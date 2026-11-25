/**
 * Field battles: the fight itself (mode 'battle', `GameState.battle`).
 *
 * Start: the party walks to a stance facing the foes where everyone stands
 * and the camera eases to frame them (phase 'intro'). Fight: every
 * fighter's time gauge fills (Wait mode: nothing fills while a menu is open
 * or an action plays); full gauges queue up in the order they filled. A
 * party member at the head of the queue gets the menu (STRIKE · TECH · ITEM
 * · FLEE), a foe plays its next move. A combo tech needs every member it
 * names with a full gauge, and spends all of their turns. End: the last foe
 * falls (bits, maybe a heart dropped on the field, the group's prize), the
 * party runs (the foes are winded for a while), or the hero falls (the
 * usual death). Pure and deterministic: chance goes through state.rng.
 */
import type {
  BattleAction, BattleElement, BattleItem, BattleMenu, BattlePick, BattleState, BattleStatus, Enemy, Fighter, Input,
  MemberId, TechId, Vec,
} from '../../types'
import { HERO_R, MAX_BITS, SPIN_TIME, SWING_TIME } from '../../types'
import { acquire, rollDrop, type Ctx } from '../combat'
import { has, setFlag, tileAt } from '../map'
import { rnd, toDir } from '../util'
import { combosOf, FOES, PARTY, TECHS, TP_MAX, TP_START, type TechDef } from './data'
import { freeSpot } from './field'

/** The walk into place, and the run out of a fight (s). */
export const INTRO_TIME = 0.55
export const OUTRO_TIME = 0.7
/** How long winded foes stand after the party ran (s): they start no fight meanwhile. */
export const WINDED_TIME = 4

const WEAK = 1.5
const RESIST = 0.5
const BROKEN = 1.5
const GUARDED = 0.25

const smooth = (t: number) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k) }

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

/** The party as it stands now: the hero, and Luna when she follows. */
function partyOf(c: Ctx): MemberId[] {
  return c.s.luna ? ['hero', 'luna'] : ['hero']
}

/**
 * Begin the fight with group `id` where everyone stands. `first`: 'party' when the hero's blade (or a bomb,
 * the disc…) struck first, 'foes' when the group saw the hero coming, null on plain contact.
 */
