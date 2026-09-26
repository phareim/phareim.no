<template>
  <!-- Mini World's shell: the 3D view fills the page; the HUD, touch
    controls and every panel are HTML over it. -->
  <div
    ref="rootRef"
    class="mw-root"
    lang="nb"
    :class="{ 'mw-root--touch': isTouch }"
    :style="{ '--mw-kb': `${keyboardInset}px` }"
  >
    <canvas ref="canvasRef" class="mw-canvas" aria-label="Mini World" @contextmenu.prevent />

    <Hud
      v-if="started"
      :person="game.active.value"
      :title="social.myTitle.value"
      :bits="game.bits.value"
      :inbox="social.inboxCount.value"
      :muted="muted"
      :running="isRun"
      :quiet="seeThrough"
      :line="hudLine"
      :caption="caption"
      :keys-hint="keysHint"
      @open="(id) => open({ id } as Panel)"
      @home="goHome"
      @mute="toggleMute"
      @quit="quitRun"
    />

    <HomeBar v-if="started && inHouse && !stack.length" :editing="editing" :selected="selected" @toggle="togglePynt" />

    <p v-if="started && !isTouch && near.label && !stack.length && !editing" class="mw-prompt mw-t" aria-live="polite">
      <span class="mw-key">E</span>{{ near.label }}
    </p>

    <TouchControls
      v-if="started && isTouch && runtime && !stack.length && !editing"
      :input="runtime.input"
      :action-label="near.label"
      :magic="!!equipped && !isRun"
      @first-touch="unlockAudio"
    />

    <Transition name="mw-pop">
      <div v-if="top" :key="topKey" class="mw-panel">
        <Welcome v-if="top.id === 'welcome'" @start="swap({ id: 'creator', personId: null })" />
        <PersonCreator v-else-if="top.id === 'creator'" :person-id="top.personId" />
        <PersonsPanel v-else-if="top.id === 'persons'" />
        <Wardrobe v-else-if="top.id === 'wardrobe'" />
        <Shop v-else-if="top.id === 'shop'" :kind="top.kind" />
        <Bag v-else-if="top.id === 'bag'" />
        <Workshop v-else-if="top.id === 'workshop'" />
        <Castle v-else-if="top.id === 'castle'" />
        <Mailbox v-else-if="top.id === 'mailbox'" />
        <SendGift v-else-if="top.id === 'gift'" :to="top.to" />
        <MapPanel v-else-if="top.id === 'map'" />
        <BoothCard v-else-if="top.id === 'booth'" :contest="top.contest" />
        <ResultCard v-else-if="top.id === 'result'" :result="top.result" @done="resultDone" />
        <FashionShow v-else-if="top.id === 'fashion'" @finish="fashionDone" />
        <MemoryGame v-else-if="top.id === 'memory'" :pairs="top.pairs" @finish="memoryDone" />
        <Surfaces v-else-if="top.id === 'surfaces'" />
      </div>
    </Transition>

    <Transition name="mw-fade">
      <p v-if="toast" :key="toast.id" class="mw-toast px-box mw-box mw-t" role="status">{{ toast.text }}</p>
    </Transition>

    <Transition name="mw-pop">
      <button v-if="cheerCard" :key="cheerCard.id" type="button" class="mw-cheer" @click="cheerCard = null">
        <span class="mw-cheer-card px-box mw-box">
          <img v-if="cheerCard.pic" :src="cheerCard.pic" alt="">
          <span class="mw-cheer-text mw-t">{{ cheerCard.text }}</span>
        </span>
      </button>
    </Transition>

    <p v-if="!game.ready.value && !loadProblem" class="mw-loading mw-t">MINI WORLD</p>
    <p v-if="loadProblem" class="mw-loading mw-loading--bad mw-t">{{ loadProblem }}</p>

    <div v-if="runPaused && isRun" class="mw-paused">
      <div class="px-box mw-box mw-paused-card">
        <p class="mw-h mw-center">PAUSE</p>
        <button type="button" class="px-btn mw-btn mw-btn--go mw-btn--big" @click="runPaused = false">FORTSETT</button>
        <p v-if="!isTouch" class="mw-p mw-dim mw-center">ESC: FORTSETT · HOLD ESC: TIL BYEN</p>
      </div>
    </div>

    <EscHold :is-active="escActive" :paused="runPaused" :show-paused="false" label="HOLD ESC: TIL BYEN" @tap="escTap" @hold="quitRun" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive, shallowRef, provide, onMounted, onBeforeUnmount } from 'vue'
