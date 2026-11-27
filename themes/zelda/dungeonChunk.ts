/**
 * The dungeons' chunk: their maps (`world/dungeons.ts`) and their pictures (`render/spritesDungeons.ts`), joined here
 * because neither the world nor the renderer holds the other. Loading this module adds the pictures to the sprite table
 * (`addSprites`), so whoever has the maps has the rows: the shell fetches it (`dungeonLoad.ts`), `world/index.ts`
 * (tests, labs, the stage) holds it from the start. Nothing is registered here.
 */
import { addSprites } from './render/sprites'
import { DUNGEON_SPRITES } from './render/spritesDungeons'

addSprites(DUNGEON_SPRITES)

export { DUNGEONS } from './world/dungeons'
