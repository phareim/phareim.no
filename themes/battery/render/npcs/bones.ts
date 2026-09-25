/**
 * Mr Bones, the skeleton butler. Feet at (a.x, a.y); he faces left (towards
 * whoever comes in from the pantry) unless told otherwise. A tailcoat, a red
 * bow tie, no trousers, black socks with garters, very shiny shoes.
 *
 * Poses (a.pose):
 *   ''        seated on his stool; shivers (chattering, jittering) while the
 *             furnace is cold, sits warm and content once it's lit
 *   'shiver'  the same as '' (the start pose)
 *   'sit'     seated and still, whatever the furnace
 *   'nojaw'   seated, his jaw on the floor in front of him (it keeps talking)
 *   'pile'    collapsed into a heap of bones and tailcoat under the stool
 *   'assemble' the heap putting itself back together (flag boiler.assembleAt
 *             holds s.time when it began; takes 1.6 s)
 *   'bow'     seated, bowing from the waist
 *   'give'    seated, holding out the lab key
 *   'stand'   standing to attention (for the finale)
 * The jaw moves while v.talking === 'bones'.
 */
import { sprite } from '../../../base/pixel/sprites'
import type { ActorState, GameState } from '../../types'
import { F } from '../../content/flags'
import type { G, NpcPainter, View } from '../api'

const INK = '#0b0616'
const BONE = '#efe8d0'
const BONE_HI = '#fffbea'
const BONE_LO = '#b8ae90'
const COAT = '#241a34'
const COAT_HI = '#4a3a6a'
const SHIRT = '#f0ecf8'
const TIE = '#e0283e'
const SOCK = '#2a2236'
const SHOE_HI = '#8a84a8'

const PAL = { w: BONE, W: BONE_LO, e: '#fff4b0', m: '#ff8ab0' }

// Facing left, three-quarter view.
const SKULL = [
  '...kkkkk...',
  '..kwwwwwk..',
  '.kwwwwwwwk.',
  'kwwwwwwwwWk',
  'kkekkekwwWk',
  'kkkkkkkwwWk',
  'kwwwwwwwwWk',
  '.kwwkkwwWk.',
  '.kwkwkwkWk.',
  '..kkkkkkk..',
]
const SKULL_WARM = SKULL.map((r, i) => (i === 6 ? 'kwmwwwmwwWk' : r))
const SKULL_SHUT = SKULL.map((r, i) => (i === 4 ? 'kkkkkkkwwWk' : r))
const JAW = [
  '.kwkwkwk.',
  '.kwwwwwWk',
  '..kkkkkk.',
]

interface Rig {
  g: G
  ax: number
  ay: number
  flip: boolean
}

function rr(r: Rig, dx: number, dy: number, w: number, h: number, c: string) {
  const x = r.flip ? r.ax - dx - w : r.ax + dx
  r.g.fillStyle = c
  r.g.fillRect(Math.round(x), Math.round(r.ay + dy), w, h)
}

function px(r: Rig, dx: number, dy: number, c: string) { rr(r, dx, dy, 1, 1, c) }

function spr(r: Rig, rows: readonly string[], dx: number, dy: number) {
  const w = rows[0]!.length
  const x = r.flip ? r.ax - dx - w : r.ax + dx
  r.g.drawImage(sprite(rows, PAL, r.flip), Math.round(x), Math.round(r.ay + dy))
}

/** A thick line between two rig points (for arms and bones). */
function limb(r: Rig, x0: number, y0: number, x1: number, y1: number, c: string, th: number) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n)
    const y = Math.round(y0 + ((y1 - y0) * i) / n)
    rr(r, x - Math.floor(th / 2), y - Math.floor(th / 2), th, th, c)
  }
}

// --- parts (each takes an extra offset, for the reassembly) ---------------

function shoes(r: Rig, oy = 0) {
  rr(r, -15, -3 + oy, 8, 4, INK)
  rr(r, -14, -3 + oy, 6, 2, '#16101e')
  rr(r, -13, -3 + oy, 2, 1, SHOE_HI)
}

