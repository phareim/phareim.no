/**
 * Space Voyagers: the field. Everything here is drawn in field pixels with
 * the origin at the field's top-left corner (the frame translates and clips
 * before it calls in). Bitmaps come from the sprite store by `kind`; shots,
 * beams, warnings and effects are drawn by code in the same hard pixels.
 *
 * What the engine's README asks of a renderer is kept: pools are skipped
 * where `active` is false, strings still waiting are not drawn, and every
 * aim and every zone is shown, warning or live, because the game is only
 * fair if they are.
 */
import { CAPTOR, DUET, SECTORS } from '../engine/balance'
import type { Bolt, Enemy, Shot, World, Zone } from '../engine/types'
import type { Fx, Puff } from './fx'
import { PICK_NAMES } from './fx'
import { C, INK, POP, SKY, WHITE } from './palette'
import { bigTextC, disc, frame, hash, line, rect, ring, stipple, textC } from './pix'
import type { G } from './pix'
import type { SpriteStore } from './sprites'

export interface FieldView {
  /** Field height (the world's) and the rows under it the backdrop runs through. */
  h: number
  under: number
  /** No shake, no tearing, a still backdrop, slower blinks. */
  reduced: boolean
  /** Where the player's ship was a tick ago, for the bank. */
  bank: number
  partnerBank: number
}

const W = 240

// ── The backdrop ─────────────────────────────────────────────────────────

const STARS: readonly { n: number; speed: number }[] = [{ n: 34, speed: 0.06 }, { n: 22, speed: 0.16 }, { n: 12, speed: 0.34 }]

export function drawBackdrop(g: G, sprites: SpriteStore, sector: number, tick: number, v: FieldView): void {
  const sky = SKY[(sector - 1) % SKY.length]!
  const H = v.h + v.under
  const t = v.reduced ? 0 : tick
  rect(g, sky.base, 0, 0, W, H)
  const tones = [sky.far, sky.mid, sky.near]
  for (let layer = 0; layer < STARS.length; layer++) {
    const L = STARS[layer]!
    g.fillStyle = tones[layer]!
    for (let i = 0; i < L.n; i++) {
      const k = hash(i + layer * 101, sector * 7 + layer)
      const x = k % W
      const y = (((k >>> 9) % H) + Math.floor(t * L.speed)) % H
      g.fillRect(x, y, 1, 1)
      // A few of the near ones are a plus of four dim pixels.
      if (layer === 2 && (k & 7) === 0) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3) }
    }
  }
  // The sector's two large things, drifting by, far apart so that one is in view most of the time.
  // One that is cut straight along its bottom (a horizon) stands on the bottom edge instead.
  const names = [`bg-${sector}-a`, `bg-${sector}-b`]
  for (let i = 0; i < 2; i++) {
    const name = names[i]!
    if (!sprites.ready(name)) { sprites.want(name); continue }
    const s = sprites.size(name)
    const room = W - s.w
    if (sprites.grounded(name)) {
      sprites.blit(g, name, Math.round(room / 2), H - s.h)
      continue
    }
    const period = H + s.h + 260
    const y = ((Math.floor(t * (i === 0 ? 0.09 : 0.07)) + (i === 0 ? s.h + 40 : period / 2 + s.h)) % period) - s.h
    const x = room > 0 ? Math.round(room * (i === 0 ? 0.15 : 0.85)) : Math.round(room / 2)
    sprites.blit(g, name, x, y)
  }
}

// ── Warnings: zones, aims, the captor's beam, CAL's doors ────────────────

