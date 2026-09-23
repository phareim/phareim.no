/**
 * Galaga story — sectors, the intercom script and the director that paces
 * it (2026-09-23). Pure: no Vue/DOM, so tests/galaga-story.test.mjs runs it
 * in plain node with an injected clock and rng.
 *
 * The premise: relay station Kestrel has lost every channel to a song. The
 * Choir, a swarm, sings over the whole band, and each boss is a Cantor that
 * carries one of its voices. Claude rides in the ship's second seat and
 * talks over the intercom: briefings, a first look at each new enemy and
 * capsule, warnings, and the odd remark. The Choir cuts in when a Cantor
 * arrives. Five named sectors end with the Conductor; past that the song
 * keeps going and so does the run.
 *
 * Voices follow Neon Dreams: Claude is the person (lowercase, plain), the
 * Choir is the machine (uppercase, `·`-separated fragments).
 */

export type Speaker = 'claude' | 'choir'

export interface Line {
  who: Speaker
  text: string
}

export interface Sector {
  num: number
  name: string
  boss: string
  /** Nebula tints for the deep field, as `r,g,b` strings. */
  tints: string[]
}

const SECTOR_DEFS: { name: string; tints: string[] }[] = [
  { name: 'KESTREL APPROACH', tints: ['42,18,69', '80,20,80', '20,80,110', '30,16,60'] },
  { name: 'THE SHOALS', tints: ['16,70,100', '20,90,110', '42,18,69', '14,50,80'] },
  { name: 'RINGFALL', tints: ['90,24,90', '60,16,70', '110,30,80', '40,14,60'] },
  { name: 'CHOIR SPACE', tints: ['100,14,60', '70,10,50', '42,18,69', '120,20,70'] },
  { name: "CONDUCTOR'S NEST", tints: ['120,20,80', '90,40,20', '60,10,60', '140,30,90'] },
]

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
export function roman(n: number): string {
  const k = Math.max(1, Math.floor(n))
  return k <= ROMAN.length ? ROMAN[k - 1]! : String(k)
}

/** Sector by zero-based index (= bosses killed so far). */
export function sectorFor(index: number): Sector {
  const i = Math.max(0, Math.floor(index))
  const num = i + 1
  if (i < SECTOR_DEFS.length) {
    const d = SECTOR_DEFS[i]!
    return { num, name: d.name, boss: i === 4 ? 'THE CONDUCTOR' : `CANTOR ${roman(num)}`, tints: d.tints }
  }
  const d = SECTOR_DEFS[3 + (i % 2)]!
  return { num, name: `DEEP CHOIR ${roman(i - 4)}`, boss: `CANTOR ${roman(num)}`, tints: d.tints }
}

/** "Neon Otter" → "otter": the Hall of Fame animal is the callsign. */
export function callsignFrom(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1]!.toLowerCase() : 'pilot'
}

type Once = 'session' | 'run'

interface CueDef {
  /** 3 story/critical (interrupts), 2 teaching, 1 ambient (dropped when busy). */
  prio: 1 | 2 | 3
  once?: Once
  /** Minimum ms between two plays of this cue. */
  cooldown?: number
  /** Variants; each is a short exchange of one or more lines. */
  variants: Line[][]
}

const C = (text: string): Line => ({ who: 'claude', text })
const Q = (text: string): Line => ({ who: 'choir', text })

