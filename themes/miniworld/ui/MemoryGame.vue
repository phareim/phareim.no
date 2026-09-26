<template>
  <Sheet title="HUSKESPILL" icon="star" tall flat @close="ctx.close()">
    <div class="mw-mem">
      <p class="mw-p mw-mem-top">
        <span>TREKK: {{ moves }}</span>
        <span>PAR: {{ found }} / {{ pairs }}</span>
      </p>
      <div ref="areaRef" class="mw-mem-area">
        <div
          class="mw-mem-grid"
          :style="{ gridTemplateColumns: `repeat(${fit.cols}, ${fit.size}px)`, gridAutoRows: `${fit.size}px` }"
        >
          <button
            v-for="c in cards"
            :key="c.index"
            type="button"
            class="mw-card"
            :class="{ 'mw-card--up': isUp(c.index), 'mw-card--done': matched.has(c.id) }"
            :aria-label="isUp(c.index) ? c.name : 'Kort'"
            :disabled="matched.has(c.id)"
            @click="flip(c.index)"
          >
            <span class="mw-card-inner">
              <span class="mw-card-back"><PxIcon id="star" :scale="cardIconScale" /></span>
              <span class="mw-card-face">
                <img v-if="c.pic" :src="c.pic" alt="">
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onBeforeUnmount } from 'vue'
import Sheet from './Sheet.vue'
import PxIcon from './PxIcon.vue'
import { useMw } from './context'
import { clothing, furniture } from '../catalog'
import { memoryDeck, type MemorySize } from '../core/contests'

const props = defineProps<{ pairs: MemorySize }>()
const emit = defineEmits<{ finish: [moves: number] }>()

const ctx = useMw()
const { pics } = ctx

const deck = memoryDeck(props.pairs, Math.floor(Math.random() * 1e9))
const cards = deck.map((c) => {
  const cl = c.kind === 'clothing' ? clothing(c.id) : undefined
  const fu = c.kind === 'furniture' ? furniture(c.id) : undefined
  return {
    ...c,
    name: cl?.name ?? fu?.name ?? '',
    pic: cl ? pics.clothing(cl, 128) : fu ? pics.furniture(c.id, 1, 128) : '',
  }
})

const open = ref<number[]>([])
const matched = reactive(new Set<string>())
const moves = ref(0)
const found = computed(() => matched.size)
let lock = false
let timer: ReturnType<typeof setTimeout> | undefined

const isUp = (i: number) => open.value.includes(i) || matched.has(cards[i]!.id)

ctx.setBusy(true)

function flip(i: number) {
  if (lock || isUp(i)) return
  ctx.sfx('flip')
  open.value = [...open.value, i]
  if (open.value.length < 2) return
  moves.value++
  const [a, b] = open.value as [number, number]
  if (cards[a]!.id === cards[b]!.id) {
    matched.add(cards[a]!.id)
    open.value = []
    ctx.sfx('match')
    if (matched.size === props.pairs) {
      lock = true
      timer = setTimeout(() => emit('finish', moves.value), 700)
    }
    return
  }
  lock = true
  timer = setTimeout(() => { open.value = []; lock = false }, 900)
}

// ---------------------------------------------------------------- fit the cards to the space

const areaRef = ref<HTMLElement | null>(null)
const fit = reactive({ cols: 4, size: 72 })
const GAP = 10
const cardIconScale = computed(() => (fit.size >= 90 ? 4 : fit.size >= 64 ? 3 : 2))
let ro: ResizeObserver | null = null

function layout() {
  const el = areaRef.value
  if (!el) return
  const W = el.clientWidth - 8
  const H = el.clientHeight - 8
  const n = cards.length
  let best = { cols: 4, size: 0 }
  for (let cols = 2; cols <= n; cols++) {
    const rows = Math.ceil(n / cols)
    const size = Math.floor(Math.min((W - GAP * (cols - 1)) / cols, (H - GAP * (rows - 1)) / rows))
    if (size > best.size) best = { cols, size }
  }
  fit.cols = best.cols
  fit.size = Math.max(44, Math.min(140, best.size))
}

onMounted(() => {
  layout()
  ro = new ResizeObserver(layout)
  if (areaRef.value) ro.observe(areaRef.value)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  if (timer) clearTimeout(timer)
  ctx.setBusy(false)
})
</script>

<style scoped>
.mw-mem { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.mw-mem-top { display: flex; justify-content: space-between; gap: 16px; padding: 0 8px 6px; flex: none; }
.mw-mem-area {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.mw-mem-grid { display: grid; gap: 10px; padding: 4px; }
.mw-card {
  position: relative;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  perspective: 600px;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.mw-card-inner {
  position: absolute;
  inset: 0;
  transition: transform 150ms ease-out;
  transform-style: preserve-3d;
}
.mw-card--up .mw-card-inner { transform: rotateY(180deg); }
.mw-card-back,
.mw-card-face {
  position: absolute;
  inset: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  box-shadow:
    0 -3px 0 0 var(--mw-ink),
    0 3px 0 0 var(--mw-ink),
    -3px 0 0 0 var(--mw-ink),
    3px 0 0 0 var(--mw-ink);
}
.mw-card-back { background: var(--mw-pink); }
.mw-card-face { background: var(--mw-paper); transform: rotateY(180deg); }
.mw-card--done .mw-card-face { background: var(--mw-mint-soft); }
.mw-card-face img { width: 88%; height: 88%; object-fit: contain; image-rendering: pixelated; }
.mw-card:focus-visible { outline: 3px solid var(--mw-blue); outline-offset: 3px; }
@media (hover: hover) {
  .mw-card:not(.mw-card--up):hover .mw-card-back { background: #ff72c0; }
}
</style>
