/**
 * OutRun cars, drawn in code from behind. Every function takes the canvas
 * context and draws with the bottom centre of the car at (x, y), `w` pixels
 * wide. `panel` (-1..1) turns the car: the flank on that side comes into
 * view and the upper body slides towards it, which is all a rear view needs
 * to read as a turn.
 */
import { CYAN, PINK, GOLD, INK_MUTED, mix, rgba } from './color'

export interface TrafficOpts {
  kind: string
  paint: number
  panel: number
  glow: boolean
}

const TRAFFIC_PAINT = [
  { body: '#2a1450', hi: '#51308f' },
  { body: '#0f3a4a', hi: '#1e6a80' },
  { body: '#4a0f2a', hi: '#8a2350' },
  { body: '#24243a', hi: '#4a4a70' },
]

/** The flank on the turn side, with the front wheel peeking out. */
function flank(ctx: CanvasRenderingContext2D, w: number, h: number, pn: number, body: string, trim: string, lowY = -0.06, highY = -0.64) {
  if (Math.abs(pn) <= 0.04) return
  const sd = Math.sign(pn)
  const a = Math.abs(pn)
  const ex = sd * (w * 0.5 + w * 0.32 * a)
  const p = new Path2D()
  // Receding into the distance, the far end sits lower and shorter.
  p.moveTo(sd * w * 0.49, h * lowY)
  p.lineTo(sd * w * 0.47, h * highY)
  p.lineTo(ex * 0.97, h * highY * 0.81)
  p.lineTo(ex, h * lowY * 2.3)
  p.closePath()
  ctx.fillStyle = mix(body, '#000000', 0.45)
  ctx.fill(p)
  ctx.strokeStyle = rgba(trim, 0.22)
  ctx.lineWidth = Math.max(0.6, w * 0.006)
  ctx.stroke(p)
  ctx.fillStyle = '#05030c'
  const fw = w * 0.12 * a + w * 0.02
  ctx.fillRect(ex - sd * fw * 1.4 - fw / 2, -h * 0.28, fw, h * 0.26)
}

