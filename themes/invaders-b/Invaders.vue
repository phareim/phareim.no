<template>
  <canvas ref="canvas" class="invaders-b-canvas"></canvas>
</template>

<script setup>
/**
 * Invaders B — RISOGRAPH PRINT. The faithful 1978 formation game as a
 * two-ink risograph poster on warm cream paper: fluorescent PINK (#ff4f8b)
 * and deep BLUE (#2440b3), overprinted with deliberate misregistration
 * (every sprite drawn twice, pink plate offset 1–2 px, multiply blend so
 * overlaps go purple-black), paper grain, halftone dots, and one more faint
 * background ink layer per cleared wave.
 *
 * Same contract as rtype/Shooter.vue and breakout/Breakout.vue: a
 * full-viewport canvas behind the landing overlay, attract-mode autopilot
 * until Enter/tap, events up to Landing.vue for the HUD. Canvas primitives
 * only, no assets. The formation marches on a TIMER (jerky on purpose).
 */
const emit = defineEmits(['score', 'wave', 'lives', 'death', 'restart', 'started'])

const canvas = ref(null)
let ctx = null
let raf = 0
let running = false
let W = 0
let H = 0
let dpr = 1

// ---------------------------------------------------------------- palette

const PAPER = '#f3ecd9'
const PAPER_WARM = '#eed9bd'
const PAPER_DEEP = '#e7dcc0'
const BLUE = '#2440b3'
const PINK = '#ff4f8b'
const INK = '#1b2560'

const MAX_SPLATS = 60
const ROWS = 5
const PTS = [30, 20, 20, 10, 10]
const SPECIES = ['squid', 'crab', 'crab', 'octo', 'octo']
const SPC_W = { squid: 8, crab: 11, octo: 12 }
const SPC_COLOR = { squid: PINK, crab: BLUE, octo: PINK }
const UFO_PTS = [50, 100, 150, 150, 300]

// ---------------------------------------------------------------- sprites
// Classic 1978 bitmaps ('X' = ink). Two frames per species.

const SPR = {
  squidA: [
    '...XX...',
    '..XXXX..',
    '.XXXXXX.',
    'XX.XX.XX',
    'XXXXXXXX',
    '..X..X..',
    '.X.XX.X.',
    'X.X..X.X',
  ],
  squidB: [
    '...XX...',
    '..XXXX..',
    '.XXXXXX.',
    'XX.XX.XX',
    'XXXXXXXX',
    '.X.X.X..',
    'X..X..X.',
    '.X....X.',
  ],
  crabA: [
    '..X.....X..',
    '...X...X...',
    '..XXXXXXX..',
    '.XX.XXX.XX.',
    'XXXXXXXXXXX',
    'X.XXXXXXX.X',
    'X.X.....X.X',
    '...XX.XX...',
  ],
  crabB: [
    '..X.....X..',
    'X..X...X..X',
    'X.XXXXXXX.X',
    'XXX.XXX.XXX',
    'XXXXXXXXXXX',
    '.XXXXXXXXX.',
    '..X.....X..',
    '.X.......X.',
  ],
  octoA: [
    '....XXXX....',
    '.XXXXXXXXXX.',
    'XXXXXXXXXXXX',
    'XX.XX..XX.XX',
    'XXXXXXXXXXXX',
    '...XX..XX...',
    '..XX.XX.XX..',
    'XX..X..X..XX',
  ],
  octoB: [
    '....XXXX....',
    '.XXXXXXXXXX.',
    'XXXXXXXXXXXX',
    'XX.XX..XX.XX',
    'XXXXXXXXXXXX',
    '..XXX..XXX..',
    '.XX..XX..XX.',
    '...X....X...',
  ],
  ufo: [
    '.....XXXXXX.....',
    '...XXXXXXXXXX...',
    '..XXXXXXXXXXXX..',
    'XXXXXXXXXXXXXXXX',
    'XX.XXXXXXXXXX.XX',
    '.XXXXXXXXXXXXXX.',
    '...XX..XX..XX...',
  ],
  cannon: [
    '......X......',
    '......X......',
    '.....XXX.....',
    '.....XXX.....',
    '..XXXXXXXXX..',
    '.XXXXXXXXXXX.',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
  ],
}

// Rough ink edges: one jitter table per stamp, regenerated on every
// formation step (frame change), never per frame.
let JIT = {}
function regenJitter() {
  JIT = {}
  const keys = ['squidA', 'squidB', 'crabA', 'crabB', 'octoA', 'octoB', 'ufo', 'cannon']
  for (const k of keys) {
    const n = SPR[k].join('').replace(/[^X]/g, '').length + 8
    const a = new Float32Array(n)
    for (let i = 0; i < n; i++) a[i] = (Math.random() - 0.5) * 0.7
    JIT[k] = a
  }
}

// Cannon explosion scatter (deterministic disc of offsets, radius 1).
const EXP = []
for (let i = 0; i < 46; i++) {
  const a = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.random())
  EXP.push({ dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.8 })
}

// ---------------------------------------------------------------- state

