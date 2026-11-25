import { glyphRows } from '../../../../base/pixel/font'
import type { MatName, Solids } from '../props'

type Thing = (solids: Solids) => void
export const ROAD_TONES = ['pink', 'cyan', 'violet', 'gold', 'rose'] as const
const LENS: Record<(typeof ROAD_TONES)[number], MatName> = {
  pink: 'glassPink', cyan: 'glassCyan', violet: 'glassViolet', gold: 'gold', rose: 'glassRose',
}

export function letters(b: Solids, word: string, y: number, z: number, ink: MatName) {
  const rows = [...word].map(glyphRows)
  const width = rows.reduce((n, glyph) => n + glyph[0]!.length + 1, -1)
  let x = -width / 2
  for (const glyph of rows) {
    glyph.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] !== '#') continue
        b.box(x + i, y, z + glyph.length - j - 1, x + i + 1, y + 0.4, z + glyph.length - j, ink)
      }
    })
    x += glyph[0]!.length + 1
  }
}

function lantern(tone: (typeof ROAD_TONES)[number], lit: boolean): Thing {
  return b => {
    b.box(-3.5, -3.5, 0, 3.5, 3.5, 3.2, 'stone')
    b.post(0, 0, 2, 23, 1.05, 'pole')
    b.post(0, 0, 17, 19, 1.8, LENS[tone] === 'gold' ? 'chestWood' : 'chrome')
    b.box(-3, -3, 22, 3, 3, 31, 'pole')
    const pane = lit ? LENS[tone] : 'carve'
    b.box(-2.15, -3.3, 23.5, 2.15, 3.3, 29, pane)
    b.box(-3.3, -2.15, 23.5, 3.3, 2.15, 29, pane)
    if (lit) b.box(-0.55, 3.3, 25, 0.55, 3.45, 28, 'core')
    b.box(-3.8, -3.8, 30, 3.8, 3.8, 32, 'chrome')
    b.post(0, 0, 31.5, 33, 1.7, 'pole')
  }
}

export function board(word: string, ink: MatName): Thing {
  return b => {
    for (const x of [-11, 11]) {
      b.box(x - 1, -1.1, 0, x + 1, 1.1, 21, 'chestWood')
      b.box(x - 1.8, -1.8, 0, x + 1.8, 1.8, 2, 'carve')
    }
    b.box(-13.5, -1.65, 10, 13.5, 1.65, 22, 'chestWood')
    b.box(-12.6, 1.65, 11, 12.6, 1.95, 21, 'dark')
    b.box(-12, 1.95, 11.4, 12, 2.18, 12.1, ink)
    letters(b, word, 2.05, 13, ink)
  }
}

const log: Thing = b => {
  b.ball(0, 0, 3.25, 12.5, 3.5, 3.25, (x, y, z, nx) => {
    if (Math.abs(nx) > 0.75) {
      const ring = Math.floor(Math.hypot(y, z - 3.25) * 1.7)
      return ring % 2 ? 'sand' : 'chestWood'
    }
    return (Math.floor(y + z * 2) & 3) === 0 ? 'ink' : 'wood'
  })
  b.box(-8.9, -1.35, 5.2, 8.8, 1.35, 6.4, 'chestWood')
}

const tripod: Thing = b => {
  for (const [x, y] of [[-10, -5], [9, -4], [0, 10]] as const) {
    for (let i = 0; i < 16; i++) {
      const f = 1 - i / 16
      b.ball(x * f, y * f, i * 1.45 + 0.7, 0.8, 0.8, 1.35, 'chestWood')
    }
  }
  b.post(0, 0, 12, 24, 0.44, 'chrome')
  b.ball(0, 0, 10.75, 4.8, 4.8, 3.8, 'pole')
  b.ball(0, 0, 13.5, 4, 4, 1.9, 'carve')
  b.post(0, 0, 14, 16, 0.8, 'chrome')
  b.box(2, 1.8, 10.7, 6.4, 2.9, 12, 'stone')
}

const shelter: Thing = b => {
  for (const x of [-13, 13]) {
    b.post(x, 8, 0, 19, 1.12, 'chestWood')
    b.post(x, -8, 0, 12, 1.12, 'chestWood')
  }
  for (let y = -11; y < 11; y++) {
    const roof = 11.5 + (y + 11) * 0.34
    b.box(-15.5, y, roof, 15.5, y + 1, roof + 1.5, y % 4 === 0 ? 'lip' : 'wood')
  }
  b.box(-13, -8, 0, 13, -7, 11, 'ink')
  b.box(-10, -5, 0, 10, 5, 1.6, 'sand')
}

function fire(frame: number): Thing {
  return b => {
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4
      b.ball(Math.cos(a) * 7.8, Math.sin(a) * 6.9, 1.1, 2.3, 1.9, 1.3, 'carve')
    }
    b.box(-5, -1.1, 0, 5, 1.1, 2, 'ink')
    b.box(-1.15, -4.6, 0, 1.15, 4.6, 2.3, 'chestWood')
    const turn = [0, -1.2, 0.8, 1.35][frame]!
    b.ball(0, 0, 4.2, 4.5, 3.5, 4.7, 'velvet')
    b.ball(turn * 0.45, 0.4, 6.9, 2.7, 2.5, 5, 'gold')
    b.ball(turn, -0.2, 10.7 + frame % 2, 1.35, 1.15, 3.8, 'gold')
    b.ball(0.2, 1.3, 5.2, 1.3, 1.3, 2.85, 'core')
    b.ball(-turn, -0.3, 15 + frame, 0.63, 0.63, 0.74, 'gold')
  }
}

export const ROADSIDE_THINGS: Record<string, Thing> = {
  ...Object.fromEntries(ROAD_TONES.flatMap(tone => [
    [`road_lantern_${tone}_off`, lantern(tone, false)], [`road_lantern_${tone}_on`, lantern(tone, true)],
  ])),
  camp_board_pink: board('CAMP', 'glassPink'),
  camp_board_cyan: board('CAMP', 'glassCyan'),
  camp_board_gold: board('CAMP', 'gold'),
  camp_board_violet: board('CAMP', 'glassViolet'),
  camp_board_open: board('OPEN', 'glassCyan'),
  camp_board_inn: board('INN', 'gold'),
  camp_board_blank: board('', 'carve'),
  camp_log: log,
  camp_tripod: tripod,
  camp_shelter: shelter,
  ...Object.fromEntries([0, 1, 2, 3].map(n => [`camp_fire_${n}`, fire(n)])),
}
