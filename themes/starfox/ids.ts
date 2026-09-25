/**
 * Star Fox canonical ids — the five sectors, their biomes and bosses, and
 * the ECHO loop arithmetic. Pure; shared by balance.ts, encounters.ts and
 * arsenal.ts and story.ts.
 *
 * `sector` is the absolute 1-based sector count of a run (6 = ECHO I's
 * first sector); `index` is 0–4 within the loop; `loop` is 0 for the first
 * pass, 1 for ECHO I, …
 */

export type BiomeId = 'coast' | 'woods' | 'ember' | 'lake' | 'space'
export type BossId = 'pincer' | 'moth' | 'furnace' | 'twins' | 'crown'

export const SECTOR_COUNT = 5
export const BIOMES: readonly BiomeId[] = ['coast', 'woods', 'ember', 'lake', 'space']
export const BOSSES: readonly BossId[] = ['pincer', 'moth', 'furnace', 'twins', 'crown']

/** 0–4: which of the five sectors an absolute sector replays. */
export function sectorIndex(sector: number): number {
  return (Math.max(1, Math.floor(sector)) - 1) % SECTOR_COUNT
}

/** 0 on the first pass, 1 on ECHO I, … */
export function loopOf(sector: number): number {
  return Math.floor((Math.max(1, Math.floor(sector)) - 1) / SECTOR_COUNT)
}

/** Absolute 1-based sector from index + loop. */
export function absoluteSector(index: number, loop: number): number {
  return Math.max(0, Math.floor(loop)) * SECTOR_COUNT + (Math.max(0, Math.floor(index)) % SECTOR_COUNT) + 1
}

export function biomeOf(sector: number): BiomeId {
  return BIOMES[sectorIndex(sector)]!
}

export function bossOf(sector: number): BossId {
  return BOSSES[sectorIndex(sector)]!
}
