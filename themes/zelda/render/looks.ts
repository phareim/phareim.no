/**
 * The frontier's realm looks (`MapDef.look`): how a realm's map is painted,
 * as tables. Every look has a row in each table (`tests/zelda-looks.test.mjs`).
 * The maps that carry no such look (the town, the coast, the Wildwood, the
 * labs) never read them, so they are drawn exactly as before.
 *
 * - `CLASSIC`: the classic painter's palette (`tiles.ts`) over the coast's.
 *   Each ground keeps to the colour family the 16-bit view's ground shader
 *   recognises for the material slot it is laid in (`GROUND`, `fits` in
 *   `iso/shaders.ts`): a lawn slot cool (blue over red, green over red), a
 *   path slot magenta (red and blue over green), a sand slot warm, water deep
 *   and blue. Rock stays violet (the cliff's material replaces it).
 * - `GROUND`: which material slot (`iso/materials.ts`) each ground takes in
 *   the 16-bit view; the look repaints those slots (`LOOK_SHEETS`).
 * - `MOOD`: the 16-bit view's light, air and sky for the look (`iso/view.ts`).
 *
 * Plants and the land beyond the edge have a look of their own in
 * `iso/flora.ts` and `iso/backdrop.ts`, named as here.
 */
import type { Material } from './iso/materials'

export type RealmLook = 'snow' | 'dune' | 'spore' | 'fog' | 'quarry' | 'suburb'
export const REALM_LOOKS: readonly RealmLook[] = ['snow', 'dune', 'spore', 'fog', 'quarry', 'suburb']

/** The realm look a map's `look` names, or null (the coast, the Wildwood, the labs). */
export function realmLook(look: string | undefined): RealmLook | null {
  return look && (REALM_LOOKS as readonly string[]).includes(look) ? look as RealmLook : null
}

/**
 * The classic palette over the coast's (`OW` in `tiles.ts`): the grass (g0 body, g1 light patch, g2 dark
 * patch, g3 shade, blade, tip, bloom), path, sand, crowns (canopy*, moon* the second mood, rim), trunks, rock,
 * plateau (a cliff's top), water, bushes (bush*, berry), tall grass (tall*).
 */