/** Traffic: sedan, truck, bug and coupe. */
export function drawTraffic(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, o: TrafficOpts) {
  const paint = TRAFFIC_PAINT[o.paint % TRAFFIC_PAINT.length]
  const body = o.kind === 'truck' ? '#2e2a44' : paint.body
  const hi = o.kind === 'truck' ? '#4c4670' : paint.hi
  const trim = PINK
  const hRatio = o.kind === 'truck' ? 0.95 : o.kind === 'bug' ? 0.62 : o.kind === 'sedan' ? 0.5 : 0.4
  const h = w * hRatio
  const pn = o.panel
  ctx.save()
  ctx.translate(x, y)

  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.beginPath()
  ctx.ellipse(0, -h * 0.02, w * 0.58, h * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
  if (o.glow && o.kind !== 'truck') {
    // Taillights mirrored in the wet road: two soft streaks under the lamps.
    ctx.globalCompositeOperation = 'lighter'
    for (const side of [-1, 1]) {
      const rg = ctx.createLinearGradient(0, 0, 0, h * 0.35)
      rg.addColorStop(0, rgba(PINK, 0.14))
      rg.addColorStop(1, rgba(PINK, 0))
      ctx.fillStyle = rg
      ctx.beginPath()
      ctx.ellipse(side * w * 0.33, 0, w * 0.1, h * 0.35, 0, 0, Math.PI)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }
  flank(ctx, w, h, pn, body, trim)

  ctx.fillStyle = '#05030c'
  const tw = w * 0.14
  const th = h * (o.kind === 'truck' ? 0.16 : 0.34)
  ctx.fillRect(-w * 0.49, -th, tw, th)
  ctx.fillRect(w * 0.49 - tw, -th, tw, th)

  const shift = pn * w * 0.05
  if (o.kind === 'truck') {
    ctx.fillStyle = body
    ctx.fillRect(-w * 0.5, -h, w, h * 0.88)
    ctx.strokeStyle = rgba(trim, 0.6)
    ctx.lineWidth = Math.max(0.6, w * 0.008)
    ctx.strokeRect(-w * 0.5, -h, w, h * 0.88)
    ctx.beginPath()
    ctx.moveTo(0, -h)
    ctx.lineTo(0, -h * 0.12)
    ctx.stroke()
    ctx.fillStyle = PINK
    ctx.fillRect(-w * 0.46, -h * 0.22, w * 0.1, h * 0.06)
    ctx.fillRect(w * 0.36, -h * 0.22, w * 0.1, h * 0.06)
    ctx.fillStyle = rgba(GOLD, 0.8)
    ctx.fillRect(-w * 0.4, -h * 0.97, w * 0.8, h * 0.02)
    ctx.restore()
    return
  }
  const lowTop = -h * 0.55
  const lb = new Path2D()
  lb.moveTo(-w * 0.5, -h * 0.08)
  lb.lineTo(-w * 0.49, lowTop)
  lb.lineTo(w * 0.49, lowTop)
  lb.lineTo(w * 0.5, -h * 0.08)
  lb.closePath()
  const bg = ctx.createLinearGradient(0, lowTop, 0, 0)
  bg.addColorStop(0, hi)
  bg.addColorStop(1, body)
  ctx.fillStyle = bg
  ctx.fill(lb)
  const deckTop = o.kind === 'bug' ? -h * 0.72 : -h * 0.66
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(-w * 0.49, lowTop)
  ctx.lineTo(-w * 0.44 + shift, deckTop)
  ctx.lineTo(w * 0.44 + shift, deckTop)
  ctx.lineTo(w * 0.49, lowTop)
  ctx.closePath()
  ctx.fill()
  const cabW = o.kind === 'bug' ? 0.34 : 0.32
  const cab = new Path2D()
  if (o.kind === 'bug') {
    cab.moveTo(-w * cabW + shift, deckTop)
    cab.bezierCurveTo(-w * cabW + shift, -h * 1.05, w * cabW + shift, -h * 1.05, w * cabW + shift, deckTop)
  } else {
    cab.moveTo(-w * cabW + shift * 1.3, deckTop)
    cab.lineTo(-w * (cabW - 0.08) + shift * 1.6, -h)
    cab.lineTo(w * (cabW - 0.08) + shift * 1.6, -h)
    cab.lineTo(w * cabW + shift * 1.3, deckTop)
  }
  cab.closePath()
  ctx.fillStyle = mix(body, '#000000', 0.15)
  ctx.fill(cab)
  if (w > 24) {
    // Rear glass, inset, with the sky mirrored in it.
    const gl = new Path2D()
    const inset = w * 0.035
    const gTop = deckTop + (-h - deckTop) * 0.82
    if (o.kind === 'bug') {
      gl.moveTo(-w * (cabW - 0.07) + shift, deckTop - h * 0.04)
      gl.bezierCurveTo(-w * (cabW - 0.08) + shift, -h * 0.95, w * (cabW - 0.08) + shift, -h * 0.95, w * (cabW - 0.07) + shift, deckTop - h * 0.04)
    } else {
      gl.moveTo(-w * cabW + inset + shift * 1.3, deckTop - h * 0.03)
      gl.lineTo(-w * (cabW - 0.08) + inset * 0.8 + shift * 1.55, gTop)
      gl.lineTo(w * (cabW - 0.08) - inset * 0.8 + shift * 1.55, gTop)
      gl.lineTo(w * cabW - inset + shift * 1.3, deckTop - h * 0.03)
    }
    gl.closePath()
    const gg = ctx.createLinearGradient(0, gTop, 0, deckTop)
    gg.addColorStop(0, '#2a1640')
    gg.addColorStop(0.6, '#6a2050')
    gg.addColorStop(1, '#1a0a26')
    ctx.fillStyle = gg
    ctx.fill(gl)
    ctx.strokeStyle = rgba(INK_MUTED, 0.3)
    ctx.lineWidth = Math.max(0.6, w * 0.005)
    ctx.stroke(gl)
  }
  ctx.fillStyle = trim
  ctx.fillRect(-w * 0.47, lowTop - h * 0.02, w * 0.94, Math.max(1, h * 0.025))
  if (o.kind === 'coupe') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    for (let i = 0; i < 4; i++) ctx.fillRect(-w * 0.3, -h * (0.48 - i * 0.07), w * 0.6, Math.max(1, h * 0.028))
  }
  const lightY = -h * 0.44
  const lightH = h * 0.1
  if (o.glow) {
    ctx.shadowColor = PINK
    ctx.shadowBlur = w * 0.06
  }
  ctx.fillStyle = PINK
  if (o.kind === 'bug') {
    ctx.beginPath()
    ctx.ellipse(-w * 0.34, lightY + lightH / 2, w * 0.06, lightH * 0.7, 0, 0, Math.PI * 2)
    ctx.ellipse(w * 0.34, lightY + lightH / 2, w * 0.06, lightH * 0.7, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillRect(-w * 0.46, lightY, w * 0.26, lightH)
    ctx.fillRect(w * 0.2, lightY, w * 0.26, lightH)
  }
  ctx.shadowBlur = 0
  ctx.fillStyle = '#d8d0e8'
  ctx.fillRect(-w * 0.07, -h * 0.3, w * 0.14, h * 0.08)
  ctx.fillStyle = '#05030c'
  ctx.fillRect(-w * 0.44, -h * 0.13, w * 0.88, h * 0.05)
  ctx.restore()
}

export interface PlayerOpts {
  panel: number
  brake: boolean
  roll: number
  /** Sideways lean of the two heads (-1..1): the curve pushing them outward. */
  lean: number
  /** Seconds, for the hair in the wind; and speed 0..1 for how hard it blows. */
  now: number
  speed: number
  reduced: boolean
  /** 0..1 flicker of the exhaust flames (a backfire). */
  flame: number
  /** Light falling on the car: 1 in the open, lower in a tunnel. */
  light: number
}

const BODY = '#c4126f'
const BODY_HI = '#ff4fa8'
const BODY_LO = '#4a0630'

/**
 * The player's car: the Testarossa Spider in Neon Dreams paint. Wide hips,
 * the slatted rear panel with the taillights glowing through it, the top
 * down, the driver on the left and a passenger whose gold hair streams in
 * the wind.
 */
export function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, o: PlayerOpts) {
  const pn = o.panel
  const up = pn * w * 0.045
  ctx.save()
  ctx.translate(x, y)
  if (o.roll) {
    ctx.translate(0, -w * 0.18)
    ctx.rotate(o.roll)
    ctx.translate(0, w * 0.18)
  }

  // Shadow, and the lamps mirrored in the wet road.
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.beginPath()
  ctx.ellipse(0, -w * 0.008, w * 0.6, w * 0.045, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'lighter'
  for (const side of [-1, 1]) {
    const rg = ctx.createLinearGradient(0, 0, 0, w * 0.16)
    rg.addColorStop(0, rgba(PINK, o.brake ? 0.4 : 0.18))
    rg.addColorStop(1, rgba(PINK, 0))
    ctx.fillStyle = rg
    ctx.beginPath()
    ctx.ellipse(side * w * 0.31, 0, w * 0.09, w * 0.16, 0, 0, Math.PI)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  flank(ctx, w, w * 0.3, pn, BODY, CYAN, -0.2, -1)

  // Windscreen frame, seen from behind: the glass barely there.
  const ws = new Path2D()
  ws.moveTo(-w * 0.37 + up, -w * 0.31)
  ws.lineTo(-w * 0.31 + up * 1.8, -w * 0.47)
  ws.lineTo(w * 0.31 + up * 1.8, -w * 0.47)
  ws.lineTo(w * 0.37 + up, -w * 0.31)
  ctx.fillStyle = rgba(CYAN, 0.07)
  ctx.fill(ws)
  ctx.strokeStyle = '#1a0a24'
  ctx.lineWidth = Math.max(1.5, w * 0.018)
  ctx.lineJoin = 'round'
  ctx.stroke(ws)
  ctx.strokeStyle = rgba(CYAN, 0.55)
  ctx.lineWidth = Math.max(0.6, w * 0.004)
  ctx.beginPath()
  ctx.moveTo(-w * 0.3 + up * 1.8, -w * 0.475)
  ctx.lineTo(w * 0.3 + up * 1.8, -w * 0.475)
  ctx.stroke()
  // Mirrors on stalks at the foot of the pillars.
  for (const sd of [-1, 1]) {
    const mx = sd * w * 0.43 + up * 1.2
    ctx.fillStyle = '#1a0a24'
    ctx.fillRect(mx - sd * w * 0.04, -w * 0.345, sd * w * 0.04, w * 0.012)
    ctx.fillStyle = BODY
    ctx.beginPath()
    ctx.ellipse(mx, -w * 0.35, w * 0.032, w * 0.02, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = rgba(CYAN, 0.6)
    ctx.lineWidth = Math.max(0.5, w * 0.004)
    ctx.stroke()
  }

  // The cockpit tub and the two seats.
  ctx.fillStyle = '#12061a'
  ctx.beginPath()
  ctx.moveTo(-w * 0.34 + up, -w * 0.29)
  ctx.lineTo(-w * 0.3 + up * 1.2, -w * 0.345)
  ctx.lineTo(w * 0.3 + up * 1.2, -w * 0.345)
  ctx.lineTo(w * 0.34 + up, -w * 0.29)
  ctx.closePath()
  ctx.fill()
  const lean = o.lean * w * 0.02
  const blow = o.reduced ? 0.3 : o.speed
  const t = o.now
  for (const sd of [-1, 1]) {
    const hx = sd * w * 0.15 + up * 1.4
    ctx.fillStyle = '#2a0d34'
    roundRect(ctx, hx - w * 0.06, -w * 0.39, w * 0.12, w * 0.085, w * 0.04)
    ctx.fill()
    ctx.strokeStyle = rgba(PINK, 0.35)
    ctx.lineWidth = Math.max(0.5, w * 0.004)
    ctx.stroke()
  }
  // Driver, left: short dark hair, cyan rim light from the dash.
  {
    const hx = -w * 0.15 + up * 1.5 + lean
    const hy = -w * 0.455
    const r = w * 0.066
    ctx.fillStyle = '#e0a58a'
    ctx.fillRect(hx - r * 0.35, hy + r * 0.6, r * 0.7, r * 0.7)
    ctx.fillStyle = '#1a0c26'
    ctx.beginPath()
    ctx.arc(hx, hy, r, 0, Math.PI * 2)
    ctx.fill()
    // A few locks lifting at speed.
    ctx.beginPath()
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI * (0.25 + i * 0.25)
      const flick = Math.sin(t * 17 + i * 2) * blow
      ctx.moveTo(hx + Math.cos(a) * r * 0.8, hy + Math.sin(a) * r * 0.8)
      ctx.lineTo(hx + Math.cos(a) * r * (1.2 + 0.25 * flick), hy + Math.sin(a) * r * (1.1 + 0.3 * blow))
    }
    ctx.strokeStyle = '#1a0c26'
    ctx.lineWidth = Math.max(1, r * 0.35)
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.strokeStyle = rgba(CYAN, 0.6)
    ctx.lineWidth = Math.max(0.6, r * 0.12)
    ctx.beginPath()
    ctx.arc(hx, hy, r * 0.96, Math.PI * 1.05, Math.PI * 1.55)
    ctx.stroke()
  }
  // Passenger, right: long gold hair streaming back and out in the wind.
  {
    const hx = w * 0.15 + up * 1.5 + lean
    const hy = -w * 0.45
    const r = w * 0.061
    const hair = new Path2D()
    const reach = r * (1.6 + 2.2 * blow)
    hair.moveTo(hx - r, hy)
    hair.arc(hx, hy, r * 1.02, Math.PI, Math.PI * 2)
    // Out to the right and down over the seat, a wave running along it.
    const n = 5
    for (let i = 0; i <= n; i++) {
      const k = i / n
      const wave = o.reduced ? 0 : Math.sin(t * 14 - k * 5) * r * 0.35 * blow * k
      hair.lineTo(hx + r + reach * k, hy + r * 0.2 + k * r * 0.9 + wave)
    }
    for (let i = n; i >= 0; i--) {
      const k = i / n
      const wave = o.reduced ? 0 : Math.sin(t * 14 - k * 5 + 0.8) * r * 0.4 * blow * k
      hair.lineTo(hx + r * 0.2 + reach * 0.9 * k, hy + r * 1.3 + k * r * 0.7 + wave)
    }
    hair.lineTo(hx - r * 0.9, hy + r * 0.9)
    hair.closePath()
    ctx.fillStyle = mix(GOLD, '#b06a18', 0.25)
    ctx.fill(hair)
    ctx.strokeStyle = rgba(GOLD, 0.9)
    ctx.lineWidth = Math.max(0.6, r * 0.1)
    ctx.stroke(hair)
    // A strand or two flying loose.
    if (!o.reduced && blow > 0.3) {
      ctx.beginPath()
      for (let j = 0; j < 2; j++) {
        const sy = hy + r * (0.4 + j * 0.5)
        ctx.moveTo(hx + r * 0.8, sy)
        ctx.quadraticCurveTo(hx + reach * 0.7, sy - r * 0.6 + Math.sin(t * 19 + j) * r * 0.4, hx + reach * 1.15, sy + Math.sin(t * 23 + j * 2) * r * 0.5)
      }
      ctx.strokeStyle = rgba(GOLD, 0.7)
      ctx.lineWidth = Math.max(0.5, r * 0.08)
      ctx.stroke()
    }
  }

  // Body: wide hips, the engine deck dipping between them.
  const bodyP = new Path2D()
  bodyP.moveTo(-w * 0.5, -w * 0.055)
  bodyP.lineTo(-w * 0.515, -w * 0.2)
  bodyP.quadraticCurveTo(-w * 0.52, -w * 0.3, -w * 0.43, -w * 0.315)
  bodyP.quadraticCurveTo(-w * 0.36, -w * 0.3, -w * 0.3 + up * 0.5, -w * 0.29)
  bodyP.lineTo(w * 0.3 + up * 0.5, -w * 0.29)
  bodyP.quadraticCurveTo(w * 0.36, -w * 0.3, w * 0.43, -w * 0.315)
  bodyP.quadraticCurveTo(w * 0.52, -w * 0.3, w * 0.515, -w * 0.2)
  bodyP.lineTo(w * 0.5, -w * 0.055)
  bodyP.closePath()
  const bg = ctx.createLinearGradient(0, -w * 0.32, 0, -w * 0.05)
  bg.addColorStop(0, mix(BODY_HI, '#000000', 1 - o.light))
  bg.addColorStop(0.3, mix(BODY, '#000000', (1 - o.light) * 0.8))
  bg.addColorStop(1, BODY_LO)
  ctx.fillStyle = bg
  ctx.fill(bodyP)
  // Chrome line along the hips.
  ctx.strokeStyle = rgba(CYAN, 0.75)
  ctx.lineWidth = Math.max(0.8, w * 0.005)
  ctx.beginPath()
  ctx.moveTo(-w * 0.5, -w * 0.23)
  ctx.quadraticCurveTo(-w * 0.5, -w * 0.3, -w * 0.43, -w * 0.31)
  ctx.moveTo(w * 0.5, -w * 0.23)
  ctx.quadraticCurveTo(w * 0.5, -w * 0.3, w * 0.43, -w * 0.31)
  ctx.stroke()

  // Tyres below the bumper.
  ctx.fillStyle = '#05030c'
  ctx.fillRect(-w * 0.49, -w * 0.075, w * 0.16, w * 0.075)
  ctx.fillRect(w * 0.33, -w * 0.075, w * 0.16, w * 0.075)

  // The slatted rear panel with the lamps behind it.
  const gx = w * 0.45
  const gt = -w * 0.25
  const gb = -w * 0.115
  ctx.fillStyle = '#14041a'
  ctx.fillRect(-gx, gt, gx * 2, gb - gt)
  if (o.brake) {
    ctx.shadowColor = '#ff5f9f'
    ctx.shadowBlur = w * 0.09
  } else {
    ctx.shadowColor = PINK
    ctx.shadowBlur = w * 0.04
  }
  ctx.fillStyle = o.brake ? '#ffd0e8' : PINK
  ctx.fillRect(-gx + w * 0.02, gt + w * 0.02, w * 0.25, gb - gt - w * 0.04)
  ctx.fillRect(gx - w * 0.27, gt + w * 0.02, w * 0.25, gb - gt - w * 0.04)
  ctx.shadowBlur = 0
  if (o.brake) {
    ctx.fillStyle = rgba(PINK, 0.8)
    ctx.fillRect(-gx + w * 0.04, gt + w * 0.04, w * 0.21, gb - gt - w * 0.08)
    ctx.fillRect(gx - w * 0.25, gt + w * 0.04, w * 0.21, gb - gt - w * 0.08)
  }
  // Slats across the whole panel, lamps and all.
  ctx.fillStyle = mix(BODY_LO, '#000000', 0.3)
  const slats = 6
  for (let i = 0; i <= slats; i++) {
    const sy = gt + (gb - gt) * (i / slats)
    ctx.fillRect(-gx, sy - w * 0.005, gx * 2, Math.max(1, w * 0.01))
  }
  ctx.fillStyle = rgba(CYAN, 0.8)
  ctx.fillRect(-w * 0.05, gt + (gb - gt) * 0.35, w * 0.1, (gb - gt) * 0.3)

  // Bumper, plate, diffuser and the four pipes.
  ctx.fillStyle = mix(BODY, '#000000', 0.35)
  ctx.fillRect(-w * 0.47, gb, w * 0.94, w * 0.03)
  ctx.fillStyle = GOLD
  ctx.fillRect(-w * 0.075, gb + w * 0.005, w * 0.15, w * 0.035)
  ctx.fillStyle = '#1a0a24'
  ctx.font = `bold ${Math.max(6, Math.round(w * 0.024))}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (w > 120) ctx.fillText('NEON 86', 0, gb + w * 0.023)
  ctx.fillStyle = '#0a0410'
  ctx.fillRect(-w * 0.4, -w * 0.07, w * 0.8, w * 0.02)
  const pipes = [-0.3, -0.24, 0.24, 0.3]
  for (const px of pipes) {
    ctx.fillStyle = '#4a4458'
    ctx.beginPath()
    ctx.arc(px * w, -w * 0.062, w * 0.02, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = o.flame > 0 ? GOLD : '#0a0410'
    ctx.beginPath()
    ctx.arc(px * w, -w * 0.062, w * 0.012, 0, Math.PI * 2)
    ctx.fill()
  }
  // Backfire: a gold-to-pink blossom at each pair of pipes.
  if (o.flame > 0) {
    ctx.globalCompositeOperation = 'lighter'
    for (const sd of [-1, 1]) {
      const fx = sd * w * 0.27
      const fy = -w * 0.055
      const fr = w * (0.05 + 0.07 * o.flame) * (o.reduced ? 1 : 0.8 + Math.random() * 0.4)
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr)
      g.addColorStop(0, 'rgba(255,255,230,0.95)')
      g.addColorStop(0.3, rgba(GOLD, 0.8))
      g.addColorStop(0.7, rgba(PINK, 0.45))
      g.addColorStop(1, rgba(PINK, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(fx, fy, fr, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
