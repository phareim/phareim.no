<template>
  <Sheet title="SEKKEN" icon="bag" wide @close="ctx.close()">
    <div class="mw-tabs" role="tablist">
      <button
        v-for="t in TABS"
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

    <template v-if="tab === 'furniture'">
      <div v-if="furnitureList.length" class="mw-grid">
        <div v-for="f in furnitureList" :key="f.uid" class="mw-tile mw-tile--static" :class="{ 'mw-tile--owned': f.placed }">
          <img v-if="f.pic" class="mw-pic" :src="f.pic" alt="">
          <span v-else class="mw-pic--empty" />
          <span class="mw-tile-name">{{ shy(f.name) }}</span>
          <span class="mw-stars" :aria-label="`Nivå ${f.level}`">
            <PxIcon v-for="n in 3" :key="n" id="star" :scale="2" :grey="n > f.level" />
          </span>
          <span class="mw-p mw-dim">{{ f.placed ? 'I HUSET' : 'I SEKKEN' }}</span>
        </div>
      </div>
      <p v-else class="mw-p mw-dim mw-center">SEKKEN ER TOM. KJØP MØBLER I MØBELBUTIKKEN!</p>
    </template>

    <template v-else-if="tab === 'weapons'">
      <div v-if="weapons.length" class="mw-grid">
        <div v-for="w in weapons" :key="w.uid" class="mw-tile mw-tile--static" :class="{ 'mw-tile--on': w.uid === equipped }">
          <img v-if="pics.weapon(w, 96)" class="mw-pic" :src="pics.weapon(w, 96)" alt="">
          <span v-else class="mw-pic--empty" />
          <span class="mw-tile-name">{{ shy(w.name) }}</span>
          <span class="mw-stars" :aria-label="`Nivå ${w.level}`">
            <PxIcon v-for="n in 3" :key="n" id="star" :scale="2" :grey="n > w.level" />
          </span>
          <button
            v-if="w.uid === equipped"
            type="button"
            class="px-btn mw-btn mw-btn--plain"
            @click="equip(null)"
          >
            LEGG BORT
          </button>
          <button v-else type="button" class="px-btn mw-btn mw-btn--go" @click="equip(w.uid)">TA I HÅNDA</button>
        </div>
      </div>
      <div v-else class="mw-stack mw-center">
        <p class="mw-p mw-dim">DU HAR INGEN MAGISKE TING ENNÅ.</p>
        <p class="mw-p mw-dim">LAG EN I VERKSTEDET!</p>
      </div>
    </template>

    <template v-else>
      <div v-if="prizes.length" class="mw-grid">
        <div v-for="p in prizes" :key="p.key" class="mw-tile mw-tile--static">
          <img v-if="p.pic" class="mw-pic" :src="p.pic" alt="">
          <span v-else class="mw-pic--empty" />
          <span class="mw-tile-name">{{ shy(p.name) }}</span>
        </div>
      </div>
      <p v-else class="mw-p mw-dim mw-center">VINN PREMIER PÅ TIVOLIET!</p>
    </template>
  </Sheet>
</template>

<script setup lang="ts">
import { shy } from './text'
import { ref, computed } from 'vue'
import Sheet from './Sheet.vue'
import PxIcon from './PxIcon.vue'
import { useMw } from './context'
import { CLOTHES, furniture } from '../catalog'

const ctx = useMw()
const { game, pics } = ctx

type Tab = 'furniture' | 'weapons' | 'prizes'
const TABS: { id: Tab; name: string }[] = [
  { id: 'furniture', name: 'MØBLER' },
  { id: 'weapons', name: 'MAGI' },
  { id: 'prizes', name: 'PREMIER' },
]
const tab = ref<Tab>('furniture')

const save = computed(() => game.save.value)
const equipped = computed(() => save.value.equipped)
const weapons = computed(() => save.value.weapons)

const furnitureList = computed(() => {
  const placed = new Set(save.value.house.items.map(i => i.uid))
  return save.value.furniture
    .map((f) => {
      const def = furniture(f.id)
      return { uid: f.uid, level: f.level, name: def?.name ?? f.id, placed: placed.has(f.uid), pic: pics.furniture(f.id, f.level, 96), prize: def?.rarity === 'prize' || def?.rarity === 'royal' }
    })
    .filter(f => !f.prize)
    .sort((a, b) => Number(a.placed) - Number(b.placed))
})

const prizes = computed(() => {
  const s = save.value
  const clothes = CLOTHES.filter(d => (d.rarity === 'prize' || d.rarity === 'royal') && s.closet.includes(d.id))
    .map(d => ({ key: d.id, name: d.name, pic: pics.clothing(d, 96) }))
  const things = s.furniture
    .filter(f => ['prize', 'royal'].includes(furniture(f.id)?.rarity ?? ''))
    .map(f => ({ key: f.uid, name: furniture(f.id)?.name ?? f.id, pic: pics.furniture(f.id, f.level, 96) }))
  return [...things, ...clothes]
})

function equip(uid: string | null) {
  const r = game.equip(uid)
  if (!r.ok) { ctx.say(r.message); return }
  ctx.sfx('equip')
}
</script>

<style scoped>
.mw-root .mw-tile--static { cursor: default; }
.mw-root .mw-tile--static:active { transform: none; }
.mw-stars { display: flex; gap: 2px; }
</style>
