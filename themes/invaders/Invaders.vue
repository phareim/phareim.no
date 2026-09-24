<template>
  <canvas ref="canvas" class="invaders-canvas"></canvas>
  <EscHold :is-active="escActive" :paused="paused" @tap="togglePause" @hold="quitToGameOver" />
</template>

<script setup>
import EscHold from '../base/EscHold.vue'
/**
 * SYNTHWAVE HORIZON — a faithful 1978 Space Invaders formation game.
 *
 * Same shell contract as rtype/Shooter.vue and breakout/Breakout.vue: a
 * full-viewport canvas behind the landing overlay, attract-mode autopilot
 * until Enter/tap, events up to Landing.vue for the HUD.
 *
 * Rules: 5-row formation (squid 30 / crab 20 / octopus 10, two frames each),
 * sideways march + step down on edge, step timer quickens as invaders die
 * (the heartbeat), lowest-per-column bombs (zigzag / plunger / rolling),
 * 4 eroding bunkers (3 on narrow screens), mystery UFO 50-300 pts, one
 * player shot at a time, one life +1 at 1500, next wave starts one row lower,
 * game over on invasion or 0 lives.
 *
 * Look (2026-09-24): Neon Shrine's pixel stage. The formation comes down
 * over the town at dusk — sky, striped sun, ridges, trees, houses with lit
 * windows, grass — drawn in logical pixels (one sprite pixel each), lit by
 * a light map, bloomed and scanlined like the portal. Invaders are the 1978
 * bitmaps outlined and shaded, with eyes that flash on the heartbeat; the
 * bunkers are shrine stone. Rules stay in CSS px; `L()` converts. Twist: a KILL COMBO — kills within 1.5 s bump a
 * multiplier x1->x4 shown as a glowing tag near the cannon; a miss resets it.
 */
const emit = defineEmits(['score', 'wave', 'lives', 'death', 'restart', 'started', 'over'])

import { createPixelStage } from '../base/pixel/stage'
import { drawText, mix, silhouette, sprite, textWidth } from '../base/pixel/sprites'
import { PICKUP_B, PICKUP_P, SPECIES_LOOK, cannonRows, createInvadersScene, paintBunker, ring, shaded } from './pixel'
import { safeBottom } from '../base/safeBottom'
import { readShipDef } from '~/composables/useShip'
import { useSound } from '~/composables/useSound'

const sound = useSound()
// Throttles: the march steps and multi-kills would be a wall of noise.
let lastStepSfx = 0
let lastBoomSfx = 0
let lastZapSfx = 0
function stepSfx() {
  const now = performance.now() / 1000
  if (now - lastStepSfx < 0.09) return
  lastStepSfx = now
  sound.sfx.marchStep()
}
function boomSfx(big = false) {
  const now = performance.now() / 1000
  if (now - lastBoomSfx < 0.09) return
  lastBoomSfx = now
  sound.sfx.explosion(big)
}
function zapSfx() {
  const now = performance.now() / 1000
  if (now - lastZapSfx < 0.25) return
  lastZapSfx = now
  sound.sfx.enemyShoot()
}

const canvas = ref(null)
let stage = null // Neon Shrine's pixel stage (themes/base/pixel/stage.ts)
const scene = createInvadersScene() // the town at dusk (./pixel.ts)
let sunFlare = 0 // wave-clear flare on the sun
let animationFrameId = null
let gameRunning = false

// Viewport (CSS px).
let SW = 0
let SH = 0
let dpr = 1
// The site's bottom band (--app-safe-bottom): the backdrop runs through it,
// the cannon, bunkers and weapon label stay above. 0 in a browser tab.
let band = 0

const PINK = '#ff2fa0'
const CYAN = '#2ff3ff'
const GOLD = '#ffd23f'
const ORANGE = '#ff6a3d'
// The Hangar ship, read live: the cannon flies its colours. (CYAN stays
// for invader-side effects and the combo tag's own semantics.)
let shipDef = readShipDef()
const LIVES = 1
const EXTRA_AT = 1500
const MAX_PARTICLES = 300
const ROWS = 5

// ---------------------------------------------------------------- sprites
// 1978 bitmaps, encoded as bit rows. Two frames per species.

const SQUID_A = [
  '...XX...',
  '..XXXX..',
  '.XXXXXX.',
  'XX.XX.XX',
  'XXXXXXXX',
  '..X..X..',
  '.X.XX.X.',
  'X.X..X.X',
]
const SQUID_B = [
  '...XX...',
  '..XXXX..',
  '.XXXXXX.',
  'XX.XX.XX',
  'XXXXXXXX',
  '.X.XX.X.',
  'X......X',
  '.X....X.',
]
const CRAB_A = [
  '..X.....X..',
  '...X...X...',
  '..XXXXXXX..',
  '.XX.XXX.XX.',
  'XXXXXXXXXXX',
  'X.XXXXXXX.X',
  'X.X.....X.X',
  '...XX.XX...',
]
const CRAB_B = [
  '..X.....X..',
  '.X.X...X.X.',
  'X.XXXXXXX.X',
  'XXX.XXX.XXX',
  'XXXXXXXXXXX',
  '.XXXXXXXXX.',
  '..X.....X..',
  '.X.......X.',
]
const OCTO_A = [
  '....XXXX....',
  '.XXXXXXXXXX.',
  'XXXXXXXXXXXX',
  'XX.XX.XX.XX.',
  'XXXXXXXXXXXX',
  '...XX..XX...',
  '..XXXXXXXX..',
  '.XX......XX.',
]
const OCTO_B = [
  '....XXXX....',
  '.XXXXXXXXXX.',
  'XXXXXXXXXXXX',
  'XX.XX.XX.XX.',
  'XXXXXXXXXXXX',
  '..XXX..XXX..',
  '.XX..XX..XX.',
  '..XX....XX..',
]
const CANNON = [
  '......X......',
  '.....XXX.....',
  '....XXXXX....',
  '...XXXXXXX...',
  '.XXXXXXXXXXX.',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
]
const UFO_SPRITE = [
  '.....XXXXXX.....',
  '...XXXXXXXXXX...',
  '..XXXXXXXXXXXX..',
  '.XX.XX.XX.XX.XX.',
  'XXXXXXXXXXXXXXXX',
  '..XXX..XX..XXX..',
  '...X........X...',
]

function speciesRows(r, frame) {
  if (r === 0) return frame ? SQUID_B : SQUID_A
  if (r <= 2) return frame ? CRAB_B : CRAB_A
  return frame ? OCTO_B : OCTO_A
}
function speciesScore(r) {
  if (r === 0) return 30
  if (r <= 2) return 20
  return 10
}

// ---------------------------------------------------------------- state

let gameStarted = false
let gameOver = false
// Esc tap pauses (EscHold owns Escape); a 3 s hold quits into game over.
const paused = ref(false)
let score = 0
let lastScoreSent = -1
let wave = 1
let lives = LIVES
let extraAwarded = false

// Formation.
let cols = 11
let alive = [] // alive[r][c]
let aliveCount = 0
let totalCount = 1
let fx = 0
let fy = 0
let marchDir = 1
let marchFrame = 0
let stepAcc = 0
let stepCount = 0
let px = 4
let cellW = 40
let cellH = 32
let formW = 400
let formH = 160
let margin = 24

// Cannon.
let cannonX = 0
let cannonVX = 0
let prevCannonX = 0
let cannonY = 0
let invulnUntil = 0
let dying = 0 // s left of the death freeze
let deathAt = 0
let deathEmitted = false
let cannonTrail = [] // { x, t } afterimages

// Shots.
let shot = null // one player bolt at a time
let weapon = null
let weaponTime = 0
let pickups = []
let pickupKills = 0
let pickupSerial = 0
let bombs = []
let bombAcc = 1

// Bunkers: { x, y, w, h, cell, gw, gh, grid }.
let bunkers = []
const BUNKER_GW = 22
const BUNKER_GH = 16

// UFO.
let ufo = null
let ufoTimer = 4
let ufoPopups = [] // { x, y, text, t, color }

// Effects.
let particles = []
let shockwaves = []
let flashes = [] // 2-frame white sprite flashes { rows, x, y, px, t }
let pulse = 0 // heartbeat copy for the formation aberration only (the
// backdrop owns the real one in neonHorizon.js); set in doStep, decays
let shake = 0

