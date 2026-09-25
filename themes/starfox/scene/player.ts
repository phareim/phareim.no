/**
 * The player's ship: the Hangar model (themes/ships/three.ts), steering,
 * bank and barrel roll, the lasers (TWIN, TWIN+, HYPER; overdrive's
 * prism beams pierce), the charge shot (hold ≥ 0.7 s, the reticle locks
 * the nearest target in a forward cone, release fires a homing orb), the
 * NOVA BOMB, the shield shell, muzzle flashes and the engine trail.
 * The attract screen flies it on autopilot.
 */
import * as THREE from 'three'
import { HP_MAX, applyDamage } from '../balance'
import {
  SHIELD, chargeLevel, laserName, chargeReady, fireRateMul, laserHit, laserPierce, pickChargeTarget, shieldAbsorb, shieldUp, useBomb,
} from '../arsenal'
import { createChargeOrb, createEngineTrail, createMuzzleFlash, createShieldBubble } from '../models/fx'
import { P, eachLight } from '../models/core'
import { buildPlayerShip } from '~/themes/ships/three'
import { readShipDef } from '~/composables/useShip'
import { LANE_Y_HI, LANE_Y_LO, breakStreak, clamp, live, type Ctx } from './ctx'

export interface PlayerInput {
  left: boolean; right: boolean; up: boolean; down: boolean
  /** Space held (keyboard) or a finger down (touch). */
  fire: boolean
  /** Space held, or a second finger down. */
  charging: boolean
  /** Touch steering: the ship eases toward (tx, ty). */
  touch: boolean
  tx: number
  ty: number
}

export interface Player {
  x: number
  y: number
  readonly visible: boolean
  readonly rolling: boolean
  /** 0–1 charge while held. */
  readonly charge: number
  /** Locked target id (0 = none). */
  readonly lockId: number
  readonly input: PlayerInput
  update(dt: number): void
  damage(dmg: number): void
  roll(dir: number): void
  bomb(): boolean
  /** Put the ship back for a new run. */
  reset(): void
  /** The ship blows up (death or quit). */
  explode(): void
  lights(add: (x: number, y: number, z: number, r: number, color: string, a: number) => void): void
}

const FIRE_INTERVAL = 1 / 6
const ROLL_DUR = 0.55
const LASER_OFFS = 3.1
const NOSE_Z = -2.2
/** Attract mode: the ship flies in the clear middle band, off the title and hint text. */
const ATTRACT_Y = 1.6
const ATTRACT_Y_PORTRAIT = 0.6
/** Phones: the attract ship flies further ahead, smaller, between the squad panel and the hint. */
const ATTRACT_Z_PORTRAIT = -7

