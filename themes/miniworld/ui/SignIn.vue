<template>
  <!-- Mini World before the world: nothing of the game is loaded, only this
    window. Sunny sky, Neon Shrine's dialog box in candy colours, big
    buttons. Sign-up is not here (invite only): a grown-up does it on the
    auth page, and the last line says so. -->
  <div class="mw-root mw-gate" lang="nb" :style="{ '--mw-kb': `${keyboardInset}px` }">
    <p v-if="account.state.value === 'checking'" class="mw-gate-title mw-t" role="status">MINI WORLD</p>

    <div v-else class="mw-gate-scroll">
      <section class="px-box mw-box mw-gate-card" :aria-label="offline ? 'Ingen kontakt' : 'Logg inn'">
        <h1 class="mw-gate-title mw-gate-title--card mw-t">MINI WORLD</h1>
        <PxIcon id="wave" :scale="6" class="mw-gate-pic" />

        <template v-if="offline">
          <p class="mw-h mw-center">FÅR IKKE KONTAKT</p>
          <p class="mw-p mw-center mw-dim" role="alert">{{ account.problem.value }}</p>
          <button ref="retryRef" type="button" class="px-btn mw-btn mw-btn--go mw-btn--big mw-btn--wide" :disabled="account.busy.value" @click="account.check()">
            PRØV IGJEN
          </button>
        </template>

        <form v-else class="mw-gate-form" novalidate @submit.prevent="submit">
          <p class="mw-h mw-center">LOGG INN FOR Å SPILLE</p>

          <label class="mw-gate-label mw-t" for="mw-email">E-POST</label>
          <input
            id="mw-email"
            ref="emailRef"
            v-model="email"
            class="mw-gate-input"
            type="email"
            inputmode="email"
            autocomplete="username"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="next"
            :disabled="account.busy.value"
          >

          <label class="mw-gate-label mw-t" for="mw-password">PASSORD</label>
          <div class="mw-gate-pass">
            <input
              id="mw-password"
              v-model="password"
              class="mw-gate-input"
              :type="show ? 'text' : 'password'"
              autocomplete="current-password"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              enterkeyhint="go"
              :disabled="account.busy.value"
            >
            <button
              type="button"
              class="px-btn mw-btn mw-btn--plain mw-gate-eye"
              :aria-pressed="show"
              :aria-label="show ? 'Skjul passordet' : 'Vis passordet'"
              @click="show = !show"
            >
              {{ show ? 'SKJUL' : 'VIS' }}
            </button>
          </div>

          <p v-if="account.problem.value" class="mw-p mw-warn mw-center mw-gate-problem" role="alert">{{ account.problem.value }}</p>

          <button type="submit" class="px-btn mw-btn mw-btn--go mw-btn--big mw-btn--wide" :disabled="account.busy.value">
            {{ account.busy.value ? 'VENT LITT …' : 'LOGG INN' }}
          </button>

          <p class="mw-p mw-dim mw-center mw-gate-help">
            Har du ikke konto?
            <a class="mw-gate-link" :href="account.signUpUrl()">Spør en voksen</a>
          </p>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import PxIcon from './PxIcon.vue'
import './mw.css'
import type { AccountApi } from '~/composables/useAccount'
import { useKeyboardInset } from '~/composables/useKeyboardInset'

const props = defineProps<{ account: AccountApi }>()
const keyboardInset = useKeyboardInset()

const email = ref('')
const password = ref('')
const show = ref(false)
const emailRef = ref<HTMLInputElement | null>(null)
const retryRef = ref<HTMLButtonElement | null>(null)
const offline = computed(() => props.account.state.value === 'offline')

async function submit() {
  const ok = await props.account.submit(email.value, password.value)
  // The password is not kept once it has been used; after a miss it stays, for a typo.
  if (ok) password.value = ''
}

onMounted(() => { void props.account.check() })
</script>

<style scoped>
.mw-gate {
  position: absolute;
  inset: 0;
  z-index: 30;
  overflow: hidden;
  background: var(--mw-sky);
  touch-action: pan-y;
}
.mw-gate-scroll {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  display: flex;
  padding:
    max(12px, env(safe-area-inset-top, 0px))
    max(12px, env(safe-area-inset-right, 0px))
    calc(12px + var(--app-safe-bottom, 0px) + var(--mw-kb, 0px))
    max(12px, env(safe-area-inset-left, 0px));
}
.mw-gate-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: 460px;
  margin: auto;
  padding: 22px 20px 22px;
  box-sizing: border-box;
}
.mw-gate-title {
  position: absolute;
  inset: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: #ffffff;
  text-shadow: 6px 6px 0 var(--mw-ink);
}
.mw-gate-title--card {
  position: static;
  inset: auto;
  font-size: 40px;
  line-height: 1;
  font-weight: 400;
  color: var(--mw-pink);
  text-shadow: 4px 4px 0 var(--mw-ink);
  text-align: center;
}
.mw-gate-form { display: flex; flex-direction: column; gap: 10px; width: 100%; }
.mw-gate-label { margin: 6px 0 0; font-size: 16px; color: var(--mw-ink-soft); }
.mw-gate-input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  min-height: 56px;
  padding: 0 12px;
  border: 0;
  border-radius: 0;
  outline: none;
  /* The pixel font has capitals only: typed text is Space Mono, 18 px so iOS does not zoom in. */
  font-family: var(--font-machine);
  font-size: 18px;
  color: var(--mw-ink);
  background: var(--mw-tile);
  box-shadow: 0 -3px 0 0 var(--mw-ink), 0 3px 0 0 var(--mw-ink), -3px 0 0 0 var(--mw-ink), 3px 0 0 0 var(--mw-ink);
  -webkit-appearance: none;
  appearance: none;
  user-select: text;
  -webkit-user-select: text;
}
.mw-gate-input:focus {
  background: var(--mw-yellow-soft);
  box-shadow: 0 -3px 0 0 var(--mw-pink), 0 3px 0 0 var(--mw-pink), -3px 0 0 0 var(--mw-pink), 3px 0 0 0 var(--mw-pink);
}
.mw-gate-input:disabled { opacity: 0.6; }
.mw-gate-pass { display: flex; align-items: center; gap: 12px; }
.mw-gate-eye { flex: none; min-width: 84px; min-height: 56px; }
.mw-gate-problem { padding: 4px 0; }
.mw-gate-help { margin-top: 6px; font-size: 16px; }
.mw-gate-link { color: var(--mw-ink); text-decoration: underline; text-underline-offset: 4px; padding: 10px 2px; }
@media (max-width: 420px) {
  .mw-gate-title { font-size: 32px; text-shadow: 4px 4px 0 var(--mw-ink); }
  .mw-gate-title--card { font-size: 32px; }
}
@media (max-height: 560px) {
  .mw-gate-card { gap: 8px; padding: 14px 16px; }
  .mw-gate-title--card { font-size: 24px; text-shadow: 2px 2px 0 var(--mw-ink); }
  .mw-gate-pic { display: none; }
}
</style>
