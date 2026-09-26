<template>
  <!-- The shared closet as picture tiles, one slot at a time. Used by the
    Garderobe, the person maker and the fashion show. -->
  <div class="mw-closet">
    <div class="mw-tabs" role="tablist">
      <button
        v-for="s in SLOTS"
        :key="s"
        type="button"
        role="tab"
        class="px-btn mw-btn"
        :class="{ 'mw-on': s === slot }"
        :aria-selected="s === slot"
        @click="slot = s"
      >
        {{ SLOT_NAMES[s] }}
      </button>
    </div>
    <div class="mw-grid">
      <button
        v-if="OPTIONAL.includes(slot)"
        type="button"
        class="mw-tile"
        :class="{ 'mw-tile--on': outfit[slot] === null }"
        @click="$emit('pick', slot, null)"
      >
        <span class="mw-pic--empty mw-none" aria-hidden="true"><PxIcon id="close" :scale="4" grey /></span>
        <span class="mw-tile-name">INGENTING</span>
      </button>
      <button
        v-for="def in items"
        :key="def.id"
        type="button"
        class="mw-tile"
        :class="{ 'mw-tile--on': outfit[slot] === def.id }"
        :aria-pressed="outfit[slot] === def.id"
        @click="$emit('pick', slot, def.id)"
      >
        <img v-if="pic(def)" class="mw-pic" :src="pic(def)" alt="">
        <span v-else class="mw-pic--empty" />
        <span class="mw-tile-name">{{ shy(def.name) }}</span>
        <span v-if="tag && def.tags.includes(tag)" class="mw-tag" aria-label="Passer til temaet">
          <PxIcon id="star" :scale="2" />
        </span>
      </button>
    </div>
    <p v-if="!items.length" class="mw-p mw-dim mw-center">DU HAR INGEN ENNÅ. KJØP I KLESBUTIKKEN!</p>
  </div>
</template>

<script setup lang="ts">
import { shy } from './text'
import { ref, computed } from 'vue'
import PxIcon from './PxIcon.vue'
import { useMw } from './context'
import { CLOTHES, SLOT_NAMES, coversLegs } from '../catalog'
import type { ClothingDef, ClothingSlot, FashionTag, Outfit } from '../types'

const props = defineProps<{
  outfit: Outfit
  /** Clothing ids to choose from (the closet). */
  owned: readonly string[]
  /** Fashion show: pieces that suit the theme get a star. */
  tag?: FashionTag | null
}>()

defineEmits<{ pick: [slot: ClothingSlot, id: string | null] }>()

const SLOTS: ClothingSlot[] = ['top', 'bottom', 'shoes', 'hat', 'face', 'back']
const OPTIONAL: ClothingSlot[] = ['hat', 'face', 'back']

const { pics } = useMw()
const slot = ref<ClothingSlot>('top')

const items = computed(() => {
  const own = new Set(props.owned)
  const list = CLOTHES.filter(d => d.slot === slot.value && own.has(d.id))
  // Theme pieces first in the fashion show.
  if (props.tag) list.sort((a, b) => Number(b.tags.includes(props.tag!)) - Number(a.tags.includes(props.tag!)))
  return list
})

const pic = (def: ClothingDef) => pics.clothing(def, 96)

defineExpose({ slot, legsCovered: computed(() => coversLegs(props.outfit.top)) })
</script>

<style scoped>
.mw-closet { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
.mw-none {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
