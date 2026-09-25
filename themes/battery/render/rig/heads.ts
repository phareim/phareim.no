/**
 * The heads: hoods, ears, hair and faces for the three friends and the
 * Professor, in front, side (facing right) and back views. Faces are small
 * string maps stamped on the skin so each expression is drawn by hand:
 * Kjell's big glasses and worried brows, Dag's calm half-lids in a ginger
 * beard, Espen's pie eyes and wide grin, the Professor's monocle.
 *
 * (hx, hy) is the head's centre in local pixels (feet at 0, 0).
 */
import { stamp, tone } from './doll'
import type { Doll, Mat } from './doll'
import { INK, MAT } from './looks'
import type { Look } from './looks'
import type { FrameDesc, Rig } from './poses'

type P = [number, number]

// ---------------------------------------------------------------------------
// Face maps
// ---------------------------------------------------------------------------

/** Small mouths, 4 wide (Kjell, Dag, the Professor). */
const MOUTH_S: Record<string, readonly string[]> = {
  shut: ['....', '.mm.', '....'],
  smile: ['m..m', '.mm.', '....'],
  wobble: ['....', '.m.m', 'm.m.'],
  open: ['.mm.', 'mttm', '.mm.'],
  o: ['.mm.', 'm..m', 'mttm', '.mm.'],
  grin: ['mmmm', 'mTTm', '.mm.'],
  teeth: ['mmmm', 'TTTT', 'mmmm'],
  talk1: ['....', 'mmmm', '.mm.'],
  talk2: ['.mm.', 'mttm', 'mttm', '.mm.'],
  chew: ['....', 'mmm.', '....'],
  hmm: ['....', '..mm', '....'],
}
/** Espen's big mouths, 6 wide. */
const MOUTH_L: Record<string, readonly string[]> = {
  shut: ['......', '.mmmm.', '......'],
  smile: ['m....m', '.mmmm.', '......'],
  wobble: ['......', 'mm.mm.', '..m..m'],
  open: ['.mmmm.', 'mttttm', '.mmmm.'],
  o: ['..mm..', '.mttm.', '.mttm.', '..mm..'],
  grin: ['mmmmmm', 'mTTTTm', '.mttm.', '..mm..'],
  teeth: ['mmmmmm', 'mTTTTm', 'mmmmmm'],
  talk1: ['.mmmm.', '.mttm.', '..mm..'],
  talk2: ['mmmmmm', 'mttttm', '.mttm.', '..mm..'],
  chew: ['......', '.mm.m.', '..m...'],
  hmm: ['......', '...mmm', '......'],
}
/** Side mouths: 2 wide (small) or 3 wide (Espen), at the face's front edge. */
const MOUTH_SIDE_S: Record<string, readonly string[]> = {
  shut: ['..', 'm.', '..'],
  smile: ['.m', 'm.', '..'],
  wobble: ['..', '.m', 'm.'],
  open: ['m.', 'tm', 'm.'],
  o: ['m.', 'tm', 'tm', 'm.'],
  grin: ['mm', 'Tm', '.m'],
  teeth: ['mm', 'TT', 'mm'],
  talk1: ['..', 'mm', 'm.'],
  talk2: ['m.', 'tm', 'tm', 'm.'],
  chew: ['..', 'mm', '..'],
  hmm: ['..', 'm.', '..'],
}
const MOUTH_SIDE_L: Record<string, readonly string[]> = {
  shut: ['...', 'mm.', '...'],
  smile: ['..m', 'mm.', '...'],
  wobble: ['...', '.mm', 'm..'],
  open: ['mm.', 'ttm', 'mm.'],
  o: ['.m.', 'mtm', 'mtm', '.m.'],
  grin: ['mmm', 'TTm', 'tm.', 'm..'],
  teeth: ['mmm', 'TTm', 'mmm'],
  talk1: ['mm.', 'tm.', 'm..'],
  talk2: ['mmm', 'ttm', 'tm.', 'm..'],
  chew: ['...', 'mm.', '...'],
  hmm: ['...', 'mm.', '...'],
}
const mouth = (set: Record<string, readonly string[]>, m: string) => set[m] ?? set.shut!

