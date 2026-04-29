<template>
  <canvas ref="canvas" class="space-starfield-canvas" aria-hidden="true" />
</template>

<script setup lang="ts">
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let stars: Star[] = []
let shootingStars: ShootingStar[] = []
let nebulas: Nebula[] = []
let constellations: Constellation[] = []
let warpBursts: WarpBurst[] = []
let animationId: number | null = null
let frame = 0

// Mouse parallax state (desktop)
let mouseParallaxX = 0
let mouseParallaxY = 0
let targetMouseX = 0
let targetMouseY = 0
const MOUSE_SENSITIVITY = 18
const MOUSE_SMOOTHING = 0.05

// Gyroscope parallax state (mobile)
let gyroOffsetX = 0
let gyroOffsetY = 0
let targetGyroX = 0
let targetGyroY = 0
const GYRO_SENSITIVITY = 1.5
const GYRO_SMOOTHING = 0.08

const NUM_STARS = 300
const NUM_NEBULAS = 5
const NUM_CONSTELLATIONS = 4

// Nebula colors: cool space palette (r, g, b)
const NEBULA_COLORS: number[][] = [
  [89, 107, 176],   // blue
  [100, 70, 150],   // violet
  [60, 110, 160],   // teal-blue
  [140, 80, 110],   // rose
  [60, 140, 130],   // cyan-teal
]

// Shooting stars spawn roughly every N frames, with some randomness
const SHOOTING_INTERVAL_MIN = 240
const SHOOTING_INTERVAL_MAX = 500
let nextShootingFrame = 300

const STAR_COLORS: number[][] = [
  [255, 255, 255],
  [255, 255, 255],
  [255, 255, 255],
  [200, 220, 255],
  [200, 220, 255],
  [180, 200, 255],
  [255, 230, 180],
  [255, 200, 150],
  [255, 180, 180],
  [220, 200, 255],
]

// Constellation shape definitions (relative x/y offsets + edge pairs)
// Coordinates are in pixels relative to the constellation's origin
const CONSTELLATION_SHAPES: Array<{
  stars: Array<{ rx: number; ry: number; size: number; brightness: number }>
  edges: [number, number][]
}> = [
  {
    // Orion's Belt — three stars in a diagonal line with shoulder/knee extensions
    stars: [
      { rx: 0,    ry: 0,   size: 2.2, brightness: 0.9 }, // Alnitak
      { rx: 28,   ry: -12, size: 2.0, brightness: 0.85 }, // Alnilam
      { rx: 58,   ry: -22, size: 2.2, brightness: 0.9 }, // Mintaka
      { rx: -22,  ry: -50, size: 1.6, brightness: 0.7 }, // left shoulder
      { rx: 80,   ry: -66, size: 1.8, brightness: 0.75 }, // right shoulder
      { rx: -8,   ry: 55,  size: 1.5, brightness: 0.65 }, // left foot
      { rx: 68,   ry: 50,  size: 1.6, brightness: 0.7 }, // right foot
    ],
    edges: [[0,1],[1,2],[3,0],[2,4],[0,5],[2,6]],
  },
  {
    // Dipper — ladle shape with 4-star bowl and 3-star handle
    stars: [
      { rx: 0,   ry: 0,   size: 1.8, brightness: 0.8 },
      { rx: 30,  ry: -5,  size: 1.6, brightness: 0.75 },
      { rx: 32,  ry: 30,  size: 1.8, brightness: 0.8 },
      { rx: 0,   ry: 33,  size: 1.7, brightness: 0.78 },
      { rx: -32, ry: 20,  size: 1.5, brightness: 0.7 },
      { rx: -60, ry: 5,   size: 1.6, brightness: 0.72 },
      { rx: -88, ry: -14, size: 1.7, brightness: 0.75 },
    ],
    edges: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]],
  },
  {
    // Cassiopeia — W / M shape
    stars: [
      { rx: 0,   ry: 0,   size: 1.8, brightness: 0.8 },
      { rx: 22,  ry: -28, size: 2.0, brightness: 0.85 },
      { rx: 44,  ry: -8,  size: 1.7, brightness: 0.75 },
      { rx: 66,  ry: -32, size: 1.9, brightness: 0.82 },
      { rx: 88,  ry: -4,  size: 1.6, brightness: 0.72 },
    ],
    edges: [[0,1],[1,2],[2,3],[3,4]],
  },
  {
    // Southern Cross — compact cross shape
    stars: [
      { rx: 0,   ry: 0,   size: 2.2, brightness: 0.9 }, // top
      { rx: 0,   ry: 40,  size: 2.0, brightness: 0.85 }, // bottom
      { rx: -20, ry: 20,  size: 1.8, brightness: 0.8 }, // left
      { rx: 20,  ry: 20,  size: 2.0, brightness: 0.85 }, // right
      { rx: -14, ry: 10,  size: 1.4, brightness: 0.65 }, // small fifth star
    ],
    edges: [[0,1],[2,3],[0,2],[0,3],[1,2],[1,3]],
  },
]