let cols = 11
let margin = 40
let u = 3 // sprite pixel unit (css px)
let cellW = 40
let cellH = 30
let baseOx = 0
let baseOy = 80
let marchX = 0
let marchY = 0
let dropRows = 0
let misX = 1.5
let misY = 1

let grid = [] // { c, r, alive }
let totalCount = 55
let dir = 1
let frame = 0
let stepT = 0
let stepDX = 10
let dropDY = 24

let cannonX = 0
let cannonY = 0
let cannonW = 40
let cannonH = 24
let shot = null // one player shot at a time: { x, y }
let bombs = [] // { x, y, style, t, speed }
let bombT = 1
let ufo = null // { x, dir }
let ufoY = 60
let ufoT = 22
let splats = [] // ink splats { x, y, r, color, t, blobs }
let pops = [] // score popups { x, y, text, t, color }
let layers = [] // one faint bg ink layer per cleared wave { sp, x, y, rot, s, color }
let bunkers = [] // { x, y, w, h, gw, gh, bp, cells, imgB, imgP, dirty }
let pulse = 0 // heartbeat: 1 on every formation step, decays
let noisePattern = null
let noiseCanvas = null

let score = 0
let lastScoreSent = -1
let wave = 1
let lives = 3
let nextLife = 1500
let gameOver = false
let gameStarted = false
let freezeT = 0 // death freeze: formation stops, explosion plays
let dying = false
let clearT = 0 // wave-clear pause before the next formation
let deathDelayT = 0 // delayed 'death' emit so the end plays out
let deathEmitted = false
let invulnUntil = 0
let eatT = 0
let lastTime = 0

let keys = {}
let touchActive = false
let touchX = 0
let touchFire = false
let tapStartX = 0
let tapStartY = 0
let tapStartTime = 0

// ---------------------------------------------------------------- helpers

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function mixHex(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16))
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return 'rgb(' + m[0] + ',' + m[1] + ',' + m[2] + ')'
}

function aliveCount() {
  let n = 0
  for (let i = 0; i < grid.length; i++) if (grid[i].alive) n++
  return n
}

function stepInterval() {
  const frac = totalCount > 0 ? aliveCount() / totalCount : 0
  const base = Math.max(360, 640 - wave * 45)
  return 26 + (base - 26) * frac
}

// ---------------------------------------------------------------- layout

function layout() {
  cols = W < 560 ? 7 : (W < 900 ? 8 : 11)
  margin = Math.max(14, W * 0.05)
  u = clamp((W - margin * 2) / (cols * 14), 1.4, 4.2)
  cellW = 14 * u
  cellH = 10 * u
  stepDX = cellW * 0.3
  dropDY = cellH * 0.85
  misX = Math.max(1, u * 0.4)
  misY = Math.max(0.8, u * 0.28)
  baseOx = (W - cols * cellW) / 2
  dropRows = Math.min(wave - 1, 3)
  baseOy = Math.max(56, H * 0.09) + dropRows * cellH
  cannonW = 13 * u
  cannonH = 8 * u
  cannonY = H - Math.max(56, H * 0.085)
  cannonX = clamp(cannonX || W / 2, margin + cannonW / 2, W - margin - cannonW / 2)
  ufoY = Math.max(44, H * 0.065)
  buildBunkers()
}

// ---------------------------------------------------------------- bunkers

const BGW = 26
const BGH = 18

function buildBunkers() {
  bunkers = []
  const n = W < 640 ? 3 : 4
  const bp = u * 0.85
  const bw = BGW * bp
  const bh = BGH * bp
  const gap = (W - margin * 2 - n * bw) / (n + 1)
  const bottom = cannonY - cannonH / 2 - 26
  const y = bottom - bh
  for (let i = 0; i < n; i++) {
    const x = margin + gap * (i + 1) + bw * i
    const cells = new Uint8Array(BGW * BGH)
    for (let gy = 0; gy < BGH; gy++) {
      for (let gx = 0; gx < BGW; gx++) {
        // Rounded top corners.
        if (gy < 4) {
          if (gx < 4 - gy || gx > BGW - 1 - (4 - gy)) continue
        }
        // Arch cut out of the bottom middle (classic bunker doorway).
        const nx = (gx + 0.5 - BGW / 2) / 6.5
        const ny = (gy + 0.5 - BGH) / 8
        if (gy > BGH - 10 && nx * nx + ny * ny < 1) continue
        cells[gy * BGW + gx] = 1
      }
    }
    const b = { x, y, w: bw, h: bh, bp, cells, imgB: null, imgP: null, dirty: true }
    bunkers.push(b)
  }
  renderBunkers()
}

