<template>
  <div class="look" :class="{ 'look--touch': touch }" @pointerdown.self="onBackdrop">
    <section
      ref="box"
      class="look-box px-box px-box--pink"
      role="dialog"
      aria-modal="true"
      aria-labelledby="look-title"
      tabindex="-1"
    >
      <header class="look-head">
        <h2 id="look-title" class="look-title">NEW LOOK</h2>
        <span class="look-say" role="status" aria-live="polite">{{ say }}</span>
      </header>

      <div class="look-top">
        <canvas ref="mirror" class="look-mirror" :width="MIRROR_W" :height="MIRROR_H" aria-hidden="true" />
        <div class="look-presets" role="group" aria-label="WHOLE LOOKS">
          <button
            v-for="(p, i) in presets"
            :key="p.id"
            type="button"
            class="px-btn look-btn"
            :class="{ 'is-sel': row === PRESET_ROW && col === i }"
            @click="preset(p.id)"
            @pointerenter="point(PRESET_ROW, i)"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

      <ul ref="list" class="look-rows">
        <li
          v-for="(o, i) in LOOK_OPTIONS"
          :key="o.key"
          :ref="el => setRow(i, el)"
          class="look-row"
          :class="{ 'is-sel': row === i + 1, 'is-off': !applies(o.key) }"
          @pointerenter="point(i + 1, 0)"
        >
          <button type="button" class="look-arrow" :disabled="!applies(o.key)" :aria-label="`PREVIOUS ${o.label}`" @click="step(i, -1)">←</button>
          <button type="button" class="look-value" :disabled="!applies(o.key)" @click="step(i, 1)">
            <span class="look-label">{{ o.label }}</span>
            <span class="look-pick">
              <i v-if="o.kind === 'color' && applies(o.key)" class="look-chip" :style="{ background: look[o.key] }" />
              {{ applies(o.key) ? choiceName(look, o) : '-' }}
            </span>
          </button>
          <button type="button" class="look-arrow" :disabled="!applies(o.key)" :aria-label="`NEXT ${o.label}`" @click="step(i, 1)">→</button>
        </li>
      </ul>

      <div class="look-foot">
        <button
          type="button"
          class="px-btn px-btn--pink look-btn"
          :class="{ 'is-sel': row === FOOT_ROW && col === 0 }"
          @click="wear"
          @pointerenter="point(FOOT_ROW, 0)"
        >
          WEAR IT
        </button>
        <button
          type="button"
          class="px-btn look-btn"
          :class="{ 'is-sel': row === FOOT_ROW && col === 1 }"
          @click="leave"
          @pointerenter="point(FOOT_ROW, 1)"
        >
          NEVER MIND
        </button>
      </div>
      <p v-if="!touch" class="look-keys" aria-hidden="true">↑↓ CHOOSE · ←→ CHANGE · ENTER PRESSES · ESC LEAVES</p>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * The NEW LOOK booth's mirror: the panel the stall on the square opens. Every
 * part of the hero is a row (hair and its colour, what is on the head, skin,
 * shirt, stripe, belt, what is worn below, shoes); BOY and GIRL are whole
 * looks, RANDOM rolls one, and MY FIGURE (when Lag Din Figur or Mini World
 * has dressed the hero) goes back to wearing that. The mirror shows the real
 * sprite frames walking in three directions and holding a find up.
 *
 * Nothing is worn until WEAR IT: the mirror paints its own canvases
 * (`lookCanvases`), the hero in the world stays as they were. The shell
 * (`Zelda.vue`) stores the look and dresses the hero on `wear`.
 *
 * Keys, while it is open, are its own (caught on `window` in the capture
 * phase, like the login console's): up / down choose a row, left / right
 * change it (or move along a row of buttons), Enter / Space / J / Z press,
 * Escape / Backspace / K / X leave without changing anything.
 */
import type { HeroColors } from '../miniworld/types'
import { lookCanvases } from './render/sheet'
import {
  DRAWN_LOOK, GIRL_LOOK, LOOK_OPTIONS, choiceName, lookFromColors, optionApplies, randomLook, stepLook,
  type HeroLook, type LookKey,
} from './render/heroLook'

const props = defineProps<{
  /** The touch deck is showing: no key hints. */
  touch: boolean
  /** The look the hero wears from this booth, if one was chosen before. */
  current: HeroLook | null
  /** The colours of a made figure (Lag Din Figur, else Mini World), if there is one. */
  figure: HeroColors | null
  /** No walking in the mirror. */
  reducedMotion?: boolean
}>()

const emit = defineEmits<{
  close: []
  /** WEAR IT: the look to store and wear; null goes back to the made figure's clothes. */
  wear: [look: HeroLook | null]
}>()

type PresetId = 'boy' | 'girl' | 'random' | 'figure'

/** Presses this soon after opening are the ones that opened it (a held Enter, a tap lifting off): ignored. */
const GRACE_MS = 350
const UP = new Set(['ArrowUp', 'KeyW'])
const DOWN = new Set(['ArrowDown', 'KeyS'])
const LEFT = new Set(['ArrowLeft', 'KeyA'])
const RIGHT = new Set(['ArrowRight', 'KeyD'])
const PRESS = new Set(['Enter', 'NumpadEnter', 'Space', 'KeyJ', 'KeyZ'])
const CLOSE = new Set(['Escape', 'Backspace', 'KeyK', 'KeyX'])

const PRESET_ROW = 0
const FOOT_ROW = LOOK_OPTIONS.length + 1
/** The mirror in sprite pixels: four 16×16 figures with a gap between, a floor line under them. */
const GAP = 4
const MIRROR_W = 4 * 16 + 5 * GAP
const MIRROR_H = 16 + 6

/** What the hero would wear with nothing chosen here: the made figure's clothes, or as drawn. */
const fallback = (): HeroLook => (props.figure ? lookFromColors(props.figure) : DRAWN_LOOK)
const look = ref<HeroLook>(props.current ?? fallback())
/** MY FIGURE was picked and nothing changed since: WEAR IT hands the choice back to the figure. */
const following = ref(false)
const say = ref('WHAT ARE WE DOING TODAY?')
const row = ref(1)
const col = ref(0)
const box = ref<HTMLElement | null>(null)
const mirror = ref<HTMLCanvasElement | null>(null)
const rows: Array<HTMLElement | null> = []
let openedAt = 0
let timer = 0
let frame = 0

const presets = computed(() => {
  const list: Array<{ id: PresetId; label: string }> = [
    { id: 'boy', label: 'BOY' },
    { id: 'girl', label: 'GIRL' },
    { id: 'random', label: 'RANDOM' },
  ]
  if (props.figure) list.push({ id: 'figure', label: 'MY FIGURE' })
  return list
})

const applies = (key: LookKey) => optionApplies(look.value, key)

function setRow(i: number, el: unknown) {
  rows[i] = (el as HTMLElement | null) ?? null
}

function early() {
  return performance.now() - openedAt < GRACE_MS
}

function point(r: number, c: number) {
  row.value = r
  col.value = c
}

function change(next: HeroLook, line: string) {
  look.value = next
  following.value = false
  say.value = line
}

function step(i: number, d: 1 | -1) {
  const o = LOOK_OPTIONS[i]
  if (!o || !applies(o.key) || early()) return
  row.value = i + 1
  const next = stepLook(look.value, o.key, d)
  change(next, `${o.label}: ${choiceName(next, o)}.`)
}

function preset(id: PresetId) {
  if (early()) return
  switch (id) {
    case 'boy': change(DRAWN_LOOK, 'THE CLASSIC. NEVER GOES OUT OF STYLE.'); break
    case 'girl': change(GIRL_LOOK, 'LONG HAIR, A BOW AND A SKIRT.'); break
    case 'random': change(randomLook(), 'BOLD. I LIKE IT.'); break
    case 'figure':
      if (!props.figure) return
      change(lookFromColors(props.figure), 'THE CLOTHES YOU MADE YOURSELF.')
      following.value = true
      break
  }
}

function wear() {
  if (early()) return
  emit('wear', following.value ? null : look.value)
}

function leave() {
  if (!early()) emit('close')
}

function onBackdrop() {
  leave()
}

/** The next row from `r` going `d` that has something to change (a colour for something not worn is skipped). */
function nextRow(r: number, d: 1 | -1): number {
  const n = FOOT_ROW + 1
  let x = r
  for (let k = 0; k < n; k++) {
    x = (x + d + n) % n
    if (x === PRESET_ROW || x === FOOT_ROW || applies(LOOK_OPTIONS[x - 1]!.key)) return x
  }
  return r
}

function move(d: 1 | -1) {
  row.value = nextRow(row.value, d)
  const width = row.value === PRESET_ROW ? presets.value.length : row.value === FOOT_ROW ? 2 : 1
  col.value = Math.min(col.value, width - 1)
  nextTick(() => rows[row.value - 1]?.scrollIntoView({ block: 'nearest' }))
}

function side(d: 1 | -1) {
  if (row.value === PRESET_ROW) { const n = presets.value.length; col.value = (col.value + d + n) % n }
  else if (row.value === FOOT_ROW) col.value = (col.value + d + 2) % 2
  else step(row.value - 1, d)
}

function press() {
  if (row.value === PRESET_ROW) { const p = presets.value[col.value]; if (p) preset(p.id) }
  else if (row.value === FOOT_ROW) { if (col.value === 0) wear(); else leave() }
  else step(row.value - 1, 1)
}

function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  // The panel owns the keyboard: nothing behind it hears a key.
  e.stopPropagation()
  const c = e.code
  if (e.type === 'keyup') {
    // A Space let go on a focused button would click it.
    if (PRESS.has(c)) e.preventDefault()
    return
  }
  if (UP.has(c)) { e.preventDefault(); move(-1) }
  else if (DOWN.has(c)) { e.preventDefault(); move(1) }
  else if (c === 'Tab') { e.preventDefault(); move(e.shiftKey ? -1 : 1) }
  else if (LEFT.has(c)) { e.preventDefault(); side(-1) }
  else if (RIGHT.has(c)) { e.preventDefault(); side(1) }
  else if (PRESS.has(c)) {
    e.preventDefault()
    if (!e.repeat && !early()) press()
  } else if (CLOSE.has(c)) {
    e.preventDefault()
    if (!e.repeat) emit('close')
  }
}

