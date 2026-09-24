/**
 * Wildwood people and creatures you talk to: Luna (idle, follower walk,
 * psi pose), Mossa, Dusty, Toby, Max, the owl and the troll. 16×16 unless
 * noted; `_0`/`_1` idle frames face down. Original designs.
 */
import { type Rows, edit, rowsAt, mirror } from './spritesWildKit'

// ---------------------------------------------------------------------------
// Luna — a small girl: buzzed dark hair, blue windbreaker over a pink dress,
// white knee socks. Shorter than the hero (her head starts two rows lower).
// ---------------------------------------------------------------------------

const LUNA_HEAD: Rows = [
  '................',
  '................',
  '......kkkk......',
  '.....khHhhk.....',
  '....khHhhhhk....',
  '....khsssshk....',
  '....kskssksk....',
  '.....kssssk.....',
]
const LUNA_BODY: Rows = [
  '....kbbssbbk....',
  '...kbwbmpbwbk...',
  '...kbBbppbBbk...',
  '...ksBkppkBsk...',
  '....kpppppPk....',
  '...kpmpppppPk...',
]
const LUNA_LEGS: Rows = [
  '....kwk..kwk....',
  '...kNNk..kNNk...',
]
const LUNA_LEGS_W1: Rows = [
  '....kwk..kNNk...',
  '...kNNk...kk....',
]

const lunaDown0 = [...LUNA_HEAD, ...LUNA_BODY, ...LUNA_LEGS]
const lunaDown1 = edit([...LUNA_HEAD, ...LUNA_BODY, ...LUNA_LEGS_W1], [4, 11, 'k'], [4, 10, 's'])
const lunaDown2 = edit([...LUNA_HEAD, ...LUNA_BODY, ...mirror(LUNA_LEGS_W1)], [11, 11, 'k'], [11, 10, 's'])

// Idle: arms wrapped around herself; frame 1 blinks and looks down.
const lunaIdle0 = rowsAt(lunaDown0, 9, [
  '...kbwbmpbwbk...',
  '...kbBssssBbk...',
  '...kbBkppkBbk...',
])
const lunaIdle1 = rowsAt(lunaIdle0, 6, [
  '....ksSssSsk....',
  '.....kssssk.....',
])

const LUNA_HEAD_UP: Rows = [
  '................',
  '................',
  '......kkkk......',
  '.....khHhhk.....',
  '....khHhhhhk....',
  '....khhHhhhk....',
  '....shhhhhhs....',
  '.....khhhhk.....',
]
const LUNA_BODY_UP: Rows = [
  '....kbbbbbbk....',
  '...kbbbbbbbbk...',
  '...kbmmmmmmbk...',
  '...ksBbbbbBsk...',
  '....kpppppPk....',
  '...kpppppppPk...',
]
const lunaUp0 = edit([...LUNA_HEAD_UP, ...LUNA_BODY_UP, ...LUNA_LEGS], [4, 6, 'k'], [11, 6, 'k'])
const lunaUp1 = edit([...LUNA_HEAD_UP, ...LUNA_BODY_UP, ...mirror(LUNA_LEGS_W1)], [4, 6, 'k'], [11, 6, 'k'])
const lunaUp2 = edit([...LUNA_HEAD_UP, ...LUNA_BODY_UP, ...LUNA_LEGS_W1], [4, 6, 'k'], [11, 6, 'k'])

const LUNA_SIDE: Rows = [
  '................',
  '................',
  '......kkkk......',
  '.....khHhhk.....',
  '....khHhhhhk....',
  '....khhhhhssk...',
  '....khhSssksk...',
  '.....khsssSk....',
  '......kbssk.....',
  '.....kbbbbbk....',
  '....kbbwbbbk....',
  '....kbbBbbk.....',
  '....kbBsbpk.....',
  '....kpppppPk....',
  '....kkwwkkk.....',
  '.....kNNNk......',
]
const lunaSide1 = rowsAt(LUNA_SIDE, 10, [
  '...kkbwbbbk.....',
  '...ksBbbbk......',
  '....kbbbpk......',
  '...kpppppPPk....',
  '...kwkkkwk......',
  '..kNNNk.kNNNk...',
])
const lunaSide2 = rowsAt(LUNA_SIDE, 10, [
  '....kbbwbbbk....',
  '....kbbbBsk.....',
  '....kbbbpk......',
  '....kpppppPk....',
  '.....kkwkk......',
  '.....kNNNk......',
])