function renderBunker(b) {
  const bw = Math.ceil(BGW * b.bp)
  const bh = Math.ceil(BGH * b.bp)
  if (!b.imgB || b.imgB.width !== bw) {
    b.imgB = document.createElement('canvas')
    b.imgP = document.createElement('canvas')
    b.imgB.width = bw
    b.imgB.height = bh
    b.imgP.width = bw
    b.imgP.height = bh
  }
  for (const [img, color] of [[b.imgB, BLUE], [b.imgP, PINK]]) {
    const g = img.getContext('2d')
    g.clearRect(0, 0, bw, bh)
    g.fillStyle = color
    for (let gy = 0; gy < BGH; gy++) {
      for (let gx = 0; gx < BGW; gx++) {
        if (b.cells[gy * BGW + gx]) g.fillRect(gx * b.bp, gy * b.bp, b.bp + 0.5, b.bp + 0.5)
      }
    }
    // Halftone dots on the ink.
    g.fillStyle = 'rgba(27,37,96,0.28)'
    for (let yy = 1; yy < BGH; yy += 2) {
      for (let xx = (yy % 4 === 1 ? 1 : 2); xx < BGW; xx += 4) {
        if (b.cells[yy * BGW + xx]) {
          g.beginPath()
          g.arc(xx * b.bp + b.bp / 2, yy * b.bp + b.bp / 2, b.bp * 0.28, 0, Math.PI * 2)
          g.fill()
        }
      }
    }
  }
  b.dirty = false
}

function renderBunkers() {
  for (const b of bunkers) renderBunker(b)
}

// Erase a ragged disc of bunker pixels around paper coords (px, py).
function eraseDisc(b, px, py, r) {
  const gx0 = Math.floor((px - r - b.x) / b.bp)
  const gx1 = Math.ceil((px + r - b.x) / b.bp)
  const gy0 = Math.floor((py - r - b.y) / b.bp)
  const gy1 = Math.ceil((py + r - b.y) / b.bp)
  let hit = false
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      if (gx < 0 || gy < 0 || gx >= BGW || gy >= BGH) continue
      if (!b.cells[gy * BGW + gx]) continue
      const cx = b.x + (gx + 0.5) * b.bp
      const cy = b.y + (gy + 0.5) * b.bp
      const d = Math.hypot(cx - px, cy - py)
      if (d < r * (0.55 + Math.random() * 0.45)) {
        b.cells[gy * BGW + gx] = 0
        hit = true
      }
    }
  }
  if (hit) b.dirty = true
  return hit
}

// Which bunker covers paper point (px, py), if any (live pixel or not).
function bunkerAt(px, py) {
  for (const b of bunkers) {
    if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b
  }
  return null
}

// ---------------------------------------------------------------- waves

function buildWave() {
  grid = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < cols; c++) grid.push({ c, r, alive: true })
  }
  totalCount = grid.length
  marchX = 0
  marchY = 0
  dir = 1
  frame = 0
  stepT = stepInterval() / 1000
  dropRows = Math.min(wave - 1, 3)
  baseOy = Math.max(56, H * 0.09) + dropRows * cellH
  regenJitter()
}

function resetGame() {
  score = 0
  lastScoreSent = 0
  wave = 1
  lives = 3
  nextLife = 1500
  gameOver = false
  gameStarted = true
  freezeT = 0
  dying = false
  clearT = 0
  deathDelayT = 0
  deathEmitted = false
  invulnUntil = 0
  shot = null
  bombs = []
  bombT = 1.2
  ufo = null
  ufoT = 20 + Math.random() * 8
  splats = []
  pops = []
  layers = []
  pulse = 0
  cannonX = W / 2
  buildWave()
  buildBunkers()
  emit('restart')
  emit('started')
  emit('score', 0)
  emit('wave', 1)
  emit('lives', lives)
}

// Attract mode: the game plays itself behind the card until Enter/tap.
function startDemo() {
  gameStarted = false
  gameOver = false
  score = 0
  lastScoreSent = 0
  wave = 1
  lives = 3
  nextLife = 1500
  freezeT = 0
  dying = false
  clearT = 0
  deathDelayT = 0
  deathEmitted = false
  invulnUntil = 0
  shot = null
  bombs = []
  bombT = 1.4
  ufo = null
  ufoT = 12 + Math.random() * 8
  splats = []
  pops = []
  layers = []
  pulse = 0
  cannonX = W / 2
  buildWave()
  buildBunkers()
}

function addScore(n, px, py, color) {
  score += n
  if (gameStarted) {
    if (score !== lastScoreSent) {
      lastScoreSent = score
      emit('score', score)
    }
    if (score >= nextLife) {
      nextLife += 1500
      lives++
      emit('lives', lives)
      if (px !== undefined) pops.push({ x: px, y: py, text: 'EXTRA ▲', t: 1.6, color: color || PINK })
    }
  }
}

// Paper coords of an invader's sprite box.
function invXY(inv) {
  const sp = SPECIES[inv.r]
  const w = SPC_W[sp] * u
  const h = 8 * u
  return {
    x: baseOx + marchX + inv.c * cellW + (cellW - w) / 2,
    y: baseOy + marchY + inv.r * cellH + (cellH - h) / 2,
    w,
    h,
  }
}

function fire() {
  if (shot) return // the classic constraint: one shot on screen
  shot = { x: cannonX, y: cannonY - cannonH / 2 - 2 }
}