// Visual-effects package state (draw-only; no gameplay impact).
// All timers are seconds, decayed with dt for frame-rate independence.
let whiteFlash = 0 // cannon-death white frame
let redPulse = 0 // cannon-death red vignette
let bassJolt = 0 // 120 ms horizontal bass jolt on the play layer
let bassDir = 1
let bunkerRevealT = 0 // bunker scanline re-materialize
const BUNKER_REVEAL_DUR = 0.8
let formRevealT = 0 // formation row-by-row fade-in
const FORM_REVEAL_DUR = 0.9
let shotTrail = [] // { x, y, t } cyan afterimages
let bunkerJolts = [] // { bi, sx, sy, t } 200 ms electric jitter
let ufoTrail = [] // { x, y, t } gold streak samples
let shootStar = null // { x, y, vx, vy, life }
let shootTimer = 18 // next shooting star in s (15-25)
let mobileFx = false // cached per layout: fewer particles, smaller blurs

// Layout the pixel caches were built for (rebuilt when px or the phone
// layout changes).
let glowPx = 0
let glowMobile = false

// Combo twist.
let streak = 0
let mult = 1
let lastKillT = -10
let comboTimer = 0
let demoCooldown = 0

let wavePause = 0 // countdown between waves
let lastTime = 0
let keys = {}
let touchActive = false
let touchX = 0
let activeTouchId = null
let tapStartX = 0
let tapStartY = 0
let tapStartTime = 0

// ---------------------------------------------------------------- helpers

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}
function rand(lo, hi) {
  return lo + Math.random() * (hi - lo)
}

// ------------------------------------------------- pixel caches

// Rebuild what depends on the layout: the town backdrop and the bunkers.
function buildFxCache() {
  mobileFx = SW < 600 || SH < 500
  glowPx = px
  glowMobile = mobileFx
  for (let i = 0; i < bunkers.length; i++) bunkers[i].dirty = true
  if (stage) scene.layout(stage.vw, stage.vh, stage.px(groundLine()))
}

// The bunkers stand in the grass, the town behind them on this line.
function groundLine() {
  return bunkerTop() + px * 5
}

function renderBunkerCache(b) {
  paintBunker(b)
  b.dirty = false
}

function setScore(v) {
  if (!gameStarted) return
  score = v
  if (score >= EXTRA_AT && !extraAwarded && gameStarted) {
    extraAwarded = true
    lives++
    emit('lives', lives)
    sound.sfx.extraLife()
    ufoPopups.push({ x: cannonX, y: cannonY - 60, text: 'EXTRA ▲', t: 0, color: GOLD })
  }
  if (gameStarted && v !== lastScoreSent) {
    lastScoreSent = v
    emit('score', v)
  }
}

// ---------------------------------------------------------------- setup

function setupCanvas() {
  const c = canvas.value
  if (!c) return
  dpr = window.devicePixelRatio || 1
  SW = c.offsetWidth
  SH = c.offsetHeight
  band = safeBottom()
  if (!stage) stage = createPixelStage(c)
  stage.resize(SW, SH, dpr, stageMinW(), 180)
  cannonX = clamp(cannonX || SW / 2, 30, SW - 30)
  prevCannonX = cannonX
  layout()
}

// The stage's minimum logical width: phones get chunkier pixels (3 CSS px
// or more) so the five-column formation keeps 24 px tall sprites.
function stageMinW() {
  return SW < 600 ? 104 : 240
}

// Single layout entry: everything derives from SW/SH here, called on
// mount and resize. Portrait phones (< 600 px) get 5 columns / 3 bunkers
// via buildWave()/resetBunkers().
function layout() {
  margin = Math.max(12, SW * 0.04)
  const h = SH - band
  // With a band, the wide layout also keeps the weapon label (up to 44 px
  // below cannonY at px 5) out of it.
  cannonY = h < 500 ? h - 60 : SW < 600 ? h - 100 : Math.min(h * 0.95, band ? h - 44 : h)
  layoutGeometry()
  buildFxCache()
  layoutBunkers()
}

// Cell size from the current column count; formation fits with margins.
function layoutGeometry() {
  const widthScale = Math.floor((SW * (SW < 600 ? .8 : .7)) / (cols * 14))
  const heightScale = Math.floor((bunkerTop() - SH * .085) / ((ROWS + 1.5) * 11))
  // One invader pixel is one logical pixel of the stage.
  px = stage ? stage.k : clamp(Math.min(widthScale, heightScale), 2, 5)
  cellW = 14 * px
  cellH = 11 * px
  formW = cols * cellW
  formH = ROWS * cellH
  fx = clamp(fx || (SW - formW) / 2, margin, Math.max(margin, SW - margin - formW))
  fy = Math.max(0, Math.min(fy || SH * 0.085, bunkerTop() - formH - cellH))
}

function bunkerTop() {
  const h = SH - band
  return h < 500 ? cannonY - 66 : SW < 600 ? cannonY - 74 : h * 0.865 - (h * 0.95 - cannonY)
}

// Horizon line (CSS px) for the shooting-star flight; the town is in ./pixel.ts.
function horizonY() {
  return stage && scene.horizon ? scene.horizon * stage.k : SH * 0.7
}

// ---------------------------------------------------------------- waves

function buildWave() {
  cols = SW >= 900 ? 11 : SW >= 600 ? 8 : 5
  alive = []
  for (let r = 0; r < ROWS; r++) {
    const row = []
    for (let c = 0; c < cols; c++) row.push(true)
    alive.push(row)
  }
  aliveCount = ROWS * cols
  totalCount = aliveCount
  marchDir = 1
  marchFrame = 0
  stepAcc = 0
  stepCount = 0
  layoutGeometry()
  if (px !== glowPx || (SW < 600 || SH < 500) !== glowMobile) buildFxCache()
  // The next formation starts one row lower, up to a floor above the bunkers.
  const maxExtra = Math.max(0, Math.floor((bunkerTop() - cellH * 1.5 - formH - SH * 0.085) / cellH))
  const extra = Math.min(wave - 1, maxExtra, 4)
  fy = SH * 0.085 + extra * cellH
  fx = (SW - formW) / 2
}

function resetBunkers() {
  const n = SW < 600 ? 3 : 4
  // One bunker cell is one logical pixel.
  const bp = px
  const bw = BUNKER_GW * bp
  const bh = BUNKER_GH * bp
  const gap = bw * 0.9
  const totalW = n * bw + (n - 1) * gap
  let x = (SW - totalW) / 2
  const y = Math.round(bunkerTop() / px) * px
  bunkers = []
  for (let i = 0; i < n; i++) {
    const grid = new Uint8Array(BUNKER_GW * BUNKER_GH)
    for (let gy = 0; gy < BUNKER_GH; gy++) {
      for (let gx = 0; gx < BUNKER_GW; gx++) {
        let solid = true
        // Chamfered top corners.
        if (gx + gy < 2 || (BUNKER_GW - 1 - gx) + gy < 2) solid = false
        // Arched cutout at the bottom middle.
        const dx = gx - (BUNKER_GW - 1) / 2
        const archW = (BUNKER_GW * 0.22) * (0.4 + 0.6 * (gy / BUNKER_GH))
        if (gy > BUNKER_GH * 0.45 && Math.abs(dx) < archW) solid = false
        grid[gy * BUNKER_GW + gx] = solid ? 1 : 0
      }
    }
    bunkers.push({ x: Math.round(x / px) * px, y, w: bw, h: bh, cell: bp, gw: BUNKER_GW, gh: BUNKER_GH, grid, dirty: true, cache: null, cachePad: 0 })
    x += bw + gap
  }
}

function layoutBunkers() {
  // Keep damage across resizes: rebuild rects, carry over overlapping cells.
  const old = bunkers
  resetBunkers()
  for (let i = 0; i < Math.min(old.length, bunkers.length); i++) {
    const o = old[i]
    const nb = bunkers[i]
    if (o.gw !== nb.gw || o.gh !== nb.gh) continue
    for (let k = 0; k < o.grid.length; k++) {
      if (!o.grid[k]) nb.grid[k] = 0
    }
  }
}

function startDemo() {
  gameStarted = false
  sound.music.stop()
  gameOver = false
  paused.value = false
  keys = {}
  resetWeapons()
  score = 0
  lastScoreSent = -1
  wave = 1
  lives = LIVES
  extraAwarded = false
  streak = 0
  mult = 1
  comboTimer = 0
  lastKillT = -10
  stepCount = 0
  dying = 0
  deathEmitted = false
  invulnUntil = 0
  pulse = 0
  sunFlare = 0
  shake = 0
  demoCooldown = 0
  shot = null
  bombs = []
  bombAcc = 1
  cannonTrail = []
  ufo = null
  ufoTimer = 4
  particles = []
  shockwaves = []
  flashes = []
  ufoPopups = []
  wavePause = 0
  whiteFlash = 0
  redPulse = 0
  bassJolt = 0
  bunkerRevealT = 0
  formRevealT = 0
  shotTrail = []
  bunkerJolts = []
  ufoTrail = []
  shootStar = null
  shootTimer = rand(15, 25)
  buildWave()
  resetBunkers()
  cannonX = SW / 2
  prevCannonX = cannonX
}