import EscHold from '../base/EscHold.vue'
import Hud from './ui/Hud.vue'
import HomeBar from './ui/HomeBar.vue'
import TouchControls from './ui/TouchControls.vue'
import Welcome from './ui/Welcome.vue'
import PersonCreator from './ui/PersonCreator.vue'
import PersonsPanel from './ui/PersonsPanel.vue'
import Wardrobe from './ui/Wardrobe.vue'
import Shop from './ui/Shop.vue'
import Bag from './ui/Bag.vue'
import Workshop from './ui/Workshop.vue'
import Castle from './ui/Castle.vue'
import Mailbox from './ui/Mailbox.vue'
import SendGift from './ui/SendGift.vue'
import MapPanel from './ui/MapPanel.vue'
import BoothCard from './ui/BoothCard.vue'
import ResultCard from './ui/ResultCard.vue'
import FashionShow from './ui/FashionShow.vue'
import MemoryGame from './ui/MemoryGame.vue'
import Surfaces from './ui/Surfaces.vue'
import './ui/mw.css'
import { MW_CTX, socialLine, type MwContext, type Panel, type Pics, type ResultCard as ResultCardData, type TravelSpot } from './ui/context'
import { useMiniWorld } from '~/composables/useMiniWorld'
import { useMiniWorldSocial } from '~/composables/useMiniWorldSocial'
import { createMiniAudio } from './audio'
import type {
  CreateRuntime, MiniAudio, MiniMusic, MiniSfx, MiniWorldRuntime, Place, Previews, RuntimeEvent, ZoneId,
} from './scene/contracts'
import type { FashionScore, MemorySize } from './core/contests'
import type { ContestId, ObbyLevel, OwnedFurniture } from './types'

// ---------------------------------------------------------------- state

const game = useMiniWorld()
const social = useMiniWorldSocial()
const { navigationLocked } = useTheme()
const { isTouch } = useInputMode()

const rootRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const runtime = shallowRef<MiniWorldRuntime | null>(null)
const previews = shallowRef<Previews | null>(null)
const loadProblem = ref('')

const place = ref<Place>({ kind: 'town' })
const stack = ref<Panel[]>([])
const top = computed(() => stack.value[stack.value.length - 1] ?? null)
/** Re-keys the panel transition when a different panel comes on top. */
const topKey = computed(() => `${stack.value.length}:${JSON.stringify(top.value)}`)

const near = reactive<{ zone: ZoneId | null; label: string | null }>({ zone: null, label: null })
const hudLine = ref('')
const caption = ref('')
const selected = ref<string | null>(null)
const seeThrough = ref(false)
const busy = ref(false)
const runPaused = ref(false)
const muted = ref(false)
const keysHintOn = ref(true)

const started = computed(() => game.ready.value && !!game.active.value && top.value?.id !== 'welcome')
const inHouse = computed(() => place.value.kind === 'house')
const editing = computed(() => place.value.kind === 'house' && place.value.edit)
const isRun = computed(() => place.value.kind === 'obby' || place.value.kind === 'stars')
const equipped = computed(() => game.save.value.weapons.find(w => w.uid === game.save.value.equipped) ?? null)
const keysHint = computed(() => (keysHintOn.value && !isTouch.value && !stack.value.length && !editing.value
  ? 'WASD: GÅ · MELLOMROM: HOPP · E: BRUK · DRA: SNU' + (equipped.value ? ' · F: MAGI' : '')
  : ''))

// ---------------------------------------------------------------- pictures and sound (safe before they load)

