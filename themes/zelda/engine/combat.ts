/**
 * Damage, drops and item grants — the rules every other engine module
 * calls into. `Ctx` bundles what a step needs.
 */
import type { DropKind, Enemy, EnemyKind, GameEvent, GameState, ItemId, WeightId, World } from '../types'
import { HERO_R, INVULN, KNOCK_SPEED, KNOCK_TIME, MAX_BITS, ROLL_IFRAMES, TOUGH, WEIGHTS } from '../types'
import { STATS } from './spawn'
import { PARROT, parrotStruck } from './parrot'
import { COPILOT, copilotStill } from './bossCopilot'
import { chance, clamp, nextId, rnd } from './util'
import { addKeys, cellRect, circleBlocked, mapInfo, setFlag, type MapInfo } from './map'
import { artOfItem, endMoves, hopDodge, isArt, learnArt, slip } from './moves'

export interface Ctx {
  w: World
  s: GameState
  ev: GameEvent[]
  info: MapInfo
}

export function ctx(w: World, s: GameState, ev: GameEvent[]): Ctx {
  return { w, s, ev, info: mapInfo(w, s.map.id) }
}

/**
 * The spot nearest a fallen foe, well inside its room, where a hero can stand: what it leaves must not lie in a pillar,
 * under a pot or in a doorway's wall.
 */
function footing(c: Ctx, e: Enemy): { x: number; y: number } {
  const z = cellRect(c.info, e.cell)
  for (let r = 0; r <= 4; r += 0.25) {
    for (let i = 0; i < (r ? 16 : 1); i++) {
      const x = clamp(e.x + Math.cos((i / 16) * Math.PI * 2) * r, z.x + 1.5, z.x + z.w - 1.5)
      const y = clamp(e.y + Math.sin((i / 16) * Math.PI * 2) * r, z.y + 1.5, z.y + z.h - 1.5)
      if (!circleBlocked(c.w, c.s.map, x, y, HERO_R)) return { x, y }
    }
  }
  return { x: e.x, y: e.y }
}

// ---------------------------------------------------------------------------
// Hero damage
// ---------------------------------------------------------------------------

/**
 * `foe`: the harm is a foe's (a blow, a shot). Only a foe's harm passes over the hero in the air (a hop it passes
 * under makes the HOP CUT after it critical), and only a foe's that passes through the roll's first moments is a SLIP (`moves.ts`). Any other harm
 * (spikes, a fall, a stone, the hero's own bomb, whatever a land adds) is not a foe's unless its caller says so.
 */
export function hurtHero(c: Ctx, dmg: number, fromX: number, fromY: number, shock = false, foe = false): boolean {
  const s = c.s
  const h = s.hero
  // Nothing hurts while the hero steps out of a door.
  if (h.auto) return false
  if (s.mode !== 'play' || h.invuln > 0 || h.act === 'fall' || h.act === 'dead' || h.act === 'get') return false
  // The first moments of a dodge roll: nothing lands.
  if (h.roll && h.roll.t < ROLL_IFRAMES) { if (foe) slip(c, fromX, fromY); return false }
  // In the air no foe's blow lands. A stone or a blast still does, and throws him clear.
  if (h.air && foe) { hopDodge(h); return false }
  h.hp = Math.max(0, h.hp - dmg)
  h.invuln = INVULN
  let dx = h.x - fromX
  let dy = h.y - fromY
  const len = Math.hypot(dx, dy) || 1
  dx /= len
  dy /= len
  h.knock = { vx: dx * KNOCK_SPEED, vy: dy * KNOCK_SPEED, t: KNOCK_TIME * (shock ? 1.5 : 1) }
  h.swing = null
  h.spin = null
  h.roll = null
  endMoves(h)
  h.charge = -1
  if (h.carry) {
    c.ev.push({ type: 'shatter', x: h.x, y: h.y - 0.6, kind: h.carry })
    h.carry = null
  }
  h.act = 'hurt'
  h.actT = 0
  c.ev.push(shock ? { type: 'shock', x: h.x, y: h.y } : { type: 'hurt', x: h.x, y: h.y })
  c.ev.push({ type: 'hitStop', ms: 70 })
  s.shake = Math.max(s.shake, 0.18)
  if (h.hp <= 0) {
    s.echo = null
    h.act = 'dead'
    h.actT = 0
    h.knock = null
    s.mode = 'dying'
    s.dying = { t: 0 }
    c.ev.push({ type: 'died' })
  }
  return true
}

// ---------------------------------------------------------------------------
// Enemy damage
// ---------------------------------------------------------------------------