function drawZone(g: G, z: Zone, tick: number, reduced: boolean): void {
  const x = Math.round(z.x)
  const y = Math.round(z.y)
  const w = Math.round(z.w)
  const h = Math.round(z.h)
  if (z.warn > 0) {
    // Showing: a dashed edge and a sparse stipple, quicker as it comes.
    const fast = z.warn < 20
    const on = reduced || Math.floor(tick / (fast ? 3 : 7)) % 2 === 0
    stipple(g, on ? C.warn : C.warnLo, x, y, w, h, 4, Math.floor(tick / 4))
    const c = on ? C.warn : C.warnLo
    line(g, c, x, y, x + w - 1, y, 3, tick >> 1)
    line(g, c, x, y + h - 1, x + w - 1, y + h - 1, 3, tick >> 1)
    line(g, c, x, y, x, y + h - 1, 3, tick >> 1)
    line(g, c, x + w - 1, y, x + w - 1, y + h - 1, 3, tick >> 1)
    return
  }
  // Live: a lit patch with hard edges.
  if (z.kind === 'wall') {
    rect(g, C.liveLo, x, y, w, h)
    rect(g, C.live, x, y, w, 2)
    rect(g, C.warn, x, y + h - 2, w, 2)
    return
  }
  rect(g, C.liveLo, x, y, w, h)
  stipple(g, C.live, x, y, w, h, 2, tick)
  rect(g, C.live, x, y, 2, h)
  rect(g, C.live, x + w - 2, y, 2, h)
  if (z.kind === 'tile' || z.kind === 'key') { rect(g, C.live, x, y, w, 2); rect(g, C.live, x, y + h - 2, w, 2) }
}

function drawAims(g: G, w: World, tick: number): void {
  for (const a of w.aims) {
    if (!a.active) continue
    const dx = a.tx - a.x
    const dy = a.ty - a.y
    const d = Math.hypot(dx, dy) || 1
    const c = a.kind === 'diver' ? C.aimed : C.warn
    line(g, c, a.x, a.y, a.x + (dx / d) * 560, a.y + (dy / d) * 560, 3, -(tick >> 1))
    if (a.kind !== 'diver') line(g, C.warnLo, a.x + 1, a.y, a.x + 1 + (dx / d) * 560, a.y + (dy / d) * 560, 3, -(tick >> 1))
    // Where it points: a small cross.
    const cx = Math.round(a.tx)
    const cy = Math.round(a.ty)
    rect(g, c, cx - 3, cy, 7, 1)
    rect(g, c, cx, cy - 3, 1, 7)
  }
}

/** The tractor beam: stippled bars in a cone down from the captor. */
function drawBeam(g: G, e: Enemy, tick: number, h: number): void {
  const on = e.t >= CAPTOR.warn
  const top = Math.round(e.y + 14)
  for (let y = top; y < h; y++) {
    const half = Math.round(Math.min(CAPTOR.beamHalf, 5 + (y - top) * 0.45))
    const x0 = Math.round(e.x) - half
    if (!on) {
      // Warming: the cone's two edges, dotted.
      if ((y + (tick >> 1)) % 3 === 0) { rect(g, C.beam, x0, y, 1, 1); rect(g, C.beam, x0 + half * 2, y, 1, 1) }
      continue
    }
    const row = (y - tick + 4000) % 6
    if (row === 0) rect(g, C.beam, x0, y, half * 2 + 1, 1)
    else if (row === 1 || row === 5) stipple(g, C.beam, x0, y, half * 2 + 1, 1, 2, y)
    else if (row === 3) stipple(g, C.beamLo, x0, y, half * 2 + 1, 1, 4, y)
    rect(g, C.beamLo, x0, y, 1, 1)
    rect(g, C.beamLo, x0 + half * 2, y, 1, 1)
  }
}

function drawBarriers(g: G, w: World): void {
  for (const b of w.barriers) {
    if (!b.active || b.shut <= 0) continue
    const y = Math.round(b.y - b.hh)
    const h = Math.round(b.hh * 2)
    const lw = Math.round((b.gapX - b.gapW / 2) * b.shut)
    const rw = Math.round((W - (b.gapX + b.gapW / 2)) * b.shut)
    for (const [x, pw, edge] of [[0, lw, lw - 2], [W - rw, rw, W - rw]] as const) {
      if (pw <= 0) continue
      rect(g, C.door, x, y, pw, h)
      rect(g, C.doorHi, x, y, pw, 1)
      rect(g, C.doorLo, x, y + h - 2, pw, 2)
      // The edge that closes, and rivets along the slab.
      rect(g, C.gold, edge, y, 2, h)
      g.fillStyle = C.doorLo
      for (let rx = x + 5; rx < x + pw - 3; rx += 12) g.fillRect(rx, y + 3, 2, 2)
    }
  }
}

