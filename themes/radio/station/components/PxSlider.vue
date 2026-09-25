<!-- Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync. -->
<template>
  <div class="pxs" :class="{ 'pxs--compact': compact }" :style="{ '--pxs-c': color }">
    <span class="pxs__label">{{ label }}</span>
    <span v-if="left" class="pxs__end pxs__end--l">{{ left }}</span>
    <div
      ref="track"
      class="pxs__track"
      role="slider"
      tabindex="0"
      :aria-label="label"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="modelValue"
      :aria-valuetext="valueText"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
      @keydown="key"
    >
      <span
        v-for="i in segments"
        :key="i"
        class="pxs__seg"
        :class="segClass(i - 1)"
      />
    </div>
    <span v-if="right" class="pxs__end pxs__end--r">{{ right }}</span>
    <span v-if="format" class="pxs__val">{{ format(modelValue) }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * A segmented pixel slider: a row of blocks, lit up to the value (or out
 * from the middle for a bipolar knob like tempo). Drag or tap on it, or
 * focus it and use the arrow keys, which it keeps from the page's own
 * shortcuts while focused.
 */
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  label: string
  min?: number
  max?: number
  step?: number
  segments?: number
  left?: string
  right?: string
  bipolar?: boolean
  color?: string
  compact?: boolean
  format?: (v: number) => string
}>(), { min: 0, max: 1, step: 0.1, segments: 10, color: '#2ff3ff' })

const emit = defineEmits<{ 'update:modelValue': [v: number] }>()
const track = ref<HTMLElement | null>(null)
let dragging = false

const frac = computed(() => (props.modelValue - props.min) / (props.max - props.min))
const valueText = computed(() => (props.format ? props.format(props.modelValue) : `${Math.round(frac.value * 100)}%`))

function segClass(i: number): string {
  const n = props.segments
  const at = Math.round(frac.value * n) // number of lit segments from the left
  if (props.bipolar) {
    const mid = n / 2
    const lo = Math.min(mid, at)
    const hi = Math.max(mid, at)
    if (i >= lo && i < hi) return i === (at > mid ? hi - 1 : lo) ? 'on head' : 'on'
    return ''
  }
  if (i < at) return i === at - 1 ? 'on head' : 'on'
  return ''
}

function quantise(v: number): number {
  const s = props.step
  const q = Math.round((v - props.min) / s) * s + props.min
  return Math.min(props.max, Math.max(props.min, Number(q.toFixed(4))))
}

function fromX(clientX: number): void {
  const el = track.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
  // Snap to segment edges: the block under the finger is the last lit one.
  const segs = props.segments
  const lit = props.bipolar ? Math.round(t * segs) : Math.ceil(t * segs - 0.25)
  const v = quantise(props.min + (Math.max(0, lit) / segs) * (props.max - props.min))
  if (v !== props.modelValue) emit('update:modelValue', v)
}

function down(e: PointerEvent): void {
  dragging = true
  track.value?.setPointerCapture(e.pointerId)
  fromX(e.clientX)
}
function move(e: PointerEvent): void {
  if (dragging) fromX(e.clientX)
}
function up(): void {
  dragging = false
}

function key(e: KeyboardEvent): void {
  let v = props.modelValue
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v += props.step
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v -= props.step
  else if (e.key === 'Home') v = props.min
  else if (e.key === 'End') v = props.max
  else return
  e.preventDefault()
  e.stopPropagation()
  v = quantise(v)
  if (v !== props.modelValue) emit('update:modelValue', v)
}
</script>

<style scoped>
.pxs {
  display: grid;
  grid-template-columns: var(--pxs-label-w, 96px) auto 1fr auto auto;
  align-items: center;
  column-gap: 8px;
  min-height: 24px;
  font-family: var(--font-pixel);
  font-size: 16px;
  line-height: 16px;
  text-transform: uppercase;
}

.pxs__label {
  grid-column: 1;
  color: var(--ink);
  text-shadow: 2px 2px 0 var(--bg);
}

.pxs__end {
  color: var(--subtle);
  white-space: nowrap;
}
.pxs__end--l { grid-column: 2; text-align: right; }
.pxs__end--r { grid-column: 4; }

.pxs__val {
  grid-column: 5;
  min-width: 36px;
  text-align: right;
  color: var(--pxs-c);
}

.pxs__track {
  grid-column: 3;
  display: flex;
  gap: 2px;
  height: 16px;
  padding: 4px 0;
  cursor: pointer;
  touch-action: none;
  outline: none;
}

.pxs__seg {
  flex: 1 1 0;
  min-width: 4px;
  background: color-mix(in srgb, var(--pxs-c) 12%, var(--bg));
  box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--pxs-c) 22%, var(--bg));
}
.pxs__seg.on {
  background: color-mix(in srgb, var(--pxs-c) 55%, var(--bg));
  box-shadow: none;
}
.pxs__seg.head {
  background: var(--pxs-c);
  box-shadow: 0 0 8px color-mix(in srgb, var(--pxs-c) 70%, transparent);
}

.pxs__track:focus-visible .pxs__seg { outline: 2px solid color-mix(in srgb, var(--pxs-c) 40%, transparent); outline-offset: 0; }
.pxs__track:focus-visible { box-shadow: 0 2px 0 0 var(--pxs-c); }

/* Narrow: the end words go, the value (tempo) stays. */
.pxs--compact { grid-template-columns: var(--pxs-label-w, 96px) 0 1fr 0 auto; }
.pxs--compact .pxs__end { display: none; }
</style>
