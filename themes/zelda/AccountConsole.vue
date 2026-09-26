<template>
  <div class="acct" @pointerdown.self="onBackdrop">
    <section
      ref="box"
      class="acct-box px-box"
      role="dialog"
      aria-modal="true"
      aria-labelledby="acct-title"
    >
      <header class="acct-head">
        <h2 id="acct-title" class="acct-title">SLEEPER ACCOUNT</h2>
        <span class="acct-host" aria-hidden="true">AUTH.PHAREIM.NO</span>
      </header>

      <div class="acct-screen" role="status" aria-live="polite">
        <template v-if="view === 'dialing'">
          <p>&gt; DIALING<span class="acct-cursor" aria-hidden="true" /></p>
        </template>
        <template v-else-if="view === 'busy'">
          <p>&gt; LOGGING OUT<span class="acct-cursor" aria-hidden="true" /></p>
        </template>
        <template v-else-if="view === 'in' && user">
          <p>&gt; LOGGED IN AS</p>
          <p class="acct-name">{{ displayName }}</p>
          <p class="acct-dim acct-mail">{{ user.email }}</p>
          <p>&gt; READY<span class="acct-cursor" aria-hidden="true" /></p>
        </template>
        <template v-else-if="view === 'offline'">
          <p class="acct-warn">&gt; NO CARRIER.</p>
          <p class="acct-dim">THE ACCOUNT SERVER IS NOT ANSWERING. THE LINKS MAY STILL WORK.</p>
        </template>
        <template v-else>
          <p v-if="loggedOut">&gt; LOGGED OUT. SLEEP WELL.</p>
          <p v-else>&gt; NOBODY LOGGED IN.</p>
          <p>&gt; LOGIN:<span class="acct-cursor" aria-hidden="true" /></p>
        </template>
      </div>

      <div class="acct-actions">
        <template v-for="(a, i) in actions" :key="a.id">
          <a
            v-if="a.href"
            :ref="el => setBtn(i, el)"
            class="px-btn acct-btn"
            :class="{ 'is-sel': i === sel, 'px-btn--pink': a.pink }"
            :href="a.href"
            @click="e => onLink(e, a.href!)"
            @pointerenter="sel = i"
          >
            <span class="acct-mark" aria-hidden="true">▶</span>{{ a.label }}
          </a>
          <button
            v-else
            :ref="el => setBtn(i, el)"
            type="button"
            class="px-btn acct-btn"
            :class="{ 'is-sel': i === sel, 'px-btn--pink': a.pink }"
            @click="run(a.id)"
            @pointerenter="sel = i"
          >
            <span class="acct-mark" aria-hidden="true">▶</span>{{ a.label }}
          </button>
        </template>
      </div>

      <p v-if="view === 'out' || view === 'offline'" class="acct-note">NEW ACCOUNTS NEED THE INVITE PHRASE.</p>
      <p v-if="!touch" class="acct-keys" aria-hidden="true">ENTER RUNS · ESC CLOSES</p>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * The login console's panel in Petter's house: a terminal in Neon Shrine's
 * dialog box over the town. It asks auth.phareim.no who is logged in
 * (`account.ts`), then offers LOG IN / CREATE ACCOUNT (full page loads to the
 * auth page, back here afterwards) or LOG OUT.
 *
 * Keys, while it is open, are its own: arrows / WASD / Tab choose, Enter /
 * Space / J / Z press, Escape / Backspace / K / X close. They are caught on
 * `window` in the capture phase, so the world, the Escape pill and the
 * shell's Escape never see them. Taps work on the buttons; a tap beside the
 * box closes it. The shell (`Zelda.vue`) saves the spot and navigates on
 * `leave`, and freezes the hero while the panel is open.
 */
import { AUTH_BASE, authPageUrl, fetchSession, signOut, type AuthUser } from './account'

const props = defineProps<{
  /** The touch deck is showing: no key hints. */
  touch: boolean
  /** Fetch for the auth calls (tests and the lab pass a fake). */
  fetcher?: typeof fetch
  /** Where the auth pages send the visitor back to; default this site's `/`. */
  back?: string
}>()

const emit = defineEmits<{
  close: []
  /** Go to an auth page (a full page load): the shell saves the spot first. */
  leave: [url: string]
}>()

type View = 'dialing' | 'in' | 'out' | 'offline' | 'busy'
type ActionId = 'login' | 'signup' | 'logout' | 'close'
interface Action { id: ActionId; label: string; href?: string; pink?: boolean }

/** Presses this soon after opening are the ones that opened it (a held Enter, a tap lifting off): ignored. */
const GRACE_MS = 350
const PREV = new Set(['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA'])
const NEXT = new Set(['ArrowDown', 'ArrowRight', 'KeyS', 'KeyD'])
const PRESS = new Set(['Enter', 'NumpadEnter', 'Space', 'KeyJ', 'KeyZ'])
const CLOSE = new Set(['Escape', 'Backspace', 'KeyK', 'KeyX'])

const view = ref<View>('dialing')
const user = ref<AuthUser | null>(null)
const loggedOut = ref(false)
const sel = ref(0)
const box = ref<HTMLElement | null>(null)
const btns: Array<HTMLElement | null> = []
let openedAt = 0
let alive = true

const f = (...a: Parameters<typeof fetch>) => (props.fetcher ?? fetch)(...a)
const back = () => props.back ?? `${window.location.origin}/`

const displayName = computed(() => {
  const u = user.value
  if (!u) return ''
  return (u.name ?? u.email.split('@')[0] ?? u.email).toUpperCase()
})

