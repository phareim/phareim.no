<template>
  <div class="sfx-wrap">
    <canvas ref="canvas" class="sfx-canvas"></canvas>
    <button
      v-if="showBomb"
      class="sfx-bomb px-btn"
      type="button"
      aria-label="Nova bomb"
      @touchstart.prevent.stop="onBombButton"
      @click.prevent="onBombButton"
    >
      BOMB
    </button>
    <EscHold :is-active="escActive" :paused="paused" @tap="togglePause" @hold="quitToGameOver" />
  </div>
</template>

<script setup lang="ts">
/**
 * Star Fox — OPERATION NIGHTLIGHT (redesign 2026-09-25). The Vue shell of
 * an on-rails 3D shooter in three.js behind the landing overlay: the
 * render loop, input, the pixel stage, and events up to Landing.vue for
 * the HUD. The scene itself lives in ./scene (one module per system,
 * sharing a context; see scene/ctx.ts):
 *
 *   env        sky, sun, biome ground, ridges, warp, chase camera
 *   obstacles  biome props (tall/float), mines, arches
 *   player     the Hangar ship, roll, lasers, charge shot, bomb, shield
 *   squad      three wingmen on their own brains
 *   enemies    pools per kind + behaviours (+ setpieces: rival, Dingo)
 *   shots      lasers, bolts, charge orbs, nova bombs
 *   pickups    capsules and rings
 *   fx         sparks, debris, rings, shockwaves, light flashes
 *   boss       the DREADNOUGHT (placeholder until the five sector bosses)
 *   encounter  the scripted travel (encounters.ts) → spawns and cues
 *   storyGlue  the intercom director on the game clock
 *   run        sectors, phases, arsenal timers, the end of a run
 *   overlay    lights for the stage's light map, HUD marks on the stage
 *
 * Events: score distance health sector boss squad arsenal toast alert
 * callout title intercom intercomShown started restart over death.
 * `?debug=starfox` adds window.__starfox (scene/debug.ts).
 */
import * as THREE from 'three'
import EscHold from '../base/EscHold.vue'
import { safeBottom } from '../base/safeBottom'
import { createPixelStage, type PixelStage } from '../base/pixel/stage'
import { HP_MAX, type SectorPhase } from './balance'
import { createArsenal } from './arsenal'
import { callsignFrom, squadFor } from './story'
import { createPixelPipeline, type PixelPipeline } from './pixel'
import { P, disposeModelCaches } from './models/core'
import { makeGlowTexture } from '~/themes/ships/three'
import { readStoredPlayer } from '~/composables/useLeaderboard'
import { useSound } from '~/composables/useSound'
import { createSfx, live, type ArsenalHud, type Ctx, type DeathSummary, type IntercomView, type Out, type SquadHud } from './scene/ctx'
import { createEnv } from './scene/env'
import { createFx } from './scene/fx'
import { createObstacles } from './scene/obstacles'
import { createShots } from './scene/shots'
import { createStoryGlue } from './scene/storyGlue'
import { createBoss } from './scene/boss'
import { createEnemies } from './scene/enemies'
import { createPlayer } from './scene/player'
import { createSquad } from './scene/squad'
import { createPickups } from './scene/pickups'
import { createSetPieces } from './scene/setpieces'
import { createEncounters } from './scene/encounter'
import { createRun } from './scene/run'
import { createOverlay, type Overlay } from './scene/overlay'
import { installDebug, type FrameStats } from './scene/debug'

const emit = defineEmits<{
  score: [n: number]
  distance: [km: number]
  health: [hp: number, max: number]
  sector: [n: number, phase: SectorPhase]
  boss: [hp: number, max: number, active: boolean, name: string]
  squad: [list: SquadHud[]]
  arsenal: [a: ArsenalHud]
  toast: [text: string]
  alert: [text: string]
  callout: [text: string]
  title: [card: string]
  intercom: [line: IntercomView | null]
  intercomShown: [n: number]
  started: []
  restart: []
  over: []
  death: [s: DeathSummary]
}>()

const sound = useSound()
const { isTouch } = useInputMode()
const canvas = ref<HTMLCanvasElement | null>(null)
const paused = ref(false)
const running = ref(false)
const showBomb = computed(() => running.value && isTouch.value)

