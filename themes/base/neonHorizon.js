/**
 * Neon Horizon — the shared synthwave backdrop for the Neon Dreams arcade
 * themes on phareim.no. Ported out of themes/invaders/Invaders.vue
 * (buildGradCache / buildGridCache / buildStars / horizonY / buildRidge /
 * the sky+stars part of drawBackground / drawSun / drawMountains / drawGrid,
 * plus the heartbeat pulse and the per-beat sun-stripe scroll).
 *
 * Colours are the Neon Dreams tokens, as already used in Invaders:
 * sky #060310 / #0b0616 / #170a30, stars #cfe9ff, sun #ffd23f → #ff6a3d →
 * #ff2fa0 with ground-coloured cut bands, ridge fill #120826 with a pink
 * .65 stroke at 1.5 px, grid pink with 9 rails at .35, a cyan centre rail
 * (Invaders strokes all rails pink; the design system calls the centre rail
 * cyan, so it is overdrawn here), and a 2 px horizon line at .8.
 *
 * Performance tricks, kept from Invaders: gradient caches rebuilt on resize
 * (not per frame), rails baked into one cached Path2D, star alpha quantized
 * to quarters, and no shadowBlur on small screens (W < 600).
 *
 * Context handling: canvas gradients and the Path2D rail cache are tied to
 * the canvas 2D context, so this module needs a ctx to build them. Pass it
 * either way — whichever is handy:
 *   const horizon = createHorizon({ ctx })  // then resize(W, H)
 *   // or
 *   const horizon = createHorizon()         // then resize(W, H, ctx)
 * draw(ctx, …) takes the live ctx every frame and rebuilds any missing or
 * stale cache from it, so a context passed only to resize (or only to
 * createHorizon) is enough; passing both just overwrites the stored ref.
 *
 * Usage (Breakout.vue pattern):
 *   horizon = createHorizon()
 *   // in setupCanvas / on resize:
 *   horizon.resize(W, H, ctx)
 *   // once per frame in update():
 *   horizon.update(dt)
 *   // first thing in draw():
 *   horizon.draw(ctx, nowSec, { dim: !gameStarted })
 *   // on hits / level clear:
 *   horizon.beat()
 */

const PINK = '#ff2fa0'
const CYAN = '#2ff3ff'
const GOLD = '#ffd23f'
const ORANGE = '#ff6a3d'
const GROUND = '#0b0616'
const GROUND_DEEP = '#060310'
const SKY_GLOW = '#170a30'
const STAR = '#cfe9ff'
const RIDGE_FILL = '#120826'

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function makeRadialBlob(color, size) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g2 = c.getContext('2d')
  const g = g2.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  g2.fillStyle = g
  g2.fillRect(0, 0, size, size)
  return c
}

