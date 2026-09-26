/**
 * The small pieces as letter art: shoes (6 × 4, one shoe from the front),
 * hats (16 × 10, the head's top in the bottom four rows), glasses
 * (12 × 4) and the back (20 × 18: capes and wings, behind the body).
 * Letters are the garment palette (pixelart.ts): a main, b shade,
 * c tint, k deep shade, d color2, e its shade, f its tint. Patterns
 * recolour the 'a' cells only.
 */
import type { GarmentDef } from '../types'
import { Paint, applyPattern, mirrorRows, type Pal } from './pixelart'

// ---------------------------------------------------------------- shoes

const SHOES: Record<string, string[]> = {
  sneaker: ['......', '.adda.', 'caaaab', 'dddddd'],
  boot: ['.caab.', '.caab.', 'caaaab', 'kkkkkk'],
  rain: ['.bbbb.', '.caab.', 'caaaab', 'dddddd'],
  ballet: ['......', '......', '.adda.', 'caaaab'],
  sandal: ['......', '......', 'aaddaa', 'bbbbbb'],
}

export function shoeArt(def: GarmentDef, P: Pal): Paint {
  const p = new Paint(6, 4)
  p.art(SHOES[def.shape ?? ''] ?? SHOES.sneaker!, 0, 0, P)
  applyPattern(p, def.pattern, P.a, P.d, { stripe: { every: 2, offset: 1 } })
  return p
}

// ---------------------------------------------------------------- hats

const HATS: Record<string, string[]> = {
  cap: [
    '................',
    '................',
    '................',
    '.......dd.......',
    '.....caaaab.....',
    '...caaaaaaaab...',
    '..caaaaddaaaab..',
    '..caaaaaaaaaab..',
    '.bbbbbbbbbbbbbb.',
    '................',
  ],
  beanie: [
    '......fddf......',
    '......dddd......',
    '.......dd.......',
    '.....caaaab.....',
    '....caaaaaab....',
    '...caaaaaaaab...',
    '..caaaaaaaaaab..',
    '..bcbcbcbcbcbc..',
    '..bcbcbcbcbcbc..',
    '................',
  ],
  crown: [
    '................',
    '................',
    '...c...cc...c...',
    '...a...aa...a...',
    '...aa.adda.aa...',
    '...caaaaaaaab...',
    '...bdbbddbbdb...',
    '...caaaaaaaab...',
    '................',
    '................',
  ],
  tiara: [
    '................',
    '................',
    '................',
    '................',
    '.......cc.......',
    '......adda......',
    '....a.aaaa.a....',
    '...caaaaaaaab...',
    '................',
    '................',
  ],
  cat: [
    '................',
    '................',
    '..a..........a..',
    '..aa........aa..',
    '..ada......ada..',
    '..adda....adda..',
    '..aaaaa..aaaaa..',
    '...bbbbbbbbbb...',
    '................',
    '................',
  ],
  bunny: [
    '.....a....a.....',
    '....aab..aab....',
    '....adb..adb....',
    '....adb..adb....',
    '....adb..adb....',
    '....adb..adb....',
    '....aab..aab....',
    '...bbbbbbbbbb...',
    '................',
    '................',
  ],
  bow: [
    '................',
    '................',
    '................',
    '....ca....ab....',
    '....caa..aab....',
    '....caaddaab....',
    '....caa..aab....',
    '....ca....ab....',
    '................',
    '................',
  ],
  witch: [
    '.........a......',
    '........aa......',
    '.......aab......',
    '......aaab......',
    '......aaaab.....',
    '.....aaaaab.....',
    '.....ddffdd.....',
    '.caaaaaaaaaaaab.',
    '................',
    '................',
  ],
  party: [
    '.......dd.......',
    '.......aa.......',
    '......aaab......',
    '......aaab......',
    '.....aaaaab.....',
    '.....aaaaab.....',
    '....aaaaaaab....',
    '....aaaaaaab....',
    '................',
    '................',
  ],
  cowboy: [
    '................',
    '................',
    '................',
    '.....ca..ab.....',
    '.....caaaab.....',
    '.....caaaab.....',
    'a....dddddd....b',
    'caaaaaaaaaaaaaab',
    '................',
    '................',
  ],
}

export function hatArt(def: GarmentDef, P: Pal): Paint {
  const p = new Paint(16, 10)
  p.art(HATS[def.shape ?? ''] ?? HATS.cap!, 0, 0, P)
  // Hats stripe every other row: rings on a beanie, bands on a party hat.
  applyPattern(p, def.pattern, P.a, P.d, { stripe: { every: 2, offset: 1 }, twinkles: [[7, 5]] })
  return p
}

