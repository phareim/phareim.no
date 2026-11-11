<template>
  <canvas ref="canvas" class="invasive-canvas"></canvas>
  <EscHold :is-active="escActive" :paused="paused" :show-paused="false" @tap="togglePause" @hold="quitToGameOver" />
</template>

<script setup lang="ts">
/**
 * INVASIVE (Invaders Mk II). The rules are in ./engine.ts (pure, tested in
 * tests/invasive-engine.test.mjs), the art in ./pixel.ts, the sound in
 * ./audio.ts. This file is the glue: the canvas on Neon Shrine's pixel
 * stage, the loop, input, particles, and what it reports up to Landing.vue.
 *
 * The same shell contract as the other canvas games: a full-viewport canvas
 * behind the landing overlay that plays itself (silently) until Enter or a
 * tap starts a run. `togglePause` and `quitToGameOver` are exposed for the
 * pause card.
 */
import EscHold from '../base/EscHold.vue'
import { createPixelStage, type PixelStage } from '../base/pixel/stage'
import { bigTextWidth, drawBigText, drawText, mix, textWidth } from '../base/pixel/sprites'
import { safeBottom } from '../base/safeBottom'
import { parkRadio, unparkRadio, useSound } from '~/composables/useSound'
import {
  FLESH, HEART, POD, ROOT, STEM, TIP, WINDOWS,
  autopilot, chargeNeeded, createGame, danger, descent, mulberry32, quitRun, setField, startDemo, startRun, stepGame,
  type Game, type Input,
} from './engine'
import {
  CELL, CYAN, GOLD, HOUSE_H, INK, PART, WHITE, WINDOW_X, WINDOW_Y,
  cannonSprite, cellSprite, heartSprite, lookFor, paintBackdrop, paintHouse, paintPillar, podSprite,
  type Look,
} from './pixel'
import { voice } from './audio'

const emit = defineEmits<{
  score: [n: number]
  layer: [n: number, name: string]
  hint: [text: string]
  paused: [v: boolean]
  started: []
  restart: []
  /** The run has ended (the moment the last window goes out). */
  over: []
  /** A moment later, once the town has gone dark: show the game-over text. */
  death: []
}>()

const sound = useSound()
const canvas = ref<HTMLCanvasElement | null>(null)
const paused = ref(false)

let stage: PixelStage | null = null
let game: Game | null = null
let backdrop: HTMLCanvasElement | null = null
let raf = 0
let running = false
let lastT = 0
let W = 0
let H = 0
let reducedMotion = false
/** The field on the stage, logical px. */
const lay = { x0: 0, y0: 0, roofY: 0, groundY: 0, cols: 30, rows: 45 }

interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string }
interface Popup { x: number; y: number; text: string; life: number; color: string }
interface Flash { x: number; y: number; r: number; life: number; color: string }
let sparks: Spark[] = []
let popups: Popup[] = []
let flashes: Flash[] = []
let shake = 0
let whiteFlash = 0
let redPulse = 0
let beatAge = 9 // seconds since the last thump
let frameN = 0
let humAcc = 0
let overAt = 0
let deathEmitted = false
let reportedScore = -1
let hints = new Set<string>()
let hintUntil = 0

/** Dev only: `&bot` lets the autopilot play the run, for `scripts/invasive-lab/shot.mjs`. */
let labBot = false

const keys: Record<string, boolean> = {}
let pointerX: number | null = null
let pointerFire = false
/** A tap or click shorter than a frame still fires its one bolt. */
let queuedShot = false

// ---------------------------------------------------------------- run control

function playing(): boolean {
  return !!game && !game.demo && !game.over
}

function escActive(): boolean {
  return playing()
}

function startGame() {
  if (!game) return
  startRun(game)
  game.events.length = 0
  sparks = []
  popups = []
  flashes = []
  shake = 0
  whiteFlash = 0
  redPulse = 0
  deathEmitted = false
  reportedScore = -1
  hints = new Set()
  paused.value = false
  pointerX = null
  pointerFire = false
  sound.unlock()
  parkRadio()
  voice.start()
  emit('restart')
  emit('started')
  emit('layer', 1, game.species.name)
  report()
  hint('cut', 'CUT A TENDRIL · ALL THAT HANGS BELOW IT DIES', 9)
}

