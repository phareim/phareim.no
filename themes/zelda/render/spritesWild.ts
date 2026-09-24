/**
 * Wildwood art (the forest, the lab and its bosses), merged into one record
 * that sprites.ts spreads into its registry. Split by kind so no file grows
 * too long; every file is self-contained (helpers in spritesWildKit.ts).
 */
import { FOLK } from './spritesWildFolk'
import { FOES } from './spritesWildFoes'
import { BOSSES } from './spritesWildBosses'
import { ITEMS } from './spritesWildItems'
import { PROPS_A } from './spritesWildProps'
import { PROPS_B } from './spritesWildPropsB'

export const WILD_RAW: Record<string, string[]> = {
  ...FOLK,
  ...FOES,
  ...BOSSES,
  ...ITEMS,
  ...PROPS_A,
  ...PROPS_B,
}