/** The mirror: the look walking toward you, sideways and away, and holding a find up. */
function paint() {
  const cv = mirror.value
  const g = cv?.getContext('2d')
  if (!cv || !g) return
  const f = lookCanvases(look.value)
  const walk = [0, 1, 0, 2][frame % 4]!
  g.clearRect(0, 0, MIRROR_W, MIRROR_H)
  g.fillStyle = '#1a1030'
  g.fillRect(0, 0, MIRROR_W, MIRROR_H)
  g.fillStyle = '#271c46'
  g.fillRect(0, MIRROR_H - 4, MIRROR_W, 4)
  g.fillStyle = '#3b2b62'
  g.fillRect(0, MIRROR_H - 4, MIRROR_W, 1)
  const names = [`hero_down_${walk}`, `hero_side_${walk}`, `hero_up_${walk}`, 'hero_get']
  names.forEach((name, i) => {
    const c = f[name]
    if (!c) return
    const x = GAP + i * (16 + GAP)
    g.fillStyle = 'rgba(8,4,20,0.5)'
    g.fillRect(x + 3, MIRROR_H - 4, 10, 2)
    g.drawImage(c, x, MIRROR_H - 3 - 16)
  })
}

watch(look, paint)

onMounted(() => {
  openedAt = performance.now()
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('keyup', onKey, true)
  box.value?.focus({ preventScroll: true })
  paint()
  if (!props.reducedMotion) timer = window.setInterval(() => { frame++; paint() }, 170)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('keyup', onKey, true)
})
</script>

