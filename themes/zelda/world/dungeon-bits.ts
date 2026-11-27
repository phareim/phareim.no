/**
 * What the dungeons' chests and floor items pay, by flag (`wallet.ts` `bitRewards`): the one thing about a dungeon
 * the shell must know before its maps are there, since a wallet adopts a save when the game begins. A dungeon with a
 * bit chest or a floor item worth bits adds its line here; a dungeon without one adds nothing.
 */
export const DUNGEON_BITS: Record<string, number> = {
  'chest:examination.duck': 50,
  'chest:actunder.bits': 20,
  'chest:lateshow.nook': 20,
}
