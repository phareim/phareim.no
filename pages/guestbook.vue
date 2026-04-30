<template>
  <div class="guestbook-page">
    <header class="gb-header">
      <h1>{{ pageTitle }}</h1>
      <p class="subtitle">{{ pageSubtitle }}</p>
    </header>

    <!-- Form -->
    <section class="gb-form-section" aria-label="Leave a note">
      <form class="gb-form" @submit.prevent="submit">
        <div class="gb-field">
          <label for="gb-name" class="gb-label">name</label>
          <input
            id="gb-name"
            v-model="form.name"
            type="text"
            class="gb-input"
            placeholder="your name"
            maxlength="60"
            autocomplete="name"
            :disabled="submitting || submitted"
            required
          />
        </div>
        <div class="gb-field">
          <label for="gb-message" class="gb-label">message</label>
          <textarea
            id="gb-message"
            v-model="form.message"
            class="gb-textarea"
            placeholder="say something…"
            maxlength="280"
            rows="3"
            :disabled="submitting || submitted"
            required
          ></textarea>
          <span class="gb-char-count" :class="{ warn: form.message.length > 240 }">
            {{ form.message.length }}/280
          </span>
        </div>

        <div v-if="error" class="gb-error" role="alert">{{ error }}</div>

        <div v-if="submitted" class="gb-success" role="status">
          {{ successMsg }}
        </div>
        <button
          v-else
          type="submit"
          class="gb-submit"
          :disabled="submitting || !form.name.trim() || !form.message.trim()"
        >
          {{ submitLabel }}
        </button>
      </form>
    </section>

    <div class="gb-divider" aria-hidden="true"></div>

    <!-- Entries list -->
    <section class="gb-entries" aria-label="Guestbook entries">
      <h2 class="section-label">{{ entries.length ? `${entries.length} note${entries.length !== 1 ? 's' : ''}` : 'notes' }}</h2>

      <div v-if="pending" class="gb-loading">
        <span class="loading-text">fetching notes…</span>
      </div>
      <div v-else-if="!entries.length" class="gb-empty">
        <p>{{ emptyMsg }}</p>
      </div>
      <ol v-else class="gb-list">
        <li
          v-for="(entry, index) in entries"
          :key="entry.id"
          class="gb-entry"
          :style="{ '--entry-index': index }"
        >
          <div class="gb-entry-header">
            <span class="gb-entry-name">{{ entry.name }}</span>
            <span class="gb-entry-date">{{ formatDate(entry.created_at) }}</span>
          </div>
          <p class="gb-entry-message">{{ entry.message }}</p>
        </li>
      </ol>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { GuestbookEntry } from '~/server/api/guestbook'

useHead({ title: 'guestbook — phareim.no' })

const { activeTheme } = useTheme()
const { data: entriesData, pending, refresh } = await useFetch<GuestbookEntry[]>('/api/guestbook')
const entries = computed(() => entriesData.value ?? [])

const form = reactive({ name: '', message: '' })
const submitting = ref(false)
const submitted = ref(false)
const error = ref('')

const pageTitle = computed(() => {
  if (activeTheme.value === 'hacker') return 'guestbook.log'
  if (activeTheme.value === 'space') return 'VISITOR LOG'
  return 'guestbook'
})

const pageSubtitle = computed(() => {
  if (activeTheme.value === 'hacker') return '// append your entry to the ledger'
  if (activeTheme.value === 'space') return 'LOG YOUR PRESENCE — LEAVE A TRANSMISSION'
  return 'leave a note, sign the wall'
})

const submitLabel = computed(() => {
  if (submitting.value) {
    if (activeTheme.value === 'hacker') return 'writing...'
    if (activeTheme.value === 'space') return 'TRANSMITTING...'
    return 'sending…'
  }
  if (activeTheme.value === 'hacker') return 'append.exe'
  if (activeTheme.value === 'space') return 'TRANSMIT'
  return 'sign'
})

const successMsg = computed(() => {
  if (activeTheme.value === 'hacker') return '> entry appended successfully'
  if (activeTheme.value === 'space') return 'TRANSMISSION RECEIVED'
  return 'thanks for signing!'
})

const emptyMsg = computed(() => {
  if (activeTheme.value === 'hacker') return '// no entries yet — be the first to append'
  if (activeTheme.value === 'space') return 'NO TRANSMISSIONS YET — MAKE FIRST CONTACT'
  return 'no entries yet — be the first!'
})

async function submit() {
  if (submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    await $fetch('/api/guestbook', {
      method: 'POST',
      body: { name: form.name.trim(), message: form.message.trim() },
    })
    submitted.value = true
    form.name = ''
    form.message = ''
    await refresh()
  } catch (err: any) {
    const msg = err?.data?.statusMessage ?? err?.message ?? 'something went wrong'
    error.value = msg
  } finally {
    submitting.value = false
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
.guestbook-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 3rem 1.5rem 5rem;
  box-sizing: border-box;
  max-width: 580px;
  margin: 0 auto;
}

.gb-header {
  margin-bottom: 2.5rem;
}

h1 {
  font-size: clamp(2rem, 6vw, 3.5rem);
  margin: 0 0 0.5rem;
  color: var(--theme-text, #111);
  font-weight: 500;
}

.subtitle {
  color: var(--theme-text-muted, #666);
  font-size: 1rem;
  margin: 0;
}

/* ── Form ───────────────────────────────────────────────────── */

.gb-form-section {
  margin-bottom: 0;
}

.gb-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.gb-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  position: relative;
}

.gb-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--theme-text-subtle, #aaa);
}

.gb-input,
.gb-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.65rem 1rem;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.1));
  border-radius: var(--theme-card-radius, 16px);
  color: var(--theme-text, #111);
  font-family: inherit;
  font-size: 0.95rem;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  resize: none;
}

