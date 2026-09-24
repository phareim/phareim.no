/**
 * Galaga's source art (2026-09-23, pixelized since 2026-09-24): every
 * enemy, the player ship and the Cantor as vector painters. They are not
 * drawn to the screen directly: `pixel.ts` renders them at the pixel
 * stage's logical size and snaps them to Neon Shrine's palette.
 *
 * Enemies face +y (down, toward the player). Kinds that turn along their
 * path are pixelized at 16 headings. Each enemy has two frames (wing beat
 * / legs, swapped on steps like an arcade sprite).
 */
import type { EnemyKind } from './balance'

const PINK = '#ff2fa0'
const PINK_L = '#ff70bc'
const GOLD = '#ffd23f'
const INK = '#f2e9ff'
const HULL_D = '#1c0f38'
const HULL_D2 = '#2a1450'

type G = CanvasRenderingContext2D
type Painter = (g: G, s: number, frame: number) => void

function poly(g: G, pts: number[][], s: number): void {
  g.beginPath()
  pts.forEach(([x, y], i) => (i ? g.lineTo(x! * s, y! * s) : g.moveTo(x! * s, y! * s)))
  g.closePath()
}

function mirror(g: G, fn: (side: 1 | -1) => void): void {
  for (const side of [-1, 1] as const) {
    g.save()
    g.scale(side, 1)
    fn(side)
    g.restore()
  }
}

function eyes(g: G, s: number, y: number, dx: number, r: number): void {
  g.fillStyle = INK
  g.beginPath()
  g.arc(-dx * s, y * s, r * s, 0, Math.PI * 2)
  g.arc(dx * s, y * s, r * s, 0, Math.PI * 2)
  g.fill()
}

// ------------------------------------------------------------------ enemies

const scout: Painter = (g, s, f) => {
  g.lineWidth = 1.4
  // Wings beat: open on frame 0, folded on frame 1.
  mirror(g, () => {
    g.save()
    g.translate(0.24 * s, -0.06 * s)
    g.rotate(f ? -0.2 : -0.55)
    g.beginPath()
    g.ellipse(0.1 * s, 0, 0.24 * s, (f ? 0.09 : 0.15) * s, 0, 0, Math.PI * 2)
    g.fillStyle = 'rgba(42,20,80,0.85)'
    g.fill()
    g.strokeStyle = PINK_L
    g.stroke()
    g.restore()
  })
  // Striped abdomen, head toward the player.
  g.beginPath()
  g.ellipse(0, -0.02 * s, 0.15 * s, 0.28 * s, 0, 0, Math.PI * 2)
  g.fillStyle = PINK
  g.fill()
  g.strokeStyle = HULL_D
  g.lineWidth = 1.6
  for (const y of [-0.16, -0.04, 0.08]) {
    g.beginPath()
    g.moveTo(-0.13 * s, y * s)
    g.quadraticCurveTo(0, (y + 0.05) * s, 0.13 * s, y * s)
    g.stroke()
  }
  g.beginPath()
  g.arc(0, 0.3 * s, 0.13 * s, 0, Math.PI * 2)
  g.fillStyle = PINK_L
  g.fill()
  eyes(g, s, 0.33, 0.055, 0.035)
  g.strokeStyle = PINK_L
  g.lineWidth = 1.2
  mirror(g, () => {
    g.beginPath()
    g.moveTo(0.05 * s, 0.4 * s)
    g.quadraticCurveTo(0.08 * s, 0.5 * s, 0.17 * s, 0.5 * s)
    g.stroke()
  })
}

const squadron: Painter = (g, s, f) => {
  const open = f ? 0.8 : 1
  g.lineWidth = 1.4
  mirror(g, () => {
    // Big fore-wing and small hind-wing, butterfly-cut.
    poly(g, [[0.05, 0.05], [0.44 * open, 0.3], [0.48 * open, 0.02], [0.3 * open, -0.2], [0.06, -0.08]], s)
    g.fillStyle = HULL_D2
    g.fill()
    g.strokeStyle = PINK
    g.stroke()
    poly(g, [[0.05, -0.1], [0.3 * open, -0.22], [0.26 * open, -0.44], [0.06, -0.3]], s)
    g.fillStyle = HULL_D
    g.fill()
    g.stroke()
    g.strokeStyle = PINK_L
    g.beginPath()
    g.moveTo(0.12 * s, 0.02 * s)
    g.lineTo(0.36 * open * s, 0.14 * s)
    g.moveTo(0.14 * s, -0.04 * s)
    g.lineTo(0.3 * open * s, -0.08 * s)
    g.stroke()
    g.fillStyle = GOLD
    g.fillRect(0.4 * open * s - 1.5, 0.18 * s - 1.5, 3, 3)
  })
  g.beginPath()
  g.ellipse(0, 0, 0.07 * s, 0.34 * s, 0, 0, Math.PI * 2)
  g.fillStyle = PINK
  g.fill()
  eyes(g, s, 0.27, 0.03, 0.025)
}

