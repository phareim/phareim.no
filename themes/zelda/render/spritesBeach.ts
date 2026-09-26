/**
 * The town's beach party: the two DJs (drawn by their booths in exits.ts,
 * waist up behind the table) and the crowd (dancer, surfer, raver). 16×16,
 * `_0`/`_1` alternate at the NPC beat, so every look is a two-step dance.
 * Original designs.
 */

type Rows = string[]

function mirror(src: Rows): Rows {
  return src.map(r => r.split('').reverse().join(''))
}

// ---------------------------------------------------------------------------
// Dancer: long pink hair, cyan crop top, violet shorts; one arm up, then the other.
// ---------------------------------------------------------------------------

const dancer0: Rows = [
  '.kk.............',
  'kssk............',
  'kssk...kkkk.....',
  '.ksk..kmpppk....',
  '.ksk.kpppppmk...',
  '.ksk.kpssssPk...',
  '..kskkpksskPk...',
  '...kskpssSsPk...',
  '....kkPkSSkPk...',
  '....kccccccck...',
  '....kcCcccCcksk.',
  '....ksssssssksk.',
  '....kvvvvvvvkk..',
  '....kvVvkvVvk...',
  '....kssk.kssk...',
  '....kkkk.kkkk...',
]
const dancer1 = mirror(dancer0)

// ---------------------------------------------------------------------------
// Surfer: bleached hair, sunglasses, open teal shirt over bare chest, orange
// board shorts, a can in one hand; nods to the beat.
// ---------------------------------------------------------------------------

const surfer0: Rows = [
  '................',
  '.....kkkkkk.....',
  '....keyeyyek....',
  '...keyyyyyyek...',
  '...kyssssssyk...',
  '...kkckkkkckk...',
  '...kssssssssk...',
  '....ksssSssk....',
  '...ktTsSSsTtk...',
  '..kttTssssTttk..',
  '..ksTtssssttTsk.',
  '..kskoooooookck.',
  '....koYooYook...',
  '....kssk.kssk...',
  '....kssk.kssk...',
  '....kkkk.kkkk...',
]
// The nod: the head drops a pixel into the collar.
const surfer1: Rows = [surfer0[0]!, ...surfer0.slice(0, 8), ...surfer0.slice(9)]

// ---------------------------------------------------------------------------
// Raver: violet bob with a lime streak, black hoodie with a pink print, glow
// sticks in both hands, swung up and down.
// ---------------------------------------------------------------------------

const raver0: Rows = [
  '..l.........c...',
  '..l.........c...',
  '..lk.kkkkk.kc...',
  '..ks.kvvlvvksk..',
  '..kskvvvlvvvsk..',
  '...kvsssssvk....',
  '...kvskssksk....',
  '....ksssSsk.....',
  '...kKKKKKKKKk...',
  '..kKKKpmpKKKKk..',
  '..kKKKKpKKKKKk..',
  '...kKKKKKKKKk...',
  '....kBBBBBBk....',
  '....kBBkkBBk....',
  '....kwwk.kwwk...',
  '....kkkk.kkkk...',
]
const raver1: Rows = [
  '................',
  '................',
  '.....kkkkk......',
  '....kvvlvvk.....',
  '...kvvvlvvvk....',
  '...kvsssssvk....',
  '...kvskssksk....',
  '....ksssSsk.....',
  '...kKKKKKKKKk...',
  '..kKKKpmpKKKKk..',
  '.kKKKKKpKKKKKKk.',
  '.ksKKKKKKKKKKsk.',
  '.kl.kBBBBBBk.ck.',
  '..l.kBBkkBBk.c..',
  '..l.kwwk.kwwkc..',
  '....kkkk.kkkk...',
]

// ---------------------------------------------------------------------------
// The DJs, drawn waist up behind their tables (rows 11–15 hide behind it).
// Mixer: cyan hair in a high fade, big pink headphones, one hand on a cup,
// the other on the mixer. Records: gold cap turned back, a vinyl held up,
// then down on the deck for a scratch.
// ---------------------------------------------------------------------------

const djMixer0: Rows = [
  '......kkkk......',
  '.....kccCck.....',
  '....kccccCck....',
  '..kpkcccccCkpk..',
  '..kpksssssskpk..',
  '..kPkskssksPkP..',
  '...kksssssskk...',
  '....kksSSskk....',
  '..kkvvvwwvvvkk..',
  '.kssvVvvvvvVssk.',
  '.kskvVvvvvvVksk.',
  '.kkkvvvvvvvvkkk.',
  '....kvvvvvvk....',
  '....kVVkkVVk....',
  '................',
  '................',
]
const djMixer1: Rows = [
  '................',
  '......kkkk......',
  '.....kccCck.....',
  '..kpkccccCckpk..',
  '..kpkcccccCkpk..',
  '.kskPksssssPk...',
  '.kskkskssksk....',
  '.ksk.ksssssk....',
  '..kkkvkSSkvvkk..',
  '...kvVvwwvvVssk.',
  '...kvVvvvvvVksk.',
  '...kvvvvvvvvkkk.',
  '....kvvvvvvk....',
  '....kVVkkVVk....',
  '................',
  '................',
]

const djRecords0: Rows = [
  '.kkkk...........',
  'kKKKKk.kkkkk....',
  'kKwwKkkyyyyyk...',
  'kKwwKkyyyyyyYk..',
  'kKKKKkkhhhhhhk..',
  '.kkkkskssksshk..',
  '....ksssssssk...',
  '....ksksSSskk...',
  '...kppkkkkppk...',
  '...kpmpppppPpk..',
  '...kpPppppppsk..',
  '...kppppppppkk..',
  '....kpppppPk....',
  '....kPPkkPPk....',
  '................',
  '................',
]
const djRecords1: Rows = [
  '................',
  '.......kkkkk....',
  '......kyyyyyk...',
  '.....kyyyyyyYk..',
  '.....khhhhhhhk..',
  '.....kskssksshk.',
  '.....ksssssssk..',
  '.....ksksSSskk..',
  '...kkppkkkkppkk.',
  '..kspmpppppPpsk.',
  '..kspPppppppksk.',
  '..kkppppppppkk..',
  '....kpppppPk....',
  '....kPPkkPPk....',
  '................',
  '................',
]

export const BEACH_RAW: Record<string, string[]> = {
  dancer_0: dancer0, dancer_1: dancer1,
  surfer_0: surfer0, surfer_1: surfer1,
  raver_0: raver0, raver_1: raver1,
  dj_mixer_0: djMixer0, dj_mixer_1: djMixer1,
  dj_records_0: djRecords0, dj_records_1: djRecords1,
}