function shins(r: Rig, oy = 0) {
  // Socks with garters, and bone above them.
  rr(r, -12, -11 + oy, 5, 9, INK)
  rr(r, -11, -10 + oy, 3, 8, SOCK)
  rr(r, -11, -10 + oy, 3, 1, TIE)
  rr(r, -12, -18 + oy, 4, 8, INK)
  rr(r, -11, -18 + oy, 2, 8, BONE)
  px(r, -11, -17 + oy, BONE_HI)
}

function thighs(r: Rig, oy = 0) {
  rr(r, -13, -22 + oy, 5, 5, INK)
  rr(r, -12, -21 + oy, 3, 3, BONE)
  px(r, -12, -21 + oy, BONE_HI)
  rr(r, -10, -22 + oy, 12, 4, INK)
  rr(r, -9, -21 + oy, 10, 2, BONE)
  rr(r, -9, -21 + oy, 10, 1, BONE_HI)
  px(r, -5, -20 + oy, BONE_LO)
}

function torso(r: Rig, oy = 0, lean = 0) {
  // The tails, hanging down behind over the stool.
  rr(r, 3, -26 + oy, 6, 15, INK)
  rr(r, 4, -26 + oy, 4, 13, COAT)
  rr(r, 7, -26 + oy, 1, 12, COAT_HI)
  rr(r, 5, -13 + oy, 2, 1, COAT)
  // The coat's body.
  rr(r, -6 + lean, -38 + oy, 12, 19, INK)
  rr(r, -5 + lean, -37 + oy, 10, 17, COAT)
  rr(r, 4 + lean, -36 + oy, 1, 15, COAT_HI)
  // Shirt front and lapels, the bow tie.
  rr(r, -5 + lean, -36 + oy, 4, 10, SHIRT)
  rr(r, -1 + lean, -36 + oy, 1, 8, '#6a5a8a')
  px(r, -3 + lean, -31 + oy, '#c8c0d8')
  px(r, -3 + lean, -28 + oy, '#c8c0d8')
  rr(r, -6 + lean, -37 + oy, 5, 2, TIE)
  px(r, -4 + lean, -37 + oy, '#8a1020')
  px(r, -6 + lean, -37 + oy, INK)
  // A flower in the buttonhole, dried since 1987.
  px(r, 2 + lean, -34 + oy, '#8a5a6a')
  // Neck vertebrae.
  rr(r, -2 + lean, -40 + oy, 3, 3, INK)
  px(r, -1 + lean, -40 + oy, BONE)
  px(r, -1 + lean, -38 + oy, BONE_LO)
}

function armRest(r: Rig, oy = 0, lean = 0) {
  // Sleeve from the shoulder to the knee, bony hand on the knee.
  limb(r, 0 + lean, -34 + oy, -4, -26 + oy, INK, 4)
  limb(r, -4, -26 + oy, -9, -22 + oy, INK, 4)
  limb(r, 0 + lean, -34 + oy, -4, -26 + oy, COAT, 2)
  limb(r, -4, -26 + oy, -8, -23 + oy, COAT, 2)
  rr(r, -9, -24 + oy, 2, 2, SHIRT)
  rr(r, -13, -23 + oy, 5, 3, INK)
  rr(r, -12, -22 + oy, 4, 1, BONE)
  px(r, -13, -21 + oy, BONE)
  px(r, -11, -21 + oy, BONE)
}

