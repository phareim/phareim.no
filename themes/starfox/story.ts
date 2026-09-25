/**
 * Star Fox story — OPERATION NIGHTLIGHT (2026-09-25). Sectors, the cast,
 * the intercom script and the director that paces it. Pure: no Vue/DOM/
 * three, so tests/starfox-story.test.mjs runs it in plain node.
 *
 * The premise: the Hollow, an armada of dark machines that eat light, came
 * in over the sea and is putting out the coast's neon one beacon at a time.
 * The player flies out of the town's hangar with Claude in the second seat
 * and three wingmen, the Hall of Fame's animal pilots. Five named sectors
 * end at the Hollow's mothership, THE CROWN; after that the run goes on as
 * ECHO I, ECHO II, … over the same five.
 *
 * The cast (speaker ids). Every person writes lowercase in the source (the
 * pixel font shows capitals); only the Hollow is a machine.
 *   claude  co-pilot in the player's second seat: teaching, weak points,
 *           dry remarks. Drawn gold-spark portrait.
 *   heron   MAGENTA HERON, wing: the ace. Cocky, counts kills, hunts ahead.
 *   bison   ATOMIC BISON, wing: the veteran. Calm, few words, covers you.
 *   dingo   MIXTAPE DINGO, wing: the youngest. Chatty, music, trouble.
 *   walrus  BYTE WALRUS, reserve wing (when the player is one of the three).
 *   zebra   NOVA ZEBRA, second reserve.
 *   wombat  GLITCH WOMBAT, the mechanic in town who runs launch control.
 *   cobra   MEGA COBRA, former squadmate, flies for the Hollow now.
 *   hollow  the armada. Machine voice, UPPERCASE, `·`-separated fragments.
 *
 * The squad: squadFor(callsign) gives the three wingmen in slot order
 * (wing 2, 3, 4); a wingman who shares the player's animal sits the run out
 * for walrus, then zebra. Lines spoken by a wingman who is not flying are
 * never said: the director only picks variants whose wing speakers are all
 * in the squad, and refuses a cue with none (dingo's trouble, heron's
 * grudge). Per-wingman cues go by id: wingCue('down', squad[slot]).
 *
 * ---------------------------------------------------------------- API
 *
 *   const squad = squadFor(callsignFrom(name))
 *   const director = createDirector({ reduced })       // rng, seen: tests
 *   director.startRun({ cs, run, squad, ...controlVars(touch) })
 *       new run: forgets run-scoped cues, then queues `launch` (wombat) and,
 *       on the first run of the page load, `brief` + one `hello:<id>` per
 *       wingman; later runs get `retry`.
 *   director.cue(key, vars?) → boolean   ask for a line; false = refused
 *   director.wing(event, slot, vars?)    cue(wingCue(event, squad[slot]))
 *   director.tick(dt)                     advance the game clock, dt in
 *                                         SECONDS; skip while paused
 *   director.current() → { id, who, name, text, shown } | null
 *       the line on screen; `name` is the intercom's name line ('HERON ·
 *       WING 2'); `shown` = characters typed (all with reduced motion).
 *   director.hush()                       drop the queue, cut the line short
 *   director.reset(run?), setVars(), setReduced(), setSquad(), squad
 *
 * Text for the Landing: rosterFor(callsign) (title screen: names and roles),
 * survivorsText(squad, alive) (game over: who is still flying).
 *
 * The director (Galaga's model): priority 3 is story and interrupts; 2 is
 * teaching; 1 is ambient and lands only after 9 s of silence. The opening
 * chatter (briefing, roll call, retry) is `soft`: lines about what is
 * happening now go ahead of it, so the sector line and first sightings are
 * never more than a line late. Cues can be
 * once per page load (SESSION_SEEN, survives remounts), once per run, or on
 * a cooldown. A teaching line cut mid-sentence by a story beat is said
 * again afterwards. Variants never repeat back to back.
 */
import type { BiomeId, BossId } from './ids.ts'

export type { BiomeId, BossId }

