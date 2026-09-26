/**
 * Lag Din Figur — the shared contract (2026-09-26). Every module codes
 * against these types; DESIGN.md explains them. Pure data, no DOM.
 */

// ---------------------------------------------------------------- textures

/** A colour: '#rrggbb' (lower case). */
export type Hex = string

/**
 * A small pixel picture, row-major: `px[y * w + x]`, null = transparent.
 * Every garment is one, in its kind's layout (see LAYOUTS).
 */
export interface Texture {
  w: number
  h: number
  px: Array<Hex | null>
}

/** Where a garment is worn. */
export type Slot = 'top' | 'bottom' | 'shoes' | 'hat' | 'face' | 'back'

/**
 * A garment's kind: picks its layout and mask. `dress` sits in the `top`
 * slot and covers the legs (the figure's `bottom` is then not drawn).
 */
export type GarmentKind =
  | 'tee' | 'long' | 'tank' | 'hoodie' | 'shirt' // top, 16×14
  | 'dress'                                       // top slot, 16×24
  | 'pants' | 'shorts' | 'skirt' | 'leggings'     // bottom, 12×12
  | 'sneaker' | 'boot' | 'flat'                   // shoes, 6×4
  | 'hat'                                         // hat, 16×10
  | 'glasses'                                     // face, 12×4
  | 'cape' | 'wings'                              // back, 20×18

export const KIND_SLOT: Record<GarmentKind, Slot> = {
  tee: 'top', long: 'top', tank: 'top', hoodie: 'top', shirt: 'top', dress: 'top',
  pants: 'bottom', shorts: 'bottom', skirt: 'bottom', leggings: 'bottom',
  sneaker: 'shoes', boot: 'shoes', flat: 'shoes',
  hat: 'hat', glasses: 'face', cape: 'back', wings: 'back',
}

/** Texture sizes per layout. `dress` is the only top that is 24 tall. */
export const LAYOUTS = {
  top: { w: 16, h: 14 },
  dress: { w: 16, h: 24 },
  bottom: { w: 12, h: 12 },
  shoes: { w: 6, h: 4 },
  hat: { w: 16, h: 10 },
  face: { w: 12, h: 4 },
  back: { w: 20, h: 18 },
} as const

export type LayoutId = keyof typeof LAYOUTS

/** The layout a kind uses. */
export function layoutOf(kind: GarmentKind): LayoutId {
  return kind === 'dress' ? 'dress' : KIND_SLOT[kind]
}

/** Top/dress layout columns: the viewer's-left arm, the torso, the viewer's-right arm (inclusive ranges). */
export const TOP_COLS = { armL: [0, 2], torso: [3, 12], armR: [13, 15] } as const
/** Dress rows: 0–13 are the top, 14–23 the skirt. */
export const DRESS_SKIRT_ROW = 14
/** Bottom layout columns per leg (inclusive). */
export const BOTTOM_COLS = { legL: [0, 5], legR: [6, 11] } as const
/** Hat layout: the head's top sits in the last HAT_HEAD_ROWS rows. */
export const HAT_HEAD_ROWS = 4

// ---------------------------------------------------------------- catalog

export type PatternId = 'plain' | 'stripes' | 'dots' | 'heart' | 'star' | 'rainbow' | 'check' | 'sparkle'

/** A built-in garment. Its texture is generated (core/textures.ts) from these fields and the worn colours. */
export interface GarmentDef {
  id: string
  /** Norwegian, short: "T-skjorte". */
  name: string
  kind: GarmentKind
  /** Default main colour; the child may change it. */
  color: Hex
  /** Default second colour (pattern, trim, lenses); the child may change it. */
  color2: Hex
  pattern: PatternId
  /** Generator detail within the kind, e.g. hats: 'crown' | 'cap' | 'beanie' | 'cat' | …; see catalog.ts. */
  shape?: string
  /** Words Pip knows it by (lower case, bokmål), e.g. ['kjole', 'prinsessekjole']. */
  words: string[]
}

/**
 * A texture as the save stores it: `data` has one char per pixel,
 * row-major; '.' is transparent, any other char is its index in `pal`
 * written in PACK_CHARS. core/textures.ts packs and unpacks.
 */
export interface PackedTexture {
  w: number
  h: number
  pal: Hex[]
  data: string
}

