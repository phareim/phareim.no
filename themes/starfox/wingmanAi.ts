/**
 * Star Fox wingman brain — pure, no three.js, DOM or Vue
 * (tests/starfox-wingman.test.mjs).
 *
 * One `WingAi` per wingman. `createWingAi()` with no id is the original
 * single wingman (the WING_AI constants); `createWingAi('heron' | 'bison' |
 * 'dingo' | …)` flies that pilot's profile from balance.ts `WINGMEN`: its
 * own hunt window, leash, guard (threats to the player first), kill-steal
 * pull, retarget margin and cover threshold. Three at once: step them with
 * `stepSquad`, which passes each the targets the others have locked, so
 * they spread out — except on a boss core, which all may share.
 */

import type { EnemyKind, WingId, WingProfile } from './balance'
import { WINGMEN } from './balance.ts'

export type WingMode = 'formation' | 'hunt' | 'regroup' | 'cover'
/** Enemy kinds plus boss pieces: `part` = any breakable boss part (claw,
 * panel, knee, Crown turret), `core` = the weak point. `turret` is the
 * ground emplacement (an EnemyKind since 2026-09-25); the old DREADNOUGHT
 * passes its hull turrets as `turret` too until Flight.vue moves to `part`. */
export type TargetKind = EnemyKind | 'part' | 'core'

export interface WingTarget {
  id: number
  kind: TargetKind
  x: number
  y: number
  z: number
  vx: number
  /** a missile homing on the player: guards take it first */
  onShip?: boolean
}

export interface WingInput {
  dt: number
  now: number
  buddy: { x: number; y: number }
  ship: { x: number; y: number; hp: number }
  formation: { x: number; y: number }
  lane: { xMax: number; yLo: number; yHi: number }
  targets: WingTarget[]
  demo: boolean
  /** target ids other wingmen have locked (stepSquad fills this) */
  claimed?: readonly number[]
}

export interface WingAi {
  /** the pilot, or null for the original single wingman */
  id: WingId | null
  mode: WingMode
  targetId: number | null
  modeT: number
  retargetT: number
  sayIdx: number
  leftSlot: boolean
}

export interface WingStep {
  tx: number
  ty: number
  fire: boolean
  say: string | null
  /** which callout `say` came from, so the story can voice it per pilot */
  sayKey: CalloutKey | null
  mode: WingMode
}

export type CalloutKey = 'lock' | 'breakOff' | 'regroup' | 'hit' | 'down' | 'online' | 'cover'

export const CALLOUTS: Record<CalloutKey, string[]> = {
  lock: ['TARGET LOCKED', 'GOT ONE IN MY SIGHTS', 'ENGAGING'],
  breakOff: ['BREAKING OFF', 'GOING HUNTING'],
  regroup: ['BACK IN FORMATION', 'ON YOUR WING'],
  hit: ["I'M HIT", 'TAKING FIRE'],
  down: ['WING DOWN', 'EJECTING'],
  online: ['BACK ONLINE', 'READY TO FLY'],
  cover: ['COVERING YOU', 'STAY CLOSE, I GOT YOU']
}

export const WING_AI = {
  retargetCooldown: 0.6,
  minHuntTime: 1.0,
  fireTolX: 0.9,
  fireTolY: 1.3,
  huntZ: [-170, -10] as [number, number],
  leadTime: 0.45,
  coverHp: 30,
  calloutTime: 2.2,
  regroupRadius: 1.5,
  /** missiles are chased until they are this close (z) — they come in
   * past the normal hunt window */
  missileZ: -3,
  /** ground turrets are only worth chasing when this close across */
  turretLineX: 2.5,
  /** extra threat for a missile homing on the player */
  onShipBonus: 1.5,
  /** cost added to a target another wingman has locked */
  claimPenalty: 12,
  /** a dive counts as "at the player" inside this lateral distance… */
  guardX: 3,
  /** …and closer than this depth */
  guardZ: -80,
  /** "in the player's line" for the kill-steal pull */
  stealX: 2.5,
  turnRate: {
    formation: 5,
    hunt: 7,
    regroup: 5,
    cover: 5
  }
}

