/**
 * The intro, the midnight strike and the finale. Placeholder.
 */
import type { Handler } from '../types'

export const intro: Handler = function* (c) {
  yield c.card('A dark and stormy night. The coast road.', 2.5)
  yield c.say('Brunhilde. Not tonight. Please not tonight.')
}

/** USE clock key on the grandfather clock (foyer): the midnight strike. */
export const midnight: Handler = function* (c) {
  yield c.sfx('clock-wind')
  yield c.say('The clock strikes twelve. Nothing happens. (The finale is not written yet.)')
}
