/** Public engine API used by Zelda.vue, the renderer and the tests. */
export { createGame, stepGame, respawn, resumeAfterWin, toSave, parseSave, cameraFor, enterMap, hasEntry, asksToLeave } from './game'
export { mapInfo, cellIndex, cellRect, cellDef, tileAt, raised, crystalAt, has, keyCount, addKeys, hasBigKey, cellIsDark, condMet } from './map'
export { shardPos, SHARD_R, enemyActive } from './enemies'
export { swingAngle } from './hero'
export { STATS } from './spawn'
// Test hooks: the play-through test kills bosses directly.
export { ctx, killEnemy, hitEnemy } from './combat'
export { solidTile } from './map'
