import type { Game, PaletteName, World } from '../types'
import type { PixelStage } from '../../base/pixel/stage'
import { LIGHTNING_FRAME, LIGHTNING_PERIOD } from '../engine/levels'
import {
  AMBIENT, MID, NEAR, SCENES, beginPixelFrame, createCamera, dimScene, endPixelFrame, flashScene, makeView, rect,
  type Camera, type Scene, type View,
} from './core'
import {
  drawArch, drawDoorway, drawForeground, drawHallBack, drawHeadland, drawLampTower,
  drawOverhang, drawPillar, drawPlatform, drawRain, drawRidgeBeast, drawSea, drawSky,
  drawSpires, drawVent, lightningBolt,
} from './scenery'
import { drawBeast, drawBuddy, drawGuard, drawLeech, drawPilot, drawTentacles, drawWreck } from './figures'
import { drawCage, drawItem, drawLamp, drawPool, drawRock, drawShield, drawShot, drawTide } from './things'
import { createCutState, drawCapture, drawCard, drawEnding, drawPrologue, type CutLook } from './cuts'

// The renderer owns a camera and the prologue's arcade backdrop; the shell
// makes one per canvas and calls draw() every frame with its pixel stage
// (themes/base/pixel/stage.ts). Scenes are still laid out in CSS pixels;
// core.ts puts every primitive on the stage's logical grid, and the frame
// goes out through the stage's light map, bloom and scanlines.

export type { CutLook } from './cuts'

export interface DrawOptions {
  reducedMotion?: boolean
  paused?: boolean
  look: CutLook
}

function sceneFor(world: World, paused: boolean, reduced: boolean): { sc: Scene; flash: boolean } {
  const base = SCENES[world.dawn ? 'dawn' : world.palette]
  if (paused) return { sc: dimScene(base), flash: false }
  const flash = !reduced && world.palette === 'storm' && !world.dawn && world.time > LIGHTNING_PERIOD - 0.01 &&
    world.time % LIGHTNING_PERIOD < LIGHTNING_FRAME
  return { sc: flash ? flashScene(base) : base, flash }
}

const SEEDS = { shore: 11, causeway: 57, hall: 91, tower: 133 } as const

function drawWorldInto(ctx: CanvasRenderingContext2D, v: View, world: World, sc: Scene, look: CutLook, opts: { flash: boolean; sunLift?: number; hidePilot?: boolean }): void {
  const seed = SEEDS[world.scenery]
  const interior = world.scenery === 'hall'
  const t = world.time

  if (interior) {
    drawHallBack(ctx, v, sc, world, t)
    for (const pr of world.props) {
      if (pr.kind === 'pillar') drawPillar(ctx, v, sc, pr)
      else if (pr.kind === 'doorway') drawDoorway(ctx, v, sc, pr)
      else if (pr.kind === 'vent') drawVent(ctx, v, sc, pr)
    }
  } else {
    drawSky(ctx, v, sc, t, opts.sunLift)
    if (opts.flash) lightningBolt(ctx, v, Math.floor(t / LIGHTNING_PERIOD) * 97)
    drawSpires(ctx, v, sc, seed)
    drawHeadland(ctx, v, sc, seed + 200)
    for (const pr of world.props) if (pr.kind === 'ridgeBeast') drawRidgeBeast(ctx, v, sc, pr, world.player.x, t)
    drawSea(ctx, v, sc, t, opts.sunLift)
    // The pool's basin behind the water.
    for (const w of world.water) rect(ctx, v.X(w.x), v.Y(w.y), (w.w) * v.s, (w.bottom - w.y) * v.s, sc.pal[NEAR + 8])
  }

  for (let i = 0; i < world.platforms.length; i++) drawPlatform(ctx, v, sc, world.platforms[i], i, interior)
  for (const pr of world.props) {
    if (pr.kind === 'overhang') drawOverhang(ctx, v, sc, pr)
    else if (pr.kind === 'lampTower') {
      const fin = world.lamps.find(l => l.final)
      drawLampTower(ctx, v, sc, pr, !!fin?.lit, t, world.dawn)
    } else if (pr.kind === 'wreck') drawWreck(ctx, v, sc, pr.x, pr.y, look.accent, t)
  }
  for (const hz of world.hazards) {
    if (hz.kind === 'rockfall') drawRock(ctx, v, sc, hz, t)
    else if (hz.kind === 'tentacles') drawTentacles(ctx, v, sc, hz, t)
  }
  for (const lamp of world.lamps) drawLamp(ctx, v, sc, lamp)
  for (const it of world.items) drawItem(ctx, v, it, t)
  if (world.cage) drawCage(ctx, v, sc, world.cage, true)
  for (const a of world.actors) {
    if (a.kind === 'leech') drawLeech(ctx, v, a, t)
    else if (a.kind === 'guard') drawGuard(ctx, v, sc, a, t)
    else if (a.kind === 'buddy') drawBuddy(ctx, v, sc, a, t)
  }
  if (!opts.hidePilot) drawPilot(ctx, v, sc, world, look)
  for (const a of world.actors) if (a.kind === 'beast') drawBeast(ctx, v, world, a)
  if (world.cage) drawCage(ctx, v, sc, world.cage, false)
  for (const sh of world.shields) drawShield(ctx, v, sh, look.accent, t)
  for (const s of world.shots) drawShot(ctx, v, s, look.accent)
  drawPool(ctx, v, sc, world)
  for (const hz of world.hazards) if (hz.kind === 'tide') drawTide(ctx, v, sc, hz, world)

  if (!interior) {
    for (const pr of world.props) if (pr.kind === 'arch') drawArch(ctx, v, sc, pr, world.groundY)
    drawForeground(ctx, v, sc, world.groundY, seed + 400, world.water.map(w => [w.x, w.x + w.w]))
    if (world.palette === 'storm' && !world.dawn) drawRain(ctx, v, sc, t)
  } else {
    // The hall's floor band in front: the room has a near wall too.
    const y = v.Y(world.groundY + 70)
    if (y < v.height) rect(ctx, 0, y, v.width, v.height - y, sc.pal[NEAR])
    rect(ctx, 0, y, v.width, 3 * v.s, sc.pal[MID])
  }
}

