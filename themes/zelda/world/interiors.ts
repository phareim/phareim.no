/**
 * Small single-room maps entered through overworld doors: the Keeper's hut,
 * the Night Market shop and the cave behind the cracked lake cliff. The
 * town's rooms (the arcade, Petter's house) are in town.ts.
 */
import type { MapDef } from '../types'

export const HUT: MapDef = {
  id: 'hut',
  name: "KEEPER'S HUT",
  kind: 'interior',
  track: 'indoor',
  rows: [
    '############',
    '#nn.t.,..M.#',
    '#nn...,....#',
    '#.....,..nn#',
    '#o.y..,..nn#',
    '#.....,....#',
    '#t....,...o#',
    '#o....@...t#',
    '######D#####',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'overworld', entry: 'hut' } },
    y: {
      ent: {
        t: 'npc', id: 'hutcat', look: 'cat', dir: 'down',
        talk: [{ lines: ["THE KEEPER'S CAT OPENS ONE EYE, THEN THE OTHER. MRRP."] }],
      },
    },
  },
}

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