const heavy: Painter = (g, s, f) => {
  // Legs scuttle between frames.
  g.strokeStyle = PINK_L
  g.lineWidth = 1.6
  mirror(g, () => {
    for (let i = 0; i < 3; i++) {
      const y = (-0.18 + i * 0.17) * s
      const kick = (f + i) % 2 ? 0.06 : -0.04
      g.beginPath()
      g.moveTo(0.3 * s, y)
      g.lineTo(0.46 * s, y + kick * s)
      g.lineTo(0.5 * s, y + (kick + 0.08) * s)
      g.stroke()
    }
  })
  // Mandibles.
  g.fillStyle = PINK
  mirror(g, () => {
    g.beginPath()
    g.moveTo(0.06 * s, 0.34 * s)
    g.quadraticCurveTo(0.2 * s, 0.44 * s, 0.1 * s, 0.52 * s)
    g.lineTo(0.05 * s, 0.42 * s)
    g.closePath()
    g.fill()
  })
  // Shell with three armour plates and a seam.
  g.beginPath()
  g.ellipse(0, -0.02 * s, 0.33 * s, 0.4 * s, 0, 0, Math.PI * 2)
  g.fillStyle = HULL_D
  g.fill()
  g.lineWidth = 2
  g.strokeStyle = PINK
  g.stroke()
  g.lineWidth = 1.2
  g.strokeStyle = PINK_L
  for (const y of [-0.22, -0.02, 0.18]) {
    g.beginPath()
    g.ellipse(0, y * s, 0.27 * s, 0.1 * s, 0, Math.PI * 0.05, Math.PI * 0.95)
    g.stroke()
  }
  g.beginPath()
  g.moveTo(0, -0.4 * s)
  g.lineTo(0, 0.3 * s)
  g.stroke()
  g.beginPath()
  g.ellipse(0, 0.32 * s, 0.14 * s, 0.08 * s, 0, 0, Math.PI * 2)
  g.fillStyle = PINK
  g.fill()
  eyes(g, s, 0.33, 0.06, 0.028)
}

const diver: Painter = (g, s, f) => {
  g.lineWidth = 1.5
  poly(g, [[0, 0.5], [0.34, -0.18], [0.13, -0.08], [0, -0.42], [-0.13, -0.08], [-0.34, -0.18]], s)
  g.fillStyle = HULL_D
  g.fill()
  g.strokeStyle = PINK
  g.stroke()
  poly(g, [[0, 0.38], [0.08, 0], [0, -0.26], [-0.08, 0]], s)
  g.fillStyle = PINK
  g.fill()
  // Exhaust flicker at the tail.
  g.fillStyle = f ? INK : PINK_L
  g.beginPath()
  g.arc(0, -0.44 * s, (f ? 0.07 : 0.05) * s, 0, Math.PI * 2)
  g.fill()
}