function onDeath(now) {
  if (now < invulnUntil || dying) return
  dying = true
  freezeT = 1.0 // ~1 s freeze where the formation stops
}

function afterFreeze(now) {
  dying = false
  if (!gameStarted) {
    // Autopilot got clipped: respawn quietly, the show goes on.
    cannonX = W / 2
    invulnUntil = now + 2
    return
  }
  lives--
  emit('lives', lives)
  if (lives <= 0) {
    gameOver = true
    deathDelayT = 1.0
    deathEmitted = false
  } else {
    cannonX = W / 2
    invulnUntil = now + 2.5
  }
}

function invade() {
  if (!gameStarted) {
    startDemo() // attract mode recycles quietly
    return
  }
  if (!gameOver) {
    gameOver = true
    deathDelayT = 1.2
    deathEmitted = false
  }
}

function killInvader(inv, px, py) {
  inv.alive = false
  const color = SPC_COLOR[SPECIES[inv.r]]
  spawnSplat(px, py, Math.max(10, u * 3.2), color)
  addScore(PTS[inv.r])
}

// ---------------------------------------------------------------- effects

function spawnSplat(x, y, r, color) {
  if (splats.length >= MAX_SPLATS) splats.shift()
  const blobs = []
  const n = 12 + Math.floor(Math.random() * 5)
  for (let i = 0; i < n; i++) {
    blobs.push({
      a: Math.random() * Math.PI * 2,
      d: 0.15 + Math.random() * 0.85,
      r: 0.12 + Math.random() * 0.22,
    })
  }
  splats.push({ x, y, r, color, t: 0.6, blobs })
}

// ---------------------------------------------------------------- update

function formationStep() {
  frame = 1 - frame
  regenJitter()
  pulse = 1 // the heartbeat shows in the paper tone
  let minC = 1e9
  let maxC = -1e9
  for (const inv of grid) {
    if (!inv.alive) continue
    if (inv.c < minC) minC = inv.c
    if (inv.c > maxC) maxC = inv.c
  }
  if (maxC < 0) return
  const left = baseOx + marchX + minC * cellW
  const right = baseOx + marchX + (maxC + 1) * cellW
  const dx = dir * stepDX
  if ((dir > 0 && right + dx > W - margin) || (dir < 0 && left + dx < margin)) {
    dir *= -1
    marchY += dropDY
  } else {
    marchX += dx
  }
}

function dropBomb() {
  // Random invader in the lowest occupied position of its column.
  const byCol = new Map()
  for (const inv of grid) {
    if (!inv.alive) continue
    const cur = byCol.get(inv.c)
    if (!cur || inv.r > cur.r) byCol.set(inv.c, inv)
  }
  if (byCol.size === 0) return
  const list = [...byCol.values()]
  const inv = list[Math.floor(Math.random() * list.length)]
  const p = invXY(inv)
  bombs.push({
    x: p.x + p.w / 2,
    y: p.y + p.h + 2,
    style: Math.floor(Math.random() * 3),
    t: Math.random() * 10,
    speed: Math.min(430, 190 + wave * 28 + Math.random() * 40),
  })
}

function bombInterval() {
  return wave <= 1 ? 0.9 + Math.random() * 0.7 : 0.45 + Math.random() * 0.5
}

function bombCap() {
  return wave <= 1 ? 2 : 3
}

function autopilot(dt) {
  // Cannon tracks the lowest invader in the nearest column, dodges bombs,
  // fires when its shot is free and roughly aligned.
  let best = null
  let bd = 1e12
  for (const inv of grid) {
    if (!inv.alive) continue
    const p = invXY(inv)
    const dy = cannonY - p.y
    if (dy <= 0) continue
    const d = Math.abs(p.x + p.w / 2 - cannonX) + dy * 0.15
    if (d < bd) {
      bd = d
      best = p
    }
  }
  let target = best ? best.x + best.w / 2 : W / 2
  for (const b of bombs) {
    if (b.y < cannonY && cannonY - b.y < 240 && Math.abs(b.x - cannonX) < 46) {
      target = cannonX + (b.x >= cannonX ? -130 : 130)
      break
    }
  }
  const d = target - cannonX
  cannonX += clamp(d, -460 * dt, 460 * dt)
  cannonX = clamp(cannonX, margin + cannonW / 2, W - margin - cannonW / 2)
  if (!shot && best && Math.abs(best.x + best.w / 2 - cannonX) < cellW * 0.6) fire()
}

