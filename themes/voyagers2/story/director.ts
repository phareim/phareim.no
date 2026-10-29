/**
 * Space Voyagers II's comms director: Space Voyagers I's, which is tested and
 * works, with one thing added: a cue said by a seat ("the back seat calls the
 * bandit") is answered with a variant whose first speaker is the pilot who
 * sits there now. Pure: no DOM, no clock but the game's, no chance but the
 * function it is given.
 *
 *  - priority 3 is story: it cuts in on anything lesser and jumps the queue;
 *  - priority 2 is teaching and events: queued, dropped when stale, and said
 *    again if a story line cut it off;
 *  - priority 1 is banter: only into silence;
 *  - a cue may be once a page load, once a run, once a mission, or on a cooldown.
 */
import { CUES, MAX_ROWS, ROW_CHARS, SPEAKERS } from './cues.ts'
import type { By, CueId, CueRule, Exchange, PilotId, SpeakerId } from './cues.ts'
import { LINES } from './lines.ts'

export const TYPE_TICKS = 1.4
export const HOLD_TICKS = 80
export const HOLD_TICKS_PER_CHAR = 2
export const GAP_TICKS = 14
export const SILENCE_TICKS = 8 * 60
export const STALE_TICKS = 12 * 60
export const CUT_TICKS = 8
export const QUEUE_MAX = 4

export interface Monitor {
  speaking: boolean
  who: SpeakerId | null
  name: string
  channel: string
  mood: string
  /** The portrait's file: `/<dir>/portrait-<who>-<mood>.png`. */
  portrait: string
  text: string
  shown: string
  chars: number
  cutsIn: boolean
  cue: CueId | null
  line: number
}

export function lineTicks(text: string): { type: number; total: number } {
  const type = Math.ceil(text.length * TYPE_TICKS)
  return { type, total: type + HOLD_TICKS + text.length * HOLD_TICKS_PER_CHAR }
}

export function exchangeTicks(lines: Exchange): number {
  let t = 0
  for (const l of lines) t += lineTicks(l.text).total + GAP_TICKS
  return t
}

/** Break a line into rows: whole words, at most `width` characters a row. */
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

export function fits(text: string): boolean {
  const r = rows(text)
  return r.length <= MAX_ROWS && r.every(x => x.length <= ROW_CHARS)
}

export function portraitOf(who: SpeakerId, mood: string): string {
  return `/${SPEAKERS[who].dir}/portrait-${who}-${mood}.png`
}

export const SESSION_SEEN = new Set<CueId>()

export interface Seats { front: PilotId; back: PilotId; player: PilotId }

interface Waiting { cue: CueId; priority: number; lines: Exchange; from: number; at: number }
interface Playing { cue: CueId; priority: number; lines: Exchange; index: number; start: number; typed: number; end: number; cut: boolean }

export interface DirectorOptions {
  random: () => number
  /** Who sits where now (read when a cue is asked for). */
  seats: () => Seats
  session?: Set<CueId>
}

export function createDirector(opts: DirectorOptions) {
  const session = opts.session ?? SESSION_SEEN
  const runSeen = new Set<CueId>()
  const missionSeen = new Set<CueId>()
  const lastAsked = new Map<CueId, number>()
  const heard = new Map<CueId, Set<number>>()
  let queue: Waiting[] = []
  let playing: Playing | null = null
  let lastEnd = -Infinity
  let nextAt = 0
  let lineId = 0
  let shownFor = -1
  const monitor: Monitor = {
    speaking: false, who: null, name: '', channel: '', mood: '', portrait: '', text: '', shown: '', chars: 0, cutsIn: false, cue: null, line: 0,
  }

  function seenSet(rule: CueRule): Set<CueId> | null {
    return rule.once === 'session' ? session : rule.once === 'run' ? runSeen : rule.once === 'mission' ? missionSeen : null
  }

  function speakerFor(by: By): PilotId {
    const s = opts.seats()
    if (by === 'front') return s.front
    if (by === 'back') return s.back
    if (by === 'player') return s.player
    return s.player === s.front ? s.back : s.front
  }

  /** Choose a variant: one not yet heard, and for a seat's cue one said by whoever sits there. */
  function choose(id: CueId): Exchange | null {
    const variants = LINES[id]
    const rule: CueRule = CUES[id]
    const allowed: number[] = []
    const who = rule.by ? speakerFor(rule.by) : null
    for (let i = 0; i < variants.length; i++) {
      if (who && (variants[i]![0]!.who === 'rex' || variants[i]![0]!.who === 'nova') && variants[i]![0]!.who !== who) continue
      allowed.push(i)
    }
    if (allowed.length === 0) return null
    let h = heard.get(id)
    if (!h) { h = new Set(); heard.set(id, h) }
    let open = allowed.filter(i => !h!.has(i))
    if (open.length === 0) { for (const i of allowed) h.delete(i); open = allowed }
    const pick = open[Math.min(open.length - 1, Math.floor(opts.random() * open.length))]!
    h.add(pick)
    return variants[pick]!
  }

  function cue(id: CueId, tick: number): boolean {
    const rule: CueRule | undefined = CUES[id]
    if (!rule || !LINES[id] || LINES[id].length === 0) return false
    const once = seenSet(rule)
    if (once?.has(id)) return false
    if (rule.once && (playing?.cue === id || queue.some(q => q.cue === id))) return false
    const last = lastAsked.get(id)
    if (rule.cooldown && last !== undefined && tick - last < rule.cooldown * 60) return false
    if (rule.priority === 1 && (playing || queue.length > 0 || tick - lastEnd < SILENCE_TICKS)) return false
    if (rule.priority === 2 && queue.some(q => q.cue === id)) return false
    const lines = choose(id)
    if (!lines) return false
    lastAsked.set(id, tick)
    const item: Waiting = { cue: id, priority: rule.priority, lines, from: 0, at: tick }
    if (rule.priority === 3) {
      const took = exchangeTicks(lines)
      for (const q of queue) if (q.priority < 3) q.at += took
      let at = queue.findIndex(q => q.priority < 3)
      if (at < 0) at = queue.length
      queue.splice(at, 0, item)
      if (playing && playing.priority < 3 && !playing.cut) {
        const from = tick < playing.typed ? playing.index : playing.index + 1
        const cutRule: CueRule = CUES[playing.cue]
        if (playing.priority === 2 && cutRule.once && from < playing.lines.length) {
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
      // Rex and Nova on the intercom say which seat they are in.
      m.channel = line.who === 'rex' || line.who === 'nova' ? (opts.seats().front === line.who ? 'FRONT SEAT' : 'BACK SEAT') : sp.channel
      m.mood = line.mood ?? sp.moods[0]!
      m.portrait = portraitOf(line.who, m.mood)
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

  function newMission(): void {
    missionSeen.clear()
  }

  function resetRun(): void {
    runSeen.clear()
    missionSeen.clear()
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

  function hush(tick: number): void {
    queue = []
    if (playing) {
      playing.cut = true
      playing.end = Math.min(playing.end, tick + CUT_TICKS)
      playing.typed = Math.min(playing.typed, tick)
    }
  }

  return {
    cue, step, newMission, resetRun, hush, monitor,
    get busy() { return playing !== null || queue.length > 0 },
    get waiting() { return queue.length },
  }
}

export type Director = ReturnType<typeof createDirector>
