// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * The radio's contracts. Everything the composer, the conductor, the audio
 * player, the scene painter and the backend agree on lives here.
 *
 * The engine is plain TypeScript with erasable syntax only (no enums, no
 * parameter properties) and `.ts` import extensions, so Node runs it with
 * native type stripping (the backend validates Opus-composed landscapes with
 * it) and Vite bundles it unchanged.
 *
 * Time: a bar is 16 steps (sixteenths) in 4/4. A phrase is `phraseBars`
 * bars (8 by default). Pitches are MIDI numbers; pitch classes are 0..11
 * with C = 0.
 */

// ---- theory --------------------------------------------------------------

/** Diatonic modes on the brightness ladder, brightest first, plus harmonic minor. */
export type Mode =
  | 'lydian'
  | 'ionian'
  | 'mixolydian'
  | 'dorian'
  | 'aeolian'
  | 'phrygian'
  | 'harmonicMinor'

export interface Chord {
  /** Pitch class of the root. */
  root: number
  /** Pitch class of the bass note (differs from root for slash chords). */
  bass: number
  /** Semitones above the root, ascending, may exceed 12 (9ths). Always includes 0. */
  tones: number[]
  /** Display symbol, e.g. 'Dm9', 'Bbmaj7', 'Fsus2/C'. */
  symbol: string
  /** Roman-numeral-ish degree label for the display, e.g. 'i', 'bVI', 'V7'. */
  degree: string
}

export interface Key {
  tonic: number
  mode: Mode
}

// ---- layers and voices ---------------------------------------------------

/** One mixer channel each. The conductor fades them in and out. */
export type Layer =
  | 'ambience'
  | 'drone'
  | 'pad'
  | 'bass'
  | 'drums'
  | 'perc'
  | 'arp'
  | 'lead'
  | 'counter'
  | 'bells'

export const LAYERS: readonly Layer[] = [
  'ambience', 'drone', 'pad', 'bass', 'drums', 'perc', 'arp', 'lead', 'counter', 'bells',
]

/**
 * Pitched voices. Each is a synth patch in `engine/audio/voices.ts`.
 * The prefix is the family, not a restriction on which layer may use it.
 */
export type VoiceId =
  // leads
  | 'lead.square'   // two detuned squares, filter closes over the note: NES/Neon Shrine hero
  | 'lead.saw'      // two detuned saws, darker: the title-screen lead
  | 'lead.pulse'    // 25 % pulse, chip-like and thin
  | 'lead.ep'       // electric piano: fast decay to a soft sustain (Rhodes-ish, FM tine)
  | 'lead.hollow'   // breathy synth flute: soft triangles, slow swell
  | 'lead.fm'       // DX7-style FM lead/bell hybrid, glassy attack
  | 'lead.glide'    // mono saw with portamento between legato notes: synthwave solo
  | 'lead.whistle'  // sine with breath noise and vibrato: ocarina / whistle
  // mallets and plucks (lead or arp)
  | 'mallet.kalimba' // thumb piano: sine + inharmonic partial, short
  | 'mallet.marimba' // wooden bar: sine + 4th harmonic, soft resonant decay
  | 'pluck.harp'     // filtered noise burst into resonant tone: harp/koto-ish
  // arps
  | 'arp.square'    // chip arp
  | 'arp.pluck'     // saw through a resonant filter that snaps shut (the sequencer)
  | 'arp.warm'      // soft detuned analog
  | 'arp.glass'     // sine bells
  | 'arp.seq'       // Berlin-school sequence: resonant saw, filter cutoff follows `opts.cutoff` (0..1)
  // pads
  | 'pad.saw'       // detuned saw pad (Neon Shrine)
  | 'pad.strings'   // string machine: saws through an ensemble chorus (Solina)
  | 'pad.choir'     // formant-filtered 'aah' pad
  | 'pad.glass'     // FM glass pad, bright, slow shimmer
  | 'pad.warm'      // filtered triangles and saws, round and soft
  | 'pad.dark'      // low-passed detuned saws with slow tape wow
  // basses
  | 'bass.saw'
  | 'bass.square'
  | 'bass.round'    // triangle + sub sine
  | 'bass.sub'      // pure sub sine, felt more than heard
  | 'bass.pluck'    // synthwave 8ths: saw + square, fast filter envelope
  | 'bass.fm'       // DX bass, punchy
  // counter lines and bells
  | 'bell.glass'
  | 'bell.fm'       // tubular/FM bell with long tail
  | 'bell.chime'    // small high chime
  | 'counter.strings' // soft sustained string line
  | 'counter.soft'  // saw+triangle sustained line (Neon Shrine counter)
  // drones
  | 'drone.sub'     // root and fifth, sine + soft triangle, very low
  | 'drone.organ'   // drawbar-ish root+fifth+octave, slow tremolo
  | 'drone.shimmer' // high overtone cluster, slow beating

