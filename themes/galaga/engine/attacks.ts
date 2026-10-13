/**
 * Space Voyagers: what the bosses throw. Every attack is a few steps with a
 * wait between them, built from three things the field already knows: shots,
 * lit patches of field that are shown before they hurt (zones), and lines
 * shown before a shot goes along them (aims). Nothing that is pointed at the
 * player comes without its warning. The numbers are ATTACK in balance.ts.
 *
 *   knight     ray, rays (two that leave a gap), floor, floor2, glint
 *   humdinger  ram, ram2, mines, hogs
 *   durant     scale, chord, trill, notes   (columns: the organ's keys)
 *   cal        eye, eyes, pods              (and the doors, in bosses.ts)
 *   fader      sliders, choke, treble
 *   deafstar   rings, note, static, squeeze
 */
import { ATTACK } from './balance.ts'
import { chance, rand, randInt, randRange } from './rng.ts'
import type { Boss, World } from './types.ts'
import { emit, playerTop, spawnAim, spawnBolt, spawnEnemy, spawnZone } from './world.ts'

/** Steps in each attack; where it depends on the phase, a function of it. */
const STEPS: Record<string, number | ((phase: number) => number)> = {
  ray: 1, rays: 1, floor: 1, floor2: 2, glint: 2,
  ram: 1, ram2: 2, mines: 1, hogs: 1,
  scale: 8, chord: 1, trill: 4, notes: 1,
  eye: 1, eyes: 3, pods: 1,
  sliders: 3, choke: p => (p >= 2 ? 2 : 1), treble: 1,
  rings: p => p, note: 1, static: 1, squeeze: 1,
}

export const ATTACK_NAMES: readonly string[] = Object.keys(STEPS)

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** One of the boss's own gang, loosed straight down the field; it does not come back. */
function helper(w: World, x: number, y: number, vx: number, vy: number): void {
  const e = spawnEnemy(w, 'grunt', w.gang, x, y)
  if (!e) return
  e.state = 'free'
  e.vx = vx
  e.vy = vy
  e.wraps = 9
}

export function beginAttack(w: World, b: Boss, name: string): void {
  const n = STEPS[name]
  if (n === undefined) return
  b.attack = name
  b.attackT = 0
  b.stepT = 0
  b.steps = typeof n === 'number' ? n : n(b.phase)
  b.a = 0
  if (b.id !== 'cal') b.b = name === 'scale' ? randInt(w.rng, 2) * 16 + randInt(w.rng, 8) : randInt(w.rng, 2)
  emit(w, 'bossAttack', b.x, b.y, name, b.phase)
}

/** Once a tick while an attack is under way. */
export function runAttack(w: World, b: Boss, dt: number): void {
  b.attackT += dt
  if (b.state === 'ram') ramMotion(w, b)
  b.stepT -= dt
  if (b.stepT > 0) return
  if (b.steps > 0) {
    const total = STEPS[b.attack]!
    const index = (typeof total === 'number' ? total : total(b.phase)) - b.steps
    b.steps--
    b.stepT = doStep(w, b, index)
    return
  }
  b.attack = ''
  if (b.state === 'ram') { b.state = 'fight'; b.y = b.homeY }
}

/** Lord Humdinger's charge: he slides to the lane while it is shown, then goes down it and back. */
function ramMotion(w: World, b: Boss): void {
  const R = ATTACK.ram
  const local = b.attackT - b.a
  if (local < R.warn) {
    b.x += clamp(b.b - b.x, -3.5, 3.5)
    b.y = b.homeY
  } else {
    const u = (local - R.warn) / R.live
    b.y = u < 1 ? b.homeY + Math.sin(u * Math.PI) * (w.h - b.homeY - 50) : b.homeY
  }
}

