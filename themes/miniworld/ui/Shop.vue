<template>
  <Sheet
    :title="kind === 'clothes' ? 'KLESBUTIKKEN' : 'MØBELBUTIKKEN'"
    :icon="kind === 'clothes' ? 'shirt' : 'house'"
    :bits="bits"
    :back="!!chosen"
    wide
    @back="chosen = null"
    @close="ctx.close()"
  >
    <!-- The shelf -->
    <template v-if="!chosen">
      <div class="mw-tabs" role="tablist">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          role="tab"
          class="px-btn mw-btn"
          :class="{ 'mw-on': tab === t.id }"
          :aria-selected="tab === t.id"
          @click="tab = t.id"
        >
          {{ t.name }}
        </button>
      </div>
      <div class="mw-grid">
        <button
          v-for="w in wares"
          :key="w.id"
          type="button"
          class="mw-tile"
          :class="{ 'mw-tile--owned': w.owned > 0 && w.unique }"
          @click="choose(w)"
        >
          <img v-if="w.pic" class="mw-pic" :src="w.pic" alt="">
          <span v-else class="mw-pic--empty" />
          <span class="mw-tile-name">{{ w.name }}</span>
          <span v-if="w.owned > 0 && w.unique" class="mw-p mw-dim">DU HAR DEN</span>
          <span v-else class="mw-price mw-p"><PxIcon id="coin" :scale="2" />{{ w.price }}</span>
          <span v-if="w.owned > 0 && !w.unique" class="mw-tag mw-tag--mint">{{ w.owned }}</span>
        </button>
      </div>
    </template>

    <!-- One thing, big -->
    <div v-else class="mw-ware">
      <div class="mw-ware-pics">
        <div class="mw-ware-pic">
          <img v-if="chosen.bigPic" :src="chosen.bigPic" alt="">
        </div>
        <div v-if="tryOn" class="mw-ware-pic mw-ware-pic--person">
          <img :src="tryOn" alt="">
        </div>
      </div>
      <div class="mw-ware-info">
        <p class="mw-h">{{ chosen.name }}</p>
        <p v-if="tryOn" class="mw-p mw-dim">SLIK SER DET UT PÅ {{ person?.name }}</p>
        <p class="mw-price mw-big"><PxIcon id="coin" :scale="3" />{{ chosen.price }}</p>
        <p v-if="chosen.owned > 0 && chosen.unique" class="mw-p">DU HAR DEN ALLEREDE.</p>
        <p v-else-if="short > 0" class="mw-p mw-warn">DU TRENGER {{ short }} BITS TIL.</p>
      </div>
    </div>

    <template v-if="chosen" #footer>
      <template v-if="chosen.owned > 0 && chosen.unique">
        <button v-if="chosen.section === 'clothes' && !wearing" type="button" class="px-btn mw-btn mw-btn--sky" @click="wear">TA PÅ</button>
        <button v-if="(chosen.section === 'floor' || chosen.section === 'wall') && !laid" type="button" class="px-btn mw-btn mw-btn--sky" @click="lay">LEGG DET</button>
        <button type="button" class="px-btn mw-btn mw-btn--plain" @click="chosen = null">◀ TILBAKE</button>
      </template>
      <button v-else type="button" class="px-btn mw-btn mw-btn--go mw-btn--big" :disabled="short > 0" @click="buy">
        KJØP
      </button>
    </template>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Sheet from './Sheet.vue'
import PxIcon from './PxIcon.vue'
import { useMw } from './context'
import { surfaceSwatch } from './swatch'
import { CLOTHES, FURNITURE, FLOORS, WALLS, SLOT_NAMES, clothing } from '../catalog'
import type { ClothingSlot, FurnitureKind } from '../types'

const props = defineProps<{ kind: 'clothes' | 'furniture' }>()

const ctx = useMw()
const { game, pics } = ctx

type Section = 'clothes' | 'furniture' | 'floor' | 'wall'
interface Ware {
  id: string
  name: string
  price: number
  section: Section
  pic: string
  bigPic: string
  /** How many you have (clothes, floors and walls: 0 or 1). */
  owned: number
  /** One of a kind for you (clothes, floors, walls): no second copy. */
  unique: boolean
}

type TabId = ClothingSlot | FurnitureKind | 'floors' | 'walls'
const tabs = computed<{ id: TabId; name: string }[]>(() => props.kind === 'clothes'
  ? (['top', 'bottom', 'shoes', 'hat', 'face', 'back'] as ClothingSlot[]).map(s => ({ id: s, name: SLOT_NAMES[s] }))
  : [
      { id: 'floor', name: 'MØBLER' },
      { id: 'small', name: 'SMÅTING' },
      { id: 'rug', name: 'TEPPER' },
      { id: 'wall', name: 'PÅ VEGGEN' },
      { id: 'floors', name: 'GULV' },
      { id: 'walls', name: 'TAPET' },
    ])
const tab = ref<TabId>(props.kind === 'clothes' ? 'top' : 'floor')