/** The tick the boss last began a hit flash. */
let bossWhiteAt = -99

/** Where in a boss's bitmap its target is painted, from the bitmap's centre. Only for a target that moves. */
const BOSS_ANCHOR: Record<string, readonly [number, number]> = { cal: [0, -7] }

// ── Shots ────────────────────────────────────────────────────────────────

function drawShot(g: G, s: Shot, tick: number, loud: boolean): void {
  const x = Math.round(s.x)
  const y = Math.round(s.y)
  switch (s.kind) {
    case 'bolt': {
      const lean = Math.abs(s.vx) < 0.4 ? 0 : s.vx > 0 ? 1 : -1
      rect(g, C.bolt, x - 1, y - 3, 2, 7)
      rect(g, C.boltCore, x - 1 + lean, y - 4, 2, 3)
      if (loud) { rect(g, C.pink, x - 2, y + 2, 1, 3); rect(g, C.pink, x + 1, y + 2, 1, 3) }
      break
    }
    case 'disc': {
      const f = (tick >> 2) & 1
      rect(g, C.disc, x - 2, y - 3, 5, 7)
      rect(g, C.disc, x - 3, y - 2, 7, 5)
      rect(g, C.discCore, x - 1, y - 1, 3, 3)
      rect(g, INK, x, y, 1, 1)
      // The rainbow catching the light, turning.
      rect(g, C.pink, f ? x - 2 : x + 1, f ? y - 2 : y + 1, 2, 1)
      break
    }
    case 'bass': {
      // An arc of bass: a shallow curve that opens as it goes.
      const hw = Math.max(3, Math.round(s.hw))
      for (let dx = -hw; dx <= hw; dx++) {
        const k = dx / hw
        const dy = Math.round(k * k * 5)
        g.fillStyle = Math.abs(dx) > hw - 3 ? C.bassLo : C.bass
        g.fillRect(x + dx, y + dy, 1, 2)
        if (loud || (dx & 1) === 0) { g.fillStyle = C.boltCore; g.fillRect(x + dx, y + dy - 1, 1, 1) }
      }
      break
    }
    case 'wing': {
      const hw = Math.max(1, Math.round(s.hw))
      rect(g, C.wing, x - hw, y - 5, hw * 2, 10)
      rect(g, WHITE, x - Math.max(1, hw - 1), y - 5, Math.max(1, hw * 2 - 2), 4)
      break
    }
  }
}

function drawBolt(g: G, b: Bolt, tick: number, bright: boolean): void {
  const x = Math.round(b.x)
  const y = Math.round(b.y)
  const held = b.frozen > 0
  switch (b.kind) {
    case 'bolt':
      disc(g, held ? C.frost : C.enemyBolt, x, y, bright ? 3 : 2)
      rect(g, C.enemyCore, x - 1, y - 1, 2, 2)
      break
    case 'aimed':
      rect(g, held ? C.frost : C.aimed, x - 1, y - 3, 3, 7)
      rect(g, held ? C.frost : C.aimed, x - 3, y - 1, 7, 3)
      rect(g, WHITE, x - 1, y - 1, 3, 3)
      break
    case 'mine': {
      const r = Math.max(3, Math.round(b.r))
      disc(g, C.mineLo, x, y, r)
      disc(g, C.mine, x - 1, y - 1, r - 2)
      rect(g, C.mine, x - r - 2, y, 2, 1); rect(g, C.mine, x + r + 1, y, 2, 1)
      rect(g, C.mine, x, y - r - 2, 1, 2); rect(g, C.mine, x, y + r + 1, 1, 2)
      rect(g, (tick >> 3) & 1 ? C.red : C.warnLo, x - 1, y - 1, 2, 2)
      break
    }
    case 'note': {
      const c = held ? C.frost : C.note
      rect(g, c, x - 3, y + 1, 4, 3)
      rect(g, c, x - 2, y, 2, 5)
      rect(g, c, x, y - 5, 1, 7)
      rect(g, c, x + 1, y - 5, 2, 2)
      rect(g, WHITE, x - 2, y + 1, 1, 1)
      break
    }
    case 'ring':
      ring(g, held ? C.frost : C.ring, x, y, Math.max(2, Math.round(b.r)))
      rect(g, C.enemyCore, x, y, 1, 1)
      break
  }
}

