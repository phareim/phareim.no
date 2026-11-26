/** Public engine API used by Zelda.vue, the renderer and the tests. */
export { createGame, stepGame, respawn, resumeAfterWin, toSave, parseSave, cameraFor, enterMap, hasEntry, loadSpot, awayMap, atlasAt, asksToLeave, asksChoice } from './game'
export { mapDef, mapInfo, cellIndex, cellRect, cellDef, tileAt, raised, crystalAt, has, keyCount, addKeys, hasBigKey, cellIsDark, condMet, setSession } from './map'
export { shardPos, SHARD_R, enemyActive } from './enemies'
export { aimOf, swingAngle, swingDur, useItems } from './hero'
// The acrobatics and the arts (`moves.ts`)
export { heroZ, airTime, mastered, moveCount, moveDef, knowsArt, artDef, artReady, artRest, isArt, ART_IDS } from './moves'
export { STATS } from './spawn'
// Test hooks: the play-through test kills bosses directly.
export { ctx, killEnemy, hitEnemy, hurtHero, grant } from './combat'
export { solidTile } from './map'
export { DAY, DAY_LENGTH, HOURS, foeLevel, setDaytime, wayOut } from './day'
// Field battles (MapDef.battle)
export { startBattle, menuView, techOk, fighter, fighterAt, battleFocus, wet, PARTY, TECHS, FOES, TP_MAX, INTRO_TIME, OUTRO_TIME, WINDED_TIME } from './battle/index'
export { terrainAbove, terrainZ, terrainRise, terrainLevel, heightAt, isRamp, RAMPS } from './terrain'
// The physical puzzles (`puzzles/`): their state and rules for the renderer and tests, and the generator's kits.
export { puzzleInfo, phys, weightOn, startRoll, SLIDE_SPEED, ROLL_SPEED, GAS_SPEED, boardSolved, traceBoard, scrambleTubes } from './puzzles/index'
export { puzzleKits, solveKit, solveGrid, stampKit, type PuzzleKit, type KitSolution, type KitMove } from './puzzles/kits'
export * from './explore'
