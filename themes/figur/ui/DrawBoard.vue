<template>
  <!-- The drawing board: the piece's grid in big square cells (hatched
    where it cannot be painted, the body's outline as faint dots), the
    tools, 24 colours, and the figure wearing it as it is drawn. -->
  <div class="fg-board" role="dialog" :aria-label="title">
    <header class="fg-board-head">
      <button type="button" class="px-btn fg-btn fg-btn--plain" @click="requestClose">
        <FgIcon id="close" :scale="2" /><span class="fg-wide-only">AVBRYT</span>
      </button>
      <h2 class="fg-board-title fg-t">{{ title }}</h2>
      <button type="button" class="px-btn fg-btn fg-btn--go" @click="startSave">
        <FgIcon id="check" :scale="2" />LAGRE
      </button>
    </header>

    <div class="fg-board-main">
      <div ref="areaRef" class="fg-board-area">
        <canvas
          ref="gridRef"
          class="fg-board-grid"
          :style="{ width: `${tex.w * cell}px`, height: `${tex.h * cell}px` }"
          aria-label="Tegnebrett"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onUp"
          @lostpointercapture="onUp"
          @contextmenu.prevent
        />
      </div>

      <div class="fg-board-side">
        <div class="fg-board-preview" :style="{ background: previewBg }">
          <img v-if="preview" :src="preview" alt="Figuren med plagget">
        </div>

        <div class="fg-board-tools" role="toolbar" aria-label="Verktøy">
          <button
            v-for="t in TOOLS"
            :key="t.id"
            type="button"
            class="px-btn fg-btn fg-btn--plain fg-tool"
            :class="{ 'fg-btn--on': tool === t.id }"
            :aria-pressed="tool === t.id"
            :aria-label="t.name"
            :title="t.name"
            @click="pickTool(t.id)"
          >
            <FgIcon :id="t.icon" :scale="3" /><span class="fg-tool-name">{{ t.name }}</span>
          </button>
          <button
            type="button"
            class="px-btn fg-btn fg-btn--plain fg-tool"
            :class="{ 'fg-btn--on': mirror }"
            :aria-pressed="mirror"
            aria-label="Speil"
            title="Speil"
            @click="toggleMirror"
          >
            <FgIcon id="mirror" :scale="3" /><span class="fg-tool-name">SPEIL</span>
          </button>
          <button type="button" class="px-btn fg-btn fg-btn--plain fg-tool" :disabled="!undoable" aria-label="Angre" title="Angre" @click="undo">
            <FgIcon id="undo" :scale="3" :grey="!undoable" /><span class="fg-tool-name">ANGRE</span>
          </button>
          <button type="button" class="px-btn fg-btn fg-btn--plain fg-tool" :disabled="empty" aria-label="Tøm" title="Tøm" @click="clearAll">
            <FgIcon id="broom" :scale="3" :grey="empty" /><span class="fg-tool-name">TØM</span>
          </button>
        </div>
      </div>

      <div class="fg-board-palette" role="group" aria-label="Farger">
        <button
          v-for="c in PALETTE"
          :key="c"
          type="button"
          class="fg-tile fg-swatch fg-board-swatch"
          :class="{ 'fg-tile--on': color === c && tool !== 'eraser' }"
          :aria-pressed="color === c"
          aria-label="Farge"
          @click="pickColor(c)"
        >
          <span class="fg-swatch-fill" :style="{ background: c }" />
        </button>
      </div>
    </div>

    <div v-if="naming" class="fg-board-name-layer">
      <form class="px-box fg-box fg-board-name fg-stack" @submit.prevent="save">
        <p class="fg-h">HVA HETER DEN?</p>
        <input
          ref="nameRef"
          v-model="name"
          class="fg-input"
          type="text"
          :maxlength="MAX_DRAWN_NAME"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="done"
          aria-label="Navn"
        >
        <p v-if="problem" class="fg-p fg-warn">{{ problem }}</p>
        <div class="fg-row fg-row--end">
          <button type="button" class="px-btn fg-btn fg-btn--plain" @click="naming = false">
            <FgIcon id="back" :scale="2" />TILBAKE
          </button>
          <button type="submit" class="px-btn fg-btn fg-btn--go">
            <FgIcon id="check" :scale="2" />LAGRE
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, inject, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { KIND_SLOT, type DrawnGarment, type Hex, type Texture } from '../types'
import { PALETTE, DRAW_TEMPLATES, garment } from '../catalog'
import { paintCell, fillArea, maskFor, guideFor, blankTexture, cloneTexture, fitsKind, applyMask, limitColors, packTexture } from '../core/textures'
import { MAX_DRAWN_COLORS, MAX_DRAWN_NAME } from '../core/save'
import { wear } from '../core/figure'
import { frameFor, styleById } from '../render/styles'
import { useFigur } from '~/composables/useFigur'
import FgIcon from './FgIcon.vue'
import type { IconId } from './icons'
import { bufferCanvas } from './pics'
import { newUndo, pushUndo, popUndo, sameTexture, lineCells, cellAt, boardCell } from './board'
import { FG_CTX, type BoardStart } from './context'