/** `echo`: a blow of the echo's blade (`engine/echo.ts`), the blade to every rule of armour. */
export type HitSource = 'sword' | 'spin' | 'disc' | 'bomb' | 'pot' | 'shot' | 'hook' | 'spit' | 'echo'
  /** The storm lamp's beam (`engine/lamp.ts`): a burn that leaves no mercy and no shove. */
  | 'beam'
  | 'stomp' // the hero coming down hard (`engine/stomp.ts`)

/** Bosses and minibosses: heavy, barely knocked back, longer mercy after a hit. */
export const BIG = new Set<EnemyKind>(['king', 'knight', 'llama', 'mistral', 'deepseek', 'gemini', 'mixtral', 'parrot'])
  .add('copilot')
/** The ones whose fall clears the room of its small fry and plays the boss fanfare. */
const BOSSES = new Set<EnemyKind>(['king', 'knight', 'llama', 'mistral', 'deepseek', 'gemini', 'mixtral', 'parrot'])

/** The blade, whoever holds it: the hero's chain, moves and spin, and the echo's. */
const blade = (src: HitSource) => src === 'sword' || src === 'spin' || src === 'echo'
/** The hero's own blade: only it is shoved back by armour, shocked, or spends a SLIP's edge. */
const own = (src: HitSource) => src === 'sword' || src === 'spin'
/**
 * The mercy a blow that was only turned aside leaves on the foe. None for the echo's: the two blades keep separate
 * mercies (`Enemy.invuln`, `Enemy.echoInvuln`), so one never swallows the other's blow.
 */
const turned = (e: Enemy, src: HitSource, t: number) => { if (src !== 'echo') e.invuln = t }

/**
 * A tough foe's opening (`TOUGH`): stunned, or standing spent after its strike (the sentry's `spent`, the hound's
 * `rest`). Open, it is a small foe in every way and its touch does no harm. False for a foe that is not tough.
 */
export function toughOpen(e: Enemy): boolean {
  return !!e.tough && (e.stun > 0 || e.ai.mode === (e.kind === 'hound' ? 'rest' : 'spent'))
}

/**
 * A boss open to the blade (the `BIG` foes; its bar is gold then, `render/renderer.ts` `foeBars`): the state in which
 * the blade takes hit points off it (`hitEnemy`, `bossRules`). It asks the boss alone, so the knight's unguarded back,
 * which depends on where the hero stands, does not count. A new boss adds its case here. False for any other foe.
 */
export function bossOpen(e: Enemy): boolean {
  if (e.dead) return false
  const mode = e.ai.mode
  switch (e.kind) {
    // Its shield is down: dazed against a wall, or stunned.
    case 'knight': return mode === 'dazed' || e.stun > 0
    case 'king': return mode === 'down'
    // The wool turns the blade whatever it is doing.
    case 'llama': return false
    case 'mistral': return mode === 'down'
    case 'deepseek': return mode === 'up' || mode === 'hauled'
    // A twin on its feet; one that has fallen is out of reach until it gets up.
    case 'gemini': return mode !== 'down'
    // Dazed against the wall, while this daze still has blows to give.
    case 'mixtral': return mode === 'dazed' && ((e.ai.took as number | undefined) ?? 0) < TOUGH.take
    // Thinking, while this thought still has blows to give.
    case 'parrot': return mode === 'think' && ((e.ai.took as number | undefined) ?? 0) < PARROT.take
    // Stalled in the road, while this stall still has blows to give.
    case 'copilot': return mode === 'stall' && ((e.ai.took as number | undefined) ?? 0) < COPILOT.take
    default: return false
  }
}

/**
 * How a blow lands, beyond its damage (the blade's chain, `COMBO`): `knock` x the ordinary shove, `stagger` s of
 * reeling (small foes), `stop` ms of hitstop, `chain` a quick hit of the chain (the foe's mercy is short, so the
 * next hit lands), `finisher` the chain's last (it bites harder on a foe stunned, or reeling from some other
 * blow: a pot, a bomb, the spin; not on one reeling only from the chain's own hits). Left out: the plain values.
 */
export interface HitOpts {
  knock?: number; stagger?: number; stop?: number; chain?: boolean; finisher?: boolean; crit?: boolean
  /** The most this blow may take (a tough foe's opening, `TOUGH.take`); what it took is counted in `ai.took`. */
  cap?: number
  /** The echo's blow: its mercy is the foe's `echoInvuln` (set by `hitEnemy`). */
  echo?: boolean
}

/**
 * The storm lamp's burn (`engine/lamp.ts`, `HitSource` 'beam'): hit points off a foe with no mercy window, no shove, no
 * poise and no reeling, so it never swallows the hero's blows. A foe nothing hurts, and a `BIG` one (its own rules
 * would say), takes none.
 */