export const CLASSIC: Record<RealmLook, Record<string, string>> = {
  // Snow white-blue with violet shade; lilac packed paths; snow-laden pines; ice-blue water.
  snow: {
    g0: '#9fb4dc', g1: '#b0c2e6', g2: '#8a9ad0', g3: '#6f78b8', blade: '#a9bce6', tip: '#b0c2ea', bloom: '#9ff4ff',
    path: '#9a80b0', pathL: '#b096c4', pathD: '#7a6494', pebble: '#c8b4dc',
    canopyD: '#1c2a52', canopyM: '#2a4070', canopyL: '#c8d8f4', canopyH: '#ffffff', rim: '#c86ab8',
    moonD: '#232a5c', moonM: '#33427e', moonL: '#5a6cb0', moonH: '#d6e2ff',
    rock: '#6e64a8', rockL: '#a8a4d8', rockD: '#463c7c', rockDD: '#2c2458', plateau: '#a0b4dc', plateauL: '#b2c4e6',
    water: '#14306a', waterD: '#0c2152', bank: '#6c8ed0', foam: '#e4f4ff',
    bush: '#2a4a78', bushL: '#c8d8f4', bushD: '#1a2c52', bushO: '#10183a', berry: '#ff5f8a',
    tallD: '#5a6a9a', tallM: '#8494c4', tallL: '#d0dcf4',
    sand: '#9a8494', sandL: '#b29aa8', sandD: '#7a6676', sandW: '#4e4060',
  },
  // Pastel peach dunes on rose hardpan; lilac stone; pink-crowned desert trees; a turquoise oasis.
  dune: {
    g0: '#b48c9c', g1: '#c49eac', g2: '#9c7488', g3: '#7a5670', blade: '#d4a890', tip: '#f0d0a0', bloom: '#ff8ae0',
    path: '#9c88b4', pathL: '#b4a2c8', pathD: '#78668e', pebble: '#d0c0e0',
    canopyD: '#5a1a4c', canopyM: '#9a2a78', canopyL: '#d04a9c', canopyH: '#ff9ad4', rim: '#ffd08a',
    moonD: '#5a4a6a', moonM: '#8a7090', moonL: '#b89ab4', moonH: '#e8d0e0',
    trunk: '#5a3a4a', trunkD: '#3a2230',
    rock: '#6a5a90', rockL: '#9a8abc', rockD: '#463a6c', rockDD: '#2e2450', plateau: '#7a6aa0', plateauL: '#9484b8',
    water: '#0e5466', waterD: '#0a3e52', bank: '#5ab8b0', foam: '#c8fff0',
    bush: '#8a5a70', bushL: '#c88aa0', bushD: '#5a3450', bushO: '#3a1c34', berry: '#ffd23f',
    tallD: '#8a6458', tallM: '#b88c6c', tallL: '#ecc890',
    sand: '#e0a890', sandL: '#ecb89c', sandD: '#c48a80', sandW: '#8a6070',
  },
  // Teal-indigo moss, violet flags, giant caps lit cyan and violet, dark pools.
  spore: {
    g0: '#1c3c50', g1: '#244a5e', g2: '#162c44', g3: '#101e36', blade: '#2e7a7a', tip: '#6ff6e8', bloom: '#8ffce0',
    path: '#5a4478', pathL: '#6e5690', pathD: '#3e2e58', pebble: '#8a70b0',
    canopyD: '#1a2a6a', canopyM: '#2a5aa0', canopyL: '#3ad0d8', canopyH: '#b4fbff', rim: '#ff5fd0',
    moonD: '#3a1a6a', moonM: '#6a30a8', moonL: '#a858e0', moonH: '#f0a8ff',
    trunk: '#8a7aa8', trunkD: '#5a4a78',
    rock: '#4a3c7a', rockL: '#6a5aa0', rockD: '#30245a', rockDD: '#1e1640', plateau: '#1a3a4e', plateauL: '#24485c',
    water: '#0c1c4a', waterD: '#08123a', bank: '#2a4a8a', foam: '#6ff6ff',
    bush: '#6a3a8a', bushL: '#c87ae0', bushD: '#3a1e5a', bushO: '#1e1038', berry: '#6ff6ff',
    tallD: '#1a4a5a', tallM: '#2a8a8a', tallL: '#8ffce0',
    sand: '#7e6672', sandL: '#94788a', sandD: '#5e4a58', sandW: '#3a2a48',
  },
  // A pink-grey lowland under the fog, mauve cobbles, green turf on the hilltops, violet water.
  fog: {
    g0: '#8a7088', g1: '#9a8098', g2: '#745c76', g3: '#5a4460', blade: '#a88ca4', tip: '#c4a8c0', bloom: '#ffd23f',
    path: '#8a6478', pathL: '#a87c90', pathD: '#644658', pebble: '#c49aac',
    canopyD: '#14303c', canopyM: '#1e5050', canopyL: '#3a8a6c', canopyH: '#9ae0b0', rim: '#ff6fb0',
    moonD: '#2a1f4c', moonM: '#3f3070', moonL: '#6a58a8', moonH: '#b0a4fa',
    plateau: '#24504a', plateauL: '#2e6458',
    water: '#1e1a5a', waterD: '#141040', bank: '#5a4a9a', foam: '#ffb4e0',
    bush: '#2a5a4a', bushL: '#5aa07a', bushD: '#163a34', bushO: '#0e2424', berry: '#ffd23f',
    tallD: '#4a3a5a', tallM: '#7a5a7a', tallL: '#c89ab8',
    sand: '#a08088', sandL: '#b8949c', sandD: '#806670', sandW: '#4e3c58',
  },
  // Ochre benches and rose topsoil, violet bench stone, rust-pines with violet needles, cyan rainwater.
  quarry: {
    g0: '#8a5a6c', g1: '#9a687a', g2: '#704a5a', g3: '#553648', blade: '#b88a5a', tip: '#e0b070', bloom: '#ffd23f',
    path: '#7a5a74', pathL: '#94708c', pathD: '#5a4058', pebble: '#b08aa4',
    canopyD: '#1e1440', canopyM: '#3a2868', canopyL: '#6a4a9a', canopyH: '#b48ae0', rim: '#ff8a4a',
    moonD: '#2a1430', moonM: '#4a2440', moonL: '#7a3a50', moonH: '#d07a60',
    trunk: '#6a3a30', trunkD: '#401f20',
    rock: '#664a7c', rockL: '#8a689e', rockD: '#442c58', rockDD: '#2a1a3c', plateau: '#7a5a8e', plateauL: '#8e6aa0',
    water: '#104a6e', waterD: '#0a3452', bank: '#3a8ab0', foam: '#9ff4ff',
    bush: '#6a5a3a', bushL: '#b0905a', bushD: '#3e3024', bushO: '#241a18', berry: '#ff8a4a',
    tallD: '#6a4a3a', tallM: '#a07a4a', tallL: '#e0b870',
    sand: '#b87850', sandL: '#d09060', sandD: '#8a5440', sandW: '#5a3448',
  },
  // A trimmed lawn, pink pavers, round green trees and yellow-green hedges, a cyan pool.
  suburb: {
    g0: '#2f7a5a', g1: '#3a8a62', g2: '#286c52', g3: '#1e5446', blade: '#4aa070', tip: '#7ad890', bloom: '#ff5fd0',
    path: '#a07890', pathL: '#b890a8', pathD: '#7e5a74', pebble: '#d4b0c4',
    canopyD: '#14403a', canopyM: '#22704a', canopyL: '#4aa85a', canopyH: '#b4e484', rim: '#ff7ab0',
    moonD: '#5a2a5a', moonM: '#94407e', moonL: '#d070a8', moonH: '#ffc0e0',
    plateau: '#2a6a52', plateauL: '#348060',
    water: '#0e4e82', waterD: '#0a3a6a', bank: '#7ad0f0', foam: '#e8ffff',
    bush: '#5a8a3a', bushL: '#a8d060', bushD: '#2e5a2e', bushO: '#163a20', berry: '#ff5fd0',
    tallD: '#2a6a4a', tallM: '#4a9a5a', tallL: '#a8e070',
    sand: '#c49a7c', sandL: '#d8b094', sandD: '#a07c64', sandW: '#6a5060',
  },
}

