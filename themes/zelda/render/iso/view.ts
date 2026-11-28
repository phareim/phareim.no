/**
 * The isometric view, rebuilt as a 16-bit machine would have dreamt it: the
 * same world turned 45° and tipped back, at twice the pixel density, with
 * real depth and real light.
 *
 * People, things and everything with a meaning of its own start as the
 * classic painters' art (the people, the hero and the bosses in this view's
 * own drawn art, `folk.ts`; standing things built as solids, `props.ts`, or
 * drawn by hand in the round, `things.ts`, the machines `machines.ts` with the classic
 * painter's live screens in their glass, and the square's newsstand and NEW LOOK stall with
 * their lit signs, mirror and people the same way); the ground, the walls and the roofs are this view's
 * own materials (`materials.ts`), laid where the classic art has that
 * surface's colours. Each frame the painters draw the map round
 * the camera into top-down pictures (ground, and what stands on it), every
 * person and thing draws itself into its own cell of an atlas, and this view
 * hands all of it to the GPU (`engine.ts`) as geometry: the ground as one
 * plane, a wall's top lifted, its face stood up, the sides nobody drew, pots
 * and lamps and people as billboards (`shape.ts` says how each tile stands).
 * There a z-buffer sorts it, the art is smoothed on its way up to two px a
 * texel, every lamp lights what it can see from the side it is on, the low
 * sun lights what faces it and throws shadows, water mirrors, neon blooms.
 *
 * At k = 0 the camera is the classic one and every effect is off, so the
 * renderer can turn one view into the other (`renderer.ts`, `project.ts`).
 * Without WebGL2 the canvas view this one replaced draws instead
 * (`legacy.ts`).
 */
import type { GameState, MapDef, MapKind, TileChar } from '../../types'
import { ARC_REACH, ROLL_TIME, SCROLL_TIME, SPIN_REACH, SPIN_TIME, SWORD_REACH, TEMPEST, TILE, roomed } from '../../types'
import { aimOf, airTime, has, heroZ, mapInfo, raised, swingAngle, swingDur } from '../../engine/index'
import { blockUp, isViewBlock } from '../../world/tiles'
import { SIDE_PATCH } from '../viewBlocks'
import { dirAngle } from '../../engine/util'
import { sycophantFocus, sycophantFrame } from '../../engine/bossSycophant'
import { houseTile } from '../steamPaint'
import { golemFocus } from '../../engine/bossGolem'
import { boxFocus } from '../../engine/bossBlackBox'
import { maximizerFocus } from '../../engine/bossMaximizer'
import type { FrameUI, Kit, SceneItem, Vec, View } from '../renderer'
import { drawLatchLines } from '../heapMarks'
import { chestStar, createTileLayer, drawLiveTiles, groundKindOf, hash2, updateTileLayer, type Light, type TileLayer } from '../tiles'
import { TONES } from '../tones'
import { drawDecals } from '../decals'
import { exitTiles, nearExit } from '../exits'
import { makeCanvas } from '../sheet'
import { NEON_SKIN } from '../hud'
import { HIRES_WINDOW_SKIN } from '../hud16'
import { drawHookChain, fireflies } from '../wild'
import { centreIn, groundRect, type Rect } from './project'
import { CARD, FLAT, ROOF, shapeOf, WALL_TOP, type Shape } from './shape'
import { standsIn } from '../standIns'
import { DENSITY, fitDepth, makeCam, toGround, toScene, type Cam } from './camera'
import { BVERT, createEngine, LVERT, VERT, type Engine, type Look } from './engine'
import { rgb } from './gl'
import { folkMix, folkRouter } from './folk'
import { furnitureAt, hasThing, LANDMARKS, thingKey, withThings } from './things'
import { machineArt, machineKit, machineLooks, MACHINE_SCREENS, screenFit, withMachines } from './machines'
import { kitsFor, realmArt as realmKit } from './frontierArt'
import { buildFlora, floraWithVisitor, stepFlora, type FloraAtlas, type FloraKind, type FloraLook } from './flora'
import { treeNow } from '../tree'
import { buildBackdrop, type Backdrop, type BackdropLook } from './backdrop'
import { nightOf, skyGrade, type DayLook } from '../daylight'
import { atlasBeyond, BEYOND, beyondTile, massifHeight } from '../beyond'
import { createLands, type Lands } from './lands'
import { buildLookMaterials, buildMaterials, materialId, stepLookMaterials, stepMaterials, type Material } from './materials'
import { CLASSIC, GROUND, lumaOf, MOOD, realmLook, type Life, type RealmLook } from '../looks'
import { realmAir, realmLife } from './air'
import { buildProps, COUNTER_TOP, stepProps, type PropAtlas, type PropKind, type PropSprite } from './props'
import { puzzlePropOf, rollKind } from './puzzleProps'
import { puzzleInfo } from '../../engine/index'
import { FIG, renderFigure, type FigureAct, type FigureBlade, type FigurePose, type FigureSprite } from './figure'
import { heroFootEase, rampSides, rampSlope, terrainCapOf, terrainFoot, terrainLift, terrainMaterial, terrainPlinth, terrainShape } from './terrain'

type G = CanvasRenderingContext2D
const T = TILE

/** How far below the view's edge a standing thing can start and still reach into it (classic px). */
const RISE = 56
/** A card's picture touches the ground this many px above its tile's bottom edge. */
const FOOT = 3
/** Overhang kept above a card's tile (a lamp's head, a crown's top). */
const UP = 10
/** A view block's height, tiles: lower than a wall (1), so what stands behind it shows. */
const VIEW_BLOCK_H = 0.625
/** A pile of paper clips (the Maximizer's ring) stands this high: a low wall that sight and shots pass. */
const PILE_H = 0.4

/** The lamp post whose glass is a street lamp's colour (`tiles.ts`; a realm's are `looks.ts` `MOOD.lamp`). */
const LAMP_PROPS: Record<string, PropKind> = { '#ff4fb8': 'lampPink', '#3ff0ff': 'lampCyan', '#ffd23f': 'lampGold', '#ffb13f': 'lampAmber', '#c87ae0': 'lampViolet' }
/** The life in the air of the frontier's maps without a realm look of their own (`air.ts` `realmLife`). */
const FRONTIER_LIFE: readonly Life[] = ['birds', 'fish']
/** How far into its cycle a shooting star is, in seconds (`backdrop.ts` `streak`): it shows for the first `on` of them. */
const streakOf = (k: { every: number; phase: number }, time: number) => (time + k.phase) % k.every
/** Dithered fills for the visible beams, one per colour (a checker in the colour, hi-res px). */
const beamPatterns = new Map<string, CanvasPattern | null>()
function beamPattern(g: G, color: string, zoom: number): CanvasPattern | null {
  let p = beamPatterns.get(color)
  if (p === undefined) {
    const c = makeCanvas(2, 2)
    const cg = c.getContext('2d')!
    cg.fillStyle = color
    cg.fillRect(0, 0, 1, 1)
    cg.fillRect(1, 1, 1, 1)
    p = g.createPattern(c, 'repeat')
    beamPatterns.set(color, p)
  }
  // (One cell of the checker is one hi-res px, however large a classic px is.)
  if (p && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix([1 / zoom, 0, 0, 1 / zoom, 0, 0]))
  return p
}

/** The rock beyond the map's edge, one to three tiles tall (`massifHeight`): a wall's top, further up. */
const MASSIF: readonly Shape[] = [WALL_TOP, { ...WALL_TOP, h: 2 * TILE }, { ...WALL_TOP, h: 3 * TILE }]

/**
 * A strip that lies flat in the ground picture where the view stands a thing in the round (a fence run north, a
 * counter laid north) is taken off the ground from its far end over this share of the thing's rise.
 */
const LAID_WIPE = 0.6

/** The two triangles of a quad round a point, as corners: a lamp's pool, a blob shadow. */
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]] as const

/** A lamp placed in the world for this frame: where, how far it reaches, its colour and strength. */
interface Placed { x: number; y: number; z: number; r: number; c: [number, number, number]; a: number }
/** What throws a blob: where it stands, how tall, its half width, how dark; `deep`: a body's half depth (its width runs along x). */
interface Card { x: number; y: number; tall: number; wide?: number; dark?: number; deep?: number }

/** The atlas of people and things: one cell each, small or big, in classic px. */
const ATLAS = 1024
const SMALL = { w: 64, h: 80, ax: 32, ay: 62 }
const BIG = { w: 200, h: 160, ax: 100, ay: 132 }
/**
 * The figures drawn in this view's own art (`folk.ts`) go into a second atlas at twice the size, cell for cell
 * with the first: a classic px (x, y) of the first is (2x, 2y) here. It covers the whole first atlas (part 20: the
 * knight is a big foe, in a big cell below the small ones); only the rows used are cleared and sent.
 */
const FOLK_ROWS = ATLAS


/**
 * How much the view spends: 2 everything, 1 without the costly extras (the
 * water's mirror, lamp shadows, corner shade, the frayed borders between two
 * grounds), 0 also with larger pixels and the ground and walls as the classic
 * art painted them (the materials are ten lookups more for every pixel).
 * A device that cannot keep up is stepped down while it plays and stays
 * there; `pinQuality` holds it still (the lab's software GPU is no judge).
 */
let pinned: number | null = null
export function pinQuality(q: number | null): void { pinned = q }

/**
 * The canvas view this one replaced, for a browser without WebGL2. Its code
 * is fetched only then; until it is here the classic picture is drawn, and
 * the controls stay unturned with it.
 */
function legacyView(kit: Kit): View {
  let v: View | null = null
  let gone = false
  const classic = legacyStandIn(kit)
  void import('./legacy').then(m => { v = m.default(kit) }, () => { gone = true /* offline: the classic picture stays */ })
  return {
    draw(s, ui, dt, k) { (v ?? classic).draw(s, ui, dt, k) },
    // (Until its code is here the renderer's own classic view draws, and this one turns in from it.)
    ready: () => v !== null || gone,
    get turn() { return v ? v.turn : 0 },
  }
}

/** The classic picture, drawn from the kit's parts: what shows while another way of drawing is not ready. */
function legacyStandIn(kit: Kit): View {
  return {
    draw(s, ui, dt) {
      const g = kit.scene()
      const pic = kit.classic.world(s, ui)
      kit.classic.light(s, ui, pic)
      g.globalCompositeOperation = 'multiply'
      g.drawImage(kit.lightMap().canvas, 0, 0)
      g.globalCompositeOperation = 'source-over'
      kit.classic.glows(g, s, ui, dt, pic)
      kit.classic.rooms(g, s, pic, '#05030c')
      const fade = kit.flashFade(g, s, ui, dt)
      kit.present(fade, bg => kit.classic.bloom(bg, s, ui, pic))
      kit.hudLayer(s, ui, dt, pic.cx, pic.cy, s.hero.y * T - pic.cy)
    },
    turn: 0,
  }
}

/** Where a stage spotlight's beam points (radians from east, clockwise): a slow swing to and fro. */
const spotSwing = (tm: number, x: number) => -0.9 + 0.85 * Math.sin(tm * 0.45 + x)

