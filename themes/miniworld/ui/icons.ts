/**
 * Mini World's menu icons: tiny string-map sprites in Neon Shrine's palette
 * (`themes/base/pixel/sprites.ts`), turned into PNG data URLs once and shown
 * as <img> with `image-rendering: pixelated` at a whole-number scale.
 * Client only (they need a canvas).
 */
import { sprite } from '../../base/pixel/sprites'

const ROWS = {
  coin: [
    '...kkkk...',
    '.kkyyyykk.',
    '.kyeeyyyk.',
    'kyeyyyyyYk',
    'kyeyyyyyYk',
    'kyyyyyyyYk',
    'kyyyyyyyYk',
    '.kyyyyYYk.',
    '.kkYYYYkk.',
    '...kkkk...',
  ],
  person: [
    '...kkkkkk...',
    '..knnnnnnk..',
    '..knssssnk..',
    '..kskssksk..',
    '..kssssssk..',
    '...kssssk...',
    '..kkkkkkkk..',
    '.kppppppppk.',
    '.kpkppppkpk.',
    '.kskppppksk.',
    '..kbbkkbbk..',
    '..kkk..kkk..',
  ],
  shirt: [
    '..kkk..kkk..',
    '.kmmmkkmmmk.',
    'kmmmmmmmmmmk',
    'kmmmmmmmmmmk',
    'kkkmmmmmmkkk',
    '..kmmmmmmk..',
    '..kmmmmmmk..',
    '..kmmmmmmk..',
    '..kmmmmmmk..',
    '..kPPPPPPk..',
    '..kkkkkkkk..',
  ],
  bag: [
    '....kkkk....',
    '...kk..kk...',
    '.kkkkkkkkkk.',
    '.kooooooook.',
    '.koooooooNk.',
    '.kkkkkkkkkk.',
    '.koooyyooNk.',
    '.koooooooNk.',
    '.koooooooNk.',
    '.kNNNNNNNNk.',
    '..kkkkkkkk..',
  ],
  house: [
    '.....kk.....',
    '....krrk....',
    '...krrrrk...',
    '..krrrrrrk..',
    '.krrrrrrrrk.',
    'kkkkkkkkkkkk',
    '.kwwwwwwwwk.',
    '.kwcckwnnwk.',
    '.kwcckwnnwk.',
    '.kwwwwwnnwk.',
    '.kwwwwwnnwk.',
    '.kkkkkkkkkk.',
  ],
  pin: [
    '...kkkk...',
    '..krrrrk..',
    '.krrwwrrk.',
    '.krwwwwrk.',
    '.krrwwrrk.',
    '.krrrrrrk.',
    '..krrrrk..',
    '..kRrrRk..',
    '...krRk...',
    '...kRRk...',
    '....kk....',
    '..llllll..',
  ],
  star: [
    '....k....',
    '...kyk...',
    '...kyk...',
    'kkkyyykkk',
    'kyyyyyyyk',
    '.kyyyyyk.',
    '.kyyyyyk.',
    '.kyykyyk.',
    'kyyk.kyyk',
    'kkk...kkk',
  ],
  crown: [
    'k....kk....k',
    'kk..kyyk..kk',
    'kyk.kyyk.kyk',
    'kyykyyyykyyk',
    'kyyyyyyyyyyk',
    'kyyryypyyryk',
    'kyyyyyyyyyyk',
    'kYYYYYYYYYYk',
    'kkkkkkkkkkkk',
  ],
  gift: [
    '..kk....kk..',
    '.kppk..kppk.',
    '..kkpkkpkk..',
    'kkkkkppkkkkk',
    'kccccppcccck',
    'kkkkkppkkkkk',
    '.kcccppccck.',
    '.kcccppccck.',
    '.kcccppccck.',
    '.kCCCppCCCk.',
    '.kkkkkkkkkk.',
  ],
  close: [
    'kk......kk',
    'kwk....kwk',
    '.kwk..kwk.',
    '..kwkkwk..',
    '...kwwk...',
    '...kwwk...',
    '..kwkkwk..',
    '.kwk..kwk.',
    'kwk....kwk',
    'kk......kk',
  ],
  sparkle: [
    '....k....',
    '...kyk...',
    '...kyk...',
    'kkkyeykkk',
    'kyyeeeyyk',
    'kkkyeykkk',
    '...kyk...',
    '...kyk...',
    '....k....',
  ],
  heart: [
    '.kkk.kkk.',
    'kppkkmmpk',
    'kpmppppPk',
    'kppppppPk',
    '.kppppPk.',
    '..kppPk..',
    '...kPk...',
    '....k....',
  ],
  cat: [
    'kk......kk',
    'kok....kok',
    'kookkkkook',
    'kooooooook',
    'kokooookok',
    'kooooooook',
    'koooppoook',
    'kookookook',
    '.kooooook.',
    '..kkkkkk..',
  ],
  bear: [
    '.kk....kk.',
    'knnkkkknnk',
    'knnnnnnnnk',
    'knknnnnknk',
    'knnnnnnnnk',
    'knneeeennk',
    'knnekkennk',
    '.knnnnnnk.',
    '..kkkkkk..',
  ],
  bunny: [
    '.kk....kk.',
    '.kmk..kmk.',
    '.kmk..kmk.',
    '.kwkkkkwk.',
    'kwwwwwwwwk',
    'kwkwwwwkwk',
    'kwwwmmwwwk',
    'kmwwkkwwmk',
    '.kwwwwwwk.',
    '..kkkkkk..',
  ],
  // The shared world (2026-09-26): other players here, and the four emotes.
  people: [
    '..kkk....kkk..',
    '.khhhk..knnnk.',
    '.ksssk..ksssk.',
    '..kkk....kkk..',
    '.kpppk..kbbbk.',
    'kpppppkkbbbbbk',
    'kpppppkkbbbbbk',
    'kkkkkkkkkkkkkk',
  ],
  wave: [
    '.k.k.k.k..',
    'ksksksksk.',
    'ksksksksk.',
    'ksksksksk.',
    'ksssssssk.',
    'kssssssskk',
    'ksssssssks',
    '.ksssssskk',
    '..ksssssk.',
    '...kkkkk..',
  ],
  dance: [
    '...kkkkk',
    '...kvvvk',
    '...kvkkk',
    '...kvk..',
    '...kvk..',
    '.kkkvk..',
    'kvvvvk..',
    'kvvvvk..',
    '.kkkk...',
  ],
  cheer: [
    'k...kkk...k',
    'sk.ksssk.ks',
    'sk.ksssk.ks',
    '.sk.kkk.ks.',
    '..skpppks..',
    '...kpppk...',
    '...kpppk...',
    '...kbkbk...',
    '...kk.kk...',
  ],
} as const

export type IconId = keyof typeof ROWS

const urls = new Map<string, string>()

/** A data URL for the icon (cached); `grey` draws it in muted tones (empty stars, locked things). */
export function icon(id: IconId, grey = false): string {
  const key = id + (grey ? ':g' : '')
  let url = urls.get(key)
  if (url !== undefined) return url
  if (typeof document === 'undefined') return ''
  const pal = grey ? { y: '#e4e0f0', Y: '#c8c0e0', e: '#f4f0ff', k: '#8f86b8' } : undefined
  url = sprite(ROWS[id], pal).toDataURL()
  urls.set(key, url)
  return url
}

/** The sprite's size in pixels, for a whole-number CSS scale. */
export function iconSize(id: IconId): { w: number; h: number } {
  const rows = ROWS[id]
  return { w: rows[0]!.length, h: rows.length }
}
