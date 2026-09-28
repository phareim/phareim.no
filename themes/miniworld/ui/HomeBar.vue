<template>
  <!-- In your house: the Pynt switch, and in Pynt mode the tray of stored
    things along the bottom, the tools for the selected one, which storey
    you decorate, and building a new storey on top. -->
  <div class="mw-home" :class="{ 'mw-home--edit': editing }">
    <div class="mw-home-top">
      <button
        type="button"
        class="px-btn mw-btn"
        :class="editing ? 'mw-btn--go' : 'mw-btn--pink'"
        @click="$emit('toggle')"
      >
        <PxIcon id="house" :scale="2" />{{ editing ? 'FERDIG' : 'PYNT' }}
      </button>
      <button v-if="editing" type="button" class="px-btn mw-btn mw-btn--plain" @click="ctx.open({ id: 'surfaces' })">
        GULV OG TAPET
      </button>
      <div v-if="editing && storey.count > 1" class="mw-storeys px-box mw-box">
        <button type="button" class="px-btn mw-btn mw-btn--sky" :disabled="storey.index <= 0" aria-label="Etasjen under" @click="goStorey(-1)">▼</button>
        <span class="mw-t mw-storey-name">{{ storeyName }}</span>
        <button type="button" class="px-btn mw-btn mw-btn--sky" :disabled="storey.index >= storey.count - 1" aria-label="Etasjen over" @click="goStorey(1)">▲</button>
      </div>
      <button
        v-if="editing && price !== null"
        type="button"
        class="px-btn mw-btn"
        :class="confirming ? 'mw-btn--go' : 'mw-btn--pink'"
        @click="build"
      >
        {{ confirming ? 'BYGG!' : '+ NY ETASJE' }}<span class="mw-price"><PxIcon id="coin" :scale="2" />{{ price }}</span>
      </button>
    </div>

    <div v-if="editing" class="mw-tray px-box mw-box">
      <div v-if="selected" class="mw-tools">
        <span class="mw-tools-name mw-t">{{ selectedName }}</span>
        <button type="button" class="px-btn mw-btn mw-btn--sky" @click="rotate">↻ SNU</button>
        <button type="button" class="px-btn mw-btn mw-btn--plain" @click="store">LEGG BORT</button>
      </div>
      <p v-else class="mw-p mw-dim mw-tray-hint">{{ stored.length ? hint('VELG EN TING. DRA DEN MED MUSA.', 'VELG EN TING. DRA DEN MED FINGEREN.') : 'ALT ER I HUSET!' }}</p>
      <div v-if="stored.length" class="mw-tray-row">
        <button
          v-for="f in stored"
          :key="f.uid"
          type="button"
          class="mw-tile mw-tray-tile"
          :aria-label="f.name"
          @click="add(f.uid)"
        >
          <img v-if="f.pic" class="mw-pic" :src="f.pic" alt="">
          <span v-else class="mw-pic--empty" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import PxIcon from './PxIcon.vue'
import { useMw } from './context'
import { furniture } from '../catalog'
import { placedUids } from '../core/save'

const props = defineProps<{ editing: boolean; selected: string | null }>()
defineEmits<{ toggle: [] }>()

const ctx = useMw()
const { game, pics } = ctx
const { hint } = useInputMode()

const stored = computed(() => {
  const s = game.save.value
  const placed = placedUids(s.house)
  return s.furniture
    .filter(f => !placed.has(f.uid))
    .map(f => ({ uid: f.uid, name: furniture(f.id)?.name ?? f.id, pic: pics.furniture(f.id, f.level, 96) }))
})

const selectedName = computed(() => {
  const f = game.save.value.furniture.find(x => x.uid === props.selected)
  return f ? furniture(f.id)?.name ?? '' : ''
})

const storey = computed(() => ctx.storey.value)
const STOREY_NAMES = ['1. ETASJE', '2. ETASJE', '3. ETASJE']
const storeyName = computed(() => STOREY_NAMES[storey.value.index] ?? '')
const price = computed(() => { void game.save.value; return game.storeyPrice() })

function goStorey(dir: 1 | -1) {
  ctx.runtime.value?.edit.storey(storey.value.index + dir)
  ctx.sfx('click')
}

/** Building costs bits: the first tap asks, the second (within a few seconds) builds. */
const confirming = ref(false)
let confirmTimer: ReturnType<typeof setTimeout> | undefined
watch(() => props.editing, () => { confirming.value = false })
onBeforeUnmount(() => clearTimeout(confirmTimer))

async function build() {
  if (!confirming.value) {
    confirming.value = true
    ctx.sfx('click')
    clearTimeout(confirmTimer)
    confirmTimer = setTimeout(() => { confirming.value = false }, 4000)
    return
  }
  confirming.value = false
  clearTimeout(confirmTimer)
  const r = game.buyStorey()
  if (!r.ok) {
    ctx.sfx(r.error === 'poor' ? 'poor' : 'close')
    ctx.say(r.message)
    return
  }
  ctx.sfx('buy')
  const top = game.save.value.house.up?.length ?? 0
  await nextTick()
  ctx.runtime.value?.edit.storey(top)
  ctx.cheer(r.moved ? `NY ETASJE! ${r.moved === 1 ? 'EN TING' : `${r.moved} TING`} LIGGER I SEKKEN.` : 'NY ETASJE! TRAPPA GÅR OPP.')
}

function add(uid: string) {
  ctx.runtime.value?.edit.add(uid)
  ctx.sfx('pick')
}
function rotate() {
  ctx.runtime.value?.edit.rotate()
  ctx.sfx('rotate')
}
function store() {
  ctx.runtime.value?.edit.store()
  ctx.sfx('store')
}
</script>

<style scoped>
.mw-home {
  position: absolute;
  inset: 0;
  z-index: 15;
  pointer-events: none;
}
.mw-home > * { pointer-events: auto; }
.mw-home-top {
  position: absolute;
  left: max(12px, env(safe-area-inset-left, 0px));
  top: calc(max(10px, env(safe-area-inset-top, 0px)) + 76px);
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
@media (max-width: 599px) {
  .mw-home-top { top: calc(max(10px, env(safe-area-inset-top, 0px)) + 136px); }
}
.mw-tray {
  position: absolute;
  left: max(12px, env(safe-area-inset-left, 0px));
  right: max(12px, env(safe-area-inset-right, 0px));
  bottom: calc(12px + var(--app-safe-bottom, 0px));
  max-width: 820px;
  margin: 0 auto;
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mw-storeys { display: flex; align-items: center; gap: 8px; padding: 4px 6px; }
.mw-storey-name { font-size: 14px; min-width: 88px; text-align: center; }
.mw-home-top .mw-price { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; }
.mw-tools { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.mw-tools-name { flex: 1; min-width: 0; font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mw-tray-hint { min-height: 48px; display: flex; align-items: center; }
.mw-tray-row {
  display: flex;
  gap: 14px;
  padding: 4px;
  overflow-x: auto;
  overscroll-behavior: contain;
  touch-action: pan-x;
  scrollbar-width: none;
}
.mw-tray-row::-webkit-scrollbar { display: none; }
.mw-root .mw-tile.mw-tray-tile { flex: none; width: 72px; padding: 4px; }
@media (max-height: 420px) {
  .mw-root .mw-tile.mw-tray-tile { width: 56px; }
  .mw-tray { padding: 6px 10px 8px; gap: 6px; }
}
</style>
