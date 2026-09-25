<template>
  <!-- The pilot's painting, shrunk to a sprite: drawn into a small canvas
       (centre crop) and shown scaled up with hard pixels. Pixels are never
       read back, so a cross-origin image may taint the canvas. -->
  <canvas ref="canvas" class="hg-portrait" :width="size" :height="size" aria-hidden="true" />
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ src: string | null, size?: number }>(), { size: 32 })

const canvas = ref<HTMLCanvasElement | null>(null)
let token = 0

function paint(): void {
  const c = canvas.value
  if (!c) return
  const g = c.getContext('2d')
  if (!g) return
  const n = props.size
  g.imageSmoothingEnabled = true
  g.fillStyle = '#1c1030'
  g.fillRect(0, 0, n, n)
  if (!props.src) {
    // No painting yet: a faint dithered checker where the face will be.
    g.fillStyle = '#2a1a4c'
    for (let y = 0; y < n; y++) for (let x = (y % 2); x < n; x += 2) g.fillRect(x, y, 1, 1)
    return
  }
  const my = ++token
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    if (my !== token) return
    const s = Math.min(img.naturalWidth, img.naturalHeight)
    const sx = (img.naturalWidth - s) / 2
    const sy = (img.naturalHeight - s) / 2
    // High-quality downscale first, then hard pixels on screen.
    g.imageSmoothingQuality = 'high'
    g.drawImage(img, sx, sy, s, s, 0, 0, n, n)
  }
  img.src = props.src
}

onMounted(paint)
watch(() => [props.src, props.size], paint)
</script>

<style scoped>
.hg-portrait {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}
</style>
