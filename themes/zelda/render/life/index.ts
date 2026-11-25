/** The ambient life registry (see `types.ts`). One import and one entry per critter. */
import type { GameState, IsoLandmark, MapKind } from '../../types'
import { TILE } from '../../types'
import { hash2, type Light } from '../tiles'
import { paintRows } from '../sheet'
import type { Item } from '../wild'
import type { Critter, LifeCtx } from './types'
import glimmerfae from './glimmerfae'
export type { Critter, LifeCtx } from './types'

export const CRITTERS: readonly Critter[] = [
  glimmerfae,
]

/** The lab (`scripts/zelda-lab/shot.mjs`, LIFE_FILE) shows one critter file in place of the registry. */
let critters: readonly Critter[] = CRITTERS
export function setLifeCritters(list: readonly Critter[] | null): void { critters = list ?? CRITTERS }

/** Does `c` show on this map at this hour? */
export function lifeShows(c: Critter, mapId: string, realm: string, kind: MapKind, sun: number): boolean {
  if (!(c.kinds ?? ['overworld']).includes(kind)) return false
  if (!(c.maps?.includes(mapId) || (realm && c.realms?.includes(realm)))) return false
  switch (c.when) {
    case 'dark': return sun <= 0.12
    case 'day': return sun > 0.12
    case 'dusk-dawn': return sun > -0.3 && sun <= 0.35
    default: return true
  }
}

const cache = new Map<string, HTMLCanvasElement>()
function frame(c: Critter, name: string, flip: boolean): HTMLCanvasElement | null {
  const key = name + (flip ? '|f' : '')
  let out = cache.get(key)
  if (out) return out
  const rows = c.frames[name]
  if (!rows) return null
  const src = paintRows(rows, c.pal as Record<string, string>)
  if (flip) {
    out = document.createElement('canvas')
    out.width = src.width
    out.height = src.height
    const g = out.getContext('2d')!
    g.translate(src.width, 0)
    g.scale(-1, 1)
    g.drawImage(src, 0, 0)
  } else out = src
  cache.set(key, out)
  return out
}

export interface LifeArgs {
  g: CanvasRenderingContext2D
  s: GameState
  cx: number
  cy: number
  time: number
  reduced: boolean
  sun: number
  kind: MapKind
  realm?: string
  look?: string
  items: Item[]
  lights: Light[]
  landmarks: readonly IsoLandmark[]
}

/** Every critter's frame: items to depth-sort and lights for the light map. */
export function queueLife(a: LifeArgs, only?: readonly string[]): void {
  const m = a.s.map
  const { g, cx, cy } = a
  const ctx: LifeCtx = {
    g, s: a.s, cx, cy,
    time: a.reduced ? 0 : a.time,
    reduced: a.reduced,
    sun: a.sun,
    night: a.sun <= 0.12,
    realm: a.realm ?? '',
    look: a.look ?? '',
    mapId: m.id,
    kind: a.kind,
    hx: Math.floor(a.s.hero.x),
    hy: Math.floor(a.s.hero.y),
    range: 9,
    landmarks: a.landmarks,
    items: a.items,
    lights: a.lights,
    at: (x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h ? '' : m.tiles[y * m.w + x] ?? ''),
    seed: (x, y, salt) => hash2(x, y, salt),
    add(c, name, x, y, lift = 0, flip = false, alpha = 1) {
      a.items.push({
        x, y,
        draw: () => {
          const img = frame(c, name, flip)
          if (!img) return
          if (alpha < 1) g.globalAlpha = Math.max(0, alpha)
          g.drawImage(img, Math.round(x * TILE - cx - img.width / 2), Math.round(y * TILE - cy - img.height - lift))
          if (alpha < 1) g.globalAlpha = 1
        },
      })
    },
    draw(x, y, lift, fn) {
      a.items.push({ x, y, draw: () => { g.save(); fn(g, Math.round(x * TILE - cx), Math.round(y * TILE - cy - lift)); g.restore() } })
    },
    glow(x, y, r, color, al) { a.lights.push({ x, y, r, color, a: al }) },
  }
  for (const c of critters) if ((!only || only.includes(c.id)) && lifeShows(c, m.id, ctx.realm, a.kind, a.sun)) c.queue(ctx)
}
