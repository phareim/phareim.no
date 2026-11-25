import { GATES_THINGS } from './gates'

/**
 * The coast's own pieces: the hand-made maps' neon waymarks and BORDER arms by the gates (`world/overworld.ts`,
 * `world/wildwood.ts`). Baked on their own (`coastData.ts`), so the town fetches these few without the arches.
 */
export const COAST_THINGS = Object.fromEntries(Object.entries(GATES_THINGS).filter(([id]) => !id.startsWith('gate_')))
