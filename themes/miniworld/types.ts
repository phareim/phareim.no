/**
 * Mini World — the data contract (2026-09-26). Every module reads these
 * types; change them here first. Pure TypeScript, no three.js, no Vue, so
 * the server and the node tests can import it.
 *
 * Money is the site's shared wallet ("bits", the same bits Neon Shrine's
 * hero picks up). It is not in the Mini World save: see `composables/useWallet.ts`.
 */

// ---------------------------------------------------------------- people

export type SkinId = 's1' | 's2' | 's3' | 's4' | 's5' | 's6'
export type HairStyleId =
  | 'short' | 'bob' | 'long' | 'ponytail' | 'pigtails' | 'bun'
  | 'curly' | 'spiky' | 'braids' | 'afro' | 'none'
export type HairColorId =
  | 'black' | 'brown' | 'blond' | 'ginger' | 'white'
  | 'pink' | 'blue' | 'purple' | 'mint' | 'rainbow'
export type EyesId = 'dots' | 'big' | 'happy' | 'lashes' | 'wink'
export type MouthId = 'smile' | 'grin' | 'open' | 'tongue' | 'cat'

/** What a person wears: one clothing id per slot, null for nothing (hat, face, back). */
export interface Outfit {
  top: string
  /** Ignored while the top is a dress or gown (it covers the legs). */
  bottom: string
  shoes: string
  hat: string | null
  face: string | null
  back: string | null
}

/** Everything the avatar builder needs to draw a person. */
export interface PersonLook {
  skin: SkinId
  hair: HairStyleId
  hairColor: HairColorId
  eyes: EyesId
  mouth: MouthId
  cheeks: boolean
  outfit: Outfit
}

export interface Person {
  /** Short random id, stable for the person's life. */
  id: string
  /** 1–12 letters (A–Å, a–å, space, hyphen), chosen by the child. */
  name: string
  look: PersonLook
}

export const MAX_PERSONS = 3
export const MAX_NAME = 12

// ---------------------------------------------------------------- catalog

export type ClothingSlot = 'top' | 'bottom' | 'shoes' | 'hat' | 'face' | 'back'

/** How the avatar builder draws a piece; each slot has its own shapes. */
export type TopShape = 'tee' | 'tank' | 'hoodie' | 'sweater' | 'jacket' | 'dress' | 'gown' | 'suit'
export type BottomShape = 'pants' | 'shorts' | 'skirt' | 'tutu'
export type ShoeShape = 'sneakers' | 'boots' | 'sandals' | 'skates' | 'party'
export type HatShape =
  | 'cap' | 'beanie' | 'bow' | 'flowers' | 'tiara' | 'crown' | 'bunny' | 'cat'
  | 'wizard' | 'helmet' | 'party' | 'sunhat' | 'unicorn'
export type FaceShape = 'round' | 'shades' | 'hearts' | 'stars' | 'mask'
export type BackShape = 'backpack' | 'cape' | 'fairy' | 'tail' | 'jetpack'
export type Pattern = 'plain' | 'stripes' | 'dots' | 'stars' | 'hearts' | 'checks' | 'rainbow' | 'sparkle' | 'flowers' | 'snow'

/** Fashion-show themes; clothes carry the ones they suit. */
export type FashionTag = 'sport' | 'fest' | 'strand' | 'vinter' | 'prinsesse' | 'verdensrom' | 'eventyr' | 'dyr' | 'regnbue'

export type Rarity = 'basic' | 'shop' | 'prize' | 'royal'

export interface ClothingDef {
  id: string
  slot: ClothingSlot
  /** Norwegian, shown to the child. */
  name: string
  /** Bits in the clothes shop; 0 for starter clothes and prizes. */
  price: number
  rarity: Rarity
  shape: TopShape | BottomShape | ShoeShape | HatShape | FaceShape | BackShape
  /** Hex colours: main fabric, second (pattern, trim), accent (buttons, gems). */
  colors: { main: string; second?: string; accent?: string }
  pattern?: Pattern
  tags: FashionTag[]
}

export type FurnitureKind = 'floor' | 'rug' | 'small' | 'wall'

export interface FurnitureDef {
  id: string
  name: string
  price: number
  rarity: Rarity
  /** floor: stands on the floor; rug: lies flat under others; small: may stand on a surface; wall: hangs on a wall. */
  kind: FurnitureKind
  /** Footprint in floor cells at rotation 0: [x, z]. Wall items: [width, 1]. */
  size: [number, number]
  /** Height of its top in cells when others may stand on it (tables, shelves); absent = nothing stacks on it. */
  surface?: number
  /** Builder key in scene/furniture.ts (several ids may share a model with other colours). */
  model: string
  colors: { main: string; second?: string; accent?: string }
  /** Something to do with it: sit, sleep, bounce, play music, … (drives a small animation). */
  use?: 'sit' | 'sleep' | 'bounce' | 'music' | 'slide' | 'light' | 'swim'
}

export interface SurfaceDef {
  id: string
  name: string
  price: number
  /** Floor or wallpaper look; the house builder draws it as a canvas texture. */
  colors: { main: string; second?: string; accent?: string }
  pattern: Pattern | 'wood' | 'tiles' | 'marble' | 'grass'
}

export type WeaponBaseId = 'wand' | 'sword' | 'blaster' | 'bow' | 'hammer'
export type WeaponMagicId = 'bubbles' | 'stars' | 'hearts' | 'confetti' | 'rainbow' | 'snow' | 'lightning' | 'flowers' | 'dragon'

