/**
 * An installed phareim.no (the home-screen app) can sit in memory for days.
 * Nuxt looks for a new deploy once per hour of open page; this also looks
 * each time the app comes back to the foreground. A new build does not
 * reload on the spot, which would move the hero or end a run: Nuxt's own
 * `app:manifest:update` makes the next navigation (a cabinet, the ⌂ chip,
 * Escape, the back button) a full load of the new deploy, before a game's
 * chunk is asked for from a build that is gone.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const { app } = useRuntimeConfig()
  const url = `${app.baseURL.replace(/\/$/, '')}${app.buildAssetsDir}builds/latest.json`
  /** Coming back twice within this long asks once. */
  const MIN_GAP_MS = 60_000
  let last = 0
  let found = false

  async function check() {
    if (found || document.visibilityState !== 'visible') return
    const now = Date.now()
    if (now - last < MIN_GAP_MS) return
    last = now
    try {
      // The query gets past the year-long cache on /_nuxt/.
      const meta = await $fetch<{ id: string; timestamp: number }>(`${url}?${now}`)
      if (meta?.id && meta.id !== app.buildId) {
        found = true
        await nuxtApp.hooks.callHook('app:manifest:update', meta)
      }
    } catch { /* offline or mid-deploy: the next return asks again */ }
  }

  document.addEventListener('visibilitychange', check)
  window.addEventListener('pageshow', (e) => { if (e.persisted) check() })
})
