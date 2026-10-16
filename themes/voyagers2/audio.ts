/**
 * Space Voyagers II: the one-shots, made by Web Audio from oscillators and
 * noise (DESIGN.md, "Sound"). The site's radio is the music; this is the
 * guns, the hits, the lock tone, the klaxon, the decoy, the afterburner, the
 * CB click when someone talks, and the autopilot's tape.
 *
 * One context, made at the first `start()` (inside the gesture that starts a
 * sortie) and asked to run again by every later gesture: iOS may leave a
 * context made after an awaited chunk suspended (`canvas-game-phone-checks`).
 * Nothing here throws.
 */

export const SFX_NAMES = [
  'gun', 'turret', 'enemyGun', 'shieldHit', 'armourHit', 'boom', 'bigBoom', 'lockOn', 'locked', 'missile',
  'klaxon', 'decoy', 'cb', 'auto', 'swap', 'hitUs',
] as const
export type Sfx = typeof SFX_NAMES[number]

export interface VoyagerAudio {
  start(): boolean
  wake(): void
  play(s: Sfx, gain?: number): void
  /** The afterburner's roar, on while burning. */
  burn(on: boolean): void
  /** The engine's hum, pitched by speed (0..1). */
  engine(level: number): void
  mute(m: boolean): void
  dispose(): void
}

