// Module-level flag so the localStorage→cookie migration runs only once per session
let migrationDone = false

export const useTheme = () => {
  const themes = [
    { id: 'scandi', name: 'Scandinavian Glass', icon: '❄️', themeColor: '#f5f5f3', themeColorDark: '#1a1c1e' },
    { id: 'hacker', name: 'Cyberpunk', icon: '📟', themeColor: '#0a0a0a', themeColorDark: '#0a0a0a' },
    { id: 'space', name: 'Space', icon: '🚀', themeColor: '#0a0a0f', themeColorDark: '#0a0a0f' }
  ]

  const themeIds = themes.map(t => t.id)

  // useCookie is SSR-aware: on the server it reads from the HTTP Cookie request header,
  // so the correct theme class ships in the first HTML response — no flash of wrong theme.
  const themeCookie = useCookie<string>('theme', {
    default: () => 'scandi',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })

  const activeTheme = useState('activeTheme', () =>
    themeIds.includes(themeCookie.value) ? themeCookie.value : 'scandi'
  )

  const themePageClass = computed(() => `${activeTheme.value}-page`)

  const themeColor = computed(() => {
    const t = themes.find(t => t.id === activeTheme.value)
    if (!t) return '#f5f5f3'
    if (import.meta.client && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return t.themeColorDark
    }
    return t.themeColor
  })

  const cx = (suffix: string) => `${activeTheme.value}-${suffix}`

  const setTheme = (themeId: string) => {
    activeTheme.value = themeId
    themeCookie.value = themeId
  }

  // Migrate existing localStorage theme preference to cookie on first mount.
  // Existing users keep their saved theme; future saves go straight to the cookie.
  if (import.meta.client) {
    onMounted(() => {
      if (migrationDone) return
      migrationDone = true
      const saved = localStorage.getItem('theme')
      if (saved && themeIds.includes(saved)) {
        activeTheme.value = saved
        themeCookie.value = saved
        localStorage.removeItem('theme')
      }
    })
  }

  return {
    activeTheme,
    themes,
    themePageClass,
    themeColor,
    cx,
    setTheme
  }
}
