/**
 * The turn switch: the instrument in the corner that turns the world from one view to the other, and shows
 * which one is on (`Zelda.vue` owns the button it is drawn in; `docs/games/neon-shrine.md`, "Views").
 *
 * The switch is a slot with a carriage in it. The carriage carries one ground tile, drawn with the picture's own
 * `projection`: a square in the classic view, the 2:1 diamond in the isometric one. Everything is laid out in the
 * HUD's logical px (L), as in hud.ts: a skin at density 2 draws the same layout at half-pixel detail. Both dresses
 * are painted and joined at a seam that crosses the body with the turn, so the instrument is never blank.
 *
 * Pure but for the canvases it is handed.
 */
import { NEON_SKIN, hudFont, type HudSkin } from './hud'
import { projection } from './iso/project'

type G = CanvasRenderingContext2D

export interface Stop {
  /** The numeral beside its end of the slot (two stops only): `shortTag(view.tag)`. */
  label: string
  /** The HUD skin of the view at this stop, as this screen can wear it. */
  skin: HudSkin
}

export interface SwitchState {
  stops: readonly Stop[]
  /** Where the carriage stands at e = 0 and at e = 1, as (possibly fractional) stop numbers. */
  a: number
  b: number
  /** ease(k) of the picture. */
  e: number
  /** 'V' beside a keyboard; null on touch (chevrons instead). */
  key: string | null
  /** The view asked for is not ready: the classic picture stands in (viewState().waiting). */
  waiting: boolean
  hover: boolean
  down: boolean
  /** The carriage's own small move, in L, signed (the fresh visit's tick, a refusal). */
  nudge: number
  /** The numeral to flash in the prize colour (-1: none). */
  flash: number
  /** Under the switch: the view's name, and how lit (3 text, 2 dim, 1 faint, 0 gone). */
  caption: string
  captionLit: 0 | 1 | 2 | 3
  /** The caption is a refusal (NO SIGNAL): in the skin's hot colour. */
  captionHot?: boolean
  /** Seconds, for the blinks. */
  time: number
  reduced: boolean
}

/** The canvas, in L: the switch row (20 high) right-aligned, the caption's line under it. */
export const SW_W = 88
export const SW_H = 30
export const ROW_H = 20
const RIGHT = SW_W - 1
const BODY_Y = 2
const BODY_H = 14
/** The carriage: 12 wide in the classic box, 13 (a window and its outline) in the 16-bit one. */
const CARR = 12
/** L between stops when there are three or more. */
const STEP = 5

/** '8-BIT' → '8', '16-BIT' → '16'; any other tag has no numeral. */
export function shortTag(tag: string): string {
  return /^(\d{1,2})-BIT$/.exec(tag)?.[1] ?? ''
}

const widthOf = (s: Stop) => (s.label ? Math.ceil(hudFont(s.skin).width(s.label)) : 0)

/** Where things are, in L from the canvas's left edge. `box` is what the button covers. */
export function switchLayout(st: Pick<SwitchState, 'stops' | 'key'>) {
  const n = st.stops.length
  const two = n === 2
  const innerW = two ? 26 : CARR + (n - 1) * STEP
  const bodyW = innerW + 2
  const lb = two ? widthOf(st.stops[1]!) : 0
  const la = two ? widthOf(st.stops[0]!) : 0
  // Right of the body: its shadow (3 L), then the second numeral.
  const bx = RIGHT - (lb ? lb + 3 : 3) - bodyW
  const left = bx - (la ? la + 3 : !two && st.key ? 9 : 0) - 2
  return { n, two, innerW, bodyW, bx, la, lb, box: { x: left, y: 0, w: SW_W - left, h: ROW_H } }
}

/** The words under the switch: the view's name, with its place in the round when there are three or more and both fit. */
export function captionFor(name: string, i: number, n: number, skin: HudSkin): string {
  if (n < 3) return name
  const full = `${name} ${i + 1}/${n}`
  return Math.ceil(hudFont(skin).width(full)) <= SW_W - 2 ? full : name
}

