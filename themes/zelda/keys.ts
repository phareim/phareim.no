/**
 * The names of the buttons, as the player's device shows them. Dialog lines
 * and hints carry {A}, {B}, {CYCLE} and {ROLL}; `subst` puts the names in. Pure,
 * and all a painter reads of the keys: which key does what is `bindings.ts`.
 */
/** The menu's keys, by what they open or switch. */
export interface MenuKeys { items: string; moves: string; map: string; log: string; keys: string; view: string; sound: string; town: string }

export interface HudKeys { a: string; b: string; cycle: string; roll?: string; touch?: boolean; menu?: MenuKeys }

/** The names of the keys as they are before a player changes any (`bindings.ts` `keyboardKeys()` says them as they are now). */
export const KEYBOARD_KEYS: HudKeys & { menu: MenuKeys } = {
  a: 'SPACE', b: 'K', cycle: 'Q', roll: 'L',
  menu: { items: 'P', moves: 'N', map: 'M', log: 'G', keys: 'H', view: 'V', sound: 'O', town: 'T' },
}
/** The touch deck's buttons carry pictures, no letters: the lines name the picture. */
export const TOUCH_KEYS: HudKeys = { a: 'THE SWORD BUTTON', b: 'THE ITEM BUTTON', cycle: 'THE SWAP BUTTON', roll: 'THE ROLL BUTTON', touch: true }

/** A touch pad's letter, where a page names a button in a word. */
export const PAD_LETTERS = { a: 'A', b: 'B', roll: 'R' }

/** The shortest names a page says the buttons by: the bound keys' beside a keyboard, the pads' letters on touch. */
export const shortKeys = (k: HudKeys): typeof PAD_LETTERS => (k.touch ? PAD_LETTERS : { a: k.a, b: k.b, roll: k.roll ?? KEYBOARD_KEYS.roll! })

export function subst(text: string, k: HudKeys): string {
  return text.replace(/\{A\}/g, k.a).replace(/\{B\}/g, k.b).replace(/\{CYCLE\}/g, k.cycle).replace(/\{ROLL\}/g, k.roll ?? 'L')
}
