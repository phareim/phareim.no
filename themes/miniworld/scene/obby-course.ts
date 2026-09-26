/**
 * Obby-himmelen's three courses as pure data (2026-09-26), so the node test
 * can check every jump against the controller (tests/miniworld-obby).
 *
 * A course is built by walking a cursor through the sky: each platform is
 * placed a gap and a height step after the last one, along the current
 * heading (±x/±z, so everything stays an axis-aligned box). Every such
 * step is recorded as a jump the player must make.
 *
 *   Lett       wide blocks, small gaps, stairs, a trampoline, three checkpoints
 *   Middels    narrower, sliding platforms, a lift, kill bricks, a spinner
 *   Vanskelig  a real Roblox obby: beams, fast movers, double spinners, long gaps
 */
import type { ObbyLevel } from '../types'

export type PlatKind = 'start' | 'solid' | 'bounce' | 'kill' | 'check' | 'finish'

export interface Plat {
  /** Centre of the top face. */
  x: number; y: number; z: number
  sx: number; sz: number
  /** Thickness below the top. */
  sy: number
  kind: PlatKind
  color: string
  /** Moving: offset = a * sin(2πt/period + phase). */
  move?: { ax: number; ay: number; az: number; period: number; phase: number }
  bounce?: number
  /** Checkpoint number (1…), on 'check' platforms. */
  check?: number
}

export interface SpinSpec { x: number; z: number; y0: number; y1: number; len: number; half: number; speed: number; angle: number }

export interface Jump { from: number; to: number }

export interface ObbyCourse {
  level: ObbyLevel
  plats: Plat[]
  spinners: SpinSpec[]
  jumps: Jump[]
  /** Respawn spots: index 0 is the start, then each checkpoint in order. */
  checkpoints: { x: number; y: number; z: number; yaw: number }[]
  finish: number
  killY: number
}

const SECTION_COLORS = ['#ff8ac8', '#ffd84f', '#7fe0a0', '#8fd8ff', '#b89aff', '#ff9f3f']

type Dir = 0 | 1 | 2 | 3 // -z, +x, +z, -x
const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0]

class Builder {
  plats: Plat[] = []
  spinners: SpinSpec[] = []
  jumps: Jump[] = []
  checkpoints: ObbyCourse['checkpoints'] = []
  dir: Dir = 0
  section = 0
  last = -1

  get color() { return SECTION_COLORS[this.section % SECTION_COLORS.length]! }

  add(p: Plat, jumpFrom = true): number {
    this.plats.push(p)
    const i = this.plats.length - 1
    if (jumpFrom && this.last >= 0) this.jumps.push({ from: this.last, to: i })
    this.last = i
    return i
  }

  /** Half extent of platform i along the heading. */
  half(i: number, d = this.dir) {
    const p = this.plats[i]!
    return d % 2 === 0 ? p.sz / 2 : p.sx / 2
  }

  /**
   * Next platform: `gap` edge to edge along the heading, `dh` up, `len` long
   * (along the heading) and `wide` across, shifted `side` to the right.
   */
  next(gap: number, dh: number, len: number, wide: number, o: Partial<Plat> & { side?: number; slide?: [number, number] } = {}): number {
    const prev = this.plats[this.last]!
    const d = this.dir
    if (o.slide) {
      // Slide across the heading: amplitude, period.
      const [amp, period] = o.slide
      o.move = { ax: -DZ[d]! * amp, ay: 0, az: DX[d]! * amp, period, phase: o.move?.phase ?? 0 }
    }
    const along = this.half(this.last) + gap + len / 2
    const rx = -DZ[d]!, rz = DX[d]!
    const side = o.side ?? 0
    const sx = d % 2 === 0 ? wide : len
    const sz = d % 2 === 0 ? len : wide
    return this.add({
      x: prev.x + DX[d]! * along + rx * side,
      y: prev.y + dh,
      z: prev.z + DZ[d]! * along + rz * side,
      sx, sz, sy: o.sy ?? 1, kind: o.kind ?? 'solid', color: o.color ?? this.color,
      move: o.move, bounce: o.bounce, check: o.check,
    })
  }

  turn(right: boolean) { this.dir = ((this.dir + (right ? 1 : 3)) % 4) as Dir }

