/**
 * The shell's side of the menu's KEYS page (`render/keysPage.ts`): where the cursor stands, the wait for a new key,
 * RESET ALL's two presses, and where the page's buttons stand (`KeysPageButtons.vue`). `Zelda.vue` makes one.
 *
 * A wait for a key begins and ends here: a window listener in the capture phase takes the next keydown, so nothing
 * else hears it (not the game, not the Escape pill, not the site's Escape). Whatever leaves the page calls `leave`.
 */
import { shallowRef } from 'vue'
import { ACTIONS, bindKey, bindings, codesOf, defaultKeys, keyName, stepOf, type KeyTable } from './bindings'
import { AGAIN_WORDS, REFUSED_WORDS, RESET_WORDS, type KeysView } from './render/keysPage'
import type { KeysTargets } from './render/renderer'

export interface KeysShellHooks {
  /** The paused picture is to be painted again. */
  repaint(): void
  sfx(name: 'select' | 'error'): void
  signedIn(): boolean
  reducedMotion(): boolean
  /** The player's new keys: keep them and put them in force. */
  save(table: KeyTable): void
}

export interface KeyButton { id: number | 'more'; label: string; style: Record<string, string> }

/** How long RESET ALL waits for its second press. */
const ARMED_MS = 3000
/** A changed row's cell flashes: this many halves, each this long. */
const FLASHES = 6
const FLASH_MS = 110
const RESET = ACTIONS.length