<style>
.look {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  padding: 12px 12px calc(12px + var(--app-safe-bottom, 0px));
  background: rgba(11, 6, 22, 0.55);
  font-family: var(--font-pixel);
  -webkit-font-smoothing: none;
  touch-action: manipulation;
}

.look-box {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: min(372px, 100%);
  max-height: 100%;
  overflow: hidden;
  padding: 12px 12px 10px;
  color: #fff4ff;
  font-size: 16px;
  line-height: 16px;
  text-transform: uppercase;
  background: #0b0616;
  outline: none;
}

.look-head {
  flex: none;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 2px solid #271c46;
}

.look-title {
  margin: 0;
  font: inherit;
  color: #ff2fa0;
  text-shadow: 2px 2px 0 #3a1a4a;
}

.look-say {
  display: block;
  height: 32px;
  margin-top: 4px;
  overflow: hidden;
  color: #2ff3ff;
  text-shadow: 0 0 8px rgba(47, 243, 255, 0.45);
}

.look-top {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: none;
}

.look-mirror {
  display: block;
  width: 100%;
  max-width: 336px;
  margin: 0 auto;
  aspect-ratio: 84 / 22;
  image-rendering: pixelated;
  box-shadow: 0 0 0 2px #ffd23f, 0 0 0 4px #0b0616, 0 0 14px rgba(255, 210, 63, 0.35);
}

