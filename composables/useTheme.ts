export const useTheme = () => {
  const activeTheme = useState('activeTheme', () => 'scandi')
  
  const themes = [
    { id: 'scandi', name: 'Scandinavian Glass', icon: '❄️' },
    { id: 'hacker', name: 'Cyberpunk', icon: '📟' },
    { id: 'tolkien', name: 'Fantasy', icon: '📜' }
  ]

  const setTheme = (themeId) => {
    activeTheme.value = themeId
  }

  return {
    activeTheme,
    themes,
    setTheme
  }
}