// Small helpers, the same rules as Galaga's story.ts (kept local so the
// module loads in plain node).

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

/** How the controls read in the lines, per input mode. */
export function controlVars(touch: boolean): Vars {
  return touch
    ? { start: 'tap', bomb: 'the bomb button', charge: 'holding a second finger', roll: 'double-tap' }
    : { start: 'press enter', bomb: 'b or x', charge: 'holding space', roll: 'shift' }
}

// ---------------------------------------------------------------- the cast

export type WingId = 'heron' | 'bison' | 'dingo' | 'walrus' | 'zebra'
export type PilotId = WingId | 'wombat' | 'cobra'
export type Speaker = 'claude' | 'hollow' | PilotId

export interface Pilot {
  id: PilotId
  /** Hall of Fame name: MAGENTA HERON. */
  name: string
  /** For the HUD and the name line: HERON. */
  short: string
  /** One line for the title screen roster. */
  role: string
  /** Ship trim and intercom edge. */
  trim: string
  /** 40×40 palette-snapped painting, public path. */
  portrait: string
  kind: 'wing' | 'reserve' | 'hangar' | 'rival'
}

const pilot = (id: PilotId, name: string, role: string, trim: string, kind: Pilot['kind']): Pilot => ({
  id, name, short: name.split(' ').pop()!, role, trim, portrait: `/starfox/pilots/${id}.png`, kind,
})

export const PILOTS: Record<PilotId, Pilot> = {
  heron: pilot('heron', 'MAGENTA HERON', 'THE ACE · HUNTS AHEAD, COUNTS KILLS', '#ff2fa0', 'wing'),
  bison: pilot('bison', 'ATOMIC BISON', 'THE VETERAN · FLIES YOUR SIX', '#ffd23f', 'wing'),
  dingo: pilot('dingo', 'MIXTAPE DINGO', 'THE ROOKIE · BRINGS THE MUSIC', '#2ff3ff', 'wing'),
  walrus: pilot('walrus', 'BYTE WALRUS', 'RESERVE · READ THE MANUAL', '#ff8a3d', 'reserve'),
  zebra: pilot('zebra', 'NOVA ZEBRA', 'RESERVE · BRIGHT AND QUICK', '#b6ff4a', 'reserve'),
  wombat: pilot('wombat', 'GLITCH WOMBAT', 'HANGAR · LAUNCH CONTROL', '#3fd8b0', 'hangar'),
  cobra: pilot('cobra', 'MEGA COBRA', 'DEFECTOR · FLIES FOR THE HOLLOW', '#ff3b5c', 'rival'),
}

export const WINGS: readonly WingId[] = ['heron', 'bison', 'dingo']
export const RESERVES: readonly WingId[] = ['walrus', 'zebra']
const WING_SET = new Set<string>([...WINGS, ...RESERVES])

export function isWing(who: string): who is WingId {
  return WING_SET.has(who)
}

/** The three wingmen in slot order; one who shares the player's animal sits out for a reserve. */
export function squadFor(callsign: string): [WingId, WingId, WingId] {
  const reserves = RESERVES.filter(r => r !== callsign)
  return WINGS.map(w => (w === callsign ? reserves.shift()! : w)) as [WingId, WingId, WingId]
}

/** Title screen roster: the squad in slot order, wing 2 to 4. */
export function rosterFor(callsign: string): (Pilot & { slot: string })[] {
  return squadFor(callsign).map((id, i) => ({ ...PILOTS[id], slot: `WING ${i + 2}` }))
}

/** Game over: who is still flying (`alive` in slot order). */
export function survivorsText(squad: readonly WingId[], alive: readonly boolean[]): string {
  const up = squad.filter((_, i) => alive[i]).map(id => PILOTS[id].short)
  if (!up.length) return 'NOBODY LEFT FLYING'
  if (up.length === 1) return `${up[0]} STILL FLYING`
  return `${up.slice(0, -1).join(', ')} AND ${up[up.length - 1]} STILL FLYING`
}