function update(nowMs) {
  const now = nowMs / 1000
  let dt = (nowMs - lastTime) / 1000
  if (!(dt > 0)) dt = 0.016
  dt = Math.min(dt, 0.05) // clamp to 50 ms for frame-rate independence
  lastTime = nowMs

  // Always-on decay: splats soak in, popups rise, heartbeat fades.
  for (let i = splats.length - 1; i >= 0; i--) {
    splats[i].t -= dt
    if (splats[i].t <= 0) splats.splice(i, 1)
  }
  for (let i = pops.length - 1; i >= 0; i--) {
    pops[i].t -= dt
    if (pops[i].t <= 0) pops.splice(i, 1)
  }
  pulse = Math.max(0, pulse - dt * 2.2)

  // Death freeze: the formation stops, the explosion plays.
  if (freezeT > 0) {
    freezeT -= dt
    if (freezeT <= 0) afterFreeze(now)
    return
  }

  // Delayed death emit so the end plays out.
  if (gameOver && !deathEmitted) {
    deathDelayT -= dt
    if (deathDelayT <= 0) {
      deathEmitted = true
      emit('death')
    }
    return
  }
  if (gameOver) return

  // Wave-clear pause, then the next formation starts one row lower.
  if (clearT > 0) {
    clearT -= dt
    if (clearT <= 0) {
      wave++
      if (gameStarted) emit('wave', wave)
      layers.push({
        sp: ['squid', 'crab', 'octo'][Math.floor(Math.random() * 3)],
        x: Math.random() * W,
        y: H * 0.15 + Math.random() * H * 0.6,
        rot: (Math.random() - 0.5) * 0.5,
        s: 6 + Math.random() * 5,
        color: Math.random() < 0.5 ? BLUE : PINK,
      })
      if (layers.length > 6) layers.shift()
      buildWave()
      buildBunkers()
    }
  }

  const demo = !gameStarted

  // Formation march (timer, not per-frame — the jerky original).
  if (clearT <= 0) {
    stepT -= dt
    if (stepT <= 0) {
      formationStep()
      stepT = stepInterval() / 1000
    }
  }

  // Cannon movement.
  if (demo) {
    autopilot(dt)
  } else {
    const lf = keys['ArrowLeft'] || keys['KeyA']
    const rt = keys['ArrowRight'] || keys['KeyD']
    const m = (rt ? 1 : 0) - (lf ? 1 : 0)
    if (m !== 0) {
      cannonX += m * 440 * dt
      cannonX = clamp(cannonX, margin + cannonW / 2, W - margin - cannonW / 2)
    } else if (touchActive) {
      const d = touchX - cannonX
      cannonX += clamp(d, -900 * dt, 900 * dt)
      cannonX = clamp(cannonX, margin + cannonW / 2, W - margin - cannonW / 2)
    }
    if (touchFire && !shot) fire()
  }

  // Player shot (one at a time) travels up.
  if (shot) {
    shot.y -= 680 * dt
    // vs UFO
    if (ufo && shot.y < ufoY + 7 * u && shot.y > ufoY - 12 &&
        shot.x > ufo.x - 4 && shot.x < ufo.x + 16 * u + 4) {
      const pts = UFO_PTS[Math.floor(Math.random() * UFO_PTS.length)]
      spawnSplat(shot.x, ufoY + 3 * u, Math.max(12, u * 3.6), PINK)
      pops.push({ x: shot.x, y: ufoY + 14, text: String(pts), t: 1.2, color: PINK })
      addScore(pts)
      ufo = null
      ufoT = 20 + Math.random() * 10
      shot = null
    }
  }
  if (shot) {
    // vs invaders
    for (const inv of grid) {
      if (!inv.alive) continue
      const p = invXY(inv)
      if (shot.x >= p.x && shot.x <= p.x + p.w && shot.y >= p.y && shot.y <= p.y + p.h) {
        killInvader(inv, p.x + p.w / 2, p.y + p.h / 2)
        shot = null
        break
      }
    }
  }
  if (shot) {
    // vs bombs (they cancel each other)
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i]
      if (Math.abs(shot.x - b.x) < 4 + u && Math.abs(shot.y - b.y) < 6 + 4 * u) {
        spawnSplat(b.x, b.y, Math.max(8, u * 2.4), BLUE)
        bombs.splice(i, 1)
        shot = null
        break
      }
    }
  }
  if (shot) {
    // vs bunkers (erodes ink)
    const b = bunkerAt(shot.x, shot.y)
    if (b) {
      if (eraseDisc(b, shot.x, shot.y, 4.5 * b.bp * 0.5 + 3)) {
        spawnSplat(shot.x, shot.y, Math.max(7, u * 2), BLUE)
      }
      shot = null
    } else if (shot.y < 8) {
      shot = null
    }
  }

  // Wave clear?
  if (clearT <= 0 && aliveCount() === 0) clearT = 1.1

  // Bomb drops.
  bombT -= dt
  if (bombT <= 0 && clearT <= 0) {
    if (bombs.length < bombCap()) dropBomb()
    bombT = bombInterval()
  }

  // Bombs fall.
  const cw = { x: cannonX - cannonW / 2, y: cannonY - cannonH / 2, w: cannonW, h: cannonH }
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i]
    b.t += dt
    b.y += b.speed * dt
    if (b.style === 0) b.x += Math.sin(b.t * 9) * 46 * dt // zigzag
    // vs cannon
    if (b.x >= cw.x && b.x <= cw.x + cw.w && b.y >= cw.y && b.y <= cw.y + cw.h) {
      bombs.splice(i, 1)
      onDeath(now)
      continue
    }
    // vs bunkers
    const bk = bunkerAt(b.x, b.y + 3)
    if (bk) {
      if (eraseDisc(bk, b.x, b.y + 3, 5 * bk.bp * 0.5 + 3)) {
        spawnSplat(b.x, b.y + 3, Math.max(7, u * 2), BLUE)
      }
      bombs.splice(i, 1)
      continue
    }
    if (b.y > H + 12) bombs.splice(i, 1)
  }

  // Invaders eat through bunkers, and invade at the player row.
  eatT -= dt
  const doEat = eatT <= 0
  if (doEat) eatT = 0.15
  for (const inv of grid) {
    if (!inv.alive) continue
    const p = invXY(inv)
    if (p.y + p.h >= cannonY - cannonH / 2 - 4) {
      invade()
      return
    }
    if (doEat) {
      for (const bk of bunkers) {
        if (p.x < bk.x + bk.w && p.x + p.w > bk.x && p.y < bk.y + bk.h && p.y + p.h > bk.y) {
          const cx = clamp(p.x + p.w / 2, bk.x, bk.x + bk.w)
          const cy = clamp(p.y + p.h / 2, bk.y, bk.y + bk.h)
          eraseDisc(bk, cx, cy, Math.max(p.w, p.h) * 0.6)
        }
      }
    }
  }

  // Mystery UFO crosses the top every ~20–30 s.
  ufoT -= dt
  if (!ufo && ufoT <= 0) {
    const d = Math.random() < 0.5 ? 1 : -1
    ufo = { x: d > 0 ? -16 * u - 10 : W + 10, dir: d }
  }
  if (ufo) {
    ufo.x += ufo.dir * 150 * dt
    if ((ufo.dir > 0 && ufo.x > W + 10) || (ufo.dir < 0 && ufo.x < -16 * u - 10)) {
      ufo = null
      ufoT = 20 + Math.random() * 10
    }
  }
}