let renderer: THREE.WebGLRenderer | null = null
let glCanvas: HTMLCanvasElement | null = null
let pipeline: PixelPipeline | null = null
let stage: PixelStage | null = null
let overlay: Overlay | null = null
let glowTex: THREE.CanvasTexture | null = null
let ctx: Ctx | null = null
let raf = 0
let last = 0
let idleTimer: ReturnType<typeof setTimeout> | null = null
let undebug: (() => void) | null = null
const stats: FrameStats = { fps: 60, frameMs: 16.7, workMs: 0 }
const flashOpt = { color: P.hot as string, a: 0 }
const presentOpt = { ambient: '#c9bde6', flash: null as { color: string; a: number } | null }

const out: Out = {
  score: n => emit('score', n),
  distance: km => emit('distance', km),
  health: (hp, max) => emit('health', hp, max),
  sector: (n, phase) => emit('sector', n, phase),
  boss: (hp, max, active, name) => emit('boss', hp, max, active, name),
  squad: list => emit('squad', list.map(s => ({ ...s }))),
  arsenal: a => emit('arsenal', { ...a }),
  toast: text => emit('toast', text),
  alert: text => emit('alert', text),
  callout: text => emit('callout', text),
  title: card => emit('title', card),
  intercom: line => emit('intercom', line),
  intercomShown: n => emit('intercomShown', n),
  started: () => { running.value = true; emit('started') },
  restart: () => emit('restart'),
  over: () => { running.value = false; emit('over') },
  death: s => emit('death', s),
}

// ---- loop -------------------------------------------------------------------
function update(c: Ctx, dt: number) {
  c.now += dt
  c.run.update(dt)
  c.enc.update(dt)
  c.sets.update(dt)
  c.player.update(dt)
  c.squad.update(dt)
  c.enemies.update(dt)
  c.boss.update(dt)
  c.shots.update(dt)
  c.obstacles.update(dt)
  c.pickups.update(dt)
  c.fx.update(dt)
  c.env.update(dt)
  c.story.update(dt)
  if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 2.2)
}

function frame(nowMs: number) {
  raf = requestAnimationFrame(frame)
  const t0 = performance.now()
  const gap = nowMs - last || 16.7
  const dt = Math.min(0.05, gap / 1000)
  last = nowMs
  stats.frameMs += (gap - stats.frameMs) * 0.1
  stats.fps = 1000 / Math.max(1, stats.frameMs)
  const c = ctx
  if (!c || !pipeline || !stage || !glCanvas || !overlay) return
  if (!paused.value) update(c, dt)
  pipeline.render(c.scene, c.camera)
  const g = stage.begin()
  g.drawImage(glCanvas, 0, 0)
  overlay.lights()
  overlay.hud()
  if (c.flash > 0) {
    flashOpt.color = c.flashColor
    flashOpt.a = c.flash * 0.4
    presentOpt.flash = flashOpt
  } else presentOpt.flash = null
  stage.present(presentOpt)
  stats.workMs += (performance.now() - t0 - stats.workMs) * 0.1
}

function resize() {
  const c = ctx
  if (!renderer || !stage || !pipeline || !c) return
  const W = window.innerWidth
  const H = window.innerHeight
  c.portrait = H > W
  c.laneX = c.portrait ? 6.5 : 11
  // The 3D renders at the stage's logical size: ~320×200 on a monitor,
  // ~195×420 on a portrait phone, scaled up by a whole number.
  stage.resize(W, H, window.devicePixelRatio || 1, c.portrait ? 180 : 320, 180)
  pipeline.setSize(stage.vw, stage.vh)
  c.camera.aspect = stage.vw / stage.vh
  c.camera.fov = c.portrait ? 80 : 62
  // Installed web app: render the view the bottom band higher so the ship
  // lifts off the bottom edge; the canvas stays full-bleed.
  const bandL = Math.round(safeBottom() / stage.k)
  if (bandL > 0) c.camera.setViewOffset(stage.vw, stage.vh, 0, bandL, stage.vw, stage.vh)
  else c.camera.clearViewOffset()
  c.camera.updateProjectionMatrix()
  c.env.resize()
}

// ---- Esc pause / hold-quit ----------------------------------------------------
function escActive(): boolean {
  return !!ctx && live(ctx)
}

function clearInput() {
  keys.clear()
  const inp = ctx?.player.input
  if (inp) {
    inp.left = inp.right = inp.up = inp.down = inp.fire = inp.charging = false
    inp.touch = false
  }
  steer.id = -1
  chargeId = -1
}