function togglePause() {
  if (!playing()) return
  paused.value = !paused.value
  clearInput()
  emit('paused', paused.value)
}

/** A 3 s Escape hold ends the run: the town goes dark, as if it had fallen. */
function quitToGameOver() {
  if (!playing() || !game) return
  paused.value = false
  emit('paused', false)
  clearInput()
  quitRun(game)
}

function report() {
  if (!game || game.demo) return
  if (game.score !== reportedScore) {
    reportedScore = game.score
    emit('score', game.score)
  }
}

/** A line of advice, once per run. */
function hint(id: string, text: string, seconds = 6) {
  if (!game || game.demo || hints.has(id)) return
  hints.add(id)
  hintUntil = game.time + seconds
  emit('hint', text)
}

// ---------------------------------------------------------------- setup

function setupCanvas() {
  const c = canvas.value
  if (!c) return
  W = c.offsetWidth
  H = c.offsetHeight
  if (!stage) stage = createPixelStage(c)
  // Three CSS px per pixel on a phone, three or four on a desk: a cell is a
  // fingertip wide and the whole sky is still a few thousand of them.
  if (H < 500) stage.resize(W, H, window.devicePixelRatio || 1, 160, 118)
  else if (W < 600) stage.resize(W, H, window.devicePixelRatio || 1, 120, 160)
  else stage.resize(W, H, window.devicePixelRatio || 1, 240, 200)
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const band = Math.ceil(safeBottom() / stage.k)
  // Under the street: the bottom band, and on touch a strip for the finger.
  const pad = coarse ? Math.round(Math.min(64, H * 0.12) / stage.k) : 2
  lay.groundY = stage.vh - band - pad - 4
  lay.roofY = lay.groundY - 4 - HOUSE_H
  const cols = Math.max(16, Math.min(52, Math.floor((stage.vw - 2) / CELL)))
  const rows = Math.max(14, Math.min(56, Math.floor(lay.roofY / CELL)))
  if (!game) game = createGame({ cols, rows, rng: mulberry32((Math.random() * 2 ** 32) >>> 0) })
  else setField(game, cols, rows)
  backdrop = paintBackdrop(stage.vw, stage.vh, lay.groundY)
  place()
}

/** Where the engine's grid sits on the stage (the run keeps its own size until its next layer). */
function place() {
  if (!stage || !game) return
  lay.cols = game.cols
  lay.rows = game.rows
  lay.x0 = Math.floor((stage.vw - game.cols * CELL) / 2)
  lay.y0 = lay.roofY - game.rows * CELL
}

/** A client x (CSS px) as a cell coordinate. */
function cellX(clientX: number): number {
  return stage ? (clientX / stage.k - lay.x0) / CELL : 0
}

// ---------------------------------------------------------------- effects

function burst(x: number, y: number, color: string, n: number, speed = 40) {
  if (sparks.length > 420) return
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const s = speed * (0.3 + Math.random())
    sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, life: 0.25 + Math.random() * 0.35, color })
  }
}

function flash(x: number, y: number, r: number, color: string, life = 0.2) {
  if (flashes.length < 14) flashes.push({ x, y, r, life, color })
}

/** Cell → the centre of it in logical px. */
function cx(x: number): number { return lay.x0 + x * CELL + CELL / 2 }
function cy(y: number): number { return lay.y0 + y * CELL + CELL / 2 }

