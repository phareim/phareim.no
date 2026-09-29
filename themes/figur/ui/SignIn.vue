<template>
  <!-- Lag Din Figur before the studio: nothing of it is loaded, only this
    window. Lilac and pink, the pixel look's dialog box, Pip waving, big
    buttons. Sign-up is not here (invite only): a grown-up does it on the
    auth page, and the last line says so. -->
  <div class="fg-root fg-gate" lang="nb" :style="{ '--fg-kb': `${keyboardInset}px` }">
    <p v-if="account.state.value === 'checking'" class="fg-gate-title fg-t" role="status">LAG DIN FIGUR</p>

    <div v-else class="fg-gate-scroll">
      <section class="px-box fg-box fg-gate-card" :aria-label="offline ? 'Ingen kontakt' : 'Logg inn'">
        <h1 class="fg-gate-title fg-gate-title--card fg-t">LAG DIN FIGUR</h1>
        <FgIcon id="pip" :scale="6" class="fg-gate-pic" />

        <template v-if="offline">
          <p class="fg-h fg-gate-center">FÅR IKKE KONTAKT</p>
          <p class="fg-p fg-dim fg-gate-center" role="alert">{{ account.problem.value }}</p>
          <button type="button" class="px-btn fg-btn fg-btn--go fg-btn--big fg-btn--wide" :disabled="account.busy.value" @click="account.check()">
            PRØV IGJEN
          </button>
        </template>

        <form v-else class="fg-gate-form" novalidate @submit.prevent="submit">
          <p class="fg-h fg-gate-center">LOGG INN FOR Å LAGE FIGURER</p>

          <label class="fg-gate-label fg-t" for="fg-email">E-POST</label>
          <input
            id="fg-email"
            v-model="email"
            class="fg-gate-input"
            type="email"
            inputmode="email"
            autocomplete="username"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="next"
            :disabled="account.busy.value"
          >

          <label class="fg-gate-label fg-t" for="fg-password">PASSORD</label>
          <div class="fg-gate-pass">
            <input
              id="fg-password"
              v-model="password"
              class="fg-gate-input"
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
              class="px-btn fg-btn fg-btn--plain fg-gate-eye"
              :aria-pressed="show"
              :aria-label="show ? 'Skjul passordet' : 'Vis passordet'"
              @click="show = !show"
            >
              {{ show ? 'SKJUL' : 'VIS' }}
            </button>
          </div>

          <p v-if="account.problem.value" class="fg-p fg-warn fg-gate-center fg-gate-problem" role="alert">{{ account.problem.value }}</p>

          <button type="submit" class="px-btn fg-btn fg-btn--go fg-btn--big fg-btn--wide" :disabled="account.busy.value">
            {{ account.busy.value ? 'VENT LITT …' : 'LOGG INN' }}
          </button>

          <p class="fg-p fg-dim fg-gate-center fg-gate-help">
            Har du ikke konto?
            <a class="fg-gate-link" :href="account.signUpUrl()">Spør en voksen</a>
          </p>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import FgIcon from './FgIcon.vue'
import './figur.css'
import type { AccountApi } from '~/composables/useAccount'
import { useKeyboardInset } from '~/composables/useKeyboardInset'

const props = defineProps<{ account: AccountApi }>()
const keyboardInset = useKeyboardInset()

const email = ref('')
const password = ref('')
const show = ref(false)
const offline = computed(() => props.account.state.value === 'offline')

async function submit() {
  const ok = await props.account.submit(email.value, password.value)
  // The password is not kept once it has been used; after a miss it stays, for a typo.
  if (ok) password.value = ''
}

onMounted(() => { void props.account.check() })
</script>

<style scoped>
.fg-gate {
  position: absolute;
  inset: 0;
  z-index: 30;
  overflow: hidden;
  background: var(--figur-bg, #f6d8ff);
  touch-action: pan-y;
}
.fg-gate-scroll {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  display: flex;
  padding:
    max(12px, env(safe-area-inset-top, 0px))
    max(12px, env(safe-area-inset-right, 0px))
    calc(12px + var(--app-safe-bottom, 0px) + var(--fg-kb, 0px))
    max(12px, env(safe-area-inset-left, 0px));
}
.fg-gate-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: 460px;
  margin: auto;
  padding: 22px 20px;
  box-sizing: border-box;
}
.fg-gate-title {
  position: absolute;
  inset: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 48px;
  color: #ffffff;
  text-shadow: 6px 6px 0 var(--fg-ink);
}
.fg-gate-title--card {
  position: static;
  inset: auto;
  font-size: 32px;
  line-height: 1.1;
  font-weight: 400;
  color: var(--fg-pink-deep);
  text-shadow: 3px 3px 0 var(--fg-ink);
}
.fg-gate-form { display: flex; flex-direction: column; gap: 10px; width: 100%; }
.fg-gate-center { text-align: center; }
.fg-gate-label { margin: 6px 0 0; font-size: 16px; color: var(--fg-ink-soft); }
.fg-gate-input {
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
  color: var(--fg-ink);
  background: var(--fg-tile);
  box-shadow: 0 -3px 0 0 var(--fg-ink), 0 3px 0 0 var(--fg-ink), -3px 0 0 0 var(--fg-ink), 3px 0 0 0 var(--fg-ink);
  -webkit-appearance: none;
  appearance: none;
  user-select: text;
  -webkit-user-select: text;
}
.fg-gate-input:focus {
  background: var(--fg-sun-soft);
  box-shadow: 0 -3px 0 0 var(--fg-pink-deep), 0 3px 0 0 var(--fg-pink-deep), -3px 0 0 0 var(--fg-pink-deep), 3px 0 0 0 var(--fg-pink-deep);
}
.fg-gate-input:disabled { opacity: 0.6; }
.fg-gate-pass { display: flex; align-items: center; gap: 12px; }
.fg-gate-eye { flex: none; min-width: 84px; min-height: 56px; }
.fg-gate-problem { padding: 4px 0; }
.fg-gate-help { margin-top: 6px; }
.fg-gate-link { color: var(--fg-ink); text-decoration: underline; text-underline-offset: 4px; padding: 10px 2px; }
@media (max-width: 520px) {
  .fg-gate-title { font-size: 32px; text-shadow: 4px 4px 0 var(--fg-ink); }
  .fg-gate-title--card { font-size: 24px; }
}
@media (max-height: 560px) {
  .fg-gate-card { gap: 8px; padding: 14px 16px; }
  .fg-gate-pic { display: none; }
  .fg-gate-title--card { text-shadow: 2px 2px 0 var(--fg-ink); }
}
</style>
