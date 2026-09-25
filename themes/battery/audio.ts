/**
 * Night of the Dead Battery — audio. Synthesised Web Audio, no samples, no
 * network. The pieces live in audio/:
 *
 *   score.ts    the theme and the cues as note data (a D minor oompah waltz)
 *   arrange.ts  who plays it on each floor and in each cue
 *   kit.ts      the instruments (harpsichord, tuba, bassoon, theremin …)
 *   sfx.ts      one recipe per sound effect name, the solve stings
 *   speech.ts   the per-speaker babble
 *   storm.ts    rain, wind, leaks and thunder, mixed per room
 *
 * This file is the engine: the audio graph, a 40 ms lookahead scheduler
 * that renders a bar at a time just before it starts, and the iMUSE trick:
 * the floors share one player running the theme, so a hero or floor switch
 * only swaps the arrangement at the next bar line (the old band fades over
 * that bar while the new one comes in on the downbeat). Forced cues are
 * separate tracks that crossfade. The intro's car music sputters out, tape
 * style, when the car coughs.
 *
 * SSR-safe: nothing touches window or AudioContext until unlock(). The site
 * radio is held silent while the page is open (the portal's contract, see
 * docs/games/global-radio.md) and released in dispose().
 */
import type { ActorId, Floor, GameEvent, HeroId, RoomId } from './types'
import { getRadioEngine } from '../radio/engine'
import { MUTE_KEY as RADIO_MUTE_KEY } from '../radio/catalog'
import { HEROES } from './content/heroes'
import * as K from './audio/kit'
import type { Kit } from './audio/kit'
import { TRACKS, compileTrack, type Compiled, type TrackDef, type TrackId } from './audio/score'
import { ARRANGEMENTS, type ArrId } from './audio/arrange'
import { RECIPES, STINGS, TRIM, blip, heroWhoosh, makeFx, roomStep, type Fx } from './audio/sfx'
import { planSpeech, playSyl, type Syl } from './audio/speech'
import { CREDITS_AMB, FLOOR_ROOM, ROOM_AMB, ROOM_FLOOR, TITLE_AMB, createStorm, type Amb, type Storm } from './audio/storm'

export interface BatteryAudio {
  /** Create/resume the AudioContext; call from a user gesture. */
  unlock(): void
  setMuted(muted: boolean): void
  /** Hold the site radio silent while the game page is open. */
  holdRadio(): void
  /** Engine events: music changes, sfx, speech blips, lightning, solves. */
  event(e: GameEvent): void
  /** The title screen's music on/off. */
  title(on: boolean): void
  suspend(on: boolean): void
  dispose(): void
  /** For tests: what is playing right now. */
  debug(): AudioDebug
}

export interface AudioDebug {
  ctx: AudioContext | null
  track: TrackId | null
  arr: ArrId | null
  /** When the current player's first bar began (its bar grid). */
  origin: number
  layers: { arr: ArrId; until: number; gain: AudioParam }[]
  fading: number
  speaking: boolean
  queued: number
  radioHeld: boolean
  muted: boolean
}

const SOUND_MUTE_KEY = 'phareim-sound-muted'

const MASTER = 0.8
const MUSIC = 0.5
const SFX = 0.75
const SPEECH = 0.5
const AMB = 0.9
/** Scheduler period and how far ahead notes are placed. */
const TICK_MS = 40
const AHEAD = 0.2
/** How far the music ducks under speech and under a solve sting. */
const SPEECH_DUCK = 0.72
const STING_DUCK = 0.22

/** The engine's speech timing (engine/game.ts speechDuration). */
export function lineSeconds(text: string): number {
  return Math.max(1.5, Math.min(6.5, 0.9 + text.length * 0.052))
}

interface Layer {
  arr: ArrId
  bus: GainNode
  send: GainNode
  st: { last?: number }
  from: number
  until: number
}

