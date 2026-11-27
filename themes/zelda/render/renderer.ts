/**
 * Neon Shrine renderer. The world is drawn at logical resolution (1 px =
 * 1/16 tile) into an offscreen buffer, lit with a multiply light map, then
 * scaled by a whole number onto the screen canvas. Neon bloom is added at
 * screen resolution on top, then the HUD layer (also logical pixels).
 *
 * The view size follows the screen: at least 13×11 tiles, more on big or
 * tall screens, so portrait phones see a tall slice of the world instead of
 * a letterboxed box. On a tall screen a small interior is zoomed until it
 * fills the height (keeping at least 10 tiles across), so a room is not a
 * thin strip between black bands. Read-only on the game state.
 *
 * Exits (cabinets, board, kiosk, terminals, signs) and their labels live in
 * `exits.ts`; the neon lettering of `MapDef.decals` in `decals.ts`. Anything
 * that glows by itself lands in `emit` and is left at full brightness by the
 * light map.
 */
import type { Dir, Enemy, GameEvent, GameState, ViewSide, World } from '../types'
import { BOMB_FUSE, FLIP_CHOP, ROLL_TIME, SPIN_TIME, TEMPEST, TILE, WARP_TIME, WINDUP, roomed } from '../types'
import { airTime, BIG, bossOpen, cameraFor, cellDef, cellIndex, cellIsDark, heroZ, HOURS, mapDef, mapInfo, shardPos, swingAngle, swingDur, toughOpen } from '../engine/index'
import { itemSpriteName } from './itemIcon'
import { dayLook, nightOf, type DayLook } from './daylight'
import { drawText, textWidth } from '../../base/pixel/font'
import { CALLOUT_TIME, drawBanner, drawCallout, drawDialog, drawHud, drawMoves, drawPause, drawSlow, drawViewStrip, hudScale, NEON_SKIN, type Callout, type HudSkin, type MenuPage } from './hud'
import { drawMapPage, targetOnScreen } from './mapPage'
import { drawItemsPage } from './itemsPage'
import { drawLogPage, type ChangeLog } from './logPage'
import type { HudKeys } from '../keys'
import { AMBIENCE } from './tones'
import { bloomDecals, drawDecals, lightDecals } from './decals'
import { BEACH_BEAT, createLabels, drawExitLabels, queueExits, type Emit } from './exits'
import { copySprite, doubledSprite, echoSprite, frameCount, heroStyle, makeCanvas, setHeroColors, setHeroLook, silhouette, sprite, spriteRows, spriteT } from './sheet'
import { drawFloorMarks } from './floorMarks'
import { drawClock, drawRings, drawTurban } from './steamPaint'
import { drawHeapFloor, drawLatchLines, queueHeap } from './heapMarks'
import { toDir } from '../engine/util'
import { PARROT } from '../engine/parrot'
import { folkTop } from './iso/folk'
import type { HeroLook } from './heroLook'
import type { HeroColors } from '../../miniworld/types'
import { chestStar, createTileLayer, drawBlock, drawLiveTiles, hash2, updateTileLayer, type Light, type TileLayer } from './tiles'
import { MOOD, realmLook } from './looks'
import { drawPsiBlock } from './labTiles'
import { drawHookChain, drawStaticMood, facingDir, fireflies, queueLuna, queueProps, setLunaFacing, type Item } from './wild'
import { drawBeams, drawGas, drawMovingMirror, queuePuzzles } from './puzzleTiles'
import { ease } from './iso/project'
import { createTurn, createTurnClock } from './turn'
import { createShade } from './shade'
import { PAL } from './sprites'
import { bladeHeading } from './bladeAngles'
import { queueWildlife } from './wildlife'
import { queueLife } from './life'
import { frontierNpcLook, type FrontierCreature } from './frontierSprites'
import { treeNow } from './tree'
import { paintSide, sideScale, type SideKit } from './side'
import { isEngineId, resolveParams, type EngineId, type ParamValues } from '../viewParams'

/** NPC looks that live on the town's beach and move on its slow beat. */
const BEACH_LOOKS: ReadonlySet<string> = new Set(['hippie', 'smoker', 'guitar', 'sleeper', 'twirler', 'bonfire'])

/** Seconds a fallen foe's white shape bursts before its poof (`Enemy.deathT`). */
const DEATH_POP = 0.18

/** Frontier skins for existing field enemy behaviours. The boss art has its own future encounters. */
const FRONTIER_FOE_LOOKS: Record<string, Partial<Record<Enemy['kind'], FrontierCreature>>> = {
  lumenby: { skull: 'timberbeetle', zapper: 'orehopper' },
  sporelight: { sentry: 'grazer' },
  yulefjord: { skull: 'draug', dasher: 'nokk' },
  stillsand: { bat: 'stonebird' },
  rerun: { hound: 'mowermob', drone: 'flamingomob', spitter: 'mailboxmob' },
}

const T = TILE

/** A tough foe's colours (its outline and bar, and a boss's bar): pink, gold while it is open; the bar's rim and what it has lost. */
const TOUGH_PINK = '#ff2fa0'
const TOUGH_GOLD = '#ffd23f'
const TOUGH_RIM = '#0b0616'
const TOUGH_LOST = '#3b2466'

/**
 * How a view draws the figures the bars stand over: `art` how much of the isometric figure shows (0 the classic
 * sprite, 1 the view's own art, between in a turn), `lift` the ground's height under a foot point, in tiles.
 */
export interface FoeView { art: number; lift?: (x: number, y: number) => number }

export interface FrameUI {
  paused: boolean
  /** The pause screen is asking "start over?". */
  confirmReset: boolean
  /** Game sound is off (shown on the pause screen). */
  muted: boolean
  reducedMotion: boolean
  /** The shell holds the world still for a hit's weight (hitstop): struck foes shiver in place. */
  hitStop?: boolean
  touch: boolean
  /** Touch stick in CSS px relative to the canvas. */
  stick: { ox: number; oy: number; dx: number; dy: number } | null
  /** Attract mode: no hero, no HUD, camera from `cam` (tiles, top-left). */
  attract: boolean
  cam: { x: number; y: number } | null
  banner: { text: string; t: number } | null
  keys: HudKeys
  /** The current view's name, for the pause screen. */
  view?: string
  /** The menu's page while paused: ITEMS (the default), MOVES (`hud.ts` drawMoves) or MAP (`mapPage.ts`). */
  page?: MenuPage
  /** The view's turn for the map (0 classic, 1 isometric): `viewState().turn`. */
  turn?: number
  /** The top of the touch deck's buttons while paused, in CSS px from the canvas's top (null: no deck): the MAP page keeps above it. */
  deckTop?: number | null
  /** The cell of the ITEMS page's grid the cursor stands on (`itemsPage.ts`). */
  itemCursor?: number
  /** What the LOG page shows (`logPage.ts`): the change list, the page of it and the dev switch. */
  log?: { changes: ChangeLog; page: number; dev: boolean }
  /** The keyboard's focus is on the MAP page's Prism button: the page rings the Prism in gold. */
  prismFocus?: boolean
  /** The view rule turning on its own (`CornerState.rule`): the MAP page's Prism names it. */
  rule?: ViewSide | null
  /** The view strip: every view in the round and which one is on, shown for a moment after a change. */
  strip?: { views: ReadonlyArray<{ name: string; tag: string }>; at: number; t: number } | null
}

type CssBox = { x: number; y: number; w: number; h: number }
export interface LogTargets { page: number; pages: number; older: CssBox | null; newer: CssBox | null; dev: CssBox }

/** Puts a world point (tiles; `z` tiles up off the ground) on the scene (logical px). */
export type Place = (x: number, y: number, z?: number) => Vec
export interface Vec { x: number; y: number }
/** A queued thing (see `Item`); `hero` marks the hero's own. */
/** `tree`: the beach tree, which the 16-bit look paints as its own (`iso/flora.ts` `floraWithVisitor`, part 17). */
export type SceneItem = Item & { hero?: boolean; tree?: boolean }

/**
 * An effect in the world (tiles), drawn over the lit scene. `star`: an impact's four rays; `slash`: a cut across a
 * foe along (vx, vy) (it does not move); `dust`: a puff that rises off the ground. `lift`: classic px up the screen.
 */
/** `line`: the HOP CUT's streak, from (x, y) by (vx, vy). */
interface Fx { kind: 'sprite' | 'spark' | 'leaf' | 'ring' | 'bit' | 'text' | 'star' | 'slash' | 'dust' | 'line'; x: number; y: number; vx: number; vy: number; t: number; life: number; name?: string; frames?: number; color: string; size: number; text?: string; lift?: number }

/** A short burst of light on the ground (a blow landing, a kill, a roll), on the renderer's clock. */
interface Pulse { x: number; y: number; r: number; color: string; a: number; at: number; life: number }

/** The dark a visit begins in (the page's own colour behind the canvas), and how long the first picture takes to come up out of it. */
const NIGHT = '#0b0616'
const DAWN_MS = 320
/**
 * A turn between views, in seconds, and the share of it at the classic end that is the hand-off: there nothing
 * turns yet (or any more), and the classic picture and the view's own, which light the same scene differently,
 * are faded one into the other. Without it the light of the whole picture changes in one frame, and on the way
 * out that frame comes after everything has come to rest.
 */
const TURN_S = 0.7
const HANDOFF = 0.1
const AMBIENT = { overworld: '#8e82c4', dungeon: '#7d6fb4', interior: '#c8b4dc', side: '#c8bcf4', dark: '#1d1433', caveDark: '#2a1e44' }
/** A dark room to a hero who owns the storm lamp: halfway between the black and a dungeon's own light (`CellDef.dark`, docs/games/neon-shrine-lighthouse.md). */
const AMBIENT_DIM = '#4d4274'

export interface SafeInsets { top: number; right: number; bottom: number; left: number }
const NO_INSETS: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 }

export interface Renderer {
  /** `safe`: the screen's notch and status-bar insets in CSS px; the world runs under them, the HUD stays clear. */
  resize(cssW: number, cssH: number, dpr: number, safe?: SafeInsets): void
  draw(s: GameState, ui: FrameUI, dt: number): void
  onEvents(ev: GameEvent[]): void
  /** View size in tiles (for the attract camera). */
  viewTiles(): { w: number; h: number }
  /** Dress the hero in a made figure's colours (null: as drawn). */
  setHeroColors(colors: HeroColors | null): void
  /** The hero's look from the NEW LOOK booth (null: none chosen); it is worn instead of a figure's colours. */
  setHeroLook(look: HeroLook | null): void
  /** Add another engine for drawing the frame (`viewParams.ts` lists them). The classic one is built in. */
  addView(id: string, make: ViewFactory): void
  hasView(id: string): boolean
  /**
   * Turn to an engine ('classic' or an added one). `instant` skips the turn. An engine that cannot draw yet (its
   * shaders are compiling) is waited for on the classic picture, and comes in when it can (`turn.ts`).
   */
  setView(id: string, instant?: boolean): void
  /**
   * The engine a visit starts in, before anything has been drawn. For `nightMs` the screen stays dark while the
   * engine is not ready, and the picture then comes up out of the dark; if it takes longer, the classic picture
   * comes up instead, and the engine turns in from it when it is here (`turnIn`), or takes over at once.
   */
  arrive(id: string, nightMs: number, turnIn: boolean): void
  /** The next frame is a visit's first: it comes up out of the dark over a moment, whichever view draws it. */
  dawn(): void
  /** The values an engine draws with from now on (`viewParams.ts`); what is left out is the engine's own. */
  setParams(id: EngineId, values?: ParamValues): void
  /**
   * The view we are in or heading for, how far the turn has come (0 classic … 1), the angle the controls turn by
   * now (radians), whether a turn is in flight, whether it waits for a view that is not ready, whether the
   * screen is kept dark for a view a visit starts in (`arrive`), whether the first picture is still coming
   * up out of the dark (`dawn`: a picture that is drawn once and left would keep the dark over it), and how many
   * views have been put away for throwing (`failed`: when it grows, the classic view has taken over).
   */
  viewState(): { id: string; k: number; turn: number; turning: boolean; waiting: boolean; dark: boolean; dawn: boolean; failed: number }
  /** The page is done with the renderer: every view lets go of what it holds. */
  dispose(): void
  /**
   * CSS px to one pixel of a fine HUD (a skin at two px to the classic px), on this screen and in this map.
   * The shell's HTML sizes its 16-bit dress by it, so its letters are as large as the canvas's. 0 where a
   * classic px is a single device px: there a fine skin gives way to its coarse stand-in, and the shell's
   * HTML keeps the classic dress too.
   */
  fineUnit(): number
  /** Where the MAP page last painted its Prism, as the box of a button over it in CSS px from the canvas's top left; null when that page was not painted, or has no Prism. */
  pagePrism(): { x: number; y: number; w: number; h: number } | null
  /** The nine cells of the ITEMS page as last painted, in CSS px from the canvas's top left; null: the page is not up. */
  itemCells(): Array<{ x: number; y: number; w: number; h: number }> | null
  /** The LOG page's buttons as last painted, in CSS px from the canvas's top left, and which of how many pages is up (null: not on screen). */
  logTargets(): LogTargets | null
}

/**
 * A way of drawing the frame other than the classic one. `k` runs from 0 (it
 * must look like the classic view there) to 1 (itself): the renderer turns
 * one into the other with it. `turn` is how far the picture is rotated from
 * the classic one at k = 1 (radians), so the controls can follow.
 */
export interface View {
  draw(s: GameState, ui: FrameUI, dt: number, k: number): void
  turn: number
  /**
   * Can the view draw itself now? Asked every frame before `draw`; while it says no, the classic view draws and
   * the turn waits. The view may do a slice of what it is waiting for in the call: a short one while a picture
   * is on screen, a longer one when `hurry` says the screen is dark anyway. `s` is given while the view is not
   * on screen: the game its first frame will show, so what that frame needs can be made ahead too. (None:
   * always ready.)
   */
  ready?(hurry: boolean, s?: GameState): boolean
  /** Let go of what the view holds outside the page's own memory (a GPU context). */
  dispose?(): void
}
export type ViewFactory = (kit: Kit) => View

/** What happens to the finished picture on its way to the screen; 1 is the classic amount of each. */
export interface Finish {
  scanlines: number
  bloom: number
  vignette: number
  /** The picture stretched up softly instead of in hard pixels, with a little sideways smear (a 64-bit machine's video filter), 0–1. None: hard. */
  smooth?: number
}

/** The top-down picture before the light falls on it, as `Kit.classic` paints it. */
export interface Picture {
  /** The camera, px. */
  cx: number
  cy: number
  lights: Light[]
  /** The people and things in it, for their shadows. */
  items?: SceneItem[]
}

/** The frame's parts, as the renderer hands them to a view. Sizes are logical px. */
export interface Kit {
  world: World
  size(): { vw: number; vh: number; decalMaxW: number }
  /** The screen itself, for a view that finishes its own picture: device px, the whole-number scale and where the scene lands. */
  screen(): { g: G; W: number; H: number; scale: number; ox: number; oy: number; dpr: number }
  sceneCanvas(): HTMLCanvasElement
  /**
   * The values this engine draws with now (`viewParams.ts`), and the finish
   * among them. Outdoors after the prism the sun, shadow and sky values are
   * the hour's (`render/daylight.ts`); `own` gives the view's own.
   */
  params(id: EngineId, own?: boolean): ParamValues
  /** The hour's light outdoors for this engine (null: no day here, the view's own dusk). */
  day(id: EngineId): DayLook | null
  finish(id: EngineId): Finish
  /**
   * The classic picture in parts, for a view that keeps the top-down camera and
   * changes what is done with it: `world` paints tiles and everything standing
   * (unlit) on the scene, `light` fills the light map and returns the ambient
   * colour, `glows` draws what shines by itself, `rooms` covers what lies
   * outside the hero's dungeon room.
   */
  classic: {
    world(s: GameState, ui: FrameUI, ground?: string): Picture
    light(s: GameState, ui: FrameUI, pic: Picture): string
    glows(g: G, s: GameState, ui: FrameUI, dt: number, pic: Picture, still?: boolean): void
    rooms(g: G, s: GameState, pic: Picture, color: string): void
    /** The picture's lights on the bloom layer, for `present`. */
    bloom(bg: G, s: GameState, ui: FrameUI, pic: Picture): void
  }
  /** The scene the view draws on, and the light map multiplied onto it. Both change when the scale does: ask each frame. */
  scene(): G
  lightMap(): { g: G; canvas: HTMLCanvasElement }
  time(): number
  glow(color: string): HTMLCanvasElement
  /** Rectangles that glow by themselves (screens), filled by `queue`. */
  emit: Emit[]
  /** Where the classic camera would look: the middle of its view, in tiles. */
  classicFocus(s: GameState, ui: FrameUI): Vec
  queue(g: G, s: GameState, ui: FrameUI, cx: number, cy: number, qw: number, qh: number, lights: Light[], flat?: G): SceneItem[]
  /**
   * What is painted flat on the floor under everything that stands (the foes' stencils, pot stands, the echo's ring),
   * for a camera at (cx, cy) px: onto the view's ground picture once whatever stands has been taken off it.
   */
  floorMarks(g: G, s: GameState, ui: FrameUI, cx: number, cy: number): void
  ambient(s: GameState, ui: FrameUI, lights: Light[]): string
  projectiles(g: G, s: GameState, place: Place, dirOf?: (vx: number, vy: number) => Vec): void
  /** The effects that glow by themselves, and the tough foes' and bosses' bars (`foes`: how this view draws their figures). */
  fx(g: G, s: GameState, dt: number, place: Place, paused: boolean, squash?: number, foes?: FoeView): void
  /**
   * The camera's kick from the last blow, in tiles (world axes): the picture leans that far along the blow and
   * settles in a few hundredths of a second. Zero under reduced motion.
   */
  nudge(): Vec
  lakeSun(g: G, s: GameState, cx: number, cy: number, reduced: boolean, qw: number, qh: number): void
  staticMood(s: GameState): boolean
  /** How the view shows a world angle (blades swing by it); null: as it is. */
  setAim(fn: ((a: number) => number) | null): void
  /**
   * How far the view's camera is turned from looking north (radians, as `Pose.yaw`; 0: as the classic picture).
   * Figures with four ways (the hero, foes, Luna) then show the side the camera sees: a hero walking away shows
   * their back.
   */
  setFacing(yaw: number): void
  /**
   * A view that draws the hero's body and blade itself says so here: `queue`'s hero item then draws only
   * what the hero holds up (a pot, a found thing) and still adds the blade's light.
   */
  setHeroBare(on: boolean): void
  /**
   * The picture on the screen now, laid over the frames that follow and fading out over `seconds`: a dissolve, for
   * a change a view makes without moving its camera (a look's change under reduced motion).
   */
  crossFade(seconds: number): void
  /** What the hero wears: the booth's look, a made figure's colours on the drawn shape, or the drawn hero. */
  heroLook(): HeroLook
  /** The scene step (px) from one world point to another, for a drawing that reaches from its own thing to a second one (the twins' tether, the king's shards); null: the classic step. */
  setSpan(fn: ((x1: number, y1: number, x2: number, y2: number) => Vec) | null): void
  /** `into`: the colour a fade ends in (the classic night, or a view's own sheet). */
  flashFade(g: G, s: GameState, ui: FrameUI, dt: number, into?: string): number
  /**
   * `picture`: the view's own finished picture, finer than the scene (any whole multiple, or a size that is a whole
   * number of device px a px), laid where the scene would be instead of it.
   */
  present(fade: number, glows: (bg: G) => void, finish?: Finish, picture?: HTMLCanvasElement): void
  /**
   * The HUD in a skin (none: the classic neon one). `from`: the skin this one
   * is taking over from and how far it has (0–1), for a view that turns in
   * from another dress: the old one fades out over the first half and this
   * one in over the second, instead of one giving way to the other in a
   * single frame. Their letters are never on top of each other.
   */
  hudLayer(s: GameState, ui: FrameUI, dt: number, cx: number, cy: number, heroY: number, skin?: HudSkin, from?: { skin: HudSkin; mix: number }): void
  /**
   * Where a skin's HUD lies on the screen: device px per HUD logical px, where
   * its logical origin lands (device px) and its logical size. The classic HUD
   * shares the scene's grid; a skin at density 2 has its own scale when the
   * screen's is odd, and then its area is not the scene's. For a view that
   * places something of its own by the HUD: (device − ox) / scale.
   */
  hudSpace(skin?: HudSkin): { scale: number; ox: number; oy: number; vw: number; vh: number }
}

