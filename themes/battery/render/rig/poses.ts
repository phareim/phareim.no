/**
 * Poses: what the body does, as targets for the rig's two-bone arms and
 * legs, plus the face. Every pose is a pure function of a small frame
 * descriptor, so a drawn frame can be cached by its key.
 *
 * Arm targets are the hand's position relative to the shoulder in units of
 * the arm's length (x outward in the front and back views, forward in the
 * side view; y down), or `at` in local pixels (feet at 0, 0). Leg targets
 * are where the foot goes: x in leg lengths (outward / forward), `lift` in
 * pixels above the floor.
 *
 * Pose names (BUILD.md "Poses"): '' idle/walk, reach, pickup, strain, shrug,
 * think, point, scared, wave, cheer, sit, fall, lie, carry, eat, back.
 */
import type { Look, RigId } from './looks'

export type RigView = 'front' | 'side' | 'back'
export type Eyes = 'open' | 'closed' | 'wide' | 'happy' | 'squeeze' | 'up' | 'side' | 'half' | 'dazed' | 'down'
export type Mouth = 'shut' | 'open' | 'o' | 'smile' | 'grin' | 'wobble' | 'chew' | 'teeth' | 'hmm' | 'talk1' | 'talk2'
export type Brows = 'rest' | 'up' | 'worried' | 'angry' | 'one'
export type Hand = 'mitt' | 'point' | 'open' | 'fist'

export interface Arm {
  x: number
  y: number
  /** Absolute local target (overrides x, y). */
  at?: readonly [number, number]
  /** Which way the elbow bends (+1 / −1). */
  bend: number
  hand?: Hand
}
export interface Leg { x: number; lift: number }

export interface Rig {
  view: RigView
  /** Whole-body vertical offset (negative is up: a jump). */
  dy: number
  /** Hips lowered by this many pixels (knees bend). */
  crouch: number
  /** Shoulders shifted forward (side) or sideways (front), px. */
  lean: number
  headDx: number
  headDy: number
  /** Shoulders up by this many pixels (breath, shrug). */
  lift: number
  /** [screen-left / far, screen-right / near]. */
  arms: [Arm, Arm]
  legs: [Leg, Leg]
  eyes: Eyes
  mouth: Mouth
  brows: Brows
  ears: 'rest' | 'up' | 'flop' | 'wild' | 'back'
  prop: '' | 'battery' | 'spoon' | 'meter' | 'sweat'
  /** Whole-body x jitter (trembling). */
  shake: number
  /** Quarter turns of the finished frame (fall, lie). */
  rot: number
  /** Tail swing, px. */
  tail: number
}

export interface FrameDesc {
  id: RigId
  view: RigView
  pose: string
  /** Pose frame. */
  f: number
  /** Walk frame 0–7, or −1 standing. */
  walk: number
  blink: boolean
  /** 0 shut, 1 / 2 open shapes while talking. */
  talk: number
  /** Idle fidget code ('' none). */
  idle: string
  /** Espen's ears without the wire. */
  flop: boolean
}

export const WALK_FRAMES = 8

/** How many frames each pose cycles through, and how fast (frames/s). */
export const POSE_ANIM: Record<string, [number, number]> = {
  '': [1, 1], reach: [1, 1], pickup: [1, 1], strain: [2, 12], shrug: [1, 1], think: [2, 1.5], point: [1, 1],
  scared: [2, 14], wave: [2, 5], cheer: [2, 4], sit: [1, 1], fall: [4, 10], lie: [1, 1], carry: [1, 1],
  eat: [2, 4], back: [1, 1],
}

const hang = (view: RigView, out = 0.12): Arm => ({ x: view === 'side' ? 0.04 : out, y: 0.97, bend: view === 'side' ? 1 : -1 })

export function baseRig(view: RigView): Rig {
  return {
    view, dy: 0, crouch: 0, lean: 0, headDx: 0, headDy: 0, lift: 0,
    arms: [hang(view), hang(view)],
    legs: [{ x: 0, lift: 0 }, { x: 0, lift: 0 }],
    eyes: 'open', mouth: 'shut', brows: 'rest', ears: 'rest', prop: '', shake: 0, rot: 0, tail: 0,
  }
}