export function createRenderer() {
  const cam: Camera = createCamera()
  const cutState = createCutState()

  function focusFor(world: World): { x: number; y: number; vx: number } | undefined {
    const p = world.player
    // A fall: the camera does not follow; it holds on the empty landscape.
    if (world.dying?.cause === 'fall') return { x: p.x, y: Math.min(p.y, world.groundY), vx: 0 }
    if (world.cage && world.cage.state !== 'down') return { x: world.cage.pivotX + 120, y: world.groundY, vx: 0 }
    return undefined
  }

  /** One frame on the stage: draw, then light map, emissive layer, bloom. */
  function frame(stage: PixelStage, ambient: string, body: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): void {
    const g = stage.begin()
    beginPixelFrame(stage)
    g.save()
    try {
      body(g, stage.cssW, stage.cssH)
    } finally {
      g.restore()
    }
    const e = endPixelFrame()
    stage.present({ ambient, afterLight: e ? gg => gg.drawImage(e, 0, 0) : undefined })
  }

  function ambientOf(world: World, paused: boolean): string {
    const name: PaletteName = world.dawn ? 'dawn' : world.palette
    return paused ? '#8a82b4' : AMBIENT[name]
  }

  function drawWorldOn(ctx: CanvasRenderingContext2D, world: World, w: number, h: number, opts: DrawOptions): void {
    const { sc, flash } = sceneFor(world, !!opts.paused, !!opts.reducedMotion)
    const v = makeView(cam, world, w, h, focusFor(world))
    drawWorldInto(ctx, v, world, sc, opts.look, { flash })
  }

  function drawWorld(stage: PixelStage, world: World, opts: DrawOptions): void {
    if (stage.cssW <= 0 || stage.cssH <= 0) return
    frame(stage, ambientOf(world, !!opts.paused), (ctx, w, h) => drawWorldOn(ctx, world, w, h, opts))
  }

  function draw(stage: PixelStage, game: Game, opts: DrawOptions): void {
    if (stage.cssW <= 0 || stage.cssH <= 0) return
    const cutId = game.mode === 'cut' ? game.cut?.id : game.mode === 'done' ? 'ending' : null
    const ambient = cutId === 'prologue' ? '#d4c8ea'
      : cutId === 'capture' ? AMBIENT.night
      : cutId === 'ending' ? AMBIENT.dawn
      : ambientOf(game.world, !!opts.paused)
    frame(stage, ambient, (ctx, w, h) => drawGame(ctx, game, w, h, opts))
  }

  function drawGame(ctx: CanvasRenderingContext2D, game: Game, w: number, h: number, opts: DrawOptions): void {
    ctx.save()
    ctx.lineJoin = 'miter'
    const cut = game.cut
    const reduced = !!opts.reducedMotion
    if (game.mode === 'cut' && cut) {
      switch (cut.id) {
        case 'prologue':
          drawPrologue(ctx, cutState, w, h, cut.t, opts.look, reduced)
          break
        case 'card':
          drawWorldOn(ctx, game.world, w, h, opts)
          drawCard(ctx, w, h, cut.t, game.world.chapter, false)
          break
        case 'capture':
          drawCapture(ctx, cam, game, w, h, cut.t, opts.look, v => drawWorldInto(ctx, v, game.world, SCENES.night, opts.look, { flash: false, hidePilot: true }), reduced)
          break
        case 'ending':
          drawEnding(ctx, cutState, cam, game, w, h, cut.t, opts.look, (v, lift) => {
            const world = game.world
            drawWorldInto(ctx, v, { ...world, actors: [], shots: [], shields: [] }, SCENES.dawn, opts.look, { flash: false, sunLift: lift, hidePilot: true })
          }, reduced)
          break
      }
    } else if (game.mode === 'done') {
      // The last frame of the ending holds under the result.
      drawEnding(ctx, cutState, cam, game, w, h, 26.5, opts.look, (v, lift) => drawWorldInto(ctx, v, game.world, SCENES.dawn, opts.look, { flash: false, sunLift: lift, hidePilot: true }), true)
    } else {
      drawWorldOn(ctx, game.world, w, h, opts)
    }
    ctx.restore()
  }

  return { draw, drawWorld }
}

export type Renderer = ReturnType<typeof createRenderer>
