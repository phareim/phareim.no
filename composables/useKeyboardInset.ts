import { ref, onMounted, onBeforeUnmount } from 'vue'

/**
 * The iPhone keyboard's height over the page, so a window with a text field
 * can sit above it (the games lock the page, and iOS scrolls it to show the
 * focused field; this puts it back when the keyboard goes). Same idea as the
 * games' own shells.
 */
export function useKeyboardInset() {
  const inset = ref(0)
  function onViewport() {
    const vv = window.visualViewport
    if (!vv) return
    inset.value = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
    if (inset.value === 0 && (window.scrollY || document.documentElement.scrollTop)) window.scrollTo(0, 0)
  }
  onMounted(() => {
    window.visualViewport?.addEventListener('resize', onViewport)
    window.visualViewport?.addEventListener('scroll', onViewport)
  })
  onBeforeUnmount(() => {
    window.visualViewport?.removeEventListener('resize', onViewport)
    window.visualViewport?.removeEventListener('scroll', onViewport)
  })
  return inset
}
