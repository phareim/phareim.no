/**
 * Scenery for the lands' isometric view (`IsoLandmark`), in two parts: helpers a map writes its landmarks with,
 * and presets, the set pieces the realms' places were drawn with (a seter, the stilts, a cul-de-sac …), anchored
 * at a place's top-left tile: `sceneryAt(realm, place, x, y)`. A preset's art comes from that realm's kit
 * (`render/iso/frontierArt/`), and `cover` hides the classic tiles under it (the place's `H` houses, `F` fences),
 * which stay solid in every view. The tile patterns the presets fit are in `scripts/world-lab/stamps.ts`.
 */
import type { IsoLandmark, LandmarkLight, Tone } from '../types'

/** A landmark: art id, the ground point under its middle (tiles), and anything else it carries. */
export const prop = (art: string, x: number, y: number, details: Partial<IsoLandmark> = {}): IsoLandmark => ({ art, x, y, ...details })
export const bob = { frames: 2, fps: 1, bob: true }
/** Numbered frames `<art>_0 … _<frames-1>` played at `fps`. */
export const cycle = (frames: number, fps: number) => ({ frames, fps })
/** A light a landmark carries (`LandmarkLight`): its tone, reach, strength, and the rest. */
export const light = (tone: Tone, r: number, a: number, more: Partial<LandmarkLight> = {}): LandmarkLight => ({ tone, r, a, ...more })
/** A road lantern on a verge, dark by day and lit after dusk (the always-loaded roadside kit). */
export const lantern = (tone: 'pink' | 'cyan' | 'violet' | 'gold' | 'rose', x: number, y: number): IsoLandmark =>
  prop(`road_lantern_${tone}_off`, x, y, { night: `road_lantern_${tone}_on`, light: { r: 2.15, tone, a: 0.55 } })
/** A giant cap's glow under itself, at its height: teal or lilac, breathing. */
export const cap = (tone: Tone, r: number, z: number) => [light(tone, r, 0.55, { z, anim: 'pulse' })]
/**
 * Lights in front of a building stand just past its cover's south edge (`dy`): inside it the classic house's
 * mass would hide them (the light's shadows, `iso/shaders.ts`).
 */
/** A cottage's lit window spilling warm light onto the snow in front. */
export const COTTAGE = [light('amber', 2.5, 0.75, { z: 0.5, dy: 1.8 })]
/** A stage spotlight's beam, swinging over the fog. */
export const SPOT = [light('cream', 5.5, 0.75, { z: 1.1, anim: 'sweep' })]
/** A blimp's red light, blinking under its belly. */
export const BLIMP = [light('red', 1.4, 0.8, { z: 1.2, anim: 'blink' })]
/** A poster lit for the show. */
export const POSTER = [light('pink', 1.5, 0.7, { z: 0.6, dy: 0.3, lit: true })]
/** A porch light by a front door. */
export const PORCH = [light('gold', 2, 0.6, { z: 0.6, dy: 1.8 })]
/** The tiles a thing stands on, solid to walkers (`IsoLandmark.solid`): w × h from tile (x, y). */
export const at = (x: number, y: number, w = 1, h = 1) => ({ solid: { x, y, w, h } })

const GATE_REALMS = new Set(['lumenby', 'seterfell', 'sporelight', 'stillsand', 'fogstage', 'rerun'])

const CAMP: IsoLandmark[] = [
  prop('camp_board_cyan', 4.4, 1.05),
  prop('camp_fire', 2.1, 2.48, { motion: cycle(4, 5), light: { r: 2.2, tone: 'gold', a: 0.6 } }),
  prop('camp_tripod', 2.1, 2.48),
  prop('camp_log', 1.66, 3.11),
  prop('camp_log', 2.64, 3.05),
  prop('camp_shelter', 5.3, 0.48),
]

