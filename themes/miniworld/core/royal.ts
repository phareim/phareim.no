/**
 * The crown in a neighbourhood: who rules (most votes, ties to who joined
 * first), which titles the ruler may take and give, and what each title
 * brings. Shared by the server (which enforces it) and the client (which
 * greys out what cannot be done).
 */
import type { RoyalTitle } from '../types'

export interface Voter {
  playerId: string
  votes: number
  /** Join time (ms or any increasing number). */
  joinedAt: number
}

/** The member with the most votes; a tie goes to who joined first; no votes at all → null. */
export function rulerOf(members: readonly Voter[]): string | null {
  let best: Voter | null = null
  for (const m of members) {
    if (m.votes <= 0) continue
    if (!best || m.votes > best.votes || (m.votes === best.votes && m.joinedAt < best.joinedAt)) best = m
  }
  return best?.playerId ?? null
}

/** Votes per member from each member's own vote (votes for non-members are ignored). */
export function countVotes(members: readonly { playerId: string; voteFor: string | null }[]): Map<string, number> {
  const ids = new Set(members.map(m => m.playerId))
  const counts = new Map<string, number>([...ids].map(id => [id, 0]))
  for (const m of members) {
    if (m.voteFor && ids.has(m.voteFor)) counts.set(m.voteFor, counts.get(m.voteFor)! + 1)
  }
  return counts
}

export const TITLES: readonly RoyalTitle[] = ['king', 'queen', 'prince', 'princess']
export const TITLE_NAMES: Record<RoyalTitle, string> = { king: 'Konge', queen: 'Dronning', prince: 'Prins', princess: 'Prinsesse' }

export const isTitle = (t: unknown): t is RoyalTitle => typeof t === 'string' && (TITLES as readonly string[]).includes(t)

/** The titles only one member may hold. */
const SINGLE: readonly RoyalTitle[] = ['king', 'queen']

export interface TitleHolder {
  playerId: string
  title: RoyalTitle | null
}

export type TitleError = 'not-member' | 'not-ruler' | 'bad-title' | 'title-taken'

/**
 * The ruler crowns themself king or queen. Returns the new titles: another
 * member holding that title loses it (a new ruler takes the crown).
 */
export function crown(members: readonly TitleHolder[], ruler: string | null, actor: string, title: RoyalTitle): TitleHolder[] | TitleError {
  if (!members.some(m => m.playerId === actor)) return 'not-member'
  if (actor !== ruler) return 'not-ruler'
  if (title !== 'king' && title !== 'queen') return 'bad-title'
  return members.map((m) => {
    if (m.playerId === actor) return { ...m, title }
    return m.title === title ? { ...m, title: null } : m
  })
}

/**
 * The titles the ruler may give another member: prince and princess
 * always, and the one of king/queen the ruler is not (once the ruler has
 * chosen). King and queen are one each.
 */
export function givableTitles(rulerTitle: RoyalTitle | null): RoyalTitle[] {
  const out: RoyalTitle[] = ['prince', 'princess']
  if (rulerTitle === 'king') out.unshift('queen')
  if (rulerTitle === 'queen') out.unshift('king')
  return out
}

/** The ruler gives `target` a title (null takes it back). Returns the new titles. */
export function giveTitle(
  members: readonly TitleHolder[], ruler: string | null, actor: string, target: string, title: RoyalTitle | null,
): TitleHolder[] | TitleError {
  if (!members.some(m => m.playerId === actor)) return 'not-member'
  if (actor !== ruler) return 'not-ruler'
  if (!members.some(m => m.playerId === target)) return 'not-member'
  if (target === actor) return 'bad-title'
  if (title !== null) {
    const rulerTitle = members.find(m => m.playerId === actor)!.title
    if (!givableTitles(rulerTitle).includes(title)) return 'bad-title'
    if (SINGLE.includes(title) && members.some(m => m.title === title && m.playerId !== target)) return 'title-taken'
  }
  return members.map(m => (m.playerId === target ? { ...m, title } : m))
}

/** What a title brings (once, kept for ever): crowns, capes and the banner. */
export function royalPrizes(title: RoyalTitle): string[] {
  switch (title) {
    case 'king': return ['crown-king', 'royal-cape', 'royal-banner']
    case 'queen': return ['crown-queen', 'royal-robe', 'royal-banner']
    case 'prince': return ['crown-prince', 'royal-banner']
    case 'princess': return ['tiara-princess', 'royal-banner']
  }
}
