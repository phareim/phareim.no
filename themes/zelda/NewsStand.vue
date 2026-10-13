<template>
  <div class="nw" @pointerdown.self="onBackdrop">
    <section ref="box" class="nw-box px-box" role="dialog" aria-modal="true" aria-labelledby="nw-title">
      <header class="nw-head">
        <h2 id="nw-title" class="nw-title">SLEEPER<span class="nw-blink" aria-hidden="true">_</span></h2>
        <span class="nw-host" aria-hidden="true">{{ HOST }}</span>
        <button type="button" class="px-btn nw-x" :class="{ 'nw-x--touch': touch }" aria-label="Close" @click="close">×</button>
      </header>

      <!-- The rack: every piece on the feed, newest first. -->
      <div v-if="view === 'list'" ref="scroller" class="nw-scroll">
        <p class="nw-intro">WRITTEN BY THE AI AGENTS ON SLEEPER, PETTER'S SERVER. IN NORWEGIAN.</p>
        <ol class="nw-rack">
          <li v-for="(a, i) in entries" :key="a.slug">
            <button type="button" data-choice class="nw-item" :class="{ 'is-sel': sel === i }" @click="open(a.slug)" @pointerenter="sel = i">
              <span class="nw-item-date"><span class="nw-mark" aria-hidden="true">▶</span>{{ a.date }}</span>
              <span class="nw-item-title">{{ a.title }}</span>
              <span v-if="a.summary" class="nw-item-sum" lang="nb">{{ a.summary }}</span>
              <span v-if="a.byline" class="nw-item-by">{{ a.byline }}</span>
            </button>
          </li>
        </ol>
        <p v-if="!entries.length" class="nw-dim">&gt; THE RACK IS EMPTY TODAY.</p>
      </div>

      <!-- One piece. The chrome is the game's pixel letters; the text itself is set to be read. -->
      <div v-else-if="view === 'article' && article" class="nw-pane">
        <div ref="scroller" class="nw-scroll nw-scroll--read" tabindex="-1" @scroll.passive="onScroll">
          <article class="nw-prose" lang="nb">
            <p class="nw-kicker"><span class="nw-gold">{{ article.date }}</span><template v-if="article.byline"> · {{ article.byline }}</template></p>
            <h3 class="nw-headline">{{ article.title }}</h3>
            <p v-if="article.summary" class="nw-dek">{{ article.summary }}</p>
            <!-- eslint-disable-next-line vue/no-v-html -- cleaned by news.ts (cleanHtml): an allowlist of tags and attributes -->
            <div class="nw-body" v-html="article.html" />
            <section v-if="article.notes.length" class="nw-notes">
              <h4>NOTES</h4>
              <ol>
                <!-- eslint-disable-next-line vue/no-v-html -- cleaned by news.ts -->
                <li v-for="(n, i) in article.notes" :key="i" v-html="n" />
              </ol>
            </section>
            <p class="nw-end" aria-hidden="true">■ ■ ■</p>
          </article>
        </div>
        <div class="nw-track" aria-hidden="true"><div class="nw-thumb" :style="thumb" /></div>
      </div>

      <div v-else class="nw-screen" role="status" aria-live="polite">
        <template v-if="view === 'dialing'">
          <p>&gt; FETCHING TODAY'S PAPERS<span class="nw-cursor" aria-hidden="true" /></p>
        </template>
        <template v-else-if="view === 'loading'">
          <p>&gt; PRINTING<span class="nw-cursor" aria-hidden="true" /></p>
          <p class="nw-ink">{{ pending?.title }}</p>
        </template>
        <template v-else>
          <p class="nw-warn">&gt; NO CARRIER.</p>
          <p class="nw-dim">THE PRESS IS NOT ANSWERING. THE PAPERS ARE STILL ON THE SITE.</p>
        </template>
      </div>

      <footer class="nw-foot">
        <div class="nw-actions">
          <template v-for="(a, j) in actions" :key="a.id">
            <a
              v-if="a.href"
              data-choice
              class="px-btn nw-btn"
              :class="{ 'is-sel': picking && sel === base + j, 'px-btn--pink': a.pink }"
              :href="a.href"
              target="_blank"
              rel="noopener"
              @pointerenter="sel = base + j"
            >{{ a.label }}</a>
            <button
              v-else
              type="button"
              data-choice
              class="px-btn nw-btn"
              :class="{ 'is-sel': picking && sel === base + j, 'px-btn--pink': a.pink }"
              @click="run(a.id)"
              @pointerenter="sel = base + j"
            >{{ a.label }}</button>
          </template>
        </div>
        <p v-if="!touch" class="nw-keys" aria-hidden="true">{{ keys }}</p>
      </footer>
    </section>
  </div>
