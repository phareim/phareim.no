<template>
  <!-- The theme card -->
  <Sheet v-if="stage === 'theme'" title="MOTEVISNING" icon="star" narrow @close="quit">
    <div class="mw-theme">
      <p class="mw-label mw-center">DAGENS TEMA ER</p>
      <p class="mw-theme-name mw-t">{{ themeName }}</p>
      <div class="mw-row mw-row--center">
        <div v-for="p in themePics" :key="p" class="mw-theme-pic"><img :src="p" alt=""></div>
      </div>
      <p class="mw-p mw-center">KLÆ DEG ETTER TEMAET!</p>
    </div>
    <template #footer>
      <button type="button" class="px-btn mw-btn mw-btn--go mw-btn--big" @click="stage = 'dress'">KLÆ DEG!</button>
    </template>
  </Sheet>

  <!-- Dress up: the wardrobe with the theme's pieces starred -->
  <Sheet v-else-if="stage === 'dress'" :title="`TEMA: ${themeName}`" icon="shirt" wide @close="quit">
    <div v-if="person" class="mw-fdress">
      <div class="mw-fdress-pic">
        <img v-if="portrait" class="mw-fdress-portrait" :src="portrait" alt="">
        <p class="mw-p mw-center">
          <PxIcon id="star" :scale="2" /> {{ matches }} PASSER
        </p>
      </div>
      <ClosetPicker :outfit="person.look.outfit" :owned="game.save.value.closet" :tag="theme" @pick="pick" />
    </div>
    <template #footer>
      <p class="mw-p mw-dim mw-fhint"><PxIcon id="star" :scale="2" /> = PASSER TIL TEMAET</p>
      <button type="button" class="px-btn mw-btn mw-btn--go mw-btn--big" @click="walk">GÅ PÅ SCENEN!</button>
    </template>
  </Sheet>

  <!-- The catwalk: the world runs, the judges sit along the bottom -->
  <div v-else class="mw-judges-layer">
    <div class="mw-judges px-box mw-box">
      <div v-for="(j, i) in JUDGES" :key="j.id" class="mw-judge" :class="{ 'mw-judge--in': i < shown }">
        <PxIcon :id="j.id" :scale="5" />
        <p class="mw-p mw-judge-name">{{ j.name }}</p>
        <p class="mw-judge-stars" :aria-label="i < shown ? `${score?.judges[i]!.stars} stjerner` : 'Venter'">
          <PxIcon v-for="n in 5" :key="n" id="star" :scale="2" :grey="i >= shown || n > (score?.judges[i]!.stars ?? 0)" />
        </p>
        <p v-if="i < shown" class="mw-p mw-judge-say">{{ score?.judges[i]!.reason }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import Sheet from './Sheet.vue'
import PxIcon from './PxIcon.vue'
import ClosetPicker from './ClosetPicker.vue'
import { useMw } from './context'
import { CLOTHES, FASHION_TAGS } from '../catalog'
import { drawFashionTheme, scoreFashion, wornPieces, JUDGES, type FashionScore } from '../core/contests'
import type { ClothingSlot } from '../types'

const emit = defineEmits<{ finish: [score: FashionScore] }>()

const ctx = useMw()
const { game, pics } = ctx

const seed = Math.floor(Math.random() * 1e9)
const theme = drawFashionTheme(seed, game.save.value.closet)
const themeName = FASHION_TAGS.find(t => t.id === theme)?.name ?? theme

const stage = ref<'theme' | 'dress' | 'catwalk'>('theme')
const person = computed(() => game.active.value)
const portrait = computed(() => (person.value ? pics.person(person.value.look, { full: true, size: 320 }) : ''))
const matches = computed(() => (person.value ? wornPieces(person.value.look.outfit).filter(id => CLOTHES.find(c => c.id === id)?.tags.includes(theme)).length : 0))

/** Three pieces that show the theme, the player's own first. */
const themePics = computed(() => {
  const own = new Set(game.save.value.closet)
  const list = CLOTHES.filter(c => c.tags.includes(theme)).sort((a, b) => Number(own.has(b.id)) - Number(own.has(a.id)))
  return list.slice(0, 3).map(c => pics.clothing(c, 128)).filter(Boolean)
})

ctx.setBusy(true)

function pick(slot: ClothingSlot, id: string | null) {
  const p = person.value
  if (!p) return
  const r = game.dress(p.id, slot, id)
  if (!r.ok) { ctx.say(r.message); return }
  ctx.sfx('dress')
}

const score = ref<FashionScore | null>(null)
const shown = ref(0)
const timers: ReturnType<typeof setTimeout>[] = []

function walk() {
  const p = person.value
  if (!p) return
  score.value = scoreFashion(p.look, theme, seed)
  stage.value = 'catwalk'
  ctx.setSeeThrough(true)
  ctx.runtime.value?.go({ kind: 'catwalk' })
  // The walk first, then one judge at a time.
  const start = 3200
  JUDGES.forEach((_, i) => {
    timers.push(setTimeout(() => { shown.value = i + 1; ctx.sfx('judge') }, start + i * 1300))
  })
  timers.push(setTimeout(() => {
    ctx.setSeeThrough(false)
    if (score.value) emit('finish', score.value)
  }, start + JUDGES.length * 1300 + 1400))
}

function quit() {
  ctx.close()
}

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  ctx.setSeeThrough(false)
  ctx.setBusy(false)
})
</script>

