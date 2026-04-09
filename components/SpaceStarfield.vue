<template>
  <canvas ref="canvas" class="space-starfield-canvas" />
</template>

<script setup lang="ts">
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let stars: Star[] = []
let shootingStars: ShootingStar[] = []
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

interface Star {
  x: number
  y: number
  size: number
  speed: number
  opacity: number
  color: number[]
  rgbStr: string
  twinklePhase: number   // current phase in twinkle cycle
  twinkleSpeed: number   // how fast it twinkles (radians/frame)
}

interface ShootingStar {
  x: number
  y: number
  vx: number
  vy: number
  tailLength: number
  opacity: number
  life: number           // 0..1 (1 = fresh, 0 = dead)
  decay: number          // life reduction per frame
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

function spawnShootingStar() {
  if (!canvas.value) return
  const w = canvas.value.width
  const h = canvas.value.height

  // Start from top-half of screen, entering from top or left edge
  const fromTop = Math.random() > 0.35
  const x = fromTop ? Math.random() * w * 0.8 : -20
  const y = fromTop ? -20 : Math.random() * h * 0.4

  // Diagonal direction: mostly downward-right
  const angle = (Math.random() * 0.4 + 0.15) * Math.PI  // ~27°–72° from horizontal
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

  // Draw the tail as a gradient line
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

  // Draw bright head
  ctx.beginPath()
  ctx.arc(s.x, s.y, s.life * 2, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
  ctx.fill()
}

function draw() {
  if (!ctx || !canvas.value) return
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  // Smooth parallax values toward targets
  gyroOffsetX += (targetGyroX - gyroOffsetX) * GYRO_SMOOTHING
  gyroOffsetY += (targetGyroY - gyroOffsetY) * GYRO_SMOOTHING
  mouseParallaxX += (targetMouseX - mouseParallaxX) * MOUSE_SMOOTHING
  mouseParallaxY += (targetMouseY - mouseParallaxY) * MOUSE_SMOOTHING

  // Draw stars
  for (const star of stars) {
    // Twinkle: add subtle opacity oscillation
    star.twinklePhase += star.twinkleSpeed
    const twinkle = 1 + Math.sin(star.twinklePhase) * 0.15
    const finalOpacity = Math.min(1, star.opacity * twinkle)

    // Parallax: combine gyro + mouse offset; deeper stars (larger) shift more
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

  // Spawn and draw shooting stars
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
}

function handleMouseMove(e: MouseEvent) {
  if (!canvas.value) return
  const cx = canvas.value.width / 2
  const cy = canvas.value.height / 2
  // Normalize to -1..1 range then scale
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

onMounted(() => {
  if (!canvas.value) return
  ctx = canvas.value.getContext('2d')
  window.addEventListener('resize', onResize)
  window.addEventListener('mousemove', handleMouseMove)
  resize()
  initStars()
  draw()

  // Gyro: try without gesture first (Android), fall back to tap (iOS)
  const DOE = DeviceOrientationEvent as any
  if (typeof DOE !== 'undefined' && typeof DOE.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', handleOrientation)
  }
  gyroTapHandler = () => { enableGyro(); document.removeEventListener('click', gyroTapHandler!) }
  document.addEventListener('click', gyroTapHandler, { once: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('deviceorientation', handleOrientation)
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
