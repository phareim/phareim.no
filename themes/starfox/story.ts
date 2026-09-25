/**
 * Star Fox story — OPERATION NIGHTLIGHT (2026-09-25). Sectors, the intercom
 * script and the director that paces it. Pure: no Vue/DOM/three, so
 * tests/starfox-story.test.mjs runs it in plain node with a fake clock.
 *
 * The premise: the Hollow, an armada of dark machines that eat light, came
 * in over the sea and is putting out the coast's neon one beacon at a time.
 * The player flies out of the town's hangar with Claude on the right wing in
 * the gold ship. Five named sectors end at the Hollow's mothership, THE
 * CROWN; after that the run goes on as ECHO I, ECHO II, … over the same five.
 *
 * Three voices (Neon Dreams: person vs machine):
 *   claude  the wingman. Person voice, plain, short, a bit dry. Lowercase in
 *           the source (the pixel font shows capitals).
 *   hollow  the armada. Machine voice, UPPERCASE, `·`-separated fragments.
 *   hangar  ground control in town. Short and procedural, lowercase, rare:
 *           launch, sector clears, the ending, one boss warning.
 *
 * ---------------------------------------------------------------- API
 *
 *   const director = createDirector({ reduced })   // rng, seen: for tests
 *   director.startRun({ cs: callsignFrom(name), run, ...controlVars(touch) })
 *       new run: forgets run-scoped cues, then queues `launch` and `brief`
 *       (first run of the page load) or `retry`.
 *   director.cue(key, vars?)  → boolean   ask for a line; false = refused
 *   director.tick(dt)                      advance the game clock, dt in
 *                                          SECONDS; do not tick while paused
 *                                          (that freezes the intercom too)
 *   director.current() → { id, who, text, shown } | null
 *       the line on screen; `shown` = characters typed so far (all of them
 *       when reduced motion is on). `id` changes when a new line starts.
 *   director.hush()                        drop the queue, cut the line short
 *                                          (quit, death)
 *   director.reset(run?)                   same as startRun without the cues
 *   director.setVars(vars) / setReduced(bool)
 *
 * Cue keys come from the helpers so the integrator never spells them:
 *   sectorCue(i) + sectorVars(i)   at every sector start (i = zero-based)
 *   bossIntroCue(i)                after the WARNING banner
 *   bossPhaseCue(i, phase)         when a boss enters phase 2 (3 for the Crown)
 *   bossDownCues(i)                on the kill: the kill line, then `clear`
 *                                  (hangar) or, after THE CROWN, `ending`
 *   meetCue(kind)                  first sighting of an enemy kind
 *   pickCue(type)                  capsule pickup (`gold` for a gold ring)
 * Plain keys: `boss:warning`, `warn:behind`, `set:rings|turrets|carrier|
 * ambush`, `gold:all`, `laser:hyper`, `hull:low`, `shield:down`,
 * `wing:down`, `wing:back`, `best`, `death`, `taunt`, `chatter`, `idle`,
 * `teach:bomb`, `teach:charge` (the last two from createNudges()).
 *
 * The director (the same model as Galaga's): priority 3 is story and
 * interrupts; 2 is teaching; 1 is ambient and lands only after 9 s of
 * silence. Cues can be once per page load (SESSION_SEEN, survives
 * remounts), once per run, or on a cooldown. A teaching line cut
 * mid-sentence by a story beat is said again afterwards. Variants never
 * repeat back to back.
 */

// Small helpers, the same rules as Galaga's story.ts (kept local so this
// module has no imports and loads in plain node).

export type Vars = Record<string, string | number>

/** "Neon Otter" → "otter": the Hall of Fame animal is the callsign. */
export function callsignFrom(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1]!.toLowerCase() : 'pilot'
}

export function fill(text: string, vars: Vars): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
export function roman(n: number): string {
  const k = Math.max(1, Math.floor(n))
  return k <= ROMAN.length ? ROMAN[k - 1]! : String(k)
}

// ---------------------------------------------------------------- sectors

import type { BiomeId, BossId } from './ids.ts'
export type { BiomeId, BossId }