/**
 * The 16-bit view's ground for each look: the material slot (`iso/materials.ts`) its grass, paths and sand
 * are laid in, and the one a cliff's top takes. The slot decides which family of classic colours the ground
 * shader takes for that ground (`fits`); what the slot looks like is the look's own sheet (`LOOK_SHEETS`).
 */
export const GROUND: Record<RealmLook, { grass: Material; path: Material; sand: Material; top: Material }> = {
  snow: { grass: 'grass', path: 'cobbles', sand: 'sand', top: 'grass' },
  dune: { grass: 'cobbles', path: 'lane', sand: 'sand', top: 'rockface' },
  spore: { grass: 'moss', path: 'lane', sand: 'sand', top: 'moss' },
  fog: { grass: 'cobbles', path: 'lane', sand: 'sand', top: 'grass' },
  quarry: { grass: 'cobbles', path: 'lane', sand: 'sand', top: 'sand' },
  suburb: { grass: 'grass', path: 'cobbles', sand: 'sand', top: 'grass' },
}

export type Particles = 'snow' | 'spores' | 'dust' | 'petals' | 'none'

/** The 16-bit view's light and air for a look, laid over the hour's (`iso/view.ts`). */
export interface Mood {
  /** The backdrop's dusk: its colour high up and at the horizon (the hour grades it as it grades the coast's). */
  sky: [string, string]
  /** Open water's deep colour. */
  water: string
  /** The far haze: a multiple of the view's own, and its colour mixed into the hour's this much. */
  haze: number
  hazeColor: string
  hazeMix: number
  /** Mist on the low ground (the Wildwood's is 1, the coast's 0.3) and its colour. */
  mist: number
  mistColor: string
  /** Where the hero walks the ground fog parts, this many tiles round (0: it does not). */
  clear: number
  /** Shafts of the low sun: a multiple of the view's own. */
  rays: number
  /** What multiplies the ambient light and the sun's colour; how much longer shadows fall; the shadow's colour. */
  ambient: [number, number, number]
  sun: [number, number, number]
  shadowLength: number
  shadowColor: string
  /** What drifts in the air, its colours, and how many at once. */
  particles: Particles
  colors: string[]
  count: number
  /** The leaves the wind carries (two colours), or none. */
  leaves: [string, string] | null
}