function startGame() {
  resetWeapons()
  shipDef = readShipDef()
  score = 0
  lastScoreSent = -1
  wave = 1
  lives = LIVES
  extraAwarded = false
  streak = 0
  mult = 1
  comboTimer = 0
  lastKillT = -10
  stepCount = 0
  gameOver = false
  gameStarted = true
  paused.value = false
  keys = {}
  dying = 0
  deathEmitted = false
  invulnUntil = 0
  pulse = 0
  sunFlare = 0
  shake = 0
  demoCooldown = 0
  clearInput()
  touchX = 0
  keys = {}
  shot = null
  bombs = []
  bombAcc = 1
  cannonTrail = []
  ufo = null
  ufoTimer = rand(20, 30)
  particles = []
  shockwaves = []
  flashes = []
  ufoPopups = []
  wavePause = 0
  whiteFlash = 0
  redPulse = 0
  bassJolt = 0
  bunkerRevealT = 0
  formRevealT = 0
  shotTrail = []
  bunkerJolts = []
  ufoTrail = []
  shootStar = null
  shootTimer = rand(15, 25)
  buildWave()
  resetBunkers()
  cannonX = SW / 2
  prevCannonX = cannonX
  sound.unlock()
  sound.sfx.uiStart()
  sound.music.start('invaders')
  emit('restart')
  emit('started')
  emit('score', 0)
  emit('wave', 1)
  emit('lives', lives)
}

// ---------------------------------------------------------------- formation

function stepIntervalMs() {
  const frac = aliveCount / totalCount
  const base = 45 + 520 * Math.pow(Math.max(0, frac), 1.2)
  // Attract mode drifts down slowly so the bottom row stays above ~45 %
  // for the first ~20 s and the name stays readable.
  const speed = gameStarted ? base / 1.15 : base * 1.9
  // Power-ups cut both ways: while one is live the formation marches twice as fast.
  return weapon ? speed / 2 : speed
}

function doStep(now) {
  marchFrame ^= 1
  stepCount++
  pulse = 1
  if (gameStarted) stepSfx()
  bassJolt = 1 // Effect 3c: horizontal bass jolt, decays in updateFx
  bassDir = marchDir
  const dx = Math.max(2, Math.round(cellW * 0.16))
  const dy = Math.max(4, Math.round(cellH * 0.7))
  // Live extents: outer dead columns must not trigger early edge turns.
  let liveMin = Infinity
  let liveMax = -Infinity
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < cols; c++) {
      if (!alive[r][c]) continue
      const rc = invaderRect(r, c)
      if (rc.x < liveMin) liveMin = rc.x
      if (rc.x + rc.w > liveMax) liveMax = rc.x + rc.w
    }
  }
  const nx = fx + marchDir * dx
  if (!Number.isFinite(liveMin)) {
    fx = nx
  } else {
    const minOff = liveMin - fx
    const maxOff = liveMax - fx
    if (marchDir > 0 && nx + maxOff > SW - margin) {
      fy += dy
      marchDir = -1
      fx = SW - margin - maxOff
    } else if (marchDir < 0 && nx + minOff < margin) {
      fy += dy
      marchDir = 1
      fx = margin - minOff
    } else {
      fx = nx
    }
  }
  eatBunkers()
  checkInvasion(now)
}

function invaderRect(r, c) {
  const rows = speciesRows(r, 0)
  const w = rows[0].length * px
  const h = rows.length * px
  const x = fx + c * cellW + (cellW - w) / 2
  const y = fy + r * cellH + (cellH - h) / 2
  return { x, y, w, h }
}

// Scratch rect: same math, no per-frame allocation for hot loops.
const _rc = { x: 0, y: 0, w: 0, h: 0 }
// Shared sprite opts (finding 12): drawSprite only reads o.ab/o.flash.
function invaderRectInto(r, c, out) {
  const rows = speciesRows(r, 0)
  out.w = rows[0].length * px
  out.h = rows.length * px
  out.x = fx + c * cellW + (cellW - out.w) / 2
  out.y = fy + r * cellH + (cellH - out.h) / 2
  return out
}

function invaderBottom() {
  let bottom = 0
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < cols; c++) {
      if (!alive[r][c]) continue
      const rc = invaderRect(r, c)
      if (rc.y + rc.h > bottom) bottom = rc.y + rc.h
    }
  }
  return bottom
}

function lowestInColumn(c) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (alive[r][c]) return r
  }
  return -1
}

function checkInvasion(now) {
  if (gameOver || dying > 0) return
  if (!gameStarted) {
    // Attract mode never ends in GAME OVER: loop the demo high instead.
    if (invaderBottom() >= cannonY - 4 * px) {
      buildWave()
      bombs = []
      shot = null
      shotTrail = []
      flashes = []
      ufoTrail = []
    }
    return
  }
  if (invaderBottom() >= cannonY - 4 * px) {
    gameOver = true
    emit('over')
    deathAt = now
    explode(cannonX, cannonY, true)
    sound.sfx.explosion(true)
    sound.sfx.gameOver()
    sound.music.stop()
  }
}

// Invaders that reach the bunkers eat through them.
function eatBunkers() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < cols; c++) {
      if (!alive[r][c]) continue
      const rc = invaderRect(r, c)
      for (let i = 0; i < bunkers.length; i++) {
        eraseRect(bunkers[i], rc.x, rc.y, rc.w, rc.h)
      }
    }
  }
}

// ---------------------------------------------------------------- bunkers

function eraseRect(b, x, y, w, h) {
  if (x + w < b.x || x > b.x + b.w || y + h < b.y || y > b.y + b.h) return
  const gx0 = clamp(Math.floor((x - b.x) / b.cell), 0, b.gw - 1)
  const gx1 = clamp(Math.floor((x + w - b.x) / b.cell), 0, b.gw - 1)
  const gy0 = clamp(Math.floor((y - b.y) / b.cell), 0, b.gh - 1)
  const gy1 = clamp(Math.floor((y + h - b.y) / b.cell), 0, b.gh - 1)
  let touched = false
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const k = gy * b.gw + gx
      if (b.grid[k]) { b.grid[k] = 0; touched = true }
    }
  }
  if (touched) b.dirty = true
}

function splat(b, sx, sy, radius) {
  const ccx = (sx - b.x) / b.cell
  const ccy = (sy - b.y) / b.cell
  let touched = false
  for (let gy = 0; gy < b.gh; gy++) {
    for (let gx = 0; gx < b.gw; gx++) {
      const d = Math.hypot(gx - ccx, gy - ccy)
      if (d < radius * (0.7 + Math.random() * 0.6)) {
        if (b.grid[gy * b.gw + gx]) { b.grid[gy * b.gw + gx] = 0; touched = true }
      }
    }
  }
  if (touched) b.dirty = true
}

// Returns true when a solid pixel was hit (and erodes it).
function hitBunker(sx, sy, radius) {
  for (let i = 0; i < bunkers.length; i++) {
    const b = bunkers[i]
    if (sx < b.x || sx > b.x + b.w || sy < b.y || sy > b.y + b.h) continue
    const gx = clamp(Math.floor((sx - b.x) / b.cell), 0, b.gw - 1)
    const gy = clamp(Math.floor((sy - b.y) / b.cell), 0, b.gh - 1)
    if (b.grid[gy * b.gw + gx]) {
      splat(b, sx, sy, radius)
      // Effect 6: cells near the hit flicker ~200 ms before settling.
      if (bunkerJolts.length < 12) bunkerJolts.push({ bi: i, sx, sy, t: 0.2 })
      return true
    }
  }
  return false
}

// Walk the travelled segment at bunker-cell resolution, including thin remnants.
function hitBunkerPath(x, fromY, toY, radius) {
  const steps = Math.max(1, Math.ceil(Math.abs(toY - fromY) / 2))
  for (let i = 0; i <= steps; i++) {
    if (hitBunker(x, fromY + (toY - fromY) * i / steps, radius)) return true
  }
  return false
}

// ---------------------------------------------------------------- effects

function spawnParticles(x, y, color, count, spread) {
  // Mobile degrades to ~60 % particle counts to stay cheap.
  if (mobileFx) count = Math.max(2, Math.round(count * 0.6))
  for (let i = 0; i < count; i++) {
    // Reuse the oldest pooled object when full: no per-kill allocs.
    let p = null
    if (particles.length >= MAX_PARTICLES) p = particles.shift()
    const a = Math.random() * Math.PI * 2
    const s = 40 + Math.random() * (spread || 220)
    if (!p) p = {}
    p.x = x
    p.y = y
    p.vx = Math.cos(a) * s
    p.vy = Math.sin(a) * s
    p.life = 1
    p.decay = 1.4 + Math.random() * 1.6
    p.size = 2 + Math.random() * 3
    p.color = color
    particles.push(p)
  }
}