type Tool = 'pencil' | 'eraser' | 'fill'
const TOOLS: Array<{ id: Tool; name: string; icon: IconId }> = [
  { id: 'pencil', name: 'BLYANT', icon: 'pencil' },
  { id: 'eraser', name: 'VISK', icon: 'eraser' },
  { id: 'fill', name: 'FYLL', icon: 'bucket' },
]
/** The preview wears the piece under this id (never saved). */
const PREVIEW_ID = 'd-preview0'

const props = defineProps<{ start: BoardStart }>()
const emit = defineEmits<{ close: [] }>()
const game = useFigur()
const ctx = inject(FG_CTX)!

const kind = props.start.kind
const initial: Texture = props.start.tex && fitsKind(props.start.tex, kind) ? applyMask(props.start.tex, kind) : blankTexture(kind)
const tex = shallowRef<Texture>(cloneTexture(initial))
const tool = ref<Tool>('pencil')
const color = ref<Hex>(PALETTE[9]!)
const mirror = ref(true)
const undoStack = newUndo()
const undoCount = ref(0)
const undoable = computed(() => undoCount.value > 0)
const empty = computed(() => !tex.value.px.some(Boolean))
const dirty = computed(() => !sameTexture(tex.value, initial))

const kindName = DRAW_TEMPLATES.find(t => t.kind === kind)?.name
  ?? garment(game.active.value.outfit[KIND_SLOT[kind]]?.id ?? '')?.name
  ?? 'Klær'
const title = computed(() => (props.start.editId ? `TEGN: ${props.start.name ?? kindName}` : `TEGN ${kindName}`))

// ---------------------------------------------------------------- the grid

const areaRef = ref<HTMLDivElement | null>(null)
const gridRef = ref<HTMLCanvasElement | null>(null)
const cell = ref(16)
const mask = maskFor(kind)
const guide = guideFor(kind)

function measure() {
  const el = areaRef.value
  if (!el) return
  cell.value = boardCell(el.clientWidth, el.clientHeight, tex.value.w, tex.value.h)
}

function paint() {
  const c = gridRef.value
  if (!c) return
  const t = tex.value
  const s = cell.value
  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1))
  const W = t.w * s * dpr
  const H = t.h * s * dpr
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
  const g = c.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.imageSmoothingEnabled = false
  for (let y = 0; y < t.h; y++) {
    for (let x = 0; x < t.w; x++) {
      const i = y * t.w + x
      const px = x * s
      const py = y * s
      if (!mask[i]) {
        // Not paintable: lilac with hard diagonal hatching.
        g.fillStyle = '#d9c4f2'
        g.fillRect(px, py, s, s)
        g.fillStyle = '#c3a6e6'
        const step = Math.max(3, Math.round(s / 4))
        for (let k = -s; k < s; k += step) {
          for (let d = 0; d < s; d++) {
            const hx = k + d
            if (hx >= 0 && hx < s) g.fillRect(px + hx, py + d, 1, 1)
          }
        }
        continue
      }
      const col = t.px[i]
      if (col) {
        g.fillStyle = col
        g.fillRect(px, py, s, s)
      } else {
        // Empty: a pale checker, so "see-through" reads as see-through.
        g.fillStyle = (x + y) % 2 ? '#ffffff' : '#f4ecfb'
        g.fillRect(px, py, s, s)
      }
      if (guide[i]) {
        g.fillStyle = 'rgba(42, 23, 68, 0.28)'
        const d = Math.max(2, Math.round(s / 5))
        g.fillRect(px + Math.floor((s - d) / 2), py + Math.floor((s - d) / 2), d, d)
      }
    }
  }
  // Cell lines.
  g.fillStyle = 'rgba(42, 23, 68, 0.14)'
  for (let x = 1; x < t.w; x++) g.fillRect(x * s, 0, 1, t.h * s)
  for (let y = 1; y < t.h; y++) g.fillRect(0, y * s, t.w * s, 1)
  // The mirror's middle line.
  if (mirror.value) {
    g.fillStyle = '#d9468f'
    const mx = (t.w * s) / 2 - 1
    for (let y = 0; y < t.h * s; y += 8) g.fillRect(mx, y, 2, 4)
  }
}

watch([tex, cell, mirror], () => { paint(); schedulePreview() }, { flush: 'post' })

// ---------------------------------------------------------------- painting

let stroke: { id: number; before: Texture; last: [number, number] | null } | null = null