// Psi: one hand raised toward you, a thin nosebleed, a pink glow at the palm.
const lunaPsi: Rows = [
  '................',
  '................',
  '......kkkk...m.p',
  '.....khHhhk..kk.',
  '....khHhhhhkkssk',
  '....khsssshkkssk',
  '....kskssksk.ksk',
  '.....ksrssk..kbk',
  '....kbbrsbbbbk..',
  '...kbwbmpbbbk...',
  '...kbBbppbBbk...',
  '...ksBkppkBbk...',
  '....kpppppPk....',
  '...kpmpppppPk...',
  '....kwk..kwk....',
  '...kNNk..kNNk...',
].map(r => r.slice(0, 16))

// ---------------------------------------------------------------------------
// Mossa — old forager: grey bun, clay shawl, moss skirt, a basket with one
// glowing mushroom. Frame 1: the mushroom pulses, she smiles.
// ---------------------------------------------------------------------------

const mossa0: Rows = [
  '.......kkk......',
  '......kWwgk.....',
  '.....kkWggkk....',
  '....kWwWWWWgk...',
  '....kWsssssgk...',
  '....ksksssksk...',
  '....kssSsSssk...',
  '...kjjjkkkjjjk..',
  '..kjiiijyjiiijk.',
  '..kaiiiiiiiik.c.',
  '...kaiiiiiak.kck',
  '...kFffffffkktTk',
  '..kFfffffffkswkk',
  '..kFffffffkdnnndk',
  '..kFFFFFFFFknNnNk',
  '...kkkkkkkkkkkkk',
].map(r => r.slice(0, 16))
const mossa1 = edit(mossa0, [14, 9, 'w'], [15, 10, 'c'], [12, 11, 'c'], [6, 5, 'S'], [10, 5, 'S'])

// ---------------------------------------------------------------------------
// Dusty — curly hair, white trucker cap, big headphones with cyan lights.
// Frame 1: eyes closed, nodding to the signal; the cups flash pink.
// ---------------------------------------------------------------------------

const dusty0: Rows = [
  '................',
  '.....kkkkkk.....',
  '....kwwwwwwk....',
  '...kkwwpmwwkk...',
  '..kgkBBBBBBkgk..',
  '..kgknsssssnkgk.',
  '..kckskssskskck.',
  '..kgknsssssnkgk.',
  '....knkssknk....',
  '...kkooooookk...',
  '..koowyywoooook.'.slice(0, 16),
  '..ksoooooooosk..',
  '...kbbbbbbbbk...',
  '...kbbbkkbbbk...',
  '...kwwk..kwwk...',
  '...kkkk..kkkk...',
]
const dusty1 = edit(rowsAt(dusty0, 6, ['..kpksSsssSskpk.']), [7, 3, 'p'])

// ---------------------------------------------------------------------------
// Toby — bowl cut, gold/violet striped shirt, walkie-talkie on the belt.
// Frame 1: the walkie's light blinks and he glances sideways.
// ---------------------------------------------------------------------------

const toby0: Rows = [
  '................',
  '.....kkkkkk.....',
  '....knnjnnnk....',
  '...knjnnnnnnk...',
  '...knnnnnnnnk...',
  '...kksssssskk...',
  '...kskksskksk...',
  '....ksSssSsk....',
  '....kkksskkk....',
  '...kyyyyyyyyk...',
  '..kvvvvvvvvvvk..',
  '..ksyyyyyyyyskk.',
  '...kNNNeNNkgWgk.',
  '...kbbbkkbkgrgk.',
  '...kwwk..kkkkkk.',
  '...kkkk..kkk....',
]
const toby1 = edit(toby0, [12, 13, 'l'], [14, 10, 'k'], [5, 6, 's'], [6, 6, 'k'], [5, 6, 'k'], [6, 6, 's'], [8, 6, 'k'], [9, 6, 's'])

// ---------------------------------------------------------------------------
// Max — ginger hair past the shoulders, teal jacket, a pink skateboard
// tucked under her arm. Frame 1: she blows her fringe up.
// ---------------------------------------------------------------------------