/** The walk: foot targets and arm swing for walk frame `w`. */
function walkLegs(r: Rig, L: Look, w: number) {
  const stride = L.id === 'dag' ? 0.3 : L.id === 'espen' ? 0.42 : 0.36
  const liftPx = L.id === 'dag' ? 2 : L.id === 'espen' ? 3.5 : 3
  const ph = w / WALK_FRAMES
  const foot = (p: number): Leg => {
    // Stance: the foot slides back along the floor; swing: it lifts and comes forward.
    if (p < 0.5) return { x: stride * (1 - 4 * p), lift: 0 }
    const q = (p - 0.5) * 2
    return { x: stride * (-1 + 2 * q), lift: Math.sin(q * Math.PI) * liftPx }
  }
  if (r.view === 'side') {
    r.legs = [foot(ph), foot((ph + 0.5) % 1)]
    const sw = Math.sin(ph * Math.PI * 2)
    r.arms = [{ x: -sw * 0.42, y: 0.92, bend: 1 }, { x: sw * 0.42, y: 0.92, bend: 1 }]
    // The body drops when the legs are apart.
    const apart = Math.abs(Math.cos(ph * Math.PI * 2))
    r.dy = apart > 0.7 ? 1 : 0
    r.lean = L.id === 'espen' ? 1 : L.id === 'kjell' ? 1 : 0
    r.tail = -Math.round(sw)
  } else {
    const s = Math.sin(ph * Math.PI * 2)
    r.legs = [{ x: 0, lift: Math.max(0, s) * liftPx * 0.8 }, { x: 0, lift: Math.max(0, -s) * liftPx * 0.8 }]
    r.arms = [{ x: 0.12, y: 0.95 - Math.max(0, -s) * 0.12, bend: -1 }, { x: 0.12, y: 0.95 - Math.max(0, s) * 0.12, bend: -1 }]
    r.dy = Math.abs(s) < 0.4 ? 0 : 1
    r.lean = L.id === 'dag' ? Math.round(s) : 0
    r.tail = Math.round(s)
  }
}

