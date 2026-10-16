/**
 * Space Voyagers II: the ten sorties, as data. A sortie is a route of nav
 * points from the Deep Dish (nav 0, home) and back; at each point a fight
 * waits, and some have a big ship parked there (DESIGN.md, "A sortie", "The
 * campaign"). The rules that run them are `mission.ts`; the words of the
 * briefings are `story/hub.ts`; the tree that orders them is `campaign.ts`.
 */
import type { ShipKind, SpawnGroup } from './types.ts'

export type WingmanId = 'dougie' | 'marge' | 'ridley' | 'duo'

export interface NavDef {
  name: string
  /** Kilometres from the Deep Dish. */
  at: [number, number, number]
  groups: SpawnGroup[]
  /** The autopilot was cut short here: an ambush (a line from Mei says so). */
  ambush?: boolean
}

export interface ConvoyDef { kind: ShipKind; name: string; pilot: string }

/** A big ship waiting at a nav point, metres from it; spawned when the Calzone arrives. */
export interface Placed {
  kind: ShipKind
  nav: number
  at: [number, number, number]
  name: string
  /** It launches fighters now and then while it lives. */
  launcher?: { group: SpawnGroup; every: number; max: number }
  /** The Hut: its vent, fixed at this point of its hull. */
  vent?: [number, number, number]
}

export type Goal =
  | { type: 'patrol' }
  | { type: 'kill'; kind: ShipKind; endOnKill?: boolean }
  | { type: 'protect'; min: number }
  | { type: 'defend'; maxLoss: number }
  | { type: 'survive'; secs: number; maxLoss: number }
  | { type: 'duel' }

export type ScriptDo = 'defect' | 'hansBack' | 'dareLeave' | 'help'

/** Something that happens a while after the Calzone reaches a nav point. */
export interface ScriptEvent { nav: number; delay: number; do: ScriptDo }

export interface MissionDef {
  id: string
  title: string
  tagline: string
  act: 1 | 2 | 3
  navs: NavDef[]
  wing: WingmanId[]
  convoy?: ConvoyDef[]
  goal: Goal
  /** The fight is at home: no route, the waves come to the Deep Dish. */
  startHome?: boolean
  /** Torpedoes on the Calzone's rack. */
  torps?: number
  placed?: Placed[]
  events?: ScriptEvent[]
}

const g = (kind: ShipKind, count: number, from: SpawnGroup['from'], range: number, extra: Partial<SpawnGroup> = {}): SpawnGroup => ({
  kind, count, from, range, goFor: 'player', delay: 0, ...extra,
})
const raid = (kind: ShipKind, count: number, from: SpawnGroup['from'], range: number, extra: Partial<SpawnGroup> = {}): SpawnGroup =>
  g(kind, count, from, range, { goFor: 'protect', ...extra })
const bomb = (count: number, delay: number, skill = 0.45): SpawnGroup => g('hound', count, 'far', 6200, { goFor: 'carrier', delay, skill })

export const FIRST_SHIFT: MissionDef = {
  id: 'firstshift', title: 'FIRST SHIFT', act: 1,
  tagline: 'PATROL THE PARKING BELT. THREE NAV POINTS. BACK BY CLOSING.',
  wing: ['dougie'],
  goal: { type: 'patrol' },
  navs: [
    {
      name: 'DEEP DISH', at: [0, 0, 0],
      groups: [bomb(1, 4, 0.4), g('rat', 2, 'far', 4800, { delay: 4, skill: 0.35 }), g('rat', 2, 'far', 4400, { delay: 18, skill: 0.4 })],
    },
    { name: 'NAV 1', at: [6, 1, -28], groups: [g('rat', 3, 'ahead', 2600, { skill: 0.3 }), g('rat', 2, 'left', 2400, { delay: 14, skill: 0.3 })] },
    {
      name: 'NAV 2', at: [-14, -2, -46],
      groups: [
        g('rat', 2, 'ahead', 2800, { skill: 0.4 }), g('bear', 1, 'ahead', 3200, { skill: 0.45 }),
        g('rat', 2, 'behind', 1600, { delay: 9, skill: 0.4 }), g('bear', 1, 'right', 3000, { delay: 24, skill: 0.45 }),
      ],
    },
  ],
}

export const CONVOY: MissionDef = {
  id: 'convoy', title: 'CONVOY', act: 1,
  tagline: 'BRING THE MOZZARELLA HOME. MARGE LEADS, TWO HAULERS FOLLOW.',
  wing: ['marge'],
  convoy: [
    { kind: 'hauler', name: 'FRESH MOZZARELLA', pilot: 'hauler' },
    { kind: 'hauler', name: 'DOUGH BALLS', pilot: 'hauler' },
  ],
  goal: { type: 'protect', min: 1 },
  navs: [
    { name: 'DEEP DISH', at: [0, 0, 0], groups: [raid('rat', 2, 'far', 4200, { delay: 3, skill: 0.4 })] },
    {
      name: 'MILE 12', at: [8, 0, -30],
      groups: [raid('rat', 3, 'ahead', 2800, { skill: 0.4 }), g('rat', 2, 'right', 2600, { skill: 0.4 }), raid('bear', 1, 'left', 3000, { delay: 14, skill: 0.45 })],
    },
    {
      name: 'MILE 40', at: [-6, 2, -55],
      groups: [raid('bear', 2, 'ahead', 3000, { skill: 0.5 }), g('rat', 2, 'ahead', 2800, { skill: 0.5 }), raid('rat', 3, 'behind', 2200, { delay: 15, skill: 0.5 }), raid('gorilla', 1, 'left', 3000, { delay: 28, skill: 0.5 })],
    },
  ],
}

