<template>
  <Sheet title="POSTKASSA" icon="gift" @close="ctx.close()">
    <!-- A gift just opened -->
    <div v-if="opened" class="mw-opened">
      <div class="mw-opened-pic" :class="{ 'mw-opened-pic--in': true }">
        <img v-if="openedPic" :src="openedPic" alt="">
        <PxIcon v-else-if="opened.kind === 'bits'" id="coin" :scale="10" />
      </div>
      <p class="mw-h mw-center">{{ openedName }}</p>
      <p class="mw-p mw-dim mw-center">FRA {{ fromName(opened) }}</p>
      <p class="mw-p mw-center">{{ opened.kind === 'clothing' ? 'DEN HENGER I GARDEROBEN.' : opened.kind === 'furniture' ? 'DEN LIGGER I SEKKEN.' : 'BITSENE ER DINE!' }}</p>
    </div>

    <template v-else>
      <p v-if="problem" class="mw-p mw-warn mw-center">{{ problem }}</p>
      <p v-if="!gifts.length && !loading" class="mw-p mw-dim mw-center mw-empty">POSTKASSA ER TOM.</p>
      <p v-else-if="!gifts.length" class="mw-p mw-dim mw-center mw-empty">HENTER …</p>
      <div v-else class="mw-grid">
        <button
          v-for="g in gifts"
          :key="g.id"
          type="button"
          class="mw-tile mw-parcel"
          :class="{ 'mw-parcel--open': opening === g.id }"
          :disabled="!!opening"
          @click="open(g)"
        >
          <span class="mw-parcel-pic"><PxIcon id="gift" :scale="6" /></span>
          <span class="mw-tile-name">FRA {{ fromName(g) }}</span>
        </button>
      </div>
    </template>

    <template #footer>
      <button v-if="opened" type="button" class="px-btn mw-btn mw-btn--go" @click="opened = null">
        {{ gifts.length ? 'NESTE GAVE' : 'FERDIG' }}
      </button>
      <button v-else type="button" class="px-btn mw-btn mw-btn--plain" @click="ctx.close()">LUKK</button>
    </template>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Sheet from './Sheet.vue'
import PxIcon from './PxIcon.vue'
import { useMw, socialLine } from './context'
import { clothing, furniture } from '../catalog'
import type { Gift } from '../types'

const ctx = useMw()
const { social, pics } = ctx

const gifts = computed(() => social.state.value?.inbox ?? [])
const opening = ref<string | null>(null)
const opened = ref<Gift | null>(null)
const problem = ref('')
const loading = ref(true)

onMounted(async () => {
  const r = await social.refresh()
  loading.value = false
  if (r !== 'ok') problem.value = socialLine(r)
})

const fromName = (g: Gift) => g.from.personName ?? g.from.playerName

const openedName = computed(() => {
  const g = opened.value
  if (!g) return ''
  if (g.kind === 'bits') return `${g.amount ?? 0} BITS`
  if (g.kind === 'clothing') return clothing(g.item)?.name ?? ''
  return furniture(g.item)?.name ?? ''
})
const openedPic = computed(() => {
  const g = opened.value
  if (!g || !g.item) return ''
  if (g.kind === 'clothing') { const d = clothing(g.item); return d ? pics.clothing(d, 256) : '' }
  if (g.kind === 'furniture') return pics.furniture(g.item, g.level ?? 1, 256)
  return ''
})

async function open(g: Gift) {
  if (opening.value) return
  opening.value = g.id
  ctx.sfx('open')
  // The unwrap wiggle plays while the server answers.
  const [res] = await Promise.all([social.openGift(g.id), new Promise(r => setTimeout(r, 360))])
  opening.value = null
  if (res.result !== 'ok' || !res.gift) {
    problem.value = socialLine(res.result)
    ctx.sfx('poor')
    return
  }
  problem.value = ''
  opened.value = res.gift
  ctx.sfx('gift')
}
</script>

<style scoped>
.mw-empty { padding: 24px 0; }
.mw-parcel-pic {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  max-width: 96px;
}
.mw-parcel--open .mw-parcel-pic { animation: mw-wiggle 120ms steps(2) 3; }
@keyframes mw-wiggle {
  0% { transform: translate(-3px, 0) rotate(-6deg); }
  100% { transform: translate(3px, -3px) rotate(6deg); }
}
.mw-opened { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 8px 0; }
.mw-opened-pic {
  width: 180px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mw-yellow-soft);
}
.mw-opened-pic img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
.mw-opened-pic--in { animation: mw-in 160ms ease-out; }
@media (max-height: 420px) {
  .mw-opened-pic { width: 120px; height: 120px; }
}
</style>