export function createVoyagerAudio(): VoyagerAudio {
  let ac: AudioContext | null = null
  let out: GainNode | null = null
  let noise: AudioBuffer | null = null
  let roar: { src: AudioBufferSourceNode; gain: GainNode } | null = null
  let hum: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null
  let muted = false
  const last = new Map<Sfx, number>()

  function wake(): void {
    if (!ac || ac.state === 'running' || ac.state === 'closed') return
    try { ac.resume().catch(() => {}) } catch { /* the next gesture asks again */ }
  }

  function start(): boolean {
    if (ac) { wake(); return true }
    try {
      const Ctor = typeof window !== 'undefined' ? (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) : null
      if (!Ctor) return false
      ac = new Ctor()
      out = ac.createGain()
      out.gain.value = muted ? 0 : 0.55
      out.connect(ac.destination)
      noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
      const d = noise.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      wake()
      return true
    } catch {
      ac = null
      return false
    }
  }

  function tone(type: OscillatorType, f0: number, f1: number, t: number, gain: number, delay = 0): void {
    if (!ac || !out) return
    const at = ac.currentTime + delay
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = type
    o.frequency.setValueAtTime(f0, at)
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + t)
    g.gain.setValueAtTime(gain, at)
    g.gain.exponentialRampToValueAtTime(0.001, at + t)
    o.connect(g)
    g.connect(out)
    o.start(at)
    o.stop(at + t + 0.02)
  }

  function hiss(t: number, gain: number, freq: number, q = 1, delay = 0, type: BiquadFilterType = 'bandpass'): void {
    if (!ac || !out || !noise) return
    const at = ac.currentTime + delay
    const s = ac.createBufferSource()
    s.buffer = noise
    const f = ac.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ac.createGain()
    g.gain.setValueAtTime(gain, at)
    g.gain.exponentialRampToValueAtTime(0.001, at + t)
    s.connect(f)
    f.connect(g)
    g.connect(out)
    s.start(at, Math.random() * 0.5)
    s.stop(at + t + 0.02)
  }

  /** Least seconds between two of the same sound. */
  const GAP: Partial<Record<Sfx, number>> = { gun: 0.06, turret: 0.07, enemyGun: 0.09, shieldHit: 0.05, armourHit: 0.05, lockOn: 0.4, klaxon: 0.6, cb: 0.25, hitUs: 0.08 }

  function play(s: Sfx, gain = 1): void {
    if (!ac || muted) return
    const now = ac.currentTime
    const gap = GAP[s] ?? 0
    if (now - (last.get(s) ?? -9) < gap) return
    last.set(s, now)
    try {
      switch (s) {
        case 'gun': // a valve's thump and a zap
          tone('square', 520, 140, 0.09, 0.07 * gain)
          tone('sine', 120, 60, 0.08, 0.12 * gain)
          break
        case 'turret':
          tone('square', 900, 300, 0.06, 0.05 * gain)
          break
        case 'enemyGun':
          tone('sawtooth', 380, 160, 0.08, 0.03 * gain)
          break
        case 'shieldHit': // a ring
          tone('triangle', 1400, 900, 0.18, 0.06 * gain)
          tone('triangle', 2100, 1500, 0.12, 0.03 * gain)
          break
        case 'armourHit': // a crunch
          hiss(0.12, 0.2 * gain, 900, 0.8)
          tone('square', 180, 70, 0.1, 0.05 * gain)
          break
        case 'hitUs':
          hiss(0.16, 0.3 * gain, 500, 0.7)
          tone('sawtooth', 110, 50, 0.18, 0.08 * gain)
          break
        case 'boom':
          hiss(0.7, 0.45 * gain, 500, 0.5, 0, 'lowpass')
          tone('sine', 90, 30, 0.6, 0.25 * gain)
          // The mascot's spring.
          tone('triangle', 300, 900, 0.25, 0.04 * gain, 0.12)
          break
        case 'bigBoom':
          hiss(1.8, 0.6 * gain, 300, 0.4, 0, 'lowpass')
          tone('sine', 60, 22, 1.6, 0.35 * gain)
          break
        case 'lockOn': // the tone that rises while the brackets close
          tone('square', 700, 900, 0.07, 0.035 * gain)
          break
        case 'locked': // and sings when they meet
          tone('square', 1200, 1200, 0.35, 0.04 * gain)
          tone('square', 1800, 1800, 0.35, 0.02 * gain)
          break
        case 'missile':
          hiss(0.6, 0.25 * gain, 2200, 0.6, 0, 'highpass')
          tone('sawtooth', 200, 600, 0.4, 0.04 * gain)
          break
        case 'klaxon':
          tone('square', 620, 620, 0.16, 0.05 * gain)
          tone('square', 480, 480, 0.16, 0.05 * gain, 0.18)
          break
        case 'decoy': // a thunk
          tone('sine', 220, 90, 0.12, 0.2 * gain)
          hiss(0.08, 0.1 * gain, 1500, 1)
          break
        case 'cb': // the CB's click and squelch
          tone('square', 2400, 2400, 0.012, 0.05 * gain)
          hiss(0.09, 0.08 * gain, 2600, 2, 0.015)
          break
        case 'auto': // a tape rewinding
          tone('sawtooth', 300, 1600, 0.9, 0.025 * gain)
          hiss(0.9, 0.05 * gain, 3000, 1.5)
          break
        case 'swap':
          tone('triangle', 440, 660, 0.1, 0.05 * gain)
          tone('triangle', 660, 440, 0.1, 0.05 * gain, 0.12)
          break
      }
    } catch {
      // A sound that fails is a sound not heard.
    }
  }

  function burn(on: boolean): void {
    if (!ac || !out || !noise) return
    try {
      if (on && !roar) {
        const src = ac.createBufferSource()
        src.buffer = noise
        src.loop = true
        const f = ac.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = 700
        const gain = ac.createGain()
        gain.gain.setValueAtTime(0.0001, ac.currentTime)
        gain.gain.exponentialRampToValueAtTime(muted ? 0.0001 : 0.16, ac.currentTime + 0.15)
        src.connect(f)
        f.connect(gain)
        gain.connect(out)
        src.start()
        roar = { src, gain }
      } else if (!on && roar) {
        const r = roar
        roar = null
        r.gain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.08)
        r.src.stop(ac.currentTime + 0.4)
      }
    } catch { /* quiet */ }
  }

  function engine(level: number): void {
    if (!ac || !out) return
    try {
      if (!hum) {
        const osc = ac.createOscillator()
        osc.type = 'sawtooth'
        const filter = ac.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 220
        const gain = ac.createGain()
        gain.gain.value = 0
        osc.connect(filter)
        filter.connect(gain)
        gain.connect(out)
        osc.start()
        hum = { osc, gain, filter }
      }
      const t = ac.currentTime
      hum.osc.frequency.setTargetAtTime(38 + level * 30, t, 0.2)
      hum.filter.frequency.setTargetAtTime(160 + level * 260, t, 0.2)
      hum.gain.gain.setTargetAtTime(muted || level <= 0 ? 0 : 0.035, t, 0.3)
    } catch { /* quiet */ }
  }

  return {
    start,
    wake,
    play,
    burn,
    engine,
    mute(m) {
      muted = m
      if (out && ac) out.gain.setTargetAtTime(m ? 0 : 0.55, ac.currentTime, 0.05)
    },
    dispose() {
      try {
        burn(false)
        hum?.osc.stop()
        ac?.close().catch(() => {})
      } catch { /* gone */ }
      ac = null
      hum = null
    },
  }
}
