/**
 * Night of the Dead Battery — the storm under everything. A rain bed
 * (filtered white noise plus a low brown roar), wind that gusts and howls,
 * droplets on the glass, water dripping where the house leaks, and thunder
 * after each lightning strike: a crack for close ones, a rolling rumble for
 * all, later and softer the further away. Each room has its own mix: the
 * roof and the driveway are in the weather, the cellar hears it through
 * stone, the conservatory has a glass roof and buckets.
 */
import * as K from './kit'
import type { Kit } from './kit'
import type { Floor, RoomId } from '../types'

export interface Amb {
  /** Rain level and brightness (lowpass cutoff). */
  rain: number
  lp: number
  wind: number
  /** A resonant whistle in the wind (chimneys, rafters). */
  howl: number
  /** Droplets on glass per second. */
  patter: number
  /** Drips from leaks per second. */
  drips: number
  /** Thunder level and brightness. */
  thunder: number
  tlp: number
}

const OUT: Amb = { rain: 0.75, lp: 7000, wind: 0.7, howl: 0.25, patter: 5, drips: 0, thunder: 1, tlp: 2600 }

export const ROOM_AMB: Record<RoomId, Amb> = {
  driveway: OUT,
  roof: { rain: 0.85, lp: 8000, wind: 0.9, howl: 0.5, patter: 6, drips: 0, thunder: 1.1, tlp: 3200 },
  foyer: { rain: 0.34, lp: 2200, wind: 0.25, howl: 0.15, patter: 1.2, drips: 0, thunder: 0.8, tlp: 900 },
  parlour: { rain: 0.3, lp: 2000, wind: 0.3, howl: 0.4, patter: 1, drips: 0, thunder: 0.8, tlp: 900 },
  kitchen: { rain: 0.36, lp: 2400, wind: 0.2, howl: 0.1, patter: 1.5, drips: 0, thunder: 0.8, tlp: 1000 },
  conservatory: { rain: 0.7, lp: 4500, wind: 0.3, howl: 0.1, patter: 5, drips: 0.8, thunder: 0.95, tlp: 1600 },
  pantry: { rain: 0.15, lp: 900, wind: 0.1, howl: 0.05, patter: 0, drips: 0.6, thunder: 0.6, tlp: 320 },
  boiler: { rain: 0.1, lp: 700, wind: 0.05, howl: 0, patter: 0, drips: 0.2, thunder: 0.55, tlp: 260 },
  lab: { rain: 0.12, lp: 800, wind: 0.08, howl: 0.1, patter: 0, drips: 0.3, thunder: 0.65, tlp: 360 },
  storeroom: { rain: 0.4, lp: 3200, wind: 0.42, howl: 0.5, patter: 2.5, drips: 0.1, thunder: 0.9, tlp: 1400 },
  study: { rain: 0.38, lp: 3200, wind: 0.42, howl: 0.4, patter: 2, drips: 0, thunder: 0.9, tlp: 1400 },
}

export const ROOM_FLOOR: Record<RoomId, Floor> = {
  driveway: 'outside', roof: 'attic',
  foyer: 'ground', parlour: 'ground', kitchen: 'ground', conservatory: 'ground',
  pantry: 'cellar', boiler: 'cellar', lab: 'cellar',
  storeroom: 'attic', study: 'attic',
}

export const FLOOR_ROOM: Record<Floor, RoomId> = { ground: 'foyer', cellar: 'boiler', attic: 'storeroom', outside: 'driveway' }

/** The title screen: the house seen from the road, the storm softened. */
export const TITLE_AMB: Amb = { rain: 0.6, lp: 4000, wind: 0.45, howl: 0.2, patter: 2, drips: 0, thunder: 0.9, tlp: 1800 }
/** The credits: the storm moving off. */
export const CREDITS_AMB: Amb = { rain: 0.35, lp: 3000, wind: 0.15, howl: 0, patter: 1, drips: 0, thunder: 0.4, tlp: 900 }

const RAIN = 0.12
const ROAR = 0.05
const WIND = 0.16
const HOWL = 3

export interface Storm {
  set(a: Amb, now: number): void
  tick(now: number, dt: number): void
  thunder(a: number, now: number): void
  stop(now: number): void
}