export const THREAT: Record<TargetKind, number> = {
  kamikaze: 3,
  mite: 3,
  dasher: 3,
  sniper: 2,
  weaver: 1.5,
  splitter: 1.5,
  drone: 1,
  bulwark: 0.5,
  turret: 2.5,
  core: 1,
  missile: 4,
  carrier: 1.2,
  part: 2.5,
  rival: 2
}

/** A newcomer must beat the current target's cost by this much to steal the lock. */
export const RETARGET_MARGIN = 3

/** The knobs one wingman flies by. */
export interface WingBrain {
  huntZ: readonly [number, number]
  leash: number
  guard: number
  steal: number
  margin: number
  coverHp: number
  turn: number
}

/** The original single wingman: no leash, no guard, no steal. */
export const DEFAULT_BRAIN: WingBrain = {
  huntZ: WING_AI.huntZ,
  leash: Infinity,
  guard: 0,
  steal: 0,
  margin: RETARGET_MARGIN,
  coverHp: WING_AI.coverHp,
  turn: 1
}

export function brainOf(id: WingId | null | undefined): WingBrain {
  if (!id) return DEFAULT_BRAIN
  const p: WingProfile = WINGMEN[id]
  return { huntZ: p.huntZ, leash: p.leash, guard: p.guard, steal: p.steal, margin: p.margin, coverHp: p.coverHp, turn: p.turn }
}

/** Turn rate for a mode, scaled by the pilot. */
export function turnRate(ai: WingAi, mode: WingMode = ai.mode): number {
  return WING_AI.turnRate[mode] * (mode === 'hunt' ? brainOf(ai.id).turn : 1)
}

/** Inside the depth window the pilot hunts and fires in (missiles closer). */
export function inHuntZone(t: WingTarget, brain: WingBrain = DEFAULT_BRAIN): boolean {
  const zMax = t.kind === 'missile' ? Math.max(WING_AI.missileZ, brain.huntZ[1]) : brain.huntZ[1]
  return t.z > brain.huntZ[0] && t.z < zMax
}

/** Worth steering toward: in the zone, inside the leash, and a ground
 * turret only when it is already nearly in line (no diving at the ground). */
export function isHuntable(
  t: WingTarget, buddy: { x: number; y: number },
  brain: WingBrain = DEFAULT_BRAIN, ship?: { x: number },
): boolean {
  if (!inHuntZone(t, brain)) return false
  if (t.kind === 'turret' && Math.abs(t.x - buddy.x) > WING_AI.turretLineX) return false
  if (ship && Math.abs(t.x - ship.x) > brain.leash + 2) return false
  return true
}

/** Coming at the player: a missile homing on the ship, or a dive close
 * to the ship's line. */
export function threatensShip(t: WingTarget, ship: { x: number }): boolean {
  if (t.onShip) return true
  const diver = t.kind === 'kamikaze' || t.kind === 'mite' || t.kind === 'missile' || t.kind === 'dasher'
  return diver && t.z > WING_AI.guardZ && Math.abs(t.x - ship.x) < WING_AI.guardX
}

function threatOf(t: WingTarget, brain: WingBrain, ship?: { x: number }): number {
  let th = (THREAT[t.kind] ?? 1) + (t.onShip ? WING_AI.onShipBonus : 0)
  if (ship && brain.guard > 0 && threatensShip(t, ship)) th += brain.guard
  if (ship && brain.steal > 0 && Math.abs(t.x - ship.x) < WING_AI.stealX) th += brain.steal
  return th
}

/**
 * Create a wingman AI state, in formation. No id = the original wingman.
 */
