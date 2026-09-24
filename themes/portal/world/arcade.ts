/**
 * The arcade hall: four cabinets along the back wall beside the Hall of Fame
 * board, four more on an island between two pillars, a carpet loop around
 * them, the HANGAR door in the back wall, the prize counter with its vendor,
 * a snack table, plants, and the robot by the entrance. 17×11, so the whole
 * hall fits one desktop screen (≈18×11 tiles).
 *
 * A cabinet is a solid machine tile carrying an exit (`art` = the theme id
 * the renderer paints on its marquee). Face it and press A: the lines are
 * the pitch and the confirmation, and closing them starts the game.
 */
import type { ExitDef, MapDef } from '../../zelda/types'

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
    '#t1234ZZBZZ....t#',
    '#,,,,,,,,,,,,,,,#',
    '#.,...........,.#',
    '#.,..I5678I...,.#',
    '#.,,,,,,,,,,,,,.#',
    '#*......,..v...S#',
    '#.nn....,.nnnn..#',
    '#*......,.......#',
    '#.....u.@.....*.#',
    '########d########',
  ],
  // Z: the board is five tiles wide; its wings stay solid.
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    d: { tile: 'D', ent: { t: 'warp', to: 'plaza', entry: 'arcade' } },
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
        talk: [{
          lines: [
            'ROBOT: BEEP. WELCOME TO THE ARCADE. EIGHT CABINETS. FREE PLAY. BOOP.',
            'FACE A CABINET AND PRESS {A}. SCORES GO UP ON THE BOARD AT THE BACK.',
            'THE HANGAR DOOR BACK THERE IS FOR PILOTS. YOUR SHIP AND YOUR RECORDS LIVE IN IT.',
          ],
        }],
      },
    },
  },
}
