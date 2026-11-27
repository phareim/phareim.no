/**
 * ACT THREE, under the stage of Fogstage (docs/worlds/act-three.md): a climb from the stage trap toward the
 * RAINCHECK, played from the side (`kind: 'side'`), one keyring `actthree`. Its treasure is THE LENS
 * (`engine/lens.ts`): painted things (`lie`) and hidden ones (a `veil` on a real platform, a `hidden` chest).
 *
 *   understage → actunder   THE UNDERSIDE (16 × 24)    the Crawlspace below, the Prop Room above: THE LENS
 *              → actdoors   THE THREE DOORS (16 × 12)  the glass taught; the first key
 *              → actbard    THE BOARDS (16 × 16)       BARD; its gate shuts the shaft up
 *              → actflats   THE FLATS (16 × 12)        a painted step, painted chests, a painted door; the second key
 *              → actwings   THE WINGS (16 × 12)        a hidden heart piece; the first locked door
 *              → actloft    THE FLY LOFT (16 × 24)     the Grid below, the Leg above, under sandbags; the second
 *                                                      locked door and the great one
 *              → actstudy   THE DRESSING ROOM (16 × 12) THE UNDERSTUDY; the Big Key
 *   the great door → actcable  THE CABLE (16 × 24)     the climb over the fog, the only falls
 *              → actgondola THE GONDOLA (16 × 16)      THE HALLUCINATOR, the glass's plate, the Weight SOURCES; the way out
 *
 * - On the way on, a step up is 2 tiles at most and a gap 2 at most.
 * - A locked door or a gate fills an opening in a wall that is solid up to the ceiling: nothing is jumped over.
 * - No foe within 8 tiles of a way into its room.
 * - Nothing the way on needs is hidden, and a painted thing is on it only as a wrong guess.
 */
import type { EntDef, MapDef, Mark } from '../types'

const stair = (to: string, entry: string, tile: 'D' | '>' = '>'): Mark => ({ tile, ent: { t: 'warp', to, entry } })
const sign = (text: string): Mark => ({ tile: 'S', ent: { t: 'sign', lines: [text] } })
const chest = (id: string, item: Extract<EntDef, { t: 'chest' }>['item'], more: { big?: boolean; hidden?: true } = {}): Mark => ({ ent: { t: 'chest', id, item, ...more } })
const foe = (kind: 'blob' | 'bat' | 'sentry'): Mark => ({ ent: { t: 'enemy', kind } })
const painted = (as: 'ledge' | 'door' | 'chest', tile?: '#'): Mark => ({ ...(tile ? { tile } : {}), ent: { t: 'lie', as } })
const veil: Mark = { tile: '¯', ent: { t: 'veil' } }
const bag = (phase: number): Mark => ({ ent: { t: 'sandbag', phase } })
const ledge: Mark = { ent: { t: 'ledge' } }
const shut = (flag: string): Mark => ({ tile: 'X', ent: { t: 'gate', open: { flag } } })

/** A room 16 wide and `h` tall: a ceiling, a wall at each side and ground from row `floor` down; `put` replaces rows. */
const room = (h: number, floor: number, put: Record<number, string>): string[] =>
  Array.from({ length: h }, (_, y) => put[y] ?? (y === 0 || y >= floor ? '################' : '#..............#'))

type Spot = [x: number, y: number, dir?: 'left' | 'right']
/** One map of the climb: 16 wide, one camera room of its own height. */
const scene = (id: string, name: string, act: string, rows: string[], entries: Record<string, Spot>, marks: MapDef['marks'], more: { track?: MapDef['track']; card?: string[]; events?: NonNullable<MapDef['cells']>[string]['events'] } = {}): MapDef => ({
  id,
  name,
  kind: 'side',
  track: 'indoor',
  realm: 'fogstage',
  keyring: 'actthree',
  resume: true,
  look: 'fog',
  cell: { w: 16, h: rows.length },
  // The room's name is its scene (the MAP page says it under the map's own); a scene's first room opens on its card.
  cells: { '0,0': { name: act, ...(more.card ? { card: { title: `${act}.`, lines: more.card } } : {}), ...(more.events ? { events: more.events } : {}) } },
  rows,
  marks,
  entries: Object.fromEntries(Object.entries(entries).map(([k, [x, y, dir]]) => [k, { x, y, dir: dir ?? 'right' }])),
  ...(more.track ? { track: more.track } : {}),
})

