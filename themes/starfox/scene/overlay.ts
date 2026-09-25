/**
 * What the scene hands the pixel stage each frame: glows for its light
 * map (projected from 3D without allocating), and the HUD layer drawn on
 * top of the scene: capsule letters when the 3D letter is too small to
 * read, the lancers' sightlines, and the charge shot's lock reticle.
 */
import type { PixelStage } from '../../base/pixel/stage'
import { drawText, textWidth } from '../../base/pixel/sprites'
import { drawCapsuleLabel, type CapsuleModel } from '../models/capsules'
import type { CapsuleType } from '../arsenal'
import { P } from '../models/core'
import { projectTo } from '../pixel'
import type { Ctx } from './ctx'

export interface Overlay {
  lights(): void
  hud(): void
}

type Add = (x: number, y: number, z: number, r: number, color: string, a: number) => void

/** Under this many logical pixels tall, a capsule's 3D letter gives way to the HUD badge. */
const LABEL_MIN_PX = 11

export function createOverlay(ctx: Ctx, stage: PixelStage): Overlay {
  const p = { x: 0, y: 0, r: 0 }
  const q = { x: 0, y: 0, r: 0 }
  const loc = { x: 0, y: 0, z: 0 }

  const add: Add = (x, y, z, r, color, a) => {
    if (!projectTo(p, ctx.camera, stage.vw, stage.vh, x, y, z, r, 2, 60)) return
    if (p.x < -p.r || p.y < -p.r || p.x > stage.vw + p.r || p.y > stage.vh + p.r) return
    stage.light(p.x, p.y, p.r, color, a)
  }

  function dotted(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, on: number) {
    const dx = x1 - x0, dy = y1 - y0
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))))
    g.fillStyle = color
    for (let i = 0; i <= n; i++) {
      if ((i + on) % 3 === 2) continue
      g.fillRect(Math.round(x0 + (dx * i) / n), Math.round(y0 + (dy * i) / n), 1, 1)
    }
  }

  function corners(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
    const x0 = Math.round(cx - s), y0 = Math.round(cy - s), x1 = Math.round(cx + s), y1 = Math.round(cy + s)
    g.fillStyle = color
    const l = 3
    g.fillRect(x0, y0, l, 1); g.fillRect(x0, y0, 1, l)
    g.fillRect(x1 - l + 1, y0, l, 1); g.fillRect(x1, y0, 1, l)
    g.fillRect(x0, y1, l, 1); g.fillRect(x0, y1 - l + 1, 1, l)
    g.fillRect(x1 - l + 1, y1, l, 1); g.fillRect(x1, y1 - l + 1, 1, l)
  }

  /** Corners round a projected point with a name above it. */
  function tag(at: { x: number; y: number; r: number }, name: string, color: string, pulse: number) {
    corners(g, at.x * kx, at.y * ky, at.r * kx + 1 + pulse, color)
    const w = textWidth(name)
    drawText(g, name, Math.round(at.x * kx - w / 2), Math.round(at.y * ky - at.r * ky - 12), color, P.ink)
  }

  let g: CanvasRenderingContext2D = stage.hud
  let kx = 1
  let ky = 1
  let blink = 0
  const capsule = (x: number, y: number, z: number, type: CapsuleType, model: CapsuleModel) => {
    if (!projectTo(p, ctx.camera, stage.vw, stage.vh, x, y, z, 0.55, 0, 400)) { model.label.visible = false; return }
    const small = p.r * 2 < LABEL_MIN_PX
    model.label.visible = !small
    if (small) drawCapsuleLabel(g, p.x * kx, p.y * ky, type)
  }
  const sightline = (x: number, y: number, z: number, tx: number, ty: number, tz: number) => {
    if (!projectTo(p, ctx.camera, stage.vw, stage.vh, x, y, z, 1, 0, 400)) return
    if (!projectTo(q, ctx.camera, stage.vw, stage.vh, tx, ty, tz, 1, 0, 400)) return
    dotted(g, p.x * kx, p.y * ky, q.x * kx, q.y * ky, P.hot, blink)
  }

  return {
    lights() {
      ctx.env.lights(add)
      ctx.player.lights(add)
      ctx.squad.lights(add)
      ctx.enemies.lights(add)
      ctx.shots.lights(add)
      ctx.pickups.lights(add)
      ctx.obstacles.lights(add)
      ctx.boss.lights(add)
      ctx.fx.lights(add)
    },
    hud() {
      g = stage.hud
      kx = stage.hw / stage.vw
      ky = stage.hh / stage.vh
      blink = Math.floor(ctx.now * 20) % 3
      // Capsule letters: the 3D sprite up close, a crisp badge far away.
      ctx.pickups.eachCapsule(capsule)
      // Lancer sightlines: the pink line is its aim.
      ctx.enemies.eachAim(sightline)
      const cam = ctx.camera
      const pulse = Math.floor(ctx.now * 8) % 2
      // Set pieces: Dingo and whoever is on his tail, and Mega Cobra.
      for (const m of ctx.squad.members) {
        if (!m.trouble || !m.alive) continue
        if (projectTo(p, cam, stage.vw, stage.vh, m.x, m.y, m.z, 2.2, 5, 40)) tag(p, 'DINGO', P.cyan, pulse)
      }
      for (const e of ctx.enemies.list) {
        if (!e.active || (e.role !== 1 && e.role !== 2) || e.invuln) continue
        if (!projectTo(p, cam, stage.vw, stage.vh, e.x, e.y, e.z, e.role === 2 ? 2.6 : 1.4, 4, 40)) continue
        if (e.role === 2) tag(p, 'COBRA', P.lime, pulse)
        else corners(g, p.x * kx, p.y * ky, p.r * kx + 1, P.hot)
      }
      // The charge lock.
      const id = ctx.player.lockId
      if (id !== 0 && ctx.enemies.locate(id, loc) && projectTo(p, cam, stage.vw, stage.vh, loc.x, loc.y, loc.z, 1.6, 4, 40)) {
        corners(g, p.x * kx, p.y * ky, p.r * kx + 2 + pulse, pulse ? P.cyan : P.white)
        const w = textWidth('LOCK')
        drawText(g, 'LOCK', Math.round(p.x * kx - w / 2), Math.round(p.y * ky + p.r * ky + 5), P.cyan, P.ink)
      }
    },
  }
}
