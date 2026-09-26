/**
 * The town's beach, a slow chill-out by the pier: the two DJs (drawn by
 * their booths in exits.ts, waist up behind the table) and the people
 * lying about on the sand (sitting hippies, a smoker, a guitar, someone
 * asleep under a straw hat, a slow dancer) and their bonfire. 16×16,
 * `_0`/`_1` alternate on the beach track's beat (renderer.ts). Original
 * designs.
 */

type Rows = string[]

/** Move rows y0..y1 one pixel right (a sway of the head and shoulders). */
function sway(src: Rows, y0: number, y1: number): Rows {
  return src.map((r, y) => (y >= y0 && y <= y1 ? '.' + r.slice(0, 15) : r))
}

function edit(src: Rows, ...ops: Array<[number, number, string]>): Rows {
  const out = src.map(r => r.split(''))
  for (const [x, y, ch] of ops) out[y]![x] = ch
  return out.map(r => r.join(''))
}

// ---------------------------------------------------------------------------
// Hippie: cross-legged on a striped blanket, long hair, lime headband,
// tie-dye shirt, eyes shut; sways with the music.
// ---------------------------------------------------------------------------

const hippie0: Rows = [
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '....knnnnnnk....',
  '....kllllllk....',
  '....knssssnk....',
  '....knSssSnk....',
  '....knsSSsnk....',
  '...knnkssknnk...',
  '...kpytpyptpk...',
  '..kspytpytpysk..',
  '..ksktpyptpksk..',
  '.kbbbbbbbbbbbbk.',
  '.kbBbbsSSsbbBbk.',
  '.yoyoyoyoyoyoyo.',
]
const hippie1 = sway(hippie0, 3, 9)

// ---------------------------------------------------------------------------
// Smoker: rasta beanie, poncho, knees up on a woven mat. Frame 0 the joint
// rests by the knee with its ember lit; frame 1 it is at the lips. The
// smoke is drawn live over the sprite (renderer.ts).
// ---------------------------------------------------------------------------

const smoker0: Rows = [
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '....kLLLLLLk....',
  '....kyyyyyyk....',
  '....krrrrrrk....',
  '...kNsSssSsNk...',
  '...kNssssssNk...',
  '....kkSSSSkk....',
  '...kddoddoddk...',
  '..ksdoddoddosk..',
  '..kskBbbbbbkswo.',
  '..kbbbbkkbbbbk..',
  '..kNNNk..kNNNk..',
  '.aiaiaiaiaiaiai.',
]
const smoker1 = edit(smoker0,
  // The hand comes up to the mouth with the joint; the ember glows brighter.
  [13, 12, 'k'], [14, 12, '.'], [15, 12, '.'], [12, 12, 'k'],
  [12, 9, 'k'], [13, 9, 's'], [12, 10, 'k'], [13, 10, 's'], [13, 11, 'k'],
  [10, 9, 'w'], [11, 9, 'w'], [14, 9, 'k'], [14, 8, 'y'],
)

// ---------------------------------------------------------------------------
// Guitar: long fair hair with a flower, an acoustic guitar across the lap,
// the strumming hand up, then down.
// ---------------------------------------------------------------------------

const guitar0: Rows = [
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '....keyyyyek....',
  '...kpyyyyyyyk...',
  '...kyssssssyk...',
  '...kysSssSsyk...',
  '...kyssSSssyk...',
  '...kyykttkyyk..k',
  '..kkkttttttk..kn',
  '.kooYkttttsknnnk',
  '.koknoonnnnnkk..',
  '.kookoostk......',
  '..kYooYkbbbbk...',
  '.aiaiaiaiaiaiai.',
]
const guitar1 = edit(guitar0, [9, 13, 'k'], [8, 13, 'o'], [8, 12, 's'], [7, 12, 'k'])

// ---------------------------------------------------------------------------
// Asleep on a towel, a straw hat over the face; the chest rises and falls.
// ---------------------------------------------------------------------------

const sleeper0: Rows = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..kkkk..........',
  '.kyYyyk.........',
  'kyyyyyyk.kkkkk..',
  'kyyYyyyksssssskk',
  'kkkkkkkkssooookk',
  '.kcwcwcwkkkkkssk',
  '.kcwcwcwcwcwckkk',
  '..kkkkkkkkkkkk..',
]
const sleeper1 = edit(sleeper0, [10, 9, 'k'], [11, 9, 'k'], [12, 9, 'k'], [10, 10, 's'], [11, 10, 's'], [12, 10, 's'])

// ---------------------------------------------------------------------------
// Slow dancer: a long flowing dress, flowers in the hair, arms out to one
// side, then the other.
// ---------------------------------------------------------------------------