export function createHorizon(opts) {
  opts = opts || {}
  // Stored ctx for building gradient / rail caches in resize(). draw()
  // always uses its own ctx argument and heals stale caches from it.
  let ctxRef = opts.ctx || null

  let W = 0
  let H = 0
  let stars = []
  let ridge = []
  let pulse = 0 // heartbeat: 1 on beat(), decays at 2.2/s like Invaders
  let heartT = 0 // ~120 ms grid-brightness window per beat, like Invaders
  let gridScroll = 0
  let sunNotch = 0 // sun cut bands scroll one notch per beat
  let mobile = false

  let skyGrad = null
  let skyGradH = 0
  let sunGrad = null
  let sunGradKey = ''
  let gridRailsPath = null
  let gridRailsKey = ''
  let pinkBlob = null

  function horizonY() {
    return W < 600 ? H * 0.92 : H * 0.7
  }

  function buildGradCache(c) {
    const g = c || ctxRef
    if (!g || W <= 0 || H <= 0) return
    const sky = g.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, GROUND_DEEP)
    sky.addColorStop(0.55, GROUND)
    sky.addColorStop(0.7, SKY_GLOW)
    sky.addColorStop(1, GROUND_DEEP)
    skyGrad = sky
    skyGradH = H
    const hy = horizonY()
    const r = Math.min(W * 0.22, H * 0.15)
    if (r >= 20) {
      const cy = hy + r * 0.55
      const sg = g.createLinearGradient(0, cy - r, 0, cy + r)
      sg.addColorStop(0, GOLD)
      sg.addColorStop(0.55, ORANGE)
      sg.addColorStop(1, PINK)
      sunGrad = sg
      sunGradKey = `${Math.round(W)}x${Math.round(H)}`
    }
  }

  function buildGridCache() {
    const hy = horizonY()
    const p = new Path2D()
    for (let k = -4; k <= 4; k++) {
      p.moveTo(W / 2 + k * 9, hy)
      p.lineTo(W / 2 + (k * W) / 7, H)
    }
    gridRailsPath = p
    gridRailsKey = `${Math.round(W)}x${Math.round(H)}`
  }

  function buildStars() {
    stars = []
    const n = Math.round(clamp((W * H) / 16000, 40, 90))
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * horizonY() * 0.94,
        b: 0.25 + Math.random() * 0.6,
        sp: 1 + Math.random() * 3,
        ph: Math.random() * Math.PI * 2,
      })
    }
  }

  function buildRidge() {
    ridge = []
    const n = Math.max(12, Math.round(W / 64))
    for (let i = 0; i <= n; i++) {
      ridge.push({
        x: (i / n) * W,
        h: (0.25 + Math.random() * 0.75) * H * 0.055,
      })
    }
  }

  function resize(nW, nH, c) {
    if (c) ctxRef = c
    W = nW
    H = nH
    mobile = W < 600
    buildStars()
    buildRidge()
    buildGradCache()
    buildGridCache()
    pinkBlob = makeRadialBlob('rgba(255, 47, 160, 0.5)', 128)
  }

  function update(dt) {
    if (!(dt > 0)) return
    pulse = Math.max(0, pulse - dt * 2.2)
    heartT = Math.max(0, heartT - dt)
    gridScroll = (gridScroll + dt * 0.35) % 1
  }

  function beat() {
    pulse = 1
    heartT = 0.12
    sunNotch++
  }

  function drawSun(ctx, dim) {
    const hy = horizonY()
    let r = Math.min(W * 0.22, H * 0.15)
    if (r < 20) return
    const cx = W / 2
    const cy = hy + r * 0.55
    const portrait = W < 600
    if (pinkBlob) {
      const hr = r * 2.1
      ctx.globalAlpha = dim ? 0.28 : 0.44
      ctx.drawImage(pinkBlob, cx - hr, cy - hr, hr * 2, hr * 2)
      ctx.globalAlpha = 1
    }
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.clip()
    if (!sunGrad || sunGradKey !== `${Math.round(W)}x${Math.round(H)}`) buildGradCache(ctx)
    const grad = sunGrad || (() => {
      const f = ctx.createLinearGradient(0, cy - r, 0, cy + r)
      f.addColorStop(0, GOLD)
      f.addColorStop(0.55, ORANGE)
      f.addColorStop(1, PINK)
      return f
    })()
    ctx.globalAlpha = portrait ? 0.32 : dim ? 0.5 : 0.8
    ctx.fillStyle = grad
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.globalAlpha = 1
    const phase = (sunNotch % 4) * 2
    let yy = cy - r * 0.25 + phase
    while (yy < cy + r) {
      const barH = 1 + ((yy - (cy - r * 0.25)) / (2 * r)) * 9
      ctx.fillStyle = GROUND
      ctx.fillRect(cx - r, yy, r * 2, barH)
      yy += barH + 9
    }
    ctx.restore()
  }

  function drawMountains(ctx) {
    const hy = horizonY()
    ctx.beginPath()
    ctx.moveTo(0, hy)
    for (let i = 0; i < ridge.length; i++) {
      ctx.lineTo(ridge[i].x, hy - ridge[i].h)
      if (i < ridge.length - 1) {
        const nx = (ridge[i].x + ridge[i + 1].x) / 2
        ctx.lineTo(nx, hy - Math.min(ridge[i].h, ridge[i + 1].h) * 0.3)
      }
    }
    ctx.lineTo(W, hy)
    ctx.closePath()
    ctx.fillStyle = RIDGE_FILL
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 47, 160, 0.65)'
    ctx.lineWidth = 1.5
    if (!mobile) {
      ctx.shadowColor = PINK
      ctx.shadowBlur = 8
    }
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  function drawGrid(ctx) {
    const hy = horizonY()
    const heart = heartT > 0 ? heartT / 0.12 : 0
    const brightness = 0.5 + heart * 0.6 + pulse * 0.15
    ctx.save()
    ctx.strokeStyle = PINK
    ctx.lineWidth = 1
    if (!mobile) {
      ctx.shadowColor = PINK
      ctx.shadowBlur = 6 + heart * 10
    }
    const rows = mobile ? 4 : 5
    for (let i = 0; i < rows; i++) {
      const p = ((i / rows) + gridScroll) % 1
      const y = hy + (H - hy) * p * p
      ctx.globalAlpha = (0.12 + 0.5 * p) * brightness
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    // Rails converge on the vanishing point: one cached path, one stroke.
    if (!gridRailsPath || gridRailsKey !== `${Math.round(W)}x${Math.round(H)}`) buildGridCache()
    ctx.globalAlpha = 0.35 * brightness
    ctx.beginPath()
    ctx.stroke(gridRailsPath)
    // Cyan centre rail over the middle, per the design system.
    ctx.strokeStyle = CYAN
    ctx.beginPath()
    ctx.moveTo(W / 2, hy)
    ctx.lineTo(W / 2, H)
    ctx.stroke()
    ctx.strokeStyle = PINK
    // Horizon line, brightest.
    ctx.globalAlpha = 0.8
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, hy)
    ctx.lineTo(W, hy)
    ctx.stroke()
    ctx.restore()
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }

  function draw(ctx, now, opts2) {
    if (!ctx || W <= 0 || H <= 0) return
    const dim = !!(opts2 && opts2.dim)
    if (!skyGrad || skyGradH !== H) buildGradCache(ctx)

    // Sky.
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, W, H)

    // Stars: sparse, twinkling, above the horizon (quantized alpha).
    ctx.fillStyle = STAR
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i]
      const tw = 0.5 + 0.5 * Math.sin(now * s.sp + s.ph)
      ctx.globalAlpha = Math.round(s.b * (0.35 + 0.65 * tw) * 4) / 4
      ctx.fillRect(s.x, s.y, 1.5, 1.5)
    }
    ctx.globalAlpha = 1

    drawSun(ctx, dim)
    drawMountains(ctx)
    drawGrid(ctx)

    if (dim) {
      // Idle: gameplay sits behind the profile card, so wash the ground.
      ctx.fillStyle = 'rgba(11,6,22,.55)'
      ctx.fillRect(0, 0, W, H)
      return
    }
    // Heartbeat: the whole background pulses subtly on each beat.
    if (pulse > 0.01) {
      ctx.fillStyle = `rgba(255, 47, 160, ${0.05 * pulse})`
      ctx.fillRect(0, 0, W, H)
    }
  }

  return { resize, update, beat, draw }
}
