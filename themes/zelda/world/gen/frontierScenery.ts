import type { IsoLandmark } from '../../types'
import { hash } from './rng'

const prop = (art: string, x: number, y: number, details: Partial<IsoLandmark> = {}): IsoLandmark => ({ art, x, y, ...details })
const bob = { frames: 2, fps: 1, bob: true }
const cycle = (frames: number, fps: number) => ({ frames, fps })

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
        lit: { flag: `q.lumenby.lot${i + 1}`, art: `quarry_letter_${ch}_on` },
      })),
      prop('quarry_crate', 7.75, 5.5),
      prop('quarry_cart_empty', 1.25, 5.65),
    ],
    'l.deepdrift': [prop('quarry_headframe', 4.5, 1.9, { shadow: { tall: 2.2, wide: 0.52 } })],
    truck: [prop('quarry_cart_full', 2.55, 3), prop('quarry_crate', 3.65, 2.75)],
    lots: [prop('quarry_ramp_n', 8.5, 4.5), prop('quarry_vein', 9.1, 5.25)],
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
      prop('fjord_cottage', 2.5, 4.5, { cover: { x: 1, y: 3, w: 3, h: 3 } }),
      prop('fjord_cottage', 8.5, 4.5, { cover: { x: 7, y: 3, w: 3, h: 3 } }),
      prop('fjord_lantern', 5.5, 8.5, { cover: { x: 5, y: 8, w: 1, h: 1 } }),
      prop('fjord_floe_mid', 2.35, 0.7),
      prop('fjord_floe_small', 8.45, 1.35),
      prop('fjord_edge_s', 2.5, 1.75),
    ],
    boathouse: [
      prop('fjord_boathouse', 3.5, 2.5, { cover: { x: 1, y: 1, w: 5, h: 3 } }),
      prop('fjord_floe_large', 1.35, 0.5),
    ],
    lighthouse: [
      prop('fjord_lighthouse', 3.5, 3.5, { cover: { x: 2, y: 2, w: 3, h: 3 }, motion: cycle(4, 1) }),
    ],
    'q.church': [
      prop('fjord_church', 5.5, 3.05, { cover: { x: 3, y: 1, w: 5, h: 4 }, shadow: { tall: 2, wide: 1.15, deep: 1.1 } }),
    ],
  },
  stillsand: {
    island: [
      prop('stillsand_island_medium', 4.25, 5.95, { shadow: { tall: 0.8, wide: 0.72, deep: 0.59 } }),
    ],
    'q.bed': [
      prop('stillsand_lens_0', 4.5, 1.5, { lit: { flag: 'q.seed.planted', art: 'stillsand_lens_1' } }),
    ],
    'l.pyramid': [
      prop('stillsand_island_large', 2.5, 7.8, { shadow: { tall: 0.9, wide: 0.9, deep: 0.7 } }),
    ],
  },
  sporelight: {
    clickers: [
      prop('sporelight_mushroom_medium_teal', 1.5, 1.6, { shadow: { tall: 1, wide: 0.44 } }),
      prop('sporelight_mushroom_large_violet', 5.5, 1.8, { shadow: { tall: 1.6, wide: 0.72 } }),
      prop('sporelight_mushroom_small_teal', 4.7, 3.6),
      prop('sporelight_glow_moss', 1.6, 2.65),
      prop('sporelight_puff', 5.8, 3.5, { motion: cycle(3, 2) }),
    ],
    'l.steamhouse': [
      prop('sporelight_bathhouse', 6.5, 3.3, { cover: { x: 5, y: 2, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.4, deep: 1.35 } }),
      prop('sporelight_mushroom_medium_teal', 1.55, 5.45),
      prop('sporelight_mushroom_medium_violet', 11.45, 5.45),
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
      prop('fogstage_spotlight', 1.5, 11.6),
      prop('fogstage_raincheck', 10.65, 9.5, { motion: bob, shadow: { tall: 1.7, wide: 1.5, deep: 0.6 } }),
      prop('fogstage_gangway', 10.75, 10.65),
    ],
    'q.programs': [
      prop('fogstage_poster_0', 5.5, 1.55, { lit: { flag: 'q.map.p2', art: 'fogstage_poster_1' } }),
    ],
    'q.raincheck': [
      prop('fogstage_raincheck', 3.5, 2.25, { motion: bob, shadow: { tall: 1.7, wide: 1.5, deep: 0.6 } }),
      prop('fogstage_gangway', 3.5, 3.45),
      prop('fogstage_spotlight', 7.6, 1.8),
      prop('fogstage_poster_2', 6.95, 2.55, { lit: { flag: 'q.act.done', art: 'fogstage_poster_7' } }),
    ],
  },
  rerun: {
    booth: [prop('rerun_phone_booth', 1.5, 1.65, { cover: { x: 1, y: 1, w: 1, h: 1 }, shadow: { tall: 1.2, wide: 0.28 } })],
    culdesac: [
      prop('rerun_house_0', 2.5, 1.5, { cover: { x: 1, y: 0, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.35, deep: 1.4 } }),
      prop('rerun_house_1', 10.5, 1.5, { cover: { x: 9, y: 0, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.35, deep: 1.4 } }),
      prop('rerun_house_1', 2.5, 8.5, { cover: { x: 1, y: 7, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.35, deep: 1.4 } }),
      prop('rerun_house_0', 10.5, 8.5, { cover: { x: 9, y: 7, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.35, deep: 1.4 } }),
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
    prop('seter_hut', 3.5, 3.5, { cover: { x: 2, y: 2, w: 3, h: 3 }, motion: cycle(2, 2) }),
    prop('seter_byre', 7.5, 3.5, { cover: { x: 6, y: 2, w: 3, h: 3 } }),
    prop('seter_churns', 3.5, fenceY + 1.45),
    ...[1, 2, 3, 7, 8, 9].map(x => wall(x, fenceY)),
  ]
}