function togglePause(): void {
  if (!ctx || !live(ctx)) return
  paused.value = !paused.value
  clearInput()
  if (paused.value) sound.music.stop(false)
  else sound.music.start('starfox')
}

// A 3 s Escape hold cancels the run: the same end as losing the hull.
function quitToGameOver(): void {
  if (!ctx || !live(ctx)) return
  paused.value = false
  clearInput()
  ctx.run.end('quit')
}

function startRun() {
  if (!ctx) return
  ctx.touch = isTouch.value
  clearInput()
  paused.value = false
  ctx.run.start()
}

// ---- input ----------------------------------------------------------------------
const keys = new Set<string>()
let lastLeftTap = 0
let lastRightTap = 0

function syncKeys() {
  const inp = ctx?.player.input
  if (!inp || inp.touch) return
  inp.left = keys.has('ArrowLeft') || keys.has('KeyA')
  inp.right = keys.has('ArrowRight') || keys.has('KeyD')
  inp.up = keys.has('ArrowUp') || keys.has('KeyW')
  inp.down = keys.has('ArrowDown') || keys.has('KeyS')
  inp.fire = keys.has('Space')
  inp.charging = keys.has('Space')
}

function onKeyDown(e: KeyboardEvent) {
  if (!ctx) return
  if (e.code === 'Enter' && (!ctx.started || (ctx.over && ctx.run.deathEmitted))) {
    startRun()
    return
  }
  // Escape belongs to EscHold (tap = pause, 3 s hold = quit); P pauses too.
  if (e.code === 'Escape') return
  if (e.code === 'KeyP' && !e.repeat) {
    if (live(ctx)) togglePause()
    return
  }
  if (!live(ctx) || paused.value) return
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault()
  if (e.repeat) return
  ctx.player.input.touch = false
  keys.add(e.code)
  const now = performance.now()
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    if (now - lastLeftTap < 280) ctx.player.roll(-1)
    lastLeftTap = now
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    if (now - lastRightTap < 280) ctx.player.roll(1)
    lastRightTap = now
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    const l = keys.has('ArrowLeft') || keys.has('KeyA')
    const r = keys.has('ArrowRight') || keys.has('KeyD')
    ctx.player.roll(r && !l ? 1 : l && !r ? -1 : 1)
  }
  if (e.code === 'KeyB' || e.code === 'KeyX') ctx.player.bomb()
  syncKeys()
}

function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.code)
  syncKeys()
}

// Touch: the first finger steers (auto-fire); a second finger held charges,
// lifting it fires; a double tap rolls; the BOMB button throws a bomb.
const steer = { id: -1, startX: 0, startY: 0, baseX: 0, baseY: 0, t: 0 }
let chargeId = -1
let tapStart: { x: number; y: number; t: number } | null = null
let lastTapEnd = 0

function isUiTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  return !!el?.closest?.('a, button, input')
}

function onTouchStart(e: TouchEvent) {
  if (!ctx || isUiTarget(e.target)) return
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i]!
    if (!live(ctx)) { tapStart = { x: t.clientX, y: t.clientY, t: performance.now() }; continue }
    e.preventDefault()
    const inp = ctx.player.input
    if (steer.id < 0) {
      steer.id = t.identifier
      steer.startX = t.clientX
      steer.startY = t.clientY
      steer.baseX = ctx.player.x
      steer.baseY = ctx.player.y
      steer.t = performance.now()
      inp.touch = true
      inp.fire = true
      inp.tx = ctx.player.x
      inp.ty = ctx.player.y
    } else if (chargeId < 0) {
      chargeId = t.identifier
      inp.charging = true
    }
  }
}

function onTouchMove(e: TouchEvent) {
  if (!ctx || steer.id < 0) return
  for (let i = 0; i < e.touches.length; i++) {
    const t = e.touches[i]!
    if (t.identifier !== steer.id) continue
    e.preventDefault()
    const W = window.innerWidth
    const H = window.innerHeight
    ctx.player.input.tx = steer.baseX + ((t.clientX - steer.startX) / Math.max(1, W)) * ctx.laneX * 3
    ctx.player.input.ty = steer.baseY - ((t.clientY - steer.startY) / Math.max(1, H)) * 20
  }
}