export function startBattle(c: Ctx, id: string, first: 'party' | 'foes' | null) {
  const s = c.s
  const def = c.info.def.battle?.groups.find(g => g.id === id)
  if (!def || s.mode !== 'play') return
  const foes = s.map.enemies.filter(e => e.group === id && !e.dead)
  if (!foes.length) return
  const h = s.hero
  const fx = foes.reduce((a, e) => a + e.x, 0) / foes.length
  const fy = foes.reduce((a, e) => a + e.y, 0) / foes.length
  let ax = h.x - fx
  let ay = h.y - fy
  const al = Math.hypot(ax, ay)
  if (al < 1e-3) { ax = 0; ay = 1 } else { ax /= al; ay /= al }
  const spread = Math.max(0, ...foes.map(e => Math.hypot(e.x - fx, e.y - fy)))
  const reach = Math.max(2.2, spread + 1.7)
  const heroAt = freeSpot(c.w, s.map, fx + ax * reach, fy + ay * reach, HERO_R) ?? { x: h.x, y: h.y }
  const from: Record<string, Vec> = { hero: { x: h.x, y: h.y } }
  const fighters: Fighter[] = []
  const party = partyOf(c)
  const r = () => rnd(s)
  const atbOf = (side: 'party' | 'foe') => first === 'party' ? (side === 'party' ? 1 : 0)
    : first === 'foes' ? (side === 'party' ? 0 : 0.5 + r() * 0.3) : r() * 0.3
  for (const m of party) {
    let home = heroAt
    if (m !== 'hero') {
      // Beside the hero, on the side she is nearer, a little further back.
      const px = -ay
      const py = ax
      const L = s.luna!
      const side = (L.x - heroAt.x) * px + (L.y - heroAt.y) * py >= 0 ? 1 : -1
      home = freeSpot(c.w, s.map, heroAt.x + px * side * 1.2 + ax * 0.5, heroAt.y + py * side * 1.2 + ay * 0.5, HERO_R)
        ?? freeSpot(c.w, s.map, heroAt.x - px * side * 1.2 + ax * 0.5, heroAt.y - py * side * 1.2 + ay * 0.5, HERO_R)
        ?? { x: heroAt.x + ax * 0.8, y: heroAt.y + ay * 0.8 }
      from[m] = { x: L.x, y: L.y }
    }
    const hp = m === 'hero' ? h.hp : PARTY[m].hp ?? 6
    fighters.push({ id: m, side: 'party', member: m, hp, maxHp: m === 'hero' ? h.maxHp : hp, atb: atbOf('party'), tp: TP_START, home: { ...home }, status: {}, down: false, turns: 0, flash: 0 })
  }
  for (const e of foes) {
    const f = e.ai.foe as keyof typeof FOES
    const d = FOES[f]
    fighters.push({ id: e.id, side: 'foe', foe: f, hp: d.hp, maxHp: d.hp, atb: atbOf('foe'), tp: 0, home: { x: e.x, y: e.y }, status: {}, down: false, turns: 0, flash: 0 })
    from[e.id] = { x: e.x, y: e.y }
    e.ai.mode = 'idle'
    e.ai.tell = 0
    e.knock = null
    e.dir = toDir(heroAt.x - e.x, heroAt.y - e.y, e.dir)
  }
  // The middle of the fight, a touch toward the party so the menu by the hero is in view.
  const all = fighters.map(f => f.home)
  const cx = all.reduce((a, p) => a + p.x, 0) / all.length
  const cy = all.reduce((a, p) => a + p.y, 0) / all.length
  const b: BattleState = {
    group: id, phase: 'intro', t: 0, first, fighters, queue: [], act: null, menu: null, pops: [], from,
    cam: { x: h.x, y: h.y }, camFrom: { x: h.x, y: h.y }, camTo: { x: cx, y: cy }, tries: 0, bits: 0, axis: { x: ax, y: ay },
  }
  s.battle = b
  s.mode = 'battle'
  // What was in the air comes down: the hook, the disc, a pot held up, the shots.
  s.hook = null
  s.disc = null
  if (h.carry) { c.ev.push({ type: 'shatter', x: h.x, y: h.y - 0.6, kind: h.carry }); h.carry = null }
  h.swing = null
  h.spin = null
  h.charge = -1
  h.knock = null
  h.vx = 0
  h.vy = 0
  h.act = 'walk'
  h.actT = 0
  s.map.projectiles.length = 0
  s.map.bombs.length = 0
  s.map.thrown.length = 0
  if (first === 'party') pop(b, heroAt.x, heroAt.y, 'FIRST STRIKE', 'info')
  else if (first === 'foes') pop(b, fx, fy, 'AMBUSH', 'hurt')
  const boss = def.foes.some(f => f === 'knight')
  c.ev.push({ type: 'battle', what: 'start', track: def.track ?? c.info.def.battle?.track ?? 'boss', boss })
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

export function stepBattle(c: Ctx, dt: number, inp: Input) {
  const s = c.s
  const b = s.battle
  if (!b) { s.mode = 'play'; return }
  b.t += dt
  for (const p of b.pops) p.t += dt
  b.pops = b.pops.filter(p => p.t < 1)
  for (const f of b.fighters) if (f.flash > 0) f.flash = Math.max(0, f.flash - dt)
  const h = s.hero
  if (h.invuln > 0) h.invuln = Math.max(0, h.invuln - dt)
  if (h.act === 'hurt' && (h.actT += dt) > 0.3) { h.act = 'idle'; h.actT = 0 }
  if (s.luna && s.luna.psi > 0) s.luna.psi = Math.max(0, s.luna.psi - dt)
  for (const e of s.map.enemies) if (e.group === b.group && e.flash > 0) e.flash -= dt

  switch (b.phase) {
    case 'intro': {
      const k = smooth(b.t / INTRO_TIME)
      for (const f of b.fighters) {
        if (f.side !== 'party') continue
        const a = b.from[f.id] ?? f.home
        put(c, f, a.x + (f.home.x - a.x) * k, a.y + (f.home.y - a.y) * k)
      }
      h.walkT += dt
      if (s.luna) s.luna.walkT += dt
      b.cam = lerp(b.camFrom, b.camTo, k)
      if (b.t >= INTRO_TIME) {
        b.phase = 'fight'
        b.t = 0
        h.act = 'idle'
        if (s.luna) s.luna.walkT = 0
        face(c)
      }
      return
    }
    case 'fight': return fight(c, b, dt, inp)
    case 'won': case 'fled': return outro(c, b, dt)
    case 'lost': return
  }
}

function fight(c: Ctx, b: BattleState, dt: number, inp: Input) {
  if (b.act) { playAction(c, b, b.act, dt); return }
  if (b.menu) { menuInput(c, b, b.menu, inp); return }
  // Time runs: gauges fill, statuses wear off.
  for (const f of b.fighters) {
    if (f.down) continue
    tickStatus(c, b, f, dt)
    if (f.down) continue
    if (b.phase !== 'fight') return
    if (f.atb < 1) {
      const st = f.status
      const rate = st.stun ? 0 : (st.slow ? 0.5 : 1) * (st.static && f.side === 'party' ? 0.7 : 1)
      f.atb = Math.min(1, f.atb + (rate * dt) / waitOf(c, f))
    }
    if (f.atb >= 1 && !b.queue.includes(f.id)) b.queue.push(f.id)
  }
  checkEnd(c, b)
  if (b.phase !== 'fight') return
  // The head of the queue acts.
  b.queue = b.queue.filter(id => { const f = fighter(b, id); return !!f && !f.down && f.atb >= 1 })
  const next = b.queue[0]
  if (!next) return
  const f = fighter(b, next)!
  if (f.side === 'party') openMenu(c, b, f)
  else foeTurn(c, b, f)
}

function waitOf(c: Ctx, f: Fighter): number {
  if (f.side === 'party') return PARTY[f.member!].wait
  return FOES[f.foe!].wait
}

/** Statuses run down; static stings each whole second. */
function tickStatus(c: Ctx, b: BattleState, f: Fighter, dt: number) {
  for (const k of Object.keys(f.status) as BattleStatus[]) {
    const before = f.status[k]!
    const after = before - dt
    if (k === 'static' && f.side === 'foe' && Math.ceil(after) < Math.ceil(before) && after > -1e-9) {
      const e = enemyOf(c, f)
      const dmg = wet(c, f) ? 4 : 2
      if (e) { c.ev.push({ type: 'shock', x: e.x, y: e.y }) }
      harmFoe(c, b, f, dmg, 'hit')
    }
    if (after <= 0) delete f.status[k]
    else f.status[k] = after
  }
}

// ---------------------------------------------------------------------------
// The menu
// ---------------------------------------------------------------------------

export interface MenuLine { label: string; ok: boolean; cost?: number; count?: number }

/** What the open menu shows: the lines of its list, the cursor, and the fighters the target cursor covers. */
export function menuView(s: { battle?: BattleState | null; inv: { tonics: number; bombs: number; bombBag: boolean } }): null | {
  who: string; level: BattleMenu['level']; lines: MenuLine[]; cursor: number; targets: string[]; target: string | null
} {
  const b = s.battle
  const m = b?.menu
  if (!b || !m) return null
  const me = fighter(b, m.who)!
  const level = m.level === 'target' ? (m.pending?.from ?? 'top') : m.level
  const lines = linesOf(b, s.inv, me, level)
  const cursor = m.level === 'target' ? (m.pending?.from === 'top' ? m.top : m.pending?.sub ?? 0) : m.cursor
  return { who: m.who, level: m.level, lines, cursor, targets: m.level === 'target' ? covered(b, m) : [], target: m.level === 'target' ? m.target : null }
}

function linesOf(b: BattleState, inv: { tonics: number; bombs: number; bombBag: boolean }, me: Fighter, level: 'top' | 'tech' | 'item'): MenuLine[] {
  const m = me.member!
  if (level === 'tech') return techsOf(b, m).map(t => ({ label: TECHS[t].name, ok: techOk(b, me, t), cost: TECHS[t].tp }))
  if (level === 'item') return itemsOf(inv).map(it => ({ label: it === 'tonic' ? 'TONIC' : 'BOMB', ok: true, count: it === 'tonic' ? inv.tonics : inv.bombs }))
  return [
    { label: PARTY[m].strike.name, ok: true },
    { label: 'TECH', ok: techsOf(b, m).some(t => techOk(b, me, t)) },
    { label: 'ITEM', ok: itemsOf(inv).length > 0 },
    { label: 'FLEE', ok: !noFlee(b) },
  ]
}

function techsOf(b: BattleState, m: MemberId): TechId[] {
  const here = new Set(b.fighters.filter(f => f.side === 'party').map(f => f.member))
  return [...PARTY[m].techs, ...combosOf(m).filter(t => TECHS[t].who.every(w => here.has(w)))].slice(0, 4)
}

/** A tech can be used now: every member it needs is up, has a full gauge and the tech points. */
export function techOk(b: BattleState, me: Fighter, t: TechId): boolean {
  const def = TECHS[t]
  return def.who.every(w => {
    const f = b.fighters.find(x => x.member === w)
    return !!f && !f.down && f.atb >= 1 && f.tp >= def.tp && (f === me || !f.status.stun)
  })
}

function itemsOf(inv: { tonics: number; bombs: number; bombBag: boolean }): BattleItem[] {
  const out: BattleItem[] = []
  if (inv.tonics > 0) out.push('tonic')
  if (inv.bombBag && inv.bombs > 0) out.push('bomb')
  return out
}

function noFlee(b: BattleState): boolean {
  return b.fighters.some(f => f.foe === 'knight' && !f.down)
}

function openMenu(c: Ctx, b: BattleState, f: Fighter) {
  b.menu = { who: f.id, level: 'top', cursor: 0, top: 0, pending: null, target: null, held: true }
  c.ev.push({ type: 'battle', what: 'turn' })
}

function menuInput(c: Ctx, b: BattleState, m: BattleMenu, inp: Input) {
  const s = c.s
  const me = fighter(b, m.who)
  if (!me || me.down) { b.menu = null; return }
  const mx = inp.move.x
  const my = inp.move.y
  const dirHeld = Math.abs(mx) > 0.5 || Math.abs(my) > 0.5
  const turned = dirHeld && !m.held
  m.held = dirHeld
  const step = turned ? (Math.abs(my) >= Math.abs(mx) ? (my > 0 ? 1 : -1) : (mx > 0 ? 1 : -1)) : 0
  const pick: BattlePick | undefined = inp.pick
  if (m.level === 'target') {
    const list = targetList(b, m)
    if (step && list.length) {
      const i = Math.max(0, list.indexOf(m.target ?? ''))
      m.target = list[(i + step + list.length) % list.length]!
      c.ev.push({ type: 'choose' })
    }
    if (pick && 'target' in pick) {
      if (list.includes(pick.target)) { m.target = pick.target; confirmTarget(c, b, m); return }
    }
    if (inp.bPress || (pick && ('none' in pick || 'cmd' in pick))) {
      // Back to the list the target was picked from (a tap on another command goes to it).
      const p = m.pending!
      m.level = p.from
      m.cursor = p.from === 'top' ? m.top : p.sub
      m.pending = null
      m.target = null
      c.ev.push({ type: 'back' })
      if (pick && 'cmd' in pick) { m.cursor = pick.cmd; choose(c, b, m, me) }
      return
    }
    if (inp.aPress && m.target) confirmTarget(c, b, m)
    return
  }
  const lines = linesOf(b, s.inv, me, m.level)
  if (step && lines.length) {
    m.cursor = (m.cursor + step + lines.length) % lines.length
    c.ev.push({ type: 'choose' })
  }
  if (pick && 'target' in pick && m.level === 'top') {
    // A foe tapped straight away: strike it.
    const f = fighter(b, pick.target)
    if (f && f.side === 'foe' && !f.down) { m.top = 0; m.pending = { kind: 'strike', from: 'top', sub: 0 }; m.level = 'target'; m.target = f.id; confirmTarget(c, b, m); return }
  }
  if (pick && 'cmd' in pick && pick.cmd >= 0 && pick.cmd < lines.length) { m.cursor = pick.cmd; choose(c, b, m, me); return }
  if ((inp.bPress || (pick && 'none' in pick)) && m.level !== 'top') {
    m.cursor = m.top
    m.level = 'top'
    c.ev.push({ type: 'back' })
    return
  }
  if (inp.aPress) choose(c, b, m, me)
}

function choose(c: Ctx, b: BattleState, m: BattleMenu, me: Fighter) {
  const s = c.s
  const lines = linesOf(b, s.inv, me, m.level as 'top' | 'tech' | 'item')
  const line = lines[m.cursor]
  if (!line?.ok) { c.ev.push({ type: 'error' }); return }
  if (m.level === 'top') {
    m.top = m.cursor
    if (m.cursor === 0) { toTarget(c, b, m, { kind: 'strike', from: 'top', sub: 0 }, 'foe'); return }
    if (m.cursor === 1) { m.level = 'tech'; m.cursor = 0; c.ev.push({ type: 'choose' }); return }
    if (m.cursor === 2) { m.level = 'item'; m.cursor = 0; c.ev.push({ type: 'choose' }); return }
    begin(c, b, { who: me.id, kind: 'flee', target: null, t: 0, hitAt: 0.25, dur: 0.4, landed: false, to: null })
    return
  }
  if (m.level === 'tech') {
    const t = techsOf(b, me.member!)[m.cursor]!
    const def = TECHS[t]
    if (def.area === 'all') { act(c, b, me, { kind: 'tech', tech: t }, null); return }
    toTarget(c, b, m, { kind: 'tech', tech: t, from: 'tech', sub: m.cursor }, def.area === 'ally' ? 'party' : 'foe')
    return
  }
  const it = itemsOf(s.inv)[m.cursor]!
  if (it === 'bomb') { act(c, b, me, { kind: 'item', item: 'bomb' }, null); return }
  toTarget(c, b, m, { kind: 'item', item: it, from: 'item', sub: m.cursor }, 'party')
}

function toTarget(c: Ctx, b: BattleState, m: BattleMenu, pending: NonNullable<BattleMenu['pending']>, side: 'foe' | 'party') {
  m.pending = pending
  m.level = 'target'
  const list = targetList(b, m)
  // Allies: the one most hurt first (a heal is for them); foes: the nearest.
  const me = fighter(b, m.who)!
  if (side === 'party') m.target = [...list].sort((a, z) => frac(b, fighter(b, a)!) - frac(b, fighter(b, z)!))[0] ?? null
  else m.target = [...list].sort((a, z) => dist(fighter(b, a)!.home, me.home) - dist(fighter(b, z)!.home, me.home))[0] ?? null
  c.ev.push({ type: 'choose' })
}

const frac = (_b: BattleState, f: Fighter) => f.hp / Math.max(1, f.maxHp)
const dist = (a: Vec, z: Vec) => Math.hypot(a.x - z.x, a.y - z.y)

/** Who the target cursor moves over: the standing foes, or the party (heals). */
function targetList(b: BattleState, m: BattleMenu): string[] {
  const p = m.pending
  const ally = p && ((p.kind === 'tech' && TECHS[p.tech!].area === 'ally') || p.kind === 'item')
  return b.fighters
    .filter(f => !f.down && (ally ? f.side === 'party' : f.side === 'foe'))
    .sort((a, z) => (a.home.x + a.home.y) - (z.home.x + z.home.y) || a.home.x - z.home.x)
    .map(f => f.id)
}

/** The fighters the pending command would hit with the cursor where it is (the target, the cluster round it, the line). */
function covered(b: BattleState, m: BattleMenu): string[] {
  if (!m.target) return []
  const me = fighter(b, m.who)!
  const p = m.pending
  if (p?.kind !== 'tech') return [m.target]
  return areaOf(b, me, TECHS[p.tech!], fighter(b, m.target)!).map(f => f.id)
}

function confirmTarget(c: Ctx, b: BattleState, m: BattleMenu) {
  const me = fighter(b, m.who)!
  const p = m.pending!
  act(c, b, me, { kind: p.kind, tech: p.tech, item: p.item }, m.target)
}

/** Turn the menu's pick into an action. */
function act(c: Ctx, b: BattleState, me: Fighter, what: { kind: 'strike' | 'tech' | 'item'; tech?: TechId; item?: BattleItem }, target: string | null) {
  const tgt = target ? fighter(b, target) : null
  const melee = (me.member === 'hero' && (what.kind === 'strike' || (what.kind === 'tech' && what.tech !== 'storm')))
  let to: Vec | null = null
  if (melee && tgt) {
    const d = dist(tgt.home, me.home) || 1
    const back = tgt.side === 'foe' ? 0.95 : 0.6
    to = { x: tgt.home.x + ((me.home.x - tgt.home.x) / d) * back, y: tgt.home.y + ((me.home.y - tgt.home.y) / d) * back }
  }
  const combo = what.kind === 'tech' && TECHS[what.tech!].who.length > 1
  const hitAt = what.kind === 'strike' ? 0.34 : combo ? 0.55 : what.kind === 'tech' ? 0.45 : 0.3
  const dur = what.kind === 'strike' ? 0.72 : combo ? 1.05 : what.kind === 'tech' ? 0.85 : 0.6
  begin(c, b, { who: me.id, kind: what.kind, tech: what.tech, item: what.item, target, t: 0, hitAt, dur, landed: false, to })
  if (what.kind === 'tech') c.ev.push({ type: 'battle', what: 'tech' })
}

function begin(c: Ctx, b: BattleState, a: BattleAction) {
  b.menu = null
  b.act = a
  // Its turn (and a combo partner's) is spent now: off the queue.
  const spent = new Set([a.who])
  if (a.kind === 'tech') for (const w of TECHS[a.tech!].who) { const f = b.fighters.find(x => x.member === w); if (f) spent.add(f.id) }
  for (const id of spent) {
    const f = fighter(b, id)!
    f.atb = 0
    if (a.kind === 'tech') f.tp = Math.max(0, f.tp - TECHS[a.tech!].tp)
  }
  b.queue = b.queue.filter(id => !spent.has(id))
}

// ---------------------------------------------------------------------------
// Foes' turns
// ---------------------------------------------------------------------------

function foeTurn(c: Ctx, b: BattleState, f: Fighter) {
  const d = FOES[f.foe!]
  const mi = d.pattern[f.turns % d.pattern.length]!
  f.turns++
  const mv = d.moves[mi]!
  const up = b.fighters.filter(x => x.side === 'party' && !x.down)
  let target: Fighter | null = null
  if (mv.kind === 'hit') {
    // The hero draws more of the blows than Luna.
    target = up.length > 1 ? (rnd(c.s) < 0.6 ? up.find(x => x.member === 'hero')! : up.find(x => x.member !== 'hero')!) : up[0] ?? null
  }
  let to: Vec | null = null
  if (mv.lunge) {
    const t = target ?? up[0]
    if (t) {
      const dd = dist(t.home, f.home) || 1
      const k = target ? 0.85 : Math.min(dd * 0.5, 1.2)
      to = target
        ? { x: t.home.x + ((f.home.x - t.home.x) / dd) * k, y: t.home.y + ((f.home.y - t.home.y) / dd) * k }
        : { x: f.home.x + ((t.home.x - f.home.x) / dd) * k, y: f.home.y + ((t.home.y - f.home.y) / dd) * k }
    }
  }
  begin(c, b, { who: f.id, kind: 'move', move: mi, target: target?.id ?? null, t: 0, hitAt: 0.38, dur: 0.75, landed: false, to })
  const e = enemyOf(c, f)
  if (e) e.ai.tell = 0.3
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function playAction(c: Ctx, b: BattleState, a: BattleAction, dt: number) {
  const s = c.s
  const h = s.hero
  const me = fighter(b, a.who)
  const prev = a.t
  a.t += dt
  if (!me) { b.act = null; return }
  // The lunge out and back.
  if (a.to) {
    const t1 = Math.max(0.05, a.hitAt - 0.06)
    const t2 = a.hitAt + 0.14
    const k = a.t < t1 ? smooth(a.t / t1) : a.t < t2 ? 1 : 1 - smooth((a.t - t2) / Math.max(0.05, a.dur - t2))
    put(c, me, me.home.x + (a.to.x - me.home.x) * k, me.home.y + (a.to.y - me.home.y) * k)
    if (me.member === 'hero' && h.act !== 'swing' && h.act !== 'spin' && h.act !== 'hurt') { h.act = a.t < t2 || a.t < a.dur - 0.05 ? 'walk' : 'idle'; h.walkT += dt }
  }
  // The hero's blade, as in the field.
  if (me.member === 'hero') {
    const spin = a.kind === 'tech' && (a.tech === 'sweep' || a.tech === 'storm')
    const start = a.hitAt - (spin ? 0.2 : 0.1)
    if ((a.kind === 'strike' || a.kind === 'tech') && prev < start && a.t >= start) {
      const tgt = a.target ? fighter(b, a.target) : null
      if (tgt) h.dir = toDir(tgt.home.x - h.x, tgt.home.y - h.y, h.dir)
      if (spin) { h.spin = { t: 0, hit: [] }; h.act = 'spin'; c.ev.push({ type: 'spin' }) }
      else { const ang = tgt ? Math.atan2(tgt.home.y - h.y, tgt.home.x - h.x) : undefined; h.swing = { t: 0, dir: h.dir, a: ang, hit: [] }; h.act = 'swing'; c.ev.push({ type: 'swing' }) }
      h.actT = 0
    }
    if (h.swing) { h.swing.t += dt; if (h.swing.t >= SWING_TIME) { h.swing = null; h.act = 'walk' } }
    if (h.spin) { h.spin.t += dt; if (h.spin.t >= SPIN_TIME) { h.spin = null; h.act = 'walk' } }
  }
  // Luna's mind at work.
  const lunaActs = me.member === 'luna' || (a.kind === 'tech' && TECHS[a.tech!].who.includes('luna'))
  if (lunaActs && s.luna && prev < a.hitAt - 0.25 && a.t >= a.hitAt - 0.25) {
    s.luna.psi = 0.7
    const tgt = a.target ? fighter(b, a.target) : null
    if (tgt) s.luna.dir = toDir(tgt.home.x - s.luna.x, tgt.home.y - s.luna.y, s.luna.dir)
  }
  if (!a.landed && a.t >= a.hitAt) { a.landed = true; land(c, b, a, me) }
  if (b.phase !== 'fight') return
  if (a.t >= a.dur) {
    if (a.to) put(c, me, me.home.x, me.home.y)
    b.act = null
    h.swing = null
    h.spin = null
    if (h.act !== 'dead') h.act = 'idle'
    face(c)
    const e = me.side === 'foe' ? enemyOf(c, me) : null
    if (e) e.ai.tell = 0
    checkEnd(c, b)
  }
}

/** The blow lands. */
function land(c: Ctx, b: BattleState, a: BattleAction, me: Fighter) {
  const s = c.s
  const tgt = a.target ? fighter(b, a.target) : null
  switch (a.kind) {
    case 'strike': {
      if (!tgt || tgt.down) return
      const st = PARTY[me.member!].strike
      const power = st.power * (me.member === 'hero' && s.inv.arc ? 1.5 : 1)
      if (st.elem === 'psi') { const e = enemyOf(c, tgt); if (e) c.ev.push({ type: 'psi', x: e.x, y: e.y }) }
      const hit = strikeFoe(c, b, me, tgt, power, st.elem, true)
      if (hit) me.tp = Math.min(TP_MAX, me.tp + 1)
      return
    }
    case 'tech': {
      const def = TECHS[a.tech!]
      if (def.area === 'ally') {
        if (tgt && !tgt.down) heal(c, b, tgt, def.heal ?? 0)
        return
      }
      const power = def.who.reduce((sum, w) => sum + PARTY[w].strike.power * (w === 'hero' && s.inv.arc ? 1.5 : 1), 0) * def.power
      const hit = def.area === 'all' ? b.fighters.filter(f => f.side === 'foe' && !f.down) : tgt ? areaOf(b, me, def, tgt) : []
      if (def.who.length > 1) s.shake = Math.max(s.shake, 0.25)
      for (const f of hit) {
        const e = enemyOf(c, f)
        if (e && def.elem === 'static') c.ev.push({ type: 'shock', x: e.x, y: e.y })
        else if (e && def.elem === 'psi') c.ev.push({ type: 'psi', x: e.x, y: e.y })
        if (power > 0) strikeFoe(c, b, me, f, power, def.elem, false)
        if (def.status && !f.down) addStatus(c, b, f, def.status.kind, def.status.s)
      }
      return
    }
    case 'item': {
      if (a.item === 'tonic') {
        if (!tgt || tgt.down || s.inv.tonics <= 0) return
        s.inv.tonics--
        heal(c, b, tgt, 4)
        return
      }
      if (s.inv.bombs <= 0) return
      s.inv.bombs--
      const foes = b.fighters.filter(f => f.side === 'foe' && !f.down)
      const cx = foes.reduce((q, f) => q + f.home.x, 0) / Math.max(1, foes.length)
      const cy = foes.reduce((q, f) => q + f.home.y, 0) / Math.max(1, foes.length)
      c.ev.push({ type: 'boom', x: cx, y: cy })
      s.shake = Math.max(s.shake, 0.3)
      for (const f of foes) {
        strikeFoe(c, b, me, f, 12, 'blast', false)
        if (!f.down) addStatus(c, b, f, 'stun', 1.5)
      }
      return
    }
    case 'flee': {
      // Running always works, but not from a guardian.
      if (noFlee(b)) { pop(b, me.home.x, me.home.y, 'NO WAY OUT', 'info'); c.ev.push({ type: 'error' }); return }
      b.tries++
      endBattle(c, b, 'fled')
      return
    }
    case 'move': return foeMove(c, b, a, me)
  }
}

function foeMove(c: Ctx, b: BattleState, a: BattleAction, me: Fighter) {
  const s = c.s
  const mv = FOES[me.foe!].moves[a.move ?? 0]!
  const e = enemyOf(c, me)
  if (mv.kind === 'guard') {
    me.guard = true
    pop(b, me.home.x, me.home.y, mv.name, 'info')
    c.ev.push({ type: 'clank', x: me.home.x, y: me.home.y })
    return
  }
  const targets = mv.kind === 'all' ? b.fighters.filter(f => f.side === 'party' && !f.down) : a.target ? [fighter(b, a.target)!].filter(f => !f.down) : []
  if (e && !mv.lunge) c.ev.push({ type: 'shoot', x: e.x, y: e.y, kind: mv.status?.kind === 'static' ? 'spark' : 'pellet' })
  pop(b, me.home.x, me.home.y, mv.name, 'info')
  for (const t of targets) {
    // A slowed foe misses more; anything misses now and then.
    const miss = rnd(s) < (me.status.slow ? 0.3 : 0.15)
    if (miss) { pop(b, t.home.x, t.home.y, 'MISS', 'info'); continue }
    if (mv.power > 0) harmParty(c, b, t, mv.power, me)
    if (mv.status && !t.down && rnd(s) < mv.status.p) addStatus(c, b, t, mv.status.kind, mv.status.s)
  }
}

/** The foes a tech reaches from `me` aimed at `tgt`: the target alone, the cluster round it, or the line through it. */
function areaOf(b: BattleState, me: Fighter, def: TechDef, tgt: Fighter): Fighter[] {
  const foes = b.fighters.filter(f => f.side === 'foe' && !f.down)
  if (def.area === 'near') return foes.filter(f => f === tgt || dist(f.home, tgt.home) <= (def.reach ?? 1.5))
  if (def.area === 'line') {
    const dx = tgt.home.x - me.home.x
    const dy = tgt.home.y - me.home.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    return foes.filter(f => {
      if (f === tgt) return true
      const px = f.home.x - me.home.x
      const py = f.home.y - me.home.y
      const along = px * ux + py * uy
      return along > 0 && Math.abs(px * uy - py * ux) < 0.75
    })
  }
  if (def.area === 'all') return foes
  return [tgt]
}

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

/** On or beside water: static hits it twice as hard and stuns it. */
export function wet(c: Ctx, f: Fighter): boolean {
  const x = Math.floor(f.home.x)
  const y = Math.floor(f.home.y)
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (tileAt(c.s.map, x + dx, y + dy) === '~') return true
  return false
}

/** A party blow on a foe. Returns true if it landed. `blow`: a single strike (it can miss on a flitting foe, crit, and get shocked back). */
function strikeFoe(c: Ctx, b: BattleState, me: Fighter, f: Fighter, power: number, elem: BattleElement, blow: boolean): boolean {
  const s = c.s
  const d = FOES[f.foe!]
  const e = enemyOf(c, f)
  if (elem === 'blade' && d.evade && !f.status.slow && !f.status.stun && rnd(s) < d.evade) {
    pop(b, f.home.x, f.home.y, 'MISS', 'info')
    return false
  }
  let mult = 0.9 + rnd(s) * 0.2
  if (d.weak?.includes(elem)) mult *= WEAK
  if (d.resist?.includes(elem)) mult *= RESIST
  if (f.status.break) mult *= BROKEN
  if (f.guard && (elem === 'blade' || elem === 'psi')) mult *= GUARDED
  const soaked = elem === 'static' && wet(c, f)
  if (soaked) mult *= 2
  let crit = false
  if (blow && rnd(s) < 0.08) { mult *= 1.5; crit = true }
  const dmg = Math.max(1, Math.round(power * mult))
  harmFoe(c, b, f, dmg, crit ? 'crit' : 'hit')
  if (soaked && !f.down) { addStatus(c, b, f, 'stun', 2); pop(b, f.home.x, f.home.y - 0.4, 'SOAKED', 'info') }
  // A zapper shocks a blade that strikes it unless it is stunned.
  if (d.shocks && elem === 'blade' && !f.status.stun && !f.down) {
    if (e) c.ev.push({ type: 'shock', x: me.home.x, y: me.home.y })
    harmParty(c, b, me, 1, f)
  }
  return true
}

function harmFoe(c: Ctx, b: BattleState, f: Fighter, dmg: number, how: 'hit' | 'crit') {
  if (f.down) return
  f.hp = Math.max(0, f.hp - dmg)
  f.flash = 0.18
  const e = enemyOf(c, f)
  if (e) e.flash = 0.18
  pop(b, f.home.x, f.home.y, how === 'crit' ? `${dmg}!` : `${dmg}`, 'hit')
  if (f.hp <= 0) {
    f.down = true
    f.atb = 0
    b.queue = b.queue.filter(id => id !== f.id)
    b.bits += FOES[f.foe!].bits
    if (e) {
      e.dead = true
      c.ev.push({ type: 'hit', x: e.x, y: e.y, kind: e.kind, killed: true })
      c.ev.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind })
    }
    c.ev.push({ type: 'hitStop', ms: 60 })
  } else if (e) {
    c.ev.push({ type: 'hit', x: e.x, y: e.y, kind: e.kind, killed: false })
  }
}

