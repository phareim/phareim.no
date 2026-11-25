/**
 * THE OLD QUARRY: the dig & build demo (`MapDef.dig`, docs/games/neon-shrine-dig.md), down the stairs at
 * Lumenby's pit (`demos.ts`). Four tools in four chests, each opening the way to the next: the shovel by the road, the
 * pickaxe in a ring of turf, the axe behind a stone wall, the hammer in a grove. With the hammer: a ramp up
 * the plateau to its chest, planks to the island's, lamps against the foes. Three caches lie buried where
 * pink flowers ring the ground. Drawn for the isometric view (heights); the classic view shows the edges.
 */
import type { MapDef } from '../types'

export const QUARRY: MapDef = {
  id: 'quarry',
  name: 'THE OLD QUARRY',
  kind: 'overworld',
  track: 'overworld',
  // Heights are only drawn in the isometric view.
  views: ['iso'],
  rows: [
    '################################',
    '#.....................~~~~~~~~~#',
    '#.аааааааа...ввввввае.~~~~~~~~~#',
    '#.аа....аа...вtвввваа.~~~~~~~~~#',
    '#.а......а.T.ввв6вввв.~~~...~~~#',
    '#.а..3...е...вввввввв.~~~.5.~~~#',
    '#.а......а...вввввввв.~~~...~~~#',
    '#.аа.....а.T.вввввввв.~~~~~~~~~#',
    '#.аааеаааа............~~~~~~~~~#',
    '#.................g:..~~~~~~~~~#',
    '#.....:...........:.:........T.#',
    '#T...:.:.g..а......:..........T#',
    '#.....:....ааеа.......TTTTTTTT.#',
    '#.ввввввв..еаа......r.T......T.#',
    '#.в.....в......,,.....T......T.#',
    '#.в.r...в.....t,,.r...T..4...T.#',
    '#.в..2..в.:.r..,,...h.T......T.#',
    '#.в...r.в:.:...,,.....T.*.*..T.#',
    '#.вr....в.:..1.,,t....T......T.#',
    '#.ввввввв.....Q,,...T.TTTTTTTT.#',
    '#.........T....E,..........T...#',
    '###############..###############',
  ],
  marks: {
    E: { ent: { t: 'entry', id: 'start', dir: 'up' }, tile: ',' },
    Q: { ent: { t: 'sign', lines: [
      'THE OLD QUARRY. WHAT YOU DIG, YOU KEEP. WHAT YOU KEEP, YOU BUILD WITH.',
      'THE TOOLS ARE WHERE THE LAST SHIFT DROPPED THEM. THE LAST SHIFT WAS IN A HURRY.',
    ] } },
    '1': { ent: { t: 'chest', id: 'quarry.shovel', item: 'shovel' } },
    '2': { ent: { t: 'chest', id: 'quarry.pickaxe', item: 'pickaxe' } },
    '3': { ent: { t: 'chest', id: 'quarry.axe', item: 'axe' } },
    '4': { ent: { t: 'chest', id: 'quarry.hammer', item: 'hammer' } },
    '5': { ent: { t: 'chest', id: 'quarry.island', item: 'bits50' } },
    '6': { ent: { t: 'chest', id: 'quarry.ledge', item: 'bits50' } },
    g: { ent: { t: 'enemy', kind: 'blob' } },
    h: { ent: { t: 'enemy', kind: 'hound' } },
  },
  dig: {
    // The ground is level 1: one below is a hole, the turf and the stone stand at 2 and 3.
    heights: [
      '................................',
      '................................',
      '..22222222...22222233...........',
      '..22....22...22222233...........',
      '..2......2...22222222...........',
      '..2......2...22222222...........',
      '..2......2...22222222...........',
      '..22.....2...22222222...........',
      '..22222222......................',
      '................................',
      '................................',
      '............2...................',
      '...........2332.................',
      '..2222222..222..................',
      '..2.....2.......................',
      '..2.....2.......................',
      '..2.....2.......................',
      '..2.....2.......................',
      '..2.....2.......................',
      '..2222222.......................',
      '................................',
      '................................',
    ],
    caches: [
      { x: 10, y: 17, id: 'quarry.cache1', item: 'bits20' },
      { x: 19, y: 10, id: 'quarry.cache2', item: 'bits50' },
      { x: 6, y: 11, id: 'quarry.cache3', item: 'bits20' },
    ],
  },
}