// SCENE ONE. Below, the Crawlspace: a curb, a ladder, a blob, a bat, and platforms two apart to the top ladder.
// Above, the Prop Room: a crate and shelves, the big chest at the far end of the middle one, the prompter's box.
const UNDERSIDE = scene('actunder', 'THE UNDERSIDE', 'SCENE ONE', room(24, 22, {
  // (Open to the top: a ceiling here would cut the jump onto the stair's shelf.)
  0: '#..............#',
  1: '#............2.#',
  2: '#.6....¯¯¯¯¯¯¯¯#',
  4: '#..¯¯¯.........#',
  5: '#.........3....#',
  6: '#......¯¯¯¯....#',
  8: '#..¯¯¯.......6.#',
  10: '#.7....##.....4#',
  11: '###########Ħ####',
  12: '#..........Ħ...#',
  13: '#..........Ħ...#',
  14: '#.......¯¯¯¯...#',
  15: '#..5...........#',
  16: '#..¯¯¯¯.....6..#',
  18: '#.......Ħ¯¯....#',
  19: '#.......Ħ......#',
  20: '#.......Ħ...¯¯¯#',
  21: '#1...##.Ħ..7...#',
}), { foot: [2.5, 21.5], fromdoors: [12.5, 1.5, 'left'] }, {
  '1': stair('understage', 'upstairs'),
  '2': stair('actdoors', 'foot'),
  '3': chest('actthree.lens', 'lens', { big: true }),
  '4': sign("(THE PROMPTER'S BOX WHISPERS: 'YOU WERE TO ENTER FROM THE LEFT.')"),
  '5': chest('actunder.bits', 'bits20'),
  '6': foe('bat'),
  '7': foe('blob'),
}, { card: ['UNDER THE STAGE.', 'NO APPLAUSE.'] })

// Three pads two tiles up, a door on each: the third is the stair. The key lies in plain sight below.
const THREE_DOORS = scene('actdoors', 'THE THREE DOORS', 'SCENE ONE', room(12, 10, {
  7: '#..3....3....2.#',
  8: '#.¯¯¯..¯¯¯..¯¯¯#',
  9: '#1...4....5....#',
}), { foot: [2.5, 9.5], doors: [12.5, 7.5] }, {
  '1': stair('actunder', 'fromdoors'),
  '2': stair('actbard', 'trapdoor'),
  '3': painted('door'),
  '4': sign('EXIT. EXIT. EXIT.\nWE ARE ALL VERY SURE.'),
  '5': chest('actthree.key1', 'smallKey'),
})

// SCENE TWO. The stage floor: a ledge by a ladder or a jump, and the shaft up behind its doorway, shut until BARD
// falls. (The ledge's east tile, under the shaft's ladder, is solid: nobody jumps past the gate from the floor.) BARD's three hiding places are its own painter's, not tiles (`engine/bossBard.ts`).
const BOARDS = scene('actbard', 'THE BOARDS', 'SCENE TWO', room(16, 12, {
  1: '#.............2#',
  2: '#............¯Ħ#',
  3: '#............#Ħ#',
  4: '#............#Ħ#',
  5: '#............#Ħ#',
  6: '#............#Ħ#',
  7: '#............#Ħ#',
  8: '#............3Ħ#',
  9: '#............XĦ#',
  10: '#........Ħ¯¯¯¯##',
  11: '#1.......Ħ.4...#',
}), { trapdoor: [2.5, 11.5], shaft: [13.5, 1.5, 'left'] }, {
  '1': stair('actdoors', 'doors'),
  '2': stair('actflats', 'foot'),
  '3': shut('actthree.bard'),
  '4': { ent: { t: 'enemy', kind: 'bard', once: 'actthree.bard' } },
}, {
  track: 'boss',
  card: ['THE STAGE.', 'EVERYTHING IS PAINTED.'],
  events: [{ when: { notFlag: 'actthree.bard' }, set: 'actthree.bardcard', lines: ['BARD.\nIT KNOWS EVERY PART\nBUT ITS OWN.'] }],
})