const weaver: Painter = (g, s, f) => {
  const tip = f ? 0.1 : -0.06
  g.lineWidth = 1.5
  g.beginPath()
  g.moveTo(0, 0.34 * s)
  g.quadraticCurveTo(0.22 * s, 0.26 * s, 0.5 * s, tip * s)
  g.quadraticCurveTo(0.3 * s, -0.02 * s, 0.1 * s, -0.22 * s)
  g.lineTo(0, -0.5 * s)
  g.lineTo(-0.1 * s, -0.22 * s)
  g.quadraticCurveTo(-0.3 * s, -0.02 * s, -0.5 * s, tip * s)
  g.quadraticCurveTo(-0.22 * s, 0.26 * s, 0, 0.34 * s)
  g.fillStyle = HULL_D2
  g.fill()
  g.strokeStyle = PINK
  g.stroke()
  g.strokeStyle = PINK_L
  g.lineWidth = 1
  mirror(g, () => {
    g.beginPath()
    g.moveTo(0.08 * s, 0.18 * s)
    g.quadraticCurveTo(0.24 * s, 0.12 * s, 0.38 * s, tip * 0.6 * s)
    g.stroke()
  })
  g.beginPath()
  g.ellipse(0, 0.12 * s, 0.08 * s, 0.14 * s, 0, 0, Math.PI * 2)
  g.fillStyle = PINK
  g.fill()
  eyes(g, s, 0.22, 0.045, 0.028)
}

const sniper: Painter = (g, s, f) => {
  g.lineWidth = 1.5
  // Barrel toward the player.
  g.fillStyle = PINK_L
  g.fillRect(-0.05 * s, 0.26 * s, 0.1 * s, 0.3 * s)
  g.fillStyle = INK
  g.fillRect(-0.05 * s, 0.52 * s, 0.1 * s, 0.05 * s)
  mirror(g, () => {
    poly(g, [[0.3, -0.1], [0.5, -0.24], [0.44, 0.08], [0.3, 0.12]], s)
    g.fillStyle = HULL_D
    g.fill()
    g.strokeStyle = PINK
    g.stroke()
  })
  g.beginPath()
  g.arc(0, 0, 0.34 * s, 0, Math.PI * 2)
  g.fillStyle = HULL_D
  g.fill()
  g.strokeStyle = PINK
  g.stroke()
  g.beginPath()
  g.arc(0, 0.04 * s, 0.17 * s, 0, Math.PI * 2)
  g.fillStyle = PINK
  g.fill()
  g.beginPath()
  g.arc(0, 0.07 * s, 0.07 * s, 0, Math.PI * 2)
  g.fillStyle = '#0b0616'
  g.fill()
  // Lens glint.
  g.fillStyle = INK
  g.beginPath()
  g.arc((f ? -0.07 : -0.05) * s, -0.03 * s, 0.035 * s, 0, Math.PI * 2)
  g.fill()
}

const splitter: Painter = (g, s, f) => {
  g.beginPath()
  g.ellipse(0, 0, 0.34 * s, 0.42 * s, 0, 0, Math.PI * 2)
  g.fillStyle = HULL_D
  g.fill()
  g.lineWidth = 1.8
  g.strokeStyle = PINK_L
  g.stroke()
  // Two mites curled inside, visible through the membrane.
  g.globalAlpha = f ? 0.9 : 0.6
  g.fillStyle = PINK
  for (const dx of [-0.13, 0.13]) {
    g.beginPath()
    g.arc(dx * s, 0.02 * s, 0.1 * s, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  eyes(g, s, 0.03, 0.13, 0.025)
  // The seam it splits along.
  g.strokeStyle = f ? INK : PINK
  g.lineWidth = 1.4
  g.beginPath()
  g.moveTo(0, -0.42 * s)
  for (let i = 1; i <= 6; i++) g.lineTo((i % 2 ? 0.05 : -0.05) * s, (-0.42 + i * 0.14) * s)
  g.stroke()
}

const mite: Painter = (g, s, f) => {
  g.strokeStyle = PINK_L
  g.lineWidth = 1.3
  mirror(g, () => {
    for (let i = 0; i < 3; i++) {
      const y = (-0.15 + i * 0.15) * s
      g.beginPath()
      g.moveTo(0.18 * s, y)
      g.lineTo(0.44 * s, y + ((f + i) % 2 ? 0.12 : -0.06) * s)
      g.stroke()
    }
  })
  g.beginPath()
  g.arc(0, 0, 0.26 * s, 0, Math.PI * 2)
  g.fillStyle = PINK
  g.fill()
  eyes(g, s, 0.1, 0.09, 0.05)
}

const bulwark: Painter = (g, s, f) => {
  const hex = (r: number) => {
    g.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i + Math.PI / 6
      const x = Math.cos(a) * r * s, y = Math.sin(a) * r * s
      i ? g.lineTo(x, y) : g.moveTo(x, y)
    }
    g.closePath()
  }
  // Three gun barrels toward the player.
  g.fillStyle = PINK_L
  for (const dx of [-0.2, 0, 0.2]) g.fillRect((dx - 0.04) * s, 0.3 * s, 0.08 * s, 0.22 * s)
  hex(0.46)
  g.fillStyle = HULL_D
  g.fill()
  g.lineWidth = 2.2
  g.strokeStyle = PINK
  g.stroke()
  hex(0.3)
  g.fillStyle = HULL_D2
  g.fill()
  g.lineWidth = 1.2
  g.strokeStyle = PINK_L
  g.stroke()
  g.beginPath()
  g.arc(0, 0, 0.13 * s, 0, Math.PI * 2)
  g.fillStyle = f ? PINK_L : PINK
  g.fill()
  g.fillStyle = INK
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i + Math.PI / 6
    g.fillRect(Math.cos(a) * 0.38 * s - 1.2, Math.sin(a) * 0.38 * s - 1.2, 2.4, 2.4)
  }
}