export function burnFoe(c: Ctx, e: Enemy, dmg: number): boolean {
  if (e.dead || STATS[e.kind].invulnerable || BIG.has(e.kind)) return false
  e.hp -= dmg
  e.flash = 0.14
  const killed = e.hp <= 0
  c.ev.push({ type: 'hit', x: e.x, y: e.y, kind: e.kind, killed })
  if (killed) killEnemy(c, e)
  return true
}

/** Apply a hit. Returns true if it connected (damage or stun). */
export function hitEnemy(c: Ctx, e: Enemy, dmg: number, fromX: number, fromY: number, src: HitSource, opt?: HitOpts): boolean {
  if (src === 'beam') return burnFoe(c, e, dmg)
  if (e.dead || (src === 'echo' ? (e.echoInvuln ?? 0) : e.invuln) > 0) return false
  if (src === 'echo') opt = { ...opt, echo: true }
  const st = STATS[e.kind]
  if (st.invulnerable) {
    if (blade(src)) c.ev.push({ type: 'clank', x: e.x, y: e.y })
    return false
  }
  // Poise: a tough one that is not open turns the blade (every move of it) without a mark, and a SLIP's edge is kept.
  // No mercy time comes of it: the opening that follows, and a disc thrown right after, must not be swallowed.
  if (e.tough && blade(src) && !toughOpen(e)) {
    c.ev.push({ type: 'clank', x: e.x, y: e.y })
    return false
  }
  // Open, it gives the blade `TOUGH.take` in all and no more (the Arc Blade only gets there sooner); with that
  // taken it shuts (`toughClocks`).
  if (e.tough && blade(src)) opt = { ...opt, cap: Math.max(0, TOUGH.take - ((e.ai.took as number | undefined) ?? 0)) }
  // The stomp meets poise as the blade does: shut, it clanks; open, its two come out of the same opening.
  if (e.tough && src === 'stomp') {
    if (!toughOpen(e)) { c.ev.push({ type: 'clank', x: e.x, y: e.y }); return false }
    opt = { ...opt, cap: Math.max(0, TOUGH.take - ((e.ai.took as number | undefined) ?? 0)) }
  }
  // After a SLIP the hero's next blow is critical (`moves.ts`).
  const h0 = c.s.hero
  if (h0.edge && own(src)) {
    opt = { ...opt, crit: true }
    const landed = hitEnemyPlain(c, e, dmg, fromX, fromY, src, opt)
    if (landed) h0.edge = false
    return landed
  }
  return hitEnemyPlain(c, e, dmg, fromX, fromY, src, opt)
}

function hitEnemyPlain(c: Ctx, e: Enemy, dmg: number, fromX: number, fromY: number, src: HitSource, opt?: HitOpts): boolean {
  const special = bossRules(c, e, dmg, fromX, fromY, src, opt)
  if (special !== null) return special
  // A calm sentry struck or stunned turns angry for good, and goes for the hero as soon as it can.
  if (e.calm && !e.ai.angry) { e.ai.angry = true; e.ai.mode = 'alert'; e.ai.t = 0.45 }
  // A tough one that is stunned, or has just shaken a stun off, turns the disc and the hook away.
  if (e.tough && (src === 'hook' || src === 'disc') && (e.stun > 0 || ((e.ai.shrug as number | undefined) ?? 0) > 0)) {
    c.ev.push({ type: 'clank', x: e.x, y: e.y })
    return false
  }
  // The hook stuns like the disc, and bites the frail.
  if (src === 'hook') {
    if (BIG.has(e.kind)) { c.ev.push({ type: 'clank', x: e.x, y: e.y }); return false }
    e.stun = e.tough ? TOUGH.stunHook : 2
    e.flash = 0.1
    c.ev.push({ type: 'discHit', x: e.x, y: e.y })
    if (e.kind === 'bat' || e.kind === 'blob' || e.kind === 'drone') return damage(c, e, 1, fromX, fromY)
    return true
  }
  // The disc stuns; it only hurts the frail.
  if (src === 'disc') {
    if (e.kind === 'king') return false
    e.stun = e.tough ? TOUGH.stunDisc : e.kind === 'knight' ? 1.4 : 2.4
    e.flash = 0.1
    c.ev.push({ type: 'discHit', x: e.x, y: e.y })
    if (e.kind === 'bat' || e.kind === 'blob') return damage(c, e, 1, fromX, fromY)
    return true
  }
  // Zappers shock a blade that strikes them unless they are stunned.
  if (e.kind === 'zapper' && own(src) && e.stun <= 0) {
    hurtHero(c, 1, e.x, e.y, true, true)
    e.flash = 0.2
    return false
  }
  if (e.kind === 'knight' && blade(src) && e.ai.mode !== 'dazed' && e.stun <= 0) {
    // Shield: blocks blows from the front half.
    const fx = e.dir === 'left' ? -1 : e.dir === 'right' ? 1 : 0
    const fy = e.dir === 'up' ? -1 : e.dir === 'down' ? 1 : 0
    const dx = fromX - e.x
    const dy = fromY - e.y
    if (dx * fx + dy * fy > 0.25 * Math.hypot(dx, dy)) {
      c.ev.push({ type: 'clank', x: e.x + fx * 0.6, y: e.y + fy * 0.6 })
      if (own(src)) {
        const h = c.s.hero
        const len = Math.hypot(h.x - e.x, h.y - e.y) || 1
        h.knock = { vx: ((h.x - e.x) / len) * KNOCK_SPEED * 0.8, vy: ((h.y - e.y) / len) * KNOCK_SPEED * 0.8, t: KNOCK_TIME }
      }
      turned(e, src, 0.25)
      return false
    }
  }
  if (e.kind === 'king' && e.ai.mode !== 'down') {
    c.ev.push({ type: 'clank', x: e.x, y: e.y })
    turned(e, src, 0.2)
    return false
  }
  return damage(c, e, dmg, fromX, fromY, opt)
}