.look-presets,
.look-foot {
  display: flex;
  gap: 8px;
  padding: 2px;
}

.look-btn {
  flex: 1 1 0;
  box-sizing: border-box;
  min-width: 0;
  min-height: 36px;
  padding: 0 4px;
  font-size: 16px;
  line-height: 16px;
  text-align: center;
  white-space: nowrap;
}

.look-btn.is-sel {
  outline: none;
  color: #0b0616;
  background: var(--px-edge);
}

/* A finger chooses by touching: no row or button stands chosen beforehand, and a tap leaves no hover behind. */
.look--touch .look-btn,
.look--touch .look-btn.is-sel,
.look--touch .look-btn:hover {
  color: var(--px-edge);
  background: rgba(11, 6, 22, 0.88);
}

.look--touch .look-btn:active {
  color: #0b0616;
  background: var(--px-edge);
}

.look--touch .look-row.is-sel {
  background: none;
}

.look--touch .look-row.is-sel .look-arrow,
.look--touch .look-arrow {
  color: #ffd23f;
}

.look-rows {
  flex: 1 1 auto;
  min-height: 0;
  margin: 8px 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  scrollbar-width: none;
}

.look-rows::-webkit-scrollbar { display: none; }

.look-row {
  display: flex;
  align-items: stretch;
  min-height: 28px;
  border-bottom: 2px solid #1a1030;
}

.look-row.is-sel {
  background: #271c46;
}

.look-row.is-off {
  color: #6f5ca6;
}

.look-arrow,
.look-value {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-transform: inherit;
  cursor: pointer;
}

.look-arrow {
  flex: none;
  width: 40px;
  color: #6f5ca6;
}

.look-row.is-sel .look-arrow {
  color: #ffd23f;
}

.look-arrow:disabled,
.look-value:disabled {
  cursor: default;
}

.look-row.is-off .look-arrow {
  visibility: hidden;
}

.look-value {
  flex: 1 1 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  min-width: 0;
  text-align: left;
}

.look-label {
  color: #b9a8d9;
}

.look-row.is-sel .look-label {
  color: #fff4ff;
}

.look-pick {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.look-chip {
  display: inline-block;
  width: 14px;
  height: 14px;
  box-shadow: 0 0 0 2px #0b0616, 0 0 0 4px #5a5285;
  margin-right: 4px;
}

.look-keys {
  margin: 8px 0 0;
  color: #6f5ca6;
  text-align: center;
}

/* A phone on its side: the mirror and the buttons beside the rows. */
@media (max-height: 520px) and (orientation: landscape) {
  .look-box {
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    column-gap: 12px;
    width: min(640px, 100%);
    /* A set height, so the rows' track is a real one and the list scrolls inside it when it must. */
    height: 100%;
    padding: 8px 12px;
  }
  .look-head { grid-column: 1; grid-row: 1; margin-bottom: 6px; padding-bottom: 4px; }
  .look-top { grid-column: 1; grid-row: 2; align-self: start; }
  .look-rows { grid-column: 2; grid-row: 1 / 4; margin: 0; }
  .look-foot { grid-column: 1; grid-row: 3; }
  .look-row { min-height: 22px; }
  .look-keys { display: none; }
}
</style>