// Two steps up from the floor, one of them paint (3); a tier with three chests, two of them paint (5); a long tier
// with a door at each end, the east one painted on the wall (6).
const FLATS = scene('actflats', 'THE FLATS', 'SCENE TWO', room(12, 10, {
  1: '#..........8...#',
  3: '2..............6',
  4: '#¯¯¯¯¯¯¯¯¯¯¯¯¯¯#',
  5: '#..4..5..5.....#',
  6: '#.¯¯¯¯¯¯¯¯¯¯...#',
  8: '#...33.¯¯......#',
  9: '#1..........7..#',
}), { foot: [2.5, 9.5], doors: [1.5, 3.5] }, {
  '1': stair('actbard', 'shaft'),
  '2': stair('actwings', 'wings', 'D'),
  '3': painted('ledge'),
  '4': chest('actthree.key2', 'smallKey'),
  '5': painted('chest'),
  '6': painted('door', '#'),
  '7': foe('sentry'),
  '8': foe('bat'),
})

// Three hidden platforms (v) up to a hidden chest; at the east end of the floor the first locked door.
const WINGS = scene('actwings', 'THE WINGS', 'SCENE TWO', room(12, 10, {
  1: '#...........####',
  2: '#...........####',
  3: '#.....3.4...####',
  4: '#...vvv.....####',
  5: '#...........####',
  6: '#vv.........####',
  7: '#...........####',
  8: '#...vv......L..#',
  9: '#1..........L.2#',
}), { wings: [2.5, 9.5], fromloft: [13.5, 9.5, 'left'] }, {
  '1': stair('actflats', 'doors', 'D'),
  '2': stair('actloft', 'rope'),
  '3': chest('actthree.heart', 'heartPiece', { hidden: true }),
  '4': foe('bat'),
  v: veil,
})

// SCENE THREE. Below, the Grid: catwalks two apart, zigzagging up under bags, to a ladder. Above, the Leg: a long
// catwalk under three bags that fall one after another, the great door at its west end and the second locked door at
// its east.
const FLY_LOFT = scene('actloft', 'THE FLY LOFT', 'SCENE THREE', room(24, 22, {
  1: '###..........###',
  2: '###6...a...8.###',
  3: '###..........###',
  4: '###..........###',
  5: '###..........###',
  6: '#.K..........L.#',
  7: '2.K.......4..L.3',
  8: '###¯¯Ħ¯¯¯¯¯¯¯###',
  9: '#....Ħ.0.......#',
  10: '#....Ħ.........#',
  11: '#....Ħ.........#',
  12: '#...¯¯¯¯¯¯¯....#',
  13: '#....8...9.....#',
  14: '#.......5...¯¯¯#',
  16: '#...¯¯¯¯¯¯¯....#',
  17: '#....6...7.....#',
  18: '#¯¯¯.........5.#',
  20: '#...¯¯¯¯¯¯¯¯...#',
  21: '#1.............#',
}), { rope: [2.5, 21.5], fromstudy: [14.5, 7.5, 'left'], kdoor: [1.5, 7.5] }, {
  '1': stair('actwings', 'fromloft'),
  '2': stair('actcable', 'foot'),
  '3': stair('actstudy', 'studyin'),
  '4': sign('(THE LEAD\'S UNDERSTUDY. LAST NIGHT IT WAS THE KING.)'),
  '5': foe('bat'),
  // The bags, by their place in the cycle (s).
  '6': bag(0),
  a: bag(0.4),
  '8': bag(0.8),
  '0': bag(1.6),
  '7': bag(2.4),
  '9': bag(3.2),
}, { card: ['THE FLY LOFT.', 'EVERYTHING HANGS.'] })

