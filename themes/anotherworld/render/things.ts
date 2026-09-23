import type { Cage, Item, Lamp, RockfallHazard, Shield, Shot, TideHazard, World } from '../types'
import { tideLevel } from '../engine/actors'
import {
  FAR, GOLD, L, MID, NEAR, PINK, SEA, SKY,
  bar, disc, glow, poly, rect,
  type Pt, type Scene, type View,
} from './core'

// Small things with a job: shots, shields, lamps, the gun, the cage, the
// tide and the rock. Everything that can kill is pink; everything that
// helps is gold; the pilot's own light is the ship's colour.

export function drawShot(ctx: CanvasRenderingContext2D, v: View, s: Shot, accent: string): void {
  const x = v.X(s.x)
  const y = v.Y(s.y)
  if (x < -60 || x > v.width + 60) return
  const dir = s.vx < 0 ? -1 : 1
  const k = v.s
  if (s.kind === 'beam') {
    const len = Math.min(220, s.t * 1300) * k
    glow(ctx, accent, 22, () => {
      poly(ctx, [[x, y - 4 * k], [x - dir * len, y - 1.5 * k], [x - dir * len, y + 1.5 * k], [x, y + 4 * k]], accent)
      disc(ctx, x, y, 5 * k, '#ffffff', 10)
    }, v.cheap)
    return
  }
  const c = s.owner === 'player' ? accent : PINK
  const len = (s.kind === 'bolt' ? 18 : 24) * k
  glow(ctx, c, 12, () => rect(ctx, dir > 0 ? x - len : x, y - 1.3 * k, len, 2.6 * k, c), v.cheap)
  rect(ctx, dir > 0 ? x - 5 * k : x, y - 0.8 * k, 5 * k, 1.6 * k, '#ffffff')
}

/** A shield is a flat wall of light; it flickers as it wears out. */
export function drawShield(ctx: CanvasRenderingContext2D, v: View, sh: Shield, accent: string, time: number): void {
  const c = sh.owner === 'player' ? accent : PINK
  if (sh.life < 0.6 && Math.floor(time * 20) % 2) return
  if (sh.hp === 1 && Math.floor(time * 14) % 3 === 0) return
  const x = v.X(sh.x)
  const top = v.Y(sh.y - sh.h)
  const bot = v.Y(sh.y)
  const k = v.s
  // It snaps up from the floor over its first tenth of a second.
  const grow = Math.min(1, sh.t / 0.1)
  const t = bot - (bot - top) * grow
  glow(ctx, c, 16, () => poly(ctx, [[x - 2 * k, bot], [x - 2.5 * k, t + 4 * k], [x, t], [x + 2.5 * k, t + 4 * k], [x + 2 * k, bot]], c), v.cheap)
  rect(ctx, x - 0.6 * k, t + 3 * k, 1.2 * k, bot - t - 4 * k, '#ffffff')
}

export function drawLamp(ctx: CanvasRenderingContext2D, v: View, sc: Scene, lamp: Lamp): void {
  if (lamp.final) return // the tower lamp is its own prop
  const { X, Y, s } = v
  const cx = X(lamp.x)
  if (cx < -60 || cx > v.width + 60) return
  const H = 60
  const top = lamp.y - H
  const pal = sc.pal
  // An alien lamp post: a bent stem, a cage for the light.
  poly(ctx, [[X(lamp.x - 2), Y(lamp.y)], [X(lamp.x - 1.2), Y(top + 6)], [X(lamp.x + 4), Y(top)], [X(lamp.x + 5), Y(top + 3)], [X(lamp.x + 1.5), Y(top + 8)], [X(lamp.x + 2), Y(lamp.y)]], pal[NEAR])
  rect(ctx, X(lamp.x - 9), Y(lamp.y) - 3 * s, 18 * s, 3 * s, pal[NEAR])
  const hx = X(lamp.x + 6)
  const hy = Y(top + 10)
  const r = 7 * s
  const head: Pt[] = [[hx, hy - r], [hx + r * 0.62, hy], [hx, hy + r], [hx - r * 0.62, hy]]
  if (lamp.lit) glow(ctx, GOLD, 18, () => poly(ctx, head, GOLD), v.cheap)
  else poly(ctx, head, pal[FAR + L])
  bar(ctx, [hx, hy - r - 2 * s], [hx, hy + r + 2 * s], 1.4 * s, pal[NEAR])
}

export function drawItem(ctx: CanvasRenderingContext2D, v: View, it: Item, time: number): void {
  if (it.taken) return
  const x = v.X(it.x)
  const y = v.Y(it.y) - 3 * v.s
  const k = v.s
  // The gun on the floor, and a gold pulse above it so the eye finds it.
  bar(ctx, [x - 7 * k, y], [x + 7 * k, y - 1 * k], 3 * k, '#05030d')
  rect(ctx, x - 7 * k, y, 3 * k, 4 * k, '#05030d')
  const pulse = Math.floor(time * 2) % 2
  glow(ctx, GOLD, 12, () => {
    rect(ctx, x + 5 * k, y - 2.4 * k, 2.4 * k, 2.4 * k, GOLD)
    if (pulse) poly(ctx, [[x, y - 14 * k], [x + 3 * k, y - 18 * k], [x, y - 22 * k], [x - 3 * k, y - 18 * k]], GOLD)
  }, v.cheap)
}

