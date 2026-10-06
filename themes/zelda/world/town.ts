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
 * The arcade hall, 17×11, so the whole hall fits one desktop screen (≈18×11
 * tiles). Three cabinets stand on an island between two pillars, straight
 * ahead of the door: Adventure, Pizza Rescue in the door's own column, and
 * Night of the Dead Battery (2026-10-06; they are the long games, and
 * Petter wanted them where a visitor looks first). The other eight line the
 * back wall, four each side of the Hall of Fame board, with the HANGAR door
 * in the wall above the gap between the right-hand four. A carpet loop runs
 * round the island with bar stools in front of every cabinet; then the prize
 * counter with its vendor, a snack table, potted plants, the robot by the
 * entrance, the HIGH SCORES sign and a chest. Mini World and Lag Din Figur
 * moved to the VIP hall next door on 2026-09-29.
 *
 * A cabinet is a solid machine tile carrying an exit (`art` = the theme id
 * the renderer paints on its marquee). Face it and press A: the lines are
 * the pitch and the confirmation, and closing them starts the game.
 */
const COIN = 'INSERT COIN?'

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
    '#t1234ZZBZZ56.78#',
    '#,iiii,,,,,ii,ii#',
    '#.,...........,.#',
    '#.,...IE09I...,.#',
    '#.,,,,,iii,,,,,.#',
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
    '8': cabinet('russian', 'RUSSIAN BLOCK GAME', [
      'RUSSIAN BLOCK GAME. FOUR BLOCKS AT A TIME. CLEAR THE LINES BEFORE THEY REACH THE TOP.',
    ]),
    '9': cabinet('battery', 'NIGHT OF THE DEAD BATTERY', [
      'NIGHT OF THE DEAD BATTERY. THREE FRIENDS IN RABBIT SUITS, ONE DEAD CAR, ONE VERY CROOKED HOUSE.',
      'A POINT-AND-CLICK ADVENTURE. PICK UP EVERYTHING. TALK TO THE CAT.',
    ]),
    // Eventyrland's open instance (2026-10-05): the same game as the VIP hall's, on a page of its own, no account.
    E: {
      tile: 'M',
      ent: {
        t: 'exit', id: 'adventure', to: { url: 'https://adventure.phareim.no' }, look: 'cabinet', art: 'adventure', label: 'ADVENTURE', side: 'down',
        lines: [
          'ADVENTURE. EVENTYRLAND WITH THE DOOR OPEN: A FAIRY-TALE WORLD IN 3D, SHARED WITH WHOEVER ELSE WALKS IN. NO ACCOUNT. YOU DRAW A NAME AND GO.',
          'IT LIVES ON ITS OWN PAGE AND IS OPEN IN NORWAY ONLY. COME BACK ANY TIME.',
          COIN,
        ],
      },
    },
    // Not a theme: Nova & Rex: The Pizza Rescue is its own site, so the cabinet leaves for the URL (`look=wasteland`
    // opens its pixel look; `from=phareim` makes its title and pause panel offer ARCADE, the way back here).
    '0': {
      tile: 'M',
      ent: {
        t: 'exit', id: 'pizzarescue', to: { url: 'https://fighter.phareim.no/?look=wasteland&from=phareim' }, look: 'cabinet', art: 'pizzarescue', label: 'PIZZA RESCUE', side: 'down',
        lines: [
          'NOVA & REX: THE PIZZA RESCUE. THE GANGS OF NEO BOSTON WRECKED THE PIZZA SHOP AND TOOK THE COOK. SIX PARTS OF TOWN, A BOSS IN EACH.',
          'TWO BUTTONS: A PUNCHES, B KICKS. IT LIVES ON ITS OWN PAGE. PAUSE THERE AND PICK ARCADE TO WALK BACK IN HERE.',
          COIN,
        ],
      },
    },
    B: {
      tile: 'I',
      ent: {
        t: 'exit', id: 'leaderboard', to: { theme: 'leaderboard' }, look: 'board', label: 'HALL OF FAME', side: 'down',
        lines: ['HALL OF FAME. THE BEST SCORE ON EVERY CABINET, FROM EVERYONE WHO PLAYS.', 'SEE THE BOARD?'],
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
              'ROBOT: BEEP. WELCOME TO THE ARCADE. ELEVEN CABINETS. FREE PLAY. BOOP.',
              'THE THREE IN THE MIDDLE ARE THE LONG ONES: ADVENTURE, PIZZA RESCUE, NIGHT OF THE DEAD BATTERY.',
              'FACE A CABINET AND PRESS {A}. SCORES GO UP ON THE BOARD AT THE BACK.',
              'THE HANGAR DOOR BACK THERE IS FOR PILOTS. YOUR SHIP AND YOUR RECORDS LIVE IN IT.',
              'THE KIDS\' GAMES MOVED NEXT DOOR, TO THE VIP HALL. ACCOUNT HOLDERS ONLY.',
            ],
          },
          { when: { notFlag: 'item:disc' }, lines: ['ROBOT: BEEP. THE KING HAS NEVER PLAYED A SINGLE CABINET. SUSPICIOUS. BOOP.'] },
          { when: { notFlag: 'boss' }, lines: ['ROBOT: THE KING TOOK THE SUN. THE ARCADE KEEPS THE LIGHTS ON ITSELF. BEEP.'] },
          { lines: ['ROBOT: NEW HIGH SCORE DETECTED. INITIALS: YOU.'] },
        ],
      },
    },
  },
}