const stinger: Painter = (g, s, f) => {
  g.lineWidth = 1.2
  mirror(g, () => {
    g.save()
    g.translate(0.08 * s, -0.12 * s)
    g.rotate(f ? -0.9 : -0.5)
    g.beginPath()
    g.ellipse(0.2 * s, 0, 0.22 * s, 0.07 * s, 0, 0, Math.PI * 2)
    g.fillStyle = 'rgba(242,233,255,0.18)'
    g.fill()
    g.strokeStyle = PINK_L
    g.stroke()
    g.restore()
  })
  // Head at the back, striped abdomen and sting pointing the way it flies.
  g.beginPath()
  g.arc(0, -0.3 * s, 0.11 * s, 0, Math.PI * 2)
  g.fillStyle = PINK_L
  g.fill()
  g.beginPath()
  g.ellipse(0, -0.12 * s, 0.1 * s, 0.1 * s, 0, 0, Math.PI * 2)
  g.fillStyle = PINK
  g.fill()
  g.beginPath()
  g.ellipse(0, 0.16 * s, 0.13 * s, 0.22 * s, 0, 0, Math.PI * 2)
  g.fillStyle = PINK
  g.fill()
  g.strokeStyle = HULL_D
  g.lineWidth = 1.8
  for (const y of [0.06, 0.18, 0.3]) {
    g.beginPath()
    g.moveTo(-0.12 * s, y * s)
    g.lineTo(0.12 * s, y * s)
    g.stroke()
  }
  poly(g, [[-0.04, 0.36], [0.04, 0.36], [0, 0.52]], s)
  g.fillStyle = INK
  g.fill()
}

export const PAINTERS: Record<EnemyKind, Painter> = {
  scout, squadron, heavy, diver, weaver, sniper, splitter, mite, bulwark, stinger,
}

/** Size in px each kind is drawn at (matches the spawn sizes). */
export const ENEMY_SIZE: Record<EnemyKind, number> = {
  scout: 28, squadron: 32, heavy: 52, diver: 26, weaver: 30,
  sniper: 26, splitter: 40, mite: 18, bulwark: 56, stinger: 26,
}

/** Kinds drawn rotated along their flight path. */
export const TURNING_KINDS = new Set<EnemyKind>(['squadron', 'stinger', 'diver', 'mite'])

// ------------------------------------------------------------------ player

export interface ShipLook {
  variant: 'dart' | 'vandal'
  colors: { hull: string; trim: string; glow: string; cockpit: string }
}

