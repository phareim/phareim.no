<template>
  <Sheet title="KART" icon="pin" narrow @close="ctx.close()">
    <p class="mw-p mw-dim">HVOR VIL DU?</p>
    <div class="mw-spots">
      <button
        v-for="s in SPOTS"
        :key="s.id"
        type="button"
        class="px-btn mw-btn mw-btn--wide mw-spot"
        :style="{ background: s.color }"
        @click="ctx.travel(s.id)"
      >
        <PxIcon :id="s.icon" :scale="3" />
        <span>{{ s.name }}</span>
      </button>
    </div>
  </Sheet>
</template>

<script setup lang="ts">
import Sheet from './Sheet.vue'
import PxIcon from './PxIcon.vue'
import { useMw, type TravelSpot } from './context'
import type { IconId } from './icons'

const ctx = useMw()

const SPOTS: { id: TravelSpot; name: string; icon: IconId; color: string }[] = [
  { id: 'torget', name: 'TORGET', icon: 'pin', color: '#fff3b8' },
  { id: 'butikkgata', name: 'BUTIKKGATA', icon: 'coin', color: '#ffd6ee' },
  { id: 'tivoliet', name: 'TIVOLIET', icon: 'star', color: '#d4f7e1' },
  { id: 'slottet', name: 'SLOTTET', icon: 'crown', color: '#e8dcff' },
  { id: 'nabogata', name: 'NABOGATA', icon: 'person', color: '#d6efff' },
  { id: 'hjem', name: 'HJEM', icon: 'house', color: '#ffe3d0' },
]
</script>

<style scoped>
.mw-spots {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  padding: 10px 4px 4px;
}
@media (max-width: 440px) {
  .mw-spots { grid-template-columns: 1fr; gap: 12px; }
}
.mw-root .px-btn.mw-btn.mw-spot {
  justify-content: flex-start;
  min-height: 64px;
  gap: 12px;
  color: var(--mw-ink);
}
@media (hover: hover) {
  .mw-root .px-btn.mw-btn.mw-spot:hover { color: var(--mw-ink); filter: brightness(0.95); }
}
</style>
