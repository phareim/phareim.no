/**
 * Every sound effect name a script may use with `c.sfx(name)`. audio.ts
 * has a recipe for each; tests check that content only uses these.
 */
export const SFX = [
  // doors, things
  'door', 'door-locked', 'creak', 'drawer', 'cupboard', 'pickup', 'drop', 'key-turn', 'lock-rattle',
  'trunk-roll', 'trunk-thud', 'window-open', 'hatch', 'dumbwaiter', 'bell',
  // the house
  'clock-tick', 'clock-chime', 'clock-wind', 'pipes-knock', 'furnace-whoosh', 'fire-crackle', 'match-strike', 'match-fizzle',
  'paper-rip', 'jar-pop', 'glug', 'rust-squeal', 'rod-clang', 'spark', 'zap', 'machine-hum', 'machine-charge', 'lever-clunk',
  'booth-door', 'radio-static', 'radio-voice', 'piano-plonk', 'phone-jingle', 'gramophone', 'splash', 'drip', 'thud', 'squeak',
  'slurp', 'burp', 'chomp', 'snore', 'munch',
  // people
  'emf', 'bones-rattle', 'bones-collapse', 'ghost-woo', 'ghost-gasp', 'cat-meow', 'cat-hiss', 'cat-purr', 'bat-flap', 'bat-squeak',
  'plant-snap', 'plant-hrrm', 'poof', 'magic', 'fanfare',
  // the car
  'car-click', 'car-start', 'car-cough', 'car-horn', 'bonnet',
] as const

export type SfxName = (typeof SFX)[number]

/** Music cues a script may force with `c.music(name)`; 'auto' goes back to the floor's theme. */
export const MUSIC = ['auto', 'title', 'intro', 'seance', 'tension', 'finale', 'credits'] as const