export function createStorm(k: Kit, out: AudioNode, start: number): Storm {
  let amb: Amb = TITLE_AMB
  let nextGust = start + 3
  const long = 1e5

  // Rain: white noise, highpassed, lowpassed per room.
  const rainSrc = K.noise(k, start, long)
  const rainHp = K.filt(k, 'highpass', 350)
  const rainLp = K.filt(k, 'lowpass', amb.lp, 0.5)
  const rainG = K.gain(k, 0)
  rainSrc.connect(rainHp)
  rainHp.connect(rainLp)
  rainLp.connect(rainG)
  rainG.connect(out)
  // The heavy low roar of rain on a big roof.
  const roarSrc = K.noise(k, start, long, 'brown')
  const roarLp = K.filt(k, 'lowpass', 500)
  const roarG = K.gain(k, 0)
  roarSrc.connect(roarLp)
  roarLp.connect(roarG)
  roarG.connect(out)
  // Wind: slow-moving bandpassed noise, and a whistle for chimneys and rafters.
  const windSrc = K.noise(k, start, long, 'white', 0.5)
  const windBp = K.filt(k, 'bandpass', 380, 1.1)
  const windG = K.gain(k, 0)
  const howlBp = K.filt(k, 'bandpass', 620, 14)
  const howlG = K.gain(k, 0)
  windSrc.connect(windBp)
  windBp.connect(windG)
  windG.connect(out)
  windSrc.connect(howlBp)
  howlBp.connect(howlG)
  howlG.connect(out)

  const sources = [rainSrc, roarSrc, windSrc]

  function set(a: Amb, now: number): void {
    amb = a
    rainG.gain.setTargetAtTime(RAIN * a.rain, now, 0.4)
    roarG.gain.setTargetAtTime(ROAR * a.rain, now, 0.4)
    rainLp.frequency.setTargetAtTime(a.lp, now, 0.3)
    windG.gain.setTargetAtTime(WIND * a.wind, now, 0.6)
    howlG.gain.setTargetAtTime(HOWL * a.howl * 0.06, now, 0.6)
  }

  function gust(now: number): void {
    const len = 2 + Math.random() * 3
    const peak = 1.6 + Math.random() * 1.4
    const f = 600 + Math.random() * 500
    windG.gain.setTargetAtTime(WIND * amb.wind * peak, now, len * 0.25)
    windG.gain.setTargetAtTime(WIND * amb.wind, now + len * 0.55, len * 0.3)
    windBp.frequency.setTargetAtTime(f, now, len * 0.25)
    windBp.frequency.setTargetAtTime(380, now + len * 0.55, len * 0.3)
    howlG.gain.setTargetAtTime(HOWL * amb.howl * peak * 0.3, now, len * 0.25)
    howlG.gain.setTargetAtTime(HOWL * amb.howl * 0.06, now + len * 0.55, len * 0.3)
    howlBp.frequency.setTargetAtTime(500 + Math.random() * 450, now, len * 0.35)
    nextGust = now + len + 3 + Math.random() * 8
  }

  function droplet(t: number): void {
    const n = K.noise(k, t, 0.03)
    const hp = K.filt(k, 'bandpass', 2500 + Math.random() * 3500, 2)
    const g = K.gain(k, 0)
    K.pluck(g.gain, t, 0.05 + Math.random() * 0.07, 0.001, 0.012 + Math.random() * 0.012)
    n.connect(hp)
    hp.connect(g)
    const p = K.panner(k, Math.random() * 1.6 - 0.8)
    g.connect(p)
    p.connect(out)
  }

  function leak(t: number): void {
    // A drop into a bucket or a puddle: a plink with a low plop under it.
    const m = 76 + Math.floor(Math.random() * 12)
    K.drip(k, out, m, t, 0.2, 0.5 + Math.random() * 0.4)
  }

  function tick(now: number, dt: number): void {
    if (now >= nextGust) gust(now)
    const ahead = now + 0.1
    if (amb.patter > 0 && Math.random() < amb.patter * dt) droplet(ahead + Math.random() * dt)
    if (amb.drips > 0 && Math.random() < amb.drips * dt) leak(ahead + Math.random() * dt)
  }

  function thunder(a: number, now: number): void {
    const s = K.clamp(a, 0.1, 1.2)
    const lvl = s * s * amb.thunder
    const t = now + 0.12 + (1.1 - Math.min(1, s)) * 2.4 + Math.random() * 0.3
    const pan = Math.random() * 1.2 - 0.6
    const bus = K.panner(k, pan)
    bus.connect(out)
    if (s > 0.62) {
      // The crack: a close strike tears the air.
      const cn = K.noise(k, t, 0.6)
      const cf = K.filt(k, 'bandpass', 3200, 0.8)
      cf.frequency.setValueAtTime(3200, t)
      cf.frequency.exponentialRampToValueAtTime(Math.max(500, amb.tlp * 0.6), t + 0.45)
      const cg = K.gain(k, 0)
      K.pluck(cg.gain, t, 0.42 * lvl * Math.min(1, amb.tlp / 1500), 0.004, 0.5)
      cn.connect(cf)
      cf.connect(cg)
      cg.connect(bus)
    }
    // The rumble: brown noise, darkening as it rolls, with a few swells.
    const len = 3 + s * 2.5
    const rn = K.noise(k, t, len + 0.3, 'brown')
    const rf = K.filt(k, 'lowpass', amb.tlp, 0.9)
    rf.frequency.setValueAtTime(amb.tlp, t)
    rf.frequency.exponentialRampToValueAtTime(Math.max(90, amb.tlp * 0.18), t + len)
    const rg = K.gain(k, 0)
    rg.gain.setValueAtTime(0, t)
    rg.gain.linearRampToValueAtTime(0.5 * lvl, t + 0.12 + Math.random() * 0.15)
    let x = t + 0.4
    while (x < t + len * 0.7) {
      rg.gain.linearRampToValueAtTime((0.22 + Math.random() * 0.3) * lvl, x)
      x += 0.3 + Math.random() * 0.6
    }
    rg.gain.exponentialRampToValueAtTime(0.0001, t + len)
    rn.connect(rf)
    rf.connect(rg)
    rg.connect(bus)
    if (s > 0.8) {
      // A sub-bass thump you feel more than hear.
      const o = K.osc(k, 'sine', 48, t, t + 1.4)
      o.frequency.exponentialRampToValueAtTime(30, t + 1.2)
      const og = K.gain(k, 0)
      K.pluck(og.gain, t, 0.28 * lvl, 0.03, 1.2)
      o.connect(og)
      og.connect(bus)
    }
  }

  function stop(now: number): void {
    for (const g of [rainG, roarG, windG, howlG]) g.gain.setTargetAtTime(0, now, 0.2)
    for (const s of sources) {
      try { s.stop(now + 1.5) } catch { /* already stopping */ }
    }
  }

  return { set, tick, thunder, stop }
}
