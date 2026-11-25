/** Public engine API used by Zelda.vue, the renderer and the tests. */
export { createGame, stepGame, respawn, resumeAfterWin, toSave, parseSave, cameraFor, enterMap, hasEntry, asksToLeave, asksChoice } from './game'
export { mapDef, mapInfo, cellIndex, cellRect, cellDef, tileAt, raised, crystalAt, has, keyCount, addKeys, hasBigKey, cellIsDark, condMet, setSession } from './map'
export { shardPos, SHARD_R, enemyActive } from './enemies'
export { aimOf, swingAngle, swingDur, useItems } from './hero'
export { STATS } from './spawn'
// Test hooks: the play-through test kills bosses directly.
export { ctx, killEnemy, hitEnemy, hurtHero } from './combat'
export { solidTile } from './map'
export { DAY, DAY_LENGTH, HOURS, foeLevel, setDaytime, wayOut } from './day'
// Field battles (MapDef.battle)
export { startBattle, menuView, techOk, fighter, fighterAt, battleFocus, wet, PARTY, TECHS, FOES, TP_MAX, INTRO_TIME, OUTRO_TIME, WINDED_TIME } from './battle/index'
export { digPlan, digTarget, digItems, buildKind, buildKinds, matCount, hasTool, encodeDig, decodeDig, DIG_CAP, DIG_MAPS, DIG_TOTAL, DIG_MATS, isDigItem } from './dig'
export { digZ, digRise, digLevel, heightAt, isRamp, RAMPS } from './digGround'
// The physical puzzles (`puzzles/`): their state and rules for the renderer and tests, and the generator's kits.
export { puzzleInfo, phys, weightOn, startRoll, SLIDE_SPEED, ROLL_SPEED } from './puzzles/index'
export { puzzleKits, solveKit, solveGrid, stampKit, type PuzzleKit, type KitSolution, type KitMove } from './puzzles/kits'
export * from './explore'