const pics: Pics = {
  person: (look, opts) => previews.value?.person(look, opts) ?? '',
  clothing: (def, size) => previews.value?.clothing(def, size) ?? '',
  furniture: (id, level, size) => previews.value?.furniture(id, level, size) ?? '',
  weapon: (w, size) => previews.value?.weapon(w, size) ?? '',
}

let audio: MiniAudio | null = null
const audioProxy: MiniAudio = {
  unlock: () => audio?.unlock(),
  setMusic: t => audio?.setMusic(t),
  sfx: (n, o) => audio?.sfx(n, o),
  setMuted: m => audio?.setMuted(m),
  get muted() { return audio?.muted ?? false },
  dispose: () => audio?.dispose(),
}
const sfx = (name: MiniSfx) => audioProxy.sfx(name)

let unlocked = false
function unlockAudio() {
  if (unlocked) return
  unlocked = true
  audioProxy.unlock()
}

function toggleMute() {
  muted.value = !muted.value
  audioProxy.setMuted(muted.value)
  if (!muted.value) sfx('click')
}

// ---------------------------------------------------------------- panels

function open(p: Panel) {
  if (top.value?.id === p.id && JSON.stringify(top.value) === JSON.stringify(p)) return
  stack.value = [...stack.value, p]
  sfx('open')
}
function swap(p: Panel) {
  stack.value = [...stack.value.slice(0, -1), p]
}
function close() {
  const t = top.value
  if (!t) return
  // The first person cannot be skipped.
  if (t.id === 'welcome' || (t.id === 'creator' && !game.save.value.persons.length)) return
  stack.value = stack.value.slice(0, -1)
  sfx('close')
  if (t.id === 'fashion' && place.value.kind === 'catwalk') runtime.value?.go({ kind: 'town' })
}
function closeAll() {
  stack.value = stack.value.filter(p => p.id === 'welcome' || (p.id === 'creator' && !game.save.value.persons.length))
}

const toast = ref<{ id: number; text: string } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined
function say(text: string) {
  if (!text) return
  toast.value = { id: Date.now(), text }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = null }, 2600)
}

const cheerCard = ref<{ id: number; text: string; pic?: string } | null>(null)
let cheerTimer: ReturnType<typeof setTimeout> | undefined
function cheer(text: string, pic?: string) {
  cheerCard.value = { id: Date.now(), text, pic }
  if (cheerTimer) clearTimeout(cheerTimer)
  cheerTimer = setTimeout(() => { cheerCard.value = null }, 1800)
}

// ---------------------------------------------------------------- places, contests, travel

function go(p: Place, visit?: Parameters<MiniWorldRuntime['go']>[1]) {
  runtime.value?.go(p, visit)
}

function goHome() {
  closeAll()
  if (place.value.kind !== 'house') go({ kind: 'house', edit: false })
}

function togglePynt() {
  if (place.value.kind !== 'house') return
  const on = !place.value.edit
  go({ kind: 'house', edit: on })
  sfx(on ? 'open' : 'close')
  if (!on) selected.value = null
}

async function visit(playerId: string) {
  closeAll()
  const { result, profile } = await social.fetchHouse(playerId)
  if (result !== 'ok' || !profile) { say(socialLine(result) || 'FANT IKKE HUSET.'); return }
  if (!profile.house) { say('HEN HAR IKKE ET HUS ENNÅ.'); return }
  const owned: OwnedFurniture[] = Object.entries(profile.kinds).map(([uid, id]) => ({ uid, id, level: profile.levels[uid] ?? 1 }))
  go({ kind: 'visit', playerId }, {
    layout: profile.house,
    owned,
    look: profile.person?.look ?? null,
    name: profile.person?.name ?? profile.playerName,
  })
}

let obbyLevel: ObbyLevel = 'easy'
function play(contest: ContestId, opts?: { level?: ObbyLevel; pairs?: 6 | 8 | 10 }) {
  closeAll()
  if (contest === 'obby') { obbyLevel = opts?.level ?? 'easy'; go({ kind: 'obby', level: obbyLevel }) }
  else if (contest === 'stars') go({ kind: 'stars' })
  else if (contest === 'fashion') open({ id: 'fashion' })
  else if (opts?.pairs) open({ id: 'memory', pairs: opts.pairs })
  else open({ id: 'booth', contest: 'memory' })
}

