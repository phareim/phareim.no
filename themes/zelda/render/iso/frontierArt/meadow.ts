import type { Pick, Solids } from '../props'
import { letters } from './roadside'

type Thing = (solids: Solids) => void

function mill(frame: number): Thing {
  return b => {
    b.box(-11, -10, 0, 11, 10, 5, 'carve')
    for (let i = 0; i < 4; i++) {
      const w = 10.3 - i * 0.85
      const z = 5 + i * 9
      b.box(-w, -w, z, w, w, z + 10, (x, _y, h, _nx, ny) => {
        if (ny > 0.5 && Math.abs(x) < 2.8 && h > 24 && h < 30) return 'gold'
        if (ny > 0.5 && Math.abs(x + 2) < 3 && h < 13) return 'dark'
        return Math.floor(h) % 6 === 0 ? 'chestWood' : 'wood'
      })
    }
    b.ball(0, 0, 42, 9, 9, 5, 'shrine')
    b.box(-2.7, 6.9, 31.5, 2.7, 12.7, 37, 'pole')
    for (let j = 0; j < 4; j++) {
      const a = Math.PI * (j / 2 + frame / 8)
      const u = Math.cos(a)
      const v = Math.sin(a)
      for (let n = 0; n <= 17; n++) {
        const x = u * n
        const z = 34.2 + v * n
        b.ball(x, 12.7, z, 0.8, 0.6, 0.8, 'chestWood')
        if (n >= 5) for (let q = 1; q <= 4; q++) {
          b.ball(x - v * q, 12.8, z + u * q, 0.73, 0.48, 0.73, q === 4 ? 'sand' : 'chrome')
        }
      }
    }
    b.ball(0, 13.45, 34.2, 2.4, 1.5, 2.4, 'gold')
  }
}

const waystone: Thing = b => {
  b.ball(0, 0, 1.1, 8, 6, 2.1, 'carve')
  b.box(-6.1, -3.1, 0, 6.1, 3.1, 20, (x, _y, z, _nx, ny) => {
    if (ny > 0.5 && z > 8 && z < 17 && (Math.abs(x) < 0.8 || Math.abs(z - 16 + Math.abs(x) * 1.2) < 0.75)) return 'glassCyan'
    return Math.floor(x * 3 + z * 7) % 11 === 0 ? 'carve' : 'stone'
  })
  b.ball(0, 0, 20, 6.2, 3.2, 3, 'rock')
}

function hay(size: number): Thing {
  const straw: Pick = (x, y, z) => {
    const streak = Math.floor(x * 0.8 + y * 2.3 + z * 0.64) & 7
    return streak === 1 ? 'chestWood' : streak < 4 ? 'clay' : 'sand'
  }
  return b => {
    b.ball(0, 0, 4 * size, 6 * size, 5 * size, 4 * size, straw)
    b.ball(-0.85, -0.55, 7.1 * size, 4.5 * size, 4.1 * size, 4.3 * size, straw)
    b.box(-4.6 * size, -0.8, 1, 4.6 * size, 0.6, 2.2, 'chestWood')
    b.ball(0.25, 0, 11 * size, 1.2, 1.15, 1.5, 'sand')
  }
}

const stop: Thing = b => {
  for (const x of [-10, 10]) {
    b.post(x, -3, 0, 20, 1.0, 'chrome')
    b.post(x, 4, 0, 17, 0.86, 'pole')
  }
  b.box(-12, -5, 17, 12, 6, 19, 'clay')
  b.box(-12, -5, 19, 11, 1, 20.4, 'wood')
  b.box(-9, -3, 3, 9, -2, 15, 'front')
  b.box(-8, -2, 12, 8, -1.4, 17, 'chrome')
  b.box(-7.9, -2, 5, 8.1, -1.1, 11, 'dark')
  letters(b, 'BUS', -0.94, 13, 'pole')
  for (let j = 0; j < 2; j++) b.box(-7, -1.1, 7 + j * 2, 3 + j * 3, -0.86, 7.5 + j * 2, 'stone')
  b.box(-8, 0, 4, 7, 4, 5.5, 'wood')
}

const cart: Thing = b => {
  for (const x of [-7, 7]) {
    b.ball(x, 1.3, 3.6, 1.4, 3.8, 3.65, 'ink')
    b.ball(x * 1.12, 1.3, 3.6, 0.6, 2.6, 2.5, 'chestWood')
    b.ball(x * 1.24, 1.3, 3.6, 0.55, 1.1, 1.1, 'chrome')
    b.box(x * 0.77 - 0.55, 5, 4.4, x * 0.77 + 0.55, 15, 5.6, 'wood')
  }
  b.box(-6.7, -6, 4.3, 6.7, 7, 5.8, 'chestWood')
  for (const x of [-7, 6]) b.box(x, -6.3, 5.2, x + 1, 7.2, 9.5, 'wood')
  b.box(-7, -6.6, 5.2, 7, -5.3, 9.5, 'wood')
  b.box(-6, 5.8, 5.2, 6, 7, 8, 'lip')
}

export const MEADOW_THINGS: Record<string, Thing> = {
  ...Object.fromEntries([0, 1, 2, 3].map(n => [`meadow_mill_${n}`, mill(n)])),
  meadow_waystone: waystone,
  meadow_hay_small: hay(0.8),
  meadow_hay_medium: hay(1.3),
  meadow_hay_large: hay(1.9),
  meadow_bus_stop: stop,
  meadow_cart: cart,
}
