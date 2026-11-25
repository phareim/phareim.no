import { FRONTIER_PEOPLE, type FrontierNpcLook, type Person } from '../../frontierSprites'
import type { MatName, Pick, Solids } from '../props'

type Thing = (solids: Solids) => void

const COLORS: Record<string, MatName> = {
  a: 'clay', b: 'shrine', B: 'pole', c: 'glassCyan', d: 'sand', e: 'sand',
  F: 'moss', g: 'chrome', G: 'stone', h: 'pole', H: 'shrine',
  K: 'front', m: 'bandPink', n: 'wood', N: 'chestWood', o: 'clay',
  p: 'bandPink', r: 'velvet', R: 'blockPink', s: 'skinWarm', S: 'skinBrown',
  t: 'bandCyan', T: 'moss', u: 'shrine', V: 'shrine', W: 'chrome', y: 'gold', Y: 'clay',
}
const tone = (color: string): MatName => COLORS[color] ?? 'pole'

function person(style: Person, back: boolean, step: number): Thing {
  return b => {
    const front = back ? -1 : 1
    const skin = tone(style.skin)
    const hair = tone(style.hair)
    const coat = tone(style.coat)
    const fold = tone(style.fold)
    const trim = tone(style.trim)
    const h = style.short ? 0.79 : 1
    const stride = step ? 1.7 : -1.7
    // Boots, bent elbows and a coat with a front overlap.
    for (const side of [-1, 1]) {
      b.ball(side * 3, stride * side, 3, 2.6, 3.5, 3, 'dark')
      b.post(side * 3, stride * side, 4, 11 * h, 1.8, fold)
      b.ball(side * 6.3, -stride * side * 0.55, 13 * h, 2.2, 2.9, 3.8 * h, coat)
      b.ball(side * 6.5, front + -stride * side * 0.55, 10.9 * h, 1.65, 2, 1.8, skin)
    }
    if (style.skirt) b.ball(0, 0, 8 * h, 6.8, 4.6, 4.4 * h, fold)
    const jacket: Pick = (x, y, z, nx, ny, nz) => {
      if (Math.floor(z) === Math.floor(13 * h)) return trim
      if ((z > 15 * h && Math.abs(y) < 3) || nx > 0.7 && x > 3.2) return fold
      if (!back && ny > 0.45 && z > 13 * h && Math.abs(x - 1) < 0.7) return trim
      return nz < -0.4 ? fold : coat
    }
    b.ball(0, 0, 13.1 * h, 5.9, 4.5, 6.1 * h, jacket)
    b.post(0, 0, 17 * h, 19.5 * h, 2.9, skin)

    const headZ = 23 * h + step
    b.ball(0, 0, headZ, 5.15, 4.7, 5.5 * h, (_x, y, z, _nx, _ny, nz) => {
      if (nz > 0.36 || y * front < -2.25 || style.head === 'wood' && z > headZ + 1) return hair
      return skin
    })
    if (style.head === 'visor') {
      b.box(-4.45, front < 0 ? -4.8 : 3.8, headZ - 0.6, 4.45, front < 0 ? -3.8 : 4.8, headZ + 2.1, 'pole')
      for (const x of [-2.5, 2.5]) b.ball(x, 4.7 * front, headZ + 0.4, 1.1, 0.6, 0.85, 'glassCyan')
    } else {
      for (const x of [-2.2, 2.2]) b.ball(x, 4.2 * front, headZ, 0.82, 0.62, 1, 'dark')
      if (!back) b.ball(0.6, 4.5 * front, headZ - 1.3, 1, 1, 0.75, skin)
    }
    if (style.head === 'helmet' || style.head === 'bonnet' || style.head === 'cap') {
      const cap = style.head === 'cap' ? coat : 'gold'
      b.ball(0, 0, headZ + 3.8 * h, 5.6, 5.3, 2.55 * h, cap)
      b.box(-4.7, front < 0 ? -6 : 2, headZ + 1, 4.7, front < 0 ? -2 : 6, headZ + 2, trim)
    }
    if (style.head === 'hood') {
      b.ball(0, -1.8 * front, headZ + 2, 5.7, 4.5, 5.4 * h, coat)
      b.box(-4.8, -1.2, headZ - 3.5, 4.8, 1.6, headZ - 2.1, trim)
    }
    if (style.head === 'braids' || style.head === 'hair') {
      b.ball(-4.15, -1.6 * front, headZ - 2.7, 1.6, 2.6, 4.3 * h, hair)
      b.ball(4.15, 0, headZ - 1.8, 1.6, 2.4, 3.7 * h, hair)
    }
    if (style.hand === 'crook' || style.hand === 'broom') {
      b.post(8.4, 2 * front, 0, style.hand === 'crook' ? 25 : 19, 0.65, 'chestWood')
      if (style.hand === 'crook') b.ball(7.4, 2 * front, 24, 2.2, 0.9, 1.9, 'wood')
      else b.ball(8.4, 2 * front, 3, 2.1, 1.4, 3, 'sand')
    } else if (style.hand === 'pick' || style.hand === 'lever') {
      b.post(8.4, 2.5 * front, 5, 20, 0.62, 'wood')
      b.box(6, 1.7 * front, 18.5, 12, 1.7 * front + 1.5, 20.5, style.hand === 'pick' ? 'chrome' : 'bandPink')
    } else if (style.hand === 'bucket' || style.hand === 'water') {
      b.post(8.5, 2.1 * front, 5, 10, 2.8, style.hand === 'water' ? 'moss' : 'stone')
      b.ball(8.5, 2.1 * front, 10, 2.6, 1.9, 0.85, 'chrome')
      if (style.hand === 'water') b.box(9.2, -0.35, 8.4, 13, 1.4, 10, 'bandCyan')
    } else if (style.hand === 'tube' || style.hand === 'book') {
      b.box(5.5, 3.2 * front, 10, 10.4, 3.2 * front + 1.9, style.hand === 'tube' ? 11.4 : 15,
        style.hand === 'tube' ? 'glassCyan' : 'bandPink')
    } else if (style.hand === 'rope') {
      b.ball(7.2, 2 * front, 10, 2.8, 1.25, 3.2, 'sand')
      b.ball(7.2, 2.9 * front, 10, 1.4, 0.9, 1.8, 'chestWood')
    } else if (style.hand === 'sled') {
      for (const x of [6, 11]) b.box(x, -2, 0, x + 1, 7, 1, 'chrome')
      b.box(5.5, -1, 1, 12.5, 5.5, 3, 'velvet')
    } else if (style.hand === 'tail' && !back) {
      b.ball(-6.7, -2.6, 6.3, 3.7, 1.4, 1.3, 'wood')
      b.ball(-9.8, -2.6, 5.5, 1.5, 1.1, 1.8, 'chestWood')
    } else if (style.hand === 'key') {
      b.box(2, -7, 13, 10, -5.5, 14.5, 'gold')
      const z = step ? 12 : 15
      for (const x of [7, 10.5]) b.ball(x, -6.2, z, 1.65, 1.2, 1.6, 'gold')
    }
  }
}

function goat(back: boolean, step: number): Thing {
  return b => {
    const front = back ? -1 : 1
    for (const x of [-3.5, 3.5]) for (const y of [-4.5, 4.5]) {
      b.post(x, y + (step ? -1.4 : 1.4) * Math.sign(x * y), 0, 8.5, 1.15, 'stone')
    }
    b.ball(0, 0, 8, 4.8, 7.5, 4.5, 'chrome')
    b.ball(0, front * 7.05, 11.85, 3.2, 3.9, 4, 'chrome')
    for (const x of [-2.2, 2.2]) {
      b.post(x, front * 6, 13.5, 18 - step, 0.74, 'chestWood')
      b.ball(x * 1.3, front * 9.1, 12.5, 0.75, 0.6, 0.65, 'ink')
    }
    b.ball(0, front * 10.3, 8.8, 1.7, 1.9, 2, 'stone')
    b.ball(1.7, front * 6.7, 7.5, 1.25, 1.4, 1.6, 'gold')
  }
}

export function peoplePose(name: FrontierNpcLook, back: boolean, step: number): Thing {
  return name === 'fellgoat' ? goat(back, step) : person(FRONTIER_PEOPLE[name], back, step)
}
