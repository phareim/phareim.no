/**
 * Space Voyagers II: the campaign. Eight sorties a run out of ten, in three
 * acts; each act has one deciding sortie whose loss takes the short losing
 * track (DESIGN.md, "The campaign"). The run's score is the Hall of Fame
 * score. Pure: the page keeps the save in localStorage (`voyagers2.save`).
 */
import type { PilotId } from './types.ts'

export type SortieId =
  | 'firstshift' | 'convoy' | 'siege'
  | 'takeout' | 'spilled' | 'hansshot' | 'dare'
  | 'buffet' | 'lastslice' | 'finale'

export type Next = SortieId | 'end-won' | 'end-lost'

export interface Node {
  act: 1 | 2 | 3
  /** The sortie that decides the act's track. */
  decides?: boolean
  won: Next
  lost: Next
}

export const TREE: Record<SortieId, Node> = {
  firstshift: { act: 1, won: 'convoy', lost: 'convoy' },
  convoy: { act: 1, won: 'siege', lost: 'siege' },
  siege: { act: 1, decides: true, won: 'takeout', lost: 'spilled' },
  takeout: { act: 2, won: 'hansshot', lost: 'hansshot' },
  spilled: { act: 2, won: 'hansshot', lost: 'hansshot' },
  hansshot: { act: 2, won: 'dare', lost: 'dare' },
  dare: { act: 2, decides: true, won: 'buffet', lost: 'lastslice' },
  buffet: { act: 3, won: 'finale', lost: 'finale' },
  lastslice: { act: 3, won: 'finale', lost: 'finale' },
  finale: { act: 3, won: 'end-won', lost: 'end-lost' },
}

export const ACTS = ['', 'THE PARKING BELT', 'THE LONG HAUL', 'THE DELIVERY'] as const

export interface Played { id: SortieId; result: 'won' | 'lost'; score: number; kills: number }

export interface Save {
  version: 1
  pilot: PilotId
  /** The next sortie, or how the campaign ended. */
  next: Next
  score: number
  kills: number
  /** The crew's morale and the partner's mood, 0..1 (talk choices move them). */
  morale: number
  mood: number
  /** Things said and chosen: talks heard, choices made, wingmen talked to. */
  flags: Record<string, boolean>
  history: Played[]
}

export function newSave(pilot: PilotId): Save {
  return { version: 1, pilot, next: 'firstshift', score: 0, kills: 0, morale: 0.6, mood: 0.6, flags: {}, history: [] }
}

/** Record a sortie and move on along the tree. */
export function afterSortie(s: Save, id: SortieId, result: 'won' | 'lost', score: number, kills: number): Save {
  const node = TREE[id]
  const next = result === 'won' ? node.won : node.lost
  const morale = Math.max(0, Math.min(1, s.morale + (result === 'won' ? 0.08 : -0.1)))
  return {
    ...s,
    next,
    score: s.score + score,
    kills: s.kills + kills,
    morale,
    history: [...s.history, { id, result, score, kills }],
  }
}

export function isEnd(n: Next): n is 'end-won' | 'end-lost' {
  return n === 'end-won' || n === 'end-lost'
}

/** A save read back from storage, or null when it is not one of ours. */
export function readSave(raw: string | null): Save | null {
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as Partial<Save>
    if (s.version !== 1 || (s.pilot !== 'rex' && s.pilot !== 'nova')) return null
    if (typeof s.next !== 'string' || !(s.next in TREE || isEnd(s.next as Next))) return null
    return {
      version: 1, pilot: s.pilot, next: s.next as Next,
      score: Number(s.score) || 0, kills: Number(s.kills) || 0,
      morale: typeof s.morale === 'number' ? s.morale : 0.6, mood: typeof s.mood === 'number' ? s.mood : 0.6,
      flags: s.flags && typeof s.flags === 'object' ? s.flags : {}, history: Array.isArray(s.history) ? s.history : [],
    }
  } catch {
    return null
  }
}

/** How many sorties a run has flown and how many it will fly in all (always eight). */
export function progress(s: Save): { flown: number; total: number } {
  return { flown: s.history.length, total: 8 }
}

/** Each sortie's name, for the title's CONTINUE line (the briefing's words are in `story/hub.ts`). */
export const SORTIE_TITLES: Record<SortieId, string> = {
  firstshift: 'FIRST SHIFT', convoy: 'CONVOY', siege: 'OVEN UNDER SIEGE', takeout: 'TAKE-OUT', spilled: 'SPILLED SAUCE',
  hansshot: 'HANS SHOT FIRST', dare: 'THE DARE', buffet: 'THE BUFFET', lastslice: 'LAST SLICE', finale: 'HEART OF THE OVEN',
}