/**
 * The new bosses' own rules; null = the ordinary rules apply.
 * LLAMA: wool turns blades and hooks; its own spit sent back, or a bomb, hurts.
 * MISTRAL: untouchable in the air; the hook drags it down, then anything hurts.
 * DEEPSEEK: under the floor nothing reaches it but the hook, which hauls it up.
 * GEMINI: ordinary, but a twin at zero only falls down (see damage).
 */
function bossRules(c: Ctx, e: Enemy, dmg: number, fromX: number, fromY: number, src: HitSource, opt?: HitOpts): boolean | null {
  const ai = e.ai
  switch (e.kind) {
    case 'llama':
      if (src === 'spit' || src === 'shot' || src === 'bomb' || src === 'pot') return damage(c, e, 2, fromX, fromY)
      if (src === 'disc') { e.stun = 1; c.ev.push({ type: 'discHit', x: e.x, y: e.y }); return true }
      c.ev.push({ type: 'clank', x: e.x, y: e.y })
      turned(e, src, 0.2)
      if (own(src)) {
        const h = c.s.hero
        const len = Math.hypot(h.x - e.x, h.y - e.y) || 1
        h.knock = { vx: ((h.x - e.x) / len) * KNOCK_SPEED * 0.7, vy: ((h.y - e.y) / len) * KNOCK_SPEED * 0.7, t: KNOCK_TIME }
      }
      return false
    case 'mistral':
      if (ai.mode === 'down') return src === 'hook' || src === 'disc' ? false : damage(c, e, dmg, fromX, fromY, opt)
      // The hook only bites while it holds still to breathe in (or blows).
      if (src === 'hook' && (ai.mode === 'inhale' || ai.mode === 'blow')) {
        ai.mode = 'down'
        ai.t = ai.phase === 2 ? 2.2 : 2.8
        ai.tell = 0
        e.flash = 0.2
        c.s.shake = Math.max(c.s.shake, 0.3)
        c.ev.push({ type: 'boom', x: e.x, y: e.y + 0.4 })
        return true
      }
      c.ev.push({ type: 'clank', x: e.x, y: e.y })
      turned(e, src, 0.15)
      return false
    // MIXTRAL: bombs, pots and batted shots hurt it at any time; the blade only while the wall has it dazed, and no
    // more than `TOUGH.take` a daze. Anything else clanks, the disc and the hook with the rest: nothing stuns it.
    case 'mixtral': {
      if (src === 'bomb' || src === 'pot' || src === 'shot' || src === 'spit') return damage(c, e, dmg, fromX, fromY, opt)
      const left = TOUGH.take - ((ai.took as number | undefined) ?? 0)
      if (blade(src) && ai.mode === 'dazed' && left > 0) return damage(c, e, dmg, fromX, fromY, { ...opt, cap: left })
      c.ev.push({ type: 'clank', x: e.x, y: e.y })
      turned(e, src, 0.2)
      return false
    }
    // THE STOCHASTIC PARROT always faces the hero, so a blow from its front half (the hero's side) clanks off its
    // beak unless it is thinking; then the blade bites from anywhere, `PARROT.take` a thought. The echo's blade at
    // its back bites at any time and sets it thinking. Bombs and batted shots hurt it as any foe.
    case 'parrot': {
      if (src === 'bomb' || src === 'shot' || src === 'spit') return damage(c, e, dmg, fromX, fromY, opt)
      const h = c.s.hero
      const open = ai.mode === 'think'
      const back = (fromX - e.x) * (h.x - e.x) + (fromY - e.y) * (h.y - e.y) < 0
      // The disc and the hook never hurt it: where they get through, they only touch.
      if ((src === 'disc' || src === 'hook') && (open || back)) { c.ev.push({ type: 'discHit', x: e.x, y: e.y }); return true }
      if (src === 'pot' && (open || back)) return damage(c, e, dmg, fromX, fromY, opt)
      const left = PARROT.take - ((ai.took as number | undefined) ?? 0)
      if (blade(src) && open && left > 0) return damage(c, e, dmg, fromX, fromY, { ...opt, cap: left })
      if (src === 'echo' && back && !open) {
        const hit = damage(c, e, dmg, fromX, fromY, opt)
        if (!e.dead) parrotStruck(c, e)
        return hit
      }
      c.ev.push({ type: 'clank', x: e.x, y: e.y })
      turned(e, src, 0.2)
      return false
    }
    case 'deepseek':
      if (ai.mode === 'under' || ai.mode === 'rise') {
        if (src !== 'hook') return false
        ai.mode = 'hauled'
        ai.t = 3
        ai.tell = 0
        e.flash = 0.2
        c.ev.push({ type: 'discHit', x: e.x, y: e.y })
        return true
      }
      if (src === 'hook' || src === 'disc') return false
      // Three blows and it dives back under the floor.
      ai.hits = ((ai.hits as number) ?? 0) + 1
      if (!damage(c, e, dmg, fromX, fromY, opt)) return false
      if ((ai.hits as number) >= 3 && !e.dead) { ai.hits = 0; ai.mode = 'under'; ai.t = 2.2; ai.tell = 0; e.invuln = 1.4 }
      return true
    // COPILOT: the stomp bites while it stands still, the blade only while it is stalled, `COPILOT.take` a stall.
    case 'copilot': {
      const left = COPILOT.take - ((ai.took as number | undefined) ?? 0)
      const stomped = src === 'stomp' && copilotStill(e)
      if (!stomped && !(blade(src) && ai.mode === 'stall' && left > 0)) {
        c.ev.push({ type: 'clank', x: e.x, y: e.y })
        turned(e, src, 0.2)
        return false
      }
      const hit = damage(c, e, stomped ? COPILOT.stomp : dmg, fromX, fromY, stomped ? opt : { ...opt, cap: left })
      // (It stands where its cycle puts it: nothing shoves it.)
      e.knock = null
      return hit
    }
    case 'gemini':
      if (ai.mode === 'down') return false
      if (src === 'hook' || src === 'disc') { e.stun = 0.8; c.ev.push({ type: 'discHit', x: e.x, y: e.y }); return true }
      return damage(c, e, dmg, fromX, fromY, opt)
    default:
      return null
  }
}

