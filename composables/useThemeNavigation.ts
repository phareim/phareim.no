/**
 * Swipe left/right and ArrowLeft/ArrowRight walk the theme list.
 * Call once, from app.vue. Themes that need the arrows or horizontal
 * touch for themselves set `navigationLocked` (see useTheme).
 */
export const useThemeNavigation = () => {
  const { nextTheme, previousTheme, navigationLocked, navigationCoolingDown, navigationBlocked } = useTheme()

  let cooldownTimer: ReturnType<typeof setTimeout> | undefined
  // Observe the game releasing its controls, before another input can navigate.
  watch(navigationLocked, (locked: boolean, wasLocked: boolean) => {
    if (cooldownTimer) clearTimeout(cooldownTimer)
    if (locked) {
      navigationCoolingDown.value = false
    } else if (wasLocked) {
      navigationCoolingDown.value = true
      cooldownTimer = setTimeout(() => { navigationCoolingDown.value = false }, 3000)
    }
  }, { flush: 'sync' })

  const SWIPE_MIN_PX = 70
  const SWIPE_MAX_MS = 700

  let startX = 0
  let startY = 0
  let startTime = 0
  let tracking = false

  const isTyping = (target: EventTarget | null) => {
    const el = target as HTMLElement | null
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (navigationBlocked.value || event.repeat || event.defaultPrevented) return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (isTyping(event.target)) return
    if (event.key === 'ArrowRight') nextTheme()
    else if (event.key === 'ArrowLeft') previousTheme()
  }

  const onTouchStart = (event: TouchEvent) => {
    if (navigationBlocked.value || event.touches.length !== 1) { tracking = false; return }
    const t = event.touches[0]
    startX = t.clientX
    startY = t.clientY
    startTime = Date.now()
    tracking = true
  }

  const onTouchEnd = (event: TouchEvent) => {
    if (!tracking) return
    tracking = false
    if (navigationBlocked.value) return
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
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
  })

  onBeforeUnmount(() => {
    if (cooldownTimer) clearTimeout(cooldownTimer)
    navigationCoolingDown.value = false
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('touchstart', onTouchStart)
    document.removeEventListener('touchend', onTouchEnd)
  })
}