export interface SectorDef {
  /** Zero-based sector index (= bosses killed so far). */
  index: number
  /** One-based sector number, counting on through the ECHO loops. */
  num: number
  /** Position in the five-sector route, 0–4. */
  base: number
  /** 0 for the first pass, 1 for ECHO I, 2 for ECHO II, … (tuning scales on it). */
  loop: number
  /** CORAL COAST … THE HOLLOW CROWN. */
  name: string
  /** '' on the first pass, else 'ECHO I', 'ECHO II', … */
  echo: string
  /** The title card: 'SECTOR 2 · WHISPER WOODS', 'ECHO I · CORAL COAST'. */
  card: string
  biome: BiomeId
  boss: BossId
  /** THE PINCER …; ECHO PINCER, ECHO II PINCER, … in the loops. */
  bossName: string
}

export const SECTORS: readonly { name: string; biome: BiomeId; boss: BossId; bossName: string }[] = [
  { name: 'CORAL COAST', biome: 'coast', boss: 'pincer', bossName: 'THE PINCER' },
  { name: 'WHISPER WOODS', biome: 'woods', boss: 'moth', bossName: 'THE MOTH' },
  { name: 'EMBER FIELDS', biome: 'ember', boss: 'furnace', bossName: 'THE FURNACE' },
  { name: 'MIRROR LAKE', biome: 'lake', boss: 'twins', bossName: 'THE TWINS' },
  { name: 'THE HOLLOW CROWN', biome: 'space', boss: 'crown', bossName: 'THE CROWN' },
]

/** Boss phases past the first: the Crown has three, the rest two. */
export const BOSS_PHASES: Record<BossId, number> = { pincer: 2, moth: 2, furnace: 2, twins: 2, crown: 3 }

export function sectorFor(index: number): SectorDef {
  const i = Math.max(0, Math.floor(index))
  const base = i % SECTORS.length
  const loop = Math.floor(i / SECTORS.length)
  const d = SECTORS[base]!
  const echo = loop ? `ECHO ${roman(loop)}` : ''
  const bare = d.bossName.replace(/^THE /, '')
  return {
    index: i,
    num: i + 1,
    base,
    loop,
    name: d.name,
    echo,
    card: loop ? `${echo} · ${d.name}` : `SECTOR ${i + 1} · ${d.name}`,
    biome: d.biome,
    boss: d.boss,
    bossName: loop === 0 ? d.bossName : loop === 1 ? `ECHO ${bare}` : `ECHO ${roman(loop)} ${bare}`,
  }
}

/** Template variables for a sector's lines (lowercase: the person voices). */
export function sectorVars(index: number): Vars {
  const s = sectorFor(index)
  return { n: s.num, name: s.name.toLowerCase(), loop: s.echo.toLowerCase(), boss: s.bossName.toLowerCase() }
}

export function sectorCue(index: number): string {
  const s = sectorFor(index)
  if (s.loop === 0) return `sector:${s.biome}`
  return s.base === 0 ? 'sector:echo' : 'sector:echo:next'
}
export function bossIntroCue(index: number): string {
  return `boss:intro:${sectorFor(index).boss}`
}
/** Phase 2 (and 3 for the Crown); null for a phase with no line. */
export function bossPhaseCue(index: number, phase: number): string | null {
  const b = sectorFor(index).boss
  return phase >= 2 && phase <= BOSS_PHASES[b] ? `boss:phase:${b}:${phase}` : null
}
export function bossDownCues(index: number): string[] {
  const s = sectorFor(index)
  return [`boss:down:${s.boss}`, s.index === 4 ? 'ending' : 'clear']
}

/** Enemy kinds and capsules the script knows (ids shared with the game). */
export const STORY_ENEMIES = [
  'drone', 'kamikaze', 'weaver', 'sniper', 'dasher', 'bulwark', 'splitter', 'mite', 'carrier', 'turret', 'missile',
] as const
export type StoryEnemy = typeof STORY_ENEMIES[number]
export const STORY_CAPSULES = ['laser', 'bomb', 'shield', 'wing', 'overdrive', 'gold'] as const
export type StoryCapsule = typeof STORY_CAPSULES[number]

export function meetCue(kind: string): string {
  return `meet:${kind}`
}
export function pickCue(type: string): string {
  return `pick:${type}`
}

/** How the controls read in Claude's lines, per input mode. */
export function controlVars(touch: boolean): Vars {
  return touch
    ? { start: 'tap', bomb: 'the bomb button', charge: 'holding a second finger' }
    : { start: 'press enter', bomb: 'b or x', charge: 'holding space' }
}

// ---------------------------------------------------------------- script

export type Speaker = 'claude' | 'hollow' | 'hangar'

