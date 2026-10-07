/**
 * The names of the buttons, as the player's device shows them. Dialog lines
 * and hints carry {A}, {B} and {CYCLE}; `subst` puts the names in. Pure.
 */
export interface HudKeys { a: string; b: string; cycle: string }

export function subst(text: string, k: HudKeys): string {
  return text.replace(/\{A\}/g, k.a).replace(/\{B\}/g, k.b).replace(/\{CYCLE\}/g, k.cycle)
}
