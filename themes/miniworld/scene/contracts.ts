/**
 * The seams between Mini World's parts (2026-09-26). The Vue shell
 * (Game.vue + ui/) drives the 3D runtime through `MiniWorldRuntime`; the
 * runtime builds people with `buildAvatar`, rooms with `createHouse`, and
 * the UI asks `createPreviews` for small pictures. Implementations:
 *
 *   runtime.ts   createRuntime        (world agent)
 *   avatar.ts    buildAvatar          (avatar/house agent)
 *   furniture.ts buildFurniture       (avatar/house agent)
 *   weapons.ts   buildWeaponModel     (avatar/house agent)
 *   house.ts     createHouse          (avatar/house agent)
 *   preview.ts   createPreviews       (avatar/house agent)
 *
 * Coordinates: y up, 1 unit ≈ one Roblox stud ×2 — a person is 2.6 units
 * tall (legs 1.0, torso 1.0, head 0.6 + hair). One house cell is 1.5 units.
 */
import type * as THREE from 'three'
import type {
  PersonLook, HouseLayout, OwnedFurniture, Weapon, ObbyLevel, RoyalTitle,
  WeaponMagicId, ClothingDef, FurnitureDef,
} from '../types'

// ---------------------------------------------------------------- input

/**
 * Written by the keyboard handler in the runtime and by the touch controls
 * in the UI; read by the runtime every frame. Edge flags (`jumpPressed`,
 * `actionPressed`, `usePressed`) are set by the writer and cleared by the
 * runtime after one frame.
 */
export interface InputState {
  /** Stick, -1..1, x right, y forward (away from the camera). */
  moveX: number
  moveY: number
  jump: boolean
  jumpPressed: boolean
  /** "Gå inn / Snakk / Bruk" — the context action at a door, booth, sofa. */
  actionPressed: boolean
  /** Swing / fire the weapon in hand. */
  usePressed: boolean
  /** Camera orbit from a drag, in radians this frame (accumulated by the writer). */
  camYaw: number
  camPitch: number
  /** Multiplicative zoom this frame (1 = none; pinch and wheel). */
  zoom: number
}

export function emptyInput(): InputState {
  return { moveX: 0, moveY: 0, jump: false, jumpPressed: false, actionPressed: false, usePressed: false, camYaw: 0, camPitch: 0, zoom: 1 }
}

// ---------------------------------------------------------------- places and zones

/** Where the player is. */
export type Place =
  /** `at`: arrive at a spot in town (the map's fast travel); omitted = where you left. */
  | { kind: 'town'; at?: TownSpot }
  | { kind: 'house'; edit: boolean }
  /** A friend's or neighbour's house, read-only. */
  | { kind: 'visit'; playerId: string }
  | { kind: 'obby'; level: ObbyLevel }
  | { kind: 'stars' }
  /** The fashion show's catwalk: the active person walks, three judges watch (score comes from the UI). */
  | { kind: 'catwalk' }

/** Fast-travel spots in town (world agent, additive 2026-09-26). */
export type TownSpot = 'torget' | 'butikkgata' | 'tivoliet' | 'slottet' | 'nabogata'

/** Things in town the player can walk up to. `door` zones open a panel or a place. */
export type ZoneId =
  | 'home'            // your house → Place house
  | 'clothes-shop'    // Klesbutikken → UI panel
  | 'furniture-shop'  // Møbelbutikken → UI panel
  | 'workshop'        // Verkstedet (upgrades, weapons) → UI panel
  | 'castle'          // Slottet: the neighbourhood, friends, crown → UI panel
  | 'mailbox'         // Postkassa by your house → UI panel (gifts)
  | 'booth-obby'      // → UI picks a level, then Place obby
  | 'booth-stars'     // → Place stars
  | 'booth-fashion'   // → UI fashion show (+ Place catwalk)
  | 'booth-memory'    // → UI memory game
  | 'wardrobe'        // the wardrobe inside your house → UI panel
  | `neighbor:${string}` // a neighbour's door on Nabogata (playerId) → Place visit
  | 'exit'            // a house or contest door back to town
  | `use:${string}`   // a sofa, bed, trampoline… in a house (furniture uid); the runtime handles the action itself

