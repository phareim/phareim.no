<template>
  <canvas ref="canvas" class="space-starfield-canvas" />
</template>

<script setup lang="ts">
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let stars: Array<{ x: number; y: number; size: number; speed: number; opacity: number; color: number[] }> = []
let animationId: number | null = null

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
    })
  }
}

function draw() {
  if (!ctx || !canvas.value) return
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  for (const star of stars) {
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${star.color[0]}, ${star.color[1]}, ${star.color[2]}, ${star.opacity})`
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
  resize()
  initStars()
}

onMounted(() => {
  if (!canvas.value) return
  ctx = canvas.value.getContext('2d')
  window.addEventListener('resize', onResize)
  resize()
  initStars()
  draw()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
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