function consume(g: Game) {
  const demo = g.demo
  const look = lookFor(g.layer)
  const root = 57 + ((g.layer - 1) % 5) * 2
  for (const e of g.events) {
    switch (e.t) {
      case 'shot':
        if (!demo) voice.shot()
        break
      case 'pop': {
        const col = e.kind === POD ? GOLD : e.severed ? look.hi : look.mid
        burst(cx(e.x), cy(e.y), col, e.severed ? 2 : 3, e.severed ? 30 : 45)
        if (e.severed && e.chain % 6 === 1) flash(cx(e.x), cy(e.y), 9, look.glow, 0.15)
        if (!demo) voice.pop(e.chain, root)
        break
      }
      case 'clank':
        burst(cx(e.x), cy(e.y) + 2, WHITE, 2, 30)
        if (!demo) voice.clank()
        break
      case 'sever':
        flash(cx(e.x), cy(e.y), 14 + Math.min(20, e.n / 4), WHITE, 0.25)
        if (e.n >= 4) popups.push({ x: cx(e.x), y: cy(e.y), text: `${e.n}`, life: 1.1, color: e.n >= 40 ? GOLD : WHITE })
        if (e.n >= 25 && !reducedMotion) shake = Math.max(shake, Math.min(1, e.n / 90))
        if (!demo) voice.sever(e.n)
        if (e.n >= 5) hint('gold', 'CATCH THE GOLD · IT CHARGES THE LANCE', 7)
        break
      case 'beat':
        beatAge = 0
        if (!demo) voice.beat(danger(g))
        if (g.layer === 1 && g.charge >= chargeNeeded(g) * 0.6) hint('heart', 'ALMOST CHARGED · GET UNDER THE HEART', 7)
        break
      case 'heartHit':
        burst(cx(e.x), cy(e.y) + 5, WHITE, 2, 60)
        if (!reducedMotion) shake = Math.max(shake, 0.25)
        if (!demo) voice.heartHit()
        break
      case 'heartDown':
        burst(cx(e.x), cy(e.y), WHITE, 40, 110)
        flash(cx(e.x), cy(e.y), 70, WHITE, 0.6)
        whiteFlash = reducedMotion ? 0.3 : 0.9
        if (!reducedMotion) shake = 1
        if (!demo) voice.heartDown(e.last)
        if (e.last && !demo) popups.push({ x: cx(e.x), y: cy(e.y) + 10, text: `+${500 * g.layer}`, life: 1.8, color: GOLD })
        break
      case 'latch':
        redPulse = Math.max(redPulse, 0.6)
        if (!demo) voice.latch()
        hint('root', 'A ROOT ON A ROOF DRINKS ITS LIGHT · CUT IT', 7)
        break
      case 'window': {
        const h = g.houses[e.house]!
        flash(cx((h.x0 + h.x1) / 2), lay.roofY + 6, 26, '#ff3b5c', 0.4)
        redPulse = 1
        if (!demo) voice.window()
        break
      }
      case 'relight':
        for (const h of g.houses) flash(cx((h.x0 + h.x1) / 2), lay.roofY + 6, 24, GOLD, 0.6)
        if (!demo) voice.relight()
        break
      case 'sporePop':
        burst(lay.x0 + e.x * CELL, lay.y0 + e.y * CELL, '#ff3b5c', 5, 40)
        if (!demo) voice.clank()
        break
      case 'stun':
        redPulse = 1
        if (!reducedMotion) shake = Math.max(shake, 0.6)
        if (!demo) voice.stun()
        hint('spore', 'SPORES SNARE THE CANNON · DODGE OR SHOOT THEM', 6)
        break
      case 'mote':
        flash(cx(g.cannon.x - 0.5), lay.groundY - 4, 10, GOLD, 0.15)
        if (!demo) voice.mote()
        break
      case 'lance':
        if (e.on) {
          whiteFlash = Math.max(whiteFlash, 0.35)
          if (!demo) voice.lanceOn()
          hint('lance', 'THE LANCE! ONLY IT CAN KILL THE HEART', 6)
        }
        break
      case 'layer':
        place()
        if (!demo) {
          voice.layer()
          emit('layer', e.n, g.species.name)
        }
        break
      case 'over':
        overAt = performance.now()
        redPulse = 1
        if (!demo) {
          voice.over()
          unparkRadio()
          emit('over')
        }
        break
    }
  }
  g.events.length = 0
}

// ---------------------------------------------------------------- update

