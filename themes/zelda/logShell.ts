/**
 * The shell's side of the menu's LOG page (`render/logPage.ts`): which page of the change list is up, the page's own
 * keys, and where its buttons stand (`LogPageButtons.vue`). `Zelda.vue` makes one.
 */
import { shallowRef } from 'vue'
import { codesOf } from './bindings'
import { CHANGE_LOG } from './changes.gen'
import type { LogTargets } from './render/renderer'

export interface LogShellHooks {
  /** The paused picture is to be painted again. */
  repaint(): void
  /** A page was turned to. */
  turned(): void
  /** DEV MODE's switch was pressed. */
  toggleDev(): void
}

/** Down, right and walk-down show older changes; up, left and walk-up newer. (D is the switch, whatever walks.) */
function turnOf(code: string): 1 | -1 | undefined {
  if (code === 'ArrowDown' || code === 'ArrowRight' || codesOf('walkDown').has(code)) return 1
  if (code === 'ArrowUp' || code === 'ArrowLeft' || codesOf('walkUp').has(code)) return -1
  return undefined
}

export function createLogShell(o: LogShellHooks) {
  /** The page asked for, 0 the newest, and how many there were at the last paint. */
  let page = 0
  let pages = 1
  const at = shallowRef<LogTargets | null>(null)

  function turn(by: 1 | -1) {
    const next = Math.max(0, Math.min(pages - 1, page + by))
    if (next === page) return
    page = next
    o.repaint()
    o.turned()
  }

  return {
    /** The buttons over the page, where it was last painted. */
    at,
    /** The menu comes to the page: the newest changes first. */
    open() { page = 0 },
    /** What the renderer paints (`FrameUI.log`). */
    view: (dev: boolean) => ({ changes: CHANGE_LOG, page, dev }),
    older: () => turn(1),
    newer: () => turn(-1),
    /** The page's own keys, while the menu is open on it. */
    key(e: KeyboardEvent): boolean {
      const dev = e.code === 'KeyD'
      const by = dev ? undefined : turnOf(e.code)
      if (!by && !dev) return false
      e.preventDefault()
      if (e.repeat) return true
      if (by) turn(by)
      else o.toggleDev()
      return true
    },
    /** After a paused paint: the buttons go where the words were painted (null: the page is not up). */
    place(next: LogTargets | null) {
      if (next) { page = next.page; pages = next.pages }
      if (JSON.stringify(next) !== JSON.stringify(at.value)) at.value = next
    },
  }
}
