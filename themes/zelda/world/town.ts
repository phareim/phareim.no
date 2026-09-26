/**
 * The town's rooms: the arcade hall and Petter's house. Their doors open
 * onto the town at the west end of the overworld.
 */
import type { ExitDef, MapDef } from '../types'

/**
 * The arcade's HIGH SCORES sign. This is the offline text; in the browser
 * `hiscore.ts` rewrites the array in place with a real top three from one
 * Hall of Fame game, picked at random on each visit.
 */
export const HIGH_SCORE_SIGN: string[] = [
  'HIGH SCORES',
  '1. KNG  999999   2. KNG  999998   3. KNG  999997',
  'SOMEONE SHOULD DO SOMETHING ABOUT THAT KING.',
]

/**
 * The arcade hall: four cabinets along the back wall beside the Hall of Fame
 * board, a ninth past it (Night of the Dead Battery) and a tenth on the
 * other side of the HANGAR door (Mini World, Ulrikke's game; both 2026-09-26), four
 * more on an island between two pillars, a carpet loop around
 * them with bar stools in front of every cabinet, the HANGAR door in the
 * back wall, the prize counter with its vendor, a snack table, potted
 * plants, the robot by the entrance, the HIGH SCORES sign and a chest.
 * 17×11, so the whole hall fits one desktop screen (≈18×11 tiles).
 *
 * A cabinet is a solid machine tile carrying an exit (`art` = the theme id
 * the renderer paints on its marquee). Face it and press A: the lines are
 * the pitch and the confirmation, and closing them starts the game.
 */
const COIN = 'INSERT COIN? PRESS {A}.'

/** A game cabinet, entered from the tile below it. */
function cabinet(id: string, label: string, lines: string[]): { tile: 'M'; ent: ExitDef } {
  return { tile: 'M', ent: { t: 'exit', id, to: { theme: id }, look: 'cabinet', art: id, label, side: 'down', lines: [...lines, COIN] } }
}