// Effect 1 — SPRITE SHATTER: every lit cell of the sprite becomes a debris
// particle in the sprite's colour, outward velocity + gravity-free drift,
// spin-less fade over ~0.5 s. Reuses the capped particle pool, no allocs
// beyond pooled objects.
function shatterSprite(rows, ox, oy, s, color) {
  const colsN = rows[0].length
  const w = colsN * s
  const h = rows.length * s
  const cx = ox + w / 2
  const cy = oy + h / 2
  for (let r = 0; r < rows.length; r++) {
    const line = rows[r]
    for (let c = 0; c < line.length; c++) {
      if (line[c] !== 'X') continue
      let q = null
      if (particles.length >= MAX_PARTICLES) q = particles.shift()
      const px0 = ox + c * s + s / 2
      const py0 = oy + r * s + s / 2
      let dx = px0 - cx
      let dy = py0 - cy
      const d = Math.hypot(dx, dy) || 1
      dx /= d
      dy /= d
      const sp = 60 + Math.random() * 220
      if (!q) q = {}
      q.x = px0
      q.y = py0
      q.vx = dx * sp + rand(-40, 40)
      q.vy = dy * sp + rand(-40, 40)
      q.life = 1
      q.decay = 1.9 + Math.random() * 0.5 // ~0.5 s
      q.size = s
      q.color = color
      particles.push(q)
    }
  }
}

function explode(x, y, big) {
  spawnParticles(x, y, '#ffffff', big ? 10 : 6, 160)
  spawnParticles(x, y, PINK, big ? 26 : 14, 320)
  spawnParticles(x, y, CYAN, big ? 14 : 8, 240)
  shockwaves.push({ x, y, radius: 6, life: 1, color: PINK })
  shake = Math.min(1, shake + (big ? 0.7 : 0.3))
}

function resetWeapons() {
  weapon = null
  weaponTime = 0
  pickups = []
  pickupKills = 0
  pickupSerial = 0
}

function dropPickup(x, y) {
  if (pickups.length >= 3) return
  pickups.push({ x: clamp(x, 22, SW - 22), y, kind: pickupSerial++ % 2 ? 'blast' : 'pierce' })
}

function updateWeapons(dt) {
  weaponTime = Math.max(0, weaponTime - dt)
  if (!weaponTime) weapon = null
  const rc = cannonRect()
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]
    const prevY = p.y
    p.y += Math.max(85, SH * 0.16) * dt
    if (p.x >= rc.x - 14 && p.x <= rc.x + rc.w + 14 && prevY <= rc.y + rc.h + 14 && p.y >= rc.y - 14) {
      weapon = p.kind
      weaponTime = 6
      sound.sfx.powerup()
      spawnParticles(p.x, cannonY, GOLD, 18, 180)
      shockwaves.push({ x: p.x, y: cannonY, radius: 6, life: 1, color: GOLD })
      pickups.splice(i, 1)
    } else if (p.y > SH + 20) pickups.splice(i, 1)
  }
}

function blast(x, y, now) {
  const radius = cellW * 1.35
  explode(x, y, true)
  if (gameStarted) sound.sfx.beam()
  shockwaves.push({ x, y, radius: radius * 0.65, life: 1, color: CYAN })
  pulse = 1
  for (let r = ROWS - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      if (!alive[r][c]) continue
      const rc = invaderRect(r, c)
      if (Math.hypot(rc.x + rc.w / 2 - x, rc.y + rc.h / 2 - y) <= radius) killInvader(r, c, now)
    }
  }
  bombs = bombs.filter(b => Math.hypot(b.x - x, b.y - y) > radius)
}

function fire() {
  if (!gameStarted || gameOver || dying > 0 || paused.value || wavePause > 0 || shot) return
  shot = { x: cannonX, y: cannonY - 4 * px - 6, weapon }
  sound.sfx.shoot()
}

function killInvader(r, c, now) {
  if (!alive[r][c]) return
  alive[r][c] = false
  aliveCount--
  const rc = invaderRect(r, c)
  const cx = rc.x + rc.w / 2
  const cy = rc.y + rc.h / 2
  if (gameStarted && ++pickupKills % 5 === 0) dropPickup(cx, cy)
  // Combo twist: a kill within 1.5 s of the previous one bumps x1->x4.
  const gap = now - lastKillT
  streak = gap < 1.5 ? streak + 1 : 0
  mult = Math.min(4, streak + 1)
  lastKillT = now
  comboTimer = 1.5
  setScore(score + speciesScore(r) * mult)
  flashes.push({ rows: speciesRows(r, marchFrame), x: rc.x, y: rc.y, px, t: 0.12 })
  // Effect 1: sprite shatter replaces the generic burst + one ring.
  const rows = speciesRows(r, marchFrame)
  shatterSprite(rows, rc.x, rc.y, px, SPECIES_LOOK[r === 0 ? 0 : r <= 2 ? 1 : 2].glow)
  shockwaves.push({ x: cx, y: cy, radius: 6, life: 1, color: PINK })
  if (gameStarted) boomSfx()
  if (aliveCount <= 0 && !gameOver) {
    wavePause = 1.3
    shot = null
    bombs = []
    shotTrail = []
    // Effect 4: wave-clear flare + grid rush start now, reveal on rebuild.
    sunFlare = 1
    if (gameStarted) sound.sfx.levelClear()
  }
}

function onCannonHit(now) {
  if (now < invulnUntil || dying > 0) return
  resetWeapons()
  explode(cannonX, cannonY, true)
  spawnParticles(cannonX, cannonY, '#ffffff', 8, 200)
  // Effect 2: cannon shatters into cyan pixels + white frame + red vignette.
  const cw = CANNON[0].length * px
  const ch = CANNON.length * px
  shatterSprite(CANNON, cannonX - cw / 2, cannonY - ch / 2, px, CYAN)
  whiteFlash = 1
  redPulse = 1
  shake = Math.min(1, Math.max(shake, 0.9)) // ~6 px decaying shake
  shot = null
  bombs = []
  streak = 0
  mult = 1
  comboTimer = 0
  if (!gameStarted) {
    // Autopilot got clipped: respawn quietly, the show goes on.
    dying = 1.0
    invulnUntil = now + 3.0
    return
  }
  lives--
  emit('lives', lives)
  if (lives <= 0) {
    gameOver = true
    emit('over')
    deathAt = now
    sound.sfx.explosion(true)
    sound.sfx.gameOver()
    sound.music.stop()
  } else {
    sound.sfx.lifeLost()
    dying = 1.0 // ~1 s freeze where the formation stops, like the original
    invulnUntil = now + 1.0 + 2.5
  }
}

// ---------------------------------------------------------------- Esc pause / hold-quit

function escActive() {
  return gameStarted && !gameOver
}

function togglePause() {
  if (!gameStarted || gameOver) return
  paused.value = !paused.value
  clearInput()
  if (paused.value) sound.music.stop(false)
  else sound.music.start('invaders')
}

// A 3 s Escape hold cancels the run: the same death as an invasion, so the
// landing shows GAME OVER with the run's score. Times are in seconds.
function quitToGameOver() {
  if (!gameStarted || gameOver) return
  paused.value = false
  clearInput()
  lives = 0
  emit('lives', lives)
  dying = 0
  shot = null
  bombs = []
  explode(cannonX, cannonY, true)
  gameOver = true
  emit('over')
  deathAt = performance.now() / 1000
  sound.sfx.explosion(true)
  sound.sfx.gameOver()
  sound.music.stop()
}

// ---------------------------------------------------------------- bombs & UFO

function maxBombs() {
  if (!gameStarted) return 2
  return wave >= 3 ? 4 : wave === 2 ? 3 : 2
}

function bombSpeed() {
  const frac = aliveCount / totalCount
  if (!gameStarted) return 150
  return Math.min(400, 170 + wave * 22 + (1 - frac) * 60)
}

function spawnBomb() {
  const liveCols = []
  for (let c = 0; c < cols; c++) {
    if (lowestInColumn(c) >= 0) liveCols.push(c)
  }
  if (!liveCols.length) return
  const c = liveCols[Math.floor(Math.random() * liveCols.length)]
  const r = lowestInColumn(c)
  const rc = invaderRect(r, c)
  const style = ['zigzag', 'plunger', 'rolling'][Math.floor(Math.random() * 3)]
  bombs.push({
    style,
    x: rc.x + rc.w / 2,
    baseX: rc.x + rc.w / 2,
    y: rc.y + rc.h + 2,
    v: bombSpeed() * (style === 'plunger' ? 1.25 : style === 'rolling' ? 0.9 : 1),
    t: Math.random() * 10,
    frame: 0,
    trail: [], // Effect 5: faint magenta smear (last 3 positions per bomb)
  })
  if (gameStarted) zapSfx()
}

