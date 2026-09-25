/**
 * The hero rig. Placeholder: coloured capsules, replaced by the real rig.
 */
import { makeCanvas } from '../../base/pixel/stage'
import { drawText } from '../../base/pixel/sprites'
import type { ActorState, GameState, HeroId } from '../types'
import type { G, View } from './api'

const COLORS: Record<string, string> = { kjell: '#8fe8ff', dag: '#ffc26b', espen: '#c7a6ff', professor: '#ffffff' }

export function drawHero(g: G, id: string, a: ActorState, v: View, walking: boolean, _s: GameState) {
  const h = id === 'dag' ? 44 : id === 'espen' ? 40 : 48
  const bob = walking ? Math.floor(v.t * 8) % 2 : 0
  g.fillStyle = '#0b0616'
  g.fillRect(Math.round(a.x - 7), Math.round(a.y - h - 1 + bob), 14, h + 1)
  g.fillStyle = COLORS[id] ?? '#fff'
  g.fillRect(Math.round(a.x - 6), Math.round(a.y - h + bob), 12, h - 1)
  g.fillStyle = '#f4f0ff'
  g.fillRect(Math.round(a.x - 5), Math.round(a.y - h - 8 + bob), 3, 8)
  g.fillRect(Math.round(a.x + 2), Math.round(a.y - h - 8 + bob), 3, 8)
  const fx = a.face === 'left' ? -3 : a.face === 'right' ? 3 : 0
  g.fillStyle = '#0b0616'
  if (a.face !== 'up') g.fillRect(Math.round(a.x + fx - 2), Math.round(a.y - h + 6 + bob), 1, 2), g.fillRect(Math.round(a.x + fx + 2), Math.round(a.y - h + 6 + bob), 1, 2)
}

const pcache = new Map<string, HTMLCanvasElement>()

/** A head for the panel: k = 1 (wide panel, ≤ 24×13) or 2 (tall panel). */
export function portrait(id: HeroId, k: number, _s: GameState): HTMLCanvasElement {
  const key = id + k
  let c = pcache.get(key)
  if (!c) {
    c = makeCanvas(16 * k, 13 * k)
    const g = c.getContext('2d')!
    g.fillStyle = COLORS[id]!
    g.fillRect(0, 0, 16 * k, 13 * k)
    drawText(g, id[0]!, 5, 3, '#0b0616')
    pcache.set(key, c)
  }
  return c
}
