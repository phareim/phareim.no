<template>
  <Teleport to="body">
    <Transition name="palette">
      <div
        v-if="open"
        class="palette-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        @click.self="$emit('close')"
      >
        <div class="palette-panel">
          <!-- Search row -->
          <div class="palette-search-row">
            <svg class="palette-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="palette-input"
              placeholder="search commands…"
              autocomplete="off"
              spellcheck="false"
              @keydown.down.prevent="move(1)"
              @keydown.up.prevent="move(-1)"
              @keydown.enter.prevent="runSelected"
              @keydown.esc.stop="$emit('close')"
            />
            <span class="palette-esc-hint" aria-hidden="true">esc</span>
          </div>

          <div class="palette-divider" aria-hidden="true" />

          <!-- Results -->
          <div class="palette-results" ref="resultsRef" role="listbox">
            <template v-if="groups.length">
              <template v-for="group in groups" :key="group.type">
                <div class="palette-group-label" role="presentation">{{ group.label }}</div>
                <button
                  v-for="cmd in group.commands"
                  :key="cmd.id"
                  class="palette-item"
                  :class="{ 'is-active': selectedId === cmd.id }"
                  role="option"
                  :aria-selected="selectedId === cmd.id"
                  @click="run(cmd)"
                  @mouseenter="selectedId = cmd.id"
                >
                  <span class="palette-item-icon" aria-hidden="true">{{ cmd.icon }}</span>
                  <span class="palette-item-name">{{ cmd.label }}</span>
                  <span v-if="cmd.hint" class="palette-item-hint" aria-hidden="true">{{ cmd.hint }}</span>
                </button>
              </template>
            </template>
            <div v-else class="palette-empty">no commands found</div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()
const props = defineProps<{ open: boolean }>()

const { setTheme } = useTheme()
const router = useRouter()

const query = ref('')
const selectedId = ref<string | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const resultsRef = ref<HTMLElement | null>(null)

interface Command {
  id: string
  label: string
  icon: string
  hint?: string
  type: 'page' | 'theme' | 'external'
  action: () => void
}

const allCommands: Command[] = [
  { id: 'nav-home',     label: 'home',              icon: '🏚️', hint: '/',        type: 'page',     action: () => router.push('/') },
  { id: 'nav-about',   label: 'about',              icon: '👤', hint: '/about',    type: 'page',     action: () => router.push('/about') },
  { id: 'nav-projects',label: 'projects',            icon: '🔧', hint: '/projects', type: 'page',     action: () => router.push('/projects') },
  { id: 'nav-feed',    label: 'thoughts',            icon: '💬', hint: '/feed',     type: 'page',     action: () => router.push('/feed') },
  { id: 'nav-now',     label: 'now',                 icon: '📍', hint: '/now',      type: 'page',     action: () => router.push('/now') },
  { id: 'nav-uses',    label: 'uses',                icon: '🔩', hint: '/uses',     type: 'page',     action: () => router.push('/uses') },
  { id: 'nav-guestbook', label: 'guestbook',           icon: '✍️', hint: '/guestbook', type: 'page',    action: () => router.push('/guestbook') },
  { id: 'nav-activity', label: 'activity',            icon: '📡', hint: '/activity', type: 'page',     action: () => router.push('/activity') },
  { id: 'nav-stats',   label: 'stats',               icon: '📊', hint: '/stats',    type: 'page',     action: () => router.push('/stats') },
  { id: 'nav-meta',    label: 'meta',                icon: '📋', hint: '/meta',     type: 'page',     action: () => router.push('/meta') },
  { id: 'nav-colophon', label: 'colophon',           icon: '📖', hint: '/colophon',    type: 'page',     action: () => router.push('/colophon') },
  { id: 'nav-playground', label: 'playground',      icon: '✦',  hint: '/playground', type: 'page',     action: () => router.push('/playground') },
  { id: 'nav-gallery', label: 'gallery',             icon: '🖼️', hint: '/gallery',    type: 'page',     action: () => router.push('/gallery') },
  { id: 'nav-clock',   label: 'clock',               icon: '🕐', hint: '/clock',      type: 'page',     action: () => router.push('/clock') },
  { id: 'nav-lab',     label: 'lab',                 icon: '🧪', hint: '/lab',      type: 'page',     action: () => router.push('/lab') },
  { id: 'theme-scandi', label: 'scandinavian glass', icon: '❄️', hint: '1',         type: 'theme',    action: () => setTheme('scandi') },
  { id: 'theme-hacker',label: 'cyberpunk',           icon: '📟', hint: '2',         type: 'theme',    action: () => setTheme('hacker') },
  { id: 'theme-space', label: 'space',               icon: '🚀', hint: '3',         type: 'theme',    action: () => setTheme('space') },
  { id: 'ext-reddot',  label: 'red dot game',        icon: '🔴',                    type: 'external', action: () => window.open('https://dot.phareim.no', '_blank', 'noopener,noreferrer') },
  { id: 'ext-reader',  label: 'rss reader',          icon: '📰',                    type: 'external', action: () => window.open('https://reader.phareim.no', '_blank', 'noopener,noreferrer') },
]