/** Drum kits: each maps the hit names below to a different synthesis. */
export type KitId =
  | 'kit.synthwave' // punchy kick, big gated snare, crisp hats, clap
  | 'kit.soft'      // lofi: round kick, soft snare, dusty hats, rim
  | 'kit.tribal'    // toms, congas, shaker, woodblock, deep kick
  | 'kit.brush'     // brushed snare swishes, soft kick, ride
  | 'kit.motorik'   // tight dry kick, tight snare, closed 16th hats
  | 'kit.heartbeat' // muffled low double-thump kick, almost no highs
  | 'kit.chip'      // NES noise-channel drums

/**
 * Drum hit names (one char, used in groove strings):
 *   k kick, s snare, c clap, h closed hat, o open hat, r ride/cymbal,
 *   p perc (shaker/conga/rim — the kit decides), t low tom, m mid tom,
 *   T high tom, x crash, z riser/reverse swell (starts at the step, lasts `len` steps)
 */
export type DrumHit = 'k' | 's' | 'c' | 'h' | 'o' | 'r' | 'p' | 't' | 'm' | 'T' | 'x' | 'z'

/** Background textures, each synthesised in `engine/audio/ambience.ts`. */
export type AmbienceId =
  | 'wind'        // low broadband wind, slow gusts (bandpassed brown noise)
  | 'wind.high'   // thin high whistling wind at altitude
  | 'birds'       // songbirds: short chirps and trills, daytime
  | 'birds.jungle' // exotic calls: whoops, long glissandi, parrots far away
  | 'insects'     // cicadas and crickets: pulsing high buzz
  | 'rain'        // steady rain hiss with close drops
  | 'rain.roof'   // rain on a car roof / tin: denser, duller, with drips
  | 'stream'      // babbling water
  | 'waves'       // sea swell, slow washes
  | 'gulls'       // distant gull cries
  | 'owl'         // occasional two-note hoot, far away
  | 'snow'        // hushed air, faint creaks, very quiet
  | 'fire'        // crackle and low roar
  | 'chimes'      // wind chimes, pentatonic in the current key
  | 'bell.distant' // a far church/village bell on the tonic, now and then
  | 'road'        // car interior: engine hum, tyre roar, slow pitch drift
  | 'passing'     // cars passing: doppler whooshes
  | 'city'        // distant city hum and far horns
  | 'radio'       // space radio: blips, beeps, short static bursts, key-aware tones
  | 'space.hum'   // deep sub rumble with slow beating
  | 'shimmer'     // high sparkles on scale tones

// ---- landscapes ----------------------------------------------------------

/**
 * A progression: space-separated chord tokens, each lasting `barsPerChord`
 * bars unless it carries a duration suffix `:n` (n bars; `:0.5` = half a bar).
 * The progression's total length must divide into whole bars and should be
 * 4 or 8 bars (it repeats to fill a phrase).
 *
 * Chord token grammar (all parts optional except the degree):
 *   [b|#]<1-7>[quality][ext][/<bass degree>][:<bars>]
 *   quality: M (major) m (minor) d (dim) s2 (sus2) s4 (sus4) 5 (power)
 *            — omitted = diatonic in the current mode, so the same
 *              progression darkens when the mood knob moves the mode.
 *   ext:     7, 9, 6, add9 (7 = the diatonic 7th of that chord)
 * Examples: '1 6 3 7', '1:2 4 5s4', 'b7M 1', '2m7 5 1add9:2', '4/1'
 */
export interface Progression {
  chords: string
  /** Default bars per chord token (1 or 2; 4 for very slow landscapes). */
  barsPerChord?: number
  /** Relative pick weight (default 1). */
  weight?: number
  /** Role: 'a' main, 'b' contrast, 'bridge' rare colour. Default 'a'. */
  role?: 'a' | 'b' | 'bridge'
}

