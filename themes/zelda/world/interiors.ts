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

// ---------------------------------------------------------------------------
// The Wildwood
// ---------------------------------------------------------------------------

export const MOSSA: MapDef = {
  id: 'mossa',
  name: "MOSSA'S COTTAGE",
  kind: 'interior',
  track: 'indoor',
  rows: [
    '############',
    '#Y.nn.t.[[.#',
    '#..........#',
    '#.o...m..(.#',
    '#......ff..#',
    '#.Y....ff.o#',
    '#t...,....t#',
    '#o...@.....#',
    '#####D######',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'wildwood', entry: 'mossa' } },
    m: {
      ent: {
        t: 'npc', id: 'mossa', look: 'mossa', dir: 'down',
        talk: [
          { when: { flag: 'got:mossa:heartPiece' }, lines: ['MOSSA: THE GLOWSHROOMS ARE SIMMERING. THE WHOLE HOUSE WILL GLOW FOR A WEEK.', 'MOSSA: YOU AND THAT GIRL COME BY FOR WAFFLES ANY TIME.'] },
          {
            when: { flags: ['took:ww.shroom1', 'took:ww.shroom2', 'took:ww.shroom3'] },
            lines: ['MOSSA: ALL THREE GLOWSHROOMS! OH, YOU DEAR.', 'MOSSA: HERE, SOMETHING I FOUND IN THE MOSS YEARS AGO. IT BEATS LIKE A HEART.'],
            give: 'heartPiece',
          },
          {
            when: { notFlag: 'got:mossa:waffle' },
            lines: [
              "MOSSA: OH! A VISITOR. YOU CUT THROUGH MY THICKET? WELL, IT GROWS BACK.",
              'MOSSA: A GIRL LIVES IN THE BRAMBLES, PAST THE BOULDERS BY THE CAMP. SHE TAKES MY WAFFLES OFF THE WINDOWSILL.',
              "MOSSA: SHE'S FRIGHTENED OF EVERYONE. TAKE HER THIS ONE, FROM ME.",
            ],
            give: 'waffle',
          },
          {
            lines: [
              'MOSSA: THREE GLOWSHROOMS GREW WILD THIS YEAR AND I CAN\'T REACH A SINGLE ONE. MY KNEES, DEAR.',
              'MOSSA: ONE ON THE BEACH. ONE ON RADIO HILL. ONE PAST THE RAVINE, IN THE DEEP WOODS.',
              'MOSSA: BRING ME ALL THREE AND I\'LL GIVE YOU SOMETHING GOOD.',
            ],
          },
        ],
      },
    },
  },
}

export const RADIO: MapDef = {
  id: 'radio',
  name: "DUSTY'S TOWER",
  kind: 'interior',
  track: 'indoor',
  rows: [
    '##########',
    '#M.ww.M[.#',
    '#..i.....#',
    '#....d...#',
    '#Y...f.o.#',
    '#t.......#',
    '#...@...t#',
    '####D#####',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'wildwood', entry: 'radio' } },
    d: {
      ent: {
        t: 'npc', id: 'dusty', look: 'dusty', dir: 'down',
        talk: [
          {
            when: { flag: 'got:dusty:heartPiece' },
            lines: [
              'DUSTY: CEREBRO IS ONLINE! I CAN HEAR THE WHOLE COAST. AND THE LAB\'S OLD NUMBERS STATION.',
              'DUSTY: IT KEEPS SAYING ONE THING: THE LIGHTS WILL SPELL IT. THE VAULT WILL LISTEN.',
              'DUSTY: LUNA SAYS THE LIGHTS ARE IN HER OLD ROOM, DOWN IN THE DEEP LAB. ROOM ELEVEN.',
            ],
          },
          {
            when: { item: 'tube' },
            lines: ['DUSTY: IS THAT A 6L6 TUBE? FROM THE LAB? YOU ABSOLUTE LEGEND.', '(HE SLOTS IT IN. THE WHOLE TOWER HUMS.)', 'DUSTY: TAKE THIS. I WAS SAVING IT FOR A GIRLFRIEND IN CANADA. SHE\'S… REAL. PROBABLY.'],
            give: 'heartPiece',
          },
          {
            lines: [
              'DUSTY: WELCOME TO CEREBRO. BIGGEST RADIO ON THE COAST. CURRENTLY DEAD.',
              'DUSTY: I NEED A VACUUM TUBE. THE LAB HAS THEM. THE LAB ALSO HAS DRONES, SO, YOU KNOW. YOU GO.',
              'DUSTY: SOMEWHERE NEAR THE MAIN BREAKER, I BET. BASEMENT LEVEL.',
            ],
          },
        ],
      },
    },
  },
}
