<template>
  <Sheet title="SLOTTET" icon="crown" wide @close="ctx.close()">
    <div class="mw-tabs" role="tablist">
      <button type="button" role="tab" class="px-btn mw-btn" :class="{ 'mw-on': tab === 'friends' }" :aria-selected="tab === 'friends'" @click="tab = 'friends'">VENNER</button>
      <button type="button" role="tab" class="px-btn mw-btn" :class="{ 'mw-on': tab === 'hood' }" :aria-selected="tab === 'hood'" @click="tab = 'hood'">NABOLAG</button>
    </div>

    <p v-if="line" class="mw-p mw-flash" :class="{ 'mw-warn': lineBad }" role="status">{{ line }}</p>

    <!-- Could not reach the server, and nothing to show from before -->
    <div v-if="!state && !loading" class="mw-stack mw-center mw-offline">
      <p class="mw-h">{{ firstProblem || 'FÅR IKKE KONTAKT AKKURAT NÅ.' }}</p>
      <div class="mw-row mw-row--center">
        <button type="button" class="px-btn mw-btn mw-btn--sky" @click="refresh">PRØV IGJEN</button>
      </div>
    </div>
    <p v-else-if="!state" class="mw-p mw-dim mw-center">HENTER …</p>

    <!-- Friends -->
    <div v-else-if="tab === 'friends'" class="mw-stack">
      <section class="mw-card mw-card--code">
        <p class="mw-label">DIN KODE</p>
        <p class="mw-mycode mw-t" :aria-label="`Din kode: ${state.me.code.split('').join(' ')}`">{{ state.me.code }}</p>
        <p class="mw-p mw-dim">GI DEN TIL EN VENN.</p>
      </section>

      <section class="mw-card">
        <p class="mw-label">NY VENN? SKRIV KODEN DERES</p>
        <div class="mw-row">
          <CodeBoxes v-model="friendCode" label="Vennekode" @enter="addFriend" />
          <button type="button" class="px-btn mw-btn mw-btn--go" :disabled="friendCode.length < 6 || busy" @click="addFriend">LEGG TIL</button>
        </div>
      </section>

      <p v-if="!state.friends.length" class="mw-p mw-dim mw-center">DU HAR INGEN VENNER HER ENNÅ.</p>
      <ul v-else class="mw-list">
        <li v-for="f in state.friends" :key="f.id" class="mw-member">
          <div class="mw-member-pic">
            <img v-if="f.person && pic(f.person.look)" :src="pic(f.person.look)" alt="">
          </div>
          <div class="mw-member-main">
            <p class="mw-p mw-member-name">{{ f.person?.name ?? f.playerName }}</p>
            <p class="mw-p mw-dim mw-small">{{ f.playerName }}</p>
            <div class="mw-row">
              <button type="button" class="px-btn mw-btn mw-btn--sky" @click="ctx.visit(f.id)">BESØK</button>
              <button type="button" class="px-btn mw-btn mw-btn--pink" @click="ctx.open({ id: 'gift', to: f.id })">
                <PxIcon id="gift" :scale="2" />SEND GAVE
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- Neighbourhood -->
    <div v-else class="mw-stack">
      <template v-if="!hood">
        <section class="mw-card">
          <p class="mw-h">LAG ET NABOLAG</p>
          <p class="mw-p mw-dim">DA FÅR DU EN KODE DE ANDRE KAN BLI MED MED.</p>
          <div class="mw-row"><button type="button" class="px-btn mw-btn mw-btn--go" :disabled="busy" @click="createHood">LAG NABOLAG</button></div>
        </section>
        <section class="mw-card">
          <p class="mw-h">BLI MED</p>
          <p class="mw-p mw-dim">SKRIV KODEN TIL NABOLAGET.</p>
          <div class="mw-row">
            <CodeBoxes v-model="hoodCode" label="Nabolagskode" @enter="joinHood" />
            <button type="button" class="px-btn mw-btn mw-btn--go" :disabled="hoodCode.length < 6 || busy" @click="joinHood">BLI MED</button>
          </div>
        </section>
      </template>

      <template v-else>
        <section class="mw-card mw-card--code">
          <p class="mw-h">{{ hood.name }}</p>
          <p class="mw-label">KODE FOR Å BLI MED</p>
          <p class="mw-mycode mw-t">{{ hood.code }}</p>
        </section>

        <!-- The ruler picks king or queen, once -->
        <section v-if="social.isRuler.value && !social.myTitle.value" class="mw-card mw-card--crown">
          <PxIcon id="crown" :scale="5" />
          <p class="mw-h mw-center">DU HAR FÅTT KRONEN!</p>
          <p class="mw-p mw-center">VIL DU VÆRE KONGE ELLER DRONNING?</p>
          <div class="mw-row mw-row--center">
            <button type="button" class="px-btn mw-btn mw-btn--big" :disabled="busy" @click="crown('king')">KONGE</button>
            <button type="button" class="px-btn mw-btn mw-btn--big mw-btn--pink" :disabled="busy" @click="crown('queen')">DRONNING</button>
          </div>
        </section>

        <p class="mw-p mw-dim">ALLE HAR EN STEMME. DEN MED FLEST STEMMER FÅR KRONEN.</p>
        <ul class="mw-list">
          <li v-for="m in members" :key="m.id" class="mw-member" :class="{ 'mw-member--ruler': m.id === hood.ruler }">
            <div class="mw-member-pic">
              <img v-if="m.person && pic(m.person.look)" :src="pic(m.person.look)" alt="">
            </div>
            <div class="mw-member-main">
              <p class="mw-p mw-member-name">
                <PxIcon v-if="m.id === hood.ruler" id="crown" :scale="2" />
                {{ m.person?.name ?? m.playerName }}<template v-if="m.id === me"> (DEG)</template>
              </p>
              <p class="mw-p mw-small">
                <span v-if="m.title" class="mw-title">{{ TITLE_NAMES[m.title] }}</span>
                <span class="mw-dim">{{ m.votes }} {{ m.votes === 1 ? 'STEMME' : 'STEMMER' }}</span>
              </p>
              <div class="mw-row">
                <span v-if="hood.myVote === m.id" class="mw-p mw-voted"><PxIcon id="heart" :scale="2" />DIN STEMME</span>
                <button v-else type="button" class="px-btn mw-btn mw-btn--plain" :disabled="busy" @click="vote(m.id)">STEM</button>
                <template v-if="m.id !== me">
                  <button type="button" class="px-btn mw-btn mw-btn--sky" @click="ctx.visit(m.id)">BESØK</button>
                  <button type="button" class="px-btn mw-btn mw-btn--pink" aria-label="Send gave" @click="ctx.open({ id: 'gift', to: m.id })">
                    <PxIcon id="gift" :scale="2" />
                  </button>
                  <button v-if="social.isRuler.value" type="button" class="px-btn mw-btn mw-btn--plain" @click="titleFor = titleFor === m.id ? null : m.id">
                    <PxIcon id="crown" :scale="2" />TITTEL
                  </button>
                </template>
              </div>
              <div v-if="titleFor === m.id" class="mw-row mw-titles">
                <button
                  v-for="t in GIVABLE"
                  :key="t"
                  type="button"
                  class="px-btn mw-btn"
                  :class="m.title === t ? 'mw-btn--pink' : 'mw-btn--plain'"
                  :disabled="busy"
                  @click="giveTitle(m.id, t)"
                >
                  {{ TITLE_NAMES[t] }}
                </button>
                <button v-if="m.title" type="button" class="px-btn mw-btn mw-btn--plain" :disabled="busy" @click="giveTitle(m.id, null)">INGEN</button>
              </div>
            </div>
          </li>
        </ul>

        <section class="mw-card">
          <div v-if="confirmLeave" class="mw-stack">
            <p class="mw-p mw-warn">VIL DU FLYTTE UT AV {{ hood.name }}?</p>
            <div class="mw-row">
              <button type="button" class="px-btn mw-btn mw-btn--danger" :disabled="busy" @click="leave">JA, FLYTT UT</button>
              <button type="button" class="px-btn mw-btn mw-btn--plain" @click="confirmLeave = false">NEI</button>
            </div>
          </div>
          <div v-else class="mw-row"><button type="button" class="px-btn mw-btn mw-btn--plain" @click="confirmLeave = true">FLYTT UT</button></div>
        </section>
      </template>
    </div>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Sheet from './Sheet.vue'
