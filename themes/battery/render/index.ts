/**
 * The renderer: the room (or split screen) in the scene box, the actors
 * sorted by depth, the light map, then the unlit HUD layer with speech,
 * the panel, cards and the cursor. Reads the Game; never changes it.
 */
import type { PixelStage } from '../../base/pixel/stage'
import { makeCanvas } from '../../base/pixel/stage'
import { mix } from '../../base/pixel/sprites'
import type { Game } from '../engine/game'
import type { Box } from '../engine/layout'
import type { ActorId, HeroId, RoomId } from '../types'
import { HERO_IDS, ROOM_H } from '../types'
import type { G, View } from './api'
import { ROOM_PAINTERS } from './rooms/index'
import { NPC_PAINTERS } from './npcs'
import { drawHero } from './actors'
import { drawPanel, drawSpeech, drawCard, drawCursor, drawHeader } from './ui'
import { drawRain } from './fx'

const BG = '#07040d'

export interface Renderer {
  draw(stage: PixelStage, game: Game, opts: { cursor: boolean }): void
  /** Drop cached room backgrounds (after a hot reload). */
  reset(): void
}

export function createRenderer(): Renderer {
  const bgCache = new Map<RoomId, HTMLCanvasElement>()

  function background(room: RoomId, w: number): HTMLCanvasElement {
    let c = bgCache.get(room)
    if (!c || c.width !== w) {
      c = makeCanvas(w, ROOM_H)
      const g = c.getContext('2d')!
      g.imageSmoothingEnabled = false
      ROOM_PAINTERS[room].paint(g, w, ROOM_H)
      bgCache.set(room, c)
    }
    return c
  }

  function draw(stage: PixelStage, game: Game, opts: { cursor: boolean }) {
    const g = stage.begin()
    const L = game.lay
    g.fillStyle = BG
    g.fillRect(0, 0, stage.vw, stage.vh)

    const glows: (() => void)[] = []
    const talking = game.speech ? game.speech.who : null
    let ambient = '#8a80a8'

    const drawRoom = (room: RoomId, box: Box, camX: number) => {
      const def = game.content.rooms[room]
      const painter = ROOM_PAINTERS[room]
      const v: View = { room, camX, w: box.w, t: game.clock, flash: game.flash, talking }
      const ox = box.x - camX
      const oy = box.y
      g.save()
      g.beginPath()
      g.rect(box.x, box.y, box.w, box.h)
      g.clip()
      g.translate(ox, oy)
      g.drawImage(background(room, def.w), 0, 0)
      painter.back?.(g, game.s, v)
      // Actors by depth: heroes, the Professor and the house's people.
      const here: { id: string; y: number }[] = []
      for (const [id, a] of Object.entries(game.s.actors)) {
        if (a.room === room && a.visible && id !== 'narrator') here.push({ id, y: a.y })
      }
      here.sort((p, q) => p.y - q.y)
      for (const { id } of here) {
        const a = game.s.actors[id]!
        if ((HERO_IDS as readonly string[]).includes(id) || id === 'professor') drawHero(g, id, a, v, game.walking(id as ActorId), game.s)
        else NPC_PAINTERS[id]?.(g, a, v, game.s)
      }
      painter.front?.(g, game.s, v)
      drawRain(g, def.floor, v)
      g.restore()
      painter.lights?.((x, y, r, color, a = 1) => stage.light(x + ox, y + oy, r, color, a), game.s, v)
      if (painter.glow) {
        glows.push(() => {
          g.save()
          g.beginPath()
          g.rect(box.x, box.y, box.w, box.h)
          g.clip()
          g.translate(ox, oy)
          painter.glow!(g, game.s, v)
          g.restore()
        })
      }
      return painter.ambient(game.s, v)
    }

    if (game.split) {
      const n = game.split.length
      const pw = Math.floor((L.scene.w - (n - 1) * 2) / n)
      game.split.forEach((p, i) => {
        const box = { x: L.scene.x + i * (pw + 2), y: L.scene.y, w: pw, h: L.scene.h }
        const rw = game.content.rooms[p.room].w
        const camX = Math.max(0, Math.min(rw - pw, Math.round(p.x - pw / 2)))
        const amb = drawRoom(p.room, box, camX)
        if (i === 0) ambient = amb
      })
    } else {
      ambient = drawRoom(game.room, L.scene, game.camX)
    }

    // The HUD layer is composited by present(), so it is drawn first.
    const h = stage.hud
    if (L.header) drawHeader(h, game, L.header)
    drawSpeech(h, game)
    drawPanel(h, game)
    if (game.card) drawCard(h, game, stage.hw, stage.hh)
    if (opts.cursor && game.pointer) drawCursor(h, game)

    const stormAmbient = game.flash > 0 ? mix(ambient, '#e8ecff', Math.min(1, game.flash) * 0.55) : ambient
    stage.present({
      ambient: stormAmbient,
      afterLight: () => {
        for (const f of glows) f()
        // The panel area stays black under the HUD.
        g.fillStyle = BG
        if (L.tall) {
          g.fillRect(0, L.scene.y + L.scene.h, stage.vw, stage.vh)
          g.fillRect(0, 0, stage.vw, L.scene.y)
        } else {
          g.fillRect(0, L.scene.y + L.scene.h, stage.vw, stage.vh)
          g.fillRect(0, 0, stage.vw, L.scene.y)
        }
      },
      flash: game.flashA > 0 ? { color: game.flashColor, a: game.flashA } : null,
      fade: game.card ? 1 : game.fade,
      shakeX: game.shake > 0 ? Math.round((Math.random() * 2 - 1) * game.shakePx) : 0,
      shakeY: game.shake > 0 ? Math.round((Math.random() * 2 - 1) * game.shakePx) : 0,
      bloom: 0.8,
    })

  }

  return { draw, reset: () => bgCache.clear() }
}

export type { HeroId, G }
