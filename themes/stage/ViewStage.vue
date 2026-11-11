<template>
  <canvas ref="canvas" class="stage-canvas" tabindex="0" aria-label="Neon Shrine, as the studio's view stage" />
</template>

<script setup lang="ts">
/**
 * THE VIEW STAGE — Neon Shrine's world with nothing around it, for the
 * studio's frame (studio.phareim.no, repo phareim/studio-web; the studio's
 * docs/stage-protocol.md). The studio shows `/?theme=stage` in an iframe and
 * says what to show: a view (an engine and its values, `viewParams.ts`), a
 * place (`scenes.ts`) and what the HUD is doing. The game owns how it looks;
 * the studio owns the values, the drafts and publishing.
 *
 * Nothing here is kept: no save, no profile, no wallet, no score, no sound.
 * The hero cannot die. Arrows / WASD walk and Space swings once the frame
 * has the focus, so a view can be walked through before it is published.
 *
 * Messages are read only from the studio's origins (and a local dev studio).
 *   studio → stage: hello · show { view, scene, gear, hud, reduced, scheme } · replay · shot { id }
 *   stage → studio: ready { scenes, engines } · shown { scene, engine } · shot { id, png } · error { message }
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createGame, stepGame } from '../zelda/engine/index'
import { WORLD } from '../zelda/world/index'
import { NO_INPUT, type GameState, type Input } from '../zelda/types'
import { createRenderer, type FrameUI, type Renderer, type ViewFactory } from '../zelda/render/renderer'
import { ENGINE_LOADERS, VIEWS } from '../zelda/views'
import { ENGINES, isEngineId, type EngineId } from '../zelda/viewParams'
import { turnMove } from '../zelda/render/iso/project'
import { STRIP_TIME } from '../zelda/render/hud'
import { STAGE_SCENES, stageScene } from './scenes'

const STUDIO_ORIGINS = ['https://studio.phareim.no']
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
const fromStudio = (origin: string) => STUDIO_ORIGINS.includes(origin) || LOCAL.test(origin)

const canvas = ref<HTMLCanvasElement | null>(null)
const { navigationLocked } = useTheme()

let renderer: Renderer | null = null
let state: GameState
let raf = 0
let lastT = 0
let alive = false
let observer: ResizeObserver | null = null
/** What the studio last asked for. */
let shown = { scene: '', gear: true, hud: 'play', engine: 'classic' as EngineId }
let ask = 0
const keys = new Set<string>()
let aPress = false

const ui: FrameUI = {
  paused: false, confirmReset: false, muted: true, reducedMotion: false, touch: false, stick: null, attract: false, cam: null, banner: null,
  keys: { a: 'SPACE', b: 'K', cycle: 'Q' },
}

function setScene(id: unknown, gear: boolean) {
  const sc = stageScene(id)
  state = createGame(WORLD, { seed: 7 })
  state.dialog = null
  state.mode = 'play'
  if (gear) {
    // What a player well into the quest carries, so the HUD has something to show.
    const inv = state.inv
    inv.sword = true; inv.bombBag = true; inv.bombs = 8; inv.disc = true; inv.selected = 'disc'; inv.bits = 123; inv.keys = 1
    state.hero.maxHp = 10
    state.hero.hp = 7
    state.flags.intro = true
  }
  sc.set(WORLD, state)
  state.hero.auto = null
  state.dialog = null
  state.mode = 'play'
  shown.scene = sc.id
  shown.gear = gear
}

function setHud(hud: unknown) {
  shown.hud = hud === 'dialog' || hud === 'pause' || hud === 'strip' || hud === 'bare' ? hud : 'play'
  ui.paused = shown.hud === 'pause'
  ui.attract = false
  ui.strip = null
  if (shown.hud === 'dialog') {
    state.dialog = { lines: ['KEEPER: THE SUN HAS HUNG ON THE HORIZON FOR THREE NIGHTS. THE STATIC KING TOOK THE SUN PRISM INTO THE OLD NEON SHRINE.'], line: 0, chars: 200, who: 'keeper', after: null } as GameState['dialog']
    state.mode = 'dialog'
  } else if (state.mode === 'dialog') {
    state.dialog = null
    state.mode = 'play'
  }
}

async function setView(view: unknown, instant = true) {
  if (!renderer) return
  const v = (view && typeof view === 'object' ? view : {}) as { engine?: unknown; params?: unknown; name?: unknown; tag?: unknown }
  const engine: EngineId = isEngineId(v.engine) ? v.engine : 'classic'
  const mine = ++ask
  const load = ENGINE_LOADERS[engine]
  if (load && !renderer.hasView(engine)) {
    try {
      const mod = await load()
      if (!alive || !renderer) return
      renderer.addView(engine, mod.default as ViewFactory)
    } catch {
      post({ type: 'error', message: `The ${engine} view did not load` })
      return
    }
  }
  if (mine !== ask) return
  renderer.setParams(engine, v.params && typeof v.params === 'object' ? v.params as Record<string, number | string | boolean> : undefined)
  // Same engine: only its values changed, the picture stays where it is.
  if (engine !== shown.engine || instant) renderer.setView(engine, instant)
  shown.engine = engine
  if (shown.hud === 'strip') {
    const round = VIEWS.map(b => ({ name: b.name, tag: b.tag }))
    const name = typeof v.name === 'string' ? v.name : VIEWS.find(b => b.engine === engine)?.name ?? ''
    const at = Math.max(0, round.findIndex(r => r.name === name))
    ui.strip = { views: round, at, t: 0 }
  }
}

