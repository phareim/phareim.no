import type { MatName, Pick, Solids } from '../props'

type Thing = (solids: Solids) => void

/** Same frontage and floor plan before and after an era change. */
function house(era: 1958 | 1986 | 2086, hip = false): Thing {
  return b => {
    const siding: MatName = era === 1958 ? 'sand' : era === 2086 ? 'chrome' : hip ? 'moss' : 'velvet'
    const roof: MatName = era === 1958 ? 'chestWood' : era === 2086 ? 'pole' : hip ? 'stone' : 'shrine'
    const panes: MatName = era === 2086 ? 'glassCyan' : 'gold'
    const wall: Pick = (x, y, z, nx, ny, nz) => {
      const along = nx > 0.5 ? y : x
      if (nz > 0.5) return roof
      if (z < 5 || Math.floor(z) % 5 === 0) return era === 2086 ? 'carve' : 'wood'
      if (z > 13 && z < 24 && (ny > 0.5 ? Math.abs(x + 17) < 5 || Math.abs(x + 31) < 5 : Math.abs(along - 2) < 8)) {
        return Math.floor(along) % 6 === 0 || z < 15 ? 'ink' : panes
      }
      if (ny > 0.5 && Math.abs(x + 2) < 5 && z < 23) return 'dark'
      return siding
    }
    b.box(-45, -46, 0, 44, 46, 3, 'stone')
    b.box(-40, -43, 3, 10, 43, 31, wall)
    b.box(11, -38, 3, 40, 43, 24, (x, _y, z, _nx, ny) => {
      if (ny > 0.5 && Math.abs(x - 25) < 11 && z < 21) return Math.floor(z) % 4 === 0 ? 'ink' : 'chrome'
      return siding
    })
    b.box(8, -40, 24, 42, 45, 27, roof)
    for (let i = 0; i < (era === 2086 ? 3 : 8); i++) {
      const edge = hip ? i * 1.7 : i * 0.6
      const cut = i * 5.1
      b.box(-43 + edge, -46 + cut, 29 + i * 2, 13 - edge, 46 - cut, 32 + i * 2, roof)
    }
    if (era === 1958) {
      b.box(-33, -12, 36, -25, -4, 54, 'clay')
      b.box(-34, -13, 54, -24, -3, 56, 'chestWood')
    } else if (era === 1986) {
      b.post(-22, -5, 45, 57, 0.7, 'chrome')
      b.box(-29, -6, 55, -15, -4, 57, 'pole')
    } else {
      b.box(-38, -15, 35, 7, 13, 37, 'chrome')
      b.box(-36, 12, 36, 5, 13, 38, 'bandCyan')
    }
    b.box(-8, 43, 0, 4, 48, 3, 'stone')
  }
}

const mailbox: Thing = b => {
  b.post(0, 0, 0, 21, 1.45, 'wood')
  b.box(-6, -4, 18, 6, 4, 25, 'chrome')
  b.ball(0, 0, 24, 6, 4.1, 2.8, 'chrome')
  b.box(5.5, -2.7, 20, 7, 2.7, 24, 'pole')
  b.box(-2.5, 4, 20, 0, 5, 29, 'velvet')
  b.box(-2.5, 4, 27, 4.5, 5, 29, 'velvet')
}
const booth: Thing = b => {
  const frame: Pick = (x, y, z, nx, ny, nz) => {
    const along = nx > 0.5 ? y : x
    if (nz > 0.3 || Math.abs(along) > 6.4 || z < 13 || ny < 0.5 && nx < 0.5) return 'blockPink'
    return z > 31 ? 'glassPink' : Math.floor(z) % 8 === 0 ? 'shrine' : 'bandCyan'
  }
  b.box(-9, -8, 0, 9, 8, 2, 'carve')
  b.box(-8, -7, 2, 8, 7, 36, frame)
  b.box(-9.5, -8.5, 35, 9.5, 8.5, 39, 'velvet')
  b.box(-5.5, 8, 33, 5.5, 8.8, 36.5, 'glassPink')
  b.box(5.1, 7, 12, 6.4, 8.2, 15, 'gold')
}

