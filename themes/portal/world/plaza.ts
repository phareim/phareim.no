/**
 * The plaza: phareim.no's front door, a night town square on the neon coast.
 * Petter's house across the north with his name on the roof, the arcade
 * west, a copy of the Keeper's hut east (the way into Neon Shrine), the
 * fountain in the middle, and the coast path south with the PHAREIM.MD
 * newsstand and the GAMES.PHAREIM.NO signpost by the pier. 40×38.
 *
 * The start stands just below Petter's door so the name and two buildings
 * are in view on a phone (≈15×28 tiles: the house and the newsstand) and on
 * a desktop (≈18×11: the house and the ends of the arcade and the hut).
 * tests/portal-world.test.mjs checks both.
 * Tile legend: themes/zelda/types.ts. Marker chars are listed in `marks`.
 */
import type { MapDef } from '../../zelda/types'

export const PLAZA: MapDef = {
  id: 'plaza',
  name: 'PHAREIM.NO',
  kind: 'overworld',
  track: 'village',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTHHHHHHHHHHHHHHHTTTTTTTTTTTT',
    'TTTT....:.T..HHHHHHHHHHHHHHH..T..:..TTTT',
    'TTT..::......HHHHHHHHHHHHHHH...:.....TTT',
    'TT.......:.t.HHHHHHHHHHHHHHH.t....:...TT',
    'TT..:..:.....HHHHHHHhHHHHHHH....:..:..TT',
    'TTTT........,,,,,,,,@,,,,,,,,.......TTTT',
    'TTT..........::,,,,,,,,,,,::.........TTT',
    'TT..HHHHHHHHH:,,,,,,,,,,,,,:HHHHHH....TT',
    'TT..HHHHHHHHH,,,,,t~~~~t,,,tHHHHHH....TT',
    'TT..HHHHHHHHH,,,,,,~~~~,,,,,HHHHHHt...TT',
    'TT.tHHHHHHHHHt,,k,,~~~~,,,,,HHNHHH....TT',
    'TT..HHHHaHHHH,,,,,t~~~~t3,,,,,,4......TT',
    'TT..,,,,,,,,,,,,,,,,,,,,,,,,.........TTT',
    'TTT..........,,,,,,,,,,,y,,,.........TTT',
    'TTTT.........:,,,,,,,,,,,,,:........TTTT',
    'TT...........::,,,,,,,,,,,::..........TT',
    'TT...:T....t.......,,,.......t...:T...TT',
    'TT.............::..,,,1.::............TT',
    'TTTTTTTTTTTTTTTTTT.,,,.TTTTTTTTTTTTTTTTT',
    'TT......T.....HHH..........T.......T..TT',
    'TT..T:......T.HHH::,,,:.;;.....T......TT',
    'TT.*..;;.:*...HHH..,,,.......*..;;:.*.TT',
    'TTT..........tnmnt.,,,..t.:g:.t......TTT',
    'TT.:,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,:TT',
    'TT.:,,,,,,,,,,,,,,,,,,2,,,,,,,,,,,,,,:TT',
    'TT.T...............t,t..............T.TT',
    'TT~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~TT',
    'TT~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~TT',
    'TT~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~TT',
    'TT~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~TT',
    'TT~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~TT',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TT',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TT',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TT',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TT',
  ],
  // The name on the roof of Petter's house, the arcade's marquee, the hut's and the newsstand's signs.
  decals: [
    { x: 20.5, y: 3.15, text: 'PETTER HAREIM', scale: 3, align: 'center', color: '#2ff3ff' },
    { x: 20.5, y: 4.75, text: 'PHAREIM.NO', scale: 2, align: 'center', color: '#ffd23f' },
    { x: 8.5, y: 10.55, text: 'ARCADE', scale: 2, align: 'center', color: '#ff5fd0' },
    { x: 31, y: 10.7, text: 'NEON SHRINE', scale: 1, align: 'center', color: '#2ff3ff' },
    { x: 15.5, y: 22.35, text: 'PHAREIM.MD', scale: 1, align: 'center', color: '#ffd23f' },
  ],
  // Where the doors put you back outside.
  entries: {
    home: { x: 20.5, y: 8.5, dir: 'down' },
    arcade: { x: 8.5, y: 15.5, dir: 'down' },
  },
  marks: {
    '@': { ent: { t: 'entry', id: 'start', dir: 'up' } },
    h: { tile: 'D', ent: { t: 'warp', to: 'home', entry: 'door' } },
    a: { tile: 'D', ent: { t: 'warp', to: 'arcade', entry: 'door' } },
    N: {
      tile: 'D',
      ent: { t: 'exit', id: 'shrine', to: { theme: 'zelda' }, look: 'door', label: 'NEON SHRINE', side: 'down' },
    },
    m: {
      tile: 'n',
      ent: {
        t: 'exit', id: 'kiosk', to: { url: 'https://phareim.md' }, look: 'kiosk', label: 'PHAREIM.MD', side: 'down',
        lines: ["PHAREIM.MD: PETTER'S WRITING. ESSAYS, NOTES AND THINGS HE WORKED OUT THE LONG WAY.", 'TAKE A COPY? PRESS {A}.'],
      },
    },
    g: {
      tile: 'S',
      ent: {
        t: 'exit', id: 'games', to: { url: 'https://games.phareim.no' }, look: 'sign', label: 'GAMES.PHAREIM.NO', side: 'down',
        lines: ['GAMES.PHAREIM.NO: MORE GAMES, ON A SITE OF THEIR OWN.', 'FOLLOW THE SIGN? PRESS {A}.'],
      },
    },
    k: {
      ent: {
        t: 'npc', id: 'kid', look: 'kid', wander: true,
        talk: [{
          lines: [
            'KID: NEW HERE? WALK UP TO ANYTHING THAT GLOWS AND PRESS {A}.',
            'THE ARCADE IS WEST, ONE CABINET PER GAME. THE HUT EAST IS A WHOLE ADVENTURE.',
            'PETTER LIVES RIGHT THERE, UNDER HIS NAME. HE LIKES VISITORS.',
          ],
        }],
      },
    },
    y: { ent: { t: 'npc', id: 'cat', look: 'cat', wander: true, talk: [{ lines: ['MRRROW.', '(THE CAT WAS HERE FIRST.)'] }] } },
    '1': { tile: 'S', ent: { t: 'sign', lines: ["↑ PETTER'S HOUSE   ← THE ARCADE   → NEON SHRINE   ↓ THE COAST"] } },
    '2': { tile: 'S', ent: { t: 'sign', lines: ['THE NEON COAST.   ← PHAREIM.MD   GAMES.PHAREIM.NO →'] } },
    '3': { tile: 'S', ent: { t: 'sign', lines: ['THE FOUNTAIN. MAKE A WISH.', 'NO COINS, PLEASE. THOSE ARE FOR THE ARCADE.'] } },
    '4': { tile: 'S', ent: { t: 'sign', lines: ['NEON SHRINE - AN ADVENTURE.', 'THE SUN WON\'T SET. STEP INSIDE TO GO GET IT BACK.'] } },
  },
}
