import { ref, computed, watch, type ComputedRef, type Ref } from 'vue'
import type { DrawnGarment, Figure, FigureBody, FigurSave, Slot, StyleId, Worn } from '~/themes/figur/types'
import { SAVE_KEY } from '~/themes/figur/types'
import * as core from '~/themes/figur/core/save'
import { isSaveError, SAVE_ERROR_TEXT, type SaveError } from '~/themes/figur/core/save'
import { cleanName, newFigure, setBody as bodyPatch, wear as wearOn } from '~/themes/figur/core/figure'
import { writeHeroColors } from '~/themes/figur/core/hero'
import { useGameSave } from '~/composables/useGameSave'
import { useLeaderboard } from '~/composables/useLeaderboard'

/**
 * Lag Din Figur's state for the studio (2026-09-26): the save from
 * core/save.ts as reactive state, every action wrapped so it is stamped
 * and stored. localStorage `figur.save` is written at once, the profile
 * slot `figur` debounced; the newest `savedAt` wins (the pattern of
 * useMiniWorld). Neon Shrine's hero wears the active figure: its colours
 * are rewritten whenever the figure or the closet changes. The UI codes
 * against `FigurApi`; the implementation follows it.
 */

/** Every action answers this; `message` is Norwegian, ready to show the child. */
export type FigurResult =
  | { ok: true }
  | { ok: false; error: SaveError; message: string }

export interface FigurApi {
  /** The save. Read it; change it only through the actions. */
  save: Readonly<Ref<FigurSave>>
  /** The figure on screen. There is always one. */
  active: ComputedRef<Figure>
  /** The drawn clothes. */
  closet: ComputedRef<DrawnGarment[]>
  /** True once the local save is loaded and the profile has answered (or timed out). */
  ready: Ref<boolean>
  /** Bumps on every change to the active figure (the stage cheers). */
  changes: Ref<number>

  // --- the active figure
  /** Replace the active figure's look with `fig` (its id is kept). Pip's changes and undo use this. */
  replace(fig: Figure): FigurResult
  setBody(patch: Partial<FigureBody>): FigurResult
  /** Put a piece on (null takes the slot off). */
  wear(slot: Slot, worn: Worn | null): FigurResult
  setStyle(style: StyleId): FigurResult
  /** 1–16 letters. */
  rename(name: string): FigurResult

  // --- figures
  /** A new default figure in the style on screen; it becomes active. */
  addFigure(): FigurResult
  /** The last one cannot go. */
  removeFigure(id: string): FigurResult
  setActive(id: string): FigurResult

  // --- drawn clothes
  /** Stores a drawn piece (same id: saves over it). */
  saveDrawn(drawn: DrawnGarment): FigurResult
  /** Deletes a drawn piece; every figure wearing it takes it off. */
  deleteDrawn(id: string): FigurResult
  /** A fresh id and the next free name for a piece of `kind`. */
  newDrawnId(): string
  nextDrawnName(kind: DrawnGarment['kind']): string

  /** Writes the profile copy now (the studio calls it when hidden). */
  flush(): void
}

const PUSH_DELAY_MS = 2000
/** How long the first load waits for the profile before going on with the local save. */
const PULL_TIMEOUT_MS = 3000
/** A profile that has not answered by then is taken as offline (pushes may go). */
const PULL_GIVE_UP_MS = 20_000
const FIGURE_NAME_TEXT = 'Navnet kan ha 1 til 16 bokstaver.'

/** A save that has a figure to show: a parsed one with none left is replaced. */
function usable(s: FigurSave | null): FigurSave | null {
  return s && s.figures.length ? s : null
}

function readLocal(): FigurSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? usable(core.parseSave(raw)) : null
  } catch {
    return null
  }
}

function writeLocal(save: FigurSave): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))
  } catch {
    // storage full or unavailable: the profile copy still goes up
  }
}

const fail = (error: SaveError, message = SAVE_ERROR_TEXT[error]): FigurResult => ({ ok: false, error, message })

let shared: FigurApi | null = null

/**
 * The shared studio state (one per page). Call it first from a
 * component's setup: the profile sync needs the Nuxt app.
 */
export function useFigur(): FigurApi {
  if (typeof window === 'undefined') return build(false)
  return (shared ??= build(true))
}

