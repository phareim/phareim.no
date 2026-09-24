/**
 * A small peaceful World for the look lab: a plaza with the name in neon,
 * an arcade room with all eight cabinets and the Hall of Fame board, and a
 * home with three terminals. Only for rendering checks; the portal's real
 * maps live in themes/portal/world/.
 */
import type { MapDef, World } from '../../themes/zelda/types'

const PLAZA: MapDef = {
  id: 'plaza',
  name: 'PHAREIM.NO',
  kind: 'overworld',
  track: 'village',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTT...HHHHHHHHHHHHHHHHHHHH...TTT',
    'TT....HHHHHHHHHHHHHHHHHHHH....TT',
    'T..t..HHHHHHHHHHHHHHHHHHHH..t..T',
    'T.....HHHHHHHHHHHHHHHHHHEH.....T',
    'T..:.....,,,,,,,,,,,,,,,,,..:..T',
    'T.......,,..............,,.....T',
    'T:......,....:....:.....,....:.T',
    'T.......,.......@..p....,......T',
    'T...t...,...............,...t..T',
    'T.......,...............,......T',
    'T..;;...,,,,,,,,,,,,,,,,,......T',
    'T..;;...K...g..t~~t....s.......T',
    'T.............:~~~~:...........T',
    'T....:.........~~~~.........:..T',
    'T.............t~~~~t...........T',
    'TT.............................T',
    'TTT..........,,,,,,.........TTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'start', dir: 'up' } },
    p: { ent: { t: 'npc', id: 'petter', look: 'petter', dir: 'down', talk: [{ lines: ['PETTER: HI!'] }] } },
    E: { tile: 'D', ent: { t: 'exit', id: 'home', to: { theme: 'x' }, look: 'door', label: "PETTER'S HOUSE" } },
    K: { tile: 'M', ent: { t: 'exit', id: 'kiosk', to: { url: 'https://phareim.md' }, look: 'kiosk', label: 'PHAREIM.MD' } },
    g: { tile: 'M', ent: { t: 'exit', id: 'gh', to: { url: 'https://github.com/phareim' }, look: 'terminal', art: 'github', label: 'GITHUB' } },
    s: { tile: 'S', ent: { t: 'exit', id: 'games', to: { url: 'https://games.phareim.no' }, look: 'sign', label: 'GAMES.PHAREIM.NO' } },
  },
  decals: [
    { x: 16, y: 3.05, text: 'PETTER HAREIM', scale: 3, align: 'center' },
    { x: 16, y: 4.55, text: 'PHAREIM.NO', scale: 1, align: 'center', color: '#2ff3ff' },
  ],
}

const CAB = (id: string, art: string, label: string) => ({ tile: 'M' as const, ent: { t: 'exit' as const, id, to: { theme: art }, look: 'cabinet' as const, art, label } })

const ARCADE: MapDef = {
  id: 'parcade',
  name: 'THE ARCADE',
  kind: 'interior',
  track: 'indoor',
  rows: [
    '###############E####',
    '#t.......B........t#',
    '#..................#',
    '#..................#',
    '#...1..2....3..4...#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#...5..6....7..8...#',
    '#..................#',
    '#u.......,,........#',
    '#........,,........#',
    '#........@.........#',
    '#########D##########',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'plaza', entry: 'start' } },
    E: { tile: 'D', ent: { t: 'exit', id: 'hangar', to: { theme: 'hangar' }, look: 'door', label: 'HANGAR' } },
    B: { tile: 'I', ent: { t: 'exit', id: 'hof', to: { theme: 'leaderboard' }, look: 'board', label: 'HALL OF FAME' } },
    u: { ent: { t: 'npc', id: 'robot', look: 'robot', dir: 'right', talk: [{ lines: ['BEEP.'] }] } },
    '1': CAB('c1', 'anotherworld', 'ANOTHER SHORE'),
    '2': CAB('c2', 'galaga', 'GALAGA'),
    '3': CAB('c3', 'breakout', 'BREAKOUT'),
    '4': CAB('c4', 'rtype', 'R-TYPE'),
    '5': CAB('c5', 'invaders', 'SPACE INVADERS'),
    '6': CAB('c6', 'starfox', 'STAR FOX'),
    '7': CAB('c7', 'outrun', 'OUTRUN'),
    '8': CAB('c8', 'tetris', 'TETRIS'),
  },
}

const HOME: MapDef = {
  id: 'home',
  name: "PETTER'S HOUSE",
  kind: 'interior',
  track: 'indoor',
  rows: [
    '##############',
    '#t..1..2..3.t#',
    '#............#',
    '#....p.......#',
    '#..,,,,,,,,..#',
    '#o.,......,.o#',
    '#..,......,..#',
    '#..,,,@,,,,..#',
    '######D#######',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'plaza', entry: 'start' } },
    p: { ent: { t: 'npc', id: 'petter', look: 'petter', dir: 'down', talk: [{ lines: ['HI.'] }] } },
    '1': { tile: 'n', ent: { t: 'exit', id: 't1', to: { url: 'https://www.linkedin.com/in/phareim' }, look: 'terminal', art: 'linkedin', label: 'LINKEDIN' } },
    '2': { tile: 'n', ent: { t: 'exit', id: 't2', to: { url: 'https://github.com/phareim' }, look: 'terminal', art: 'github', label: 'GITHUB' } },
    '3': { tile: 'n', ent: { t: 'exit', id: 't3', to: { url: 'https://bsky.app/profile/phareim.no' }, look: 'terminal', art: 'bluesky', label: 'BLUESKY' } },
  },
}

export const LAB: World = {
  maps: { plaza: PLAZA, parcade: ARCADE, home: HOME },
  start: { map: 'plaza', entry: 'start' },
  peaceful: true,
}