// ── Things ───────────────────────────────────────────────────────────────

function bar(g: G, cx: number, y: number, w: number, share: number, hi: string, lo: string): void {
  const x = Math.round(cx - w / 2)
  rect(g, INK, x - 1, y - 1, w + 2, 5)
  rect(g, C.barBack, x, y, w, 3)
  const fill = Math.round(w * Math.max(0, Math.min(1, share)))
  rect(g, lo, x, y, fill, 3)
  rect(g, hi, x, y, fill, 1)
}

function pips(g: G, cx: number, y: number, hp: number, maxHp: number): void {
  const n = Math.min(8, maxHp)
  const x0 = Math.round(cx - (n * 3 - 1) / 2)
  for (let i = 0; i < n; i++) rect(g, i < hp ? C.gold : C.barBack, x0 + i * 3, y, 2, 2)
}

/** A ship's exhaust: two frames of a few pixels. */
function flame(g: G, x: number, y: number, tick: number, wide: boolean): void {
  const f = (tick >> 2) & 1
  rect(g, C.bass, x - (wide ? 2 : 1), y, wide ? 4 : 2, 2 + f)
  rect(g, C.bolt, x - 1, y, 2, 1 + f)
}

function drawShip(g: G, sprites: SpriteStore, kind: string, x: number, y: number, bank: number, tick: number, variant: 'plain' | 'white' = 'plain'): void {
  const banked = Math.abs(bank) > 0.9 && sprites.ready(`${kind}-bank`)
  const name = banked ? `${kind}-bank` : kind
  const s = sprites.size(name)
  flame(g, Math.round(x), Math.round(y + s.h / 2 - 1), tick, kind === 'ship-rex')
  sprites.draw(g, name, x, y, { mirror: banked && bank > 0, variant })
}

function drawPuff(g: G, p: Puff): void {
  const tone = POP[p.tone] ?? POP.ours!
  const x = Math.round(p.x)
  const y = Math.round(p.y)
  // A few frames, not a slide: time moves in steps of three ticks.
  const f = Math.floor(p.t / 3)
  switch (p.kind) {
    case 'pop': {
      const n = 5 + p.n * 2
      const c = f < 1 ? tone[0] : f < 3 ? tone[1] : tone[2]
      const size = f < 2 ? 3 : f < 4 ? 2 : 1
      for (let i = 0; i < n; i++) {
        const k = hash(p.seed, i)
        const a = (i / n) * 6.283 + (k % 100) / 60
        const d = (f + 1) * (1.6 + (k >>> 8) % 3 * 0.5) * (0.8 + p.n * 0.25)
        rect(g, i % 3 === 0 ? tone[0] : c, x + Math.round(Math.cos(a) * d) - 1, y + Math.round(Math.sin(a) * d) - 1, size, size)
      }
      if (f < 1) rect(g, tone[0], x - 3, y - 3, 6, 6)
      break
    }
    case 'spark':
      rect(g, tone[0], x - 1, y - 1 - f, 2, 2)
      rect(g, tone[1], x - 2 - f, y + f, 1, 1)
      rect(g, tone[1], x + 2 + f, y + f, 1, 1)
      break
    case 'bubble':
      // The pilot, drifting off in a bubble.
      if (p.t > 6) {
        ring(g, C.bubble, x, y, 4)
        rect(g, tone[1], x - 1, y, 2, 2)
        rect(g, WHITE, x - 2, y - 2, 1, 1)
      }
      break
    case 'ring':
      ring(g, f & 1 ? tone[1] : tone[0], x, y, Math.max(2, Math.round((p.n * (p.t + 1)) / p.life)), p.n > 60 ? 3 : 0, p.t)
      break
    case 'cancel':
      rect(g, C.gold, x - 2 + f, y, 1, 1)
      rect(g, C.gold, x + 2 - f, y, 1, 1)
      rect(g, WHITE, x, y - 2 - f, 1, 2)
      break
    case 'flash':
      break
  }
}

