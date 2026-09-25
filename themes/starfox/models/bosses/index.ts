/**
 * The five sector bosses: one builder per boss, one contract (./types).
 * Each call builds a fresh boss (geometry and materials are cached, so a
 * second build only makes meshes); build once per run and `reset()` it.
 */
import type { AnyBoss, BossId, CrownModel, FurnaceModel, MothModel, PincerModel, TwinsModel } from './types'
import { createPincer } from './pincer'
import { createMoth } from './moth'
import { createFurnace } from './furnace'
import { createTwins } from './twins'
import { createCrown } from './crown'

export * from './types'
export { createPincer, createMoth, createFurnace, createTwins, createCrown }
export { disposeBossMats } from './shared'

export const BOSS_IDS: BossId[] = ['pincer', 'moth', 'furnace', 'twins', 'crown']

export function createBoss(id: 'pincer'): PincerModel
export function createBoss(id: 'moth'): MothModel
export function createBoss(id: 'furnace'): FurnaceModel
export function createBoss(id: 'twins'): TwinsModel
export function createBoss(id: 'crown'): CrownModel
export function createBoss(id: BossId): AnyBoss
export function createBoss(id: BossId): AnyBoss {
  switch (id) {
    case 'pincer': return createPincer()
    case 'moth': return createMoth()
    case 'furnace': return createFurnace()
    case 'twins': return createTwins()
    case 'crown': return createCrown()
  }
}
