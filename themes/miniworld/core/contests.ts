/**
 * Contest rewards on Tivoliet: what a finished obby, star hunt, fashion
 * show or memory game pays, which first wins give prizes, and the fashion
 * judges and memory decks (seeded, so they can be replayed and tested).
 * Every number worth tuning is in REWARDS.
 */
import type { MiniWorldSave, ObbyLevel, FashionTag, PersonLook, Outfit, ClothingSlot, ContestRecord } from '../types'
import { CLOTHES, FURNITURE, FASHION_TAGS, clothing, coversLegs } from '../catalog'
import { grantPrizes } from './save'
import { seeded, pick, shuffle } from './rng'

export const REWARDS = {
  obby: {
    bits: { easy: 15, medium: 30, hard: 60 } as Record<ObbyLevel, number>,
    newBestBonus: 10,
    trophy: { easy: 'trophy-easy', medium: 'trophy-medium', hard: 'trophy-hard' } as Record<ObbyLevel, string>,
    /** Extra prizes on the first finish of a level. */
    firstExtras: { easy: ['obby-hoodie'], medium: [], hard: [] } as Record<ObbyLevel, string[]>,
  },
  stars: {
    maxBits: 45,
    winAt: 30,
    prizes: ['trophy-stars', 'star-top', 'skirt-star'],
  },
  fashion: {
    bitsPerStar: 2,
    winAt: 12,
    prizes: ['trophy-fashion', 'shoes-gold'],
  },
  memory: {
    bitsPerPair: 3,
    minBits: 5,
    prizePairs: 10,
    prizes: ['trophy-memory', 'star-glasses'],
  },
} as const

export const MEMORY_SIZES = [6, 8, 10] as const
export type MemorySize = typeof MEMORY_SIZES[number]

export type ContestResult =
  | { contest: 'obby'; level: ObbyLevel; seconds: number }
  | { contest: 'stars'; stars: number }
  /** `stars`: the three judges' total (3–15), from scoreFashion. */
  | { contest: 'fashion'; stars: number }
  /** `moves`: turns of two cards until every pair was found. */
  | { contest: 'memory'; pairs: MemorySize; moves: number }

export interface ContestOutcome {
  save: MiniWorldSave
  bits: number
  /** Catalog ids given for the first time. */
  prizes: string[]
  newBest: boolean
  /** The first win that gave this contest's (or level's) prizes. */
  firstWin: boolean
}

const bump = (r: ContestRecord, won: boolean, best: number | null): ContestRecord =>
  ({ plays: r.plays + 1, wins: r.wins + (won ? 1 : 0), best })

/** Pays and records a finished contest. Bits are returned for the caller's wallet; prizes are already in the save. */
export function finishContest(save: MiniWorldSave, result: ContestResult): ContestOutcome {
  let bits = 0
  let wanted: string[] = []
  let newBest = false
  let won = false
  const contests = { ...save.contests, obby: { ...save.contests.obby } }

  if (result.contest === 'obby') {
    const R = REWARDS.obby
    const rec = contests.obby[result.level]
    const secs = Math.max(0, Math.round(result.seconds * 10) / 10)
    newBest = rec.best === null || secs < rec.best
    won = true
    bits = R.bits[result.level] + (newBest ? R.newBestBonus : 0)
    contests.obby[result.level] = bump(rec, true, newBest ? secs : rec.best)
    wanted = [R.trophy[result.level], ...R.firstExtras[result.level]]
  } else if (result.contest === 'stars') {
    const R = REWARDS.stars
    const stars = Math.max(0, Math.floor(result.stars))
    const rec = contests.stars
    newBest = stars > 0 && (rec.best === null || stars > rec.best)
    won = stars >= R.winAt
    bits = Math.min(stars, R.maxBits)
    contests.stars = bump(rec, won, newBest ? stars : rec.best)
    if (won) wanted = [...R.prizes]
  } else if (result.contest === 'fashion') {
    const R = REWARDS.fashion
    const stars = Math.max(3, Math.min(15, Math.floor(result.stars)))
    const rec = contests.fashion
    newBest = rec.best === null || stars > rec.best
    won = stars >= R.winAt
    bits = stars * R.bitsPerStar
    contests.fashion = bump(rec, won, newBest ? stars : rec.best)
    if (won) wanted = [...R.prizes]
  } else {
    const R = REWARDS.memory
    const moves = Math.max(result.pairs, Math.floor(result.moves))
    const rec = contests.memory
    newBest = rec.best === null || moves < rec.best
    won = true
    bits = Math.max(R.minBits, result.pairs * R.bitsPerPair - (moves - result.pairs))
    contests.memory = bump(rec, true, newBest ? moves : rec.best)
    if (result.pairs === R.prizePairs) wanted = [...R.prizes]
  }

  const fresh = wanted.filter(id => !save.prizes.includes(id))
  const next = grantPrizes({ ...save, contests }, fresh)
  return { save: next, bits, prizes: fresh, newBest, firstWin: won && fresh.length > 0 }
}