export interface WeaponBaseDef { id: WeaponBaseId; name: string; price: number }
export interface WeaponMagicDef { id: WeaponMagicId; name: string; price: number; colors: string[] }

// ---------------------------------------------------------------- save

/** One piece of furniture the player owns. `uid` tells two identical sofas apart. */
export interface OwnedFurniture {
  uid: string
  id: string
  /** 1 plain, 2 shiny (gold trim, sparkle), 3 magic (glow, floating sparkles). */
  level: 1 | 2 | 3
}

/** A placed furniture instance in the house. */
export interface PlacedItem {
  uid: string
  /** Cell of the footprint's min corner (rotation applied). Wall items: position along the wall. */
  x: number
  z: number
  /** Quarter turns, 0–3. Wall items: which wall (0 back, 1 right, 2 front, 3 left). */
  rot: 0 | 1 | 2 | 3
  /** For `small` items standing on a surface: the uid underneath. */
  on?: string
}

export const HOUSE_W = 10
export const HOUSE_D = 8

export interface HouseLayout {
  floor: string
  wall: string
  items: PlacedItem[]
}

export interface Weapon {
  uid: string
  base: WeaponBaseId
  magic: WeaponMagicId
  /** Hex colour of the weapon itself. */
  color: string
  level: 1 | 2 | 3
  /** Generated from magic + base ("Boble-blaster"); the child may not type one. */
  name: string
}

export type ObbyLevel = 'easy' | 'medium' | 'hard'
export type ContestId = 'obby' | 'stars' | 'fashion' | 'memory'

export interface ContestRecord {
  /** Times finished (obby), played (others). */
  plays: number
  wins: number
  /** Obby: fastest seconds; stars: most stars; fashion: most stars (1–15); memory: fewest moves. */
  best: number | null
}

export interface MiniWorldSave {
  v: 1
  persons: Person[]
  /** Id of the person you play; '' before the first person exists. */
  active: string
  /** Clothing ids the player owns (every person dresses from this closet). */
  closet: string[]
  furniture: OwnedFurniture[]
  house: HouseLayout
  floors: string[]
  walls: string[]
  weapons: Weapon[]
  /** uid of the weapon in hand, or null. */
  equipped: string | null
  /** Prize ids already given once (first-win prizes, title crowns). */
  prizes: string[]
  contests: {
    obby: Record<ObbyLevel, ContestRecord>
    stars: ContestRecord
    fashion: ContestRecord
    memory: ContestRecord
  }
  /** Gift ids already opened, so a slow network cannot open one twice. */
  openedGifts: string[]
  /** Client wall clock ms of the last write (profile sync: newest wins). */
  savedAt: number
}

// ---------------------------------------------------------------- neighbourhood (server + client)

export type RoyalTitle = 'king' | 'queen' | 'prince' | 'princess'

/** What others may see of a player: their generated site name, friend code, active person and house. */
/**
 * Other players are named by their public id (`id`): stable, safe to show,
 * unrelated to the private player id in localStorage, which is the only
 * credential and never leaves its own browser.
 */
export interface PublicProfile {
  /** Public id. */
  id: string
  /** The Hall of Fame name (NEON OTTER); shown small under the person's name. */
  playerName: string
  code: string
  person: { name: string; look: PersonLook } | null
  house: HouseLayout | null
  /** Furniture levels by uid, so a visitor sees upgrades. */
  levels: Record<string, 1 | 2 | 3>
  /** Furniture catalog ids by uid (a visitor needs to know what each uid is). */
  kinds: Record<string, string>
}

export interface HoodMember {
  /** Public id. */
  id: string
  playerName: string
  person: { name: string; look: PersonLook } | null
  title: RoyalTitle | null
  /** Votes this member has for the crown. */
  votes: number
}

export interface Hood {
  id: string
  /** Generated: an adjective + a place ("Solsikkedalen"). */
  name: string
  /** Six letters to join with. */
  code: string
  members: HoodMember[]
  /** Public id of the crowned member (most votes), or null before any vote. */
  ruler: string | null
  /** Who I voted for (public id). */
  myVote: string | null
}

export type GiftKind = 'clothing' | 'furniture' | 'bits'

export interface Gift {
  id: string
  /** `id`: the sender's public id. */
  from: { id: string; playerName: string; personName: string | null }
  kind: GiftKind
  /** Catalog id for clothing/furniture; absent for bits. */
  item?: string
  /** Furniture level travels with it; bits amount for kind bits. */
  level?: 1 | 2 | 3
  amount?: number
  sentAt: number
}

export interface SocialState {
  /** My friend code and my public id (to find myself among the members). */
  me: { code: string; id: string }
  friends: PublicProfile[]
  hood: Hood | null
  inbox: Gift[]
}

// ---------------------------------------------------------------- Neon Shrine bridge

/**
 * The active person's colours for Neon Shrine's hero sprite, written to
 * localStorage `miniworld.heroColors` whenever the active person or their
 * outfit changes. Neon Shrine recolours its hero with them (hair, headband
 * → hat, shirt, belt, trousers, shoes, skin). Hex strings; each *Shade is
 * the darker two-tone partner.
 */
export interface HeroColors {
  skin: string; skinShade: string
  hair: string; hairShade: string
  /** The headband row: the hat's colour, or the hair colour when there is no hat. */
  band: string
  top: string; topShade: string; topAccent: string
  bottom: string
  shoes: string
}

export const HERO_COLORS_KEY = 'miniworld.heroColors'