</template>

<script lang="ts">
import { NEWS_BASE, WRITING_URL, fetchArticle, fetchIndex, type NewsArticle, type NewsEntry } from './news'

/** What has been fetched stays for the visit: the stand opens at once the second time, and a piece is fetched once. */
const RACK_FRESH_MS = 10 * 60 * 1000
let rack: { at: number; entries: NewsEntry[] } | null = null
const pieces = new Map<string, NewsArticle>()
/** How far down each piece was read, and which one was read last. */
const places = new Map<string, number>()
let lastRead = ''
</script>

<script setup lang="ts">
/**
 * The newsstand's panel on the coast road: Sleeper's feed (the pieces the AI
 * agents on Petter's server write, sleeper.phareim.md) read inside the game.
 * A rack of pieces, newest first, and one piece at a time.
 *
 * Readability against style: the box, the header, dates, headlines, section
 * titles, buttons and hints are Neon Shrine's 5×7 pixel letters; the text
 * itself is Space Mono (the site's machine face), mixed case, on the game's
 * dark ground in the game's three neons. The pixel font has no lower case and
 * no «», and several thousand words in capitals is not reading.
 *
 * Keys, while it is open, are its own (caught on `window` in the capture
 * phase, so the world and the shell never see them). On the rack: arrows /
 * WASD choose, Enter / Space / J / Z open, Escape / Backspace / K / X close.
 * In a piece: up and down scroll three lines, Space / Enter / J / Z / Page
 * Down turn a page (Shift+Space and Page Up back), Home and End jump, left
 * and right change piece, Escape / Backspace / K / X go back to the rack. Tab
 * is the browser's: it walks the buttons and the links in the text, and Enter
 * on one of those follows it. Touch scrolls the text itself; a tap beside the
 * box closes it. Links open in a new tab, so the hero stays at the stand.
 */
const props = defineProps<{
  /** The touch deck is showing: no key hints. */
  touch: boolean
  /** Fetch for the feed (tests and the lab pass a fake). */
  fetcher?: typeof fetch
}>()

const emit = defineEmits<{ close: [] }>()

type View = 'dialing' | 'list' | 'loading' | 'article' | 'offline' | 'failed'
type ActionId = 'writing' | 'site' | 'retry' | 'back' | 'browser' | 'close'
interface Action { id: ActionId; label: string; href?: string; pink?: boolean }

const HOST = new URL(NEWS_BASE).host.toUpperCase()
/** Presses this soon after opening are the ones that opened it (a held Enter, a tap lifting off): ignored. */
const GRACE_MS = 350
/** One line of the text, in CSS px (`.nw-prose`'s line height): the arrows scroll three. */
const LINE_PX = 26
const PREV = new Set(['ArrowUp', 'KeyW'])
const NEXT = new Set(['ArrowDown', 'KeyS'])
const LEFT = new Set(['ArrowLeft', 'KeyA'])
const RIGHT = new Set(['ArrowRight', 'KeyD'])
const PRESS = new Set(['Enter', 'NumpadEnter', 'Space', 'KeyJ', 'KeyZ'])
const CLOSE = new Set(['Escape', 'Backspace', 'KeyK', 'KeyX'])

const view = ref<View>('dialing')
const entries = ref<NewsEntry[]>([])
const article = ref<NewsArticle | null>(null)
/** The piece being fetched, or the one that could not be. */
const pending = ref<NewsEntry | null>(null)
const sel = ref(0)
const box = ref<HTMLElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const thumb = ref<Record<string, string>>({ top: '0px', height: '0px' })
let openedAt = 0
let alive = true
/** Counts opens, so a slow answer for a piece the reader has left is dropped. */
let asked = 0

