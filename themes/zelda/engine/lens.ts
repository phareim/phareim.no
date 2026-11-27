/**
 * THE LENS, Act Three's treasure (docs/worlds/act-three.md): a hero who stands still a moment sees what is false. It
 * is owned by the flag `item:lens` alone (no slot, no inventory field). A false thing it only draws differently: what
 * is solid under paint is the tile's to say, glass up or down. A hidden thing is not there until the glass has shown it
 * (`placeHidden`), and then stays for the visit.
 *
 * Still: on his feet (the floor or a platform; not a ladder, not the air), in play, and for `LENS.up` s no stick
 * beyond its dead zone, no press or release of a button, A not held, no hurt, no lines, card, pause or door. A thumb
 * that rests on B without a change is not moving. At `LENS.ring` a ring grows round the hero's feet; at `LENS.up` the
 * glass is up, and stays until the hero moves, is hurt or leaves the room. False things fade to an outline in
 * `LENS.show` s and come back over `LENS.back` s, so that one look is good for one jump; hidden things the glass has
 * shown stay faintly drawn for the visit (`MapState.lensSeen`). Nothing here is saved.
 *
 * The things the glass knows are marks (`lie`, `veil`, a chest with `hidden`). A boss may declare the glass too
 * (`bossLens`). Painted by `render/actthreePaint.ts`.
 */
import type { Enemy, EnemyKind, GameState, Input, Rect } from '../types'
import { HERO_R } from '../types'
import { dirVec } from './util'
import { cellIndex, cellRect, circleOnTile, has, type MapInfo } from './map'
import type { Ctx } from './combat'

/** Seconds: when the ring starts and the glass is up, the picture's change in and back out; the stick's dead zone. */
export const LENS = { ring: 0.25, up: 0.7, show: 0.2, back: 2.5, dead: 0.2, puff: 0.4, pencil: 0.45 } as const
export const LENS_FLAG = 'item:lens'
/** The rows of one screen of a tall room: the glass's ring is for what the hero's screen holds. */
const SCREEN = 12

/** The glass's clock (`GameState.lens`). Never saved. */
export interface Lens {
  /** `<map>:<room>`: another room starts again with the glass down. */
  at: string
  /** Seconds the hero has been still. */
  still: number
  up: boolean
  /** How far the picture has changed, 0..1. */
  k: number
  /** The hero's screen holds something the glass would show: the ring is drawn, the glass sounds. */
  here: boolean
  /** Last step's spot, hearts and held buttons. */
  x: number
  y: number
  hp: number
  a: boolean
  b: boolean
}

/** A thing the glass knows: its tile, what it is, its room. */
export interface GlassThing {
  i: number
  x: number
  y: number
  cell: number
  /** 'ledge' / 'door' / 'chest' are false; 'veil' (a real platform) and 'cache' (a real chest) are hidden. */
  is: 'ledge' | 'door' | 'chest' | 'veil' | 'cache'
  /** 'cache': the chest's id. */
  id?: string
}
export const isFalse = (t: GlassThing) => t.is !== 'veil' && t.is !== 'cache'

const things = new WeakMap<MapInfo, GlassThing[]>()
/** Every false and hidden thing of a map, from its marks. */
export function glassThings(info: MapInfo): readonly GlassThing[] {
  let list = things.get(info)
  if (list) return list
  list = []
  for (const m of info.marks) {
    const e = m.ent
    const is = e.t === 'lie' ? e.as : e.t === 'veil' ? 'veil' : e.t === 'chest' && e.hidden ? 'cache' : null
    if (!is) continue
    list.push({ i: m.y * info.w + m.x, x: m.x, y: m.y, cell: cellIndex(info, m.x + 0.5, m.y + 0.5), is, ...(e.t === 'chest' ? { id: e.id } : {}) })
  }
  things.set(info, list)
  return list
}

/** The glass is up. */
export const lensUp = (s: Pick<GameState, 'lens'>) => !!s.lens?.up

/** The foes that declare the glass: their room rings even with nothing marked in it. */
const GLASS_FOES: ReadonlySet<EnemyKind> = new Set<EnemyKind>(['bard', 'hallucinator'])
export const bossLens = (e: Enemy) => !e.dead && GLASS_FOES.has(e.kind)

/** The screen the hero is on: the room, or the 12 rows of a tall one that hold his feet. */
export function lensScreen(c: Ctx): Rect {
  const z = cellRect(c.info, c.s.zoneIndex)
  if (z.h <= 16) return z
  const band = Math.max(0, Math.min(Math.ceil(z.h / SCREEN) - 1, Math.floor((c.s.hero.y - z.y) / SCREEN)))
  return { x: z.x, y: z.y + band * SCREEN, w: z.w, h: Math.min(SCREEN, z.h - band * SCREEN) }
}