export interface Line {
  who: Speaker
  text: string
}

type Once = 'session' | 'run'

export interface CueDef {
  /** 3 story (interrupts), 2 teaching, 1 ambient (dropped when busy). */
  prio: 1 | 2 | 3
  once?: Once
  /** Minimum ms of game time between two plays of this cue. */
  cooldown?: number
  /** Variants; each is a short exchange of one or more lines. */
  variants: Line[][]
}

/** Longest line per voice, in characters (three lines of the desktop panel). */
export const MAX_CHARS: Record<Speaker, number> = { claude: 80, hollow: 44, hangar: 60 }

const C = (text: string): Line => ({ who: 'claude', text })
const H = (text: string): Line => ({ who: 'hollow', text })
const G = (text: string): Line => ({ who: 'hangar', text })

export const CUES: Record<string, CueDef> = {
  idle: { prio: 2, once: 'session', variants: [[C('claude, in the gold one. {start} and we go.')]] },

  // --- run start
  launch: {
    prio: 3, variants: [
      [G('hangar to nightlight. doors open, sky is yours.')],
      [G('nightlight, cleared out. mind the radio mast.')],
      [G('hangar. runway lit, fuel full. go when ready.')],
      [G('doors open, {cs}. bring the ship back this time.')],
    ],
  },
  brief: {
    prio: 3, once: 'session', variants: [[
      C('{cs}, claude here. i am on your right, in the gold ship.'),
      C('the hollow came in over the sea. they eat light, one beacon at a time.'),
      H('LIGHT · DETECTED · DIM IT'),
      C('operation nightlight. we turn the coast back on. shoot the dark things.'),
    ]],
  },
  retry: {
    prio: 3, variants: [
      [C('new ship, same plan. lights on, dark things off.')],
      [C('the hollow did not move while you were gone. rude of them.')],
      [C('round {run}. they have learned nothing. we have.')],
      [C('back on your right. i kept the formation open.')],
    ],
  },

  // --- sector openings (sectorCue)
  'sector:coast': {
    prio: 3, variants: [
      [C('coral coast. every beacon is out from the pier to the stacks.')],
      [C('the coast again. the sea stacks do not move for anyone.')],
    ],
  },
  'sector:woods': {
    prio: 3, variants: [
      [C('whisper woods. the spores glow, the hollow does not. shoot what is dark.')],
      [C('into the woods. the trunks are closer than they look.')],
    ],
  },
  'sector:ember': {
    prio: 3, variants: [
      [C('ember fields. the ground is hot and the geysers do not warn you.')],
      [C('ember fields. the lava lights them from below. use it.')],
    ],
  },
  'sector:lake': {
    prio: 3, variants: [
      [C('mirror lake. two of everything down there. only one of them shoots.')],
      [C('mirror lake. do not aim at the reflections. i did, once.')],
    ],
  },
  'sector:space': {
    prio: 3, variants: [
      [C('that was the last beacon. the rest of the dark is above the sky.'), C('the hollow crown. their ship. going up.')],
      [C('above the sky. no ground to hit, plenty of everything else.')],
    ],
  },
  'sector:echo': {
    prio: 3, variants: [
      [H('NIGHT · RETURNS · NIGHT ALWAYS RETURNS'), C('the coast is going dark again. {loop}. same route, faster guns.')],
      [C('{loop}. they rebuilt everything we broke.'), C('fine. we have the practice.')],
    ],
  },
  'sector:echo:next': {
    prio: 3, variants: [
      [C('{name}, again. they turned everything up.')],
      [C('{name}. i remember this part. it remembers us.')],
      [C('{name}. faster this time. so are we.')],
    ],
  },

  // --- enemies, first sighting (meetCue)
  'meet:drone': { prio: 2, once: 'session', variants: [[C('gnats. small, in formation, one shot each.')]] },
  'meet:kamikaze': { prio: 2, once: 'session', variants: [[C('spike. when it blinks, it has picked you. roll or move.')]] },
  'meet:weaver': { prio: 2, once: 'session', variants: [[C('manta. it swings wide and leaves mines in its wake.')]] },
  'meet:sniper': { prio: 2, once: 'session', variants: [[C('lancer. the pink line is its aim. half a second, then it fires.')]] },
  'meet:dasher': { prio: 2, once: 'session', variants: [[C('hornet, behind you. it overtakes, then turns. let it pass first.')]] },
  'meet:bulwark': { prio: 2, once: 'session', variants: [[C('bulwark. the shield eats lasers. hit it while it fires, or charge a shot.')]] },
  'meet:splitter': { prio: 2, once: 'session', variants: [[C('pod. crack it and two mites fall out.')]] },
  'meet:mite': { prio: 2, once: 'session', variants: [[C('mites. tiny, fast, diving. anything kills them.')]] },
  'meet:carrier': { prio: 2, once: 'session', variants: [[C('carrier. it launches gnats until it stops. hit the glowing parts.')]] },
  'meet:turret': { prio: 2, once: 'session', variants: [[C('ground guns. they only fire up. keep moving across them.')]] },
  'meet:missile': { prio: 2, once: 'session', variants: [[C('missile on us. it turns slower than we do. or shoot it.')]] },
  'warn:behind': {
    prio: 2, cooldown: 25_000, variants: [
      [C('behind you.')],
      [C('six o\'clock. coming through.')],
      [C('hornet on our tail.')],
    ],
  },

  // --- capsules, first pickup (pickCue)
  'pick:laser': { prio: 2, once: 'session', variants: [[C('l capsule. the guns step up: twin, twin plus, hyper. a hit takes one back.')]] },
  'pick:bomb': { prio: 2, once: 'session', variants: [[C('nova bomb. {bomb} throws it. anything small in the blast is gone.')]] },
  'pick:shield': { prio: 2, once: 'session', variants: [[C('shield shell. it takes the next few hits. not forever.')]] },
  'pick:wing': { prio: 2, once: 'session', variants: [[C('w capsule. that one was for me. full repair, and i fire double for a bit.')]] },
  'pick:overdrive': { prio: 2, once: 'session', variants: [[C('overdrive. faster fire, and the beams go straight through.')]] },
  'pick:gold': { prio: 2, once: 'session', variants: [[C('gold ring. they sit off the easy line on purpose. three in a sector pays.')]] },
  'gold:all': {
    prio: 2, cooldown: 30_000, variants: [
      [C('all gold. that is a bomb, on the house.')],
      [C('three for three. i am putting that in the report.')],
    ],
  },
  'laser:hyper': {
    prio: 1, once: 'run', variants: [
      [C('hyper. try not to get hit, i like this setting.')],
      [C('hyper laser. keep it.')],
    ],
  },

  // --- nudges (createNudges)
  'teach:bomb': { prio: 2, once: 'session', variants: [[C('you are carrying bombs. {bomb}. they refill.')]] },
  'teach:charge': { prio: 2, once: 'session', variants: [[C('try {charge}. it locks on, and it cracks shields.')]] },

  // --- hull, shield, wing
  'hull:low': {
    prio: 3, once: 'run', variants: [
      [C('hull under a third, {cs}. rings patch it.')],
      [C('you are leaking. any ring will do.')],
    ],
  },
  'shield:down': {
    prio: 1, cooldown: 20_000, variants: [
      [C('shield is gone.')],
      [C('shell popped. back to hull.')],
    ],
  },
  'wing:down': {
    prio: 2, cooldown: 20_000, variants: [
      [C('i am out. back in a moment. do not do anything interesting.')],
      [C('lost the gold one. rebuilding. keep them off you.')],
      [C('down. my guns were the good ones, sorry.')],
    ],
  },
  'wing:back': {
    prio: 1, cooldown: 20_000, variants: [
      [C('back on your right.')],
      [C('gold one again. what did i miss.')],
      [C('reformed. where were we.')],
    ],
  },

  // --- mid-sector set pieces
  'set:rings': {
    prio: 2, cooldown: 60_000, variants: [
      [C('ring gate ahead. thread them in a line.')],
      [C('rings. through them, not near them.')],
    ],
  },
  'set:turrets': {
    prio: 2, cooldown: 60_000, variants: [
      [C('gun line on the ground. keep sliding, they lead slowly.')],
      [C('turrets below. they only look up.')],
    ],
  },
  'set:carrier': {
    prio: 2, cooldown: 60_000, variants: [
      [H('CARRIER · DEPLOYING · SWARM'), C('kill the ship and the gnats stop.')],
      [C('another carrier. go for the glow.')],
    ],
  },
  'set:ambush': {
    prio: 2, cooldown: 60_000, variants: [
      [C('contacts behind us. they waited.')],
      [C('ambush from the rear. slide aside, let them overshoot.')],
    ],
  },

  // --- bosses
  'boss:warning': {
    prio: 3, variants: [
      [G('hangar. heavy return on your scope. big one.')],
      [C('something large ahead. very large.')],
      [C('warning lights. i assume they mean it.')],
    ],
  },
  'boss:intro:pincer': {
    prio: 3, variants: [
      [H('THE TIDE · TAKES · ALL LIGHT'), C('the pincer. dodge the claws. shoot the mouth when it roars.')],
      [H('SMALL LIGHT · COME CLOSER'), C('the crab again. the mouth, when it roars.')],
    ],
  },
  'boss:intro:moth': {
    prio: 3, variants: [
      [H('WE DRINK · THE GLOW'), C('the moth. shoot the wing panels off, then the core.')],
      [H('SPORES · SETTLE · SLEEP'), C('moth. the wingbeats push us sideways. lean into them.')],
    ],
  },
  'boss:intro:furnace': {
    prio: 3, variants: [
      [H('WE WALK · YOU BURN'), C('the furnace. hop the shockwaves. break a knee and the belly opens.')],
      [H('HEAT · WITHOUT · LIGHT'), C('three legs. go for the knees.')],
    ],
  },
  'boss:intro:twins': {
    prio: 3, variants: [
      [H('WE ARE ONE · WE ARE TWO'), C('the twins. only the one with the lit core can be hurt. follow the light.')],
      [H('LOOK · AT · YOURSELF'), C('twins. they swap on a beat. count it.')],
    ],
  },
  'boss:intro:crown': {
    prio: 3, variants: [
      [H('THE CROWN · SEES · ALL LIGHT'), H('WE WILL · CLOSE · THE SKY'), C('that is their ship. the gun ring first, then the eye.')],
      [H('YOU AGAIN · SMALL LIGHT'), C('the crown. guns, eye, then it runs. do not let it.')],
    ],
  },
  'boss:phase:pincer:2': {
    prio: 3, variants: [
      [C('half gone. the claws come faster now. watch the tell.')],
      [C('it is angry. it roars more, too. more openings.')],
    ],
  },
  'boss:phase:moth:2': {
    prio: 3, variants: [
      [C('wings are off. the core is open.')],
      [C('no more panels. it drops spores when it is scared. it is scared.')],
    ],
  },
  'boss:phase:furnace:2': {
    prio: 3, variants: [
      [C('knee is gone. belly is open, hit it.')],
      [C('it is limping. the belly, under it.')],
    ],
  },
  'boss:phase:twins:2': {
    prio: 3, variants: [
      [H('HALF · OF · US'), C('one twin down. the other one is faster alone.')],
      [C('one left. no more swapping. just hit it.')],
    ],
  },
  'boss:phase:crown:2': {
    prio: 3, variants: [
      [H('SEE · US'), C('the eye is open. everything on it.')],
      [C('eye open. that is the only soft part.')],
    ],
  },
  'boss:phase:crown:3': {
    prio: 3, variants: [
      [C('it is running. after it, through the debris.')],
      [H('RETREAT · REGROUP · RETURN'), C('it is leaving. we are not letting it.')],
    ],
  },
  'boss:down:pincer': {
    prio: 3, variants: [
      [H('THE TIDE · GOES · OUT'), C('the pincer is sinking. nice flying, {cs}.')],
      [C('crab down. the water can keep it.')],
    ],
  },
  'boss:down:moth': {
    prio: 3, variants: [
      [H('DARK · FALLING'), C('moth down. it went toward the light in the end.')],
      [C('moth down. no more spores.')],
    ],
  },
  'boss:down:furnace': {
    prio: 3, variants: [
      [H('COLD · NOW'), C('furnace down. it cools fast for something that loud.')],
      [C('the walker fell over. it is staying down.')],
    ],
  },
  'boss:down:twins': {
    prio: 3, variants: [
      [H('WE ARE · NONE'), C('both twins down. the lake has one reflection again.')],
      [C('twins down. both of them. i checked twice.')],
    ],
  },
  'boss:down:crown': {
    prio: 3, variants: [
      [H('THE CROWN · FALLS · THE NIGHT · STAYS'), C('the crown is down.')],
      [H('WE · ARE · MANY'), C('and that one is not.')],
    ],
  },
  clear: {
    prio: 3, variants: [
      [G('hangar. {name} beacon is lit again.')],
      [G('{name} is clear. we see your lights from here.')],
      [G('beacon back on. good work, nightlight.')],
      [G('hangar. lights on in {name}. next heading sent.')],
    ],
  },
  ending: {
    prio: 3, once: 'run', variants: [
      [
        C('every beacon on the coast is lit.'),
        G('hangar to nightlight. we can see the whole coast from here.'),
        C('they will come back. so will we. keep flying, {cs}.'),
      ],
      [
        C('the lights are on from the pier to the mast.'),
        G('hangar. town is lit. you can see it from up there.'),
        C('something is still moving out there. we keep going.'),
      ],
    ],
  },

  // --- the run
  best: {
    prio: 2, once: 'run', variants: [
      [C('further than you have ever flown. score noted.')],
      [C('new best. i will tell the hangar. they will pretend to be calm.')],
    ],
  },
  death: {
    prio: 3, variants: [
      [C('you are down. i will bring the gold one home.')],
      [C('ship lost, {cs}. the score stands.')],
      [C('that is the run. the lights you lit stay lit.')],
    ],
  },
  taunt: {
    prio: 1, cooldown: 45_000, variants: [
      [H('YOUR LIGHT · IS · SMALL')],
      [H('EVERY BEACON · GOES OUT')],
      [H('THE TOWN · IS NEXT')],
      [H('DIM · DIMMER · GONE')],
    ],
  },
  chatter: {
    prio: 1, cooldown: 70_000, variants: [
      [C('the town kept its lights on all night. for us.')],
      [C('if you see a gold ring, i saw it first.')],
      [C('quiet stretch. i do not trust it.')],
    ],
  },
}