/** Do step `index` of the boss's attack; returns the ticks to wait after it. */
function doStep(w: World, b: Boss, index: number): number {
  const p = w.player
  const W = w.w
  const H = w.h
  const top = b.y + b.hh + 2
  const last = b.steps === 0
  switch (b.attack) {
    // ── Saturday Knight ──
    case 'ray': {
      const R = ATTACK.ray
      const left = chance(w.rng, 0.5)
      spawnZone(w, 'ray', left ? 0 : W - R.w, top, R.w, H - top, R.warn, R.live, left ? R.speed : -R.speed, 0)
      return R.warn + 40
    }
    case 'rays': {
      // Two rays from the edges that stop short of each other: the gap is where to stand.
      const R = ATTACK.rays
      const cx = W / 2 + randRange(w.rng, -R.shift, R.shift)
      spawnZone(w, 'ray', 0, top, R.w, H - top, R.warn, R.live, (cx - R.gap / 2 - R.w) / R.live, 0)
      spawnZone(w, 'ray', W - R.w, top, R.w, H - top, R.warn, R.live, -(W - cx - R.gap / 2 - R.w) / R.live, 0)
      return R.warn + R.live
    }
    case 'floor':
    case 'floor2': {
      // The dance floor: a checkerboard of squares over the player's part of the field.
      const F = ATTACK.floor
      const y0 = playerTop(w) - 4
      const tw = W / F.cols
      const th = (H - y0) / F.rows
      const parity = (b.b + index) % 2
      for (let c = 0; c < F.cols; c++) {
        for (let r = 0; r < F.rows; r++) {
          if ((c + r) % 2 === parity) spawnZone(w, 'tile', c * tw, y0 + r * th, tw, th, F.warn, F.live)
        }
      }
      return b.attack === 'floor2' && !last ? F.warn - 10 : F.warn + F.live
    }
    case 'glint': {
      const G = ATTACK.glint
      const turn = randRange(w.rng, -0.2, 0.2)
      for (let i = 0; i < G.n; i++) {
        const a = (i / (G.n - 1) - 0.5) * G.fan + turn
        spawnBolt(w, 'bolt', b.x, top, Math.sin(a) * G.speed, Math.cos(a) * G.speed)
      }
      return 34
    }
    // ── Lord Humdinger ──
    case 'ram':
    case 'ram2': {
      const R = ATTACK.ram
      b.a = b.attackT
      b.b = clamp(p.x, R.w / 2 + 2, W - R.w / 2 - 2)
      b.state = 'ram'
      spawnZone(w, 'ram', b.b - R.w / 2, b.homeY, R.w, H - b.homeY, R.warn, R.live)
      return R.warn + R.live + 20
    }
    case 'mines': {
      const M = ATTACK.mines
      for (let i = 0; i < M.n; i++) {
        const x = (i + 0.15 + 0.7 * rand(w.rng)) * W / M.n
        const m = spawnBolt(w, 'mine', x, top, 0, M.fall, M.r)
        if (!m) break
        m.stopAt = randRange(w.rng, playerTop(w), H - 30)
        m.life = (m.stopAt - top) / M.fall + M.sit
      }
      return 70
    }
    case 'hogs': {
      const n = ATTACK.hogs.n + (b.phase >= 2 ? 1 : 0)
      for (let i = 0; i < n; i++) helper(w, clamp(b.x + (i - (n - 1) / 2) * 26, 12, W - 12), top, randRange(w.rng, -0.5, 0.5), 1.7)
      return 70
    }
    // ── Doctor Durant Durant ──
    case 'scale': {
      // A run up or down the keyboard; one key is silent.
      const K = ATTACK.keys
      const cw = W / K.cols
      const up = b.b >= 16
      const skip = b.b % 16
      const col = up ? index : K.cols - 1 - index
      if (col !== skip) spawnZone(w, 'key', col * cw, top, cw, H - top, K.warn, K.live)
      return last ? K.warn + K.live : K.stagger
    }
    case 'chord': {
      // Every key but two; one of the silent ones is always near the player.
      const K = ATTACK.keys
      const cw = W / K.cols
      const near = clamp(Math.floor(p.x / cw) + randInt(w.rng, 5) - 2, 0, K.cols - 1)
      let far = randInt(w.rng, K.cols)
      if (far === near) far = (far + 4) % K.cols
      for (let c = 0; c < K.cols; c++) {
        if (c !== near && c !== far) spawnZone(w, 'key', c * cw, top, cw, H - top, K.chordWarn, K.chordLive)
      }
      return K.chordWarn + K.chordLive
    }
    case 'trill': {
      const K = ATTACK.keys
      const cw = W / K.cols
      for (let c = (b.b + index) % 2; c < K.cols; c += 2) spawnZone(w, 'key', c * cw, top, cw, H - top, K.warn, K.live + 2)
      return last ? K.warn + K.live : K.trillGap
    }
    case 'notes': {
      const N = ATTACK.notes
      for (let i = 0; i < N.n; i++) {
        spawnBolt(w, 'note', (i + 0.5) * W / N.n, top, randRange(w.rng, -0.5, 0.5), N.speed, 3.5)
      }
      return 50
    }
    // ── CAL 9000 ──
    case 'eye':
    case 'eyes': {
      // The lens looks at the ship: the line shows for most of a second, then the shot.
      const E = ATTACK.eye
      spawnAim(w, 'boss', b.x + b.wx, b.y + b.wy + b.whh, p.x, p.y, E.warn, E.speed)
      return last ? E.warn + 30 : E.between
    }
    case 'pods': {
      const n = ATTACK.pods.n + (b.phase >= 2 ? 1 : 0)
      for (let i = 0; i < n; i++) {
        const x = i === 0 ? 30 : i === 1 ? W - 30 : W / 2 + randRange(w.rng, -40, 40)
        helper(w, x, top, x < W / 2 ? 0.35 : -0.35, 1.5)
      }
      return 80
    }
    // ── Dark Fader ──
    case 'sliders': {
      // Faders coming down the desk: a bar across the field with one gap.
      const S = ATTACK.sliders
      const gap = b.phase >= 2 ? S.gap2 : S.gap
      const speed = b.phase >= 2 ? S.speed2 : S.speed
      const lo = gap / 2 + 8
      const hi = W - gap / 2 - 8
      let gx = index === 0
        ? clamp(p.x + randRange(w.rng, -90, 90), lo, hi)
        : b.b + (chance(w.rng, 0.5) ? -1 : 1) * randRange(w.rng, 40, S.shift)
      if (gx < lo) gx = Math.min(hi, b.b + randRange(w.rng, 40, S.shift))
      if (gx > hi) gx = Math.max(lo, b.b - randRange(w.rng, 40, S.shift))
      b.b = gx
      const live = (H - top) / speed + 12
      spawnZone(w, 'wall', 0, top, gx - gap / 2, S.h, S.warn, live, 0, speed)
      spawnZone(w, 'wall', gx + gap / 2, top, W - gx - gap / 2, S.h, S.warn, live, 0, speed)
      return last ? 120 : S.between
    }
    case 'choke': {
      const C = ATTACK.choke
      spawnAim(w, 'boss', b.x, top, p.x, p.y, C.warn, C.speed, -1, C.burst - 1)
      return C.warn + 50
    }
    case 'treble': {
      const T = ATTACK.treble
      const turn = rand(w.rng) * Math.PI * 2
      for (let i = 0; i < T.n; i++) {
        const a = turn + i * Math.PI * 2 / T.n
        if (Math.sin(a) > -0.3) spawnBolt(w, 'ring', b.x, b.y, Math.cos(a) * T.speed, Math.sin(a) * T.speed)
      }
      return 70
    }
    // ── The Deaf Star ──
    case 'rings': {
      // A ring of bass with a piece missing, somewhere below.
      const R = ATTACK.rings
      const hole = Math.PI / 2 + randRange(w.rng, -0.9, 0.9)
      const half = R.gap * Math.PI / R.n
      for (let i = 0; i < R.n; i++) {
        const a = i * Math.PI * 2 / R.n
        if (Math.sin(a) < 0.05) continue
        let off = Math.abs(a - hole)
        if (off > Math.PI) off = Math.PI * 2 - off
        if (off > half) spawnBolt(w, 'ring', b.x, b.y + 16, Math.cos(a) * R.speed, Math.sin(a) * R.speed)
      }
      return last ? 80 : R.between
    }
    case 'note': {
      // The one note: a column where the ship is, shown for more than a second first.
      const N = ATTACK.note
      const nw = b.phase >= 3 ? N.w3 : N.w
      spawnZone(w, 'note', clamp(p.x - nw / 2, 0, W - nw), top, nw, H - top, N.warn, N.live)
      return N.warn + N.live
    }
    case 'static': {
      const n = ATTACK.static.n
      for (let i = 0; i < n; i++) helper(w, (i + 0.5) * W / n + randRange(w.rng, -20, 20), top, 0, 1.5)
      return 80
    }
    case 'squeeze': {
      // The walls of the cabinet close in; the rings that follow have less room.
      const S = ATTACK.squeeze
      spawnZone(w, 'squeeze', 0, top, S.w, H - top, S.warn, S.live)
      spawnZone(w, 'squeeze', W - S.w, top, S.w, H - top, S.warn, S.live)
      return 40
    }
  }
  return 30
}
