/**
 * Which kind of input the visitor is using, so a hint can say
 * "PRESS ENTER" on a keyboard and "TAP" on a phone instead of both.
 *
 * Server: guessed from the client hint / user agent so the first paint is
 * already right for most visitors. Client: `(hover: none) and (pointer:
 * coarse)` decides at mount (catches iPads, which send a desktop UA), then
 * the first real keydown, touch or mouse press wins — a touch laptop or an
 * iPad with a keyboard ends up on whatever the visitor actually uses.
 */
export type InputMode = 'keyboard' | 'touch'

const TOUCH_QUERY = '(hover: none) and (pointer: coarse)'
const MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod/i

let wired = false

export const useInputMode = () => {
  const inputMode = useState<InputMode>('inputMode', () => {
    if (import.meta.server) {
      const h = useRequestHeaders(['sec-ch-ua-mobile', 'user-agent'])
      if (h['sec-ch-ua-mobile'] === '?1') return 'touch'
      return MOBILE_UA.test(h['user-agent'] ?? '') ? 'touch' : 'keyboard'
    }
    return window.matchMedia(TOUCH_QUERY).matches ? 'touch' : 'keyboard'
  })

  if (import.meta.client && !wired) {
    wired = true
    onMounted(() => {
      const mq = window.matchMedia(TOUCH_QUERY)
      inputMode.value = mq.matches ? 'touch' : 'keyboard'
      mq.addEventListener('change', e => { inputMode.value = e.matches ? 'touch' : 'keyboard' })
      window.addEventListener('touchstart', () => { inputMode.value = 'touch' }, { passive: true, capture: true })
      window.addEventListener('keydown', () => { inputMode.value = 'keyboard' }, { capture: true })
      window.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse') inputMode.value = 'keyboard'
      }, { passive: true, capture: true })
    })
  }

  const isTouch = computed(() => inputMode.value === 'touch')

  /** Pick the wording for the current input mode. Reactive when read in a template. */
  const hint = (keyboard: string, touch: string) => (inputMode.value === 'touch' ? touch : keyboard)

  return { inputMode, isTouch, hint }
}
