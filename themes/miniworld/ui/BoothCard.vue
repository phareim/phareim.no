<template>
  <!-- A booth on Tivoliet: what you do, what you can win, your best, and Spill. -->
  <Sheet :title="info.title" icon="star" @close="ctx.close()">
    <div class="mw-booth">
      <ul class="mw-booth-how">
        <li v-for="l in info.how" :key="l" class="mw-p">{{ l }}</li>
      </ul>

      <div class="mw-booth-win">
        <p class="mw-label">DU KAN VINNE</p>
        <div class="mw-booth-prizes">
          <div class="mw-booth-bits mw-p"><PxIcon id="coin" :scale="3" />BITS</div>
          <div v-for="p in prizePics" :key="p.id" class="mw-booth-prize" :class="{ 'mw-booth-prize--got': p.got }">
            <img v-if="p.pic" :src="p.pic" :alt="p.name">
            <span v-if="p.got" class="mw-tag mw-tag--mint">HAR</span>
          </div>
        </div>
        <p class="mw-p mw-dim">{{ info.win }}</p>
      </div>

      <p v-if="bestLine" class="mw-p mw-best"><PxIcon id="star" :scale="2" />{{ bestLine }}</p>

      <!-- Obby: pick a level -->
      <div v-if="contest === 'obby'" class="mw-levels">
        <button
          v-for="l in LEVELS"
          :key="l.id"
          type="button"
          class="px-btn mw-btn mw-btn--big mw-level"
          :style="{ background: l.color }"
          @click="ctx.play('obby', { level: l.id })"
        >
          <span>{{ l.name }}</span>
          <img v-if="trophy(l.id)" class="mw-level-trophy" :src="trophy(l.id)" alt="Pokal">
          <span v-if="obbyBest(l.id)" class="mw-level-best">{{ obbyBest(l.id) }}</span>
        </button>
      </div>

      <!-- Memory: pick a size -->
      <div v-else-if="contest === 'memory'" class="mw-levels">
        <button
          v-for="(n, i) in MEMORY_SIZES"
          :key="n"
          type="button"
          class="px-btn mw-btn mw-btn--big mw-level"
          :style="{ background: LEVELS[i]!.color }"
          @click="ctx.play('memory', { pairs: n })"
        >
          <span>{{ n }} PAR</span>
          <span class="mw-level-best">{{ LEVELS[i]!.name }}</span>
        </button>
      </div>
    </div>

    <template v-if="contest === 'stars' || contest === 'fashion'" #footer>
      <button type="button" class="px-btn mw-btn mw-btn--go mw-btn--big" @click="ctx.play(contest)">SPILL!</button>
    </template>
  </Sheet>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Sheet from './Sheet.vue'
import PxIcon from './PxIcon.vue'
import { useMw } from './context'
import { clothing, furniture } from '../catalog'
import { REWARDS, MEMORY_SIZES } from '../core/contests'
import type { ContestId, ObbyLevel } from '../types'

const props = defineProps<{ contest: ContestId }>()

const ctx = useMw()
const { game, pics } = ctx

const LEVELS: { id: ObbyLevel; name: string; color: string }[] = [
  { id: 'easy', name: 'LETT', color: '#d4f7e1' },
  { id: 'medium', name: 'MIDDELS', color: '#fff3b8' },
  { id: 'hard', name: 'VANSKELIG', color: '#ffd6ee' },
]