// ---------------------------------------------------------------- fashion show

export const JUDGES = [
  { id: 'cat', name: 'Frøken Katt' },
  { id: 'bear', name: 'Herr Bjørn' },
  { id: 'bunny', name: 'Kanin-Kari' },
] as const

export interface JudgeScore {
  judge: typeof JUDGES[number]['id']
  stars: 1 | 2 | 3 | 4 | 5
  /** One short Norwegian cheer. */
  reason: string
}

export interface FashionScore {
  theme: FashionTag
  judges: [JudgeScore, JudgeScore, JudgeScore]
  total: number
  /** Worn pieces that suit the theme. */
  matches: string[]
}

const PRAISE: Record<FashionTag, string> = {
  sport: 'Så sporty!', fest: 'Klar for fest!', strand: 'Sommerlig!', vinter: 'God og varm!',
  prinsesse: 'Kongelig!', verdensrom: 'Ut av denne verden!', eventyr: 'Som et eventyr!',
  dyr: 'Så søtt!', regnbue: 'Så fargerik!',
}
const KIND = ['Modig valg!', 'Fine farger!', 'Kult!', 'Morsomt!']
const WARM = ['Flott!', 'Nydelig!', 'Stilig!']

/** The pieces a person shows on the catwalk (a dress hides the bottom). */
export function wornPieces(outfit: Outfit): string[] {
  const slots: ClothingSlot[] = ['top', 'bottom', 'shoes', 'hat', 'face', 'back']
  return slots
    .filter(s => !(s === 'bottom' && coversLegs(outfit.top)))
    .map(s => outfit[s])
    .filter((id): id is string => !!id && !!clothing(id))
}

/**
 * Three judges score a look for a theme, 1–5 stars each. The base is how
 * many worn pieces suit the theme (0 → 1, 1 → 2, 2 → 3, 3 → 4, 4+ → 5);
 * each judge nudges it a star up or down by the seed, never below 1; a
 * full outfit (hat, face and back on) gives the last judge a star more.
 */
export function scoreFashion(look: PersonLook, theme: FashionTag, seed: number): FashionScore {
  const rng = seeded(seed)
  const worn = wornPieces(look.outfit)
  const matches = worn.filter(id => clothing(id)!.tags.includes(theme))
  const base = Math.min(5, matches.length + 1)
  const full = !!(look.outfit.hat && look.outfit.face && look.outfit.back)
  const judges = JUDGES.map((j, i) => {
    const r = rng()
    const nudge = r < 0.2 ? -1 : r > 0.75 ? 1 : 0
    const bonus = full && i === JUDGES.length - 1 ? 1 : 0
    const stars = Math.max(1, Math.min(5, base + nudge + bonus)) as JudgeScore['stars']
    const reason = stars >= 4 && matches.length ? PRAISE[theme] : stars >= 3 ? pick(rng, WARM) : pick(rng, KIND)
    return { judge: j.id, stars, reason }
  }) as FashionScore['judges']
  return { theme, judges, total: judges.reduce((s, j) => s + j.stars, 0), matches }
}

/**
 * A theme for the show. With the closet, themes where the player owns
 * pieces for at least two different slots come first, so there is always
 * a way to do well.
 */
export function drawFashionTheme(seed: number, closet?: readonly string[]): FashionTag {
  const rng = seeded(seed)
  const all = FASHION_TAGS.map(t => t.id)
  if (!closet) return pick(rng, all)
  const doable = all.filter((tag) => {
    const slots = new Set(closet.map(id => clothing(id)).filter(d => d && d.tags.includes(tag)).map(d => d!.slot))
    return slots.size >= 2
  })
  return pick(rng, doable.length ? doable : all)
}

// ---------------------------------------------------------------- memory

export interface MemoryCard {
  /** Position in the deck. */
  index: number
  kind: 'clothing' | 'furniture'
  /** Catalog id; two cards share each id. */
  id: string
}

/** A shuffled deck of `pairs` pairs of different clothes and furniture pictures. */
export function memoryDeck(pairs: number, seed: number): MemoryCard[] {
  const rng = seeded(seed)
  const n = Math.max(2, Math.min(12, Math.floor(pairs)))
  // Different models only, so two pictures never look alike.
  const pool: { kind: 'clothing' | 'furniture'; id: string }[] = []
  const seen = new Set<string>()
  for (const c of CLOTHES) {
    const key = `c:${c.shape}:${c.colors.main}`
    if (!seen.has(key)) { seen.add(key); pool.push({ kind: 'clothing', id: c.id }) }
  }
  for (const f of FURNITURE) {
    const key = `f:${f.model}`
    if (!seen.has(key)) { seen.add(key); pool.push({ kind: 'furniture', id: f.id }) }
  }
  const chosen = shuffle(rng, pool).slice(0, n)
  return shuffle(rng, [...chosen, ...chosen]).map((c, index) => ({ index, ...c }))
}
