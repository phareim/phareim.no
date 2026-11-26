import type { MatName, Pick, Solids } from '../props'
import { RIM, lamplight, onRim } from './nightPanes'

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

/**
 * The bathhouse's walls: timber in courses, a band of gold windows either side of the middle on every face.
 * At night (L1) each window has a rim of spill light and brighter lamplight between the courses' dark bars.
 */
const wall = (night: boolean): Pick => (x, y, z, nx, _ny, nz) => {
  const along = nx > 0.5 ? y : x
  if (z < 4) return 'carve'
  if (nz < 0.5 && z > 17 && z < 31 && Math.abs(along) > 13 && Math.abs(along) < 25) {
    if (!night) return 'gold'
    // The window as the face shows it: from its left edge (the east face runs from its south end), up from its sill.
    const a = nx > 0.5 ? 25 - Math.abs(along) : Math.abs(along) - 13
    const left = nx > 0.5 ? along > 0 : along < 0
    const u = left ? 12 - a : a
    if (onRim(u, z - 17, 12, 14)) return RIM
    if (Math.floor(z) % 7 === 0) return 'ink'
    return lamplight(u, z - 17, 12, 14)
  }
  return Math.floor(z) % 7 === 0 ? 'ink' : 'wood'
}

/** `night` (L1): the windows lit, the lanterns brighter, the transom over the door the bath's cyan light. */
const bathhouse = (night: boolean): Thing => b => {
  b.box(-44, -42, 0, 44, 42, 5, 'stone')
  b.box(-36, -28, 5, 36, 27, 38, wall(night))
  // Dark central vestibule, an open transom, and gold lanterns under the eaves.
  b.box(-12, 23, 5, 12, 30, 31, 'dark')
  b.box(-10, 29, 26, 10, 31, 30, night ? 'glassCyan' : 'bandCyan')
  for (const x of [-13, 11]) b.box(x, 28, 5, x + 2, 32, 32, 'chestWood')
  for (let level = 0; level < 7; level++) {
    const cut = level * 4.1
    const z = 37 + level * 2.7
    b.box(-42, -33 + cut, z, 42, 34 - cut, z + 3, level % 2 ? 'shrine' : 'pole')
  }
  for (const x of [-29, 29]) {
    b.post(x, 33, 6, 27, 1.1, 'pole')
    b.box(x - 3.5, 29.5, 18, x + 3.5, 36.5, 25, night
      ? (px, _py, pz, _nx, _ny, nz) => (nz < 0.5 && pz > 19.5 && pz < 23.5 && Math.abs(px - x) < 2.6 ? 'core' : 'gold')
      : 'gold')
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

/**
 * THE ROOT STAIR's way down to the Battle Glade (art round 4), over its `>` tile, 2 x 2 tiles: worn stone steps going
 * down northward into the ground through a mossy rim, between two great roots that arch out of the moss on its west
 * and east sides, their veins glowing, a third root humped behind it; a soft cyan glow from the bottom of the stair.
 * The steps and the pit's far walls lie below the ground (z < 0); the rim round the hole hides what the ground would.
 */
const rootstair: Thing = b => {
  const rim: Pick = (x, y, _z, _nx, _ny, nz) => (nz > 0.5 && Math.sin(x / 2.5) + Math.sin(y / 3.1) > 1.2 ? 'stone' : 'moss')
  b.box(-32, 14, -1, 32, 32, 0, rim)
  b.box(-32, -32, -1, 32, -19, 0, rim)
  b.box(-32, -19, -1, -14, 14, 0, rim)
  b.box(16, -19, -1, 32, 14, 0, rim)
  // The pit's far walls: the west wall's east face, the north wall's south face.
  const wall: Pick = (_x, _y, z) => (Math.floor(z + 64) % 6 === 0 ? 'carve' : 'shrine')
  b.box(-17, -19, -20, -14, 14, -1, wall)
  b.box(-17, -22, -20, 16, -19, -1, wall)
  // The steps, from the top at the south edge down to the north, the lowest in the glow.
  for (let k = 0; k < 7; k++) {
    const y1 = 14 - k * 4.7
    b.box(-14, y1 - 4.7, -4 - k * 2.4, 16, y1, -1 - k * 2.4, (_x, _y, _z, _nx, ny, nz) => (nz > 0.5 ? (k > 4 ? 'bandCyan' : 'stone') : ny > 0.5 ? 'carve' : 'stone'))
  }
  b.box(-14, -19, -21, 16, -17, -14, 'glassCyan')
  // The roots: thick, knotted, arching out of the ground either side of the stair and humped behind it.
  const root = (salt: number): Pick => (x, y, z, _nx, _ny, nz) => {
    const v = Math.sin((x + y) / 3 + salt) + Math.sin(z / 2 + y / 5 + salt)
    if (Math.abs(v) < 0.16) return 'glassCyan'
    return nz > 0.6 && Math.sin(x / 2 + salt) > 0.6 ? 'moss' : 'chestWood'
  }
  for (let i = 0; i <= 30; i++) {
    const t = i / 30
    b.ball(-26 + t * 52, -27 - Math.sin(t * 3) * 2, Math.sin(t * Math.PI) * 10 - 1, 5.5, 5, 5, root(3))
  }
  for (const [x0, side, salt] of [[-22, -1, 1], [23, 1, 2]] as const) {
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      const y = -28 + t * 56
      const z = Math.sin(t * Math.PI) * 11 - 2
      const r = 6 - Math.sin(t * Math.PI) * 1.5
      b.ball(x0 + side * Math.sin(t * 5) * 2.5, y, z, r, r * 0.9, r * 0.85, root(salt))
    }
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
  sporelight_bathhouse: bathhouse(false),
  sporelight_bathhouse_night: bathhouse(true),
  sporelight_grazer_calm_0: grazer(false, 0),
  sporelight_grazer_calm_1: grazer(false, 1),
  sporelight_grazer_angry_0: grazer(true, 0),
  sporelight_grazer_angry_1: grazer(true, 1),
  sporelight_rootstair: rootstair,
}
