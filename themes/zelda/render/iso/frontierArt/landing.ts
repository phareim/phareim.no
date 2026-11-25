import type { Pick, Solids } from '../props'

type Thing = (solids: Solids) => void

function breakwater(end: boolean): Thing {
  return b => {
    const stones = [-13, -7, 0, 7, 13].filter(x => !end || x < 10)
    for (let j = 0; j < 3; j++) for (const [i, x] of stones.entries()) {
      const r = ((i + j * 3) % 4) * 0.3
      b.ball(x + (j - 1) * 2, (j - 1) * 4, (j === 1 ? 4 : 2) + r, 4.7 + r, 3.8 + r, 3.2 + r,
        (i + j) % 3 === 0 ? 'moss' : (i + j) % 3 === 1 ? 'rock' : 'carve')
    }
    if (end) b.ball(9.5, 1, 3, 6.1, 5.5, 5, 'stone')
  }
}

const planks: Pick = (x, y, z, _nx, _ny, nz) => {
  const grain = Math.floor(y + 52) % 5
  if (grain === 0) return 'ink'
  if (nz > 0.7 && z > 4 && Math.abs(x) > 10 && grain === 1) return 'chrome'
  return grain === 1 ? 'lip' : 'wood'
}

const pier: Thing = b => {
  for (const x of [-11, 11]) for (const y of [-41, -15, 15, 41]) b.post(x, y, -4, 7.5, 1.7, 'chestWood')
  b.box(-13.2, -47.5, 2, 13.2, 47.5, 5.8, planks)
  for (const x of [-13.8, 12.8]) b.box(x, -48.1, 3.95, x + 1, 48.1, 5.5, 'lip')
}

const bollard: Thing = b => {
  b.box(-3, -2.9, 0, 3, 2.9, 1.6, 'carve')
  b.post(0, 0, 1.6, 7, 1.55, 'pole')
  b.post(0, 0, 6.8, 8.6, 2.1, 'chrome')
  b.ball(0, 0, 4.8, 2.45, 2.4, 0.6, 'sand')
}

const crates: Thing = b => {
  const crate = (x: number, y: number, z: number, side: number) => {
    b.box(x, y, z, x + side, y + side, z + side, (a, d, h, nx, ny, nz) => {
      const f = nz > 0.7 ? Math.floor(d - y) : nx > 0.65 ? Math.floor(d - y + h - z) : Math.floor(a - x + h - z)
      return f % 4 === 0 ? 'ink' : ny > 0.5 && h < z + side * 0.7 && h > z + side * 0.5 ? 'clay' : 'wood'
    })
  }
  crate(-9, -6, 0, 11)
  crate(2, 2, 0, 8)
  crate(-7.8, -5.1, 11, 7.5)
}

const nets: Thing = b => {
  for (const x of [-10, 10]) b.post(x, 0, 0, 16, 0.85, 'chestWood')
  b.box(-11, -0.85, 14.8, 11, 0.85, 16.4, 'wood')
  for (let x = -8; x <= 8; x++) for (let h = 3; h < 15; h++) {
    if ((x + h) % 4 !== 0 && (x - h) % 4 !== 0) continue
    b.box(x, 0.85, h, x + 0.66, 1.4, h + 0.66, 'sand')
  }
  for (const x of [-7, 0, 7]) b.ball(x, 1.4, 3.8, 1.2, 0.7, 1, 'clay')
}

const harbour: Thing = b => {
  b.box(-4.2, -4.2, 0, 4.2, 4.2, 2.8, 'carve')
  b.post(0, 0, 2.8, 28.5, 2.1, 'wood')
  b.post(0, 0, 14, 16, 2.4, 'chrome')
  b.box(-5, -5, 27, 5, 5, 29, 'chrome')
  b.box(-4, -4, 29, 4, 4, 33, 'glassCyan')
  b.box(-5.15, -5.15, 33, 5.15, 5.15, 35, 'pole')
  b.ball(0, 0, 35.5, 3.7, 3.7, 1.9, 'gold')
}

export const LANDING_THINGS: Record<string, Thing> = {
  landing_breakwater: breakwater(false),
  landing_breakwater_end: breakwater(true),
  landing_pier: pier,
  landing_bollard: bollard,
  landing_crates: crates,
  landing_net_rack: nets,
  landing_harbour_light: harbour,
}