function spawnUFO(now) {
  const dir = Math.random() < 0.5 ? 1 : -1
  if (gameStarted) sound.sfx.ufo()
  ufo = {
    x: dir > 0 ? -60 : SW + 60,
    dir,
    y: Math.max(26, SH * 0.055),
    v: Math.max(120, SW / 6.5),
  }
}

function ufoPoints() {
  const table = [50, 100, 150, 300]
  return table[Math.floor(Math.random() * table.length)]
}

// ---------------------------------------------------------------- autopilot

function autopilot(dt) {
  // Nearest column with a live invader; track its lowest invader.
  let targetX = SW / 2
  let bestD = Infinity
  for (let c = 0; c < cols; c++) {
    const r = lowestInColumn(c)
    if (r < 0) continue
    invaderRectInto(r, c, _rc)
    const cx = _rc.x + _rc.w / 2
    const d = Math.abs(cx - cannonX)
    if (d < bestD) {
      bestD = d
      targetX = cx
    }
  }
  // Dodge falling bombs (targetX may swerve; aimX keeps the pre-dodge aim).
  const aimX = targetX
  for (let i = 0; i < bombs.length; i++) {
    const b = bombs[i]
    if (b.y > cannonY - 260 && b.y < cannonY && Math.abs(b.x - cannonX) < 46) {
      targetX = cannonX < b.x ? cannonX - 120 : cannonX + 120
      break
    }
  }
  moveCannonToward(targetX, dt)
  demoCooldown -= dt
  // Deliberately imperfect: a wide aim window plus a ~35 % chance of a
  // large aim error and a real cadence control (demoCooldown), so the demo
  // misses sometimes and the formation stays full for ~20 s.
  if (!shot && demoCooldown <= 0 && Math.abs(aimX - cannonX) < 40) {
    if (Math.random() < 0.35) {
      cannonX = clamp(cannonX + (Math.random() < 0.5 ? -1 : 1) * rand(50, 110), 24, SW - 24)
    }
    fireDemoShot()
  }
}

function moveCannonToward(tx, dt) {
  const dx = clampCannon(tx) - cannonX
  cannonX += clamp(dx, -1, 1) * cannonSpeed() * dt
  if (Math.abs(dx) < cannonSpeed() * dt) cannonX = clampCannon(tx)
}

function clampCannon(x) {
  const inset = Math.max(24, CANNON[0].length * px / 2 + 2)
  return clamp(x, inset, SW - inset)
}

function cannonSpeed() {
  return Math.max(340, SW * 0.45)
}

function fireDemoShot() {
  if (gameOver || dying > 0 || shot) return
  demoCooldown = rand(1.4, 2.2)
  shot = { x: cannonX, y: cannonY - 4 * px - 6 }
}

// ---------------------------------------------------------------- update

function update(nowMs) {
  const now = nowMs / 1000
  let dt = (nowMs - lastTime) / 1000
  if (!(dt > 0)) dt = 0.016
  dt = Math.min(dt, 0.05) // clamp to 50 ms for frame-rate independence
  lastTime = nowMs

  pulse = Math.max(0, pulse - dt * 2.2) // formation-aberration copy only
  bassJolt = Math.max(0, bassJolt - dt * 8.3) // ~120 ms jolt
  whiteFlash = Math.max(0, whiteFlash - dt * 6)
  redPulse = Math.max(0, redPulse - dt * 2.2)
  shake = Math.max(0, shake - 2.6 * dt)

  cannonVX = dt > 0 ? (cannonX - prevCannonX) / dt : 0
  prevCannonX = cannonX
  // Afterimage trail when moving fast.
  if (Math.abs(cannonVX) > 260 && dying <= 0 && !gameOver) {
    cannonTrail.push({ x: cannonX, t: 0.25 })
    if (cannonTrail.length > 6) cannonTrail.shift()
  }
  for (let i = cannonTrail.length - 1; i >= 0; i--) {
    cannonTrail[i].t -= dt
    if (cannonTrail[i].t <= 0) cannonTrail.splice(i, 1)
  }

  updateFx(dt, now)

  // Delayed death emit so the explosion plays out.
  if (gameOver && !deathEmitted && now - deathAt > 0.9) {
    deathEmitted = true
    emit('death')
  }
}

function updateFx(dt, now) {
  sunFlare = Math.max(0, sunFlare - dt * 0.8)
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= 0.985
    p.vy *= 0.985
    p.life -= p.decay * dt
    if (p.life <= 0) particles.splice(i, 1)
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i]
    sw.radius += 420 * dt
    sw.life -= 1.7 * dt
    if (sw.life <= 0) shockwaves.splice(i, 1)
  }
  for (let i = flashes.length - 1; i >= 0; i--) {
    flashes[i].t -= dt
    if (flashes[i].t <= 0) flashes.splice(i, 1)
  }
  for (let i = ufoPopups.length - 1; i >= 0; i--) {
    ufoPopups[i].t += dt
    if (ufoPopups[i].t > 1.4) ufoPopups.splice(i, 1)
  }
  if (bunkerRevealT > 0) bunkerRevealT = Math.max(0, bunkerRevealT - dt)
  if (formRevealT > 0) formRevealT = Math.max(0, formRevealT - dt)
  // Effect 5: player-shot trail samples decay.
  for (let i = shotTrail.length - 1; i >= 0; i--) {
    shotTrail[i].t -= dt
    if (shotTrail[i].t <= 0) shotTrail.splice(i, 1)
  }
  // Effect 6: bunker electric jitter decays (~200 ms).
  for (let i = bunkerJolts.length - 1; i >= 0; i--) {
    bunkerJolts[i].t -= dt
    if (bunkerJolts[i].t <= 0) bunkerJolts.splice(i, 1)
  }
  // Effect 7: UFO streak samples decay.
  for (let i = ufoTrail.length - 1; i >= 0; i--) {
    ufoTrail[i].t -= dt
    if (ufoTrail[i].t <= 0) ufoTrail.splice(i, 1)
  }
  // Effect 8: shooting star timer + flight (frame-rate independent).
  shootTimer -= dt
  if (shootTimer <= 0 && !shootStar) {
    const hy = horizonY()
    const y0 = rand(SH * 0.04, Math.max(SH * 0.06, hy * 0.45))
    const fromLeft = Math.random() < 0.5
    const speed = rand(SW * 0.5, SW * 0.8)
    shootStar = {
      x: fromLeft ? -20 : SW + 20,
      y: y0,
      vx: (fromLeft ? 1 : -1) * speed,
      vy: speed * 0.28,
      life: 1.1,
    }
    shootTimer = rand(15, 25)
  }
  if (shootStar) {
    shootStar.x += shootStar.vx * dt
    shootStar.y += shootStar.vy * dt
    shootStar.life -= dt
    if (shootStar.life <= 0 || shootStar.y > horizonY()) shootStar = null
  }
  if (comboTimer > 0) {
    comboTimer -= dt
    if (comboTimer <= 0) {
      streak = 0
      mult = 1
    }
  }
}

