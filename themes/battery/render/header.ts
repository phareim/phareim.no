/**
 * The tall (phone) layout's header above the scene. Placeholder: the title
 * and where the current hero is.
 */
import { drawText, textWidth } from '../../base/pixel/sprites'
import type { Game } from '../engine/game'
import type { Box } from '../engine/layout'
import type { G } from './api'

export function drawHouseHeader(g: G, game: Game, b: Box) {
  const room = game.roomDef()
  const hero = game.content.heroes[game.hero]
  const title = 'NIGHT OF THE DEAD BATTERY'
  const y = b.y + b.h - 22
  if (y < 4) return
  drawText(g, title, Math.round((b.w - textWidth(title)) / 2), y, '#5a4a80')
  const sub = `${hero.name} · ${room.name}`
  drawText(g, sub, Math.round((b.w - textWidth(sub)) / 2), y + 10, hero.color)
}