export const ARCADE: MapDef = {
  id: 'arcade',
  name: 'THE ARCADE',
  kind: 'interior',
  track: 'indoor',
  rows: [
    '#############h###',
    '#t1234ZZBZZ.9.0t#',
    '#,iiii,,,,,,,,,,#',
    '#.,...........,.#',
    '#.,..I5678I...,.#',
    '#.,,,,iiii,,,,,.#',
    '#Y......,..v...S#',
    '#.nn....,.nnnn..#',
    '#Q......,......$#',
    '#.....u.@.....Y.#',
    '########d########',
  ],
  // Z: the board is five tiles wide; its wings stay solid.
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    d: { tile: 'D', ent: { t: 'warp', to: 'overworld', entry: 'arcade' } },
    $: { ent: { t: 'chest', id: 'arcade.chest', item: 'bits20' } },
    Q: { tile: 'S', ent: { t: 'sign', lines: HIGH_SCORE_SIGN } },
    '1': cabinet('anotherworld', 'ANOTHER SHORE', [
      'ANOTHER SHORE. A STRANGER WAKES ON AN ALIEN COAST. FIVE CHAPTERS TO GET HOME.',
      'RUN, SWIM, HIDE. THE BEAST IS NEVER FAR BEHIND.',
    ]),
    '2': cabinet('galaga', 'GALAGA', [
      'GALAGA. A SWARM CALLED THE CHOIR SINGS OVER EVERY CHANNEL. SHOOT IT QUIET.',
      'CLAUDE RIDES IN THE SECOND SEAT.',
    ]),
    '3': cabinet('breakout', 'BREAKOUT', [
      'BREAKOUT. ONE PADDLE, ONE BALL, A WALL OF NEON BRICKS.',
    ]),
    '4': cabinet('rtype', 'R-TYPE', [
      'R-TYPE. AN ENDLESS CAVE, A FORCE POD AND A BEAM YOU CHARGE BY HOLDING FIRE.',
      'THE WALLS CLOSE IN THE FURTHER YOU FLY.',
    ]),
    '5': cabinet('invaders', 'SPACE INVADERS', [
      'SPACE INVADERS. FIFTY-FIVE OF THEM, MARCHING DOWN, FASTER WITH EVERY ONE YOU HIT.',
    ]),
    '6': cabinet('starfox', 'STAR FOX', [
      'STAR FOX. ON RAILS THROUGH RINGS, PILLARS AND A GUNSHIP AT THE END OF EVERY SECTOR.',
      'DO A BARREL ROLL.',
    ]),
    '7': cabinet('outrun', 'OUTRUN', [
      'OUTRUN. A CONVERTIBLE, THE COAST ROAD AND A CLOCK THAT NEVER STOPS.',
      'LEFT AT EVERY FORK IS EASIER. RIGHT IS HARDER.',
    ]),
    '8': cabinet('tetris', 'TETRIS', [
      'TETRIS. FOUR BLOCKS AT A TIME. CLEAR THE LINES BEFORE THEY REACH THE TOP.',
    ]),
    '9': cabinet('battery', 'NIGHT OF THE DEAD BATTERY', [
      'NIGHT OF THE DEAD BATTERY. THREE FRIENDS IN RABBIT SUITS, ONE DEAD CAR, ONE VERY CROOKED HOUSE.',
      'A POINT-AND-CLICK ADVENTURE. PICK UP EVERYTHING. TALK TO THE CAT.',
    ]),
    '0': cabinet('miniworld', 'MINI WORLD', [
      'MINI WORLD. ULRIKKE, AGE SEVEN, DESIGNED IT: A SUNNY TOWN OF BLOCKS. MAKE YOUR PEOPLE, DRESS THEM UP, DO UP YOUR HOUSE.',
      'OBBY TOWER, STAR HUNT, FASHION SHOW. WIN BITS, THE SAME BITS YOU FIND OUT HERE. THE ONLY CABINET WITH NO MONSTERS IN IT.',
    ]),
    B: {
      tile: 'I',
      ent: {
        t: 'exit', id: 'leaderboard', to: { theme: 'leaderboard' }, look: 'board', label: 'HALL OF FAME', side: 'down',
        lines: ['HALL OF FAME. THE BEST SCORE ON EVERY CABINET, FROM EVERYONE WHO PLAYS.', 'SEE THE BOARD? PRESS {A}.'],
      },
    },
    h: {
      tile: 'D',
      ent: { t: 'exit', id: 'hangar', to: { theme: 'hangar' }, look: 'door', label: 'HANGAR', side: 'down' },
    },
    v: {
      ent: {
        t: 'npc', id: 'vendor', look: 'vendor', dir: 'down',
        talk: [{ lines: ['VENDOR: PRIZE COUNTER! THE ONLY PRIZE IS YOUR NAME ON THAT BOARD.', 'NO TICKETS NEEDED. JUST BEAT THE PERSON ABOVE YOU.'] }],
      },
    },
    S: { tile: 'S', ent: { t: 'sign', lines: ['HOUSE RULES:', 'NO FOOD NEAR THE CABINETS. NO SPILLS ON THE CARPET. NO RAGE QUITS. (HOLD ESC IF YOU MUST.)'] } },
    u: {
      ent: {
        t: 'npc', id: 'robot', look: 'robot', dir: 'left',
        talk: [
          {
            when: { notFlag: 'item:sword' },
            lines: [
              'ROBOT: BEEP. WELCOME TO THE ARCADE. TEN CABINETS. FREE PLAY. BOOP.',
              'FACE A CABINET AND PRESS {A}. SCORES GO UP ON THE BOARD AT THE BACK.',
              'THE HANGAR DOOR BACK THERE IS FOR PILOTS. YOUR SHIP AND YOUR RECORDS LIVE IN IT.',
            ],
          },
          { when: { notFlag: 'item:disc' }, lines: ['ROBOT: BEEP. THE SHRINE HIDES A PRISM DISC. IT FLIES OVER WATER AND FLIPS FAR SWITCHES. BOOP.'] },
          { when: { notFlag: 'boss' }, lines: ['ROBOT: THE KING HIDES BEHIND SPINNING SHARDS. BREAK THEM, THEN STRIKE HIS EYE. BEEP.'] },
          { lines: ['ROBOT: NEW HIGH SCORE DETECTED. INITIALS: YOU.'] },
        ],
      },
    },
  },
}

