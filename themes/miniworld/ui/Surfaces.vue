<template>
  <Sheet title="GULV OG TAPET" icon="house" @close="ctx.close()">
    <p class="mw-label">GULV</p>
    <div class="mw-grid mw-grid--small">
      <button
        v-for="f in floors"
        :key="f.id"
        type="button"
        class="mw-tile"
        :class="{ 'mw-tile--on': house.floor === f.id }"
        @click="lay('floor', f.id)"
      >
        <img class="mw-pic" :src="surfaceSwatch(f)" alt="">
        <span class="mw-tile-name">{{ f.name }}</span>
      </button>
    </div>
    <p class="mw-label">TAPET</p>
    <div class="mw-grid mw-grid--small">
      <button
        v-for="w in walls"
        :key="w.id"
        type="button"
        class="mw-tile"
        :class="{ 'mw-tile--on': house.wall === w.id }"
        @click="lay('wall', w.id)"
      >
        <img class="mw-pic" :src="surfaceSwatch(w)" alt="">
        <span class="mw-tile-name">{{ w.name }}</span>
      </button>
    </div>
    <template #footer>
      <button type="button" class="px-btn mw-btn mw-btn--sky" @click="ctx.open({ id: 'shop', kind: 'furniture' })">
        <PxIcon id="coin" :scale="2" />KJØP FLERE
      </button>
      <button type="button" class="px-btn mw-btn mw-btn--go" @click="ctx.close()">FERDIG</button>
    </template>
  </Sheet>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Sheet from './Sheet.vue'
import PxIcon from './PxIcon.vue'
import { useMw } from './context'
import { surfaceSwatch } from './swatch'
import { FLOORS, WALLS } from '../catalog'

const ctx = useMw()
const { game } = ctx

const house = computed(() => game.save.value.house)
const floors = computed(() => FLOORS.filter(f => game.save.value.floors.includes(f.id)))
const walls = computed(() => WALLS.filter(w => game.save.value.walls.includes(w.id)))

function lay(kind: 'floor' | 'wall', id: string) {
  const r = game.setSurface(kind, id)
  if (!r.ok) { ctx.say(r.message); return }
  ctx.sfx('place')
}
</script>