/**
 * The VIP hall, next door to the arcade on its north side. Ulrikke's games
 * stand along the back wall (Mini World and Lag Din Figur moved out of the
 * arcade 2026-09-29, Eventyrland came in the same day) and a bar takes the
 * right-hand corner, with a bartender behind it and a shelf of bottles. The
 * room is dim on purpose: a mirror ball throws four coloured spots over the
 * dance floor and neon glows on the walls. The door in the town is roped off
 * until the visitor is logged in on auth.phareim.no; a guard stands beside
 * it. 17×11, like the arcade.
 */
export const VIP: MapDef = {
  id: 'vip',
  name: 'THE VIP HALL',
  kind: 'interior',
  track: 'indoor',
  ambient: '#8a76b8',
  rows: [
    '#################',
    '#t1.2.3.S..qqqqq#',
    '#.i.i.i...n..W..#',
    '#.........nnnnnn#',
    '#..........i.i.i#',
    '#Y...fffffff...Y#',
    '#....fffffff....#',
    '#....fffffff....#',
    '#Y...fffffff...Y#',
    '#t......@......t#',
    '########d########',
  ],
  props: [
    { kind: 'discoball', x: 8.5, y: 4.2, w: 3, h: 2.3 },
    { kind: 'glow', x: 13.5, y: 1.6, w: 4.5, color: '#ff2fa0' },
    { kind: 'glow', x: 4, y: 1.5, w: 5, color: '#2ff3ff' },
    { kind: 'glow', x: 1.2, y: 9, w: 3.5, color: '#9a4ff0' },
    { kind: 'glow', x: 15.3, y: 9, w: 3.5, color: '#ffd23f' },
  ],
  decals: [
    { x: 9.3, y: 0.3, text: 'VIP LOUNGE', color: '#ff2fa0', scale: 1, align: 'center' },
    { x: 13.5, y: 0.3, text: 'BAR', color: '#2ff3ff', scale: 1, align: 'center' },
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    d: { tile: 'D', ent: { t: 'warp', to: 'overworld', entry: 'vip' } },
    S: { tile: 'S', ent: { t: 'sign', lines: ['THE VIP HALL. FOR PEOPLE WITH AN ACCOUNT.', 'THE GUARD OUTSIDE LET YOU IN, SO YOU ARE ON THE LIST.', 'ULRIKKE\'S GAMES ON THE LEFT. THE BAR IS ON THE RIGHT.'] } },
    W: {
      ent: {
        t: 'npc', id: 'bartender', look: 'barmaid', dir: 'down',
        talk: [
          {
            when: { flag: 'boss' },
            lines: [
              'BARTENDER: WELL, LOOK WHO IT IS. THE ONE WHO PUT THE KING IN HIS PLACE!',
              'THE LAST HIT IS ON THE HOUSE: SUN IN A GLASS. IT IS WARM AND IT GLOWS. DO NOT ASK WHAT IS IN IT.',
            ],
          },
          {
            lines: [
              'BARTENDER: WELCOME TO THE VIP BAR, HONEY! WHAT CAN I GET YOU?',
              'TODAY: THE LASER SUNSET, THE GLITCHY MOJITO, THE LAG SPIKE (IT ARRIVES LATE), AND THE EXTRA LIFE. IT FIZZES AND TASTES LIKE MUSHROOM.',
              'ALL ON THE HOUSE. THE COLOURS ARE NOT NATURAL. THEY ARE BETTER.',
            ],
          },
        ],
      },
    },
    '1': cabinet('miniworld', 'MINI WORLD', [
      'MINI WORLD. ULRIKKE, AGE SEVEN, DESIGNED IT: A SUNNY TOWN OF BLOCKS. MAKE YOUR PEOPLE, DRESS THEM UP, DO UP YOUR HOUSE.',
      'OBBY TOWER, STAR HUNT, FASHION SHOW. WIN BITS, THE SAME BITS YOU FIND OUT HERE. THE ONLY CABINET WITH NO MONSTERS IN IT.',
    ]),
    '2': cabinet('figur', 'LAG DIN FIGUR', [
      'LAG DIN FIGUR. ULRIKKE MADE THIS ONE TOO: MAKE A FIGURE, THEN SEE IT AS MINECRAFT, ROBLOX, TOCA BOCA OR AVATAR WORLD WOULD DRAW IT.',
      'DRAW YOUR OWN CLOTHES. ASK PIP FOR HELP. FREE, NO ADS. THE FIGURE YOU MAKE WALKS OUT HERE AS YOU.',
    ]),
    '3': {
      tile: 'M',
      ent: {
        t: 'exit', id: 'eventyrland', to: { url: 'https://eventyrland.phareim.no' }, look: 'cabinet', art: 'eventyrland', label: 'EVENTYRLAND', side: 'down',
        lines: [
          'EVENTYRLAND. A FAIRY-TALE ADVENTURE IN 3D: A PRINCESS, A VILLAGE, A TRAIN THAT RUNS ON TIME, AND FRIENDS TO MEET IN ONE SHARED WORLD.',
          'IT LIVES ON ITS OWN PAGE, SO THIS ONE OPENS A NEW WORLD. COME BACK ANY TIME.',
          COIN,
        ],
      },
    },
  },
}