export const MOOD: Record<RealmLook, Mood> = {
  // A cold low sun, long blue shadows, light snow falling.
  snow: {
    sky: ['#1c1e5e', '#7a7ae0'], water: '#123a6c', haze: 1.2, hazeColor: '#9fb8ff', hazeMix: 0.7,
    mist: 0.25, mistColor: '#8aa0e0', clear: 0, rays: 0.3,
    ambient: [0.92, 0.98, 1.12], sun: [0.85, 0.95, 1.15], shadowLength: 1.6, shadowColor: '#3a3aa8',
    particles: 'snow', colors: ['#ffffff', '#d6e2ff', '#b4c4ff'], count: 70, leaves: null,
  },
  // A warm haze over pastel dunes, quartz glinting.
  dune: {
    sky: ['#5a3a8a', '#ffb08a'], water: '#0e7088', haze: 1.6, hazeColor: '#ffb89a', hazeMix: 0.75,
    mist: 0, mistColor: '#ffc0a0', clear: 0, rays: 0.6,
    ambient: [1.1, 1.06, 1.04], sun: [1.08, 1, 0.92], shadowLength: 1.3, shadowColor: '#7a4a9a',
    particles: 'dust', colors: ['#ffe0c0', '#ffc0b0'], count: 26, leaves: null,
  },
  // Always dusk under the caps: a dim green ambient, glowing spores drifting up.
  spore: {
    sky: ['#120c3a', '#3a6aa0'], water: '#0a1e48', haze: 0.8, hazeColor: '#5a40b0', hazeMix: 0.8,
    mist: 0.9, mistColor: '#4a3aa0', clear: 0, rays: 0,
    ambient: [0.72, 0.9, 0.92], sun: [0.4, 0.55, 0.6], shadowLength: 0.8, shadowColor: '#1a2a5a',
    particles: 'spores', colors: ['#6ff6ff', '#8ffce0', '#ff8ae0', '#c8a0ff'], count: 34, leaves: null,
  },
  // Rose ground fog that parts round the hero; the hilltops stand clear of it.
  fog: {
    sky: ['#3a1a5a', '#ff7ab8'], water: '#1c1650', haze: 1.4, hazeColor: '#ff8ac0', hazeMix: 0.85,
    mist: 1.8, mistColor: '#e888b8', clear: 3.2, rays: 0.2,
    ambient: [1.02, 0.94, 1.0], sun: [1, 0.85, 0.95], shadowLength: 0.9, shadowColor: '#5a2a7a',
    particles: 'none', colors: [], count: 0, leaves: ['#ff8ac0', '#c8a0ff'],
  },
  // A dusty ochre afternoon: dust on the air, the sun low and orange.
  quarry: {
    sky: ['#3a1a5a', '#ff8a4a'], water: '#0e4a72', haze: 1.3, hazeColor: '#ffa060', hazeMix: 0.7,
    mist: 0.3, mistColor: '#c07a5a', clear: 0, rays: 0.7,
    ambient: [1.04, 0.98, 0.94], sun: [1.15, 0.92, 0.75], shadowLength: 1.2, shadowColor: '#4a2a6a',
    particles: 'dust', colors: ['#ffb070', '#e0905a', '#ffd0a0'], count: 40, leaves: null,
  },
  // A bright eighties afternoon: warm sun, violet shadows, cut grass on the wind.
  suburb: {
    sky: ['#3a4ab0', '#ffb0d0'], water: '#127ab8', haze: 0.7, hazeColor: '#ffc0e0', hazeMix: 0.5,
    mist: 0, mistColor: '#c0a0e0', clear: 0, rays: 0.5,
    ambient: [1.22, 1.14, 1.06], sun: [1.15, 1.02, 0.88], shadowLength: 1.15, shadowColor: '#6a4aa8',
    particles: 'petals', colors: ['#ffb0e0', '#ffffff', '#b4e484'], count: 14, leaves: ['#7ad890', '#ff9ad4'],
  },
}

/** A hex colour's brightness as the shaders reckon it (0–1). */
export function lumaOf(hex: string): number {
  const v = parseInt(hex.slice(1, 7), 16)
  return (((v >> 16) & 255) * 0.299 + ((v >> 8) & 255) * 0.587 + (v & 255) * 0.114) / 255
}
