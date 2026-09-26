<template>
  <!-- KLÆR: one row of slot pictures, then what is worn there (its two
    colours and TEGN PÅ DENNE), then the child's own pieces and the
    built-in ones as pictures. Tap wears; tap again takes off a hat,
    glasses, a back piece or shoes. -->
  <div class="fg-clothes">
    <div class="fg-subtabs" role="tablist" aria-label="Klær">
      <button
        v-for="t in GROUPS"
        :key="t.id"
        type="button"
        role="tab"
        class="px-btn fg-btn fg-btn--plain fg-subtab"
        :class="{ 'fg-btn--on': group === t.id }"
        :aria-selected="group === t.id"
        :aria-label="t.name"
        @click="pick(t.id)"
      >
        <FgIcon :id="t.icon" :scale="t.id === 'face' || t.id === 'shoes' ? 3 : 2" />
      </button>
    </div>

    <div class="fg-panel-body fg-clothes-body">
      <p class="fg-label fg-clothes-name">{{ current.name }}</p>

      <template v-if="mine.length">
        <p class="fg-label"><FgIcon id="star" :scale="2" />MINE KLÆR</p>
        <div class="fg-grid">
          <div v-for="d in mine" :key="d.id" class="fg-mine">
            <button
              type="button"
              class="fg-tile"
              :class="{ 'fg-tile--on': wornId === d.id }"
              :aria-label="d.name"
              :aria-pressed="wornId === d.id"
              @click="wearDrawn(d.id, d.kind)"
            >
              <img class="fg-pic" :src="drawnPic(d)" alt="">
            </button>
            <button type="button" class="px-btn fg-btn fg-btn--plain fg-trash" :aria-label="`Slett ${d.name}`" @click="remove(d.id, d.name)">
              <FgIcon id="trash" :scale="2" />
            </button>
          </div>
        </div>
        <p class="fg-label"><FgIcon :id="current.icon" :scale="2" />FRA BUTIKKEN</p>
      </template>

      <div class="fg-grid">
        <button
          v-for="d in builtIns"
          :key="d.id"
          type="button"
          class="fg-tile"
          :class="{ 'fg-tile--on': wornId === d.id }"
          :aria-label="d.name"
          :aria-pressed="wornId === d.id"
          @click="wearBuiltIn(d)"
        >
          <img class="fg-pic" :src="garmentPic(d, wornId === d.id ? worn?.color : undefined, wornId === d.id ? worn?.color2 : undefined)" alt="">
        </button>
      </div>
      <template v-if="wornDef && wornHere">
        <p class="fg-label"><span class="fg-dot" :style="{ background: mainColor }" />{{ wornDef.name }}: FARGE</p>
        <div class="fg-strip" role="group" aria-label="Farge">
          <button
            v-for="c in PALETTE"
            :key="'a' + c"
            type="button"
            class="fg-tile fg-swatch"
            :class="{ 'fg-tile--on': mainColor === c }"
            :aria-pressed="mainColor === c"
            aria-label="Farge"
            @click="recolor('color', c)"
          >
            <span class="fg-swatch-fill" :style="{ background: c }" />
          </button>
        </div>
        <p class="fg-label"><span class="fg-dot" :style="{ background: secondColor }" />FARGE 2</p>
        <div class="fg-strip" role="group" aria-label="Farge 2">
          <button
            v-for="c in PALETTE"
            :key="'b' + c"
            type="button"
            class="fg-tile fg-swatch"
            :class="{ 'fg-tile--on': secondColor === c }"
            :aria-pressed="secondColor === c"
            aria-label="Farge 2"
            @click="recolor('color2', c)"
          >
            <span class="fg-swatch-fill" :style="{ background: c }" />
          </button>
        </div>
      </template>

      <button
        v-if="canDrawOn"
        type="button"
        class="px-btn fg-btn fg-btn--sky fg-btn--wide fg-drawon"
        @click="drawOn"
      >
        <FgIcon id="pencil" :scale="2" />TEGN PÅ DENNE
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, watch } from 'vue'
import { KIND_SLOT, type GarmentDef, type GarmentKind, type Hex, type Slot } from '../types'
import { GARMENTS, PALETTE, garment } from '../catalog'
import { garmentTexture, isDrawableKind, drawnTexture } from '../core/textures'
import { useFigur } from '~/composables/useFigur'
import FgIcon from './FgIcon.vue'
import type { IconId } from './icons'
import { garmentPic, drawnPic } from './pics'
import { FG_CTX } from './context'

type Group = 'top' | 'dress' | 'bottom' | 'shoes' | 'hat' | 'face' | 'back'

const GROUPS: Array<{ id: Group; name: string; icon: IconId; slot: Slot }> = [
  { id: 'top', name: 'Overdel', icon: 'top', slot: 'top' },
  { id: 'dress', name: 'Kjoler', icon: 'dress', slot: 'top' },
  { id: 'bottom', name: 'Bukser og skjørt', icon: 'bottom', slot: 'bottom' },
  { id: 'shoes', name: 'Sko', icon: 'shoes', slot: 'shoes' },
  { id: 'hat', name: 'Hodeplagg', icon: 'hat', slot: 'hat' },
  { id: 'face', name: 'Briller', icon: 'glasses', slot: 'face' },
  { id: 'back', name: 'Rygg', icon: 'wings', slot: 'back' },
]
/** Slots a second tap empties: nobody minds being without a hat. */
const OFF_OK: readonly Slot[] = ['shoes', 'hat', 'face', 'back']

