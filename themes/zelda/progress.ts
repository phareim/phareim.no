/**
 * Quest progress, readable from a live GameState or a stored save — the
 * pause screen's QUEST line and the Hangar's adventure row share it — and
 * the rule for merging this browser's save with the copy on the player's
 * profile. Pure: no DOM, no Vue.
 */
import type { Inventory, SaveData } from './types'

/** The quest as twelve steps; the index is how many are done. */
const STEPS: Array<{ short: string; hint: string }> = [
  { short: 'THE BLADE', hint: "OPEN THE CHEST BY THE KEEPER'S HUT." },
  { short: 'THE BOMB BAG', hint: 'SEARCH WHISPER WOODS, NORTH OF HOME, FOR SOMETHING THAT GOES BOOM.' },
  { short: 'THE WILDWOOD', hint: "CUT INTO THE WILDWOOD, WEST OF TOWN ALONG THE SHORE. SOMEONE HIDES IN THE BRAMBLES. MOSSA KNOWS WHAT SHE LIKES." },
  { short: 'THE HOOK', hint: 'THE LAB IS NORTH OF THE CAMP. LUNA MOVES THE BLOCK; THE POWER IS DOWNSTAIRS; THE LLAMA HAS THE HOOK.' },
  { short: 'MISTRAL', hint: "THE BIG KEY IS IN THE LAB'S COOLANT VAULT. MISTRAL WAITS NORTH OF THE HUB. HOOK IT DOWN, THEN STRIKE." },
  { short: 'THE ARC BLADE', hint: 'SWING OVER THE RAVINE TO THE DEEP LAB. THE LIGHTS IN ROOM ELEVEN SPELL THE WORD THE VAULT LISTENS FOR.' },
  { short: 'GEMINI', hint: 'CUT THROUGH THE VINES TO THE STAIRS. GEMINI GUARDS THE GATE: BRING THE TWINS DOWN TOGETHER.' },
  { short: 'THE RUBBLE', hint: 'THE VINES IN THE GRAVES ARE DEAD. BLAST THE RUBBLE AT THE NORTH END OF THE HOLLOW GRAVES.' },
  { short: 'THE DISC', hint: "FIND THE SHRINE'S TREASURE. KEYS OPEN THE WAY WEST OF THE GREAT HALL." },
  { short: 'THE BIG KEY', hint: 'A KNIGHT GUARDS THE BIG KEY, NORTH OF THE CRYSTAL ROOM.' },
  { short: 'THE STATIC KING', hint: 'OPEN THE GREAT DOOR AND FACE THE STATIC KING.' },
  { short: 'THE SUN PRISM', hint: 'CLAIM THE SUN PRISM.' },
]

export const QUEST_STEPS = STEPS.length

/** Steps done, 0..QUEST_STEPS (12 only once the prism is taken). */
export function questStep(inv: Inventory, flags: readonly string[], mapId: string): number {
  const has = (f: string) => flags.includes(f)
  if (!inv.sword) return 0
  if (!inv.bombBag) return 1
  if (!has('luna')) return 2
  if (!inv.hook) return 3
  if (!has('mistral')) return 4
  if (!inv.arc) return 5
  if (!has('gateShut')) return 6
  // Being inside the shrine means the rubble is behind you.
  if (!flags.some(f => f.startsWith('bomb:overworld:')) && mapId !== 'shrine') return 7
  if (!inv.disc) return 8
  if (!inv.bigKey) return 9
  if (!has('boss')) return 10
  return inv.prism ? QUEST_STEPS : 11
}

export function questHint(step: number): string {
  if (step >= QUEST_STEPS) return 'THE SUN HAS SET. WANDER WHERE YOU LIKE, OR START OVER AT THE RED MACHINE IN PETTER\'S HOUSE.'
  return STEPS[Math.min(step, QUEST_STEPS - 1)]!.hint
}

export interface QuestSummary {
  step: number
  /** What the player is after now. */
  goal: string
  hearts: number
  elapsed: number
}

export function summarizeSave(save: SaveData): QuestSummary {
  const step = questStep(save.inv, save.flags, save.map)
  return {
    step,
    goal: STEPS[Math.min(step, QUEST_STEPS - 1)]!.short,
    hearts: Math.floor(save.maxHp / 2),
    elapsed: save.elapsed,
  }
}

/**
 * The same summary from a save as the API hands it back, for pages that
 * should not load the engine (the Hangar). Loose checks only: anything odd
 * gives null, and the game's own parseSave stays the judge on load.
 */
export function summarizeRaw(raw: unknown): QuestSummary | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const inv = r.inv as Inventory | undefined
  if (!inv || typeof inv !== 'object' || typeof r.map !== 'string') return null
  if (!Array.isArray(r.flags) || typeof r.maxHp !== 'number' || typeof r.elapsed !== 'number') return null
  return summarizeSave({ inv, flags: r.flags.filter((f): f is string => typeof f === 'string'), map: r.map, maxHp: r.maxHp, elapsed: r.elapsed } as SaveData)
}

export function formatPlayTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

// ---------------------------------------------------------------------------
// Merging with the profile copy
// ---------------------------------------------------------------------------

/** The profile's copy, as `/api/save` returns it (data unparsed). */
export interface RemoteSave {
  data: unknown | null
  savedAt: number
  best: number | null
  clears: number
}

export type SyncAction =
  /** The profile is newer: take its save (or its "no run", after a win or new game there). */
  | { kind: 'pull'; save: SaveData | null }
  /** This browser is newer or the profile has nothing: send ours. */
  | { kind: 'push'; save: SaveData | null; savedAt: number }
  | { kind: 'none' }

/**
 * Newest write wins. `localAt` is this browser's last write — the save's
 * own `savedAt`, or the moment it was cleared (new game, win). Saves from
 * before profile sync have no `savedAt` and count as the oldest possible.
 * `remoteData` is the profile's save already run through `parseSave`.
 */
export function reconcile(
  local: SaveData | null,
  localAt: number,
  remote: RemoteSave | null,
  remoteData: SaveData | null,
): SyncAction {
  if (!remote) return local || localAt > 0 ? { kind: 'push', save: local, savedAt: localAt } : { kind: 'none' }
  if (remote.savedAt > localAt) {
    // A profile copy this build cannot read never replaces a readable local save.
    if (remote.data !== null && !remoteData) return local ? { kind: 'push', save: local, savedAt: localAt } : { kind: 'none' }
    return { kind: 'pull', save: remoteData }
  }
  if (localAt > remote.savedAt) return { kind: 'push', save: local, savedAt: localAt }
  return { kind: 'none' }
}