interface Star {
  x: number
  y: number
  size: number
  speed: number
  opacity: number
  color: number[]
  rgbStr: string
  twinklePhase: number
  twinkleSpeed: number
}

interface ShootingStar {
  x: number
  y: number
  vx: number
  vy: number
  tailLength: number
  opacity: number
  life: number
  decay: number
}

interface Nebula {
  x: number
  y: number
  radius: number
  color: number[]
  opacity: number
  speed: number
  parallaxDepth: number
}

interface ConstellationStar {
  rx: number    // relative x from origin
  ry: number    // relative y from origin
  size: number
  brightness: number
  twinklePhase: number
  twinkleSpeed: number
}

interface Constellation {
  x: number            // origin x (drifts leftward)
  y: number            // origin y
  speed: number        // horizontal drift (very slow)
  opacity: number      // overall fade (for distant constellations)
  stars: ConstellationStar[]
  edges: [number, number][]
  parallaxDepth: number
}

interface WarpBurst {
  x: number
  y: number
  radius: number
  maxRadius: number
  speed: number
  opacity: number
  decay: number
}

function resize() {
  if (!canvas.value) return
  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight
}

function initStars() {
  if (!canvas.value) return
  stars = []
  for (let i = 0; i < NUM_STARS; i++) {
    const color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
    stars.push({
      x: Math.random() * canvas.value.width,
      y: Math.random() * canvas.value.height,
      size: Math.random() * 1.8 + 0.2,
      speed: Math.random() * 1.5 + 0.3,
      opacity: Math.random() * 0.7 + 0.3,
      color,
      rgbStr: `${color[0]}, ${color[1]}, ${color[2]}`,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
    })
  }
}

function initNebulas() {
  if (!canvas.value) return
  nebulas = []
  for (let i = 0; i < NUM_NEBULAS; i++) {
    const color = NEBULA_COLORS[i % NEBULA_COLORS.length]
    nebulas.push({
      x: Math.random() * canvas.value.width,
      y: Math.random() * canvas.value.height,
      radius: Math.random() * 220 + 120,
      color,
      opacity: Math.random() * 0.07 + 0.03,
      speed: Math.random() * 0.08 + 0.03,
      parallaxDepth: Math.random() * 0.3 + 0.1,
    })
  }
}

function initConstellations() {
  if (!canvas.value) return
  constellations = []
  const w = canvas.value.width
  const h = canvas.value.height
  for (let i = 0; i < NUM_CONSTELLATIONS; i++) {
    const shape = CONSTELLATION_SHAPES[i % CONSTELLATION_SHAPES.length]
    constellations.push({
      x: Math.random() * w,
      y: Math.random() * h * 0.85 + h * 0.05,
      speed: Math.random() * 0.12 + 0.04,  // drifts much slower than regular stars
      opacity: Math.random() * 0.35 + 0.25, // subtle — should not overpower the starfield
      stars: shape.stars.map(s => ({
        ...s,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.015 + 0.004,
      })),
      edges: shape.edges,
      parallaxDepth: Math.random() * 0.15 + 0.05,
    })
  }
}

