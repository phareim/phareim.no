// The only theme is Almanac. This composable still exists for API compatibility
// (pages and components import `themePageClass`, `cx()`, `themeColor`). It is
// intentionally trivial — kept as a shim so we don't have to touch every page
// just to remove the `cx()` calls.

export const useTheme = () => {
  const activeTheme = useState('activeTheme', () => 'almanac')

  const themePageClass = computed(() => 'almanac-page')

  const themeColor = computed(() => {
    if (import.meta.client && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return '#0e1219'
    }
    return '#f4f0e8'
  })

  const cx = (suffix: string) => `almanac-${suffix}`

  // setTheme is a no-op — kept so existing callers don't break during the rebuild.
  // Remove after all callers are deleted in later tasks.
  const setTheme = (_themeId: string) => {}

  return {
    activeTheme,
    themes: [{ id: 'almanac', name: 'Almanac', icon: '◐', themeColor: '#f4f0e8', themeColorDark: '#0e1219' }],
    themePageClass,
    themeColor,
    cx,
    setTheme,
  }
}