export const SIEGE: MissionDef = {
  id: 'siege', title: 'OVEN UNDER SIEGE', act: 1,
  tagline: 'THE FRANCHISE IS COMING FOR THE DEEP DISH. KEEP THE BOMBERS OFF THE OVEN.',
  wing: ['dougie', 'ridley'],
  startHome: true,
  goal: { type: 'defend', maxLoss: 0.45 },
  navs: [
    {
      name: 'DEEP DISH', at: [0, 0, 0],
      groups: [
        bomb(2, 3), g('rat', 3, 'far', 4600, { delay: 3, skill: 0.45 }),
        bomb(2, 38), g('bear', 2, 'far', 4800, { delay: 38, skill: 0.5 }),
        bomb(2, 75, 0.5), g('gorilla', 1, 'far', 4400, { delay: 75, skill: 0.5 }), g('rat', 2, 'far', 4400, { delay: 75, skill: 0.5 }),
      ],
    },
  ],
}

export const TAKEOUT: MissionDef = {
  id: 'takeout', title: 'TAKE-OUT', act: 2,
  tagline: 'AN OUTLET IN THE LONG HAUL. KNOCK OUT ITS GUNS, THEN DELIVER A TORPEDO.',
  wing: ['duo'],
  torps: 2,
  goal: { type: 'kill', kind: 'outlet' },
  placed: [{ kind: 'outlet', nav: 2, at: [0, 0, -2600], name: 'OUTLET 451' }],
  navs: [
    { name: 'DEEP DISH', at: [0, 0, 0], groups: [g('rat', 2, 'far', 4400, { delay: 4, skill: 0.5 })] },
    { name: 'NAV 1', at: [10, 1, -32], groups: [g('rat', 3, 'ahead', 2600, { skill: 0.5 }), g('bear', 1, 'ahead', 3000, { skill: 0.5 })] },
    {
      name: 'THE OUTLET', at: [20, -1, -60],
      groups: [g('bear', 2, 'ahead', 2400, { skill: 0.55 }), g('rat', 2, 'ahead', 2000, { skill: 0.55 }), g('gorilla', 1, 'right', 2600, { delay: 12, skill: 0.55 }), g('rat', 2, 'behind', 1800, { delay: 25, skill: 0.55 })],
    },
  ],
}

export const SPILLED: MissionDef = {
  id: 'spilled', title: 'SPILLED SAUCE', act: 2,
  tagline: 'THE DEEP DISH IS HURT. BRING RIDLEY AND THE SPARE PARTS HOME.',
  wing: [],
  convoy: [{ kind: 'tug', name: 'NOSTALGIA', pilot: 'ridley' }],
  goal: { type: 'protect', min: 1 },
  navs: [
    { name: 'DEEP DISH', at: [0, 0, 0], groups: [bomb(1, 4, 0.45), raid('rat', 2, 'far', 4200, { delay: 4, skill: 0.45 })] },
    { name: 'THE DEPOT', at: [12, 0, -40], groups: [g('rat', 2, 'ahead', 2800, { skill: 0.5 }), raid('bear', 1, 'ahead', 3000, { skill: 0.5 }), raid('rat', 2, 'left', 2600, { delay: 12, skill: 0.5 })] },
    {
      name: '???', at: [4, 3, -18], ambush: true,
      groups: [raid('bear', 2, 'behind', 1600, { skill: 0.5 }), g('rat', 3, 'right', 1800, { skill: 0.5 }), raid('rat', 2, 'ahead', 2400, { delay: 14, skill: 0.5 })],
    },
  ],
}

export const HANS_SHOT: MissionDef = {
  id: 'hansshot', title: 'HANS SHOT FIRST', act: 2,
  tagline: 'A PATROL WITH HANS DUO. WATCH HIM.',
  wing: ['duo', 'dougie'],
  goal: { type: 'patrol' },
  events: [{ nav: 2, delay: 14, do: 'defect' }],
  navs: [
    { name: 'DEEP DISH', at: [0, 0, 0], groups: [g('rat', 2, 'far', 4400, { delay: 4, skill: 0.5 })] },
    { name: 'NAV 1', at: [-8, 0, -30], groups: [g('rat', 4, 'ahead', 2600, { skill: 0.5 })] },
    { name: 'NAV 2', at: [-20, 2, -52], groups: [g('bear', 2, 'ahead', 3000, { skill: 0.55 }), g('rat', 2, 'ahead', 2600, { skill: 0.5 })] },
    { name: 'NAV 3', at: [-8, -2, -70], groups: [g('rat', 3, 'ahead', 2600, { skill: 0.55 }), g('gorilla', 1, 'ahead', 3200, { skill: 0.55 })] },
  ],
}