<style scoped>
.mw-theme { display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 8px 0; }
.mw-theme-name { margin: 0; font-size: 48px; line-height: 1; color: var(--mw-pink); text-shadow: 3px 3px 0 var(--mw-ink); text-align: center; }
.mw-theme-pic { width: 96px; height: 96px; background: var(--mw-tile); }
.mw-theme-pic img { width: 100%; height: 100%; image-rendering: pixelated; display: block; }
@media (max-width: 420px) {
  .mw-theme-name { font-size: 32px; }
  .mw-theme-pic { width: 80px; height: 80px; }
}

.mw-fdress { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.mw-fdress-pic { display: flex; flex-direction: column; align-items: center; gap: 4px; background: var(--mw-pink-soft); padding: 6px; }
.mw-fdress-portrait { height: 140px; width: auto; aspect-ratio: 4 / 5; object-fit: contain; image-rendering: pixelated; }
.mw-fdress-pic .mw-p { display: flex; align-items: center; gap: 6px; }
.mw-fhint { display: flex; align-items: center; gap: 6px; margin-right: auto; }
@media (min-width: 640px), (orientation: landscape) and (max-height: 500px) {
  .mw-fdress { grid-template-columns: minmax(150px, 30%) minmax(0, 1fr); align-items: start; }
  .mw-fdress-pic { position: sticky; top: 0; }
  .mw-fdress-portrait { width: 100%; height: auto; }
}
@media (orientation: landscape) and (max-height: 500px) {
  .mw-fdress { grid-template-columns: 140px minmax(0, 1fr); }
  .mw-fhint { display: none; }
}

.mw-judges-layer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  justify-content: center;
  padding: 0 max(12px, env(safe-area-inset-right, 0px)) calc(12px + var(--app-safe-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));
  pointer-events: none;
}
.mw-judges {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  width: 100%;
  max-width: 720px;
  padding: 10px;
}
.mw-judge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 2px;
  opacity: 0.5;
  transition: opacity 150ms ease-out;
}
.mw-judge--in { opacity: 1; }
.mw-judge--in .mw-judge-stars { animation: mw-in 160ms ease-out; }
.mw-judge-name { font-size: 16px; text-align: center; }
.mw-judge-stars { display: flex; gap: 1px; margin: 0; }
.mw-judge-say { color: #c0187a; text-align: center; font-size: 16px; }
@media (max-width: 420px) {
  .mw-judge-name { display: none; }
}
</style>
