<template>
  <Sheet title="SEND GAVE" icon="gift" :bits="bits" :back="step !== 'who' && !fixedTo" wide @back="back" @close="ctx.close()">
    <!-- 1. Who -->
    <template v-if="step === 'who'">
      <p class="mw-label">HVEM SKAL FÅ GAVEN?</p>
      <p v-if="!people.length" class="mw-p mw-dim mw-center">DU HAR INGEN VENNER ELLER NABOER ENNÅ. FINN DEM PÅ SLOTTET!</p>
      <div v-else class="mw-grid">
        <button v-for="p in people" :key="p.id" type="button" class="mw-tile" @click="pickWho(p.id)">
          <img v-if="p.pic" class="mw-pic" :src="p.pic" alt="">
          <span v-else class="mw-pic--empty" />
          <span class="mw-tile-name">{{ shy(p.name) }}</span>
        </button>
      </div>
    </template>

    <!-- 2. What -->
    <template v-else-if="step === 'what'">
      <p class="mw-label">HVA VIL DU GI TIL {{ toName }}?</p>
      <div class="mw-tabs" role="tablist">
        <button type="button" role="tab" class="px-btn mw-btn" :class="{ 'mw-on': kind === 'clothing' }" @click="kind = 'clothing'">KLÆR</button>
        <button type="button" role="tab" class="px-btn mw-btn" :class="{ 'mw-on': kind === 'furniture' }" @click="kind = 'furniture'">MØBLER</button>
        <button type="button" role="tab" class="px-btn mw-btn" :class="{ 'mw-on': kind === 'bits' }" @click="kind = 'bits'">BITS</button>
      </div>
      <div v-if="kind === 'clothing'" class="mw-grid">
        <button v-for="c in clothesList" :key="c.id" type="button" class="mw-tile" :disabled="!c.ok" @click="choose({ kind: 'clothing', id: c.id })">
          <img v-if="c.pic" class="mw-pic" :src="c.pic" alt="">
          <span v-else class="mw-pic--empty" />
          <span class="mw-tile-name">{{ shy(c.name) }}</span>
        </button>
      </div>
      <div v-else-if="kind === 'furniture'" class="mw-grid">
        <button v-for="f in furnitureList" :key="f.uid" type="button" class="mw-tile" :disabled="!f.ok" @click="choose({ kind: 'furniture', uid: f.uid })">
          <img v-if="f.pic" class="mw-pic" :src="f.pic" alt="">
          <span v-else class="mw-pic--empty" />
          <span class="mw-tile-name">{{ shy(f.name) }}</span>
          <span v-if="f.placed" class="mw-p mw-dim">I HUSET</span>
        </button>
        <p v-if="!furnitureList.length" class="mw-p mw-dim">DU HAR INGEN MØBLER Å GI.</p>
      </div>
      <div v-else class="mw-row mw-row--center mw-amounts">
        <button
          v-for="n in [10, 25, 50]"
          :key="n"
          type="button"
          class="px-btn mw-btn mw-btn--big"
          :disabled="bits < n"
          @click="choose({ kind: 'bits', amount: n })"
        >
          <PxIcon id="coin" :scale="3" />{{ n }}
        </button>
      </div>
    </template>

    <!-- 3. Sure? -->
    <div v-else class="mw-sure">
      <div class="mw-sure-pic">
        <img v-if="choicePic" :src="choicePic" alt="">
        <PxIcon v-else id="coin" :scale="10" />
      </div>
      <p class="mw-h mw-center">SENDE {{ choiceName }} TIL {{ toName }}?</p>
      <p v-if="choicePlaced" class="mw-p mw-warn mw-center">DEN BLIR BORTE FRA HUSET DITT.</p>
      <p v-if="problem" class="mw-p mw-warn mw-center">{{ problem }}</p>
    </div>

    <template v-if="step === 'sure'" #footer>
      <button type="button" class="px-btn mw-btn mw-btn--plain" @click="step = 'what'">NEI</button>
      <button type="button" class="px-btn mw-btn mw-btn--go mw-btn--big" :disabled="sending" @click="send">
        <PxIcon id="gift" :scale="2" />SEND!
      </button>
    </template>
  </Sheet>
</template>