/** Shared stamp ids such as 'house' are scoped to a realm. Anchors and cover are in stamp tiles. */
const SCENERY: Record<string, Record<string, IsoLandmark[]>> = {
  meadow: {
    camp: [prop('meadow_bus_stop', 0.47, 1.78), prop('meadow_cart', 5.6, 2.28)],
    'q.crossroads': [
      prop('meadow_bus_stop', 3.4, 1.55),
      prop('meadow_mill', 6.51, 0.6, { motion: cycle(4, 2), shadow: { tall: 1.45, wide: 0.44 } }),
      prop('meadow_cart', 7.2, 2.6),
      prop('camp_board_pink', 7.76, 3.69),
      prop('camp_log', 4.68, 3.55), prop('camp_log', 5.84, 3.69), prop('camp_tripod', 5.5, 2.86),
      prop('camp_shelter', 3.7, 0.7),
    ],
    hamlet: [prop('meadow_mill', 6.5, 2.35, { motion: cycle(4, 2) }), prop('meadow_cart', 9.4, 5.75)],
    house: [
      prop('meadow_mill', 0.6, 2.15, { motion: cycle(4, 2) }),
      prop('meadow_hay_small', 5.8, 4.25),
    ],
    shrine: [prop('meadow_waystone', 3.5, 3.25)],
    stones: [prop('meadow_waystone', 3.5, 3.25)],
    grove: [
      prop('meadow_hay_small', 1.75, 2.8),
      prop('meadow_hay_medium', 4.5, 2.85),
      prop('meadow_hay_large', 5.55, 3.25),
    ],
  },
  landing: {
    'landing:s': [
      prop('landing_pier', 5.5, 6.5, { cover: { x: 5, y: 5, w: 1, h: 3 } }),
      prop('landing_breakwater', 1.38, 6.4),
      prop('landing_breakwater_end', 2.45, 6.4),
      prop('landing_bollard', 5.79, 7.43),
      prop('landing_bollard', 5.15, 5.58),
      prop('landing_crates', 3.7, 4.28),
      prop('landing_net_rack', 1.63, 4.15),
      prop('landing_harbour_light', 6.55, 5.35, { light: { r: 2.6, tone: 'cyan', a: 0.65 } }),
      prop('camp_board_gold', 3.45, 2.08),
    ],
  },
  lumenby: {
    'q.unionhall': [
      ...[...'lumenby'].map((ch, i) => prop(`quarry_letter_${ch}_off`, 0.8 + i * 1.2, 0.6, {
        z: 0.85,
        lit: { flag: `q.lumenby.sign${i + 1}`, art: `quarry_letter_${ch}_on` },
        // A lit letter spills pink on the bench under it.
        lights: [light('rose', 1.9, 0.7, { z: 0.3, dy: 0.35, lit: true })],
      })),
      prop('quarry_crate', 7.75, 5.5, at(7, 5)),
      prop('quarry_cart_empty', 1.25, 5.65, at(1, 5)),
    ],
    // (The headframe's legs stand either side of the shaft, solid even once a pickaxe takes the drift's rock under
    // them; the shaft between them stays the way down.)
    'l.deepdrift': [prop('quarry_headframe', 4.5, 1.9, { shadow: { tall: 2.2, wide: 0.52 }, lights: [light('red', 1.4, 0.9, { z: 2.3, anim: 'blink' }), light('amber', 2.6, 0.6, { z: 0.8, dy: 0.5 })], ...at(3, 1, 3) })],
    truck: [prop('quarry_cart_full', 2.55, 3, at(2, 2)), prop('quarry_crate', 3.65, 2.75, at(3, 2))],
    lots: [prop('quarry_ramp_n', 8.5, 4.5), prop('quarry_vein', 9.1, 5.25, { lights: [light('teal', 2.2, 0.6, { z: 0.2, anim: 'pulse' })] })],
  },
  seterfell: {
    seter: seterFarm(9),
    'q.seter': seterFarm(8),
    trollhump: [
      prop('seter_troll_big_0', 4.4, 4.8, { z: 0.85, shadow: { tall: 1.0, wide: 0.91, deep: 0.55 } }),
    ],
    mound: [
      prop('seter_troll_small_0', 2.5, 1.75, { shadow: { tall: 0.66, wide: 0.64 } }),
    ],
  },
  yulefjord: {
    stilts: [
      prop('fjord_cottage', 2.5, 4.5, { night: 'fjord_cottage_night', cover: { x: 1, y: 3, w: 3, h: 3 }, lights: COTTAGE }),
      prop('fjord_cottage', 8.5, 4.5, { night: 'fjord_cottage_night', cover: { x: 7, y: 3, w: 3, h: 3 }, lights: COTTAGE }),
      prop('fjord_lantern', 5.5, 8.5, { cover: { x: 5, y: 8, w: 1, h: 1 }, lights: [light('amber', 4.5, 0.85, { z: 1.1, anim: 'fire' })] }),
      prop('fjord_floe_mid', 2.35, 0.7),
      prop('fjord_floe_small', 8.45, 1.35),
      prop('fjord_edge_s', 2.5, 1.75),
    ],
    boathouse: [
      prop('fjord_boathouse', 3.5, 2.5, { cover: { x: 1, y: 1, w: 5, h: 3 }, lights: [light('amber', 2.6, 0.7, { z: 0.7, dy: 1.8 })] }),
      prop('fjord_floe_large', 1.35, 0.5),
    ],
    lighthouse: [
      prop('fjord_lighthouse', 3.5, 3.5, { cover: { x: 2, y: 2, w: 3, h: 3 }, motion: cycle(4, 1), lights: [light('cream', 6.5, 0.8, { z: 2.6, anim: 'sweep' }), light('amber', 2.2, 0.6, { z: 0.5, dy: 1.8 })] }),
    ],
    'q.church': [
      prop('fjord_church', 5.5, 3.05, { cover: { x: 3, y: 1, w: 5, h: 4 }, shadow: { tall: 2, wide: 1.15, deep: 1.1 }, lights: [light('gold', 2.2, 0.55, { z: 0.6, dy: 2.25 })] }),
    ],
  },
  stillsand: {
    island: [
      prop('stillsand_island_medium', 4.25, 5.95, { shadow: { tall: 0.8, wide: 0.72, deep: 0.59 }, ...at(4, 5) }),
    ],
    'q.bed': [
      prop('stillsand_lens_0', 4.5, 1.5, { lit: { flag: 'q.seed.planted', art: 'stillsand_lens_1' }, lights: [light('gold', 3, 0.85, { z: 1, anim: 'pulse', lit: true })] }),
    ],
    'l.pyramid': [
      prop('stillsand_island_large', 2.5, 7.8, { shadow: { tall: 0.9, wide: 0.9, deep: 0.7 }, ...at(1, 6, 2, 2) }),
    ],
  },
  sporelight: {
    clickers: [
      prop('sporelight_mushroom_medium_teal', 1.5, 1.6, { shadow: { tall: 1, wide: 0.44 }, lights: cap('teal', 3, 0.9), ...at(1, 1) }),
      prop('sporelight_mushroom_large_violet', 5.5, 1.8, { shadow: { tall: 1.6, wide: 0.72 }, lights: cap('lilac', 3.6, 1.4), ...at(5, 1) }),
      prop('sporelight_mushroom_small_teal', 4.7, 3.6, { lights: cap('teal', 2.2, 0.55) }),
      prop('sporelight_glow_moss', 1.6, 2.65, { lights: [light('teal', 1.5, 0.5, { z: 0.1 })] }),
      prop('sporelight_puff', 5.8, 3.5, { motion: cycle(3, 2) }),
    ],
    'l.steamhouse': [
      prop('sporelight_bathhouse', 6.5, 3.3, { night: 'sporelight_bathhouse_night',
        cover: { x: 5, y: 2, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.4, deep: 1.35 },
        // Two gold lanterns at its eave posts.
        lights: [light('gold', 2.5, 0.8, { dx: -1, dy: 2, z: 0.8, anim: 'fire' }), light('gold', 2.5, 0.8, { dx: 1, dy: 2, z: 0.8, anim: 'fire' })],
      }),
      prop('sporelight_mushroom_medium_teal', 1.55, 5.45, { lights: cap('teal', 3, 0.9), ...at(1, 5) }),
      prop('sporelight_mushroom_medium_violet', 11.45, 5.45, { lights: cap('lilac', 3, 0.9), ...at(11, 5) }),
      prop('sporelight_puff', 11.45, 4.75, { motion: cycle(3, 2) }),
    ],
    shellyard: [prop('sporelight_grazer_calm', 2.5, 1.45, { motion: cycle(2, 1), shadow: { tall: 0.8, wide: 0.46 }, ...at(2, 1) })],
  },
  fogstage: {
    flats: [
      prop('fogstage_flat', 3, 1.75, { cover: { x: 2, y: 1, w: 2, h: 1 }, shadow: { tall: 1.15, wide: 0.7, deep: 0.06 } }),
      prop('fogstage_sandbags', 3.1, 2.4, at(3, 2)),
    ],
    hilltown: [
      prop('fogstage_spotlight_0', 1.5, 11.6, { lights: SPOT, ...at(1, 11) }),
      prop('fogstage_raincheck', 10.65, 9.5, { motion: bob, shadow: { tall: 1.7, wide: 1.5, deep: 0.6 }, lights: BLIMP }),
      prop('fogstage_gangway', 10.75, 10.65),
    ],
    'q.programs': [
      prop('fogstage_poster_0', 5.5, 1.55, { lit: { flag: 'q.map.p2', art: 'fogstage_poster_1' }, lights: POSTER }),
    ],
    'q.raincheck': [
      prop('fogstage_raincheck', 3.5, 2.25, { motion: bob, shadow: { tall: 1.7, wide: 1.5, deep: 0.6 }, lights: BLIMP }),
      prop('fogstage_gangway', 3.5, 3.45),
      prop('fogstage_spotlight_3', 7.6, 1.8, { lights: SPOT, ...at(7, 1) }),
      prop('fogstage_poster_2', 6.95, 2.55, { lit: { flag: 'q.act.done', art: 'fogstage_poster_7' }, lights: POSTER }),
    ],
  },
  rerun: {
    booth: [prop('rerun_phone_booth', 1.5, 1.65, { cover: { x: 1, y: 1, w: 1, h: 1 }, shadow: { tall: 1.2, wide: 0.28 }, lights: [light('ice', 2, 0.7, { z: 0.9, dy: 0.5 })] })],
    culdesac: [
      prop('rerun_house_0', 2.5, 1.5, { night: 'rerun_house_0_night', cover: { x: 1, y: 0, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.35, deep: 1.4 }, lights: PORCH }),
      prop('rerun_house_1', 10.5, 1.5, { night: 'rerun_house_1_night', cover: { x: 9, y: 0, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.35, deep: 1.4 }, lights: PORCH }),
      prop('rerun_house_1', 2.5, 8.5, { night: 'rerun_house_1_night', cover: { x: 1, y: 7, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.35, deep: 1.4 }, lights: PORCH }),
      prop('rerun_house_0', 10.5, 8.5, { night: 'rerun_house_0_night', cover: { x: 9, y: 7, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.35, deep: 1.4 }, lights: PORCH }),
      prop('rerun_mailbox', 2.65, 3.45, at(2, 3)),
      prop('rerun_station_wagon', 9.75, 3.65, at(9, 3, 2)),
      prop('rerun_flamingo', 11.45, 4.8, at(11, 4)),
      prop('rerun_sprinkler', 10.55, 6.2, { motion: cycle(2, 2), ...at(10, 6) }),
      prop('rerun_lawnmower', 2.4, 6.3, at(2, 6)),
    ],
    lot: [
      prop('rerun_mailbox', 2.6, 5.5, at(2, 5)),
      prop('rerun_flamingo', 6.6, 4.8, at(6, 4)),
    ],
    'l.drivein': [
      prop('rerun_station_wagon', 1.25, 2.8, at(0, 2, 2)),
      prop('rerun_station_wagon', 7.75, 2.8, at(7, 2, 2)),
    ],
  },
}