function armGive(r: Rig, t: number) {
  limb(r, 0, -34, -8, -31, INK, 4)
  limb(r, -8, -31, -15, -31, INK, 4)
  limb(r, 0, -34, -8, -31, COAT, 2)
  limb(r, -8, -31, -14, -31, COAT, 2)
  rr(r, -15, -32, 2, 3, SHIRT)
  // Fingers, and the key, swinging a little.
  rr(r, -19, -33, 5, 4, INK)
  rr(r, -18, -32, 4, 1, BONE)
  px(r, -18, -30, BONE)
  const sw = Math.round(Math.sin(t * 4))
  rr(r, -19 + sw, -30, 3, 7, INK)
  px(r, -18 + sw, -29, '#ffd23f')
  px(r, -18 + sw, -28, '#ffd23f')
  px(r, -17 + sw, -27, '#ffd23f')
  px(r, -18 + sw, -26, '#ffd23f')
  px(r, -18 + sw, -25, '#c4861c')
}

function head(r: Rig, oy: number, jawDrop: number, jaw: boolean, warm: boolean, blink: boolean, lean = 0) {
  spr(r, blink ? SKULL_SHUT : warm ? SKULL_WARM : SKULL, -6 + lean, -49 + oy)
  if (jaw) spr(r, JAW, -5 + lean, -40 + oy + jawDrop)
}

function stoolJaw(r: Rig, talking: boolean, t: number) {
  const open = talking && Math.floor(t * 9) % 2 === 0
  spr(r, JAW, -24, open ? -4 : -3)
  if (open) rr(r, -23, -4, 6, 1, INK)
}

// --- whole poses ----------------------------------------------------------

function seated(r: Rig, s: GameState, a: ActorState, v: View, opts: { jaw?: boolean; give?: boolean; bow?: boolean } = {}) {
  const t = v.t
  const lit = !!s.flags[F.furnaceLit]
  const talking = v.talking === 'bones'
  const shiver = !lit && a.pose !== 'sit' && !opts.give
  const jx = shiver ? (Math.floor(t * 22) % 2 ? 1 : 0) : 0
  const body: Rig = { ...r, ax: r.ax + (r.flip ? -jx : jx) }
  shoes(r)
  shins(r)
  thighs(r)
  const lean = opts.bow ? -3 : 0
  const bob = !shiver && !talking && Math.floor(t / 3.2) % 3 === 0 && (t / 3.2) % 1 < 0.35 ? 1 : 0
  torso(body, opts.bow ? 2 : 0, lean)
  if (opts.give) armGive(body, t)
  else armRest(body, 0, lean)
  const jawDrop = talking ? (Math.floor(t * 9) % 2 ? 2 : 0) : shiver ? Math.floor(t * 18) % 2 : 0
  const blink = !shiver && Math.floor(t * 0.5) % 5 === 0 && (t * 0.5) % 1 < 0.08
  head(body, (opts.bow ? 4 : 0) + bob, jawDrop, opts.jaw !== false, lit, blink, lean)
  // Chattering: little rattle marks by his shoulders.
  if (shiver && Math.floor(t * 6) % 2) {
    px(r, 8, -40, '#c8c0e0'); px(r, 9, -42, '#c8c0e0')
    px(r, -9, -44, '#c8c0e0'); px(r, -10, -46, '#c8c0e0')
  }
  if (opts.jaw === false) stoolJaw(r, talking, t)
}

function pile(r: Rig, t: number, jiggle = 0) {
  const j = (i: number) => (jiggle ? Math.round(Math.sin(t * 30 + i * 2) * jiggle) : 0)
  // The coat, in a heap.
  for (let y = -7; y <= 0; y++) {
    const half = Math.round(12 * Math.sqrt(1 - ((y + 0) / 8) ** 2))
    rr(r, -half - 1 + 2, y - 1, half * 2 + 2, 1, INK)
    rr(r, -half + 2, y, half * 2, 1, y < -5 ? COAT_HI : COAT)
  }
  // Bones sticking out every which way.
  limb(r, -14, -2 + j(1), -4, -6 + j(1), INK, 3)
  limb(r, -13, -2 + j(1), -5, -6 + j(1), BONE, 1)
  limb(r, 8, -1 + j(2), 16, -8 + j(2), INK, 3)
  limb(r, 9, -2 + j(2), 15, -7 + j(2), BONE, 1)
  limb(r, -2, -9 + j(3), 6, -12 + j(3), INK, 3)
  limb(r, -1, -10 + j(3), 5, -11 + j(3), BONE, 1)
  // Shoes, one up, one down.
  rr(r, -18, -3, 7, 3, INK); rr(r, -17, -3, 5, 2, '#16101e'); px(r, -16, -3, SHOE_HI)
  rr(r, 13, -4 + j(4), 3, 7, INK); rr(r, 14, -3 + j(4), 1, 5, '#16101e')
  // The bow tie, and the skull on top, looking put out.
  rr(r, 4, -9, 4, 2, TIE)
  spr(r, SKULL, -4, -19 + j(5))
  spr(r, JAW, -3, -10 + j(6))
}