function harmParty(c: Ctx, b: BattleState, t: Fighter, dmg: number, _from: Fighter) {
  const s = c.s
  if (t.down) return
  t.flash = 0.2
  pop(b, t.home.x, t.home.y, `${dmg}`, 'hurt')
  if (t.member === 'hero') {
    const h = s.hero
    h.hp = Math.max(0, h.hp - dmg)
    t.hp = h.hp
    h.invuln = 0.45
    h.act = 'hurt'
    h.actT = 0
    h.swing = null
    h.spin = null
    c.ev.push({ type: 'hurt', x: h.x, y: h.y })
    c.ev.push({ type: 'hitStop', ms: 50 })
    s.shake = Math.max(s.shake, 0.15)
    if (h.hp <= 0) lose(c, b)
    return
  }
  t.hp = Math.max(0, t.hp - dmg)
  c.ev.push({ type: 'hurt', x: t.home.x, y: t.home.y })
  if (t.hp <= 0) {
    t.down = true
    t.atb = 0
    t.status = {}
    b.queue = b.queue.filter(id => id !== t.id)
    pop(b, t.home.x, t.home.y - 0.5, 'KO', 'hurt')
  }
}

function heal(c: Ctx, b: BattleState, t: Fighter, n: number) {
  const s = c.s
  if (t.member === 'hero') { s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + n); t.hp = s.hero.hp }
  else t.hp = Math.min(t.maxHp, t.hp + n)
  pop(b, t.home.x, t.home.y, `+${n}`, 'heal')
  c.ev.push({ type: 'collect', kind: 'heart' })
}