// ---------------------------------------------------------------- director

export interface Spoken extends Line {
  key: string
  prio: number
  /** Monotonic id so the view can tell two identical lines apart. */
  id: number
  /** Game-clock ms. */
  start: number
  /** When typing finishes. */
  typed: number
  end: number
}

export interface IntercomLine {
  id: number
  who: Speaker
  text: string
  /** Characters typed so far. */
  shown: number
}

/** Typing speed and reading time, game-clock ms (Galaga's numbers). */
export const TYPE_MS_PER_CHAR = 26
export const HOLD_MS = 1500
export const HOLD_MS_PER_CHAR = 32
export const GAP_MS = 260
/** Ambient cues also wait this long after any line. */
export const AMBIENT_GAP_MS = 9000
/** Teaching lines older than this in the queue are dropped as stale. */
export const STALE_MS = 8000
const QUEUE_MAX = 5

export function lineDuration(text: string): { type: number; total: number } {
  const type = text.length * TYPE_MS_PER_CHAR
  return { type, total: type + HOLD_MS + text.length * HOLD_MS_PER_CHAR }
}

/** Characters of `line` visible at `now` (typewriter). */
export function visibleChars(line: Spoken, now: number): number {
  if (now >= line.typed) return line.text.length
  return Math.max(0, Math.floor((now - line.start) / TYPE_MS_PER_CHAR))
}