function update(dt: number) {
  const g = game
  if (!g) return
  let input: Input
  if (g.demo) input = autopilot(g, 1, 0.5)
  else if (labBot) input = autopilot(g, 1, 0.4)
  else {
    const left = keys.ArrowLeft || keys.KeyA
    const right = keys.ArrowRight || keys.KeyD
    input = {
      move: (right ? 1 : 0) - (left ? 1 : 0),
      target: pointerX,
      fire: pointerFire || queuedShot || !!keys.Space || !!keys.ArrowUp || !!keys.KeyW,
    }
    queuedShot = false
  }
  stepGame(g, dt, input)
  consume(g)
  report()
  if (!g.demo && g.lance > 0) {
    humAcc += dt
    if (humAcc > 0.11) { humAcc = 0; voice.lanceHum() }
  }
  if (!g.demo && hintUntil && g.time > hintUntil) { hintUntil = 0; emit('hint', '') }
  if (g.over && !deathEmitted && performance.now() - overAt > 1900) {
    deathEmitted = true
    emit('death')
  }
  // Effects.
  beatAge += dt
  shake = Math.max(0, shake - dt * 2.4)
  whiteFlash = Math.max(0, whiteFlash - dt * 2.2)
  redPulse = Math.max(0, redPulse - dt * 1.6)
  let w = 0
  for (const s of sparks) {
    s.life -= dt
    if (s.life <= 0) continue
    s.vy += 90 * dt
    s.x += s.vx * dt
    s.y += s.vy * dt
    sparks[w++] = s
  }
  sparks.length = w
  w = 0
  for (const p of popups) {
    p.life -= dt
    if (p.life <= 0) continue
    p.y -= 9 * dt
    popups[w++] = p
  }
  popups.length = w
  w = 0
  for (const f of flashes) {
    f.life -= dt
    if (f.life > 0) flashes[w++] = f
  }
  flashes.length = w
}

// ---------------------------------------------------------------- draw

/** The ceiling past the field's edges and above its first row: the same flesh, out of reach. */
function drawBeyond(g: CanvasRenderingContext2D, st: PixelStage, look: Look, body: number, off: number, beats: number) {
  const bottom = lay.y0 + body * CELL
  const left = lay.x0
  const right = lay.x0 + lay.cols * CELL
  for (let y = bottom - CELL; y > -CELL - off; y -= CELL) {
    const row = Math.round((y - lay.y0) / CELL)
    for (let x = left - CELL; x > -CELL; x -= CELL) g.drawImage(cellSprite(look, PART.Flesh, (beats + row + x / CELL) & 1, 0), x, y - off)
    for (let x = right; x < st.vw; x += CELL) g.drawImage(cellSprite(look, PART.Flesh, (beats + row + x / CELL) & 1, 0), x, y - off)
    if (row < 0) for (let x = left; x < right; x += CELL) g.drawImage(cellSprite(look, PART.Flesh, (beats + row + x / CELL) & 1, 0), x, y - off)
  }
}