/** A false chest the hero has opened this visit is gone. */
export const lieGone = (s: GameState, i: number) => !!s.map.lensGone?.some(g => g.i === i)

function holds(c: Ctx): boolean {
  const s = c.s
  const z = lensScreen(c)
  if (s.map.enemies.some(e => e.cell === s.zoneIndex && bossLens(e))) return true
  return glassThings(c.info).some(t => t.cell === s.zoneIndex && t.x >= z.x && t.x < z.x + z.w && t.y >= z.y && t.y < z.y + z.h &&
    !(t.is === 'chest' && lieGone(s, t.i)) && !(t.is === 'cache' && has(s, `chest:${t.id}`)))
}

/** On his own feet and at nothing. */
function footed(c: Ctx): boolean {
  const h = c.s.hero
  if (c.s.mode !== 'play' || c.s.card || c.s.hook) return false
  if (h.knock || h.swing || h.spin || h.roll || h.air || h.auto) return false
  if (h.act !== 'idle' && h.act !== 'walk' && h.act !== 'carry') return false
  return c.info.def.kind !== 'side' || (!!h.side?.ground && !h.side.ladder)
}

/**
 * A hidden thing is there once the glass has shown it, and stays for the visit (an opened chest too: it does not
 * stand in the air over ledges that are not there). Until then its tile is air: it bears nobody, blocks nobody and
 * offers the A button nothing. (It never goes back while the map is loaded, so the ground does not flicker as the
 * glass comes and goes.)
 */
function placeHidden(c: Ctx) {
  const s = c.s
  const m = s.map
  const h = s.hero
  for (const t of glassThings(c.info)) {
    if (isFalse(t)) continue
    const there = !!m.lensSeen?.includes(t.i)
    const want = there ? c.info.base[t.i]! : '.'
    if (m.tiles[t.i] === want) continue
    // (A chest never comes up round the hero: it waits until he is clear of its tile.)
    if (there && t.is === 'cache' && circleOnTile(h.x, h.y, HERO_R, t.x, t.y)) continue
    m.tiles[t.i] = want
    m.version++
  }
}

/** One step of the glass, before anything else moves: `game.ts` calls it, under a card too. */
export function stepLens(c: Ctx, inp: Input, dt: number) {
  const s = c.s
  for (const g of s.map.lensGone ?? []) g.t += dt
  placeHidden(c)
  if (s.demo || !has(s, LENS_FLAG)) { if (s.lens) delete s.lens; return }
  const h = s.hero
  const at = `${s.map.id}:${s.zoneIndex}`
  const b = !!inp.jumpHeld
  let l = s.lens
  if (!l || l.at !== at) l = s.lens = { at, still: 0, up: false, k: 0, here: false, x: h.x, y: h.y, hp: h.hp, a: inp.a, b }
  const moved = Math.hypot(inp.move.x, inp.move.y) > LENS.dead || Math.hypot(h.x - l.x, h.y - l.y) > 0.002 ||
    inp.a || inp.aPress || inp.bPress || !!inp.jumpPress || !!inp.rollPress || inp.cycle ||
    // (Let go: B's release is a change; B held on is not.)
    (l.a && !inp.a) || (l.b && !b) || h.hp < l.hp || !footed(c)
  l.x = h.x
  l.y = h.y
  l.hp = h.hp
  l.a = inp.a
  l.b = b
  const was = l.up
  l.still = moved ? 0 : l.still + dt
  l.up = l.still >= LENS.up - 1e-6
  l.k = l.up ? Math.min(1, l.k + dt / LENS.show) : Math.max(0, l.k - dt / LENS.back)
  l.here = holds(c)
  if (!l.up) return
  if (!was && l.here) c.ev.push({ type: 'lens' })
  for (const t of glassThings(c.info)) {
    if (isFalse(t) || t.cell !== s.zoneIndex) continue
    const seen = s.map.lensSeen ??= []
    if (!seen.includes(t.i)) seen.push(t.i)
  }
  placeHidden(c)
}

/** The false chest within a tile in front of the hero (A opens it, to nothing): its tile, or null. */
export function lieAhead(c: Ctx): number | null {
  const s = c.s
  const h = s.hero
  const v = dirVec(h.dir)
  if (!v.x) return null
  const t = glassThings(c.info).find(t => {
    if (t.is !== 'chest' || t.cell !== s.zoneIndex || lieGone(s, t.i) || Math.floor(h.y) !== t.y) return false
    const ahead = (t.x + 0.5 - h.x) * v.x
    return ahead > -0.35 && ahead < 1.35
  })
  return t ? t.i : null
}

/** It puffs white and is gone for the visit. */
export function puffLie(c: Ctx, i: number) {
  const m = c.s.map
  ;(m.lensGone ??= []).push({ i, t: 0 })
  c.ev.push({ type: 'puff', x: (i % m.w) + 0.5, y: Math.floor(i / m.w) + 0.5 })
}
