/**
 * The pencil view: the world as it was sketched before the pixels.
 *
 * The picture is the classic one, top-down and unlit, handed to Blyant's
 * pencil (`Blyant.Sketch2D`, npm `blyant`): the edge between two colours is a
 * contour drawn twice by a shaking hand, the light map is hatching, colour
 * is coloured pencil rubbed into the paper's grain, and every tile is a
 * square on squared paper. The hand follows the world, not the screen, so a
 * line stands still while the camera walks past it.
 *
 * Papir is pencil on a light sheet, Kull chalk on a dark one; `auto` follows
 * the visitor's light or dark mode, as Blyant does everywhere else. The HUD
 * is notes on the same paper (`paperSkin` in `hud.ts`).
 *
 * `k` mixes the sketch in over the classic picture in patches, like a drawing
 * coming to be, so the turn from the classic view needs no cut.
 */
import 'blyant/dist/blyant.js'
import type { GameState } from '../../types'
import { TILE } from '../../types'
import { mapInfo } from '../../engine/index'
import type { FrameUI, Kit, View } from '../renderer'
import { NEON_SKIN, paperSkin, type HudSkin } from '../hud'
import { AMBIENCE } from '../tones'

const T = TILE

/** Blyant's tokens for the two sheets (tokens.json in phareim/blyant). */
const SHEETS = {
  papir: { sheet: '#fafaf7', sheet2: '#f0f0ec', line: '#454641', ink: '#252623', soft: '#6b6c66', faint: '#a8a9a2', grid: '#d5d5cf', red: '#c4705f', blue: '#3d6c99', yellow: '#b28f2c', green: '#5b904f', veil: 'rgba(250,250,247,0.84)' },
  kull: { sheet: '#1c1d1b', sheet2: '#252623', line: '#c8c9c2', ink: '#ecece6', soft: '#a2a39c', faint: '#5f605b', grid: '#3b3c38', red: '#d98877', blue: '#9cc1e6', yellow: '#e2c970', green: '#9cb887', veil: 'rgba(28,29,27,0.84)' },
} as const
type SheetId = keyof typeof SHEETS

/** The light the picture counts as plain daylight, per kind of map: what is darker gets hatched, what is brighter is a lamp. */
const DAY = { overworld: '#8e82c4', dungeon: '#7d6fb4', interior: '#c8b4dc' }

interface Sketch {
  canvas: HTMLCanvasElement
  ok: boolean
  set(patch: Record<string, unknown>): Sketch
  render(source: HTMLCanvasElement, frame: Record<string, unknown>): HTMLCanvasElement
}

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255
}

export default function blyantView(kit: Kit): View {
  const Blyant = (window as unknown as { Blyant: { Sketch2D: new (o?: Record<string, unknown>) => Sketch } }).Blyant
  const sketch = new Blyant.Sketch2D({ pixelRatio: 1 })
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)')
  let skinKey = ''
  let skin: HudSkin = NEON_SKIN

  function draw(s: GameState, ui: FrameUI, dt: number, k: number) {
    const p = kit.params('blyant')
    const sheetId: SheetId = p.paper === 'papir' || p.paper === 'kull' ? p.paper : dark?.matches ? 'kull' : 'papir'
    const sheet = SHEETS[sheetId]
    const paper = (p.paperColor as string) || sheet.sheet
    const ink = (p.inkColor as string) || sheet.ink
    const key = `${sheetId}:${paper}:${ink}`
    if (key !== skinKey) {
      skinKey = key
      skin = paperSkin({ ...sheet, sheet: paper, ink })
    }
    const scr = kit.screen()
    const { vw, vh } = kit.size()
    const g = kit.scene()
    const def = mapInfo(kit.world, s.map.id).def

    // The classic picture, unlit, on a ground the colour of the sheet: where the map ends, the paper is bare.
    const pic = kit.classic.world(s, ui, paper)
    kit.classic.light(s, ui, pic)
    const { g: lg, canvas: light } = kit.lightMap()
    // What shines by itself is drawn on the picture and on the light, so it is lit by its own colour.
    kit.classic.glows(g, s, ui, dt, pic)
    kit.classic.glows(lg, s, ui, 0, pic, true)
    kit.classic.rooms(g, s, pic, paper)
    kit.classic.rooms(lg, s, pic, '#ffffff')
    const fade = kit.flashFade(g, s, ui, dt, paper)
    if (fade > 0) { lg.globalAlpha = Math.min(1, fade); lg.fillStyle = '#ffffff'; lg.fillRect(0, 0, vw, vh); lg.globalAlpha = 1 }

    sketch.set({
      paper, ink, faint: sheet.grid,
      wobble: ui.reducedMotion ? Math.min(p.wobble as number, 1.2) : p.wobble,
      lineWidth: p.lineWidth, detail: p.detail, hatch: p.hatch, hatchGap: p.hatchGap,
      shade: p.shade, exposure: p.exposure, colour: p.colour, grain: p.grain, grid: p.grid ? T : 0,
      boil: p.boil && !ui.reducedMotion && !ui.paused,
      // The hand is as large as the art: three screen px to a game px is the size Blyant draws at.
      pixelRatio: Math.max(0.8, scr.scale / 3),
    })
    const day = def.ambient ? AMBIENCE[def.ambient] : DAY[def.kind]
    const out = sketch.render(kit.sceneCanvas(), {
      light, lightRef: lum(day), pixel: scr.scale, width: vw * scr.scale, height: vh * scr.scale,
      origin: [pic.cx, pic.cy], mix: k, time: kit.time(),
    })
    const sg = scr.g
    sg.setTransform(1, 0, 0, 1, 0, 0)
    sg.globalCompositeOperation = 'source-over'
    sg.globalAlpha = 1
    sg.fillStyle = paper
    sg.fillRect(0, 0, scr.W, scr.H)
    sg.imageSmoothingEnabled = false
    sg.drawImage(out, scr.ox, scr.oy)
    // Halfway through the turn the HUD is still the classic one: it changes dress with the picture.
    const windows = p.windows === 'paper' && k > 0.5 ? skin : NEON_SKIN
    kit.hudLayer(s, ui, dt, pic.cx, pic.cy, s.hero.y * T - pic.cy, windows)
  }

  return { draw, turn: 0 }
}