const max0: Rows = [
  '................',
  '.....kkkkkk.....',
  '....kojooook....',
  '...kojoooooik...',
  '...kojssssjik.kk',
  '...koskssksik.kpk',
  '...koiSssSiik.kpk',
  '..koiikSSkiiokkPk',
  '..kikttttttkiykPk',
  '..kiktttwttkkpPk',
  '...ktttwtttskPPk',
  '...ksBBBBBBkkPPk',
  '....kBBBBBBkykPk',
  '....kBBkkBBk.kk.',
  '....kwwk.kwwk...',
  '....kkkk.kkkk...',
].map(r => r.slice(0, 16))
const max1 = edit(max0, [6, 2, 'j'], [7, 1, 'o'], [7, 0, 'k'], [7, 7, 'k'], [8, 7, 'k'])

// ---------------------------------------------------------------------------
// Owl — round, perched on a branch; frame 1 blinks.
// ---------------------------------------------------------------------------

const owl0: Rows = [
  '................',
  '..kk........kk..',
  '..knkkkkkkkknk..',
  '..knnnjnnjnnnk..',
  '.kndddnnnndddnk.',
  '.kddkkkddkkkddk.',
  '.kdkeykddkeykdk.',
  '.kdkykkYYkykkdk.',
  '.kndkkdkkdkkdnk.',
  '.knnddddddddnnk.',
  '.kNnddNddNddnNk.',
  '.kNnndNddNdnNNk.',
  '..kNNnnnnnnNNk..',
  '..kkkykkkkykkk..',
  '.kNNNnNNNNnNNNNk',
  '.kkkkkkkkkkkkkkk',
]
const owl1 = rowsAt(owl0, 5, [
  '.kddddddddddddk.',
  '.kdkkkkddkkkkdk.',
  '.kddddkYYkddddk.',
])

// ---------------------------------------------------------------------------
// Troll — 22×24. Mossy hair with a sprout, a big nose, a gentle underbite,
// a moss tunic and a tufted tail. He lost his hat. Frame 1 blinks and wags.
// ---------------------------------------------------------------------------

const troll0: Rows = [
  '...............lk.....',
  '.......kkkkkkklLk.....',
  '.....kkfFffffFkk......',
  '....kfffFfffffffFk....',
  '...kfFffffFffffffFk...',
  '..kffffxxxxxxxxffFfk..',
  '..kfFxxXXxxxxXXxxfFk..',
  '.kkkfxwkxXXXXxkwxfkkk.',
  'kxxkxxxxXdwddXxxxxkxxk',
  '.kXkxxxXddddddXxxxkXk.',
  '..kxxxxXdddddxXxxxxk..',
  '...kxxxXddddxxXxxxk...',
  '...kxxxxXxxxxXxxxxk...',
  '...kxxxxxXXXXxxxxxk...',
  '...kxkxxxxxxxxxxkxk...',
  '....kxkwkkkkkkwkxk....',
  '..kkkkxxxxxxxxxxkkk...',
  '.kxxxkddddddddddkxxk..',
  '.kxXxkddddddddddkxXxk.',
  '.kxkxkfffFffffFfkxkxk.',
  '.kkkkkfFfffFffFfkkkkk.',
  '.....kXXXkkkkXXXkkfk..',
  '....kxxxxk..kxxxxkfFk.',
  '....kkkkkk..kkkkkkkk..',
]
const troll1 = edit(troll0, [6, 7, 'k'], [15, 7, 'k'],
  [18, 21, 'f'], [19, 21, 'k'], [18, 22, 'k'], [19, 22, 'f'], [20, 22, 'F'], [20, 21, 'k'], [21, 22, 'k'])

export const FOLK: Record<string, Rows> = {
  luna_0: lunaIdle0, luna_1: lunaIdle1,
  luna_down_0: lunaDown0, luna_down_1: lunaDown1, luna_down_2: lunaDown2,
  luna_up_0: lunaUp0, luna_up_1: lunaUp1, luna_up_2: lunaUp2,
  luna_side_0: LUNA_SIDE, luna_side_1: lunaSide1, luna_side_2: lunaSide2,
  luna_psi: lunaPsi,
  mossa_0: mossa0, mossa_1: mossa1,
  dusty_0: dusty0, dusty_1: dusty1,
  toby_0: toby0, toby_1: toby1,
  max_0: max0, max_1: max1,
  owl_0: owl0, owl_1: owl1,
  troll_0: troll0, troll_1: troll1,
}
