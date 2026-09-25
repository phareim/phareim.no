/**
 * The hero rig: Kjell, Dag, Espen and the Professor, drawn from a paper
 * doll (render/rig/) in four facings with a walk cycle, idle life (blinks,
 * breath, Kjell's glasses, Dag's sway, Espen's bounce), a talking mouth and
 * the poses in BUILD.md: reach, pickup, strain, shrug, think, point,
 * scared, wave, cheer, sit, fall, lie, carry, eat, back. An unknown pose
 * draws idle. Each distinct frame is painted once into a small canvas and
 * cached, so a hero costs two drawImage calls a frame (shadow and body).
 *
 * Espen's ears flop for good once `espen.ears` is set (the radio took the
 * coat-hanger wire).
 */
import { makeCanvas } from '../../base/pixel/stage'
import type { ActorState, GameState, HeroId } from '../types'
import type { G, View } from './api'
import { mirror } from './rig/doll'
import { paintFrame } from './rig/paint'
import type { Built } from './rig/paint'
import { POSE_ANIM, WALK_FRAMES } from './rig/poses'
import type { FrameDesc, RigView } from './rig/poses'
import type { RigId } from './rig/looks'
import { paintPortrait } from './rig/portrait'

export const HERO_POSES = Object.keys(POSE_ANIM).filter(Boolean)

const cache = new Map<string, Built>()

function frame(desc: FrameDesc, mirrored: boolean): Built {
  const key = `${desc.id}|${desc.view}|${mirrored ? 'L' : 'R'}|${desc.pose}|${desc.f}|${desc.walk}|${desc.blink ? 1 : 0}|${desc.talk}|${desc.idle}|${desc.flop ? 1 : 0}`
  let b = cache.get(key)
  if (!b) {
    const base = paintFrame(desc)
    b = mirrored ? { c: mirror(base.c), ax: base.c.width - base.ax, ay: base.ay } : base
    if (cache.size > 1500) cache.clear()
    cache.set(key, b)
  }
  return b
}

export const WALK_RATE: Record<RigId, number> = { kjell: 10, dag: 8, espen: 13, professor: 10 }
export const PHASE: Record<RigId, number> = { kjell: 0, dag: 2.3, espen: 4.1, professor: 1.2 }
const TALK = [1, 2, 0, 2, 1, 1, 0, 2, 2, 1, 0, 1]

/** What the hero is doing when not asked to do anything. */
function idleOf(id: RigId, t: number, talking: boolean): string {
  switch (id) {
    case 'kjell': {
      const c = t % 9
      if (c < 0.7 && !talking) return 'glasses'
      if (c > 3.2 && c < 4.4) return 'look'
      return Math.floor(t / 1.4) % 2 ? 'breath' : ''
    }
    case 'dag': {
      const c = t % 10
      if (c < 2.2) return 'sway-l'
      if (c > 4.6 && c < 6.8) return 'sway-r'
      if (c > 8 && c < 9 && !talking && Math.floor(t / 10) % 3 === 1) return 'yawn'
      return Math.floor(t / 1.8) % 2 ? 'breath' : ''
    }
    case 'espen': {
      const c = t % 7.5
      if (c < 2.6) return Math.floor(t * 5) % 2 ? 'up' : ''
      if (c > 4.2 && c < 5.6 && !talking) return 'meter'
      return Math.floor(t / 1.1) % 2 ? 'breath' : ''
    }
    default: {
      const c = t % 6
      if (c > 3 && c < 4.2) return 'monocle'
      return Math.floor(t / 1.6) % 2 ? 'breath' : ''
    }
  }
}

function describe(id: RigId, a: ActorState, v: View, walking: boolean, s: GameState): { desc: FrameDesc; mirrored: boolean } {
  const view: RigView = a.face === 'down' ? 'front' : a.face === 'up' ? 'back' : 'side'
  const pose = a.pose in POSE_ANIM ? a.pose : ''
  const t = v.t + PHASE[id]
  const [n, fps] = POSE_ANIM[pose]!
  const talking = v.talking === id
  const walk = walking && pose !== 'sit' && pose !== 'lie' && pose !== 'fall' ? Math.floor(t * WALK_RATE[id]) % WALK_FRAMES : -1
  const blinkP = id === 'dag' ? 4.6 : id === 'espen' ? 2.7 : id === 'kjell' ? 3.3 : 5
  const desc: FrameDesc = {
    id,
    view,
    pose,
    f: n > 1 ? Math.floor(t * fps) % n : 0,
    walk,
    blink: t % blinkP < 0.14,
    talk: talking ? TALK[Math.floor(t * 9) % TALK.length]! : 0,
    idle: pose || walk >= 0 ? '' : idleOf(id, t, talking),
    flop: id === 'espen' && !!s.flags['espen.ears'],
  }
  // Poses that turn to the audience (or away) are never mirrored.
  const turned = pose === 'fall' || pose === 'cheer' || pose === 'back'
  return { desc, mirrored: a.face === 'left' && !turned }
}

const SHADOW_W: Record<RigId, number> = { kjell: 13, dag: 22, espen: 12, professor: 13 }
const shadows = new Map<string, HTMLCanvasElement>()

function shadow(id: RigId, pose: string): HTMLCanvasElement {
  const w = SHADOW_W[id] + (pose === 'lie' ? 24 : pose === 'sit' ? 6 : 0)
  const key = id + w
  let c = shadows.get(key)
  if (!c) {
    const h = 4
    c = makeCanvas(w, h)
    const g = c.getContext('2d')!
    g.fillStyle = '#0b0616'
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2), ny = (y + 0.5 - h / 2) / (h / 2)
      if (nx * nx + ny * ny <= 1) g.fillRect(x, y, 1, 1)
    }
    shadows.set(key, c)
  }
  return c
}

export function drawHero(g: G, id: string, a: ActorState, v: View, walking: boolean, s: GameState) {
  const rid = (id === 'professor' || id === 'kjell' || id === 'dag' || id === 'espen' ? id : 'kjell') as RigId
  const { desc, mirrored } = describe(rid, a, v, walking, s)
  const x = Math.round(a.x), y = Math.round(a.y)
  const sh = shadow(rid, desc.pose)
  const air = desc.pose === 'fall'
  g.globalAlpha = air ? 0.18 : 0.32
  g.drawImage(sh, x - Math.floor(sh.width / 2) + (desc.pose === 'lie' ? (mirrored ? -6 : 6) : 0), y - 2)
  g.globalAlpha = 1
  const b = frame(desc, mirrored)
  g.drawImage(b.c, x - b.ax, y - b.ay)
}

const pcache = new Map<string, HTMLCanvasElement>()

/**
 * A head for the panel: k = 1 is the wide panel's box (≤ 24×13, ears cut
 * off), k = 2 the tall phone panel (≤ 34×34, ears showing). The heads
 * blink on the play clock.
 */
export function portrait(id: HeroId, k: number, s: GameState): HTMLCanvasElement {
  const t = s.time + PHASE[id]
  const blink = t % (id === 'dag' ? 4.6 : id === 'espen' ? 2.7 : 3.3) < 0.14
  const flop = id === 'espen' && !!s.flags['espen.ears']
  const key = `${id}|${k}|${blink ? 1 : 0}|${flop ? 1 : 0}`
  let c = pcache.get(key)
  if (!c) {
    c = paintPortrait(id, k >= 2 ? 2 : 1, blink, flop)
    pcache.set(key, c)
  }
  return c
}