function travel(to: TravelSpot) {
  closeAll()
  if (to === 'hjem') { goHome(); return }
  go({ kind: 'town', at: to })
  sfx('door')
}

function quitRun() {
  runPaused.value = false
  if (isRun.value || place.value.kind === 'catwalk') go({ kind: 'town' })
}

function showResult(r: ResultCardData) {
  closeAll()
  open({ id: 'result', result: r })
}

function resultDone() {
  stack.value = stack.value.filter(p => p.id !== 'result')
  const k = place.value.kind
  if (k === 'obby' || k === 'stars' || k === 'catwalk') go({ kind: 'town' })
}

function fashionDone(score: FashionScore) {
  const out = game.finishContest({ contest: 'fashion', stars: score.total })
  stack.value = stack.value.filter(p => p.id !== 'fashion')
  showResult({
    title: 'MOTEVISNING', line: `${score.total} AV 15 STJERNER`, bits: out.bits, newBest: out.newBest, prizes: out.prizes,
    again: { contest: 'fashion' },
  })
}

function memoryDone(moves: number) {
  const t = top.value
  const pairs = (t?.id === 'memory' ? t.pairs : 6) as MemorySize
  const out = game.finishContest({ contest: 'memory', pairs, moves })
  showResult({
    title: 'HUSKESPILL', line: `ALLE ${pairs} PAR PÅ ${moves} TREKK`, bits: out.bits, newBest: out.newBest, prizes: out.prizes,
    again: { contest: 'memory' },
  })
}

// ---------------------------------------------------------------- runtime events

const USING: Record<string, string> = {
  sit: 'DU SITTER', sleep: 'SOV GODT …', bounce: 'HOPP HOPP!', music: 'LA LA LA ♪', slide: 'WIII!', light: 'LYS!', swim: 'PLASK!',
}

const ZONE_PANELS: Partial<Record<ZoneId, Panel>> = {
  'clothes-shop': { id: 'shop', kind: 'clothes' },
  'furniture-shop': { id: 'shop', kind: 'furniture' },
  'workshop': { id: 'workshop' },
  'castle': { id: 'castle' },
  'mailbox': { id: 'mailbox' },
  'wardrobe': { id: 'wardrobe' },
  'booth-obby': { id: 'booth', contest: 'obby' },
  'booth-stars': { id: 'booth', contest: 'stars' },
  'booth-fashion': { id: 'booth', contest: 'fashion' },
  'booth-memory': { id: 'booth', contest: 'memory' },
}

function onZone(zone: ZoneId) {
  if (stack.value.length) return
  const panel = ZONE_PANELS[zone]
  if (panel) { open(panel); return }
  if (zone === 'home') { if (place.value.kind !== 'house') go({ kind: 'house', edit: false }); return }
  if (zone === 'exit') { if (place.value.kind !== 'town') go({ kind: 'town' }); return }
  if (zone.startsWith('neighbor:')) void visit(zone.slice('neighbor:'.length))
}

/** The last layout the runtime reported, so pushing the save back does not reset the editor. */
let runtimeLayout = ''
let pushedFurniture = ''