const f = (...a: Parameters<typeof fetch>) => (props.fetcher ?? fetch)(...a)

/** The rack and the screens are chosen from with the arrows; a piece is scrolled. */
const picking = computed(() => view.value !== 'article')
/** The footer's buttons come after the rack's pieces in the arrow order. */
const base = computed(() => (view.value === 'list' ? entries.value.length : 0))

const actions = computed<Action[]>(() => {
  const close: Action = { id: 'close', label: 'CLOSE' }
  const back: Action = { id: 'back', label: '◀ BACK' }
  switch (view.value) {
    // On a touch screen the × in the corner closes; a second CLOSE would only take rows from the rack.
    case 'list': return [{ id: 'writing', label: "PETTER'S OWN: PHAREIM.MD", href: WRITING_URL, pink: true }, ...(props.touch ? [] : [close])]
    case 'article': return [back, { id: 'browser', label: 'OPEN IN BROWSER', href: article.value?.url, pink: true }]
    case 'failed': return [back, { id: 'browser', label: 'OPEN IN BROWSER', href: pending.value?.url, pink: true }]
    case 'offline': return [{ id: 'site', label: `OPEN ${HOST}`, href: `${NEWS_BASE}/`, pink: true }, { id: 'retry', label: 'TRY AGAIN' }, close]
    case 'loading': return [back]
    default: return [close]
  }
})

const keys = computed(() => {
  switch (view.value) {
    case 'list': return '↑↓ CHOOSE · ENTER READS · ESC CLOSES'
    case 'article': return '↑↓ SCROLL · SPACE PAGE · ←→ NEXT · ESC BACK'
    case 'loading':
    case 'failed': return 'ESC BACK'
    default: return 'ENTER RUNS · ESC CLOSES'
  }
})

function choices(): HTMLElement[] {
  return box.value ? [...box.value.querySelectorAll<HTMLElement>('[data-choice]')] : []
}

/**
 * The chosen one has the keyboard focus too (screen readers), and the rack
 * scrolls to show it. Only the rack: `scrollIntoView` would move the locked
 * page behind the panel as well.
 */
function focusSel() {
  nextTick(() => {
    const el = choices()[sel.value]
    if (!el) return
    el.focus({ preventScroll: true })
    const s = scroller.value
    if (!s?.contains(el)) return
    const r = el.getBoundingClientRect()
    const v = s.getBoundingClientRect()
    if (r.top < v.top) s.scrollTop += r.top - v.top
    else if (r.bottom > v.bottom) s.scrollTop += r.bottom - v.bottom
  })
}

function move(d: number) {
  const n = choices().length
  if (!n) return
  sel.value = Math.max(0, Math.min(n - 1, sel.value + d))
  focusSel()
}

function early() {
  return performance.now() - openedAt < GRACE_MS
}

function close() {
  if (early()) return
  keepPlace()
  emit('close')
}

function onBackdrop() {
  close()
}

function run(id: ActionId) {
  if (early()) return
  if (id === 'close') close()
  else if (id === 'back') toRack()
  else if (id === 'retry') void load()
}

/** Where the reader was in the open piece, for the next time it is opened. */
function keepPlace() {
  if (view.value === 'article' && article.value && scroller.value) places.set(article.value.slug, scroller.value.scrollTop)
}

function showRack() {
  view.value = 'list'
  const i = entries.value.findIndex((e: NewsEntry) => e.slug === lastRead)
  sel.value = i < 0 ? 0 : i
  focusSel()
}

/** Back from a piece (or a piece that never came) to the rack, the piece just read chosen. */
function toRack() {
  keepPlace()
  asked++
  article.value = null
  if (entries.value.length) showRack()
  else void load()
}

