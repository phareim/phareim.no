/**
 * The isometric view's own people (parts 19 and 20, 2026-11-24; the hero, part 21, 2026-11-25): figures redrawn as
 * isometric pixel art at the view's density, two px of theirs to one px of the classic sprite, in their own colours
 * (3–5 shades a material, an outline in each part's darkest shade), and drawn as authored: no Scale2x, no blend of
 * shades on the way up.
 *
 * - *Which figures.* A family (`keeper`, `spitter`, …) is in `folkArt.ts`: for each of its drawn facings
 *   (`front`: three-quarter toward the viewer's lower left; `back`: three-quarter away, toward the upper left)
 *   the frames the classic sprite has, with the foot point (`ax`, `ay`) that lands where the classic sprite's
 *   bottom centre does. Mirroring gives the other two facings.
 * - *How it gets in.* The classic painter still draws every person into the view's atlas, exactly as in the
 *   classic view; the view watches what it draws (`spriteTag` in `sheet.ts` says which sprite a canvas is) and,
 *   where a sprite has art here, draws that art into a second atlas at twice the size instead (`iso/view.ts`,
 *   picture 5 in the geometry pass). So everything the painter does (the hurt flash's white silhouette, the blink,
 *   translucency, a bob or a hop, what is drawn round a figure) carries over without a line of its own: a flash
 *   is the art's own silhouette in that colour, an alpha is the same alpha.
 * - *Facings.* The view turns the world 45°: south runs to the lower left of the screen, east to the lower right.
 *   A figure walking south shows its front (as drawn), east its front mirrored, north its back mirrored, west its
 *   back. A classic sprite that is one front picture, mirrored for `left` (the townsfolk), keeps its front and
 *   its mirror: they turn to whoever talks to them, never away.
 * - *The studio's newest edit wins.* Each family records a hash of the classic rows it was drawn from, as the
 *   game showed them with the studio's live pack applied (`src`). When the rows a sprite is drawn from now
 *   (`spriteRows`) differ from that, or the studio has added a frame the family does not have, the whole
 *   family is drawn the classic way again (its live rows, smoothed as before) until it is redrawn. Whole
 *   families, so an animation never steps between two kinds of drawing.
 *
 * - *The bosses* (part 22) are families too, in `bossArt.ts`: built in 3D, posed for their classic frames, rendered
 *   from this view's angle and drawn over by hand as pixel art. They face the viewer as the classic ones do
 *   (`king_hurt` is the front frame `front_hurt`, `gemini_b_1` is `front_b_1`); the king's shards are a family of one
 *   picture (`shard`). The troll by the bridge is a townsperson's kind of figure: a front, mirrored as the classic.
 * - *The hero and its blade* (part 21) go through the same router, but their art is `hero.ts`'s: composed from parts
 *   and recoloured by roles for whatever look the hero wears, the blades redrawn at twice their size. A hero shape not
 *   wholly drawn, or a hero the studio has redrawn, is the classic sprite, as a stale family is.
 *
 * Pure but for the canvases, which are made the first time a frame is asked for.
 */
import { FOLK_ART, type FolkFamily } from './folkArt'
import { BOSS_ART } from './bossArt'
import { bladePic, heroPic } from './hero'
import { frameCount, makeCanvas, spriteRevision, spriteRows, spriteTag as spriteTagOf, type SpriteTag } from '../sheet'

export type Facing = 'front' | 'back'

/**
 * Bosses drawn but not shown: their art stays in `bossArt.ts` until a redraw lands, and the game draws the classic
 * sprite. Empty now: the llama, held after part 22 (its drawing lost the upright stance and the L badge, and was
 * partly doubled px), was redrawn face-on in part 24 and is shown again.
 */
export const BOSSES_HELD = new Set<string>([])
const SHOWN_BOSSES = Object.fromEntries(Object.entries(BOSS_ART).filter(([k]) => !BOSSES_HELD.has(k)))

/** Every family with art: the people and foes (`folkArt.ts`) and the bosses shown (`bossArt.ts`). */
const ART: Record<string, FolkFamily> = { ...FOLK_ART, ...SHOWN_BOSSES }

