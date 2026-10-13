/**
 * Space Voyagers: the part of each 64 x 64 portrait the narrow console band shows. Its window is
 * 40 x 40, and the middle of a portrait is often not the face (Mei, Nova and Rex look in from the
 * right, Ridley's cat sits at the left edge), so each has its own origin, chosen by looking at
 * the file so that the eyes and the mouth are in the window. One entry per speaker, and one per
 * mood where the head sits elsewhere. `scripts/galaga-lab/crops.mjs` draws all of them in one sheet.
 */
export const BAND_CROP: Record<string, readonly [number, number]> = {
  babs: [13, 12],
  'barton-calm': [14, 8],
  'barton-shout': [14, 6],
  cal: [10, 11],
  'duckie-calm': [13, 9],
  'duckie-shout': [11, 9],
  'duo-grin': [12, 6],
  'duo-sweat': [12, 7],
  'durant-angry': [13, 12],
  'durant-calm': [9, 9],
  fader: [12, 6],
  'humdinger-angry': [12, 14],
  'humdinger-calm': [8, 8],
  'knight-angry': [6, 8],
  'knight-calm': [11, 8],
  'lena-calm': [12, 11],
  'lena-stern': [10, 12],
  'marge-calm': [11, 9],
  'marge-spooky': [12, 10],
  'mei-calm': [20, 14],
  'mei-excited': [20, 13],
  nova: [22, 12],
  'rex-cheerful': [24, 5],
  'rex-eating': [24, 18],
  'rex-sheepish': [24, 13],
  'rex-worried': [22, 12],
  'ridley-calm': [3, 14],
  'ridley-grim': [3, 15],
}

/** The middle, for a face the table does not know. */
const MIDDLE: readonly [number, number] = [12, 12]

/** Where the band's 40 x 40 window begins in `portrait-<who>-<mood>`. */
export function bandCrop(who: string, mood: string): readonly [number, number] {
  return BAND_CROP[`${who}-${mood}`] ?? BAND_CROP[who] ?? MIDDLE
}