import PxIcon from './PxIcon.vue'
import CodeBoxes from './CodeBoxes.vue'
import { useMw, socialLine } from './context'
import type { SocialResult } from '~/composables/useMiniWorldSocial'
import type { PersonLook, RoyalTitle } from '../types'

const ctx = useMw()
const { social, pics, game } = ctx

const TITLE_NAMES: Record<RoyalTitle, string> = { king: 'KONGE', queen: 'DRONNING', prince: 'PRINS', princess: 'PRINSESSE' }
const GIVABLE: RoyalTitle[] = ['prince', 'princess', 'king', 'queen']

const tab = ref<'friends' | 'hood'>('friends')
const state = computed(() => social.state.value)
const hood = computed(() => state.value?.hood ?? null)
const me = computed(() => social.me.value)
const busy = computed(() => social.busy.value)
/** Members by votes; my own row shows my active person even before the profile publish lands. */
const members = computed(() => [...(hood.value?.members ?? [])]
  .map((m) => {
    const mine = m.id === me.value ? game.active.value : null
    return mine ? { ...m, person: { name: mine.name, look: mine.look } } : m
  })
  .sort((a, b) => b.votes - a.votes))

const friendCode = ref('')
const hoodCode = ref('')
const titleFor = ref<string | null>(null)
const confirmLeave = ref(false)
const loading = ref(true)
const firstProblem = ref('')

