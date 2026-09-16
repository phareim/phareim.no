<template>
  <canvas ref="canvas" class="zelda-canvas" />
  <EscHold :is-active="() => escActive()" :paused="paused" @tap="togglePause" @hold="quit" />
</template>

<script setup lang="ts">
/**
 * NEON SHRINE — the loop, input, phases and audio wiring for the Zelda-like
 * action-adventure game. Follows the pattern of OutRun.vue with touch input
 * from Another Shore (autopilot for attract mode).
 *
 * Phases: 'attract' (autopilot, silent), 'play' (the run), 'over' (quit path
 * preserving progress), 'won' (victory).
 *
 * Keys: arrows/WASD move, Space/J attack, E/K interact, P pause, Enter start.
 * Touch: floating stick on left 60%, attack tap on right 40%, interact hold on right side.
 */

import EscHold from '../base/EscHold.vue'
import type {
  GameState,
  GameEvent,
  Input,
  Vec,
  SaveData,
  World,
  Renderer,
} from './types'

const emit = defineEmits<{
  phase: [phase: 'attract' | 'play' | 'over' | 'won']
  result: [result: { reason: 'quit' | 'won'; elapsed: number; best: number | null }]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const paused = ref(false)

// Lazy-loaded engine and world
let engine: any = null
let world: World | null = null
let renderer: Renderer | null = null

let state: GameState | null = null
let phase: 'attract' | 'play' | 'over' | 'won' = 'attract'
let raf = 0
let last = 0
let touchMode = false
let hitStopTime = 0
let stickStartT = 0
let reducedMotion = false

// Room-to-music mapping
const areaToMusic: Record<string, 'zelda' | 'zeldaDungeon' | 'zeldaBoss'> = {
  overworld: 'zelda',
  dungeon: 'zeldaDungeon',
  boss: 'zeldaBoss',
}

const keys: Record<string, boolean> = {}
let stickId: number | null = null
let stickOriginX = 0
let stickOriginY = 0
let stickDx = 0
let stickDy = 0
let attackId: number | null = null
let attackStartTime = 0
let interactPending = false

// UI state
const ui = ref({
  banner: null as { text: string; t: number } | null,
  paused: false,
  reducedMotion: false,
  alpha: 1,
  stick: null as { originX: number; originY: number; dx: number; dy: number } | null,
  hint: '',
})

const sound = useSound()

// Load engine and world on mount
onMounted(async () => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  
  try {
    // Dynamic import to handle if engine.ts doesn't exist yet
    const engineModule = await import('./engine')
    const worldModule = await import('./world')
    const rendererModule = await import('./renderer')

    engine = {
      createGame: engineModule.createGame,
      stepGame: engineModule.stepGame,
      autopilot: engineModule.autopilot,
      toSave: engineModule.toSave,
      parseSave: engineModule.parseSave,
      respawn: engineModule.respawn,
    }
    world = worldModule.WORLD
    
    if (!canvas.value || !engine || !world) return

    renderer = rendererModule.createRenderer(canvas.value, world)
    state = createAttractGame()
    
    setupCanvas()
    startLoop()
  } catch (e) {
    console.error('Failed to load Zelda game:', e)
    if (canvas.value) {
      const ctx = canvas.value.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ff2fa0'
        ctx.font = '16px monospace'
        ctx.fillText('Engine loading...', 20, 30)
      }
    }
  }
})

function createAttractGame(): GameState {
  if (!engine || !world) throw new Error('Engine not loaded')
  return engine.createGame(world, { demo: true })
}

function createNewGame(): GameState {
  if (!engine || !world) throw new Error('Engine not loaded')
  return engine.createGame(world, { demo: false })
}

function createResumeGame(): GameState {
  if (!engine || !world) throw new Error('Engine not loaded')
  let save: SaveData | null = null
  try {
    const raw = localStorage.getItem('zeldaSave')
    if (raw) save = engine.parseSave(JSON.parse(raw))
  } catch { /* ignore */ }
  return engine.createGame(world, { save, demo: false })
}

