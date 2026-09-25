// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * The radio's session state, client-only (RadioApp is a .client component).
 *
 * One conductor lives for the whole session and is created on the first
 * PLAY, with whatever controls were set before; until then the page shows
 * the chosen place with an idle scene. Every control change goes through
 * `set()`, which updates the reactive copy, calls `conductor.setControls`
 * with just the changed fields and saves controls to localStorage.
 *
 * The HUD fields below are written from the page's animation loop (`tick`)
 * only when they change, so Vue re-renders a few times a bar, not 60 times
 * a second.
 */
import { computed, reactive, ref, shallowRef } from 'vue'
import type { BarPlan, Controls, FeedbackSnapshot, Landscape, Layer, RadioPlayer, VisualState } from '../engine/types.ts'
import { DEFAULT_CONTROLS, LAYERS } from '../engine/types.ts'
import { createConductor, modeFor } from '../engine/conductor.ts'
import type { Conductor } from '../engine/conductor.ts'
import { BUILTIN, LANDSCAPES } from '../engine/landscapes/index.ts'
import { ENGINE_VERSION, INTENSITY_NAMES } from '../engine/catalog.ts'
import { keyName as engineKeyName } from '../engine/theory.ts'
import type { Key } from '../engine/types.ts'

/** 'Bb dorian' → 'Bb DORIAN': the root keeps its flat (PxText draws it), the mode is shouted. */
function keyName(k: Key): string {
  const s = engineKeyName(k)
  const i = s.indexOf(' ')
  return i < 0 ? s : s.slice(0, i) + ' ' + s.slice(i + 1).toUpperCase()
}
import { load, save } from './storage'

// The player module is bundled statically when it exists (an eager glob is a
// static import that tolerates a missing file), so the AudioContext starts
// inside the PLAY gesture with no await in front of it.
const playerModules = import.meta.glob<{ createPlayer: (c: Conductor) => RadioPlayer }>('../engine/audio/player.ts', { eager: true })
const createPlayer = Object.values(playerModules)[0]?.createPlayer ?? null