function seterFarm(fenceY: number): IsoLandmark[] {
  const wall = (x: number, y: number) => prop('seter_fence_ew', x + 0.5, y + 0.5, { cover: { x, y, w: 1, h: 1 } })
  return [
    // The hut's hearth shows at its door, and its chimney smokes (embers and smoke rise from a fire's light).
    prop('seter_hut', 3.5, 3.5, { night: 'seter_hut_night',
      cover: { x: 2, y: 2, w: 3, h: 3 }, motion: cycle(2, 2),
      lights: [light('amber', 2.6, 0.75, { z: 0.5, dy: 1.8 }), light('fire', 2.4, 0.45, { dx: -0.4, dy: -0.8, z: 2, anim: 'fire' })],
    }),
    prop('seter_byre', 7.5, 3.5, { cover: { x: 6, y: 2, w: 3, h: 3 } }),
    prop('seter_churns', 3.5, fenceY + 1.45, at(3, fenceY + 1)),
    ...[1, 2, 3, 7, 8, 9].map(x => wall(x, fenceY)),
  ]
}

/** Every preset there is, as [realm, place] (the gate arches as `gate` and `gate:ew` of each realm that has them). */
export function sceneryPlaces(): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const [realm, places] of Object.entries(SCENERY)) for (const place of Object.keys(places)) out.push([realm, place])
  for (const realm of GATE_REALMS) out.push([realm, 'gate'], [realm, 'gate:ew'])
  return out
}

export function sceneryAt(realm: string, stamp: string, x: number, y: number): IsoLandmark[] {
  if (GATE_REALMS.has(realm) && (stamp === 'gate' || stamp === 'gate:ew')) {
    const road = stamp === 'gate' ? 'ns' : 'ew'
    const stem = `gate_${realm}_${road}`
    return [prop(`${stem}_off`, x + 1.5, y + 1.5, { night: `${stem}_on` })]
  }
  const scenery = SCENERY[realm]?.[stamp] ?? []
  return (stamp === 'camp' ? [...CAMP, ...scenery] : scenery).map(lm => ({
    ...lm,
    x: lm.x + x,
    y: lm.y + y,
    ...(lm.cover ? { cover: { ...lm.cover, x: lm.cover.x + x, y: lm.cover.y + y } } : {}),
    ...(lm.solid ? { solid: { ...lm.solid, x: lm.solid.x + x, y: lm.solid.y + y } } : {}),
  }))
}
