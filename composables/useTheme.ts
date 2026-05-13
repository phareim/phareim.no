export type ThemeId = 'scandi' | 'hacker' | 'space' | 'almanac'

export const useTheme = () => {
  const activeTheme = useState('activeTheme', () => 'scandi')

  const themes = [
    { id: 'scandi', name: 'Scandinavian Glass', icon: '❄️', themeColor: '#f5f5f3', themeColorDark: '#1a1c1e' },
    { id: 'hacker', name: 'Cyberpunk', icon: '📟', themeColor: '#0a0a0a', themeColorDark: '#0a0a0a' },
    { id: 'space', name: 'Space', icon: '🚀', themeColor: '#0a0a0f', themeColorDark: '#0a0a0f' },
    { id: 'almanac', name: 'Almanac', icon: '◐', themeColor: '#f4f0e8', themeColorDark: '#0e1219' }
  ]

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
    if (activeTheme.value === themeId) return
    activeTheme.value = themeId
    if (import.meta.client) {
      localStorage.setItem('theme', themeId)
    }
  }

  // Restore theme from localStorage on client (after hydration to avoid mismatch)
  if (import.meta.client) {
    onMounted(() => {
      const saved = localStorage.getItem('theme')
      if (saved && themes.some(t => t.id === saved)) {
        activeTheme.value = saved
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