function drawNebulas() {
  if (!ctx || !canvas.value) return
  for (const nebula of nebulas) {
    const px = nebula.x + (gyroOffsetX + mouseParallaxX) * nebula.parallaxDepth
    const py = nebula.y + (gyroOffsetY + mouseParallaxY) * nebula.parallaxDepth

    const [r, g, b] = nebula.color
    const grad = ctx.createRadialGradient(px, py, 0, px, py, nebula.radius)
    grad.addColorStop(0,   `rgba(${r},${g},${b},${nebula.opacity})`)
    grad.addColorStop(0.4, `rgba(${r},${g},${b},${nebula.opacity * 0.5})`)
    grad.addColorStop(1,   `rgba(${r},${g},${b},0)`)

    ctx.beginPath()
    ctx.arc(px, py, nebula.radius, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()

    nebula.x -= nebula.speed
    if (nebula.x + nebula.radius < 0) {
      nebula.x = canvas.value.width + nebula.radius
      nebula.y = Math.random() * canvas.value.height
    }
  }
}

function drawConstellations() {
  if (!ctx || !canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height
  const px0 = (gyroOffsetX + mouseParallaxX)
  const py0 = (gyroOffsetY + mouseParallaxY)

  for (const con of constellations) {
    const ox = con.x + px0 * con.parallaxDepth
    const oy = con.y + py0 * con.parallaxDepth

    // Compute absolute star positions
    const positions = con.stars.map(s => ({
      x: ox + s.rx,
      y: oy + s.ry,
    }))

    // Draw connecting lines — very faint
    ctx.save()
    ctx.globalAlpha = con.opacity * 0.35
    ctx.strokeStyle = 'rgba(180, 210, 255, 1)'
    ctx.lineWidth = 0.6
    for (const [a, b] of con.edges) {
      const pa = positions[a]
      const pb = positions[b]
      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.stroke()
    }
    ctx.restore()

    // Draw constellation stars — slightly brighter than background stars
    for (let i = 0; i < con.stars.length; i++) {
      const s = con.stars[i]
      const pos = positions[i]
      s.twinklePhase += s.twinkleSpeed
      const twinkle = 1 + Math.sin(s.twinklePhase) * 0.2
      const alpha = Math.min(1, con.opacity * s.brightness * twinkle * 1.6)

      // Soft glow halo
      const glowR = s.size * 3.5
      const glowGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR)
      glowGrad.addColorStop(0, `rgba(200, 220, 255, ${alpha * 0.25})`)
      glowGrad.addColorStop(1, `rgba(200, 220, 255, 0)`)
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2)
      ctx.fillStyle = glowGrad
      ctx.fill()

      // Star core
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, s.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(220, 235, 255, ${alpha})`
      ctx.fill()
    }

    // Drift leftward; wrap to right edge when fully off-screen
    con.x -= con.speed
    const rightmostX = Math.max(...con.stars.map(s => s.rx))
    if (con.x + rightmostX < -20) {
      const leftmostX = Math.min(...con.stars.map(s => s.rx))
      con.x = w - leftmostX + 20
      con.y = Math.random() * h * 0.85 + h * 0.05
      con.opacity = Math.random() * 0.35 + 0.25
    }
  }
}

function triggerWarpBurst(clientX: number, clientY: number) {
  if (!canvas.value) return
  const rect = canvas.value.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  const maxR = Math.min(canvas.value.width, canvas.value.height) * 0.42
  warpBursts.push({ x, y, radius: 0, maxRadius: maxR, speed: 14 + Math.random() * 8, opacity: 0.9 + Math.random() * 0.1, decay: 0.009 + Math.random() * 0.005 })
}

function drawWarpBursts() {
  if (!ctx || warpBursts.length === 0) return
  for (let i = warpBursts.length - 1; i >= 0; i--) {
    const burst = warpBursts[i]!
    burst.radius += burst.speed
    burst.speed = Math.max(2, burst.speed * 0.97)
    burst.opacity -= burst.decay
    if (burst.opacity <= 0 || burst.radius > burst.maxRadius) {
      warpBursts.splice(i, 1)
      continue
    }
    const progress = burst.radius / burst.maxRadius

    // Outer expanding ring
    ctx.beginPath()
    ctx.arc(burst.x, burst.y, burst.radius, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(140, 200, 255, ${(burst.opacity * (1 - progress * 0.7)).toFixed(3)})`
    ctx.lineWidth = Math.max(0.5, 2 - progress * 1.5)
    ctx.stroke()

    // Secondary inner ring at half radius
    if (burst.radius > 24) {
      ctx.beginPath()
      ctx.arc(burst.x, burst.y, burst.radius * 0.5, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(200, 230, 255, ${(burst.opacity * (1 - progress) * 0.4).toFixed(3)})`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Central flash during early expansion
    if (progress < 0.18) {
      const flashAlpha = burst.opacity * (1 - progress / 0.18) * 0.65
      const flashR = burst.radius * 0.18
      const grad = ctx.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, flashR)
      grad.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha.toFixed(3)})`)
      grad.addColorStop(1, `rgba(140, 200, 255, 0)`)
      ctx.beginPath()
      ctx.arc(burst.x, burst.y, flashR, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
    }
  }
}

function spawnShootingStar() {
  if (!canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height

  const fromTop = Math.random() > 0.35
  const x = fromTop ? Math.random() * w * 0.8 : -20
  const y = fromTop ? -20 : Math.random() * h * 0.4

  const angle = (Math.random() * 0.4 + 0.15) * Math.PI
  const speed = Math.random() * 6 + 8

  shootingStars.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    tailLength: Math.random() * 80 + 60,
    opacity: Math.random() * 0.4 + 0.6,
    life: 1,
    decay: Math.random() * 0.008 + 0.006,
  })
}

function drawShootingStar(s: ShootingStar) {
  if (!ctx) return
  const alpha = s.opacity * s.life

  const tailX = s.x - (s.vx / Math.hypot(s.vx, s.vy)) * s.tailLength
  const tailY = s.y - (s.vy / Math.hypot(s.vx, s.vy)) * s.tailLength

  const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y)
  grad.addColorStop(0, `rgba(255, 255, 255, 0)`)
  grad.addColorStop(0.6, `rgba(220, 235, 255, ${alpha * 0.3})`)
  grad.addColorStop(1, `rgba(255, 255, 255, ${alpha})`)

  ctx.beginPath()
  ctx.moveTo(tailX, tailY)
  ctx.lineTo(s.x, s.y)
  ctx.strokeStyle = grad
  ctx.lineWidth = s.life * 1.5
  ctx.lineCap = 'round'
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(s.x, s.y, s.life * 2, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
  ctx.fill()
}

function draw() {
  if (!ctx || !canvas.value) return
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  gyroOffsetX += (targetGyroX - gyroOffsetX) * GYRO_SMOOTHING
  gyroOffsetY += (targetGyroY - gyroOffsetY) * GYRO_SMOOTHING
  mouseParallaxX += (targetMouseX - mouseParallaxX) * MOUSE_SMOOTHING
  mouseParallaxY += (targetMouseY - mouseParallaxY) * MOUSE_SMOOTHING

  drawNebulas()
  drawConstellations()

  for (const star of stars) {
    star.twinklePhase += star.twinkleSpeed
    const twinkle = 1 + Math.sin(star.twinklePhase) * 0.15
    const finalOpacity = Math.min(1, star.opacity * twinkle)

    const depth = star.size / 2.0
    const px = star.x + (gyroOffsetX + mouseParallaxX) * depth
    const py = star.y + (gyroOffsetY + mouseParallaxY) * depth

    ctx.beginPath()
    ctx.arc(px, py, star.size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${star.rgbStr}, ${finalOpacity})`
    ctx.fill()

    star.x -= star.speed
    if (star.x < -2) {
      star.x = canvas.value!.width + 2
      star.y = Math.random() * canvas.value!.height
      star.opacity = Math.random() * 0.7 + 0.3
      star.speed = Math.random() * 1.5 + 0.3
    }
  }

  frame++
  if (frame >= nextShootingFrame) {
    spawnShootingStar()
    nextShootingFrame = frame + Math.floor(
      Math.random() * (SHOOTING_INTERVAL_MAX - SHOOTING_INTERVAL_MIN) + SHOOTING_INTERVAL_MIN
    )
  }

  shootingStars = shootingStars.filter(s => s.life > 0)
  for (const s of shootingStars) {
    drawShootingStar(s)
    s.x += s.vx
    s.y += s.vy
    s.life -= s.decay
  }

  drawWarpBursts()

  animationId = requestAnimationFrame(draw)
}

function onResize() {
  const oldW = canvas.value?.width ?? 0
  const oldH = canvas.value?.height ?? 0
  resize()
  if (!canvas.value) return
  const newW = canvas.value.width
  const newH = canvas.value.height
  for (const star of stars) {
    star.x = star.x * newW / (oldW || newW)
    star.y = star.y * newH / (oldH || newH)
  }
  for (const con of constellations) {
    con.x = con.x * newW / (oldW || newW)
    con.y = con.y * newH / (oldH || newH)
  }
}

function onResizeStatic() {
  onResize()
  drawStatic()
}

function handleClick(e: MouseEvent) {
  triggerWarpBurst(e.clientX, e.clientY)
}

function handleTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (touch) triggerWarpBurst(touch.clientX, touch.clientY)
}

function handleMouseMove(e: MouseEvent) {
  if (!canvas.value) return
  const cx = canvas.value.width / 2
  const cy = canvas.value.height / 2
  targetMouseX = ((e.clientX - cx) / cx) * -MOUSE_SENSITIVITY
  targetMouseY = ((e.clientY - cy) / cy) * -MOUSE_SENSITIVITY
}

function handleOrientation(e: DeviceOrientationEvent) {
  if (e.gamma !== null && e.beta !== null) {
    targetGyroX = e.gamma * GYRO_SENSITIVITY
    targetGyroY = (e.beta - 45) * GYRO_SENSITIVITY
  }
}

function enableGyro() {
  const DOE = DeviceOrientationEvent as any
  if (typeof DOE !== 'undefined' && typeof DOE.requestPermission === 'function') {
    DOE.requestPermission().then((state: string) => {
      if (state === 'granted') {
        window.addEventListener('deviceorientation', handleOrientation)
      }
    }).catch(console.warn)
  } else if ('DeviceOrientationEvent' in window) {
    window.addEventListener('deviceorientation', handleOrientation)
  }
}

let gyroTapHandler: (() => void) | null = null
let reducedMotion = false

function drawStatic() {
  if (!ctx || !canvas.value) return
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
  for (const star of stars) {
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${star.rgbStr}, ${star.opacity})`
    ctx.fill()
  }
  // Draw constellations statically (no twinkle, no drift)
  for (const con of constellations) {
    const positions = con.stars.map(s => ({ x: con.x + s.rx, y: con.y + s.ry }))
    ctx.globalAlpha = con.opacity * 0.35
    ctx.strokeStyle = 'rgba(180, 210, 255, 1)'
    ctx.lineWidth = 0.6
    for (const [a, b] of con.edges) {
      ctx.beginPath()
      ctx.moveTo(positions[a].x, positions[a].y)
      ctx.lineTo(positions[b].x, positions[b].y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    for (let i = 0; i < con.stars.length; i++) {
      const s = con.stars[i]
      const pos = positions[i]
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, s.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(220, 235, 255, ${con.opacity * s.brightness * 1.4})`
      ctx.fill()
    }
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    if (animationId !== null) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  } else {
    if (animationId === null) draw()
  }
}

onMounted(() => {
  if (!canvas.value) return
  ctx = canvas.value.getContext('2d')
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  resize()
  initStars()
  initNebulas()
  initConstellations()

  if (reducedMotion) {
    drawStatic()
    window.addEventListener('resize', onResizeStatic)
    return
  }

  window.addEventListener('resize', onResize)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('click', handleClick)
  window.addEventListener('touchstart', handleTouchStart, { passive: true })
  document.addEventListener('visibilitychange', handleVisibilityChange)
  draw()

  const DOE = DeviceOrientationEvent as any
  if (typeof DOE !== 'undefined' && typeof DOE.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', handleOrientation)
  }
  gyroTapHandler = () => { enableGyro(); document.removeEventListener('click', gyroTapHandler!) }
  document.addEventListener('click', gyroTapHandler, { once: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('resize', onResizeStatic)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('click', handleClick)
  window.removeEventListener('touchstart', handleTouchStart)
  window.removeEventListener('deviceorientation', handleOrientation)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (gyroTapHandler) document.removeEventListener('click', gyroTapHandler)
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
  }
})
</script>

<style scoped>
.space-starfield-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
</style>
