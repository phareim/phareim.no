/**
 * Star Fox cast and route — the part of story.ts the title screen and the
 * HUD need (Landing.vue, Intercom.vue): the five sectors and their ECHO
 * loops, the pilots and the squad rules, name lines. Split from story.ts
 * so the landing, which ships in the site's entry chunk, does not carry
 * the whole script; story.ts re-exports all of it. Pure, loads in node.
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
