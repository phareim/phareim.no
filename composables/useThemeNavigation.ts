/**
 * Swipe left/right and ArrowLeft/ArrowRight walk the theme list; Escape
 * goes back to the portal. Call once, from app.vue. Themes that need the
 * arrows or horizontal touch for themselves set `navigationLocked` (see
 * useTheme). None of it applies on the portal, which owns every key.
 */
export const useThemeNavigation = () => {
  const {
    activeTheme, isHome, nextTheme, previousTheme, goHome,
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

  const SWIPE_MIN_PX = 70
  const SWIPE_MAX_MS = 700

  let startX = 0
  let startY = 0
  let startTime = 0
  let tracking = false

  const isTyping = (target: EventTarget | null) => {
    const el = target as HTMLElement | null
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (isHome.value || navigationBlocked.value || event.repeat || event.defaultPrevented) return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (isTyping(event.target)) return
    if (event.key === 'ArrowRight') nextTheme()
    else if (event.key === 'ArrowLeft') previousTheme()
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

  const onTouchStart = (event: TouchEvent) => {
    if (isHome.value || navigationBlocked.value || event.touches.length !== 1) { tracking = false; return }
    const t = event.touches[0]
    startX = t.clientX
    startY = t.clientY
    startTime = Date.now()
    tracking = true
  }

  const onTouchEnd = (event: TouchEvent) => {
    if (!tracking) return
    tracking = false
    if (isHome.value || navigationBlocked.value) return
    const t = event.changedTouches[0]
    const dx = t.clientX - startX
    const dy = t.clientY - startY
    if (Date.now() - startTime > SWIPE_MAX_MS) return
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 2) return
    // Finger moving left reveals the next theme, like a carousel.
    if (dx < 0) nextTheme()
    else previousTheme()
  }

  onMounted(() => {
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('keydown', onEscape)
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
  })

  onBeforeUnmount(() => {
    if (cooldownTimer) clearTimeout(cooldownTimer)
    navigationCoolingDown.value = false
    document.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keydown', onEscape)
    document.removeEventListener('touchstart', onTouchStart)
    document.removeEventListener('touchend', onTouchEnd)
  })
}