/**
 * Petter's house, half home and half workshop: three terminals on the back
 * wall that open his profiles, the red NEW GAME machine beside them (the only
 * way to start the quest over, moved here from the pause menu 2026-09-26),
 * Petter by his desk and its glowing monitor,
 * bookshelves in both back corners, a sofa facing the rug, an aquarium,
 * a patterned rug, potted plants, a framed print on the wall and a toy chest. No email
 * address, on purpose (decided 2026-09-07). 15×10.
 */
/** A terminal on the back wall, used from the tile below it. */
function terminal(id: string, label: string, url: string, lines: string[]): { tile: 'M'; ent: ExitDef } {
  return { tile: 'M', ent: { t: 'exit', id, to: { url }, look: 'terminal', label, side: 'down', lines } }
}

export const HOME: MapDef = {
  id: 'home',
  name: "PETTER'S HOUSE",
  kind: 'interior',
  track: 'indoor',
  rows: [
    '###S###########',
    '#[[.1..2..3.4[#',
    '#.............#',
    '#wwp..(((.~~..#',
    '#....fffff....#',
    '#Y...fffff...Y#',
    '#....fffff....#',
    '#............$#',
    '#t.....@.....t#',
    '#######d#######',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    d: { tile: 'D', ent: { t: 'warp', to: 'overworld', entry: 'home' } },
    '1': terminal('linkedin', 'LINKEDIN', 'https://www.linkedin.com/in/phareim', [
      'LINKEDIN: PETTER HAREIM. THE WORK, PAST AND PRESENT.',
      'OPEN IT? PRESS {A}.',
    ]),
    '2': terminal('github', 'GITHUB', 'https://github.com/phareim', [
      'GITHUB: PHAREIM. CODE, SIDE PROJECTS AND EXPERIMENTS.',
      'OPEN IT? PRESS {A}.',
    ]),
    '3': terminal('bluesky', 'BLUESKY', 'https://bsky.app/profile/phareim.no', [
      'BLUESKY: PHAREIM.NO. SHORT POSTS, NOW AND THEN.',
      'OPEN IT? PRESS {A}.',
    ]),
    // Its lines close into the shell's yes/no question (the engine's `startOver` event).
    '4': {
      tile: 'M',
      ent: {
        t: 'exit', id: 'newgame', to: { reset: true }, look: 'cabinet', art: 'newgame', label: 'NEW GAME', side: 'down',
        lines: [
          'NEW GAME. WIPES YOUR QUEST: ITEMS, HEARTS, BITS, FRIENDS. HERE AND ON YOUR PILOT. YOUR BEST TIME STAYS.',
          'START OVER? PRESS {A}.',
        ],
      },
    },
    S: { tile: '^', ent: { t: 'sign', lines: ['A FRAMED PRINT: THE NEON COAST AT NIGHT, THE SUN STUCK ON THE HORIZON.'] } },
    p: {
      ent: {
        t: 'npc', id: 'petter', look: 'petter', dir: 'left',
        talk: [{
          lines: [
            "PETTER: OH, HI! I'M PETTER HAREIM. WELCOME TO MY LITTLE TOWN.",
            'FATHER, HUSBAND, GEEK, ASPIRING GOOD GUY.',
            'HELP FOLKS. WRITE CODE. BUILD THINGS.',
            "I'M ON LINKEDIN, GITHUB AND BLUESKY. THE TERMINALS ON THE WALL WILL TAKE YOU THERE.",
            'THE RED MACHINE BY THE TERMINALS STARTS YOUR QUEST OVER. ONLY IF YOU MEAN IT.',
          ],
        }],
      },
    },
  },
}