// ---------------------------------------------------------------- draw

function plot(rows, px, py, unit, j) {
  let k = 0
  const n = j ? j.length : 0
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 'X') {
        const jx = n ? j[k % n] : 0
        const jy = n ? j[(k + 7) % n] : 0
        ctx.fillRect(px + c * unit + jx, py + r * unit + jy, unit + 0.4, unit + 0.4)
        k++
      }
    }
  }
}

// Every sprite twice: pink plate offset, blue plate on top, multiply blend.
function stamp(key, px, py, unit, main, under) {
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = under
  plot(SPR[key], px + misX, py + misY, unit, JIT[key])
  ctx.fillStyle = main
  plot(SPR[key], px, py, unit, JIT[key])
  ctx.restore()
}

function makeNoise() {
  noiseCanvas = document.createElement('canvas')
  noiseCanvas.width = 128
  noiseCanvas.height = 128
  const g = noiseCanvas.getContext('2d')
  const img = g.createImageData(128, 128)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 20 + Math.floor(Math.random() * 60)
    img.data[i] = v
    img.data[i + 1] = v + 10
    img.data[i + 2] = v + 40
    img.data[i + 3] = 16
  }
  g.putImageData(img, 0, 0)
  noisePattern = ctx.createPattern(noiseCanvas, 'repeat')
}

