import { allThemes, homeTheme, isAnyThemeId, resolveThemeId, type ThemeDefinition } from '~/themes'

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
 * the previous one, and pushes otherwise (a deep link into a game). There is
 * no way from one game straight to another (2026-09-24): you walk out to the
 * portal and into the next cabinet.
 */
export const useTheme = () => {
  const route = useRoute()
  const router = useRouter()

  const activeTheme = computed<string>(() => {
    const id = resolveThemeId(route.query.theme)
    return isAnyThemeId(id) ? id : homeTheme.id
  })

  const isHome = computed(() => activeTheme.value === homeTheme.id)

  /** While true a game owns the controls: Escape and the home chip leave it alone. */
  const navigationLocked = useState<boolean>('themeNavigationLocked', () => false)

  const navigationCoolingDown = useState<boolean>('themeNavigationCoolingDown', () => false)
  const navigationBlocked = computed(() => navigationLocked.value || navigationCoolingDown.value)

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

  /** From the portal into a theme. Ignores the lock; the back button returns. */
  const launch = (id: string) => {
    if (!isAnyThemeId(id) || id === homeTheme.id) return
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
    theme,
    activeTheme,
    isHome,
    themePageClass,
    themeColor,
    navigationLocked,
    navigationCoolingDown,
    navigationBlocked,
    launch,
    goHome,
  }
}