// Kjell's lenses, 5×4 (the screen-left one; the other is mirrored).
const LENS: Record<string, readonly string[]> = {
  open: ['.fff.', 'flelf', 'flllf', '.fff.'],
  side: ['.fff.', 'fllef', 'flllf', '.fff.'],
  wide: ['.fff.', 'flelf', 'flllf', '.fff.'],
  up: ['.fef.', 'flllf', 'flllf', '.fff.'],
  down: ['.fff.', 'flllf', 'flelf', '.fff.'],
  closed: ['.fff.', 'flllf', 'feeef', '.fff.'],
  half: ['.fff.', 'feeef', 'flelf', '.fff.'],
  happy: ['.fff.', 'flelf', 'felef', '.fff.'],
  squeeze: ['.fff.', 'feelf', 'fllef', '.fff.'],
  dazed: ['.fff.', 'felef', 'flelf', '.fff.'],
}

// Espen's wide eyes, 4×4: a white with a dark rim and a big pupil (the screen-left eye; the other mirrors).
const RING: Record<string, readonly string[]> = {
  open: ['.kk.', 'kwek', 'kwek', '.kk.'],
  wide: ['.kk.', 'kwek', 'kwek', '.kk.'],
  side: ['.kk.', 'kewk', 'kewk', '.kk.'],
  up: ['.ke.', 'kwek', 'kwwk', '.kk.'],
  down: ['.kk.', 'kwwk', 'kwek', '.ke.'],
  closed: ['....', '....', 'kkkk', '....'],
  half: ['....', 'kkkk', 'kwek', '.kk.'],
  happy: ['....', '.kk.', 'k..k', '....'],
  squeeze: ['k...', '.kk.', 'k...', '....'],
  dazed: ['k..k', '.kk.', 'k..k', '....'],
}

// Dag's calm eyes, 3×2.
const CALM: Record<string, readonly string[]> = {
  open: ['.k.', 'wew'],
  wide: ['wkw', 'wew'],
  half: ['kkk', 'wew'],
  side: ['kkk', 'wwe'],
  up: ['wew', 'kkk'],
  down: ['kkk', '.e.'],
  closed: ['...', 'kkk'],
  happy: ['.k.', 'k.k'],
  squeeze: ['kk.', '.kk'],
  dazed: ['k.k', '.k.'],
}

// The Professor's eyes, 2×2.
const DOT: Record<string, readonly string[]> = {
  open: ['ge', 'ee'], wide: ['ge', 'ee'], side: ['eg', 'ee'], up: ['ee', '..'], down: ['..', 'ee'],
  closed: ['..', 'ee'], half: ['..', 'ee'], happy: ['ee', 'e.'], squeeze: ['e.', '.e'], dazed: ['e.', '.e'],
}

function facePal(L: Look, extra: Record<string, string> = {}): Record<string, string> {
  return {
    k: INK.k, m: INK.mouth, t: INK.tongue, T: INK.tooth, w: INK.white, e: INK.eye,
    f: INK.frame, l: INK.lens, g: INK.glint, b: INK.blush,
    s: tone(L.skin, 1), S: tone(L.skin, 3), d: tone(L.skin, 0),
    ...extra,
  }
}

// ---------------------------------------------------------------------------
// Ears
// ---------------------------------------------------------------------------

/** Ear length factor: portraits draw short ears so they fit the box. */
let earK = 1
export function setEarScale(k: number) { earK = k }

/** A bunny ear: a chain of capsules widening towards the tip, pink inside when seen from the front. */
function ear(d: Doll, pts0: P[], r0: number, r1: number, suit: Mat, pinkIn: boolean, dim = 0) {
  const b = pts0[0]!
  const pts: P[] = earK === 1 ? pts0 : pts0.map(p => [b[0] + (p[0] - b[0]) * earK, b[1] + (p[1] - b[1]) * earK] as P)
  const n = pts.length - 1
  for (let i = 0; i < n; i++) {
    const a = pts[i]!, c = pts[i + 1]!
    const ra = r0 + (r1 - r0) * (i / n), rb = r0 + (r1 - r0) * ((i + 1) / n)
    d.cap(a[0], a[1], c[0], c[1], ra, rb, suit, { line: 'k', join: i > 0, dim })
  }
  if (pinkIn) {
    for (let i = 0; i < n; i++) {
      const a = pts[i]!, c = pts[i + 1]!
      const ra = (r0 + (r1 - r0) * (i / n)) * 0.42, rb = (r0 + (r1 - r0) * ((i + 1) / n)) * 0.5
      d.cap(a[0], a[1] + (i === 0 ? 2 : 0), c[0], c[1], ra, rb, MAT.pink, { clip: true, flat: true })
    }
  }
}