/** The intercom's name line for a speaker. */
export function nameLine(who: Speaker, squad: readonly WingId[] = []): string {
  if (who === 'claude') return 'CLAUDE · CO-PILOT'
  if (who === 'hollow') return 'THE HOLLOW · INTERCEPT'
  if (who === 'wombat') return 'WOMBAT · HANGAR'
  if (who === 'cobra') return 'COBRA · HOLLOW'
  const slot = squad.indexOf(who)
  return slot >= 0 ? `${PILOTS[who].short} · WING ${slot + 2}` : `${PILOTS[who].short} · WING`
}

/** Per-wingman cue key: down, back, boss, last; kill (heron), cover (bison). */
export function wingCue(event: string, id: WingId): string {
  return `wing:${event}:${id}`
}

/** On the player's death: Claude's last word, then one wingman still up (or nobody). */
export function deathCues(squad: readonly WingId[], alive: readonly boolean[]): string[] {
  const up = squad.find((_, i) => alive[i])
  return up ? ['death', wingCue('last', up)] : ['death', 'death:alone']
}

// ---------------------------------------------------------------- script

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
  /** The opening chatter (briefing, roll call, retry): cues about what is
   * happening now (the sector line, first sightings, pickups) go ahead of
   * it in the queue instead of waiting behind it. */
  soft?: boolean
  /** Variants; each is a short exchange of one or more lines. */
  variants: Line[][]
}

/** Longest line per voice, in characters (three lines of the desktop panel). */
export const MAX_CHARS: Record<Speaker, number> = {
  claude: 80, hollow: 44, wombat: 72, cobra: 72,
  heron: 72, bison: 72, dingo: 72, walrus: 72, zebra: 72,
}

const say = (who: Speaker) => (text: string): Line => ({ who, text })
const C = say('claude')
const H = say('hollow')
const W = say('wombat')
const K = say('cobra')
const HE = say('heron')
const BI = say('bison')
const DI = say('dingo')
const WA = say('walrus')
const ZE = say('zebra')

