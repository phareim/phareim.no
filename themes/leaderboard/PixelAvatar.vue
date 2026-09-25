<template>
  <canvas ref="canvas" class="lb-pix" :class="{ 'lb-pix--empty': !drawn }" :width="n" :height="n" aria-hidden="true" />
</template>

<script setup lang="ts">
/**
 * A pilot portrait as pixel art: the painting shrunk into an n×n canvas and
 * shown scaled up with `image-rendering: pixelated`, so it sits on the same
 * grid as the pixel font. The image may come from another origin; that only
 * taints the canvas, and nothing here reads its pixels back.
 */
const props = withDefaults(defineProps<{ src?: string | null, n?: number }>(), { src: null, n: 12 })

const canvas = ref<HTMLCanvasElement | null>(null)
const drawn = ref(false)
let token = 0

function paint(): void {
  const c = canvas.value
  if (!c) return
  const g = c.getContext('2d')
  if (!g) return
  const mine = ++token
  g.clearRect(0, 0, c.width, c.height)
  drawn.value = false
  if (!props.src) return
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    if (mine !== token || !canvas.value) return
    // Crop to a centred square, then shrink in two steps (4n, then n) so the
    // small grid averages the painting instead of sampling noise.
    const s = Math.min(img.naturalWidth, img.naturalHeight)
    const sx = (img.naturalWidth - s) / 2
    const sy = (img.naturalHeight - s) / 2
    const mid = document.createElement('canvas')
    mid.width = mid.height = props.n * 4
    const mg = mid.getContext('2d')!
    mg.imageSmoothingQuality = 'high'
    mg.drawImage(img, sx, sy, s, s, 0, 0, mid.width, mid.height)
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'high'
    g.clearRect(0, 0, c.width, c.height)
    g.drawImage(mid, 0, 0, props.n, props.n)
    drawn.value = true
  }
  img.src = props.src
}

onMounted(paint)
watch(() => [props.src, props.n], () => nextTick(paint))
</script>

<style scoped>
.lb-pix {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

/* No picture yet: a dark square with a faint pixel checker. */
.lb-pix--empty {
  background:
    conic-gradient(#1c1030 25%, #140b26 0 50%, #1c1030 0 75%, #140b26 0) 0 0 / 4px 4px;
}
</style>