/**
 * A groove: one 16-char string per hit. Chars: '.' rest, 'x' hit,
 * 'X' accent, 'g' ghost (quiet), '-' (only for 'z') hold.
 */
export type Groove = Partial<Record<DrumHit, string>>

export interface MelodySpec {
  voice: VoiceId
  /** Lowest and highest MIDI note. */
  range: [number, number]
  /** 0..1: how many of the available rhythmic slots get notes. */
  density: number
  /** 0..1: probability a move is a step rather than a leap. */
  stepwise: number
  /**
   * Rhythm vocabulary: 'long' (half and whole notes), 'straight' (8ths and
   * quarters), 'dotted' (dotted 8ths and quarters), 'syncopated' (off-beat
   * pushes), 'sixteenths' (busy runs).
   */
  rhythm: Array<'long' | 'straight' | 'dotted' | 'syncopated' | 'sixteenths'>
  /** Motif length in bars. */
  motifBars: 1 | 2
  /** 0..1: chance the lead sits out a phrase to let the music breathe. */
  rest: number
  /** Pentatonic filter: melody uses only the mode's pentatonic subset. */
  pentatonic?: boolean
  /**
   * Written themes. Each is one or two bars of eighth notes separated by
   * '|', eight tokens a bar: a scale degree 1–7 (' after it = an octave up,
   * , = an octave down), '-' holds, '.' rests. Example:
   * "1 - 5, 1 2 3 - 5 | 4 - 3 - 2 - . ."
   * The composer keeps the rhythm and the melodic shape and fits the notes
   * to whatever chord is under them, so a theme survives mode and chord
   * changes. Sections mostly state and vary these; without them the
   * composer invents motifs.
   */
  motifs?: string[]
}

export type ArpPattern = 'up' | 'down' | 'updown' | 'random' | 'broken' | 'pedal' | 'sequence'

export interface ArpSpec {
  voice: VoiceId
  pattern: ArpPattern
  /** 8 or 16 = eighths or sixteenths; 4 = quarters. Index by intensity 0..4. */
  rate: [4 | 8 | 16, 4 | 8 | 16, 4 | 8 | 16, 4 | 8 | 16, 4 | 8 | 16]
  /** 1 or 2 octaves of chord tones. */
  octaves: 1 | 2
  /** Base register: the lowest MIDI note the arp starts from. */
  low: number
  /** 'sequence' only: scale-degree offsets from the chord root, one per step, cycling. */
  sequence?: number[]
}

export interface BassSpec {
  voice: VoiceId
  /**
   * One 16-char pattern per intensity 0..4. Chars:
   *   R root, O root +12, 5 fifth, 3 chord third, 7 chord seventh,
   *   a approach (scale step into the next chord's root; chromatic if 'chromatic' is set),
   *   - hold, . rest.
   * An empty string = no bass at that intensity.
   */
  patterns: [string, string, string, string, string]
  /** Octave of the root: MIDI of C in that octave (36 = C2, default). */
  octave?: number
  chromaticApproach?: boolean
}

export interface DrumSpec {
  kit: KitId
  /** One groove per intensity 0..4; empty object = no drums. */
  grooves: [Groove, Groove, Groove, Groove, Groove]
  /** Fill that replaces the last bar of a phrase (when a fill is due). */
  fill: Groove
  /** Perc-layer groove (shakers, congas) per intensity; plays on the 'perc' layer. */
  perc?: [Groove, Groove, Groove, Groove, Groove]
}

export interface FxSpec {
  /** 0..1 send levels at the default Space setting. */
  reverb: number
  delay: number
  /** Reverb tail length in seconds (1.5 small room … 8 vast). */
  reverbSize: number
  /** Master low-pass tone 0 (dark) .. 1 (open). */
  tone: number
  /** 0..1 tape saturation and wow at the default Grit setting. */
  grit: number
  /** Kick ducks pads and drones this much (0..1): the synthwave pump. */
  pump?: number
}