function damage(c: Ctx, e: Enemy, dmg: number, fromX: number, fromY: number, opt?: HitOpts): boolean {
  const big = BIG.has(e.kind)
  // The chain's finisher on a foe stunned (the disc, the hook) or reeling from another blow: a critical one.
  // The chain's own hits leave the foe reeling too, but that is the chain's ordinary course, not a crit.
  const crit = !!opt?.crit || (!!opt?.finisher && !big && (e.stun > 0 || ((e.stagger ?? 0) > 0 && !e.reelChain)))
  const dealt = Math.min(dmg + (crit ? 1 : 0), opt?.cap ?? Infinity)
  e.hp -= dealt
  if (opt?.cap !== undefined) e.ai.took = ((e.ai.took as number | undefined) ?? 0) + dealt
  e.flash = 0.14
  const mercy = big ? 0.45 : opt?.chain ? 0.1 : 0.28
  if (opt?.echo) e.echoInvuln = mercy
  else e.invuln = mercy
  const ddx = e.x - fromX
  const ddy = e.y - fromY
  const len = Math.hypot(ddx, ddy) || 1
  const dx = ddx / len
  const dy = ddy / len
  if (e.kind !== 'king' && e.kind !== 'mistral' && e.kind !== 'gemini') {
    const k = (opt?.knock ?? 1) * (big ? 0.4 : 1)
    e.knock = { vx: dx * 9 * k, vy: dy * 9 * k, t: 0.14 }
  }
  if (!big) { e.stagger = Math.max(e.stagger ?? 0, opt?.stagger ?? 0.12); e.reelChain = !!opt?.chain }
  e.hitT = 0
  e.hitDx = dx
  e.hitDy = dy
  const heavy = (opt?.stop ?? 0) >= 50
  if (e.kind === 'gemini' && e.hp <= 0) {
    // A twin at zero falls down; the other must follow before it gets up again.
    const twin = c.s.map.enemies.find(o => o !== e && o.kind === 'gemini' && o.cell === e.cell && !o.dead)
    if (twin && twin.ai.mode !== 'down') {
      e.hp = 0
      e.ai.mode = 'down'
      e.ai.t = 4
      e.ai.tell = 0
      e.knock = null
      c.ev.push({ type: 'hit', x: e.x, y: e.y, kind: e.kind, killed: false, dx, dy, heavy: true })
      c.ev.push({ type: 'hitStop', ms: 120 })
      c.ev.push({ type: 'bossPhase', phase: 2 })
      return true
    }
    if (twin) { twin.hp = 0; twin.dead = true; twin.deathT = 0; c.ev.push({ type: 'kill', x: twin.x, y: twin.y, kind: twin.kind }) }
  }
  const killed = e.hp <= 0
  c.ev.push({ type: 'hit', x: e.x, y: e.y, kind: e.kind, killed, dx, dy, heavy, crit })
  // Hitstop by weight: a quick hit of the chain, the finisher, a boss, a kill.
  c.ev.push({ type: 'hitStop', ms: killed ? 90 : BOSSES.has(e.kind) ? 60 : opt?.stop ?? 40 })
  if (killed) killEnemy(c, e)
  else if ((e.kind === 'king' || e.kind === 'mistral' || e.kind === 'deepseek' || e.kind === 'mixtral' || e.kind === 'parrot') && e.hp <= STATS[e.kind].hp / 2 && e.ai.phase !== 2) {
    e.ai.phase = 2
    c.ev.push({ type: 'bossPhase', phase: 2 })
    c.ev.push({ type: 'hitStop', ms: 120 })
    c.s.shake = 0.4
  }
  return true
}