function updateGame(dt, now) {
  // Death freeze: the formation stops while the cannon burns.
  if (dying > 0) {
    dying -= dt
    if (dying <= 0 && !gameOver) {
      cannonX = SW / 2
      prevCannonX = cannonX
    }
    return
  }
  if (gameOver) return

  // Wave transition: the next formation starts one row lower.
  if (wavePause > 0) {
    wavePause -= dt
    if (wavePause <= 0) {
      // In attract mode loop wave 1 forever so the formation stays high
      // behind the card; a real game climbs one row lower per wave.
      wave = gameStarted ? wave + 1 : 1
      if (gameStarted) emit('wave', wave)
      buildWave()
      bombs = []
      shot = null
      shotTrail = []
      // Effect 4: bunkers re-materialize with a bottom-to-top scanline
      // reveal; the new formation fades in row by row from the top.
      bunkerRevealT = BUNKER_REVEAL_DUR
      formRevealT = FORM_REVEAL_DUR
    }
    return
  }

  // Formation march: a timer, not a per-frame move — the jerky original.
  stepAcc += dt * 1000
  let guard = 0
  while (stepAcc >= stepIntervalMs() && guard++ < 8) {
    stepAcc -= stepIntervalMs()
    doStep(now)
    if (gameOver) return
  }

  // Bombs away.
  bombAcc -= dt
  if (bombAcc <= 0) {
    if (bombs.length < maxBombs() && aliveCount > 0) spawnBomb()
    const frac = aliveCount / totalCount
    bombAcc = rand(0.5, 1.2) * (gameStarted ? 1 : 1.6) * (0.5 + frac * 0.8)
  }

  // UFO crossing.
  ufoTimer -= dt
  if (ufoTimer <= 0 && !ufo) {
    spawnUFO(now)
    ufoTimer = rand(20, 30)
  }
  if (ufo) {
    ufo.x += ufo.dir * ufo.v * dt
    // Effect 7: light-streak samples behind the UFO (ring-buffer reuse).
    if (ufoTrail.length < 24) {
      ufoTrail.push({ x: ufo.x, y: ufo.y, t: 0.4 })
    } else {
      const o = ufoTrail.shift()
      o.x = ufo.x
      o.y = ufo.y
      o.t = 0.4
      ufoTrail.push(o)
    }
    if ((ufo.dir > 0 && ufo.x > SW + 70) || (ufo.dir < 0 && ufo.x < -70)) ufo = null
  }

  // Cannon movement: autopilot or player.
  if (!gameStarted) {
    autopilot(dt)
  } else {
    const lf = keys['ArrowLeft'] || keys['KeyA']
    const rt = keys['ArrowRight'] || keys['KeyD']
    const m = (rt ? 1 : 0) - (lf ? 1 : 0)
    if (touchActive) {
      cannonX = clampCannon(touchX)
      fire()
    } else if (m) {
      cannonX = clampCannon(cannonX + m * cannonSpeed() * dt)
    }
  }
  cannonX = clampCannon(cannonX)

  updateWeapons(dt)
  if (gameStarted && (keys.Space || keys.ArrowUp || keys.KeyW)) fire()
  updateShot(dt, now)
  updateBombs(dt, now)
}

function shotSpeed() {
  return Math.max(620, SH * 1.08) * (shot?.weapon === 'pierce' ? 1.35 : 1)
}

function updateShot(dt, now) {
  if (!shot) return
  // Effect 5: short cyan trail (ring-buffer reuse: no per-frame alloc).
  const maxTrail = mobileFx ? 3 : 4
  if (shotTrail.length < maxTrail) {
    shotTrail.push({ x: shot.x, y: shot.y, t: 0.18 })
  } else {
    const o = shotTrail.shift()
    o.x = shot.x
    o.y = shot.y
    o.t = 0.18
    shotTrail.push(o)
  }
  const prevY = shot.y
  shot.y -= shotSpeed() * dt
  if (shot.y < -20) {
    // A miss resets the combo.
    shot = null
    shotTrail = []
    streak = 0
    mult = 1
    comboTimer = 0
    return
  }
  // UFO first (it flies above everything).
  if (ufo) {
    const uw = UFO_SPRITE[0].length * px
    const uh = UFO_SPRITE.length * px
    if (shot.x > ufo.x - uw / 2 && shot.x < ufo.x + uw / 2 && shot.y <= ufo.y + uh && prevY >= ufo.y) {
      const pts = ufoPoints()
      if (gameStarted) setScore(score + pts)
      ufoPopups.push({ x: ufo.x, y: ufo.y + uh, text: String(pts), t: 0, color: GOLD })
      // Effect 1/7: UFO shatters into gold pixels + light streak + ring.
      shatterSprite(UFO_SPRITE, ufo.x - uw / 2, ufo.y, px, GOLD)
      for (let k = 0; k < 8; k++) {
        const nx = ufo.x - ufo.dir * k * 9
        const ny = ufo.y + uh / 2
        if (ufoTrail.length < 24) {
          ufoTrail.push({ x: nx, y: ny, t: 0.5 })
        } else {
          const o = ufoTrail.shift()
          o.x = nx
          o.y = ny
          o.t = 0.5
          ufoTrail.push(o)
        }
      }
      shockwaves.push({ x: ufo.x, y: ufo.y + uh / 2, radius: 6, life: 1, color: GOLD })
      if (gameStarted) {
        sound.sfx.ufo()
        boomSfx()
        dropPickup(ufo.x, ufo.y)
      }
      ufo = null
      shot = null
      shotTrail = []
      return
    }
  }
  // Bunkers erode pixel by pixel — before invaders, so a bolt cannot
  // kill through a bunker without chewing it.
  if (hitBunkerPath(shot.x, prevY, shot.y, 2)) {
    // Effect 5: bunker impact throws 4-6 cyan sparks.
    spawnParticles(shot.x, shot.y, CYAN, 4 + Math.floor(Math.random() * 3), 160)
    shot = null
    shotTrail = []
    return
  }
  // Sweep upward from the lowest row: slow frames must not skip a target.
  for (let r = ROWS - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      if (!alive[r][c]) continue
      invaderRectInto(r, c, _rc)
      if (shot.x > _rc.x && shot.x < _rc.x + _rc.w && prevY >= _rc.y && shot.y <= _rc.y + _rc.h) {
        const bolt = shot
        const x = _rc.x + _rc.w / 2
        const y = _rc.y + _rc.h / 2
        if (bolt.weapon !== 'pierce') shot = null
        killInvader(r, c, now)
        if (bolt.weapon === 'blast') blast(x, y, now)
        if (!shot) return
      }
    }
  }
  if (!shot) return
  // Shooting a bomb out of the sky.
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i]
    if (Math.abs(shot.x - b.x) < 8 && Math.abs(shot.y - b.y) < 12) {
      spawnParticles(b.x, b.y, '#ffffff', 6, 160)
      bombs.splice(i, 1)
      shot = null
      return
    }
  }
}

function cannonRect() {
  const w = CANNON[0].length * px
  const h = CANNON.length * px
  return { x: cannonX - w / 2, y: cannonY - h / 2, w, h }
}

function updateBombs(dt, now) {
  const cr = cannonRect()
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i]
    b.t += dt
    const prevY = b.y
    b.y += b.v * dt
    // Effect 5: faint magenta smear — keep last 3 positions per bomb.
    if (!b.trail) b.trail = []
    b.trail.push({ x: b.x, y: b.y })
    if (b.trail.length > 3) b.trail.shift()
    if (b.style === 'zigzag') b.x = b.baseX + Math.sin(b.t * 9) * cellW * 0.22
    else if (b.style === 'rolling') {
      b.x = b.baseX + Math.sin(b.t * 5) * cellW * 0.1
      b.frame = Math.floor(b.t * 8) % 2
    }
    if (b.y > SH + 12) {
      bombs.splice(i, 1)
      continue
    }
    // Bunkers erode.
    if (hitBunkerPath(b.x, prevY + 6, b.y + 6, 2.5)) {
      spawnParticles(b.x, b.y, PINK, 5, 140)
      bombs.splice(i, 1)
      continue
    }
    // The cannon.
    if (now >= invulnUntil && dying <= 0 &&
      b.x > cr.x && b.x < cr.x + cr.w && b.y >= cr.y && prevY <= cr.y + cr.h) {
      bombs.splice(i, 1)
      onCannonHit(now)
      return
    }
  }
}

// ---------------------------------------------------------------- draw
// Everything below draws in the stage's logical pixels: L() takes a CSS
// coordinate to the pixel grid. Shots, bombs, sparks and the sun are drawn
// after the light map (they glow); the rest is lit by it.

function L(v) {
  return Math.round(v / stage.k)
}

const UFO_LOOK = { body: 'y', hi: 'e', lo: 'Y', glow: '#ffd23f' }

function lookFor(rows) {
  if (rows === SQUID_A || rows === SQUID_B) return SPECIES_LOOK[0]
  if (rows === CRAB_A || rows === CRAB_B) return SPECIES_LOOK[1]
  if (rows === UFO_SPRITE) return UFO_LOOK
  return SPECIES_LOOK[2]
}

let cannonSpr = null
let cannonKey = ''
function cannonSprite() {
  const hull = shipDef.colors.hull
  const trim = shipDef.colors.trim
  const key = hull + trim
  if (!cannonSpr || key !== cannonKey) {
    cannonKey = key
    cannonSpr = sprite(cannonRows(CANNON), { c: hull, C: mix(hull, '#0b0616', 0.45), w: mix(hull, '#ffffff', 0.55), T: trim })
  }
  return cannonSpr
}

// Invaders' eyes, gathered while drawing so the glow pass can light them.
const eyes = []

function drawSpriteAt(g, rows, x, y, look) {
  const map = shaded(rows, look)
  const spr = sprite(map)
  const ox = L(x) - 1
  const oy = L(y) - 1
  g.drawImage(spr, ox, oy)
  eyes.push(ox, oy, map)
  return spr
}

