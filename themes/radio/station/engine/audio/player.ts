// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * The live player: `createPlayer(conductor)` → RadioPlayer (types.ts).
 *
 * Owns the AudioContext and the clock; everything musical happens in the
 * core (core.ts). The clock is a Web Worker posting ticks (a hidden tab
 * throttles main-thread timers to once a second or less; worker timers keep
 * running). Lookahead is 0.2 s while the page is visible and 2 s while it is
 * hidden, so a throttled page still never runs dry.
 *
 * Output: core → volume → a MediaStreamDestination (`stream`, for an <audio>
 * element: iOS lock screen, OS media controls) and, in 'speakers' mode (the
 * default), also → the context's destination. A page that plays `stream`
 * through an element calls setOutput('stream') so the music is not doubled.
 */
import type { ConductorLike, RadioPlayer, VisualState, BarPlan, Layer } from '../types.ts'
import { LAYERS } from '../types.ts'
import { createCore, type Core } from './core.ts'

const LOOKAHEAD_VISIBLE = 0.2
const LOOKAHEAD_HIDDEN = 2
const TICK_VISIBLE_MS = 25
const TICK_HIDDEN_MS = 250

const WORKER_SRC = `
let timer = null
onmessage = (e) => {
  const ms = e.data
  if (timer) clearInterval(timer)
  timer = ms > 0 ? setInterval(() => postMessage(0), ms) : null
}
`

interface Clock { set(ms: number): void; dispose(): void }

/**
 * A worker ticking every `ms` (0 = stopped). Falls back to setInterval where
 * workers are unavailable or blocked (a strict CSP fails the worker
 * asynchronously, through onerror, rather than throwing).
 */
function createClock(onTick: () => void): Clock {
  let ms = 0
  let id: ReturnType<typeof setInterval> | null = null
  let worker: Worker | null = null
  const interval = () => {
    if (id) clearInterval(id)
    id = ms > 0 ? setInterval(onTick, ms) : null
  }
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }))
    worker = new Worker(url)
    URL.revokeObjectURL(url)
    worker.onmessage = () => onTick()
    worker.onerror = () => {
      worker?.terminate()
      worker = null
      interval()
    }
  } catch {
    worker = null
  }
  return {
    set(v) {
      ms = v
      if (worker) worker.postMessage(v)
      else interval()
    },
    dispose() {
      worker?.terminate()
      if (id) clearInterval(id)
    },
  }
}

const EMPTY_LEVELS = (): Record<Layer, number> => {
  const l = {} as Record<Layer, number>
  for (const k of LAYERS) l[k] = 0
  return l
}

export function createPlayer(conductor: ConductorLike): RadioPlayer {
  let ac: AudioContext | null = null
  let core: Core | null = null
  let volume: GainNode | null = null
  let streamDest: MediaStreamAudioDestinationNode | null = null
  let clock: Clock | null = null
  let playing = false
  let level = 0.8
  let stopTimer: ReturnType<typeof setTimeout> | null = null
  let output: 'speakers' | 'stream' = 'speakers'
  let toSpeakers = false
  const listeners = new Set<(plan: BarPlan) => void>()

  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'
  const lookahead = () => (hidden() ? LOOKAHEAD_HIDDEN : LOOKAHEAD_VISIBLE)
  /** The audio clock as heard: minus the output latency, so visuals line up with the speakers. */
  const heard = () => (ac ? ac.currentTime - (ac.outputLatency || ac.baseLatency || 0) : 0)

  function tick(): void {
    if (!ac || !core || !playing || ac.state !== 'running') return
    try {
      core.tick(ac.currentTime, ac.currentTime + lookahead())
    } catch (err) {
      console.error('radio: tick failed', err)
    }
    const due = core.due(heard())
    for (const plan of due) for (const cb of listeners) {
      try { cb(plan) } catch (err) { console.error('radio: onBar listener failed', err) }
    }
  }

  function onVisibility(): void {
    if (!clock || !playing) return
    // The OS may have interrupted the context (a phone call on iOS); pick it up again.
    if (!hidden() && ac && ac.state !== 'running' && !stopTimer) ac.resume().catch(() => {})
    clock.set(hidden() ? TICK_HIDDEN_MS : TICK_VISIBLE_MS)
    // Top up the lookahead right away when the page hides.
    tick()
  }

  function build(): void {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) throw new Error('Web Audio is not available')
    // 'playback' asks for larger buffers: fewer dropouts, less CPU; the scheduler hides the latency.
    ac = new Ctor({ latencyHint: 'playback' })
    core = createCore(ac, conductor)
    volume = ac.createGain()
    volume.gain.value = 0
    core.output.connect(volume)
    try {
      streamDest = ac.createMediaStreamDestination()
      volume.connect(streamDest)
    } catch {
      streamDest = null
    }
    route()
    clock = createClock(tick)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
  }

  /** Connect or disconnect the speakers path. Without a MediaStream the speakers always stay on. */
  function route(): void {
    if (!ac || !volume) return
    const want = output === 'speakers' || !streamDest
    if (want === toSpeakers) return
    if (want) volume.connect(ac.destination)
    else {
      try { volume.disconnect(ac.destination) } catch { /* not connected */ }
    }
    toSpeakers = want
  }

  function setOutput(mode: 'speakers' | 'stream'): void {
    output = mode === 'stream' ? 'stream' : 'speakers'
    route()
  }

  const volGain = (v: number) => v * v

  async function start(): Promise<void> {
    if (!ac) build()
    const c = ac!
    if (stopTimer) { clearTimeout(stopTimer); stopTimer = null }
    if (c.state !== 'running') await c.resume()
    playing = true
    const t = c.currentTime
    const g = volume!.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(volGain(level), t + 0.4)
    clock!.set(hidden() ? TICK_HIDDEN_MS : TICK_VISIBLE_MS)
    tick()
  }

  function stop(): void {
    if (!ac || !playing) return
    const c = ac
    const t = c.currentTime
    const g = volume!.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(0, t + 1)
    // Keep scheduling through the fade, then freeze the clock; the conductor keeps its state.
    stopTimer = setTimeout(() => {
      stopTimer = null
      playing = false
      clock?.set(0)
      c.suspend().catch(() => {})
    }, 1100)
  }

  function setVolume(v: number): void {
    level = Math.max(0, Math.min(1, Number.isFinite(v) ? v : level))
    if (!ac || !volume || !playing || stopTimer) return
    volume.gain.setTargetAtTime(volGain(level), ac.currentTime, 0.05)
  }

  function visual(): VisualState {
    if (!core || !ac) {
      return { bar: null, step: 0, scene: { from: '', to: '', blend: 0 }, beat: 0, levels: EMPTY_LEVELS(), recent: [], time: 0, playing: false }
    }
    return { ...core.visual(heard()), playing: playing && !stopTimer }
  }

  function onBar(cb: (plan: BarPlan) => void): () => void {
    listeners.add(cb)
    return () => { listeners.delete(cb) }
  }

  return {
    start,
    stop,
    get playing() { return playing && !stopTimer },
    setVolume,
    visual,
    onBar,
    get context() { return ac },
    get stream() { return streamDest ? streamDest.stream : null },
    setOutput,
  }
}