export interface Landscape {
  id: string
  name: string
  /** One line for the picker. */
  blurb: string
  /** Pitch class of home. */
  tonic: number
  /**
   * Modes the mood knob moves between, brightest first. The first entry is
   * used at mood 0, the last at mood 1. One entry = the knob only tints
   * voicings and filters.
   */
  moods: Mode[]
  /** Default mood 0..1. */
  mood: number
  bpm: number
  /** 0..0.5 of a sixteenth: delay of the off-beat sixteenths. */
  swing: number
  /** Bars per phrase: 8 (default) or 4. */
  phraseBars?: 4 | 8
  progressions: Progression[]
  /** 0..1: chance to add a diatonic 7th to a chord without one; 9ths at half that. */
  color: number
  pad: { voice: VoiceId }
  drone?: { voice: VoiceId }
  bass: BassSpec
  arp?: ArpSpec
  lead?: MelodySpec
  counter?: { voice: VoiceId; style: 'guide' | 'answer' }
  bells?: { voice: VoiceId; density: number }
  drums: DrumSpec
  /**
   * The layers present at each intensity 0..4 (ambience is always on).
   * Must grow monotonically: every layer at level n is also at n+1.
   */
  layers: [Layer[], Layer[], Layer[], Layer[], Layer[]]
  fx: FxSpec
  /** Ambience textures and their levels 0..1 at intensity 0; they thin out a little as intensity rises. */
  ambience: Partial<Record<AmbienceId, number>>
  /** Accent colour for the UI (hex). */
  accent: string
  /** Which painted scene shows it (a built-in landscape id); defaults to `id`. */
  scene?: string
  /** Where it came from: 'builtin' or 'opus' (composed on request). */
  origin?: 'builtin' | 'opus'
  /** For Opus-composed landscapes: the request it was composed from. */
  prompt?: string
}

// ---- controls ------------------------------------------------------------

/** What the listener sets. The conductor moves the music toward it. */
export interface Controls {
  landscape: string
  /** 0 still, 1 drift, 2 cruise, 3 drive, 4 surge. */
  intensity: 0 | 1 | 2 | 3 | 4
  /** 0 bright .. 1 dark: moves along the landscape's moods at phrase boundaries. */
  mood: number
  /** 0 dry .. 1 vast: reverb and delay (glides). */
  space: number
  /** 0 clean .. 1 worn tape (glides). */
  grit: number
  /** 0 sparse .. 1 busy: note density, arp rate, ghost notes (phrase boundaries). */
  density: number
  /** Tempo nudge in bpm, -20..+20 (glides over a phrase). */
  tempo: number
  /** Keep: freeze the current progression and motif, loop the section. */
  hold: boolean
}

export const DEFAULT_CONTROLS: Controls = {
  landscape: 'coast',
  intensity: 2,
  mood: 0.5,
  space: 0.5,
  grit: 0.3,
  density: 0.5,
  tempo: 0,
  hold: false,
}

// ---- what the conductor hands the player, one bar at a time --------------

export interface NoteEvent {
  layer: Layer
  voice: VoiceId
  midi: number
  /** Step 0..15 within the bar (fractional allowed for triplets). */
  step: number
  /** Length in steps (may run past the bar end). */
  len: number
  /** 0..1 */
  vel: number
  /** -1..1, default 0. */
  pan?: number
  /** Voice-specific extras (e.g. arp.seq cutoff 0..1, lead.glide legato). */
  opts?: { cutoff?: number; legato?: boolean }
}

export interface DrumEvent {
  layer: 'drums' | 'perc'
  kit: KitId
  hit: DrumHit
  step: number
  vel: number
  /** Only for 'z' (riser): length in steps. */
  len?: number
}

export interface LayerMix {
  /** Target gain 0..1 for this layer (1 = the landscape's normal level). */
  gain: number
  /** How long the move to `gain` takes, in bars (0 = at the bar start). */
  fadeBars: number
}

export interface FxState {
  reverb: number
  delay: number
  reverbSize: number
  tone: number
  grit: number
  pump: number
  /** Stereo width 0..1. */
  width: number
}

/** A chord span inside one bar. */
export interface ChordSpan {
  from: number
  len: number
  chord: Chord
}

export interface TransitionInfo {
  /** 'intensity' | 'landscape' | 'mood' | 'none' */
  kind: 'intensity' | 'landscape' | 'mood' | 'none'
  from: string
  to: string
  /** 0..1 progress through the whole planned transition at the start of this bar. */
  progress: number
  /** Human-readable, e.g. 'pivot on Em · marimba in 2 bars'. */
  note: string
}