/** Index chars of a PackedTexture (62; a drawn piece uses at most this many colours). */
export const PACK_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** A drawn garment: the child's own, in the save's closet. */
export interface DrawnGarment {
  /** 'd-' + 8 chars [a-z0-9]. */
  id: string
  /** 1–20 chars. */
  name: string
  kind: GarmentKind
  tex: PackedTexture
  createdAt: number
}

/** A worn piece: a catalog id or a drawn id, with the child's colours (built-ins only; drawn pieces ignore them). */
export interface Worn {
  id: string
  color?: Hex
  color2?: Hex
}

export type Outfit = Record<Slot, Worn | null>

// ---------------------------------------------------------------- figure

export type SkinId = 'porselen' | 'lys' | 'honning' | 'oliven' | 'brun' | 'mork' | 'bla' | 'gronn' | 'lilla'
export type HairStyle = 'short' | 'long' | 'ponytail' | 'pigtails' | 'curly' | 'bun' | 'spiky' | 'afro' | 'none'
export type EyeStyle = 'round' | 'happy' | 'sparkle' | 'sleepy' | 'wink' | 'star'
export type MouthStyle = 'smile' | 'grin' | 'open' | 'tongue' | 'small'
export type StyleId = 'minecraft' | 'roblox' | 'toca' | 'avatar'

export interface FigureBody {
  skin: SkinId
  hair: HairStyle
  /** '#rrggbb', or 'rainbow'. */
  hairColor: Hex | 'rainbow'
  eyes: EyeStyle
  eyeColor: Hex
  mouth: MouthStyle
  cheeks: boolean
  freckles: boolean
}

export interface Figure {
  /** 'f-' + 8 chars [a-z0-9]. */
  id: string
  /** 1–16 chars; "Figur 1" until renamed. */
  name: string
  body: FigureBody
  outfit: Outfit
  /** The style last looked at. */
  style: StyleId
}

export const MAX_FIGURES = 8
export const MAX_DRAWN = 40
export const SLOTS: readonly Slot[] = ['top', 'bottom', 'shoes', 'hat', 'face', 'back']

// ---------------------------------------------------------------- save

export interface FigurSave {
  v: 1
  figures: Figure[]
  /** Id of the active figure ('' when there are none). */
  active: string
  closet: DrawnGarment[]
  /** Client wall-clock ms of the newest change; newest wins against the profile copy. */
  savedAt: number
}

export const SAVE_KEY = 'figur.save'
/** Neon Shrine reads this before Mini World's `miniworld.heroColors`. Value: HeroColors JSON. */
export const FIGUR_HERO_KEY = 'figur.heroColors'

// ---------------------------------------------------------------- rendering

/**
 * Logical pixels a style paints into. The Stage scales it up by a whole
 * number; `px` is row-major like Texture, null = transparent.
 */
export interface PixelBuffer {
  w: number
  h: number
  px: Array<Hex | null>
}

/** Everything a style needs to paint one frame. */
export interface FigureFrame {
  buf: PixelBuffer
  figure: Figure
  /** The texture for each worn slot (already resolved: built-ins generated in the worn colours, drawn ones looked up), null when empty. `bottom` is null under a dress. */
  tex: Record<Slot, Texture | null>
  /** The kind worn in each slot (null when empty): renderers flare skirts and dresses, extend boots. */
  kind: Record<Slot, GarmentKind | null>
  /** Seconds since the stage started. */
  t: number
  pose: {
    /** 0 or 1: the idle bob, in the style's own pixels. */
    bob: number
    /** Eyes closed this frame. */
    blink: boolean
    /** 0..1, counts down after a change: a little hop and sparkles. */
    cheer: number
  }
  /** Paint the backdrop too (false: transparent, for thumbnails and exports). */
  backdrop: boolean
}

export interface FigureStyle {
  id: StyleId
  /** As the child reads it on the tab: 'MINECRAFT'. */
  label: string
  /** Short label for narrow screens: 'MINE'. */
  short: string
  /** The CSS colour around the scaled buffer (letterbox), matching the backdrop's edges. */
  bg: Hex
  /** Logical size of a full-figure frame, figure plus a little room; the Stage keeps this aspect or wider. */
  size: { w: number; h: number }
  /** Paints the frame into frame.buf (whose size may be wider/taller than `size`: centre the figure, stand it on the floor line). */
  draw(frame: FigureFrame): void
}

// ---------------------------------------------------------------- Neon Shrine

/** Re-exported so the figure's bridge and Neon Shrine share one shape. */
export type { HeroColors } from '../miniworld/types'