/** The player ship at a bank step (-2 … 2, negative = rolling left). */
export function paintShip(look: ShipLook, bank: number): (g: G) => void {
  const wide = look.variant === 'vandal'
  const { hull, trim, cockpit } = look.colors
  return g => {
    g.scale(1 - Math.abs(bank) * 0.08, 1)
    const span = wide ? 27 : 22
    const lift = bank * 1.8
    g.lineWidth = 1.4
    // Wings: the one on the outside of the turn rises.
    for (const side of [-1, 1]) {
      const t = side * lift
      g.beginPath()
      g.moveTo(side * 5, -3)
      g.lineTo(side * span, 9 - t)
      g.lineTo(side * span, 15 - t)
      g.lineTo(side * 6, 12)
      g.closePath()
      g.fillStyle = 'rgba(11,6,22,0.92)'
      g.fill()
      g.strokeStyle = hull
      g.stroke()
      g.beginPath()
      g.moveTo(side * 7, 2)
      g.lineTo(side * (span - 3), 11 - t)
      g.strokeStyle = trim
      g.globalAlpha = 0.8
      g.stroke()
      g.globalAlpha = 1
      if (wide) {
        g.fillStyle = trim
        g.fillRect(side * (span - 7) - 1.5, 12 - t, 3, 4)
      }
      // Gold wing tips (the one gold note on the player).
      g.fillStyle = GOLD
      g.fillRect(side * span - (side > 0 ? 2 : 0), 9 - t, 2, 6)
    }
    // Fuselage.
    g.beginPath()
    g.moveTo(0, -21)
    g.lineTo(5, -9)
    g.lineTo(6.5, 8)
    g.lineTo(3.5, 15)
    g.lineTo(-3.5, 15)
    g.lineTo(-6.5, 8)
    g.lineTo(-5, -9)
    g.closePath()
    g.fillStyle = hull
    g.fill()
    g.strokeStyle = '#0b0616'
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(-4.5, 4)
    g.lineTo(4.5, 4)
    g.moveTo(-5, 9)
    g.lineTo(5, 9)
    g.stroke()
    // Canopy.
    g.beginPath()
    g.ellipse(bank * 0.4, -7, 2.6, 5.5, 0, 0, Math.PI * 2)
    g.fillStyle = '#0b0616'
    g.fill()
    g.beginPath()
    g.ellipse(bank * 0.4 - 0.6, -8.5, 1.1, 2.4, 0, 0, Math.PI * 2)
    g.fillStyle = cockpit
    g.fill()
    // Nozzles.
    g.fillStyle = '#0b0616'
    g.fillRect(-4, 14, 3, 3)
    g.fillRect(1, 14, 3, 3)
  }
}

// ------------------------------------------------------------------ boss

/** The Cantor: twin armoured wings, engine pods, a recessed reactor. */
export function paintBoss(size: number, color: string): (g: G) => void {
  return g => {
    g.scale(size, size)
    g.lineWidth = 1.4 / size
    g.lineJoin = 'round'
    const panel = (points: number[][], fill = '#23102e') => {
      g.beginPath()
      points.forEach(([x, y], i) => (i ? g.lineTo(x!, y!) : g.moveTo(x!, y!)))
      g.closePath()
      g.fillStyle = fill
      g.fill()
      g.strokeStyle = color
      g.stroke()
    }
    for (const side of [-1, 1]) {
      g.save()
      g.scale(side, 1)
      panel([[.08, -.28], [.3, -.4], [.56, -.12], [.53, .27], [.35, .38], [.19, .08]])
      panel([[.22, -.23], [.33, -.29], [.46, -.08], [.41, .19], [.28, .1]], '#13091f')
      for (const x of [.26, .43]) {
        panel([[x - .035, -.27], [x + .035, -.27], [x + .04, -.43], [x - .04, -.43]])
        g.fillStyle = PINK_L
        g.fillRect(x - .023, -.47, .046, .04)
      }
      panel([[.3, .12], [.41, .12], [.41, .38], [.3, .38]], '#120826')
      g.fillStyle = PINK_L
      g.fillRect(.32, .32, .07, .05)
      g.strokeStyle = color
      for (let i = 0; i < 3; i++) {
        g.beginPath()
        g.moveTo(.24 + i * .07, -.13)
        g.lineTo(.28 + i * .06, -.02)
        g.stroke()
      }
      // Wing-edge running lights.
      g.fillStyle = INK
      g.fillRect(.52, .0, .012, .012)
      g.fillRect(.5, .18, .012, .012)
      g.restore()
    }
    panel([[0, -.4], [.2, -.17], [.15, .23], [0, .4], [-.15, .23], [-.2, -.17]], '#301037')
    panel([[0, -.21], [.085, -.08], [.065, .1], [0, .17], [-.065, .1], [-.085, -.08]], '#13091f')
    g.strokeStyle = PINK_L
    g.beginPath()
    g.moveTo(0, -.36)
    g.lineTo(0, -.24)
    g.moveTo(0, .2)
    g.lineTo(0, .33)
    g.stroke()
  }
}