/** Build the rig for one frame. */
export function rigFor(L: Look, d: FrameDesc): Rig {
  // Cheering and tumbling turn to the audience.
  const view = d.pose === 'back' ? 'back' : d.pose === 'fall' || (d.pose === 'cheer' && d.view === 'side') ? 'front' : d.pose === 'lie' ? 'side' : d.view
  const r = baseRig(view)
  const side = view === 'side'
  const front = view === 'front'
  const f = d.f
  // Personalities at rest.
  if (L.id === 'dag') { r.eyes = 'half'; r.mouth = 'smile' }
  if (L.id === 'kjell') { r.brows = 'worried' }
  if (L.id === 'espen') { r.eyes = 'wide'; r.mouth = 'grin' }
  if (L.id === 'professor') { r.mouth = 'smile'; r.brows = 'one' }

  if (d.walk >= 0) walkLegs(r, L, d.walk)

  switch (d.pose) {
    case 'reach':
      if (side) r.arms[1] = { x: 0.97, y: 0.05, bend: 1, hand: 'open' }, r.lean = 1
      else if (front) r.arms[1] = { x: 0.62, y: 0.55, bend: -1, hand: 'open' }
      else r.arms[1] = { x: 0.25, y: -0.92, bend: 1, hand: 'open' }
      r.eyes = L.id === 'espen' ? 'wide' : 'open'
      break
    case 'pickup':
      r.crouch = Math.round(L.legLen * 0.38)
      if (side) {
        r.lean = 4
        r.legs = [{ x: -0.18, lift: 0 }, { x: 0.22, lift: 0 }]
        r.arms[1] = { at: [Math.round(L.legLen * 0.55) + 4, -2], x: 0, y: 0, bend: 1, hand: 'open' }
        r.arms[0] = { at: [Math.round(L.legLen * 0.4) + 2, -4], x: 0, y: 0, bend: 1 }
        r.headDx = 2
        r.headDy = 1
      } else {
        r.legs = [{ x: 0.12, lift: 0 }, { x: 0.12, lift: 0 }]
        r.arms = [{ at: [3, -2], x: 0, y: 0, bend: -1, hand: 'open' }, { at: [3, -2], x: 0, y: 0, bend: -1, hand: 'open' }]
        r.headDy = 2
      }
      r.eyes = view === 'back' ? 'open' : 'down'
      break
    case 'strain':
      r.shake = f % 2
      r.eyes = 'squeeze'
      r.mouth = 'teeth'
      r.prop = 'sweat'
      if (side) {
        r.legs = [{ x: -0.35, lift: 0 }, { x: 0.3, lift: 0 }]
        r.lean = -2
        r.headDx = -1
        r.arms = [{ x: 0.9, y: 0.25, bend: 1, hand: 'fist' }, { x: 0.95, y: 0.2, bend: 1, hand: 'fist' }]
      } else {
        r.legs = [{ x: 0.3, lift: 0 }, { x: 0.3, lift: 0 }]
        r.crouch = 2
        r.arms = [{ at: [1.5, -L.legLen - Math.round(L.torsoH * 0.45)], x: 0, y: 0, bend: -1, hand: 'fist' }, { at: [1.5, -L.legLen - Math.round(L.torsoH * 0.45)], x: 0, y: 0, bend: -1, hand: 'fist' }]
      }
      break
    case 'shrug':
      r.lift = 1
      r.headDy = 1
      r.brows = 'up'
      r.eyes = L.id === 'dag' ? 'closed' : 'side'
      r.mouth = 'wobble'
      if (side) r.arms = [{ x: 0.35, y: 0.45, bend: 1, hand: 'open' }, { x: 0.55, y: 0.4, bend: 1, hand: 'open' }]
      else r.arms = [{ x: 0.78, y: 0.45, bend: -1, hand: 'open' }, { x: 0.78, y: 0.45, bend: -1, hand: 'open' }]
      break
    case 'think':
      r.eyes = f ? 'up' : 'side'
      r.mouth = 'hmm'
      r.brows = 'one'
      if (side) {
        r.arms[1] = { at: [Math.round(L.headRx * 0.9), -L.legLen - L.torsoH - L.neck + Math.round(L.headRy * 0.75)], x: 0, y: 0, bend: 1, hand: f ? 'point' : 'fist' }
        r.arms[0] = { x: 0.45, y: 0.55, bend: 1 }
      } else {
        r.arms[1] = { at: [2, -L.legLen - L.torsoH - L.neck + Math.round(L.headRy * 0.75)], x: 0, y: 0, bend: -1, hand: 'fist' }
        r.arms[0] = { at: [-2, -L.legLen - Math.round(L.torsoH * 0.35)], x: 0, y: 0, bend: -1 }
      }
      break
    case 'point':
      r.mouth = 'open'
      r.brows = 'up'
      if (side) r.arms[1] = { x: 1, y: -0.12, bend: 1, hand: 'point' }
      else if (front) r.arms[1] = { x: 1, y: -0.1, bend: -1, hand: 'point' }
      else r.arms[1] = { x: 0.4, y: -0.9, bend: 1, hand: 'point' }
      break
    case 'scared':
      r.eyes = 'wide'
      r.mouth = 'o'
      r.brows = 'up'
      r.ears = 'up'
      r.dy = -2
      r.shake = f % 2
      r.prop = 'sweat'
      if (side) r.arms = [{ x: 0.55, y: -0.3, bend: 1, hand: 'open' }, { x: 0.75, y: -0.25, bend: 1, hand: 'open' }], r.lean = -2
      else r.arms = [{ x: 0.5, y: -0.72, bend: 1, hand: 'open' }, { x: 0.5, y: -0.72, bend: 1, hand: 'open' }]
      r.legs = side ? [{ x: -0.1, lift: 0 }, { x: 0.12, lift: 1 }] : [{ x: 0.05, lift: 0 }, { x: 0.05, lift: 0 }]
      break
    case 'wave':
      r.mouth = 'smile'
      r.eyes = L.id === 'dag' ? 'half' : 'happy'
      if (side) r.arms[1] = { x: f ? 0.85 : 0.72, y: f ? -0.45 : -0.62, bend: 1, hand: 'open' }
      else r.arms[1] = { x: f ? 0.6 : 0.35, y: -0.8, bend: 1, hand: 'open' }
      break
    case 'cheer':
      r.mouth = 'grin'
      r.eyes = 'happy'
      r.ears = 'up'
      r.dy = f ? 0 : -3
      if (!f) r.legs = side ? [{ x: -0.15, lift: 0 }, { x: 0.15, lift: 0 }] : [{ x: 0.15, lift: 0 }, { x: 0.15, lift: 0 }]
      if (side) r.arms = [{ x: 0.55, y: -0.8, bend: 1, hand: 'fist' }, { x: 0.8, y: -0.58, bend: 1, hand: 'fist' }]
      else r.arms = [{ x: 0.42, y: -0.88, bend: 1, hand: 'fist' }, { x: 0.42, y: -0.88, bend: 1, hand: 'fist' }]
      break
    case 'sit':
      r.crouch = L.legLen - 3
      if (side) {
        r.legs = [{ x: 0.85, lift: 0 }, { x: 0.95, lift: 0 }]
        r.arms = [{ at: [-5, -2], x: 0, y: 0, bend: 1 }, { x: 0.55, y: 0.55, bend: 1 }]
        r.lean = 1
      } else {
        r.legs = [{ x: -0.1, lift: 0 }, { x: -0.1, lift: 0 }]
        r.arms = [{ x: 0.5, y: 0.8, bend: -1 }, { x: 0.5, y: 0.8, bend: -1 }]
      }
      break
    case 'fall':
      r.eyes = 'wide'
      r.mouth = 'o'
      r.ears = 'wild'
      r.brows = 'up'
      r.arms = [{ x: 0.75, y: -0.55, bend: 1, hand: 'open' }, { x: 0.85, y: -0.35, bend: 1, hand: 'open' }]
      r.legs = [{ x: 0.35, lift: 3 }, { x: 0.25, lift: 5 }]
      r.rot = f
      break
    case 'lie':
      r.eyes = 'dazed'
      r.mouth = 'wobble'
      r.ears = 'flop'
      r.arms = [{ x: 0.05, y: 0.98, bend: 1 }, { x: 0.05, y: 0.98, bend: 1 }]
      r.rot = 3
      break
    case 'carry':
      r.prop = 'battery'
      r.mouth = L.id === 'dag' ? 'smile' : 'teeth'
      if (side) r.arms = [{ x: 0.72, y: 0.62, bend: 1, hand: 'mitt' }, { x: 0.72, y: 0.62, bend: 1, hand: 'mitt' }]
      else r.arms = [{ at: [7.5, -L.legLen + 4], x: 0, y: 0, bend: -1 }, { at: [7.5, -L.legLen + 4], x: 0, y: 0, bend: -1 }]
      break
    case 'eat':
      r.mouth = f ? 'chew' : 'open'
      r.eyes = 'happy'
      r.prop = 'spoon'
      if (side) r.arms[1] = { at: [Math.round(L.headRx) + 1, -L.legLen - L.torsoH - L.neck + Math.round(L.headRy * 0.55) + (f ? 1 : 0)], x: 0, y: 0, bend: 1, hand: 'fist' }
      else r.arms[1] = { at: [1, -L.legLen - L.torsoH - L.neck + Math.round(L.headRy * 0.7) + (f ? 1 : 0)], x: 0, y: 0, bend: -1, hand: 'fist' }
      break
    case 'back':
      r.headDy = -1
      r.ears = 'back'
      break
  }

  // Idle fidgets (only when standing in no pose).
  if (!d.pose && d.walk < 0) {
    switch (d.idle) {
      case 'glasses':
        if (side) r.arms[1] = { at: [Math.round(L.headRx * 0.7), -L.legLen - L.torsoH - L.neck + 1], x: 0, y: 0, bend: 1, hand: 'point' }
        else r.arms[1] = { at: [0, -L.legLen - L.torsoH - L.neck + 2], x: 0, y: 0, bend: -1, hand: 'point' }
        r.eyes = 'open'
        break
      case 'look':
        r.eyes = 'side'
        break
      case 'sway-l': r.lean = side ? 0 : -1; r.headDx = side ? -1 : -1; break
      case 'sway-r': r.lean = side ? 0 : 1; r.headDx = side ? 1 : 1; break
      case 'up': r.dy = -1; break
      case 'meter':
        r.prop = 'meter'
        r.eyes = 'down'
        r.mouth = 'o'
        if (side) r.arms[1] = { x: 0.8, y: 0.35, bend: 1, hand: 'fist' }
        else r.arms[1] = { x: 0.1, y: 0.62, bend: -1, hand: 'fist' }
        break
      case 'yawn': r.mouth = 'o'; r.eyes = 'closed'; break
      case 'monocle': r.brows = 'one'; r.eyes = 'side'; break
    }
    if (d.idle === 'breath') r.lift = 1
  }

  // The talking mouth.
  if (d.talk && view !== 'back' && d.pose !== 'eat' && d.pose !== 'fall') r.mouth = d.talk === 1 ? 'talk1' : 'talk2'
  if (d.blink && r.eyes !== 'squeeze' && r.eyes !== 'dazed' && r.eyes !== 'happy') r.eyes = 'closed'
  if (d.flop && r.ears !== 'wild') r.ears = 'flop'
  return r
}