/** Remembers once-per-session cues across remounts within a page load. */
export const SESSION_SEEN = new Set<string>()

interface Pending { line: Line; key: string; prio: number; queuedAt: number }

export function createDirector(opts: { rng?: () => number; seen?: Set<string>; reduced?: boolean } = {}) {
  const rng = opts.rng ?? Math.random
  const sessionSeen = opts.seen ?? SESSION_SEEN
  const runSeen = new Set<string>()
  const lastPlayed = new Map<string, number>()
  const lastVariant = new Map<string, number>()
  let reduced = !!opts.reduced
  let now = 0
  let queue: Pending[] = []
  let current: Spoken | null = null
  let lastEnd = -Infinity
  let nextId = 1
  let vars: Vars = {}

  function setVars(v: Vars): void {
    vars = { ...vars, ...v }
  }

  function setReduced(on: boolean): void {
    reduced = on
  }

  /** Ask for a cue. Returns true when it was queued. */
  function cue(key: string, extra: Vars = {}): boolean {
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
    const n = def.variants.length
    let vi = Math.floor(rng() * n) % n
    if (n > 1 && vi === lastVariant.get(key)) vi = (vi + 1) % n
    lastVariant.set(key, vi)
    // Once-cues are marked seen when they start playing (tick), so a line
    // dropped from the queue can still be said the next time it is asked for.
    lastPlayed.set(key, now)
    const v = { ...vars, ...extra }
    const lines = def.variants[vi]!.map(l => ({ who: l.who, text: fill(l.text, v) }))
    const entries = lines.map(line => ({ line, key, prio: def.prio, queuedAt: now }))
    if (def.prio === 3) {
      // Story beats cut ambient and teaching lines and jump the queue. A
      // teaching line cut mid-sentence is said again afterwards.
      const resume: Pending[] = []
      if (current && current.prio === 2 && now < current.typed) {
        resume.push({ line: { who: current.who, text: current.text }, key: current.key, prio: 2, queuedAt: now + 4000 })
      }
      queue = queue.filter(p => p.prio >= 3)
      if (current && current.prio < 3) current.end = Math.min(current.end, now + 120)
      queue.push(...entries, ...resume)
    } else {
      queue.push(...entries)
    }
    while (queue.length > QUEUE_MAX) {
      const i = queue.findIndex(p => p.prio < 3)
      queue.splice(i >= 0 ? i : 0, 1)
    }
    return true
  }

  function advance(): void {
    if (current && now >= current.end) {
      lastEnd = current.end
      current = null
    }
    if (!current && queue.length && now - lastEnd >= GAP_MS) {
      queue = queue.filter(p => p.prio >= 3 || now - p.queuedAt < STALE_MS)
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
  }

  /** Advance the game clock by `dt` seconds. */
  function tick(dt: number): void {
    if (dt > 0) now += dt * 1000
    advance()
  }

  function currentLine(): IntercomLine | null {
    advance()
    if (!current) return null
    return {
      id: current.id,
      who: current.who,
      text: current.text,
      shown: reduced ? current.text.length : visibleChars(current, now),
    }
  }

  /** New run: forget run-scoped cues and anything queued or on screen. */
  function reset(run?: number): void {
    runSeen.clear()
    queue = []
    current = null
    lastEnd = -Infinity
    if (run !== undefined) vars = { ...vars, run }
  }

  /** New run plus its opening lines: launch, then the briefing or a retry line. */
  function startRun(v: Vars = {}): void {
    reset()
    setVars(v)
    cue('launch')
    if (!cue('brief')) cue('retry')
  }

  /** Drop what is queued and cut the current line short (quit, death). */
  function hush(): void {
    queue = []
    if (current) {
      current.end = Math.min(current.end, now + 120)
      // Mark it typed so a following story beat does not resume it.
      current.typed = Math.min(current.typed, now)
    }
  }

  return {
    cue, tick, current: currentLine, reset, startRun, hush, setVars, setReduced,
    /** The full line on screen, with key and timings (tests, debug). */
    get spoken() { return current },
    get queued() { return queue.length },
    get now() { return now },
  }
}

export type Director = ReturnType<typeof createDirector>

// ---------------------------------------------------------------- nudges

export type Skill = 'bomb' | 'charge'

/** Flying seconds into a run before Claude suggests a skill never used. */
export const NUDGE_AFTER: Record<Skill, number> = { bomb: 40, charge: 65 }
/** Seconds between two asks while the director is busy. */
const NUDGE_RETRY = 15

/**
 * Suggests the bomb or the charge shot when the player has not used them.
 * `used()` is remembered for the page load (a player who has bombed once
 * knows the button). Per frame:
 *   const key = nudges.tick(dt, { flying: phase === 'travel', bombs })
 *   if (key) director.cue(key)
 * The director's once-per-session rule stops repeats after it has played.
 */
export function createNudges(after: Record<Skill, number> = NUDGE_AFTER) {
  const usedSkills = new Set<Skill>()
  let flown = 0
  let wait = 0

  function used(skill: Skill): void {
    usedSkills.add(skill)
  }

  function tick(dt: number, ctx: { flying: boolean; bombs?: number }): string | null {
    if (!ctx.flying) return null
    flown += dt
    if (wait > 0) {
      wait -= dt
      return null
    }
    for (const skill of ['bomb', 'charge'] as Skill[]) {
      if (usedSkills.has(skill) || flown < after[skill]) continue
      if (skill === 'bomb' && (ctx.bombs ?? 1) <= 0) continue
      wait = NUDGE_RETRY
      return `teach:${skill}`
    }
    return null
  }

  /** New run: the clock starts over; what was used stays used. */
  function reset(): void {
    flown = 0
    wait = 0
  }

  return { used, tick, reset }
}