.gb-input::placeholder,
.gb-textarea::placeholder {
  color: var(--theme-text-subtle, #bbb);
}

.gb-input:focus,
.gb-textarea:focus {
  border-color: var(--theme-accent, #89abd0);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-accent, #89abd0) 18%, transparent);
}

.gb-input:disabled,
.gb-textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gb-char-count {
  align-self: flex-end;
  font-size: 0.65rem;
  color: var(--theme-text-subtle, #bbb);
  line-height: 1;
}

.gb-char-count.warn {
  color: var(--theme-accent-danger, #c1272d);
}

.gb-error {
  font-size: 0.85rem;
  color: var(--theme-accent-danger, #c1272d);
  padding: 0.6rem 0.9rem;
  background: color-mix(in srgb, var(--theme-accent-danger, #c1272d) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-accent-danger, #c1272d) 20%, transparent);
  border-radius: calc(var(--theme-card-radius, 16px) * 0.6);
}

.gb-success {
  font-size: 0.9rem;
  color: var(--theme-accent, #6b8cae);
  padding: 0.6rem 0.9rem;
  background: color-mix(in srgb, var(--theme-accent, #6b8cae) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-accent, #6b8cae) 20%, transparent);
  border-radius: calc(var(--theme-card-radius, 16px) * 0.6);
  text-align: center;
}

.gb-submit {
  align-self: flex-start;
  padding: 0.55rem 1.75rem;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.12));
  border-radius: var(--theme-card-radius, 16px);
  color: var(--theme-text, #111);
  font-family: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: border-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
}

.gb-submit:hover:not(:disabled) {
  border-color: var(--theme-accent, #89abd0);
  color: var(--theme-accent, #89abd0);
}

.gb-submit:focus-visible {
  outline: 2px solid var(--theme-accent, #89abd0);
  outline-offset: 2px;
  border-color: var(--theme-accent, #89abd0);
}

.gb-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Divider ────────────────────────────────────────────────── */

.gb-divider {
  width: 36px;
  height: 1px;
  background: var(--theme-card-border, rgba(0, 0, 0, 0.12));
  margin: 2.5rem 0;
}

/* ── Entries ────────────────────────────────────────────────── */

.section-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--theme-text-subtle, #aaa);
  margin: 0 0 1.25rem;
}

.gb-loading,
.gb-empty {
  color: var(--theme-text-muted, #888);
  font-size: 0.9rem;
  padding: 0.5rem 0;
}

.gb-empty p {
  margin: 0;
  font-style: italic;
}

.loading-text {
  animation: loading-pulse 1.6s ease-in-out infinite;
}

@keyframes loading-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.gb-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

@keyframes entry-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.gb-entry {
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  border-radius: var(--theme-card-radius, 16px);
  padding: 1rem 1.25rem;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 2px 8px var(--theme-card-shadow, rgba(0, 0, 0, 0.04));
  transition: box-shadow 0.2s ease;
  animation: entry-in 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  animation-delay: calc(var(--entry-index, 0) * 45ms);
}

.gb-entry:hover {
  box-shadow: 0 4px 16px var(--theme-card-shadow, rgba(0, 0, 0, 0.08));
}

@media (prefers-reduced-motion: reduce) {
  .gb-entry {
    animation: none;
  }
}

.gb-entry-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.45rem;
}

.gb-entry-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--theme-text, #111);
}

.gb-entry-date {
  font-size: 0.68rem;
  color: var(--theme-text-subtle, #aaa);
  white-space: nowrap;
  flex-shrink: 0;
}

.gb-entry-message {
  font-size: 0.9rem;
  color: var(--theme-text-muted, #555);
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Hacker theme overrides ─────────────────────────────────── */

:global(.hacker-page) h1 {
  font-family: monospace;
  text-transform: lowercase;
  text-shadow: 0 0 10px currentColor;
}

:global(.hacker-page) .subtitle {
  font-family: monospace;
}

:global(.hacker-page) .section-label {
  font-family: monospace;
}

:global(.hacker-page) .gb-label {
  font-family: monospace;
}

:global(.hacker-page) .gb-input,
:global(.hacker-page) .gb-textarea {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .gb-submit {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .gb-entry {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .gb-entry-name {
  font-family: monospace;
  text-shadow: 0 0 6px currentColor;
}

:global(.hacker-page) .gb-entry:hover {
  box-shadow: 0 0 18px var(--theme-card-shadow, rgba(0, 255, 65, 0.2));
}

/* ── Space theme overrides ──────────────────────────────────── */

:global(.space-page) h1 {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  text-shadow: 0 0 40px rgba(140, 170, 220, 0.3);
}

:global(.space-page) .section-label {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
}

:global(.space-page) .gb-entry:hover {
  box-shadow:
    0 8px 32px var(--theme-card-shadow, rgba(140, 170, 220, 0.15)),
    0 0 0 1px rgba(140, 170, 220, 0.2);
}
</style>