// A flat floor and two shelves to leave a charge by. The great key comes when the understudy falls.
const DRESSING_ROOM = scene('actstudy', 'THE DRESSING ROOM', 'SCENE THREE', room(12, 10, {
  8: '#...¯¯¯¯.¯¯¯¯..#',
  9: '#1.........2.3.#',
}), { studyin: [2.5, 9.5] }, {
  '1': stair('actloft', 'fromstudy'),
  '2': { ent: { t: 'enemy', kind: 'sentry', tough: true, once: 'actthree.understudy' } },
  '3': { ent: { t: 'chest', id: 'actthree.bigkey', item: 'bigKey', appear: { flag: 'actthree.understudy' } } },
})

// SCENE FOUR. Clamps on the cable, two rows apart, over the fog. At three of them the way is offered twice, one
// clamp each side of the clamp two rows below, and one of the pair is paint (2). Safe ledges (5) on real clamps.
const CABLE = scene('actcable', 'THE CABLE', 'SCENE FOUR', [
  '................',
  '................',
  '................',
  '.......45553....',
  '...¯¯¯¯¯¯¯¯¯¯...',
  '................',
  '....¯¯¯.....222.',
  '........555.....',
  '........¯¯¯.....',
  '................',
  '....¯¯¯.....222.',
  '........555.....',
  '........¯¯¯.....',
  '....555.........',
  '....¯¯¯.........',
  '................',
  '222.....¯¯¯.....',
  '....555.........',
  '....¯¯¯.........',
  '................',
  '........¯¯¯.....',
  '.....1..........',
  '.....#####......',
  '.....#####......',
], { foot: [7.5, 21.5], top: [9.5, 3.5, 'left'] }, {
  '1': stair('actloft', 'kdoor'),
  '2': painted('ledge'),
  '3': stair('actgondola', 'stair'),
  '4': sign('GONDOLA. MAXIMUM LOAD: ONE HERO, THREE OF ANYTHING ELSE.'),
  '5': ledge,
}, { card: ['THE CABLE.', 'THE ACT WENT THIS WAY.'] })

// The gondola: the floor, the glass's plate (painted, `actthreePaint.ts`), THE HALLUCINATOR, and the stair out behind
// a gate that waits on its fall.
const GONDOLA = scene('actgondola', 'THE GONDOLA', 'SCENE FOUR', room(16, 12, {
  ...Object.fromEntries(Array.from({ length: 9 }, (_, k) => [k + 1, '#............###'])),
  9: '#..........h.###',
  10: '#.........hh.3.#',
  11: '#1...4.......X2#',
}), { stair: [2.5, 11.5] }, {
  '1': stair('actcable', 'top'),
  '2': stair('fogstage', 'mast'),
  '3': shut('hallucinator'),
  // The Weight it sat on, on the floor once it has fallen.
  '4': { ent: { t: 'item', id: 'actgondola.weight', item: 'weightSources', appear: { flag: 'hallucinator' } } },
  // Three bodies of one boss: the first of them in the room (the upper one) is the real one (`engine/bossHallucinator.ts`).
  h: { ent: { t: 'enemy', kind: 'hallucinator', once: 'hallucinator' } },
}, {
  track: 'boss',
  events: [
    { when: { notFlag: 'hallucinator' }, set: 'actthree.hallucinatorcard', lines: ['THE HALLUCINATOR.\nIT IS QUITE SURE.\nASK IT ANYTHING.'] },
    { when: { flag: 'hallucinator' }, set: 'actthree.cratesflat', lines: ['(THE CRATES GO FLAT. SOMEBODY ACTUALLY WROTE THE REST.)'] },
  ],
})

/** The climb's maps by id (`lands.ts` collects them into the world). */
export const MAPS: Record<string, MapDef> = {
  actunder: UNDERSIDE, actdoors: THREE_DOORS, actbard: BOARDS, actflats: FLATS, actwings: WINGS, actloft: FLY_LOFT,
  actstudy: DRESSING_ROOM, actcable: CABLE, actgondola: GONDOLA,
}