function drawMass(g: CanvasRenderingContext2D, st: PixelStage, gm: Game, look: Look, off: number) {
  const { cols, rows, kind, hp, dist, dieAt, beats } = gm
  const I = gm.beatInterval
  const tb = gm.phase === 'play' ? gm.beatT : 99
  for (let y = 0; y < rows; y++) {
    const py = lay.y0 + y * CELL - off
    if (py < -CELL) continue
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      const k = kind[i]!
      if (!k || k === HEART) continue
      const px = lay.x0 + x * CELL
      const frame = (beats + x + y) & 1
      if (dieAt[i]) {
        // A fuse: severed cells flicker white until they go.
        g.drawImage(cellSprite(look, PART.Dying, frame, (frameN + x + y) & 1), px, py)
        st.emit(px, py, CELL, CELL)
        continue
      }
      // The pulse leaves the heart on the thump and runs out through the tissue.
      let u = tb - dist[i]! * 0.02
      u = tb > 50 ? 9 : ((u % I) + I) % I
      const wave = u < 0.08 ? 2 : u < 0.2 ? 1 : 0
      if (k === FLESH) {
        g.drawImage(cellSprite(look, PART.Flesh, frame, wave), px, py)
      } else if (k === STEM) {
        if (hp[i]! > 1) g.drawImage(cellSprite(look, PART.Bark, 0, wave), px, py)
        else g.drawImage(cellSprite(look, PART.Stem, frame, wave === 2 ? 2 : 1), px, py)
      } else if (k === TIP) {
        g.drawImage(cellSprite(look, PART.Tip, frame, wave === 2 ? 2 : 1), px, py)
        st.emit(px, py, CELL, CELL)
        st.light(px + 2, py + 2, 8, look.glow, 0.7)
      } else if (k === ROOT) {
        const hot = (frameN >> 3) & 1
        g.drawImage(cellSprite(look, PART.Root, frame, hot ? 2 : 1), px, py)
        st.emit(px, py, CELL, CELL)
        st.light(px + 2, py + 2, 12, '#ff3b5c', 0.6 + hot * 0.3)
      } else if (k === POD) {
        const swell = wave > 0
        g.drawImage(podSprite(look, swell), px - 1, py - 1)
        st.light(px + 2, py + 2, 9, GOLD, 0.55)
      }
    }
  }
  for (const h of gm.hearts) {
    if (!h.alive) continue
    const hx = lay.x0 + (h.x - 1) * CELL
    const hy = lay.y0 + (h.y - 1) * CELL - off
    const thump = gm.phase === 'play' && beatAge < 0.11
    const hurt = h.hp < h.maxHp * 0.34 ? 2 : h.hp < h.maxHp * 0.67 ? 1 : 0
    const struck = gm.lance > 0 && gm.beamTop >= 0 && Math.abs(Math.floor(gm.cannon.x) - h.x) <= 1 && (frameN & 1) === 0
    const img = heartSprite(look, hurt, thump, struck)
    if (thump) g.drawImage(img, hx - 1, hy - 1, 14, 14)
    else g.drawImage(img, hx, hy)
    st.emit(hx, hy, 12, 12)
    st.light(hx + 6, hy + 6, thump ? 46 : 34, look.glow, thump ? 1 : 0.75)
  }
}

function drawTown(g: CanvasRenderingContext2D, st: PixelStage, gm: Game) {
  for (let i = 0; i < gm.houses.length; i++) {
    const h = gm.houses[i]!
    const x = lay.x0 + h.x0 * CELL
    paintHouse(g, x, lay.roofY, h.lights, i)
    for (let w = 0; w < WINDOW_X.length; w++) {
      if (w < WINDOW_X.length - h.lights) continue
      st.emit(x + WINDOW_X[w]!, lay.roofY + WINDOW_Y, 2, 3)
    }
    if (h.lights > 0) st.light(x + 10, lay.roofY + 7, 14 + h.lights * 4, GOLD, 0.3 + h.lights * 0.13)
    // Roots run down the wall of a house that is being drunk.
    if (h.roots && h.lights > 0) {
      g.fillStyle = '#ff3b5c'
      for (let r = 0; r < Math.min(3, h.roots); r++) g.fillRect(x + 4 + r * 6, lay.roofY, 1, 5 + ((frameN >> 3) + r) % 3)
    }
  }
  // On a wide screen the field ends at two stone pillars.
  if (lay.x0 > 8) {
    paintPillar(g, lay.x0 - 4, 0, lay.groundY)
    paintPillar(g, lay.x0 + lay.cols * CELL + 1, 0, lay.groundY)
  }
}

function drawCannon(g: CanvasRenderingContext2D, st: PixelStage, gm: Game) {
  const c = gm.cannon
  const x = Math.round(lay.x0 + c.x * CELL - 5.5)
  const y = lay.groundY - 7
  const snared = c.stun > 0
  const mode = snared ? 'snared' : gm.lance > 0 ? 'lance' : 'plain'
  // A flicker of grace after it shakes the spores off.
  if (c.grace > 0 && (frameN & 2)) return
  g.drawImage(cannonSprite(mode), x, y)
  if (snared) {
    g.fillStyle = '#ff3b5c'
    for (let i = 0; i < 4; i++) g.fillRect(x + ((i * 3 + (frameN >> 2)) % 11), y + 1 + (i % 3) * 2, 2, 1)
  }
  st.light(x + 5, y + 3, snared ? 8 : 12, snared ? '#ff3b5c' : gm.lance > 0 ? GOLD : CYAN, 0.55)
}

