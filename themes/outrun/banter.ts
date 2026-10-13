/**
 * What Nova and Rex say to each other on the drive. Pure and deterministic,
 * like the engine: the page hands it cues (a fork taken, a tunnel, a close
 * pass, silence) and it answers with the line on screen, if any. No DOM, no
 * canvas, its own seeded random numbers, so `node --test` covers it.
 *
 * The voices are the ones of Nova's Solo Rescue (~/github/nova/docs/story.md):
 * Nova is dry and quick, three to nine words, never explains a joke. Rex is
 * cheerful, hungry and not worried enough; he rates the food. Nothing stronger
 * than "crap". She drives, he holds the pizza.
 *
 * Rules:
 * - an exchange is one to three lines said in turn; one exchange at a time;
 * - urgent cues (the start, a fork, a new stage, a wreck, the last seconds,
 *   the end) cut in on small talk and otherwise wait for the line to finish;
 * - reactions (a bump, a tunnel, a close pass) need five quiet seconds;
 * - small talk comes by itself after nine to fifteen quiet seconds;
 * - no exchange is said twice in a run; a cue whose lines are used up is
 *   passed over in silence.
 */
import type { Biome } from './engine'

export type Speaker = 'nova' | 'rex'
export type NovaMood = 'calm' | 'smirk' | 'angry' | 'surprised' | 'shout' | 'wince' | 'laugh' | 'eyeroll' | 'set'
export type RexMood = 'cheerful' | 'eating' | 'sheepish' | 'worried'

export interface BanterLine {
  who: Speaker
  mood: NovaMood | RexMood
  text: string
}

/** The line on screen: how long it has been up and how long it stays. */
export interface SpokenLine extends BanterLine {
  t: number
  life: number
}

export type Cue =
  | 'go' | 'fork-left' | 'fork-right' | 'checkpoint' | `stage:${Biome}`
  | 'tumble' | 'spin' | 'low' | 'timeup' | 'goal'
  | 'bump' | 'scrape' | 'offroad' | 'tunnel' | 'close' | 'chain' | 'fast' | 'backfire'
  | 'idle'

const n = (mood: NovaMood, text: string): BanterLine => ({ who: 'nova', mood, text })
const r = (mood: RexMood, text: string): BanterLine => ({ who: 'rex', mood, text })

