<template>
  <div class="terminal-page" @click="focusInput">
    <div class="terminal-window" @click.stop>

      <!-- macOS-style title bar -->
      <div class="terminal-titlebar" aria-hidden="true">
        <div class="terminal-dots">
          <span class="dot dot--red"></span>
          <span class="dot dot--yellow"></span>
          <span class="dot dot--green"></span>
        </div>
        <span class="terminal-title-text">phareim@phareim.no — bash</span>
      </div>

      <!-- Terminal output + input -->
      <div class="terminal-body" ref="bodyEl">

        <!-- Welcome message -->
        <div class="t-line t-line--motd">
          phareim.no terminal — type <span class="t-hl">help</span> to get started
        </div>
        <div class="t-line t-line--blank"></div>

        <!-- Command history -->
        <template v-for="(entry, idx) in cmdHistory" :key="idx">
          <div class="t-line t-line--input">
            <span class="t-prompt" aria-hidden="true">{{ PROMPT }}&nbsp;</span>{{ entry.cmd }}
          </div>
          <div
            v-for="(line, li) in entry.output"
            :key="li"
            class="t-line"
            :class="`t-line--${line.type}`"
            v-html="line.html"
          ></div>
          <div class="t-line t-line--blank"></div>
        </template>

        <!-- Active input line -->
        <div class="t-line t-line--active" ref="activeLine">
          <span class="t-prompt" aria-hidden="true">{{ PROMPT }}&nbsp;</span>
          <input
            ref="inputEl"
            v-model="currentCmd"
            class="t-input"
            type="text"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            aria-label="terminal command input"
            @keydown="handleKey"
          />
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const { activeTheme } = useTheme()

useHead({ title: 'terminal — phareim.no' })

const PROMPT = 'phareim@phareim.no:~$'

// ── Types ──────────────────────────────────────────────────────────────

interface OutputLine {
  type: 'output' | 'error' | 'blank' | 'heading'
  html: string
}

interface CmdEntry {
  cmd: string
  output: OutputLine[]
}

// ── State ──────────────────────────────────────────────────────────────

const cmdHistory = ref<CmdEntry[]>([])
const currentCmd = ref('')
const navHistory = ref<string[]>([])
const navHistoryIdx = ref(0)

const inputEl = ref<HTMLInputElement | null>(null)
const bodyEl = ref<HTMLElement | null>(null)

// ── Output helpers ─────────────────────────────────────────────────────

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function out(text: string, type: OutputLine['type'] = 'output'): OutputLine {
  return { type, html: esc(text) }
}

function h(markup: string, type: OutputLine['type'] = 'output'): OutputLine {
  return { type, html: markup }
}

function blank(): OutputLine {
  return { type: 'blank', html: '' }
}

// ── Page directory ─────────────────────────────────────────────────────

const PAGES = [
  { path: '/',           desc: 'home' },
  { path: '/about',      desc: 'about me' },
  { path: '/projects',   desc: 'github projects' },
  { path: '/feed',       desc: 'bluesky thoughts' },
  { path: '/now',        desc: "what i'm doing now" },
  { path: '/uses',       desc: 'tools i use' },
  { path: '/guestbook',  desc: 'sign the guestbook' },
  { path: '/activity',   desc: 'unified timeline' },
  { path: '/stats',      desc: 'coding stats' },
  { path: '/meta',       desc: 'commit history' },
  { path: '/colophon',   desc: 'how this site works' },
  { path: '/playground', desc: 'ai image generation' },
  { path: '/gallery',    desc: 'generated images' },
  { path: '/clock',      desc: 'real-time clock' },
  { path: '/lab',        desc: 'experiments' },
  { path: '/focus',      desc: 'pomodoro timer' },
  { path: '/terminal',   desc: '← you are here' },
]

// ── Command implementations ─────────────────────────────────────────────

function helpCmd(): OutputLine[] {
  return [
    out('available commands', 'heading'),
    blank(),
    h('  <span class="t-hl">help</span>              show this help'),
    h('  <span class="t-hl">whoami</span>            who runs this site'),
    h('  <span class="t-hl">ls</span>                list all pages'),
    h('  <span class="t-hl">cat</span> &lt;page&gt;       show page info  (e.g. cat /about)'),
    h('  <span class="t-hl">open</span> &lt;path&gt;      navigate to a page'),
    h('  <span class="t-hl">pwd</span>               print working directory'),
    h('  <span class="t-hl">date</span>              current date and time'),
    h('  <span class="t-hl">uname</span>             system information'),
    h('  <span class="t-hl">echo</span> &lt;text&gt;      print text'),
    h('  <span class="t-hl">theme</span>             show current theme'),
    h('  <span class="t-hl">history</span>           command history'),
    h('  <span class="t-hl">clear</span>             clear the terminal'),
    h('  <span class="t-hl">exit</span>              go to home page'),
  ]
}