function cellOf(e: PointerEvent): [number, number] | null {
  const c = gridRef.value
  if (!c) return null
  const r = c.getBoundingClientRect()
  return cellAt(e.clientX - r.left, e.clientY - r.top, cell.value, tex.value.w, tex.value.h)
}

function paintAt(x: number, y: number) {
  const next = paintCell(tex.value, kind, x, y, tool.value === 'eraser' ? null : color.value, mirror.value)
  if (next !== tex.value) { tex.value = next; ctx.sfx('tick') }
}

function onDown(e: PointerEvent) {
  if (e.button !== 0 && e.pointerType === 'mouse') return
  e.preventDefault()
  const at = cellOf(e)
  if (!at) return
  const before = tex.value
  if (tool.value === 'fill') {
    const next = fillArea(before, kind, at[0], at[1], color.value, mirror.value)
    if (next !== before) { commitUndo(before); tex.value = next; ctx.sfx('pop') }
    return
  }
  gridRef.value?.setPointerCapture(e.pointerId)
  stroke = { id: e.pointerId, before, last: at }
  paintAt(at[0], at[1])
}

function onMove(e: PointerEvent) {
  if (!stroke || e.pointerId !== stroke.id) return
  const at = cellOf(e)
  if (!at) { stroke.last = null; return }
  const from = stroke.last ?? at
  for (const [x, y] of lineCells(from[0], from[1], at[0], at[1])) paintAt(x, y)
  stroke.last = at
}

function onUp(e: PointerEvent) {
  if (!stroke || e.pointerId !== stroke.id) return
  if (tex.value !== stroke.before) commitUndo(stroke.before)
  stroke = null
}

function commitUndo(before: Texture) {
  pushUndo(undoStack, before)
  undoCount.value = undoStack.stack.length
}

function undo() {
  const prev = popUndo(undoStack)
  undoCount.value = undoStack.stack.length
  if (!prev) return
  tex.value = prev
  ctx.sfx('whoosh')
}

function pickTool(t: Tool) {
  tool.value = t
  ctx.sfx('pop')
}

function pickColor(c: Hex) {
  color.value = c
  if (tool.value === 'eraser') tool.value = 'pencil'
  ctx.sfx('pop')
}

function toggleMirror() {
  mirror.value = !mirror.value
  ctx.sfx('pop')
}

function clearAll() {
  ctx.ask('Vil du tømme hele?', () => {
    commitUndo(tex.value)
    tex.value = blankTexture(kind)
    ctx.sfx('whoosh')
  })
}

// ---------------------------------------------------------------- preview

const preview = ref('')
const previewBg = computed(() => styleById(game.active.value.style).bg)
let previewRaf = 0

function schedulePreview() {
  if (previewRaf) return
  previewRaf = requestAnimationFrame(() => {
    previewRaf = 0
    const f = game.active.value
    const temp: DrawnGarment = { id: PREVIEW_ID, name: 'Tegning', kind, tex: packTexture(tex.value), createdAt: 0 }
    const closet = [...game.closet.value.filter(d => d.id !== props.start.editId), temp]
    let fig = wear(f, KIND_SLOT[kind], { id: PREVIEW_ID })
    // Trousers drawn while a dress is on: show them with a plain top.
    if (KIND_SLOT[kind] === 'bottom' && closetKind(f.outfit.top?.id) === 'dress') fig = wear(fig, 'top', { id: 'tskjorte' })
    const buf = frameFor(fig, closet, styleById(f.style), { t: 0, pose: { bob: 0, blink: false, cheer: 0 }, backdrop: true })
    preview.value = bufferCanvas(buf).toDataURL()
  })
}

function closetKind(id: string | undefined) {
  if (!id) return undefined
  return garment(id)?.kind ?? game.closet.value.find(d => d.id === id)?.kind
}

watch(() => game.active.value.style, schedulePreview)

// ---------------------------------------------------------------- save and close

const naming = ref(false)
const name = ref('')
const problem = ref('')
const nameRef = ref<HTMLInputElement | null>(null)

async function startSave() {
  if (empty.value) {
    ctx.say('Tegn noe først!')
    ctx.sfx('no')
    return
  }
  name.value = props.start.editId ? (props.start.name ?? kindName) : game.nextDrawnName(kind)
  problem.value = ''
  naming.value = true
  ctx.sfx('pop')
  await nextTick()
  nameRef.value?.focus()
  nameRef.value?.select()
}