export function createWingAi(id: WingId | null = null): WingAi {
  return {
    id,
    mode: 'formation',
    targetId: null,
    modeT: 0,
    retargetT: 0,
    sayIdx: 0,
    leftSlot: false
  }
}

/**
 * Get a callout string for the given key, cycling through the list.
 * Mutates ai.sayIdx.
 */
export function callout(ai: WingAi, key: CalloutKey): string {
  const list = CALLOUTS[key]
  const str = list[ai.sayIdx % list.length]!
  ai.sayIdx++
  return str
}

export interface PickOpts {
  brain?: WingBrain
  ship?: { x: number }
  /** ids other wingmen have locked: penalised unless a boss core */
  claimed?: readonly number[]
}

/** Score a candidate: lateral reach + depth, minus a threat bonus, plus a
 * penalty when someone else has it. Lower is better. */
function targetCost(t: WingTarget, buddy: { x: number; y: number }, o: PickOpts): number {
  const dx = t.x - buddy.x
  const dy = t.y - buddy.y
  const claimed = t.kind !== 'core' && !!o.claimed && o.claimed.includes(t.id)
  return Math.sqrt(dx * dx + dy * dy) + 0.02 * Math.abs(t.z)
    - 4 * threatOf(t, o.brain ?? DEFAULT_BRAIN, o.ship)
    + (claimed ? WING_AI.claimPenalty : 0)
}

/**
 * Pick the best target from the candidate list.
 * Candidates must be huntable: inside the pilot's hunt window (missiles
 * up to missileZ), inside its leash, ground turrets only when nearly in
 * line. Sticky: the current target is kept unless another beats its cost
 * by the pilot's margin (a kamikaze diving in). Cost: lateral distance +
 * 0.02·|z| − 4·threat (+ guard/steal bonuses) + claimPenalty when another
 * wingman has it; lowest wins.
 */
export function pickTarget(
  targets: WingTarget[],
  buddy: { x: number; y: number },
  current: number | null,
  opts: PickOpts = {}
): WingTarget | null {
  const brain = opts.brain ?? DEFAULT_BRAIN
  let best: WingTarget | null = null
  let bestScore = Infinity
  let cur: WingTarget | null = null
  for (const t of targets) {
    if (!isHuntable(t, buddy, brain, opts.ship)) continue
    if (t.id === current) cur = t
    const score = targetCost(t, buddy, opts)
    if (score < bestScore) {
      bestScore = score
      best = t
    }
  }
  // Sticky: keep the current target unless the best is clearly better.
  if (cur && targetCost(cur, buddy, opts) - brain.margin <= bestScore) return cur
  return best
}

/**
 * Check if the buddy can fire at the target (line of sight).
 */
export function canFire(buddy: { x: number; y: number }, target: { x: number; y: number }): boolean {
  return (
    Math.abs(target.x - buddy.x) < WING_AI.fireTolX &&
    Math.abs(target.y - buddy.y) < WING_AI.fireTolY
  )
}

/**
 * Step the wingman AI state machine. Mutates ai and returns the desired position and action.
 */