  check(gap: number, dh = 0, size = 6) {
    this.section++
    const n = this.checkpoints.length
    const i = this.next(gap, dh, size, size, { kind: 'check', color: '#fff8fc', check: n })
    const p = this.plats[i]!
    this.checkpoints.push({ x: p.x, y: p.y, z: p.z, yaw: yawOf(this.dir) })
    return i
  }

  /** A long platform with kill strips across it: safe pieces joined by jumps over the strips. */
  killRun(gap: number, pieces: number, safeLen: number, killLen: number, wide: number) {
    for (let k = 0; k < pieces; k++) {
      this.next(k === 0 ? gap : killLen, 0, safeLen, wide)
      if (k < pieces - 1) {
        // The strip itself: flush between the safe pieces, a touch lower so it reads as a trench.
        const a = this.plats[this.last]!
        const d = this.dir
        const along = this.half(this.last) + killLen / 2
        this.plats.push({
          x: a.x + DX[d]! * along, y: a.y - 0.15, z: a.z + DZ[d]! * along,
          sx: d % 2 === 0 ? wide : killLen, sz: d % 2 === 0 ? killLen : wide, sy: 0.85, kind: 'kill', color: '#ff3b3b',
        })
      }
    }
  }

  spinner(size: number, gap: number, dh: number, arms: number, speed: number, barTop: number) {
    const i = this.next(gap, dh, size, size)
    const p = this.plats[i]!
    for (let a = 0; a < arms; a++) {
      this.spinners.push({ x: p.x, z: p.z, y0: p.y, y1: p.y + barTop, len: size / 2 - 0.2, half: 0.22, speed, angle: (a * Math.PI) / arms })
    }
    return i
  }
}

function yawOf(d: Dir): number {
  // Facing along the heading; the runtime's facing 0 is +z.
  return Math.atan2(DX[d]!, DZ[d]!)
}

