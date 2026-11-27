/**
 * The Steamhouse's attendants, THE BATH and the robe (docs/games/neon-shrine.md, "The Steamhouse").
 *
 * An attendant is an `npc` with `attend` (a ghost in a robe): not a foe, no hit points, never hurt, never hurting
 * anyone, solid as any person is. It offers: the first time the hero stands or walks inside its ring in a visit, the
 * brain opens its first talk branch (the offer: a two-way ask whose first answer is NO). YES, or lingering inside the
 * ring after a NO until the clock fills, starts THE BATH: a white fade, the lobby, a robe, full hearts, and nothing
 * else touched (the flags, the deck, the purse and the items stay; what a map load always loses is lost). A visit
 * lasts until the hero leaves the room or is bathed.
 *
 * Called by one line from `stepObjects`; it also steps THE NO's window (`refuse.ts`), which lives off the same clock.
 */
import type { Npc } from '../types'
import { type Ctx } from './combat'
import { talkTo, openDialog } from './hero'
import { cellIndex, setFlag } from './map'
import { stepRefuse } from './refuse'
import { toDir } from './util'

/** The house's two maps. The robe is kept inside them and goes off at any other door. */
export const HOUSE: ReadonlySet<string> = new Set(['steamhouse', 'steamsuite'])
/** The robe's walking speed, as a share of the hero's. */
export const ROBE_SPEED = 0.8

/** The clock of lingering (first values to tune by playing). */
export const ATTEND = {
  /** Seconds inside the ring after a NO before the attendant says YES. */
  linger: 5.0,
  /** The clock turns pink for its last this many seconds: this will take you. */
  pink: 1.5,
  /** Outside the ring the clock drains this many times as fast as it fills. */
  drain: 2,
}

/** The first condition-free ask of the attendant's talk (what it says to YES). */
function askOf(c: Ctx, id: string) {
  for (const m of c.info.marks) {
    if (m.ent.t !== 'npc' || m.ent.id !== id) continue
    return m.ent.talk.find(b => b.ask)?.ask ?? null
  }
  return null
}

/** True when the hero is in a state to be offered something: standing or walking, not carrying, rolling or in the air. */
function offerable(c: Ctx): boolean {
  const h = c.s.hero
  return (h.act === 'idle' || h.act === 'walk') && !h.carry && !h.roll && !h.air && !h.auto && !c.s.hook
}

/** The brain: step every attendant of the map. */
export function stepAttendants(c: Ctx, dt: number) {
  stepRefuse(c, dt)
  const s = c.s
  const h = s.hero
  const dungeon = c.info.def.kind === 'dungeon'
  for (const n of s.map.npcs) {
    const a = n.att
    if (!a || a.mode !== 'ask') continue
    // A visit lasts until the hero leaves the room: the others forget the hero.
    if (dungeon && cellIndex(c.info, n.x, n.y) !== s.zoneIndex) { a.made = false; a.linger = false; a.clock = 0; a.muted = false; continue }
    const inside = Math.hypot(h.x - n.x, h.y - n.y) <= a.ring
    if (!a.made) {
      if (inside && offerable(c) && !s.dialog) { offer(c, n); return }
      continue
    }
    if (!a.linger || a.muted) continue
    a.clock = inside ? Math.min(ATTEND.linger, a.clock + dt) : Math.max(0, a.clock - dt * ATTEND.drain)
    if (a.clock >= ATTEND.linger) { sayYes(c, n); return }
  }
}

/** The offer: the attendant's first branch, opened by the brain. The flags it sets are set now (B closes it like NO). */
function offer(c: Ctx, n: Npc) {
  const a = n.att!
  const h = c.s.hero
  a.made = true
  a.linger = true
  a.clock = 0
  talkTo(c, n.id)
  n.dir = toDir(h.x - n.x, h.y - n.y, n.dir)
  for (const f of c.s.dialog?.after?.set ?? []) setFlag(c.s, f)
}

/** The clock is full: the attendant says its YES, and the bath begins when that is read. */
function sayYes(c: Ctx, n: Npc) {
  const ask = askOf(c, n.id)
  n.att!.clock = 0
  n.att!.linger = false
  if (!ask) { startBath(c); return }
  openDialog(c, ask.replies[1], n.look, { ...(ask.after?.[1] ?? {}), bath: true })
}

/** THE BATH, the first half: the world holds and the fade runs to white, to the lobby's pool. */
export function startBath(c: Ctx) {
  const s = c.s
  const h = s.hero
  // A bath from the Best Room starts the fight again, but the way back is the short one: the lobby's north gate opens.
  if (s.map.id === 'steamsuite') setFlag(s, 'steamhouse.back')
  s.mode = 'warp'
  s.warp = { t: 0, to: 'steamhouse', entry: 'baths', swapped: false, white: true }
  h.swing = null
  h.spin = null
  h.roll = null
  h.charge = -1
  h.vx = 0
  h.vy = 0
  h.act = 'idle'
  c.ev.push({ type: 'bath', phase: 'begin' })
}

/**
 * THE BATH, the second half, in the middle of the fade (the map has been loaded: every room's unsaved state is home):
 * hearts full, the robe on, and the lobby's attendant counts its offer as made, with no clock, so the hero is not
 * asked again the moment they come back.
 */
export function bathArrive(c: Ctx) {
  const s = c.s
  s.hero.hp = s.hero.maxHp
  s.hero.robe = true
  setFlag(s, 'steamhouse.bathed')
  for (const n of s.map.npcs) if (n.att?.mode === 'ask') { n.att.made = true; n.att.muted = true; n.att.linger = false; n.att.clock = 0 }
  c.ev.push({ type: 'bath', phase: 'arrive' })
}

/** On every map entry: the robe stays in the house only. */
export function keepRobe(s: { hero: { robe?: boolean } }, map: string) {
  if (!HOUSE.has(map)) s.hero.robe = false
}

/** The rack of hooks: A takes the robe off (instant, a small sound, no line). True when it did. */
export function hangRobe(c: Ctx): boolean {
  const h = c.s.hero
  if (!h.robe) return false
  h.robe = false
  c.ev.push({ type: 'bath', phase: 'robeOff' })
  return true
}

/** The share of the clock that has run, 0 to 1, and whether it shows pink; null when the attendant shows no clock. */
export function clockOf(n: Npc): { k: number; pink: boolean } | null {
  const a = n.att
  if (!a || a.mode !== 'ask' || !a.made || !a.linger || a.muted || a.clock <= 0) return null
  return { k: a.clock / ATTEND.linger, pink: a.clock >= ATTEND.linger - ATTEND.pink }
}