/** How lit the HTML that changes dress is across a turn: it fades out before the flip at e = 0.5 and in after it, as the canvas HUD does. */
export function chromeAlpha(e: number): number {
  return Math.min(1, Math.abs(e - 0.5) / 0.2)
}

/** The fresh visit's tick, `ms` after it began: how far the carriage leans toward the other end, in L (out in 120 ms, held 80, back in 200). */
export function tickNudge(ms: number): number {
  if (ms <= 0 || ms >= TICK_MS) return 0
  return 3 * (ms < 120 ? ms / 120 : ms < 200 ? 1 : 1 - (ms - 200) / 200)
}
export const TICK_MS = 400

/** A refusal (the view's code did not arrive): the carriage bumps toward the goal and falls back (80 ms out, 120 back), in L. */
export function refuseNudge(ms: number): number {
  if (ms <= 0 || ms >= REFUSE_MS) return 0
  return 2 * (ms < 80 ? ms / 80 : 1 - (ms - 80) / 120)
}
export const REFUSE_MS = 200

/** Where the carriage stands in a skin's slot (L from the slot floor's left edge), and how far it can go. */
export function carriageAt(st: SwitchState, skin: HudSkin): { pos: number; travel: number; left: number; width: number } {
  const lay = switchLayout(st)
  const sl = slot(skin, lay, st)
  return { pos: sl.pos, travel: sl.travel, left: sl.ix + sl.pos, width: sl.cw }
}

/** The seam between the two dresses, in fine px from the canvas's left edge (null: one dress draws alone). */
export function seamAt(st: SwitchState): number | null {
  const A = st.stops[Math.round(st.a)]!.skin
  const B = st.stops[Math.round(st.b)]!.skin
  if (A === B || st.e <= 0 || st.e >= 1) return null
  const lay = switchLayout(st)
  const x0 = (lay.bx - 1) * 2
  const x1 = (lay.bx + lay.bodyW + 3) * 2
  return Math.round(st.b >= st.a ? x0 + (x1 - x0) * st.e : x1 - (x1 - x0) * st.e)
}

/** The carriage's left edge in a skin's slot, in L from the slot's own left edge, and the slot. */
function slot(skin: HudSkin, lay: ReturnType<typeof switchLayout>, st: SwitchState) {
  const fine = (skin.density ?? 1) > 1
  const unit = fine ? 0.5 : 1
  // The floor inside the frame: one px in the classic box, a pixel and a half in the 16-bit window.
  const inset = fine ? 1.5 : 1
  const cw = fine ? CARR + 1 : CARR
  const iw = lay.bodyW - inset * 2
  const travel = iw - cw
  const at = (i: number) => (lay.n > 1 ? (i / (lay.n - 1)) * travel : 0)
  const snap = (v: number) => Math.round(v / unit) * unit
  const pos = Math.max(0, Math.min(travel, snap(at(st.a + (st.b - st.a) * st.e) + st.nudge)))
  return { fine, unit, inset, cw, iw, travel, at, snap, pos, ix: lay.bx + inset }
}

/** The ground tile as the picture has it: a 4 × 4 L square at e = 0, the 8 × 4 L diamond at e = 1. `unit`: one pixel, in L. */
function tile(g: G, cx: number, cy: number, e: number, unit: number, top: string, light: string | null, side: string | null) {
  const p = projection(e)
  // Half a tile is 2 L, and a quarter pixel more so the diamond's rows come out 4, 8, 8, 4 (4, 8, 12, 16 … at half pixels).
  const a = (2 + unit / 2) / 16
  const ex = { x: p.ex.x * a, y: p.ex.y * a }
  const ey = { x: p.ey.x * a, y: p.ey.y * a }
  const det = ex.x * ey.y - ey.x * ex.y
  const inside = (x: number, y: number) => Math.abs((x * ey.y - y * ey.x) / det) <= 1 && Math.abs((y * ex.x - x * ex.y) / det) <= 1
  const up = (v: number) => Math.ceil(v / unit) * unit
  const rx = up(Math.abs(ex.x) + Math.abs(ey.x))
  const ry = up(Math.abs(ex.y) + Math.abs(ey.y))
  // What the classic art never drew comes in with the turn: the slab's side, two pixels at most.
  const thick = side ? Math.round(e * 2) * unit : 0
  for (let y = -ry; y < ry + thick; y += unit) {
    for (let x = -rx; x < rx; x += unit) {
      const px = x + unit / 2
      const py = y + unit / 2
      let c: string | null = null
      if (inside(px, py)) c = light && !inside(px, py - unit) ? light : top
      else if (thick && (inside(px, py - unit) || inside(px, py - thick))) c = side
      if (!c) continue
      g.fillStyle = c
      g.fillRect(cx + x, cy + y, unit, unit)
    }
  }
}

