// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Auto: the radio drifts from place to place on its own, slowly. It stays
 * seven to eleven minutes of listening in each place (paused time and time
 * spent crossing over don't count), then glides to another, preferring one
 * with a nearby tempo and not one of the last few. The conductor makes the
 * crossing itself: the phrase ends, a bridge, the new place builds up.
 *
 * STAY (auto off) keeps the music where it is; ▶▶ glides on now.
 */
import { ref } from 'vue'
import type { Landscape } from '../engine/types.ts'
import { load, save } from './storage'
import { useRadio } from './useRadio'
import { useChannels } from './useChannels'

const AUTO_KEY = 'radio.auto'
const MIN_STAY = 7 * 60
const MAX_STAY = 11 * 60

const auto = ref<boolean>(load<boolean>(AUTO_KEY, false) === true)
/** Seconds left in this place while auto is on. */
const left = ref(0)

let stay = pickStay()
let heard = 0
let last = 0
/** The place the stay is counted for; a new pick (by hand or by auto) starts a fresh stay. */
let counting = ''
let timer: ReturnType<typeof setInterval> | null = null
const recent: string[] = []

function pickStay(): number {
  return MIN_STAY + Math.floor(Math.random() * (MAX_STAY - MIN_STAY))
}

/** Somewhere else, near in tempo, not visited lately. */
function pickNext(list: Landscape[], from: Landscape): Landscape {
  const pool = list.filter(l => l.id !== from.id && !recent.includes(l.id))
  const choices = pool.length ? pool : list.filter(l => l.id !== from.id)
  if (!choices.length) return from
  const weights = choices.map(l => 1 / (1 + Math.abs(l.bpm - from.bpm) / 18))
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < choices.length; i++) {
    r -= weights[i]!
    if (r <= 0) return choices[i]!
  }
  return choices[choices.length - 1]!
}

/** Glide to the next place now (auto or not). */
function glideOn(): void {
  const { controls, landscapeOf, set } = useRadio()
  const { visible } = useChannels()
  const from = landscapeOf(controls.landscape)
  recent.unshift(from.id)
  recent.length = Math.min(recent.length, 3)
  set({ landscape: pickNext(visible.value, from).id })
  heard = 0
  stay = pickStay()
  left.value = stay
}

/** Counts by the wall clock: a hidden tab's timers fire late, not less time passes. */
function second(): void {
  const { playing, controls, sounding } = useRadio()
  const now = Date.now()
  const dt = last ? Math.min(120, (now - last) / 1000) : 1
  last = now
  if (!auto.value || !playing.value) return
  if (controls.landscape !== counting) {
    counting = controls.landscape
    heard = 0
    stay = pickStay()
  }
  // Crossing over is part of the journey, not of the stay.
  if (sounding() !== controls.landscape) return
  heard += dt
  left.value = Math.max(0, Math.round(stay - heard))
  if (heard >= stay) glideOn()
}

function setAuto(on: boolean): void {
  auto.value = on
  save(AUTO_KEY, on)
  heard = 0
  stay = pickStay()
  left.value = stay
}

function startClock(): void {
  if (timer || typeof window === 'undefined') return
  timer = setInterval(second, 1000)
}

export function useAuto() {
  startClock()
  return { auto, left, setAuto, toggleAuto: () => setAuto(!auto.value), glideOn }
}
