<template>
  <canvas ref="canvas" class="space-starfield-canvas" />
</template>

<script setup lang="ts">
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let stars: Array<{ x: number; y: number; size: number; speed: number; opacity: number; color: number[]; rgbStr: string }> = []
let animationId: number | null = null

// Gyroscope parallax state
let gyroOffsetX = 0
let gyroOffsetY = 0
let targetGyroX = 0
let targetGyroY = 0
const GYRO_SENSITIVITY = 1.5
const GYRO_SMOOTHING = 0.08

const NUM_STARS = 300

const STAR_COLORS = [
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
    })
  }
}

function draw() {
  if (!ctx || !canvas.value) return
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  // Smooth gyro values toward target
  gyroOffsetX += (targetGyroX - gyroOffsetX) * GYRO_SMOOTHING
  gyroOffsetY += (targetGyroY - gyroOffsetY) * GYRO_SMOOTHING

  for (const star of stars) {
    // Parallax: bigger stars (closer) shift more
    const depth = star.size / 2.0
    const px = star.x + gyroOffsetX * depth
    const py = star.y + gyroOffsetY * depth
    ctx.beginPath()
    ctx.arc(px, py, star.size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${star.rgbStr}, ${star.opacity})`
    ctx.fill()

    star.x -= star.speed
    if (star.x < -2) {
      star.x = canvas.value!.width + 2
      star.y = Math.random() * canvas.value!.height
      star.opacity = Math.random() * 0.7 + 0.3
      star.speed = Math.random() * 1.5 + 0.3
    }
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