const groups = computed(() => {
  const q = query.value.trim().toLowerCase()
  const filtered = q
    ? allCommands.filter(c => c.label.toLowerCase().includes(q) || c.type.includes(q))
    : allCommands

  return (['page', 'theme', 'external'] as const)
    .map(type => ({
      type,
      label: { page: 'pages', theme: 'themes', external: 'links' }[type],
      commands: filtered.filter(c => c.type === type),
    }))
    .filter(g => g.commands.length > 0)
})

const flatCommands = computed(() => groups.value.flatMap(g => g.commands))

watch(groups, () => {
  selectedId.value = flatCommands.value[0]?.id ?? null
})

function move(delta: number) {
  const cmds = flatCommands.value
  if (!cmds.length) return
  const idx = cmds.findIndex(c => c.id === selectedId.value)
  const next = Math.max(0, Math.min(cmds.length - 1, (idx === -1 ? 0 : idx) + delta))
  selectedId.value = cmds[next].id
  nextTick(() => {
    resultsRef.value?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' })
  })
}

function run(cmd: Command) {
  cmd.action()
  emit('close')
}

function runSelected() {
  const cmd = flatCommands.value.find(c => c.id === selectedId.value)
  if (cmd) run(cmd)
}

watch(() => props.open, (val) => {
  if (val) {
    query.value = ''
    nextTick(() => {
      inputRef.value?.focus()
      selectedId.value = flatCommands.value[0]?.id ?? null
    })
  }
})
</script>

<style scoped>
/* ── Backdrop ─────────────────────────────────────────────── */

.palette-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* ── Panel ────────────────────────────────────────────────── */

.palette-panel {
  width: 100%;
  max-width: 560px;
  margin: 0 1rem;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.94));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.1));
  border-radius: var(--theme-card-radius, 20px);
  box-shadow: 0 16px 60px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  overflow: hidden;
}

/* ── Search row ───────────────────────────────────────────── */

.palette-search-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.9rem 1.1rem;
}