const STATUS_WORD: Record<BattleStatus, string> = { stun: 'DAZED', static: 'STATIC', slow: 'SLOW', break: 'BREAK' }

function addStatus(c: Ctx, b: BattleState, f: Fighter, k: BattleStatus, secs: number) {
  if (f.down) return
  if (k === 'static' && f.side === 'foe' && FOES[f.foe!].resist?.includes('static')) return
  const had = !!f.status[k]
  f.status[k] = Math.max(f.status[k] ?? 0, secs)
  if (k === 'break' && f.guard) f.guard = false
  if (!had) pop(b, f.home.x, f.home.y - 0.35, STATUS_WORD[k], 'info')
}

// ---------------------------------------------------------------------------
// The end
// ---------------------------------------------------------------------------

function checkEnd(c: Ctx, b: BattleState) {
  if (b.phase !== 'fight') return
  if (b.fighters.every(f => f.side !== 'foe' || f.down)) endBattle(c, b, 'won')
}

function lose(c: Ctx, b: BattleState) {
  const s = c.s
  const h = s.hero
  b.phase = 'lost'
  b.t = 0
  b.act = null
  b.menu = null
  h.act = 'dead'
  h.actT = 0
  h.knock = null
  s.mode = 'dying'
  s.dying = { t: 0 }
  c.ev.push({ type: 'died' })
}

