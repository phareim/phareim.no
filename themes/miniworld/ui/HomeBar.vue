<template>
  <!-- In your house: the Pynt switch, and in Pynt mode the tray of stored
    things along the bottom and the tools for the selected one. -->
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
import { computed } from 'vue'
import PxIcon from './PxIcon.vue'
import { useMw } from './context'
import { furniture } from '../catalog'

const props = defineProps<{ editing: boolean; selected: string | null }>()
defineEmits<{ toggle: [] }>()

const ctx = useMw()
const { game, pics } = ctx
const { hint } = useInputMode()

const stored = computed(() => {
  const s = game.save.value
  const placed = new Set(s.house.items.map(i => i.uid))
  return s.furniture
    .filter(f => !placed.has(f.uid))
    .map(f => ({ uid: f.uid, name: furniture(f.id)?.name ?? f.id, pic: pics.furniture(f.id, f.level, 96) }))
})

const selectedName = computed(() => {
  const f = game.save.value.furniture.find(x => x.uid === props.selected)
  return f ? furniture(f.id)?.name ?? '' : ''
})

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