const twirler0: Rows = [
  '................',
  '......kkkk......',
  '.....khphHk.....',
  '....khhhhhhk....',
  '....khsssshk....',
  '....khSssShk....',
  '....khssSshk....',
  '.....khsshk.....',
  '.kkkkvvvvvvk....',
  'kssssvmvvmvk....',
  '.kkkvmvvvvmvk...',
  '....kvvmvvvvk...',
  '...kvmvvvvmvvk..',
  '...kvvvvmvvvvk..',
  '..kvvmvvvvvmvvk.',
  '..kkkkkssskkkkk.',
]
const twirler1 = twirler0.map(r => r.split('').reverse().join(''))

// ---------------------------------------------------------------------------
// The bonfire in its ring of stones.
// ---------------------------------------------------------------------------

const bonfire0: Rows = [
  '................',
  '................',
  '................',
  '.......r........',
  '......ro...r....',
  '.....roo..ro....',
  '.....royr.roo...',
  '....rroyyroyor..',
  '....royyeyyyor..',
  '...rroyeeeyyorr.',
  '...royyeeeeyor..',
  '..knnroyyyyornk.',
  '.kgGnnNnnNnnnGgk',
  '.kGgggGgGggggGk.',
  '..kkkkkkkkkkkk..',
  '................',
]
const bonfire1: Rows = [
  '................',
  '................',
  '..........r.....',
  '....r.....or....',
  '....or...roo....',
  '....ror..royr...',
  '...rrorrroyyr...',
  '...royyrroyor...',
  '...royyeyyyor...',
  '..rroyeeeyyorr..',
  '...royeeeeyyor..',
  '..knnroyyyyornk.',
  '.kgGnnNnnNnnnGgk',
  '.kGgggGgGggggGk.',
  '..kkkkkkkkkkkk..',
  '................',
]

// ---------------------------------------------------------------------------
// The DJs, drawn waist up behind their tables (rows 11–15 hide behind it).
// Jam: long hair, a flower crown, round shades, a tie-dye shirt, nodding
// slowly with a hand on the headphones. Radio: an old hippie with a grey
// ponytail and beard, a bucket hat, a poncho, a record held up to look at.
// ---------------------------------------------------------------------------

const djMixer0: Rows = [
  '......kkkk......',
  '.....kpnlnk.....',
  '....knnnnnnk....',
  '..kvknnnnnnkvk..',
  '..kvknsssssnvk..',
  '..kvkkkskkknvk..',
  '...knsssssnnk...',
  '....knsSSsnk....',
  '..kkpytpyptpkk..',
  '.kssytpytpytssk.',
  '.kskpytpyptpksk.',
  '.kkkytpytpytkkk.',
  '....kbbbbbbk....',
  '....kBBkkBBk....',
  '................',
  '................',
]
const djMixer1: Rows = [
  '................',
  '......kkkk......',
  '.....kpnlnk.....',
  '..kvknnnnnnkvk..',
  '..kvknnnnnnkvk..',
  '.kskknsssssnvk..',
  '.kskkkkskkknvk..',
  '.ksk.knsSSnnk...',
  '..kkpkyssyptpk..',
  '...kytpytpytssk.',
  '...kpytpyptpksk.',
  '...kytpytpytkkk.',
  '....kbbbbbbk....',
  '....kBBkkBBk....',
  '................',
  '................',
]

const djRecords0: Rows = [
  '.kkkk...........',
  'kKKKKk.kkkkkk...',
  'kKwwKk.kddddk...',
  'kKwwKkkddddddk..',
  'kKKKKkWkssssskW.',
  '.kkkkskskssskkWk',
  '....kWsssssWk.Wk',
  '....kWWWWWWWk...',
  '...kddkWWWkddk..',
  '...kdoddddddok..',
  '...kddoddddodsk.',
  '...kddddoddddkk.',
  '....kddoddddk...',
  '....kiikkiik....',
  '................',
  '................',
]
const djRecords1: Rows = [
  '................',
  '.......kkkkkk...',
  '.......kddddk...',
  '......kddddddk..',
  '......kkssssskW.',
  '......kskssskkWk',
  '.....kWsssssWkWk',
  '.....kWWWWWWWk..',
  '...kkddkWWWkddk.',
  '..ksdoddddddosk.',
  '..ksdoddddodsk..',
  '..kkddddoddddk..',
  '....kddoddddk...',
  '....kiikkiik....',
  '................',
  '................',
]

export const BEACH_RAW: Record<string, string[]> = {
  hippie_0: hippie0, hippie_1: hippie1,
  smoker_0: smoker0, smoker_1: smoker1,
  guitar_0: guitar0, guitar_1: guitar1,
  sleeper_0: sleeper0, sleeper_1: sleeper1,
  twirler_0: twirler0, twirler_1: twirler1,
  bonfire_0: bonfire0, bonfire_1: bonfire1,
  dj_mixer_0: djMixer0, dj_mixer_1: djMixer1,
  dj_records_0: djRecords0, dj_records_1: djRecords1,
}