function onTouchEnd(e: TouchEvent) {
  if (!ctx) return
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i]!
    if (t.identifier === chargeId) {
      chargeId = -1
      ctx.player.input.charging = false
      continue
    }
    if (t.identifier === steer.id) {
      steer.id = -1
      ctx.player.input.fire = false
      const moved = Math.hypot(t.clientX - steer.startX, t.clientY - steer.startY)
      if (moved < 14 && performance.now() - steer.t < 400) {
        const now = performance.now()
        if (now - lastTapEnd < 350) ctx.player.roll(1)
        lastTapEnd = now
      }
      continue
    }
    if (!live(ctx) && tapStart && !isUiTarget(e.target)) {
      const moved = Math.hypot(t.clientX - tapStart.x, t.clientY - tapStart.y)
      if (moved < 14 && performance.now() - tapStart.t < 400 && (!ctx.started || ctx.run.deathEmitted)) startRun()
      tapStart = null
    }
  }
}

function onBombButton() {
  ctx?.player.bomb()
}

function onBlur() {
  clearInput()
}

// ---- lifecycle ---------------------------------------------------------------------
onMounted(() => {
  try {
    glCanvas = document.createElement('canvas')
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, powerPreference: 'low-power' })
  } catch { return }
  stage = createPixelStage(canvas.value!)
  pipeline = createPixelPipeline(renderer)
  glowTex = makeGlowTexture()
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200)
  camera.position.set(0, 3.6, 10.5)
  camera.lookAt(0, 1.2, -40)
  const c = {
    scene, camera, glowTex, rng: Math.random,
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    touch: isTouch.value, laneX: 11, portrait: false, now: 0,
    started: false, over: false, god: false, holdWings: false, runs: 0, score: 0, mult: 1, killCount: 0, streakT: 0,
    hp: HP_MAX, invulnUntil: 0, sector: 1, phase: 'travel' as SectorPhase, phaseT: 0, worldSpeed: 26, elapsed: 0, distance: 0,
    arsenal: createArsenal(), shake: 0, flash: 0, flashColor: P.hot as string,
    squadIds: squadFor(callsignFrom(readStoredPlayer()?.name)), bestBefore: 0,
    out, sfx: createSfx(sound, () => !!ctx && live(ctx)),
  } as unknown as Ctx
  ctx = c
  c.env = createEnv(c)
  c.fx = createFx(c)
  c.obstacles = createObstacles(c)
  c.shots = createShots(c)
  c.story = createStoryGlue(c)
  c.boss = createBoss(c)
  c.enemies = createEnemies(c)
  c.player = createPlayer(c)
  c.squad = createSquad(c)
  c.pickups = createPickups(c)
  c.sets = createSetPieces(c)
  c.enc = createEncounters(c)
  c.run = createRun(c, sound)
  c.squad.setup(c.squadIds)
  overlay = createOverlay(c, stage)
  resize()
  if (new URLSearchParams(window.location.search).get('debug') === 'starfox') undebug = installDebug(c, stats)
  // Claude says hello once per page load while the title screen waits.
  idleTimer = setTimeout(() => { if (ctx && !ctx.started) { ctx.touch = isTouch.value; ctx.story.idle() } }, 1400)
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('touchstart', onTouchStart, { passive: false })
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
  window.addEventListener('touchcancel', onTouchEnd)
  window.addEventListener('blur', onBlur)
  last = performance.now()
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  if (idleTimer) clearTimeout(idleTimer)
  undebug?.()
  sound.music.stop()
  window.removeEventListener('resize', resize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('touchstart', onTouchStart)
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', onTouchEnd)
  window.removeEventListener('touchcancel', onTouchEnd)
  window.removeEventListener('blur', onBlur)
  ctx?.scene.traverse((o) => {
    const m = o as THREE.Mesh
    m.geometry?.dispose?.()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach(x => x.dispose())
    else mat?.dispose?.()
  })
  disposeModelCaches()
  glowTex?.dispose()
  pipeline?.dispose()
  pipeline = null
  stage = null
  ctx = null
  renderer?.dispose()
  renderer?.forceContextLoss()
  renderer = null
})
</script>

<style>
.sfx-wrap {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.sfx-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 1;
}
/* Touch only, during a run: bottom-right, above the bottom band (the home
   chip is hidden while a run holds the navigation lock). */
.sfx-bomb.px-btn {
  position: fixed;
  right: 14px;
  bottom: calc(18px + var(--app-safe-bottom, 0px));
  z-index: 6;
  --px-u: 3px;
  --px-edge: #ff2fa0;
  min-width: 76px;
  min-height: 56px;
  padding: 0 12px;
  font-size: 16px;
  color: #ff8ae0;
  background: #140b26;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}
</style>
