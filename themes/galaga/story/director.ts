/**
 * Space Voyagers' radio director: it takes cues from the game and decides
 * what is on the monitor each tick. Pure: no DOM, no clock but the game's
 * (ticks, 60 a second, so pause freezes it) and no chance but the function
 * it is given. The cues and their rules are in `cues.ts`, the words in
 * `lines.ts`. DESIGN.md, "Who talks".
 *
 * The rules, kept from the old game's director:
 *  - priority 3 is story: it cuts in on anything lesser and jumps the queue;
 *  - priority 2 is teaching and events: queued, dropped if it has waited too
 *    long to still make sense, and said again if a story line cut it off;
 *  - priority 1 is banter: only into nine seconds of silence;
 *  - a cue may be once a page load, once a run, once a sector, or on a cooldown.
 * New: a cue's answer is an exchange, several lines by different speakers
 * played one after another. Variants are chosen at random, unheard ones first.
 */
import { CUES, MAX_ROWS, ROW_CHARS, SPEAKERS } from './cues.ts'
import type { CueId, CueRule, Exchange, SpeakerId } from './cues.ts'
import { LINES } from './lines.ts'

/** Ticks a character takes to type, a line stays once typed, and the pause between lines. */
export const TYPE_TICKS = 1.5
export const HOLD_TICKS = 90
export const HOLD_TICKS_PER_CHAR = 2
export const GAP_TICKS = 16
/** Banter waits for this much silence. */
export const SILENCE_TICKS = 9 * 60
/** A teaching or event line that has waited this long is dropped (and may be asked for again). */
export const STALE_TICKS = 15 * 60
/** How long a line that is cut off takes to go. */
export const CUT_TICKS = 8
export const QUEUE_MAX = 4

/** What the monitor shows this tick. One object, reused: read it, do not keep it. */
export interface Monitor {
  speaking: boolean
  who: SpeakerId | null
  /** The name plate and the channel. */
  name: string
  channel: string
  /** The portrait: `portrait-<who>-<mood>`. */
  mood: string
  /** The whole line, and the part of it typed so far. */
  text: string
  shown: string
  chars: number
  /** A boss is cutting in on every band: the monitor tears. */
  cutsIn: boolean
  cue: CueId | null
  /** Goes up by one with every line, so two identical lines can be told apart. */
  line: number
}

export function lineTicks(text: string): { type: number; total: number } {
  const type = Math.ceil(text.length * TYPE_TICKS)
  return { type, total: type + HOLD_TICKS + text.length * HOLD_TICKS_PER_CHAR }
}

/** How long an exchange takes to play, gaps included. */
export function exchangeTicks(lines: Exchange): number {
  let t = 0
  for (const l of lines) t += lineTicks(l.text).total + GAP_TICKS
  return t
}

/** Break a line into the monitor's rows: whole words, at most `width` characters a row. */
export function rows(text: string, width: number = ROW_CHARS): string[] {
  const out: string[] = []
  let row = ''
  for (const word of text.split(' ')) {
    if (row === '') row = word
    else if (row.length + 1 + word.length <= width) row += ' ' + word
    else { out.push(row); row = word }
  }
  if (row !== '') out.push(row)
  return out
}

/** Does the line fit the monitor? */
export function fits(text: string): boolean {
  const r = rows(text)
  return r.length <= MAX_ROWS && r.every(x => x.length <= ROW_CHARS)
}

/** Remembers once-a-page-load cues across runs. */
export const SESSION_SEEN = new Set<CueId>()

interface Waiting { cue: CueId; priority: number; lines: Exchange; from: number; at: number }
interface Playing { cue: CueId; priority: number; lines: Exchange; index: number; start: number; typed: number; end: number; cut: boolean }

export interface DirectorOptions {
  /** A number in [0, 1): the world's radio stream. */
  random: () => number
  /** The once-a-page-load memory; a test passes its own. */
  session?: Set<CueId>
}