function build(client: boolean): FigurApi {
  const save = ref<FigurSave>((client && readLocal()) || core.newSave()) as Ref<FigurSave>
  const ready = ref(!client)
  const changes = ref(0)
  const profile = useGameSave('figur')
  const { ensurePlayer } = useLeaderboard()

  const active = computed(() => core.activeFigure(save.value) ?? save.value.figures[0]!)
  const closet = computed(() => save.value.closet)

  // --- persistence

  /** Pushes wait until the profile has answered once, so a fresh tab cannot overwrite a newer profile copy. */
  let pulled = !client
  let pushTimer: ReturnType<typeof setTimeout> | null = null
  let dirty = false
  let playerAsked = false

  function pushNow(): void {
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null }
    if (!dirty || !pulled) return
    dirty = false
    profile.push({ data: save.value, savedAt: save.value.savedAt })
  }

  function schedulePush(): void {
    dirty = true
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(pushNow, PUSH_DELAY_MS)
  }

  /** Makes a new save the state: stamped, stored locally at once, the profile later. */
  function commit(next: FigurSave): void {
    const stamped = { ...next, savedAt: Math.max(Date.now(), save.value.savedAt + 1) }
    save.value = stamped
    if (!client) return
    writeLocal(stamped)
    // The first real change makes the player, so the profile has a slot to keep.
    if (!playerAsked && !profile.hasPlayer()) {
      playerAsked = true
      void ensurePlayer().catch(() => { playerAsked = false })
    }
    schedulePush()
  }

  async function firstSync(): Promise<void> {
    try {
      if (!profile.hasPlayer()) return
      /** The local save as loaded: a slow profile answer is compared with this, not with play since. */
      const base = save.value.savedAt
      const pull = profile.pull()
      const timeout = new Promise<'slow'>(resolve => setTimeout(() => resolve('slow'), PULL_TIMEOUT_MS))
      let remote = await Promise.race([pull, timeout])
      if (remote === 'slow') {
        // Play on the local save meanwhile, but push nothing until the profile has answered.
        ready.value = true
        remote = await Promise.race([pull, new Promise<'offline'>(resolve => setTimeout(() => resolve('offline'), PULL_GIVE_UP_MS))])
      }
      if (remote === 'offline') return
      const local = save.value
      const theirs = remote?.data ? usable(core.parseSave(remote.data)) : null
      if (remote && theirs && remote.savedAt > base) {
        save.value = { ...theirs, savedAt: Math.max(remote.savedAt, local.savedAt) }
        writeLocal(save.value)
      } else if (local.savedAt > 0 && (!remote || remote.savedAt < local.savedAt)) {
        dirty = true
      }
    } finally {
      pulled = true
      ready.value = true
      pushNow()
    }
  }

  if (client) {
    void firstSync()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') pushNow()
    })
    // Another tab of the studio saved: take its newer copy.
    window.addEventListener('storage', (e) => {
      if (e.key !== SAVE_KEY || !e.newValue) return
      const theirs = usable(core.parseSave(e.newValue))
      if (theirs && theirs.savedAt > save.value.savedAt) save.value = theirs
    })
    // Neon Shrine's hero wears the active figure, once there is a made one:
    // the starter figure of a visit that changed nothing leaves Mini World's dressing alone.
    watch(
      () => JSON.stringify([save.value.savedAt > 0, active.value, save.value.closet.map(d => d.id + d.tex.data + d.tex.pal.join())]),
      () => { if (save.value.savedAt > 0) writeHeroColors(active.value, save.value.closet) },
      { immediate: true },
    )
  }

  // --- actions

  /** Commits a pure action's result. `cheer`: the active figure changed. */
  function run(r: FigurSave | SaveError, cheer = true, message?: string): FigurResult {
    if (isSaveError(r)) return fail(r, message)
    if (r === save.value) return { ok: true }
    commit(r)
    if (cheer) changes.value++
    return { ok: true }
  }

  /** Changes the active figure through `fn`. */
  function change(fn: (f: Figure) => Figure): FigurResult {
    const cur = active.value
    const next = fn(cur)
    if (next === cur) return { ok: true }
    return run(core.updateFigure(save.value, cur.id, next))
  }

  return {
    save,
    active,
    closet,
    ready,
    changes,

    replace: fig => change(() => ({ ...fig, id: active.value.id })),
    setBody: patch => change(f => bodyPatch(f, patch)),
    wear: (slot, worn) => change(f => wearOn(f, slot, worn)),
    setStyle: style => change(f => (f.style === style ? f : { ...f, style })),
    rename(name) {
      const clean = cleanName(name)
      if (!clean) return fail('bad-name', FIGURE_NAME_TEXT)
      return change(f => (f.name === clean ? f : { ...f, name: clean }))
    },

    addFigure() {
      // The new one opens in the style on screen.
      const fig = { ...newFigure(core.nextFigureName(save.value)), style: active.value.style }
      return run(core.addFigure(save.value, fig))
    },
    removeFigure: id => run(core.removeFigure(save.value, id)),
    setActive: id => run(core.setActive(save.value, id)),

    saveDrawn: drawn => run(core.saveDrawn(save.value, drawn)),
    deleteDrawn: id => run(core.deleteDrawn(save.value, id)),
    newDrawnId: () => core.newDrawnId(save.value),
    nextDrawnName: kind => core.nextDrawnName(save.value, kind),

    flush: pushNow,
  }
}