// ---------------------------------------------------------------------------
// Heads
// ---------------------------------------------------------------------------

export function head(d: Doll, L: Look, hx0: number, hy0: number, r: Rig, desc: FrameDesc) {
  const hx = Math.round(hx0), hy = Math.round(hy0)
  if (L.id === 'kjell') kjell(d, L, hx, hy, r)
  else if (L.id === 'dag') dag(d, L, hx, hy, r)
  else if (L.id === 'espen') espen(d, L, hx, hy, r, desc)
  else professor(d, L, hx, hy, r)
}

function kjell(d: Doll, L: Look, hx: number, hy: number, r: Rig) {
  const v = r.view
  const top = hy - L.headRy
  const pal = facePal(L, { h: tone(MAT.blond, 2), H: tone(MAT.blond, 3), n: tone(MAT.blond, 1) })
  const up = r.ears === 'up' || r.ears === 'wild'
  const flop = r.ears === 'flop'
  const lean = r.ears === 'back' ? 2 : 0
  // Ears: one stands (just), the other is bent at a right angle.
  if (v === 'side') {
    const bx = hx - 2
    const far: P[] = flop ? [[bx, top + 2], [bx - 5, top + 4], [bx - 9, top + 9]] : [[bx, top + 2], [bx - 1 - lean, top - 5], [bx - 2 - lean * 2, top - 11]]
    const near: P[] = flop ? [[bx + 1, top + 2], [bx - 3, top + 6], [bx - 6, top + 11]]
      : up ? [[bx + 1, top + 2], [bx + 1, top - 5], [bx + 1, top - 11]]
        : [[bx + 1, top + 2], [bx + 1 - lean, top - 4.5], [bx + 7, top - 5]]
    ear(d, far, 1.4, 2.2, L.suit, false, -1)
    ear(d, near, 1.4, 2.1, L.suit, false)
  } else {
    const s = v === 'back' ? -1 : 1
    const straight: P[] = flop ? [[hx - 3 * s, top + 2], [hx - 8 * s, top + 4], [hx - 11 * s, top + 9]]
      : up ? [[hx - 3 * s, top + 2], [hx - 4 * s, top - 5], [hx - 5 * s, top - 11]]
        : [[hx - 3 * s, top + 2], [hx - 3.5 * s, top - 5], [hx - 4.5 * s, top - 11]]
    const bent: P[] = flop ? [[hx + 3 * s, top + 2], [hx + 8 * s, top + 4], [hx + 11 * s, top + 9]]
      : up ? [[hx + 3 * s, top + 2], [hx + 4 * s, top - 5], [hx + 5 * s, top - 11]]
        : [[hx + 3 * s, top + 2], [hx + 3.5 * s, top - 4.5], [hx + 10 * s, top - 5]]
    ear(d, straight, 1.4, 2.3, L.suit, v === 'front' && !flop)
    ear(d, bent, 1.4, 2.2, L.suit, v === 'front' && !flop)
  }
  d.ell(hx, hy, v === 'side' ? L.headRx - 0.4 : L.headRx, L.headRy, L.suit, { line: 'k' })

  if (v === 'front') {
    d.ell(hx, hy + 1.6, 6.6, 7, tone(L.suit, 1), { clip: true, flat: true })
    d.ell(hx, hy + 1.6, 5.9, 6.3, L.skin, { clip: true })
    // A blond fringe, swept to one side.
    stamp(d, ['...nhhHHhn..', '..nh.hHh.n..', '...n..n.....'], hx - 6, hy - 6, pal)
    const brows = r.brows === 'up' ? ['..ee....ee..', '............'] : r.brows === 'angry' ? ['..e......e..', '...ee..ee...'] : r.brows === 'one' ? ['........ee..', '..ee........'] : ['....e..e....', '..ee....ee..']
    stamp(d, brows, hx - 6, hy - 3, { e: INK.eye })
    const lens = LENS[r.eyes] ?? LENS.open!
    stamp(d, lens, hx - 6, hy - 1, pal, false, false)
    stamp(d, lens, hx + 1, hy - 1, pal, r.eyes !== 'side' && r.eyes !== 'squeeze' ? true : r.eyes === 'squeeze', false)
    d.px(hx - 1, hy, INK.frame)
    d.px(hx, hy, INK.frame)
    d.px(hx - 5, hy - 1, INK.glint, false)
    // A long nose, hanging.
    stamp(d, ['.S', 'Ss', 'ss', 'd.'], hx - 1, hy + 1, pal)
    stamp(d, mouth(MOUTH_S, r.mouth), hx - 2, hy + 5, pal)
  } else if (v === 'side') {
    d.ell(hx + 3.4, hy + 1.6, 5.2, 7, tone(L.suit, 1), { clip: true, flat: true })
    d.ell(hx + 3.7, hy + 1.6, 4.5, 6.3, L.skin, { clip: true })
    stamp(d, ['..nhHH', '.nh.hn', '..n...'], hx, hy - 6, pal)
    stamp(d, r.brows === 'up' ? ['.ee.', '....'] : ['...e', '.ee.'], hx + 3, hy - 3, { e: INK.eye })
    const lens = LENS[r.eyes] ?? LENS.open!
    stamp(d, lens.map(s => s.slice(1)), hx + 3, hy - 1, pal, false, false)
    d.line(hx, hy, hx + 2, hy, INK.frame, true)
    // The long nose sticks out past the hood.
    d.cap(hx + 7, hy + 2, hx + 10.6, hy + 3.8, 1.35, 0.85, L.skin, { line: 'd' })
    d.px(hx + 7, hy + 3, tone(L.skin, 0))
    stamp(d, mouth(MOUTH_SIDE_S, r.mouth), hx + 5, hy + 5, pal)
  } else {
    d.line(hx - 0.5, hy - 6, hx - 0.5, hy + 6, tone(L.suit, 1), true)
  }
}