function drawEyes(g) {
  const hot = pulse > 0.5
  g.fillStyle = hot ? '#ffffff' : '#fff1b0'
  for (let i = 0; i < eyes.length; i += 3) {
    const ox = eyes[i]
    const oy = eyes[i + 1]
    const map = eyes[i + 2]
    for (let y = 0; y < map.length; y++) {
      const line = map[y]
      for (let x = 0; x < line.length; x++) if (line[x] === 'e') g.fillRect(ox + x, oy + y, 1, 1)
    }
  }
}

function drawBunkers(g) {
  const revealP = bunkerRevealT > 0 ? 1 - bunkerRevealT / BUNKER_REVEAL_DUR : 1
  for (let i = 0; i < bunkers.length; i++) {
    const b = bunkers[i]
    let jx = 0
    let jy = 0
    for (let j = 0; j < bunkerJolts.length; j++) {
      if (bunkerJolts[j].bi !== i) continue
      jx = Math.round(rand(-1, 1))
      jy = Math.round(rand(-1, 1))
    }
    if (!b.pix || b.dirty) renderBunkerCache(b)
    const x = L(b.x) - 1 + jx
    const y = L(b.y) - 1 + jy
    if (bunkerRevealT > 0) {
      // Re-materialise bottom to top after a wave clear, a neon scan line at the front.
      const from = Math.floor((b.gh + 2) * (1 - revealP))
      if (from < b.pix.height) g.drawImage(b.pix, 0, from, b.pix.width, b.pix.height - from, x, y + from, b.pix.width, b.pix.height - from)
      stage.emit(x, y + from, b.pix.width, 1)
      g.fillStyle = '#7ce4ff'
      g.fillRect(x, y + from, b.pix.width, 1)
    } else {
      g.drawImage(b.pix, x, y)
    }
    stage.light(x + b.pix.width / 2, y + 2, b.pix.width * 0.7, '#3ff0ff', 0.35)
  }
}

function drawFormation(g, now) {
  const revealP = formRevealT > 0 ? 1 - formRevealT / FORM_REVEAL_DUR : 1
  for (let r = 0; r < ROWS; r++) {
    let rowA = 1
    if (formRevealT > 0) {
      rowA = clamp(revealP * ROWS - r, 0, 1)
      if (rowA <= 0) continue
    }
    const rows = speciesRows(r, marchFrame)
    const look = lookFor(rows)
    for (let c = 0; c < cols; c++) {
      if (!alive[r][c]) continue
      invaderRectInto(r, c, _rc)
      g.globalAlpha = rowA
      const spr = drawSpriteAt(g, rows, _rc.x, _rc.y, look)
      g.globalAlpha = 1
      stage.light(L(_rc.x) + spr.width / 2, L(_rc.y) + spr.height / 2, 10 + pulse * 3, look.glow, (0.4 + pulse * 0.35) * rowA)
    }
  }
}

function drawUFO(g) {
  if (!ufo) return
  const w = UFO_SPRITE[0].length * px
  const spr = drawSpriteAt(g, UFO_SPRITE, ufo.x - w / 2, ufo.y, UFO_LOOK)
  stage.light(L(ufo.x), L(ufo.y) + spr.height / 2, 26, '#ffd23f', 0.8)
}

function drawCannon(g, now) {
  const spr = cannonSprite()
  const hull = shipDef.colors.hull
  const cx = L(cannonX)
  const cy = L(cannonY)
  const x0 = cx - Math.floor(spr.width / 2)
  const y0 = cy - Math.floor(spr.height / 2)
  if (dying > 0) {
    const k = 1 - dying
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + k * 3
      const d = (k * 46) / stage.k
      g.globalAlpha = 1 - k
      g.fillStyle = i % 3 === 0 ? '#ffffff' : hull
      g.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.7), 1, 1)
    }
    g.globalAlpha = 1
    stage.light(cx, cy, 30 * (1 - k), '#ff8a3d', 1)
    return
  }
  const blink = now < invulnUntil && Math.floor(now * 12) % 2 === 0
  if (blink || gameOver) return
  // Afterimages when moving fast.
  for (let i = 0; i < cannonTrail.length; i++) {
    const t = cannonTrail[i]
    g.globalAlpha = 0.25 * (t.t / 0.25)
    g.drawImage(silhouette(cannonRows(CANNON), hull), L(t.x) - Math.floor(spr.width / 2), y0)
  }
  g.globalAlpha = 1
  // Contact shadow on the grass, then the ship.
  g.fillStyle = 'rgba(5,3,12,0.45)'
  g.fillRect(x0 + 1, y0 + spr.height - 1, spr.width - 2, 2)
  g.drawImage(spr, x0, y0)
  stage.light(cx, cy - 2, 18, hull, 0.6)
}

function drawPickups(g) {
  if (!gameStarted || gameOver) return
  for (const p of pickups) {
    const spr = sprite(p.kind === 'pierce' ? PICKUP_P : PICKUP_B)
    const x = L(p.x) - 4
    const y = L(p.y) - 4
    g.drawImage(spr, x, y)
    stage.light(x + 4, y + 4, 12, '#ffd23f', 0.8)
  }
}

// Emissive pass: after the light map.
function drawGlowing(g, now) {
  scene.drawGlow(g, now, Math.max(pulse * 0.5, sunFlare))
  drawEyes(g)
  // Kill flashes: the invader's shape in white for two frames.
  for (let i = 0; i < flashes.length; i++) {
    const f = flashes[i]
    g.globalAlpha = Math.min(1, f.t / 0.06)
    g.drawImage(silhouette(shaded(f.rows, lookFor(f.rows)), '#ffffff'), L(f.x) - 1, L(f.y) - 1)
  }
  g.globalAlpha = 1
  if (shootStar) {
    g.globalAlpha = Math.max(0, Math.min(1, shootStar.life)) * (gameStarted ? 0.9 : 0.5)
    g.fillStyle = '#fff4ff'
    const n = 8
    for (let i = 0; i < n; i++) {
      const t = i / n
      if (i > 3) g.fillStyle = '#8f86b8'
      g.fillRect(L(shootStar.x - shootStar.vx * 0.12 * t), L(shootStar.y - shootStar.vy * 0.12 * t), 1, 1)
    }
    g.globalAlpha = 1
  }
  // UFO streak.
  if (ufo) {
    g.fillStyle = '#ffd23f'
    for (let i = 0; i < ufoTrail.length; i++) {
      const t = ufoTrail[i]
      const a = (t.t / 0.4) * 0.5
      if (a <= 0.02) continue
      g.globalAlpha = a
      const len = Math.max(1, Math.round((10 + (1 - t.t / 0.4) * 26) / stage.k))
      g.fillRect(L(t.x) - (len >> 1), L(t.y) + 3, len, 1)
    }
    g.globalAlpha = 1
  }
  // Player shot and its trail, in the ship's colour.
  const bolt = shipDef.colors.hull
  for (let i = 0; i < shotTrail.length; i++) {
    const t = shotTrail[i]
    g.globalAlpha = Math.max(0, t.t / 0.18) * 0.5
    g.fillStyle = bolt
    g.fillRect(L(t.x), L(t.y - 12), 1, 3)
  }
  g.globalAlpha = 1
  if (shot) {
    const x = L(shot.x)
    const y = L(shot.y - 12)
    g.fillStyle = bolt
    g.fillRect(x - 1, y + 1, 3, 2)
    g.fillRect(x, y - 1, 1, 5)
    g.fillStyle = '#ffffff'
    g.fillRect(x, y, 1, 3)
  }
  for (let i = 0; i < bombs.length; i++) drawBomb(g, bombs[i])
  // Shockwaves: pixel rings.
  for (let i = 0; i < shockwaves.length; i++) {
    const sw = shockwaves[i]
    g.globalAlpha = Math.max(0, sw.life)
    ring(g, L(sw.x), L(sw.y), L(sw.radius), sw.color)
    if (sw.life > 0.6) ring(g, L(sw.x), L(sw.y), L(sw.radius) - 1, '#ffffff')
  }
  g.globalAlpha = 1
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    g.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5))
    g.fillStyle = p.color
    const n = Math.max(1, Math.round(p.size / stage.k))
    g.fillRect(L(p.x) - (n >> 1), L(p.y) - (n >> 1), n, n)
  }
  g.globalAlpha = 1
  if (redPulse > 0.01) {
    g.globalAlpha = redPulse * 0.35
    g.fillStyle = '#ff3b5c'
    const e = Math.max(3, L(Math.max(18, SW * 0.03)))
    g.fillRect(0, 0, stage.vw, e)
    g.fillRect(0, stage.vh - e, stage.vw, e)
    g.fillRect(0, 0, e, stage.vh)
    g.fillRect(stage.vw - e, 0, e, stage.vh)
    g.globalAlpha = 1
  }
}