function assemble(r: Rig, s: GameState, a: ActorState, v: View) {
  const t0 = typeof s.flags['boiler.assembleAt'] === 'number' ? (s.flags['boiler.assembleAt'] as number) : s.time
  const p = Math.max(0, Math.min(1, (s.time - t0) / 1.6))
  if (p < 0.2) { pile(r, v.t, 1); return }
  // Each part flies up from the heap to its place, in order, on a little arc.
  const k = (d: number) => Math.max(0, Math.min(1, (p - d) / 0.3))
  const arc = (d: number, dist: number) => { const q = k(d); return Math.round((1 - q) * dist - Math.sin(q * Math.PI) * 6) }
  if (k(0.3) < 0.5) {
    for (let y = -5; y <= 0; y++) {
      const half = Math.round(10 * (1 - k(0.3)) * Math.sqrt(1 - (y / 6) ** 2))
      rr(r, -half + 2, y, half * 2, 1, COAT)
    }
  }
  shoes(r, 0)
  shins(r, arc(0.2, 8))
  thighs(r, arc(0.25, 14))
  torso(r, arc(0.35, 20))
  armRest(r, arc(0.45, 20))
  head(r, arc(0.6, 32), 0, true, !!s.flags[F.furnaceLit], false)
  void a
}

function standing(r: Rig, s: GameState, v: View) {
  const t = v.t
  const talking = v.talking === 'bones'
  // Shoes, socks, bony legs.
  for (const dx of [-5, 1]) {
    rr(r, dx - 2, -3, 7, 4, INK)
    rr(r, dx - 1, -3, 5, 2, '#16101e')
    px(r, dx, -3, SHOE_HI)
    rr(r, dx - 1, -12, 4, 10, INK)
    rr(r, dx, -11, 2, 9, SOCK)
    rr(r, dx, -11, 2, 1, TIE)
    rr(r, dx - 1, -28, 4, 17, INK)
    rr(r, dx, -27, 2, 16, BONE)
    px(r, dx, -20, BONE_LO)
    rr(r, dx - 1, -21, 4, 2, INK)
    px(r, dx, -20, BONE)
  }
  const shift: Rig = { ...r, ay: r.ay - 10 }
  torso(shift, 0)
  // Arms straight down by his sides, correct.
  limb(shift, 0, -34, 1, -20, INK, 4)
  limb(shift, 0, -34, 1, -21, COAT, 2)
  rr(shift, -1, -19, 3, 3, BONE)
  const jawDrop = talking ? (Math.floor(t * 9) % 2 ? 2 : 0) : 0
  head(shift, 0, jawDrop, true, !!s.flags[F.furnaceLit], false)
}

export const paint: NpcPainter = (g, a, v, s) => {
  const r: Rig = { g, ax: Math.round(a.x), ay: Math.round(a.y), flip: a.face === 'right' }
  switch (a.pose) {
    case 'pile': pile(r, v.t); return
    case 'assemble': assemble(r, s, a, v); return
    case 'nojaw': seated(r, s, a, v, { jaw: false }); return
    case 'give': seated(r, s, a, v, { give: true }); return
    case 'bow': seated(r, s, a, v, { bow: true }); return
    case 'stand': standing(r, s, v); return
    default: seated(r, s, a, v)
  }
}
