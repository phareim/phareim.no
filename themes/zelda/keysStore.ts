/**
 * Where the player's keys are kept: in this browser (`localStorage['zelda.keys']`, `{ v: 1, map, at }`: the changed
 * actions, and when) and in the profile's hidden save slot of the same name, so they follow the player across
 * devices. The whole record is the unit, and the newest write wins. NEW GAME and a wiped save never touch it.
 * Also the two feeds for a key's name (`bindings.ts` `keyName`). Framework-free; a browser that keeps nothing
 * (private mode) still plays, for as long as the page lives.
 */
import { applyKeys, changedKeys, defaultKeys, isAction, noteKey, parseKeys, setLayoutMap, type KeyTable, type LayoutMap } from './bindings'

export const KEYS_STORE = 'zelda.keys'

export interface KeysRecord { v: 1; map: Record<string, string>; at: number }

/** The profile's slot, as `useGameSave('zelda.keys')` has it. */
export interface KeysRemote {
  hasPlayer(): boolean
  pull(): Promise<{ data: unknown; savedAt: number } | null | 'offline'>
  push(u: { data: object; savedAt: number }): void
}

/** A record storage would not take. */
let unkept: KeysRecord | null = null

function readRecord(): KeysRecord | null {
  if (unkept) return unkept
  try {
    const raw = JSON.parse(globalThis.localStorage.getItem(KEYS_STORE) ?? 'null') as { at?: unknown } | null
    const parsed = parseKeys(raw)
    return parsed && { v: 1, map: parsed.map, at: typeof raw!.at === 'number' && raw!.at > 0 ? raw!.at : 0 }
  } catch { return null }
}

function writeRecord(record: KeysRecord) {
  try {
    globalThis.localStorage.setItem(KEYS_STORE, JSON.stringify(record))
    unkept = null
  } catch { unkept = record }
}

/** Puts this browser's keys in force; without a record, the first ones. In the shell's `onMounted`, never sooner. */
export function loadKeys() {
  applyKeys(parseKeys(readRecord())?.table ?? defaultKeys())
}

/** The player changed the keys (a reset too): kept here, in force, and sent to the profile if this browser has a player. */
export function saveKeys(table: KeyTable, remote?: KeysRemote) {
  // A newer version's actions, which this one does not know, stay in the record.
  const others = Object.fromEntries(Object.entries(readRecord()?.map ?? {}).filter(([id]) => !isAction(id)))
  const record: KeysRecord = { v: 1, map: { ...others, ...changedKeys(table) }, at: Date.now() }
  writeRecord(record)
  applyKeys(table)
  // (Changing a key never makes a player.)
  if (remote?.hasPlayer()) remote.push({ data: record, savedAt: record.at })
}

/** Brings this browser's record and the profile's into step: the newer one wins. Quiet when the profile cannot be had. */
export async function syncKeys(remote: KeysRemote): Promise<void> {
  if (!remote.hasPlayer()) return
  const theirs = await remote.pull()
  if (theirs === 'offline') return
  // (Read after the answer: a key may have been changed while it was on its way.)
  const mine = readRecord()
  if (theirs && theirs.savedAt > (mine?.at ?? 0)) {
    const parsed = parseKeys(theirs.data)
    if (!parsed) return
    writeRecord({ v: 1, map: parsed.map, at: theirs.savedAt })
    applyKeys(parsed.table)
  } else if (mine && mine.at > 0 && (!theirs || mine.at > theirs.savedAt)) remote.push({ data: mine, savedAt: mine.at })
}

interface Keyboard {
  getLayoutMap?: () => Promise<LayoutMap>
  addEventListener?: (type: 'layoutchange', cb: () => void) => void
  removeEventListener?: (type: 'layoutchange', cb: () => void) => void
}

/** Learns what this keyboard calls its keys: from the browser's layout map where it has one, and from what is typed. */
export function watchKeyNames(): () => void {
  let on = true
  const typed = (e: KeyboardEvent) => { if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) noteKey(e.code, e.key) }
  window.addEventListener('keydown', typed, true)
  const keyboard = (navigator as Navigator & { keyboard?: Keyboard }).keyboard
  // (Refused in a frame from another origin: the other ways of naming a key stand.)
  const read = () => { void keyboard?.getLayoutMap?.().then(map => { if (on) setLayoutMap(map) }, () => {}) }
  read()
  keyboard?.addEventListener?.('layoutchange', read)
  return () => {
    on = false
    window.removeEventListener('keydown', typed, true)
    keyboard?.removeEventListener?.('layoutchange', read)
  }
}