type G = CanvasRenderingContext2D

export function createRenderer(canvas: HTMLCanvasElement, world: World): Renderer {
  const screen = canvas.getContext('2d')!
  let scene = makeCanvas(1, 1)
  let sg = scene.getContext('2d')!
  let light = makeCanvas(1, 1)
  let lg = light.getContext('2d')!
  let hud = makeCanvas(1, 1)
  let hg = hud.getContext('2d')!
  /** The HUD canvas of a skin with finer pixels than the scene's (`fineHud`); none until one is worn. */
  let hudFine: HTMLCanvasElement | null = null
  let hgFine: G | null = null
  let bloom = makeCanvas(1, 1)
  let bg = bloom.getContext('2d')!
  let W = 1
  let H = 1
  let insets: SafeInsets = NO_INSETS
  let scale = 1
  let vw = 1
  let vh = 1
  let dpr = 1
  /** Scale from the screen alone; `scale` may be larger for a small room. */
  let baseScale = 1
  let layoutMap = ''
  /** Widest a decal may be; a scale-3 name steps down on a narrow phone. */
  let decalMaxW = Infinity
  let layer: TileLayer | null = null
  let time = 0
  /** The frame's reduced-motion setting (`begin`), for parts drawn without the frame's UI. */
  let frameReduced = false
  let fx: Fx[] = []
  /** Light bursts on the ground (`Pulse`), pushed with the frame's lights in `ambient`. */
  let pulses: Pulse[] = []
  /** The camera's kick (`Kit.nudge`): tiles along the blow, when it began, how long it settles. */
  let kick = { x: 0, y: 0, at: -1, life: 0.09 }
  /** Effects at the hero, waiting for the frame's state: a roll's dust, a lunge's. */
  let heroFx: Array<'roll' | 'lunge'> = []
  /** Frames drawn (it counts on in a hitstop, when the clock stands still): struck foes shiver by it. */
  let frameN = 0
  let frameHitStop = false
  let flashT = 0
  /** The MAP page's Prism as last painted (`Renderer.pagePrism`). */
  let prismAt: { x: number; y: number; w: number; h: number } | null = null
  /** The ITEMS page's cells as last painted (`Renderer.itemCells`). */
  let cellsAt: Array<{ x: number; y: number; w: number; h: number }> | null = null
  /** The LOG page's buttons as last painted (`Renderer.logTargets`). */
  let logAt: LogTargets | null = null
  let flashColor = '#ffffff'
  const glowCache = new Map<string, HTMLCanvasElement>()
  let scan: CanvasPattern | null = null
  const labels = createLabels()
  const shade = createShade(world)
  const emit: Emit[] = []

  function glow(color: string): HTMLCanvasElement {
    let c = glowCache.get(color)
    if (c) return c
    c = makeCanvas(64, 64)
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, color)
    grad.addColorStop(0.35, color + 'aa')
    grad.addColorStop(1, color + '00')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    glowCache.set(color, c)
    return c
  }

  function resize(cssW: number, cssH: number, ratio: number, safe: SafeInsets = NO_INSETS) {
    dpr = Math.max(1, Math.min(3, ratio || 1))
    W = Math.max(1, Math.round(cssW * dpr))
    H = Math.max(1, Math.round(cssH * dpr))
    insets = safe
    canvas.width = W
    canvas.height = H
    // Whole-number scale showing at least 13×11 tiles (and at most ~28 wide).
    baseScale = Math.max(1, Math.floor(Math.min(W / (13 * T), H / (11 * T))))
    while (W / baseScale > 30 * T) baseScale++
    layoutMap = ''
    setScale(baseScale)
  }

  /** The scale for a map: the screen's, or larger for an interior that would leave the tall view half empty. */
  function scaleFor(mapId: string): number {
    const def = mapDef(world, mapId)
    if (def?.kind === 'side') return sideScale(W, H, def)
    if (!def || def.kind !== 'interior' || H <= W) return baseScale
    const rows = def.rows.length
    if (rows * T * baseScale >= H * 0.8) return baseScale
    const byHeight = Math.floor(H / (rows * T))
    const byWidth = Math.floor(W / (10 * T))
    return Math.max(baseScale, Math.min(byHeight, byWidth))
  }

  function setScale(next: number) {
    scale = next
    vw = Math.ceil(W / scale)
    decalMaxW = vw - 8
    vh = Math.ceil(H / scale)
    scene = makeCanvas(vw, vh)
    sg = scene.getContext('2d')!
    light = makeCanvas(vw, vh)
    lg = light.getContext('2d')!
    hud = makeCanvas(vw, vh)
    hg = hud.getContext('2d')!
    bloom = makeCanvas(vw, vh)
    bg = bloom.getContext('2d')!
    for (const g of [sg, lg, hg, screen]) g.imageSmoothingEnabled = false
    // Scanline pattern at screen resolution.
    const p = makeCanvas(1, Math.max(2, scale))
    const pg = p.getContext('2d')!
    pg.fillStyle = 'rgba(0,0,0,0.13)'
    pg.fillRect(0, 0, 1, Math.max(1, Math.floor(scale / 3)))
    scan = screen.createPattern(p, 'repeat')
  }

  function viewTiles() {
    return { w: vw / T, h: vh / T }
  }

  // ---------------------------------------------------------------------------
  // Events → effects
  // ---------------------------------------------------------------------------

  /** A four-frame effect over `life` seconds; frames the studio added keep the time per frame. */
  function fxSprite(name: string, life: number, x: number, y: number, t = 0): Fx {
    const frames = frameCount(name, 4)
    return { kind: 'sprite', name, frames, x, y, vx: 0, vy: 0, t, life: (life * frames) / 4, color: '', size: 1 }
  }

  function spark(x: number, y: number, n: number, color: string, speed = 5, life = 0.35) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.4 + Math.random() * 0.8)
      fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: life * (0.6 + Math.random() * 0.6), color, size: 1 })
    }
  }

  function pulse(x: number, y: number, r: number, color: string, life: number, a = 1) {
    pulses.push({ x, y, r, color, a, at: time, life })
    if (pulses.length > 24) pulses.shift()
  }

  /** The impact of a blow: sparks thrown along it, a star, a ring, and on a heavy blow a gold ring and a cut across. */
  function impact(x: number, y: number, dx: number, dy: number, heavy: boolean, crit: boolean, color: string) {
    const n = heavy ? 9 : 6
    const a0 = Math.atan2(dy, dx)
    for (let i = 0; i < n; i++) {
      const a = a0 + (Math.random() - 0.5) * 1.2
      const v = 7 + Math.random() * 3
      fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.14 + Math.random() * 0.1, color: i % 3 ? color : '#ffffff', size: 1, lift: 5 })
    }
    fx.push({ kind: 'star', x, y, vx: 0, vy: 0, t: 0, life: crit ? 0.12 : 0.08, color: crit ? '#ffd23f' : color, size: crit ? 11 : heavy ? 9 : 8, lift: 5 })
    fx.push({ kind: 'ring', x, y, vx: 0, vy: 0, t: 0, life: 0.15, color: '#fff4ff', size: 0.5, lift: 5 })
    if (heavy || crit) {
      fx.push({ kind: 'ring', x, y, vx: 0, vy: 0, t: -0.03, life: 0.2, color: '#ffd23f', size: 0.8, lift: 5 })
      fx.push({ kind: 'slash', x, y, vx: -dy, vy: dx, t: 0, life: 0.1, color: arc ? '#ffd23f' : '#2ff3ff', size: 14, lift: 5 })
    }
  }

  function dust(x: number, y: number, n: number, back: { x: number; y: number } = { x: 0, y: 0 }) {
    for (let i = 0; i < n; i++) {
      fx.push({ kind: 'dust', x: x + (Math.random() - 0.5) * 0.4, y: y + 0.3 + (Math.random() - 0.5) * 0.2, vx: back.x * (0.8 + Math.random()) + (Math.random() - 0.5) * 1.2, vy: back.y * (0.8 + Math.random()) + (Math.random() - 0.5) * 0.6, t: -i * 0.02, life: 0.3 + Math.random() * 0.15, color: '#cfc6ff', size: i % 2 ? 2 : 1, lift: 0 })
    }
  }

  function onEvents(ev: GameEvent[]) {
    for (const e of ev) {
      switch (e.type) {
        case 'hit': {
          const color = e.kind === 'king' ? '#ff2fa0' : arc ? '#ffd23f' : '#2ff3ff'
          if (e.dx === undefined || e.dy === undefined) { spark(e.x, e.y, e.killed ? 10 : 6, e.kind === 'king' ? '#ff2fa0' : '#fff4ff', 6); pulse(e.x, e.y, 2.4, '#fff4ff', 0.1); break }
          impact(e.x, e.y, e.dx, e.dy, !!e.heavy, !!e.crit, color)
          if (e.killed) spark(e.x, e.y, 6, color, 6)
          pulse(e.x, e.y, 2.4, '#fff4ff', 0.1)
          if (e.heavy) pulse(e.x, e.y, 3.5, arc ? '#ffd23f' : '#2ff3ff', 0.16)
          // The camera leans along the blow: harder for the finisher and a kill.
          const k = 2 * (e.heavy ? 2 : 1) * (e.killed ? 1.5 : 1) / T
          kick = { x: e.dx * k, y: e.dy * k, at: time, life: e.heavy ? 0.12 : 0.09 }
          break
        }
        case 'swing': {
          if (e.n === 2) heroFx.push('lunge')
          // The HOP CUT springs back in: a streak where it goes (`engine/moves.ts`).
          const sp = e.spring
          if (sp) {
            fx.push({ kind: 'line', x: sp.x, y: sp.y, vx: Math.cos(sp.a) * sp.d, vy: Math.sin(sp.a) * sp.d, t: 0, life: 0.26, color: arc ? '#ffd23f' : '#2ff3ff', size: 1, lift: 7 })
            dust(sp.x, sp.y, 4, { x: -Math.cos(sp.a) * 2, y: -Math.sin(sp.a) * 2 })
          }
          break
        }
        case 'roll': heroFx.push('roll'); break
        // The acrobatics (`engine/moves.ts`): off the ground, down again.
        case 'air':
          heroFx.push(e.kind === 'comet' ? 'lunge' : 'roll')
          break
        case 'touchdown': {
          dust(e.x, e.y, e.heavy ? 8 : e.kind === 'hop' ? 3 : 4)
          pulse(e.x, e.y, e.heavy ? 2.2 : e.kind === 'hop' ? 1 : 1.4, arc ? '#ffd23f' : '#2ff3ff', e.heavy ? 0.22 : 0.12)
          if (e.kind === 'flip') {
            chopAt = { x: e.x, y: e.y, a: e.a, at: time }
            fx.push({ kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.2, color: '#fff4ff', size: FLIP_CHOP.ring * 0.75, lift: 0 })
            kick = { x: Math.cos(e.a) * 3 / T, y: Math.sin(e.a) * 3 / T, at: time, life: 0.1 }
          }
          break
        }
        case 'move':
          // The special moves call their name every time; the chain and the spin only the first and the mastering one.
          if (e.first || e.mastered || (e.id !== 'triple' && e.id !== 'whirl')) callout = { id: e.id, t: 0, first: e.first, mastered: e.mastered }
          break
        case 'slip':
          flashT = 0.1
          flashColor = '#2ff3ff'
          fx.push({ kind: 'ring', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.35, color: '#2ff3ff', size: 1.4, name: 'hero' })
          fx.push({ kind: 'star', x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.14, color: '#2ff3ff', size: 10, lift: 6 })
          break
        case 'kill':
          fx.push(fxSprite('poof', 0.36, e.x, e.y, -0.1))
          spark(e.x, e.y, 8, '#ff2fa0', 4, 0.5)
          pulse(e.x, e.y, 3, '#ff2fa0', 0.2)
          if (e.kind === 'king' || e.kind === 'knight' || e.kind === 'mixtral' || e.kind === 'parrot') {
            for (let i = 0; i < 6; i++) fx.push(fxSprite('boom', 0.5, e.x + (Math.random() - 0.5) * 2.5, e.y + (Math.random() - 0.5) * 2, -i * 0.18))
            flashT = 0.5
            flashColor = '#ffffff'
          }
          break
        case 'clank':
          spark(e.x, e.y, 5, '#ffd23f', 5, 0.25)
          fx.push({ kind: 'star', x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.08, color: '#ffd23f', size: 7, lift: 5 })
          pulse(e.x, e.y, 1.8, '#ffd23f', 0.12)
          break
        case 'cut':
          for (let i = 0; i < 6; i++) fx.push({ kind: 'leaf', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4, t: 0, life: 0.5 + Math.random() * 0.3, color: e.tile === '*' ? '#46b595' : '#56c9b8', size: 1 })
          break
        case 'shatter':
          for (let i = 0; i < 7; i++) fx.push({ kind: 'leaf', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 4, t: 0, life: 0.45, color: e.kind === 'pot' ? '#e07a4e' : '#8f86b8', size: 2 })
          break
        case 'boom':
          fx.push(fxSprite('boom', 0.5, e.x, e.y))
          spark(e.x, e.y, 12, '#ff8a3d', 7, 0.45)
          pulse(e.x, e.y, 4, '#ff8a3d', 0.25)
          break
        case 'hurt': flashT = 0.12; flashColor = '#ff3b5c'; break
        case 'shock': flashT = 0.16; flashColor = '#b6ff4a'; spark(e.x, e.y, 10, '#b6ff4a', 7); pulse(e.x, e.y, 3, '#b6ff4a', 0.18); break
        case 'chest': spark(e.x, e.y - 0.3, 14, '#ffd23f', 4, 0.6); pulse(e.x, e.y - 0.3, 3, '#ffd23f', 0.3); break
        case 'itemGet': fx.push({ kind: 'ring', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.6, color: '#ffd23f', size: 1, name: 'hero' }); break
        case 'collect': fx.push({ kind: 'ring', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.25, color: e.kind === 'heart' ? '#ff2fa0' : e.kind === 'key' ? '#ffd23f' : '#b6ff4a', size: 0.5, name: 'hero' }); break
        case 'unlock': case 'gate': spark(e.x, e.y, 12, '#ffd23f', 3, 0.6); break
        case 'crystal': flashT = 0.08; flashColor = e.state === 'pink' ? '#ff2fa0' : '#2ff3ff'; break
        case 'reflect': spark(e.x, e.y, 6, '#2ff3ff', 5); pulse(e.x, e.y, 2, '#2ff3ff', 0.12); break
        case 'discHit': spark(e.x, e.y, 6, '#2ff3ff', 4); pulse(e.x, e.y, 2, '#2ff3ff', 0.12); break
        case 'charged': fx.push({ kind: 'ring', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.3, color: '#2ff3ff', size: 0.6, name: 'hero' }); break
        case 'spin': fx.push({ kind: 'ring', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: SPIN_TIME, color: '#2ff3ff', size: 1.6, name: 'hero' }); break
        case 'bossPhase': flashT = 0.3; flashColor = '#ff2fa0'; break
        // The Parrot's move comes: stars along its blade, a ring where it spins or lands, a burst where it rushes off.
        case 'recited':
          if (e.move === 'C') for (let i = -2; i <= 2; i++) { const a = e.a + (i / 5) * PARROT.cut.arc; fx.push({ kind: 'star', x: e.x + Math.cos(a) * 1.7, y: e.y + Math.sin(a) * 1.7, vx: 0, vy: 0, t: 0, life: 0.14, color: '#ff8ae0', size: 5, lift: 5 }) }
          else if (e.move === 'R') spark(e.x, e.y, 10, '#ff8ae0', 5, 0.35)
          else fx.push({ kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.3, color: '#ff8ae0', size: e.move === 'S' ? PARROT.spin : PARROT.hop.r })
          pulse(e.x, e.y, 2.4, '#ff2fa0', 0.16)
          break
        case 'won': flashT = 1; flashColor = '#ffd23f'; break
        // An echo left: a ring where it stands; its blows flash there; a pot back on its stand.
        case 'echo': fx.push({ kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.45, color: '#2ff3ff', size: 1 }); pulse(e.x, e.y, 2.4, '#2ff3ff', 0.25); break
        // THE NO met a blow: a gold ring bursts where it met it (the ring is the clue; the sound only confirms).
        case 'refuse':
          fx.push({ kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.5, color: '#ffd23f', size: 1.6, lift: 5 })
          fx.push({ kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, t: -0.08, life: 0.4, color: '#fff4ff', size: 0.9, lift: 5 })
          spark(e.x, e.y, 8, '#ffd23f', 5, 0.35)
          pulse(e.x, e.y, 2.4, '#ffd23f', 0.2)
          break
        case 'echoCut': pulse(e.x, e.y, 2, '#2ff3ff', 0.14, 0.8); break
        case 'restock': spark(e.x, e.y, 8, '#ffd23f', 3, 0.4); pulse(e.x, e.y, 1.6, '#ffd23f', 0.25); break
        case 'psi': fx.push({ kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.5, color: '#ff8ae0', size: 1.2 }); break
        case 'hookHit': spark(e.x, e.y, 6, '#cfc6ff', 4, 0.3); break
        // The Magnet: cyan on the metal it takes, a grey spark at the hand for a tap that takes nothing.
        case 'latch': spark(e.x, e.y, 6, '#2ff3ff', 4, 0.3); pulse(e.x, e.y, 1.8, '#2ff3ff', 0.18); break
        case 'fizzle': spark(e.x, e.y, 5, '#8f86b8', 3, 0.25); break
        case 'iron': spark(e.x, e.y, 5, '#cfc6ff', 3, 0.2); break
        case 'lever': spark(e.x, e.y, 12, '#b6ff4a', 5, 0.5); flashT = 0.1; flashColor = '#b6ff4a'; pulse(e.x, e.y, 2.5, '#b6ff4a', 0.2); break
        case 'glyph': if (e.ok) fx.push({ kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.4, color: '#2ff3ff', size: 0.6 }); break
        case 'join': fx.push({ kind: 'ring', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.8, color: '#ff8ae0', size: 1.6, name: 'hero' }); break
      }
    }
    if (fx.length > 260) fx = fx.slice(fx.length - 260)
  }

  // ---------------------------------------------------------------------------
  // Drawing helpers
  // ---------------------------------------------------------------------------

  function dirKey(d: Dir): { key: string; flip: boolean } {
    d = facingDir(d, facing)
    if (d === 'left') return { key: 'side', flip: true }
    if (d === 'right') return { key: 'side', flip: false }
    return { key: d, flip: false }
  }

  function shadow(g: G, x: number, y: number, w: number) {
    g.fillStyle = 'rgba(8,4,20,0.42)'
    g.fillRect(Math.round(x - w / 2) + 1, Math.round(y) - 1, w - 2, 1)
    g.fillRect(Math.round(x - w / 2), Math.round(y), w, 2)
    g.fillRect(Math.round(x - w / 2) + 1, Math.round(y) + 2, w - 2, 1)
  }

  /** A thin curl of smoke off the joint: a few grey puffs rising, drifting and fading. */
  function smoke(g: G, x: number, y: number, time: number, reduced: boolean) {
    for (let i = 0; i < 4; i++) {
      const age = reduced ? i / 4 : ((time * 0.35 + i / 4) % 1)
      const px = Math.round(x + Math.sin(age * 6 + i) * 2 + age * 3)
      const py = Math.round(y - age * 14)
      g.globalAlpha = 0.75 * (1 - age)
      g.fillStyle = '#cfc6ff'
      g.fillRect(px, py, age > 0.35 ? 2 : 1, age > 0.6 ? 2 : 1)
    }
    g.globalAlpha = 1
  }

  /**
   * A sprite with its bottom centre at (x, y). `sx`, `sy`: squashed or stretched about that point, to whole px (the
   * isometric view's art follows a drawing at another size). `color`: its silhouette in that colour instead.
   */
  function put(g: G, name: string, x: number, y: number, flip = false, flash = false, sx = 1, sy = 1, color?: string) {
    const c = color ? silhouette(name, color, flip) : flash ? silhouette(name, '#ffffff', flip) : sprite(name, flip)
    if (sx === 1 && sy === 1) { g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height)); return }
    const w = Math.max(1, Math.round(c.width * sx))
    const h = Math.max(1, Math.round(c.height * sy))
    g.drawImage(c, Math.round(x - w / 2), Math.round(y - h), w, h)
  }

  /** The hero's squash and stretch: pulled down into a blow's windup, up as it lands, low into a roll, flat when hurt. */
  function heroSquash(s: GameState): [number, number] {
    const h = s.hero
    const sw = h.swing
    if (sw && sw.n !== undefined) {
      const p = sw.t / swingDur(sw)
      const fin = sw.n === 2
      if (p < WINDUP) return fin ? [1.1, 0.9] : [1.04, 0.94]
      if (p < WINDUP + 0.3) return fin ? [0.92, 1.1] : [0.96, 1.06]
      return [1, 1]
    }
    if (h.act === 'roll' && h.roll && h.roll.t < 0.06) return [1.1, 0.88]
    // Off the ground low, and down again into a crouch.
    if (h.air && h.air.t < 0.04 && h.air.kind !== 'comet') return [1.12, 0.86]
    if (h.air?.kind === 'comet') return [1.12, 0.9]
    if (chopAt && time - chopAt.at < 0.06 && time >= chopAt.at) return [1.14, 0.86]
    if (h.act === 'hurt' && h.actT < 0.08) return [1.12, 0.88]
    return [1, 1]
  }

  /** The roll's frame: tucked, then turning, a quarter in each of four. */
  function rollFrame(s: GameState): { name: string; flip: boolean } {
    const h = s.hero
    const { key, flip } = dirKey(h.dir)
    const p = h.roll ? Math.min(0.999, h.roll.t / ROLL_TIME) : 0
    return { name: `hero_${key}_roll_${Math.floor(p * 4)}`, flip }
  }

  /**
   * The hero in the air (`engine/moves.ts`), as frames of the roll and the swing: tucked, then the ball turning a
   * quarter at a time (lossless pixel turns, `rot`) the way the hero flies, then untucking. FLIP CUT raises the
   * blade overhead before the chop; the COMET is the finisher's lunge, blade first; the TEMPEST turns the swing
   * round twice; the HOP is the run's own frames, low, off the ground with both feet, low again, facing the foe.
   */
  function airFrame(s: GameState): { name: string; flip: boolean; rot: number; blade: null | { a: number; reach: number; screen?: boolean } } {
    const h = s.hero
    const a = h.air!
    const { key, flip } = dirKey(h.dir)
    const p = Math.min(0.999, a.t / airTime(a.kind))
    // The ball turns clockwise on the screen flying right, the other way flying left; a back flip the other way round.
    const sa = aim(Math.hypot(a.vx, a.vy) > 0.3 ? Math.atan2(a.vy, a.vx) : a.a)
    let spinWay = Math.cos(sa) >= 0 ? 1 : -1
    if (a.kind === 'back') spinWay = -spinWay
    const ball = (q: number) => ({ name: `hero_${key}_roll_1`, flip, rot: ((spinWay * q) % 4 + 4) % 4, blade: null })
    switch (a.kind) {
      case 'flip': case 'back': case 'spring': {
        if (p < 0.1) return { name: `hero_${key}_roll_0`, flip, rot: 0, blade: null }
        if (a.kind === 'flip' && p >= 0.72) return { name: `hero_${key}_atk_wind`, flip, rot: 0, blade: { a: -Math.PI / 2 - spinWay * 0.5, reach: 10, screen: true } }
        if (p >= 0.88) return { name: `hero_${key}_roll_3`, flip, rot: 0, blade: null }
        return ball(Math.floor(((p - 0.1) / 0.78) * 4))
      }
      case 'comet': return { name: `hero_${key}_atk_lunge`, flip, rot: 0, blade: { a: a.a, reach: 13 } }
      case 'tempest': {
        const turn = a.a + Math.PI * 2 * TEMPEST.turns * p
        const seq: Dir[] = ['down', 'left', 'up', 'right']
        const start = seq.indexOf(h.dir)
        const dd = dirKey(seq[(start + Math.floor(p * 4 * TEMPEST.turns)) % 4]!)
        return { name: `hero_${dd.key}_atk`, flip: dd.flip, rot: 0, blade: { a: turn, reach: 12 } }
      }
      case 'hop': return { name: `hero_${key}_run_${p < 0.14 ? 1 : p < 0.82 ? 2 : 4}`, flip, rot: 0, blade: null }
    }
  }

  /** A sprite stood on (x, y) as `put` stands it, turned `q` quarter turns about its middle (lossless). */
  function putRot(g: G, name: string, x: number, y: number, flip: boolean, q: number, color?: string) {
    if (!q) { put(g, name, x, y, flip, false, 1, 1, color); return }
    const c = color ? silhouette(name, color, flip) : sprite(name, flip)
    g.save()
    g.translate(Math.round(x), Math.round(y - c.height / 2))
    g.rotate((q * Math.PI) / 2)
    g.drawImage(c, -Math.round(c.width / 2), -Math.round(c.height / 2))
    g.restore()
  }

  /** The beach tree: its crown for today's deploys, one fruit per visitor on top (render/tree.ts). */
  function drawTree(g: G, x: number, y: number) {
    const t = treeNow()
    shadow(g, x, y - 1, 10)
    const left = Math.round(x - 8)
    const top = Math.round(y - 32)
    put(g, `tree_${t.stage}`, x, y)
    g.fillStyle = PAL.r!
    for (const [fx, fy] of t.fruit) g.fillRect(left + fx, top + fy, 2, 2)
  }

  function drawHero(g: G, s: GameState, cx: number, cy: number, lights: Light[]) {
    const h = s.hero
    const x = h.x * T - cx
    // In the air the figure rises off its shadow (`heroZ`, engine/moves.ts).
    const ground = h.y * T - cy + 6
    const lift = Math.round(heroZ(h) * T)
    const feet = ground - lift
    const { key, flip } = dirKey(h.dir)
    if (heroBare && (h.act === 'dead' || h.act === 'fall')) return
    if (h.act === 'dead') {
      const d = s.dying ? s.dying.t : 0
      if (d < 0.8) {
        const spin: Dir[] = ['down', 'left', 'up', 'right']
        const sd = dirKey(spin[Math.floor(d * 10) % 4]!)
        put(g, `hero_${sd.key}_0`, x, feet, sd.flip)
      } else put(g, 'hero_dead', x, feet)
      return
    }
    if (h.act === 'fall') {
      const f = Math.min(2, Math.floor(h.actT / 0.18))
      put(g, `hero_fall_${f}`, x, feet - 2)
      return
    }
    if (h.invuln > 0 && h.act !== 'get' && Math.floor(time * 20) % 2 === 0) return
    if (!heroBare) shadow(g, x, ground - 1, lift > 0 ? Math.max(6, 10 - Math.round(lift / 5)) : 10)
    if (h.act === 'air' && h.air) {
      const f = airFrame(s)
      const away = facingDir(h.dir, facing) === 'up'
      if (f.blade && away) drawBlade(g, s, x, feet - 7, lights, f.blade)
      if (!heroBare) putRot(g, f.name, x, feet, f.flip, f.rot)
      if (f.blade && !away) drawBlade(g, s, x, feet - 7, lights, f.blade)
      return
    }
    // FLIP CUT's chop, held a moment after landing.
    if (chopAt && (h.act === 'idle' || h.act === 'walk') && time - chopAt.at < 0.14 && time >= chopAt.at) {
      if (!heroBare) put(g, `hero_${key}_atk_land`, x, feet, flip, false, ...heroSquash(s))
      drawBlade(g, s, x, feet - 7, lights, { a: chopAt.a, reach: 12 })
      return
    }
    let name = `hero_${key}_0`
    let mirror = flip && h.act !== 'hurt' && h.act !== 'get'
    const [sx, sy] = heroSquash(s)
    const step = Math.floor(h.walkT * 8.5) % 4
    const walkFrame = [1, 0, 2, 0][step]!
    const speed = Math.hypot(h.vx, h.vy)
    switch (h.act) {
      case 'idle':
        // Held charge: braced low, the blade behind. Otherwise a slow breath (none under reduced motion).
        if (h.charge > 0.12 && s.inv.sword && !h.carry) name = `hero_${key}_charge`
        else if (!frameReduced && Math.floor(time / 0.7) % 2 === 1) name = `hero_${key}_idle_1`
        break
      // At full stride the run (six frames, one in the air); slowed (a held charge, a slope) the walk.
      case 'walk': name = speed >= 4.5 ? `hero_${key}_run_${Math.floor(h.walkT * 12) % 6}` : `hero_${key}_${walkFrame}`; break
      case 'swing': {
        // The chain (`COMBO`): the wind-up, then the forehand, the backhand, and the finisher's lunge and landing.
        const sw = h.swing
        const p = sw ? sw.t / swingDur(sw) : 1
        const n = sw?.n
        name = `hero_${key}_atk`
        if (n !== undefined) {
          if (p < WINDUP) name = `hero_${key}_atk_wind`
          else if (n === 1) name = `hero_${key}_atk_back`
          else if (n === 2) name = p < 0.7 ? `hero_${key}_atk_lunge` : `hero_${key}_atk_land`
        }
        break
      }
      case 'throw': case 'use': case 'hook': name = `hero_${key}_atk`; break
      case 'roll': { const r = rollFrame(s); name = r.name; mirror = r.flip; break }
      case 'spin': {
        const order: Dir[] = [h.dir, h.dir === 'down' ? 'left' : h.dir === 'left' ? 'up' : h.dir === 'up' ? 'right' : 'down']
        const p = h.spin ? h.spin.t / SPIN_TIME : 0
        const seq: Dir[] = ['down', 'left', 'up', 'right']
        const start = seq.indexOf(order[0]!)
        const dd = dirKey(seq[(start + Math.floor(p * 4)) % 4]!)
        name = `hero_${dd.key}_atk`
        if (!heroBare) put(g, name, x, feet, dd.flip)
        drawSpinBlade(g, s, x, feet - 7, lights)
        return
      }
      case 'lift': name = `hero_${key}_carry_0`; break
      case 'carry': name = `hero_${key}_carry_${h.vx || h.vy ? walkFrame % 2 : 0}`; break
      case 'push': name = `hero_${key}_push`; break
      // Hurt from every side (down is the front `hero_hurt`).
      case 'hurt': name = key === 'down' ? 'hero_hurt' : `hero_${key}_hurt`; mirror = flip; break
      case 'get': name = 'hero_get'; break
    }
    const blade = h.swing || (h.charge > 0.12 && s.inv.sword && !h.carry)
    // Blade behind the body when facing up (on the screen: a turned camera may see another side).
    const away = facingDir(h.dir, facing) === 'up'
    if (blade && away) drawBlade(g, s, x, feet - 7, lights)
    if (!heroBare) put(g, name, x, feet, mirror, false, sx, sy)
    // The Steamhouse's robe: a white wash over the figure the view draws, and a towel on the head.
    if (h.robe) {
      if (!heroBare) { g.globalAlpha = 0.5; put(g, name, x, feet, mirror, false, sx, sy, '#ffffff'); g.globalAlpha = 1 }
      drawTurban(g, x, feet)
    }
    if (blade && !away) drawBlade(g, s, x, feet - 7, lights)
    if (h.carry || h.act === 'lift') {
      const lift = h.act === 'lift' ? Math.min(1, h.actT / 0.18) : 1
      const spr = sprite(h.carry === 'rock' ? 'rock' : 'pot')
      g.drawImage(spr, Math.round(x - 8), Math.round(feet - 16 - 10 * lift - 2))
    }
    if (h.act === 'get' && s.get) {
      const icon = itemSpriteName(s.get.item)
      const spr = sprite(icon)
      g.drawImage(spr, Math.round(x - spr.width / 2), Math.round(feet - 18 - spr.height))
      lights.push({ x: h.x, y: h.y - 1.4, r: 3.5, color: '#ffd23f', a: 0.9 })
    }
  }

  let arc = false
  /** The view draws the hero's body and blade itself (`setHeroBare`). */
  let heroBare = false
  /** How far the view's camera is turned from north (`Kit.setFacing`): figures show the side it sees. */
  let facing = 0
  /** A world angle as the view shows it (the classic view: as it is). */
  let aim: (a: number) => number = a => a
  /** The scene step between two world points in a view that moves drawings (null: the classic view, where it is plain arithmetic). */
  let span: ((x1: number, y1: number, x2: number, y2: number) => Vec) | null = null
  function bladeSprite(a: number): { name: string; fh: boolean; fv: boolean } {
    const b = bladeSprite1(a)
    return arc ? { ...b, name: b.name.replace('sword_', 'sword2_') } : b
  }

  function bladeSprite1(a: number): { name: string; fh: boolean; fv: boolean } {
    return bladeHeading(a)
  }

  function blit(g: G, name: string, fh: boolean, fv: boolean, x: number, y: number) {
    const c = spriteT(name, fh, fv)
    g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2))
  }

  /**
   * The blade in the hand. `at`: where it points instead of the swing or the held charge (the air's moves): a world
   * angle, or with `screen` one on the screen (overhead, straight down: no way along the ground).
   */
  function drawBlade(g: G, s: GameState, x: number, y: number, lights: Light[], at?: { a: number; reach: number; screen?: boolean }) {
    const h = s.hero
    let wa: number
    let reach = 11
    const p = h.swing ? h.swing.t / swingDur(h.swing) : 0
    if (at) { wa = at.a; reach = at.reach }
    else if (h.swing) wa = swingAngle(h.swing, p)
    else {
      wa = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[h.dir]
      reach = 9
    }
    // The lights stand in the world, so they go by the world's angle; the sprite by the one the view shows.
    const a = at?.screen ? wa : aim(wa)
    const charged = !at && !h.swing && h.charge >= 0.55
    const hx = (x + camX) / T
    const hy = (y + camY) / T
    const color = arc ? '#ffd23f' : '#2ff3ff'
    lights.push({ x: hx + (at?.screen ? 0 : Math.cos(wa)), y: hy + (at?.screen ? 0 : Math.sin(wa)), r: charged ? 2.6 : h.swing || at ? 2.4 : 1.8, color, a: charged ? (Math.floor(time * 12) % 2 ? 1 : 0.5) : 0.7 })
    // The sweep's trail lights the ground behind the blade.
    if (h.swing && !at) for (let k = 1; k <= 2; k++) {
      const q = p - 0.12 * k
      if (q < (h.swing.n === undefined ? 0 : WINDUP)) break
      const ta = swingAngle(h.swing, q)
      lights.push({ x: hx + Math.cos(ta) * 0.9, y: hy + Math.sin(ta) * 0.9, r: 1.4, color, a: k === 1 ? 0.5 : 0.2 })
    }
    if (heroBare) return
    const bs = bladeSprite(a)
    const bx = x + Math.cos(a) * reach
    const by = y + Math.sin(a) * reach
    blit(g, bs.name, bs.fh, bs.fv, bx, by)
    if (charged && Math.floor(time * 12) % 2 === 0) {
      g.fillStyle = '#ffffff'
      const tx = Math.round(x + Math.cos(a) * 17)
      const ty = Math.round(y + Math.sin(a) * 17)
      g.fillRect(tx - 1, ty, 3, 1)
      g.fillRect(tx, ty - 1, 1, 3)
    }
  }

  /**
   * The echo (`engine/echo.ts`): the hero's own frames in two tones of cyan, see-through; while it cuts, its swing
   * frames and its blade, going the way its blow goes.
   */
  function drawEcho(g: G, s: GameState, cx: number, cy: number, lights: Light[]) {
    const e = s.echo
    if (!e) return
    const x = e.x * T - cx
    const feet = e.y * T - cy + 6
    const cut = e.cut && e.cut.t < e.cut.dur ? e.cut : null
    let way: Dir = cut ? toDir(Math.cos(cut.a), Math.sin(cut.a), e.dir) : e.dir
    let pose = '0'
    let blade: { a: number; reach: number } | null = null
    if (cut) {
      const p = Math.min(0.999, cut.t / cut.dur)
      if (cut.kind === 'swing') {
        // (Its picture starts where the hero's blow starts to cut: past the wind-up.)
        const q = WINDUP + (1 - WINDUP) * p
        blade = { a: swingAngle({ dir: way, a: cut.a, n: cut.n, side: cut.n === 1 ? -1 : 1 }, q), reach: 11 }
        pose = cut.n === 1 ? 'atk_back' : cut.n === 2 ? (q < 0.7 ? 'atk_lunge' : 'atk_land') : 'atk'
      } else if (cut.kind === 'spin' || cut.kind === 'tempest') {
        const turns = cut.kind === 'tempest' ? TEMPEST.turns : 1
        const seq: Dir[] = ['down', 'left', 'up', 'right']
        way = seq[(seq.indexOf(way) + Math.floor(p * 4 * turns)) % 4]!
        blade = { a: cut.a + Math.PI * 2 * turns * p, reach: 12 }
        pose = 'atk'
      } else {
        blade = { a: cut.a, reach: cut.kind === 'comet' ? 13 : 12 }
        pose = cut.kind === 'comet' ? 'atk_lunge' : 'atk_land'
      }
    }
    const { key, flip } = dirKey(way)
    const away = facingDir(way, facing) === 'up'
    g.globalAlpha = frameReduced ? 0.62 : 0.6 + 0.06 * Math.sin(time * 5)
    const drawIts = () => {
      if (!blade) return
      const a = aim(blade.a)
      const bs = bladeSprite(a)
      const c = echoSprite(bs.name, bs.fh, bs.fv)
      g.drawImage(c, Math.round(x + Math.cos(a) * blade.reach - c.width / 2), Math.round(feet - 7 + Math.sin(a) * blade.reach - c.height / 2))
    }
    if (away) drawIts()
    const c = echoSprite(`hero_${key}_${pose}`, flip)
    g.drawImage(c, Math.round(x - c.width / 2), Math.round(feet - c.height))
    if (!away) drawIts()
    g.globalAlpha = 1
    lights.push({ x: e.x, y: e.y - 0.3, r: blade ? 2.2 : 1.5, color: '#2ff3ff', a: blade ? 0.75 : 0.5 })
  }

  /** The still copy the Parrot leaves: its own figure in pink, see-through, horn up while its move is stencilled. */
  function drawParrotCopy(g: G, e: Enemy, x: number, feet: number) {
    const telling = e.ai.con && !e.ai.cact
    const c = copySprite(telling ? 'parrot_tell' : 'parrot_0', e.dir === 'right')
    g.globalAlpha = frameReduced ? 0.55 : 0.5 + 0.08 * Math.sin(time * 6)
    g.drawImage(c, Math.round(x - c.width / 2), Math.round(feet - c.height))
    g.globalAlpha = 1
  }

  function drawSpinBlade(g: G, s: GameState, x: number, y: number, lights: Light[]) {
    const h = s.hero
    const p = h.spin ? h.spin.t / SPIN_TIME : 0
    const base = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[h.dir]
    const a = aim(base) + p * Math.PI * 2
    lights.push({ x: h.x, y: h.y, r: 3.2, color: '#2ff3ff', a: 0.8 })
    if (heroBare) return
    const bs = bladeSprite(a)
    blit(g, bs.name, bs.fh, bs.fv, x + Math.cos(a) * 12, y + Math.sin(a) * 11)
  }

  function enemySprite(e: Enemy, realm?: string): { name: string; flip: boolean } {
    // Each figure steps through its own number of frames (two as drawn; more when the studio
    // added some, render/sheet.ts frameCount). Poses that hold one frame keep it.
    const tick = Math.floor(time * (e.kind === 'bat' ? 8 : 4) + hash2(e.home.x, e.home.y) * 4)
    const f = (prefix: string) => tick % frameCount(prefix, 2)
    const fast = (prefix: string) => Math.floor(time * 10) % frameCount(prefix, 2)
    const { key, flip } = dirKey(e.dir)
    const frontier = realm ? FRONTIER_FOE_LOOKS[realm]?.[e.kind] : undefined
    if (frontier) {
      if (frontier === 'stonebird') return { name: e.ai.mode === 'rest' ? 'stonebird_perch' : 'stonebird_fly', flip }
      if (frontier === 'nokk' && e.ai.mode === 'idle') return { name: 'nokk_eyes', flip }
      // Pink eyes: every grazer but a calm one that nobody has struck.
      if (frontier === 'grazer' && (!e.calm || e.ai.angry)) return { name: tick % 2 ? 'grazer_angryb' : 'grazer_angrya', flip }
      const prefix = `${frontier}_${key}`
      return { name: `${prefix}_${f(prefix)}`, flip }
    }
    switch (e.kind) {
      case 'blob': return { name: `blob_${e.ai.mode === 'hop' ? 1 : f('blob')}`, flip: false }
      case 'spitter': return { name: `spitter_${key}_${e.ai.tell > 0 ? 1 : f(`spitter_${key}`)}`, flip }
      case 'sentry': return { name: `sentry_${key}_${f(`sentry_${key}`)}`, flip }
      case 'bat': return { name: `bat_${e.ai.mode === 'rest' ? 1 : f('bat')}`, flip: false }
      case 'dasher': return { name: `dasher_${key}_${f(`dasher_${key}`)}`, flip }
      case 'zapper': return { name: `zapper_${e.stun > 0 ? 0 : f('zapper')}`, flip: false }
      case 'skull': return { name: e.ai.mode === 'hop' || e.ai.mode === 'dodge' ? 'skull_jump' : `skull_${f('skull')}`, flip: false }
      case 'eye': return { name: 'eye', flip: false }
      case 'blade': return { name: 'blade', flip: false }
      case 'knight': return { name: `knight_${key}_${e.ai.mode === 'charge' ? fast(`knight_${key}`) : f(`knight_${key}`)}`, flip }
      case 'king': return { name: e.flash > 0 || e.ai.mode === 'down' ? 'king_hurt' : `king_${f('king')}`, flip: false }
      case 'hound': return { name: e.ai.mode === 'tell' ? 'hound_open' : `hound_${key}_${e.ai.mode === 'lunge' ? 1 : f(`hound_${key}`)}`, flip }
      case 'drone': return { name: `drone_${fast('drone')}`, flip: false }
      case 'llama': return { name: e.ai.mode === 'aim' ? 'llama_spit' : `llama_${key}_${e.ai.mode === 'charge' ? fast(`llama_${key}`) : f(`llama_${key}`)}`, flip }
      case 'mistral': return { name: e.ai.mode === 'down' ? 'mistral_down' : `mistral_${Math.floor(time * (e.ai.mode === 'blow' ? 14 : 7)) % frameCount('mistral', 4)}`, flip: false }
      case 'deepseek': return { name: e.ai.tell > 0 && e.ai.mode === 'up' ? 'deepseek_bite' : `deepseek_${f('deepseek')}`, flip: e.dir === 'left' }
      case 'gemini': {
        const other = this_map_twin(e)
        const t = !other || e.home.x < other.home.x ? 'a' : 'b'
        return { name: e.ai.mode === 'down' ? `gemini_${t}_down` : `gemini_${t}_${f(`gemini_${t}`)}`, flip: false }
      }
      // Three heads: walking, they take turns looking; dazed, they spin; else the one down its lane leads.
      case 'mixtral': {
        const heads = ['left', 'middle', 'right', 'middle'] as const
        const dazed = e.ai.mode === 'dazed'
        const pose = dazed || e.ai.mode === 'stalk' || e.ai.mode === 'idle' ? heads[Math.floor(time * (dazed ? 9 : 2.2)) % 4]!
          : e.dir === 'left' ? 'left' : e.dir === 'right' ? 'right' : 'middle'
        return { name: `mixtral_${pose}`, flip: false }
      }
      // It faces west as drawn, and the hero always (`engine/parrot.ts`): head tilted while it thinks, its horn up
      // while a move of its own is stencilled.
      case 'parrot': {
        const name = e.flash > 0 ? 'parrot_hurt' : e.ai.mode === 'think' ? 'parrot_think'
          : e.ai.mode === 'recite' && e.ai.on && !e.ai.act ? 'parrot_tell' : `parrot_${f('parrot')}`
        return { name, flip: e.dir === 'right' }
      }
    }
  }

  let twinList: Enemy[] = []
  function this_map_twin(e: Enemy): Enemy | undefined {
    return twinList.find(o => o !== e && o.kind === 'gemini' && o.cell === e.cell)
  }

  /** `flat`: seen from the side (`side.ts`): a flyer is drawn where it is, and nothing throws a shadow. */
  function drawEnemy(g: G, s: GameState, e: Enemy, cx: number, cy: number, lights: Light[], flat = false) {
    const x = e.x * T - cx
    let feet = e.y * T - cy + e.r * T + 1
    if (e.kind === 'deepseek' && (e.ai.mode === 'under' || e.ai.mode === 'rise')) {
      // Under the floor: only a fin cutting through it, and a ripple as it rises.
      const rising = e.ai.mode === 'rise'
      g.strokeStyle = rising ? '#ff3b5c' : 'rgba(47,243,255,0.6)'
      g.lineWidth = 1
      const rad = rising ? 6 + (1 - e.ai.t / 0.6) * 10 : 5 + Math.sin(time * 8) * 1.5
      g.beginPath(); g.ellipse(Math.round(x), Math.round(e.y * T - cy + 3), rad, rad * 0.45, 0, 0, Math.PI * 2); g.stroke()
      put(g, 'deepseek_fin', x, e.y * T - cy + 5, e.dir === 'left')
      lights.push({ x: e.x, y: e.y, r: rising ? 2.6 : 1.4, color: rising ? '#ff3b5c' : '#2ff3ff', a: 0.7 })
      return
    }
    if (e.kind === 'gemini' && e.ai.mode !== 'down') {
      const other = this_map_twin(e)
      if (other && !other.dead && other.ai.mode !== 'down' && e.home.x > other.home.x) {
        // The tether between the twins.
        const to = span ? span(e.x, e.y, other.x, other.y) : null
        const ox = to ? x + to.x : other.x * T - cx
        const oy = to ? e.y * T - cy - 10 + to.y : other.y * T - cy - 10
        const flick = Math.floor(time * 20) % 2
        g.strokeStyle = flick ? '#ff2fa0' : '#2ff3ff'
        g.lineWidth = 2
        g.beginPath(); g.moveTo(Math.round(x), Math.round(e.y * T - cy - 10)); g.lineTo(Math.round(ox), Math.round(oy)); g.stroke()
        g.strokeStyle = '#ffffff'
        g.lineWidth = 1
        g.beginPath(); g.moveTo(Math.round(x), Math.round(e.y * T - cy - 10)); g.lineTo(Math.round(ox), Math.round(oy)); g.stroke()
        lights.push({ x: (e.x + other.x) / 2, y: (e.y + other.y) / 2 - 0.6, r: 3, color: '#ff2fa0', a: 0.6 })
      }
    }
    const { name, flip } = enemySprite(e, mapInfo(world, s.map.id).def.realm)
    const flying = e.kind === 'bat' || e.kind === 'king' || e.kind === 'drone' || (e.kind === 'mistral' && e.ai.mode !== 'down') || (e.kind === 'gemini' && e.ai.mode !== 'down')
    if (e.kind === 'mistral') lights.push({ x: e.x, y: e.y - 1, r: 4, color: '#9ff6ff', a: e.ai.mode === 'down' ? 1 : 0.6 })
    if (e.kind === 'gemini') lights.push({ x: e.x, y: e.y - 1, r: 2.4, color: e.home.x < (this_map_twin(e)?.home.x ?? Infinity) ? '#2ff3ff' : '#ff2fa0', a: e.ai.mode === 'down' ? 0.3 : 0.8 })
    if (e.kind === 'drone') lights.push({ x: e.x, y: e.y - 0.6, r: 1.2, color: '#ff3b5c', a: 0.7 })
    if (e.kind === 'king') {
      const down = e.ai.mode === 'down'
      const hover = down ? 0 : 6 + Math.sin(time * 2) * 2
      shadow(g, x, feet - 2, 30)
      feet -= hover
      const shake = e.ai.mode === 'dying' ? (Math.random() - 0.5) * 3 : 0
      put(g, name, x + shake + shiver(e), feet + 8, flip, flashing(e))
      lights.push({ x: e.x, y: e.y, r: 5, color: '#ff2fa0', a: down ? 1 : 0.7 })
      if (e.ai.tell > 0 && Math.floor(time * 16) % 2 === 0) {
        g.fillStyle = '#ff2fa0'
        g.fillRect(Math.round(x) - 14, Math.round(feet - 40), 28, 1)
      }
      if (!down) {
        const bits = e.ai.shards as number
        for (let i = 0; i < 4; i++) {
          if (!(bits & (1 << i))) continue
          const p = shardPos(e, i)
          const to = span ? span(e.x, e.y, p.x, p.y) : null
          const sx = to ? x + to.x : p.x * T - cx
          const sy = to ? e.y * T - cy + to.y : p.y * T - cy
          shadow(g, sx, sy + 8, 6)
          put(g, 'shard', sx, sy + 4)
          lights.push({ x: p.x, y: p.y, r: 1.6, color: '#ff2fa0', a: 0.8 })
        }
      }
      return
    }
    if (e.kind !== 'eye' && e.kind !== 'blade' && !flat) shadow(g, x, feet - 1, Math.round(e.r * T * 1.6))
    if (flying && !flat) feet -= 6 + Math.round(Math.sin(time * 6 + e.home.x) * 1.5)
    if (e.kind === 'skull' && (e.ai.mode === 'hop' || e.ai.mode === 'dodge')) feet -= Math.round(Math.sin(Math.max(0, 1 - e.ai.t / 0.34) * Math.PI) * 5)
    if (e.kind === 'blob' && e.ai.mode === 'hop') feet -= Math.round(Math.sin(Math.max(0, 1 - e.ai.t / 0.38) * Math.PI) * 3)
    const [sx, sy] = foeSquash(e)
    if (e.kind === 'mixtral') {
      // Its pictures are small ones, drawn at twice their size (`doubledSprite`); the isometric view has its own.
      const shake = e.ai.mode === 'tell' && !frameReduced ? (Math.floor(time * 24) % 2 ? 1 : -1) : 0
      const c = doubledSprite(name, flip, flashing(e) ? '#ffffff' : undefined)
      g.drawImage(c, Math.round(x + shiver(e) + shake - c.width / 2), Math.round(feet - c.height))
      // A small pale light of its own, so its picture reads against its own lane; gold while it is open.
      lights.push({ x: e.x, y: e.y - 0.5, r: e.ai.tell > 0 ? 1.8 : 2.2, color: bossOpen(e) ? TOUGH_GOLD : '#c4fbff', a: bossOpen(e) ? 0.55 : 0.5 })
      return
    }
    if (e.kind === 'parrot') {
      // Off the ground in its hops, over its own shadow.
      feet -= Math.round(((e.ai.z as number | undefined) ?? 0) * T)
      const open = bossOpen(e)
      lights.push({ x: e.x, y: e.y - 0.8, r: 3, color: open ? TOUGH_GOLD : e.ai.mode === 'recite' ? '#ff8ae0' : '#c4fbff', a: open ? 0.6 : 0.5 })
    }
    if (e.tough) {
      toughOutline(g, e, name, x + shiver(e), feet, flip, sx, sy)
      // A light of its outline's colour while it tells or is open, so dusk and night do not dull it.
      if (e.ai.tell > 0) lights.push({ x: e.x, y: e.y - 0.4, r: 1.4, color: '#ffffff', a: 0.8 })
      else if (toughOpen(e)) lights.push({ x: e.x, y: e.y - 0.4, r: 1.4, color: TOUGH_GOLD, a: 0.8 })
    }
    put(g, name, x + shiver(e), feet, flip, flashing(e), sx, sy)
    if (e.kind === 'eye') {
      const a = e.ai.ang as number ?? 0
      const hot = e.ai.tell > 0 || e.ai.mode === 'aim'
      g.fillStyle = hot ? '#ffffff' : '#ff3b5c'
      g.fillRect(Math.round(x + Math.cos(a) * 3) - 1, Math.round(feet - 10 + Math.sin(a) * 2) - 1, 3, 3)
      lights.push({ x: e.x, y: e.y - 0.3, r: hot ? 2.4 : 1.2, color: '#ff3b5c', a: hot ? 1 : 0.6 })
    }
    if (e.kind === 'zapper' && e.stun <= 0) lights.push({ x: e.x, y: e.y - 0.4, r: 2, color: '#b6ff4a', a: 0.5 + 0.3 * Math.sin(time * 15) })
    // (A tough one's stars and a boss's go with its bar, over its head as this view draws it: `foeBars`.)
    if (e.stun > 0 && !e.tough && !BIG.has(e.kind)) drawStars(g, x, feet - 16)
    // (A tough one tells by its outline.)
    if (e.ai.tell > 0 && !e.tough && e.kind !== 'eye' && e.kind !== 'spitter' && e.kind !== 'hound' && e.kind !== 'llama' && e.kind !== 'deepseek') {
      g.fillStyle = '#ff2fa0'
      const top = feet - (e.kind === 'knight' ? 28 : 19)
      g.fillRect(Math.round(x), Math.round(top), 1, 4)
      g.fillRect(Math.round(x), Math.round(top) + 5, 1, 1)
    }
  }

  /**
   * A tough foe's outline, behind its sprite: its own silhouette a px out in the four directions. Pink; gold while it
   * is open; while it tells, white and pink by turns at 8 Hz (white all along under reduced motion).
   */
  function toughOutline(g: G, e: Enemy, name: string, x: number, y: number, flip: boolean, sx: number, sy: number) {
    const white = e.ai.tell > 0 && (frameReduced || Math.floor(time * 16) % 2 === 0)
    const color = toughOpen(e) ? TOUGH_GOLD : white ? '#ffffff' : TOUGH_PINK
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) put(g, name, x + dx, y + dy, flip, false, sx, sy, color)
  }

  /**
   * How far the top of a foe's figure stands above its foot point, in classic px, as the view draws it: read off the
   * art's own rows (the classic sprite's, or the isometric figure's), the tallest frame of the pose, so a bar over it
   * does not bob with the walk.
   */
  function figureTop(name: string, flip: boolean, art: number, size = 1): number {
    const walk = /^(.*)_\d+$/.exec(name)
    const pose = walk ? Array.from({ length: frameCount(walk[1]!, 2) }, (_, i) => `${walk[1]}_${i}`)
      : /^grazer_angry[ab]$/.test(name) ? ['grazer_angrya', 'grazer_angryb'] : [name]
    let classic = 0
    let drawn = 0
    for (const n of pose) {
      const rows = spriteRows(n)
      if (!rows) continue
      const first = rows.findIndex(r => [...r].some(ch => !!PAL[ch]))
      const own = first < 0 ? 0 : rows.length - first
      classic = Math.max(classic, own * size)
      if (art > 0) drawn = Math.max(drawn, folkTop(n, flip) ?? own)
    }
    return art > 0 ? classic + (drawn - classic) * art : classic
  }

  /**
   * Over every tough foe and every boss (`BIG`): a bar of what is left of it, 3 px high, its lower edge 3 px above
   * the figure, and its stars while stunned or dazed. A tough one's is 12 px wide, a boss's twice its radius; gold
   * while the foe is open (`toughOpen`, `bossOpen`). Drawn with the effects, so it is unlit, crisp and above every
   * sprite, in all the views.
   */
  function foeBars(g: G, s: GameState, place: Place, view: FoeView) {
    const def = mapInfo(world, s.map.id).def
    for (const e of s.map.enemies) {
      const big = BIG.has(e.kind)
      // (The same foes the queue draws.)
      if ((!e.tough && !big) || e.dead || e.away) continue
      if (roomed(def.kind) && e.cell !== s.zoneIndex && !(s.scroll && e.cell === s.scroll.index)) continue
      // Under the floor only a fin shows: the bar rides over that.
      const fin = e.kind === 'deepseek' && (e.ai.mode === 'under' || e.ai.mode === 'rise')
      const { name, flip } = fin ? { name: 'deepseek_fin', flip: e.dir === 'left' } : enemySprite(e, def.realm)
      const foot = e.y + e.r + 1 / T
      const at = place(e.x, foot, view.lift?.(e.x, foot - 0.01) ?? 0)
      const head = Math.round(at.y) - Math.round(figureTop(name, flip, view.art, e.kind === 'mixtral' ? 2 : 1)) - standsAbove(e)
      // Stunned: its stars turn in the gap between its head and the bar.
      const dazed = ((e.kind === 'knight' || e.kind === 'llama' || e.kind === 'mixtral') && e.ai.mode === 'dazed') || (e.kind === 'mistral' && e.ai.mode === 'down')
      if (e.stun > 0 || dazed) drawStars(g, at.x, head - 1)
      const w = big ? Math.round(e.r * T) * 2 : 12
      const x = Math.round(at.x) - w / 2
      const y = head - 6
      const color = toughOpen(e) || bossOpen(e) ? TOUGH_GOLD : TOUGH_PINK
      g.fillStyle = TOUGH_RIM
      g.fillRect(x, y, w, 3)
      g.fillStyle = TOUGH_LOST
      g.fillRect(x + 1, y + 1, w - 2, 1)
      if (e.hp <= 0) continue
      g.fillStyle = color
      g.fillRect(x + 1, y + 1, Math.max(1, Math.round(((w - 2) * Math.min(e.hp, e.maxHp)) / e.maxHp)), 1)
    }
  }

  /**
   * How far above its foot point `drawEnemy` sets a boss's figure, px, at the top of its bob (so the bar holds still):
   * the king hovers, its picture hung 8 px low, and Mistral and the twins fly while they are up.
   */
  function standsAbove(e: Enemy): number {
    if (e.kind === 'king') return (e.ai.mode === 'down' ? 0 : 8) - 8
    if ((e.kind === 'mistral' || e.kind === 'gemini') && e.ai.mode !== 'down') return 7
    return 0
  }

  /** White while struck: solid for the first 60 ms (a hit held in hitstop always shows it), then flickering out. */
  function flashing(e: Enemy): boolean {
    return e.flash > 0.08 || (e.flash > 0 && Math.floor(time * 30) % 2 === 0)
  }

  /** A struck foe in a hitstop shivers a px either way, frame by frame (the clock stands still; the frames do not). */
  function shiver(e: Enemy): number {
    return frameHitStop && e.flash > 0 && !frameReduced ? (frameN % 2 ? 1 : -1) : 0
  }

  /** A foe squashed flat by a blow, then springing back up a little taller. */
  function foeSquash(e: Enemy): [number, number] {
    const t = e.hitT
    if (t === undefined || BIG.has(e.kind)) return [1, 1]
    if (t < 0.07) return [1.2, 0.82]
    if (t < 0.14) return [0.94, 1.06]
    return [1, 1]
  }

  /** A foe's last moment: its white shape bursting wide and flat along the blow, fading, before the poof. */
  function drawDeathPop(g: G, s: GameState, e: Enemy, cx: number, cy: number) {
    const p = Math.min(1, (e.deathT ?? 0) / DEATH_POP)
    const step = span ? span(e.x, e.y, e.x + (e.hitDx ?? 0), e.y + (e.hitDy ?? 0)) : { x: (e.hitDx ?? 0) * T, y: (e.hitDy ?? 0) * T }
    const x = e.x * T - cx + (step.x * 6 * p) / T
    const feet = e.y * T - cy + e.r * T + 1 + (step.y * 6 * p) / T
    const { name, flip } = enemySprite(e, mapInfo(world, s.map.id).def.realm)
    g.globalAlpha = 1 - p
    put(g, name, x, feet, flip, false, 1 + 0.5 * p, 1 - 0.8 * p, '#ffffff')
    g.globalAlpha = 1
  }

  function drawStars(g: G, x: number, y: number) {
    for (let i = 0; i < 3; i++) {
      const a = time * 6 + (i * Math.PI * 2) / 3
      g.fillStyle = i % 2 ? '#ffd23f' : '#fff4ff'
      g.fillRect(Math.round(x + Math.cos(a) * 5), Math.round(y + Math.sin(a) * 2), 1, 1)
    }
  }

  let camX = 0
  let camY = 0

  // ---------------------------------------------------------------------------
  // The frame's parts, shared by every view
  // ---------------------------------------------------------------------------

  /** Advance the clock and fit the scale to the map. */
  function begin(s: GameState, ui: FrameUI, dt: number) {
    time += ui.paused ? 0 : dt
    frameN++
    frameHitStop = !!ui.hitStop
    frameReduced = ui.reducedMotion
    if (layoutMap !== s.map.id) {
      layoutMap = s.map.id
      const want = scaleFor(s.map.id)
      if (want !== scale) setScale(want)
    }
  }

  /**
   * Everything that stands in the world this frame, unsorted: props, Luna,
   * blocks on the move, drops, pickups, people, exits, enemies, bombs, thrown
   * pots and the hero. Each draws itself the classic way, for a camera at
   * (cx, cy) px over a view of qw × qh px; a view with another projection
   * moves the drawing to where the item's anchor lands. `flat` takes what
   * lies on the ground and is drawn at once.
   */
  function queue(g: G, s: GameState, ui: FrameUI, cx: number, cy: number, qw: number, qh: number, lights: Light[], flat: G = g): SceneItem[] {
    const def = mapInfo(world, s.map.id).def
    const { kind } = def
    camX = cx
    camY = cy
    const items: SceneItem[] = []
    const m = s.map
    arc = s.inv.arc
    twinList = m.enemies
    queueProps(g, world, s, cx, cy, qw, qh, time, ui.reducedMotion, items, lights, flat)
    for (const it of items) it.big = true
    if (!ui.attract && kind === 'overworld') {
      queueWildlife(g, s, cx, cy, time, ui.reducedMotion, (dayOf(drawing)?.sun ?? 0.12) <= 0.12, items, def.isoLandmarks)
    }
    if (!ui.attract) queueLife({ g, s, cx, cy, time, reduced: ui.reducedMotion, sun: kind === 'overworld' ? dayOf(drawing)?.sun ?? 0.12 : -1, kind, realm: def.realm, look: def.look, items, lights, landmarks: def.isoLandmarks ?? [] })
    if (!ui.attract) queueLuna(g, s, cx, cy, items, lights)
    if (!ui.attract && s.echo) {
      const e = s.echo
      items.push({ x: e.x, foot: 6 / T, y: e.y, draw: () => drawEcho(g, s, cx, cy, lights) })
    }
    queuePuzzles(g, s, cx, cy, items)
    if (!ui.attract) queueHeap(g, world, s, cx, cy, time, ui.reducedMotion, items, lights)
    for (const b of m.moving) {
      const p = Math.min(1, b.t / (b.dur ?? 0.28))
      const bx = (b.fx + (b.tx - b.fx) * p) * T - cx
      const by = (b.fy + (b.ty - b.fy) * p) * T - cy
      items.push({
        x: b.fx + (b.tx - b.fx) * p + 0.5,
        ay: b.fy + (b.ty - b.fy) * p + 1,
        y: b.fy + 1,
        draw: () => {
          if (b.kind === 'μ' || b.kind === 'ν') { drawMovingMirror(g, Math.round(bx), Math.round(by), b.kind); return }
          if (b.kind !== 'B') { drawBlock(g, Math.round(bx), Math.round(by)); return }
          // A block dropping into a hole shrinks away at the end.
          const k = b.falls ? Math.max(0, 1 - Math.max(0, p - 0.7) / 0.3) : 1
          if (k >= 1) drawPsiBlock(g, Math.round(bx), Math.round(by))
          else if (k > 0) { g.save(); g.translate(Math.round(bx + 8), Math.round(by + 8)); g.scale(k, k); drawPsiBlock(g, -8, -8); g.restore() }
        },
      })
    }
    for (const d of m.drops) {
      const left = d.life - d.t
      if (left < 2 && Math.floor(time * 12) % 2 === 0) continue
      const name = d.kind === 'heart' ? 'drop_heart' : d.kind === 'bit' ? 'bit_1' : d.kind === 'bit5' ? 'bit_5' : d.kind === 'bomb' ? 'drop_bomb' : 'drop_key'
      items.push({ x: d.x, foot: 4 / T, y: d.y, draw: () => { shadow(g, d.x * T - cx, d.y * T - cy + 3, 5); put(g, name, d.x * T - cx, d.y * T - cy + 4 - d.z * T) } })
      if (d.kind === 'bit5' || d.kind === 'key') lights.push({ x: d.x, y: d.y, r: 0.9, color: d.kind === 'key' ? '#ffd23f' : '#2f5fd0', a: 0.5 })
    }
    for (const p of m.pickups) {
      if (p.hidden) continue
      const icon = itemSpriteName(p.item)
      const bob = p.shop || ui.reducedMotion ? 0 : Math.round(Math.sin(time * 3 + p.x) * 1.5)
      items.push({
        x: p.x,
        foot: 5 / T,
        tile: true,
        y: p.y,
        draw: () => {
          const px = p.x * T - cx
          const py = p.y * T - cy
          if (!p.shop) shadow(g, px, py + 5, 8)
          put(g, icon, px, py + 5 - (p.shop ? 3 : 2) + bob)
          // What lies there to be picked up glints now and then.
          if (!p.shop && !ui.reducedMotion) chestStar(g, px + 4, py - 6 + bob, time, Math.round(p.x * 7 + p.y * 13))
          if (p.shop) {
            const t = String(p.shop.price)
            drawText(g, t, Math.round(px - textWidth(t) / 2), Math.round(py + 9), '#b6ff4a', '#0b0616')
          }
        },
      })
      lights.push({ x: p.x, y: p.y - 0.3, r: p.item === 'prism' ? 4 : 1.8, color: p.item === 'prism' ? '#ffd23f' : p.item === 'heartContainer' || p.item === 'heartPiece' ? '#ff2fa0' : '#ffd23f', a: 0.8 })
    }
    for (const n of m.npcs) {
      // The beach's people move on its track's slow beat; everyone else steps at 2 Hz.
      const chill = BEACH_LOOKS.has(n.look)
      const f = Math.floor(time * (chill ? BEACH_BEAT : 2) + (chill ? 0 : n.home.x)) % frameCount(n.look, 2)
      items.push({
        x: n.x,
        foot: 6 / T,
        y: n.y,
        big: n.look === 'tree',
        ...(n.look === 'tree' ? { tree: true } : {}),
        // The bonfire drawn by hand in the round for the isometric view (part 23, `iso/things.ts`).
        ...(n.look === 'bonfire' ? { things: [{ id: `bonfire_${f}`, dy: -0.3 }] } : {}),
        draw: () => {
          const x = n.x * T - cx
          const y = n.y * T - cy + 6
          if (n.look === 'tree') { drawTree(g, x, y); return }
          if (n.look !== 'bonfire') shadow(g, x, y - 1, 10)
          if (frontierNpcLook(n.look)) {
            const { key, flip } = dirKey(n.dir)
            const prefix = `${n.look}_${key}`
            const frame = Math.floor(time * 2 + n.home.x) % frameCount(prefix, 2)
            put(g, `${prefix}_${frame}`, x, y, flip)
          } else put(g, `${n.look}_${f}`, x, y, n.dir === 'left')
          if (n.look === 'smoker') smoke(g, x + (n.dir === 'left' ? -1 : 1) * (f ? 6 : 7), y - (f ? 9 : 5), time, ui.reducedMotion)
          if (n.att) drawClock(g, n, x, y, time, ui.reducedMotion)
        },
      })
      if (n.look === 'bonfire') {
        const flick = ui.reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(time * 7) * Math.sin(time * 2.3)
        lights.push({ x: n.x, y: n.y - 0.4, r: 5.5, color: '#ff8a3d', a: 0.95 * flick, fire: true }, { x: n.x, y: n.y - 0.6, r: 2, color: '#ffd23f', a: 0.8 * flick })
      }
      if (n.look === 'smoker') lights.push({ x: n.x + (n.dir === 'left' ? -0.3 : 0.3), y: n.y - 0.3, r: 0.6, color: '#ff8a3d', a: 0.7 })
      if (n.look === 'barmaid') lights.push({ x: n.x, y: n.y - 0.6, r: 1.8, color: '#ffb070', a: 0.6 })
      if (n.look === 'robot') lights.push({ x: n.x, y: n.y - 0.8, r: 1.2, color: '#ff2fa0', a: 0.7 })
      if (n.look === 'keeper') lights.push({ x: n.x + 0.3, y: n.y - 0.9, r: 1.6, color: '#2ff3ff', a: 0.7 })
      if (n.look === 'ghost') lights.push({ x: n.x, y: n.y, r: 2, color: '#cfc6ff', a: 0.4 })
    }
    emit.length = 0
    const beforeExits = items.length
    queueExits(g, m.exits ?? [], cx, cy, qw, qh, ui.reducedMotion ? 0 : time, ui.reducedMotion, items, lights, emit)
    for (let i = beforeExits; i < items.length; i++) items[i]!.big = true
    for (const e of m.enemies) {
      if (e.dead) {
        // Just fallen: the pop, where it stood.
        if (e.deathT !== undefined && e.deathT < DEATH_POP && !e.away && !BIG.has(e.kind) && (!roomed(kind) || e.cell === s.zoneIndex)) {
          items.push({ x: e.x, foot: e.r + 1 / T, ay: e.y, y: e.y, draw: () => drawDeathPop(g, s, e, cx, cy) })
        }
        continue
      }
      if (roomed(kind) && e.cell !== s.zoneIndex && !(s.scroll && e.cell === s.scroll.index)) continue
      items.push({ x: e.x, foot: e.r + 1 / T, ay: e.y, y: e.kind === 'eye' ? e.y + 0.4 : e.y, big: BIG.has(e.kind), draw: () => drawEnemy(g, s, e, cx, cy, lights) })
      if (e.kind === 'parrot' && e.ai.copy) {
        const x = e.ai.cx as number
        const y = e.ai.cy as number
        // A hair behind: while the Parrot has not stirred from the spot, it is the Parrot that shows.
        items.push({ x, foot: e.r + 1 / T, ay: y - 0.05, y: y - 0.05, big: true, draw: () => drawParrotCopy(g, e, x * T - cx, (y + e.r) * T - cy + 1) })
      }
    }
    for (const b of m.bombs) {
      const fast = b.t > BOMB_FUSE - 0.6
      const f = Math.floor(time * (fast ? 16 : 5)) % frameCount('bomb', 2)
      items.push({ x: b.x, foot: 5 / T, y: b.y, draw: () => { shadow(g, b.x * T - cx, b.y * T - cy + 4, 8); put(g, `bomb_${f}`, b.x * T - cx, b.y * T - cy + 5) } })
      lights.push({ x: b.x, y: b.y - 0.5, r: 1, color: '#ff8a3d', a: 0.7 })
    }
    for (const o of m.thrown) {
      items.push({ x: o.x, foot: 5 / T, y: o.y, draw: () => { shadow(g, o.x * T - cx, o.y * T - cy + 4, 8); put(g, o.kind === 'rock' ? 'rock' : 'pot', o.x * T - cx, o.y * T - cy + 8 - o.z * T * 1.4) } })
    }
    if (!ui.attract && s.hero.x > -10) {
      items.push({ x: s.hero.x, foot: 6 / T, y: s.hero.y, hero: true, draw: () => drawHero(g, s, cx, cy, lights) })
      // The roll leaves the hero's shape behind in cyan for a moment, three of them, fading; the air's moves leave
      // more, and longer (the comet and the HOP CUT's spring a streak of them).
      const h = s.hero
      const trail = !heroBare ? ghostTrail(s) : null
      if (trail && (!ghosts.length || time - ghosts[ghosts.length - 1]!.at >= trail.every)) {
        ghosts.push({ x: h.x, y: h.y, lift: Math.round(heroZ(h) * T), ...trail.frame, at: time, life: trail.life, color: trail.color })
      }
      ghosts = ghosts.filter(gh => time - gh.at < gh.life && time >= gh.at).slice(-8)
      ghosts.forEach(gh => {
        const a = 0.5 * (1 - (time - gh.at) / gh.life)
        if (Math.hypot(gh.x - h.x, gh.y - h.y) < 0.12) return
        items.push({ x: gh.x, foot: 6 / T, y: gh.y - 0.01, draw: () => {
          g.globalAlpha = a
          putRot(g, gh.name, gh.x * T - cx, gh.y * T - cy + 6 - gh.lift, gh.flip, gh.rot, gh.color)
          g.globalAlpha = 1
        } })
      })
    }
    return items
  }

  /** What is painted flat on the floor (`floorMarks.ts`): the foes' stencils, pot stands, the echo's ring. */
  function floorMarks(g: G, s: GameState, ui: FrameUI, cx: number, cy: number) {
    if (!ui.attract) drawHeapFloor(g, world, s, cx, cy, time, ui.reducedMotion)
    if (!ui.attract) drawFloorMarks(g, world, s, cx, cy, time, ui.reducedMotion)
    if (!ui.attract) drawRings(g, world, s, cx, cy, time, ui.reducedMotion)
  }

  /** The afterimages: where the hero was, how high, in which frame, and how long it stays. */
  let ghosts: Array<{ x: number; y: number; lift: number; name: string; flip: boolean; rot: number; at: number; life: number; color: string }> = []
  /** The combo being called out (`hud.ts` drawCallout). */
  let callout: Callout | null = null
  /** FLIP CUT's chop: where and when it came down (the pose and the smear hold a moment). */
  let chopAt: { x: number; y: number; a: number; at: number } | null = null

  /** What leaves afterimages now, how often, for how long, in which colour (null: nothing). */
  function ghostTrail(s: GameState): null | { every: number; life: number; color: string; frame: { name: string; flip: boolean; rot: number } } {
    const h = s.hero
    if (h.act === 'roll') return { every: 0.035, life: 0.15, color: '#2ff3ff', frame: { ...rollFrame(s), rot: 0 } }
    if (h.act === 'air' && h.air) {
      const f = airFrame(s)
      const fast = h.air.kind === 'comet'
      return { every: fast ? 0.012 : 0.03, life: fast ? 0.22 : h.air.kind === 'hop' ? 0.12 : 0.18, color: fast ? '#fff4ff' : '#2ff3ff', frame: { name: f.name, flip: f.flip, rot: f.rot } }
    }
    // The HOP CUT's spring back in, blade drawn back: a white streak.
    if (h.act === 'swing' && h.swing?.spring !== undefined && h.swing.t < 0) {
      const { key, flip } = dirKey(h.dir)
      return { every: 0.01, life: 0.2, color: '#fff4ff', frame: { name: `hero_${key}_atk_wind`, flip, rot: 0 } }
    }
    return null
  }

  /** The light map's base colour for the hero's room, and the lights of the hero and of what flies. */
  function ambient(s: GameState, ui: FrameUI, lights: Light[]): string {
    const info = mapInfo(world, s.map.id)
    const kind = info.def.kind
    const m = s.map
    const dark = kind !== 'overworld' && cellIsDark(s, info, s.zoneIndex)
    const day = kind === 'overworld' ? dayOf(drawing) : null
    // The dark has three levels: black (no lamp), dim (the lamp owned), lit (the room's `lit` flag: not dark at all).
    const dim = dark && s.inv.lamp
    const amb = dark ? (dim ? AMBIENT_DIM : kind === 'interior' ? AMBIENT.caveDark : AMBIENT.dark) : info.def.ambient ? AMBIENCE[info.def.ambient] : day ? day.ambient : AMBIENT[kind]
    const h = s.hero
    // Out in a dark realm, and anywhere on the frontier at night, the hero's own light is more of a lantern.
    const realm = day ? realmLook(info.def.look) : null
    const lantern = day ? Math.max(realm ? MOOD[realm].hero : 0, info.def.realm ? 0.6 * nightOf(day) : 0) : 0
    if (!ui.attract && h.x > -10) lights.push({ x: h.x, y: h.y - 0.2, r: dark ? (dim ? 6.2 : 5.2) : 2.6 + 0.9 * lantern, color: dark ? '#b8a8e8' : '#8a7ab8', a: dark ? 1 : 0.35 + 0.2 * lantern })
    if (s.disc) lights.push({ x: s.disc.x, y: s.disc.y, r: 2.2, color: '#2ff3ff', a: 0.9 })
    // The storm lamp set down lights its own ground.
    if (s.lamp) lights.push({ x: (s.lamp.idx % m.w) + 0.5, y: Math.floor(s.lamp.idx / m.w) + 0.5, r: 3.2, color: '#2ff3ff', a: 1 })
    for (const p of m.projectiles) {
      if (p.kind === 'gust') continue
      lights.push({ x: p.x, y: p.y, r: p.kind === 'laser' ? 1.8 : 1.4, color: p.friendly ? '#2ff3ff' : p.kind === 'laser' ? '#ff3b5c' : p.kind === 'spit' ? '#cfc6ff' : '#ff2fa0', a: 0.9 })
    }
    for (const b of m.blasts) lights.push({ x: b.x, y: b.y, r: 5 * (1 - b.t), color: '#ff8a3d', a: 1 })
    // Blows, kills and rolls light the ground for a moment.
    pulses = pulses.filter(P => time - P.at < P.life && time >= P.at - 1)
    for (const P of pulses) lights.push({ x: P.x, y: P.y, r: P.r, color: P.color, a: P.a * (1 - Math.max(0, time - P.at) / P.life) })
    return amb
  }

  /** The camera's kick now (`Kit.nudge`), tiles. */
  function nudge(): Vec {
    if (frameReduced || kick.at < 0) return { x: 0, y: 0 }
    const age = time - kick.at
    if (age < 0 || age >= kick.life) return { x: 0, y: 0 }
    const k = 1 - age / kick.life
    return { x: kick.x * k, y: kick.y * k }
  }

  /** What flies and glows, drawn after the light: shots and the disc. `place` puts a world point on the scene; `dirOf` turns a world direction into the scene's. */
  function projectiles(g: G, s: GameState, place: Place, dirOf: (vx: number, vy: number) => Vec = (vx, vy) => ({ x: vx, y: vy })) {
    const m = s.map
    drawGas(g, s, place, time, frameReduced)
    drawBeams(g, s, place, time, frameReduced)
    for (const p of m.projectiles) {
      const at = place(p.x, p.y)
      const px = at.x
      const py = at.y
      const v = dirOf(p.vx, p.vy)
      if (p.kind === 'pellet') put(g, 'pellet', px, py + 3)
      else if (p.kind === 'spit') {
        g.fillStyle = p.friendly ? '#2ff3ff' : '#cfc6ff'
        g.fillRect(Math.round(px) - 2, Math.round(py) - 2, 5, 4)
        g.fillStyle = '#ffffff'
        g.fillRect(Math.round(px) - 1, Math.round(py) - 2, 2, 1)
      } else if (p.kind === 'gust') {
        g.strokeStyle = 'rgba(207,250,255,0.75)'
        g.lineWidth = 1
        const a0 = p.t * 14
        g.beginPath(); g.arc(Math.round(px), Math.round(py), 4, a0, a0 + 4); g.stroke()
        g.beginPath(); g.arc(Math.round(px), Math.round(py), 2, a0 + 2, a0 + 5); g.stroke()
      }
      else if (p.kind === 'laser') {
        const len = 7
        const n = Math.hypot(v.x, v.y) || 1
        g.strokeStyle = '#ff3b5c'
        g.lineWidth = 3
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - (v.x / n) * len, py - (v.y / n) * len); g.stroke()
        g.strokeStyle = '#ffffff'
        g.lineWidth = 1
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - (v.x / n) * len, py - (v.y / n) * len); g.stroke()
      } else {
        g.fillStyle = p.friendly ? '#2ff3ff' : '#ff2fa0'
        g.fillRect(Math.round(px) - 2, Math.round(py) - 1, 5, 3)
        g.fillRect(Math.round(px) - 1, Math.round(py) - 2, 3, 5)
        g.fillStyle = '#ffffff'
        g.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2)
      }
    }
    if (s.disc) {
      const f = Math.floor(time * 20) % frameCount('disc', 2)
      const at = place(s.disc.x, s.disc.y)
      put(g, `disc_${f}`, at.x, at.y + 6)
    }
  }

  /** The screen flash and the warp, death and exit fades over the scene; returns the fade (0..1). */
  function flashFade(g: G, s: GameState, ui: FrameUI, dt: number, into = '#0b0616'): number {
    // Screen flash
    if (flashT > 0) {
      g.globalAlpha = Math.min(0.55, flashT * 2.2)
      g.fillStyle = flashColor
      g.fillRect(0, 0, vw, vh)
      g.globalAlpha = 1
      if (!ui.paused) flashT -= dt
    }
    // Warp / death fades
    let fade = 0
    if (s.warp) fade = s.warp.t < WARP_TIME ? s.warp.t / WARP_TIME : 2 - s.warp.t / WARP_TIME
    if (s.dying) fade = Math.max(0, (s.dying.t - 1) / 0.8)
    // Leaving the game: hold full dark until the shell navigates away.
    if (s.mode === 'exit') fade = 1
    if (fade > 0) {
      g.globalAlpha = Math.min(1, fade)
      g.fillStyle = s.warp?.white ? '#ffffff' : into
      g.fillRect(0, 0, vw, vh)
      g.globalAlpha = 1
    }
    return fade
  }

  /**
   * The finished scene to the screen: whole-number upscale, the neon bloom
   * (`glows` adds the frame's lights to the bloom layer), scanlines, vignette.
   */
  function present(fade: number, glows: (bg: G) => void, finish: Finish = finishOf('classic'), picture?: HTMLCanvasElement) {
    screen.setTransform(1, 0, 0, 1, 0, 0)
    screen.globalCompositeOperation = 'source-over'
    screen.fillStyle = '#0b0616'
    screen.fillRect(0, 0, W, H)
    const ox = Math.floor((W - vw * scale) / 2)
    const oy = Math.floor((H - vh * scale) / 2)
    screen.imageSmoothingEnabled = false
    const src = picture ?? scene
    const sw = picture ? picture.width : vw
    const sh = picture ? picture.height : vh
    screen.drawImage(src, 0, 0, sw, sh, ox, oy, vw * scale, vh * scale)
    const soft = Math.max(0, Math.min(1, finish.smooth ?? 0))
    if (soft > 0) {
      // Filtered on its way up, and smeared a little sideways, over the hard pixels.
      screen.imageSmoothingEnabled = true
      screen.globalAlpha = soft
      screen.drawImage(src, 0, 0, sw, sh, ox, oy, vw * scale, vh * scale)
      screen.globalAlpha = soft * 0.4
      screen.drawImage(src, 0, 0, sw, sh, ox + Math.max(1, (0.6 * vw * scale) / sw), oy, vw * scale, vh * scale)
      screen.globalAlpha = 1
      screen.imageSmoothingEnabled = false
    }
    // Neon bloom: glows gathered at logical resolution, then one smooth
    // upscale added onto the screen (cheap on phones, soft on big screens).
    if (fade < 1 && finish.bloom > 0) {
      bg.globalCompositeOperation = 'source-over'
      bg.clearRect(0, 0, vw, vh)
      bg.globalCompositeOperation = 'lighter'
      glows(bg)
      bg.globalAlpha = 1
      screen.globalCompositeOperation = 'lighter'
      screen.imageSmoothingEnabled = true
      // More than the classic amount is the same glow laid on again.
      for (let b = finish.bloom; b > 0; b -= 1) {
        screen.globalAlpha = (1 - fade) * Math.min(1, b)
        screen.drawImage(bloom, 0, 0, vw, vh, ox, oy, vw * scale, vh * scale)
      }
      screen.imageSmoothingEnabled = false
      screen.globalAlpha = 1
      screen.globalCompositeOperation = 'source-over'
    }
    if (scan && scale >= 3 && finish.scanlines > 0) {
      screen.fillStyle = scan
      for (let n = finish.scanlines; n > 0; n -= 1) {
        screen.globalAlpha = Math.min(1, n)
        screen.fillRect(0, 0, W, H)
      }
      screen.globalAlpha = 1
    }
    if (finish.vignette > 0) vignette(screen, finish.vignette)
  }

  /** The skin this screen can show: one with finer pixels gives way to its coarse stand-in where a logical px is a single device px. */
  function wearable(skin: HudSkin): HudSkin {
    return (skin.density ?? 1) > 1 && scale < 2 && skin.coarse ? skin.coarse() : skin
  }

  /** Where a skin's HUD lies on the screen (`Kit.hudSpace`). */
  function hudSpace(skin: HudSkin = NEON_SKIN): { scale: number; ox: number; oy: number; vw: number; vh: number } {
    skin = wearable(skin)
    const hs = hudScale(scale, W, H, skin.density)
    const w = hs === scale ? vw : Math.ceil(W / hs)
    const h = hs === scale ? vh : Math.ceil(H / hs)
    return { scale: hs, ox: Math.floor((W - w * hs) / 2), oy: Math.floor((H - h * hs) / 2), vw: w, vh: h }
  }

  /** The canvas for a skin at `density` pixels per logical px, its context scaled so the layout stays in logical px. */
  function fineHud(w: number, h: number, density: number): G {
    if (!hudFine || !hgFine || hudFine.width !== w || hudFine.height !== h) {
      hudFine = makeCanvas(w, h)
      hgFine = hudFine.getContext('2d')!
      hgFine.imageSmoothingEnabled = false
    }
    hgFine.setTransform(density, 0, 0, density, 0, 0)
    return hgFine
  }

  /**
   * The HUD layer and the touch stick. (cx, cy) is the camera the exit labels
   * are placed by (px), `heroY` the hero's row on the scene (the dialog box
   * keeps clear of it): both in scene px, whatever grid the skin's HUD is on.
   * `from`: see `Kit.hudLayer`.
   */
  function hudLayer(s: GameState, ui: FrameUI, dt: number, cx: number, cy: number, heroY: number, skin: HudSkin = NEON_SKIN, from?: { skin: HudSkin; mix: number }) {
    // The dialog box keeps the side it opened on: a turn of the view under it (the camera tipping, the hero's row moving
    // on the screen) never throws it from the bottom to the top in one frame.
    if (s.dialog) {
      if (dialogRow.of !== s.dialog) dialogRow = { of: s.dialog, y: heroY }
      heroY = dialogRow.y
    } else dialogRow = { of: null, y: 0 }
    cellsAt = null
    prismAt = null
    logAt = null
    const to = wearable(skin)
    const old = from ? wearable(from.skin) : to
    const mix = old === to ? 1 : Math.max(0, Math.min(1, from!.mix))
    // Between two dresses both are painted, the one being left over the one coming in, so the HUD is never
    // gone. (The second painting takes no time: its labels' fades have already moved this frame.)
    if (old !== to && mix > 0 && mix < 1) { hudPaint(s, ui, dt, cx, cy, heroY, to, mix); hudPaint(s, ui, 0, cx, cy, heroY, old, 1 - mix) }
    else hudPaint(s, ui, dt, cx, cy, heroY, mix < 0.5 ? old : to, 1)

    // Touch stick
    if (ui.stick) {
      const sx = ui.stick.ox * dpr
      const sy = ui.stick.oy * dpr
      screen.strokeStyle = 'rgba(47,243,255,0.45)'
      screen.lineWidth = 2 * dpr
      screen.beginPath(); screen.arc(sx, sy, 40 * dpr, 0, Math.PI * 2); screen.stroke()
      screen.fillStyle = 'rgba(47,243,255,0.35)'
      screen.beginPath(); screen.arc(sx + ui.stick.dx * dpr, sy + ui.stick.dy * dpr, 16 * dpr, 0, Math.PI * 2); screen.fill()
    }
  }

  /** The dialog the box's side was taken for, and the hero's row it was taken by. */
  let dialogRow: { of: unknown; y: number } = { of: null, y: 0 }

  /** One skin's HUD, painted on its own grid and laid on the screen at `alpha`. */
  function hudPaint(s: GameState, ui: FrameUI, dt: number, cx: number, cy: number, heroY: number, skin: HudSkin, alpha: number) {
    const ox = Math.floor((W - vw * scale) / 2)
    const oy = Math.floor((H - vh * scale) / 2)
    // The skin's own grid: the scene's for the classic HUD; at density 2 twice as fine, and of another size when the screen's scale is odd.
    const sp = hudSpace(skin)
    const density = skin.density ?? 1
    const g = density > 1 ? fineHud(sp.vw * density, sp.vh * density, density) : hg
    g.clearRect(0, 0, sp.vw, sp.vh)
    // The camera and the hero's row arrive in scene px; on a HUD grid of another scale they are these.
    const zoom = scale / sp.scale
    const lx = cx - (ox - sp.ox) / scale
    const ly = cy - (oy - sp.oy) / scale
    const heroRow = (oy - sp.oy + heroY * scale) / sp.scale
    if (!ui.attract && s.mode !== 'exit') {
      // Hearts, bits and items appear with the blade; before that the town is just a town.
      const hud = s.inv.sword
      // Clear of the notch and the status bar when the page fills the whole screen.
      const top = Math.ceil(insets.top * dpr / sp.scale)
      const left = Math.ceil(insets.left * dpr / sp.scale)
      const right = Math.ceil(insets.right * dpr / sp.scale)
      const bottom = Math.ceil(insets.bottom * dpr / sp.scale)
      // SLIP's slow world: a cool tint and a frame round it.
      if (s.slow && !ui.paused) drawSlow(g, s.slow, sp.vw, sp.vh, skin)
      // A page of the menu is the whole screen's: no hearts, counters or item box under its veil (they are back with
      // the next paint of play, or of the start-over question), and nothing of what would stand frozen behind it, since
      // it has no window of its own (a label, a banner, a line).
      const pageUp = ui.paused && !ui.confirmReset
      if (hud && !pageUp) {
        g.save()
        g.translate(left, top)
        drawHud(g, s, sp.vw - left - right, time, ui.touch, skin, world)
        g.restore()
      }
      // A combo's name where it lands (`moves.ts` credit).
      if (callout && !ui.paused && s.mode === 'play') {
        if (alpha >= 0.5) callout.t += dt
        if (callout.t > CALLOUT_TIME) callout = null
        else drawCallout(g, callout, sp.vw, sp.vh, skin, heroRow - 46)
      }
      if (!pageUp) drawExitLabels(g, s, labels, lx, ly, sp.vw, sp.vh, ui.paused ? 0 : dt, ui.keys.touch ? 'TAP' : ui.keys.a, ui.reducedMotion, !ui.paused, (hud ? 30 : 2) + top, skin, zoom)
      // The view strip has the banner's place while it is up.
      if (ui.banner && !pageUp && s.mode !== 'dialog' && !(ui.strip && !ui.paused)) drawBanner(g, ui.banner.text, ui.banner.t, sp.vw, sp.vh, skin)
      if (s.dialog && !pageUp) {
        g.save()
        g.translate(0, top)
        drawDialog(g, s, sp.vw, sp.vh - top - bottom, heroRow - top, ui.keys, time, skin)
        g.restore()
      }
      if (ui.paused && ui.page === 'moves' && !ui.confirmReset) drawMoves(g, s, sp.vw, sp.vh, ui.keys, skin, top)
      // (The MAP page lies on this skin's grid: the deck's top comes to it from the shell's CSS px.)
      else if (ui.paused && ui.page === 'map' && !ui.confirmReset) drawMapPage(g, world, s, sp.vw, sp.vh, { keys: ui.keys, e: ui.turn ?? 0, css: sp.scale / dpr, deck: ui.deckTop == null ? null : Math.floor((ui.deckTop * dpr - sp.oy) / sp.scale), safe: { top, left, right, bottom }, focus: ui.prismFocus, rule: ui.rule, placed: p => { prismAt = p.gemHit && targetOnScreen(p.gemHit, sp, dpr, { w: W / dpr, h: H / dpr }) } }, skin)
      else if (ui.paused && ui.confirmReset) drawPause(g, sp.vw, sp.vh, ui.keys, skin)
      else if (ui.paused && ui.page === 'log' && ui.log && !ui.confirmReset) drawLogPage(g, sp.vw, sp.vh, { keys: ui.keys, log: ui.log.changes, page: ui.log.page, dev: ui.log.dev, css: sp.scale / dpr, deck: ui.deckTop == null ? null : Math.floor((ui.deckTop * dpr - sp.oy) / sp.scale), safe: { top, left, right, bottom }, placed: p => { const at = (b: CssBox) => targetOnScreen(b, sp, dpr, { w: W / dpr, h: H / dpr }); logAt = { page: p.page, pages: p.pages, older: p.older && at(p.older.hit), newer: p.newer && at(p.newer.hit), dev: at(p.dev.hit) } } }, skin)
      // (The ITEMS page keeps above the deck as the MAP page does, and says where its cells came to lie.)
      else if (ui.paused) drawItemsPage(g, s, sp.vw, sp.vh, { keys: ui.keys, cursor: ui.itemCursor ?? 0, css: sp.scale / dpr, deck: ui.deckTop == null ? null : Math.floor((ui.deckTop * dpr - sp.oy) / sp.scale), safe: { top, left, right, bottom }, muted: ui.muted, view: ui.view, placed: p => { cellsAt = p.cells.map(b => targetOnScreen(b, sp, dpr, { w: W / dpr, h: H / dpr })) } }, skin)
      else if (ui.strip && !s.dialog) drawViewStrip(g, ui.strip, sp.vw, sp.vh - bottom, !!ui.keys.touch, skin)
    }
    if (alpha < 1) screen.globalAlpha = alpha
    screen.drawImage(density > 1 ? hudFine! : hud, 0, 0, sp.vw * density, sp.vh * density, sp.ox, sp.oy, sp.vw * sp.scale, sp.vh * sp.scale)
    if (alpha < 1) screen.globalAlpha = 1
  }

  // ---------------------------------------------------------------------------
  // The classic view
  // ---------------------------------------------------------------------------

  /** The top-down world, unlit, on the scene: tiles, lettering, everything standing, the hook's chain, fireflies. */
  function classicWorld(s: GameState, ui: FrameUI, ground?: string): Picture {
    const info = mapInfo(world, s.map.id)
    const kind = info.def.kind
    const side = kind === 'side'
    if (!side) {
      if (!layer || layer.mapId !== s.map.id) layer = createTileLayer(world, s.map)
      else updateTileLayer(layer, world, s.map)
    }

    // Camera
    const cam = ui.cam ?? cameraFor(s, vw / T, vh / T)
    let cx = Math.round(cam.x * T)
    let cy = Math.round(cam.y * T)
    if (s.shake > 0 && !ui.reducedMotion) {
      cx += Math.round((Math.random() - 0.5) * 4 * Math.min(1, s.shake * 4))
      cy += Math.round((Math.random() - 0.5) * 4 * Math.min(1, s.shake * 4))
    }
    // A blow's kick: the picture leans along it (the camera the other way).
    const kn = nudge()
    cx -= Math.round(kn.x * T)
    cy -= Math.round(kn.y * T)
    const lights: Light[] = []
    const g = sg
    if (side) { sidePicture(g, s, ui, cx, cy, lights); return { cx, cy, lights } }
    g.fillStyle = ground ?? (kind === 'overworld' ? '#0e2a3c' : '#07040f')
    g.fillRect(0, 0, vw, vh)
    g.drawImage(layer!.canvas, -cx, -cy)
    drawLiveTiles(g, world, s, cx, cy, vw, vh, time, lights, ui.reducedMotion, kind === 'overworld' ? nightOf(dayOf('classic')) : 0)
    drawDecals(g, info.def.decals, cx, cy, vw, vh, { t: time, reduced: ui.reducedMotion, maxW: decalMaxW }, lights)

    const items = queue(g, s, ui, cx, cy, vw, vh, lights)
    floorMarks(g, s, ui, cx, cy)
    items.sort((a, b) => a.y - b.y)
    for (const it of items) it.draw()
    drawHookChain(g, s, cx, cy, lights)
    drawLatchLines(g, s, cx, cy, time, ui.reducedMotion, lights)
    if (info.def.look === 'wild' && !ui.attract) fireflies(cx, cy, vw, vh, ui.reducedMotion ? 0 : time, lights, g, dayOf('classic')?.fireflies ?? 1)
    const look = kind === 'overworld' && !ui.attract ? realmLook(info.def.look) : null
    const flies = look ? MOOD[look].flies : null
    if (flies) fireflies(cx, cy, vw, vh, ui.reducedMotion ? 0 : time, lights, g, flies.still ? 1 : dayOf('classic')?.fireflies ?? 1, flies.color, flies.light, flies.count)
    return { cx, cy, lights, items }
  }

  /** A side map's picture (`side.ts`), with this renderer's foes, blade and lights. (No shadows: no sun from the side.) */
  function sidePicture(g: G, s: GameState, ui: FrameUI, cx: number, cy: number, lights: Light[]) {
    camX = cx
    camY = cy
    arc = s.inv.arc
    twinList = s.map.enemies
    emit.length = 0
    const kit: SideKit = {
      g, world, cx, cy, vw, vh, time, reduced: ui.reducedMotion, lights,
      put: (name, x, y, flip, flash, sx, sy) => put(g, name, x, y, flip, flash, sx, sy),
      blade: (x, y) => drawBlade(g, s, x, y, lights),
      spin: (x, y) => drawSpinBlade(g, s, x, y, lights),
      // (A px lower than from above: its feet on the floor's lit edge.)
      foe(e) {
        if (!e.dead) drawEnemy(g, s, e, cx, cy + 1, lights, true)
        else if (e.deathT !== undefined && e.deathT < DEATH_POP && !e.away) drawDeathPop(g, s, e, cx, cy + 1)
      },
    }
    paintSide(kit, s)
  }

  /** The light map for that picture; returns the ambient colour it starts from. */
  function classicLight(s: GameState, ui: FrameUI, pic: Picture): string {
    const info = mapInfo(world, s.map.id)
    const { cx, cy, lights } = pic
    const amb = ambient(s, ui, lights)
    lg.globalCompositeOperation = 'source-over'
    lg.fillStyle = amb
    lg.fillRect(0, 0, vw, vh)
    // Shadows take from the dusk's light only: the lamps are added after, and shine into them.
    const par = dayParams('classic')
    // The sun's shadows over the whole map are cast again whenever it moves: by the hour it moves in steps of 3° and a tenth of a tile, a hard-pixel tick every few seconds.
    const own = paramsOf('classic')
    const turned = ((((par.sunAngle as number) - (own.sunAngle as number)) % 360) + 540) % 360 - 180
    const sunDeg = (own.sunAngle as number) + Math.round(turned / 3) * 3
    const sunLen = par.shadowLength === own.shadowLength ? own.shadowLength as number : Math.round((par.shadowLength as number) * 10) / 10
    const shadows = pic.items ? shade.frame(s, { angle: (sunDeg * Math.PI) / 180, length: sunLen, strength: par.shadow as number, color: par.shadowColor as string, moving: !!dayOf('classic') }, pic.items, lights, cx, cy, vw, vh) : null
    if (shadows) {
      lg.globalCompositeOperation = 'multiply'
      lg.drawImage(shadows, 0, 0)
    }
    lg.globalCompositeOperation = 'lighter'
    for (const L of lights) {
      const rad = L.r * T
      const px = L.x * T - cx
      const py = L.y * T - cy
      if (px < -rad || py < -rad || px > vw + rad || py > vh + rad) continue
      lg.globalAlpha = Math.max(0, Math.min(1, L.a))
      lg.drawImage(glow(L.color), px - rad, py - rad, rad * 2, rad * 2)
    }
    lg.globalAlpha = 1
    lg.fillStyle = '#ffffff'
    for (const e of emit) lg.fillRect(e.x, e.y, e.w, e.h)
    lightDecals(lg, info.def.decals, cx, cy, vw, vh, { t: time, reduced: ui.reducedMotion, maxW: decalMaxW })
    lg.globalCompositeOperation = 'source-over'
    return amb
  }

  /** What shines by itself, drawn after the light: the sun in the lake, the Other Side's static, shots, effects. `still` draws the effects without moving them on. */
  function classicGlows(g: G, s: GameState, ui: FrameUI, dt: number, pic: Picture, still = false) {
    const { cx, cy } = pic
    if (s.map.id === 'overworld') drawLakeSun(g, s, cx, cy, ui.reducedMotion)
    if (staticMood(s, mapInfo(world, s.map.id))) drawStaticMood(g, vw, vh, cx, cy, time, ui.reducedMotion)
    projectiles(g, s, (x, y) => ({ x: x * T - cx, y: y * T - cy }))
    drawFx(g, s, dt, (x, y, z = 0) => ({ x: x * T - cx, y: (y - z) * T - cy }), ui.paused || still)
  }

  /** Cover the world outside the current dungeon room. */
  function classicRooms(g: G, s: GameState, pic: Picture, color: string) {
    if (!roomed(mapInfo(world, s.map.id).def.kind) || s.scroll) return
    const z = s.zone
    g.fillStyle = color
    const zx = z.x * T - pic.cx
    const zy = z.y * T - pic.cy
    g.fillRect(0, 0, vw, Math.max(0, zy))
    g.fillRect(0, zy + z.h * T, vw, vh)
    g.fillRect(0, 0, Math.max(0, zx), vh)
    g.fillRect(zx + z.w * T, 0, vw, vh)
  }

  function classicBloom(bg: G, s: GameState, ui: FrameUI, pic: Picture) {
    const { cx, cy, lights } = pic
    for (const L of lights) {
      if (L.a < 0.3) continue
      const rad = L.r * T * 0.9
      const px = L.x * T - cx
      const py = L.y * T - cy
      if (px < -rad || py < -rad || px > vw + rad || py > vh + rad) continue
      bg.globalAlpha = Math.min(1, L.a) * 0.32
      bg.drawImage(glow(L.color), px - rad, py - rad, rad * 2, rad * 2)
    }
    bg.globalAlpha = 1
    bloomDecals(bg, mapInfo(world, s.map.id).def.decals, cx, cy, vw, vh, { t: time, reduced: ui.reducedMotion, maxW: decalMaxW })
  }

  /** `still`: a second picture of a frame another view draws (the hand-off), in which nothing moves on. */
  function drawClassic(s: GameState, ui: FrameUI, dt: number, still = false) {
    const g = sg
    const pic = classicWorld(s, ui)
    classicLight(s, ui, pic)
    g.globalCompositeOperation = 'multiply'
    g.drawImage(light, 0, 0)
    exposeDay(g)
    g.globalCompositeOperation = 'source-over'
    classicGlows(g, s, ui, dt, pic, still)
    classicRooms(g, s, pic, '#05030c')
    const fade = flashFade(g, s, ui, dt)
    present(fade, bg => classicBloom(bg, s, ui, pic))
    hudLayer(s, ui, dt, pic.cx, pic.cy, s.hero.y * T - pic.cy)
  }

  let lit: HTMLCanvasElement | null = null
  /** By day the lit picture is brightened past the art's own (the art is painted for the dusk): added onto itself, in part. */
  function exposeDay(g: G) {
    const x = dayOf(drawing)?.exposure ?? 0
    if (x <= 0.01) return
    if (!lit || lit.width !== vw || lit.height !== vh) lit = makeCanvas(vw, vh)
    const cg = lit.getContext('2d')!
    cg.globalCompositeOperation = 'copy'
    cg.drawImage(scene, 0, 0)
    g.globalCompositeOperation = 'lighter'
    g.globalAlpha = Math.min(1, x)
    g.drawImage(lit, 0, 0)
    g.globalAlpha = 1
  }

  let vig: HTMLCanvasElement | null = null
  function vignette(g: G, strength = 1) {
    if (!vig || vig.width !== W || vig.height !== H) {
      vig = makeCanvas(W, H)
      const vg = vig.getContext('2d')!
      const grad = vg.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75)
      grad.addColorStop(0, 'rgba(11,6,22,0)')
      grad.addColorStop(1, 'rgba(11,6,22,0.55)')
      vg.fillStyle = grad
      vg.fillRect(0, 0, W, H)
    }
    for (let n = strength; n > 0; n -= 1) {
      g.globalAlpha = Math.min(1, n)
      g.drawImage(vig, 0, 0)
    }
    g.globalAlpha = 1
  }

  /** The striped synthwave sun, reflected in Mirror Lake. */
  function drawLakeSun(g: G, s: GameState, cx: number, cy: number, reduced: boolean, qw = vw, qh = vh) {
    const sx = 55 * T - cx
    const sy = 33 * T - cy
    if (sx < -120 || sx > qw + 120 || sy < -80 || sy > qh + 80) return
    const glare = dayOf(drawing)?.glare ?? 1
    if (glare <= 0.02) return
    const m = s.map
    const cols = ['#ffd23f', '#ffb13f', '#ff8a3d', '#ff5f7a', '#ff2fa0', '#c42a9a']
    for (let i = 0; i < 14; i++) {
      const y = sy + i * 3
      const half = Math.round(Math.sqrt(Math.max(0, 1 - (i / 14) ** 2)) * 48)
      const wob = reduced ? 0 : Math.round(Math.sin(time * 2 + i * 0.9) * 2)
      g.fillStyle = cols[Math.min(cols.length - 1, Math.floor(i / 2))]!
      for (let x = -half; x < half; x += 2) {
        const tx = Math.floor((sx + x + cx) / T)
        const ty = Math.floor((y + cy) / T)
        if (m.tiles[ty * m.w + tx] !== '~') continue
        g.globalAlpha = (0.8 - i * 0.04) * glare
        g.fillRect(Math.round(sx + x + wob), Math.round(y), 2, 1)
      }
    }
    g.globalAlpha = 1
  }

  function drawFx(g: G, s: GameState, dt: number, place: Place, paused: boolean, squash = 1, foes: FoeView = { art: 0 }) {
    const h = s.hero
    // Dust at the hero's heels: off a roll, behind the finisher's lunge, where a run turns round.
    for (const what of heroFx) {
      const a = h.swing?.a ?? Math.atan2(h.vy, h.vx)
      if (what === 'roll') { dust(h.x, h.y, 5, { x: -Math.cos(a) * 1.5, y: -Math.sin(a) * 1.5 }); pulse(h.x, h.y, 1.6, '#2ff3ff', 0.16, 0.8) }
      else dust(h.x, h.y, 3, { x: -Math.cos(a) * 2, y: -Math.sin(a) * 2 })
    }
    heroFx = []
    if (!paused && dt > 0) {
      const sp = Math.hypot(h.vx, h.vy)
      if (sp > 3 && heroV.s > 3 && (h.vx * heroV.x + h.vy * heroV.y) / (sp * heroV.s) < -0.4 && h.act === 'walk') dust(h.x, h.y, 4, { x: -h.vx * 0.2, y: -h.vy * 0.2 })
      heroV = { x: h.vx, y: h.vy, s: sp }
    }
    if (!heroBare && h.x > -10) drawSmear(g, s, place)
    const keep: Fx[] = []
    for (const f of fx) {
      if (!paused) f.t += dt
      if (f.t > f.life) continue
      keep.push(f)
      if (f.t < 0) continue
      const p = f.t / f.life
      const lift = f.lift ?? 0
      if (f.kind === 'star') {
        // Four rays out from a white core, growing then gone.
        const at = place(f.x, f.y, lift / T)
        const x = Math.round(at.x)
        const y = Math.round(at.y)
        const len = Math.round(3 + (f.size - 3) * Math.min(1, p * 1.6))
        // The rays in the blow's colour, white toward the middle; short diagonals between them; a dark rim so it
        // reads on a foe flashing white.
        g.globalAlpha = 0.5
        g.fillStyle = '#0b0616'
        g.fillRect(x - len, y - 1, len * 2 + 1, 3)
        g.fillRect(x - 1, y - len, 3, len * 2 + 1)
        g.globalAlpha = 1
        g.fillStyle = f.color
        g.fillRect(x - len, y, len * 2 + 1, 1)
        g.fillRect(x, y - len, 1, len * 2 + 1)
        const d = Math.round(len * 0.45)
        for (let i = 1; i <= d; i++) { g.fillRect(x - i, y - i, 1, 1); g.fillRect(x + i, y - i, 1, 1); g.fillRect(x - i, y + i, 1, 1); g.fillRect(x + i, y + i, 1, 1) }
        const w = Math.max(1, Math.round(len / 2))
        g.fillStyle = '#ffffff'
        g.fillRect(x - w, y, w * 2 + 1, 1)
        g.fillRect(x, y - w, 1, w * 2 + 1)
        g.fillRect(x - 1, y - 1, 2, 2)
        continue
      }
      if (f.kind === 'slash') {
        // A straight cut across the foe, along the blade's way; it shrinks to its middle as it fades.
        const at = place(f.x, f.y, lift / T)
        const to = place(f.x + f.vx, f.y + f.vy, lift / T)
        let ux = to.x - at.x
        let uy = to.y - at.y
        const n = Math.hypot(ux, uy) || 1
        ux /= n; uy /= n
        const half = (f.size / 2) * (1 - p * 0.7)
        for (let i = -half; i <= half; i += 0.5) {
          const px = Math.round(at.x + ux * i)
          const py = Math.round(at.y + uy * i)
          g.fillStyle = Math.abs(i) < half * 0.6 ? '#ffffff' : f.color
          g.fillRect(px, py, 1, 1)
        }
        continue
      }
      if (f.kind === 'line') {
        // The HOP CUT: one long cut where the hero sprang, burning out from where it began.
        const n = Math.max(4, Math.round(Math.hypot(f.vx, f.vy) * T))
        const from = Math.floor(n * p * p)
        for (let i = from; i <= n; i++) {
          const q = i / n
          const at = place(f.x + f.vx * q, f.y + f.vy * q, lift / T)
          g.fillStyle = i > n - 3 || (i - from) < n * 0.1 ? '#ffffff' : f.color
          g.globalAlpha = 1 - p * 0.6
          g.fillRect(Math.round(at.x), Math.round(at.y), 1, 1)
        }
        g.globalAlpha = 1
        continue
      }
      if (f.kind === 'dust') {
        if (!paused) {
          f.x += f.vx * dt
          f.y += f.vy * dt
          f.vx *= 0.9
          f.vy *= 0.9
        }
        const at = place(f.x, f.y, (lift + p * 6) / T)
        g.globalAlpha = 0.8 * (1 - p)
        g.fillStyle = f.color
        g.fillRect(Math.round(at.x), Math.round(at.y), f.size, f.size)
        g.globalAlpha = 1
        continue
      }
      if (f.kind === 'sprite') {
        const fr = Math.min(f.frames! - 1, Math.floor(p * f.frames!))
        const spr = sprite(`${f.name}_${fr}`)
        const at = place(f.x, f.y)
        g.drawImage(spr, Math.round(at.x - spr.width / 2), Math.round(at.y - spr.height / 2))
        continue
      }
      if (f.kind === 'ring') {
        const at = f.name === 'hero' ? place(s.hero.x, s.hero.y) : place(f.x, f.y, lift / T)
        const x = at.x
        const y = at.y
        const rad = 4 + p * 16 * f.size
        g.globalAlpha = 1 - p
        g.strokeStyle = f.color
        g.lineWidth = 1
        g.beginPath()
        if (squash === 1) g.arc(Math.round(x), Math.round(y), rad, 0, Math.PI * 2)
        else g.ellipse(Math.round(x), Math.round(y), rad, rad * squash, 0, 0, Math.PI * 2)
        g.stroke()
        g.globalAlpha = 1
        continue
      }
      if (!paused) {
        f.x += f.vx * dt
        f.y += f.vy * dt
        if (f.kind === 'leaf') f.vy += 12 * dt
        f.vx *= 0.92
        f.vy *= f.kind === 'leaf' ? 1 : 0.92
      }
      g.globalAlpha = 1 - p * 0.7
      g.fillStyle = f.color
      const at = place(f.x, f.y, lift / T)
      g.fillRect(Math.round(at.x), Math.round(at.y), f.size, f.size)
      g.globalAlpha = 1
    }
    fx = keep
    foeBars(g, s, place, foes)
  }

  /** The hero's velocity last frame (a run turning round raises dust). */
  let heroV = { x: 0, y: 0, s: 0 }
  /** The chain's finisher, held on screen a moment after the swing ends. */
  let lastSwing: { sw: NonNullable<GameState['hero']['swing']>; x: number; y: number } | null = null
  let lingerAt = -1

  /**
   * The blade's smear: a crescent of hard pixels over the arc the blade has just swept, white at its head, then
   * cyan (gold for the Arc Blade), then a dithered deep tail, at the finest px the layer has. It is the circle the
   * blade's sprite sweeps round the hero's hand on the screen (`rOut` px), each px at the world angle the view's
   * ground gives its direction (`place`), so it follows the blade in every view. The chain's finisher is wider and
   * lingers a moment; the spin's goes round the whole circle.
   */
  function drawSmear(g: G, s: GameState, place: Place) {
    const h = s.hero
    let head: number, tail: number, rOut: number, fade = 1
    // The finisher's linger keeps only the rim, narrowing as it fades: a thin crescent, not the swept wedge.
    let rim = 0
    let lift = 0
    let hx = h.x, hy = h.y
    if (h.swing) {
      const sw = h.swing
      const p = Math.min(1, sw.t / swingDur(sw))
      const from = sw.n === undefined ? 0 : WINDUP
      if (p <= from + 0.02) { lastSwing = null; return }
      head = swingAngle(sw, p)
      tail = swingAngle(sw, Math.max(from, p - (sw.n === 2 ? 0.5 : 0.35)))
      rOut = (arc ? 18 : 16) * (sw.n === 2 ? 1.15 : 1)
      lastSwing = sw.n === 2 ? { sw: { ...sw }, x: h.x, y: h.y } : null
      lingerAt = -1
    } else if (h.spin) {
      const p = Math.min(1, h.spin.t / SPIN_TIME)
      const base = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[h.dir]
      head = base + Math.PI * 2 * p
      tail = head - Math.min(Math.PI * 2 * p, Math.PI * 1.25)
      rOut = arc ? 20 : 18
      lastSwing = null
    } else if (h.air?.kind === 'tempest') {
      // The tempest's whirl, round and round, in the air.
      const p = Math.min(1, h.air.t / airTime('tempest'))
      head = h.air.a + Math.PI * 2 * TEMPEST.turns * p
      tail = head - Math.min(Math.PI * 2 * TEMPEST.turns * p, Math.PI * 1.4)
      rOut = arc ? 21 : 19
      lift = heroZ(h)
      lastSwing = null
    } else if (chopAt && time - chopAt.at < 0.1 && time >= chopAt.at) {
      // FLIP CUT's chop: the whole arc at once, thinning out.
      fade = 1 - (time - chopAt.at) / 0.1
      head = chopAt.a + FLIP_CHOP.arc / 2
      tail = chopAt.a - FLIP_CHOP.arc / 2
      rOut = (arc ? 20 : 18) * 1.1
      rim = rOut * (0.35 + 0.4 * (1 - fade))
      hx = chopAt.x
      hy = chopAt.y
      lastSwing = null
    } else if (lastSwing) {
      // The finisher's smear stays a moment after the blow, thinning out.
      if (lingerAt < 0) lingerAt = time
      fade = 1 - (time - lingerAt) / 0.06
      if (fade <= 0 || time < lingerAt) { lastSwing = null; return }
      const sw = lastSwing.sw
      head = swingAngle(sw, 1)
      tail = swingAngle(sw, 0.5)
      rOut = (arc ? 18 : 16) * 1.15
      rim = rOut * (0.6 + 0.3 * (1 - fade))
      hx = lastSwing.x
      hy = lastSwing.y
    } else return
    const span0 = Math.abs(head - tail)
    if (span0 < 0.05) return
    const dirS = head > tail ? 1 : -1
    // The ground's axes on the scene at the hero, and back.
    const o = place(hx, hy)
    const ex = place(hx + 1, hy)
    const ey = place(hx, hy + 1)
    const ax = ex.x - o.x, ay = ex.y - o.y, bx = ey.x - o.x, by = ey.y - o.y
    const det = ax * by - bx * ay
    if (Math.abs(det) < 1e-6) return
    // The hand: 7 px up over the feet, as the classic painter holds the blade.
    const hand = place(hx, hy + 6 / T, 7 / T + lift)
    const px = hand.x
    const py = hand.y
    const t = g.getTransform()
    const cell = 1 / Math.max(1, Math.round(Math.hypot(t.a, t.b)))
    const ext = rOut + 1
    const eyt = rOut + 1
    const x0 = Math.floor((px - ext) / cell) * cell
    const y0 = Math.floor((py - eyt) / cell) * cell
    const mid = arc ? '#ffd23f' : '#2ff3ff'
    const deep = arc ? '#9a4ff0' : '#1a9fc4'
    const TAU = Math.PI * 2
    let style = ''
    for (let y = y0; y <= py + eyt; y += cell) {
      const v = y + cell / 2 - py
      for (let x = x0; x <= px + ext; x += cell) {
        const u = x + cell / 2 - px
        const wx = (u * by - v * bx) / det
        const wy = (v * ax - u * ay) / det
        const r = Math.hypot(u, v)
        if (r > rOut || r < 4) continue
        let off = ((Math.atan2(wy, wx) - tail) * dirS) % TAU
        if (off < 0) off += TAU
        if (off > span0) continue
        // 0 at the blade, 1 at the end of the trail.
        const age = 1 - off / span0
        // A crescent: the trail thins toward the blade's tip as it ages.
        if (r < Math.max(5 + rOut * 0.45 * age, rim)) continue
        const ix = Math.round(x / cell)
        const iy = Math.round(y / cell)
        // Fading out (the finisher's linger): fewer and fewer cells.
        if (fade < 1 && ((ix * 7 + iy * 13) % 10) / 10 > fade) continue
        let col: string
        if (age < 0.15) col = '#fff4ff'
        else if (age < 0.55) col = mid
        else { if ((ix + iy) & 1) continue; col = deep }
        if (col !== style) { g.fillStyle = col; style = col }
        g.fillRect(x, y, cell, cell)
      }
    }
  }

  /** The Other Side's mood: a dungeon room marked 'static', or an overworld area with the 'static' track. */
  function staticMood(s: GameState, info: ReturnType<typeof mapInfo>): boolean {
    if (roomed(info.def.kind)) return cellDef(info, s.zoneIndex)?.mood === 'static'
    const h = s.hero
    return !!info.def.areas?.some(a => a.track === 'static' && h.x >= a.x && h.x < a.x + a.w && h.y >= a.y && h.y < a.y + a.h)
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  // The values each engine draws with: its own, until the shell hands it a view's.
  const params = new Map<EngineId, ParamValues>()
  const paramsOf = (id: EngineId): ParamValues => {
    let p = params.get(id)
    if (!p) { p = resolveParams(id); params.set(id, p) }
    return p
  }
  /** The state being drawn and the engine drawing it, for the hour's light. */
  let frameState: GameState | null = null
  let drawing: EngineId = 'classic'
  const dayCache = new Map<EngineId, { t: number; own: ParamValues; look: DayLook; params: ParamValues }>()
  const str = (v: unknown, d: string) => typeof v === 'string' && v ? v : d
  /** Seconds into the day outdoors for this engine, or null: before the prism, under a roof, or no state yet. */
  function hourOf(id: EngineId): number | null {
    const s = frameState
    if (!s || mapInfo(world, s.map.id).def.kind !== 'overworld') return null
    const hold = paramsOf(id).daytime
    return typeof hold === 'string' && hold in HOURS ? HOURS[hold as keyof typeof HOURS] : s.daytime
  }
  function dayEntry(id: EngineId) {
    const t = hourOf(id)
    if (t === null) return null
    const own = paramsOf(id)
    const at = Math.round(t * 10) / 10
    const had = dayCache.get(id)
    if (had && had.t === at && had.own === own) return had
    const look = dayLook(at, {
      ambient: AMBIENT.overworld,
      sunAngle: own.sunAngle as number, shadowLength: own.shadowLength as number, shadow: own.shadow as number,
      skyTop: str(own.skyTop, '#1a0f4a'), skyHorizon: str(own.skyHorizon, '#ff5f9e'), haze: str(own.hazeColor, '#ff6fb0'),
      nightLight: str(own.nightLight, '#3a3878'), dawnLight: str(own.dawnLight, '#f0a4b0'), noonLight: str(own.noonLight, '#f4efe8'),
      nightSky: str(own.nightSky, '#070722'), nightHorizon: str(own.nightHorizon, '#2c2466'),
      dawnSky: str(own.dawnSky, '#2a2c78'), dawnHorizon: str(own.dawnHorizon, '#ffa26b'),
      noonSky: str(own.noonSky, '#2a7fd4'), noonHorizon: str(own.noonHorizon, '#a8e4ff'),
      noonBright: typeof own.noonBright === 'number' ? own.noonBright : 0.55,
    })
    const params: ParamValues = { ...own, sunAngle: look.sunAngle, shadowLength: look.shadowLength, shadow: look.shadow }
    if ('skyTop' in own) { params.skyTop = look.skyTop; params.skyHorizon = look.skyHorizon; params.hazeColor = look.haze }
    // The low sun's warmth goes with the low sun.
    if (typeof own.rim === 'number') params.rim = own.rim * look.low
    if (typeof own.rays === 'number') params.rays = own.rays * look.low
    const e = { t: at, own, look, params }
    dayCache.set(id, e)
    return e
  }
  const dayOf = (id: EngineId): DayLook | null => dayEntry(id)?.look ?? null
  const dayParams = (id: EngineId): ParamValues => dayEntry(id)?.params ?? paramsOf(id)

  function finishOf(id: EngineId): Finish {
    const p = paramsOf(id)
    return { scanlines: p.scanlines as number ?? 1, bloom: p.bloom as number ?? 1, vignette: p.vignette as number ?? 1 }
  }

  const kit: Kit = {
    world,
    size: () => ({ vw, vh, decalMaxW }),
    screen: () => ({ g: screen, W, H, scale, ox: Math.floor((W - vw * scale) / 2), oy: Math.floor((H - vh * scale) / 2), dpr }),
    sceneCanvas: () => scene,
    params: (id, own) => own ? paramsOf(id) : dayParams(id),
    day: dayOf,
    finish: finishOf,
    classic: { world: classicWorld, light: classicLight, glows: classicGlows, rooms: classicRooms, bloom: classicBloom },
    scene: () => sg,
    lightMap: () => ({ g: lg, canvas: light }),
    time: () => time,
    glow,
    emit,
    classicFocus(s, ui) {
      const cam = ui.cam ?? cameraFor(s, vw / T, vh / T)
      return { x: cam.x + vw / T / 2, y: cam.y + vh / T / 2 }
    },
    queue,
    floorMarks,
    ambient,
    projectiles,
    fx: drawFx,
    nudge,
    lakeSun: drawLakeSun,
    staticMood: s => staticMood(s, mapInfo(world, s.map.id)),
    setAim(fn) { aim = fn ?? (a => a) },
    setFacing(yaw) { facing = yaw; setLunaFacing(yaw) },
    setHeroBare(on) { heroBare = on },
    crossFade(seconds) {
      if (W < 2 || H < 2) return
      xfadeC ??= document.createElement('canvas')
      if (xfadeC.width !== W || xfadeC.height !== H) { xfadeC.width = W; xfadeC.height = H }
      const xg = xfadeC.getContext('2d')!
      xg.globalCompositeOperation = 'copy'
      xg.drawImage(canvas, 0, 0)
      xfadeA = 1
      xfadeS = Math.max(0.05, seconds)
    },
    heroLook: heroStyle,
    setSpan(fn) { span = fn },
    flashFade,
    present,
    hudLayer,
    hudSpace,
  }
  const views = new Map<string, View>()
  const turn = createTurn(id => views.has(id), TURN_S)
  /** The turn as a view draws it and the shell follows it: still at 0 through the hand-off. */
  const turned = (raw: number) => Math.max(0, (raw - HANDOFF) / (1 - HANDOFF))
  /** The classic picture as last drawn, kept to be laid over a view's during the hand-off. */
  let handC: HTMLCanvasElement | null = null
  /** A dissolve a view asked for (`crossFade`): the old picture, how much of it is left, and over how long it goes. */
  let xfadeC: HTMLCanvasElement | null = null
  let xfadeA = 0
  let xfadeS = 0.4
  /**
   * The start of a visit (`arrive`): the time night ends (0: no arrival under way; -1: it is counted from the first
   * frame drawn, `nightLeft` ms, so a tab opened in the background has its night when it is looked at), and
   * whether the view turns in after it.
   */
  let nightEnds = 0
  let nightLeft = 0
  let arriveTurns = false
  /** The first picture of a visit comes up out of the dark: when that began (0: not yet; -1: no such thing). */
  let dawnAt = -1
  /** The added view the last frame drew ('': the classic one alone). */
  let lastDrawn = ''
  /** The last frame painted the classic picture for the first time on this map: a long frame, not time passed. */
  let warmed = false
  /** A turn out has begun toward a classic picture this map has not had: it is painted in the turn's second frame. */
  let cold = false

  /** The screen as it is before a visit's first picture. */
  function night() {
    screen.setTransform(1, 0, 0, 1, 0, 0)
    screen.fillStyle = NIGHT
    screen.fillRect(0, 0, W, H)
  }
  /** Over the finished frame: the dark the first picture comes up out of. */
  function dawn() {
    if (dawnAt < 0) return
    const t = performance.now()
    if (!dawnAt) dawnAt = t
    const a = 1 - (t - dawnAt) / DAWN_MS
    if (a <= 0) { dawnAt = -1; return }
    screen.save()
    screen.setTransform(1, 0, 0, 1, 0, 0)
    screen.globalAlpha = a * a
    screen.fillStyle = NIGHT
    screen.fillRect(0, 0, W, H)
    screen.restore()
  }

  /**
   * Can a view draw? Asked with the game while the view is not on screen, so it can make what its first frame
   * needs (`View.ready`). A view that throws here is put away like one that throws drawing.
   */
  function able(id: string, v: View, hurry: boolean): boolean {
    if (!v.ready) return true
    try { return v.ready(hurry, lastDrawn === id ? undefined : frameState ?? undefined) } catch (e) {
      putAway(id, v, e)
      return false
    }
  }

  /** Views put away for throwing, counted: the shell watches the number (`viewState().failed`) and follows to the classic view. */
  let failed = 0
  /**
   * A view threw. It would throw again every frame, with the game running on unseen behind a still picture: it
   * is put away, and the classic view draws from here on. The turn stands on the classic picture too, unless
   * the view was on its way out anyway: then the turn ends there, on the picture it was heading for.
   */
  function putAway(id: string, v: View, e: unknown) {
    console.error(`view ${id} failed; the classic view takes over`, e)
    try { v.dispose?.() } catch { /* it is going anyway */ }
    views.delete(id)
    lastDrawn = ''
    if (turn.id === id) turn.set('classic', true)
    // (On its way out: it is gone, as a view that cannot draw is, and the turn does not run on without it.)
    else if (turn.shown === id) turn.step(0, false)
    failed++
  }

  /** The turn's share of the frame's time (`turnTime`): a long frame near the hand-off is not counted whole. */
  const clock = createTurnClock(HANDOFF, TURN_S)
  function turnDt(dt: number): number {
    const held = warmed
    if (turn.turning) warmed = false
    return clock(dt, turn, held)
  }

  /** The classic picture under (or before) a view's: drawn the classic way, with no time passing in it. */
  function classicUnder(s: GameState, ui: FrameUI, shown: string) {
    drawing = 'classic'
    aim = a => a
    span = null
    drawClassic(s, ui, 0, true)
    drawing = isEngineId(shown) ? shown : 'classic'
  }

  function draw(s: GameState, ui: FrameUI, dt: number) {
    frameState = s
    // A view whose camera turns says so again each frame (`setFacing`); every other picture is the classic way round.
    facing = 0
    setLunaFacing(0)
    begin(s, ui, dt)
    // A view that draws the hero itself says so again each frame.
    heroBare = false
    // Can the view on its way in (or on screen) draw? While it cannot, the turn waits on the classic picture.
    const coming = turn.shown ? views.get(turn.shown) : undefined
    let ready = true
    if (coming) {
      if (nightEnds < 0) nightEnds = performance.now() + nightLeft
      const dark = nightEnds > 0 && performance.now() < nightEnds
      ready = able(turn.shown, coming, dark)
      if (!ready && dark && views.has(turn.shown)) {
        // A visit's first moments: night, so the classic picture does not flash by on the way to this one.
        turn.step(dt, false)
        drawing = 'classic'
        aim = a => a
        span = null
        lastDrawn = ''
        night()
        return
      }
      // It takes longer than a moment: the classic picture after all, and the view turns in from it when it is here.
      if (!ready && nightEnds && arriveTurns) turn.set(turn.id, false)
    }
    nightEnds = 0
    const now = turn.step(turnDt(dt), ready)
    const v = now.shown ? views.get(now.shown) : undefined
    drawing = v && isEngineId(now.shown) ? now.shown : 'classic'
    if (!v) { aim = a => a; span = null; lastDrawn = ''; drawClassic(s, ui, dt); dawn(); return }
    // The hand-off: the classic picture is drawn first and kept, the view draws at the same still geometry, and
    // the classic one is laid over it, less of it each frame. (No time passes in the classic drawing: the view's
    // is the frame.)
    const over = now.k < HANDOFF ? 1 - now.k / HANDOFF : 0
    if (over > 0) {
      classicUnder(s, ui, now.shown)
      handC ??= document.createElement('canvas')
      if (handC.width !== W || handC.height !== H) { handC.width = W; handC.height = H }
      const hc = handC.getContext('2d')!
      hc.globalCompositeOperation = 'copy'
      hc.drawImage(canvas, 0, 0)
    }
    // On the way out to a classic picture this map has not had yet: it is painted at the start of the turn,
    // where its long frame is a short wait on a picture that has hardly moved, and not a halt at the hand-off.
    // (In the turn's second frame: the first one shows whatever answered the press.)
    const unpainted = over === 0 && turn.id !== now.shown && (!layer || layer.mapId !== s.map.id)
    if (unpainted && cold) { classicUnder(s, ui, now.shown); warmed = true }
    cold = unpainted && !cold
    try {
      v.draw(s, ui, dt, Math.max(1e-6, ease(turned(now.k))))
      lastDrawn = now.shown
      if (over > 0 && handC) {
        screen.save()
        screen.setTransform(1, 0, 0, 1, 0, 0)
        screen.globalAlpha = over
        screen.drawImage(handC, 0, 0)
        screen.restore()
      }
      if (xfadeA > 0 && xfadeC) {
        if (xfadeC.width === W && xfadeC.height === H) {
          screen.save()
          screen.setTransform(1, 0, 0, 1, 0, 0)
          screen.globalAlpha = xfadeA * xfadeA * (3 - 2 * xfadeA)
          screen.drawImage(xfadeC, 0, 0)
          screen.restore()
        }
        xfadeA = Math.max(0, xfadeA - Math.min(0.1, dt) / xfadeS)
      }
      dawn()
    } catch (e) {
      putAway(now.shown, v, e)
      drawing = 'classic'
      aim = a => a
      span = null
      drawClassic(s, ui, dt)
    }
  }

  /**
   * After a set: a view that cannot draw yet is waited for from this moment, not from the next frame drawn, so
   * whoever reads the state in between (the shell's dress, its corner) is never told the view is in.
   */
  function settle() {
    const v = turn.shown ? views.get(turn.shown) : undefined
    if (v && !able(turn.shown, v, false)) turn.step(0, false)
  }

  function setView(id: string, instant = false) { turn.set(id, instant); settle() }

  function arrive(id: string, nightMs: number, turnIn: boolean) {
    if (nightMs > 0 && views.has(id)) {
      turn.set(id, true)
      nightLeft = nightMs
      nightEnds = -1
      arriveTurns = turnIn
      return
    }
    // The classic picture is already up: the view turns in from it, or takes over at once.
    turn.set(id, !turnIn)
    settle()
  }

  function viewState() {
    const v = turn.shown ? views.get(turn.shown) : undefined
    const k = turned(turn.k)
    return { id: turn.id, k, turn: v ? v.turn * ease(k) : 0, turning: turn.turning, waiting: turn.waiting, dark: nightEnds !== 0, dawn: dawnAt >= 0, failed }
  }

  void cellIndex
  return {
    resize, draw, onEvents, viewTiles, setHeroColors, setHeroLook,
    addView(id, make) { views.set(id, make(kit)) },
    hasView: id => id === 'classic' || views.has(id),
    setView, arrive, viewState,
    dawn() { dawnAt = 0 },
    setParams(id, values) { params.set(id, resolveParams(id, values)) },
    dispose() {
      for (const v of views.values()) try { v.dispose?.() } catch { /* nothing to be done */ }
      views.clear()
    },
    fineUnit: () => scale < 2 ? 0 : hudScale(scale, W, H, 2) / 2 / dpr,
    pagePrism: () => prismAt,
    itemCells: () => cellsAt,
    logTargets: () => logAt,
  }
}