export function killEnemy(c: Ctx, e: Enemy) {
  e.dead = true
  e.deathT = 0
  e.stagger = 0
  e.knock = null
  c.ev.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind })
  if (e.once) setFlag(c.s, e.once)
  // A reward that waits on this fall and is to lie where it happened.
  for (const p of c.s.map.pickups) if (p.atFall && p.appear && 'flag' in p.appear && p.appear.flag === e.once) Object.assign(p, footing(c, e))
  // The Parrot's own bombs go with it.
  if (e.kind === 'parrot') c.s.map.bombs = c.s.map.bombs.filter(b => !b.by)
  if (BOSSES.has(e.kind)) {
    c.ev.push({ type: 'bossDown', kind: e.kind })
    c.s.shake = 0.6
    // The room's small fry go with their master (another heavy foe stays: the Echo Barrow's pair of knights).
    for (const o of c.s.map.enemies) if (o !== e && o.cell === e.cell && !o.dead && o.kind !== 'eye' && !BIG.has(o.kind)) { o.dead = true; o.deathT = 0; c.ev.push({ type: 'kill', x: o.x, y: o.y, kind: o.kind }) }
    return
  }
  // A tough one always leaves a heart and five bits, side by side (and its key, if it carries one).
  if (e.tough) {
    spawnDrop(c, e.x - 0.3, e.y, 'heart')
    spawnDrop(c, e.x + 0.3, e.y, 'bit5')
    if (e.carries === 'smallKey') spawnDrop(c, e.x, e.y + 0.3, 'key')
    return
  }
  if (e.carries === 'smallKey') { spawnDrop(c, e.x, e.y, 'key'); return }
  rollDrop(c, e.x, e.y, 0.55)
}

// ---------------------------------------------------------------------------
// Drops
// ---------------------------------------------------------------------------

export function spawnDrop(c: Ctx, x: number, y: number, kind: DropKind) {
  const m = c.s.map
  if (m.drops.length > 24) m.drops.shift()
  m.drops.push({ id: nextId(c.s), kind, x, y, t: 0, z: 0, vz: 5, life: kind === 'key' ? Infinity : 10 })
  c.ev.push({ type: 'drop', kind })
}

/** Random loot: hearts when hurt, bombs once you carry them, bits otherwise. */
export function rollDrop(c: Ctx, x: number, y: number, p: number) {
  const s = c.s
  if (!chance(s, p)) return
  const h = s.hero
  const r = rnd(s)
  const hurt = h.hp < h.maxHp
  if (hurt && r < 0.32) spawnDrop(c, x, y, 'heart')
  else if (s.inv.bombBag && r < 0.45) spawnDrop(c, x, y, 'bomb')
  else if (r < 0.88) spawnDrop(c, x, y, 'bit')
  else spawnDrop(c, x, y, 'bit5')
}

export function collectDrop(c: Ctx, kind: DropKind) {
  const s = c.s
  const inv = s.inv
  if (kind === 'heart') s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + 2)
  else if (kind === 'bit') inv.bits = Math.min(MAX_BITS, inv.bits + 1)
  else if (kind === 'bit5') inv.bits = Math.min(MAX_BITS, inv.bits + 5)
  else if (kind === 'bomb') inv.bombs = Math.min(bombMax(s), inv.bombs + 2)
  else if (kind === 'key') addKeys(s, 1)
  c.ev.push({ type: 'collect', kind })
}