.palette-search-icon {
  color: var(--theme-text-subtle, #aaa);
  flex-shrink: 0;
}

.palette-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: 0.95rem;
  color: var(--theme-text, #111);
  caret-color: var(--theme-accent, #6b8cae);
  min-width: 0;
}

.palette-input::placeholder {
  color: var(--theme-text-subtle, #bbb);
}

.palette-esc-hint {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--theme-text-subtle, #bbb);
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.12));
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
  line-height: 1.4;
  flex-shrink: 0;
  letter-spacing: 0.03em;
}

/* ── Divider ──────────────────────────────────────────────── */

.palette-divider {
  height: 1px;
  background: var(--theme-card-border, rgba(0, 0, 0, 0.08));
}

/* ── Results ──────────────────────────────────────────────── */

.palette-results {
  max-height: 50vh;
  overflow-y: auto;
  padding: 0.5rem 0.5rem 0.6rem;
  scrollbar-width: thin;
  scrollbar-color: var(--theme-card-border, rgba(0,0,0,0.1)) transparent;
}

.palette-results::-webkit-scrollbar {
  width: 4px;
}
.palette-results::-webkit-scrollbar-track {
  background: transparent;
}
.palette-results::-webkit-scrollbar-thumb {
  background: var(--theme-card-border, rgba(0,0,0,0.12));
  border-radius: 999px;
}

.palette-group-label {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--theme-text-subtle, #bbb);
  padding: 0.6rem 0.7rem 0.3rem;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  padding: 0.55rem 0.7rem;
  background: none;
  border: none;
  border-radius: calc(var(--theme-card-radius, 20px) * 0.5);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.875rem;
  color: var(--theme-text-muted, #555);
  text-align: left;
  transition: background 0.1s ease, color 0.1s ease;
}

.palette-item.is-active {
  background: color-mix(in srgb, var(--theme-accent, #6b8cae) 12%, transparent);
  color: var(--theme-text, #111);
}

.palette-item-icon {
  font-size: 1rem;
  width: 1.4rem;
  text-align: center;
  flex-shrink: 0;
}

.palette-item-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.palette-item-hint {
  font-size: 0.7rem;
  color: var(--theme-text-subtle, #bbb);
  background: var(--theme-bg, #f5f5f3);
  border: 1px solid var(--theme-card-border, rgba(0,0,0,0.1));
  border-radius: 4px;
  padding: 0.1rem 0.4rem;
  font-weight: 500;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.palette-empty {
  padding: 1.5rem 1rem;
  text-align: center;
  color: var(--theme-text-subtle, #bbb);
  font-size: 0.85rem;
}

/* ── Transition ───────────────────────────────────────────── */

.palette-enter-active {
  transition: opacity 0.18s ease;
}
.palette-leave-active {
  transition: opacity 0.13s ease;
}
.palette-enter-from,
.palette-leave-to {
  opacity: 0;
}
.palette-enter-active .palette-panel {
  transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.palette-leave-active .palette-panel {
  transition: opacity 0.13s ease, transform 0.13s ease;
}
.palette-enter-from .palette-panel {
  opacity: 0;
  transform: scale(0.96) translateY(-8px);
}
.palette-leave-to .palette-panel {
  opacity: 0;
  transform: scale(0.98) translateY(-4px);
}

/* ── Hacker theme ─────────────────────────────────────────── */

:global(.hacker-page) .palette-panel {
  border-radius: 0;
  box-shadow: 0 0 40px var(--theme-card-shadow, rgba(0, 255, 65, 0.15));
}

:global(.hacker-page) .palette-input {
  font-family: monospace;
}

:global(.hacker-page) .palette-item {
  border-radius: 0;
  font-family: monospace;
}

:global(.hacker-page) .palette-item.is-active {
  background: rgba(0, 255, 65, 0.1);
  color: var(--theme-text, #00ff41);
}

:global(.hacker-page) .palette-item-hint {
  font-family: monospace;
  border-color: var(--theme-accent, #00ff41);
  color: var(--theme-accent, #00ff41);
  background: rgba(0, 20, 0, 0.8);
}

:global(.hacker-page) .palette-esc-hint {
  font-family: monospace;
  border-color: var(--theme-accent, #00ff41);
  color: var(--theme-accent, #00ff41);
}

:global(.hacker-page) .palette-group-label {
  font-family: monospace;
}

/* ── Space theme ──────────────────────────────────────────── */

:global(.space-page) .palette-panel {
  box-shadow:
    0 16px 60px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(140, 170, 220, 0.12);
}

:global(.space-page) .palette-item.is-active {
  background: color-mix(in srgb, var(--space-accent-blue, #89abd0) 15%, transparent);
  color: var(--space-text, #fff);
}

:global(.space-page) .palette-item-hint {
  background: rgba(15, 15, 30, 0.8);
  border-color: rgba(140, 170, 220, 0.2);
}

:global(.space-page) .palette-esc-hint {
  background: rgba(15, 15, 30, 0.8);
  border-color: rgba(140, 170, 220, 0.2);
}
</style>
