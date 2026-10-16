/**
 * Space Voyagers II: the missions, as data. A mission is a route of nav
 * points from the Deep Dish (nav 0, home) and back; at each point a fight
 * waits (DESIGN.md, "A mission"). The words of the briefings and the radio
 * are in `story/`; the campaign tree that orders the missions is
 * `campaign.ts`.
 */
import type { ShipKind, SpawnGroup } from './types.ts'

export type WingmanId = 'dougie' | 'marge' | 'ridley' | 'duo'

export interface NavDef {
  name: string
  /** Kilometres from the Deep Dish. */
  at: [number, number, number]
  groups: SpawnGroup[]
}

export interface ConvoyDef {
  kind: ShipKind
  name: string
  pilot: string
}

export interface MissionDef {
  id: string
  title: string
  /** The briefing's short line. */
  tagline: string
  /** Nav 0 is home (the Deep Dish); the route is 1, 2, … and home again. */
  navs: NavDef[]
  /** Who flies with the Calzone (a wingman each). */
  wing: WingmanId[]
  /** Ships that fly the route with the Calzone and must reach home. */
  convoy?: ConvoyDef[]
  /** A ship that must be destroyed (by kind, at a nav), or ''. */
  kill?: { kind: ShipKind; nav: number }
}

const g = (kind: ShipKind, count: number, from: SpawnGroup['from'], range: number, extra: Partial<SpawnGroup> = {}): SpawnGroup => ({
  kind, count, from, range, goFor: 'player', delay: 0, ...extra,
})

/** The first sortie: three nav points, the Franchise's fighters at two, a bomber at home. */
export const FIRST_SHIFT: MissionDef = {
  id: 'firstshift',
  title: 'FIRST SHIFT',
  tagline: 'PATROL THE PARKING BELT. THREE NAV POINTS. BACK BY CLOSING.',
  wing: ['dougie'],
  navs: [
    {
      name: 'DEEP DISH',
      at: [0, 0, 0],
      groups: [
        g('hound', 1, 'far', 5200, { goFor: 'carrier', delay: 4, skill: 0.4 }),
        g('rat', 2, 'far', 4800, { delay: 4, skill: 0.35 }),
      ],
    },
    {
      name: 'NAV 1',
      at: [6, 1, -28],
      groups: [g('rat', 3, 'ahead', 2600, { skill: 0.3 })],
    },
    {
      name: 'NAV 2',
      at: [-14, -2, -46],
      groups: [
        g('rat', 2, 'ahead', 2800, { skill: 0.4 }),
        g('bear', 1, 'ahead', 3200, { skill: 0.45 }),
        g('rat', 2, 'behind', 1600, { delay: 9, skill: 0.4 }),
      ],
    },
  ],
}

export const MISSIONS: Record<string, MissionDef> = {
  firstshift: FIRST_SHIFT,
}