const CHORD = /^[A-G][b#]?(maj9|maj7|m\(maj7\)|m7b5|madd9|dim7|dim|add9|7sus4|7sus2|sus4|sus2|m9|m7|m6|m|9|7|6\/9|6|5)?(\/[A-G][b#]?)?[,.]?$/

/** Shout the words of a transition note but keep chord names as written (PxText draws their flats and minors). */
function noteText(s: string): string {
  return s.split(' ').map(w => (CHORD.test(w) ? w : w.toUpperCase())).join(' ')
}

const CONTROLS_KEY = 'radio.controls'
const VOLUME_KEY = 'radio.volume'

function restoreControls(): Controls {
  const saved = load<Partial<Controls>>(CONTROLS_KEY, {})
  const c: Controls = { ...DEFAULT_CONTROLS }
  const n = (x: unknown, lo: number, hi: number, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d)
  if (typeof saved.landscape === 'string') c.landscape = saved.landscape
  c.intensity = Math.round(n(saved.intensity, 0, 4, c.intensity)) as Controls['intensity']
  c.mood = n(saved.mood, 0, 1, c.mood)
  c.space = n(saved.space, 0, 1, c.space)
  c.grit = n(saved.grit, 0, 1, c.grit)
  c.density = n(saved.density, 0, 1, c.density)
  c.tempo = Math.round(n(saved.tempo, -20, 20, c.tempo))
  c.hold = saved.hold === true
  return c
}

const controls = reactive<Controls>(restoreControls())
const volume = ref<number>(Math.min(1, Math.max(0, Number(load<number>(VOLUME_KEY, 0.8)) || 0)))
const muted = ref(false)
const playing = ref(false)
const started = ref(false)
const composed = shallowRef<Landscape[]>([])

const landscapes = computed<Landscape[]>(() => [...BUILTIN, ...composed.value])
const byId = computed<Record<string, Landscape>>(() => Object.fromEntries(landscapes.value.map(l => [l.id, l])))

/** What the HUD shows. `landscape` is the place sounding now; `controls.landscape` is where the music is going. */
const hud = reactive({
  landscape: controls.landscape,
  key: '',
  chord: '',
  next: '',
  bpm: 0,
  phraseBar: -1,
  phraseBars: 8,
  section: '',
  note: '',
  transition: 'none' as string,
  /** The intensity the music is at now (it moves toward controls.intensity layer by layer). */
  intensity: -1,
})
const levels = reactive<Record<Layer, number>>(Object.fromEntries(LAYERS.map(l => [l, 0])) as Record<Layer, number>)
const active = reactive<Record<Layer, boolean>>(Object.fromEntries(LAYERS.map(l => [l, false])) as Record<Layer, boolean>)
const upcoming = reactive<Record<Layer, number>>(Object.fromEntries(LAYERS.map(l => [l, 0])) as Record<Layer, number>)

let conductor: Conductor | null = null
let player: RadioPlayer | null = null
let lastBarIndex = -1
let lastBar: BarPlan | null = null
const barListeners = new Set<(b: BarPlan) => void>()

function lookup(id: string): Landscape | undefined {
  return byId.value[id] ?? LANDSCAPES[id]
}

function landscapeOf(id: string): Landscape {
  return lookup(id) ?? BUILTIN[0]!
}

function set(patch: Partial<Controls>): void {
  const clean: Partial<Controls> = {}
  for (const [k, v] of Object.entries(patch) as Array<[keyof Controls, never]>) {
    if (controls[k] !== v) (clean as Record<string, unknown>)[k] = v
  }
  if (!Object.keys(clean).length) return
  Object.assign(controls, clean)
  conductor?.setControls(clean)
  // The conductor may correct a value (clamping, an unknown landscape).
  if (conductor) Object.assign(controls, conductor.controls)
  save(CONTROLS_KEY, { ...controls })
}

function applyVolume(): void {
  player?.setVolume(muted.value ? 0 : volume.value)
}

function setVolume(v: number): void {
  volume.value = Math.min(1, Math.max(0, v))
  if (volume.value > 0) muted.value = false
  save(VOLUME_KEY, volume.value)
  applyVolume()
}

function toggleMute(): void {
  muted.value = !muted.value
  applyVolume()
}

/** Start or resume. Call straight from a user gesture. Returns the player's stream, if any, for the <audio> element. */
function play(): Promise<void> {
  if (!createPlayer) return Promise.reject(new Error('audio player not available'))
  if (!conductor) {
    conductor = createConductor({ lookup, controls: { ...controls } })
    // An unknown landscape (a hidden composed one) falls back to the conductor's choice.
    Object.assign(controls, conductor.controls)
  }
  if (!player) {
    player = createPlayer(conductor)
    player.onBar(b => { for (const cb of barListeners) cb(b) })
  }
  applyVolume()
  try {
    // Safari 17+: play as media (through the silent switch), not as a UI sound.
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'playback'
  } catch { /* not supported */ }
  const p = player.start()
  started.value = true
  playing.value = true
  return p.catch((e) => { playing.value = player?.playing ?? false; throw e })
}

function pause(): void {
  player?.stop()
  playing.value = false
}

function onBar(cb: (b: BarPlan) => void): () => void {
  barListeners.add(cb)
  return () => barListeners.delete(cb)
}

// ---- the idle scene (before the first PLAY) --------------------------------

const idle = { from: controls.landscape, to: controls.landscape, t0: 0 }
const EMPTY_LEVELS = Object.fromEntries(LAYERS.map(l => [l, 0])) as Record<Layer, number>

function sceneOf(id: string): string {
  const L = landscapeOf(id)
  return L.scene ?? L.id
}

function idleVisual(now: number): VisualState {
  if (sceneOf(controls.landscape) !== idle.to) {
    idle.from = idle.to
    idle.to = sceneOf(controls.landscape)
    idle.t0 = now
  }
  const blend = Math.min(1, (now - idle.t0) / 1600)
  const L = landscapeOf(controls.landscape)
  const key = { tonic: L.tonic, mode: modeFor(L, controls.mood) }
  const bar = {
    index: 0, bpmStart: L.bpm, bpmEnd: L.bpm, swing: 0,
    chords: [{ from: 0, len: 16, chord: { root: L.tonic, bass: L.tonic, tones: [0, 7], symbol: '', degree: '' } }],
    key, scale: [], notes: [], drums: [], mix: {},
    fx: { reverb: 0, delay: 0, reverbSize: 2, tone: 1, grit: 0, pump: 0, width: 1 },
    ambience: {}, ambienceFadeBars: 1,
    meta: {
      landscape: L.id,
      scene: { from: idle.from, to: idle.to, blendStart: blend, blendEnd: blend },
      phraseBar: 0, phraseBars: 8, section: '', active: [], upcoming: [],
      transition: { kind: 'none', from: L.id, to: L.id, progress: 1, note: '' },
      intensity: controls.intensity,
    },
  } as BarPlan
  return { bar, step: 0, scene: { from: idle.from, to: idle.to, blend }, beat: 0, levels: EMPTY_LEVELS, recent: [], time: now / 1000, playing: false }
}

// ---- per frame -------------------------------------------------------------

/** Read the player (or the idle scene) and refresh the HUD. Called every animation frame. */
function tick(now: number): VisualState {
  const v = player && started.value ? player.visual() : idleVisual(now)
  const bar = player && started.value ? v.bar : null

  if (!bar) {
    const L = landscapeOf(controls.landscape)
    hud.landscape = L.id
    hud.key = keyName({ tonic: L.tonic, mode: modeFor(L, controls.mood) })
    hud.bpm = Math.round(L.bpm + controls.tempo)
    hud.chord = ''
    hud.next = ''
    hud.phraseBar = -1
    hud.note = ''
  } else {
    if (bar.index !== lastBarIndex) {
      lastBarIndex = bar.index
      lastBar = bar
      // The conductor names the place sounding: the old one until the bridge
      // turns into the new key, the new one from there and while it builds up.
      hud.landscape = bar.meta.landscape
      hud.key = keyName(bar.key)
      hud.bpm = Math.round(bar.bpmEnd)
      hud.phraseBar = bar.meta.phraseBar
      hud.phraseBars = bar.meta.phraseBars
      hud.section = bar.meta.section
      hud.note = noteText(bar.meta.transition.note)
      hud.transition = bar.meta.transition.kind
      hud.intensity = bar.meta.intensity
      for (const l of LAYERS) {
        active[l] = bar.meta.active.includes(l)
        upcoming[l] = bar.meta.upcoming.find(u => u.layer === l)?.inBars ?? 0
      }
    }
    const spans = bar.chords
    const i = spans.findIndex(s => v.step >= s.from && v.step < s.from + s.len)
    const now_ = spans[i < 0 ? 0 : i]?.chord.symbol ?? ''
    const next = (i >= 0 && spans[i + 1]?.chord.symbol) || bar.meta.nextChord || ''
    if (hud.chord !== now_) hud.chord = now_
    const nx = next && next !== now_ ? next : ''
    if (hud.next !== nx) hud.next = nx
  }
  for (const l of LAYERS) {
    const q = Math.round(Math.min(1, Math.max(0, v.levels?.[l] ?? 0)) * 4) / 4
    if (levels[l] !== q) levels[l] = q
  }
  return v
}

// ---- feedback snapshot -------------------------------------------------------

function snapshot(): FeedbackSnapshot {
  const bar = (player && started.value ? player.visual().bar : null) ?? lastBar
  const c = conductor ? conductor.controls : { ...controls }
  const L = landscapeOf(bar?.meta.landscape ?? controls.landscape)
  return {
    landscape: L.id,
    controls: c,
    bar: bar?.index ?? -1,
    key: bar ? keyName(bar.key) : keyName({ tonic: L.tonic, mode: modeFor(L, c.mood) }),
    chords: bar ? bar.chords.map(s => s.chord.symbol) : [],
    section: bar?.meta.section ?? '',
    seed: conductor?.seed ?? 0,
    engineVersion: ENGINE_VERSION,
    active: bar ? [...bar.meta.active] : [],
    transition: bar?.meta.transition.kind ?? 'none',
  }
}

// ---- composed landscapes -----------------------------------------------------

function setComposed(list: Landscape[]): void {
  composed.value = list.map(l => ({ ...l, origin: 'opus' as const }))
}

export function useRadio() {
  return {
    controls,
    volume,
    muted,
    playing,
    started,
    landscapes,
    composed,
    hud,
    levels,
    active,
    upcoming,
    hasPlayer: !!createPlayer,
    intensityNames: INTENSITY_NAMES,
    set,
    setVolume,
    toggleMute,
    play,
    pause,
    tick,
    snapshot,
    onBar,
    landscapeOf,
    setComposed,
    stream: () => player?.stream ?? null,
    context: () => player?.context ?? null,
    setOutput: (mode: 'speakers' | 'stream') => player?.setOutput(mode),
    /** The place sounding now, read from the player (the HUD stops updating in a hidden tab). */
    sounding: () => player?.visual().bar?.meta.landscape ?? hud.landscape,
  }
}