/** Every exchange, by the cue that calls for it. */
export const LINES: Record<Cue, readonly (readonly BanterLine[])[]> = {
  go: [
    [n('set', 'Mountains by sunrise. Hold the pizza.'), r('cheerful', 'Holding. Mostly.')],
    [r('cheerful', 'Road trip! Did you bring the tape?'), n('calm', "You're sitting on it.")],
    [n('calm', 'Seatbelt.'), r('sheepish', "It's holding the pizza.")],
    [r('cheerful', 'Whose car is this again?'), n('smirk', 'Slop said take the weekend.')],
  ],
  'fork-left': [
    [r('cheerful', 'Left! The scenic way.'), n('smirk', 'The slow way. Fine.')],
    [n('calm', 'Left it is.'), r('eating', 'Good. Fewer bumps for the pizza.')],
    [r('sheepish', 'Map says left is shorter. I think. It is upside down.')],
    [n('eyeroll', 'The easy road. Happy?'), r('cheerful', 'Very!')],
  ],
  'fork-right': [
    [n('set', 'Right. The fun one.'), r('worried', 'Define fun.')],
    [r('worried', 'The steep road? With the pizza?'), n('smirk', 'Hold it tighter.')],
    [n('smirk', 'Higher road, better view.'), r('cheerful', 'Better appetite!')],
    [r('worried', 'That sign had a skull on it.'), n('calm', 'That was a moose.')],
  ],
  checkpoint: [
    [r('cheerful', "Clock says we're good."), n('calm', "Clock's been wrong since '89.")],
    [n('smirk', 'Making time.'), r('eating', 'Making crumbs.')],
    [r('cheerful', 'Halfway! Probably!'), n('calm', "You're holding the map sideways.")],
  ],
  'stage:city': [
    [r('cheerful', 'Smells like a bakery. And a tyre fire.'), n('calm', "That's the bakery.")],
    [n('eyeroll', 'One mill, nine pizza places.'), r('cheerful', 'I rate four of them!')],
  ],
  'stage:shore': [
    [r('cheerful', 'The sea! Can we stop for clams?'), n('calm', 'We have pizza.'), r('cheerful', 'Clam pizza?')],
    [n('calm', 'Lighthouse.'), r('cheerful', "It's winking at us."), n('eyeroll', "It's a lighthouse, Rex.")],
  ],
  'stage:farms': [
    [r('cheerful', 'Cows! No. Those are rocks.'), n('smirk', 'Wicked observant.')],
    [r('eating', 'That barn sells pie. I can feel it.'), n('set', "We're not stopping.")],
    [r('cheerful', 'A diner! Open all night!'), n('calm', "It's been open since '89.")],
  ],
  'stage:woods': [
    [r('worried', 'The sign said moose.'), n('calm', "The moose can't read. Relax.")],
    [n('calm', 'No radio out here. Just tape.'), r('cheerful', 'Side B! The good side.')],
    [r('worried', 'It is very dark in there.'), n('smirk', "It's trees. They're asleep.")],
  ],
  'stage:pass': [
    [r('worried', "That's a lot of rock on both sides."), n('smirk', "It's called a road.")],
    [n('set', 'Ears popping yet?'), r('eating', "Can't tell. Chewing.")],
    [r('cheerful', 'I can see our house from here!'), n('calm', "That's a rock, Rex.")],
  ],
  'stage:peaks': [
    [r('cheerful', 'Snow! In 1989!'), n('calm', "It's been 1989 for a while.")],
    [n('surprised', 'Is that actual snow?'), r('cheerful', 'First of the year. Again.')],
    [r('worried', 'Is the car good on ice?'), n('set', 'We are about to know.')],
  ],
  tumble: [
    [r('worried', 'Did we just roll?'), n('wince', "Don't tell Slop.")],
    [n('shout', 'Nobody dents this car but me!')],
    [r('sheepish', "The duffel's fine. I landed on it.")],
    [n('wince', 'Still got four wheels. Count them.'), r('worried', 'Three. Four! Four.')],
  ],
  spin: [
    [n('wince', "Fine. I'm fine. Car's fine."), r('sheepish', 'The pizza saw things.')],
    [r('worried', "We're going backwards!"), n('set', 'Briefly.')],
    [n('angry', 'Who taught that guy to drive?')],
  ],
  low: [
    [r('worried', "Sun's coming up fast."), n('set', 'So am I.')],
    [n('shout', 'Hold on to something!'), r('worried', "I'm holding the pizza!")],
    [r('worried', 'Are we going to make it?'), n('set', 'Ask me in ten seconds.')],
  ],
  timeup: [
    [n('angry', 'Out of night.'), r('sheepish', 'We could eat the pizza here?')],
    [r('cheerful', 'Nice view anyway.'), n('eyeroll', "It's a guard rail.")],
    [n('wince', 'So close.'), r('eating', 'Mmf. Next time.')],
  ],
  goal: [
    [n('laugh', 'Mountains. Told you.'), r('eating', 'Sunrise and cold pizza. Ten out of ten.')],
    [r('cheerful', 'We made it! Is the pizza okay?'), n('smirk', "You're wearing it.")],
    [n('smirk', "It's a hill. It's fine."), r('cheerful', "You're smiling!"), n('calm', 'Am not.')],
  ],
  bump: [
    [r('sheepish', 'Sorry! Why am I apologising?'), n('angry', 'Use your blinker, pal!')],
    [n('angry', 'Hey! This is a company car!')],
    [r('sheepish', "The pizza slid. It's fine. It's upside down.")],
    [n('wince', 'That was his fault.'), r('cheerful', 'Totally his fault!')],
  ],
  scrape: [
    [n('wince', "That's the paint."), r('cheerful', 'Sparks! Like the Fourth of July.')],
    [r('worried', 'The wall is very close.'), n('set', 'The wall started it.')],
  ],
  offroad: [
    [r('worried', "This isn't road."), n('set', "It's road-adjacent.")],
    [n('eyeroll', 'Shortcut.'), r('worried', 'Through a field?')],
    [r('worried', 'I think that was a pumpkin.'), n('calm', 'Was.')],
  ],
  tunnel: [
    [r('cheerful', 'Tunnel! Hold your breath!'), n('eyeroll', 'For what?')],
    [r('cheerful', 'ECHO!'), n('wince', "Don't.")],
    [n('calm', 'Lights.'), r('sheepish', "They're on. I think that's the wipers.")],
  ],
  close: [
    [r('worried', 'That was a mirror. We kept ours?'), n('smirk', 'Both of them.')],
    [n('smirk', 'Plenty of room.'), r('worried', 'I could read his dashboard.')],
    [r('cheerful', 'Hi! Bye!')],
    [n('calm', 'Checker cab. They never signal.')],
  ],
  chain: [
    [r('worried', "You're counting them. Stop counting them."), n('smirk', 'Four.')],
    [n('laugh', 'Like delivery night on the scooter.'), r('worried', 'The scooter had less pizza at stake.')],
    [r('worried', 'Is this a race?'), n('set', 'Everything is a race.')],
  ],
  fast: [
    [r('worried', 'How fast is this?'), n('calm', "Needle's broken. So, fine.")],
    [n('smirk', 'Fastest scooter in Neo Boston.'), r('worried', "This isn't a scooter!")],
    [r('cheerful', "My headband's trying to leave.")],
  ],
  backfire: [
    [r('worried', 'Was that us?'), n('calm', 'That was the car.')],
    [n('smirk', 'She does that.'), r('worried', 'On purpose?')],
  ],
  idle: [
    [r('eating', 'This slice is a seven. Road slice. Different scale.'), n('eyeroll', 'Stop eating the luggage.')],
    [r('cheerful', 'Play our song.'), n('smirk', "It's been playing. For an hour.")],
    [n('calm', 'You taped over the weather report.'), r('sheepish', 'With our song!'), n('calm', 'It was about tonight.')],
    [r('cheerful', 'I spy something beginning with R.'), n('eyeroll', 'Road.'), r('cheerful', "You're so good at this.")],
    [r('worried', 'Do mountains have pizza?'), n('set', 'They do now.')],
    [n('calm', 'Mei says the Dial dies past the hills.'), r('cheerful', 'Good. Just us and side A.')],
    [r('cheerful', 'Are we there yet?'), n('calm', 'Ask the mountains.')],
    [r('eating', 'Hot dog stand back there. A six.'), n('surprised', 'When did you—'), r('eating', 'Mmf.')],
    [n('smirk', 'Nineteen eighty-nine. Best year going.'), r('cheerful', 'Only year going!')],
    [r('sheepish', 'I may have packed only snacks.'), n('calm', 'I know. I packed the rest.')],
    [r('cheerful', 'You never said why the mountains.'), n('calm', "No payphones up there."), r('cheerful', 'Romantic!')],
    [n('calm', 'Rewind it. I like that one.'), r('cheerful', 'It says DO NOT TAPE OVER. In your writing.')],
  ],
}

