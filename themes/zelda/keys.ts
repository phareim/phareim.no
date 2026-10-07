/**
 * The names of the buttons, as the player's device shows them. Dialog lines
 * and hints carry {A}, {B} and {CYCLE}; `subst` puts the names in. Pure.
 */
export interface HudKeys { a: string; b: string; cycle: string; touch?: boolean }

export const KEYBOARD_KEYS: HudKeys = { a: 'SPACE', b: 'K', cycle: 'Q' }
/** The touch deck's buttons carry pictures, no letters: the lines name the picture. */
export const TOUCH_KEYS: HudKeys = { a: 'THE SWORD BUTTON', b: 'THE ITEM BUTTON', cycle: 'THE SWAP BUTTON', touch: true }

export function subst(text: string, k: HudKeys): string {
  return text.replace(/\{A\}/g, k.a).replace(/\{B\}/g, k.b).replace(/\{CYCLE\}/g, k.cycle)
}