export interface BarPlan {
  /** Absolute bar counter since start. */
  index: number
  /** Tempo at the start and end of the bar (linear glide between). */
  bpmStart: number
  bpmEnd: number
  swing: number
  chords: ChordSpan[]
  key: Key
  /** Pitch classes of the current scale (for key-aware ambience). */
  scale: number[]
  notes: NoteEvent[]
  drums: DrumEvent[]
  /** Per-layer mix targets; a layer missing here keeps its previous target. */
  mix: Partial<Record<Layer, LayerMix>>
  fx: FxState
  /** Target levels of each texture, reached over `ambienceFadeBars`. */
  ambience: Partial<Record<AmbienceId, number>>
  ambienceFadeBars: number
  /** For the display and the scene. */
  meta: {
    landscape: string
    /** Scene crossfade: from → to, with blend at the start and end of the bar. */
    scene: { from: string; to: string; blendStart: number; blendEnd: number }
    phraseBar: number
    phraseBars: number
    section: string
    /** Layers sounding this bar (gain > 0). */
    active: Layer[]
    /** Layers scheduled to enter, and in how many bars. */
    upcoming: Array<{ layer: Layer; inBars: number }>
    transition: TransitionInfo
    intensity: number
    /** The next bar's first chord, for 'next chord' in the display. */
    nextChord?: string
  }
}

/** What the conductor exposes to the player. */
export interface ConductorLike {
  /** Plan the next bar. Called once per bar, about a bar ahead of time at most. */
  nextBar(): BarPlan
  /** Set the listener's controls; takes effect at musically sensible points. */
  setControls(c: Partial<Controls>): void
  readonly controls: Controls
}

// ---- what the player hands the page -------------------------------------

/** Cheap to read every animation frame. */
export interface VisualState {
  /** The bar sounding now (null before the first bar). */
  bar: BarPlan | null
  /** Position in the sounding bar, 0..16 (fractional). */
  step: number
  /** Scene crossfade at this moment: from → to, blend 0..1. */
  scene: { from: string; to: string; blend: number }
  /** 1 on a kick, decaying to 0 over about a beat. */
  beat: number
  /** Current audible level of each layer, 0..1 (mix gain × recent activity). */
  levels: Record<Layer, number>
  /** Notes that started in the last ~2 s, newest last (max 24). `age` in seconds. */
  recent: Array<{ layer: Layer; midi: number; age: number }>
  /** Seconds since start (audio clock). */
  time: number
  playing: boolean
}

export interface RadioPlayer {
  /** Create or resume the AudioContext (call from a user gesture) and start scheduling. */
  start(): Promise<void>
  /** Fade out over ~1 s, then suspend. The conductor keeps its state. */
  stop(): void
  readonly playing: boolean
  /** Master volume 0..1. */
  setVolume(v: number): void
  visual(): VisualState
  /** Fires when a bar starts sounding (aligned to the audio clock). Returns an unsubscribe. */
  onBar(cb: (plan: BarPlan) => void): () => void
  readonly context: AudioContext | null
  /**
   * The master output as a MediaStream, for an <audio> element: keeps iOS
   * playing with the screen locked and gives the OS media controls a source.
   */
  readonly stream: MediaStream | null
  /**
   * Where the sound goes. 'speakers' (default): the AudioContext's own
   * output. 'stream': only `stream` carries it (the page plays it through an
   * <audio> element), so the music is not heard twice.
   */
  setOutput(mode: 'speakers' | 'stream'): void
}

// ---- feedback (backend) --------------------------------------------------

/** What a thumbs up/down captures, so a review can find the moment again. */
export interface FeedbackSnapshot {
  landscape: string
  controls: Controls
  bar: number
  key: string
  chords: string[]
  section: string
  seed: number
  engineVersion: string
  /** Active layers and voices when the button was pressed. */
  active: Layer[]
  transition: TransitionInfo['kind']
}

export interface Feedback {
  id?: number
  at?: string
  /** 1 up, -1 down, 0 comment only. */
  rating: 1 | -1 | 0
  comment: string
  snapshot: FeedbackSnapshot
}