export interface NeighborInfo {
  playerId: string
  /** The person's name (or the player's site name when they have no person yet). */
  label: string
  title: RoyalTitle | null
  look: PersonLook | null
}

// ---------------------------------------------------------------- events

export type ObbyResult = { level: ObbyLevel; seconds: number; falls: number }
export type StarsResult = { stars: number }

export type RuntimeEvent =
  /** The zone whose action button should show (null: none). Fired on change. */
  | { type: 'near'; zone: ZoneId | null; label: string | null }
  /** The player pressed action at a zone, or walked through a door. */
  | { type: 'zone'; zone: ZoneId }
  | { type: 'place'; place: Place }
  | { type: 'obby-end'; result: ObbyResult | null }
  | { type: 'stars-end'; result: StarsResult }
  /** Live contest HUD: obby timer/checkpoint, stars count and seconds left. */
  | { type: 'hud'; text: string }
  /** A balloon popped by a weapon: a tiny reward, capped by the runtime (≤ 30 bits per session). */
  | { type: 'pop'; bits: number }
  /** House edit: the selected item (uid) or null. */
  | { type: 'select'; uid: string | null }
  /** House edit: the layout after a move, rotate or store. */
  | { type: 'layout'; layout: HouseLayout }
  /** Sitting on a sofa, sleeping in a bed, bouncing… (for a small caption). */
  | { type: 'using'; what: string | null }
  /** A sound the shell should play (audio.ts); the runtime has no audio of its own. */
  | { type: 'sfx'; name: MiniSfx; magic?: WeaponMagicId }

// ---------------------------------------------------------------- audio (themes/miniworld/audio.ts)

export type MiniMusic = 'town' | 'house' | 'obby' | 'stars' | 'fashion' | 'memory' | 'shop' | 'castle' | 'off'
export type MiniSfx =
  | 'jump' | 'land' | 'bounce' | 'splash' | 'respawn' | 'checkpoint' | 'finish'
  | 'star' | 'coin' | 'pop' | 'magic' | 'door' | 'sit'
  | 'click' | 'open' | 'close' | 'buy' | 'poor' | 'equip' | 'dress'
  | 'place' | 'pick' | 'rotate' | 'store' | 'upgrade'
  | 'flip' | 'match' | 'win' | 'fanfare' | 'gift' | 'crown' | 'judge'

/** `createMiniAudio()` in audio.ts. Silent until `unlock()` runs inside a user gesture (iOS). */
export interface MiniAudio {
  unlock(): void
  setMusic(track: MiniMusic): void
  sfx(name: MiniSfx, opts?: { magic?: WeaponMagicId }): void
  setMuted(muted: boolean): void
  readonly muted: boolean
  dispose(): void
}

// ---------------------------------------------------------------- runtime

export interface MiniWorldRuntime {
  /** Shared, mutable; the UI's touch controls write into it. */
  readonly input: InputState
  /** Canvas CSS size and device pixel ratio; safe = insets the HUD keeps clear of (CSS px). */
  resize(w: number, h: number, dpr: number): void
  /** Starts the loop. */
  start(): void
  /** Paused: no simulation, one frame still drawn on resize. */
  setPaused(paused: boolean): void
  /** The person you play. Rebuilds the avatar when the look changes. */
  setPlayer(look: PersonLook, name: string, title: RoyalTitle | null): void
  /** The weapon in hand, or null. */
  setWeapon(weapon: Weapon | null): void
  /** Your house as it is now, and what each owned uid is. */
  setHouse(layout: HouseLayout, owned: OwnedFurniture[]): void
  /** Neighbours' houses on Nabogata (in order), with their people waving outside. */
  setNeighbors(list: NeighborInfo[]): void
  /** Go somewhere. `visit` needs the house data (the UI fetched it). */
  go(place: Place, visit?: { layout: HouseLayout; owned: OwnedFurniture[]; look: PersonLook | null; name: string }): void
  readonly place: Place
  /** House edit (Place house with edit true). */
  edit: {
    /** Starts placing a stored item: it appears in the middle of the room, selected. */
    add(uid: string): void
    select(uid: string | null): void
    rotate(): void
    /** Back to storage (the layout event follows). */
    store(): void
  }
  on(handler: (e: RuntimeEvent) => void): () => void
  dispose(): void
}

