import type { IsoLandmark, LandmarkLight, Tone } from '../../types'

const prop = (art: string, x: number, y: number, details: Partial<IsoLandmark> = {}): IsoLandmark => ({ art, x, y, ...details })
const bob = { frames: 2, fps: 1, bob: true }
const cycle = (frames: number, fps: number) => ({ frames, fps })
/** A light a landmark carries (`LandmarkLight`): its tone, reach, strength, and the rest. */
const light = (tone: Tone, r: number, a: number, more: Partial<LandmarkLight> = {}): LandmarkLight => ({ tone, r, a, ...more })
/** A giant cap's glow under itself, at its height: teal or lilac, breathing. */
const cap = (tone: Tone, r: number, z: number) => [light(tone, r, 0.55, { z, anim: 'pulse' })]
/**
 * Lights in front of a building stand just past its cover's south edge (`dy`): inside it the classic house's
 * mass would hide them (the light's shadows, `iso/shaders.ts`).
 */
/** A cottage's lit window spilling warm light onto the snow in front. */
const COTTAGE = [light('amber', 2.5, 0.75, { z: 0.5, dy: 1.8 })]
/** A stage spotlight's beam, swinging over the fog. */
const SPOT = [light('cream', 5.5, 0.75, { z: 1.1, anim: 'sweep' })]
/** A blimp's red light, blinking under its belly. */
const BLIMP = [light('red', 1.4, 0.8, { z: 1.2, anim: 'blink' })]
/** A poster lit for the show. */
const POSTER = [light('pink', 1.5, 0.7, { z: 0.6, dy: 0.3, lit: true })]
/** A porch light by a front door. */
const PORCH = [light('gold', 2, 0.6, { z: 0.6, dy: 1.8 })]