/** The field in play. The frame has drawn the backdrop already. */
export function drawField(g: G, sprites: SpriteStore, w: World, fx: Fx, v: FieldView): void {
  const tick = w.tick
  const H = v.h
  const loud = w.duet > 0
  const blink = v.reduced ? 8 : 4

  for (const z of w.zones) if (z.active) drawZone(g, z, tick, v.reduced)
  if (w.cloud.active) {
    // EXTRA HOLD: a cloud of spray, a stippled disc.
    const c = w.cloud
    const r = Math.round(c.r)
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy))
      stipple(g, C.cloud, Math.round(c.x) - half, Math.round(c.y) + dy, half * 2, 1, c.t < 60 ? 4 : 2)
    }
    ring(g, C.cloud, c.x, c.y, r, 3, tick >> 2)
  }

  // Rigs and their cargo.
  let lead = -1
  for (let i = 0; i < w.rigs.length; i++) {
    const r = w.rigs[i]!
    if (!r.active) continue
    if (r.unhooked) sprites.draw(g, r.kind, r.x, r.y, { rows: 40, anchorTop: true })
    else sprites.draw(g, r.kind, r.x, r.y)
    if (r.job === 'convoy' && (lead < 0 || r.y < w.rigs[lead]!.y)) lead = i
  }
  if (w.convoy.active && lead >= 0) {
    const r = w.rigs[lead]!
    const y = Math.max(12, Math.min(H - 8, Math.round(r.y - r.hh - 8)))
    textC(g, 'CARGO', r.x, y - 9, C.text, INK)
    bar(g, r.x, y, 30, w.convoy.cargo, C.cargo, C.cargoLo)
  }

  // The stranded ship, her beacon, the cables.
  const wing = w.wing
  if (wing.state !== 'off') {
    sprites.draw(g, wing.kind, wing.x, wing.y)
    const s = sprites.size(wing.kind)
    if (wing.state === 'drift' || wing.state === 'stalled') {
      if (v.reduced || (tick >> 4) & 1) ring(g, C.gold, wing.x, wing.y - s.h / 2 - 5, 3 + ((tick >> 4) & 2))
      rect(g, C.gold, Math.round(wing.x), Math.round(wing.y - s.h / 2 - 5), 1, 1)
    }
    if (wing.state === 'stalled' && wing.bar > 0) {
      const p = w.player
      line(g, C.cable, p.x - 3, p.y - 6, wing.x - 4, wing.y + 6)
      line(g, C.cableLo, p.x + 3, p.y - 6, wing.x + 4, wing.y + 6)
      bar(g, wing.x, Math.round(wing.y - s.h / 2 - 16), 32, wing.bar, C.cable, C.cableLo)
    }
  }
  if (w.pass.active) sprites.draw(g, w.pass.kind, w.pass.x, w.pass.y)
  if (w.duo.active) sprites.draw(g, w.duo.kind, w.duo.x, w.duo.y)

  // Enemies.
  for (const e of w.enemies) {
    if (!e.active || e.state === 'wait') continue
    if (e.role === 'captor' && e.state === 'hover' && !e.carrying) drawBeam(g, e, tick, H + v.under)
    sprites.draw(g, e.kind, e.x, e.y, e.flash < 3 ? { variant: 'white' } : undefined)
    if (e.frozen > 0) sprites.draw(g, e.kind, e.x, e.y, { variant: 'frost' })
    if (e.maxHp >= 3) pips(g, e.x, Math.round(e.y + sprites.size(e.kind).h / 2 + 2), e.hp, e.maxHp)
  }

  // The boss.
  const b = w.boss
  if (b.active) {
    if (b.id === 'cal') {
      // A wall of valves across the field: the bitmap is its middle.
      const y = Math.round(b.y - b.hh)
      rect(g, C.metalLo, Math.round(b.x - b.hw), y, Math.round(b.hw * 2), Math.round(b.hh * 2))
      rect(g, C.metal, Math.round(b.x - b.hw), y, Math.round(b.hw * 2), 2)
      for (let x = Math.round(b.x - b.hw) + 5; x < b.x + b.hw - 4; x += 11) {
        rect(g, C.glass, x, y + 6, 6, 12)
        rect(g, (hash(x, tick >> 4) & 3) === 0 ? C.bass : C.cableLo, x + 1, y + 8, 4, 8)
      }
    }
    const dying = b.state === 'dying'
    // Under steady fire a boss would be a white silhouette all the time: it flashes two ticks in eight at most.
    if (tick < bossWhiteAt) bossWhiteAt = -99
    if (b.flash < 2 && tick - bossWhiteAt >= 8 && !v.reduced) bossWhiteAt = tick
    const white = dying ? Math.floor(tick / (v.reduced ? 12 : 4)) % 2 === 0 : tick - bossWhiteAt < 2
    // A boss whose target moves along its body (CAL's lens) is drawn with the target's point of the bitmap on it.
    const anchor = BOSS_ANCHOR[b.id]
    if (anchor) sprites.draw(g, b.kind, b.x + b.wx - anchor[0], b.y + b.wy - anchor[1], white ? { variant: 'white' } : undefined)
    else sprites.draw(g, b.kind, b.x, b.y, white ? { variant: 'white' } : undefined)
    if (!dying && (b.whw < b.hw - 4 || b.whh < b.hh - 4) && (v.reduced || (tick >> 3) & 1)) {
      // The part that takes damage.
      frame(g, C.gold, Math.round(b.x + b.wx - b.whw) - 2, Math.round(b.y + b.wy - b.whh) - 2, Math.round(b.whw * 2) + 4, Math.round(b.whh * 2) + 4)
    }
  }
  drawBarriers(g, w)
  drawAims(g, w, tick)

  // Pick-ups, named while they are new.
  for (const k of w.pickups) {
    if (!k.active) continue
    sprites.draw(g, k.kind, k.x, k.y)
    if (k.age < 150) textC(g, PICK_NAMES[k.id] ?? k.id, Math.max(22, Math.min(W - 22, k.x)), Math.round(k.y + sprites.size(k.kind).h / 2 + 2), C.gold, INK)
  }

  for (const s of w.shots) if (s.active) drawShot(g, s, tick, loud)

  // The two ships.
  const p = w.player
  const q = w.partner
  const showQ = q.invuln <= 0 || Math.floor(tick / blink) % 2 === 0
  if (showQ) {
    drawShip(g, sprites, q.kind, q.x, q.y, v.partnerBank, tick)
    if (q.state === 'limp') {
      // Smoke: a stipple trailing up.
      stipple(g, C.mine, Math.round(q.x) - 3, Math.round(q.y) - 26 - ((tick >> 2) % 6), 7, 8, 2, tick >> 2)
    }
  }
  if (p.towing > 0) line(g, C.cable, q.x, q.y + 12, p.x, p.y - 14)
  const alive = !w.over && (p.hull > 0 || p.towing > 0)
  if (alive && (p.invuln <= 0 || Math.floor(tick / blink) % 2 === 0)) {
    drawShip(g, sprites, p.kind, p.x, p.y, v.bank, tick)
  }
  if (alive && p.bubble > 0) {
    ring(g, C.bubble, p.x, p.y, 21)
    if (p.bubble > 1) ring(g, C.bubble, p.x, p.y, 23, 2, tick >> 2)
    rect(g, WHITE, Math.round(p.x) - 14, Math.round(p.y) - 15, 2, 1)
    rect(g, WHITE, Math.round(p.x) - 15, Math.round(p.y) - 14, 1, 2)
  }
  if (alive && p.magnet > 0 && (tick >> 3) & 1) ring(g, C.red, p.x, p.y, 15, 4, tick >> 1)

  const bright = w.sector === 1 && w.voyage === 1
  for (const s of w.bolts) if (s.active) drawBolt(g, s, tick, bright)

  for (const f of fx.puffs) if (f.active) drawPuff(g, f)
  for (const t of fx.words) {
    if (!t.active || (t.life - t.t < 10 && (t.t & 2))) continue
    textC(g, t.text, Math.max(20, Math.min(W - 20, t.x)), t.y, C[t.color], INK)
  }

  // DUET: loud at the edges, where nothing has to be read.
  if (loud) {
    const share = w.duet / DUET.ticks
    for (let y = 0; y < H; y += 8) {
      const on = ((y >> 3) + (tick >> 2)) & 1
      rect(g, on ? C.pink : C.gold, 0, y, 3, 8)
      rect(g, on ? C.gold : C.pink, W - 3, y, 3, 8)
    }
    rect(g, INK, 0, 0, W, 3)
    rect(g, C.pink, 0, 0, Math.round(W * share), 3)
  }

  // The boss's hull.
  if (b.active && b.state !== 'dying') {
    const x = 20
    const bw = W - 40
    const y = loud ? 5 : 3
    rect(g, INK, x - 1, y - 1, bw + 2, 5)
    rect(g, C.barBack, x, y, bw, 3)
    const fill = Math.round(bw * Math.max(0, b.hp / b.maxHp))
    rect(g, C.warnLo, x, y, fill, 3)
    rect(g, C.red, x, y, fill, 1)
  }
  if (w.chainMul > 1) textC(g, `X${w.chainMul}`, W - 12, b.active ? 10 : 4, C.pink, INK)

  drawBanner(g, sprites, w, fx, H)
  if (fx.blink > 0 && !v.reduced) stipple(g, WHITE, 0, 0, W, H, 2, fx.blink)
}