function drawGlowing(g: CanvasRenderingContext2D, st: PixelStage, gm: Game, look: Look) {
  // The curb is the lance's gauge: it fills with gold from the left, and burns down while the lance is lit.
  const fw = lay.cols * CELL
  if (gm.lance > 0) {
    g.fillStyle = (frameN & 2) ? WHITE : GOLD
    g.fillRect(lay.x0, lay.groundY, Math.round(fw * Math.min(1, gm.lance / 3.2)), 1)
  } else if (gm.charge > 0) {
    g.fillStyle = GOLD
    g.fillRect(lay.x0, lay.groundY, Math.round(fw * gm.charge / chargeNeeded(gm)), 1)
  }
  // Bolts.
  g.fillStyle = CYAN
  for (const b of gm.bolts) g.fillRect(lay.x0 + b.col * CELL + 1, Math.round(lay.y0 + b.y * CELL), 2, 4)
  // The lance.
  if (gm.lance > 0 && gm.cannon.stun <= 0) {
    const col = Math.max(0, Math.min(gm.cols - 1, Math.floor(gm.cannon.x)))
    const x = lay.x0 + col * CELL
    const top = gm.beamTop < 0 ? 0 : lay.y0 + (gm.beamTop + 1) * CELL
    const bottom = lay.groundY - 7
    g.fillStyle = GOLD
    g.fillRect(x, top, CELL, bottom - top)
    g.fillStyle = WHITE
    g.fillRect(x + 1, top, 2, bottom - top)
    if (frameN & 1) burst(x + 2, top, GOLD, 1, 50)
  }
  // Spores: red drops with a tail.
  for (const s of gm.spores) {
    const x = Math.round(lay.x0 + s.x * CELL)
    const y = Math.round(lay.y0 + s.y * CELL)
    g.fillStyle = '#ff3b5c'
    g.fillRect(x - 1, y - 1, 2, 3)
    g.fillStyle = WHITE
    g.fillRect(x - 1, y + 1, 2, 1)
    g.fillStyle = '#9e1638'
    g.fillRect(x - 1 + (frameN >> 2 & 1), y - 3, 1, 2)
  }
  // Motes: gold seeds that twinkle on the way down.
  for (let i = 0; i < gm.motes.length; i++) {
    const m = gm.motes[i]!
    const x = Math.round(lay.x0 + m.x * CELL)
    const y = Math.round(lay.y0 + m.y * CELL)
    const tw = ((frameN >> 2) + i) & 3
    g.fillStyle = tw === 0 ? WHITE : GOLD
    g.fillRect(x, y, 1, 1)
    if (tw < 2) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3) }
  }
  for (const s of sparks) {
    g.globalAlpha = Math.min(1, s.life * 3)
    g.fillStyle = s.color
    g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1)
  }
  g.globalAlpha = 1
  if (redPulse > 0.02) {
    g.globalAlpha = redPulse * 0.3
    g.fillStyle = '#ff3b5c'
    const e = 3
    g.fillRect(0, 0, st.vw, e)
    g.fillRect(0, st.vh - e, st.vw, e)
    g.fillRect(0, 0, e, st.vh)
    g.fillRect(st.vw - e, 0, e, st.vh)
    g.globalAlpha = 1
  }
  void look
}