export const DARE: MissionDef = {
  id: 'dare', title: 'THE DARE', act: 2,
  tagline: 'PRINCE PARMESAN WANTS YOU. ALONE. AT NAV 2.',
  wing: [],
  goal: { type: 'duel' },
  events: [{ nav: 2, delay: 12, do: 'dareLeave' }],
  navs: [
    { name: 'DEEP DISH', at: [0, 0, 0], groups: [] },
    { name: 'NAV 1', at: [6, 0, -25], groups: [g('rat', 3, 'ahead', 2600, { skill: 0.5 })] },
    {
      name: 'THE DARE', at: [14, 3, -48],
      groups: [g('parmesan', 1, 'ahead', 2600, { skill: 0.85, ace: 'parmesan' }), g('rat', 2, 'ahead', 2900, { skill: 0.5 })],
    },
  ],
}

export const BUFFET: MissionDef = {
  id: 'buffet', title: 'THE BUFFET', act: 3,
  tagline: 'THE FRANCHISE CARRIER IS EXPOSED. GUNS FIRST, THEN THREE TORPEDOES.',
  wing: ['marge', 'ridley'],
  torps: 3,
  goal: { type: 'kill', kind: 'buffet' },
  placed: [{
    kind: 'buffet', nav: 2, at: [0, 0, -3000], name: 'THE BUFFET',
    launcher: { group: g('rat', 2, 'far', 300, { skill: 0.55 }), every: 25, max: 4 },
  }],
  navs: [
    { name: 'DEEP DISH', at: [0, 0, 0], groups: [] },
    { name: 'NAV 1', at: [12, 0, -35], groups: [g('rat', 3, 'ahead', 2600, { skill: 0.55 }), g('bear', 2, 'ahead', 3000, { skill: 0.55 })] },
    { name: 'THE BUFFET', at: [28, 2, -64], groups: [g('bear', 2, 'ahead', 2200, { skill: 0.55 }), g('gorilla', 1, 'ahead', 2400, { skill: 0.55 })] },
  ],
}

export const LAST_SLICE: MissionDef = {
  id: 'lastslice', title: 'LAST SLICE', act: 3,
  tagline: 'THE FRANCHISE FOUND US. HOLD THE DEEP DISH UNTIL HELP COMES.',
  wing: ['dougie', 'ridley'],
  startHome: true,
  goal: { type: 'survive', secs: 180, maxLoss: 0.5 },
  events: [{ nav: 0, delay: 180, do: 'help' }],
  navs: [
    {
      name: 'DEEP DISH', at: [0, 0, 0],
      groups: [
        bomb(2, 3, 0.5), g('rat', 3, 'far', 4600, { delay: 3, skill: 0.5 }),
        bomb(1, 38, 0.5), g('bear', 2, 'far', 4600, { delay: 38, skill: 0.55 }),
        g('gorilla', 2, 'far', 4600, { delay: 75, skill: 0.55 }), g('rat', 2, 'far', 4400, { delay: 75, skill: 0.55 }),
        bomb(2, 110, 0.55), g('bear', 2, 'far', 4600, { delay: 110, skill: 0.55 }),
        g('rat', 4, 'far', 4400, { delay: 145, skill: 0.55 }),
      ],
    },
  ],
}

export const FINALE: MissionDef = {
  id: 'finale', title: 'HEART OF THE OVEN', act: 3,
  tagline: 'DELIVER THE VOLCANO INTO THE HUT. THIRTY MINUTES OR IT IS FREE.',
  wing: ['marge', 'ridley'],
  torps: 1,
  goal: { type: 'kill', kind: 'vent', endOnKill: true },
  events: [{ nav: 2, delay: 25, do: 'hansBack' }],
  placed: [{ kind: 'hut', nav: 2, at: [0, -700, -2600], name: 'THE HUT', vent: [0, 318, 0] }],
  navs: [
    { name: 'DEEP DISH', at: [0, 0, 0], groups: [] },
    { name: 'NAV 1', at: [-10, 0, -40], groups: [g('rat', 3, 'ahead', 2600, { skill: 0.55 }), g('bear', 2, 'ahead', 3000, { skill: 0.55 })] },
    {
      name: 'THE HUT', at: [-25, -5, -80],
      groups: [
        g('parmesan', 1, 'ahead', 2400, { skill: 0.75, ace: 'parmesan' }), g('rat', 3, 'ahead', 2600, { skill: 0.6 }),
        g('bear', 2, 'left', 2600, { delay: 30, skill: 0.6 }), g('rat', 3, 'behind', 2200, { delay: 55, skill: 0.6 }),
      ],
    },
  ],
}

export const MISSIONS: Record<string, MissionDef> = {
  firstshift: FIRST_SHIFT, convoy: CONVOY, siege: SIEGE, takeout: TAKEOUT, spilled: SPILLED,
  hansshot: HANS_SHOT, dare: DARE, buffet: BUFFET, lastslice: LAST_SLICE, finale: FINALE,
}