<script setup lang="ts">
import { shy } from './text'
import { ref, computed, onMounted } from 'vue'
import Sheet from './Sheet.vue'
import PxIcon from './PxIcon.vue'
import { useMw, socialLine } from './context'
import { CLOTHES, clothing, furniture } from '../catalog'
import type { GiftChoice } from '~/composables/useMiniWorldSocial'

const props = defineProps<{ to: string | null }>()

const ctx = useMw()
const { game, social, pics } = ctx

const fixedTo = computed(() => !!props.to)
const to = ref<string | null>(props.to)
const step = ref<'who' | 'what' | 'sure'>(props.to ? 'what' : 'who')
const kind = ref<'clothing' | 'furniture' | 'bits'>('clothing')
const choice = ref<GiftChoice | null>(null)
const sending = ref(false)
const problem = ref('')
const bits = computed(() => game.bits.value)

/** Friends and neighbours, once each, never me. */
const people = computed(() => {
  const s = social.state.value
  const me = social.me.value
  const seen = new Set<string>()
  const out: { id: string; name: string; pic: string }[] = []
  const add = (id: string, name: string, look: Parameters<typeof pics.person>[0] | null | undefined) => {
    if (id === me || seen.has(id)) return
    seen.add(id)
    out.push({ id, name, pic: look ? pics.person(look, { size: 112 }) : '' })
  }
  for (const f of s?.friends ?? []) add(f.id, f.person?.name ?? f.playerName, f.person?.look)
  for (const m of s?.hood?.members ?? []) add(m.id, m.person?.name ?? m.playerName, m.person?.look)
  return out
})
const toName = computed(() => people.value.find(p => p.id === to.value)?.name ?? '')

onMounted(() => { if (!social.state.value) void social.refresh() })

function pickWho(id: string) {
  to.value = id
  step.value = 'what'
  ctx.sfx('click')
}

function back() {
  if (step.value === 'sure') step.value = 'what'
  else if (!fixedTo.value) step.value = 'who'
}

const clothesList = computed(() => CLOTHES
  .filter(d => game.save.value.closet.includes(d.id))
  .map(d => ({ id: d.id, name: d.name, pic: pics.clothing(d, 96), ok: game.canGiveAway('clothing', d.id).ok })))

const furnitureList = computed(() => {
  const placed = new Set(game.save.value.house.items.map(i => i.uid))
  return game.save.value.furniture.map(f => ({
    uid: f.uid,
    name: furniture(f.id)?.name ?? f.id,
    pic: pics.furniture(f.id, f.level, 96),
    placed: placed.has(f.uid),
    ok: game.canGiveAway('furniture', f.uid).ok,
  }))
})

function choose(c: GiftChoice) {
  choice.value = c
  problem.value = ''
  step.value = 'sure'
  ctx.sfx('click')
}

const choiceName = computed(() => {
  const c = choice.value
  if (!c) return ''
  if (c.kind === 'bits') return `${c.amount} BITS`
  if (c.kind === 'clothing') return clothing(c.id)?.name ?? ''
  const f = game.save.value.furniture.find(x => x.uid === c.uid)
  return furniture(f?.id)?.name ?? ''
})
const choicePic = computed(() => {
  const c = choice.value
  if (!c || c.kind === 'bits') return ''
  if (c.kind === 'clothing') { const d = clothing(c.id); return d ? pics.clothing(d, 256) : '' }
  const f = game.save.value.furniture.find(x => x.uid === c.uid)
  return f ? pics.furniture(f.id, f.level, 256) : ''
})
const choicePlaced = computed(() => {
  const c = choice.value
  return c?.kind === 'furniture' && game.save.value.house.items.some(i => i.uid === c.uid)
})

async function send() {
  const c = choice.value
  if (!c || !to.value || sending.value) return
  sending.value = true
  const pic = choicePic.value
  const r = await social.sendGift(to.value, c)
  sending.value = false
  if (r !== 'ok') {
    problem.value = socialLine(r)
    ctx.sfx('poor')
    return
  }
  ctx.sfx('gift')
  ctx.cheer(`GAVEN ER SENDT TIL ${toName.value}!`, pic || undefined)
  ctx.close()
}
</script>

<style scoped>
.mw-amounts { padding: 16px 0; }
.mw-sure { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.mw-sure-pic {
  width: 180px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mw-yellow-soft);
}
.mw-sure-pic img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
@media (max-height: 420px) {
  .mw-sure-pic { width: 110px; height: 110px; }
}
</style>
