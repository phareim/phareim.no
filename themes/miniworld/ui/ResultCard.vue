<template>
  <Sheet :title="result.title" icon="star" narrow :closable="false">
    <div class="mw-result">
      <p class="mw-h mw-center">{{ result.line }}</p>
      <p class="mw-result-bits mw-t" :class="{ 'mw-result-bits--in': shownBits > 0 }">
        <PxIcon id="coin" :scale="4" />+{{ shownBits }}
      </p>
      <p v-if="result.newBest" class="mw-result-best mw-t">NY REKORD!</p>

      <div v-if="result.prizes.length" class="mw-result-prizes">
        <p class="mw-label mw-center">{{ revealed === 0 ? 'OG DU VANT …' : 'DU VANT!' }}</p>
        <div class="mw-row mw-row--center">
          <div v-for="(p, i) in prizes" :key="p.id" class="mw-result-prize" :class="{ 'mw-result-prize--in': i < revealed }">
            <template v-if="i < revealed">
              <img v-if="p.pic" :src="p.pic" alt="">
              <span class="mw-p mw-center">{{ p.name }}</span>
            </template>
            <PxIcon v-else id="gift" :scale="5" />
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <button v-if="result.again" type="button" class="px-btn mw-btn mw-btn--sky" :disabled="!done" @click="again">SPILL IGJEN</button>
      <button type="button" class="px-btn mw-btn mw-btn--go mw-btn--big" :disabled="!done" @click="$emit('done')">FERDIG</button>
    </template>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Sheet from './Sheet.vue'
import PxIcon from './PxIcon.vue'
import { useMw, type ResultCard } from './context'
import { clothing, furniture } from '../catalog'

const props = defineProps<{ result: ResultCard }>()
const emit = defineEmits<{ done: [] }>()

const ctx = useMw()
const { pics } = ctx

const prizes = computed(() => props.result.prizes.map((id) => {
  const c = clothing(id)
  const f = furniture(id)
  return { id, name: c?.name ?? f?.name ?? '', pic: c ? pics.clothing(c, 128) : f ? pics.furniture(id, 1, 128) : '' }
}))

const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const shownBits = ref(reduced ? props.result.bits : 0)
const revealed = ref(reduced ? props.result.prizes.length : 0)
const done = ref(reduced)

const timers: ReturnType<typeof setTimeout>[] = []
const later = (ms: number, fn: () => void) => { timers.push(setTimeout(fn, ms)) }

onMounted(() => {
  ctx.sfx(props.result.prizes.length || props.result.newBest ? 'fanfare' : 'win')
  if (reduced) return
  // Bits count up quickly, then each prize unwraps in turn.
  const total = props.result.bits
  const steps = Math.min(12, Math.max(1, total))
  for (let i = 1; i <= steps; i++) later(i * 40, () => { shownBits.value = Math.round((total * i) / steps) })
  if (total > 0) later(steps * 40, () => ctx.sfx('coin'))
  let t = steps * 40 + 500
  props.result.prizes.forEach((_, i) => {
    later(t, () => { revealed.value = i + 1; ctx.sfx('gift') })
    t += 700
  })
  later(t - 300, () => { done.value = true })
})
onBeforeUnmount(() => timers.forEach(clearTimeout))

function again() {
  const a = props.result.again
  if (!a) return
  emit('done')
  if (a.contest === 'obby' || a.contest === 'stars') ctx.play(a.contest, { level: a.level })
  else ctx.open({ id: 'booth', contest: a.contest })
}
</script>

<style scoped>
.mw-result { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 8px 0; }
.mw-result-bits { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 48px; line-height: 1; }
.mw-result-best {
  margin: 0;
  padding: 6px 12px;
  font-size: 24px;
  color: #fff;
  background: var(--mw-pink);
  animation: mw-in 160ms ease-out;
}
.mw-result-prizes { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.mw-result-prize {
  width: 112px;
  min-height: 112px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px;
  background: var(--mw-tile);
}
.mw-result-prize--in { background: var(--mw-yellow-soft); animation: mw-in 160ms ease-out; }
.mw-result-prize img { width: 80px; height: 80px; image-rendering: pixelated; }
@media (max-height: 420px) {
  .mw-result-bits { font-size: 32px; }
  .mw-result-prize { width: 88px; min-height: 88px; }
  .mw-result-prize img { width: 56px; height: 56px; }
}
</style>