export const CUES: Record<string, CueDef> = {
  idle: { prio: 2, once: 'session', variants: [[C('claude on comms. {start} when you are ready.')]] },

  'start:first': {
    prio: 3, once: 'session', variants: [[
      C('morning, {cs}. claude here, second seat.'),
      C('kestrel lost every channel an hour ago. something out there is singing over all of them.'),
      C("let's go find out what. guns are warm."),
    ]],
  },
  'start:again': {
    prio: 3, variants: [
      [C('back in the seat. i kept the engine warm.')],
      [C("the choir doesn't learn. we do. go.")],
      [C('new hull, same song. launching.')],
      [C("round {run}. i've recalibrated. you've presumably also recalibrated.")],
    ],
  },

  'sector:2': { prio: 3, variants: [[C('band is clearer already.'), C('next relay sits inside the shoals. thick nebula, bad sensors. trust your eyes.')]] },
  'sector:3': { prio: 3, variants: [[C('i isolated the song. it has layers, one per cantor.'), C('ringfall next. the choir nests in the ring debris.')]] },
  'sector:4': { prio: 3, variants: [[C("that was kestrel's last beacon. from here on it's their space."), C('if i go quiet, it is the jamming. keep shooting.')]] },
  'sector:5': { prio: 3, variants: [[C("one signature left and it's enormous."), C('the conductor. everything so far was an echo of it.')]] },
  'sector:6': { prio: 3, variants: [[C("conductor's gone and the song is still playing."), C("so it was never one ship. fine. we keep clearing the band.")]] },
  'sector:deep': {
    prio: 3, variants: [
      [C('sector {n}. deeper than any chart i have.')],
      [C('sector {n}. kestrel can hear us again, faintly.')],
      [C("sector {n}. i've stopped naming these.")],
    ],
  },

  'boss:1': { prio: 3, variants: [[Q('WE ARE THE SONG · YOU ARE THE SILENCE'), C('cantor inbound. big one. hit the core in the middle.')]] },
  'boss:n': {
    prio: 3, variants: [
      [Q('JOIN THE CHORUS · SMALL VOICE'), C('another cantor. same weak spot, meaner guns.')],
      [Q('EVERY SIGNAL ENDS IN US'), C('it fires in rings now. read the gaps.')],
      [Q('WE HEARD YOU COMING'), C('cantor. you know the drill.')],
      [Q('SING · OR BE SUNG'), C('ignore the lyrics. aim for the core.')],
    ],
  },
  'boss:conductor': { prio: 3, variants: [[Q('I CONDUCT THE DARK · HEAR ME'), C('that is the conductor. everything we have, now.')]] },
  'boss:down': {
    prio: 3, variants: [
      [C('cantor down. one voice fewer.')],
      [C('and it is quiet. for about a second.')],
      [C('that one sang flat anyway.')],
      [C('down. hull patched from the wreck.')],
    ],
  },
  'boss:down:conductor': { prio: 3, variants: [[Q('THE SONG · DOES NOT · END'), C('it does for that one. nice flying, {cs}.')]] },

  'meet:heavy': { prio: 2, once: 'session', variants: [[C('armoured ships. three hits, and the pips show what is left.')]] },
  'meet:diver': { prio: 2, once: 'session', variants: [[C('divers. they lock on and drop. sidestep late.')]] },
  'meet:weaver': { prio: 2, once: 'session', variants: [[C('weavers swing wide. let them come to you.')]] },
  'meet:sniper': { prio: 2, once: 'session', variants: [[C('sniper. the pink line is where it is about to shoot. be elsewhere.')]] },
  'meet:splitter': { prio: 2, once: 'session', variants: [[C('splitter. crack it and two mites fall out. do not be under it.')]] },
  'meet:bulwark': { prio: 2, once: 'session', variants: [[C('bulwark. five hits of armour and a three-way gun. take it from the side.')]] },
  'meet:stinger': { prio: 2, once: 'session', variants: [[C('stingers on the flank. fast, one shot each.')]] },

  'pick:weapon': { prio: 2, once: 'session', variants: [[C('power cell. the gun gets a level. a hit takes one back.')]] },
  'pick:laser': { prio: 2, once: 'session', variants: [[C('laser module. it punches through a whole column.')]] },
  'pick:homing': { prio: 2, once: 'session', variants: [[C('seekers online. they pick their own targets. i helped.')]] },
  'pick:shield': { prio: 2, once: 'session', variants: [[C('s capsules patch the hull first, then shield the nose.')]] },
  'pick:aegis': { prio: 2, once: 'session', variants: [[C('aegis. a double shield on the nose. rams still hurt.')]] },
  'pick:dual': { prio: 2, once: 'session', variants: [[C('escort on your wing. it takes the next hit for you. brave little thing.')]] },
  'pick:rear': { prio: 2, once: 'session', variants: [[C('rear gun. nothing sneaks up behind us now.')]] },
  'pick:tempo': { prio: 2, once: 'session', variants: [[C('time dilation. everything that is not us slows down.')]] },
  'pick:nova': { prio: 2, once: 'session', variants: [[C('nova. that was the whole screen.')]] },
  'pick:magnet': { prio: 2, once: 'session', variants: [[C('magnet. capsules come to you, and it drags on incoming fire.')]] },
  'pick:combo': { prio: 2, once: 'session', variants: [[C('double score. greed is a valid strategy.')]] },
  'pick:switch': {
    prio: 1, cooldown: 25_000, variants: [
      [C('switching modules. level carries over.')],
      [C('new gun, same level.')],
    ],
  },

  'sync:ready': { prio: 2, once: 'session', variants: [[C('sync is full. {sync} and i take the guns for a bit.')]] },
  'sync:ready:again': { prio: 1, cooldown: 45_000, variants: [[C('sync ready.')], [C('sync is charged when you want it.')]] },
  'sync:on': {
    prio: 1, cooldown: 12_000, variants: [
      [C('sync on. you fly, i shoot.')],
      [C('hands off the trigger. mine now.')],
      [C('all of it, everywhere.')],
    ],
  },

  'hull:2': { prio: 2, once: 'run', variants: [[C("hull's at two. i'd rather not learn what one feels like.")]] },
  'hull:1': { prio: 3, once: 'run', variants: [[C('one segment left, {cs}. look for an s capsule.')]] },
  'escort:lost': { prio: 1, cooldown: 20_000, variants: [[C('escort is gone. it did its job.')]] },
  'combo:4': { prio: 1, cooldown: 40_000, variants: [[C('x4. keep it going.')], [C('that is a chain. do not break it.')]] },
  'wave:10': { prio: 1, once: 'run', variants: [[C('wave ten. they send more because you are winning.')]] },
  'wave:25': { prio: 1, once: 'run', variants: [[C('wave twenty-five. i have run out of encouraging statistics.')]] },
  best: { prio: 2, once: 'run', variants: [[C('new personal best. i am writing it down.')]] },
  taunt: {
    prio: 1, cooldown: 45_000, variants: [
      [Q('YOUR SIGNAL IS SMALL')],
      [Q('WE HAVE SUNG OVER LOUDER')],
      [Q('KESTREL IS LISTENING TO US NOW')],
      [Q('LAY DOWN · HUM ALONG')],
    ],
  },
  death: {
    prio: 3, variants: [
      [C('hull breach. ejecting. i have the black box.')],
      [C('that is it for this ship. the score stands.')],
      [C('we lost the ship. not the data. go again.')],
    ],
  },
}

