/**
 * What Game.vue hands every panel (provide/inject): the game state, the
 * neighbourhood, pictures, sound, the runtime, and the panel stack.
 */
import { inject, type InjectionKey, type Ref, type ShallowRef } from 'vue'
import type { MiniWorldApi } from '~/composables/useMiniWorld'
import { socialText, type MiniWorldSocialApi, type SocialResult } from '~/composables/useMiniWorldSocial'
import type { MiniAudio, MiniWorldRuntime, Place, Previews, MiniSfx, AvatarPose, TownSpot } from '../scene/contracts'
import type { ContestId, ObbyLevel, PersonLook, ClothingDef, Weapon } from '../types'

/** Every panel the shell can show. The top of the stack is the one you see. */
export type Panel =
  | { id: 'welcome' }
  | { id: 'creator'; personId: string | null }
  | { id: 'persons' }
  | { id: 'wardrobe' }
  | { id: 'shop'; kind: 'clothes' | 'furniture' }
  | { id: 'bag' }
  | { id: 'workshop' }
  | { id: 'castle' }
  | { id: 'mailbox' }
  | { id: 'gift'; to: string | null }
  | { id: 'map' }
  | { id: 'booth'; contest: ContestId }
  | { id: 'result'; result: ResultCard }
  | { id: 'fashion' }
  | { id: 'memory'; pairs: 6 | 8 | 10 }
  | { id: 'surfaces' }

export type PanelId = Panel['id']

/** What a result card shows. */
export interface ResultCard {
  title: string
  /** One line under the title ("TID 42 S", "12 STJERNER"). */
  line: string
  bits: number
  newBest: boolean
  /** Catalog ids of prizes won now (clothing or furniture). */
  prizes: string[]
  /** Contest to play again, and the obby level. */
  again?: { contest: ContestId; level?: ObbyLevel }
}

/** Pictures for panels. Each call is cached by the previews module; '' when there is no picture yet. */
export interface Pics {
  person(look: PersonLook, opts?: { full?: boolean; size?: number; pose?: AvatarPose }): string
  clothing(def: ClothingDef, size?: number): string
  furniture(id: string, level: 1 | 2 | 3, size?: number): string
  weapon(weapon: Weapon, size?: number): string
}

export interface MwContext {
  game: MiniWorldApi
  social: MiniWorldSocialApi
  pics: Pics
  previews: ShallowRef<Previews | null>
  audio: MiniAudio
  runtime: ShallowRef<MiniWorldRuntime | null>
  place: Ref<Place>
  open(panel: Panel): void
  /** Replace the top panel. */
  swap(panel: Panel): void
  /** Close the top panel. */
  close(): void
  /** Close every panel. */
  closeAll(): void
  /** A short Norwegian line at the top of the view for a moment. */
  say(text: string): void
  /** A happy moment: a big card with a picture and a line, gone by itself. */
  cheer(text: string, pic?: string): void
  sfx(name: MiniSfx): void
  /** Fashion show: whether the panel lets the world run behind it (catwalk). */
  setSeeThrough(on: boolean): void
  /** Fashion and memory games: lock the site's navigation while a round is on. */
  setBusy(on: boolean): void
  /** Walk into a friend's or neighbour's house (fetches it, then goes there). */
  visit(playerId: string): void
  /** Start a contest from its booth card (obby level for the obby). */
  play(contest: ContestId, opts?: { level?: ObbyLevel; pairs?: 6 | 8 | 10 }): void
  /** Fast travel (Kart). */
  travel(to: TravelSpot): void
}

/** The map's places: the runtime's town spots, and home. */
export type TravelSpot = TownSpot | 'hjem'

/** Norwegian feedback for a neighbourhood call; '' for ok. */
export function socialLine(r: SocialResult): string {
  if (r === 'offline') return 'FÅR IKKE KONTAKT AKKURAT NÅ.'
  return socialText(r)
}

export const MW_CTX: InjectionKey<MwContext> = Symbol('miniworld')

export function useMw(): MwContext {
  const ctx = inject(MW_CTX)
  if (!ctx) throw new Error('Mini World panel outside the game shell')
  return ctx
}