export function createPlayer(ctx: Ctx): Player {
  const model = buildPlayerShip(readShipDef(), ctx.glowTex)
  const root = model.root
  const bank = model.bank
  const engine = model.engine
  const engineBase = engine.scale.x
  root.position.set(0, 0.5, 0)
  ctx.scene.add(root)

  const bubble = createShieldBubble(2.6)
  root.add(bubble.root)
  const muzzleL = createMuzzleFlash(P.cyan)
  const muzzleR = createMuzzleFlash(P.cyan)
  muzzleL.root.position.set(-LASER_OFFS, 0.05, -1.4)
  muzzleR.root.position.set(LASER_OFFS, 0.05, -1.4)
  root.add(muzzleL.root, muzzleR.root)
  const nose = createChargeOrb()
  nose.root.position.set(0, 0.05, NOSE_Z)
  root.add(nose.root)
  nose.set(0, 0)
  const trail = createEngineTrail(P.cyan)
  ctx.scene.add(trail.mesh)

  const input: PlayerInput = { left: false, right: false, up: false, down: false, fire: false, charging: false, touch: false, tx: 0, ty: 0.5 }
  const ev = new THREE.Vector3()
  const avoid = { x: 0, y: 0 }
  const me = { x: 0, y: 0, z: 0 }
  let x = 0
  let y = 0.5
  let visible = true
  let rollT = -1
  let rollDir = 1
  let fireT = 0
  let chargeT = 0
  let chargeWasReady = false
  let lockId = 0
  let firstHit = true

  function fireInterval(): number {
    const lv = ctx.arsenal.laser
    return FIRE_INTERVAL / (lv >= 3 ? 1.6 : lv === 2 ? 1.25 : 1) / fireRateMul(ctx.arsenal)
  }

  function fireLaser() {
    const lv = ctx.arsenal.laser
    const pierce = laserPierce(ctx.arsenal)
    const side = pierce > 0 ? P.purple : P.cyan
    const core = pierce > 0 ? P.pink : P.gold
    const yy = y + 0.05
    ctx.shots.laser(x - LASER_OFFS, yy, -1.2, side, 1, -1, pierce)
    ctx.shots.laser(x + LASER_OFFS, yy, -1.2, side, 1, -1, pierce)
    if (lv >= 2) ctx.shots.laser(x, yy, -1.2, core, 2, -1, pierce)
    if (lv >= 3) {
      ctx.shots.laser(x - 0.6, yy, -1.2, core, 2, -1, pierce)
      ctx.shots.laser(x + 0.6, yy, -1.2, core, 2, -1, pierce)
    }
    muzzleL.fire()
    muzzleR.fire()
    ctx.sfx.laser()
  }

  function autopilot(dt: number) {
    const t = ctx.now
    const portrait = ctx.portrait
    const baseY = portrait ? ATTRACT_Y_PORTRAIT : ATTRACT_Y
    let tx = Math.sin(t * 0.5) * (portrait ? 1.6 : 3.0)
    let ty = baseY + Math.sin(t * 0.7) * 0.3
    ctx.obstacles.avoid(tx, ty, avoid)
    tx = clamp(avoid.x, -ctx.laneX, ctx.laneX)
    ty = clamp(ty, baseY - 0.4, baseY + 0.6)
    const k = 1 - Math.exp(-3 * dt)
    x += (tx - x) * k
    y += (ty - y) * k
    fireT += dt
    if (fireT >= 0.5) { fireT = 0; fireLaser() }
  }

  function steer(dt: number) {
    if (!input.touch) {
      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0)
      const dy = (input.up ? 1 : 0) - (input.down ? 1 : 0)
      x = clamp(x + dx * 13 * dt, -ctx.laneX, ctx.laneX)
      y = clamp(y + dy * 11 * dt, LANE_Y_LO, LANE_Y_HI)
      input.tx = x
      input.ty = y
    } else {
      const k = 1 - Math.exp(-12 * dt)
      x += (clamp(input.tx, -ctx.laneX, ctx.laneX) - x) * k
      y += (clamp(input.ty, LANE_Y_LO, LANE_Y_HI) - y) * k
    }
  }

  function updateCharge(dt: number) {
    if (input.charging) {
      chargeT += dt
      const ready = chargeReady(chargeT)
      if (ready && !chargeWasReady) ctx.sfx.charge()
      chargeWasReady = ready
      if (ready) {
        me.x = x
        me.y = y
        const t = pickChargeTarget(me, ctx.enemies.targets)
        lockId = t ? t.id : 0
      }
    } else if (chargeT > 0) {
      if (chargeReady(chargeT)) {
        ctx.shots.orb(x, y + 0.05, NOSE_Z - 0.5, lockId)
        ctx.story.used('charge')
      }
      chargeT = 0
      chargeWasReady = false
      lockId = 0
    }
    const lv = chargeLevel(chargeT)
    nose.set(chargeT > 0.15 ? lv : 0, ctx.now)
  }

  function die() {
    visible = false
    root.visible = false
    trail.mesh.visible = false
    nose.set(0, 0)
    ctx.fx.explode(x, y, 0, P.cyan, 2.5)
    ctx.fx.explode(x, y, 0, P.gold, 1.5)
    ctx.shake = 1.4
    ctx.flash = 1
    ctx.flashColor = P.hot
  }

  const player: Player = {
    get x() { return x },
    set x(v) { x = v },
    get y() { return y },
    set y(v) { y = v },
    get visible() { return visible },
    get rolling() { return rollT >= 0 },
    get charge() { return chargeLevel(chargeT) },
    get lockId() { return lockId },
    input,
    update(dt) {
      if (!visible) return
      const demo = !ctx.started
      if (demo) autopilot(dt)
      else if (!ctx.over) steer(dt)
      // bank and pitch from the keys (keyboard) or the follow error (touch)
      const keyBank = ((input.left ? 1 : 0) - (input.right ? 1 : 0)) * 0.55
      const followBank = input.touch ? clamp((input.tx - x) * -0.12, -0.7, 0.7) : 0
      const pitch = ((input.up ? 1 : 0) - (input.down ? 1 : 0)) * -0.18
      bank.rotation.z += ((keyBank + followBank) - bank.rotation.z) * Math.min(1, dt * 8)
      bank.rotation.x += (pitch - bank.rotation.x) * Math.min(1, dt * 8)
      if (rollT >= 0) {
        rollT += dt / ROLL_DUR
        if (rollT >= 1) { rollT = -1; bank.rotation.y = 0 }
        else {
          bank.rotation.z = rollDir * rollT * Math.PI * 2 + keyBank
          bank.rotation.y = Math.sin(rollT * Math.PI) * 0.4 * rollDir
        }
      }
      const t = ctx.now
      root.position.set(x, y + Math.sin(t * 2.1) * 0.08, demo && ctx.portrait ? ATTRACT_Z_PORTRAIT : 0)
      root.visible = t >= ctx.invulnUntil || Math.floor(t * 12) % 2 === 0
      const es = engineBase + Math.sin(t * 31) * 0.08 + ctx.worldSpeed * 0.002
      engine.scale.set(es, es, 1)
      if (live(ctx)) {
        const want = input.fire
        if (want) {
          fireT += dt
          let step = fireInterval()
          while (fireT >= step) { fireT -= step; fireLaser(); step = fireInterval() }
        } else fireT = Math.min(fireT, fireInterval())
        updateCharge(dt)
      }
      muzzleL.update(dt)
      muzzleR.update(dt)
      const a = ctx.arsenal
      bubble.set(shieldUp(a) ? Math.max(a.shieldHp / SHIELD.absorb, Math.min(1, a.shieldT / 3)) : 0, t)
      bubble.update(dt)
      root.updateMatrixWorld()
      engine.getWorldPosition(ev)
      trail.update(dt, ev.x, ev.y, ev.z + 0.3, ctx.worldSpeed * 0.6)
    },
    damage(dmg) {
      if (!live(ctx) || !visible || ctx.god) return
      if (ctx.now < ctx.invulnUntil || rollT >= 0) return
      const a = ctx.arsenal
      const hadShield = shieldUp(a)
      const rest = shieldAbsorb(a, dmg)
      if (hadShield) {
        bubble.hit()
        ctx.fx.sparks(x, y, 0, P.jade, 12, 8)
        ctx.sfx.tick()
        if (!shieldUp(a)) ctx.story.cue('shield:down')
        ctx.run.arsenalDirty()
        if (rest <= 0) { ctx.invulnUntil = ctx.now + 0.3; return }
      }
      breakStreak(ctx)
      ctx.hp = applyDamage(ctx.hp, rest)
      ctx.out.health(ctx.hp, HP_MAX)
      ctx.flash = Math.max(ctx.flash, 0.9)
      ctx.flashColor = P.hot
      ctx.shake = Math.max(ctx.shake, 0.7)
      ctx.fx.sparks(x, y, 0, P.cyan, 26, 12)
      ctx.fx.wave(x, y, 0, P.cyan)
      if (firstHit) { firstHit = false; ctx.story.cue('teach:roll') }
      if (ctx.hp <= 0) { ctx.run.end('death'); return }
      if (ctx.hp < HP_MAX * 0.3) ctx.story.cue('hull:low')
      ctx.sfx.hit()
      ctx.invulnUntil = ctx.now + 1.0
      const before = a.laser
      if (laserHit(a) !== before) ctx.out.toast(`LASER DOWN · ${laserName(a.laser)}`)
      ctx.run.arsenalDirty()
    },
    roll(dir) {
      if (!live(ctx) || !visible || rollT >= 0) return
      rollT = 0
      rollDir = dir >= 0 ? 1 : -1
      ctx.sfx.roll()
    },
    bomb() {
      if (!live(ctx) || !visible) return false
      if (!useBomb(ctx.arsenal)) return false
      ctx.shots.bomb(x, y, NOSE_Z)
      ctx.story.used('bomb')
      ctx.run.arsenalDirty()
      return true
    },
    reset() {
      x = 0
      y = 0.5
      input.tx = 0
      input.ty = 0.5
      input.fire = input.charging = input.touch = false
      input.left = input.right = input.up = input.down = false
      visible = true
      root.visible = true
      trail.mesh.visible = true
      trail.reset(0, 0.5, 1.7)
      rollT = -1
      fireT = 0
      chargeT = 0
      chargeWasReady = false
      lockId = 0
      firstHit = true
      bank.rotation.set(0, 0, 0)
      nose.set(0, 0)
    },
    explode: die,
    lights(add) {
      if (visible && root.visible) add(x, y, 1.3, 2.4, P.cyan, 0.75)
      if (!visible) return
      eachLight(muzzleL.lights, add)
      eachLight(muzzleR.lights, add)
      if (chargeT > 0.15) eachLight(nose.lights, add)
    },
  }
  return player
}
