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
        <div class="t-line t-line--active">
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
const { activeTheme, setTheme } = useTheme()

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

interface TabState { base: string; matches: string[]; idx: number }
const tabState = ref<TabState | null>(null)

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
  { path: '/morse',      desc: 'morse code translator' },
  { path: '/launch',     desc: 'rocket launch countdown' },
]

// ── Command implementations ─────────────────────────────────────────────

function helpCmd(): OutputLine[] {
  return [
    out('available commands', 'heading'),
    blank(),
    h('  <span class="t-hl">help</span>                  show this help'),
    h('  <span class="t-hl">whoami</span>                who runs this site'),
    h('  <span class="t-hl">ls</span>                    list all pages'),
    h('  <span class="t-hl">cat</span> &lt;page&gt;           show page info  (e.g. cat /about)'),
    h('  <span class="t-hl">open</span> &lt;path&gt;          navigate to a page'),
    h('  <span class="t-hl">settheme</span> &lt;theme&gt;     switch site theme  (e.g. settheme space)'),
    h('  <span class="t-hl">fortune</span>               random quote'),
    h('  <span class="t-hl">pwd</span>                   print working directory'),
    h('  <span class="t-hl">date</span>                  current date and time'),
    h('  <span class="t-hl">uname</span>                 system information'),
    h('  <span class="t-hl">echo</span> &lt;text&gt;          print text'),
    h('  <span class="t-hl">theme</span>                 show current theme'),
    h('  <span class="t-hl">history</span>               command history'),
    h('  <span class="t-hl">neofetch</span>              system info'),
    h('  <span class="t-hl">clear</span>                 clear the terminal'),
    h('  <span class="t-hl">exit</span>                  go to home page'),
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
    '/morse': [
      h('<span class="t-hl">/morse</span>'),
      blank(),
      out('  interactive morse code translator.'),
      out('  type text → see morse code → hear it via web audio api.'),
      out('  supports a–z, 0–9, and common punctuation.'),
    ],
    '/launch': [
      h('<span class="t-hl">/launch</span>'),
      blank(),
      out('  rocket launch countdown: T-10 to liftoff.'),
      out('  svg rocket on pad (scandi/space/almanac), ascii rocket (hacker).'),
      out('  web audio rumble + orbit chord on ignition.'),
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
    scandi:  'scandinavian glass',
    hacker:  'cyberpunk / hacker',
    space:   'deep space',
    almanac: 'almanac',
  }
  const keys: Record<string, string> = { scandi: '1', hacker: '2', space: '3', almanac: '4' }
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
  lines.push(h('  press <span class="t-hl">1</span>–<span class="t-hl">4</span> to switch, or use <span class="t-hl">settheme &lt;id&gt;</span>'))
  return lines
}

function historyCmd(): OutputLine[] {
  if (!navHistory.value.length) return [out('  (no commands in history)')]
  return navHistory.value.map((cmd, i) =>
    h(`  <span class="t-subtle">${String(i + 1).padStart(3)}</span>  ${esc(cmd)}`)
  )
}

function neofetchCmd(): OutputLine[] {
  const themeLabels: Record<string, string> = {
    scandi:  'scandinavian glass',
    hacker:  'cyberpunk / hacker',
    space:   'deep space',
    almanac: 'almanac',
  }
  return [
    h('<span class="t-hl">phareim</span><span class="t-subtle">@</span><span class="t-hl">phareim.no</span>'),
    h('<span class="t-subtle">──────────────────────────</span>'),
    h(`  <span class="t-subtle">os:</span>      nuxt 3 / cloudflare pages`),
    h(`  <span class="t-subtle">host:</span>    phareim.no (edge compute)`),
    h(`  <span class="t-subtle">theme:</span>   <span class="t-hl">${esc(themeLabels[activeTheme.value] ?? activeTheme.value)}</span>`),
    h(`  <span class="t-subtle">pages:</span>   ${PAGES.length} routes`),
    h(`  <span class="t-subtle">stack:</span>   vue 3 · typescript · d1 · r2`),
    h(`  <span class="t-subtle">agent:</span>   claude sonnet (scheduled, every 6h)`),
  ]
}

// ── Fortune quotes ────────────────────────────────────────────────────

const FORTUNES = [
  'Make it work, make it right, make it fast. — Kent Beck',
  'Any fool can write code that a computer can understand. Good programmers write code that humans can understand. — Martin Fowler',
  'Simplicity is the ultimate sophistication. — Leonardo da Vinci',
  'The best code is no code at all. — Jeff Atwood',
  'It works on my machine.',
  'There are only two hard things in CS: cache invalidation, naming things, and off-by-one errors.',
  'Debugging is twice as hard as writing the code in the first place. — Brian W. Kernighan',
  "The most dangerous phrase in the language is: 'we've always done it this way.' — Grace Hopper",
  "In theory, theory and practice are the same. In practice, they're not.",
  "A ship in harbour is safe — but that's not what ships are for. — John A. Shedd",
  'Code is read more often than it is written.',
  "git commit -m 'fix: it works, don't ask why'",
  'sudo make me a sandwich.',
  'First, solve the problem. Then, write the code. — John Johnson',
  'Talk is cheap. Show me the code. — Linus Torvalds',
  'Give a man a program, frustrate him for a day. Teach a man to program, frustrate him for a lifetime.',
  'The function of good software is to make the complex appear to be simple. — Grady Booch',
  'Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away. — Antoine de Saint-Exupéry',
  'Walking on water and developing software from a specification are easy if both are frozen. — Edward V. Berard',
  'The internet never forgets, but it also never remembers correctly.',
]

function fortuneCmd(): OutputLine[] {
  const quote = FORTUNES[Math.floor(Math.random() * FORTUNES.length)]!
  const sep = quote.lastIndexOf(' — ')
  if (sep !== -1) {
    const text = quote.slice(0, sep)
    const author = quote.slice(sep + 3)
    return [
      h(`  <span class="t-subtle">❝</span> ${esc(text)} <span class="t-subtle">❞</span>`),
      blank(),
      h(`  <span class="t-subtle">— ${esc(author)}</span>`),
    ]
  }
  return [h(`  <span class="t-subtle">❝</span> ${esc(quote)} <span class="t-subtle">❞</span>`)]
}

function setthemeCmd(arg: string): OutputLine[] {
  const THEME_IDS = ['scandi', 'hacker', 'space', 'almanac']
  const labels: Record<string, string> = {
    scandi:  'scandinavian glass',
    hacker:  'cyberpunk / hacker',
    space:   'deep space',
    almanac: 'almanac',
  }
  if (!arg) {
    const lines: OutputLine[] = [
      h('usage: <span class="t-hl">settheme</span> &lt;theme&gt;'),
      blank(),
    ]
    for (const id of THEME_IDS) {
      const marker = activeTheme.value === id ? '<span class="t-hl">→</span>' : ' '
      lines.push(h(`  ${marker} <span class="t-hl">${id}</span>  ${esc(labels[id]!)}`))
    }
    return lines
  }
  const id = arg.toLowerCase()
  if (!THEME_IDS.includes(id)) {
    return [
      h(`settheme: unknown theme '<span class="t-hl">${esc(id)}</span>'`, 'error'),
      h(`  valid: ${THEME_IDS.map(v => `<span class="t-hl">${v}</span>`).join(', ')}`),
    ]
  }
  if (activeTheme.value === id) {
    return [h(`already using <span class="t-hl">${esc(labels[id]!)}</span>`)]
  }
  setTheme(id)
  return [h(`theme → <span class="t-hl">${esc(labels[id]!)}</span>`)]
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
    case 'neofetch':
    case 'fetch':
      output = neofetchCmd()
      break
    case 'fortune':
      output = fortuneCmd()
      break
    case 'settheme':
      output = setthemeCmd(arg)
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
  if (e.key !== 'Tab') tabState.value = null
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
    const raw = currentCmd.value
    const parts = raw.split(/\s+/)
    const pathCmds = ['cat', 'open', 'cd', 'goto']

    if (parts.length >= 2 && pathCmds.includes(parts[0]!.toLowerCase())) {
      const verb = parts[0]!
      const partial = parts.slice(1).join(' ')
      const norm = partial && !partial.startsWith('/') ? `/${partial}` : partial
      if (!tabState.value || tabState.value.base !== raw) {
        const matches = PAGES.map(p => p.path).filter(p =>
          norm ? p.toLowerCase().startsWith(norm.toLowerCase()) : true
        )
        if (!matches.length) return
        tabState.value = { base: raw, matches, idx: 0 }
      } else {
        tabState.value.idx = (tabState.value.idx + 1) % tabState.value.matches.length
      }
      currentCmd.value = `${verb} ${tabState.value.matches[tabState.value.idx]!}`
      tabState.value.base = currentCmd.value
    } else if (parts.length >= 1 && parts[0]!.toLowerCase() === 'settheme') {
      const partial = parts.slice(1).join(' ')
      const themeIds = ['almanac', 'hacker', 'scandi', 'space']
      if (!tabState.value || tabState.value.base !== raw) {
        const matches = themeIds.filter(id => !partial || id.startsWith(partial.toLowerCase()))
        if (!matches.length) return
        tabState.value = { base: raw, matches, idx: 0 }
      } else {
        tabState.value.idx = (tabState.value.idx + 1) % tabState.value.matches.length
      }
      currentCmd.value = `settheme ${tabState.value.matches[tabState.value.idx]!}`
      tabState.value.base = currentCmd.value
    } else {
      const allCmds = ['cat', 'cd', 'clear', 'date', 'echo', 'exit', 'fetch', 'fortune', 'goto', 'help', 'history', 'ls', 'neofetch', 'open', 'pages', 'pwd', 'settheme', 'theme', 'uname', 'whoami']
      if (!raw.trim()) return
      if (!tabState.value || tabState.value.base !== raw) {
        const matches = allCmds.filter(c => c.startsWith(raw.toLowerCase()))
        if (!matches.length) return
        tabState.value = { base: raw, matches, idx: 0 }
      } else {
        tabState.value.idx = (tabState.value.idx + 1) % tabState.value.matches.length
      }
      currentCmd.value = tabState.value.matches[tabState.value.idx]!
      tabState.value.base = currentCmd.value
    }
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
