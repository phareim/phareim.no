/**
 * Quest progress, readable from a live GameState or a stored save — the
 * pause screen's QUEST line and the Hangar's adventure row share it — and
 * the rule for merging this browser's save with the copy on the player's
 * profile. Pure: no DOM, no Vue.
 */
import type { Inventory, SaveData } from './types'

/**
 * The quest as twelve milestones, in the order the hints suggest. The Shrine
 * road is open from the start (2026-10-01), so the Static King (steps 7–10)
 * and the Gate in the Deep Lab (2–6) can be done in either order.
 */
const STEPS: Array<{ short: string; hint: string }> = [
  { short: 'THE BLADE', hint: "OPEN THE CHEST BY THE KEEPER'S HUT." },
  { short: 'THE BOMB BAG', hint: 'SEARCH WHISPER WOODS, NORTH OF HOME, FOR SOMETHING THAT GOES BOOM.' },
  { short: 'THE WILDWOOD', hint: "CUT INTO THE WILDWOOD, WEST OF TOWN ALONG THE SHORE. SOMEONE HIDES IN THE BRAMBLES. MOSSA KNOWS WHAT SHE LIKES. (OR GO FOR THE KING: THE SHRINE IS NORTH OF THE HOLLOW GRAVES.)" },
  { short: 'THE HOOK', hint: 'THE LAB IS NORTH OF THE CAMP. LUNA MOVES THE BLOCK; THE POWER IS DOWNSTAIRS; THE LLAMA HAS THE HOOK.' },
  { short: 'MISTRAL', hint: "THE BIG KEY IS IN THE LAB'S COOLANT VAULT. MISTRAL WAITS NORTH OF THE HUB." },
  { short: 'THE ARC BLADE', hint: 'CROSS THE RAVINE TO THE DEEP LAB. THE VAULT LISTENS FOR A WORD.' },
  { short: 'GEMINI', hint: 'FIND THE STAIRS UNDER THE VINES. GEMINI GUARDS THE GATE. SHUT IT.' },
  { short: 'THE RUBBLE', hint: 'BLAST THE RUBBLE AT THE NORTH END OF THE HOLLOW GRAVES. THE SHRINE IS BEHIND IT.' },
  { short: 'THE DISC', hint: "FIND THE SHRINE'S TREASURE. KEYS OPEN THE WAY WEST OF THE GREAT HALL." },
  { short: 'THE BIG KEY', hint: 'A KNIGHT GUARDS THE BIG KEY, NORTH OF THE CRYSTAL ROOM.' },
  { short: 'THE STATIC KING', hint: 'OPEN THE GREAT DOOR AND FACE THE STATIC KING.' },
  { short: 'THE SUN PRISM', hint: 'CLAIM THE SUN PRISM.' },
]

export const QUEST_STEPS = STEPS.length

const SHRINE_FIRST = 7
const KING = 10
const GATE = 6
const PRISM = 11

/** Which of the twelve are done. The prism needs the king down and the Gate shut. */
function doneSteps(inv: Inventory, flags: readonly string[], mapId: string): boolean[] {
  const has = (f: string) => flags.includes(f)
  const king = has('boss')
  const inShrine = mapId === 'shrine' || flags.some(f => f.startsWith('bomb:overworld:'))
  return [
    inv.sword,
    inv.bombBag,
    has('luna'),
    inv.hook,
    has('mistral'),
    inv.arc,
    has('gateShut'),
    // Being inside the shrine means the rubble is behind you.
    inShrine || inv.disc || inv.bigKey || king,
    inv.disc || king,
    inv.bigKey || king,
    king,
    inv.prism,
  ]
}

/** Steps done, 0..QUEST_STEPS (12 only once the prism is taken). */
export function questStep(inv: Inventory, flags: readonly string[], mapId: string): number {
  return doneSteps(inv, flags, mapId).filter(Boolean).length
}

/**
 * What to do next, as an index into the twelve. The blade and bombs come first; after that, whichever of the
 * two roads the player has started (the Shrine, once the rubble is blasted or the king is down) comes first.
 */
export function questNext(inv: Inventory, flags: readonly string[], mapId: string): number {
  const done = doneSteps(inv, flags, mapId)
  if (!done[0]) return 0
  if (!done[1]) return 1
  const shrineStarted = done[SHRINE_FIRST]
  const order = shrineStarted
    ? [SHRINE_FIRST, 8, 9, KING, 2, 3, 4, 5, GATE, PRISM]
    : [2, 3, 4, 5, GATE, SHRINE_FIRST, 8, 9, KING, PRISM]
  return order.find(i => !done[i]) ?? QUEST_STEPS
}

/** The hint for a `questNext` index. */
export function questHint(next: number): string {
  if (next >= QUEST_STEPS) return 'THE SUN HAS SET. WANDER WHERE YOU LIKE, OR START OVER AT THE RED MACHINE IN PETTER\'S HOUSE.'
  return STEPS[next]!.hint
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
  const next = questNext(save.inv, save.flags, save.map)
  return {
    step,
    goal: STEPS[Math.min(next, QUEST_STEPS - 1)]!.short,
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
