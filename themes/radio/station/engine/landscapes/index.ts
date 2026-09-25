// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/** The built-in landscapes, in dial order. */
import type { Landscape } from '../types.ts'
import { coast } from './coast.ts'
import { summit } from './summit.ts'
import { jungle } from './jungle.ts'
import { frostwood } from './frostwood.ts'
import { village } from './village.ts'
import { nightdrive } from './nightdrive.ts'
import { voyager } from './voyager.ts'
import { deepspace } from './deepspace.ts'
import { neonrain } from './neonrain.ts'
import { caverns } from './caverns.ts'

export const BUILTIN: readonly Landscape[] = [
  coast, summit, jungle, frostwood, village, nightdrive, voyager, deepspace, neonrain, caverns,
].map(l => ({ ...l, origin: 'builtin' as const }))

export const LANDSCAPES: Record<string, Landscape> = Object.fromEntries(BUILTIN.map(l => [l.id, l]))