const game = useFigur()
const ctx = inject(FG_CTX)!

const groupOf = (kind: GarmentKind): Group => (kind === 'dress' ? 'dress' : (KIND_SLOT[kind] as Group))
const startGroup = (): Group => {
  const top = game.active.value.outfit.top
  const def = top ? garment(top.id) : undefined
  const drawn = top ? game.closet.value.find(d => d.id === top.id) : undefined
  return (def?.kind ?? drawn?.kind) === 'dress' ? 'dress' : 'top'
}
const group = ref<Group>(startGroup())
const current = computed(() => GROUPS.find(g => g.id === group.value)!)
const slot = computed(() => current.value.slot)
const worn = computed(() => game.active.value.outfit[slot.value])
const wornId = computed(() => worn.value?.id ?? null)
const wornDef = computed(() => (worn.value ? garment(worn.value.id) : undefined))
const wornDrawn = computed(() => (worn.value ? game.closet.value.find(d => d.id === worn.value!.id) : undefined))
const wornKind = computed(() => wornDef.value?.kind ?? wornDrawn.value?.kind ?? null)
/** The worn piece belongs to this tab (a dress is worn in the top slot but lives under Kjoler). */
const wornHere = computed(() => !!wornKind.value && groupOf(wornKind.value) === group.value)
const mainColor = computed(() => worn.value?.color ?? wornDef.value?.color ?? '')
const secondColor = computed(() => worn.value?.color2 ?? wornDef.value?.color2 ?? '')
const canDrawOn = computed(() => wornHere.value && !!wornKind.value && isDrawableKind(wornKind.value))

const builtIns = computed(() => GARMENTS.filter(d => groupOf(d.kind) === group.value))
const mine = computed(() => game.closet.value.filter(d => groupOf(d.kind) === group.value).slice().reverse())

/** The last top that was not a dress, for putting trousers on over a dress. */
let lastTop: { id: string; color?: Hex; color2?: Hex } | null = null
watch(() => game.active.value.outfit.top, (t) => {
  if (!t) return
  const kind = garment(t.id)?.kind ?? game.closet.value.find(d => d.id === t.id)?.kind
  if (kind && kind !== 'dress') lastTop = { ...t }
}, { immediate: true })

function pick(g: Group) {
  group.value = g
  ctx.sfx('pop')
}

function put(kind: GarmentKind, id: string, colors: { color?: Hex; color2?: Hex } = {}) {
  const s = KIND_SLOT[kind]
  const now = game.active.value.outfit[s]
  if (now?.id === id) {
    if (OFF_OK.includes(s)) { game.wear(s, null); ctx.sfx('whoosh') } else ctx.sfx('pop')
    return
  }
  // Trousers or a skirt over a dress: the dress comes off for the last top (or a T-skjorte).
  if (s === 'bottom') {
    const top = game.active.value.outfit.top
    const topKind = top ? garment(top.id)?.kind ?? game.closet.value.find(d => d.id === top.id)?.kind : undefined
    if (topKind === 'dress') game.wear('top', lastTop ?? { id: 'tskjorte' })
  }
  game.wear(s, { id, ...colors })
  ctx.sfx('pop')
}

const wearBuiltIn = (d: GarmentDef) => put(d.kind, d.id)
const wearDrawn = (id: string, kind: GarmentKind) => put(kind, id)

function recolor(which: 'color' | 'color2', c: Hex) {
  const w = worn.value
  if (!w) return
  game.wear(slot.value, { ...w, [which]: c })
  ctx.sfx('pop')
}

function remove(id: string, name: string) {
  ctx.ask(`Vil du slette ${name}?`, () => {
    game.deleteDrawn(id)
    ctx.sfx('whoosh')
  })
}

function drawOn() {
  const w = worn.value
  const kind = wornKind.value
  if (!w || !kind || !isDrawableKind(kind)) return
  const drawn = wornDrawn.value
  if (drawn) {
    const tex = drawnTexture(drawn)
    ctx.openBoard({ kind, tex: tex ?? undefined, editId: drawn.id, name: drawn.name })
    return
  }
  const def = wornDef.value
  if (def) ctx.openBoard({ kind, tex: garmentTexture(def, w.color, w.color2) })
}
</script>

<style scoped>
.fg-clothes {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
.fg-subtabs {
  flex: none;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  padding: 6px 6px 10px;
}
.fg-root .px-btn.fg-btn.fg-subtab { min-width: 0; padding: 0; }
.fg-clothes-body { flex: 1 1 auto; }
.fg-clothes-name { color: var(--fg-ink); margin: 0 0 4px; }
.fg-dot {
  display: inline-block;
  width: 16px;
  height: 16px;
  flex: none;
  box-shadow: 0 0 0 3px var(--fg-ink);
}
.fg-drawon { margin: 14px 0 4px; }
.fg-mine { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.fg-root .px-btn.fg-btn.fg-trash { min-height: 44px; width: 100%; padding: 0; }
</style>
