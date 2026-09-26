/**
 * Names in Mini World: the rule for a person's name (typed by a child),
 * the six-letter codes for friends and neighbourhoods, generated
 * neighbourhood names and the workshop's weapon names.
 */
import { MAX_NAME, type WeaponBaseId, type WeaponMagicId } from '../types'
import { weaponBase, weaponMagic } from '../catalog'
import { pick, type Rng } from './rng'

// ---------------------------------------------------------------- person names

/** Letters a name may hold besides A–Z: Norwegian, and the accents the pixel font can draw (it maps them). */
const NAME_CHARS = /^[A-Za-zÆØÅæøåÄÖÜäöüÉÈéè\- ]+$/

/**
 * A person's name as it will be stored: trimmed, inner spaces collapsed,
 * 1–12 characters of letters, space and hyphen. Anything else → null.
 */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (!s || [...s].length > MAX_NAME) return null
  if (!NAME_CHARS.test(s)) return null
  if (!/[^\- ]/.test(s)) return null
  return s
}

// ---------------------------------------------------------------- codes

/** Code letters: no I, O or Q (they look like 1, 0 and O), no digits. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPRSTUVWXYZ'
export const CODE_LENGTH = 6
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`)

export function randomCode(rng: Rng = Math.random): string {
  let s = ''
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)]
  return s
}

/** A typed code, uppercased and without spaces; null if it cannot be a code. */
export function cleanCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.toUpperCase().replace(/[\s-]/g, '')
  return CODE_RE.test(s) ? s : null
}

export const isCode = (s: unknown): s is string => typeof s === 'string' && CODE_RE.test(s)

// ---------------------------------------------------------------- neighbourhood names

/**
 * First parts, each a noun that compounds straight onto every place below
 * ("Solsikke" + "dalen"). Kept to words a seven-year-old knows.
 */
export const HOOD_FIRST = [
  'Solsikke', 'Regnbue', 'Stjerne', 'Jordbær', 'Blåbær', 'Måne', 'Sol', 'Sommerfugl',
  'Eple', 'Kirsebær', 'Hjerte', 'Snø', 'Blomster', 'Enhjørning', 'Glitter', 'Sukker',
  'Kanin', 'Ekorn', 'Karamell', 'Lykke', 'Drage', 'Tulipan', 'Bringebær', 'Perle',
  'Sjokolade', 'Vanilje', 'Kløver', 'Lavendel',
] as const

/** Places with the definite ending, so the name reads as one place. */
export const HOOD_PLACE = [
  'dalen', 'bakken', 'stien', 'lia', 'åsen', 'haugen', 'skogen', 'vika', 'tunet', 'enga', 'bukta', 'toppen',
] as const

export function hoodName(rng: Rng = Math.random): string {
  return pick(rng, HOOD_FIRST) + pick(rng, HOOD_PLACE)
}

// ---------------------------------------------------------------- weapons

/** "Boble-blaster", "Stjerne-tryllestav", "Drage-sverd": magic, hyphen, base in lowercase. */
export function weaponName(base: WeaponBaseId, magic: WeaponMagicId): string {
  const b = weaponBase(base)?.name ?? base
  const m = weaponMagic(magic)?.name ?? magic
  return `${m}-${b.toLowerCase()}`
}
