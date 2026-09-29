// Lag Din Figur's sign-in window and its Logg ut (themes/figur/ui/SignIn.vue,
// SettingsSheet.vue): Vue files, so these checks read their source for what
// a seven-year-old with an iPad needs. The logic behind the window is
// composables/useAccount.ts (tests/miniworld-login-client.test.mjs) and the
// server's lock is tests/miniworld-account.test.mjs, save slot `figur` included.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(join(repo, p), 'utf8')

test('the window: labelled fields, a show/hide password, big targets, the texts and the sign-up line', () => {
  const w = read('themes/figur/ui/SignIn.vue')
  // Each field has a label, the right type and autofill hints, and no zoom on iOS (18 px).
  assert.match(w, /<label[^>]*for="fg-email"/)
  assert.match(w, /<label[^>]*for="fg-password"/)
  assert.match(w, /type="email"/)
  assert.match(w, /autocomplete="username"/)
  assert.match(w, /autocomplete="current-password"/)
  assert.match(w, /:type="show \? 'text' : 'password'"/)
  assert.match(w, /:aria-pressed="show"/)
  assert.match(w, /font-size: 18px/)
  assert.doesNotMatch(w, /font-size: 1[0-5]px/)
  // Touch targets: inputs, buttons.
  assert.match(w, /\.fg-gate-input \{[^}]*min-height: 56px/)
  assert.match(w, /\.fg-gate-eye \{[^}]*min-height: 56px/)
  assert.match(w, /fg-btn--big fg-btn--wide/)
  // Errors are announced; the retry for a missing connection is a button.
  assert.match(w, /role="alert"/)
  assert.match(w, /PRØV IGJEN/)
  // Sign-up stays on the auth page: a line and a link, no form.
  assert.match(w, /Har du ikke konto\?\s*<a class="fg-gate-link" :href="account\.signUpUrl\(\)">Spør en voksen<\/a>/)
  assert.equal(w.split('<form').length - 1, 1)
  assert.doesNotMatch(w.replace(/<!--[\s\S]*?-->/g, ''), /sign-up|invite/i)
  // It draws in the studio's look, not another.
  assert.match(w, /class="fg-root fg-gate"/)
  assert.match(w, /px-box fg-box/)
  assert.match(w, /<FgIcon id="pip"/)
  // The keyboard does not cover the field, and the page stays put.
  assert.match(w, /useKeyboardInset/)
  assert.match(w, /calc\(12px \+ var\(--app-safe-bottom, 0px\) \+ var\(--fg-kb, 0px\)\)/)
})

test('Logg ut sits in the studio\'s settings, asks once more, and saves first', () => {
  const game = read('themes/figur/Game.vue')
  assert.match(game, /aria-label="Innstillinger" @click="openSheet\('settings'\)"/)
  assert.match(game, /<SettingsSheet v-else-if="sheet === 'settings'"/)
  const s = read('themes/figur/ui/SettingsSheet.vue')
  assert.match(s, /LOGG UT/)
  assert.match(s, /LOGGE UT\?/)
  assert.match(s, /game\.flush\(\)\s*await savesSettled\(\)/)
  assert.match(s, /account\.logOut\(/)
})

test('the game is only rendered behind the gate, and the studio shows no sign-in chrome of its own', () => {
  const landing = read('themes/figur/Landing.vue')
  assert.match(landing, /<FigurGame v-if="account\.state\.value === 'in'" \/>/)
  assert.match(landing, /<FgSignIn v-else :account="account" \/>/)
  assert.match(landing, /import\('\.\/ui\/SignIn\.vue'\)/)
})