let studio: { source: MessageEventSource; origin: string } | null = null
function post(msg: Record<string, unknown>) {
  if (!studio) return
  ;(studio.source as Window).postMessage(msg, studio.origin)
}

function onMessage(e: MessageEvent) {
  if (!fromStudio(e.origin) || !e.source) return
  const m = e.data as { type?: unknown; id?: unknown } & Record<string, unknown>
  if (!m || typeof m.type !== 'string') return
  studio = { source: e.source, origin: e.origin }
  switch (m.type) {
    case 'hello':
      post({
        type: 'ready', protocol: 1, game: 'neon-shrine', figures: [],
        scenes: STAGE_SCENES.map(s => ({ id: s.id, label: s.label, group: s.group })),
        engines: Object.keys(ENGINES),
      })
      break
    case 'show': {
      const gear = m.gear !== false
      if (m.scene !== shown.scene || gear !== shown.gear) setScene(m.scene, gear)
      ui.reducedMotion = m.reduced === true
      setHud(m.hud)
      void setView(m.view, m.turn !== true).then(() => post({ type: 'shown', figure: shown.scene, scene: shown.scene, engine: shown.engine }))
      break
    }
    case 'replay':
      // The turn from the classic picture into the view, to look at.
      if (renderer && shown.engine !== 'classic') { renderer.setView('classic', true); renderer.setView(shown.engine, false) }
      break
    case 'shot':
      try { post({ type: 'shot', id: m.id, png: canvas.value?.toDataURL('image/png') ?? '' }) } catch { post({ type: 'error', id: m.id, message: 'No picture' }) }
      break
  }
}

const MOVE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
}
function onKeyDown(e: KeyboardEvent) {
  if (e.code in MOVE || e.code === 'Space') e.preventDefault()
  if (e.code === 'Space' && !keys.has('Space')) aPress = true
  keys.add(e.code)
}
function onKeyUp(e: KeyboardEvent) { keys.delete(e.code) }
function onBlur() { keys.clear() }

function readInput(): Input {
  let x = 0
  let y = 0
  for (const k of keys) { const m = MOVE[k]; if (m) { x += m[0]; y += m[1] } }
  const n = Math.hypot(x, y) || 1
  const press = aPress
  aPress = false
  return { ...NO_INPUT, move: { x: x / n, y: y / n }, a: keys.has('Space'), aPress: press }
}

function frame(nowMs: number) {
  raf = requestAnimationFrame(frame)
  if (!renderer || document.hidden) return
  const dt = lastT ? Math.min((nowMs - lastT) / 1000, 0.1) : 0
  lastT = nowMs
  if (!ui.paused && state.mode !== 'dialog') {
    const raw = readInput()
    const turn = renderer.viewState().turn
    renderer.onEvents(stepGame(WORLD, state, dt, turn ? { ...raw, move: turnMove(raw.move, turn) } : raw))
    // Nobody dies on a stage, and nothing here ends the visit.
    state.hero.hp = Math.max(state.hero.hp, 2)
    if (state.dying || state.mode === 'exit' || state.mode === 'won') setScene(shown.scene, shown.gear)
  }
  if (ui.strip) { ui.strip.t += dt; if (ui.strip.t > STRIP_TIME) ui.strip.t = 0 }
  renderer.draw(state, ui, ui.paused ? 0 : dt)
}

function resize() {
  if (!canvas.value || !renderer) return
  renderer.resize(canvas.value.clientWidth, canvas.value.clientHeight, Math.min(2, window.devicePixelRatio || 1))
}

onMounted(() => {
  if (!canvas.value) return
  alive = true
  // The stage owns every key: Escape leaves nothing, and the home chip stays away.
  navigationLocked.value = true
  renderer = createRenderer(canvas.value, WORLD)
  setScene('plaza', true)
  resize()
  observer = new ResizeObserver(resize)
  observer.observe(canvas.value)
  window.addEventListener('message', onMessage)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  // On its own (no studio around it) the address may say what to show: ?view=iso&scene=beach.
  const q = new URLSearchParams(location.search)
  if (q.get('scene')) setScene(q.get('scene'), true)
  if (q.get('view')) void setView({ engine: q.get('view') })
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  alive = false
  cancelAnimationFrame(raf)
  observer?.disconnect()
  window.removeEventListener('message', onMessage)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onBlur)
  navigationLocked.value = false
  renderer = null
})
</script>

<style>
.stage-canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  outline: none;
  touch-action: none;
}
</style>