function chevron(g: G, x: number, y: number, dir: -1 | 1, color: string) {
  g.fillStyle = color
  for (let i = 0; i < 3; i++) g.fillRect(x + (dir < 0 ? 2 - i : i), y + i, 1, 5 - i * 2)
}

/** One dress's picture of the body and the carriage, in L (the context is scaled by the skin's density). */
export function paintSwitch(g: G, skin: HudSkin, st: SwitchState) {
  const lay = switchLayout(st)
  const sl = slot(skin, lay, st)
  const { fine, unit, inset, cw, iw, ix, pos } = sl
  const by = BODY_Y
  const F = hudFont(skin)
  // The slot: the cool window, like the item box and the pause chip.
  skin.panel(g, lay.bx, by, lay.bodyW, BODY_H, 'cool')
  const now = Math.round(st.e < 0.5 ? st.a : st.b)
  if (lay.two) {
    // The floor's engraving, where the carriage is not: the key that moves it, or a chevron toward that end.
    const lit = st.hover ? skin.cool : skin.dim
    const goal = Math.round(st.b)
    for (const half of [0, 1] as const) {
      const hx = ix + (half ? iw - cw : 0) + (cw - 5) / 2
      if (st.waiting && half === goal) {
        // Waiting for the view: three dots count toward it, six steps a second.
        const step = st.reduced ? 3 : Math.floor(st.time * 6) % 4
        for (let i = 0; i < 3; i++) {
          g.fillStyle = i < step ? skin.cool : skin.faint
          g.fillRect(sl.snap(hx - 1 + i * 3), by + 6, 1, 2)
        }
      } else if (st.key) F.draw(g, st.key, sl.snap(hx), by + (fine ? 3.5 : 4), lit)
      else chevron(g, Math.round(hx + 1), by + 5, half ? 1 : -1, lit)
    }
  } else {
    // Three stops or more: a notch in the frame over and under every stop, the one in use lit.
    for (let i = 0; i < lay.n; i++) {
      g.fillStyle = i === now ? skin.text : fine ? skin.faint : skin.outline
      const tx = sl.snap(ix + sl.at(i) + cw / 2 - unit / 2)
      g.fillRect(tx, fine ? by + inset - unit : by, unit, unit)
      g.fillRect(tx, fine ? by + BODY_H - inset : by + BODY_H - 1, unit, unit)
    }
  }
  // The carriage: the window of "the view in use" (hot).
  const cx = ix + pos
  if (fine) skin.panel(g, cx + 0.5, by + inset + 1, CARR, 9, 'hot')
  else if (skin === NEON_SKIN) {
    // The classic plate: the box's fill and a hot edge with notched corners; the box's cyan rule is too much in ten rows.
    g.fillStyle = skin.outline
    g.fillRect(cx, by + 2, CARR, 10)
    g.fillStyle = skin.hot
    g.fillRect(cx + 1, by + 2, CARR - 2, 1); g.fillRect(cx + 1, by + 11, CARR - 2, 1)
    g.fillRect(cx, by + 3, 1, 8); g.fillRect(cx + CARR - 1, by + 3, 1, 8)
  } else skin.panel(g, cx, by + 2, CARR, 10, 'hot')
  const tcx = cx + cw / 2
  const tcy = by + 7 - (fine ? 0.5 : 0) + (st.down && fine ? unit : 0)
  const top = st.down ? skin.text : skin.cool
  if (fine) tile(g, tcx, tcy, st.e, 0.5, top, skin.text, skin.faint)
  else tile(g, tcx, tcy, st.e, 1, top, null, null)
}

