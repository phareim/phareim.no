/**
 * The physical puzzles' standing things in the isometric view, built of
 * solids like the other props (`props.ts`, which packs them in its atlas):
 * beam emitters (a lens to each side), mirrors on both diagonals, the prism,
 * receivers dark and lit, valve wheels shut and open, and a boulder rolling
 * along either axis in four frames (a resting one is the props' own
 * `boulder`), and Relight the Sign's lumen taps and sockets, dark and lit.
 * `puzzlePropOf` says which stands for a tile now; pure.
 *
 * Seen from this view's corner a mirror on the diagonal from south-west to
 * north-east ('μ') turns its face to the viewer, and one on the other diagonal
 * ('ν') is seen edge-on: a slim pane with a lit top edge.
 */
import type { Dir, TileChar } from '../../types'
import type { MatName, Solids } from './props'

export type PuzzlePropKind =
  | 'pzEmitterD' | 'pzEmitterU' | 'pzEmitterL' | 'pzEmitterR'
  | 'pzMirrorA' | 'pzMirrorB' | 'pzPrism' | 'pzReceiver' | 'pzReceiverLit' | 'pzValveShut' | 'pzValveOpen'
  | `pzRollX${0 | 1 | 2 | 3}` | `pzRollY${0 | 1 | 2 | 3}`
  | 'pzTap' | 'pzSocket' | 'pzSocketLit'

export const PUZZLE_PROP_KINDS: readonly PuzzlePropKind[] = [
  'pzEmitterD', 'pzEmitterU', 'pzEmitterL', 'pzEmitterR',
  'pzMirrorA', 'pzMirrorB', 'pzPrism', 'pzReceiver', 'pzReceiverLit', 'pzValveShut', 'pzValveOpen',
  'pzRollX0', 'pzRollX1', 'pzRollX2', 'pzRollX3', 'pzRollY0', 'pzRollY1', 'pzRollY2', 'pzRollY3',
  'pzTap', 'pzSocket', 'pzSocketLit',
]

/** Which of them glow by themselves (the materials test asks). */
export const PUZZLE_PROPS_GLOW = /^pz(Emitter|Mirror|Prism|ReceiverLit|Valve|Roll|Tap|SocketLit)/

function plinth(b: Solids) {
  b.box(-8, -8, 0, 8, 8, 3, 'pole')
  b.box(-6.5, -6.5, 3, 6.5, 6.5, 4.5, 'chrome')
}

/** A beam emitter: a squat steel housing, a lens on the side it shines from, a lit stripe on its top toward it. */
function emitter(b: Solids, dir: Dir) {
  const [dx, dy] = dir === 'down' ? [0, 1] : dir === 'up' ? [0, -1] : dir === 'left' ? [-1, 0] : [1, 0]
  b.box(-10, -10, 0, 10, 10, 18, (x, y, z, _nx, _ny, nz) => {
    if (nz > 0.5) return x * dx + y * dy > 3 && Math.abs(x * dy + y * dx) < 2.2 ? 'glassCyan' : Math.abs(x) > 8.6 || Math.abs(y) > 8.6 ? 'chrome' : 'shrine'
    return z < 2 ? 'pole' : z > 16 ? 'chrome' : 'shrine'
  })
  // The lens, standing out of the side it shines from.
  const lx = dx * 11.5
  const ly = dy * 11.5
  const hw = 4.5
  b.box(dx ? lx - 1.5 : -hw, dy ? ly - 1.5 : -hw, 8, dx ? lx + 1.5 : hw, dy ? ly + 1.5 : hw, 16, (_x, _y, z) => (z > 10 && z < 14 ? 'core' : 'glassCyan'))
}

/** A mirror: a pane of glass in a chrome frame on a plinth, on the diagonal `slash` ('/' when true). */
function mirror(b: Solids, slash: boolean) {
  plinth(b)
  const sy = slash ? -1 : 1
  const pane = (x: number, _y: number, z: number): MatName => {
    if (z > 24.5 || z < 6.5) return 'chrome'
    if (Math.abs(x) > 9.5) return 'chrome'
    return z > 20 && z < 22 ? 'core' : 'glassCyan'
  }
  // (Posts close together along the diagonal: a pane standing on it.)
  for (let s = -10.5; s <= 10.5; s += 0.35) b.post(s, sy * s, 4.5, 26, slash ? 1.5 : 2.6, pane)
}

function prism(b: Solids) {
  plinth(b)
  // A pyramid of rose glass, light at its heart.
  for (let i = 0; i < 9; i++) {
    const w = 8 - i * 0.85
    b.box(-w, -w, 4.5 + i * 2.2, w, w, 6.7 + i * 2.2, (_x, _y, z, _nx, _ny, nz) => (nz > 0.5 && z > 14 && z < 20 ? 'core' : i < 3 ? 'blockPink' : 'glassPink'))
  }
}

function receiver(b: Solids, lit: boolean) {
  plinth(b)
  b.post(0, 0, 4.5, 6.5, 4.6, 'chrome')
  b.ball(0, 0, 12, 5.6, 5.6, 5.6, (_x, _y, z) => (lit ? (z > 14 ? 'core' : 'glassCyan') : 'dark'))
}