function drawHud(h: CanvasRenderingContext2D, st: PixelStage, gm: Game, look: Look) {
  for (const p of popups) {
    const w = textWidth(p.text)
    const x = Math.max(1, Math.min(st.vw - w - 1, Math.round(p.x - w / 2)))
    h.globalAlpha = Math.min(1, p.life * 2)
    drawText(h, p.text, x, Math.round(p.y), p.color, INK)
  }
  h.globalAlpha = 1
  if (gm.demo) return
  const mid = Math.round(lay.y0 + (gm.rows * CELL) * 0.55)
  if (gm.phase === 'descend' && gm.phaseT < 1.5) {
    const n = st.vw > 200 ? 3 : 2
    const title = `LAYER ${gm.layer}`
    drawBigText(h, title, Math.round((st.vw - bigTextWidth(title, n)) / 2), mid - 4 * n, n, look.hi, INK)
    const name = gm.species.name
    drawText(h, name, Math.round((st.vw - textWidth(name)) / 2), mid + 5 * n, look.mid, INK)
  } else if (gm.phase === 'between') {
    const n = st.vw > 200 ? 3 : 2
    const title = 'HEART DOWN'
    if ((frameN >> 3) & 1 || gm.phaseT > 0.8) drawBigText(h, title, Math.round((st.vw - bigTextWidth(title, n)) / 2), mid - 4 * n, n, GOLD, INK)
  } else if (gm.cannon.stun > 0 && (frameN >> 2) & 1) {
    const t = 'SNARED'
    const x = Math.max(1, Math.min(st.vw - textWidth(t) - 1, Math.round(lay.x0 + gm.cannon.x * CELL - textWidth(t) / 2)))
    drawText(h, t, x, lay.groundY - 18, '#ff3b5c', INK)
  }
}

function draw() {
  const st = stage
  const gm = game
  if (!st || !gm || !backdrop) return
  frameN++
  const look = lookFor(gm.layer)
  const g = st.begin()
  g.drawImage(backdrop, 0, 0)
  // A new ceiling comes down from above the screen.
  const off = Math.round(descent(gm) * (lay.y0 + gm.body * CELL + 6))
  const empty = gm.phase === 'between' || (gm.phase === 'collapse' && !gm.dying.length)
  if (!empty && gm.phase !== 'collapse') drawBeyond(g, st, look, gm.body, off, gm.beats)
  drawMass(g, st, gm, look, off)
  drawTown(g, st, gm)
  drawCannon(g, st, gm)
  for (const b of gm.bolts) st.light(lay.x0 + b.col * CELL + 2, lay.y0 + b.y * CELL + 2, 7, CYAN, 0.8)
  for (let i = 0; i < gm.motes.length && i < 12; i++) st.light(lay.x0 + gm.motes[i]!.x * CELL, lay.y0 + gm.motes[i]!.y * CELL, 6, GOLD, 0.6)
  for (const s of gm.spores) st.light(lay.x0 + s.x * CELL, lay.y0 + s.y * CELL, 7, '#ff3b5c', 0.7)
  for (const f of flashes) st.light(f.x, f.y, f.r, f.color, Math.min(1, f.life * 5))
  if (gm.lance > 0 && gm.cannon.stun <= 0) {
    const x = lay.x0 + Math.floor(gm.cannon.x) * CELL + 2
    const top = gm.beamTop < 0 ? 0 : lay.y0 + (gm.beamTop + 1) * CELL
    for (let y = lay.groundY - 10; y > top; y -= 18) st.light(x, y, 16, GOLD, 0.9)
  }
  drawHud(st.hud, st, gm, look)
  // The town's windows are the light: every one that goes out darkens the whole picture.
  let lit = 0
  for (const h of gm.houses) lit += h.lights
  const f = lit / Math.max(1, gm.houses.length * WINDOWS)
  const ambient = gm.over ? '#1c1638' : mix('#3a3064', gm.demo ? '#7468a8' : '#9486cc', f)
  const m = reducedMotion ? 0 : shake * 2.5
  st.present({
    ambient,
    shakeX: m ? (Math.random() - 0.5) * m * 2 : 0,
    shakeY: m ? (Math.random() - 0.5) * m * 2 : 0,
    flash: whiteFlash > 0.01 ? { color: '#ffffff', a: whiteFlash * 0.5 } : null,
    afterLight: g2 => drawGlowing(g2, st, gm, look),
  })
}

function frame(now: number) {
  if (!running) return
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000))
  lastT = now
  if (!paused.value) update(dt)
  draw()
  raf = requestAnimationFrame(frame)
}

// ---------------------------------------------------------------- input

function isInteractive(el: EventTarget | null): boolean {
  const e = el as HTMLElement | null
  if (!e || !e.closest) return false
  return !!e.closest('a, button, input')
}

function clearInput() {
  for (const k in keys) keys[k] = false
  pointerFire = false
  queuedShot = false
  pointerX = null
  touchId = null
}

