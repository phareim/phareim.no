/**
 * Player names for the Hall of Fame: one 80s/tech word and one animal, so
 * a name reads as something distinct and joyful — NEON OTTER, MODEM WALRUS,
 * FLUX CAPYBARA. A name is generated in the browser when a player first
 * enters the leaderboard (each browser is its own player), and rerolled on
 * request. The server validates a submitted name against these same lists,
 * so the board can only ever hold names of this shape.
 *
 * Plain TS with no runtime imports: shared by the theme, the composable,
 * the Nitro API and tests/leaderboard-names.test.mjs.
 */

export const FIRST_WORDS = [
  'Neon', 'Laser', 'Turbo', 'Synth', 'Pixel', 'Modem', 'Vector', 'Chrome',
  'Retro', 'Cassette', 'Arcade', 'Disco', 'VHS', 'Floppy', 'Cyber', 'Hologram',
  'Glitch', 'Mega', 'Ultra', 'Plasma', 'Sonic', 'Techno', 'Cosmic', 'Astro',
  'Robo', 'Byte', 'Nova', 'Photon', 'Vapor', 'Voltage', 'Static', 'Groove',
  'Boombox', 'Walkman', 'Joystick', 'Pager', 'Radical', 'Gnarly', 'Rewind', 'Stereo',
  'Polaroid', 'Hyper', 'Quantum', 'Pinball', 'Mixtape', 'Betamax', 'Cathode', 'Vinyl',
  'Outrun', 'Warp', 'Bionic', 'Atomic', 'Electro', 'Funky', 'Tubular', 'Gigawatt',
  'Overdrive', 'Nitro', 'Flux', 'Midnight', 'Sunset', 'Cobalt', 'Magenta', 'Dialup',
] as const

export const SECOND_WORDS = [
  'Otter', 'Capybara', 'Ferret', 'Walrus', 'Axolotl', 'Lemur', 'Wombat', 'Puffin',
  'Gecko', 'Narwhal', 'Ocelot', 'Pangolin', 'Quokka', 'Tapir', 'Yak', 'Llama',
  'Mongoose', 'Manatee', 'Ibex', 'Heron', 'Falcon', 'Badger', 'Lynx', 'Marmot',
  'Newt', 'Orca', 'Panda', 'Raccoon', 'Sloth', 'Toucan', 'Viper', 'Wolf',
  'Fox', 'Moose', 'Koala', 'Kiwi', 'Dingo', 'Cobra', 'Bison', 'Beetle',
  'Hedgehog', 'Platypus', 'Penguin', 'Flamingo', 'Iguana', 'Jaguar', 'Meerkat', 'Octopus',
  'Pelican', 'Salamander', 'Seahorse', 'Tortoise', 'Weasel', 'Wolverine', 'Alpaca', 'Armadillo',
  'Chinchilla', 'Dolphin', 'Gibbon', 'Hamster', 'Jackal', 'Macaw', 'Numbat', 'Ostrich',
  'Piranha', 'Reindeer', 'Stingray', 'Tarsier', 'Warthog', 'Zebra', 'Mantis', 'Gopher',
] as const

const firstSet = new Set<string>(FIRST_WORDS)
const secondSet = new Set<string>(SECOND_WORDS)

/** How many distinct names the two lists can make. */
export const NAME_SPACE = FIRST_WORDS.length * SECOND_WORDS.length

/** A random "First Second" name, title case, single space. */
export function randomName(rng: () => number = Math.random): string {
  const a = FIRST_WORDS[Math.floor(rng() * FIRST_WORDS.length)]
  const b = SECOND_WORDS[Math.floor(rng() * SECOND_WORDS.length)]
  return `${a} ${b}`
}

/** A random name different from `current` (unless the lists only allow one). */
export function rerollName(current: string, rng: () => number = Math.random): string {
  for (let i = 0; i < 8; i++) {
    const n = randomName(rng)
    if (n !== current) return n
  }
  return randomName(rng)
}

/** True for exactly the strings randomName() can produce. */
export function isValidName(name: unknown): name is string {
  if (typeof name !== 'string') return false
  const parts = name.split(' ')
  return parts.length === 2 && firstSet.has(parts[0]) && secondSet.has(parts[1])
}