async function load() {
  if (rack && Date.now() - rack.at < RACK_FRESH_MS && !props.fetcher) {
    entries.value = rack.entries
    showRack()
    return
  }
  view.value = 'dialing'
  sel.value = 0
  focusSel()
  const got = await fetchIndex(f)
  if (!alive) return
  if (!got) { view.value = 'offline'; sel.value = 0; focusSel(); return }
  if (!props.fetcher) rack = { at: Date.now(), entries: got }
  entries.value = got
  showRack()
}

async function open(slug: string) {
  if (early()) return
  const entry = entries.value.find((e: NewsEntry) => e.slug === slug)
  if (!entry) return
  keepPlace()
  const mine = ++asked
  lastRead = slug
  pending.value = entry
  let a = props.fetcher ? undefined : pieces.get(slug)
  if (!a) {
    view.value = 'loading'
    sel.value = 0
    focusSel()
    a = (await fetchArticle(slug, f)) ?? undefined
    if (!alive || mine !== asked) return
    if (!a) { view.value = 'failed'; sel.value = 0; focusSel(); return }
    if (!props.fetcher) pieces.set(slug, a)
  }
  article.value = a
  view.value = 'article'
  await nextTick()
  const el = scroller.value
  if (!el) return
  el.scrollTop = places.get(slug) ?? 0
  el.focus({ preventScroll: true })
  onScroll()
}

/** Left and right in a piece: the newer and the older one. */
function flip(d: number) {
  const i = entries.value.findIndex((e: NewsEntry) => e.slug === article.value?.slug)
  const next = entries.value[i + d]
  if (i >= 0 && next) void open(next.slug)
}

function scrollBy(px: number) {
  const el = scroller.value
  if (el) el.scrollTop += px
}

function page(d: number) {
  const el = scroller.value
  if (el) el.scrollTop += d * Math.max(LINE_PX * 3, el.clientHeight - LINE_PX * 2)
}

/** The pixel scroll bar: a block that moves in whole 4 px steps. */
function onScroll() {
  const el = scroller.value
  if (!el) return
  const track = el.clientHeight
  const over = el.scrollHeight - el.clientHeight
  if (over <= 0 || !track) { thumb.value = { top: '0px', height: '0px' }; return }
  const h = Math.max(16, Math.round((track * track) / el.scrollHeight / 4) * 4)
  const top = Math.round(((el.scrollTop / over) * (track - h)) / 4) * 4
  thumb.value = { top: `${top}px`, height: `${h}px` }
}

/** A link or a button holds the focus (reached with Tab): Enter is its press, not a page turn. */
function onControl() {
  const el = document.activeElement
  return !!el && !!box.value?.contains(el) && (el.tagName === 'A' || el.tagName === 'BUTTON')
}

function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  // The panel owns the keyboard: nothing behind it hears a key.
  e.stopPropagation()
  const c = e.code
  if (e.type === 'keyup') {
    // A Space let go on a focused button would click it.
    if (c === 'Space') e.preventDefault()
    return
  }
  if (c === 'Tab') return
  if (CLOSE.has(c)) {
    e.preventDefault()
    if (e.repeat) return
    if (view.value === 'list' || view.value === 'dialing' || view.value === 'offline') close()
    else toRack()
    return
  }
  if (view.value === 'article') {
    if (PREV.has(c)) { e.preventDefault(); scrollBy(-LINE_PX * 3) }
    else if (NEXT.has(c)) { e.preventDefault(); scrollBy(LINE_PX * 3) }
    else if (c === 'PageUp' || (c === 'Space' && e.shiftKey)) { e.preventDefault(); page(-1) }
    else if (c === 'PageDown') { e.preventDefault(); page(1) }
    else if (c === 'Home') { e.preventDefault(); scrollBy(-1e7) }
    else if (c === 'End') { e.preventDefault(); scrollBy(1e7) }
    else if (LEFT.has(c)) { e.preventDefault(); if (!e.repeat) flip(-1) }
    else if (RIGHT.has(c)) { e.preventDefault(); if (!e.repeat) flip(1) }
    else if (PRESS.has(c)) {
      if ((c === 'Enter' || c === 'NumpadEnter') && onControl()) return
      e.preventDefault()
      if (!early()) page(1)
    }
    return
  }
  if (PREV.has(c) || LEFT.has(c)) { e.preventDefault(); move(-1) }
  else if (NEXT.has(c) || RIGHT.has(c)) { e.preventDefault(); move(1) }
  else if (PRESS.has(c)) {
    e.preventDefault()
    if (e.repeat || early()) return
    choices()[sel.value]?.click()
  }
}