function drawMoon() {
  const mx = W * 0.84
  const my = H * 0.19
  const r = Math.min(W, H) * 0.105
  ctx.fillStyle = PAPER_DEEP
  ctx.beginPath()
  ctx.arc(mx, my, r, 0, Math.PI * 2)
  ctx.fill()
  // Halftone dots on the moon.
  ctx.save()
  ctx.beginPath()
  ctx.arc(mx, my, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = 'rgba(36,64,179,0.12)'
  const step = Math.max(5, u * 1.8)
  for (let yy = my - r; yy < my + r; yy += step) {
    for (let xx = mx - r; xx < mx + r; xx += step) {
      if (Math.hypot(xx - mx, yy - my) < r) {
        ctx.beginPath()
        ctx.arc(xx, yy, step * 0.22, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.restore()
  // Thin ring, poster-style.
  ctx.save()
  ctx.translate(mx, my)
  ctx.rotate(-0.35)
  ctx.strokeStyle = 'rgba(36,64,179,0.5)'
  ctx.lineWidth = Math.max(1, u * 0.4)
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 1.5, r * 0.42, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawCropMarks() {
  ctx.strokeStyle = 'rgba(36,64,179,0.6)'
  ctx.lineWidth = 1.5
  const m = 10
  const l = 14
  const corners = [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath()
    ctx.moveTo(x, y + sy * l)
    ctx.lineTo(x, y)
    ctx.lineTo(x + sx * l, y)
    ctx.stroke()
  }
}

function drawLayers() {
  for (const L of layers) {
    ctx.save()
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = 0.055
    ctx.translate(L.x, L.y)
    ctx.rotate(L.rot)
    ctx.fillStyle = L.color
    plot(SPR[L.sp + 'A'], -SPC_W[L.sp] * L.s / 2, -4 * L.s, L.s, null)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

function drawInvader(inv) {
  const sp = SPECIES[inv.r]
  const p = invXY(inv)
  stamp(sp + (frame === 0 ? 'A' : 'B'), p.x, p.y, u, SPC_COLOR[sp], SPC_COLOR[sp] === PINK ? BLUE : PINK)
}

function drawUfo() {
  if (!ufo) return
  const rows = SPR.ufo
  // Body: pink saucer over a blue underprint…
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = BLUE
  plot(rows.slice(0, 5), ufo.x + misX, ufoY + misY, u, JIT.ufo)
  ctx.fillStyle = PINK
  plot(rows.slice(0, 5), ufo.x, ufoY, u, JIT.ufo)
  // …with a solid blue rim (bottom two rows).
  ctx.fillStyle = BLUE
  plot(rows.slice(5), ufo.x + misX * 0.5, ufoY + misY * 0.5, u, JIT.ufo)
  plot(rows.slice(5), ufo.x, ufoY, u, JIT.ufo)
  ctx.restore()
}

function drawCannon(now) {
  if (dying) {
    // Two-frame explosion scatter in both inks.
    const grow = 1 - freezeT // 0 → 1 over the freeze
    const s = u * (0.8 + grow * 1.6)
    ctx.save()
    ctx.globalCompositeOperation = 'multiply'
    for (const [off, color] of [[0, PINK], [1, BLUE]]) {
      ctx.fillStyle = color
      for (let i = off; i < EXP.length; i += 2) {
        const e = EXP[i]
        const w = u * (0.7 + ((i * 7) % 5) * 0.3)
        ctx.fillRect(
          cannonX + e.dx * s * 6 + (off ? 0 : misX),
          cannonY + e.dy * s * 6 + (off ? 0 : misY),
          w, w * 0.7
        )
      }
    }
    ctx.restore()
    return
  }
  if (now < invulnUntil && Math.floor(now * 12) % 2 === 0) return // respawn blink
  stamp('cannon', cannonX - cannonW / 2, cannonY - cannonH / 2, u, BLUE, PINK)
}

function drawShot() {
  if (!shot) return
  const w = Math.max(2, u * 0.9)
  const h = 4.5 * u
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = BLUE
  ctx.fillRect(shot.x - w / 2 + misX, shot.y - h + misY, w, h)
  ctx.fillStyle = PINK
  ctx.fillRect(shot.x - w / 2, shot.y - h, w, h)
  ctx.restore()
}

function drawBomb(b) {
  const s = Math.max(1.2, u * 0.8)
  const passes = [[misX, misY, PINK], [0, 0, BLUE]]
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.lineWidth = s * 0.9
  for (const [ox, oy, color] of passes) {
    ctx.strokeStyle = color
    ctx.fillStyle = color
    const x = b.x + ox
    const y = b.y + oy
    if (b.style === 0) {
      // Zigzag.
      ctx.beginPath()
      const ph = Math.floor(b.t * 6) % 2
      ctx.moveTo(x, y - 4 * s)
      ctx.lineTo(x + (ph ? s : -s), y - 2 * s)
      ctx.lineTo(x + (ph ? -s : s), y)
      ctx.lineTo(x + (ph ? s : -s), y + 2 * s)
      ctx.lineTo(x, y + 4 * s)
      ctx.stroke()
    } else if (b.style === 1) {
      // Plunger: bar, stem, cup — stem length alternates.
      const ext = Math.floor(b.t * 5) % 2 === 0 ? 0 : s * 1.2
      ctx.fillRect(x - 2 * s, y - 4 * s, 4 * s, s)
      ctx.fillRect(x - 0.5 * s, y - 3 * s, s, 4 * s + ext)
      ctx.fillRect(x - 2 * s, y + s + ext, 4 * s, s)
    } else {
      // Rolling: three bars, middle one slides.
      const off = Math.sin(b.t * 10) * s * 1.4
      ctx.fillRect(x - 2 * s, y - 3 * s, 4 * s, s * 0.9)
      ctx.fillRect(x - 2 * s + off, y - 0.5 * s, 4 * s, s * 0.9)
      ctx.fillRect(x - 2 * s, y + 2 * s, 4 * s, s * 0.9)
    }
  }
  ctx.restore()
}

function drawSplats() {
  for (const sp of splats) {
    const a = Math.max(0, sp.t / 0.6)
    const soak = 1 + (0.6 - sp.t) * 0.5
    ctx.save()
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = a * 0.9
    ctx.fillStyle = sp.color
    for (const bl of sp.blobs) {
      ctx.beginPath()
      ctx.arc(sp.x + Math.cos(bl.a) * bl.d * sp.r * soak, sp.y + Math.sin(bl.a) * bl.d * sp.r * soak,
        Math.max(0.8, bl.r * sp.r * soak), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

function drawPops() {
  for (const p of pops) {
    const a = clamp(p.t / 1.2, 0, 1)
    ctx.save()
    ctx.font = '800 ' + Math.round(10 + u * 3) + 'px ui-monospace, Menlo, Consolas, monospace'
    ctx.textAlign = 'center'
    ctx.globalAlpha = a
    ctx.fillStyle = BLUE
    ctx.fillText(p.text, p.x + misX, p.y - (1.6 - p.t) * 24 + misY)
    ctx.fillStyle = p.color
    ctx.fillText(p.text, p.x, p.y - (1.6 - p.t) * 24)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

function draw() {
  if (!ctx) return
  const now = performance.now() / 1000

  // Paper, warmed by the heartbeat pulse.
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.fillStyle = mixHex(PAPER, PAPER_WARM, pulse * 0.55)
  ctx.fillRect(0, 0, W, H)

  drawMoon()
  drawLayers()

  // Bunkers: pink plate offset, blue plate on top.
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  for (const b of bunkers) {
    if (b.dirty) renderBunker(b)
    ctx.globalAlpha = 0.9
    ctx.drawImage(b.imgP, b.x + misX, b.y + misY, b.w, b.h)
    ctx.globalAlpha = 1
    ctx.drawImage(b.imgB, b.x, b.y, b.w, b.h)
  }
  ctx.restore()
  ctx.globalAlpha = 1

  drawUfo()
  for (const inv of grid) if (inv.alive) drawInvader(inv)
  drawCannon(now)
  drawShot()
  for (const b of bombs) drawBomb(b)
  drawSplats()
  drawPops()

  // Paper grain over everything.
  if (noisePattern) {
    ctx.save()
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = 0.55
    ctx.fillStyle = noisePattern
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
    ctx.globalAlpha = 1
  }
  ctx.globalCompositeOperation = 'source-over'

  drawCropMarks()
}

function gameLoop(now) {
  if (!running) return
  update(now)
  draw()
  raf = requestAnimationFrame(gameLoop)
}

// ---------------------------------------------------------------- setup

function setupCanvas() {
  const c = canvas.value
  if (!c) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = c.offsetWidth
  H = c.offsetHeight
  c.width = Math.round(W * dpr)
  c.height = Math.round(H * dpr)
  ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (!noisePattern) makeNoise()
  layout()
}

// ---------------------------------------------------------------- input

function isInteractiveElement(el) {
  if (!el || !el.closest) return false
  const tag = el.tagName
  if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT') return true
  if (el.closest('a, button, .social-links, .flip-container, .theme-pager')) return true
  return false
}

function handleKeyDown(e) {
  if (e.code === 'Space' || e.code === 'ArrowUp') e.preventDefault()
  keys[e.code] = true
  if ((e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') && !e.repeat) {
    if (gameStarted && !gameOver && !dying) fire()
  }
  if (e.code === 'Enter' && (!gameStarted || gameOver)) resetGame()
  // Arrow keys drive the cannon while running; the shell's theme switching
  // stays locked via navigationLocked (see Landing.vue).
  if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && gameStarted && !gameOver) e.preventDefault()
}

function handleKeyUp(e) {
  keys[e.code] = false
}

function handleResize() {
  setupCanvas()
}

function handleTouchStart(e) {
  if (isInteractiveElement(e.target)) return
  const t = e.touches[0]
  tapStartX = t.clientX
  tapStartY = t.clientY
  tapStartTime = performance.now()
  if (!gameStarted || gameOver) {
    // Start on tap, not on touchstart, so a horizontal swipe can still
    // switch theme without launching the game.
    return
  }
  touchActive = true
  touchFire = true // auto-fire while touching
  touchX = t.clientX
}

function handleTouchMove(e) {
  if (!touchActive) return
  if (isInteractiveElement(e.target)) return
  e.preventDefault() // only while playing
  touchX = e.touches[0].clientX
}

function handleTouchEnd(e) {
  if (isInteractiveElement(e.target)) {
    touchActive = false
    touchFire = false
    return
  }
  const t = e.changedTouches[0]
  const isTap = t && Math.hypot(t.clientX - tapStartX, t.clientY - tapStartY) < 15 &&
    performance.now() - tapStartTime < 400
  if (!gameStarted || gameOver) {
    if (isTap) resetGame()
  }
  touchActive = false
  touchFire = false
}

onMounted(() => {
  setupCanvas()
  startDemo()
  running = true
  lastTime = performance.now()
  raf = requestAnimationFrame(gameLoop)

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('resize', handleResize)
  window.addEventListener('touchstart', handleTouchStart, { passive: true })
  window.addEventListener('touchmove', handleTouchMove, { passive: false })
  window.addEventListener('touchend', handleTouchEnd)
})

onBeforeUnmount(() => {
  running = false
  if (raf) cancelAnimationFrame(raf)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('touchstart', handleTouchStart)
  window.removeEventListener('touchmove', handleTouchMove)
  window.removeEventListener('touchend', handleTouchEnd)
})
</script>

<style scoped>
/* Full-viewport playfield behind the landing overlay. */
.invaders-b-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  display: block;
  z-index: 1;
}
</style>