/**
 * Petter's house, half home and half workshop: three terminals on the back
 * wall that open his profiles, the red NEW GAME machine beside them (the only
 * way to start the quest over, moved here from the pause menu 2026-09-26),
 * the login console by the aquarium (Sleeper, his server, standing in the
 * corner: it opens the shell's account panel for auth.phareim.no),
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
    '#wwp..(((.~~.5#',
    '#....fffff....#',
    '#....fffff....#',
    '#Y...fffff...Y#',
    '#............$#',
    '#t.....@.....t#',
    '#######d#######',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    d: { tile: 'D', ent: { t: 'warp', to: 'overworld', entry: 'home' } },
    '1': terminal('linkedin', 'LINKEDIN', 'https://www.linkedin.com/in/phareim', [
      'LINKEDIN: PETTER HAREIM. THE WORK, PAST AND PRESENT.',
      'OPEN IT?',
    ]),
    '2': terminal('github', 'GITHUB', 'https://github.com/phareim', [
      'GITHUB: PHAREIM. CODE, SIDE PROJECTS AND EXPERIMENTS.',
      'OPEN IT?',
    ]),
    '3': terminal('bluesky', 'BLUESKY', 'https://bsky.app/profile/phareim.no', [
      'BLUESKY: PHAREIM.NO. SHORT POSTS, NOW AND THEN.',
      'OPEN IT?',
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
    // The login console: A opens the account panel (the engine's `panel` event); it leaves nothing.
    '5': {
      tile: 'M',
      ent: { t: 'exit', id: 'login', to: { panel: 'account' }, look: 'console', label: 'LOGIN', side: 'down' },
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
            'THE TALL ONE BY THE FISH IS SLEEPER, MY SERVER. LOG IN THERE, IF YOU HAVE AN ACCOUNT.',
          ],
        }],
      },
    },
  },
}