function onKeyDown(e: KeyboardEvent) {
  if (isInteractive(e.target)) return
  // Escape belongs to EscHold (tap = pause, 3 s hold = quit); P pauses too.
  if (e.code === 'Escape') return
  if (e.code === 'KeyP' && !e.repeat) {
    if (playing()) { e.preventDefault(); togglePause() }
    return
  }
  if (paused.value) return
  if (!playing()) {
    if (e.code === 'Enter' && !e.repeat && (!game || !game.over || deathEmitted)) startGame()
    return
  }
  keys[e.code] = true
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault()
  // The keys take the cannon back from the mouse.
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD') pointerX = null
}

function onKeyUp(e: KeyboardEvent) {
  keys[e.code] = false
}

function onMouseMove(e: MouseEvent) {
  if (!playing() || paused.value || performance.now() - lastTouchEnd < 700) return
  pointerX = cellX(e.clientX)
}

function onMouseDown(e: MouseEvent) {
  // A tap also sends a mousedown after touchend.
  if (performance.now() - lastTouchEnd < 700) return
  if (e.button !== 0 || isInteractive(e.target) || !playing() || paused.value) return
  pointerX = cellX(e.clientX)
  pointerFire = true
  queuedShot = true
}

function onMouseUp() {
  if (touchId === null) pointerFire = false
}

let touchId: number | null = null
let tapX = 0
let tapY = 0
let tapT = 0
let lastTouchEnd = -Infinity

function onTouchStart(e: TouchEvent) {
  if (isInteractive(e.target) || touchId !== null) return
  const t = e.changedTouches[0]
  if (!t) return
  touchId = t.identifier
  tapX = t.clientX
  tapY = t.clientY
  tapT = performance.now()
  // Idle: a tap starts (on touchend), a swipe does nothing.
  if (!playing() || paused.value) return
  e.preventDefault()
  pointerX = cellX(t.clientX)
  pointerFire = true
  queuedShot = true
}

function onTouchMove(e: TouchEvent) {
  const t = Array.from(e.changedTouches).find(q => q.identifier === touchId)
  if (!t || !pointerFire) return
  e.preventDefault()
  pointerX = cellX(t.clientX)
}

function onTouchEnd(e: TouchEvent) {
  const t = Array.from(e.changedTouches).find(q => q.identifier === touchId)
  if (!t) return
  const tap = Math.hypot(t.clientX - tapX, t.clientY - tapY) < 15 && performance.now() - tapT < 400
  if (tap && !playing() && !paused.value && !isInteractive(e.target) && (!game || !game.over || deathEmitted)) startGame()
  touchId = null
  pointerFire = false
  pointerX = null
  lastTouchEnd = performance.now()
}

function onTouchCancel(e: TouchEvent) {
  if (Array.from(e.changedTouches).some(q => q.identifier === touchId)) clearInput()
}

function onVisibility() {
  if (document.hidden) clearInput()
}

let resizeT: ReturnType<typeof setTimeout> | null = null
function onResize() {
  if (resizeT) clearTimeout(resizeT)
  resizeT = setTimeout(() => { resizeT = null; setupCanvas() }, 150)
}

defineExpose({ togglePause, quitToGameOver })

onMounted(() => {
  reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  labBot = import.meta.dev && new URLSearchParams(location.search).has('bot')
  setupCanvas()
  if (game) startDemo(game)
  place()
  running = true
  lastT = performance.now()
  raf = requestAnimationFrame(frame)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('resize', onResize)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('touchstart', onTouchStart, { passive: false })
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
  window.addEventListener('touchcancel', onTouchCancel)
  window.addEventListener('blur', clearInput)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  running = false
  unparkRadio()
  if (resizeT) clearTimeout(resizeT)
  if (raf) cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mousedown', onMouseDown)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('touchstart', onTouchStart)
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', onTouchEnd)
  window.removeEventListener('touchcancel', onTouchCancel)
  window.removeEventListener('blur', clearInput)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style scoped>
/* Full-viewport playfield behind the landing overlay. */
.invasive-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: var(--app-height, 100dvh);
  display: block;
  z-index: 1;
}
</style>