const URGENT: ReadonlySet<string> = new Set(['go', 'fork-left', 'fork-right', 'checkpoint', 'tumble', 'spin', 'low', 'timeup', 'goal'])
/** 2 urgent, 1 a reaction, 0 small talk. */
export function priority(cue: Cue): 0 | 1 | 2 {
  if (cue === 'idle') return 0
  return URGENT.has(cue) || cue.startsWith('stage:') ? 2 : 1
}

/** Seconds a reaction must find quiet, and the range small talk waits for. */
export const REACT_QUIET = 5
export const IDLE_QUIET = [9, 15] as const
/** Seconds between the lines of one exchange. */
export const LINE_GAP = 0.3

/** How long a line stays up: long enough to read, never long enough to nag. */
export function lineLife(text: string): number {
  return Math.max(2, Math.min(4.6, 1.4 + text.length * 0.06))
}

export interface Banter {
  rng: number
  /** Exchange indices still unsaid, per cue, in the order they will be said. */
  left: Partial<Record<Cue, number[]>>
  /** The exchange being said, the line of it that is up, and that line's clock. */
  now: { cue: Cue, lines: readonly BanterLine[], i: number, t: number, gap: number } | null
  /** An urgent cue waiting for the line on screen to finish. */
  pending: Cue | null
  /** Seconds since the last word, and how long small talk will wait this time. */
  quiet: number
  idleAt: number
  /** After the end of a run nothing more is said. */
  over: boolean
  /** Exchanges said, for the tests and the result panel. */
  said: number
}