function onEvent(e: RuntimeEvent) {
  switch (e.type) {
    case 'near':
      near.zone = e.zone
      near.label = e.label ? e.label.toUpperCase() : null
      break
    case 'zone':
      onZone(e.zone)
      break
    case 'place':
      place.value = e.place
      near.zone = null
      near.label = null
      caption.value = ''
      if (e.place.kind !== 'obby' && e.place.kind !== 'stars') { hudLine.value = ''; runPaused.value = false }
      if (!(e.place.kind === 'house' && e.place.edit)) selected.value = null
      break
    case 'obby-end':
      if (e.result) {
        const out = game.finishContest({ contest: 'obby', level: e.result.level, seconds: e.result.seconds })
        showResult({
          title: 'DU KLARTE DET!', line: `TID: ${Math.round(e.result.seconds)} SEKUNDER`, bits: out.bits, newBest: out.newBest, prizes: out.prizes,
          again: { contest: 'obby', level: e.result.level },
        })
      }
      break
    case 'stars-end': {
      const out = game.finishContest({ contest: 'stars', stars: e.result.stars })
      showResult({
        title: 'STJERNEJAKT', line: `${e.result.stars} STJERNER!`, bits: out.bits, newBest: out.newBest, prizes: out.prizes,
        again: { contest: 'stars' },
      })
      break
    }
    case 'hud':
      hudLine.value = e.text.toUpperCase()
      break
    case 'pop':
      if (e.bits > 0) game.earn(e.bits, 'mw:pop')
      break
    case 'select':
      selected.value = e.uid
      break
    case 'layout': {
      runtimeLayout = JSON.stringify(e.layout)
      const r = game.setLayout(e.layout)
      if (!r.ok) { say(r.message); pushHouse(true) }
      break
    }
    case 'using':
      caption.value = e.what ? (USING[e.what] ?? e.what.toUpperCase()) : ''
      break
    case 'sfx':
      audioProxy.sfx(e.name, e.magic ? { magic: e.magic } : undefined)
      break
  }
}

// ---------------------------------------------------------------- save → runtime

function pushPlayer() {
  const rt = runtime.value
  const p = game.active.value
  if (rt && p) rt.setPlayer(p.look, p.name, social.myTitle.value)
}

function pushHouse(force = false) {
  const rt = runtime.value
  if (!rt) return
  const s = game.save.value
  const layout = JSON.stringify(s.house)
  const owned = JSON.stringify(s.furniture)
  if (!force && layout === runtimeLayout && owned === pushedFurniture) return
  runtimeLayout = layout
  pushedFurniture = owned
  rt.setHouse(s.house, s.furniture)
}

watch(() => [JSON.stringify(game.active.value), social.myTitle.value], pushPlayer)
watch(() => JSON.stringify(equipped.value), () => runtime.value?.setWeapon(equipped.value))
watch(() => [JSON.stringify(game.save.value.house), JSON.stringify(game.save.value.furniture)], () => pushHouse())
watch(() => JSON.stringify(social.neighbors.value), () => runtime.value?.setNeighbors(social.neighbors.value))

// The first person: the welcome card, then the maker.
watch([() => game.ready.value, () => game.save.value.persons.length], ([ready, n]) => {
  if (!ready) return
  if (n === 0 && !stack.value.some(p => p.id === 'welcome' || p.id === 'creator')) stack.value = [{ id: 'welcome' }]
  if (n > 0) void social.refresh()
}, { immediate: true })

// ---------------------------------------------------------------- pause, lock, music

const panelCovers = computed(() => stack.value.length > 0 && !seeThrough.value)
watch([panelCovers, runPaused], () => runtime.value?.setPaused(panelCovers.value || runPaused.value))

watch([isRun, busy, () => place.value.kind], () => {
  navigationLocked.value = isRun.value || busy.value || place.value.kind === 'catwalk'
}, { immediate: true })

const music = computed<MiniMusic>(() => {
  const t = top.value?.id
  if (t === 'shop' || t === 'workshop') return 'shop'
  if (t === 'castle' || t === 'mailbox' || t === 'gift') return 'castle'
  if (t === 'memory') return 'memory'
  if (t === 'fashion') return 'fashion'
  switch (place.value.kind) {
    case 'house': case 'visit': return 'house'
    case 'obby': return 'obby'
    case 'stars': return 'stars'
    case 'catwalk': return 'fashion'
    default: return 'town'
  }
})
watch(music, m => audioProxy.setMusic(m))

// ---------------------------------------------------------------- keys

function escActive() {
  return isRun.value && !stack.value.length
}
function escTap() {
  runPaused.value = !runPaused.value
}