export function stepWingman(ai: WingAi, input: WingInput): WingStep {
  const { dt, buddy, ship, formation, lane, targets, demo } = input
  const brain = brainOf(ai.id)

  // 1. Update timers
  ai.modeT += dt
  ai.retargetT -= dt

  // 2. Demo mode: formation flying, no targeting, no fire
  if (demo) {
    ai.mode = 'formation'
    ai.targetId = null
    return { tx: formation.x, ty: formation.y, fire: false, say: null, sayKey: null, mode: 'formation' }
  }

  let sayKey: CalloutKey | null = null
  let say: string | null = null
  const speak = (k: CalloutKey) => { sayKey = k; say = callout(ai, k) }

  // 3. Cover mode if ship HP is critical
  if (ship.hp < brain.coverHp) {
    if (ai.mode !== 'cover') {
      ai.mode = 'cover'
      ai.modeT = 0
      speak('cover')
    }
    ai.targetId = null
    const tx = clamp(formation.x, -lane.xMax, lane.xMax)
    const ty = clamp(formation.y, lane.yLo, lane.yHi)
    // Still fire if a target crosses the lane
    const fire = targets.some(t => inHuntZone(t, brain) && canFire(buddy, t))
    return { tx, ty, fire, say, sayKey, mode: ai.mode }
  }

  // 4. Exit cover mode if HP recovered
  if (ai.mode === 'cover') {
    ai.mode = 'regroup'
    ai.modeT = 0
  }

  // 5. Target maintenance
  const t = pickTarget(targets, buddy, ai.targetId, { brain, ship, claimed: input.claimed })

  if (t === null) {
    ai.targetId = null
  } else if (t.id !== ai.targetId) {
    // Only switch if no current target or retarget cooldown has expired
    if (ai.targetId === null || ai.retargetT <= 0) {
      ai.targetId = t.id
      ai.retargetT = WING_AI.retargetCooldown
      speak('lock')
    }
  }

  // Transition to hunt when a target appears in formation/regroup
  if ((ai.mode === 'regroup' || ai.mode === 'formation') && t !== null) {
    ai.mode = 'hunt'
    ai.modeT = 0
    if (!ai.leftSlot) {
      ai.leftSlot = true
      speak('breakOff') // breakOff overrides lock
    }
  }

  // 6. Hunt mode timeout: switch to regroup after minHuntTime with no target
  if (ai.mode === 'hunt' && ai.targetId === null) {
    if (ai.modeT >= WING_AI.minHuntTime) {
      ai.mode = 'regroup'
      ai.modeT = 0
    }
  }

  // 7. Regroup complete when buddy is close enough to formation
  if (ai.mode === 'regroup') {
    const dx = buddy.x - formation.x
    const dy = buddy.y - formation.y
    if (Math.sqrt(dx * dx + dy * dy) < WING_AI.regroupRadius) {
      ai.mode = 'formation'
      ai.modeT = 0
      ai.leftSlot = false
      speak('regroup')
    }
  }

  // 8. Desired lane position
  let tx = formation.x
  let ty = formation.y

  if (ai.mode === 'hunt' && ai.targetId !== null) {
    const target = targets.find(tg => tg.id === ai.targetId)
    if (target) {
      tx = target.x + target.vx * WING_AI.leadTime
      ty = target.y
    }
  }

  // Leash to the ship, then the lane
  tx = clamp(tx, ship.x - brain.leash, ship.x + brain.leash)
  tx = clamp(tx, -lane.xMax, lane.xMax)
  ty = clamp(ty, lane.yLo, lane.yHi)

  // 9. Fire if any target in the zone passes the line-of-sight check
  const fire = targets.some(tg => inHuntZone(tg, brain) && canFire(buddy, tg))

  return { tx, ty, fire, say, sayKey, mode: ai.mode }
}

export interface SquadMember {
  ai: WingAi
  input: WingInput
}

/**
 * Step several wingmen for one frame. Each sees the targets the others
 * hold (their locks before this frame, updated as the frame goes), so
 * three wingmen spread over three enemies; a boss core is never claimed.
 * Order matters a little: earlier members pick first. Writes each
 * member's `input.claimed`.
 */
export function stepSquad(members: readonly SquadMember[]): WingStep[] {
  const out: WingStep[] = []
  for (let i = 0; i < members.length; i++) {
    const claimed: number[] = []
    for (let j = 0; j < members.length; j++) {
      if (j === i) continue
      const id = members[j]!.ai.targetId
      if (id !== null) claimed.push(id)
    }
    members[i]!.input.claimed = claimed
    out.push(stepWingman(members[i]!.ai, members[i]!.input))
  }
  return out
}

/**
 * Clamp a value to [min, max].
 */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}