export const bombMax = (s: GameState) => (s.inv.bombBag ? (s.inv.bigBag ? 20 : 12) : 0)

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export function itemText(s: GameState, item: ItemId): string[] {
  switch (item) {
    case 'sword': return ['YOU GOT THE NEON BLADE!', 'PRESS {A} TO SWING, AND AGAIN FOR THE NEXT BLOW. HOLD {A}, THEN LET GO, FOR A SPIN ATTACK.', '{ROLL} ROLLS YOU OUT OF HARM\'S WAY. {A} IN A ROLL FLIPS YOU OVER. PAUSE FOR YOUR MOVES.', 'THE KEEPER WANTS A WORD BEFORE YOU GO.']
    case 'bombBag': return ['YOU GOT BOMBS!', 'PRESS {B} TO SET ONE. A BLAST BREAKS CRACKED ROCK AND WALLS.']
    case 'bombs5': return ['FIVE BOMBS. HANDLE WITH CARE.']
    case 'disc': return ['YOU GOT THE PRISM DISC!', 'PRESS {B} TO THROW IT. IT STUNS FOES, FETCHES LOOT AND FLIPS FAR SWITCHES.', '{CYCLE} SWAPS BETWEEN BOMBS AND THE DISC.']
    case 'smallKey': return ['A SMALL KEY. WALK INTO A LOCKED DOOR TO OPEN IT.']
    // (The Shrine's ring is the one with the King behind its great door.)
    case 'bigKey':
      if (s.map.ring === 'underglow') return ['THE BIG KEY! IT OPENS THE DOOR AT THE FOOT OF THE HEAP.']
      if (s.map.ring === 'lateshow') return ['THE LAST REEL! THE BOOTH HAS A SLOT FOR IT.']
      return [s.map.ring === 'shrine' ? 'THE BIG KEY! IT OPENS THE GREAT DOOR TO THE KING.' : 'THE BIG KEY! IT OPENS THE GREAT DOOR HERE.']
    case 'heartPiece': return s.inv.pieces === 0
      ? ['A PIECE OF HEART!', 'THAT MAKES FOUR. YOUR LIFE GREW BY ONE HEART!']
      : [`A PIECE OF HEART! (${s.inv.pieces}/4)`]
    case 'heartContainer': return ['A HEART CONTAINER! YOUR LIFE GREW BY ONE HEART.']
    case 'heart': return ['LIFE RESTORED.']
    case 'bits5': return ['YOU GOT 5 BITS.']
    case 'bits20': return ['YOU GOT 20 BITS!']
    case 'bits50': return ['YOU GOT 50 BITS!']
    case 'prism': return ['YOU GOT THE SUN PRISM!', 'THE SKY CAN FINALLY SET. TIME TO GO HOME.']
    case 'echo': return ['YOU GOT THE ECHO!', '{B} LEAVES ONE WHERE YOU STAND. WHEN YOU CUT, IT CUTS.']
    case 'no': return ['YOU GOT THE NO!', 'A CUT AT THE RIGHT MOMENT REFUSES A BLOW OR AN OFFER.']
    case 'lamp': return ['YOU GOT THE STORM LAMP!', '{B} SETS IT DOWN WHERE YOU FACE. {B} AGAIN TAKES IT UP.']
    case 'magnet': return ['YOU GOT THE MAGNET!', '{B} LATCHES THE NEAREST METAL. LOOSE COMES TO YOU. BOLTED TAKES YOU.', '{CYCLE} SWAPS BETWEEN YOUR ITEMS.']
    case 'stomp': return ['YOU GOT THE STOMP!', 'IN THE AIR, {A} COMES DOWN HARD.']
    case 'hook': return ['YOU GOT THE GRAPPLING HOOK!', 'PRESS {B} TO FIRE IT. IT BITES INTO POSTS, PILLARS, LAMPS AND CHESTS, AND REELS YOU OVER PITS AND WATER.', '{CYCLE} SWAPS BETWEEN YOUR ITEMS.']
    case 'arc': return ['YOU GOT THE ARC BLADE!', "PROJECT HORIZON'S LAST PROTOTYPE. IT HITS TWICE AS HARD AND CUTS THROUGH STATIC VINES."]
    case 'bigBag': return ['A BIGGER BOMB BAG! YOU CAN CARRY 20 BOMBS NOW.']
    case 'waffle': return ['A WAFFLE, STILL WARM.', 'SOMEONE IN THESE WOODS WOULD DO A LOT FOR ONE OF THESE.']
    case 'shroom': return s.inv.shrooms >= 3
      ? ['A GLOWSHROOM! (3/3)', 'THAT IS ALL THREE. MOSSA WILL BE PLEASED.']
      : [`A GLOWSHROOM! (${s.inv.shrooms}/3)`]
    case 'tube': return ['A VACUUM TUBE, STILL GOOD.', "SOMEBODY'S RADIO NEEDS ONE OF THESE."]
    case 'walkie': return ['A WALKIE-TALKIE. A STICKER ON THE BACK SAYS: PROPERTY OF TOBY. OVER.']
    case 'hat': return ['AN ENORMOUS GREEN FELT HAT. IT SMELLS OF MOSS AND BROWN CHEESE.']
    case 'artHop': return ['YOU LEARNED HOP!', 'PRESS {B} TO HOP CLEAR OF A FOE, STILL FACING IT. NO BLOW REACHES YOU IN THE AIR.', 'PRESS {A} IN THE HOP AND YOU SPRING BACK IN WITH A CUT. THE CHAIN OF CUTS GOES ON THROUGH IT.', 'THE HOP SITS ON {B} WITH YOUR ITEMS: {CYCLE} SWAPS.']
    case 'weightMeaning': case 'weightReasons': case 'weightNo': case 'weightSurprise':
    case 'weightFingers': case 'weightCredit': case 'weightSources': return weightText(item)
  }
}

