import { themes, isThemeId, randomThemeId, type ThemeDefinition } from '~/themes'

const COOKIE_NAME = 'theme'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * Theme state. Resolved once per request, in this order:
 *   1. `?theme=<id>` in the URL (deep link, also handy when building a theme)
 *   2. the `theme` cookie (returning visitor)
 *   3. a random pick (first visit)
 * The pick happens during SSR, so the first paint is already the right theme
 * and the cookie is set in the response — no flash, no client-side reshuffle.
 */
export const useTheme = () => {
  const cookie = useCookie<string | undefined>(COOKIE_NAME, {
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    path: '/',
  })

  const activeTheme = useState<string>('activeTheme', () => {
    const fromQuery = useRoute().query.theme
    if (isThemeId(fromQuery)) return fromQuery
    if (isThemeId(cookie.value)) return cookie.value
    return randomThemeId()
  })

  if (cookie.value !== activeTheme.value) {
    cookie.value = activeTheme.value
  }

  /** While true, swipe and arrow keys do not switch theme (a game owns them). */
  const navigationLocked = useState<boolean>('themeNavigationLocked', () => false)

  const theme = computed<ThemeDefinition>(
    () => themes.find(t => t.id === activeTheme.value) ?? themes[0]
  )

  const themePageClass = computed(() => `${activeTheme.value}-page`)

  const themeColor = computed(() => {
    const t = theme.value
    if (import.meta.client && t.themeColorDark && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return t.themeColorDark
    }
    return t.themeColor
  })

  const setTheme = (id: string) => {
    if (!isThemeId(id)) return
    activeTheme.value = id
    cookie.value = id
  }

  const step = (delta: number) => {
    const i = themes.findIndex(t => t.id === activeTheme.value)
    const next = (i + delta + themes.length) % themes.length
    setTheme(themes[next].id)
  }

  return {
    themes,
    theme,
    activeTheme,
    themePageClass,
    themeColor,
    navigationLocked,
    setTheme,
    nextTheme: () => step(1),
    previousTheme: () => step(-1),
  }
}