function drawBomb(g, b) {
  const x = L(b.x)
  const y = L(b.y)
  if (b.trail) {
    g.fillStyle = PINK
    for (let i = 0; i < b.trail.length; i++) {
      g.globalAlpha = ((i + 1) / b.trail.length) * 0.4
      g.fillRect(L(b.trail[i].x), L(b.trail[i].y) - 1, 1, 2)
    }
    g.globalAlpha = 1
  }
  g.fillStyle = '#ffffff'
  if (b.style === 'zigzag') {
    for (let i = 0; i < 5; i++) g.fillRect(x + (i % 2 ? 1 : -1), y + i, 1, 1)
  } else if (b.style === 'plunger') {
    g.fillRect(x, y, 1, 5)
    g.fillRect(x - 1, y + 1, 3, 1)
    g.fillRect(x - 1, y + 4, 3, 1)
  } else {
    const off = b.frame ? 1 : -1
    g.fillRect(x - 1, y, 3, 1)
    g.fillRect(x - 1 + off, y + 2, 3, 1)
    g.fillRect(x - 1, y + 4, 3, 1)
  }
  g.fillStyle = PINK
  g.fillRect(x, y + 5, 1, 1)
}

function drawHud(h, now) {
  // Score pop-ups rise from where they were earned.
  for (let i = 0; i < ufoPopups.length; i++) {
    const p = ufoPopups[i]
    if (p.t > 1.1 && Math.floor(now * 16) % 2) continue
    const w = textWidth(p.text)
    drawText(h, p.text, L(p.x) - (w >> 1), L(p.y - p.t * 34) - 3, p.color, '#0b0616')
  }
  if (!gameStarted || gameOver || dying > 0) return
  const cy = L(cannonY)
  if (mult > 1) {
    const t = `X${mult} COMBO`
    const w = textWidth(t)
    drawText(h, t, clamp(L(cannonX) - (w >> 1), 2, stage.vw - w - 2), cy - 16, mult >= 4 ? GOLD : CYAN, '#0b0616')
  }
  if (weapon) {
    const t = `${weapon.toUpperCase()} ${Math.ceil(weaponTime)}S`
    const w = textWidth(t)
    const y = Math.min(stage.vh - L(band) - 9, cy + 7)
    drawText(h, t, clamp(L(cannonX) - (w >> 1), 2, stage.vw - w - 2), y, GOLD, '#0b0616')
  }
}

function draw() {
  if (!stage) return
  const now = performance.now() / 1000
  const g = stage.begin()
  eyes.length = 0
  scene.drawBack(g, stage, now, Math.max(pulse * 0.5, sunFlare))
  drawBunkers(g)
  drawFormation(g, now)
  drawUFO(g)
  drawPickups(g)
  drawCannon(g, now)
  if (shot) stage.light(L(shot.x), L(shot.y - 8), 8, shipDef.colors.hull, 0.9)
  for (let i = 0; i < bombs.length; i++) stage.light(L(bombs[i].x), L(bombs[i].y) + 2, 6, PINK, 0.8)
  for (let i = 0; i < shockwaves.length; i++) {
    const sw = shockwaves[i]
    stage.light(L(sw.x), L(sw.y), Math.max(4, L(sw.radius)), sw.color, sw.life * 0.6)
  }
  drawHud(stage.hud, now)
  let sx = 0
  if (shake > 0) sx = (Math.random() - 0.5) * shake * 7 / stage.k
  if (!mobileFx && bassJolt > 0.3) sx += bassDir
  const sy = shake > 0 ? (Math.random() - 0.5) * shake * 7 / stage.k : 0
  stage.present({
    // Attract mode sits darker behind the start text.
    ambient: gameStarted ? '#a497d4' : '#766aa8',
    shakeX: sx,
    shakeY: sy,
    flash: whiteFlash > 0.01 ? { color: '#ffffff', a: whiteFlash * 0.55 } : null,
    afterLight: g2 => drawGlowing(g2, now),
  })
}

function frame(now) {
  if (!gameRunning) return
  const dtMs = Math.min(50, Math.max(0, now - lastFrameT))
  lastFrameT = now
  if (!paused.value) {
    update(now)
    updateGame(dtMs / 1000 || 0.016, now / 1000)
  }
  draw()
  animationFrameId = requestAnimationFrame(frame)
}

let lastFrameT = 0

// ---------------------------------------------------------------- input

function isInteractiveElement(el) {
  if (!el || !el.closest) return false
  const tag = el.tagName
  if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT') return true
  if (el.closest('a, button, .social-links, .flip-container')) return true
  return false
}

function handleKeyDown(e) {
  if (isInteractiveElement(e.target)) return
  // Escape belongs to EscHold (tap = pause, 3 s hold = quit); P pauses too.
  if (e.code === 'Escape') return
  if (e.code === 'KeyP' && !e.repeat) {
    if (gameStarted && !gameOver) {
      e.preventDefault()
      togglePause()
    }
    return
  }
  keys[e.code] = true
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    if (!gameStarted || gameOver) return
    e.preventDefault()
    if (!e.repeat) fire()
  }
  if (!gameStarted || gameOver) {
    if (e.code === 'Enter' && !e.repeat) startGame()
  }
}

function handleKeyUp(e) {
  keys[e.code] = false
}

function handleResize() {
  // setupCanvas() refreshes SW/SH via layout(), then we rebuild the wave if
  // the width class changed so the 11/8/5 column count adapts while bunkers
  // flip 3<->4.
  setupCanvas()
  const nowCols = SW >= 900 ? 11 : SW >= 600 ? 8 : 5
  if (nowCols !== cols) {
    buildWave()
    resetBunkers()
  }
  // Keep everything on screen after a resize.
  fx = clamp(fx, margin, Math.max(margin, SW - margin - formW))
  fy = Math.max(0, Math.min(fy, bunkerTop() - formH - cellH))
  cannonX = clampCannon(cannonX)
  if (ufo) ufo.y = Math.max(26, SH * 0.055)
}

let resizeT = null
function debouncedResize() {
  if (resizeT) clearTimeout(resizeT)
  resizeT = setTimeout(() => { resizeT = null; handleResize() }, 150)
}

function clearInput() {
  touchActive = false
  activeTouchId = null
  keys = {}
}

function handleTouchStart(e) {
  if (isInteractiveElement(e.target) || activeTouchId !== null) return
  const t = e.changedTouches[0]
  if (!t) return
  activeTouchId = t.identifier
  tapStartX = t.clientX
  tapStartY = t.clientY
  tapStartTime = performance.now()
  if (!gameStarted || gameOver) return // Idle: a tap starts, a swipe does nothing.
  e.preventDefault()
  touchActive = true
  touchX = t.clientX
  // Like Breakout, follow the finger directly instead of chasing it at key speed.
  if (dying <= 0) cannonX = clampCannon(touchX)
}

function handleTouchMove(e) {
  const t = Array.from(e.changedTouches).find(t => t.identifier === activeTouchId)
  if (!t || !touchActive) return
  e.preventDefault()
  touchX = t.clientX
}

function handleTouchEnd(e) {
  const t = Array.from(e.changedTouches).find(t => t.identifier === activeTouchId)
  if (!t) return
  const isTap = Math.hypot(t.clientX - tapStartX, t.clientY - tapStartY) < 15 && performance.now() - tapStartTime < 400
  if ((!gameStarted || gameOver) && isTap) startGame()
  clearInput()
}

function handleTouchCancel(e) {
  if (Array.from(e.changedTouches).some(t => t.identifier === activeTouchId)) clearInput()
}

function handleVisibility() {
  if (document.hidden) clearInput()
}

onMounted(() => {
  setupCanvas()
  startDemo()
  gameRunning = true
  lastTime = performance.now()
  lastFrameT = lastTime
  animationFrameId = requestAnimationFrame(frame)

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('resize', debouncedResize)
  window.addEventListener('touchstart', handleTouchStart, { passive: false })
  window.addEventListener('touchmove', handleTouchMove, { passive: false })
  window.addEventListener('touchend', handleTouchEnd)
  window.addEventListener('touchcancel', handleTouchCancel)
  window.addEventListener('blur', clearInput)
  document.addEventListener('visibilitychange', handleVisibility)
})

onBeforeUnmount(() => {
  gameRunning = false
  sound.music.stop()
  clearInput()
  if (resizeT) clearTimeout(resizeT)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('resize', debouncedResize)
  window.removeEventListener('touchstart', handleTouchStart)
  window.removeEventListener('touchmove', handleTouchMove)
  window.removeEventListener('touchend', handleTouchEnd)
  window.removeEventListener('touchcancel', handleTouchCancel)
  window.removeEventListener('blur', clearInput)
  document.removeEventListener('visibilitychange', handleVisibility)
})
</script>

<style scoped>
/* Full-viewport playfield behind the landing overlay. */
.invaders-canvas {
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
