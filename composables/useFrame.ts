import { framedGame, type FramedGame } from '~/themes/frames'

/** Running from the Home Screen (or installed on a desktop), not in a browser tab. */
export function isInstalledApp(): boolean {
  if (!import.meta.client) return false
  return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * A game from another address, shown inside this page (docs/games/frame.md).
 * `/?frame=<id>` is the state, like `/?theme=<id>` for a theme: the town
 * pushes it (`enter`), so the back button returns, and `leave` steps back to
 * the town when it is the previous entry.
 */
export const useFrame = () => {
  const route = useRoute()
  const router = useRouter()

  const framed = computed<FramedGame | null>(() => framedGame(route.query.frame))

  /** From the town into a framed game; false when `id` is not one, or the page runs in a browser tab. */
  const enter = (id: string): boolean => {
    if (!framedGame(id) || !isInstalledApp()) return false
    router.push({ path: '/', query: { frame: id } })
    return true
  }

  /** Back to the town. */
  const leave = () => {
    if (!framed.value) return
    const back = import.meta.client ? (window.history.state as { back?: unknown } | null)?.back : null
    if (back === '/') router.back()
    else router.push('/')
  }

  return { framed, enter, leave }
}
