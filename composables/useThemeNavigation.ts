/**
 * Escape goes back to the portal. Call once, from app.vue. There is no
 * switching between games here (arrows and swipes were removed 2026-09-24):
 * the way to another game is out through the portal. A game that owns the
 * controls sets `navigationLocked` (see useTheme); after it lets go, Escape
 * waits a 3 s grace period. None of it applies on the portal, which owns
 * every key.
 */
export const useThemeNavigation = () => {
  const {
    activeTheme, isHome, goHome,
    navigationLocked, navigationCoolingDown, navigationBlocked,
  } = useTheme()

  let cooldownTimer: ReturnType<typeof setTimeout> | undefined
  // The theme that took the lock. A game unmounted by a route change (back
  // button, home chip) releases its lock after the switch; that is no game
  // over, so it starts no cooldown.
  let lockedBy: string | null = null
  // Observe the game releasing its controls, before another input can navigate.
  watch(navigationLocked, (locked: boolean, wasLocked: boolean) => {
    if (cooldownTimer) clearTimeout(cooldownTimer)
    if (locked) {
      lockedBy = activeTheme.value
      navigationCoolingDown.value = false
    } else if (wasLocked) {
      const sameTheme = lockedBy === activeTheme.value
      lockedBy = null
      navigationCoolingDown.value = sameTheme
      if (sameTheme) cooldownTimer = setTimeout(() => { navigationCoolingDown.value = false }, 3000)
    }
  }, { flush: 'sync' })

  // Arriving on another theme by URL ends any cooldown left from the last one.
  watch(activeTheme, () => {
    if (navigationLocked.value) return
    if (cooldownTimer) clearTimeout(cooldownTimer)
    navigationCoolingDown.value = false
  })

  const isTyping = (target: EventTarget | null) => {
    const el = target as HTMLElement | null
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
  }

  /**
   * Escape goes home when the game is not using it. Games listen on
   * `window`, and EscHold (pause/quit) and the games' own Escape uses call
   * preventDefault. A window listener may run before theirs, and a
   * microtask would run between listeners, so the verdict waits for a task
   * after the whole dispatch.
   */
  const onEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.repeat) return
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
    if (isHome.value || navigationBlocked.value || isTyping(event.target)) return
    const from = activeTheme.value
    setTimeout(() => {
      if (event.defaultPrevented || navigationBlocked.value || activeTheme.value !== from) return
      goHome()
    }, 0)
  }

  onMounted(() => {
    window.addEventListener('keydown', onEscape)
  })

  onBeforeUnmount(() => {
    if (cooldownTimer) clearTimeout(cooldownTimer)
    navigationCoolingDown.value = false
    window.removeEventListener('keydown', onEscape)
  })
}