/** FNV-1a over the rows, one line each: eight hex digits. */
export function rowsHash(rows: readonly string[] | undefined): string {
  if (!rows) return '-'
  let h = 0x811c9dc5
  const s = rows.join('\n')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * The family a classic sprite belongs to, when it has isometric art (its name must be one the art was drawn from).
 * A sprite of one picture (`eye`, `blade`) is a family of its own.
 */
export function familyOf(name: string, art: Record<string, FolkFamily> = ART): string | null {
  const i = name.indexOf('_')
  const fam = i < 0 ? name : name.slice(0, i)
  return art[fam]?.src[name] ? fam : null
}

/**
 * Which drawn frame stands for a classic sprite, and mirrored or not. `spitter_side_1` mirrored (walking west)
 * is the back as drawn, frame 1; `keeper_0` is the front, mirrored when the classic one is.
 * - A family that walks four ways and also stands still in frames of its own (Luna: `luna_0`, `luna_1` as a
 *   person in the camp, `luna_down_*` as she follows) keeps those as `idle_<n>` (`idle` says the family has them).
 * - A pose of its own (`luna_psi`, `hound_open`, `skull_jump`) is a front frame by that name, `front_psi`;
 *   a sprite of one picture (`eye`) is `front_0`.
 */
export function facingOf(name: string, fam: string, flip: boolean, idle = false): { key: string; flip: boolean } | null {
  if (name === fam) return { key: 'front_0', flip }
  const rest = name.slice(fam.length + 1)
  if (rest === 'up_hurt') return { key: 'back_hurt', flip: true }
  const four = /^(down|up|side)_(\d+)$/.exec(rest)
  if (four) {
    const f = four[2]
    if (four[1] === 'down') return { key: `front_${f}`, flip: false }
    if (four[1] === 'up') return { key: `back_${f}`, flip: true }
    return flip ? { key: `back_${f}`, flip: false } : { key: `front_${f}`, flip: true }
  }
  if (/^\d+$/.test(rest)) return { key: `${idle ? 'idle' : 'front'}_${rest}`, flip }
  if (/^[a-z]+$/.test(rest)) return { key: `front_${rest}`, flip }
  // One of a pair drawn apart (part 22: `gemini_a_0`, `gemini_b_down`): a front frame by the rest of its name.
  if (/^[a-z]_[a-z0-9]+$/.test(rest)) return { key: `front_${rest}`, flip }
  return null
}

/**
 * Is a family's art still what the game shows: every sprite it was drawn from has the rows it had, and no
 * animation has grown a frame since (`frameCount`, the studio's added frames).
 */
export function familyFresh(
  fam: FolkFamily,
  rowsOf: (name: string) => readonly string[] | undefined = spriteRows,
  count: (prefix: string, own: number) => number = frameCount,
): boolean {
  const runs = new Map<string, number>()
  for (const [name, hash] of Object.entries(fam.src)) {
    if (rowsHash(rowsOf(name)) !== hash) return false
    const m = /^(.*)_(\d+)$/.exec(name)
    if (m) runs.set(m[1]!, Math.max(runs.get(m[1]!) ?? 0, Number(m[2]) + 1))
  }
  for (const [prefix, own] of runs) if (count(prefix, own) !== own) return false
  return true
}

type Canvas = HTMLCanvasElement
export interface FolkPic {
  c: Canvas
  /** The foot point in the picture's px: where the classic sprite's bottom centre lands, twice as far out. */
  ax: number
  ay: number
}

/** A drawn frame's rows as a canvas, mirrored or not. */
function paint(fam: FolkFamily, key: string, flip: boolean): FolkPic | null {
  const fr = fam.frames[key]
  if (!fr) return null
  const h = fr.rows.length
  const w = fr.rows[0]?.length ?? 0
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')!
  const img = g.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    const row = fr.rows[y]!
    for (let x = 0; x < w; x++) {
      const col = fam.pal[row[x]!]
      if (!col) continue
      const o = (y * w + (flip ? w - 1 - x : x)) * 4
      img.data[o] = parseInt(col.slice(1, 3), 16)
      img.data[o + 1] = parseInt(col.slice(3, 5), 16)
      img.data[o + 2] = parseInt(col.slice(5, 7), 16)
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return { c, ax: flip ? w - fr.ax : fr.ax, ay: fr.ay }
}

const pics = new Map<string, FolkPic | null>()
const fresh = new Map<string, boolean>()
let seen = -1

/**
 * The isometric picture for what the classic painter is drawing (a sprite, or its silhouette in a colour), or
 * null when it has none, or has none that is still fresh: then the classic sprite is drawn.
 */
export function folkPic(tag: SpriteTag): FolkPic | null {
  // The hero and its blade have art of their own (`hero.ts`, part 21).
  if (tag.name.startsWith('hero_')) return heroPic(tag)
  if (tag.name.startsWith('sword')) return bladePic(tag)
  if (tag.flipV) return null
  const famId = familyOf(tag.name)
  if (!famId) return null
  if (seen !== spriteRevision()) { seen = spriteRevision(); fresh.clear() }
  const fam = ART[famId]!
  let ok = fresh.get(famId)
  if (ok === undefined) { ok = familyFresh(fam); fresh.set(famId, ok) }
  if (!ok) return null
  const f = facingOf(tag.name, famId, tag.flip, !!fam.frames.idle_0)
  if (!f) return null
  const key = `${famId}|${f.key}|${f.flip ? 'f' : ''}|${tag.color ?? ''}`
  let p = pics.get(key)
  if (p === undefined) {
    p = paint(fam, f.key, f.flip)
    if (p && tag.color) {
      // A flash: the art's own outline, filled with the colour (as `silhouette` does the classic sprite).
      const g = p.c.getContext('2d')!
      g.globalCompositeOperation = 'source-in'
      g.fillStyle = tag.color
      g.fillRect(0, 0, p.c.width, p.c.height)
    }
    pics.set(key, p)
  }
  return p
}

/**
 * How far a turn has handed the figures to their art, for a turn of k: none until 0.35, all from 0.65, eased between
 * (the geometry pass dithers what is part-covered, so the two pictures cross in a stipple, about the moment the
 * modelled hero takes over at 0.5).
 */
export function folkMix(k: number): number {
  const t = Math.max(0, Math.min(1, (k - 0.35) / 0.3))
  return t * t * (3 - 2 * t)
}

/** The families with art, for the lab and the tests: the people and foes, and the bosses. */
export const FOLK_FAMILIES = Object.keys(FOLK_ART)
export const BOSS_FAMILIES = Object.keys(SHOWN_BOSSES)

/**
 * Watch what the classic painter draws into a view's atlas (`ag`): a sprite with art here is drawn into the figures'
 * atlas (`hg`, `density` times the size, cell for cell) instead, with the same transform, alpha, compositing and
 * filter; everything else goes where it was going. Between `begin(cell)` and `end()` only, so the rest of the frame's
 * drawing is untouched. `end` says whether anything went to the figures' atlas.
 */
export interface FolkRouter {
  /** `mix` < 1: both are drawn, the classic sprite at 1 − mix of its alpha and the art at mix (a turn's cross-fade). */
  begin(cellX: number, cellY: number, w: number, h: number, mix?: number): void
  end(): boolean
}
export function folkRouter(ag: CanvasRenderingContext2D, hg: CanvasRenderingContext2D, density: number): FolkRouter {
  let on = false
  let hit = false
  let share = 1
  const classicDraw = ag.drawImage.bind(ag) as (...a: unknown[]) => void
  ;(ag as { drawImage: unknown }).drawImage = (...a: unknown[]) => {
    const tag = on && (a.length === 3 || a.length === 5) ? spriteTagOf(a[0]) : undefined
    const pic = tag ? folkPic(tag) : null
    if (!pic) { classicDraw(...a); return }
    if (share < 1) {
      const was = ag.globalAlpha
      ag.globalAlpha = was * (1 - share)
      classicDraw(...a)
      ag.globalAlpha = was
    }
    const src = a[0] as HTMLCanvasElement
    const dx = a[1] as number
    const dy = a[2] as number
    // (Drawn at another size: scaled as the classic sprite would be. The foot point is the sprite's bottom centre.)
    const sx = a.length === 5 ? (a[3] as number) / src.width : 1
    const sy = a.length === 5 ? (a[4] as number) / src.height : 1
    const t = ag.getTransform()
    hg.save()
    hg.setTransform(density * t.a, density * t.b, density * t.c, density * t.d, density * t.e, density * t.f)
    hg.globalAlpha = ag.globalAlpha * share
    hg.globalCompositeOperation = ag.globalCompositeOperation
    hg.filter = ag.filter
    const fx = dx + (src.width / 2) * sx - (pic.ax / density) * sx
    const fy = dy + src.height * sy - (pic.ay / density) * sy
    hg.drawImage(pic.c, fx, fy, (pic.c.width / density) * sx, (pic.c.height / density) * sy)
    hg.restore()
    hit = true
  }
  return {
    begin(cellX, cellY, w, h, mix = 1) {
      on = true
      hit = false
      share = Math.max(0, Math.min(1, mix))
      hg.save()
      hg.beginPath()
      hg.rect((cellX + 1) * density, (cellY + 1) * density, (w - 2) * density, (h - 2) * density)
      hg.clip()
    },
    end() {
      if (!on) return false
      hg.restore()
      on = false
      return hit
    },
  }
}