export function createKeysShell(o: KeysShellHooks) {
  let cursor = 0
  let capturing = false
  let refused = false
  /** The row that changed places with the last one changed. */
  let lit: number | null = null
  let armed: ReturnType<typeof setTimeout> | null = null
  let flashing: number[] = []
  let flashLeft = 0
  let flashTimer: ReturnType<typeof setTimeout> | null = null
  /** The pages as last painted, and whether the two sections stood beside each other. */
  let pages: number[][] = []
  let wide = false
  const at = shallowRef<KeyButton[] | null>(null)

  function disarm() {
    if (!armed) return
    clearTimeout(armed)
    armed = null
    o.repaint()
  }

  function stopFlash() {
    if (flashTimer) clearTimeout(flashTimer)
    flashTimer = null
    flashLeft = 0
  }

  function flash(rows: number[]) {
    stopFlash()
    if (o.reducedMotion() || !rows.length) return
    flashing = rows
    flashLeft = FLASHES
    const step = () => {
      flashTimer = flashLeft > 0 ? setTimeout(() => { flashLeft--; o.repaint(); step() }, FLASH_MS) : null
    }
    step()
  }

  function moveTo(next: number) {
    const to = Math.max(0, Math.min(RESET, next))
    if (to === cursor) return
    disarm()
    cursor = to
    lit = null
    o.repaint()
    o.sfx('select')
  }

  function stop() {
    if (!capturing) return
    capturing = false
    refused = false
    window.removeEventListener('keydown', take, true)
    window.removeEventListener('blur', stop)
    o.repaint()
  }

  /** The key waited for. */
  function take(e: KeyboardEvent) {
    // (A chord is the browser's: Ctrl+R still reloads.)
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return
    e.preventDefault()
    e.stopImmediatePropagation()
    if (e.repeat) return
    if (e.code === 'Escape') { stop(); return }
    const row = ACTIONS[cursor]!
    const had = bindings()
    const bound = bindKey(had, row.id, e.code)
    if ('refused' in bound) {
      refused = true
      o.sfx('error')
      o.repaint()
      return
    }
    stop()
    if (bound.table !== had) {
      o.save(bound.table)
      lit = bound.swapped ? ACTIONS.findIndex(a => a.id === bound.swapped) : null
      flash([cursor])
    }
    o.sfx('select')
    o.repaint()
  }

  /** A press on the cursor's row: wait for its new key. On RESET ALL: ask once, then do it. */
  function choose() {
    // (A button reached by Tab lets go, so Space is not its press while the key is waited for, or after.)
    const focused = typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null
    if (cursor === RESET) {
      if (!armed) {
        lit = null
        armed = setTimeout(() => { armed = null; o.repaint() }, ARMED_MS)
      } else {
        disarm()
        const had = bindings()
        const changed = ACTIONS.map((a, i) => (had[a.id] === a.key ? -1 : i)).filter(i => i >= 0)
        o.save(defaultKeys())
        flash(changed)
        focused?.closest?.('[data-game-keys]') && focused.blur()
      }
      o.sfx('select')
      o.repaint()
      return
    }
    focused?.closest?.('[data-game-keys]') && focused.blur()
    disarm()
    stopFlash()
    lit = null
    refused = false
    capturing = true
    window.addEventListener('keydown', take, true)
    window.addEventListener('blur', stop)
    o.sfx('select')
    o.repaint()
  }

  /** Nothing of the page is left waiting. */
  function leave() {
    stop()
    disarm()
    stopFlash()
    lit = null
  }

  const pageOf = (row: number) => Math.max(0, pages.findIndex(p => p.includes(row)))

  return {
    /** The buttons over the page, where it was last painted. */
    at,
    /** The menu comes to the page: the cursor at the top. */
    open() { leave(); cursor = 0 },
    leave,
    /** What the renderer paints (`FrameUI.keysPage`). */
    view(): KeysView {
      const table = bindings()
      return {
        rows: ACTIONS.map(a => ({ section: a.section, name: a.name, key: keyName(table[a.id]) })),
        cursor,
        capturing,
        armed: !!armed,
        lit,
        // (The last half of all is the dark one.)
        flash: flashLeft > 0 && flashLeft % 2 === 0 ? flashing : [],
        last: capturing ? (refused ? REFUSED_WORDS : 'PRESS A KEY · ESC CANCELS')
          : armed ? AGAIN_WORDS
            : lit !== null ? `SWAPPED WITH ${ACTIONS[lit]!.name}`
              : 'ESC RESUME · ENTER CHANGE',
        signIn: !o.signedIn(),
      }
    },
    /** The page's own keys, while the menu is open on it: the cursor, and Enter or A's keys to change a row. */
    key(e: KeyboardEvent): boolean {
      // While a key is waited for, what `take` leaves alone (an input method's keys) does nothing here either.
      if (capturing) return true
      const step = stepOf(e.code)
      const chosen = e.code === 'Enter' || e.code === 'NumpadEnter' || codesOf('a').has(e.code)
      // Any other key takes RESET ALL's question back.
      if (!chosen) disarm()
      if (!step && !chosen) return false
      e.preventDefault()
      if (e.repeat) return true
      if (chosen) { choose(); return true }
      const [dx, dy] = step!
      if (dy) moveTo(cursor + dy)
      else if (wide) {
        // Beside each other: across to the same row of the other section.
        const half = ACTIONS.filter(a => a.section === 'PLAY').length
        if (dx > 0 && cursor < half) moveTo(Math.min(RESET - 1, cursor + half))
        else if (dx < 0 && cursor >= half && cursor < RESET) moveTo(cursor - half)
      } else {
        // One column: left and right turn the page.
        const row = pages[pageOf(cursor) + dx]?.[0]
        if (row !== undefined) moveTo(row)
      }
      return true
    },
    /** A pointer on a row's button, RESET ALL's or MORE. */
    press(id: number | 'more') {
      stop()
      if (id === 'more') { moveTo(pages[(pageOf(cursor) + 1) % Math.max(1, pages.length)]?.[0] ?? 0); return }
      moveTo(id)
      choose()
    },
    /** After a paused paint: the buttons go where the rows were painted (null: the page is not up). */
    place(next: KeysTargets | null) {
      let buttons: KeyButton[] | null = null
      if (next) {
        pages = next.pages
        wide = next.wide
        const table = bindings()
        const style = (b: { x: number; y: number; w: number; h: number }) => ({ left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` })
        buttons = next.rows.map(r => ({ id: r.index, label: `${ACTIONS[r.index]!.name}, ${keyName(table[ACTIONS[r.index]!.id])}`, style: style(r.box) }))
        if (next.reset) buttons.push({ id: RESET, label: armed ? AGAIN_WORDS : RESET_WORDS, style: style(next.reset) })
        if (next.more) buttons.push({ id: 'more', label: 'More keys', style: style(next.more) })
      }
      if (JSON.stringify(buttons) !== JSON.stringify(at.value)) at.value = buttons
    },
  }
}
