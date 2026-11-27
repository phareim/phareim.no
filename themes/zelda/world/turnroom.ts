/**
 * The Turn Room (map `turnroom`): one room that teaches the view as a rule, behind a door in the Puzzle Lab's Weigh
 * House. Square blocks (`□`) are solid in the 8-bit view only, diamond blocks (`◇`) in the isometric one only; in
 * the other view a block is an outline on the floor. Three steps, from the door northwards:
 *
 *   1. a row of diamond blocks: passed in the 8-bit view, so a hero who arrives in the isometric one (a game opens
 *      in it) must turn at the door;
 *   2. a row of square blocks: passed in the isometric view, so the hero turns back in the middle (and a turn tried
 *      while standing in either row's line is refused: STAND CLEAR);
 *   3. the stagger to the chest: turn, cross the diamonds, turn again on the ground between, cross the squares.
 *
 * Every tile the hero can be put down on is floor in both views (`validate.ts`). No foes, no keys, nothing else.
 */
import type { MapDef } from '../types'

export const TURNROOM: MapDef = {
  id: 'turnroom',
  name: 'THE TURN ROOM',
  kind: 'dungeon',
  track: 'dungeon',
  views: ['iso', 'classic'],
  keyring: 'turnroom',
  cell: { w: 16, h: 12 },
  rows: [
    '################',
    '#.....◇..#######',
    '#.....◇..□..9###',
    '#.....###□..s###',
    '#.....##########',
    '#□□□□□□□□□□□□□□#',
    '#..............#',
    '#..............#',
    '#◇◇◇◇◇◇◇◇◇◇◇◇◇◇#',
    '#..............#',
    '#.....h.@......#',
    '########1#######',
  ],
  cells: { '0,0': { name: 'THE TURN ROOM' } },
  marks: {
    '@': { ent: { t: 'entry', id: 'start', dir: 'up' } },
    '1': { ent: { t: 'warp', to: 'puzzlelab', entry: 'from-turnroom' }, tile: 'D' },
    h: { ent: { t: 'sign', lines: ['THE TURN ROOM. SOME THINGS ARE ONLY THERE FROM ONE SIDE.'] } },
    s: { ent: { t: 'sign', lines: ['SQUARE FOR FLAT. DIAMOND FOR DEEP.', "(SOMEBODY HAS UNDERLINED 'STAND CLEAR'.)"] } },
    '9': { ent: { t: 'chest', id: 'turnroom.prize', item: 'bits20' } },
  },
}
