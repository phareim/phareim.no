export const useTheme = () => {
  const activeTheme = useState('activeTheme', () => 'scandi')

  const themes = [
    { id: 'scandi', name: 'Scandinavian Glass', icon: '❄️' },
    { id: 'hacker', name: 'Cyberpunk', icon: '📟' },
    { id: 'tolkien', name: 'Fantasy', icon: '📜' },
    { id: 'cartoon', name: 'Cartoon', icon: '🍄' }
  ]

  const themePageClass = computed(() => `${activeTheme.value}-page`)

  const cx = (suffix: string) => `${activeTheme.value}-${suffix}`

  const setTheme = (themeId: string) => {
    activeTheme.value = themeId
    if (import.meta.client) {
      localStorage.setItem('theme', themeId)
    }
  }

  // Restore theme from localStorage on client
  if (import.meta.client) {
    const saved = localStorage.getItem('theme')
    if (saved && themes.some(t => t.id === saved)) {
      activeTheme.value = saved
    }
  }

  return {
    activeTheme,
    themes,
    themePageClass,
    cx,
    setTheme
  }
}