function weightText(id: WeightId): string[] {
  const { word } = WEIGHTS.find(w => w.id === id)!
  const end = id === 'weightNo' ? 'IT IS THE SMALLEST. IT IS THE HEAVIEST.' : 'IT IS HEAVIER THAN IT LOOKS.'
  return ['YOU GOT A SACRED WEIGHT!', `IT IS STAMPED ${word}. ${end}`]
}

/** Apply an item to the inventory (no presentation). */
export function grant(s: GameState, item: ItemId) {
  const inv = s.inv
  const h = s.hero
  switch (item) {
    case 'sword': inv.sword = true; break
    case 'bombBag': inv.bombBag = true; inv.bombs = 8; if (!inv.selected || isArt(inv.selected)) inv.selected = 'bombs'; break
    case 'bombs5': inv.bombs = Math.min(bombMax(s), inv.bombs + 5); break
    case 'disc': inv.disc = true; inv.selected = 'disc'; break
    case 'smallKey': addKeys(s, 1); break
    case 'bigKey': if (s.map.ring === 'shrine') inv.bigKey = true; else setFlag(s, `bigkey:${s.map.ring}`); break
    case 'heartPiece':
      inv.pieces++
      if (inv.pieces >= 4) { inv.pieces = 0; h.maxHp += 2; h.hp = h.maxHp }
      break
    case 'heartContainer': h.maxHp += 2; h.hp = h.maxHp; break
    case 'heart': h.hp = Math.min(h.maxHp, h.hp + 2); break
    case 'bits5': inv.bits = Math.min(MAX_BITS, inv.bits + 5); break
    case 'bits20': inv.bits = Math.min(MAX_BITS, inv.bits + 20); break
    case 'bits50': inv.bits = Math.min(MAX_BITS, inv.bits + 50); break
    case 'prism': inv.prism = true; break
    case 'hook': inv.hook = true; inv.selected = 'hook'; break
    case 'arc': inv.arc = true; inv.sword = true; break
    case 'echo': inv.echo = true; inv.selected = 'echo'; break
    case 'lamp': inv.lamp = true; inv.selected = 'lamp'; break
    case 'magnet': inv.magnet = true; inv.selected = 'magnet'; break
    case 'stomp': inv.stomp = true; break
    case 'bigBag': inv.bigBag = true; inv.bombBag = true; inv.bombs = 20; if (!inv.selected) inv.selected = 'bombs'; break
    case 'shroom': inv.shrooms = Math.min(3, inv.shrooms + 1); break
    case 'waffle': case 'tube': case 'walkie': case 'hat': break
    // THE NO is held by its flag alone (`engine/refuse.ts`).
    case 'no': break
    // A Sacred Weight is held by its flag alone (`hasWeight`).
    case 'weightMeaning': case 'weightReasons': case 'weightNo': case 'weightSurprise':
    case 'weightFingers': case 'weightCredit': case 'weightSources': break
    case 'artHop': learnArt(s, artOfItem(item)!); break
  }
  setFlag(s, `item:${item}`)
}

/** Grant with the item-get pose and text. */
export function acquire(c: Ctx, item: ItemId) {
  const s = c.s
  grant(s, item)
  s.mode = 'get'
  s.get = { item, t: 0, text: itemText(s, item) }
  const h = s.hero
  h.act = 'get'
  h.actT = 0
  h.swing = null
  h.spin = null
  h.roll = null
  endMoves(h)
  h.bufA = 0
  h.charge = -1
  h.knock = null
  c.ev.push({ type: 'itemGet', item })
}