function drawBanner(g: G, sprites: SpriteStore, w: World, fx: Fx, H: number): void {
  const b = fx.banner
  if (b.life <= 0) return
  const left = b.life - b.t
  if (left < 12 && (left & 2)) return
  const color = C[b.color]
  if (b.card) {
    // The ending: the picture, and the words under it.
    const s = sprites.size('card-ending')
    const top = Math.max(0, Math.round((H - s.h - 60) / 2))
    sprites.draw(g, 'card-ending', W / 2, top + s.h / 2)
    rect(g, INK, 0, top + s.h, W, 58)
    bigTextC(g, b.title, W / 2, top + s.h + 8, 2, color, C.warnLo)
    textC(g, b.sub, W / 2, top + s.h + 28, C.text)
    textC(g, `SCORE ${w.score}`, W / 2, top + s.h + 40, C.gold)
    return
  }
  const y = Math.round(H * 0.3)
  // Type the title on over its first ticks.
  const shown = b.title.slice(0, Math.max(1, Math.ceil((b.t + 1) / 2)))
  bigTextC(g, shown, W / 2 - (b.title.length - shown.length) * 6, y, 2, color, INK)
  if (b.sub && b.t > b.title.length * 2) textC(g, b.sub, W / 2, y + 20, C.text, INK)
}

/** TRACKING: the field tears in horizontal bands, as a worn tape does. Not near the ship. */
export function tearField(g: G, buf: HTMLCanvasElement, fieldX: number, fieldY: number, w: World, H: number): void {
  const step = w.tick >> 3
  for (let i = 0; i < 5; i++) {
    const k = hash(step, i * 13 + 1)
    const h = 3 + (k % 10)
    const y = (k >>> 6) % Math.max(1, H - h)
    if (Math.abs(y + h / 2 - w.player.y) < 34) continue
    const shift = ((k >>> 14) % 13) - 6
    if (shift === 0) continue
    g.drawImage(buf, fieldX, fieldY + y, W, h, fieldX + shift, fieldY + y, W, h)
    // The edge of a tear: a line of snow.
    stipple(g, WHITE, fieldX, fieldY + y, W, 1, 4, k & 3)
  }
}

export function sectorName(sector: number): string {
  return SECTORS[sector - 1]?.name ?? ''
}