function save() {
  const id = props.start.editId ?? game.newDrawnId()
  const old = game.closet.value.find(d => d.id === id)
  const drawn: DrawnGarment = {
    id,
    name: name.value,
    kind,
    tex: packTexture(limitColors(tex.value, MAX_DRAWN_COLORS)),
    createdAt: old?.createdAt ?? Date.now(),
  }
  const r = game.saveDrawn(drawn)
  if (!r.ok) { problem.value = r.message; ctx.sfx('no'); return }
  const slot = KIND_SLOT[kind]
  if (slot === 'bottom' && closetKind(game.active.value.outfit.top?.id) === 'dress') game.wear('top', { id: 'tskjorte' })
  game.wear(slot, { id })
  ctx.sfx('sparkle')
  ctx.say('Lagret! Du finner den i Mine klær.')
  emit('close')
}

function requestClose() {
  if (!dirty.value) { emit('close'); return }
  ctx.ask('Vil du slutte uten å lagre?', () => emit('close'))
}

/** Escape: out of the name step first, then off the board (asking if there is unsaved drawing). */
function escape() {
  if (naming.value) { naming.value = false; return }
  requestClose()
}

defineExpose({ escape, undo })

let ro: ResizeObserver | null = null
onMounted(() => {
  measure()
  ro = new ResizeObserver(measure)
  if (areaRef.value) ro.observe(areaRef.value)
  paint()
  schedulePreview()
})
onBeforeUnmount(() => {
  ro?.disconnect()
  if (previewRaf) cancelAnimationFrame(previewRaf)
})
</script>

<style scoped>
.fg-board {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding:
    max(10px, env(safe-area-inset-top, 0px))
    max(12px, env(safe-area-inset-right, 0px))
    calc(10px + var(--app-safe-bottom, 0px))
    max(12px, env(safe-area-inset-left, 0px));
  background: var(--fg-lilac);
  overflow: clip;
}
.fg-board-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 3px;
}
.fg-board-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 16px;
  font-weight: 400;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fg-board-main {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 76px;
  grid-template-rows: minmax(0, 1fr) auto;
  grid-template-areas:
    "area side"
    "palette side";
  gap: 10px;
}
.fg-board-area {
  grid-area: area;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fg-board-grid {
  display: block;
  touch-action: none;
  cursor: crosshair;
  image-rendering: pixelated;
  box-shadow:
    0 -3px 0 0 var(--fg-ink),
    0 3px 0 0 var(--fg-ink),
    -3px 0 0 0 var(--fg-ink),
    3px 0 0 0 var(--fg-ink);
}
/* The side column: the preview (shrinks first) over the tools; its foot stays free for the site's ⌂ chip. */
.fg-board-side {
  grid-area: side;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  padding-bottom: 44px;
}
.fg-board-preview {
  flex: 1 1 108px;
  min-height: 0;
  max-height: 220px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden;
  box-shadow:
    0 -3px 0 0 var(--fg-ink),
    0 3px 0 0 var(--fg-ink),
    -3px 0 0 0 var(--fg-ink),
    3px 0 0 0 var(--fg-ink);
}
.fg-board-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}
.fg-board-tools {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fg-root .px-btn.fg-btn.fg-tool { min-height: 48px; padding: 0; gap: 8px; width: 100%; }
.fg-tool-name { display: none; }
.fg-board-palette {
  grid-area: palette;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
  padding: 3px;
}
.fg-root .fg-tile.fg-board-swatch { min-width: 0; min-height: 44px; }
.fg-wide-only { display: none; }

/* Wide screens and landscape: the board on the left; preview, labelled tools and the palette on the right. */
@media (min-width: 800px), (orientation: landscape) and (min-width: 560px) {
  .fg-wide-only { display: inline; }
  .fg-board-main {
    grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
    grid-template-rows: minmax(0, 1fr) auto;
    grid-template-areas:
      "area side"
      "area palette";
    column-gap: 20px;
  }
  .fg-board { padding-bottom: calc(56px + var(--app-safe-bottom, 0px)); }
  .fg-board-side { gap: 12px; padding: 3px; }
  .fg-board-preview { flex: 1 1 200px; max-height: 260px; }
  .fg-board-tools { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .fg-root .px-btn.fg-btn.fg-tool { flex-direction: column; min-height: 64px; gap: 4px; }
  .fg-tool-name { display: block; }
  .fg-board-palette { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
  .fg-root .fg-tile.fg-board-swatch { min-height: 48px; }
}
@media (orientation: landscape) and (max-height: 500px) {
  .fg-root .px-btn.fg-btn.fg-tool { min-height: 48px; }
  .fg-tool-name { display: none; }
  .fg-board { padding-bottom: calc(10px + var(--app-safe-bottom, 0px)); padding-right: 64px; }
  .fg-board-palette { grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 6px; }
  .fg-root .fg-tile.fg-board-swatch { min-height: 40px; }
}

.fg-board-name-layer {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 16px calc(16px + var(--app-safe-bottom, 0px) + var(--fg-kb, 0px));
  background: rgba(42, 23, 68, 0.32);
}
.fg-board-name { width: 100%; max-width: 420px; padding: 18px; }
</style>