function setPhase(p: typeof phase) {
  phase = p
  emit('phase', p)
}

function setupCanvas() {
  if (!canvas.value || !renderer) return
  const obs = new ResizeObserver(() => updateCanvasSize())
  obs.observe(canvas.value)
  updateCanvasSize()
  window.addEventListener('resize', updateCanvasSize)
}

function updateCanvasSize() {
  if (!canvas.value || !renderer) return
  const w = canvas.value.clientWidth
  const h = canvas.value.clientHeight
  const dpr = Math.min(devicePixelRatio, 2)
  renderer.resize(w, h, dpr)
}

function startLoop() {
  if (raf) cancelAnimationFrame(raf)
  raf = requestAnimationFrame(frame)
}

function frame(nowMs: number) {
  raf = requestAnimationFrame(frame)
  if (!renderer || !state || !engine) return

  const now = nowMs / 1000
  let dt = last ? now - last : 1 / 60
  last = now
  
  ui.value.reducedMotion = reducedMotion
  ui.value.paused = paused.value

  if (paused.value || (reducedMotion && phase === 'attract')) {
    renderer.draw(state, ui.value, 0)
    return
  }

  // Hit-stop: skip engine steps, keep drawing
  if (hitStopTime > 0) {
    hitStopTime -= dt * 1000
    renderer.draw(state, ui.value, dt)
    return
  }

  dt = Math.min(dt, 0.1)

  if (phase === 'attract') {
    const input = engine.autopilot(world, state)
    const events = engine.stepGame(world, state, dt, input)
    renderer.onEvents(events)
  } else if (phase === 'play') {
    const input = readInput()
    const events = engine.stepGame(world, state, dt, input)
    renderer.onEvents(events)
    handleEvents(events)
    
    if (state.phase === 'won') {
      finishWon()
      return
    }
  }

  updateBanner(dt)
  renderer.draw(state, ui.value, dt)
}

function updateBanner(dt: number) {
  if (ui.value.banner) {
    ui.value.banner.t -= dt
    if (ui.value.banner.t <= 0) {
      ui.value.banner = null
    }
  }
}

function readInput(): Input {
  const move: Vec = { x: 0, y: 0 }
  
  // Keyboard
  if (keys.ArrowUp || keys.KeyW) move.y -= 1
  if (keys.ArrowDown || keys.KeyS) move.y += 1
  if (keys.ArrowLeft || keys.KeyA) move.x -= 1
  if (keys.ArrowRight || keys.KeyD) move.x += 1

  // Touch stick
  if (stickId !== null) {
    const len = Math.hypot(stickDx, stickDy)
    if (len > 0.1) {
      const scale = 1 / Math.max(len, 1)
      move.x = stickDx * scale
      move.y = stickDy * scale
    }
  }

  // Normalize diagonal
  const len = Math.hypot(move.x, move.y)
  if (len > 1) {
    move.x /= len
    move.y /= len
  }

  const attack = (keys.Space || keys.KeyJ) && !keys.prevSpace
  const interact = (keys.KeyE || keys.KeyK) && !keys.prevE
  const autoFace = touchMode && attackId !== null && !interactPending

  keys.prevSpace = keys.Space || keys.KeyJ
  keys.prevE = keys.KeyE || keys.KeyK

  return { move, attack, interact, autoFace }
}