export default function isoView(kit: Kit): View {
  let engine: Engine
  try { engine = createEngine() } catch { return legacyView(kit) }
  /** The things built for this view (`props.ts`), once they are painted. */
  let propAtlas: PropAtlas | null = null
  /** The kits on the GPU now, joined by '+' ('' none). */
  let realmArt = ''
  /** The looks whose machines drawn by hand (parts 25–26, `machines.ts`) are packed beside the realm's kit ('' none). */
  let machinesIn = ''
  let coverDef: ReturnType<typeof mapInfo>['def'] | null = null
  const covered = new Set<number>()
  /** Solid scenery whose art is on the GPU: its classic stand-in (`../standIns.ts`) stands down for it. */
  const propped = new Set<number>()
  /** The realm look whose materials are on the GPU ('' the coast's). */
  let matLook = ''
  const sendProps = (kits: string, machines = machinesIn) => {
    realmArt = kits
    machinesIn = machines
    const art = kits ? Object.assign({}, ...kits.split('+').map(k => realmKit(k))) : undefined
    propAtlas = withThings(buildProps(), withMachines(art, machineKit(machines)))
    engine.props(propAtlas.albedo, propAtlas.normal, propAtlas.w, propAtlas.h)
    // (The landmarks that cover classic scenery are counted again with the kits that are on the GPU now.)
    coverDef = null
  }
  const sendMaterials = () => {
    const mats = buildMaterials()
    matLook = ''
    // (With the things drawn by hand packed under the built ones: part 23, `things.ts`.)
    engine.materials(mats.data, mats.w, mats.h)
    sendProps(realmArt)
  }
  /**
   * Puts the map's kits on the GPU once their art packs are here (`frontierArt/index.ts`); until then the atlas has
   * none of them, and their landmarks are left out (the classic scenery under them stays). False while one is
   * still on its way.
   */
  const prepareProps = (def: MapDef): boolean => {
    // (The hand-made maps' waymarks and barriers by the gates are a kit of their own, `coast`.)
    const want = kitsFor(def)
    const here = want.map(k => !!realmKit(k)).every(Boolean)
    const have = here ? want.join('+') : ''
    // (A room with machines packs their art beside it once its chunk is here: part 25. Meanwhile they stand as boxes. Once
    // packed they stay where no realm's kit comes in, so a door out of the arcade does not pack and send the atlas again.)
    const looks = machineLooks(def) || (have ? '' : machinesIn)
    const machines = looks && machineArt(looks) ? looks : ''
    if (have !== realmArt || machines !== machinesIn) sendProps(have, machines)
    return here
  }
  /**
   * Paints the view's own pictures, the materials and the things. All of it at once is a pause one can feel
   * on a phone, and it falls when the visitor asks for the view, so it is done a few milliseconds a frame
   * while the shaders compile anyway (more of them while the screen is dark, `hurry`); `all` (the lab, which
   * waits for nothing) does it in one go.
   */
  function paint(all: boolean, hurry: boolean): boolean {
    if (propAtlas) return true
    const t0 = performance.now()
    while (!(stepMaterials() && stepProps())) if (!all && performance.now() - t0 > (hurry ? 40 : 8)) return false
    sendMaterials()
    return true
  }
  let fallback: View | null = null
  /** Contexts made after a loss: a GPU that keeps losing them is left alone. */
  let revived = 0

  const world = kit.world
  let base: TileLayer | null = null
  let objects: TileLayer | null = null
  let shapes: Shape[] = []
  let shapesKey = ''
  let shapeMap: GameState['map'] | null = null
  /**
   * The field the view draws: the map and, outdoors, `M` tiles of the land beyond its edge on every side
   * (`../beyond.ts`). `outer` holds its tiles and `shapes` their shapes, ew × eh of them, the map's (0, 0) at (M, M).
   */
  let M = 0
  let ew = 0
  let eh = 0
  let outer: TileChar[] = []
  let lands: Lands | null = null
  /** The ground alone around the camera: what a standing tile leaves behind on the ground picture. */
  const ground = makeCanvas(256, 256)
  /** The map's standing things around the camera, on a clear ground. */
  const objs = makeCanvas(256, 256)
  /** What lies on the ground: the base plus the objects that stay down. */
  const flat = makeCanvas(256, 256)
  const atlas = makeCanvas(ATLAS, ATLAS)
  const ag = atlas.getContext('2d')!
  ag.imageSmoothingEnabled = false
  const folkAtlas = makeCanvas(ATLAS * DENSITY, FOLK_ROWS * DENSITY)
  const hg = folkAtlas.getContext('2d')!
  hg.imageSmoothingEnabled = false
  let folkUsed = 0
  const router = folkRouter(ag, hg, DENSITY)
  /** Shots, sparks, the flash: over the lit scene, in hi-res px. */
  const fx = makeCanvas(1, 1)
  const sky = makeCanvas(1, 1)
  let skyKey = ''
  let tilesKey = ''
  let verts = new Float32Array(VERT * 6 * 2048)
  let nv = 0
  let lightVerts = new Float32Array(LVERT * 6 * 256)
  let blobVerts = new Float32Array(BVERT * 6 * 128)
  /** This frame's people and things, small and large, and where those who stand have their feet (x, y pairs). */
  const small: SceneItem[] = []
  const large: SceneItem[] = []
  const standing: number[] = []
  /** Where the things with a body stand (x, y pairs): they carry lights like those who stand, and throw no blob. */
  const bearers: number[] = []
  /** Both kinds of feet, for the lights carried over them. */
  const feetOf = [standing, bearers] as const
  /**
   * Scratch for `draw`, emptied at the start of each frame instead of made again (a phone's collector notices
   * sixty maps and arrays a second): the counters' front edges, this frame's lights and loose lights, what throws a
   * blob, and the lamps placed in the world (their objects reused, `nPlaced` of them in use).
   */
  const tops = new Map<number, number>()
  const lights: Light[] = []
  const loose: Light[] = []
  const cards: Card[] = []
  const placed: Placed[] = []
  let nPlaced = 0
  /** A light's colour as the GPU takes it, by its hex (the same few colours every frame; read only). */
  const lampRgb = new Map<string, [number, number, number]>()
  const rgbOf = (hex: string): [number, number, number] => {
    let c = lampRgb.get(hex)
    if (!c) { if (lampRgb.size > 256) lampRgb.clear(); c = rgb(hex); lampRgb.set(hex, c) }
    return c
  }
  /** Small things in the air: the dust a step kicks up. World points (tiles), a height, a life. */
  const motes: Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; life: number; color: string }> = []
  let stepT = 0
  /** Prints the hero leaves in spore moss (they glow) and in snow (they are dark): world points, an age, the map they are on. */
  const prints: Array<{ x: number; y: number; t: number }> = []
  let printT = 0
  let printMap = ''
  let flora: FloraAtlas | null = null
  /** The hero's figure: this frame's picture, and the way the body faces on screen (it turns, it does not snap). */
  let fig: FigureSprite | null = null
  let yawShown: number | null = null
  let yawMap = ''
  /** The hero's height as last drawn on a map with terrain (`terrain.ts`). */
  let heroFoot: number | null = null
  let floraLook = ''
  /** The atlas rows in use last frame: what must be cleared, and what is sent to the GPU. */
  let atlasUsed = ATLAS
  let quality = 2
  let lastDraw = 0
  /** The gaps between the last frames that count, ms. */
  const gaps = new Float32Array(120)
  let gapN = 0
  /** Frames to leave out of the count: the first ones, and those after a map change (painting a map is not a slow GPU). */
  let settle = 90
  /** One way back up is allowed: a device that fails it again stays down. */
  let climbed = false
  let good = 0
  /**
   * Watch the time between frames, and step down when the device keeps
   * missing them. A window of frames is judged by its median, so one hitch
   * (a map being painted, a collection) decides nothing; a gap longer than
   * a few frames is a hidden tab, a pause or the shell's slow tick behind a
   * panel, and is not counted at all.
   */
  function govern(paused: boolean) {
    const now = performance.now()
    const gap = now - lastDraw
    lastDraw = now
    if (pinned !== null) { quality = pinned; return }
    if (paused || gap > 120 || gap <= 0) return
    if (settle > 0) { settle--; return }
    gaps[gapN++] = gap
    if (gapN < gaps.length) return
    gapN = 0
    const sorted = Array.from(gaps).sort((a, b) => a - b)
    const median = sorted[sorted.length >> 1]!
    // 30 a second can be a display holding back (low power mode): give up the extras, keep the pixels.
    if (quality === 2 && median > 24) { quality = 1; good = 0 }
    else if (quality === 1 && median > 42) { quality = 0; good = 0 }
    else if (quality < 2 && !climbed && median < 18.5 && ++good >= 4) { quality++; climbed = true; good = 0 }
  }

  /** Grow a top-down picture in steps, so walking does not reallocate it. */
  function fit(c: HTMLCanvasElement, w: number, h: number): G {
    const W = Math.ceil(w / 128) * 128
    const H = Math.ceil(h / 128) * 128
    if (c.width < W || c.height < H) { c.width = Math.max(c.width, W); c.height = Math.max(c.height, H) }
    const g = c.getContext('2d')!
    g.imageSmoothingEnabled = false
    return g
  }

  function tileAt(m: GameState['map'], kind: MapKind, x: number, y: number): TileChar {
    if (x >= 0 && y >= 0 && x < m.w && y < m.h) return m.tiles[y * m.w + x]!
    if (kind !== 'overworld') return '#'
    const ex = x + M
    const ey = y + M
    return ex >= 0 && ey >= 0 && ex < ew && ey < eh && shapeMap === m ? outer[ey * ew + ex]! : beyondTile(m.tiles, m.w, m.h, x, y, atlasBeyond(world, m.id))
  }

  /** The part of a map-sized picture under the window (bx, by, bw, bh), laid at the window's corner. */
  function part(g: G, src: HTMLCanvasElement, bx: number, by: number, bw: number, bh: number) {
    const x0 = Math.max(0, bx)
    const y0 = Math.max(0, by)
    const x1 = Math.min(src.width, bx + bw)
    const y1 = Math.min(src.height, by + bh)
    if (x1 > x0 && y1 > y0) g.drawImage(src, x0, y0, x1 - x0, y1 - y0, x0 - bx, y0 - by, x1 - x0, y1 - y0)
  }

  function rebuildShapes(s: GameState, kind: MapKind, beyond: number) {
    const m = s.map
    const own = exitTiles(world, m.id)
    M = beyond
    if (!M) lands = null
    ew = m.w + 2 * M
    eh = m.h + 2 * M
    // Not this map's field yet: `tileAt` asks the rule itself while the field is filled.
    shapeMap = null
    outer = new Array(ew * eh)
    for (let ey = 0; ey < eh; ey++) for (let ex = 0; ex < ew; ex++) outer[ey * ew + ex] = tileAt(m, kind, ex - M, ey - M)
    shapeMap = m
    shapes = new Array(ew * eh)
    for (let ey = 0; ey < eh; ey++) for (let ex = 0; ex < ew; ex++) {
      const tx = ex - M
      const ty = ey - M
      const inside = tx >= 0 && ty >= 0 && tx < m.w && ty < m.h
      let sh = shapeOf(outer[ey * ew + ex]!, kind, (dx, dy) => tileAt(m, kind, tx + dx, ty + dy), inside && own.has(ty * m.w + tx), true)
      // Solid scenery's classic stand-in stands up as a card (when the realm's own art is drawn, it stands down).
      if (inside && standsIn(m, ty * m.w + tx)) sh = CARD
      // The rock beyond the edge rises in steps the further out it lies.
      if (!inside && sh === WALL_TOP) sh = MASSIF[massifHeight(m.w, m.h, tx, ty + sh.f) - 1]!
      // Terrain: ground above its level stands up as a column (`terrain.ts`).
      if (inside && m.terrain) sh = terrainShape(m, tx, ty, sh)
      shapes[ey * ew + ex] = sh
    }
  }

  /** The shape of a tile now (crystal blocks go up and down without the map changing). */
  function shapeAt(tx: number, ty: number): Shape {
    const m = shapeMap!
    const ex = tx + M
    const ey = ty + M
    if (ex < 0 || ey < 0 || ex >= ew || ey >= eh) return FLAT
    const sh = shapes[ey * ew + ex]!
    if (sh.k !== 'card') return sh
    const t = outer[ey * ew + ex]
    // (A chest only THE LENS shows lies flat here: the glass draws it, `../balance.ts`.)
    if (t === '$' && mapInfo(world, m.id).chests.get(ty * m.w + tx)?.hidden) return FLAT
    if ((t === 'P' || t === 'C') && !raised(world, m, tx, ty)) return FLAT
    if (isViewBlock(t!) && !blockUp(t!, m.view)) return FLAT
    return sh
  }

  /**
   * A rock face outdoors with no top behind it (a wall one tile deep): the classic art never drew what lies
   * on it, so the view closes it with a cap and an east side of its own. A fence or a counter along x is a
   * face too, and no mass. Nor is a face between two rock tops: those stand a row further south, so it is the
   * north wall of a gap in them, and a cap on it would hang over the ground in front.
   * `strips`: a room whose walls stand in aisles one tile deep (a sandstone dungeon), closed the same way.
   */
  function loneFace(tx: number, ty: number, kind: MapKind, strips = false): boolean {
    if ((kind !== 'overworld' && !strips) || ty - 1 < -M) return false
    if (shapeAt(tx, ty).k !== 'face') return false
    const rock = (x: number): boolean => {
      if (x + M < 0 || x + M >= ew) return false
      const q = outer[(ty + M) * ew + x + M]
      return q === '#' || q === '%' || q === '^'
    }
    if (!rock(tx)) return false
    if ((rock(tx - 1) && shapeAt(tx - 1, ty).k === 'top') || (rock(tx + 1) && shapeAt(tx + 1, ty).k === 'top')) return false
    const n = shapeAt(tx, ty - 1).k
    return n !== 'top' && n !== 'face'
  }

  /** How many roof tiles lie south of this one in its house: its eaves are that many tiles away. */
  function roofSouth(tx: number, ty: number): number {
    let n = 0
    while (n < 12 && shapeAt(tx, ty + n + 1) === ROOF) n++
    return n
  }
  /** How much a house's roof rises for every tile north of its eaves (`roofPitch`), as the tile data was last sent. */
  let pitchSent = 0
  /** The map has a counter laid north: a strip of the ground picture, where every other counter is a face stood up. */
  let hasLaid = false
  /**
   * Such a counter has not been taken off the ground yet (`LAID_WIPE`): its tile keeps the classic floor under
   * it. The floor's material would paint the strip over long before the counter in the round is up.
   */
  let laidKeep = false

  /** What the light and the shadows need to know of each tile: how tall the mass on it is, and whether it is water. */
  function uploadTiles(kind: MapKind, look: string | undefined, green: boolean) {
    const wild = look === 'wild'
    const m = shapeMap!
    const realm = realmLook(look)
    const own: Record<string, Material> = realm
      ? { grass: GROUND[realm].grass, path: GROUND[realm].path, sand: GROUND[realm].sand, floor: 'flags', boards: 'boards' }
      : { grass: wild ? 'moss' : 'grass', path: wild ? 'lane' : 'cobbles', sand: 'sand', floor: 'flags', boards: 'boards' }
    const data = new Uint8Array(ew * eh * 4)
    for (let ey = 0; ey < eh; ey++) for (let ex = 0; ex < ew; ex++) {
      const sh = shapes[ey * ew + ex]!
      const t = outer[ey * ew + ex]
      // A wood of real trees is not a block: its trees throw their own soft shadows.
      if (sh.k === 'top' && !(green && t === 'T')) {
        const fy = ey + sh.f
        // A roof stands higher the further it is from its eaves.
        const rise = sh === ROOF && pitchSent > 0 ? pitchSent * (roofSouth(ex - M, ey - M) + 0.5) : 0
        if (fy < eh) { const o = (fy * ew + ex) * 4; data[o] = Math.max(data[o]!, Math.min(255, Math.round(((sh.h / T + rise) / 4) * 255))) }
      }
      // (A view block that is up casts a low mass's shadow.)
      if (isViewBlock(t!) && blockUp(t!, m.view)) { const o = (ey * ew + ex) * 4; data[o] = Math.max(data[o]!, Math.round((VIEW_BLOCK_H / 4) * 255)) }
      if (t === '~' || t === 'ω') data[(ey * ew + ex) * 4 + 1] = 255
      if (look === 'lab') {
        // A lab's ground is its plates wherever it is not a wall, coolant or a shaft (`paintLabBase`).
        data[(ey * ew + ex) * 4 + 3] = t === '#' || t === '%' || t === '^' || t === '~' || t === 'O' ? 0 : materialId('plates')
      } else {
        const tx = ex - M
        const ty = ey - M
        let gk = groundKindOf(kind, t!, (dx, dy) => tileAt(m, kind, tx + dx, ty + dy))
        // The back row of a rock has no ground of its own: the ground behind it runs on under it (`draw`).
        if (!gk && kind === 'overworld' && sh.k === 'top' && ey > 0 && shapes[(ey - 1) * ew + ex]!.k !== 'top') {
          gk = groundKindOf(kind, outer[(ey - 1) * ew + ex]!, (dx, dy) => tileAt(m, kind, tx + dx, ty - 1 + dy))
        }
        if (laidKeep && t === 'n' && sh.k !== 'face') gk = null
        data[(ey * ew + ex) * 4 + 3] = gk ? materialId(own[gk]!) : 0
      }
      if (loneFace(ex - M, ey - M, kind, look === 'dune')) {
        const fy = ey + sh.d
        if (fy < eh) { const o = (fy * ew + ex) * 4; data[o] = Math.max(data[o]!, Math.round(((sh.d + 1) / 4) * 255)) }
      }
      // Pavement after rain, a polished floor: neon shows in them (the composite pass).
      if (kind === 'overworld' ? t === ',' && !wild : t === '.' || t === ',' || t === 'f' || (isViewBlock(t!) && !blockUp(t!, m.view))) data[(ey * ew + ex) * 4 + 2] = kind === 'overworld' ? 150 : kind === 'interior' ? 190 : 110
      // The puzzles' ice is glazed, the drained basin still wet.
      if (t === 'α' || t === 'ψ') data[(ey * ew + ex) * 4 + 2] = t === 'α' ? 255 : 170
    }
    engine.tiles(data, ew, eh)
  }

  let backdrop: Backdrop | null = null
  let backdropKey = ''
  /** Where each layer was laid last (px), to know when one has moved. */
  let skyAt = new Int32Array(0)
  /** The hour the sky was last laid for (the sun's sink and fade, the stars'). */
  let skyHour = ''
  /**
   * What lies beyond the map's edge (`backdrop.ts`): layers that slide at
   * their own speeds as the camera moves, and clouds that drift. They are
   * laid on one scene-sized picture, again only when one of them has moved a
   * whole px.
   */
  function paintSky(look: BackdropLook, w: number, h: number, top: string, horizon: string, camX: number, time: number, day: DayLook | null = null) {
    const key = `${look}:${w}:${h}:${top}:${horizon}`
    if (key !== backdropKey) {
      backdrop = buildBackdrop(look, w, h, { top, horizon })
      backdropKey = key
      skyKey = ''
      if (sky.width !== w || sky.height !== h) { sky.width = w; sky.height = h }
    }
    const layers = backdrop!.layers
    // The hour: the sun sinks under the horizon at nightfall and fades as it climbs to noon; the stars go out by day.
    // Both in whole steps, so the picture is laid again only when one of them shows.
    const sinkPx = day ? Math.round(Math.max(0, 0.12 - day.sun) * h * 0.32) : 0
    const sunA = day ? Math.round(Math.max(0, Math.min(1, 1 - (day.sun - 0.25) / 0.4)) * 10) / 10 : 1
    const starA = day ? Math.round(Math.max(0, Math.min(1, day.stars)) * 10) / 10 : 1
    // The northern lights breathe, slowly, brighter in the dark: in tenths, so the sky is laid again only on a step
    // (and only a sky that has them).
    const auroraA = !layers.some(L => L.role === 'aurora') ? 1 : Math.round((0.55 + 0.45 * starA) * (0.72 + 0.28 * Math.sin(time * 0.35)) * 10) / 10
    const hourKey = `${sinkPx}:${sunA}:${starA}:${auroraA}`
    if (hourKey !== skyHour) { skyHour = hourKey; skyKey = '' }
    if (skyAt.length !== layers.length) skyAt = new Int32Array(layers.length).fill(-0x7fffffff)
    let moved = skyKey === ''
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i]!
      // A layer that blinks (a mast's lamp) is shown for the first half of each cycle: hidden is no place at all.
      // A shooting star is there for a moment of its cycle, where it has got to (never under reduced motion).
      const at = L.streak ? (time > 0 && streakOf(L.streak, time) <= L.streak.on ? Math.round(streakOf(L.streak, time) * 60) : 0x7fffffff)
        : L.blink && (time % L.blink) >= L.blink / 2 ? 0x7fffffff : Math.round(camX * L.parallax + time * L.drift)
      if (at !== skyAt[i]) { skyAt[i] = at; moved = true }
    }
    if (!moved) return
    skyKey = 'drawn'
    const sg = sky.getContext('2d')!
    sg.imageSmoothingEnabled = false
    sg.clearRect(0, 0, w, h)
    const line = Math.round(backdrop!.horizon * h)
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i]!
      const at = skyAt[i]!
      if (at === 0x7fffffff) continue
      const alpha = L.role === 'sun' ? sunA : L.role === 'stars' ? starA : L.role === 'aurora' ? auroraA : 1
      if (alpha <= 0) continue
      let y = Math.round(L.top * h)
      sg.globalAlpha = alpha
      if (L.role === 'sun' && sinkPx > 0) {
        // Under the horizon it is gone: only what stands above the line shows.
        y += sinkPx
        sg.save()
        sg.beginPath()
        sg.rect(0, 0, w, line)
        sg.clip()
      }
      const cw = L.canvas.width
      if (L.streak) {
        const ph = at / 60
        sg.globalAlpha = alpha * (ph < L.streak.on * 0.6 ? 1 : 0.5)
        sg.drawImage(L.canvas, Math.round(L.streak.x * w + ph * L.streak.dx), y + Math.round(ph * L.streak.dy))
      } else if (!L.repeatX) sg.drawImage(L.canvas, Math.round((w - cw) / 2) - at, y)
      else for (let x = -(((at % cw) + cw) % cw); x < w; x += cw) sg.drawImage(L.canvas, x, y)
      if (L.role === 'sun' && sinkPx > 0) sg.restore()
      sg.globalAlpha = 1
    }
    engine.sky(sky)
  }

  // --- geometry ------------------------------------------------------------------

  function room(floats: number) {
    if ((nv + 6) * VERT + floats > verts.length) {
      const next = new Float32Array(verts.length * 2)
      next.set(verts)
      verts = next
    }
  }
  function vert(x: number, y: number, z: number, ox: number, oy: number, u: number, v: number, kind: number, pic: number, shade: number, ramp: number) {
    const o = nv * VERT
    verts[o] = x; verts[o + 1] = y; verts[o + 2] = z
    verts[o + 3] = ox; verts[o + 4] = oy
    verts[o + 5] = u; verts[o + 6] = v
    verts[o + 7] = kind; verts[o + 8] = pic; verts[o + 9] = shade; verts[o + 10] = ramp
    nv++
  }
  /**
   * A picture on a plane. The four corners are world points, each with a
   * sideways screen offset in hi-res px (billboards), in the order top-left,
   * top-right, bottom-right, bottom-left of the picture's rectangle
   * (u0, v0)–(u1, v1). `oy` shifts the whole quad down the screen.
   */
  function quad(
    x0: number, y0: number, z0: number, o0: number,
    x1: number, y1: number, z1: number, o1: number,
    x2: number, y2: number, z2: number, o2: number,
    x3: number, y3: number, z3: number, o3: number,
    u0: number, v0: number, u1: number, v1: number,
    kind: number, pic: number, shade = 0, rampTop = 0, rampFoot = 0, oy = 0,
  ) {
    room(0)
    vert(x0, y0, z0, o0, oy, u0, v0, kind, pic, shade, rampTop)
    vert(x1, y1, z1, o1, oy, u1, v0, kind, pic, shade, rampTop)
    vert(x2, y2, z2, o2, oy, u1, v1, kind, pic, shade, rampFoot)
    vert(x0, y0, z0, o0, oy, u0, v0, kind, pic, shade, rampTop)
    vert(x2, y2, z2, o2, oy, u1, v1, kind, pic, shade, rampFoot)
    vert(x3, y3, z3, o3, oy, u0, v1, kind, pic, shade, rampFoot)
  }

  /**
   * A plant from the flora atlas, standing at a ground point: `pick` chooses
   * the variant (0..1), `sway` how much the wind moves it. Plants are drawn at
   * one atlas px to the hi-res px, so every one of their pixels is a pixel.
   * `z`: how high the ground it stands on is (a tree on the rock beyond the edge).
   */
  function plant(kind: FloraKind, x: number, y: number, pick: number, sway: number, px: number, z = 0, grow = 1) {
    const list = flora!.sprites[kind]
    if (!list || !list.length) return
    const sp = list[Math.min(list.length - 1, Math.floor(pick * list.length))]!
    // (Rising out of the ground: the top `grow` of the picture, its lower edge on the ground. Whole px, so every pixel stays a pixel.)
    const up = Math.round(sp.h * grow)
    if (up <= 0) return
    const foot = z - (sp.h - sp.ay) / (T * DENSITY)
    const top = foot + up / (T * DENSITY)
    const l = -sp.ax * px
    const r = (sp.w - sp.ax) * px
    quad(x, y, top, l, x, y, top, r, x, y, foot, r, x, y, foot, l, sp.x, sp.y, sp.x + sp.w, sp.y + up, 7, 2, sway)
  }

  /** The sign tiles an exit frames in neon (its frame is drawn for the classic sign, so that sign stays). */
  const signCache = new Map<string, Set<number>>()
  function signExits(mapId: string): Set<number> {
    let set = signCache.get(mapId)
    if (!set) {
      set = new Set()
      const info = mapInfo(world, mapId)
      for (const mk of info.marks) if (mk.ent.t === 'exit' && mk.ent.look === 'sign') set.add(mk.y * info.w + mk.x)
      signCache.set(mapId, set)
    }
    return set
  }

  /** The things standing this frame (kind, x, y, px each): their quads end the list, drawn with a depth of their own. */
  const stood: Array<[PropKind | `thing:${string}`, number, number, number, number, number]> = []
  /**
   * A thing built for this view (`props.ts`), or drawn by hand for it (`things.ts`, `thing:<id>`), standing at a
   * ground point: a pixel of it is a pixel of the scene.
   */
  function stand(kind: PropKind | `thing:${string}`, x: number, y: number, px: number, rise = 1, z = 0) {
    stood.push([kind, x, y, px, rise, z])
  }
  /**
   * A machine drawn by hand (part 25): the classic painter's own screens, drawn in the item's cell, stood in the glass of its
   * drawing (`MACHINE_SCREENS`, measured per drawing; placed by `screenFit`), running down half a px a column with the drawn
   * front, and risen with it. On the drawing's own card, each side of the screen brought a px nearer than the glass behind
   * it (the glass's depth read from the drawing, `depthCode`, at the screen's left and right column), along the line of
   * sight, so it stays where it is on the screen: one depth for the whole card left the nearer, right-hand side of the
   * glass over it. The hero in front still hides it. A region may stand in another drawn thing's key area (`part`, `box`:
   * a stall's sign on its roof, its mirror on its back wall), or be a person behind a counter (`stand`, part 26).
   */
  function machineScreens(it: SceneItem, ux: number, uy: number, ay: number, px: number, rise: number, cam: Cam) {
    if (!it.screens) return
    const TD = T * DENSITY
    const [lx, ly, lz] = cam.dv
    // (A pixel `q` px nearer than its card is drawn that much nearer along (1, 1, 1) / 32: the engine's `uDeep`.)
    const perPx = (lx + ly + lz) / TD
    const al = propAtlas!.albedo
    const aw = propAtlas!.w
    it.screens.forEach((sc, i) => {
      const p = it.things![sc.part ?? 0]
      const sp = p && (propAtlas!.sprites as Record<string, PropSprite>)[thingKey(p.id)]
      if (!p || !sp) return
      const sink = (sp.h - Math.round(sp.h * rise)) / TD
      if (sc.stand) {
        // A person behind the counter (part 26): an upright card of the region, its middle over the region's, standing
        // back from the item's point with its foot at the counter's top, so the drawn counter hides them below the waist.
        const cx = it.x + (sc.u + sc.w / 2) / T
        const cy = ay - sc.stand.y
        const z0 = sc.stand.z - sink
        const half = (sc.w / 2) * DENSITY * px
        const u0 = ux + sc.u
        const v0 = uy + sc.v
        quad(cx, cy, z0 + sc.h / T, -half, cx, cy, z0 + sc.h / T, half, cx, cy, z0, half, cx, cy, z0, -half, u0, v0, u0 + sc.w, v0 + sc.h, 3, 1)
        return
      }
      const b = MACHINE_SCREENS[p.id]?.[sc.box ?? i]
      if (!b) return
      const x = it.x + (p.dx ?? 0)
      const y = ay + (p.dy ?? 0)
      /** How far along the line of sight a corner comes forward: a px past the glass at that column of the drawing. */
      const ahead = (col: number, row: number): number => {
        const a = al[((sp.y + Math.round(row)) * aw + sp.x + col) * 4 + 3]!
        return ((a ? (a - 128) / 4 : 4.8) + 1) * perPx
      }
      const { S, c, r, sw, sh, du, dv } = screenFit(b, sc.w, sc.h)
      const zt = (sp.ay - r) / TD - sink
      const zr = zt - sw / 2 / TD
      const l = (c - sp.ax) * px
      const rr = (c + sw - sp.ax) * px
      const fl = ahead(c, r + sh / 2)
      const fr = ahead(c + sw - 1, r + (sw - 1) / 2 + sh / 2)
      const u0 = ux + sc.u + du
      const v0 = uy + sc.v + dv
      quad(
        x + lx * fl, y + ly * fl, zt + lz * fl, l,
        x + lx * fr, y + ly * fr, zr + lz * fr, rr,
        x + lx * fr, y + ly * fr, zr - sh / TD + lz * fr, rr,
        x + lx * fl, y + ly * fl, zt - sh / TD + lz * fl, l,
        u0, v0, u0 + sw / S, v0 + sh / S, 4, 1,
      )
    })
  }
  function standAll(): { start: number; count: number } | null {
    if (!stood.length) return null
    const start = nv
    for (const [kind, x, y, px, rise, z] of stood) {
      const sp = (propAtlas!.sprites as Record<string, PropSprite>)[kind]!
      // (Rising out of the ground as the turn ends: so many rows of the picture from its first one down, the last
      // of them on the ground. Whole rows, so every pixel stays a pixel.)
      const up = Math.round((sp.h - sp.top) * rise)
      if (up <= 0) continue
      const foot = z - (sp.h - sp.ay) / (T * DENSITY)
      const top = foot + up / (T * DENSITY)
      const l = -sp.ax * px
      const r = (sp.w - sp.ax) * px
      quad(x, y, top, l, x, y, top, r, x, y, foot, r, x, y, foot, l, sp.x, sp.y + sp.top, sp.x + sp.w, sp.y + sp.top + up, 3, 4)
    }
    stood.length = 0
    return { start, count: nv - start }
  }

  /**
   * The hero's pose this frame, from what the game says they are doing. The body turns toward where they are
   * headed at a pace (a quarter turn in a tenth of a second; faster into a swing), so a change of direction
   * is a turn and not a cut.
   */
  function heroPose(s: GameState, time: number, dt: number): FigurePose {
    const h = s.hero
    const arc = s.inv.arc
    const stride = ((h.walkT * 8.5) / 4) % 1
    let act: FigureAct = 'idle'
    let t = time
    let moving = false
    let target = aimOf(h)
    let turnRate = 15
    let blade: FigureBlade | undefined
    if (h.act === 'dead') {
      const d = s.dying ? s.dying.t : 0
      act = 'dead'
      t = d < 0.8 ? (d / 0.8) * 0.5 : Math.min(1, 0.5 + ((d - 0.8) / 0.6) * 0.5)
    } else if (h.act === 'fall') { act = 'fall'; t = Math.min(1, h.actT / 0.54) }
    else {
      switch (h.act) {
        case 'walk': act = 'walk'; t = stride; break
        case 'swing': act = 'swing'; t = h.swing ? Math.max(0, Math.min(1, h.swing.t / swingDur(h.swing))) : 1; break
        case 'throw': case 'use': case 'hook': act = 'use'; t = Math.min(1, h.actT / 0.2); break
        case 'spin': act = 'spin'; t = h.spin ? Math.min(1, h.spin.t / SPIN_TIME) : 1; break
        case 'lift': act = 'lift'; t = Math.min(1, h.actT / 0.18); break
        case 'carry': act = 'carry'; t = stride; moving = !!(h.vx || h.vy); break
        case 'push': act = 'push'; t = stride; break
        case 'hurt': act = 'hurt'; t = Math.min(1, h.actT / 0.3); break
        case 'get': act = 'get'; t = Math.min(1, h.actT / 0.3); break
        case 'roll': act = 'roll'; t = h.roll ? Math.min(1, h.roll.t / ROLL_TIME) : 1; break
        // The acrobatics (`engine/moves.ts`): the roll's turn in the air, the finisher's lunge, the spin's circle,
        // and the hop a stride of the run held off the ground.
        case 'air': {
          const a = h.air
          const p = a ? Math.min(1, a.t / airTime(a.kind)) : 1
          if (!a || a.kind === 'comet') { act = 'lunge'; t = 0.45 }
          else if (a.kind === 'tempest') { act = 'spin'; t = (p * TEMPEST.turns) % 1 }
          else if (a.kind === 'hop') { act = 'walk'; t = 0.25; moving = true }
          else { act = 'roll'; t = p }
          break
        }
      }
      const kind = arc ? 'arc' : 'sword'
      if (h.swing) {
        const p = Math.min(1, h.swing.t / swingDur(h.swing))
        const trail: number[] = []
        for (let i = 1; i <= 6; i++) { const q = p - i * 0.07; if (q < 0) break; trail.push(swingAngle(h.swing, q)) }
        blade = { a: swingAngle(h.swing, p), reach: arc ? ARC_REACH : SWORD_REACH, trail, kind, charge: 0, flash: false }
        target = h.swing.a ?? dirAngle(h.swing.dir)
        turnRate = 40
      } else if (h.spin) {
        const p = Math.min(1, h.spin.t / SPIN_TIME)
        const base = dirAngle(h.dir)
        const a = base + p * Math.PI * 2
        const trail: number[] = []
        for (let i = 1; i <= 10; i++) { const q = a - i * 0.22; if (q < base) break; trail.push(q) }
        blade = { a, reach: SPIN_REACH + (arc ? 0.2 : 0), trail, kind, charge: 0, flash: false }
        // The figure turns the circle itself, from where the spin began.
        yawShown = base
        target = base
      } else if (h.air?.kind === 'comet' || h.air?.kind === 'tempest') {
        const p = Math.min(1, h.air.t / airTime(h.air.kind))
        const a = h.air.kind === 'comet' ? h.air.a : h.air.a + Math.PI * 2 * TEMPEST.turns * p
        const trail: number[] = []
        if (h.air.kind === 'tempest') for (let i = 1; i <= 8; i++) trail.push(a - i * 0.25)
        blade = { a, reach: (arc ? ARC_REACH : SWORD_REACH) + 0.2, trail, kind, charge: 0, flash: false }
        if (h.air.kind === 'tempest') yawShown = a
        target = h.air.kind === 'comet' ? a : target
      } else if (h.charge > 0.12 && s.inv.sword && !h.carry) {
        blade = { a: target, reach: (arc ? ARC_REACH : SWORD_REACH) * 0.82, trail: [], kind, charge: Math.min(1, h.charge), flash: h.charge >= 0.55 && Math.floor(time * 12) % 2 === 0 }
      }
    }
    if (yawShown === null || yawMap !== s.map.id) yawShown = target
    yawMap = s.map.id
    const d = Math.atan2(Math.sin(target - yawShown), Math.cos(target - yawShown))
    const step = turnRate * dt
    yawShown += Math.abs(d) <= step ? d : Math.sign(d) * step
    return { yaw: yawShown, act, t, moving, blade }
  }

  /**
   * Is everything here to draw with: a context, the shaders (the driver compiles them off the main thread), the
   * view's own pictures and, when the view is not on screen yet (`s`), the map's? The renderer asks before every
   * frame and draws the classic view while the answer is no (`View.ready`); each call paints a little more.
   */
  function ready(hurry: boolean, s?: GameState): boolean {
    if (fallback) return fallback.ready ? fallback.ready(hurry, s) : true
    if (engine.lost()) {
      // The browser took the context (a tab left in the background, a driver reset): make another, and send
      // everything the old one held again. A GPU that will not give one gets the canvas view.
      engine.dispose()
      try {
        if (++revived > 3) throw new Error('context lost again')
        engine = createEngine()
        if (propAtlas) sendMaterials()
        tilesKey = ''; floraLook = ''; backdropKey = ''; atlasUsed = ATLAS; settle = 90; matLook = ''
      } catch { fallback = legacyView(kit); return ready(hurry, s) }
    }
    const had = propAtlas !== null
    const painted = paint(pinned !== null, hurry)
    const built = engine.ready(pinned !== null)
    if (built === 'failed') { engine.dispose(); fallback = legacyView(kit); return ready(hurry, s) }
    // (The map's pictures after the view's own, and not in the call that finished those: a slice is a slice.)
    // (In a visit's dark nothing is waited for but the view itself: its first frame is drawn under the dark, and
    // may be as long as it likes. The map's pictures are still made here meanwhile, as far as the dark lasts.)
    const mapped = !s || ((had || pinned !== null) && prepare(s, pinned !== null, hurry)) || (hurry && pinned === null)
    return painted && mapped && built === 'yes'
  }

  /** A map's tile pictures are new: its shapes and the land beyond follow, and the long frame is not the GPU's. */
  function fresh() {
    shapesKey = ''
    lands = null
    settle = Math.max(settle, 20)
    gapN = 0
  }
  const floraOf = (look: string | undefined): FloraLook => realmLook(look) ?? (look === 'wild' ? 'wild' : 'coast')
  /**
   * A realm look's materials on the GPU, or the coast's back (`materials.ts`): painted a sheet a call while
   * there is time (`late`), all at once when `late` is not given.
   */
  function lookMaterials(look: string | undefined, late?: () => boolean): boolean {
    if (!propAtlas) return true
    const want = realmLook(look) ?? ''
    if (matLook === want) return true
    if (want) {
      if (late) while (!stepLookMaterials(want)) if (late()) return false
      const mats = buildLookMaterials(want)
      engine.materials(mats.data, mats.w, mats.h)
    } else {
      const mats = buildMaterials()
      engine.materials(mats.data, mats.w, mats.h)
    }
    matLook = want
    return true
  }

  /**
   * What the first frame on a map paints before it can draw: the map's two tile pictures and, outdoors, the
   * plants. Together they are a pause of a tenth of a second or more, and the first frame of a view that was
   * waited for is the first frame of its turn; so while the view is not on screen they are made here, a piece a
   * call, as its own pictures are (`paint`). `draw` makes whatever is still missing: a map walked into, or a
   * visit's first frame, which is drawn under the dark and is not held back for them (`ready`).
   */
  function prepare(s: GameState, all: boolean, hurry: boolean): boolean {
    const m = s.map
    const t0 = performance.now()
    const late = () => !all && performance.now() - t0 > (hurry ? 40 : 8)
    if (!base || base.mapId !== m.id) { base = createTileLayer(world, m, 'base'); fresh(); if (late()) return false }
    if (!objects || objects.mapId !== m.id) { objects = createTileLayer(world, m, 'objects'); fresh(); if (late()) return false }
    const def = mapInfo(world, m.id).def
    // (The lab, which waits for everything, waits for the realm's kit too; a visit draws on without it.)
    if (!prepareProps(def) && all) return false
    const fLook = floraOf(def.look)
    if (def.kind === 'overworld' && floraLook !== fLook) {
      while (!stepFlora(fLook)) if (late()) return false
      flora = buildFlora(fLook)
      engine.flora(flora.albedo, flora.normal)
      floraLook = fLook
    }
    if (!lookMaterials(def.look, late)) return false
    return true
  }

  function draw(s: GameState, ui: FrameUI, dt: number, k: number) {
    if (!ready(false)) {
      // (Whoever draws without asking first gets night.)
      const g0 = kit.screen()
      g0.g.setTransform(1, 0, 0, 1, 0, 0)
      g0.g.fillStyle = '#0b0616'
      g0.g.fillRect(0, 0, g0.W, g0.H)
      return
    }
    if (fallback) { fallback.draw(s, ui, dt, k); return }
    govern(ui.paused)
    const scr = kit.screen()
    const { decalMaxW } = kit.size()
    const m = s.map
    const info = mapInfo(world, m.id)
    const def = info.def
    prepareProps(def)
    if (coverDef !== def) {
      coverDef = def
      covered.clear()
      propped.clear()
      const sprites = propAtlas!.sprites
      for (const { art, cover, solid, motion } of def.isoLandmarks ?? []) {
        if (!(cover || solid) || !Object.prototype.hasOwnProperty.call(sprites, thingKey(motion && !motion.bob ? `${art}_0` : art))) continue
        if (cover) for (let y = cover.y; y < cover.y + cover.h; y++) {
          for (let x = cover.x; x < cover.x + cover.w; x++) covered.add(y * m.w + x)
        }
        if (solid) for (let y = solid.y; y < solid.y + solid.h; y++) {
          for (let x = solid.x; x < solid.x + solid.w; x++) if (info.scenery.has(y * m.w + x)) propped.add(y * m.w + x)
        }
      }
    }
    const kind = def.kind
    const time = kit.time()
    const day = kit.day('iso')
    const afterDusk = !day || day.sun <= 0.12
    const reduced = ui.reducedMotion
    const outdoors = kind === 'overworld'

    if (!base || base.mapId !== m.id) { base = createTileLayer(world, m, 'base'); fresh() } else updateTileLayer(base, world, m)
    if (!objects || objects.mapId !== m.id) { objects = createTileLayer(world, m, 'objects'); fresh() } else updateTileLayer(objects, world, m)
    const par = kit.params('iso')
    // Outdoors the land goes on past the map's edge.
    const key = `${m.id}:${m.version}:${outdoors && par.beyond ? BEYOND : 0}`
    if (key !== shapesKey || shapeMap !== m) {
      rebuildShapes(s, kind, outdoors && par.beyond ? BEYOND : 0)
      shapesKey = key
      tilesKey = ''
      hasLaid = !outdoors && def.look !== 'lab' && shapes.some((sh, i) => outer[i] === 'n' && sh.k !== 'face')
    }
    const planted = outdoors && !!par.plants
    const pitch = outdoors ? (par.roofPitch as number) : 0
    // (Until the wipe is done: the counter rises over the turn's last fifth, `rise` below.)
    laidKeep = hasLaid && !!par.props && k < 0.8 + 0.2 * LAID_WIPE
    const tKey = `${key}:${planted}:${pitch}:${laidKeep}`
    if (tilesKey !== tKey) { pitchSent = pitch; uploadTiles(kind, def.look, planted); tilesKey = tKey }
    if (M && !lands) lands = createLands(kind, def.look, (x, y) => tileAt(m, kind, x, y), m.w, m.h, M)
    const fLook = floraOf(def.look)
    if (outdoors && floraLook !== fLook) { flora = buildFlora(fLook); engine.flora(flora.albedo, flora.normal); floraLook = fLook }
    lookMaterials(def.look)
    const realm = realmLook(def.look)
    const mood = realm ? MOOD[realm] : null
    // The beach tree, painted as the wood's trees are, for today's deploys and visitors: the atlas with it is made
    // again only when either changes (part 17).
    if (outdoors && flora && floraLook === fLook) {
      const tl = treeNow()
      const fv = floraWithVisitor(fLook, tl.stage, tl.count)
      if (fv !== flora) { flora = fv; engine.flora(fv.albedo, fv.normal) }
    }

    // --- the scene's size: one hi-res px is a whole number of device px ----------------
    // Half the classic px where that is a whole number of device px. Where it is not, a phone gets the larger
    // px (figures a fifth larger than classic, and fewer px to fill), a wide screen the smaller (more to see).
    const half = scr.scale / DENSITY
    const narrow = scr.W / scr.dpr < 700
    const hs = Math.max(1, Number.isInteger(half) ? half : narrow ? Math.ceil(half) : Math.floor(half)) + (quality === 0 && scr.scale >= 3 ? 1 : 0)
    const sw = Math.ceil(scr.W / hs)
    const sh = Math.ceil(scr.H / hs)
    const offX = Math.floor((scr.W - sw * hs) / 2)
    const offY = Math.floor((scr.H - sh * hs) / 2)
    /** Hi-res px per classic px where the turn starts: there the picture is as large as the classic one. */
    const zoom0 = scr.scale / hs
    const zoom = zoom0 + (DENSITY - zoom0) * k
    const vw = sw / zoom
    const vh = sh / zoom

    // --- projection and camera ------------------------------------------------------
    const P0 = makeCam(k, sw, sh, zoom0, { x: 0, y: 0 }).P
    const proj = (x: number, y: number): Vec => ({ x: x * P0.ex.x + y * P0.ey.x, y: x * P0.ex.y + y * P0.ey.y })
    const cf = kit.classicFocus(s, ui)
    const cClassic = proj(cf.x, cf.y)
    let c = cClassic
    if (!ui.cam) {
      const at = boxFocus(s, vw / 2 / T, vh / 2 / T, true) ?? maximizerFocus(s, vw / 2 / T, vh / 2 / T) ?? golemFocus(s, sycophantFocus(s))
      const focus = { x: at.x, y: at.y + 6 / T }
      let ci: Vec
      if (s.scroll) {
        const a = centreIn(P0, focus, s.scroll.from, vw, vh, RISE)
        const b = centreIn(P0, focus, s.scroll.to, vw, vh, RISE)
        const t = Math.min(1, s.scroll.t / SCROLL_TIME)
        const e = t * t * (3 - 2 * t)
        ci = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
      } else {
        ci = centreIn(P0, focus, s.zone, vw, vh, RISE)
        // The Sycophant's room: its card, and where THE END comes down, are kept in a picture smaller than the room.
        ci = sycophantFrame(s, ci, { x: vw, y: vh }, (x, y) => ({ x: x * P0.ex.x + y * P0.ey.x, y: x * P0.ex.y + y * P0.ey.y }))
      }
      c = { x: cClassic.x + (ci.x - cClassic.x) * k, y: cClassic.y + (ci.y - cClassic.y) * k }
    }
    const jitter = { x: 0, y: 0 }
    if (s.shake > 0 && !reduced) {
      jitter.x = -Math.round((Math.random() - 0.5) * 4 * Math.min(1, s.shake * 4)) * DENSITY
      jitter.y = -Math.round((Math.random() - 0.5) * 4 * Math.min(1, s.shake * 4)) * DENSITY
    }
    // A blow's kick (`Kit.nudge`, none under reduced motion): the picture leans along it.
    const kn = kit.nudge()
    if (kn.x || kn.y) {
      jitter.x += Math.round((kn.x * P0.ex.x + kn.y * P0.ey.x) * zoom)
      jitter.y += Math.round((kn.x * P0.ex.y + kn.y * P0.ey.y) * zoom)
    }
    const cam: Cam = makeCam(k, sw, sh, zoom0, c, jitter)
    const P = cam.P
    /** A ground point (tiles) on the scene, in classic px (what the kit's painters count in). */
    const S1 = (x: number, y: number, z = 0): Vec => { const p = toScene(cam, x, y, z); return { x: p.x / zoom, y: p.y / zoom } }

    // The tiles in play: the hero's room in a dungeon, everything in sight elsewhere.
    const R: Rect = groundRect(P, c, vw, vh, RISE, 2, m.w, m.h, M)
    fitDepth(cam, R)
    const rooms: Rect[] = !roomed(kind) ? [] : s.scroll ? [s.scroll.from, s.scroll.to] : [s.zone]
    const within = (z: Rect, x: number, y: number, pad: number) => x >= z.x - pad && x < z.x + z.w + pad && y >= z.y - pad && y < z.y + z.h + pad
    const inRoom = (x: number, y: number, pad = 0) => !rooms.length || rooms.some(z => within(z, x, y, pad))
    const bx = R.x * T
    const by = R.y * T
    const bw = R.w * T
    const bh = R.h * T

    /**
     * The tiles a counter built for this view stands on (`props.ts`), and where its front edge runs: what the
     * classic art puts on that tile's picture stands on its top, at the front, so a price under a ware hangs
     * down the counter's face.
     */
    tops.clear()
    /**
     * How far the things this view builds itself have come up (`props.ts`): they are drawn as the finished view
     * sees them, so they rise out of the ground over the last part of the turn, while the classic pictures they
     * stand in for sink into it. (Turned halfway, the parts of a counter would stand as a staircase.)
     */
    const rise = Math.max(0, Math.min(1, (k - 0.8) / 0.2))
    /** A point of the classic picture (tiles), where it is in the world: on the ground, on a roof, on a wall's face, on a card. */
    const world3 = (x: number, y: number): [number, number, number] => {
      const tx = Math.floor(x)
      const ty = Math.floor(y)
      const front = tops.get(ty * 4096 + tx)
      // (A fifth of a tile toward the viewer, which leaves it where it is on the screen: a card faces the viewer,
      // the counter's face runs east, and without it half of a price would stand inside the counter.)
      if (front !== undefined && rise >= 1) return [x + 0.2, front + 0.2, COUNTER_TOP / (T * DENSITY) + 0.2]
      if (front !== undefined) {
        // What lies on a counter goes up with it, from where the classic picture has it.
        const a = classic3(x, y)
        const e = rise * rise * (3 - 2 * rise)
        return [a[0] + (x + 0.2 - a[0]) * e, a[1] + (front + 0.2 - a[1]) * e, a[2] + (COUNTER_TOP / (T * DENSITY) + 0.2 - a[2]) * e]
      }
      return classic3(x, y)
    }
    const classic3 = (x: number, y: number): [number, number, number] => {
      const tx = Math.floor(x)
      const ty = Math.floor(y)
      const shp = inRoom(tx, ty) ? shapeAt(tx, ty) : FLAT
      if (shp.k === 'top') return [x, y + shp.f, shp.h / T + (shp === ROOF ? pitch * k * (roofSouth(tx, ty) + 1 - (y - ty)) : 0)]
      if (shp.k === 'face') return [x, ty + 1 + shp.d, shp.d + (ty + 1 - y)]
      if (shp.k === 'card') return [tx + 0.5, ty + 1 - FOOT / T, Math.max(0, ty + 1 - y - FOOT / T)]
      return [x, y, 0]
    }

    // --- the classic picture, in parts ---------------------------------------------
    lights.length = 0
    /** The time things move by (0 under reduced motion: everything holds still). */
    const tm = reduced ? 0 : time
    /** Beams that sweep (a landmark's `sweep` light): drawn over the lit scene as a dithered wedge. */
    const beams: Array<{ x: number; y: number; z: number; ang: number; reach: number; color: string; a: number }> = []
    const og = fit(objs, bw, bh)
    og.setTransform(1, 0, 0, 1, 0, 0)
    og.clearRect(0, 0, objs.width, objs.height)
    // The ground alone, and what stands on it: the land beyond the edge first, the map over it.
    const gg = fit(ground, bw, bh)
    gg.setTransform(1, 0, 0, 1, 0, 0)
    gg.clearRect(0, 0, ground.width, ground.height)
    if (lands) {
      const fresh = lands.draw(gg, 'base', bx, by, bw, bh)
      lands.draw(og, 'objects', bx, by, bw, bh)
      if (fresh) { settle = Math.max(settle, 10); gapN = 0 }
    }
    part(gg, base.canvas, bx, by, bw, bh)
    part(og, objects.canvas, bx, by, bw, bh)
    const night = outdoors ? nightOf(kit.day('iso')) : 0
    // (The view blocks are drawn for the picture they will be seen in: this view's own once the turn is past its half.)
    const blockFace = k > 0.5 ? 'iso' as const : 'flat' as const
    drawLiveTiles(og, world, s, bx, by, bw, bh, time, lights, reduced, night, blockFace)
    drawDecals(og, def.decals, bx, by, bw, bh, { t: time, reduced, maxW: decalMaxW }, lights)
    kit.setAim(a => Math.atan2(Math.cos(a) * P.ex.y + Math.sin(a) * P.ey.y, Math.cos(a) * P.ex.x + Math.sin(a) * P.ey.x))
    kit.setSpan((x1, y1, x2, y2) => ({ x: (x2 - x1) * P.ex.x + (y2 - y1) * P.ey.x, y: (x2 - x1) * P.ex.y + (y2 - y1) * P.ey.y }))
    ag.setTransform(1, 0, 0, 1, 0, 0)
    ag.clearRect(0, 0, ATLAS, Math.max(atlasUsed, 1))
    if (folkUsed) { hg.setTransform(1, 0, 0, 1, 0, 0); hg.clearRect(0, 0, folkAtlas.width, folkUsed); folkUsed = 0 }
    // The figures in this view's own art (`folk.ts`, the hero's `hero.ts`) take over from the classic sprites through
    // the middle of the turn, crossing in a stipple, about when the modelled hero does.
    const folk = par.figures !== 'classic' ? folkMix(k) : 0
    // The hero's body and blade are this view's own once the turn is under way (`figure.ts`); the classic
    // painter then draws only what the hero holds up.
    const modelled = k > 0.5 && par.figure === 'modelled'
    kit.setHeroBare(modelled)
    const items = kit.queue(ag, s, ui, bx, by, bw, bh, lights, og)

    const fg = fit(flat, bw, bh)
    fg.setTransform(1, 0, 0, 1, 0, 0)
    fg.clearRect(0, 0, flat.width, flat.height)
    fg.drawImage(ground, 0, 0, bw, bh, 0, 0, bw, bh)
    fg.drawImage(objs, 0, 0, bw, bh, 0, 0, bw, bh)
    /** Take what stands off the ground picture again: the ground alone comes back in that rectangle. */
    const bare = (x: number, y: number, w: number, h: number) => {
      fg.clearRect(x, y, w, h)
      const x0 = Math.max(0, x)
      const y0 = Math.max(0, y)
      if (x + w > x0 && y + h > y0) fg.drawImage(ground, x0, y0, x + w - x0, y + h - y0, x0, y0, x + w - x0, y + h - y0)
    }

    // --- what stands ---------------------------------------------------------------
    nv = 0
    stood.length = 0
    const shading = par.shading as number
    const eastShade = (0.16 + 0.5 * shading) * k
    const southShade = (0.06 + 0.3 * shading) * k
    cards.length = 0
    /** The row of the face tile with `d` face rows under it, in column tx below row ty; -1 if the art has none. */
    const faceRow = (tx: number, ty: number, d: number): number => {
      let y = ty + 1
      while (y < m.h + M && y <= ty + 8 && shapeAt(tx, y).k === 'top') y++
      for (; y < m.h + M; y++) {
        const q = shapeAt(tx, y)
        if (q.k !== 'face') return -1
        if (q.d === d) return y
      }
      return -1
    }
    // Plants are real ones once the turn is under way: trees with crowns, bushes, grass that stands (`flora.ts`).
    const grow = Math.max(0, Math.min(1, (k - 0.15) / 0.6))
    const green = outdoors && !!flora && grow > 0 && (par.plants as boolean)
    const px = zoom / DENSITY
    const solid = rise > 0 && !!par.props
    /** Are the things drawn by hand for this view (`things.ts`) standing in place of their classic cards. */
    const drawn = rise > 0 && par.things !== false
    /** Where this room is, for the furniture drawn by hand (`furnitureAt`): a lab's consoles blink at 2 a second, as the classic ones. */
    const room = { map: m.id, lab: def.look === 'lab', tick: reduced ? 0 : Math.floor(time * 2) }
    /** How much of a classic stand-in still stands (it sinks as this view's own thing rises in its place). */
    let sunk = 1
    const tileOf = (x: number, y: number): TileChar => tileAt(m, kind, x, y)
    // What stands in this view's own materials (`materials.ts`): a roof's shingles, a wall's boards, a cliff's
    // rock, the Shrine's bricks. The number rides with the picture's in a quad's meta (picture + 8 × material).
    const builtOf = (t: TileChar, top: boolean): number => {
      if (m.terrain) { const dm = terrainMaterial(t, top, def.look === 'wild'); if (dm) return 8 * materialId(dm) }
      if (def.look === 'lab') return t === '#' || t === '%' || t === '^' ? 8 * materialId(top ? 'plates' : 'steel') : 0
      if (kind === 'overworld') {
        if (t === 'H' || t === 'M' || t === 'D') return 8 * materialId(top ? 'shingles' : 'siding')
        // (A cracked face keeps the classic picture: the rock's material would take every colour of the crack.)
        if (t === '%' && !top) return 0
        if (t === '#' || t === '%' || t === '^') return 8 * materialId(top ? (realm ? GROUND[realm].top : def.look === 'wild' ? 'moss' : 'grass') : 'rockface')
        return 0
      }
      if (t !== '#' && t !== '%' && t !== '^') return 0
      return 8 * materialId(kind === 'dungeon' ? (top ? 'blocks' : 'bricks') : (top ? 'slab' : 'panel'))
    }
    /** Terrain (`terrain.ts`): a ramp, and the column under a thing that stands on raised ground. True: the tile is drawn. */
    const terrainTile = (tx: number, ty: number, t: TileChar, shp: Shape): boolean => {
      void t
      const n = terrainPlinth(m, tx, ty, shp)
      const slope = rampSlope(m, tx, ty)
      if (!n && !slope) return false
      const sx = (tx - R.x) * T
      const sy = (ty - R.y) * T
      const own = (q: TileChar, top: boolean) => { const dm = terrainMaterial(q, top, def.look === 'wild'); return dm ? 8 * materialId(dm) : 0 }
      if (n > 0) {
        // The column, capped with a plain neighbour's picture (under a chest lies turf, not chest).
        const [cx, cy] = terrainCapOf(m, tx, ty)
        const cap = m.tiles[cy * m.w + cx]!
        const ux = (cx - R.x) * T
        const uy = (cy - R.y) * T
        const side = own(cap, false)
        quad(tx, ty, n, 0, tx + 1, ty, n, 0, tx + 1, ty + 1, n, 0, tx, ty + 1, n, 0, ux, uy, ux + T, uy + T, 0, own(cap, true))
        if (terrainLift(m, tx, ty + 1) < n) quad(tx, ty + 1, n, 0, tx + 1, ty + 1, n, 0, tx + 1, ty + 1, 0, 0, tx, ty + 1, 0, 0, ux, uy, ux + T, uy + T, 1, side, southShade, 0, 1)
        if (terrainLift(m, tx + 1, ty) < n) quad(tx + 1, ty, n, 0, tx + 1, ty + 1, n, 0, tx + 1, ty + 1, 0, 0, tx + 1, ty, 0, 0, ux, uy, ux + T, uy + T, 2, side, eastShade, 0, 1)
      }
      if (!slope) return false
      // The ramp: its steps on a slope, and its sides where they face the viewer.
      bare(sx, sy, T, T)
      const [a, b, c2, d] = slope
      quad(a![0], a![1], a![2], 0, b![0], b![1], b![2], 0, c2![0], c2![1], c2![2], 0, d![0], d![1], d![2], 0, sx, sy, sx + T, sy + T, 0, 0)
      const side = own('а', false)
      for (const f of rampSides(m, tx, ty)) {
        const [p, q, r2, w] = f.q
        quad(p![0], p![1], p![2], 0, q![0], q![1], q![2], 0, r2![0], r2![1], r2![2], 0, w![0], w![1], w![2], 0, sx, sy, sx + T, sy + T, f.east ? 2 : 1, side, f.east ? eastShade : southShade, 0, 1)
      }
      return true
    }
    // From the near corner to the far one, so what stands in front is drawn first and hides the rest early.
    for (let ty = R.y + R.h - 1; ty >= R.y; ty--) for (let tx = R.x + R.w - 1; tx >= R.x; tx--) {
      if (!inRoom(tx, ty)) continue
      if (drawn && k >= 1 && tx >= 0 && tx < m.w && (covered.has(ty * m.w + tx) || (propped.has(ty * m.w + tx) && standsIn(m, ty * m.w + tx)))) {
        bare((tx - R.x) * T, (ty - R.y) * T, T, T)
        continue
      }
      const shp = shapeAt(tx, ty)
      const t = tileAt(m, kind, tx, ty)
      // The Steamhouse paints some of its tiles' things itself (`steamPaint.ts`): nothing of the tile's own stands.
      if (houseTile(info, t, tx, ty, s.view)) { bare((tx - R.x) * T, (ty - R.y) * T, T, T); continue }
      // (A counter or a fence that runs north lies flat as a card, and stands as a thing of this view's own.)
      const ownThing = solid && ((t === 'n' && def.look !== 'lab') || (t === 'F' && outdoors))
      /** Furniture drawn by hand for this view stands for this tile (part 23, `furnitureAt`). */
      const piece = drawn && (kind === 'interior' || def.look === 'lab') && !(tx >= 0 && ty >= 0 && tx < m.w && ty < m.h && exitTiles(world, m.id).has(ty * m.w + tx)) ? furnitureAt(tileOf, tx, ty, room) : null
      if (m.terrain && terrainTile(tx, ty, t, shp)) continue
      if (shp.k === 'flat' && !ownThing && !piece && !(green && (t === '.' || t === ';' || t === ':'))) continue
      // The ground rectangle is the box round a diamond: about half of it is off the screen.
      const midX = cam.ox + (tx + 0.5) * cam.ex.x + (ty + 0.5) * cam.ey.x
      const midY = cam.oy + (tx + 0.5) * cam.ex.y + (ty + 0.5) * cam.ey.y
      if (midX < -96 || midX > sw + 96 || midY < -80 || midY > sh + (RISE + 24) * zoom) continue
      // Where the tile's picture is in the top-down pictures.
      const sx = (tx - R.x) * T
      const sy = (ty - R.y) * T
      if (piece) {
        // A piece of furniture drawn by hand (part 23): it stands once for its run of tiles, and their pictures
        // (a card, a box, a strip on the ground) go.
        if (piece !== 'part') {
          stand(thingKey(piece.id), piece.x, piece.y, px, rise)
          cards.push({ x: piece.x, y: piece.y, tall: 0.7 * rise, wide: 0.45, dark: 0.8 })
        }
        if (rise >= 0.5) {
          const up = shapeAt(tx, ty - 1).k === 'flat' ? UP : 0
          bare(sx, sy - up, T, T + up)
          continue
        }
      }
      if (shp.k === 'card' && t === '▩') {
        // A pile of paper clips: a low heap, the clips' picture on its top, and on the sides that show the violet lip
        // along the picture's foot (the same clips again would lie flat).
        bare(sx, sy, T, T)
        quad(tx, ty, PILE_H, 0, tx + 1, ty, PILE_H, 0, tx + 1, ty + 1, PILE_H, 0, tx, ty + 1, PILE_H, 0, sx, sy, sx + T, sy + T, 0, 0)
        if (tileOf(tx, ty + 1) !== '▩') quad(tx, ty + 1, PILE_H, 0, tx + 1, ty + 1, PILE_H, 0, tx + 1, ty + 1, 0, 0, tx, ty + 1, 0, 0, sx + 1, sy + T - 3, sx + T - 1, sy + T - 1, 1, 0, southShade, 0, 1)
        if (tileOf(tx + 1, ty) !== '▩') quad(tx + 1, ty, PILE_H, 0, tx + 1, ty + 1, PILE_H, 0, tx + 1, ty + 1, 0, 0, tx + 1, ty, 0, 0, sx + 1, sy + T - 3, sx + T - 1, sy + T - 1, 2, 0, eastShade, 0, 1)
        continue
      }
      if (shp.k === 'card' && isViewBlock(t)) {
        // A view block that is up: a low block of the room's own wall materials, its shape cut into the top. It
        // grows out of the floor over the second half of the turn; before the half its picture lies as the classic one.
        if (blockFace === 'iso') {
          bare(sx, sy, T, T)
          const hz = VIEW_BLOCK_H * Math.min(1, (k - 0.5) * 2)
          const upAt = (x: number, y: number) => inRoom(x, y) && isViewBlock(tileOf(x, y)) && shapeAt(x, y).k === 'card'
          quad(tx, ty, hz, 0, tx + 1, ty, hz, 0, tx + 1, ty + 1, hz, 0, tx, ty + 1, hz, 0, sx, sy, sx + T, sy + T, 0, builtOf('#', true))
          const side = builtOf('#', false)
          const u0 = sx + SIDE_PATCH.x
          const v0 = sy + SIDE_PATCH.y
          const u1 = u0 + SIDE_PATCH.w
          const v1 = v0 + SIDE_PATCH.h
          if (!upAt(tx, ty + 1)) quad(tx, ty + 1, hz, 0, tx + 1, ty + 1, hz, 0, tx + 1, ty + 1, 0, 0, tx, ty + 1, 0, 0, u0, v0, u1, v1, 1, side, southShade, 0, 1)
          if (!upAt(tx + 1, ty)) quad(tx + 1, ty, hz, 0, tx + 1, ty + 1, hz, 0, tx + 1, ty + 1, 0, 0, tx + 1, ty, 0, 0, u0, v0, u1, v1, 2, side, eastShade, 0, 1)
        }
        continue
      }
      if (green) {
        const h1 = hash2(tx, ty, 21)
        const h2 = hash2(tx, ty, 22)
        const h3 = hash2(tx, ty, 23)
        if (t === 'T') {
          // The classic crown comes off the ground; a tree stands in its place, a little off the grid.
          const lone = shp.k === 'card'
          const up = shapeAt(tx, ty - 1).k === 'flat' ? UP : 0
          // (The classic crown is a little wider than its tile: two px round it go too.)
          const fy = shp.k === 'top' ? ty + shp.f : ty
          const sand = tileOf(tx - 1, ty) === '-' || tileOf(tx + 1, ty) === '-' || tileOf(tx, ty + 1) === '-' || tileOf(tx, ty - 1) === '-'
          plant(sand ? 'palm' : lone ? 'tree' : 'canopy', tx + 0.5 + (h1 - 0.5) * 0.4, fy + 0.62 + (h2 - 0.5) * 0.3, h3, 0.22, px, 0, grow)
          // A crown's shade is a wide soft pool, longer for a tree that stands alone.
          cards.push({ x: tx + 0.5, y: fy + 0.7, tall: (lone ? 1.5 : 1.1) * grow, wide: lone ? 0.5 : 0.8, dark: lone ? 0.85 : 0.7 })
          if (grow >= 1) { bare(sx - 2, sy - Math.max(up, 2), T + 4, T + Math.max(up, 2) + 2); continue }
        }
        if (t === '*' && shp.k === 'card') {
          plant('bush', tx + 0.5, ty + 0.78, h3, 0.3, px, 0, grow)
          if (grow >= 1) { bare(sx, sy, T, T); cards.push({ x: tx + 0.5, y: ty + 0.8, tall: 0.7 }); continue }
        }
        if (shp.k === 'flat' && !ownThing) {
          if (t === ';') {
            // Tall grass stands: the hero wades through it.
            plant('tall', tx + 0.3 + h1 * 0.2, ty + 0.45 + h2 * 0.15, h3, 1, px, 0, grow)
            plant('tall', tx + 0.6 + h2 * 0.25, ty + 0.8 + h1 * 0.15, h1, 1, px, 0, grow)
          } else if (t === ':') {
            // The same flowers the tile's light shines from: pink or cyan.
            const kindF: FloraKind = hash2(tx, ty, 6) > 0.5 ? 'flowerPink' : 'flowerCyan'
            plant(kindF, tx + 0.25 + h1 * 0.5, ty + 0.35 + h2 * 0.5, h3, 0.8, px, 0, grow)
            if (h3 > 0.4) plant(kindF, tx + 0.2 + h2 * 0.6, ty + 0.5 + h3 * 0.4, h1, 0.8, px, 0, grow)
          } else if (tileOf(tx + 1, ty) === '~' || tileOf(tx - 1, ty) === '~' || tileOf(tx, ty + 1) === '~' || tileOf(tx, ty - 1) === '~') {
            if (h1 > 0.55) plant('reed', tx + 0.2 + h2 * 0.6, ty + 0.25 + h3 * 0.6, h3, 0.9, px, 0, grow)
          } else if (h1 > 0.62) plant('tuft', tx + 0.15 + h2 * 0.7, ty + 0.2 + h3 * 0.7, h2, 1, px, 0, grow)
          continue
        }
      }
      if (shp.k === 'flat' && !ownThing) continue
      sunk = green && (t === 'T' || (t === '*' && shp.k === 'card')) ? 1 - grow : 1
      if (solid && t === 'F' && outdoors) {
        // A fence in the round: a post and rails out to wherever it goes on (a run to the north lay flat as a card).
        const sides = (tileOf(tx - 1, ty) === 'F' ? 1 : 0) | (tileOf(tx + 1, ty) === 'F' ? 2 : 0) | (tileOf(tx, ty - 1) === 'F' ? 4 : 0) | (tileOf(tx, ty + 1) === 'F' ? 8 : 0)
        stand(`fence${sides}`, tx + 0.5, ty + 0.5, px, rise)
        cards.push({ x: tx + 0.5, y: ty + 0.55, tall: 0.6 * rise, wide: 0.12 })
        if (rise >= 1) { bare(sx, sy, T, T); continue }
        // (A run that lies flat is taken off the ground from its far end while the fence comes up: gone in one
        // frame, it would leave a few frames with no fence at all.)
        if (shp.k === 'flat') { bare(sx, sy, T, Math.round(T * Math.min(1, rise / LAID_WIPE))); continue }
        sunk = 1 - rise
      }
      // (Not where an exit stands on the counter's tile and draws all of it itself: the newsstand.)
      if (solid && t === 'n' && def.look !== 'lab' && !(tx >= 0 && ty >= 0 && tx < m.w && ty < m.h && exitTiles(world, m.id).has(ty * m.w + tx))) {
        // A counter in the round, one part to the tile, in place of a strip of its picture stood up (or laid down).
        const n = tileOf(tx, ty - 1) === 'n'
        const s2 = tileOf(tx, ty + 1) === 'n'
        const along = tileOf(tx - 1, ty) === 'n' || tileOf(tx + 1, ty) === 'n'
        stand(!along && (n || s2) ? 'counterY' : n && s2 ? 'counterNS' : n ? 'counterN' : s2 ? 'counterS' : 'counter', tx + 0.5, ty + 0.5, px, rise)
        tops.set(ty * 4096 + tx, ty + 0.5 + (s2 || (!along && n) ? 0.5 : 9 / 32) + 0.02)
        cards.push({ x: tx + 0.5, y: ty + 0.6, tall: 0.5 * rise, wide: 0.5, dark: 0.8 })
        // (A strip of the classic counter stood along x sinks as this one rises; one laid north is in the ground
        // picture, and is taken off it from the far end while this one comes up, as a fence's is.)
        if (rise >= 1) { bare(sx, sy, T, T); continue }
        if (shp.k !== 'face') { bare(sx, sy, T, Math.round(T * Math.min(1, rise / LAID_WIPE))); continue }
        sunk = 1 - rise
      }
      if (shp.k === 'flat') continue
      if (shp.k === 'top') {
        bare(sx, sy, T, T)
        // A rock's back row has no ground of its own, and the mass stands a row south of it: the ground
        // behind runs on under it, or the dusk would show through the land.
        if (outdoors && sy >= T && shapeAt(tx, ty - 1).k !== 'top' && (t === '#' || t === '%' || t === '^')) fg.drawImage(ground, sx, sy - T, T, T, sx, sy, T, T)
        const fy = ty + shp.f
        const hz = (shp.h / T) * sunk
        // (A sinking crown closes as it reaches the ground: whole px off every edge.)
        const inPx = sunk < 0.25 ? Math.round((1 - sunk / 0.25) * T / 2) : 0
        if (inPx * 2 >= T) continue
        const q = inPx / T
        const side = builtOf(t, false)
        const slope = shp === ROOF ? pitch * k : 0
        if (slope > 0) {
          // A house's roof rises from its eaves toward the back: one plane, so what is painted on it stays whole.
          const zS = hz + slope * roofSouth(tx, ty)
          const zN = zS + slope
          quad(tx, fy, zN, 0, tx + 1, fy, zN, 0, tx + 1, fy + 1, zS, 0, tx, fy + 1, zS, 0, sx, sy, sx + T, sy + T, 5, builtOf(t, true), slope)
          if (shp.sides && !(shapeAt(tx + 1, ty) === ROOF && inRoom(tx + 1, ty))) {
            // The gable over the east wall: a plain patch of the wall's own picture, up to the roof.
            const fr = faceRow(tx, ty, 1)
            const gy = ((fr < 0 ? ty : fr) - R.y) * T
            quad(tx + 1, fy, zN, 0, tx + 1, fy + 1, zS, 0, tx + 1, fy + 1, hz, 0, tx + 1, fy, hz, 0, sx + 1, gy + 13, sx + 3, gy + 15, 2, side, eastShade, 0, 0)
          }
        } else quad(tx + q, fy + q, hz, 0, tx + 1 - q, fy + q, hz, 0, tx + 1 - q, fy + 1 - q, hz, 0, tx + q, fy + 1 - q, hz, 0, sx + inPx, sy + inPx, sx + T - inPx, sy + T - inPx, 0, builtOf(t, true))
        // The rock beyond the edge is wooded on top, so it is a hillside and not a tabletop. (No sway: the
        // wind bends a plant from the ground up, and these do not stand on it.)
        if (green && t === '#' && (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) && hash2(tx, ty, 24) > 0.42) {
          plant(hash2(tx, ty, 25) > 0.6 ? 'tree' : 'canopy', tx + 0.5 + (hash2(tx, ty, 21) - 0.5) * 0.4, fy + 0.6 + (hash2(tx, ty, 22) - 0.5) * 0.3, hash2(tx, ty, 23), 0, px, hz, grow)
        }
        const levels = Math.round(shp.h / T)
        const below = shapeAt(tx, ty + 1)
        // (A step down in the rock beyond the edge shows its side too, from the lower step's top up.)
        const step = below.k === 'top' && below.h < shp.h ? Math.round(below.h / T) : -1
        const south = shp.sides && (below.k === 'flat' || below.k === 'card' || step >= 0 || !inRoom(tx, ty + 1))
        const east = shp.sides && !(shapeAt(tx + 1, ty).k === 'top' && shapeAt(tx + 1, ty).h >= shp.h && inRoom(tx + 1, ty))
        for (let l = 0; l < levels; l++) {
          const r0 = 1 - (l + 1) / levels
          const r1 = 1 - l / levels
          if (south && l >= step) quad(tx + q, fy + 1 - q, (l + 1) * sunk, 0, tx + 1 - q, fy + 1 - q, (l + 1) * sunk, 0, tx + 1 - q, fy + 1 - q, l * sunk, 0, tx + q, fy + 1 - q, l * sunk, 0, sx + inPx, sy, sx + T - inPx, sy + T, 1, side, southShade, r0, r1)
          if (east) {
            // The east side runs from the back corner to the front one: the picture's left edge is the far end.
            const fr = faceRow(tx, ty, l)
            const ey = ((fr < 0 ? ty : fr) - R.y) * T
            quad(tx + 1 - q, fy + q, (l + 1) * sunk, 0, tx + 1 - q, fy + 1 - q, (l + 1) * sunk, 0, tx + 1 - q, fy + 1 - q, l * sunk, 0, tx + 1 - q, fy + q, l * sunk, 0, sx + inPx, ey, sx + T - inPx, ey + T, 2, side, eastShade, r0, r1)
          }
        }
        continue
      }
      if (shp.k === 'face') {
        bare(sx, sy, T, T)
        const y = ty + 1 + shp.d
        const side = builtOf(t, false)
        quad(tx, y, shp.d + sunk, 0, tx + 1, y, shp.d + sunk, 0, tx + 1, y, shp.d, 0, tx, y, shp.d, 0, sx, sy, sx + T, sy + Math.round(T * sunk), 1, side)
        if (loneFace(tx, ty, kind, def.look === 'dune')) {
          // Closed on top with a plain patch of its own picture, and on its east end with the picture again.
          const hz = shp.d + 1
          quad(tx, y - 1, hz, 0, tx + 1, y - 1, hz, 0, tx + 1, y, hz, 0, tx, y, hz, 0, sx + 6, sy + 12, sx + 7, sy + 13, 0, side)
          const e = shapeAt(tx + 1, ty).k
          if (e === 'flat' || e === 'card') quad(tx + 1, y - 1, hz, 0, tx + 1, y, hz, 0, tx + 1, y, 0, 0, tx + 1, y - 1, 0, 0, sx, sy, sx + T, sy + T, 2, side, eastShade, 0, 1)
        }
        continue
      }
      const up = shapeAt(tx, ty - 1).k === 'flat' ? UP : 0
      if (drawn && t === 'I' && def.look === 'lab') {
        // A lab's specimen tank, drawn by hand in the round (part 23, `things.ts`); its bubbles as the classic tile's.
        const id = `tank_${Math.floor((reduced ? 0 : time) * 3 + tx) % 2}`
        if (hasThing(id)) {
          stand(thingKey(id), tx + 0.5, ty + 0.55, px, rise)
          cards.push({ x: tx + 0.5, y: ty + 0.6, tall: 1.3 * rise, wide: 0.3 })
          if (rise >= 0.5) { bare(sx, sy - up, T, T + up); continue }
        }
      }
      if (solid) {
        // The things this view builds itself, in the round, where the classic art has a card.
        let prop: PropKind | null = null
        if (t === 'G' && outdoors) prop = 'grave'
        else if (t === 'o') prop = 'pot'
        else if (t === 'r') prop = 'rock'
        else if (t === 'R') prop = 'boulder'
        else if (t === 'S' && outdoors && !signExits(m.id).has(ty * m.w + tx)) prop = 'sign'
        else if (t === 'I' && def.look !== 'lab') prop = outdoors || def.look === 'dune' ? 'pillarStone' : 'pillarShrine'
        else if (t === 'P') prop = 'blockPink'
        else if (t === 'C') prop = 'blockCyan'
        else if (t === '$') {
          const ch = info.chests.get(ty * m.w + tx)
          const open = ch ? has(s, `chest:${ch.id}`) : true
          prop = ch?.big ? (open ? 'bigChestOpen' : 'bigChest') : open ? 'chestOpen' : 'chest'
        }
        else if (t === 'i' && kind === 'interior') prop = 'stool'
        else if (t === 'β' || t === 'ρ' || t === 'ξ' || t === 'μ' || t === 'ν' || t === 'π' || t === 'κ' || t === 'Θ' || t === 'Λ' || t === 'Φ' || t === 'Ξ') {
          // (Its art comes with the realm's pack: until that is here, as on a reload inside the Lighthouse, the built
          // mirrors stand.)
          if (drawn && k >= 1 && def.realm === 'yulefjord' && (t === 'μ' || t === 'ν') && thingKey(t === 'μ' ? 'fjord_mirror_a' : 'fjord_mirror_b') in propAtlas!.sprites) {
            stand(thingKey(t === 'μ' ? 'fjord_mirror_a' : 'fjord_mirror_b'), tx + 0.5, ty + 0.5, px, 1)
            bare(sx, sy - up, T, T + up)
            continue
          }
          // The physical puzzles' things (`puzzleProps.ts`): a receiver lit, a valve open, an emitter's way.
          const pz = puzzleInfo(info)
          const i = ty * m.w + tx
          const flag = pz.receivers.get(i) ?? pz.valves.get(i) ?? pz.sockets.get(i)?.flag
          prop = puzzlePropOf(t, { lit: !!m.phys?.lit.includes(i) || !!m.phys?.gas?.fed.includes(i) || ((t === 'ρ' || t === 'Λ') && !!flag && has(s, flag)), open: !!flag && has(s, flag), dir: pz.emitters.find(e => e.idx === i)?.dir ?? (t === 'Φ' ? s.lamp?.dir : undefined) })
        }
        else if (t === 't' && kind !== 'dungeon') {
          // (A torch on the beach keeps its flame; the lamp's colour is the classic one's, as its light is.)
          const sandy = (tileOf(tx + 1, ty) === '-' ? 1 : 0) + (tileOf(tx - 1, ty) === '-' ? 1 : 0) + (tileOf(tx, ty + 1) === '-' ? 1 : 0) + (tileOf(tx, ty - 1) === '-' ? 1 : 0) >= 2
          if (!(outdoors && sandy)) {
            const pair = outdoors && mood ? mood.lamp : null
            prop = pair ? LAMP_PROPS[pair[hash2(tx, ty, 11) < 0.5 ? 0 : 1]] ?? 'lampPink' : hash2(tx, ty, 11) < 0.5 ? 'lampPink' : 'lampCyan'
          }
          else if (drawn) {
            // The tiki torch drawn by hand, its flame leaning with the breeze as the classic one's (part 23).
            const id = `torch_${1 + (reduced ? 0 : Math.round(Math.sin(time * 5 + tx * 1.7)))}`
            if (hasThing(id)) {
              stand(thingKey(id), tx + 0.5, ty + 0.62, px, rise)
              cards.push({ x: tx + 0.5, y: ty + 0.66, tall: 1.1 * rise, wide: 0.12 })
              if (rise >= 0.5) { bare(sx, sy - up, T, T + up); continue }
            }
          }
        }
        if (prop) {
          stand(prop, tx + 0.5, prop === 'blockPink' || prop === 'blockCyan' || prop.startsWith('pz') ? ty + 0.5 : ty + 0.62, px, rise, terrainLift(m, tx, ty))
          const post = prop.startsWith('lamp')
          cards.push({ x: tx + 0.5, y: ty + 0.66, tall: (post ? 1.6 : prop === 'pot' || prop === 'rock' || prop === 'stool' ? 0.6 : 0.8) * rise, wide: prop === 'boulder' ? 0.36 : post ? 0.14 : 0.24 })
          if (rise >= 1) { bare(sx, sy - up, T, T + up); continue }
          sunk = 1 - rise
        }
      }
      // A card: the tile's picture upright, with what reaches above it when nothing stands there.
      bare(sx, sy - up, T, T + up)
      const fx0 = tx + 0.5
      const fy0 = ty + 1 - FOOT / T
      const rows = Math.round((T + up) * sunk)
      if (rows <= 0) continue
      const foot = -FOOT / T + terrainLift(m, tx, ty)
      const top = foot + rows / T
      const half = (T / 2) * zoom
      quad(fx0, fy0, top, -half, fx0, fy0, top, half, fx0, fy0, foot, half, fx0, fy0, foot, -half, sx, sy - up, sx + T, sy - up + rows, 3, 0)
      cards.push({ x: fx0, y: fy0, tall: (0.9 + up / T) * sunk })
    }

    // --- people and things, a cell each -------------------------------------------------
    // Small cells fill the atlas from the top, the hero's first; large ones follow below, the nearest to the
    // hero first, so when a room has more than the atlas holds it is the far cabinets that go without.
    const smallPerRow = Math.floor(ATLAS / SMALL.w)
    const bigPerRow = Math.floor(ATLAS / BIG.w)
    small.length = 0
    large.length = 0
    for (const it of items) {
      const ay = (it.ay ?? it.y) + (it.foot ?? 0)
      if (it.hero) small.unshift(it)
      else if (!inRoom(it.x, ay, 0.5)) continue
      else if (it.big) large.push(it)
      else small.push(it)
    }
    const bigTop = Math.ceil(small.length / smallPerRow) * SMALL.h
    if (bigTop + Math.ceil(large.length / bigPerRow) * BIG.h > ATLAS) {
      const hx = s.hero.x
      const hy = s.hero.y
      large.sort((a, b) => Math.hypot(a.x - hx, a.y - hy) - Math.hypot(b.x - hx, b.y - hy))
    }
    let used = 1
    // (The hero's height on terrain, eased down off a ledge.)
    heroFoot = m.terrain ? heroFootEase(yawMap === m.id ? heroFoot : null, s, ui.paused ? 0 : dt) : null
    const heroLift = heroFoot ?? 0
    standing.length = 0
    bearers.length = 0
    let ghost: { start: number; count: number } | null = null
    for (let n = 0; n < small.length + large.length; n++) {
      const big = n >= small.length
      const it = big ? large[n - small.length]! : small[n]!
      const i = big ? n - small.length : n
      const C = big ? BIG : SMALL
      const cellX = (i % (big ? bigPerRow : smallPerRow)) * C.w
      const cellY = (big ? bigTop : 0) + Math.floor(i / (big ? bigPerRow : smallPerRow)) * C.h
      if (cellY + C.h > ATLAS) continue
      used = Math.max(used, cellY + C.h)
      const ay = (it.ay ?? it.y) + (it.foot ?? 0)
      // The beach tree: the painted one, a plant like the wood's (once the turn has the plants up; part 17).
      if (it.tree && green && flora?.sprites.visitor?.length) {
        plant('visitor', it.x, ay, 0, 0.18, px, 0, grow)
        cards.push({ x: it.x, y: ay + 0.1, tall: 1.5 * grow, wide: 0.6, dark: 0.85 })
        if (grow >= 1) continue
      }
      // Things drawn by hand for this view (part 23, `things.ts`; value `things`) stand where the item does, in the
      // ground like the built things; the classic card goes once they are halfway up. A booth's DJ stays a card (`bare`).
      let draw = it.draw
      /** How far back along the line of sight the card stands (a DJ behind the table): the same place on the screen. */
      let back = 0
      /** A machine drawn by hand (part 25, value `machines`) stands, and the classic painter's screens go in its glass. */
      let lit = false
      if (drawn && it.things?.every(p => it.screens ? machinesIn && thingKey(p.id) in propAtlas!.sprites : hasThing(p.id)) && (!it.screens || par.machines !== false)) {
        for (const p of it.things) stand(thingKey(p.id), it.x + (p.dx ?? 0), ay + (p.dy ?? 0), px, rise)
        if (it.shade) cards.push({ x: it.x + it.shade.dx, y: ay + it.shade.dy, tall: it.shade.tall * rise, wide: it.shade.wide, deep: it.shade.deep, dark: 0.9 })
        if (rise >= 0.5) {
          if (it.screens) {
            lit = true
            // (A stall's cell holds only its live parts and its people, on nothing: part 26.)
            if (it.bare) draw = it.bare
          } else if (!it.bare) continue
          else {
            draw = it.bare
            back = it.bareBack ?? 0
          }
        }
      }
      // The item draws itself the classic way; its anchor lands on the cell's.
      ag.save()
      ag.beginPath()
      ag.rect(cellX + 1, cellY + 1, C.w - 2, C.h - 2)
      ag.clip()
      ag.setTransform(1, 0, 0, 1, Math.round(cellX + C.ax - (it.x * T - bx)), Math.round(cellY + C.ay - (ay * T - by)))
      // (The hero too, in its own art (`hero.ts`, part 21), unless the modelled hero is drawn instead. In the
      // Steamhouse's robe it is the classic figure: the robe is painted on that card, and art behind it would show
      // through it as a figure seen through a wall does.)
      if (folk > 0 && cellY + C.h <= FOLK_ROWS && !(it.hero && (modelled || s.hero.robe))) router.begin(cellX, cellY, C.w, C.h, folk)
      draw()
      const folkHit = router.end()
      if (folkHit) folkUsed = Math.max(folkUsed, (cellY + C.h) * DENSITY)
      ag.restore()
      const u1 = cellX + C.w
      const v1 = cellY + C.h
      const top = C.ay / T
      const foot = -(C.h - C.ay) / T
      if (lit) {
        machineScreens(it, cellX + C.ax, cellY + C.ay, ay, px, rise, cam)
        bearers.push(it.x, ay)
        continue
      }
      if (it.box && par.props) {
        // A cabinet, a booth: its drawing is its front, stood along the wall it faces, and behind it a body the
        // classic art never drew, closed on top and to the east with a plain patch of the drawing's own edge.
        const x0 = it.x - C.ax / T
        const x1 = it.x + (C.w - C.ax) / T
        // (Early in the turn the front is a hair nearer than the wall plane it stands on: a counter's strip beside
        // it stands on the same plane and would cut into its awning. In depth only: the offsets put it back where
        // it was on the screen.)
        const nb = 0.03 * (1 - k)
        const fy = ay + nb
        const nx = -nb * cam.ey.x
        quad(x0, fy, top, nx, x1, fy, top, nx, x1, fy, foot, nx, x0, fy, foot, nx, cellX, cellY, u1, v1, 4, 1, 0, 0, 0, -nb * cam.ey.y)
        const hw = it.box.w / 2 / T
        const hz = it.box.h / T
        // (The body grows back from its front as the picture turns: at k = 0 the front stands where the classic drawing does.)
        const d = (it.box.d / T) * Math.min(1, k * 1.5)
        const pu = cellX + C.ax - it.box.w / 2 + (it.box.px ? it.box.px[0] : 1)
        const pv = cellY + C.ay - (it.box.px ? it.box.h - it.box.px[1] : Math.round(it.box.h / 2))
        quad(it.x - hw, ay - d, hz, 0, it.x + hw, ay - d, hz, 0, it.x + hw, ay, hz, 0, it.x - hw, ay, hz, 0, pu, pv, pu + 1, pv + 1, 0, 1)
        quad(it.x + hw, ay - d, hz, 0, it.x + hw, ay, hz, 0, it.x + hw, ay, 0, 0, it.x + hw, ay - d, 0, 0, pu, pv, pu + 1, pv + 1, 2, 1, eastShade, 0, 1)
        // (Its shadow is as wide as the side it turns to the light: a stall three tiles long throws a broad one south, a narrow one east.)
        cards.push({ x: it.x, y: ay - d / 2, tall: Math.min(1.6, hz * 0.8), wide: hw, deep: d / 2, dark: 0.9 })
        bearers.push(it.x, ay)
        continue
      }
      if (it.wall) {
        // On the wall behind it: one px to the right runs along the wall, one px up is up.
        const x0 = it.x - C.ax / T
        const x1 = it.x + (C.w - C.ax) / T
        const wy = ay + 0.03
        quad(x0, wy, top, 0, x1, wy, top, 0, x1, wy, foot, 0, x0, wy, foot, 0, cellX, cellY, u1, v1, 4, 1)
        continue
      }
      let fx0 = it.x
      let fy0 = ay
      let z0 = 0
      if (it.tile) {
        // On its tile's picture, wherever that went, and in front of it: goods on a counter, a sign's neon frame.
        const p = world3(it.x, ay - 0.01)
        if (p[2] > 0 || shapeAt(Math.floor(it.x), Math.floor(ay - 0.01)).k !== 'flat') { fx0 = p[0]; fy0 = p[1]; z0 = p[2] + 0.04 }
      } else if (!it.hero || s.hero.act !== 'fall') standing.push(it.x, ay)
      // Terrain: on raised ground, up a ramp, down in a hole (`terrain.ts`).
      if (m.terrain && !it.tile) z0 += it.hero ? heroLift : terrainFoot(m, it.x, ay - 0.01)
      fx0 -= back
      fy0 -= back
      z0 -= back
      const l = -C.ax * zoom
      const r = (C.w - C.ax) * zoom
      quad(fx0, fy0, z0 + top, l, fx0, fy0, z0 + top, r, fx0, fy0, z0 + foot, r, fx0, fy0, z0 + foot, l, cellX, cellY, u1, v1, 3, 1, 0, 0, 0, z0 > 0 ? 0.04 * cam.zs : 0)
      if (folkHit) {
        // The figure in its own art, on the same card, a hair behind what the painter drew round it (a puff of
        // smoke, stars, a tell), at one texel to the scene px.
        const gx = fx0 - 0.02
        const gy = fy0 - 0.02
        quad(gx, gy, z0 + top, l, gx, gy, z0 + top, r, gx, gy, z0 + foot, r, gx, gy, z0 + foot, l, cellX * DENSITY, cellY * DENSITY, u1 * DENSITY, v1 * DENSITY, 3, 5, 0, 0, 0, z0 > 0 ? 0.04 * cam.zs : 0)
      }
      if (it.hero && modelled) {
        const h = s.hero
        // Hit, the hero blinks; in the classic picture too.
        const blink = h.act !== 'dead' && h.act !== 'fall' && h.act !== 'get' && h.invuln > 0 && Math.floor(time * 20) % 2 === 0
        if (!blink) {
          fig = renderFigure(heroPose(s, time, ui.paused ? 0 : dt), kit.heroLook(), fig ?? undefined)
          engine.figure(fig.albedo, fig.normal, fig.w, fig.h)
          // A pixel of the figure is a pixel of the scene. It stands a hair behind what it holds up.
          const fp = zoom / DENSITY
          const ft = FIG.ay / (T * DENSITY)
          const ff = -(FIG.h - FIG.ay) / (T * DENSITY)
          const fl = -FIG.ax * fp
          const fr = (FIG.w - FIG.ax) * fp
          const gx = fx0 - 0.02
          const gy = fy0 - 0.02
          const fz = z0 + heroZ(h)
          quad(gx, gy, ft + fz, fl, gx, gy, ft + fz, fr, gx, gy, ff + fz, fr, gx, gy, ff + fz, fl, 0, 0, FIG.w, FIG.h, 3, 3)
          ghost = { start: nv - 6, count: 6 }
        }
      } else if (it.hero && k > 0.5) {
        // Seen through a wall: the hero's card, and the art's card in front of it when it has one.
        ghost = folkHit ? { start: nv - 12, count: 12 } : { start: nv - 6, count: 6 }
      }
    }

    atlasUsed = used
    // The fountain in the square's pool and the ferries alongside the piers.
    if (drawn) for (const lm of LANDMARKS[m.id] ?? []) {
      const frame = Math.floor((reduced ? 0 : time) * lm.fps) % lm.frames
      const id = lm.bob ? lm.id : `${lm.id}_${frame}`
      if (hasThing(id)) stand(thingKey(id), lm.x, lm.y, px, rise, lm.bob ? frame / (T * DENSITY) : 0)
    }
    if (drawn) for (const lm of def.isoLandmarks ?? []) {
      const tx = Math.floor(lm.x)
      const ty = Math.floor(lm.y)
      if (!inRoom(tx, ty)) continue
      let art = lm.lit && has(s, lm.lit.flag) ? lm.lit.art : lm.night && afterDusk ? lm.night : lm.art
      const motion = lm.motion
      const frame = motion && !reduced ? Math.floor(time * motion.fps) % motion.frames : 0
      // A stage spotlight's head (`frontierArt/fogstage.ts`: eighths of a turn clockwise from east) turns with its beam.
      const sweeping = lm.lights?.find(L => L.anim === 'sweep')
      if (sweeping && !motion && /^fogstage_spotlight_\d$/.test(art)) {
        const ang = spotSwing(tm, lm.x + (sweeping.dx ?? 0))
        art = `fogstage_spotlight_${((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8}`
      }
      const key = thingKey(motion && !motion.bob ? `${art}_${frame}` : art)
      if (!Object.prototype.hasOwnProperty.call(propAtlas!.sprites, key)) continue
      const z = (lm.z ?? terrainLift(m, tx, ty)) + (motion?.bob ? frame / (T * DENSITY) : 0)
      stand(key, lm.x, lm.y, px, rise, z)
      if (lm.shadow) cards.push({ x: lm.x, y: lm.y, ...lm.shadow })
      // What it shines with (`types.ts` `LandmarkLight`): it comes up with the landmark over the turn's end.
      for (const L of lm.lights ?? []) {
        if (L.lit && !(lm.lit && has(s, lm.lit.flag))) continue
        const lx = lm.x + (L.dx ?? 0)
        const ly = lm.y + (L.dy ?? 0)
        const lz = z + (L.z ?? 0.6)
        const color = TONES[L.tone]
        if (L.anim === 'sweep') {
          // A beam that turns (a lighthouse's: where the lens frame drawn points it, frame i along the i-th quarter
          // turn from +x, as `frontierArt/fjord.ts` `lighthouse` draws it) or swings to and fro (a stage spotlight).
          const ang = motion ? (Math.PI * 2 * frame) / motion.frames : spotSwing(tm, lx)
          beams.push({ x: lx, y: ly, z: lz, ang, reach: L.r, color, a: L.a * rise })
          lights.push({ x: lx, y: ly, z: lz, r: 1.6, color, a: L.a * rise })
          for (let i = 1; i <= 5; i++) {
            const d = (i / 5) * L.r
            lights.push({ x: lx + Math.cos(ang) * d, y: ly + Math.sin(ang) * d, z: 0.25, r: 1 + 0.32 * i, color, a: L.a * rise * (1 - i * 0.11) })
          }
          continue
        }
        const f = L.anim === 'fire' ? 0.8 + 0.12 * Math.sin(tm * 13 + lx * 3) + 0.08 * Math.sin(tm * 7.3 + ly)
          : L.anim === 'pulse' ? 0.8 + 0.2 * Math.sin(tm * 1.3 + lx * 2 + ly)
          : L.anim === 'blink' ? (reduced || Math.floor(tm * 1.2 + lx) % 2 === 0 ? 1 : 0.1) : 1
        lights.push({ x: lx, y: ly, z: lz, r: L.r, color, a: L.a * f * rise, fire: L.anim === 'fire' && L.tone === 'fire' })
      }
      // Codex's single light (`IsoLandmark.light`): with a night picture, it shines only after dusk.
      if (lm.light && (!lm.night || afterDusk)) {
        const { r, tone, a } = lm.light
        lights.push({ x: lm.x, y: lm.y, z: z + 0.6, r, color: TONES[tone], a: a * rise })
      }
    }
    // Boulders rolling (the puzzles'): in the round, turning as they go (their classic card stands down for them).
    if (drawn) for (const b of m.phys?.rolling ?? []) {
      if (!inRoom(b.x, b.y)) continue
      stand(rollKind(b.dx, b.dx ? b.x : b.y), b.x, b.y + 0.12, px, rise)
      cards.push({ x: b.x, y: b.y + 0.2, tall: 0.7 * rise, wide: 0.34 })
    }
    const deep = standAll()
    // --- the ground picture's last layers ------------------------------------------------
    if (rooms.length) {
      // Everything outside the hero's room stays dark, as in the classic view.
      const rx0 = Math.min(...rooms.map(z => z.x))
      const ry0 = Math.min(...rooms.map(z => z.y))
      const rx1 = Math.max(...rooms.map(z => z.x + z.w))
      const ry1 = Math.max(...rooms.map(z => z.y + z.h))
      fg.clearRect(0, 0, bw, (ry0 - R.y) * T)
      fg.clearRect(0, (ry1 - R.y) * T, bw, bh)
      fg.clearRect(0, 0, (rx0 - R.x) * T, bh)
      fg.clearRect((rx1 - R.x) * T, 0, bw, bh)
    }
    // The floor's paint goes on once whatever stands has been taken off the ground, so no card carries it up.
    kit.floorMarks(fg, s, ui, bx, by)
    if (s.hook) drawHookChain(fg, s, bx, by, lights)
    drawLatchLines(fg, s, bx, by, time, reduced, lights)
    if (m.id === 'overworld') kit.lakeSun(fg, s, bx, by, reduced, bw, bh)

    // --- shots, sparks, the flash: over the lit scene ------------------------------------
    if (fx.width !== sw || fx.height !== sh) { fx.width = sw; fx.height = sh }
    const xg = fx.getContext('2d')!
    xg.imageSmoothingEnabled = false
    xg.setTransform(1, 0, 0, 1, 0, 0)
    xg.clearRect(0, 0, sw, sh)
    xg.setTransform(zoom, 0, 0, zoom, 0, 0)
    // The view's own camera in classic terms, for what is placed on the screen and not in the world.
    const vx = Math.round(c.x - vw / 2)
    const vy = Math.round(c.y - vh / 2)
    /** Lights already on the scene (fireflies), in classic px. */
    loose.length = 0
    if (def.look === 'wild' && !ui.attract) {
      const n = lights.length
      fireflies(vx, vy, Math.ceil(vw), Math.ceil(vh), reduced ? 0 : time, lights, xg, kit.day('iso')?.fireflies ?? 1)
      for (const L of lights.splice(n)) loose.push({ ...L, x: L.x * T - vx, y: L.y * T - vy })
    }
    const moody = kit.staticMood(s)
    if (moody && !reduced) {
      // The Other Side's ash, drifting up the screen (its colour cast is the GPU's).
      xg.fillStyle = 'rgba(207,198,255,0.55)'
      for (let i = 0; i < 40; i++) {
        const ax = ((hash2(i, 1, 9) * 400 - vx * 0.4 + Math.sin(time * 0.6 + i) * 8) % vw + vw) % vw
        const ay = ((hash2(i, 2, 9) * 400 - vy * 0.4 - time * (6 + (i % 5) * 2)) % vh + vh) % vh
        xg.fillRect(Math.round(ax * 2) / 2, Math.round(ay * 2) / 2, i % 3 ? 0.5 : 1, 0.5)
      }
    }
    // A realm's air (`air.ts`): snow falling, spores rising, dust on the wind; a few of the spores light what is near.
    if (mood && outdoors && !ui.attract && k > 0.5) {
      const n = lights.length
      realmAir(xg, mood, vx, vy, Math.ceil(vw), Math.ceil(vh), reduced ? 0 : time, lights)
      // Its fireflies, or wisps (as the Wildwood's, in its own colours; the classic view has them too).
      if (mood.flies) fireflies(vx, vy, Math.ceil(vw), Math.ceil(vh), reduced ? 0 : time, lights, xg, mood.flies.still ? 1 : kit.day('iso')?.fireflies ?? 1, mood.flies.color, mood.flies.light, mood.flies.count)
      for (const L of lights.splice(n)) loose.push({ ...L, x: L.x * T - vx, y: L.y * T - vy })
    }
    // A realm's life: lanterns, glints, butterflies, birds, fish (in the world, where they are). The rest of the
    // frontier has birds and fish.
    const airLife = outdoors && !ui.attract && k > 0.5 ? mood ? mood.life : def.realm ? FRONTIER_LIFE : null : null
    if (airLife) {
      realmLife(xg, airLife, {
        place: (x, y, z) => { const p = toScene(cam, x, y, z); return { x: Math.round(p.x) / zoom, y: Math.round(p.y) / zoom } },
        tile: (x, y) => tileOf(x, y),
        x0: R.x, y0: R.y, x1: R.x + R.w, y1: R.y + R.h, vw: Math.ceil(vw), vh: Math.ceil(vh), px: 1 / zoom,
      }, reduced ? 0 : time, lights)
    }
    // A closed chest glints (the classic one draws its star with the tile).
    if (solid && rise > 0.99 && !reduced && !ui.attract) {
      for (const [i, ch] of info.chests) {
        const tx = i % m.w
        const ty = Math.floor(i / m.w)
        if (ch.hidden || m.tiles[i] !== '$' || has(s, `chest:${ch.id}`) || !inRoom(tx, ty) || tx < R.x || ty < R.y || tx >= R.x + R.w || ty >= R.y + R.h) continue
        const p = toScene(cam, tx + 0.5 + (hash2(tx, ty, 31) - 0.5) * 0.3, ty + 0.5, ch.big ? 0.75 : 0.55)
        chestStar(xg, Math.round(p.x) / zoom, Math.round(p.y) / zoom, time, tx * 31 + ty, ch.big ? 1.3 : 1)
      }
    }
    // The beams that sweep, seen in the air: a dithered wedge from the lamp, thinning out as it goes.
    for (const b of beams) {
      const pat = beamPattern(xg, b.color, zoom)
      if (!pat) break
      const o = toScene(cam, b.x, b.y, b.z)
      const at = (d: number, side: number) => {
        const a = b.ang + side * 0.17
        const q = toScene(cam, b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, b.z * (1 - d / (b.reach * 1.15)))
        return [q.x / zoom, q.y / zoom] as const
      }
      xg.fillStyle = pat
      for (let i = 0; i < 3; i++) {
        const d0 = (i / 3) * b.reach * 1.1
        const d1 = ((i + 1) / 3) * b.reach * 1.1
        const p0 = i === 0 ? [o.x / zoom, o.y / zoom] as const : at(d0, -1)
        const p3 = i === 0 ? p0 : at(d0, 1)
        const p1 = at(d1, -1)
        const p2 = at(d1, 1)
        xg.globalAlpha = b.a * (0.55 - i * 0.15)
        xg.beginPath()
        xg.moveTo(p0[0], p0[1]); xg.lineTo(p1[0], p1[1]); xg.lineTo(p2[0], p2[1]); xg.lineTo(p3[0], p3[1])
        xg.closePath()
        xg.fill()
      }
      xg.globalAlpha = 1
    }
    kit.projectiles(xg, s, S1, (dx, dy) => ({ x: dx * P.ex.x + dy * P.ey.x, y: dx * P.ex.y + dy * P.ey.y }))
    // (The tough foes' and bosses' bars stand over this view's own figures, on terrain at the height their cards stand.)
    kit.fx(xg, s, dt, S1, ui.paused, 1 - 0.5 * k, { art: folk, lift: m.terrain ? (x, y) => terrainFoot(m, x, y) : undefined })
    // --- the air: dust at the hero's heels, sparks rising in the lamplight, leaves on the wind ----
    if (!reduced && k > 0.5 && (par.air as boolean)) {
      const h = s.hero
      if (!ui.paused) {
        if (h.act === 'walk' && !ui.attract && (h.vx || h.vy)) {
          stepT += dt
          if (stepT > 0.16) {
            stepT = 0
            motes.push({ x: h.x + (Math.random() - 0.5) * 0.3, y: h.y + 0.38, z: 0.02, vx: -h.vx * 0.06 + (Math.random() - 0.5) * 0.4, vy: -h.vy * 0.06 + (Math.random() - 0.5) * 0.4, vz: 0.5 + Math.random() * 0.4, t: 0, life: 0.38, color: outdoors ? '#cfc6ff' : '#a99ad6' })
          }
        }
        for (let i = motes.length - 1; i >= 0; i--) {
          const p = motes[i]!
          p.t += dt
          if (p.t > p.life) { motes.splice(i, 1); continue }
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt
          p.vz -= 1.2 * dt
        }
      }
      const dot = (x: number, y: number, z: number, size: number, color: string, a: number) => {
        const p = toScene(cam, x, y, z)
        xg.globalAlpha = a
        xg.fillStyle = color
        xg.fillRect(Math.round(p.x) / zoom, Math.round(p.y) / zoom, size / zoom, size / zoom)
      }
      for (const p of motes) dot(p.x, p.y, Math.max(0, p.z), p.t < p.life * 0.5 ? 2 : 1, p.color, 0.7 * (1 - p.t / p.life))
      // Prints in the spore moss glow a while; in the snow they are dark, and stay longer.
      const printing = outdoors && (realm === 'spore' || realm === 'snow')
      if (printMap !== m.id) { prints.length = 0; printMap = m.id }
      if (printing && !ui.paused) {
        for (let i = prints.length - 1; i >= 0; i--) { prints[i]!.t += dt; if (prints[i]!.t > (realm === 'snow' ? 5 : 2.2)) prints.splice(i, 1) }
        if (h.act === 'walk' && !ui.attract && (h.vx || h.vy)) {
          printT += dt
          if (printT > 0.2) {
            printT = 0
            const n = Math.hypot(h.vx, h.vy) || 1
            const side = prints.length % 2 ? 1 : -1
            prints.push({ x: h.x - (h.vy / n) * 0.1 * side, y: h.y + 0.36 + (h.vx / n) * 0.1 * side, t: 0 })
            if (prints.length > 16) prints.shift()
          }
        }
      }
      if (printing) for (const p of prints) {
        if (realm === 'spore') {
          const f = 1 - p.t / 2.2
          dot(p.x, p.y, 0, 3, '#8ffce0', 0.85 * f)
          lights.push({ x: p.x, y: p.y, z: 0.05, r: 0.75, color: '#6ff6ff', a: 0.55 * f })
        } else {
          const p0 = toScene(cam, p.x, p.y)
          xg.globalAlpha = 0.6 * Math.min(1, (5 - p.t) / 1.5)
          xg.fillStyle = '#3a3a8a'
          xg.fillRect(Math.round(p0.x) / zoom, Math.round(p0.y) / zoom, 3 / zoom, 2 / zoom)
        }
      }
      // A fire throws embers that wink out as they climb, and a pale smoke that goes higher. Only a real fire's
      // light (`Light.fire`), whatever its flicker; each keeps its own embers (hashed on where it burns).
      let fires = 0
      for (const L of lights) {
        if (!L.fire || fires >= 10) continue
        fires++
        const at = L.z !== undefined ? [L.x, L.y, L.z] : world3(L.x, L.y)
        const base = L.z !== undefined ? L.z : at[2] * 0.5 + 0.2
        const fx0 = Math.round(L.x * 4)
        const fy0 = Math.round(L.y * 4)
        const wind = (par.wind as number) || 0.3
        for (let j = 0; j < 6; j++) {
          const ph = hash2(fx0 + j * 7, fy0, 37)
          const life = (time * (0.75 + ph * 0.5) + ph * 5) % 1
          const sway = Math.sin(time * 2.2 + ph * 12) * 0.2 * life + life * 0.25 * wind
          dot(at[0]! + (ph - 0.5) * 0.4 + sway, at[1]! + (hash2(fx0 + j * 7, fy0, 38) - 0.5) * 0.3, base + life * 1.5, (life < 0.4 ? 2 : 1) * zoom, life < 0.3 ? '#fff1b0' : life < 0.65 ? '#ffd23f' : '#ff3b5c', (1 - life) * 0.95)
        }
        for (let j = 0; j < 3; j++) {
          const ph = hash2(fx0 + j * 5, fy0, 39)
          const life = (time * 0.22 + ph * 3 + j / 3) % 1
          dot(at[0]! + life * 0.6 * wind + Math.sin(time * 0.8 + j) * 0.12, at[1]!, base + 0.5 + life * 2.4, (life < 0.4 ? 2 : 3) * zoom, '#cfc6e8', Math.sin(life * Math.PI) * 0.45)
        }
      }
      // A spark or two climbs in every lamp's light.
      let li = 0
      for (const L of lights) {
        li++
        if (L.r < 3.6 || L.a < 0.5 || L.fire) continue
        const at = L.z !== undefined ? [L.x, L.y, L.z] : world3(L.x, L.y)
        for (let j = 0; j < 2; j++) {
          const ph = hash2(li, j, 31)
          const life = (time * (0.16 + ph * 0.1) + ph * 7) % 1
          const ang = ph * 40 + time * (0.4 + ph)
          const rad = 0.25 + ph * L.r * 0.22
          dot(at[0] + Math.cos(ang) * rad, at[1] + Math.sin(ang) * rad * 0.8, at[2] * 0.5 + life * 1.3, 1, L.color, Math.sin(life * Math.PI) * 0.8)
        }
      }
      // Leaves ride the wind across the coast and the woods.
      if (outdoors && !(mood && !mood.leaves)) {
        const wind = par.wind as number
        for (let i = 0; i < 9; i++) {
          const a = hash2(i, 5, 41)
          const b = hash2(i, 6, 41)
          const lx = ((a * 1.7 + time * (0.02 + b * 0.02) * (0.5 + wind)) % 1.2) - 0.1
          const ly = ((b * 1.3 + time * 0.011 + Math.sin(time * 0.9 + i) * 0.02) % 1.1) - 0.05
          xg.globalAlpha = 0.75
          xg.fillStyle = mood?.leaves ? mood.leaves[i % 3 ? 0 : 1] : def.look === 'wild' ? (i % 3 ? '#3fd8b0' : '#b98cff') : i % 3 ? '#ff8ae0' : '#56c9b8'
          const wob = Math.sin(time * 3 + i * 2.1)
          xg.fillRect(Math.round(lx * sw) / zoom, Math.round(ly * sh + wob * 3) / zoom, (wob > 0 ? 2 : 1) / zoom, 1 / zoom)
        }
      }
      xg.globalAlpha = 1
    }
    const ks = kit.size()
    xg.setTransform(sw / ks.vw, 0, 0, sh / ks.vh, 0, 0)
    const fade = kit.flashFade(xg, s, ui, dt)
    xg.setTransform(1, 0, 0, 1, 0, 0)

    // --- the sun ------------------------------------------------------------------------
    const own = kit.params('iso', true)
    // The sun's own light. By day it whitens as the sun climbs; at night it is the moon's, faint and blue;
    // in the blue hours, when nothing throws a shadow, there is none.
    const ownShadow = own.shadow as number
    const direct = outdoors ? (ownShadow > 0 ? Math.min(1, (par.shadow as number) / ownShadow) : 1) : 0
    const height = day ? day.sun : 0.12
    const warm = rgb(par.sunLight as string)
    // (The moon takes over from the sun across a stretch of its sinking, not at a line: no step in the light.)
    const moonT = Math.max(0, Math.min(1, (-0.2 - height) / 0.2))
    const moonK = moonT * moonT * (3 - 2 * moonT)
    let sunCol: [number, number, number] = mix3(mix3(warm, [1, 0.97, 0.9], Math.max(0, Math.min(1, (height - 0.12) / 0.6))), [0.5, 0.62, 1], moonK)
    if (mood) sunCol = [sunCol[0] * mood.sun[0], sunCol[1] * mood.sun[1], sunCol[2] * mood.sun[2]]
    const sunS = (par.sunStrength as number) * direct * k * ((1 - moonK) * (1 - 0.35 * Math.max(0, Math.min(1, (height - 0.12) / 0.6))) + moonK * 0.4)
    // What the sun does not reach is lit by the sky: cooler and dimmer than one light for everything.
    const skyFill: [number, number, number] = [1 - 0.5 * sunS, 1 - 0.4 * sunS, 1 - 0.16 * sunS]
    // And while the sun is up the lamps are only just lit: their pools are smaller things in a lit world.
    let lampGain = outdoors ? 1 - 0.4 * Math.min(1, sunS) * (1 - moonK) : 1
    // Out on the frontier a lamp, a campfire, a lit window reads at any hour; a realm's lamps shine as its art needs.
    if (outdoors && def.realm) lampGain = Math.max(lampGain, 0.8)
    if (outdoors && mood) lampGain *= mood.lamps

    // --- lamps -------------------------------------------------------------------------
    const amb = kit.ambient(s, ui, lights)
    nPlaced = 0
    const put = (x: number, y: number, z: number, r: number, color: string, a: number) => {
      const o = placed[nPlaced] ??= { x: 0, y: 0, z: 0, r: 0, c: [0, 0, 0], a: 0 }
      o.x = x; o.y = y; o.z = z; o.r = r; o.c = rgbOf(color); o.a = Math.max(0, Math.min(1, a))
      nPlaced++
    }
    for (const L of lights) {
      const p: [number, number, number] = L.z !== undefined ? [L.x, L.y, L.z] : world3(L.x, L.y)
      if (p[2] === 0 && L.z === undefined) {
        // The classic picture puts a carried light up the screen from its bearer's feet: a lantern in a hand,
        // a cabinet's screen, a fire's heart. Here that is height, over the feet it belongs to.
        let best = 2
        for (const feet of feetOf) for (let i = 0; i < feet.length; i += 2) {
          const up = feet[i + 1]! - L.y
          if (Math.abs(feet[i]! - L.x) < 0.4 && up > 0.05 && up < best) { best = up; p[0] = feet[i]!; p[1] = feet[i + 1]!; p[2] = up }
        }
      }
      put(p[0], p[1], p[2], L.r, L.color, L.a)
    }
    for (const L of loose) {
      const p = toGround(cam, L.x * zoom, L.y * zoom)
      put(p.x, p.y, 0.4, L.r, L.color, L.a)
    }
    if (nPlaced * 6 * LVERT > lightVerts.length) lightVerts = new Float32Array(nPlaced * 6 * LVERT * 2)
    let nl = 0
    for (let li = 0; li < nPlaced; li++) {
      const L = placed[li]!
      if (L.x + L.r < R.x || L.y + L.r < R.y || L.x - L.r > R.x + R.w || L.y - L.r > R.y + R.h) continue
      for (const [dx, dy] of CORNERS) {
        const o = nl * LVERT
        lightVerts[o] = L.x + dx * L.r; lightVerts[o + 1] = L.y + dy * L.r
        lightVerts[o + 2] = L.x; lightVerts[o + 3] = L.y; lightVerts[o + 4] = L.z; lightVerts[o + 5] = L.r
        lightVerts[o + 6] = L.c[0] * L.a * lampGain; lightVerts[o + 7] = L.c[1] * L.a * lampGain; lightVerts[o + 8] = L.c[2] * L.a * lampGain
        nl++
      }
    }

    // --- blob shadows: away from whatever lights the spot most ---------------------------
    const sunA = ((par.sunAngle as number) * Math.PI) / 180
    const sunDir = { x: Math.cos(sunA), y: Math.sin(sunA) }
    const reach = (par.shadowLength as number) * (outdoors ? 1 : 0.4) * (mood ? mood.shadowLength : 1)
    let nb = 0
    const blob = (x: number, y: number, tall: number, wide: number, dark = 1, deep = -1) => {
      if ((nb + 6) * BVERT > blobVerts.length) { const next = new Float32Array(blobVerts.length * 2); next.set(blobVerts); blobVerts = next }
      let dx = outdoors ? sunDir.x * 0.5 : 0
      let dy = outdoors ? sunDir.y * 0.5 : 0
      let sum = outdoors ? 0.5 : 0.15
      for (let li = 0; li < nPlaced; li++) {
        const L = placed[li]!
        const lx = L.x - x
        const ly = L.y - y
        const d = Math.hypot(lx, ly)
        if (d >= L.r || d < 0.05) continue
        const w = L.a * (1 - d / L.r) * (L.c[0] * 0.3 + L.c[1] * 0.59 + L.c[2] * 0.11)
        dx += (lx / d) * w
        dy += (ly / d) * w
        sum += w
      }
      // Lit from all sides, the shadow is a pool under the feet; from one, it is long.
      const co = Math.min(1, Math.hypot(dx, dy) / sum)
      const n = Math.hypot(dx, dy) || 1
      const ux = -dx / n
      const uy = -dy / n
      const len = tall * (0.25 + reach * 0.75 * co) * k
      // A body (`deep`): the box's half extents across and along the way its shadow falls.
      const hw = deep < 0 ? wide : Math.max(0.2, wide * Math.abs(uy) + deep * Math.abs(ux))
      const hl = len / 2 + (deep < 0 ? wide : wide * Math.abs(ux) + deep * Math.abs(uy))
      const cx0 = x + ux * len * 0.5
      const cy0 = y + uy * len * 0.5
      for (const [a, b] of CORNERS) {
        const o = nb * BVERT
        blobVerts[o] = cx0 + ux * hl * a - uy * hw * b
        blobVerts[o + 1] = cy0 + uy * hl * a + ux * hw * b
        blobVerts[o + 2] = a; blobVerts[o + 3] = b; blobVerts[o + 4] = dark
        nb++
      }
    }
    if ((par.shadow as number) > 0) {
      for (const cd of cards) blob(cd.x, cd.y, cd.tall, cd.wide ?? 0.22, cd.dark ?? 1, cd.deep ?? -1)
      for (let i = 0; i < standing.length; i += 2) blob(standing[i]!, standing[i + 1]! - 0.1, 0.85, 0.26)
    }

    // --- to the GPU -----------------------------------------------------------------------
    // The backdrop is painted in the view's own dusk; the hour moves its sun and stars and grades the rest.
    paintSky(outdoors ? (realm ?? (def.look === 'wild' ? 'wild' : 'coast')) : 'void', sw, sh, mood ? mood.sky[0] : own.skyTop as string, mood ? mood.sky[1] : own.skyHorizon as string, c.x * DENSITY, reduced ? 0 : time, day)
    const grade = day ? skyGrade(own.skyTop as string, own.skyHorizon as string, par.skyTop as string, par.skyHorizon as string) : null
    engine.flat(flat)
    engine.objs(objs)
    engine.atlas(atlas, atlasUsed)
    if (folkUsed) engine.folk(folkAtlas, folkUsed)
    engine.fx(fx)
    // The finish turns with the picture too: the classic view's scanlines thin out as this one comes in.
    const f0 = kit.finish('classic')
    const f1 = kit.finish('iso')
    const elev = Math.atan2(1, Math.max(0.05, (par.shadowLength as number) * (mood ? mood.shadowLength : 1)))
    const look: Look = {
      soft: (par.smoothing as number) * Math.min(1, k * 2),
      materials: quality === 0 ? 0 : (par.materials as number) * Math.max(0, Math.min(1, k * 2 - 0.6)),
      sand: def.look === 'dune' && !outdoors,
      fray: quality >= 2,
      bump: (par.relief as number) * k,
      round: (par.roundness as number) * k,
      emit: k,
      directional: (par.sideLight as number) * k,
      occlude: quality < 2 ? 0 : (par.lightShadows as number) * k,
      glow: par.glow as number,
      // (The rest of the day's exposure, as the classic picture takes it: the turn's flat end is as bright as the classic one.)
      expose: (day?.exposure ?? 0) * (1 - k),
      sun: [sunDir.x * Math.cos(elev), sunDir.y * Math.cos(elev), Math.sin(elev)],
      shadowLen: reach,
      shadow: (par.shadow as number) * k,
      shadowTint: tint(par.shadowColor as string),
      sunColor: [sunCol[0] * sunS, sunCol[1] * sunS, sunCol[2] * sunS],
      shading: shading * k,
      rim: (par.rim as number) * k,
      ao: quality < 2 ? 0 : (par.occlusion as number) * k,
      clouds: outdoors ? (par.clouds as number) * k : 0,
      cloudDrift: reduced ? 0 : time * 0.02 * (par.cloudSpeed as number),
      water: k,
      mirror: quality < 2 ? 0 : (par.reflections as number) * k,
      wet: quality < 2 ? 0 : (par.wet as number) * k,
      haze: (par.haze as number) * k,
      hazeColor: rgb(par.hazeColor as string),
      skyTop: rgb(par.skyTop as string),
      skyHorizon: rgb(par.skyHorizon as string),
      skyMul: grade ? grade.mul : [1, 1, 1],
      skyAdd: grade ? grade.add : [0, 0, 0],
      sky: !!par.sky,
      // The Wildwood stands in mist and shafts of the low sun; the coast has a breath of both.
      mist: outdoors ? (par.mist as number) * k * (def.look === 'wild' ? 1 : 0.3) : 0,
      mistColor: mistOf(rgb(par.hazeColor as string)),
      rays: outdoors && !reduced ? (par.rays as number) * k * (def.look === 'wild' ? 1 : 0.4) : 0,
      // (The colours thin out over the turn, from eight bits a channel to five: no frame where the dither switches on.)
      colorBits: par.colors === '15-bit' ? 8 - 3 * Math.max(0, Math.min(1, (k - 0.2) / 0.6)) : 0,
      bloom: f0.bloom + (f1.bloom - f0.bloom) * k,
      vignette: f0.vignette + (f1.vignette - f0.vignette) * k,
      scanlines: f0.scanlines + (f1.scanlines - f0.scanlines) * k,
      wind: reduced ? 0 : (par.wind as number),
    }
    // On the frontier's dark grass a lamp's pool is lost in the multiplied light (it is capped); more of it hangs
    // in the air there, where it reads on any ground: a campfire lights its clearing. Not at night, when the
    // lamps are at full strength anyway and the air would burn out to a floodlight.
    if (outdoors && def.realm) look.glow *= 1 + 0.6 * (1 - night)
    if (mood && outdoors) moodLook(look, mood, realm!, grade, s.hero.x, s.hero.y + 0.3)
    // Under the northern lights the snow takes their green, breathing with them (`backdrop.ts` `paintAurora`).
    const aurora = realm === 'snow' && outdoors && night > 0 ? 1 + night * (0.06 + (reduced ? 0 : 0.04 * Math.sin(time * 0.35))) : 0
    const heroAt = toScene(cam, s.hero.x, s.hero.y + 6 / T)
    let iris: [number, number, number] = [0, 0, -1]
    if (s.dying && k > 0.5) {
      const hp = toScene(cam, s.hero.x, s.hero.y, 0.4)
      const t = Math.max(0, Math.min(1, (s.dying.t - 0.9) / 0.8))
      iris = [offX + hp.x * hs, offY + hp.y * hs, (1 - t * t) * Math.hypot(scr.W, scr.H)]
    }
    engine.draw({
      // Under reduced motion the water, the mist and the shafts stand still.
      cam, R, mapX: -M, mapY: -M, mapW: ew, mapH: eh, inner: { x: 0, y: 0, w: m.w, h: m.h }, far: M ? k : 0, rooms, time: reduced ? 0 : time, outdoors,
      // By day the light is more than the art's own (the art is painted for the dusk).
      ambient: rgb(amb).map((q, i) => q * (1 + (day?.exposure ?? 0) * k) * (outdoors ? skyFill[i]! * (mood ? 1 + (mood.ambient[i]! - 1) * k : 1) * (aurora ? (i === 1 ? aurora : i === 2 ? 1 + (aurora - 1) * 0.5 : 1) : 1) : 1)) as [number, number, number],
      voidColor: rgb(outdoors ? '#0e2a3c' : '#07040f'),
      hero: { x: s.hero.x, y: s.hero.y },
      verts, vertCount: nv,
      lights: lightVerts, lightCount: nl / 6,
      blobs: blobVerts, blobCount: nb / 6,
      // The fade itself is already on the effects layer (`flashFade` painted it there).
      look, fade: 0, ghost, deep,
      // A door is a mosaic on the way out and on the way in; the Other Side waves down its scanlines; death closes the iris.
      mosaic: s.warp && !reduced && k > 0.5 ? 1 + Math.round(fade * 7) * 2 : 1,
      wave: !reduced && moody ? 1.6 * k : 0,
      iris,
      veil: ui.attract ? [0, 0, 0, 0] : [heroAt.x, heroAt.y - 14 * zoom, s.hero.x * cam.dv[0] + (s.hero.y + 6 / T) * cam.dv[1], 38 * zoom * k],
      cast: moody ? [1 - 0.153 * 1, 1 - 0.459 * 1, 1 - 0.278 * 1] : [1, 1, 1],
      W: scr.W, H: scr.H, hs, offX, offY, scanStep: scr.scale,
    })
    const g = scr.g
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'source-over'
    g.globalAlpha = 1
    g.imageSmoothingEnabled = false
    g.drawImage(engine.canvas, 0, 0)

    // Labels and the dialog box sit by the exit at hand and the hero, wherever the view put them.
    /** A ground point in the HUD's logical px. */
    const hudOf = (x: number, y: number): Vec => {
      const p = toScene(cam, x, y)
      return { x: (offX + p.x * hs - scr.ox) / scr.scale, y: (offY + p.y * hs - scr.oy) / scr.scale }
    }
    const near = nearExit(s)
    const ref = near ? { x: near.x, y: near.y } : { x: s.hero.x, y: s.hero.y }
    const at = hudOf(ref.x, ref.y)
    kit.hudLayer(s, ui, dt, Math.round(ref.x * T - at.x), Math.round(ref.y * T - at.y), hudOf(s.hero.x, s.hero.y).y,
      // The windows change dress in the middle of the turn: the classic ones fade out, these fade in.
      par.windows === '16-bit' ? HIRES_WINDOW_SKIN : NEON_SKIN, k < 1 ? { skin: NEON_SKIN, mix: (k - 0.3) / 0.4 } : undefined)
  }

  return {
    draw,
    ready,
    // The controls turn with the picture: not while the classic one stands in for it.
    get turn() { return fallback ? fallback.turn : engine.ready() === 'yes' ? Math.PI / 4 : 0 },
    dispose() { engine.dispose() },
  }
}