const actions = computed<Action[]>(() => {
  const close: Action = { id: 'close', label: 'CLOSE' }
  switch (view.value) {
    case 'in': return [{ id: 'logout', label: 'LOG OUT', pink: true }, close]
    case 'out':
    case 'offline':
      if (!import.meta.client) return [close]
      return [
        { id: 'login', label: 'LOG IN', href: authPageUrl('signin', back()) },
        { id: 'signup', label: 'CREATE ACCOUNT', href: authPageUrl('signup', back()), pink: true },
        close,
      ]
    default: return [close]
  }
})

function setBtn(i: number, el: unknown) {
  btns[i] = (el as HTMLElement | null) ?? null
}

/** The chosen button has the keyboard focus too, for screen readers. */
function focusSel() {
  nextTick(() => btns[sel.value]?.focus({ preventScroll: true }))
}

watch(actions, () => { sel.value = 0; focusSel() })

function move(d: number) {
  const n = actions.value.length
  sel.value = (sel.value + d + n) % n
  focusSel()
}

function early() {
  return performance.now() - openedAt < GRACE_MS
}

function run(id: ActionId) {
  if (early()) return
  const a = actions.value.find((x: Action) => x.id === id)
  if (!a) return
  if (a.href) { emit('leave', a.href); return }
  if (id === 'close') emit('close')
  else if (id === 'logout') void logout()
}

function onLink(e: MouseEvent, href: string) {
  // A new tab or window is the browser's business; this tab stays in the town.
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  e.preventDefault()
  if (!early()) emit('leave', href)
}

function onBackdrop() {
  if (!early()) emit('close')
}

async function load() {
  view.value = 'dialing'
  const s = await fetchSession(f, AUTH_BASE)
  if (!alive) return
  if (s.state === 'in') user.value = s.user
  view.value = s.state
}

async function logout() {
  view.value = 'busy'
  const ok = await signOut(f, AUTH_BASE)
  if (!alive) return
  if (ok) {
    user.value = null
    loggedOut.value = true
    view.value = 'out'
  } else {
    await load()
  }
}

function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  // The panel owns the keyboard: nothing behind it hears a key.
  e.stopPropagation()
  const c = e.code
  if (e.type === 'keyup') {
    // A Space let go on a focused button would click it.
    if (PRESS.has(c)) e.preventDefault()
    return
  }
  if (PREV.has(c)) { e.preventDefault(); move(-1) }
  else if (NEXT.has(c)) { e.preventDefault(); move(1) }
  else if (c === 'Tab') { e.preventDefault(); move(e.shiftKey ? -1 : 1) }
  else if (PRESS.has(c)) {
    e.preventDefault()
    if (e.repeat || early()) return
    const a = actions.value[sel.value]
    if (a) run(a.id)
  } else if (CLOSE.has(c)) {
    e.preventDefault()
    if (!e.repeat) emit('close')
  }
}

onMounted(() => {
  openedAt = performance.now()
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('keyup', onKey, true)
  focusSel()
  void load()
})

onBeforeUnmount(() => {
  alive = false
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('keyup', onKey, true)
})
</script>

<style>
.acct {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  padding: 16px 16px calc(16px + var(--app-safe-bottom, 0px));
  background: rgba(11, 6, 22, 0.55);
  font-family: var(--font-pixel);
  -webkit-font-smoothing: none;
  touch-action: manipulation;
}

.acct-box {
  box-sizing: border-box;
  width: min(360px, 100%);
  max-height: 100%;
  overflow: hidden;
  padding: 16px 16px 14px;
  color: #fff4ff;
  font-size: 16px;
  line-height: 24px;
  text-transform: uppercase;
  background: #0b0616;
}

.acct-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 2px solid #271c46;
}

.acct-title {
  margin: 0;
  font: inherit;
  color: #ff2fa0;
  text-shadow: 2px 2px 0 #3a1a4a;
}

.acct-host {
  color: #6f5ca6;
}

.acct-screen {
  min-height: 48px;
  margin: 0 0 12px;
  color: #2ff3ff;
  text-shadow: 0 0 8px rgba(47, 243, 255, 0.45);
}

.acct-screen p {
  margin: 0;
  overflow-wrap: anywhere;
}

.acct-name {
  color: #fff4ff;
  text-shadow: 2px 2px 0 #3a1a4a;
}

.acct-dim {
  color: #b9a8d9;
  text-shadow: none;
}

.acct-warn {
  color: #ffd23f;
  text-shadow: 0 0 8px rgba(255, 210, 63, 0.4);
}

.acct-cursor {
  display: inline-block;
  width: 10px;
  height: 14px;
  margin-left: 6px;
  vertical-align: -1px;
  background: currentColor;
  animation: acct-blink 1.06s steps(1) infinite;
}

@keyframes acct-blink {
  50% { opacity: 0; }
}

.acct-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px;
}

.acct-btn {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 44px;
  padding: 0 10px;
  text-align: left;
  text-decoration: none;
  font-size: 16px;
  line-height: 16px;
}

.acct-mark {
  width: 12px;
  visibility: hidden;
}

.acct-btn.is-sel {
  outline: none;
  color: #0b0616;
  background: var(--px-edge);
}

.acct-btn.is-sel .acct-mark {
  visibility: visible;
}

.acct-note {
  margin: 12px 0 0;
  color: #ffd23f;
}

.acct-keys {
  margin: 8px 0 0;
  color: #6f5ca6;
}

@media (prefers-reduced-motion: reduce) {
  .acct-cursor { animation: none; }
}
</style>
