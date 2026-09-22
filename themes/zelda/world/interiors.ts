/**
 * Small single-room maps entered through overworld doors: the Night Market
 * shop, the arcade and the cave behind the cracked lake cliff.
 */
import type { MapDef } from '../types'

export const SHOP: MapDef = {
  id: 'shop',
  name: 'NIGHT MARKET SHOP',
  kind: 'interior',
  track: 'indoor',
  rows: [
    '##############',
    '#M..t....t..M#',
    '#......v.....#',
    '#nn1nn2nn3nnn#',
    '#............#',
    '#..,,,,,,,,..#',
    '#..,......,..#',
    '#o.,......,.o#',
    '#..,,,,@,,,..#',
    '#######D######',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'overworld', entry: 'shop' } },
    v: {
      ent: {
        t: 'npc', id: 'vendor', look: 'vendor', dir: 'down',
        talk: [{ lines: ['VENDOR: WELCOME, NIGHT OWL. FACE AN ITEM ON THE COUNTER AND PRESS {A} TO BUY.'] }],
      },
    },
    '1': { tile: 'n', ent: { t: 'shop', id: 'shop.bombs', item: 'bombs5', price: 15 } },
    '2': { tile: 'n', ent: { t: 'shop', id: 'shop.heart', item: 'heart', price: 10 } },
    '3': { tile: 'n', ent: { t: 'shop', id: 'shop.piece', item: 'heartPiece', price: 100, once: true } },
  },
}

export const ARCADE: MapDef = {
  id: 'arcade',
  name: 'THE ARCADE',
  kind: 'interior',
  track: 'indoor',
  rows: [
    '##############',
    '#MMM.t..t.MMM#',
    '#............#',
    '#.u..........#',
    '#..,,,,,,,,..#',
    '#M.,......,.M#',
    '#M.,..o...,.M#',
    '#S.,......,.$#',
    '#..,,,@,,,,..#',
    '######D#######',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'overworld', entry: 'arcade' } },
    $: { ent: { t: 'chest', id: 'arcade.chest', item: 'bits20' } },
    S: { tile: 'S', ent: { t: 'sign', lines: ['HIGH SCORES', '1. KNG  999999   2. KNG  999998   3. KNG  999997', 'SOMEONE SHOULD DO SOMETHING ABOUT THAT KING.'] } },
    u: {
      ent: {
        t: 'npc', id: 'robot', look: 'robot', dir: 'right',
        talk: [
          { when: { notFlag: 'item:disc' }, lines: ['ROBOT: BEEP. THE SHRINE HIDES A PRISM DISC. IT FLIES OVER WATER AND FLIPS FAR SWITCHES. BOOP.'] },
          { when: { notFlag: 'boss' }, lines: ['ROBOT: THE KING HIDES BEHIND SPINNING SHARDS. BREAK THEM, THEN STRIKE HIS EYE. BEEP.'] },
          { lines: ['ROBOT: NEW HIGH SCORE DETECTED. INITIALS: YOU.'] },
        ],
      },
    },
  },
}

export const CAVE: MapDef = {
  id: 'cave',
  name: 'LAKESIDE CAVE',
  kind: 'interior',
  track: 'indoor',
  cells: { '0,0': { dark: true } },
  rows: [
    '##############',
    '##....##....##',
    '#.a........a.#',
    '#...o....o...#',
    '#.....II.....#',
    '#.....5......#',
    '#.o.........o#',
    '#............#',
    '##....@....###',
    '######D#######',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'overworld', entry: 'cave' } },
    '5': { ent: { t: 'item', id: 'cave.piece', item: 'heartPiece' } },
    a: { ent: { t: 'enemy', kind: 'bat' } },
  },
}