/** Dag's ears, down his back like a cape (behind the body in front and side views). */
export function dagEarsBehind(d: Doll, L: Look, hx: number, hy: number, r: Rig) {
  const sw = r.tail * 0.5
  if (r.view === 'side') {
    ear(d, [[hx - 3, hy + 5], [hx - 8 + sw, hy + 12], [hx - 10 + sw, hy + 21]], 1.9, 2.9, L.suit, false, -1)
    ear(d, [[hx - 2, hy + 5], [hx - 6 + sw, hy + 13], [hx - 7 + sw, hy + 23]], 1.9, 2.9, L.suit, false)
  } else if (r.view === 'front') {
    ear(d, [[hx - 4, hy + 4], [hx - 10 + sw, hy + 10], [hx - 12.5 + sw, hy + 19]], 1.9, 2.9, L.suit, false, -1)
    ear(d, [[hx + 4, hy + 4], [hx + 10 + sw, hy + 10], [hx + 12.5 + sw, hy + 19]], 1.9, 2.9, L.suit, false, -1)
  }
}

function dag(d: Doll, L: Look, hx: number, hy: number, r: Rig) {
  const v = r.view
  const pal = facePal(L, { h: tone(MAT.ginger, 2), H: tone(MAT.ginger, 3), n: tone(MAT.ginger, 1), N: tone(MAT.ginger, 0), m: INK.mouth })
  if (v === 'back') {
    d.ell(hx, hy + 6.5, 9, 3.8, L.suit, { line: 'k' })
    d.ell(hx, hy, L.headRx, L.headRy, L.skin, { line: 'k' })
    d.ell(hx, hy - 1, L.headRx + 0.4, L.headRy - 0.6, MAT.ginger, { clip: true })
    // A small bald spot, which nobody mentions.
    d.ell(hx + 1, hy - 5.2, 2.2, 1.4, L.skin, { clip: true })
    // The ears lie down his back, splayed, tips curling out.
    const sw = r.tail * 0.5
    ear(d, [[hx - 2, hy + 6], [hx - 4.5 + sw, hy + 13], [hx - 7 + sw, hy + 20], [hx - 9 + sw, hy + 22]], 1.8, 3, L.suit, false)
    ear(d, [[hx + 2, hy + 6], [hx + 4.5 + sw, hy + 13], [hx + 7 + sw, hy + 20], [hx + 9 + sw, hy + 22]], 1.8, 3, L.suit, false)
    return
  }
  // The hood, bunched behind his neck.
  d.ell(hx + (v === 'side' ? -2.5 : 0), hy + 6.5, v === 'side' ? 6.5 : 9, 3.6, L.suit, { line: 'k' })
  if (v === 'front') {
    d.ell(hx, hy, L.headRx, L.headRy, L.skin, { line: 'k' })
    d.ell(hx, hy - 5.4, L.headRx + 0.8, 4.4, MAT.ginger, { clip: true })
    stamp(d, ['.hh.h....h.hh..', 'h..........h..h'], hx - 7, hy - 2, pal)
    // The beard: a big ginger bib over the collar.
    d.ell(hx, hy + 5, 8.8, 7.4, MAT.ginger, { line: 'd' })
    d.ell(hx, hy + 1.3, 6, 2.9, L.skin, { clip: true })
    stamp(d, ['..hh.H..h.h..', '.h..h..h..h..', '..h...h...h.h'], hx - 6, hy + 7, pal)
    stamp(d, ['.nhhHHhhn.', 'nh......hn'], hx - 5, hy + 3, pal)
    stamp(d, mouth(MOUTH_S, r.mouth), hx - 2, hy + 4, pal)
    stamp(d, r.brows === 'up' ? ['NNN....NNN', '..........'] : ['..........', 'NNN....NNN'], hx - 5, hy - 3, pal)
    const e = CALM[r.eyes] ?? CALM.half!
    stamp(d, e, hx - 5, hy - 1, pal)
    stamp(d, e, hx + 2, hy - 1, pal, r.eyes !== 'side')
    d.ell(hx, hy + 1.7, 2, 1.7, L.skin, { line: 'd' })
    d.px(hx - 1, hy + 1, tone(L.skin, 3))
    stamp(d, ['b..........b'], hx - 6, hy + 1, pal)
  } else {
    d.ell(hx, hy, L.headRx - 0.8, L.headRy, L.skin, { line: 'k' })
    d.ell(hx - 2, hy - 4.4, L.headRx + 0.4, 5, MAT.ginger, { clip: true })
    d.ell(hx - 6, hy + 0.5, 3.2, 7, MAT.ginger, { clip: true })
    d.ell(hx - 1.5, hy + 0.5, 1.5, 2, L.skin, { line: 'd' })
    // Beard jutting forward.
    d.ell(hx + 2.8, hy + 5.4, 6.4, 6.8, MAT.ginger, { line: 'd' })
    d.ell(hx + 4, hy + 1, 3.6, 2.5, L.skin, { clip: true })
    stamp(d, ['.h..h.', 'h..h..', '..h..h'], hx + 1, hy + 7, pal)
    const e = CALM[r.eyes] ?? CALM.half!
    stamp(d, e.map(s => s.slice(1)), hx + 4, hy - 1, pal)
    stamp(d, r.brows === 'up' ? ['NNN', '...'] : ['...', 'NNN'], hx + 3, hy - 3, pal)
    d.ell(hx + 7.6, hy + 1.6, 2, 1.8, L.skin, { line: 'd' })
    d.px(hx + 7, hy + 1, tone(L.skin, 3))
    stamp(d, ['..nhHh', '.n....'], hx + 3, hy + 3, pal)
    stamp(d, mouth(MOUTH_SIDE_S, r.mouth), hx + 6, hy + 4, pal)
  }
}