const INFO: Record<ContestId, { title: string; how: string[]; win: string; prizes: readonly string[] }> = {
  obby: {
    title: 'OBBY-TÅRNET',
    how: ['HOPP FRA KLOSS TIL KLOSS.', 'IKKE TRÅKK PÅ DET RØDE!', 'KOM TIL FLAGGET.'],
    win: 'EN POKAL FØRSTE GANG DU KLARER ET NIVÅ.',
    prizes: [REWARDS.obby.trophy.easy, REWARDS.obby.trophy.medium, REWARDS.obby.trophy.hard, ...REWARDS.obby.firstExtras.easy],
  },
  stars: {
    title: 'STJERNEJAKT',
    how: ['SAMLE STJERNER PÅ ENGA.', 'DU HAR 45 SEKUNDER.'],
    win: `${REWARDS.stars.winAt} STJERNER GIR PREMIER.`,
    prizes: REWARDS.stars.prizes,
  },
  fashion: {
    title: 'MOTEVISNING',
    how: ['DU FÅR ET TEMA.', 'KLÆ DEG ETTER TEMAET.', 'GÅ PÅ SCENEN. DOMMERNE GIR STJERNER.'],
    win: `${REWARDS.fashion.winAt} STJERNER GIR PREMIER.`,
    prizes: REWARDS.fashion.prizes,
  },
  memory: {
    title: 'HUSKESPILL',
    how: ['SNU TO KORT.', 'FINN DE SOM ER LIKE.', 'JO FÆRRE TREKK, JO FLERE BITS.'],
    win: `${REWARDS.memory.prizePairs} PAR GIR PREMIER.`,
    prizes: REWARDS.memory.prizes,
  },
}

const info = computed(() => INFO[props.contest])

const prizePics = computed(() => info.value.prizes.map((id) => {
  const c = clothing(id)
  const f = furniture(id)
  return {
    id,
    name: c?.name ?? f?.name ?? id,
    pic: c ? pics.clothing(c, 96) : f ? pics.furniture(id, 1, 96) : '',
    got: game.save.value.prizes.includes(id),
  }
}))

const rec = computed(() => game.save.value.contests)
const bestLine = computed(() => {
  const r = rec.value
  if (props.contest === 'stars' && r.stars.best !== null) return `DIN BESTE: ${r.stars.best} STJERNER`
  if (props.contest === 'fashion' && r.fashion.best !== null) return `DIN BESTE: ${r.fashion.best} STJERNER`
  if (props.contest === 'memory' && r.memory.best !== null) return `DIN BESTE: ${r.memory.best} TREKK`
  return ''
})
const obbyBest = (l: ObbyLevel) => {
  const b = rec.value.obby[l].best
  return b === null ? '' : `${Math.round(b)} S`
}
const trophy = (l: ObbyLevel) => (rec.value.obby[l].wins > 0 ? pics.furniture(REWARDS.obby.trophy[l], 1, 64) : '')
</script>

<style scoped>
.mw-booth { display: flex; flex-direction: column; gap: 14px; }
.mw-booth-how { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.mw-booth-how li { position: relative; padding-left: 24px; }
.mw-booth-how li::before { content: '▶'; position: absolute; left: 0; color: var(--mw-pink); }
.mw-booth-win { display: flex; flex-direction: column; gap: 8px; padding: 10px; background: var(--mw-yellow-soft); }
.mw-booth-prizes { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.mw-booth-bits { display: flex; align-items: center; gap: 6px; padding-right: 6px; }
.mw-booth-prize { position: relative; width: 64px; height: 64px; background: var(--mw-paper); }
.mw-booth-prize img { width: 100%; height: 100%; image-rendering: pixelated; display: block; }
.mw-booth-prize--got { background: var(--mw-mint-soft); }
.mw-booth-prize .mw-tag { top: auto; bottom: 0; right: 0; }
.mw-best { display: flex; align-items: center; gap: 8px; }
.mw-levels { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.mw-root .px-btn.mw-btn.mw-level {
  flex-direction: column;
  gap: 6px;
  min-height: 96px;
  padding: 8px 4px;
  color: var(--mw-ink);
}
@media (hover: hover) {
  .mw-root .px-btn.mw-btn.mw-level:hover { color: var(--mw-ink); filter: brightness(0.95); }
}
.mw-level-trophy { width: 40px; height: 40px; image-rendering: pixelated; }
.mw-level-best { font-size: 16px; }
@media (max-width: 480px) {
  .mw-levels { grid-template-columns: 1fr; gap: 12px; }
  .mw-root .px-btn.mw-btn.mw-level { flex-direction: row; justify-content: space-between; min-height: 64px; padding: 0 16px; }
}
</style>