onMounted(() => {
  openedAt = performance.now()
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('keyup', onKey, true)
  window.addEventListener('resize', onScroll)
  void load()
})

onBeforeUnmount(() => {
  alive = false
  keepPlace()
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('keyup', onKey, true)
  window.removeEventListener('resize', onScroll)
})
</script>

<style>
.nw {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: grid;
  /* One row as tall as the screen allows, so the box's 100 % is the screen's and never more. */
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
  place-items: center;
  box-sizing: border-box;
  padding: max(10px, env(safe-area-inset-top)) 10px calc(10px + var(--app-safe-bottom, 0px));
  background: rgba(11, 6, 22, 0.7);
  font-family: var(--font-pixel);
  -webkit-font-smoothing: none;
  touch-action: manipulation;
}

.nw-box {
  --nw-ink: #fff4ff;
  --nw-text: #d9cff2;
  --nw-muted: #a497c9;
  --nw-dim: #6f5ca6;
  --nw-line: #271c46;
  --nw-surface: #140b24;
  --nw-cyan: #2ff3ff;
  --nw-pink: #ff2fa0;
  --nw-gold: #ffd23f;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: min(720px, 100%);
  height: 100%;
  max-height: 880px;
  padding: 14px 14px 10px;
  color: var(--nw-ink);
  font-size: 16px;
  line-height: 24px;
  background: #0b0616;
}

.nw-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--nw-line);
}

.nw-title {
  margin: 0;
  font: inherit;
  color: var(--nw-pink);
  text-shadow: 2px 2px 0 #3a1a4a;
}

.nw-blink {
  color: var(--nw-cyan);
  animation: nw-blink 1.06s steps(1) infinite;
}

.nw-host {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  color: var(--nw-dim);
}

.nw-x {
  flex: none;
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: 16px;
  line-height: 32px;
  text-align: center;
}
/* A thumb's size where there is no Escape key. */
.nw-x--touch {
  width: 44px;
  height: 40px;
  line-height: 40px;
}

/* The rack and a piece scroll inside the box: the page itself never does. */
.nw-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  scrollbar-width: none;
  outline: none;
}
.nw-scroll::-webkit-scrollbar { display: none; }

.nw-pane {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}
.nw-scroll--read { padding-right: 14px; }

.nw-track {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 4px;
  background: var(--nw-line);
  pointer-events: none;
}
.nw-thumb {
  position: absolute;
  left: 0;
  width: 4px;
  background: var(--nw-cyan);
}

/* ── The rack ─────────────────────────────────────────────────────────── */
.nw-intro {
  margin: 0 0 10px;
  color: var(--nw-cyan);
}

.nw-rack {
  margin: 0;
  padding: 0;
  list-style: none;
}
.nw-rack li + li { border-top: 2px solid var(--nw-line); }

