/**
 * Petter's house, half home and half workshop: three terminals on the back
 * wall that open his profiles, Petter by his desk and its glowing monitor,
 * bookshelves in both back corners, a sofa facing the rug, an aquarium,
 * a patterned rug, potted plants, a framed print on the wall and a toy chest. No email
 * address, on purpose (decided 2026-09-07). 15×10.
 */
import type { ExitDef, MapDef } from '../../zelda/types'

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
    '############S##',
    '#[[.1..2..3..[#',
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
    d: { tile: 'D', ent: { t: 'warp', to: 'plaza', entry: 'home' } },
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
          ],
        }],
      },
    },
  },
}
