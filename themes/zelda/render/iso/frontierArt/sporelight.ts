import type { MatName, Pick, Solids } from '../props'

type Thing = (solids: Solids) => void

function mushroom(scale: number, violet: boolean): Thing {
  return b => {
    const tint = violet ? 'shrine' : 'moss'
    const bright = violet ? 'bandPink' : 'bandCyan'
    b.post(0, 0, 0, 22 * scale, 2.7 * scale, 'chrome')
    b.ball(0, 0, 24 * scale, 11.4 * scale, 10.6 * scale, 2.1 * scale, bright)
    const cap: Pick = (x, y, z, _nx, _ny, nz) => {
      const p = (Math.floor(x / scale) * 13 ^ Math.floor(y / scale) * 17) & 15
      if (nz < 0.25 && z < 26 * scale) return bright
      if (nz > 0.4 && p < 2 && ((Math.floor(z / scale) & 1) === 0)) return bright
      return tint
    }
    b.ball(-scale, -scale, 26 * scale, 11.8 * scale, 10.8 * scale, 6.4 * scale, cap)
  }
}

const moss: Thing = b => {
  for (const [x, y, z, color] of [[0, 0, 5, 'moss'], [4, 1, 3, 'bandCyan'], [-4, 2, 3, 'moss'], [2, -5, 4, 'moss'], [0, 4, 3, 'bandCyan']] as const) {
    b.ball(x, y, z / 2, 2.5, 2, z / 2, color)
  }
}

function puff(frame: number): Thing {
  return b => {
    const pufflets = [[0, 0, 9, 3], [3, -3, 13, 2], [-5, 3, 11, 2], [1, 4, 7, 1.5], [4, 1, 5, 1.5]] as const
    pufflets.forEach(([x, y, z, r], i) => {
      const drift = 1 + frame * 0.38
      b.ball(x * drift, y * drift, z + frame * 3, r * drift, r * drift, r * drift,
        i % 2 ? 'bandPink' : 'bandCyan')
    })
  }
}

const wall: Pick = (x, y, z, nx, _ny, nz) => {
  const along = nx > 0.5 ? y : x
  if (z < 4) return 'carve'
  if (nz < 0.5 && z > 17 && z < 31 && Math.abs(along) > 13 && Math.abs(along) < 25) return 'gold'
  return Math.floor(z) % 7 === 0 ? 'ink' : 'wood'
}

const bathhouse: Thing = b => {
  b.box(-44, -42, 0, 44, 42, 5, 'stone')
  b.box(-36, -28, 5, 36, 27, 38, wall)
  // Dark central vestibule, an open transom, and gold lanterns under the eaves.
  b.box(-12, 23, 5, 12, 30, 31, 'dark')
  b.box(-10, 29, 26, 10, 31, 30, 'bandCyan')
  for (const x of [-13, 11]) b.box(x, 28, 5, x + 2, 32, 32, 'chestWood')
  for (let level = 0; level < 7; level++) {
    const cut = level * 4.1
    const z = 37 + level * 2.7
    b.box(-42, -33 + cut, z, 42, 34 - cut, z + 3, level % 2 ? 'shrine' : 'pole')
  }
  for (const x of [-29, 29]) {
    b.post(x, 33, 6, 27, 1.1, 'pole')
    b.box(x - 3.5, 29.5, 18, x + 3.5, 36.5, 25, 'gold')
    b.box(x - 4, 29, 25, x + 4, 37, 28, 'ink')
  }
}

function grazer(angry: boolean, step: number): Thing {
  return b => {
    const shell: Pick = (x, y, z, _nx, _ny, nz) => {
      if (nz < 0.4 && z < 25) return 'carve'
      return (Math.floor(x + y / 2 + z) & 7) < 2 ? 'stone' : 'shrine'
    }
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      const stride = 2 * side * end * (step ? -1 : 1)
      b.post(side * 8, end * 13 + stride, 0, 15, end > 0 ? 3.4 : 2.8, 'carve')
    }
    b.ball(0, -3, 20, 15, 22, 16, shell)
    b.ball(0, 16, 16, 8.5, 13, 8.5, 'rock')
    b.ball(0, 26, 12, 6.5, 5, 4.5, 'carve')
    const eyes: MatName = angry ? 'glassPink' : 'glassCyan'
    b.ball(5.5, 24, 18, 2.4, 2.9, 1.8, eyes)
    b.ball(-5.5, 24, 18, 2.2, 2.6, 1.8, eyes)
    for (const x of [-7, 7]) b.ball(x, 21, 24, 2.8, 2.3, angry ? 5 : 3.8, 'moss')
  }
}

export const SPORELIGHT_THINGS: Record<string, Thing> = {
  sporelight_mushroom_small_teal: mushroom(0.75, false),
  sporelight_mushroom_medium_teal: mushroom(1.25, false),
  sporelight_mushroom_large_teal: mushroom(2.1, false),
  sporelight_mushroom_small_violet: mushroom(0.75, true),
  sporelight_mushroom_medium_violet: mushroom(1.25, true),
  sporelight_mushroom_large_violet: mushroom(2.1, true),
  sporelight_glow_moss: moss,
  sporelight_puff_0: puff(0),
  sporelight_puff_1: puff(1),
  sporelight_puff_2: puff(2),
  sporelight_bathhouse: bathhouse,
  sporelight_grazer_calm_0: grazer(false, 0),
  sporelight_grazer_calm_1: grazer(false, 1),
  sporelight_grazer_angry_0: grazer(true, 0),
  sporelight_grazer_angry_1: grazer(true, 1),
}