function espen(d: Doll, L: Look, hx: number, hy: number, r: Rig, desc: FrameDesc) {
  const v = r.view
  const top = hy - L.headRy
  const wire = '#a8a8c8'
  const flop = r.ears === 'flop'
  const jig = (desc.f + Math.max(0, desc.walk) + (desc.idle === 'up' ? 1 : 0)) % 2 ? 0.7 : -0.5
  const pal = facePal(L, { h: tone(MAT.darkHair, 2), H: tone(MAT.darkHair, 3), n: tone(MAT.darkHair, 1) })
  // Ears: coat-hanger wire keeps them up, zig-zag; without it they flop.
  const earPts = (s: number, bx: number): P[] => flop ? [[bx + 4 * s, top + 3], [bx + 9 * s, top + 6], [bx + 11 * s, top + 12]]
    : r.ears === 'wild' ? [[bx + 3 * s, top + 2], [bx + 7 * s, top - 4], [bx + 11 * s, top - 8]]
      : [[bx + 3 * s, top + 2], [bx + 4.3 * s, top - 4], [bx + (3.2 + jig) * s, top - 9.5], [bx + (4.4 + jig) * s, top - 15]]
  const wireOn = (pts: P[], s: number) => {
    for (let i = 0; i < pts.length - 1; i++) d.line(pts[i]![0] + 1.6 * s, pts[i]![1], pts[i + 1]![0] + 1.8 * s, pts[i + 1]![1], wire, true)
    const tip = pts[pts.length - 1]!
    d.px(tip[0] + s, tip[1] - 2.4, wire, false)
  }
  if (v === 'side') {
    const far = earPts(-1, hx + 1), near = earPts(1, hx - 3)
    if (!flop) { far.forEach(p => { p[0] = p[0] * 0.6 + (hx - 2) * 0.4 }); near.forEach(p => { p[0] = p[0] * 0.6 + (hx - 1) * 0.4 }) }
    ear(d, far, 1.3, 1.9, L.suit, false, -1)
    ear(d, near, 1.3, 1.9, L.suit, false)
    if (!flop && r.ears !== 'wild') wireOn(near, 1)
  } else {
    const a = earPts(-1, hx), b = earPts(1, hx)
    ear(d, a, 1.3, 2, L.suit, v === 'front' && !flop)
    ear(d, b, 1.3, 2, L.suit, v === 'front' && !flop)
    if (!flop && r.ears !== 'wild') { wireOn(a, -1); wireOn(b, 1) }
  }
  d.ell(hx, hy, v === 'side' ? L.headRx - 0.4 : L.headRx, L.headRy, L.suit, { line: 'k' })
  if (v === 'front') {
    d.ell(hx, hy + 1.5, 6.9, 6.9, tone(L.suit, 1), { clip: true, flat: true })
    d.ell(hx, hy + 1.6, 6.2, 6.2, L.skin, { clip: true })
    // Messy hair bursting out of the hood.
    stamp(d, ['..h..H...h....', '.hhh.hHh.hhh.h', 'hhHhhhhhHhhhh.', '.hh.hHhhh.hh..', '..n...n...n...'], hx - 7, hy - 8, pal)
    stamp(d, ['h.', 'hh', '.h'], hx + 7, hy - 4, pal, false, false)
    stamp(d, ['.h', 'hh'], hx - 9, hy - 3, pal, false, false)
    stamp(d, r.brows === 'up' ? ['.ee....ee.', 'e..e..e..e'] : r.brows === 'angry' ? ['..........', 'eee....eee'] : ['.eee..eee.', '..........'], hx - 5, hy - 4 + (r.brows === 'up' ? -0 : 1), { e: INK.eye })
    const e = RING[r.eyes] ?? RING.open!
    stamp(d, e, hx - 5, hy - 1, pal, r.eyes === 'side')
    stamp(d, e, hx + 1, hy - 1, pal, r.eyes !== 'side')
    stamp(d, ['s..........s', '.s........s.'], hx - 6, hy + 3, pal)
    d.px(hx - 1, hy + 3, tone(L.skin, 1))
    d.px(hx, hy + 2, tone(L.skin, 3))
    stamp(d, mouth(MOUTH_L, r.mouth), hx - 3, hy + 4, pal)
  } else if (v === 'side') {
    d.ell(hx + 3.2, hy + 1.5, 5.5, 6.9, tone(L.suit, 1), { clip: true, flat: true })
    d.ell(hx + 3.5, hy + 1.6, 4.8, 6.2, L.skin, { clip: true })
    stamp(d, ['..h.H.h.', '.hhHhhhh', 'hhhhHhh.', '..n.hn.n'], hx, hy - 7, pal)
    stamp(d, ['.h', 'hh', 'h.'], hx + 7, hy - 6, pal, false, false)
    stamp(d, r.brows === 'up' || r.eyes === 'wide' ? ['.ee', 'e..'] : ['...', 'eee'], hx + 5, hy - 3, { e: INK.eye })
    const e = RING[r.eyes] ?? RING.open!
    stamp(d, e.map(s => s.slice(0, 3)), hx + 4, hy - 1, pal, r.eyes === 'side')
    // A small upturned nose.
    d.ell(hx + 8, hy + 2, 1.3, 1.1, L.skin, { line: 'd' })
    d.px(hx + 8, hy + 1, tone(L.skin, 3))
    d.px(hx + 4, hy + 3, tone(L.skin, 1))
    stamp(d, mouth(MOUTH_SIDE_L, r.mouth), hx + 5, hy + 4, pal)
  } else {
    d.line(hx - 0.5, hy - 6, hx - 0.5, hy + 6, tone(L.suit, 1), true)
    stamp(d, ['h.H..h', '.h.hh.'], hx - 3, hy - 9, pal, false, false)
  }
}