export type CreateRuntime = (canvas: HTMLCanvasElement, opts: { reducedMotion: boolean; lowPower: boolean }) => MiniWorldRuntime

// ---------------------------------------------------------------- avatar

export type AvatarPose = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'sit' | 'sleep' | 'wave' | 'swing' | 'dance' | 'cheer'

export interface AvatarHandle {
  /** Feet at y = 0, facing +z. */
  readonly group: THREE.Group
  setLook(look: PersonLook): void
  /** The weapon model in the right hand, or null. */
  setHeld(weapon: Weapon | null): void
  /** A floating name tag (with a crown mark for a title), or null to hide. */
  setTag(name: string | null, title: RoyalTitle | null): void
  /** speed: 0..1 of run speed, drives the walk cycle. */
  animate(pose: AvatarPose, dt: number, speed?: number): void
  dispose(): void
}

export type BuildAvatar = (look: PersonLook) => AvatarHandle

// ---------------------------------------------------------------- furniture and weapons

export interface FurnitureHandle {
  /** Origin at the footprint's min corner on the floor, footprint along +x/+z at rotation 0. */
  readonly group: THREE.Group
  readonly def: FurnitureDef
  /** Per-frame life: the aquarium's fish, the disco ball, level 3 sparkles. */
  update(dt: number, t: number): void
  dispose(): void
}

export type BuildFurniture = (id: string, level: 1 | 2 | 3) => FurnitureHandle

export interface WeaponModelHandle {
  /** Grip at the origin, pointing along +z. */
  readonly group: THREE.Group
  /** Where the magic comes out (local). */
  readonly muzzle: THREE.Vector3
  readonly magic: WeaponMagicId
  readonly level: 1 | 2 | 3
  dispose(): void
}

export type BuildWeaponModel = (weapon: Weapon) => WeaponModelHandle

// ---------------------------------------------------------------- house

export interface HouseHandle {
  /** The room, origin at the floor's min corner; HOUSE_W × HOUSE_D cells of CELL units. */
  readonly group: THREE.Group
  /** Where you stand when you come in (world units, local to group), and the door zone. */
  readonly spawn: THREE.Vector3
  readonly door: THREE.Box3
  /** Solid boxes for the character controller (walls, furniture). */
  colliders(): THREE.Box3[]
  /** Seats, beds, trampolines… the runtime offers "Bruk" there. */
  usables(): { uid: string; use: NonNullable<FurnitureDef['use']>; at: THREE.Vector3 }[]
  setLayout(layout: HouseLayout, owned: OwnedFurniture[]): void
  /** Edit mode: grid overlay, selection outline, drag to move (pointer events on the canvas via the runtime). */
  setEdit(on: boolean): void
  select(uid: string | null): void
  /**
   * Pointer in edit mode, already turned into a ray by the runtime. Returns
   * what happened so the runtime can emit events.
   */
  pointer(kind: 'down' | 'move' | 'up', ray: THREE.Ray): { select?: string | null; layout?: HouseLayout } | null
  add(uid: string): HouseLayout | null
  rotate(): HouseLayout | null
  store(): HouseLayout | null
  update(dt: number, t: number): void
  dispose(): void
}

export type CreateHouse = (opts: { editable: boolean }) => HouseHandle

export const CELL = 1.5

// ---------------------------------------------------------------- previews for the UI

/**
 * Small pictures for the panels, rendered by one offscreen WebGL renderer
 * and cached by key. All return PNG data URLs (or '' before the first
 * render on a device without WebGL).
 */
export interface Previews {
  /** Head-and-shoulders portrait, or full body. */
  person(look: PersonLook, opts?: { full?: boolean; size?: number; pose?: AvatarPose }): string
  /** One clothing item on its own (a shirt on a hanger, shoes, a hat). */
  clothing(def: ClothingDef, size?: number): string
  furniture(id: string, level: 1 | 2 | 3, size?: number): string
  weapon(weapon: Weapon, size?: number): string
  dispose(): void
}

export type CreatePreviews = () => Previews