function whoamiCmd(): OutputLine[] {
  return [
    h('<span class="t-hl">petter hareim</span>'),
    blank(),
    out('  developer · consultant · based in norway'),
    out('  father. husband. geek. aspiring good guy.'),
    blank(),
    h('  github   <span class="t-subtle">→</span> <a href="https://github.com/phareim" target="_blank" rel="noopener noreferrer" class="t-link">github.com/phareim</a>'),
    h('  bluesky  <span class="t-subtle">→</span> <a href="https://bsky.app/profile/phareim.no" target="_blank" rel="noopener noreferrer" class="t-link">bsky.app/profile/phareim.no</a>'),
    h('  x        <span class="t-subtle">→</span> <a href="https://x.com/phareim" target="_blank" rel="noopener noreferrer" class="t-link">x.com/phareim</a>'),
    h('  work     <span class="t-subtle">→</span> <a href="https://www.miles.no" target="_blank" rel="noopener noreferrer" class="t-link">miles.no</a>'),
  ]
}

function lsCmd(): OutputLine[] {
  const lines: OutputLine[] = [out('pages', 'heading'), blank()]
  for (const p of PAGES) {
    const pad = p.path.padEnd(16, ' ')
    lines.push(h(`  <span class="t-hl">${esc(pad)}</span><span class="t-subtle">${esc(p.desc)}</span>`))
  }
  return lines
}

function catCmd(arg: string): OutputLine[] {
  if (!arg) return [h('cat: missing argument', 'error')]
  const page = arg.startsWith('/') ? arg : `/${arg}`

  const catData: Record<string, OutputLine[]> = {
    '/': [
      h('<span class="t-hl">/</span>  <span class="t-subtle">home</span>'),
      blank(),
      out('  interactive landing page with bubble physics canvas.'),
      out('  press enter or click to start. tap the bubbles.'),
    ],
    '/about': [
      h('<span class="t-hl">/about</span>'),
      blank(),
      out('  name:   petter hareim'),
      out('  work:   consultant at miles.no'),
      out('  where:  norway'),
      out('  bio:    father. husband. geek. aspiring good guy.'),
    ],
    '/now': [
      h('<span class="t-hl">/now</span>'),
      blank(),
      out('  → consulting at miles.no'),
      out('  → maintaining phareim.no (it updates itself)'),
      out('  live data from bluesky + github'),
    ],
    '/colophon': [
      h('<span class="t-hl">/colophon</span>'),
      blank(),
      out('  framework:  nuxt 3 + vue 3 + typescript'),
      out('  hosting:    cloudflare pages (edge)'),
      out('  database:   cloudflare d1 (sqlite at edge)'),
      out('  storage:    cloudflare r2'),
      out('  maintained: scheduled claude agent, every 6 hours'),
    ],
    '/lab': [
      h('<span class="t-hl">/lab</span>'),
      blank(),
      h('  → <a href="https://dot.phareim.no" target="_blank" rel="noopener noreferrer" class="t-link">dot.phareim.no</a>  the red dot game'),
      h('  → <a href="https://reader.phareim.no" target="_blank" rel="noopener noreferrer" class="t-link">reader.phareim.no</a>  rss reader'),
    ],
    '/terminal': [
      h('<span class="t-hl">/terminal</span>'),
      blank(),
      out('  you are here. an interactive terminal for exploring this site.'),
      out('  type help for commands. use ↑/↓ for history. tab to complete.'),
    ],
  }

  if (catData[page]) return catData[page]

  const found = PAGES.find(p => p.path === page)
  if (found) {
    return [
      h(`<span class="t-hl">${esc(page)}</span>  <span class="t-subtle">${esc(found.desc)}</span>`),
      blank(),
      h(`  <span class="t-subtle">run <span class="t-hl">open ${esc(page)}</span> to navigate there</span>`),
    ]
  }

  return [h(`cat: ${esc(arg)}: no such page`, 'error')]
}