export const CUES: Record<string, CueDef> = {
  idle: { prio: 2, once: 'session', variants: [[C('claude, second seat. {start} and we go.')]] },

  // --- run start (startRun). Soft, so it usually lands a few seconds into
  // the flight, after the sector line: Wombat talks to a ship already out.
  launch: {
    prio: 3, soft: true, variants: [
      [W('wombat to nightlight. you are off the pad. bring it back in one piece.')],
      [W('the neon dreams sign is lit behind you. go get the rest.')],
      [W('wombat here, {cs}. i just polished that canopy.')],
      [W('wombat here. new struts on that ship. be kind to them.')],
    ],
  },
  brief: {
    prio: 3, once: 'session', soft: true, variants: [[
      C('{cs}, claude here. second seat, same as always.'),
      C('the hollow eats light, one beacon at a time. we turn the coast back on.'),
    ]],
  },
  // The roll call: one short line each, after the briefing.
  'hello:heron': { prio: 3, once: 'session', soft: true, variants: [[HE('heron. keep up, {cs}.')]] },
  'hello:bison': { prio: 3, once: 'session', soft: true, variants: [[BI('bison. on your six.')]] },
  'hello:dingo': { prio: 3, once: 'session', soft: true, variants: [[DI('dingo. mixtape is loaded.')]] },
  'hello:walrus': { prio: 3, once: 'session', soft: true, variants: [[WA('walrus, filling in.')]] },
  'hello:zebra': { prio: 3, once: 'session', soft: true, variants: [[ZE('zebra, from the reserve.')]] },
  retry: {
    prio: 3, soft: true, variants: [
      [C('new ship, same plan. lights on, dark things off.')],
      [C('round {run}. they have learned nothing. we have.')],
      [DI('you are back. i restarted the mixtape.')],
      [HE('back already. i am three kills up on you.')],
      [BI('back in formation. slower this time.')],
    ],
  },

  // --- sector openings (sectorCue)
  'sector:coast': {
    prio: 3, variants: [
      [C('coral coast. every beacon is out from the pier to the stacks.')],
      [C('the coast again. the sea stacks do not move for anyone.')],
      [DI('coast track is on. it has seagulls in it.'), C('it does not.')],
    ],
  },
  'sector:woods': {
    prio: 3, variants: [
      [C('whisper woods. the spores glow, the hollow does not. shoot what is dark.')],
      [C('into the woods. the trunks are closer than they look.')],
      [HE('trees and a low ceiling. my favourite.')],
    ],
  },
  'sector:ember': {
    prio: 3, variants: [
      [C('ember fields. the ground is hot and the geysers do not warn you.')],
      [C('ember fields. the lava lights them from below. use it.')],
      [BI('ember fields. never fly over the same vent twice.')],
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
      [BI('above the sky. nobody up here comes back for you. stay close.')],
    ],
  },
  'sector:echo': {
    prio: 3, variants: [
      [H('NIGHT · RETURNS · NIGHT ALWAYS RETURNS'), C('the coast is going dark again. {loop}. same route, faster guns.')],
      [C('{loop}. they rebuilt everything we broke.'), HE('good. i was running out of things to shoot.')],
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
  'meet:dasher': { prio: 2, once: 'session', variants: [[C('hornet, behind us. it overtakes, then turns. let it pass first.')]] },
  'meet:bulwark': { prio: 2, once: 'session', variants: [[C('bulwark. the shield eats lasers. hit it while it fires, or charge a shot.')]] },
  'meet:splitter': { prio: 2, once: 'session', variants: [[C('pod. crack it and two mites fall out.')]] },
  'meet:mite': { prio: 2, once: 'session', variants: [[C('mites. tiny, fast, diving. anything kills them.')]] },
  'meet:carrier': { prio: 2, once: 'session', variants: [[C('carrier. it launches gnats until it stops. hit the glowing parts.')]] },
  'meet:turret': {
    prio: 2, once: 'session', variants: [
      [BI('ground guns. they only fire up. keep sliding across them.')],
      [C('ground guns. they only fire up. keep moving across them.')],
    ],
  },
  'meet:missile': { prio: 2, once: 'session', variants: [[C('missile on us. it turns slower than we do. or shoot it.')]] },
  'warn:behind': {
    prio: 2, cooldown: 25_000, variants: [
      [C('behind us.')],
      [BI('six o\'clock, {cs}.')],
      [HE('one on your tail. i will get it. probably.')],
    ],
  },

  // --- capsules, first pickup (pickCue)
  'pick:laser': { prio: 2, once: 'session', variants: [[C('l capsule. the guns step up: twin, twin plus, hyper. a hit takes one back.')]] },
  'pick:bomb': { prio: 2, once: 'session', variants: [[C('nova bomb. {bomb} throws it. anything small in the blast is gone.')]] },
  'pick:shield': {
    prio: 2, once: 'session', variants: [
      [BI('shield shell. it takes a few hits for you. do not get greedy.')],
      [C('shield shell. it takes the next few hits. not forever.')],
    ],
  },
  'pick:wing': { prio: 2, once: 'session', variants: [[C('w capsule. it calls the whole squad back up, patched.')]] },
  'pick:overdrive': { prio: 2, once: 'session', variants: [[C('overdrive. faster fire, and the beams go straight through.')]] },
  'pick:gold': { prio: 2, once: 'session', variants: [[C('gold ring. they sit off the easy line on purpose. three in a sector pays.')]] },
  'wing:rally': {
    prio: 2, cooldown: 20_000, variants: [
      [HE('back. did anyone count my kills while i was gone.')],
      [DI('i am back. i am fine. that was fine.')],
      [BI('all three up. let us keep it that way.')],
      [C('whole squad back up.')],
    ],
  },
  'gold:all': {
    prio: 2, cooldown: 30_000, variants: [
      [C('all gold. that is a bomb, on the house.')],
      [C('three for three. i am putting that in the report.')],
      [HE('all three gold. fine. that was good.')],
    ],
  },
  'laser:hyper': {
    prio: 1, once: 'run', variants: [
      [C('hyper. try not to get hit, i like this setting.')],
      [HE('hyper. finally a gun worth flying next to.')],
    ],
  },

  // --- teaching (createNudges; teach:roll on the first hit taken)
  'teach:bomb': { prio: 2, once: 'session', variants: [[C('you are carrying bombs. {bomb}. they refill.')]] },
  'teach:charge': { prio: 2, once: 'session', variants: [[C('try {charge}. it locks on, and it cracks shields.')]] },
  'teach:roll': {
    prio: 2, once: 'session', variants: [
      [BI('roll into their fire, {cs}. {roll}. it has saved me more than once.')],
      [C('{roll} to roll. bolts slide off while you spin.')],
    ],
  },

  // --- hull, shield
  'hull:low': {
    prio: 3, once: 'run', variants: [
      [C('hull under a third, {cs}. rings patch it.')],
      [C('we are leaking. any ring will do.')],
      [BI('you are smoking, {cs}. find a ring. i have your back.')],
    ],
  },
  'shield:down': {
    prio: 1, cooldown: 20_000, variants: [
      [C('shield is gone.')],
      [C('shell popped. back to hull.')],
    ],
  },

  // --- the wingmen, by id (wingCue)
  'wing:down:heron': { prio: 2, cooldown: 20_000, variants: [[HE('i am hit. nobody touch my kills.')], [HE('out. that was not my fault.')]] },
  'wing:down:bison': { prio: 2, cooldown: 20_000, variants: [[BI('bison down. i will be back. stay on course.')], [BI('lost my ship. keep moving, {cs}.')]] },
  'wing:down:dingo': { prio: 2, cooldown: 20_000, variants: [[DI('i am out. it is fine. i am fine.')], [DI('ejected. the tape is okay.')]] },
  'wing:down:walrus': { prio: 2, cooldown: 20_000, variants: [[WA('walrus down. the manual says that is bad.')], [WA('out. back soon.')]] },
  'wing:down:zebra': { prio: 2, cooldown: 20_000, variants: [[ZE('zebra out. that was a lot of light.')], [ZE('hit. back soon.')]] },
  'wing:back:heron': { prio: 1, cooldown: 20_000, variants: [[HE('back. what did i miss. nothing, i assume.')], [HE('heron up. let us go.')]] },
  'wing:back:bison': { prio: 1, cooldown: 20_000, variants: [[BI('back behind you.')], [BI('new ship. same place.')]] },
  'wing:back:dingo': { prio: 1, cooldown: 20_000, variants: [[DI('i am back. did you miss me. do not answer.')], [DI('dingo up. restarting the song.')]] },
  'wing:back:walrus': { prio: 1, cooldown: 20_000, variants: [[WA('walrus, back in the slot.')], [WA('returning. steady.')]] },
  'wing:back:zebra': { prio: 1, cooldown: 20_000, variants: [[ZE('back. still bright.')], [ZE('zebra up again.')]] },
  'wing:boss:heron': { prio: 2, cooldown: 60_000, variants: [[HE('that is a big target. dibs.')], [HE('the core is mine.')]] },
  'wing:boss:bison': { prio: 2, cooldown: 60_000, variants: [[BI('big ones are slow. use the time.')], [BI('stay out of its front. i will draw fire.')]] },
  'wing:boss:dingo': { prio: 2, cooldown: 60_000, variants: [[DI('that is huge. that is so huge.')], [DI('boss music. finally.')]] },
  'wing:boss:walrus': { prio: 2, cooldown: 60_000, variants: [[WA('large contact. the manual says shoot it.')], [WA('big one. slow and steady.')]] },
  'wing:boss:zebra': { prio: 2, cooldown: 60_000, variants: [[ZE('oh, that is big. okay.')], [ZE('light it up.')]] },
  'wing:last:heron': { prio: 3, variants: [[HE('i will finish it. go get a new ship.')], [HE('fine. more kills for me.')]] },
  'wing:last:bison': { prio: 3, variants: [[BI('i have it from here. go home, {cs}.')], [BI('clean ejection. i will cover the drop.')]] },
  'wing:last:dingo': { prio: 3, variants: [[DI('no no no. okay. i will hold the line. i think.')], [DI('pausing the mixtape until you are back.')]] },
  'wing:last:walrus': { prio: 3, variants: [[WA('understood. i will hold here.')], [WA('i have your sector. go.')]] },
  'wing:last:zebra': { prio: 3, variants: [[ZE('i will keep the lights on. go.')], [ZE('still up. still bright. see you soon.')]] },
  'wing:kill:heron': {
    prio: 1, cooldown: 40_000, variants: [
      [HE('splash one. that is mine.')],
      [HE('another one. keep up, {cs}.')],
      [HE('are you counting. i am counting.')],
    ],
  },
  'wing:cover:bison': {
    prio: 1, cooldown: 40_000, variants: [
      [BI('i am on your six. breathe.')],
      [BI('covering you. take your time.')],
    ],
  },

  // --- dingo in trouble (a set piece: shoot the gnats on his tail)
  'dingo:trouble': {
    prio: 3, cooldown: 60_000, variants: [
      [DI('uh. three gnats on me. they will not let go.'), DI('help. please. the mixtape is still playing.')],
      [DI('dingo here. i have company. a lot of it.'), BI('break right, dingo. {cs}, clear his tail.')],
      [DI('they are all over me. is this a lot. this feels like a lot.'), HE('again, dingo.')],
    ],
  },
  'dingo:saved': {
    prio: 2, cooldown: 30_000, variants: [
      [DI('thanks, {cs}. i owe you a track.')],
      [DI('clear. okay. heart rate normal. ish.'), HE('you are welcome.'), DI('heron, you did nothing.')],
    ],
  },
  'dingo:lost': {
    prio: 3, cooldown: 30_000, variants: [
      [DI('i am hit. going down. save the mixtape.'), BI('he will be back. eyes front, {cs}.')],
      [DI('ejecting. sorry, sorry.')],
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
      [BI('turrets below. they only look up.')],
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
      [BI('ambush from the rear. slide aside, let them overshoot.')],
    ],
  },

  // --- mega cobra: flyby (sector 2), dogfight (sector 3), duel (sector 5)
  'cobra:flyby': {
    prio: 3, once: 'run', variants: [
      [K('hello, heron. still flying second best.'), HE('cobra.'), C('mega cobra. he flew with this squad. then he flew for them.')],
      [K('the old squad, and a new pilot in my seat. cute.'), C('mega cobra. he flew with this squad. then he flew for them.')],
      [K('dingo. you still play that tape.'), DI('cobra. you went dark.'), C('mega cobra. he flew in this squad once. now he flies for them.')],
    ],
  },
  'cobra:arrive': {
    prio: 3, cooldown: 60_000, variants: [
      [K('let us see what the town taught you, {cs}.'), HE('he is mine.'), BI('he is everyone\'s. stay together.')],
      [K('bison. you look tired. retire.'), BI('i taught you better than this, cobra.')],
      [K('i always liked this part.'), C('the red ship is cobra. hurt it enough and he runs.')],
    ],
  },
  'cobra:hit': {
    prio: 2, cooldown: 8_000, variants: [
      [K('that scratched the paint.')],
      [K('lucky.')],
      [K('careful. i know how you roll.')],
    ],
  },
  'cobra:escape': {
    prio: 3, cooldown: 60_000, variants: [
      [K('another time. the crown is waiting.'), HE('coward.')],
      [K('you are not worth the fuel yet.'), DI('he used to be nice.')],
      [K('later, squad.'), BI('he is running. let him.')],
      [K('later, {cs}.'), C('he is gone. he will be back. they always are.')],
    ],
  },
  'cobra:duel': {
    prio: 3, cooldown: 60_000, variants: [
      [K('last dance, {cs}. the crown does not need to see this.'), HE('i have waited for this.'), C('cobra, between us and the crown. he goes first.')],
      [K('i taught dingo to roll. did he tell you.'), DI('you did. roll, {cs}.')],
      [K('you are good. i was better.'), C('cobra, then the crown. in that order.')],
    ],
  },
  'cobra:down': {
    prio: 3, cooldown: 60_000, variants: [
      [K('i should have stayed in the hangar.'), W('i kept your old ship, cobra. still polished.')],
      [K('tell dingo i am sorry.'), DI('he heard.')],
      [K('it was dark, where they took me.'), BI('rest, cobra.'), C('cobra is down. the crown is next.')],
      [K('not like this.'), C('cobra is down. that leaves their ship.')],
    ],
  },

  // --- bosses
  'boss:warning': {
    prio: 3, variants: [
      [W('wombat. big return on your scope. careful with my ship.')],
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
      [C('crab down. the water can keep it.'), HE('i am counting that one as mine.')],
      [C('crab down. the water can keep it.')],
    ],
  },
  'boss:down:moth': {
    prio: 3, variants: [
      [H('DARK · FALLING'), C('moth down. it went toward the light in the end.')],
      [C('moth down. no more spores.'), DI('that one is getting a song.')],
      [C('moth down. no more spores.')],
    ],
  },
  'boss:down:furnace': {
    prio: 3, variants: [
      [H('COLD · NOW'), C('furnace down. it cools fast for something that loud.')],
      [C('the walker fell over. it is staying down.'), BI('good. my ears hurt.')],
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
      [W('wombat. {name} beacon is lit again. i can see it from the bench.')],
      [W('{name} is clear. how is the ship. no, do not tell me.')],
      [W('beacon back on. the neon dreams sign flickered. happy, i think.')],
      [W('lights on in {name}. next heading sent. mind the paint.')],
    ],
  },
  ending: {
    prio: 3, once: 'run', variants: [
      [
        C('every beacon on the coast is lit.'),
        W('wombat here. the whole coast is lit. the sign too.'),
        BI('they will be back. so will we.'),
        C('keep flying, {cs}.'),
      ],
      [
        C('the lights are on from the pier to the mast.'),
        DI('can we play the victory track now.'),
        HE('no.'),
        W('come home when you like. i will keep the doors open.'),
      ],
      [
        C('that was the crown. the coast is lit.'),
        W('wombat. i can see you from here. keep going, {cs}.'),
      ],
    ],
  },

  // --- the run
  best: {
    prio: 2, once: 'run', variants: [
      [C('further than you have ever flown. score noted.')],
      [HE('new best. still not mine, but new.')],
      [DI('personal best. that goes on the mixtape.')],
    ],
  },
  death: {
    prio: 3, variants: [
      [C('hull breach. ejecting. i have the black box.')],
      [C('ship lost, {cs}. the score stands.')],
      [C('that is the run. the lights you lit stay lit.')],
    ],
  },
  'death:alone': {
    prio: 3, variants: [
      [C('nobody left up there. wombat is prepping the next ship.')],
      [W('wombat. all ships down. come home, i will fix them.')],
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
  // Banter: only variants whose speakers are all flying get picked.
  chatter: {
    prio: 1, cooldown: 60_000, variants: [
      [DI('okay, track four. this one has a key change.'), HE('dingo. the channel.'), DI('sorry.')],
      [HE('that is eleven for me. bison.'), BI('i was not counting.'), HE('nine, then.')],
      [BI('{cs}. you fly well. do not tell heron i said so.')],
      [DI('does anyone else miss cobra. a little.'), BI('eyes front, dingo.')],
      [DI('wombat, can you hear the mixtape down there.'), W('i can. please stop.')],
      [HE('{cs}, race you to the next beacon.')],
      [WA('walrus here. the manual did not mention this many mines.')],
      [ZE('is it always this pretty up here, or just tonight.'), BI('just tonight.')],
      [C('quiet stretch. i do not trust it.')],
      [C('the town kept its lights on all night. for us.')],
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
  /** The name line: 'HERON · WING 2', 'WOMBAT · HANGAR'. */
  name: string
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
export const STALE_MS = 6000
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

/** Can every wing speaker in this exchange fly with `squad`? */
export function variantFits(variant: readonly Line[], squad: readonly WingId[]): boolean {
  return variant.every(l => !isWing(l.who) || squad.includes(l.who))
}

/** Remembers once-per-session cues across remounts within a page load. */
export const SESSION_SEEN = new Set<string>()

interface Pending { line: Line; key: string; prio: number; queuedAt: number; soft: boolean }

export function createDirector(opts: { rng?: () => number; seen?: Set<string>; reduced?: boolean; squad?: readonly WingId[] } = {}) {
  const rng = opts.rng ?? Math.random
  const sessionSeen = opts.seen ?? SESSION_SEEN
  const runSeen = new Set<string>()
  const lastPlayed = new Map<string, number>()
  const lastVariant = new Map<string, number>()
  let reduced = !!opts.reduced
  let squad: WingId[] = [...(opts.squad ?? WINGS)]
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

  function setSquad(s: readonly WingId[]): void {
    squad = [...s]
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
    // Only exchanges whose wingmen are flying; never the same one twice running.
    const fits = def.variants.map((v, i) => (variantFits(v, squad) ? i : -1)).filter(i => i >= 0)
    if (!fits.length) return false
    let pick = Math.floor(rng() * fits.length) % fits.length
    if (fits.length > 1 && fits[pick] === lastVariant.get(key)) pick = (pick + 1) % fits.length
    const vi = fits[pick]!
    lastVariant.set(key, vi)
    // Once-cues are marked seen when they start playing (tick), so a line
    // dropped from the queue can still be said the next time it is asked for.
    lastPlayed.set(key, now)
    const v = { ...vars, ...extra }
    const lines = def.variants[vi]!.map(l => ({ who: l.who, text: fill(l.text, v) }))
    const soft = !!def.soft
    const entries = lines.map(line => ({ line, key, prio: def.prio, queuedAt: now, soft }))
    if (def.prio === 3) {
      // Story beats cut ambient and teaching lines and jump the queue. A
      // teaching line cut mid-sentence is said again afterwards.
      const resume: Pending[] = []
      if (current && current.prio === 2 && now < current.typed) {
        resume.push({ line: { who: current.who, text: current.text }, key: current.key, prio: 2, queuedAt: now + 4000, soft: false })
      }
      queue = queue.filter(p => p.prio >= 3)
      if (current && current.prio < 3) current.end = Math.min(current.end, now + 120)
      enqueue([...entries, ...resume], soft)
    } else {
      enqueue(entries, soft)
    }
    // Too much waiting: drop the oldest teaching/ambient lines (story stays).
    // The opening chatter waits at the back and does not count.
    while (queue.length - queue.filter(p => p.soft).length > QUEUE_MAX) {
      const i = queue.findIndex(p => p.prio < 3)
      if (i < 0) break
      queue.splice(i, 1)
    }
    return true
  }

  /** Append, or (a cue about the game right now) go ahead of the opening chatter. */
  function enqueue(entries: Pending[], soft: boolean): void {
    const at = soft ? -1 : queue.findIndex(p => p.soft)
    if (at < 0) queue.push(...entries)
    else queue.splice(at, 0, ...entries)
  }

  /** A per-wingman cue for the wingman in `slot` (0–2). */
  function wing(event: string, slot: number, extra: Vars = {}): boolean {
    const id = squad[slot]
    return id ? cue(wingCue(event, id), extra) : false
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
      name: nameLine(current.who, squad),
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

  /**
   * New run plus its opening: wombat's launch, then the briefing and the
   * squad's hellos (first run of the page load) or a retry line.
   */
  function startRun(v: Vars & { squad?: readonly WingId[] } = {}): void {
    const { squad: s, ...rest } = v
    reset()
    if (s) setSquad(s)
    setVars(rest as Vars)
    cue('launch')
    if (cue('brief')) for (const id of squad) cue(`hello:${id}`)
    else cue('retry')
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
    cue, wing, tick, current: currentLine, reset, startRun, hush, setVars, setReduced, setSquad,
    get squad(): readonly WingId[] { return squad },
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