export function sceneryAt(realm: string, stamp: string, x: number, y: number): IsoLandmark[] {
  const scenery = SCENERY[realm]?.[stamp] ?? []
  return (stamp === 'camp' ? [...CAMP, ...scenery] : scenery).map(lm => ({
    ...lm,
    x: lm.x + x,
    y: lm.y + y,
    ...(lm.cover ? { cover: { ...lm.cover, x: lm.cover.x + x, y: lm.cover.y + y } } : {}),
  }))
}

const ROAD_TONES = ['pink', 'cyan', 'violet', 'gold', 'rose'] as const
const ROAD_VERGE = new Set(['.', ':', ';', '-'])

/** Sparse lamps on open verges. Read the completed layout without consuming its random stream. */
export function roadsideLights(rows: string[][], claimed: Uint8Array, seed: number): IsoLandmark[] {
  const w = rows[0]!.length
  const out: IsoLandmark[] = []
  for (let y = 2; y < rows.length - 2; y++) for (let x = 2; x < w - 2; x++) {
    if (rows[y]![x] !== ',' || claimed[y * w + x]) continue
    const chance = hash(seed, x, y)
    if (chance % 23 !== 0) continue
    const across = rows[y]![x - 1] === ',' || rows[y]![x + 1] === ','
    const sign = chance & 1 ? 1 : -1
    for (const side of [sign, -sign]) {
      const nx = x + (across ? 0 : side)
      const ny = y + (across ? side : 0)
      if (claimed[ny * w + nx] || !ROAD_VERGE.has(rows[ny]![nx]!)) continue
      if (out.some(p => Math.abs(p.x - nx - 0.5) + Math.abs(p.y - ny - 0.5) < 5)) continue
      const tone = ROAD_TONES[(chance >>> 8) % ROAD_TONES.length]!
      out.push(prop(`road_lantern_${tone}_off`, nx + 0.5, ny + 0.5, {
        night: `road_lantern_${tone}_on`, light: { r: 2.15, tone, a: 0.55 },
      }))
      break
    }
  }
  return out
}