const wagon: Thing = b => {
  for (const x of [-15, 14]) for (const y of [-7, 7]) b.ball(x, y, 4.5, 4.2, 2.6, 4.5, 'dark')
  b.box(-22, -8, 5, 22, 8, 11, 'clay')
  b.box(-17, -7.5, 11, 10, 7.5, 19, (x, _y, z, nx, ny, nz) => {
    if (nz > 0.4 || z < 13 || Math.abs(x + 14) < 1 || Math.abs(x + 3) < 1 || Math.abs(x - 6) < 1) return 'chestWood'
    return ny > 0.5 || nx > 0.5 ? 'bandCyan' : 'pole'
  })
  b.box(-18, -8, 18, 11, 8, 20, 'sand')
  for (const y of [-5.5, 5.5]) b.box(21.5, y - 1.5, 6.5, 23, y + 1.5, 9.5, 'gold')
  b.box(22, -7, 4, 23.5, 7, 6, 'chrome')
}

const flamingo: Thing = b => {
  b.post(-1.7, -0.75, 0, 9, 0.6, 'chrome')
  b.post(2, 0.75, 0, 9, 0.6, 'chrome')
  b.ball(0, 0, 10, 5.7, 2.8, 3.2, 'velvet')
  b.ball(4, 0.5, 14, 1.4, 1.3, 4.8, 'bandPink')
  b.ball(6, 1.2, 18.6, 2.8, 1.9, 2.2, 'velvet')
  b.box(7, 1, 17.2, 10, 2.4, 18.8, 'sand')
  b.box(9.5, 1, 16.7, 10.5, 2.4, 17.8, 'dark')
}

function sprinkler(frame: number): Thing {
  return b => {
    b.box(-3, -3, 0, 3, 3, 2, 'carve')
    b.post(0, 0, 2, 7, 1.2, 'chrome')
    b.box(-3.5, -1, 6, 3.5, 1, 8, 'gold')
    const angle = (frame * 0.5 - 0.3) * Math.PI
    for (const side of [-1, 1]) for (let i = 1; i < 6; i++) {
      const r = i * 3 * side
      b.ball(r * Math.cos(angle), r * Math.sin(angle), 7 + i * (5 - i) * 1.6, i > 3 ? 0.75 : 1, 0.8, 0.8, i % 2 ? 'bandCyan' : 'chrome')
    }
  }
}

const mower: Thing = b => {
  for (const x of [-5, 5]) for (const y of [-6, 6]) b.ball(x, y, 2.2, 2.2, 1.7, 2.2, 'dark')
  b.box(-6, -8, 2.5, 6, 8, 5, 'velvet')
  b.box(-3.5, -4, 5, 3.5, 3, 8, 'chrome')
  b.box(-5, -8, 5, 5, -4, 8, 'pole')
  for (const x of [-4.5, 4.5]) for (let i = 0; i < 6; i++) b.box(x - 0.6, -8 - i, 5 + i * 1.6, x + 0.6, -7 - i, 7 + i * 1.6, 'chrome')
  b.box(-5, -14, 13, 5, -12, 15, 'pole')
}

export const RERUN_THINGS: Record<string, Thing> = {
  rerun_house_0: house(1986),
  rerun_house_1: house(1986, true),
  rerun_house_1958: house(1958),
  rerun_house_1986: house(1986),
  rerun_house_2086: house(2086),
  rerun_mailbox: mailbox,
  rerun_phone_booth: booth,
  rerun_station_wagon: wagon,
  rerun_flamingo: flamingo,
  rerun_sprinkler_0: sprinkler(0),
  rerun_sprinkler_1: sprinkler(1),
  rerun_lawnmower: mower,
}