function onKeyDown(e: KeyboardEvent) {
  unlockAudio()
  // Enter on the welcome card starts the person maker, wherever the focus is.
  if (e.key === 'Enter' && !e.repeat && top.value?.id === 'welcome') {
    e.preventDefault()
    swap({ id: 'creator', personId: null })
    return
  }
  if (e.key !== 'Escape' || e.repeat) {
    if (keysHintOn.value && /^(Key[WASD]|Arrow)/.test(e.code)) setTimeout(() => { keysHintOn.value = false }, 6000)
    return
  }
  const el = e.target as HTMLElement | null
  if (stack.value.length) {
    const t = top.value!
    // The welcome card cannot close: Escape stays the shell's (back to the portal).
    if (t.id === 'welcome' || (t.id === 'creator' && !game.save.value.persons.length)) {
      if (el && el.tagName === 'INPUT') { el.blur(); e.preventDefault() }
      return
    }
    e.preventDefault()
    if (el && el.tagName === 'INPUT') { el.blur(); return }
    if (t.id === 'result') resultDone()
    else close()
    return
  }
  if (editing.value) { e.preventDefault(); togglePynt() }
}

// ---------------------------------------------------------------- the context for panels

const ctx: MwContext = {
  game, social, pics, previews, audio: audioProxy, runtime, place,
  open, swap, close, closeAll, say, cheer, sfx,
  setSeeThrough: (on) => { seeThrough.value = on },
  setBusy: (on) => { busy.value = on },
  visit: (id) => { void visit(id) },
  play, travel,
}
provide(MW_CTX, ctx)

// ---------------------------------------------------------------- the view

/** The iPhone keyboard's height over the page, so a sheet can sit above it. */
const keyboardInset = ref(0)
function onViewport() {
  const vv = window.visualViewport
  if (!vv) return
  keyboardInset.value = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
  // iOS scrolls the locked page to show a focused field; put it back when the keyboard goes.
  if (keyboardInset.value === 0 && (window.scrollY || document.documentElement.scrollTop)) window.scrollTo(0, 0)
}

let ro: ResizeObserver | null = null
function resize() {
  const el = rootRef.value
  const rt = runtime.value
  if (!el || !rt) return
  rt.resize(el.clientWidth, el.clientHeight, window.devicePixelRatio || 1)
}

/**
 * three.js and the world come in their own chunks, so the shell (sky,
 * welcome card, panels) paints first. Pictures load alongside.
 */
async function boot() {
  const [previewMod, runtimeMod] = await Promise.allSettled([import('./scene/preview'), import('./scene/runtime')])
  if (previewMod.status === 'fulfilled') {
    try { previews.value = previewMod.value.createPreviews() } catch (err) { console.warn('[miniworld] previews', err) }
  }
  if (runtimeMod.status === 'rejected') {
    console.error('[miniworld] runtime', runtimeMod.reason)
    loadProblem.value = 'NOE GIKK GALT. PRØV Å LASTE SIDEN PÅ NYTT.'
    return
  }
  if (!canvasRef.value) return
  try {
    const mod: { createRuntime: CreateRuntime } = runtimeMod.value
    if (!canvasRef.value) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const nav = navigator as Navigator & { deviceMemory?: number }
    const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4 || (isTouch.value && (nav.deviceMemory ?? 8) <= 4)
    const rt = mod.createRuntime(canvasRef.value, { reducedMotion, lowPower })
    runtime.value = rt
    offRuntime = rt.on(onEvent)
    place.value = rt.place
    resize()
    pushPlayer()
    rt.setWeapon(equipped.value)
    pushHouse(true)
    rt.setNeighbors(social.neighbors.value)
    rt.setPaused(panelCovers.value || runPaused.value)
    rt.start()
  } catch (err) {
    console.error('[miniworld] runtime', err)
    loadProblem.value = 'NOE GIKK GALT. PRØV Å LASTE SIDEN PÅ NYTT.'
  }
}

let offRuntime: (() => void) | null = null
let socialTimer: ReturnType<typeof setInterval> | undefined

function onVisibility() {
  if (document.visibilityState === 'visible' && game.save.value.persons.length) void social.refresh()
  else game.flush()
}

