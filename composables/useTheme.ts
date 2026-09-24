import { themes, allThemes, homeTheme, isThemeId, isAnyThemeId, resolveThemeId, type ThemeDefinition } from '~/themes'

/** Set by `launch()`, read (and cleared) by the theme it launched. */
export interface PortalLaunch {
  theme: string
  at: number
}

/**
 * Theme state. The URL is the only source (2026-09-24):
 *   - `/` is the portal, the home theme
 *   - `/?theme=<id>` is that theme, parked ones included; legacy ids are
 *     mapped first, an unknown id falls back to the portal
 * It is read from the route, so SSR paints the right theme and client
 * navigation (links, back/forward) switches it with no extra state.
 *
 * Leaving the portal (`launch`) pushes a history entry, so the back button
 * returns. Coming back (`goHome`) steps back to that entry when the portal is
 * the previous one, and pushes otherwise (a deep link into a game). Swiping
 * between games replaces the entry, so history does not fill up.
 */
export const useTheme = () => {
  const route = useRoute()
  const router = useRouter()

  const activeTheme = computed<string>(() => {
    const id = resolveThemeId(route.query.theme)
    return isAnyThemeId(id) ? id : homeTheme.id
  })

  const isHome = computed(() => activeTheme.value === homeTheme.id)

  /** While true, swipe and arrow keys do not switch theme (a game owns them). */
  const navigationLocked = useState<boolean>('themeNavigationLocked', () => false)

  const navigationCoolingDown = useState<boolean>('themeNavigationCoolingDown', () => false)
  const navigationBlocked = computed(() => navigationLocked.value || navigationCoolingDown.value)

  const portalLaunch = useState<PortalLaunch | null>('portalLaunch', () => null)

  const theme = computed<ThemeDefinition>(
    () => allThemes.find(t => t.id === activeTheme.value) ?? homeTheme
  )

  const themePageClass = computed(() => `${activeTheme.value}-page`)

  const themeColor = computed(() => {
    const t = theme.value
    if (import.meta.client && t.themeColorDark && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return t.themeColorDark
    }
    return t.themeColor
  })

  /** Swipe, arrow, chevron or dot: another game in the rotation. Respects the lock. */
  const setTheme = (id: string) => {
    if (navigationBlocked.value || !isThemeId(id) || id === activeTheme.value) return
    router.replace({ path: '/', query: { theme: id } })
  }

  const step = (delta: number) => {
    if (isHome.value) return
    const i = themes.findIndex(t => t.id === activeTheme.value)
    // A parked theme is not in the rotation: a step lands on the first or last game.
    const next = i < 0 ? (delta > 0 ? 0 : themes.length - 1) : (i + delta + themes.length) % themes.length
    setTheme(themes[next].id)
  }

  /** From the portal into a theme. Ignores the lock; the back button returns. */
  const launch = (id: string) => {
    if (!isAnyThemeId(id) || id === homeTheme.id) return
    portalLaunch.value = { theme: id, at: Date.now() }
    router.push({ path: '/', query: { theme: id } })
  }

  /** Back to the portal. Ignores the lock. */
  const goHome = () => {
    if (isHome.value) return
    // vue-router keeps the previous entry's path in history.state.back.
    const back = import.meta.client ? (window.history.state as { back?: unknown } | null)?.back : null
    if (back === '/') router.back()
    else router.push('/')
  }

  return {
    themes,
    theme,
    activeTheme,
    isHome,
    themePageClass,
    themeColor,
    navigationLocked,
    navigationCoolingDown,
    navigationBlocked,
    portalLaunch,
    setTheme,
    nextTheme: () => step(1),
    previousTheme: () => step(-1),
    launch,
    goHome,
  }
}