function openCmd(arg: string): OutputLine[] {
  if (!arg) return [h('open: missing path argument', 'error')]
  const path = arg.startsWith('/') ? arg : `/${arg}`
  const found = PAGES.find(p => p.path === path)
  if (!found) {
    return [
      h(`open: no page at <span class="t-hl">${esc(path)}</span>`, 'error'),
      h(`  run <span class="t-hl">ls</span> to see available pages`),
    ]
  }
  setTimeout(() => router.push(path), 500)
  return [h(`navigating to <span class="t-hl">${esc(path)}</span>…`)]
}

function unameCmd(): OutputLine[] {
  return [out('phareim.no  nuxt/3  cloudflare-pages  edge/v8  x86_64')]
}

function themeCmd(): OutputLine[] {
  const labels: Record<string, string> = {
    scandi: 'scandinavian glass',
    hacker: 'cyberpunk / hacker',
    space:  'deep space',
  }
  const keys: Record<string, string> = { scandi: '1', hacker: '2', space: '3' }
  const current = activeTheme.value
  const lines: OutputLine[] = [
    h(`active: <span class="t-hl">${esc(labels[current] ?? current)}</span>`),
    blank(),
  ]
  for (const [k, label] of Object.entries(labels)) {
    const marker = k === current ? '<span class="t-hl">→</span>' : ' '
    lines.push(h(`  ${marker} [<span class="t-hl">${keys[k]}</span>] ${esc(label)}`))
  }
  lines.push(blank())
  lines.push(h('  press <span class="t-hl">1</span>, <span class="t-hl">2</span>, or <span class="t-hl">3</span> to switch themes'))
  return lines
}

function historyCmd(): OutputLine[] {
  if (!navHistory.value.length) return [out('  (no commands in history)')]
  return navHistory.value.map((cmd, i) =>
    h(`  <span class="t-subtle">${String(i + 1).padStart(3)}</span>  ${esc(cmd)}`)
  )
}

// ── Command processor ──────────────────────────────────────────────────

function processCmd(raw: string): CmdEntry | null {
  const cmd = raw.trim()
  if (!cmd) return null

  navHistory.value.push(cmd)
  navHistoryIdx.value = navHistory.value.length

  const parts = cmd.split(/\s+/)
  const verb = parts[0].toLowerCase()
  const arg = parts.slice(1).join(' ')

  let output: OutputLine[]

  switch (verb) {
    case 'help':
      output = helpCmd()
      break
    case 'whoami':
      output = whoamiCmd()
      break
    case 'ls':
    case 'pages':
      output = lsCmd()
      break
    case 'cat':
      output = catCmd(arg)
      break
    case 'open':
    case 'goto':
    case 'cd':
      output = openCmd(arg)
      break
    case 'pwd':
      output = [out('/phareim.no/terminal')]
      break
    case 'date':
      output = [out(new Date().toUTCString())]
      break
    case 'uname':
      output = unameCmd()
      break
    case 'echo':
      output = [out(arg)]
      break
    case 'theme':
      output = themeCmd()
      break
    case 'history':
      output = historyCmd()
      break
    case 'clear':
      cmdHistory.value = []
      return null
    case 'exit':
      output = [out('bye!')]
      setTimeout(() => router.push('/'), 400)
      break
    default:
      output = [h(`bash: ${esc(verb)}: command not found — try <span class="t-hl">help</span>`, 'error')]
  }

  return { cmd, output }
}

// ── Keyboard handler ───────────────────────────────────────────────────

function handleKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    const entry = processCmd(currentCmd.value)
    if (entry) cmdHistory.value.push(entry)
    currentCmd.value = ''
    navHistoryIdx.value = navHistory.value.length
    nextTick(() => scrollBottom())
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (navHistoryIdx.value > 0) {
      navHistoryIdx.value--
      currentCmd.value = navHistory.value[navHistoryIdx.value]
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (navHistoryIdx.value < navHistory.value.length - 1) {
      navHistoryIdx.value++
      currentCmd.value = navHistory.value[navHistoryIdx.value]
    } else {
      navHistoryIdx.value = navHistory.value.length
      currentCmd.value = ''
    }
  } else if (e.key === 'l' && e.ctrlKey) {
    e.preventDefault()
    cmdHistory.value = []
  } else if (e.key === 'Tab') {
    e.preventDefault()
    const cmds = ['help', 'whoami', 'ls', 'pages', 'cat', 'open', 'goto', 'cd', 'pwd', 'date', 'uname', 'echo', 'theme', 'history', 'clear', 'exit']
    const partial = currentCmd.value.toLowerCase()
    if (!partial) return
    const match = cmds.find(c => c.startsWith(partial))
    if (match) currentCmd.value = match
  }
}