function endBattle(c: Ctx, b: BattleState, how: 'won' | 'fled') {
  const s = c.s
  b.phase = how
  b.t = 0
  b.menu = null
  b.queue = []
  b.camFrom = { ...b.cam }
  const h = s.hero
  h.swing = null
  h.spin = null
  if (how === 'won') {
    b.act = null
    h.act = 'idle'
    s.inv.bits = Math.min(MAX_BITS, s.inv.bits + b.bits)
    if (b.bits > 0) { pop(b, h.x, h.y - 0.3, `+${b.bits} BITS`, 'heal'); c.ev.push({ type: 'collect', kind: 'bit5' }) }
    // A heart (or bits, a bomb) left where the foes stood, as in the field.
    const foes = b.fighters.filter(f => f.side === 'foe')
    const last = foes[foes.length - 1]
    if (last) rollDrop(c, last.home.x, last.home.y, 0.6)
    const def = c.info.def.battle?.groups.find(g => g.id === b.group)
    if (def?.once) setFlag(s, `battle:${b.group}`)
    b.camTo = { x: h.x, y: h.y }
    c.ev.push({ type: 'battle', what: 'won', boss: !!def?.foes.includes('knight') })
  } else {
    b.act = null
    // The party turns and runs, back the way it came.
    for (const f of b.fighters) {
      if (f.side !== 'party') continue
      const to = freeSpot(c.w, s.map, f.home.x + b.axis.x * 1.6, f.home.y + b.axis.y * 1.6, HERO_R) ?? f.home
      b.from[f.id] = { ...f.home }
      f.home = { ...to }
    }
    h.dir = toDir(b.axis.x, b.axis.y, h.dir)
    if (s.luna) s.luna.dir = h.dir
    const hero = b.fighters.find(f => f.member === 'hero')!
    b.camTo = { ...hero.home }
    c.ev.push({ type: 'battle', what: 'fled' })
  }
}