interface Player {
  id: TrackId
  def: TrackDef
  comp: Compiled
  out: GainNode
  delay: DelayNode | null
  layers: Layer[]
  i: number
  pass: number
  next: number
  stopAt: number
  deadAt: number
  sputtered: boolean
  origin: number
  /** The intro: coughs heard so far (two hiccups, the third kills it). */
  coughs: number
}

interface Speaking {
  who: ActorId
  g: GainNode
  q: Syl[]
  t0: number
  i: number
}

function readMuted(): boolean {
  try { return typeof window !== 'undefined' && localStorage.getItem(SOUND_MUTE_KEY) === '1' } catch { return false }
}

const CUES: Record<string, [TrackId, ArrId]> = {
  title: ['theme', 'title'],
  intro: ['intro', 'intro'],
  seance: ['seance', 'seance'],
  tension: ['tension', 'tension'],
  finale: ['finale', 'finale'],
  credits: ['credits', 'credits'],
}

export function createBatteryAudio(): BatteryAudio {
  let ac: AudioContext | null = null
  let kit: Kit | null = null
  let master!: GainNode
  let musicBus!: GainNode
  let stingDuck!: GainNode
  let speechDuck!: GainNode
  let musicVerb!: ConvolverNode
  let sfxBus!: GainNode
  let sfxVerb!: ConvolverNode
  let speechBus!: GainNode
  let echoIn!: GainNode
  let storm: Storm | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let lastTick = 0

  let muted = readMuted()
  let paused = false
  let disposed = false
  let radioHeld = false
  let wantTitle = true
  let titleOffAt = 0
  let want: { name: string | null; floor: Floor } | null = null
  /** After the intro dies: when the sparse storm theme creeps in (0 = never). */
  let creepAt = 0

  let current: Player | null = null
  const fading: Player[] = []
  let speech: Speaking | null = null
  const lastSfx = new Map<string, number>()
  let stingI = 0

  // Where everyone is, for the storm's room mix.
  let hero: HeroId = 'kjell'
  let floor: Floor = 'ground'
  const heroRoom: Partial<Record<HeroId, RoomId>> = {}
  for (const h of Object.keys(HEROES) as HeroId[]) heroRoom[h] = HEROES[h].start.room
  let cueAmb: Amb | null = TITLE_AMB

  const client = () => typeof window !== 'undefined'

  // ---- the graph ------------------------------------------------------------

  function ensure(): boolean {
    if (disposed || !client()) return false
    if (ac) {
      if (ac.state === 'suspended' && !paused) ac.resume().catch(() => {})
      return true
    }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return false
    try { ac = new Ctor() } catch { ac = null; return false }
    const c = ac
    kit = K.makeKit(c)
    const comp = c.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.knee.value = 10
    comp.ratio.value = 4
    comp.attack.value = 0.005
    comp.release.value = 0.25
    comp.connect(c.destination)
    master = K.gain(kit, muted ? 0 : MASTER)
    master.connect(comp)

    musicBus = K.gain(kit, MUSIC)
    musicBus.connect(master)
    stingDuck = K.gain(kit, 1)
    stingDuck.connect(musicBus)
    speechDuck = K.gain(kit, 1)
    speechDuck.connect(stingDuck)
    musicVerb = c.createConvolver()
    musicVerb.buffer = K.impulse(c, 2.2, 3.2, 0.02)
    const verbRet = K.gain(kit, 0.55)
    musicVerb.connect(verbRet)
    verbRet.connect(stingDuck)

    sfxBus = K.gain(kit, SFX)
    sfxBus.connect(master)
    sfxVerb = c.createConvolver()
    sfxVerb.buffer = K.impulse(c, 1.4, 3, 0.01)
    const sfxRet = K.gain(kit, 0.6)
    sfxVerb.connect(sfxRet)
    sfxRet.connect(sfxBus)

    speechBus = K.gain(kit, SPEECH)
    speechBus.connect(master)
    // Aunt Hedvig speaks from the other side: a dark echo.
    echoIn = K.gain(kit, 0.5)
    const echo = c.createDelay(1)
    echo.delayTime.value = 0.26
    const fb = K.gain(kit, 0.4)
    const elp = K.filt(kit, 'lowpass', 2200)
    echoIn.connect(echo)
    echo.connect(elp)
    elp.connect(fb)
    fb.connect(echo)
    elp.connect(speechBus)

    const ambBus = K.gain(kit, AMB)
    ambBus.connect(master)
    storm = createStorm(kit, ambBus, c.currentTime + 0.05)
    storm.set(ambNow(), c.currentTime)

    lastTick = c.currentTime
    timer = setInterval(tick, TICK_MS)
    if (c.state === 'suspended' && !paused) c.resume().catch(() => {})
    return true
  }

  // ---- the radio ------------------------------------------------------------

  function parkRadio(): void {
    if (radioHeld) return
    try {
      getRadioEngine().hold(true)
      radioHeld = true
    } catch { /* no radio */ }
  }

  function unparkRadio(): void {
    if (!radioHeld) return
    radioHeld = false
    try {
      const r = getRadioEngine()
      r.hold(false)
      let radioMuted = false
      try { radioMuted = localStorage.getItem(RADIO_MUTE_KEY) === '1' } catch { /* none */ }
      if (r.playing && !radioMuted) r.suspend(false)
    } catch { /* ignore */ }
  }

  // ---- first gesture: the title music starts even before a game does ----------

  const gestureEvents = ['pointerup', 'keydown', 'touchend'] as const
  function onGesture(): void {
    if (disposed) return
    if (!ac) {
      ensure()
      if (wantTitle && !current && !want) want = { name: 'title', floor }
    } else if (ac.state === 'suspended' && !paused) ac.resume().catch(() => {})
  }
  const canListen = client() && typeof window.addEventListener === 'function'
  if (canListen) for (const ev of gestureEvents) window.addEventListener(ev, onGesture, { capture: true, passive: true })

  // A hidden tab goes quiet on its own (the game also pauses; the title screen doesn't).
  function onVisibility(): void {
    if (!ac || disposed) return
    if (document.hidden) ac.suspend().catch(() => {})
    else if (!paused) ac.resume().catch(() => {})
  }
  const canWatch = canListen && typeof document !== 'undefined' && typeof document.addEventListener === 'function'
  if (canWatch) document.addEventListener('visibilitychange', onVisibility)

  // ---- ambience ---------------------------------------------------------------

  function ambNow(): Amb {
    if (cueAmb) return cueAmb
    const r = heroRoom[hero]
    if (r && ROOM_FLOOR[r] === floor) return ROOM_AMB[r]
    return ROOM_AMB[FLOOR_ROOM[floor]]
  }

  function refreshAmb(): void {
    if (ac && storm) storm.set(ambNow(), ac.currentTime)
  }

  // ---- music: players and layers --------------------------------------------

  const barLen = (p: Player): number => (p.def.meter * 60) / bpmOf(p)
  function steps(p: Player): number {
    return Math.min(p.pass, p.def.maxSteps ?? 0)
  }
  function bpmOf(p: Player): number {
    return p.def.bpm + (p.def.bpmStep ?? 0) * steps(p)
  }

  function addLayer(p: Player, arr: ArrId, from: number, instant: boolean): Layer {
    const a = ARRANGEMENTS[arr]
    const bus = K.gain(kit!, 0)
    bus.gain.setValueAtTime(0, ac!.currentTime)
    if (instant) bus.gain.setValueAtTime(a.level, Math.max(ac!.currentTime, from - 0.01))
    else bus.gain.setTargetAtTime(a.level, Math.max(ac!.currentTime, from - 0.03), 0.1)
    const send = K.gain(kit!, a.verb)
    bus.connect(p.out)
    bus.connect(send)
    send.connect(musicVerb)
    const l: Layer = { arr, bus, send, st: {}, from, until: Infinity }
    p.layers.push(l)
    return l
  }

  function makePlayer(id: TrackId, arr: ArrId, start: number): Player {
    const out = K.gain(kit!, 0)
    out.gain.setValueAtTime(0, ac!.currentTime)
    out.gain.setTargetAtTime(1, Math.max(ac!.currentTime, start - 0.05), 0.05)
    let delay: DelayNode | null = null
    if (id === 'intro') {
      // A tape path for the sputter at the end of the drive.
      delay = ac!.createDelay(2)
      delay.delayTime.value = 0.01
      out.connect(delay)
      delay.connect(speechDuck)
    } else out.connect(speechDuck)
    const p: Player = {
      id, def: TRACKS[id], comp: compileTrack(id), out, delay, layers: [],
      i: 0, pass: 0, next: start, stopAt: Infinity, deadAt: Infinity, sputtered: false, origin: start, coughs: 0,
    }
    addLayer(p, arr, start, true)
    return p
  }

  /** iMUSE: change the band at the next bar line, same bars, same tempo. */
  function switchArr(p: Player, arr: ArrId): void {
    const live = p.layers.filter(l => l.until === Infinity)
    const cur = live[live.length - 1]
    if (cur && cur.arr === arr) return
    const T = p.next
    const bar = barLen(p)
    if (cur && cur.from >= T - 1e-6) {
      // The switch we asked for has not sounded yet: replace it.
      cur.until = cur.from
      cur.bus.gain.cancelScheduledValues(ac!.currentTime)
      cur.bus.gain.setValueAtTime(0, ac!.currentTime)
      const back = p.layers.find(l => l !== cur && Math.abs(l.until - (T + bar)) < 1e-6 && l.arr === arr)
      if (back) {
        back.until = Infinity
        back.bus.gain.cancelScheduledValues(T - 0.01)
        back.bus.gain.setTargetAtTime(ARRANGEMENTS[arr].level, ac!.currentTime, 0.05)
        return
      }
    } else if (cur) {
      cur.until = T + bar
      cur.bus.gain.cancelScheduledValues(T)
      cur.bus.gain.setTargetAtTime(0, T, bar * 0.3)
    }
    addLayer(p, arr, T, false)
    // Rapid switching: never more than three bands at once.
    while (p.layers.length > 3) {
      const old = p.layers.shift()!
      old.bus.gain.cancelScheduledValues(ac!.currentTime)
      old.bus.gain.setTargetAtTime(0, ac!.currentTime, 0.05)
      try { old.bus.disconnect() } catch { /* gone */ }
    }
  }

  function fadePlayer(p: Player, tc: number): void {
    const now = ac!.currentTime
    p.out.gain.cancelScheduledValues(now)
    p.out.gain.setTargetAtTime(0, now, tc)
    p.stopAt = Math.min(p.stopAt, now + tc * 3)
    p.deadAt = now + tc * 6 + 2.5
    fading.push(p)
  }

  /** The car coughs: the tape wows down and back, the band drops out for a moment. */
  function hiccup(p: Player, depth: number): void {
    if (!ac) return
    const s = ac.currentTime + 0.05
    const g = p.out.gain
    g.cancelScheduledValues(s)
    g.setValueAtTime(1, s)
    g.linearRampToValueAtTime(0.3, s + 0.08)
    g.linearRampToValueAtTime(1, s + 0.4)
    if (p.delay) {
      const d = p.delay.delayTime
      d.cancelScheduledValues(s)
      d.setValueAtTime(0.01, s)
      d.linearRampToValueAtTime(0.01 + depth, s + 0.15)
      d.linearRampToValueAtTime(0.01, s + 0.45)
    }
  }

  /** The car dies: the music stutters, sags in pitch like a tape running down, and stops. */
  function sputter(p: Player): void {
    if (p.sputtered || !ac) return
    p.sputtered = true
    const s = ac.currentTime + 0.05
    const g = p.out.gain
    g.cancelScheduledValues(s)
    g.setValueAtTime(1, s)
    g.linearRampToValueAtTime(0.25, s + 0.12)
    g.linearRampToValueAtTime(1, s + 0.28)
    g.linearRampToValueAtTime(0.15, s + 0.5)
    g.linearRampToValueAtTime(0.85, s + 0.66)
    g.linearRampToValueAtTime(0.5, s + 1.3)
    g.linearRampToValueAtTime(0, s + 2.6)
    if (p.delay) {
      const d = p.delay.delayTime
      d.cancelScheduledValues(s)
      d.setValueAtTime(0.01, s)
      d.linearRampToValueAtTime(0.05, s + 0.3)
      d.setValueAtTime(0.05, s + 0.66)
      d.linearRampToValueAtTime(0.3, s + 1.4)
      d.linearRampToValueAtTime(1.2, s + 2.4)
    }
    p.stopAt = s + 1.5
    p.deadAt = s + 5
    if (current === p) current = null
    fading.push(p)
    creepAt = s + 7
  }

  function applyMusic(name: string | null, fl: Floor): void {
    if (!ac) return
    titleOffAt = 0
    creepAt = 0
    floor = fl
    if (name === null) {
      if (current) fadePlayer(current, 0.5)
      current = null
      cueAmb = null
      refreshAmb()
      return
    }
    let track: TrackId
    let arr: ArrId
    if (name === 'auto') {
      track = 'theme'
      arr = fl
      // A floor the current hero doesn't live on: the hero who does is probably playing.
      if (HEROES[hero].floor !== fl && fl !== 'outside') {
        const h = (Object.keys(HEROES) as HeroId[]).find(x => HEROES[x].floor === fl)
        if (h) hero = h
      }
    } else if (CUES[name]) [track, arr] = CUES[name]!
    else return
    cueAmb = name === 'title' ? TITLE_AMB : name === 'credits' ? CREDITS_AMB : name === 'intro' ? ROOM_AMB.driveway : null
    refreshAmb()
    parkRadio()
    if (current && current.id === track) {
      switchArr(current, arr)
      return
    }
    if (current) fadePlayer(current, 0.35)
    current = makePlayer(track, arr, ac.currentTime + 0.12)
  }

  function renderBar(p: Player, t0: number): void {
    const bars = p.comp.bars
    const bar = bars[p.i]!
    const prev = p.i > 0 ? bars[p.i - 1]! : null
    const next = bars[p.i + 1] ?? bars[p.comp.loopBar]!
    const beat = 60 / bpmOf(p)
    const tr = (p.def.trStep ?? 0) * steps(p)
    for (const l of p.layers) {
      if (l.from > t0 + 1e-3 || t0 >= l.until - 1e-3) continue
      try {
        ARRANGEMENTS[l.arr].bar({
          k: kit!, out: l.bus, t0, beat, e: beat / 2, bar, prev, next, pass: p.pass, tr, st: l.st, rnd: Math.random,
        })
      } catch { /* a closed context mid-bar */ }
    }
  }

  function schedule(p: Player, now: number): void {
    let guard = 3
    while (p.next < now + AHEAD && p.next < p.stopAt && guard-- > 0) {
      // A bar that should already have started (a stalled tab) is skipped, not crammed in.
      if (p.next < now - 0.05) {
        p.next = now + 0.05
      }
      if (!muted) renderBar(p, p.next)
      p.next += barLen(p)
      p.i++
      if (p.i >= p.comp.bars.length) {
        p.i = p.comp.loopBar
        p.pass++
      }
    }
    for (const l of p.layers) {
      if (l.until !== Infinity && now > l.until + 4) {
        try { l.bus.disconnect() } catch { /* gone */ }
      }
    }
    p.layers = p.layers.filter(l => l.until === Infinity || now <= l.until + 4)
  }

  // ---- speech -------------------------------------------------------------------

  function stopSpeech(now: number): void {
    if (!speech) return
    const g = speech.g
    g.gain.cancelScheduledValues(now)
    g.gain.setTargetAtTime(0, now, 0.012)
    speech = null
  }

  function speak(who: ActorId, text: string): void {
    if (!ac || !kit) return
    const now = ac.currentTime
    stopSpeech(now)
    if (muted) return
    const dur = lineSeconds(text)
    const q = planSpeech(who, text, dur)
    const g = K.gain(kit, 1)
    g.connect(speechBus)
    speech = { who, g, q, t0: now + 0.03, i: 0 }
    speechDuck.gain.cancelScheduledValues(now)
    speechDuck.gain.setTargetAtTime(SPEECH_DUCK, now, 0.08)
    speechDuck.gain.setTargetAtTime(1, now + dur, 0.4)
    pumpSpeech(now)
  }

  function pumpSpeech(now: number): void {
    const s = speech
    if (!s || !kit) return
    while (s.i < s.q.length && s.t0 + s.q[s.i]!.t < now + AHEAD) {
      const syl = s.q[s.i]!
      try { playSyl(kit, s.g, echoIn, s.who, syl, Math.max(now, s.t0 + syl.t)) } catch { /* ignore */ }
      s.i++
    }
  }

  // ---- one-shots ------------------------------------------------------------------

  function fx(trimDb = 0): Fx | null {
    if (!ac || !kit || muted) return null
    let out: AudioNode = sfxBus
    if (trimDb) {
      const g = K.gain(kit, Math.pow(10, trimDb / 20))
      g.connect(sfxBus)
      out = g
    }
    return makeFx(kit, ac.currentTime + 0.01, out, sfxVerb)
  }

  function sfx(name: string): void {
    if (!ac) return
    const now = ac.currentTime
    // Brunhilde chugs in on the intro's music: two coughs make it hiccup, the third (or the starter clicking) kills it.
    if (current?.id === 'intro' && !current.sputtered) {
      if (name === 'car-cough') {
        current.coughs++
        if (current.coughs >= 3) sputter(current)
        else hiccup(current, current.coughs === 1 ? 0.04 : 0.07)
      } else if (name === 'car-click') sputter(current)
    }
    if (muted) return
    const last = lastSfx.get(name) ?? -1
    if (now - last < 0.04 && last >= 0) return
    lastSfx.set(name, now)
    const f = fx(TRIM[name] ?? 0)
    if (!f) return
    f.since = last >= 0 ? now - last : Infinity
    const r = RECIPES[name]
    try { (r ?? blip)(f) } catch { /* ignore */ }
  }

  function sting(id: string): void {
    const f = fx()
    if (!f || !ac) return
    if (id === 'midnight') {
      // The big one: the finale is already playing; a fanfare on top, a lighter duck.
      RECIPES.fanfare!(f)
      const now = ac.currentTime
      stingDuck.gain.cancelScheduledValues(now)
      stingDuck.gain.setTargetAtTime(0.55, now, 0.04)
      stingDuck.gain.setTargetAtTime(1, now + 1.2, 0.4)
      return
    }
    let h = 0
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    const recipe = STINGS[(h + stingI++) % STINGS.length]!
    let len = 1.2
    try { len = recipe(f) } catch { /* ignore */ }
    const now = ac.currentTime
    stingDuck.gain.cancelScheduledValues(now)
    stingDuck.gain.setTargetAtTime(STING_DUCK, now, 0.04)
    stingDuck.gain.setTargetAtTime(1, now + len, 0.35)
  }

  // ---- the clock -------------------------------------------------------------------

  function tick(): void {
    if (!ac || !kit) return
    const now = ac.currentTime
    const dt = Math.max(0, Math.min(0.25, now - lastTick))
    lastTick = now
    try {
      if (want) {
        const w = want
        want = null
        applyMusic(w.name, w.floor)
      }
      if (titleOffAt && now >= titleOffAt) {
        titleOffAt = 0
        const onTitle = current?.layers.some(l => l.until === Infinity && l.arr === 'title')
        if (current && onTitle) {
          fadePlayer(current, 0.4)
          current = null
        }
      }
      if (creepAt && now >= creepAt) {
        creepAt = 0
        // Rain, then the theme again, sparse, from the dark: the driveway's arrangement.
        if (!current) {
          current = makePlayer('theme', 'outside', now + 0.12)
          current.out.gain.cancelScheduledValues(now)
          current.out.gain.setValueAtTime(0, now)
          current.out.gain.setTargetAtTime(1, now + 0.1, 2.5)
        }
      }
      if (current) schedule(current, now)
      for (const p of fading) schedule(p, now)
      for (let i = fading.length - 1; i >= 0; i--) {
        const p = fading[i]!
        if (now > p.deadAt) {
          try { p.out.disconnect() } catch { /* gone */ }
          fading.splice(i, 1)
        }
      }
      pumpSpeech(now)
      if (!muted) storm?.tick(now, dt)
    } catch { /* never let the timer die */ }
  }

  // ---- public ----------------------------------------------------------------------

  return {
    unlock() {
      if (!ensure()) return
      if (wantTitle && !current && !want) want = { name: 'title', floor }
    },

    setMuted(m) {
      muted = m
      if (!ac) return
      master.gain.setTargetAtTime(m ? 0 : MASTER, ac.currentTime, 0.03)
      if (m) stopSpeech(ac.currentTime)
    },

    holdRadio() {
      parkRadio()
    },

    event(e) {
      switch (e.t) {
        case 'music':
          want = { name: e.name, floor: e.floor }
          if (e.name !== 'title') wantTitle = false
          return
        case 'hero':
          hero = e.id
          refreshAmb()
          { const f = fx(); if (f) heroWhoosh(f) }
          return
        case 'room':
          heroRoom[hero] = e.room
          refreshAmb()
          { const f = fx(); if (f) roomStep(f) }
          return
        case 'sfx':
          sfx(e.name)
          return
        case 'speak':
          speak(e.who, e.text)
          return
        case 'lightning':
          if (ac && storm && !muted) storm.thunder(e.a, ac.currentTime)
          return
        case 'solve':
          sting(e.id)
          return
        default:
          // flash, shake, save, end: nothing to hear (the credits cue plays the end).
          return
      }
    },

    title(on) {
      wantTitle = on
      if (!ac) return
      if (on) {
        want = { name: 'title', floor }
        cueAmb = TITLE_AMB
        refreshAmb()
      } else {
        if (want?.name === 'title') want = null
        titleOffAt = ac.currentTime + 0.3
      }
    },

    suspend(on) {
      paused = on
      if (!ac) return
      if (on) ac.suspend().catch(() => {})
      else ac.resume().catch(() => {})
    },

    dispose() {
      disposed = true
      if (canListen) for (const ev of gestureEvents) window.removeEventListener(ev, onGesture, { capture: true })
      if (canWatch) document.removeEventListener('visibilitychange', onVisibility)
      if (timer) { clearInterval(timer); timer = null }
      if (ac && storm) storm.stop(ac.currentTime)
      current = null
      fading.length = 0
      speech = null
      storm = null
      unparkRadio()
      if (ac) ac.close().catch(() => {})
      ac = null
      kit = null
    },

    debug() {
      const live = current?.layers.filter(l => l.until === Infinity) ?? []
      return {
        ctx: ac,
        track: current?.id ?? null,
        arr: live[live.length - 1]?.arr ?? null,
        origin: current?.origin ?? 0,
        layers: (current?.layers ?? []).map(l => ({ arr: l.arr, until: l.until, gain: l.bus.gain })),
        fading: fading.length,
        speaking: speech !== null,
        queued: speech ? speech.q.length - speech.i : 0,
        radioHeld,
        muted,
      }
    },
  }
}
