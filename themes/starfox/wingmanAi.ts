import type { EnemyKind } from './balance'

export type WingMode = 'formation' | 'hunt' | 'regroup' | 'cover'
export type TargetKind = EnemyKind | 'turret' | 'core'

export interface WingTarget {
  id: number
  kind: TargetKind
  x: number
  y: number
  z: number
  vx: number
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
}

export interface WingAi {
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
  core: 1
}

/**
 * Create a new wingman AI state object, initialized to formation mode.
 */
export function createWingAi(): WingAi {
  return {
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
  const str = list[ai.sayIdx % list.length]
  ai.sayIdx++
  return str
}

/** Score a candidate: lateral reach + depth, minus a threat bonus. Lower is better. */
function targetCost(t: WingTarget, buddy: { x: number; y: number }): number {
  const dx = t.x - buddy.x
  const dy = t.y - buddy.y
  return Math.sqrt(dx * dx + dy * dy) + 0.02 * Math.abs(t.z) - 4 * (THREAT[t.kind] ?? 1)
}

/** A newcomer must beat the current target's cost by this much to steal the lock. */
export const RETARGET_MARGIN = 3

/**
 * Pick the best target from the candidate list.
 * Candidates must satisfy huntZ[0] < z < huntZ[1].
 * Sticky: the current target is kept while it is in range, unless another
 * candidate beats its cost by RETARGET_MARGIN (a kamikaze diving in).
 * Cost: lateral distance + 0.02*|z| - 4*THREAT[kind]; lowest wins.
 */
export function pickTarget(
  targets: WingTarget[],
  buddy: { x: number; y: number },
  current: number | null
): WingTarget | null {
  const [zMin, zMax] = WING_AI.huntZ
  const candidates = targets.filter(t => t.z > zMin && t.z < zMax)

  if (candidates.length === 0) return null

  let best: WingTarget | null = null
  let bestScore = Infinity
  for (const t of candidates) {
    const score = targetCost(t, buddy)
    if (score < bestScore) {
      bestScore = score
      best = t
    }
  }

  // Sticky: keep the current target unless the best is clearly better.
  if (current !== null) {
    const cur = candidates.find(t => t.id === current)
    if (cur && targetCost(cur, buddy) - RETARGET_MARGIN <= bestScore) return cur
  }

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

  // 1. Update timers
  ai.modeT += dt
  ai.retargetT -= dt

  // 2. Demo mode: formation flying, no targeting, no fire
  if (demo) {
    ai.mode = 'formation'
    ai.targetId = null
    return {
      tx: formation.x,
      ty: formation.y,
      fire: false,
      say: null,
      mode: 'formation'
    }
  }

  let say: string | null = null

  // 3. Cover mode if ship HP is critical
  if (ship.hp < WING_AI.coverHp) {
    if (ai.mode !== 'cover') {
      ai.mode = 'cover'
      ai.modeT = 0
      say = callout(ai, 'cover')
    }
    ai.targetId = null
    const tx = clamp(formation.x, -lane.xMax, lane.xMax)
    const ty = clamp(formation.y, lane.yLo, lane.yHi)

    // Still fire if a target crosses the lane
    const [zMin, zMax] = WING_AI.huntZ
    const fireTargets = targets.filter(t => t.z > zMin && t.z < zMax)
    const fire = fireTargets.some(t => canFire(buddy, t))

    return { tx, ty, fire, say, mode: ai.mode }
  }

  // 4. Exit cover mode if HP recovered
  if (ai.mode === 'cover') {
    ai.mode = 'regroup'
    ai.modeT = 0
  }

  // 5. Target maintenance
  let t = pickTarget(targets, buddy, ai.targetId)

  if (t === null) {
    ai.targetId = null
  } else if (t.id !== ai.targetId) {
    // Only switch if no current target or retarget cooldown has expired
    if (ai.targetId === null || ai.retargetT <= 0) {
      ai.targetId = t.id
      ai.retargetT = WING_AI.retargetCooldown
      say = callout(ai, 'lock')
    }
  }

  // Transition to hunt when a target appears in formation/regroup
  if ((ai.mode === 'regroup' || ai.mode === 'formation') && t !== null) {
    ai.mode = 'hunt'
    ai.modeT = 0
    if (!ai.leftSlot) {
      ai.leftSlot = true
      say = callout(ai, 'breakOff') // breakOff overrides lock
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
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < WING_AI.regroupRadius) {
      ai.mode = 'formation'
      ai.modeT = 0
      ai.leftSlot = false
      say = callout(ai, 'regroup')
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

  // Clamp to lane bounds
  tx = clamp(tx, -lane.xMax, lane.xMax)
  ty = clamp(ty, lane.yLo, lane.yHi)

  // 9. Fire if any target in huntZ passes line-of-sight check
  const [zMin, zMax] = WING_AI.huntZ
  const fireTargets = targets.filter(tg => tg.z > zMin && tg.z < zMax)
  const fire = fireTargets.some(tg => canFire(buddy, tg))

  // 10. Return step
  return { tx, ty, fire, say, mode: ai.mode }
}

/**
 * Clamp a value to [min, max].
 */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}