// ---------------------------------------------------------------- glasses

const GLASSES: Record<string, string[]> = {
  round: ['..aa....aa..', 'aafdaaaafdaa', '.adda..adda.', '..aa....aa..'],
  sun: ['aaaaaaaaaaaa', 'afdddaafddda', 'addddaadddda', '.dddd..dddd.'],
  heart: ['aa.aa..aa.aa', 'afddaaaafdda', '.ada....ada.', '..a......a..'],
  star: ['..a......a..', 'adfdaaaadfda', '.ada....ada.', '.a.a....a.a.'],
}

export function glassesArt(def: GarmentDef, P: Pal): Paint {
  const p = new Paint(12, 4)
  p.art(GLASSES[def.shape ?? ''] ?? GLASSES.round!, 0, 0, P, '')
  return p
}

// ---------------------------------------------------------------- back

/** The left wing (the viewer's left), 10 × 18; the right one is its mirror. */
const WINGS: Record<string, string[]> = {
  angel: [
    '...ccc....',
    '.ccaaac...',
    'caaaaaaac.',
    'caaaaaaaac',
    'caaaaaaaaa',
    'aaaaaaaaaa',
    'abaabaabaa',
    'abaabaabaa',
    'abaabaabaa',
    'dbaabaabaa',
    '.daabaabaa',
    '.dbabaabaa',
    '..daabaab.',
    '..dbdbaab.',
    '...d.dbd..',
    '.....d.d..',
    '..........',
    '..........',
  ],
  butterfly: [
    '..........',
    '.eeee.....',
    'eaaaae....',
    'eacaaae...',
    'eaddaaae..',
    'eaddaaaae.',
    '.eaaaaaaae',
    '..eaaaaaae',
    '...eeeaaae',
    '....eaaaae',
    '...eaadaae',
    '...eaddaae',
    '...eaaaae.',
    '....eaae..',
    '.....ee...',
    '..........',
    '..........',
    '..........',
  ],
  fairy: [
    '.aa.......',
    'acca......',
    'acdca.....',
    'accdca....',
    'acccdca...',
    '.acccdca..',
    '.accccdca.',
    '..accccdca',
    '...aaaacca',
    '.....acdca',
    '....accdca',
    '....acdcca',
    '.....acca.',
    '......aa..',
    '..........',
    '..........',
    '..........',
    '..........',
  ],
  dragon: [
    'c.........',
    'aa........',
    'adaa......',
    'adddaaa...',
    'addaddaaa.',
    'adddaddaaa',
    'addddaddda',
    'addddaddda',
    'adddddaddd',
    'addddddadd',
    'ad.ddddadd',
    'a...dd.ad.',
    '.....d..d.',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
  ],
}

const CAPE_ROWS = 18

export function backArt(def: GarmentDef, P: Pal): Paint {
  const p = new Paint(20, 18)
  if (def.kind === 'cape') {
    // Hangs from the shoulders and widens a column each side every six rows.
    for (let y = 0; y < CAPE_ROWS; y++) {
      const widen = Math.floor(y / 6)
      const a = 4 - widen
      const b = 15 + widen
      for (let x = a; x <= b; x++) p.cloth(x, y, P.a)
      p.detail(a, y, P.d)
      p.detail(b, y, P.e)
      if (y >= 4 && y < CAPE_ROWS - 1) for (const x of [a + 3, b - 3]) p.detail(x, y, P.b)
    }
    for (let x = 4; x <= 15; x++) p.detail(x, 0, P.b)
    p.detail(9, 0, P.d); p.detail(10, 0, P.d)
    for (let x = 2; x <= 17; x++) if (p.isFab(x, CAPE_ROWS - 1)) p.detail(x, CAPE_ROWS - 1, P.b)
    applyPattern(p, def.pattern, P.a, P.d, { twinkles: [[7, 8], [12, 12], [6, 15]] })
    return p
  }
  const left = WINGS[def.shape ?? ''] ?? WINGS.angel!
  const fabric = def.shape === 'fairy' ? 'c' : 'a'
  p.art(left, 0, 0, P, fabric)
  p.art(mirrorRows(left), 10, 0, P, fabric)
  applyPattern(p, def.pattern, fabric === 'c' ? P.c : P.a, P.d)
  return p
}