/**
 * The whole instrument onto `g`, whose unit is one FINE px (half an L; the caller scales it to the screen): the two
 * dresses joined at the seam, then the numerals, each in its own machine's letters, and the caption.
 * `scratch`: two canvases the painter may size and use.
 */
export function drawTurnSwitch(g: G, st: SwitchState, scratch: [HTMLCanvasElement, HTMLCanvasElement]) {
  const lay = switchLayout(st)
  const ia = Math.round(st.a)
  const ib = Math.round(st.b)
  const A = st.stops[ia]!.skin
  const B = st.stops[ib]!.skin
  const W2 = SW_W * 2
  const H2 = SW_H * 2
  const pic = (skin: HudSkin, c: HTMLCanvasElement) => {
    const den = skin.density ?? 1
    c.width = SW_W * den; c.height = SW_H * den
    const cg = c.getContext('2d')!
    cg.imageSmoothingEnabled = false
    cg.setTransform(den, 0, 0, den, 0, 0)
    paintSwitch(cg, skin, st)
  }
  g.imageSmoothingEnabled = false
  g.clearRect(0, 0, W2, H2)
  const seam = seamAt(st)
  if (seam === null) {
    pic(st.e >= 1 ? B : A, scratch[0])
    g.drawImage(scratch[0], 0, 0, W2, H2)
  } else {
    // The seam leaves a's end at e = 0 and reaches b's end at e = 1; what it has passed wears b's dress.
    // With two stops the carriage is flush at both ends, so the seam is always inside the carriage.
    const right = st.b >= st.a
    pic(A, scratch[0]); pic(B, scratch[1])
    const part = (c: HTMLCanvasElement, from: number, to: number) => {
      if (to <= from) return
      const k = c.width / W2
      g.drawImage(c, from * k, 0, (to - from) * k, c.height, from, 0, to - from, H2)
    }
    if (right) { part(scratch[1], 0, seam); part(scratch[0], seam, W2) } else { part(scratch[0], 0, seam); part(scratch[1], seam, W2) }
  }
  // A skin's letters are laid out in L on a context scaled 2× from fine px, whatever its density.
  const text = (of: Stop, s: string, xL: number, yL: number, color: string) => {
    const skin = of.skin
    g.save()
    g.scale(2, 2)
    const F = hudFont(skin)
    // The 5×7 font only has a drop shadow: lying on the world beside a control it gets a rim all the way round.
    if ((skin.density ?? 1) < 2) for (const [ox, oy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1]] as const) F.draw(g, s, xL + ox, yL + oy, skin.outline)
    F.draw(g, s, xL, yL, color, skin.outline)
    g.restore()
  }
  const now = Math.round(st.e < 0.5 ? st.a : st.b)
  const y = (s: Stop) => BODY_Y + ((s.skin.density ?? 1) > 1 ? 3.5 : 4)
  if (lay.two) {
    st.stops.forEach((s, i) => {
      if (!s.label) return
      const blink = st.waiting && i === ib && (st.reduced || Math.floor(st.time * 3) % 2 === 0)
      const color = blink || st.flash === i ? s.skin.prize : i === now || st.hover ? s.skin.text : s.skin.dim
      text(s, s.label, i === 0 ? lay.bx - 3 - lay.la : lay.bx + lay.bodyW + 3, y(s), color)
    })
  } else if (st.key) {
    const sk = st.stops[now]!.skin
    text(st.stops[now]!, st.key, lay.bx - 8, BODY_Y + 4, st.hover ? sk.text : sk.cool)
  }
  if (st.caption && st.captionLit > 0) {
    const s = st.stops[now]!
    const w = Math.ceil(hudFont(s.skin).width(st.caption))
    text(s, st.caption, RIGHT - 1 - w, ROW_H + 1, st.captionHot ? s.skin.hot : st.captionLit === 3 ? s.skin.text : st.captionLit === 2 ? s.skin.dim : s.skin.faint)
  }
}
