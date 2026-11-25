/** Public engine API used by Zelda.vue, the renderer and the tests. */
export { createGame, stepGame, respawn, resumeAfterWin, toSave, parseSave, cameraFor, enterMap, hasEntry, asksToLeave, asksChoice } from './game'
export { mapInfo, cellIndex, cellRect, cellDef, tileAt, raised, crystalAt, has, keyCount, addKeys, hasBigKey, cellIsDark, condMet, setSession } from './map'
export { shardPos, SHARD_R, enemyActive } from './enemies'
export { aimOf, swingAngle } from './hero'
export { STATS } from './spawn'
// Test hooks: the play-through test kills bosses directly.
export { ctx, killEnemy, hitEnemy } from './combat'
export { solidTile } from './map'
export { DAY, DAY_LENGTH, HOURS, foeLevel, setDaytime, wayOut } from './day'
export { digPlan, digTarget, digItems, buildKind, buildKinds, matCount, hasTool, encodeDig, decodeDig, DIG_CAP, DIG_MAPS, DIG_MATS, isDigItem } from './dig'
export { digZ, digRise, digLevel, heightAt, isRamp, RAMPS } from './digGround'
