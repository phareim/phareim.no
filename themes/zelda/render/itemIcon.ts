/** The sprite an item is drawn with: held up and lying in the world, and the B item out on the HUD. */
import { bItem, type GameState, type ItemId } from '../types'

/** The picture of an item held up or lying on the floor. Every `ItemId` has a case (tsc requires it). */
export function itemSpriteName(item: ItemId): string {
  switch (item) {
    case 'sword': return 'item_sword'
    case 'bombBag': case 'bombs5': return 'item_bombbag'
    case 'disc': return 'item_disc'
    case 'smallKey': return 'item_key'
    case 'bigKey': return 'item_bigkey'
    case 'heartPiece': return 'item_heartpiece'
    case 'heartContainer': return 'item_container'
    case 'heart': return 'drop_heart'
    case 'bits5': case 'bits20': case 'bits50': return 'item_bits'
    case 'prism': return 'item_prism'
    case 'hook': return 'item_hook'
    case 'arc': return 'item_arc'
    case 'bigBag': return 'item_bigbag'
    case 'waffle': return 'item_waffle'
    case 'shroom': return 'item_shroom'
    case 'tube': return 'item_tube'
    case 'walkie': return 'item_walkie'
    case 'hat': return 'item_hat'
    // The art learned (`engine/moves.ts`): its own icon.
    case 'artHop': return 'item_hop'
    // The Sacred Weights share one picture, a stand-in until the seven stamped icons are drawn.
    case 'weightMeaning': case 'weightReasons': case 'weightNo': case 'weightSurprise':
    case 'weightFingers': case 'weightCredit': case 'weightSources': return 'item_weight'
  }
}

/** The icon of the B item out (the HUD's box, the touch B pad); '' with nothing out. */
export function itemIconName(s: GameState): string {
  return bItem(s.inv.selected)?.icon ?? ''
}