function focusInput() {
  inputEl.value?.focus()
}

function scrollBottom() {
  if (bodyEl.value) {
    bodyEl.value.scrollTop = bodyEl.value.scrollHeight
  }
}

onMounted(() => {
  focusInput()
})
</script>

<style scoped>
/* ── Page ─────────────────────────────────────────────────────────── */

.terminal-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 2.5rem 1rem 4rem;
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  cursor: default;
}

/* ── Window card ──────────────────────────────────────────────────── */

.terminal-window {
  width: 100%;
  max-width: 760px;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  border-radius: var(--theme-card-radius, 16px);
  overflow: hidden;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 4px 24px var(--theme-card-shadow, rgba(0, 0, 0, 0.08));
  animation: win-enter 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

@keyframes win-enter {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── Title bar ────────────────────────────────────────────────────── */

.terminal-titlebar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  background: color-mix(in srgb, var(--theme-card-border, rgba(0,0,0,0.08)) 60%, transparent);
  border-bottom: 1px solid var(--theme-card-border, rgba(0, 0, 0, 0.08));
  user-select: none;
}

.terminal-dots {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot--red    { background: #ff5f57; }
.dot--yellow { background: #febc2e; }
.dot--green  { background: #28c840; }

.terminal-title-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.7rem;
  color: var(--theme-text-subtle, #aaa);
  flex: 1;
  text-align: center;
  padding-right: 66px;
}

/* ── Body ─────────────────────────────────────────────────────────── */

.terminal-body {
  padding: 1.25rem 1.5rem 1.5rem;
  overflow-y: auto;
  max-height: calc(100dvh - 10rem);
  min-height: 320px;
  cursor: text;
  scroll-behavior: smooth;
}

/* ── Lines ────────────────────────────────────────────────────────── */

.t-line {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
  line-height: 1.65;
  color: var(--theme-text-muted, #555);
  white-space: pre-wrap;
  word-break: break-all;
  display: block;
  min-height: 1em;
}

.t-line--motd {
  color: var(--theme-text-subtle, #999);
  font-style: italic;
}

.t-line--input {
  color: var(--theme-text, #111);
  display: flex;
  align-items: baseline;
}

.t-line--output {
  color: var(--theme-text-muted, #555);
}

.t-line--error {
  color: var(--theme-accent-danger, #c1272d);
}

.t-line--heading {
  color: var(--theme-text, #111);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
}

.t-line--blank {
  min-height: 0.5em;
}

.t-line--active {
  display: flex;
  align-items: center;
  color: var(--theme-text, #111);
}

/* ── Prompt ───────────────────────────────────────────────────────── */

.t-prompt {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
  color: var(--theme-accent, #6b8cae);
  white-space: nowrap;
  user-select: none;
  flex-shrink: 0;
}

/* ── Input ────────────────────────────────────────────────────────── */

.t-input {
  background: transparent;
  border: none;
  outline: none;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
  line-height: 1.65;
  color: var(--theme-text, #111);
  flex: 1;
  min-width: 0;
  padding: 0;
  margin: 0;
  caret-color: var(--theme-accent, #6b8cae);
  user-select: text;
}

/* ── Deep selectors for v-html content ────────────────────────────── */

.terminal-body :deep(.t-hl) {
  color: var(--theme-accent, #6b8cae);
  font-weight: 600;
}

.terminal-body :deep(.t-subtle) {
  color: var(--theme-text-subtle, #aaa);
}

.terminal-body :deep(.t-link) {
  color: var(--theme-accent, #6b8cae);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.15s ease;
}

.terminal-body :deep(.t-link:hover) {
  border-color: var(--theme-accent, #6b8cae);
}

/* ── Responsive ───────────────────────────────────────────────────── */

@media (max-width: 540px) {
  .terminal-page {
    padding: 0;
    align-items: stretch;
  }

  .terminal-window {
    border-radius: 0;
    min-height: 100dvh;
    max-width: 100%;
    border-left: none;
    border-right: none;
    border-top: none;
  }

  .terminal-body {
    max-height: calc(100dvh - 40px);
  }

  .t-line,
  .t-prompt,
  .t-input {
    font-size: 0.8rem;
  }
}

/* ── Hacker theme ─────────────────────────────────────────────────── */

:global(.hacker-page) .terminal-page {
  padding: 0;
  align-items: stretch;
}

:global(.hacker-page) .terminal-window {
  max-width: 100%;
  border-radius: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.hacker-page) .terminal-titlebar {
  background: rgba(0, 20, 0, 0.7);
  border-bottom-color: var(--hacker-border, #003b00);
}

:global(.hacker-page) .dot--red    { background: #1a0000; box-shadow: none; }
:global(.hacker-page) .dot--yellow { background: #1a1400; box-shadow: none; }
:global(.hacker-page) .dot--green  {
  background: var(--hacker-text, #00ff41);
  box-shadow: 0 0 8px var(--hacker-text, #00ff41);
}

:global(.hacker-page) .terminal-title-text {
  color: var(--hacker-text-dim, #008F11);
}

:global(.hacker-page) .terminal-body {
  max-height: calc(100dvh - 36px);
}

:global(.hacker-page) .t-line {
  color: var(--hacker-text-dim, #008F11);
}

:global(.hacker-page) .t-line--motd {
  color: var(--hacker-text, #00ff41);
  font-style: normal;
  text-shadow: 0 0 8px currentColor;
}

:global(.hacker-page) .t-line--input {
  color: var(--hacker-text, #00ff41);
  text-shadow: 0 0 4px currentColor;
}

:global(.hacker-page) .t-line--output {
  color: var(--hacker-text-dim, #008F11);
}

:global(.hacker-page) .t-line--error {
  color: var(--hacker-accent, #ff0055);
  text-shadow: 0 0 6px var(--hacker-accent, #ff0055);
}

:global(.hacker-page) .t-line--heading {
  color: var(--hacker-text, #00ff41);
  text-shadow: 0 0 6px currentColor;
}

:global(.hacker-page) .t-prompt {
  text-shadow: 0 0 6px currentColor;
}

:global(.hacker-page) .t-input {
  text-shadow: 0 0 4px currentColor;
}

:global(.hacker-page) .terminal-body :deep(.t-hl) {
  text-shadow: 0 0 8px currentColor;
}

:global(.hacker-page) .terminal-body :deep(.t-subtle) {
  color: var(--hacker-text-dim, #008F11);
}

:global(.hacker-page) .terminal-body :deep(.t-link) {
  text-shadow: 0 0 4px currentColor;
  border-bottom-color: var(--hacker-text-dim, #008F11);
}

:global(.hacker-page) .terminal-body :deep(.t-link:hover) {
  border-color: var(--hacker-text, #00ff41);
}

/* ── Space theme ──────────────────────────────────────────────────── */

:global(.space-page) .terminal-window {
  background: rgba(8, 8, 18, 0.88);
  border-color: rgba(140, 170, 220, 0.2);
  box-shadow:
    0 4px 32px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(140, 170, 220, 0.06),
    inset 0 1px 0 rgba(140, 170, 220, 0.04);
}

:global(.space-page) .terminal-titlebar {
  background: rgba(140, 170, 220, 0.04);
  border-bottom-color: rgba(140, 170, 220, 0.12);
}

:global(.space-page) .terminal-title-text {
  color: var(--space-text-subtle, #5a6080);
}

:global(.space-page) .t-line {
  color: var(--space-text-muted, #a0a8c0);
}

:global(.space-page) .t-line--motd {
  color: var(--space-text-subtle, #5a6080);
}

:global(.space-page) .t-line--input {
  color: var(--space-text, #ffffff);
}

:global(.space-page) .t-line--output {
  color: var(--space-text-muted, #a0a8c0);
}

:global(.space-page) .t-line--error {
  color: var(--space-accent-red, #e06060);
}

:global(.space-page) .t-line--heading {
  color: var(--space-accent-blue, #89abd0);
  text-shadow: 0 0 12px rgba(137, 171, 208, 0.4);
}

:global(.space-page) .t-prompt {
  color: var(--space-accent-amber, #e8c87a);
}

:global(.space-page) .t-input {
  color: var(--space-text, #ffffff);
  caret-color: var(--space-accent-amber, #e8c87a);
}

:global(.space-page) .terminal-body :deep(.t-hl) {
  color: var(--space-accent-blue, #89abd0);
}

:global(.space-page) .terminal-body :deep(.t-subtle) {
  color: var(--space-text-subtle, #5a6080);
}

:global(.space-page) .terminal-body :deep(.t-link) {
  border-bottom-color: rgba(137, 171, 208, 0.2);
}
</style>
