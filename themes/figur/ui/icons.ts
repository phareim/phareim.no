/**
 * The studio's icons: tiny string-map sprites (themes/base/pixel/sprites.ts)
 * in the pixel palette, outlined in the studio's ink, turned into PNG data
 * URLs once and shown as <img> with `image-rendering: pixelated` at a
 * whole-number scale. Every button pairs one of these with its word.
 * Client only (they need a canvas).
 */
import { sprite } from '../../base/pixel/sprites'

/** The studio's ink for every outline, and a few colours the base palette lacks. */
const FIGUR_PAL: Record<string, string> = {
  k: '#2a1744',
  x: '#8f86b8', // grey
  z: '#e6e2f2', // pale grey
  d: '#7fe0b0', // mint
  f: '#6ecbff', // sky
  q: '#ffc2dd', // blush
}

const ROWS = {
  // ------------------------------------------------ tool tabs
  body: [
    '...kkkkkk...',
    '..kssssssk..',
    '..kskssksk..',
    '..kssssssk..',
    '...kssssk...',
    '....kkkk....',
    '..kkppppkk..',
    '.kppppppppk.',
    '.ksppppppsk.',
    '.kkppppppkk.',
    '..kbbkkbbk..',
    '..kkk..kkk..',
  ],
  hair: [
    '...kkkkkk...',
    '..kppppppk..',
    '.kppppppppk.',
    '.kppssssppk.',
    '.kpsksskspk.',
    '.kpsssssspk.',
    '.kppsqqsppk.',
    '.kppkkkkppk.',
    '.kppk..kppk.',
    '.kppk..kppk.',
    '..kk....kk..',
  ],
  clothes: [
    '..kkk..kkk..',
    '.kvvvkkvvvk.',
    'kvvvvvvvvvvk',
    'kvvvvvvvvvvk',
    'kkkvvvvvvkkk',
    '..kvvvvvvk..',
    '..kvvvvvvk..',
    '..kvvvvvvk..',
    '..kVVVVVVk..',
    '..kkkkkkkk..',
  ],
  draw: [
    '....kkkk....',
    '....kmmk....',
    '....kmmk....',
    '....kkkk....',
    '....kyYk....',
    '....kyYk....',
    '....kyYk....',
    '....kyYk....',
    '....kyYk....',
    '....kjjk....',
    '.....kjk....',
    '......k.....',
  ],
  pip: [
    '.....kkkkkk.....',
    '...kkffffffkk...',
    '..kffffffffffk..',
    '.kfffwkfffffffk.',
    '.kfffkkfffffffk.',
    'yykfffffffffffk.',
    'yyykqqffffffffk.',
    '.kkfffffwwwwffk.',
    '..kffwwwwwwCCk..',
    '..kffwwwwwwCCkk.',
    '...kffwwwwCCk...',
    '....kkkkkkkk....',
    '.....yk..yk.....',
    '....yyk.yyk.....',
  ],

  // ------------------------------------------------ styles
  minecraft: [
    'kkkkkkkkkk',
    'kllllllllk',
    'kllLllLllk',
    'kLnLnnLnLk',
    'knnnnnnnnk',
    'knNnnnNnnk',
    'knnnNnnnnk',
    'knnnnnnNnk',
    'kNnnnnnnnk',
    'kkkkkkkkkk',
  ],
  roblox: [
    '.kkkkkkkk.',
    'kyyyyyyyyk',
    'kyykyykyyk',
    'kyykyykyyk',
    'kyyyyyyyyk',
    'kykyyyykyk',
    'kyykkkkyyk',
    'kyyyyyyyYk',
    '.kkkkkkkk.',
  ],
  toca: [
    '...kkkkkk...',
    '.kksssssskk.',
    '.kssssssssk.',
    'kssksssskssk',
    'kssksssskssk',
    'kqqssssssqqk',
    '.kssskksssk.',
    '..kksssskk..',
    '....kkkkk...',
  ],
  avatar: [
    '.kkk..kkk.',
    'kpppkkmmmk',
    'kppppmmwmk',
    'kpppppmmmk',
    'kpppppppmk',
    '.kpppppPk.',
    '..kpppPk..',
    '...kpPk...',
    '....kk....',
  ],

  // ------------------------------------------------ drawing board
  pencil: [
    '....kkkk....',
    '....kmmk....',
    '....kkkk....',
    '....kyYk....',
    '....kyYk....',
    '....kyYk....',
    '....kyYk....',
    '....kjjk....',
    '.....kjk....',
    '......k.....',
  ],
  eraser: [
    '..kkkkkkkkk.',
    '.kmmmmmwwwk.',
    '.kmmmmmwwwk.',
    '.kmmmmmwwwk.',
    '.kPPPPPzzzk.',
    '.kkkkkkkkkk.',
    '............',
    '..x..x..x...',
  ],
  bucket: [
    '...kkkkk....',
    '..k.....k...',
    '.kkkkkkkkk..',
    '.kpppppppk..',
    '.kwwwwwwwkp.',
    '.kwwwwwwwkp.',
    '.kzwwwwwwk..',
    '..kzwwwwk.p.',
    '..kzwwwwk...',
    '..kkkkkkk...',
  ],
  mirror: [
    '.....kk.....',
    'k..........k',
    'kk...kk...kk',
    'kpk......kwk',
    'kppk.kk.kwwk',
    'kpppk..kwwwk',
    'kkkkk..kkkkk',
    '.....kk.....',
  ],
  undo: [
    '...k........',
    '..kk........',
    '.kykkkkkk...',
    'kyyyyyyyyk..',
    '.kykkkkkyyk.',
    '..kk....kyk.',
    '...k....kyk.',
    '........kyk.',
    '.....kkkyyk.',
    '.....kyyyk..',
    '.....kkkk...',
  ],
  trash: [
    '....kkkk....',
    '.kkkkkkkkkk.',
    '.kzzzzzzzzk.',
    '.kkkkkkkkkk.',
    '..kzxzxzxk..',
    '..kzxzxzxk..',
    '..kzxzxzxk..',
    '..kzxzxzxk..',
    '..kzxzxzxk..',
    '..kkkkkkkk..',
  ],
  broom: [
    '....kkkk....',
    '....knnk....',
    '....knnk....',
    '....knnk....',
    '...kkkkkk...',
    '..kyyyyyyk..',
    '..kyYyYyYk..',
    '.kyYyYyYyYk.',
    '.kyYyYyYyYk.',
    'kyYyYyYyYyYk',
    'kkkkkkkkkkkk',
  ],

  // ------------------------------------------------ small buttons
  close: [
    'kk......kk',
    'kkk....kkk',
    '.kkk..kkk.',
    '..kkkkkk..',
    '...kkkk...',
    '...kkkk...',
    '..kkkkkk..',
    '.kkk..kkk.',
    'kkk....kkk',
    'kk......kk',
  ],
  check: [
    '..........kk',
    '.........kkk',
    '........kkk.',
    'kk.....kkk..',
    'kkk...kkk...',
    '.kkk.kkk....',
    '..kkkkk.....',
    '...kkk......',
    '....k.......',
  ],
  plus: [
    '...kkkk...',
    '...kwwk...',
    '...kwwk...',
    'kkkkwwkkkk',
    'kwwwwwwwwk',
    'kwwwwwwwwk',
    'kkkkwwkkkk',
    '...kwwk...',
    '...kwwk...',
    '...kkkk...',
  ],
  download: [
    '...kkkk...',
    '...kwwk...',
    '...kwwk...',
    '...kwwk...',
    'kkkkwwkkkk',
    '.kwwwwwwk.',
    '..kwwwwk..',
    '...kwwk...',
    'k...kk...k',
    'k........k',
    'kkkkkkkkkk',
  ],
  figures: [
    '..kkk....kkk..',
    '.ksssk..ksssk.',
    '.ksssk..ksssk.',
    '..kkk....kkk..',
    '.kpppk..kvvvk.',
    'kpppppkkvvvvvk',
    'kpppppkkvvvvvk',
    '.kbkbk..kbkbk.',
    '.kk.kk..kk.kk.',
  ],
  sound: [
    '....k.......',
    '...kk....k..',
    'kkkwk..k..k.',
    'kwwwk...k.k.',
    'kwwwk...k.k.',
    'kkkwk..k..k.',
    '...kk....k..',
    '....k.......',
  ],
  mute: [
    '....k.......',
    '...kk.......',
    'kkkwk.k..k..',
    'kwwwk..kk...',
    'kwwwk..kk...',
    'kkkwk.k..k..',
    '...kk.......',
    '....k.......',
  ],
  picture: [
    'kkkkkkkkkkkk',
    'kffffffffyyk',
    'kffffffffyyk',
    'kffffLfffffk',
    'kfffLLLffffk',
    'kffLLLLLLffk',
    'kLLLLLLLLLLk',
    'kkkkkkkkkkkk',
  ],
  back: [
    '....kk....',
    '...kwk....',
    '..kwwkkkkk',
    '.kwwwwwwwk',
    'kwwwwwwwwk',
    '.kwwwwwwwk',
    '..kwwkkkkk',
    '...kwk....',
    '....kk....',
  ],
  star: [
    '.....kk.....',
    '....kyyk....',
    '....kyyk....',
    'kkkkkyykkkkk',
    'kyyyyyyyyyyk',
    '.kyyyyyyyyk.',
    '..kyyyyyyk..',
    '..kyykkyyk..',
    '.kyyk..kyyk.',
    '.kkk....kkk.',
  ],
  heart: [
    '.kkk..kkk.',
    'kpppkkpppk',
    'kppppppwpk',
    'kppppppppk',
    '.kppppppk.',
    '..kppppk..',
    '...kppk...',
    '....kk....',
  ],

  // ------------------------------------------------ body parts
  skin: [
    '...kkkk...',
    '.kksssskk.',
    '.kssssssk.',
    'kssssssssk',
    'ksssssssSk',
    'ksssssssSk',
    'kssssssSSk',
    '.ksssssSk.',
    '.kkSSSSkk.',
    '...kkkk...',
  ],
  eye: [
    '...kkkkkk...',
    '.kkwwbbwwkk.',
    'kwwwbkkbwwwk',
    'kwwwbkkbwwwk',
    '.kkwwbbwwkk.',
    '...kkkkkk...',
  ],
  mouth: [
    'k..........k',
    'kk........kk',
    '.krrrrrrrrk.',
    '..krrmmrrk..',
    '...kkkkkk...',
  ],
  cheeks: [
    '...kkkkkk...',
    '.kksssssskk.',
    '.kssssssssk.',
    'kssksssskssk',
    'kssssssssssk',
    'kqqssssssqqk',
    '.kssskksssk.',
    '..kksssskk..',
    '....kkkk....',
  ],
  freckles: [
    '...kkkkkk...',
    '.kksssssskk.',
    '.kssssssssk.',
    'kssksssskssk',
    'kssssssssssk',
    'ksnsnssnsnsk',
    '.kssskksssk.',
    '..kksssskk..',
    '....kkkk....',
  ],

  // ------------------------------------------------ clothes slots
  top: [
    '..kkk..kkk..',
    '.kccckkccck.',
    'kcccccccccck',
    'kcccccccccck',
    'kkkcccccckkk',
    '..kcccccck..',
    '..kcccccck..',
    '..kCCCCCCk..',
    '..kkkkkkkk..',
  ],
  dress: [
    '...kk..kk...',
    '...kpkkpk...',
    '..kppppppk..',
    '..kppppppk..',
    '..kkyyyykk..',
    '..kppppppk..',
    '.kppppppppk.',
    '.kppppppppk.',
    'kppppppppppk',
    'kPPPPPPPPPPk',
    'kkkkkkkkkkkk',
  ],
  bottom: [
    '.kkkkkkkkk.',
    '.kbbbbbbbk.',
    '.kbbbbbbbk.',
    '.kbbbkbbbk.',
    '.kbbk.kbbk.',
    '.kbbk.kbbk.',
    '.kbbk.kbbk.',
    '.kbbk.kbbk.',
    '.kBBk.kBBk.',
    '.kkkk.kkkk.',
  ],
  shoes: [
    '..kkkk......',
    '..krrk......',
    '..krrkkkk...',
    '.krrrrrrrk..',
    'krrrrrrrrrk.',
    'kwwwwwwwwwk.',
    'kkkkkkkkkkk.',
  ],
  hat: [
    '..k..kk..k..',
    '.kyk.kk.kyk.',
    '.kyykyykyyk.',
    '.kyyyyyyyyk.',
    '.kyryyyyryk.',
    '.kyyyyyyyyk.',
    '.kkkkkkkkkk.',
  ],
  glasses: [
    '.kkkk..kkkk.',
    'kkffk..kffkk',
    '.kffkkkkffk.',
    '.kffk..kffk.',
    '.kkkk..kkkk.',
  ],
  wings: [
    'kk........kk',
    'kmk......kmk',
    'kmmk.kk.kmmk',
    'kmmmkkkkmmmk',
    'kmmmkkkkmmmk',
    '.kmmkkkkmmk.',
    '.kmmk..kmmk.',
    '..kk....kk..',
  ],
} as const

export type IconId = keyof typeof ROWS

/** Checks that every icon's rows are the same width (tests call it too). */
export function iconProblems(): string[] {
  const out: string[] = []
  for (const [id, rows] of Object.entries(ROWS)) {
    const w = rows[0]!.length
    rows.forEach((r, i) => { if (r.length !== w) out.push(`${id} row ${i}: ${r.length} ≠ ${w}`) })
  }
  return out
}

const urls = new Map<string, string>()

/** A data URL for the icon (cached); `grey` draws it in muted tones (off, disabled). */
export function icon(id: IconId, grey = false): string {
  const key = id + (grey ? ':g' : '')
  let url = urls.get(key)
  if (url !== undefined) return url
  if (typeof document === 'undefined') return ''
  const pal = grey ? { ...FIGUR_PAL, k: '#8f86b8' } : FIGUR_PAL
  url = sprite(ROWS[id] as readonly string[], pal).toDataURL()
  urls.set(key, url)
  return url
}

/** The sprite's size in pixels, for a whole-number CSS scale. */
export function iconSize(id: IconId): { w: number; h: number } {
  const rows = ROWS[id]
  return { w: rows[0]!.length, h: rows.length }
}