export function obbyCourse(level: ObbyLevel): ObbyCourse {
  const b = new Builder()
  b.add({ x: 0, y: 0, z: 0, sx: 10, sz: 10, sy: 1.5, kind: 'start', color: '#c8b0ff' }, false)
  b.checkpoints.push({ x: 0, y: 0, z: 2.5, yaw: Math.PI })

  if (level === 'easy') {
    // Stairs up.
    b.next(1.2, 0.5, 4, 5); b.next(1.2, 0.5, 4, 5); b.next(1.4, 0.5, 4, 5)
    b.check(1.5, 0)
    // Zigzag stepping stones.
    b.next(1.8, 0, 3.5, 3.5, { side: -1.5 }); b.next(1.8, 0, 3.5, 3.5, { side: 3 }); b.next(1.8, 0, 3.5, 3.5, { side: -3 }); b.next(1.8, 0, 3.5, 3.5, { side: 1.5 })
    b.turn(true)
    // A trampoline up to a high meadow.
    b.next(1.5, 0, 4, 4, { kind: 'bounce', bounce: 19, color: '#4fb8ff' })
    b.next(1.0, 3.0, 5, 6)
    b.check(1.5, 0)
    // A bridge of little blocks, then steps down.
    b.next(2.0, 0, 3, 3); b.next(2.0, 0, 3, 3); b.next(2.0, 0.5, 3, 3); b.next(2.0, 0, 3, 3)
    b.turn(false)
    b.next(1.5, -1, 4, 4); b.next(1.5, -1, 4, 4)
    b.check(1.5, 0)
    b.next(2.2, 0.5, 3.5, 3.5); b.next(2.2, 0.5, 3.5, 3.5); b.next(2.4, 0, 3.5, 3.5, { side: 1 })
    b.next(2.0, 0, 8, 8, { kind: 'finish', color: '#ffd23f' })
  } else if (level === 'medium') {
    b.next(2.4, 0.8, 3, 3); b.next(2.6, 0.8, 3, 3); b.next(2.8, 0, 2.6, 2.6, { side: 1.5 })
    b.check(2.4)
    // Sliding platforms (side to side).
    b.next(2.6, 0, 3, 3, { slide: [3, 4.5] })
    b.next(2.6, 0, 3, 3, { slide: [-3, 4.5], move: { ax: 0, ay: 0, az: 0, period: 1, phase: 1.5 } })
    b.next(2.6, 0.6, 3, 3)
    b.check(2.4)
    // Kill bricks: jump the red strips.
    b.killRun(2.4, 4, 2.6, 1.6, 3)
    b.turn(true)
    b.next(2.6, 0.8, 2.6, 2.6); b.next(2.8, 0.8, 2.6, 2.6)
    b.check(2.4)
    // A spinner, then a lift up to a trampoline.
    b.spinner(8, 2.4, 0, 1, 1.3, 0.7)
    b.next(2.4, 0, 3, 3, { move: { ax: 0, ay: 3, az: 0, period: 5, phase: -Math.PI / 2 } })
    b.next(2.2, 3.4, 3.5, 3.5)
    b.next(2.4, 0, 3, 3, { kind: 'bounce', bounce: 20, color: '#4fb8ff' })
    b.next(1.2, 3.2, 4, 4)
    b.check(2.4)
    b.turn(false)
    b.next(3.0, 0, 2.4, 2.4, { side: -1.5 }); b.next(3.0, 0.6, 2.4, 2.4, { side: 3 }); b.next(3.0, 0, 2.4, 2.4, { side: -1.5 })
    b.next(2.6, 0, 8, 8, { kind: 'finish', color: '#ffd23f' })
  } else {
    // Beams and long gaps.
    b.next(3.4, 1, 2, 2); b.next(3.6, 1, 2, 2); b.next(3.8, 0, 1.6, 1.6, { side: -2 }); b.next(4.0, 0, 1.6, 1.6, { side: 2 })
    b.check(3.4)
    // A narrow beam walk with kill bricks.
    b.killRun(3.0, 5, 2.2, 2.2, 1.6)
    b.turn(true)
    // Fast sliders.
    b.next(3.2, 0, 2.2, 2.2, { slide: [4, 3] })
    b.next(3.2, 0, 2.2, 2.2)
    b.turn(false)
    b.next(3.2, 0, 2.2, 2.2, { slide: [-4, 2.6] })
    b.next(3.0, 0, 2.2, 2.2, { slide: [4, 2.6], move: { ax: 0, ay: 0, az: 0, period: 1, phase: 1 } })
    b.check(3.0)
    // Double spinner, then stairs of tiny blocks up.
    b.spinner(9, 3.0, 0, 2, 1.8, 0.8)
    b.next(3.2, 1.2, 1.6, 1.6); b.next(3.2, 1.2, 1.6, 1.6)
    b.check(3.0, 0, 5)
    b.next(3.0, 1.4, 1.6, 1.6); b.next(3.0, 1.4, 1.6, 1.6)
    b.check(3.0)
    // A lift over a gap, then a trampoline to a floating island.
    b.next(3.0, 0, 2.2, 2.2, { move: { ax: 0, ay: 4, az: 0, period: 4, phase: -Math.PI / 2 } })
    b.next(3.0, 4.2, 2, 2)
    b.turn(true)
    b.next(3.4, 0, 2, 2, { kind: 'bounce', bounce: 22, color: '#4fb8ff' })
    b.next(1.8, 4.4, 2.4, 2.4)
    b.next(4.2, -1, 1.6, 1.6); b.next(4.2, -1, 1.4, 1.4); b.next(4.0, 0, 1.4, 1.4, { side: 2 })
    b.check(3.2)
    // The last stretch: a spinner on a beam's end, and the finish.
    b.spinner(7, 3.2, 0.5, 1, 2.4, 0.9)
    b.next(3.8, 0.8, 1.6, 1.6); b.next(4.0, 0.8, 1.6, 1.6)
    b.next(3.4, 0, 8, 8, { kind: 'finish', color: '#ffd23f' })
  }
  const finish = b.plats.findIndex(p => p.kind === 'finish')
  const minY = Math.min(...b.plats.map(p => p.y - (p.move ? Math.abs(p.move.ay) : 0)))
  return { level, plats: b.plats, spinners: b.spinners, jumps: b.jumps, checkpoints: b.checkpoints, finish, killY: minY - 18 }
}

/** Offset of a moving platform at time t (the runtime and the test share it). */
export function moveOffset(p: Plat, t: number): [number, number, number] {
  if (!p.move) return [0, 0, 0]
  const s = Math.sin((2 * Math.PI * t) / p.move.period + p.move.phase)
  return [p.move.ax * s, p.move.ay * s, p.move.az * s]
}

export const OBBY_NAMES: Record<ObbyLevel, string> = { easy: 'LETT', medium: 'MIDDELS', hard: 'VANSKELIG' }