const save = computed(() => game.save.value)
const bits = computed(() => game.bits.value)
const person = computed(() => game.active.value)

const wares = computed<Ware[]>(() => {
  const t = tab.value
  const s = save.value
  if (props.kind === 'clothes') {
    return CLOTHES.filter(d => d.slot === t && d.rarity === 'shop' && d.price > 0).map(d => ({
      id: d.id, name: d.name, price: d.price, section: 'clothes' as const,
      pic: pics.clothing(d, 96), bigPic: '',
      owned: s.closet.includes(d.id) ? 1 : 0, unique: true,
    }))
  }
  if (t === 'floors' || t === 'walls') {
    const list = t === 'floors' ? FLOORS : WALLS
    const own = t === 'floors' ? s.floors : s.walls
    return list.filter(d => d.price > 0).map(d => ({
      id: d.id, name: d.name, price: d.price, section: (t === 'floors' ? 'floor' : 'wall') as Section,
      pic: surfaceSwatch(d), bigPic: '', owned: own.includes(d.id) ? 1 : 0, unique: true,
    }))
  }
  return FURNITURE.filter(d => d.kind === t && d.rarity === 'shop' && d.price > 0).map(d => ({
    id: d.id, name: d.name, price: d.price, section: 'furniture' as const,
    pic: pics.furniture(d.id, 1, 96), bigPic: '',
    owned: s.furniture.filter(f => f.id === d.id).length, unique: false,
  }))
})

const chosenId = ref<{ id: string; section: Section } | null>(null)
const chosen = computed<Ware | null>({
  get() {
    const c = chosenId.value
    if (!c) return null
    const w = wares.value.find(x => x.id === c.id)
    if (!w) return null
    const def = clothing(w.id)
    const bigPic = w.section === 'clothes' && def ? pics.clothing(def, 256)
      : w.section === 'furniture' ? pics.furniture(w.id, 1, 256)
      : w.pic
    return { ...w, bigPic }
  },
  set(v) { chosenId.value = v ? { id: v.id, section: v.section } : null },
})

function choose(w: Ware) {
  chosenId.value = { id: w.id, section: w.section }
  ctx.sfx('click')
}

const short = computed(() => (chosen.value ? Math.max(0, chosen.value.price - bits.value) : 0))

/** Clothes: your person wearing it, before you buy. */
const tryOn = computed(() => {
  const c = chosen.value
  const p = person.value
  if (!c || c.section !== 'clothes' || !p) return ''
  const def = clothing(c.id)
  if (!def) return ''
  return pics.person({ ...p.look, outfit: { ...p.look.outfit, [def.slot]: def.id } }, { full: true, size: 256 })
})

const wearing = computed(() => {
  const c = chosen.value
  const def = c ? clothing(c.id) : undefined
  return !!def && person.value?.look.outfit[def.slot] === def.id
})
const laid = computed(() => {
  const c = chosen.value
  if (!c) return false
  return c.section === 'floor' ? save.value.house.floor === c.id : save.value.house.wall === c.id
})

function buy() {
  const c = chosen.value
  if (!c) return
  const r = c.section === 'clothes' ? game.buyClothing(c.id)
    : c.section === 'furniture' ? game.buyFurniture(c.id)
    : c.section === 'floor' ? game.buyFloor(c.id)
    : game.buyWall(c.id)
  if (!r.ok) {
    ctx.sfx(r.error === 'poor' ? 'poor' : 'close')
    ctx.say(r.message)
    return
  }
  ctx.sfx('buy')
  const line = c.section === 'furniture' ? 'DEN LIGGER I SEKKEN!' : 'DEN ER DIN!'
  ctx.cheer(line, c.bigPic)
}

function wear() {
  const c = chosen.value
  const p = person.value
  const def = c ? clothing(c.id) : undefined
  if (!p || !def) return
  const r = game.dress(p.id, def.slot, def.id)
  if (!r.ok) { ctx.say(r.message); return }
  ctx.sfx('dress')
}

function lay() {
  const c = chosen.value
  if (!c || (c.section !== 'floor' && c.section !== 'wall')) return
  const r = game.setSurface(c.section, c.id)
  if (!r.ok) { ctx.say(r.message); return }
  ctx.sfx('place')
  ctx.say(c.section === 'floor' ? 'NYTT GULV HJEMME!' : 'NY TAPET HJEMME!')
}
</script>

<style scoped>
.mw-ware {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}
.mw-ware-pics { display: flex; gap: 12px; justify-content: center; }
.mw-ware-pic {
  flex: 1 1 0;
  max-width: 220px;
  aspect-ratio: 1;
  background: var(--mw-tile);
  display: flex;
  align-items: center;
  justify-content: center;
}
.mw-ware-pic img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
.mw-ware-pic--person { background: var(--mw-pink-soft); }
.mw-ware-info { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
@media (min-width: 640px), (orientation: landscape) and (max-height: 500px) {
  .mw-ware { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); }
}
@media (orientation: landscape) and (max-height: 500px) {
  .mw-ware-pic { max-width: 150px; }
}
</style>
