/**
 * The ONE place a dungeon's sprite rows are spread. A new dungeon's rows: one import and one spread here, nowhere
 * else, and never in `sprites.ts` (that is the home page's table).
 *
 * These come with the dungeons' maps, as a chunk: `dungeonChunk.ts` adds them to the table (`addSprites`) as it loads,
 * which is before a door opens in the game, and at once for `world/index.ts` (tests, labs, the stage). A
 * picture that is seen outside a dungeon (a treasure's icon, the lamp set down) does not belong here: it goes in
 * `spritesCarried.ts` or another file `sprites.ts` spreads.
 */
import { DUNGEON_BOSSES } from './spritesDungeonBosses'
import { LIGHTHOUSE_RAW } from './spritesLighthouse'
import { HEAP_RAW } from './spritesHeap'
import { BANNER_RAW, GIFT_RAW, HOUSE_RAW, SYCOPHANT_RAW } from './spritesSycophant'
import { EXAM_RAW } from './spritesExamination'
import { GOLEM_RAW } from './spritesGolem'
import { WEAVER_RAW } from './spritesWeaver'
import { COPILOT_SIDE_RAW } from './spritesCopilotSide'
import { HALLUCINATOR_SPRITES } from './spritesHallucinator'
import { MAXIMIZER_RAW } from './spritesMaximizer'
import { LATE_SHOW_RAW } from './spritesLateShow'

export const DUNGEON_SPRITES: Record<string, string[]> = {
  ...DUNGEON_BOSSES,
  ...LIGHTHOUSE_RAW,
  ...HEAP_RAW,
  ...SYCOPHANT_RAW,
  ...GIFT_RAW,
  ...EXAM_RAW,
  ...HOUSE_RAW,
  ...BANNER_RAW,
  ...GOLEM_RAW,
  ...WEAVER_RAW,
  ...COPILOT_SIDE_RAW,
  ...HALLUCINATOR_SPRITES,
  ...MAXIMIZER_RAW,
  ...LATE_SHOW_RAW,
}