function rand(b: Banter): number {
  b.rng = (b.rng + 0x6d2b79f5) | 0
  let t = b.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function createBanter(seed = 1989): Banter {
  const b: Banter = { rng: seed | 0, left: {}, now: null, pending: null, quiet: 0, idleAt: 0, over: false, said: 0 }
  b.idleAt = IDLE_QUIET[0] + rand(b) * (IDLE_QUIET[1] - IDLE_QUIET[0])
  return b
}

/** The next unsaid exchange for a cue (shuffled once per run), or null when they are used up. */
function draw(b: Banter, cue: Cue): readonly BanterLine[] | null {
  let left = b.left[cue]
  if (!left) {
    left = LINES[cue].map((_, i) => i)
    for (let i = left.length - 1; i > 0; i--) {
      const j = Math.floor(rand(b) * (i + 1))
      const t = left[i]!
      left[i] = left[j]!
      left[j] = t
    }
    b.left[cue] = left
  }
  const i = left.pop()
  return i === undefined ? null : LINES[cue][i]!
}

function begin(b: Banter, cue: Cue): boolean {
  // A new stage has lines of its own; when they are said, the checkpoint's do.
  const lines = draw(b, cue) ?? (cue.startsWith('stage:') ? draw(b, 'checkpoint') : null)
  if (!lines) return false
  b.now = { cue, lines, i: 0, t: 0, gap: 0 }
  b.pending = null
  b.said++
  if (cue === 'timeup' || cue === 'goal') b.over = true
  return true
}

/** Something happened. Returns true when it will be spoken to (now, or when the line up is done). */
export function cueBanter(b: Banter, cue: Cue): boolean {
  if (b.over) return false
  const p = priority(cue)
  if (b.now) {
    if (p < 2) return false
    // The end of the run, and anything urgent over small talk, cuts in; else it waits its turn.
    if (cue === 'timeup' || cue === 'goal' || priority(b.now.cue) < 2) return begin(b, cue)
    b.pending = cue
    return true
  }
  if (p === 1 && b.quiet < REACT_QUIET) return false
  return begin(b, cue)
}

/** Advance the clock. `hold` (the countdown, a pause) keeps small talk from starting. */
export function stepBanter(b: Banter, dt: number, hold = false): void {
  const s = b.now
  if (!s) {
    b.quiet += dt
    if (b.pending) {
      const cue = b.pending
      b.pending = null
      begin(b, cue)
    } else if (!hold && !b.over && b.quiet >= b.idleAt) {
      if (!begin(b, 'idle')) b.quiet = 0
    }
    return
  }
  if (s.gap > 0) {
    s.gap -= dt
    return
  }
  s.t += dt
  if (s.t < lineLife(s.lines[s.i]!.text)) return
  if (s.i + 1 < s.lines.length) {
    s.i++
    s.t = 0
    s.gap = LINE_GAP
    return
  }
  b.now = null
  b.quiet = 0
  b.idleAt = IDLE_QUIET[0] + rand(b) * (IDLE_QUIET[1] - IDLE_QUIET[0])
}

/** The line to show, or null between lines and in silence. */
export function spokenLine(b: Banter): SpokenLine | null {
  const s = b.now
  if (!s || s.gap > 0) return null
  const line = s.lines[s.i]!
  return { ...line, t: s.t, life: lineLife(line.text) }
}