onMounted(() => {
  audio = createMiniAudio()
  muted.value = audio.muted
  audio.setMusic(music.value)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true })
  window.visualViewport?.addEventListener('resize', onViewport)
  window.visualViewport?.addEventListener('scroll', onViewport)
  document.addEventListener('visibilitychange', onVisibility)
  ro = new ResizeObserver(resize)
  if (rootRef.value) ro.observe(rootRef.value)
  socialTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && game.save.value.persons.length && !stack.value.length) void social.refresh()
  }, 90_000)
  void boot()
  if (import.meta.dev) (window as unknown as { __mw?: unknown }).__mw = { get runtime() { return runtime.value }, game, social, ctx }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('pointerdown', unlockAudio, { capture: true })
  window.visualViewport?.removeEventListener('resize', onViewport)
  window.visualViewport?.removeEventListener('scroll', onViewport)
  document.removeEventListener('visibilitychange', onVisibility)
  ro?.disconnect()
  if (socialTimer) clearInterval(socialTimer)
  if (toastTimer) clearTimeout(toastTimer)
  if (cheerTimer) clearTimeout(cheerTimer)
  offRuntime?.()
  runtime.value?.dispose()
  runtime.value = null
  previews.value?.dispose()
  previews.value = null
  audio?.dispose()
  audio = null
  game.flush()
  navigationLocked.value = false
})

// Keyboard hints fade after a while even without walking.
onMounted(() => { setTimeout(() => { keysHintOn.value = false }, 25_000) })
</script>

<style scoped>
.mw-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #8fd8ff;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.mw-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: pixelated;
  outline: none;
}
.mw-panel { position: absolute; inset: 0; z-index: 30; pointer-events: none; }
.mw-panel > * { pointer-events: auto; }

.mw-prompt {
  position: absolute;
  left: 50%;
  bottom: calc(40px + var(--app-safe-bottom, 0px));
  transform: translateX(-50%);
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 24px;
  color: #fff;
  text-shadow: 3px 3px 0 var(--mw-ink);
  white-space: nowrap;
  pointer-events: none;
}
.mw-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: var(--mw-ink);
  text-shadow: none;
  background: var(--mw-yellow);
  box-shadow: 0 -3px 0 0 var(--mw-ink), 0 3px 0 0 var(--mw-ink), -3px 0 0 0 var(--mw-ink), 3px 0 0 0 var(--mw-ink);
}

.mw-toast {
  position: absolute;
  left: 50%;
  top: calc(max(10px, env(safe-area-inset-top, 0px)) + 70px);
  transform: translateX(-50%);
  z-index: 40;
  margin: 0;
  padding: 10px 16px;
  max-width: calc(100% - 32px);
  font-size: 16px;
  line-height: 1.5;
  text-align: center;
  pointer-events: none;
}

.mw-cheer {
  position: absolute;
  inset: 0;
  z-index: 45;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border: 0;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.mw-cheer-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 18px 22px;
  max-width: 100%;
  --px-edge: var(--mw-pink) !important;
  animation: mw-in 160ms ease-out;
}
.mw-cheer-card img { width: 160px; height: 160px; object-fit: contain; image-rendering: pixelated; }
.mw-cheer-text { font-size: 32px; line-height: 1.25; color: var(--mw-pink); text-shadow: 3px 3px 0 var(--mw-ink); text-align: center; }
@media (max-height: 460px) {
  .mw-cheer-card img { width: 110px; height: 110px; }
  .mw-cheer-text { font-size: 24px; }
}

.mw-paused {
  position: absolute;
  inset: 0;
  z-index: 35;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(42, 31, 74, 0.28);
}
.mw-paused-card { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 20px 24px; }

.mw-loading {
  position: absolute;
  inset: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: #fff;
  text-shadow: 6px 6px 0 var(--mw-ink);
  pointer-events: none;
}
.mw-loading--bad { font-size: 24px; text-shadow: 3px 3px 0 var(--mw-ink); padding: 24px; text-align: center; }
@media (max-width: 420px) {
  .mw-loading { font-size: 32px; text-shadow: 4px 4px 0 var(--mw-ink); }
}
</style>