const line = ref('')
const lineBad = ref(false)
let lineTimer: ReturnType<typeof setTimeout> | undefined
function show(text: string, bad: boolean) {
  line.value = text
  lineBad.value = bad
  if (lineTimer) clearTimeout(lineTimer)
  lineTimer = setTimeout(() => { line.value = '' }, 3500)
}
onBeforeUnmount(() => { if (lineTimer) clearTimeout(lineTimer) })

/** Shows the result; true when it went well. */
function answer(r: SocialResult, good?: string): boolean {
  if (r === 'ok') {
    if (good) show(good, false)
    return true
  }
  ctx.sfx('poor')
  show(socialLine(r), true)
  return false
}

const pic = (look: PersonLook) => pics.person(look, { size: 112 })

async function refresh() {
  loading.value = true
  const r = await social.refresh()
  loading.value = false
  firstProblem.value = r === 'ok' ? '' : socialLine(r)
}
onMounted(refresh)

async function addFriend() {
  if (friendCode.value.length < 6) return
  const r = await social.addFriend(friendCode.value)
  if (answer(r, 'NY VENN!')) { friendCode.value = ''; ctx.sfx('fanfare') }
}

async function createHood() {
  const r = await social.createHood()
  if (answer(r)) {
    ctx.sfx('fanfare')
    const h = social.state.value?.hood
    if (h) ctx.cheer(`${h.name}! KODE: ${h.code}`)
  }
}

async function joinHood() {
  if (hoodCode.value.length < 6) return
  const r = await social.joinHood(hoodCode.value)
  if (answer(r)) {
    hoodCode.value = ''
    ctx.sfx('fanfare')
    const h = social.state.value?.hood
    if (h) ctx.cheer(`VELKOMMEN TIL ${h.name}!`)
  }
}

async function vote(id: string) {
  const r = await social.vote(id)
  if (answer(r, 'DU HAR STEMT!')) ctx.sfx('click')
}

async function crown(title: 'king' | 'queen') {
  const r = await social.crown(title)
  if (!answer(r)) return
  ctx.sfx('crown')
  const p = game.active.value
  const crownId = title === 'king' ? 'crown-king' : 'crown-queen'
  const look = p ? { ...p.look, outfit: { ...p.look.outfit, hat: crownId } } : null
  ctx.cheer(title === 'king' ? 'LENGE LEVE KONGEN!' : 'LENGE LEVE DRONNINGEN!', look ? pics.person(look, { full: true, size: 256, pose: 'cheer' }) : undefined)
}

async function giveTitle(id: string, title: RoyalTitle | null) {
  const r = await social.giveTitle(id, title)
  if (answer(r, title ? `NÅ ER HEN ${TITLE_NAMES[title]}!` : 'TITTELEN ER TATT TILBAKE.')) {
    ctx.sfx(title ? 'crown' : 'click')
    titleFor.value = null
  }
}

async function leave() {
  const r = await social.leaveHood()
  confirmLeave.value = false
  answer(r, 'DU HAR FLYTTET UT.')
}
</script>

<style scoped>
.mw-card {
  padding: 12px;
  background: var(--mw-tile);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mw-card--code { align-items: flex-start; background: var(--mw-yellow-soft); }
.mw-card--crown { align-items: center; background: var(--mw-pink-soft); }
.mw-mycode {
  margin: 0;
  font-size: 48px;
  letter-spacing: 0.25em;
  line-height: 1;
}
.mw-flash {
  padding: 8px 12px;
  background: var(--mw-mint-soft);
  margin-bottom: 8px;
}
.mw-flash.mw-warn { background: var(--mw-pink-soft); }
.mw-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.mw-member { display: flex; gap: 12px; align-items: flex-start; padding: 10px; background: var(--mw-tile); }
.mw-member--ruler { background: var(--mw-yellow-soft); }
.mw-member-pic { width: 72px; height: 72px; flex: none; background: var(--mw-paper); }
.mw-member-pic img { width: 100%; height: 100%; display: block; image-rendering: pixelated; }
.mw-member-main { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1; }
.mw-member-name { display: flex; align-items: center; gap: 6px; font-size: 24px; }
.mw-small { display: flex; gap: 12px; flex-wrap: wrap; }
.mw-title { color: #c0187a; }
.mw-voted { display: inline-flex; align-items: center; gap: 6px; min-height: 48px; color: #c0187a; }
.mw-titles { padding-top: 4px; }
@media (max-width: 420px) {
  .mw-mycode { font-size: 32px; }
}
</style>