/** Shared stamp ids such as 'house' are scoped to a realm. Anchors and cover are in stamp tiles. */
const SCENERY: Record<string, Record<string, IsoLandmark[]>> = {
  lumenby: {
    'q.unionhall': [
      ...[...'lumenby'].map((ch, i) => prop(`quarry_letter_${ch}_off`, 0.8 + i * 1.2, 0.6, {
        z: 0.85,
        lit: { flag: `q.lumenby.lot${i + 1}`, art: `quarry_letter_${ch}_on` },
        // A lit letter spills pink on the bench under it.
        lights: [light('rose', 1.9, 0.7, { z: 0.3, dy: 0.35, lit: true })],
      })),
      prop('quarry_crate', 7.75, 5.5),
      prop('quarry_cart_empty', 1.25, 5.65),
    ],
    'l.deepdrift': [prop('quarry_headframe', 4.5, 1.9, { shadow: { tall: 2.2, wide: 0.52 }, lights: [light('red', 1.4, 0.9, { z: 2.3, anim: 'blink' }), light('amber', 2.6, 0.6, { z: 0.8, dy: 0.5 })] })],
    truck: [prop('quarry_cart_full', 2.55, 3), prop('quarry_crate', 3.65, 2.75)],
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
      prop('fjord_cottage', 2.5, 4.5, { cover: { x: 1, y: 3, w: 3, h: 3 }, lights: COTTAGE }),
      prop('fjord_cottage', 8.5, 4.5, { cover: { x: 7, y: 3, w: 3, h: 3 }, lights: COTTAGE }),
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
      prop('fjord_church', 5.5, 3.05, { cover: { x: 3, y: 1, w: 5, h: 4 }, shadow: { tall: 2, wide: 1.15, deep: 1.1 }, lights: [light('gold', 3.5, 0.75, { z: 0.6, dy: 2.25 }), light('amber', 2, 0.5, { z: 2.4, dy: 0.2 })] }),
    ],
  },
  stillsand: {
    island: [
      prop('stillsand_island_medium', 4.25, 5.95, { shadow: { tall: 0.8, wide: 0.72, deep: 0.59 } }),
    ],
    'q.bed': [
      prop('stillsand_lens_0', 4.5, 1.5, { lit: { flag: 'q.seed.planted', art: 'stillsand_lens_1' }, lights: [light('gold', 3, 0.85, { z: 1, anim: 'pulse', lit: true })] }),
    ],
    'l.pyramid': [
      prop('stillsand_island_large', 2.5, 7.8, { shadow: { tall: 0.9, wide: 0.9, deep: 0.7 } }),
    ],
  },
  sporelight: {
    clickers: [
      prop('sporelight_mushroom_medium_teal', 1.5, 1.6, { shadow: { tall: 1, wide: 0.44 }, lights: cap('teal', 3, 0.9) }),
      prop('sporelight_mushroom_large_violet', 5.5, 1.8, { shadow: { tall: 1.6, wide: 0.72 }, lights: cap('lilac', 3.6, 1.4) }),
      prop('sporelight_mushroom_small_teal', 4.7, 3.6, { lights: cap('teal', 2.2, 0.55) }),
      prop('sporelight_glow_moss', 1.6, 2.65, { lights: [light('teal', 1.5, 0.5, { z: 0.1 })] }),
      prop('sporelight_puff', 5.8, 3.5, { motion: cycle(3, 2) }),
    ],
    'l.steamhouse': [
      prop('sporelight_bathhouse', 6.5, 3.3, {
        cover: { x: 5, y: 2, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.4, deep: 1.35 },
        // Two gold lanterns at its eave posts.
        lights: [light('gold', 2.5, 0.8, { dx: -1, dy: 2, z: 0.8, anim: 'fire' }), light('gold', 2.5, 0.8, { dx: 1, dy: 2, z: 0.8, anim: 'fire' })],
      }),
      prop('sporelight_mushroom_medium_teal', 1.55, 5.45, { lights: cap('teal', 3, 0.9) }),
      prop('sporelight_mushroom_medium_violet', 11.45, 5.45, { lights: cap('lilac', 3, 0.9) }),
      prop('sporelight_puff', 11.45, 4.75, { motion: cycle(3, 2) }),
    ],
    shellyard: [prop('sporelight_grazer_calm', 2.5, 1.45, { motion: cycle(2, 1), shadow: { tall: 0.8, wide: 0.46 } })],
  },
  fogstage: {
    flats: [
      prop('fogstage_flat', 3, 1.75, { cover: { x: 2, y: 1, w: 2, h: 1 }, shadow: { tall: 1.15, wide: 0.7, deep: 0.06 } }),
      prop('fogstage_sandbags', 3.1, 2.4),
    ],
    hilltown: [
      prop('fogstage_spotlight', 1.5, 11.6, { lights: SPOT }),
      prop('fogstage_raincheck', 10.65, 9.5, { motion: bob, shadow: { tall: 1.7, wide: 1.5, deep: 0.6 }, lights: BLIMP }),
      prop('fogstage_gangway', 10.75, 10.65),
    ],
    'q.programs': [
      prop('fogstage_poster_0', 5.5, 1.55, { lit: { flag: 'q.map.p2', art: 'fogstage_poster_1' }, lights: POSTER }),
    ],
    'q.raincheck': [
      prop('fogstage_raincheck', 3.5, 2.25, { motion: bob, shadow: { tall: 1.7, wide: 1.5, deep: 0.6 }, lights: BLIMP }),
      prop('fogstage_gangway', 3.5, 3.45),
      prop('fogstage_spotlight', 7.6, 1.8, { lights: SPOT }),
      prop('fogstage_poster_2', 6.95, 2.55, { lit: { flag: 'q.act.done', art: 'fogstage_poster_7' }, lights: POSTER }),
    ],
  },
  rerun: {
    booth: [prop('rerun_phone_booth', 1.5, 1.65, { cover: { x: 1, y: 1, w: 1, h: 1 }, shadow: { tall: 1.2, wide: 0.28 }, lights: [light('ice', 2, 0.7, { z: 0.9, dy: 0.5 })] })],
    culdesac: [
      prop('rerun_house_0', 2.5, 1.5, { cover: { x: 1, y: 0, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.35, deep: 1.4 }, lights: PORCH }),
      prop('rerun_house_1', 10.5, 1.5, { cover: { x: 9, y: 0, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.35, deep: 1.4 }, lights: PORCH }),
      prop('rerun_house_1', 2.5, 8.5, { cover: { x: 1, y: 7, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.35, deep: 1.4 }, lights: PORCH }),
      prop('rerun_house_0', 10.5, 8.5, { cover: { x: 9, y: 7, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.35, deep: 1.4 }, lights: PORCH }),
      prop('rerun_mailbox', 2.65, 3.45),
      prop('rerun_station_wagon', 9.75, 3.65),
      prop('rerun_flamingo', 11.45, 4.8),
      prop('rerun_sprinkler', 10.55, 6.2, { motion: cycle(2, 2) }),
      prop('rerun_lawnmower', 2.4, 6.3),
    ],
    lot: [
      prop('rerun_mailbox', 2.6, 5.5),
      prop('rerun_flamingo', 6.6, 4.8),
    ],
    'l.drivein': [
      prop('rerun_station_wagon', 1.25, 2.8),
      prop('rerun_station_wagon', 7.75, 2.8),
    ],
  },
}

function seterFarm(fenceY: number): IsoLandmark[] {
  const wall = (x: number, y: number) => prop('seter_fence_ew', x + 0.5, y + 0.5, { cover: { x, y, w: 1, h: 1 } })
  return [
    // The hut's hearth shows at its door, and its chimney smokes (embers and smoke rise from a fire's light).
    prop('seter_hut', 3.5, 3.5, {
      cover: { x: 2, y: 2, w: 3, h: 3 }, motion: cycle(2, 2),
      lights: [light('amber', 2.6, 0.75, { z: 0.5, dy: 1.8 }), light('fire', 2.4, 0.45, { dx: -0.4, dy: -0.8, z: 2, anim: 'fire' })],
    }),
    prop('seter_byre', 7.5, 3.5, { cover: { x: 6, y: 2, w: 3, h: 3 } }),
    prop('seter_churns', 3.5, fenceY + 1.45),
    ...[1, 2, 3, 7, 8, 9].map(x => wall(x, fenceY)),
  ]
}

export function sceneryAt(realm: string, stamp: string, x: number, y: number): IsoLandmark[] {
  return (SCENERY[realm]?.[stamp] ?? []).map(lm => ({
    ...lm,
    x: lm.x + x,
    y: lm.y + y,
    ...(lm.cover ? { cover: { ...lm.cover, x: lm.cover.x + x, y: lm.cover.y + y } } : {}),
  }))
}
