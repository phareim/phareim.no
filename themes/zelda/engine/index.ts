/** Public engine API used by Zelda.vue, the renderer and the tests. */
export { createGame, stepGame, respawn, resumeAfterWin, toSave, parseSave, cameraFor, enterMap, hasEntry, asksToLeave, asksChoice } from './game'
export { mapDef, mapInfo, cellIndex, cellRect, cellDef, tileAt, raised, crystalAt, has, keyCount, addKeys, hasBigKey, cellIsDark, condMet, setSession } from './map'
export { shardPos, SHARD_R, enemyActive } from './enemies'
export { aimOf, swingAngle } from './hero'
export { STATS } from './spawn'
// Test hooks: the play-through test kills bosses directly.
export { ctx, killEnemy, hitEnemy } from './combat'
export { solidTile } from './map'
export { DAY, DAY_LENGTH, HOURS, foeLevel, setDaytime, wayOut } from './day'
// Field battles (MapDef.battle)
export { startBattle, menuView, techOk, fighter, fighterAt, battleFocus, wet, PARTY, TECHS, FOES, TP_MAX, INTRO_TIME, OUTRO_TIME, WINDED_TIME } from './battle/index'