function outro(c: Ctx, b: BattleState, dt: number) {
  const s = c.s
  const h = s.hero
  const k = smooth(b.t / OUTRO_TIME)
  b.cam = lerp(b.camFrom, b.camTo, k)
  if (b.phase === 'fled') {
    for (const f of b.fighters) {
      if (f.side !== 'party') continue
      const a = b.from[f.id] ?? f.home
      put(c, f, a.x + (f.home.x - a.x) * k, a.y + (f.home.y - a.y) * k)
    }
    h.act = 'walk'
    h.walkT += dt
    if (s.luna) s.luna.walkT += dt
  }
  if (b.t < OUTRO_TIME) return
  // Control comes back where the hero stands.
  h.act = 'idle'
  h.safe = { x: h.x, y: h.y }
  h.invuln = Math.max(h.invuln, 0.6)
  if (s.luna) { s.luna.walkT = 0; s.luna.trail = [{ x: s.luna.x, y: s.luna.y }, { x: h.x, y: h.y }] }
  if (b.phase === 'fled') {
    for (const e of s.map.enemies) if (e.group === b.group && !e.dead) { e.stun = WINDED_TIME; e.x = e.home.x; e.y = e.home.y }
  }
  const def = c.info.def.battle?.groups.find(g => g.id === b.group)
  const won = b.phase === 'won'
  s.battle = null
  s.mode = 'play'
  if (won && def?.prize && !has(s, `battle:${def.id}:prize`)) {
    setFlag(s, `battle:${def.id}:prize`)
    acquire(c, def.prize)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function fighter(b: BattleState, id: string): Fighter | undefined {
  return b.fighters.find(f => f.id === id)
}

function enemyOf(c: Ctx, f: Fighter): Enemy | undefined {
  return f.side === 'foe' ? c.s.map.enemies.find(e => e.id === f.id) : undefined
}

/** Where a fighter's figure is now (the hero, Luna, or its enemy). */
export function fighterAt(s: { hero: Vec; luna: Vec | null; map: { enemies: Enemy[] } }, f: Fighter): Vec {
  if (f.member === 'hero') return { x: s.hero.x, y: s.hero.y }
  if (f.member === 'luna') return s.luna ? { x: s.luna.x, y: s.luna.y } : f.home
  const e = s.map.enemies.find(x => x.id === f.id)
  return e ? { x: e.x, y: e.y } : f.home
}

function put(c: Ctx, f: Fighter, x: number, y: number) {
  const s = c.s
  if (f.member === 'hero') { s.hero.x = x; s.hero.y = y; return }
  if (f.member === 'luna') { if (s.luna) { s.luna.x = x; s.luna.y = y } return }
  const e = enemyOf(c, f)
  if (e) { e.x = x; e.y = y }
}

/** Everyone faces the other side. */
function face(c: Ctx) {
  const s = c.s
  const b = s.battle
  if (!b) return
  const mid = (side: 'party' | 'foe') => {
    const l = b.fighters.filter(f => f.side === side && !f.down)
    return l.length ? { x: l.reduce((a, f) => a + f.home.x, 0) / l.length, y: l.reduce((a, f) => a + f.home.y, 0) / l.length } : null
  }
  const foes = mid('foe')
  const party = mid('party')
  if (foes) {
    s.hero.dir = toDir(foes.x - s.hero.x, foes.y - s.hero.y, s.hero.dir)
    if (s.luna) s.luna.dir = toDir(foes.x - s.luna.x, foes.y - s.luna.y, s.luna.dir)
  }
  if (party) for (const f of b.fighters) { const e = enemyOf(c, f); if (e && !e.dead) e.dir = toDir(party.x - e.x, party.y - e.y, e.dir) }
}

function pop(b: BattleState, x: number, y: number, text: string, tone: 'hit' | 'hurt' | 'heal' | 'info') {
  // Words over the same spot stack instead of covering each other.
  const near = b.pops.filter(p => Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.8 && p.t < 0.3).length
  b.pops.push({ x, y: y - near * 0.45, text, tone, t: 0 })
  if (b.pops.length > 16) b.pops.shift()
}

const lerp = (a: Vec, z: Vec, k: number): Vec => ({ x: a.x + (z.x - a.x) * k, y: a.y + (z.y - a.y) * k })

/** Where the camera looks (tile units): the fight's middle while one is on, eased in and out; else the hero. */
export function battleFocus(s: { hero: Vec; battle?: BattleState | null }): Vec {
  return s.battle ? s.battle.cam : s.hero
}