function valve(b: Solids, open: boolean) {
  b.box(-6, -6, 0, 6, 6, 2.5, 'pole')
  b.post(0, 0, 2.5, 16, 2, 'pole')
  // The wheel faces the viewer's right: a ring of gold round a lit hub.
  b.ball(0, 0, 18, 8.5, 2, 8.5, (x, _y, z) => {
    const r = Math.hypot(x, z - 18)
    if (r < 3) return open ? 'bandCyan' : 'bandPink'
    if (r > 6 || Math.abs(x) < 1.1 || Math.abs(z - 18) < 1.1) return 'gold'
    return 'dark'
  })
}

/** A lumen tap: a squat steel tank on a plinth, a brass wheel on top round a pink hub. */
function tap(b: Solids) {
  b.box(-9, -9, 0, 9, 9, 2.5, 'shrine')
  b.box(-7.5, -7.5, 2.5, 7.5, 7.5, 14, (_x, _y, z, _nx, _ny, nz) => (nz > 0.5 || z > 12.5 ? 'chrome' : 'shrine'))
  b.post(0, 0, 14, 17.5, 1.4, 'chrome')
  b.ball(0, 0, 18.5, 6, 6, 1.4, (x, y) => (Math.hypot(x, y) < 1.8 ? 'bandPink' : 'gold'))
}

/** A socket: the line's riser up the hill, a steel post on a plinth with a glass bulb, dark or lit pink. */
function socket(b: Solids, lit: boolean) {
  plinth(b)
  b.post(0, 0, 4.5, 15, 1.8, 'chrome')
  b.ball(0, 0, 19, 4.6, 4.6, 4.8, (_x, _y, z) => (lit ? (z > 20.5 ? 'core' : 'glassPink') : 'dark'))
}

/** A boulder rolling along x (`axis` 'X') or y, turned a quarter of a quarter turn per frame: a neon band round it shows it. */
function roll(b: Solids, axis: 'X' | 'Y', frame: number) {
  const ph = (frame * Math.PI) / 8
  b.ball(0, 0, 11, 11, 11, 11, (x, y, z) => {
    const u = axis === 'X' ? x : y
    const a = Math.atan2(z - 11, u) - ph
    const m = ((a % Math.PI) + Math.PI) % Math.PI
    return m < 0.32 ? 'bandPink' : 'boulder'
  })
}

export const PUZZLE_BUILD: Record<PuzzlePropKind, (b: Solids) => void> = {
  pzEmitterD: b => emitter(b, 'down'),
  pzEmitterU: b => emitter(b, 'up'),
  pzEmitterL: b => emitter(b, 'left'),
  pzEmitterR: b => emitter(b, 'right'),
  pzMirrorA: b => mirror(b, true),
  pzMirrorB: b => mirror(b, false),
  pzPrism: prism,
  pzReceiver: b => receiver(b, false),
  pzReceiverLit: b => receiver(b, true),
  pzValveShut: b => valve(b, false),
  pzValveOpen: b => valve(b, true),
  pzRollX0: b => roll(b, 'X', 0), pzRollX1: b => roll(b, 'X', 1), pzRollX2: b => roll(b, 'X', 2), pzRollX3: b => roll(b, 'X', 3),
  pzRollY0: b => roll(b, 'Y', 0), pzRollY1: b => roll(b, 'Y', 1), pzRollY2: b => roll(b, 'Y', 2), pzRollY3: b => roll(b, 'Y', 3),
  pzTap: tap,
  pzSocket: b => socket(b, false),
  pzSocketLit: b => socket(b, true),
}

/** What stands for a puzzle tile now: `lit` a receiver a beam reaches (or solved), `open` a valve's flag, `dir` an emitter's way. */
export function puzzlePropOf(t: TileChar, state: { lit?: boolean; open?: boolean; dir?: Dir }): PuzzlePropKind | 'boulder' | null {
  switch (t) {
    case 'β': return state.dir === 'up' ? 'pzEmitterU' : state.dir === 'left' ? 'pzEmitterL' : state.dir === 'right' ? 'pzEmitterR' : 'pzEmitterD'
    case 'μ': return 'pzMirrorA'
    case 'ν': return 'pzMirrorB'
    case 'π': return 'pzPrism'
    case 'ρ': return state.lit ? 'pzReceiverLit' : 'pzReceiver'
    case 'ξ': return state.open ? 'pzValveOpen' : 'pzValveShut'
    case 'κ': return 'boulder'
    case 'Θ': return 'pzTap'
    case 'Λ': return state.lit ? 'pzSocketLit' : 'pzSocket'
  }
  return null
}

/** A rolling boulder's frame: by its axis and how far it has come (tiles). */
export function rollKind(dx: number, along: number): PuzzlePropKind {
  const f = (((Math.floor(along * 4) % 4) + 4) % 4) as 0 | 1 | 2 | 3
  return dx ? `pzRollX${f}` : `pzRollY${f}`
}
