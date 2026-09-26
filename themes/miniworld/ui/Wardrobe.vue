<template>
  <Sheet title="GARDEROBE" icon="shirt" wide @close="ctx.close()">
    <div v-if="person" class="mw-wardrobe">
      <div class="mw-wardrobe-pic">
        <img v-if="portrait" :src="portrait" alt="">
        <p class="mw-p mw-center">{{ person.name }}</p>
      </div>
      <ClosetPicker :outfit="person.look.outfit" :owned="game.save.value.closet" @pick="pick" />
    </div>
    <template #footer>
      <button type="button" class="px-btn mw-btn mw-btn--sky" @click="ctx.open({ id: 'shop', kind: 'clothes' })">
        <PxIcon id="coin" :scale="2" />FLERE KLÆR
      </button>
      <button type="button" class="px-btn mw-btn mw-btn--go" @click="ctx.close()">FERDIG</button>
    </template>
  </Sheet>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Sheet from './Sheet.vue'
import PxIcon from './PxIcon.vue'
import ClosetPicker from './ClosetPicker.vue'
import { useMw } from './context'
import type { ClothingSlot } from '../types'

const ctx = useMw()
const { game, pics } = ctx

const person = computed(() => game.active.value)
const portrait = computed(() => (person.value ? pics.person(person.value.look, { full: true, size: 320 }) : ''))

function pick(slot: ClothingSlot, id: string | null) {
  const p = person.value
  if (!p) return
  const r = game.dress(p.id, slot, id)
  if (!r.ok) { ctx.say(r.message); return }
  ctx.sfx('dress')
}
</script>

<style scoped>
.mw-wardrobe {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
.mw-wardrobe-pic {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: var(--mw-tile);
  padding: 6px;
}
.mw-wardrobe-pic img { height: 150px; width: auto; aspect-ratio: 4 / 5; image-rendering: pixelated; }
@media (min-width: 640px), (orientation: landscape) and (max-height: 500px) {
  .mw-wardrobe { grid-template-columns: minmax(160px, 32%) minmax(0, 1fr); align-items: start; }
  .mw-wardrobe-pic { position: sticky; top: 0; }
  .mw-wardrobe-pic img { height: auto; width: 100%; }
}
@media (orientation: landscape) and (max-height: 500px) {
  .mw-wardrobe { grid-template-columns: 150px minmax(0, 1fr); }
}
</style>