export function createDirector(opts: DirectorOptions) {
  const session = opts.session ?? SESSION_SEEN
  const runSeen = new Set<CueId>()
  const sectorSeen = new Set<CueId>()
  const lastAsked = new Map<CueId, number>()
  const heard = new Map<CueId, Set<number>>()
  let queue: Waiting[] = []
  let playing: Playing | null = null
  let lastEnd = -Infinity
  let nextAt = 0
  let lineId = 0
  let shownFor = -1
  const monitor: Monitor = {
    speaking: false, who: null, name: '', channel: '', mood: '', text: '', shown: '', chars: 0, cutsIn: false, cue: null, line: 0,
  }

  function seenSet(rule: CueRule): Set<CueId> | null {
    return rule.once === 'session' ? session : rule.once === 'run' ? runSeen : rule.once === 'sector' ? sectorSeen : null
  }

  /** Choose a variant: one not yet heard if there is one. */
  function choose(id: CueId): Exchange {
    const variants = LINES[id]
    let h = heard.get(id)
    if (!h) { h = new Set(); heard.set(id, h) }
    if (h.size >= variants.length) h.clear()
    const open: number[] = []
    for (let i = 0; i < variants.length; i++) if (!h.has(i)) open.push(i)
    const pick = open[Math.min(open.length - 1, Math.floor(opts.random() * open.length))]!
    h.add(pick)
    return variants[pick]!
  }

  /** Ask for a cue at game tick `tick`. Returns true when it was taken. */
  function cue(id: CueId, tick: number): boolean {
    const rule: CueRule | undefined = CUES[id]
    if (!rule || !LINES[id] || LINES[id].length === 0) return false
    const once = seenSet(rule)
    if (once?.has(id)) return false
    if (rule.once && (playing?.cue === id || queue.some(q => q.cue === id))) return false
    const last = lastAsked.get(id)
    if (rule.cooldown && last !== undefined && tick - last < rule.cooldown * 60) return false
    if (rule.priority === 1 && (playing || queue.length > 0 || tick - lastEnd < SILENCE_TICKS)) return false
    const lines = choose(id)
    lastAsked.set(id, tick)
    const item: Waiting = { cue: id, priority: rule.priority, lines, from: 0, at: tick }
    if (rule.priority === 3) {
      // A story beat cuts in. A teaching or event line it cuts off is said again afterwards.
      const took = exchangeTicks(lines)
      for (const q of queue) if (q.priority < 3) q.at += took
      let at = queue.findIndex(q => q.priority < 3)
      if (at < 0) at = queue.length
      queue.splice(at, 0, item)
      if (playing && playing.priority < 3 && !playing.cut) {
        const from = tick < playing.typed ? playing.index : playing.index + 1
        const cut: CueRule = CUES[playing.cue]
        if (playing.priority === 2 && cut.once && from < playing.lines.length) {
          queue.splice(at + 1, 0, { cue: playing.cue, priority: 2, lines: playing.lines, from, at: tick + took })
        }
        playing.cut = true
        playing.end = Math.min(playing.end, tick + CUT_TICKS)
        playing.typed = Math.min(playing.typed, tick)
      }
    } else {
      queue.push(item)
    }
    while (queue.length > QUEUE_MAX) {
      const i = queue.findIndex(q => q.priority < 3)
      queue.splice(i >= 0 ? i : 0, 1)
    }
    return true
  }

  function startLine(p: Playing, tick: number): void {
    const d = lineTicks(p.lines[p.index]!.text)
    p.start = tick
    p.typed = tick + d.type
    p.end = tick + d.total
    lineId++
  }

  /** Advance to `tick`; returns what the monitor shows. */
  function step(tick: number): Monitor {
    if (playing && tick >= playing.end) {
      lastEnd = playing.end
      nextAt = playing.end + (playing.cut ? 0 : GAP_TICKS)
      if (!playing.cut && playing.index + 1 < playing.lines.length) {
        playing.index++
        playing.start = Infinity
        playing.end = Infinity
      } else playing = null
    }
    if (playing && playing.start === Infinity && tick >= nextAt) startLine(playing, tick)
    if (!playing && queue.length > 0 && tick >= nextAt) {
      queue = queue.filter(q => q.priority >= 3 || tick - q.at < STALE_TICKS)
      const next = queue.shift()
      if (next) {
        seenSet(CUES[next.cue])?.add(next.cue)
        playing = { cue: next.cue, priority: next.priority, lines: next.lines, index: next.from, start: 0, typed: 0, end: 0, cut: false }
        startLine(playing, tick)
      }
    }
    const m = monitor
    if (!playing || playing.start === Infinity) {
      if (m.speaking) { m.speaking = false; m.cutsIn = false; m.shown = ''; m.chars = 0 }
      return m
    }
    const line = playing.lines[playing.index]!
    const sp = SPEAKERS[line.who]
    const chars = tick >= playing.typed ? line.text.length : Math.max(0, Math.floor((tick - playing.start) / TYPE_TICKS))
    if (m.line !== lineId || !m.speaking) {
      m.speaking = true
      m.who = line.who
      m.name = sp.name
      m.channel = sp.channel
      m.mood = line.mood ?? sp.moods[0]!
      m.text = line.text
      m.cutsIn = sp.cutsIn === true
      m.cue = playing.cue
      m.line = lineId
      shownFor = -1
    }
    if (chars !== shownFor) {
      shownFor = chars
      m.chars = chars
      m.shown = line.text.slice(0, chars)
    }
    return m
  }

  /** A new sector: once-a-sector cues may be said again. */
  function newSector(): void {
    sectorSeen.clear()
  }

  /** A new run: forget what was said this run and anything still waiting. */
  function resetRun(): void {
    runSeen.clear()
    sectorSeen.clear()
    lastAsked.clear()
    queue = []
    playing = null
    lastEnd = -Infinity
    nextAt = 0
    monitor.speaking = false
    monitor.cutsIn = false
    monitor.shown = ''
    monitor.chars = 0
  }

  /** Drop what is waiting and cut the line on the air short (the player quit). */
  function hush(tick: number): void {
    queue = []
    if (playing) {
      playing.cut = true
      playing.end = Math.min(playing.end, tick + CUT_TICKS)
      playing.typed = Math.min(playing.typed, tick)
    }
  }

  return {
    cue, step, newSector, resetRun, hush, monitor,
    get busy() { return playing !== null || queue.length > 0 },
    get waiting() { return queue.length },
  }
}

export type Director = ReturnType<typeof createDirector>

/** The part of an engine event the radio reads. */
export interface RadioEvent {
  readonly type: string
  readonly kind: string
  readonly alt: string
}

/**
 * The glue between the engine and the radio, once a tick after `step(world)`:
 * feed the tick's events to the director and get the monitor back.
 * A `cue` event asks for `kind`, and for `alt` when that is turned down;
 * a sector's card lets once-a-sector cues be said again.
 */
export function listen(director: Director, events: readonly RadioEvent[], tick: number): Monitor {
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!
    if (e.type === 'card' && e.kind === 'sector') director.newSector()
    else if (e.type === 'cue') {
      if (!director.cue(e.kind as CueId, tick) && e.alt) director.cue(e.alt as CueId, tick)
    }
  }
  return director.step(tick)
}
