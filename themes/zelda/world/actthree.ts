/**
 * ACT THREE, under the stage of Fogstage (docs/worlds/act-three.md): a climb from the stage trap toward the
 * RAINCHECK, played from the side (`kind: 'side'`), one keyring `actthree`. Its treasure is THE LENS
 * (`engine/lens.ts`): painted things (`lie`) and hidden ones (a `veil` on a real platform, a `hidden` chest).
 *
 *   understage → actunder   THE UNDERSIDE (16 × 24)    the Crawlspace below, the Prop Room above: THE LENS
 *              → actdoors   THE THREE DOORS (16 × 12)  the glass taught; the first key
 *              → actbard    THE BOARDS (16 × 16)       the stage floor and its shaft
 *              → actflats   THE FLATS (16 × 12)        a painted step, painted chests, a painted door; the second key
 *              → actwings   THE WINGS (16 × 12)        a hidden heart piece; the first locked door
 *              → actloft    THE FLY LOFT (16 × 24)     so far its floor and a second locked door
 *
 * - On the way on, a step up is 2 tiles at most and a gap 2 at most.
 * - A locked door fills an opening in a wall that is solid up to the ceiling: nothing is jumped over.
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

/** A room 16 wide and `h` tall: a ceiling, a wall at each side and ground from row `floor` down; `put` replaces rows. */
const room = (h: number, floor: number, put: Record<number, string>): string[] =>
  Array.from({ length: h }, (_, y) => put[y] ?? (y === 0 || y >= floor ? '################' : '#..............#'))

type Spot = [x: number, y: number, dir?: 'left' | 'right']
/** One map of the climb: 16 wide, one camera room of its own height. */
const scene = (id: string, name: string, act: string, rows: string[], entries: Record<string, Spot>, marks: MapDef['marks'], more: { track?: MapDef['track']; card?: string[] } = {}): MapDef => ({
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
  cells: { '0,0': { name: act, ...(more.card ? { card: { title: `${act}.`, lines: more.card } } : {}) } },
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
  '4': sign('EXIT. EXIT. EXIT. WE ARE ALL VERY SURE.'),
  '5': chest('actthree.key1', 'smallKey'),
})

// SCENE TWO. The stage floor: a ledge by a ladder or a jump, and the shaft up behind its doorway.
const BOARDS = scene('actbard', 'THE BOARDS', 'SCENE TWO', room(16, 12, {
  1: '#.............2#',
  2: '#............¯Ħ#',
  3: '#............#Ħ#',
  4: '#............#Ħ#',
  5: '#............#Ħ#',
  6: '#............#Ħ#',
  7: '#............#Ħ#',
  8: '#.............Ħ#',
  9: '#.............Ħ#',
  10: '#........Ħ¯¯¯¯¯#',
  11: '#1.......Ħ.....#',
}), { trapdoor: [2.5, 11.5], shaft: [13.5, 1.5, 'left'] }, {
  '1': stair('actdoors', 'doors'),
  '2': stair('actflats', 'foot'),
}, { track: 'boss', card: ['THE STAGE.', 'EVERYTHING IS PAINTED.'] })

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

// The Fly Loft so far: its floor, the rope's stair, and the second locked door with a closet behind it.
const FLY_LOFT = scene('actloft', 'THE FLY LOFT', 'SCENE THREE', room(24, 22, {
  ...Object.fromEntries(Array.from({ length: 19 }, (_, k) => [k + 1, '#...........####'])),
  20: '#...........L..#',
  21: '#1..........L..#',
}), { rope: [2.5, 21.5] }, {
  '1': stair('actwings', 'fromloft'),
})

/** The climb's maps by id (`lands.ts` collects them into the world). */
export const MAPS: Record<string, MapDef> = {
  actunder: UNDERSIDE, actdoors: THREE_DOORS, actbard: BOARDS, actflats: FLATS, actwings: WINGS, actloft: FLY_LOFT,
}