export function drawCage(ctx: CanvasRenderingContext2D, v: View, sc: Scene, c: Cage, back: boolean): void {
  const k = v.s
  const pal = sc.pal
  const W = 80
  const H = 84
  const cx = c.x
  const top = c.y
  const ang = c.state === 'down' ? c.theta : c.theta
  const cos = Math.cos(ang)
  const sin = Math.sin(ang)
  // Cage-local u (right), w (down) around the rope's end.
  const P = (u: number, w: number): Pt => [v.X(cx + u * cos - w * sin), v.Y(top + u * sin + w * cos)]
  if (back) {
    if (c.state !== 'down') bar(ctx, [v.X(c.pivotX), v.Y(c.pivotY)], P(0, 0), 2 * k, pal[NEAR + L])
    rect(ctx, v.X(c.pivotX) - 10 * k, v.Y(c.pivotY) - 8 * k, 20 * k, 8 * k, pal[NEAR])
    // The back bars.
    for (let i = 0; i < 5; i++) bar(ctx, P(-W / 2 + 8 + i * 16, 6), P(-W / 2 + 8 + i * 16, H), 1.4 * k, pal[MID])
    return
  }
  const broken = c.state === 'down'
  // Roof, floor, front bars; broken, the front hangs open.
  poly(ctx, [P(-W / 2 - 4, 6), P(0, -2), P(W / 2 + 4, 6), P(W / 2 + 4, 10), P(-W / 2 - 4, 10)], pal[NEAR])
  poly(ctx, [P(-W / 2 - 3, H - 2), P(W / 2 + 3, H - 2), P(W / 2 + 3, H + 4), P(-W / 2 - 3, H + 4)], pal[NEAR])
  for (let i = 0; i < 6; i++) {
    const u = -W / 2 + i * (W / 5)
    if (broken && i === 5) {
      bar(ctx, P(u, H), P(u + 30, H - 6), 2.4 * k, pal[NEAR + L])
      continue
    }
    if (broken && i === 4) continue
    bar(ctx, P(u, 8), P(u, H - 2), 2.4 * k, pal[NEAR + L])
  }
  bar(ctx, P(-W / 2, H * 0.45), P(W / 2, H * 0.45), 1.6 * k, pal[NEAR])
}

export function drawTide(ctx: CanvasRenderingContext2D, v: View, sc: Scene, hz: TideHazard, world: World): void {
  const { X, Y, s } = v
  const x0 = X(hz.x - 6)
  const x1 = X(hz.x + hz.w + 6)
  if (x1 < 0 || x0 > v.width) return
  const dyingHere = world.dying?.cause === 'tide'
  const level = dyingHere ? 1 : tideLevel(hz, world.time)
  if (level <= 0) return
  const full = hz.h * (dyingHere ? 1.5 : 1)
  const slabTop = Y(hz.y + hz.h)
  const top = slabTop - full * level * s
  const crest = Math.max(2, 3 * s)
  const w = x1 - x0
  const edge: Pt[] = [[x0, top + 3 * s], [x0 + w * 0.3, top], [x0 + w * 0.7, top + 1.5 * s], [x1, top + 2.5 * s]]
  poly(ctx, [...edge, [x1, slabTop + 30 * s], [x0, slabTop + 30 * s]], sc.pal[SEA + L])
  poly(ctx, [...edge, ...edge.slice().reverse().map(([x, y]): Pt => [x, y + crest])], sc.pal[SKY + L])
}

export function drawRock(ctx: CanvasRenderingContext2D, v: View, sc: Scene, hz: RockfallHazard, time: number): void {
  const { X, Y, s } = v
  const x0 = X(hz.x)
  const x1 = X(hz.x + hz.w)
  if (x1 < 0 || x0 > v.width) return
  const yT = Y(hz.top)
  const yB = Y(hz.top + hz.h)
  const pal = sc.pal
  if (hz.state === 'hanging') {
    // Grit trickles down where the rock will land: the threat before its motion.
    const land = Y(hz.y + hz.h)
    for (let i = 0; i < 6; i++) {
      const u = (time * 0.9 + i / 6) % 1
      const gx = x0 + (hz.w * (0.3 + ((i * 37) % 10) / 25)) * s
      const gy = land - (1 - u) * v.height * 0.9
      if (gy > land - 4 * s) continue
      rect(ctx, gx, gy, 2 * s, 2 * s, pal[NEAR + L])
    }
  }
  if (hz.state === 'landed') {
    poly(ctx, [[x0, yB], [x0 + 8 * s, yT], [x1 - 9 * s, yT + 2 * s], [x1, yB]], pal[NEAR])
    poly(ctx, [[x1 - 9 * s, yT + 2 * s], [x1 - 15 * s, yT + 2 * s], [x1 - 6 * s, yB], [x1, yB]], pal[NEAR + L])
  } else {
    poly(ctx, [[x0, yT], [x1, yT], [x1 - 14 * s, yB], [x0 + 10 * s, yB]], pal[NEAR])
    poly(ctx, [[x1, yT], [x1 - 7 * s, yT], [x1 - 19 * s, yB], [x1 - 14 * s, yB]], pal[NEAR + L])
  }
}

/** The pool's water, drawn over the figure so it reads as being in it. */
export function drawPool(ctx: CanvasRenderingContext2D, v: View, sc: Scene, world: World): void {
  for (const w of world.water) {
    const x0 = v.X(w.x)
    const x1 = v.X(w.x + w.w)
    if (x1 < 0 || x0 > v.width) continue
    const y0 = v.Y(w.y)
    const y1 = v.Y(w.bottom)
    ctx.save()
    ctx.globalAlpha = 0.62
    rect(ctx, x0, y0, x1 - x0, y1 - y0, sc.pal[SEA])
    ctx.restore()
    const shift = (Math.floor(world.time * 1.5) % 4) * v.s
    rect(ctx, x0, y0, x1 - x0, Math.max(2, 2.5 * v.s), sc.pal[SEA + L])
    rect(ctx, x0 + 30 * v.s + shift, y0 + 8 * v.s, (x1 - x0) * 0.4, Math.max(1.5, 1.5 * v.s), sc.pal[MID + L])
  }
}
