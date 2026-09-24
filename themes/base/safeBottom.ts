/**
 * The site's bottom band in CSS px: `--app-safe-bottom` from app.vue, the strip
 * along the bottom edge where nothing interactive or meaning-bearing may sit
 * (the player's ship or paddle, HUD text, hints). Backdrops may run through it.
 *
 * The token holds env()/max(), which getComputedStyle hands back unresolved, so
 * this measures a hidden probe instead. Cheap enough to call on every resize;
 * returns 0 outside the browser.
 */
export function safeBottom(): number {
  if (typeof document === 'undefined' || !document.body) return 0
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;visibility:hidden;pointer-events:none;height:var(--app-safe-bottom, 0px)'
  document.body.appendChild(probe)
  const h = probe.getBoundingClientRect().height
  probe.remove()
  return Number.isFinite(h) ? Math.max(0, h) : 0
}
