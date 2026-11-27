/**
 * Where the hero stands, for a feedback report: the report's `meta` and the save. It only reads. Positions are TILE
 * UNITS (`types.ts`); every key is always there, null where unknown. `shot` and `shotNote` are filled in when the
 * report is sent (the picture is made on its own, `capture.ts`).
 */
import { CHANGE_LOG } from '../changes.gen'
import { toSave } from '../engine/game'
import { mapDef } from '../engine/map'
import type { Renderer } from '../render/renderer'
import type { GameState, SaveData, World } from '../types'

export interface Snapshot {
  state: GameState
  world: World
  renderer: Renderer | null
  canvas: HTMLCanvasElement | null
  touch: boolean
  signedIn: boolean
  paused: boolean
}

/** The service's caps, UTF-8 bytes. */
export const META_MAX = 32_768
export const SAVE_MAX = 65_536
/** The window of tiles around the hero, tiles to a side. */
const NEAR = 15

const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length

function nearby(s: GameState) {
  const m = s.map
  const reach = (NEAR - 1) / 2
  const tx = Math.floor(s.hero.x)
  const ty = Math.floor(s.hero.y)
  const x0 = Math.max(0, tx - reach)
  const y0 = Math.max(0, ty - reach)
  const w = Math.min(m.w, tx + reach + 1) - x0
  const h = Math.min(m.h, ty + reach + 1) - y0
  if (w <= 0 || h <= 0) return null
  const rows = Array.from({ length: h }, (_, y) => m.tiles.slice((y0 + y) * m.w + x0, (y0 + y) * m.w + x0 + w).join(''))
  return { x0, y0, w, h, rows }
}

export function collectContext({ state: s, world, renderer, canvas, touch, signedIn, paused }: Snapshot) {
  const h = s.hero
  const def = mapDef(world, s.map.id)
  const vs = renderer?.viewState() ?? null
  const page = typeof window === 'undefined' ? null : window
  const viewport = page ? { w: page.innerWidth, h: page.innerHeight, dpr: page.devicePixelRatio || 1 } : null

  const full: SaveData | null = toSave(s)
  const saveNote: 'ok' | 'none' | 'too-big' = !full ? 'none' : bytes(full) > SAVE_MAX ? 'too-big' : 'ok'
  // (A copy through JSON: what is held for a retry stays as it was at the tap, whatever the game does after.)
  const save: SaveData | null = saveNote === 'ok' ? JSON.parse(JSON.stringify(full)) : null

  const meta = {
    v: 1 as const,
    app: 'zelda' as const,
    at: new Date().toISOString(),
    url: typeof location === 'undefined' ? null : location.origin + location.pathname,
    version: { n: CHANGE_LOG.version, hash: CHANGE_LOG.hash, date: CHANGE_LOG.date },
    where: {
      map: { id: s.map.id, name: def?.name ?? null, kind: def?.kind ?? null },
      area: s.area,
      tile: { x: Math.floor(h.x), y: Math.floor(h.y) },
      pos: { x: h.x, y: h.y },
      facing: h.dir,
      zone: s.zone ? { index: s.zoneIndex, x: s.zone.x, y: s.zone.y, w: s.zone.w, h: s.zone.h } : null,
      entry: { map: s.entry.map, entry: s.entry.entry },
      hp: h.hp,
      maxHp: h.maxHp,
      mode: s.mode,
      elapsed: s.elapsed,
      view: { id: vs?.id ?? null, rule: s.view, turning: vs?.turning ?? null, dark: vs?.dark ?? null },
      near: nearby(s),
    },
    env: {
      viewport,
      canvas: canvas ? { w: canvas.width, h: canvas.height } : null,
      touch,
      orientation: (typeof screen !== 'undefined' ? screen.orientation?.type : null) ?? (viewport ? (viewport.h >= viewport.w ? 'portrait' : 'landscape') : null),
      ua: typeof navigator === 'undefined' ? null : navigator.userAgent,
      signedIn,
      paused,
    },
    shot: null as { w: number; h: number; bytes: number; q: number } | null,
    shotNote: 'none' as 'ok' | 'none' | 'too-big' | 'error',
    saveNote,
  }
  return { meta, save }
}

export type Context = ReturnType<typeof collectContext>