function professor(d: Doll, L: Look, hx: number, hy: number, r: Rig) {
  const v = r.view
  const streak = '#2a1f4a'
  const pal = facePal(L, { h: tone(MAT.whiteHair, 2), n: tone(MAT.whiteHair, 0), y: '#ffd23f', Y: '#c4861c', z: streak })
  const sx = v === 'side' ? -2 : 0
  // Wild white hair: a cloud and spikes in every direction.
  const spikes: P[] = v === 'side'
    ? [[-11, -5], [-9, -10], [-4, -13], [2, -12], [5, -9], [-12, 1], [-10, 5]]
    : [[-10, -8], [-5, -12], [1, -13], [6, -11], [10, -7], [11, -1], [-11, -1], [-9, 5], [9, 5]]
  d.ell(hx + sx, hy - 2.5, 8.6, 7, MAT.whiteHair, { line: 'k' })
  for (const [x, y] of spikes) d.cap(hx + sx * 0.5, hy - 2, hx + x, hy + y, 2.6, 1, MAT.whiteHair, { line: 'k' })
  if (v !== 'side') d.ell(hx + 6.5, hy + 1.5, 3.4, 4, MAT.whiteHair, { line: 'k' })
  d.ell(hx - 6.5 + sx, hy + 1.5, 3.4, 4, MAT.whiteHair, { line: 'k' })
  if (v === 'back') {
    d.cap(hx - 3, hy - 11, hx + 1, hy + 2, 1, 1, streak, { clip: true, flat: true })
    return
  }
  const fx = v === 'side' ? hx + 1 : hx
  d.ell(fx, hy + 0.8, v === 'side' ? L.headRx - 0.6 : L.headRx, L.headRy, L.skin, { line: 'k' })
  if (v === 'front') {
    d.ell(hx, hy - 5, L.headRx + 0.6, 3.2, MAT.whiteHair, { clip: true })
    // The one dark streak, from the forehead back.
    d.cap(hx - 3, hy - 3, hx - 5, hy - 11, 1, 1, streak, { clip: true, flat: true })
    stamp(d, r.brows === 'one' ? ['.....nn.', 'nnn.....'] : ['nnn..nn.'], hx - 4, hy - 3, pal)
    const e = DOT[r.eyes] ?? DOT.open!
    stamp(d, e, hx - 4, hy - 1, pal)
    stamp(d, e, hx + 2, hy - 1, pal, true)
    // The monocle, and its chain down to the coat.
    stamp(d, ['.yyy.', 'yw..y', 'y...y', '.yYy.'], hx + 1, hy - 2, pal, false, false)
    d.line(hx + 4, hy + 2, hx + 5, hy + 8, '#c4861c', false)
    stamp(d, ['S.', 'Ss', 'ds'], hx - 1, hy, pal)
    stamp(d, mouth(MOUTH_S, r.mouth), hx - 2, hy + 4, pal)
  } else {
    d.ell(hx - 1, hy - 5, L.headRx, 3.2, MAT.whiteHair, { clip: true })
    d.cap(hx - 1, hy - 3, hx - 5, hy - 11, 1, 1, streak, { clip: true, flat: true })
    stamp(d, r.brows === 'one' ? ['.nnn', '....'] : ['....', '.nnn'], hx + 3, hy - 4, pal)
    const e = DOT[r.eyes] ?? DOT.open!
    stamp(d, e.map(s => s.replace('g', 'e').slice(0, 1)), hx + 5, hy - 1, pal)
    stamp(d, ['.yy.', 'y..y', 'y..y', '.yY.'], hx + 4, hy - 2, pal, false, false)
    d.px(hx + 6, hy - 1, INK.glint, false)
    d.line(hx + 4, hy + 2, hx + 2, hy + 8, '#c4861c', false)
    d.cap(hx + 6.4, hy + 0.5, hx + 9, hy + 2.4, 1.1, 0.6, L.skin, { line: 'd' })
    stamp(d, mouth(MOUTH_SIDE_S, r.mouth), hx + 5, hy + 4, pal)
  }
}