function handleEvents(events: GameEvent[]) {
  for (const e of events) {
    switch (e.type) {
      case 'swing':
        sound.sfx.laser()
        break
      case 'swordHit':
        sound.sfx.hit()
        if (e.killed) sound.sfx.explosion()
        break
      case 'swordClank':
        sound.sfx.wall()
        break
      case 'playerHit':
        sound.sfx.lifeLost()
        break
      case 'playerDied':
        sound.sfx.death()
        break
      case 'respawn':
        sound.sfx.shield()
        break
      case 'enemyDied':
        sound.sfx.explosion()
        break
      case 'potSmash':
        sound.sfx.brickBreak()
        break
      case 'grassCut':
        sound.sfx.brick()
        break
      case 'pickup':
        sound.sfx.powerup()
        break
      case 'chestOpened':
      case 'reward':
        sound.sfx.extraLife()
        saveToDisk()
        break
      case 'doorUnlocked':
      case 'doorOpened':
        sound.sfx.checkpoint()
        saveToDisk()
        break
      case 'roomEnter':
        ui.value.banner = { text: e.name, t: 1.6 }
        const musicStyle = areaToMusic[e.area] || 'zelda'
        sound.music.start(musicStyle)
        saveToDisk()
        break
      case 'slideStart':
        break
      case 'bossPhase':
        sound.sfx.levelup()
        break
      case 'bossDefeated':
        sound.sfx.levelClear()
        break
      case 'won':
        sound.sfx.win()
        break
      case 'hitStop':
        if (!reducedMotion) {
          hitStopTime = e.ms
        }
        break
      case 'shoot':
        sound.sfx.enemyShoot()
        break
    }
  }
}

function saveToDisk() {
  if (!state || !engine) return
  const save = engine.toSave(state)
  if (!save) return
  try {
    localStorage.setItem('zeldaSave', JSON.stringify(save))
  } catch { /* private mode */ }
}

function finishWon() {
  setPhase('won')
  clearInput()
  sound.music.stop()
  
  let best: number | null = null
  try {
    const rawBest = localStorage.getItem('zeldaBest')
    if (rawBest) {
      const seconds = parseInt(rawBest, 10)
      if (!isNaN(seconds) && state!.elapsed < seconds) {
        best = state!.elapsed
        localStorage.setItem('zeldaBest', String(best))
      } else if (!isNaN(seconds)) {
        best = seconds
      }
    } else {
      best = state!.elapsed
      localStorage.setItem('zeldaBest', String(best))
    }
  } catch { /* ignore */ }

  emit('result', {
    reason: 'won',
    elapsed: state!.elapsed,
    best,
  })
}

function onKeyDown(e: KeyboardEvent) {
  if (isInteractive(e.target)) return
  if (e.code === 'Escape') return
  if (e.key !== 'Unidentified') touchMode = false

  if (e.code === 'KeyP' && !e.repeat) {
    if (phase === 'play') {
      e.preventDefault()
      togglePause()
    }
    return
  }

  if (e.code === 'KeyN' && !e.repeat && (phase === 'attract' || phase === 'over' || phase === 'won')) {
    try { localStorage.removeItem('zeldaSave') } catch { /* ignore */ }
    startGame()
    e.preventDefault()
    return
  }

  if (e.code === 'Enter' && !e.repeat) {
    if (phase === 'attract') {
      startGame()
      e.preventDefault()
    } else if (phase === 'over' || phase === 'won') {
      continueGame()
      e.preventDefault()
    }
    return
  }

  if (phase !== 'play') return

  keys[e.code] = true
  const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyE', 'KeyJ', 'KeyK']
  if (gameKeys.includes(e.code)) {
    e.preventDefault()
  }
}

function onKeyUp(e: KeyboardEvent) {
  keys[e.code] = false
}

function onPointerDown(e: PointerEvent) {
  if (isInteractive(e.target)) return
  if (e.pointerType !== 'mouse') touchMode = true

  if (phase === 'attract') {
    stickStartT = performance.now()
    stickOriginX = e.clientX
    stickOriginY = e.clientY
    return
  }

  if (phase === 'play' && renderer) {
    const rect = renderer.roomRect()
    const localX = e.clientX - rect.x

    if (localX < rect.w * 0.6) {
      // Left side: stick
      if (stickId === null) {
        stickId = e.pointerId
        stickOriginX = e.clientX
        stickOriginY = e.clientY
        ;(e.target as any)?.setPointerCapture?.(e.pointerId)
      }
    } else {
      // Right side: attack or interact
      if (attackId === null) {
        attackId = e.pointerId
        attackStartTime = performance.now()
        interactPending = false
        ;(e.target as any)?.setPointerCapture?.(e.pointerId)
      }
    }
  }
}