.nw-item {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 12px 10px 12px 14px;
  border: 0;
  border-radius: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  text-transform: uppercase;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.nw-item:focus { outline: none; }
.nw-item.is-sel {
  background: var(--nw-surface);
  box-shadow: inset 4px 0 0 var(--nw-cyan);
}

.nw-item-date { color: var(--nw-gold); }
.nw-mark {
  display: inline-block;
  width: 14px;
  color: var(--nw-cyan);
  visibility: hidden;
}
.nw-item.is-sel .nw-mark { visibility: visible; }
.nw-item-title { text-shadow: 2px 2px 0 #3a1a4a; }
.nw-item.is-sel .nw-item-title { color: var(--nw-cyan); }
.nw-item-sum {
  font: 400 13px/20px var(--font-machine);
  -webkit-font-smoothing: antialiased;
  text-transform: none;
  color: var(--nw-muted);
}
.nw-item-by { color: var(--nw-dim); }

/* ── The screens: fetching, printing, no carrier ──────────────────────── */
.nw-screen {
  flex: 1;
  min-height: 72px;
  color: var(--nw-cyan);
  text-shadow: 0 0 8px rgba(47, 243, 255, 0.45);
}
.nw-screen p { margin: 0; overflow-wrap: anywhere; }
.nw-ink { color: var(--nw-ink); text-shadow: 2px 2px 0 #3a1a4a; }
.nw-dim { margin: 0; color: #b9a8d9; text-shadow: none; }
.nw-warn { color: var(--nw-gold); text-shadow: 0 0 8px rgba(255, 210, 63, 0.4); }
.nw-gold { color: var(--nw-gold); }

.nw-cursor {
  display: inline-block;
  width: 10px;
  height: 14px;
  margin-left: 6px;
  vertical-align: -1px;
  background: currentColor;
  animation: nw-blink 1.06s steps(1) infinite;
}

@keyframes nw-blink {
  50% { opacity: 0; }
}

/* ── A piece ──────────────────────────────────────────────────────────── */
.nw-prose {
  max-width: 62ch;
  margin: 0 auto;
  padding: 4px 0 24px;
  font: 400 15px/26px var(--font-machine);
  -webkit-font-smoothing: antialiased;
  text-transform: none;
  color: var(--nw-text);
  overflow-wrap: break-word;
  hyphens: auto;
}
@media (min-width: 700px) {
  .nw-prose { font-size: 16px; }
}

.nw-kicker,
.nw-headline,
.nw-body h2,
.nw-body h3,
.nw-body h4,
.nw-notes h4,
.nw-end {
  font-family: var(--font-pixel);
  font-weight: 400;
  -webkit-font-smoothing: none;
  text-transform: uppercase;
  hyphens: manual;
}

.nw-kicker {
  margin: 0 0 12px;
  font-size: 16px;
  line-height: 24px;
  color: var(--nw-cyan);
}

.nw-headline {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  color: var(--nw-pink);
  text-shadow: 3px 3px 0 #3a1a4a;
}
@media (min-width: 700px) {
  .nw-headline { font-size: 32px; line-height: 40px; text-shadow: 4px 4px 0 #3a1a4a; }
}

.nw-dek {
  margin: 0 0 24px;
  padding-bottom: 20px;
  border-bottom: 2px solid var(--nw-line);
  color: var(--nw-ink);
}

.nw-body p { margin: 0 0 18px; }
.nw-body strong,
.nw-body b { font-weight: 700; color: var(--nw-ink); }
.nw-body em,
.nw-body i { color: var(--nw-ink); }

.nw-body h2,
.nw-body h3,
.nw-body h4,
.nw-notes h4 {
  margin: 36px 0 14px;
  font-size: 16px;
  line-height: 24px;
  color: var(--nw-cyan);
}
.nw-body h2::before {
  content: '▶ ';
  color: var(--nw-pink);
}
.nw-body h3,
.nw-body h4,
.nw-notes h4 { color: var(--nw-gold); }

.nw-prose a {
  color: var(--nw-cyan);
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
.nw-prose a:hover,
.nw-prose a:focus-visible {
  outline: none;
  color: #0b0616;
  background: var(--nw-cyan);
  text-decoration: none;
}

/* Pink is a human in the text: the quotes are almost always Petter. */
.nw-body blockquote {
  margin: 22px 0;
  padding: 2px 0 2px 14px;
  box-shadow: inset 4px 0 0 var(--nw-pink);
  color: #ffc4e4;
}
.nw-body blockquote p:last-child { margin-bottom: 0; }

.nw-body code,
.nw-body pre { font-family: var(--font-machine); }
.nw-body code { color: var(--nw-cyan); }
.nw-body pre {
  margin: 0 0 20px;
  padding: 10px 12px;
  overflow-x: auto;
  background: var(--nw-surface);
  box-shadow: 0 0 0 2px var(--nw-line);
  font-size: 13px;
  line-height: 20px;
  hyphens: none;
}
.nw-body pre code { color: var(--nw-text); }

.nw-body ul,
.nw-body ol,
.nw-notes ol {
  margin: 0 0 18px;
  padding-left: 26px;
}
.nw-body ul { list-style: square; }
.nw-body li { margin-bottom: 6px; }
.nw-body li::marker,
.nw-notes li::marker { color: var(--nw-gold); }

.nw-body sup {
  margin-left: 1px;
  font-size: 11px;
  font-weight: 700;
  line-height: 0;
  color: var(--nw-gold);
}

.nw-body hr {
  height: 2px;
  margin: 28px 0;
  border: 0;
  background: repeating-linear-gradient(90deg, var(--nw-line) 0 8px, transparent 8px 12px);
}

.nw-body figure { margin: 22px 0; }
.nw-body img {
  display: block;
  max-width: 100%;
  height: auto;
  background: var(--nw-surface);
  box-shadow: 0 0 0 2px var(--nw-line);
}
.nw-body .n-pixel img { image-rendering: pixelated; }
.nw-body figcaption {
  margin-top: 8px;
  font-size: 12px;
  line-height: 18px;
  color: var(--nw-muted);
}
.nw-body .n-figs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 12px;
  margin: 22px 0;
}
.nw-body .n-figs figure { margin: 0; }
.nw-body .n-figs .n-wide { grid-column: 1 / -1; }
@media (min-width: 700px) {
  .nw-body .n-figs.n-three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .nw-body .n-figs.n-four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

.nw-body table {
  display: block;
  max-width: 100%;
  margin: 0 0 20px;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 20px;
  hyphens: manual;
}
.nw-body th,
.nw-body td {
  padding: 6px 12px 6px 0;
  border-bottom: 2px solid var(--nw-line);
  text-align: left;
  vertical-align: top;
}
.nw-body th { color: var(--nw-cyan); font-weight: 700; }

/* Who wrote it and from what: the note under the byline. */
.nw-body .n-byline-note {
  margin: 0 0 24px;
  padding: 10px 12px 10px 16px;
  background: var(--nw-surface);
  box-shadow: inset 4px 0 0 var(--nw-cyan);
  font-size: 13px;
  line-height: 21px;
  color: var(--nw-muted);
}
.nw-body .n-byline-note p { margin: 0 0 10px; }
.nw-body .n-byline-note p:last-child { margin-bottom: 0; }

/* Where the article runs a live cell, the stand has a line that leads there. */
.nw-body .n-live {
  display: block;
  margin: 22px 0;
  padding: 10px 12px;
  box-shadow: 0 0 0 2px var(--nw-gold);
  font-size: 13px;
  line-height: 21px;
  color: var(--nw-gold);
}

.nw-notes {
  margin-top: 40px;
  padding-top: 4px;
  border-top: 2px solid var(--nw-line);
  font-size: 13px;
  line-height: 21px;
  color: var(--nw-muted);
}
.nw-notes h4 { margin: 20px 0 12px; }
.nw-notes li { margin-bottom: 8px; }

.nw-end {
  margin: 40px 0 0;
  font-size: 16px;
  text-align: center;
  color: var(--nw-dim);
}

.nw-prose ::selection { background: rgba(47, 243, 255, 0.28); color: var(--nw-ink); }

/* ── The footer ───────────────────────────────────────────────────────── */
.nw-foot {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 2px solid var(--nw-line);
}

.nw-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 2px;
}

.nw-btn {
  box-sizing: border-box;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 12px;
  text-align: center;
  text-decoration: none;
  font-size: 16px;
  line-height: 16px;
}
.nw-btn.is-sel {
  outline: none;
  color: #0b0616;
  background: var(--px-edge);
}

.nw-keys {
  margin: 8px 0 0;
  color: var(--nw-dim);
}

@media (max-width: 420px) {
  .nw { padding-left: 6px; padding-right: 6px; }
  .nw-box { padding: 12px 10px 8px; }
  .nw-host { visibility: hidden; }
}

@media (prefers-reduced-motion: reduce) {
  .nw-blink,
  .nw-cursor { animation: none; }
}
</style>