const mix3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** Each realm look's classic ground brightness per material slot (the ground shader's `uRefs`), worked out once. */
const realmRefs = new Map<RealmLook, Float32Array>()
function refsOf(realm: RealmLook): Float32Array {
  let r = realmRefs.get(realm)
  if (!r) {
    r = new Float32Array(8)
    const pal = CLASSIC[realm]
    const g = GROUND[realm]
    const slot = (m: Material) => materialId(m)
    if (pal.g0) r[slot(g.grass)] = lumaOf(pal.g0)
    if (pal.path) r[slot(g.path)] = lumaOf(pal.path)
    if (pal.sand) r[slot(g.sand)] = lumaOf(pal.sand)
    realmRefs.set(realm, r)
  }
  return r
}

/**
 * A realm's light and air over the hour's (`looks.ts` `MOOD`): its haze, mist and shafts, its shadows' colour,
 * its water, the ground fog parting round the hero, and its sky in the water as the hour grades it.
 */
function moodLook(look: Look, mood: (typeof MOOD)[RealmLook], realm: RealmLook, grade: { mul: [number, number, number]; add: [number, number, number] } | null, hx: number, hy: number): void {
  const graded = (hex: string): [number, number, number] => {
    const c = rgb(hex)
    return grade ? [c[0] * grade.mul[0] + grade.add[0], c[1] * grade.mul[1] + grade.add[1], c[2] * grade.mul[2] + grade.add[2]].map(v => Math.max(0, Math.min(1, v))) as [number, number, number] : c
  }
  look.haze *= mood.haze
  look.hazeColor = mix3(look.hazeColor, graded(mood.hazeColor), mood.hazeMix)
  // (The mist was taken at the coast's breath of it: 0.3 of the view's own.)
  look.mist = (look.mist / 0.3) * mood.mist
  look.mistColor = graded(mood.mistColor)
  look.rays = (look.rays / 0.4) * mood.rays
  look.raysColor = rgb(mood.raysColor)
  look.glow *= mood.glow
  look.shadowTint = tint(mood.shadowColor)
  look.skyTop = graded(mood.sky[0])
  look.skyHorizon = graded(mood.sky[1])
  look.waterTint = rgb(mood.water)
  look.refs = refsOf(realm)
  if (mood.clear > 0) look.fog = [hx, hy, mood.clear, 0.16]
}
/** The mist's colour: the haze, cooled toward the night. */
function mistOf(haze: [number, number, number]): [number, number, number] {
  return [haze[0] * 0.14 + 0.13, haze[1] * 0.14 + 0.2, haze[2] * 0.14 + 0.3]
}

/** What a shadow does to the light: the shadow colour, lifted so the darkest shade is still a colour. */
function tint(hex: string): [number, number, number] {
  const c = rgb(hex)
  return [0.34 + c[0] * 0.9, 0.3 + c[1] * 0.9, 0.42 + c[2] * 0.9]
}

export type { SceneItem }