function onPointerMove(e: PointerEvent) {
  if (phase !== 'play' || stickId !== e.pointerId || !renderer) return

  stickDx = (e.clientX - stickOriginX) / 40
  stickDy = (e.clientY - stickOriginY) / 40
  
  const len = Math.hypot(stickDx, stickDy)
  if (len > 1) {
    const scale = 1 / len
    stickDx *= scale
    stickDy *= scale
  }

  const rect = renderer.roomRect()
  ui.value.stick = {
    originX: stickOriginX - rect.x,
    originY: stickOriginY - rect.y,
    dx: stickDx * 40,
    dy: stickDy * 40,
  }
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerId === stickId) {
    stickId = null
    stickDx = 0
    stickDy = 0
    ui.value.stick = null
  }

  if (phase === 'attract' && e.pointerId === stickId) {
    const now = performance.now()
    const dx = Math.abs(e.clientX - stickOriginX)
    const dy = Math.abs(e.clientY - stickOriginY)
    if (dx < 10 && dy < 10 && now - stickStartT < 200) {
      startGame()
    }
  }

  if (e.pointerId === attackId) {
    const held = performance.now() - attackStartTime
    if (held > 350) {
      interactPending = true
    }
    attackId = null
  }
}

function isInteractive(el: EventTarget | null) {
  const e = el as HTMLElement | null
  return !!e?.closest?.('a, button, .theme-pager')
}

function startGame() {
  if (!engine || !world) return
  paused.value = false
  state = createNewGame()
  setPhase('play')
  clearInput()
  sound.unlock()
  sound.music.start('zelda')
}

function continueGame() {
  if (phase === 'over') {
    if (!engine || !world) return
    state = createResumeGame()
  } else if (phase === 'won') {
    if (!engine || !world) return
    state = createNewGame()
  }
  setPhase('play')
  paused.value = false
  clearInput()
  sound.unlock()
  sound.music.start('zelda')
}

function quit() {
  if (phase !== 'play') return
  paused.value = false
  setPhase('over')
  clearInput()
  sound.music.stop(false)

  emit('result', {
    reason: 'quit',
    elapsed: state?.elapsed ?? 0,
    best: null,
  })
}

function togglePause() {
  if (phase !== 'play') return
  paused.value = !paused.value
  if (paused.value) {
    sound.music.stop(false)
  } else {
    sound.music.start('zelda')
  }
  clearInput()
}

function escActive() {
  return phase === 'play'
}

function clearInput() {
  for (const k of Object.keys(keys)) keys[k] = false
  stickId = null
  attackId = null
  stickDx = 0
  stickDy = 0
  ui.value.stick = null
}

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearInput()
  sound.music.stop()
  useTheme().navigationLocked.value = false
  window.removeEventListener('resize', updateCanvasSize)
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
  if (canvas.value) {
    canvas.value.removeEventListener('pointerdown', onPointerDown)
    canvas.value.removeEventListener('pointermove', onPointerMove)
    canvas.value.removeEventListener('pointerup', onPointerUp)
  }
})

onMounted(() => {
  useTheme().navigationLocked.value = phase === 'play'
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  if (canvas.value) {
    canvas.value.addEventListener('pointerdown', onPointerDown)
    canvas.value.addEventListener('pointermove', onPointerMove)
    canvas.value.addEventListener('pointerup', onPointerUp)
  }
})
</script>

<style>
.zelda-canvas {
  display: block;
  width: 100%;
  height: 100%;
  background: #0b0616;
  touch-action: none;
}
</style>
