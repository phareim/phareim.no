/**
 * Soft hyphens for item names in narrow tiles. The pixel font is wide
 * (16 px ≈ 12 px a letter), so "Prinsessekjole" cannot fit a phone tile,
 * and browsers do not hyphenate Norwegian reliably: without help the name
 * breaks at whatever letter hits the edge ("FOTBALLD / RAKT"). This puts
 * U+00AD between the parts of a compound, and between syllables of a
 * long part, so a break lands where a reader expects it.
 */

/** Word endings that start a new compound part (longest first when matched). */
const HEADS = [
  'kjole', 'genser', 'drakt', 'jakke', 'skjorte', 'singlet', 'bukse', 'shorts', 'skjørt', 'tights', 'topp',
  'sko', 'støvler', 'skøyter', 'hatt', 'krone', 'tiara', 'krans', 'ører', 'hjelm', 'horn', 'sløyfe',
  'briller', 'maske', 'sekk', 'hale', 'kappe', 'vinger', 'pakke', 'seng', 'sofa', 'stol', 'bord', 'hylle',
  'benk', 'skap', 'kar', 'hus', 'kule', 'kurv', 'plante', 'lampe', 'teppe', 'vase', 'kake', 'bolle',
  'maleri', 'speil', 'slynge', 'pokal', 'gulv', 'fliser', 'tapet', 'himmel', 'stav', 'sverd', 'hammer',
  'blaster', 'sekk', 'line', 'spill', 'tårnet', 'jakt', 'visning', 'butikken', 'parken', 'gata', 'dalen',
].sort((a, b) => b.length - a.length)

const VOWEL = /[aeiouyæøåéèäöü]/i
const SHY = '\u00AD'

/** Longest part that still fits a phone tile line. */
const MAX_PART = 5

function splitCompound(word: string): string[] {
  const lower = word.toLowerCase()
  for (const h of HEADS) {
    if (lower.length - h.length >= 3 && lower.endsWith(h)) {
      const cut = word.length - h.length
      return [...splitCompound(word.slice(0, cut)), word.slice(cut)]
    }
  }
  return [word]
}

/** Splits a long part between two consonants nearest its middle (VC-CV), else before a lone consonant (V-CV). */
function splitSyllables(part: string): string[] {
  if (part.length <= MAX_PART) return [part]
  const mid = part.length / 2
  let best = -1
  for (let i = 2; i <= part.length - 2; i++) {
    const a = part[i - 1]!, b = part[i]!
    const vc = !VOWEL.test(a) && !VOWEL.test(b) && VOWEL.test(part[i - 2]!) && VOWEL.test(part[i + 1] ?? '')
    const v_cv = VOWEL.test(a) && !VOWEL.test(b) && VOWEL.test(part[i + 1] ?? '')
    if ((vc || v_cv) && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i
  }
  if (best < 0) return [part]
  return [...splitSyllables(part.slice(0, best)), ...splitSyllables(part.slice(best))]
}

/** The name with soft hyphens at compound and syllable breaks; short words untouched. */
export function shy(name: string): string {
  return name
    .split(/(\s+|-)/)
    .map(w => (w.length <= MAX_PART || /\s|-/.test(w) ? w : splitCompound(w).flatMap(splitSyllables).join(SHY)))
    .join('')
}