export interface Spoken extends Line {
  key: string
  prio: number
  /** Monotonic id so the view can tell two identical lines apart. */
  id: number
  start: number
  /** When typing finishes. */
  typed: number
  end: number
}

/** Typing speed and reading time (ms). */
export const TYPE_MS_PER_CHAR = 26
export const HOLD_MS = 1500
export const HOLD_MS_PER_CHAR = 32
export const GAP_MS = 260
/** Ambient cues also wait this long after any line. */
export const AMBIENT_GAP_MS = 9000
const QUEUE_MAX = 5

export type Vars = Record<string, string | number>

export function fill(text: string, vars: Vars): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

export function lineDuration(text: string): { type: number; total: number } {
  const type = text.length * TYPE_MS_PER_CHAR
  return { type, total: type + HOLD_MS + text.length * HOLD_MS_PER_CHAR }
}

/** Remembers once-per-session cues across remounts within a page load. */
export const SESSION_SEEN = new Set<string>()

interface Pending { line: Line; key: string; prio: number; queuedAt: number }

export function createDirector(opts: { rng?: () => number; seen?: Set<string> } = {}) {
  const rng = opts.rng ?? Math.random
  const sessionSeen = opts.seen ?? SESSION_SEEN
  const runSeen = new Set<string>()
  const lastPlayed = new Map<string, number>()
  const lastVariant = new Map<string, number>()
  let queue: Pending[] = []
  let current: Spoken | null = null
  let lastEnd = -Infinity
  let nextId = 1
  let vars: Vars = {}

  function setVars(v: Vars): void {
    vars = { ...vars, ...v }
  }

  /** Ask for a cue. Returns true when it was queued. */
  function cue(key: string, now: number, extra: Vars = {}): boolean {
    const def = CUES[key]
    if (!def) return false
    if (def.once === 'session' && sessionSeen.has(key)) return false
    if (def.once === 'run' && runSeen.has(key)) return false
    // A once-cue waiting in the queue or on screen is not asked for twice.
    if (def.once && (current?.key === key || queue.some(p => p.key === key))) return false
    const last = lastPlayed.get(key)
    if (def.cooldown && last !== undefined && now - last < def.cooldown) return false
    if (def.prio === 1) {
      // Ambient: only into silence, and not right after anything else.
      if (current || queue.length || now - lastEnd < AMBIENT_GAP_MS) return false
    }
    // Pick a variant, never the same one twice running.
    const n = def.variants.length
    let vi = Math.floor(rng() * n) % n
    if (n > 1 && vi === lastVariant.get(key)) vi = (vi + 1) % n
    lastVariant.set(key, vi)
    // Once-cues are marked seen when they start playing (tick), so a line
    // dropped from the queue can still be said next time it is asked for.
    lastPlayed.set(key, now)
    const v = { ...vars, ...extra }
    const lines = def.variants[vi]!.map(l => ({ who: l.who, text: fill(l.text, v) }))
    if (def.prio === 3) {
      // Story beats cut ambient chatter and jump the teaching queue. A
      // teaching line cut mid-sentence is said again afterwards (it is a
      // once-per-session tip; losing it would lose it for good).
      const resume: Pending[] = []
      if (current && current.prio === 2 && now < current.typed) {
        resume.push({ line: { who: current.who, text: current.text }, key: current.key, prio: 2, queuedAt: now + 4000 })
      }
      queue = queue.filter(p => p.prio >= 3)
      if (current && current.prio < 3) current.end = Math.min(current.end, now + 120)
      queue.push(...lines.map(line => ({ line, key, prio: def.prio, queuedAt: now })), ...resume)
    } else {
      queue.push(...lines.map(line => ({ line, key, prio: def.prio, queuedAt: now })))
    }
    while (queue.length > QUEUE_MAX) {
      // Drop the oldest low-priority entry first.
      const i = queue.findIndex(p => p.prio < 3)
      queue.splice(i >= 0 ? i : 0, 1)
    }
    return true
  }

  /** Advance to `now`; returns the line on screen (or null). */
  function tick(now: number): Spoken | null {
    if (current && now >= current.end) {
      lastEnd = current.end
      current = null
    }
    if (!current && queue.length && now - lastEnd >= GAP_MS) {
      // Teaching lines that waited too long are stale; story lines are not.
      queue = queue.filter(p => p.prio >= 3 || now - p.queuedAt < 8000)
      const next = queue.shift()
      if (next) {
        const once = CUES[next.key]?.once
        if (once === 'session') sessionSeen.add(next.key)
        if (once === 'run') runSeen.add(next.key)
        const d = lineDuration(next.line.text)
        current = {
          ...next.line, key: next.key, prio: next.prio, id: nextId++,
          start: now, typed: now + d.type, end: now + d.total,
        }
      }
    }
    return current
  }

  /** New run: forget run-scoped cues and anything still queued. */
  function resetRun(): void {
    runSeen.clear()
    queue = []
    current = null
    lastEnd = -Infinity
  }

  /** Drop what is queued and cut the current line short (e.g. on quit). */
  function hush(now: number): void {
    queue = []
    if (current) {
      current.end = Math.min(current.end, now + 120)
      // Mark it typed so a following story beat does not resume it.
      current.typed = Math.min(current.typed, now)
    }
  }

  return {
    cue, tick, resetRun, hush, setVars,
    get current() { return current },
    get queued() { return queue.length },
  }
}

export type Director = ReturnType<typeof createDirector>

/** Characters of `line` visible at `now` (typewriter). */
export function visibleChars(line: Spoken, now: number): number {
  if (now >= line.typed) return line.text.length
  return Math.max(0, Math.floor((now - line.start) / TYPE_MS_PER_CHAR))
}
