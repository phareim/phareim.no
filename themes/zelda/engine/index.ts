/** Public engine API used by Zelda.vue, the renderer and the tests. */
export { createGame, stepGame, respawn, resumeAfterWin, resumeAfterEnd2, toSave, parseSave, cameraFor, enterMap, hasEntry, loadSpot, awayMap, atlasAt, asksToLeave, asksChoice } from './game'
export { mapDef, mapInfo, cellIndex, cellRect, cellDef, tileAt, raised, crystalAt, has, keyCount, addKeys, hasBigKey, cellIsDark, condMet, setSession } from './map'
export { shardPos, SHARD_R, enemyActive } from './enemies'
// A door whose map did not come (`World.lazy`).
export { abortWarp, DOOR_SHUT, DOOR_SHUT_OFFLINE } from './abortWarp'
export { aimOf, swingAngle, swingDur, useItems } from './hero'
// What a press of A would do (`action.ts`): the touch deck's picture, and the engine's own choice.
export { aWould, type AWould } from './action'
// The acrobatics and the arts (`moves.ts`)
export { heroZ, airTime, mastered, moveCount, moveDef, knowsArt, artDef, artReady, artRest, isArt, ART_IDS } from './moves'
export { STATS } from './spawn'
// The echo (`echo.ts`), and what the floor is stencilled with.
export { echoMayStand, echoAim, ECHO_R } from './echo'
// The Magnet (`magnet.ts`): what a tap would take, and iron smashed (it comes home).
export { magnetPlan, magnetPreview, magnetRest, smashIron, MAGNET, type MagnetPlan } from './magnet'
// The Scrape Golem's numbers (`bossGolem.ts`).
export { GOLEM } from './bossGolem'
export { stencilsOf, inStencil, type Stencil } from './stencils'
// The storm lamp (`lamp.ts`): its beam on a foe, and whether a dark hound is unseen.
export { inLampBeam, unseen } from './lamp'
// The side view's numbers (the lab measures them).
export { SIDE, type SideHero } from './side'
// The Stomp's numbers, what it would come down on, and the intertitle cards' timing.
export { STOMP, stompAim, type StompAim } from './stomp'
export { CARD } from './cards'
// The glass of Act Three (`lens.ts`): its seconds, what it knows, whether it is up.
export { LENS, lensUp, lensScreen, glassThings, bossLens, type Lens } from './lens'
export { COPILOT, copilotStill } from './bossCopilot'
export { WEAVER, handsRight, weaverSlot, weaverFinger, weaverFootprint, weaverStrips, weaverLane, weaverPellet, weaverWaves } from './bossWeaver'
export { CHASE } from './chase'
// Act Three's BARD and the fly loft's sandbags: their numbers and what their blows cover.
export { BARD, BARD_SET, bardPiece, bardOpen, bardBoxes, type BardPiece } from './bossBard'
// Act Three's boss: its numbers, its bodies, what its crates cover and what its bar shows.
export { HALLU, halluBodies, halluBoxes, halluPopped, halluShown, halluAims, halluPaint } from './bossHallucinator'
export { BAG, bagsOf, bagAt, column, type Box } from './sandbag'
// Test hooks: the play-through test kills bosses directly.
export { ctx, killEnemy, hitEnemy, hurtHero, grant } from './combat'
export { toughOpen, bossOpen, BIG, itemText } from './combat'
export { isWeight, hasWeight, weightCount, clearFoes } from './map'
export { solidTile, circleBlocked, moveCircle, lineClear, type MoveMode } from './map'
// The view as a rule: which view blocks are solid, and the one call that turns it.
export { setViewRule, risesUnderHero, hasViewBlocks } from './map'
export { DAY, DAY_LENGTH, HOURS, foeLevel, setDaytime, wayOut } from './day'
export { terrainAbove, terrainZ, terrainRise, terrainLevel, heightAt, isRamp, RAMPS } from './terrain'
// The physical puzzles (`puzzles/`): their state and rules for the renderer and tests, and the generator's kits.
export { puzzleInfo, phys, weightOn, startRoll, SLIDE_SPEED, ROLL_SPEED, GAS_SPEED, boardSolved, traceBoard, scrambleTubes } from './puzzles/index'
export { puzzleKits, solveKit, solveGrid, stampKit, type PuzzleKit, type KitSolution, type KitMove } from './puzzles/kits'
export * from './explore'
// The Examination (`exam.ts`): the world's share of the hero's clock where time waits.
export { stillK } from './exam'
// The Supply Room's boss: its numbers, its stations, what it paints; and the hearts it turns to clips.
export { MAXI, STATIONS, FOOT, maximizerStencils, maximizerFlash, ringTiles, quotaCircles, stationOf, clipFlights } from './bossMaximizer'
export { heroCap, clipLimit, setClips, clipHeart, unclipHeart } from './clips'
