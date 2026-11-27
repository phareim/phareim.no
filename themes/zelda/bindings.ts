/**
 * Which key does what in Neon Shrine and its menu: one table, read by `input.ts` (play), by the shell (`menuCommand`
 * and the menu's own keys), by `keyboardKeys()` for the painters and by the menu's KEYS page, where the player
 * changes it. Every code is a `KeyboardEvent.code` (the key's place, not its letter). Framework-free and without the
 * DOM: `keysStore.ts` keeps the table in the browser and on the profile.
 *
 * An action has one key the player can change (its primary). Beside it:
 * - always on, never in the table: the four arrows (walking; in a menu the cursor), Escape, Enter and NumpadEnter,
 *   Backspace, Y and N on the start-over question, PageUp and PageDown (the menu's previous and next page), Tab;
 * - spares (`SPARES`), live and never drawn: a spare answers only while its code is no action's primary.
 */
import type { HudKeys, MenuKeys } from './keys'

/** The actions in the KEYS page's order, each with its row's name (12 letters at most) and its first key. */
export const ACTIONS = [
  { id: 'walkUp', name: 'WALK UP', key: 'KeyW', section: 'PLAY' },
  { id: 'walkDown', name: 'WALK DOWN', key: 'KeyS', section: 'PLAY' },
  { id: 'walkLeft', name: 'WALK LEFT', key: 'KeyA', section: 'PLAY' },
  { id: 'walkRight', name: 'WALK RIGHT', key: 'KeyD', section: 'PLAY' },
  { id: 'a', name: 'ACTION', key: 'Space', section: 'PLAY' },
  { id: 'b', name: 'ITEM/JUMP', key: 'KeyK', section: 'PLAY' },
  { id: 'cycle', name: 'SWAP ITEM', key: 'KeyQ', section: 'PLAY' },
  { id: 'roll', name: 'ROLL', key: 'KeyL', section: 'PLAY' },
  { id: 'pItems', name: 'ITEMS PAGE', key: 'KeyP', section: 'MENU' },
  { id: 'pMoves', name: 'MOVES PAGE', key: 'KeyN', section: 'MENU' },
  { id: 'pMap', name: 'MAP PAGE', key: 'KeyM', section: 'MENU' },
  { id: 'pLog', name: 'LOG PAGE', key: 'KeyG', section: 'MENU' },
  { id: 'pKeys', name: 'KEYS PAGE', key: 'KeyH', section: 'MENU' },
  { id: 'view', name: 'VIEW', key: 'KeyV', section: 'MENU' },
  { id: 'sound', name: 'SOUND', key: 'KeyO', section: 'MENU' },
  { id: 'town', name: 'TO TOWN', key: 'KeyT', section: 'MENU' },
] as const

export type ActionId = typeof ACTIONS[number]['id']
export type KeyTable = Readonly<Record<ActionId, string>>

const SPARES: Partial<Record<ActionId, readonly string[]>> = {
  a: ['KeyJ', 'KeyZ', 'Enter'],
  b: ['KeyX', 'ShiftLeft', 'ShiftRight'],
  cycle: ['Tab'],
  roll: ['KeyC'],
}

/** The walk actions and their arrows, with the step each takes: on the screen, and a cursor's in a menu. */
const STEPS: ReadonlyArray<readonly [ActionId, string, readonly [number, number]]> = [
  ['walkLeft', 'ArrowLeft', [-1, 0]], ['walkRight', 'ArrowRight', [1, 0]], ['walkUp', 'ArrowUp', [0, -1]], ['walkDown', 'ArrowDown', [0, 1]],
]

/** The keys an action may be given: everything else belongs to the browser, to the menu or to the always-on keys. */
const ALLOWED = /^(Key[A-XZ]|Digit[0-9]|Numpad([0-9]|Add|Subtract|Multiply|Divide|Decimal)|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Backquote|Comma|Period|Slash|IntlBackslash|Space|ShiftLeft|ShiftRight|Insert|Delete|Home|End)$/
/** D is the LOG page's DEV MODE switch, so no key of the menu's may be it. */
const MENU_REFUSED = 'KeyD'

const byId = new Map<string, typeof ACTIONS[number]>(ACTIONS.map(a => [a.id, a]))
const fits = (action: ActionId, code: string) => ALLOWED.test(code) && !(code === MENU_REFUSED && byId.get(action)!.section === 'MENU')

export function defaultKeys(): KeyTable {
  return Object.fromEntries(ACTIONS.map(a => [a.id, a.key])) as Record<ActionId, string>
}

// ---- the table in force ------------------------------------------------------------------------------------------

let current: KeyTable = defaultKeys()
/** 'table': a key was changed. 'names': only what a key is called. */
export type KeysChange = 'table' | 'names'
const listeners = new Set<(what: KeysChange) => void>()
let names: HudKeys | null = null

function changed(what: KeysChange) {
  names = null
  for (const cb of listeners) cb(what)
}

/** The table in force. Read it when a key comes, never keep it. */
export const bindings = (): KeyTable => current

export function applyKeys(table: KeyTable) {
  if (ACTIONS.every(a => current[a.id] === table[a.id])) return
  current = { ...table }
  changed('table')
}

export const resetKeys = () => applyKeys(defaultKeys())

export function onKeysChange(cb: (what: KeysChange) => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

// ---- what a code means -------------------------------------------------------------------------------------------

const primaryOf = (code: string, table: KeyTable) => ACTIONS.find(a => table[a.id] === code)?.id ?? null

/** The action a code is the key of: primaries first, then spares. */
export function actionOf(code: string, table: KeyTable = current): ActionId | null {
  return primaryOf(code, table) ?? ACTIONS.find(a => SPARES[a.id]?.includes(code))?.id ?? null
}

/** The way a code walks (and moves a menu's cursor): an arrow, or a walk action's key. */
export function stepOf(code: string, table: KeyTable = current): readonly [number, number] | null {
  return STEPS.find(([id, arrow]) => code === arrow || code === table[id])?.[2] ?? null
}

/** Every code that works an action: its key and its spares still free. 'cursor': what moves a menu's cursor. */
export function codesOf(what: ActionId | 'cursor', table: KeyTable = current): ReadonlySet<string> {
  if (what === 'cursor') return new Set(STEPS.flatMap(([id, arrow]) => [arrow, table[id]]))
  return new Set([table[what], ...(SPARES[what] ?? []).filter(code => !primaryOf(code, table))])
}

export type MenuCommand = 'items' | 'moves' | 'map' | 'log' | 'keys' | 'view' | 'sound' | 'town' | 'yes' | 'no' | 'pagePrev' | 'pageNext'
export interface MenuState {
  paused: boolean
  /** The start-over question is up. */
  confirmReset: boolean
  /** The touch deck is showing: there is no KEYS page, and no turning of pages by key. */
  touch: boolean
}

/** What a code means to the menu, in play or in it; null: nothing. The one place that says so. */
export function menuCommand(code: string, s: MenuState, table: KeyTable = current): MenuCommand | null {
  const asking = s.paused && s.confirmReset
  if (asking) {
    if (code === 'KeyY') return 'yes'
    if (code === 'KeyN' || code === 'Backspace') return 'no'
  }
  if (s.paused && !asking && !s.touch) {
    if (code === 'PageUp') return 'pagePrev'
    if (code === 'PageDown') return 'pageNext'
  }
  const action = primaryOf(code, table)
  // (The ITEMS key, as an Escape tap, also answers the question: no.)
  if (action === 'pItems') return 'items'
  if (asking) return null
  switch (action) {
    case 'pMoves': return 'moves'
    case 'pMap': return 'map'
    case 'pLog': return 'log'
    case 'pKeys': return s.touch ? null : 'keys'
    case 'view': return 'view'
    case 'sound': return s.paused ? 'sound' : null
    case 'town': return s.paused ? 'town' : null
    default: return null
  }
}

// ---- changing it ---------------------------------------------------------------------------------------------------

export type Bound = { table: KeyTable; swapped?: ActionId } | { refused: true }

/**
 * The table with `code` as `action`'s key. A key that is another action's changes places with it; one that is only a
 * spare is simply taken. Refused: a key outside the allowed set, and D for a key of the menu's, by either road.
 */
export function bindKey(table: KeyTable, action: ActionId, code: string): Bound {
  if (!fits(action, code)) return { refused: true }
  const had = table[action]
  if (had === code) return { table }
  const other = primaryOf(code, table)
  if (!other) return { table: { ...table, [action]: code } }
  if (!fits(other, had)) return { refused: true }
  return { table: { ...table, [action]: code, [other]: had }, swapped: other }
}

/**
 * A stored record `{ v: 1, map }` read: the table it makes, and the entries kept, those of actions this version does
 * not know among them (an older device must not erase a newer one's keys). Null only for what is no record at all.
 * A bad code is skipped; of two entries after one key, the one whose action stands later in `ACTIONS` is dropped.
 */
export function parseKeys(raw: unknown): { table: KeyTable; map: Record<string, string> } | null {
  const r = raw as { v?: unknown; map?: unknown } | null
  if (!r || typeof r !== 'object' || r.v !== 1) return null
  const unknown: Record<string, string> = {}
  const mine: Partial<Record<ActionId, string>> = {}
  for (const [id, code] of Object.entries(r.map && typeof r.map === 'object' ? r.map : {})) {
    if (typeof code !== 'string' || !/^[a-zA-Z][a-zA-Z0-9]{0,23}$/.test(id)) continue
    if (!byId.has(id)) { if (/^[a-zA-Z0-9]{1,24}$/.test(code)) unknown[id] = code }
    else if (fits(id as ActionId, code)) mine[id as ActionId] = code
  }
  for (;;) {
    const table: KeyTable = { ...defaultKeys(), ...mine }
    const holder = new Map<string, ActionId>()
    let drop: ActionId | null = null
    for (const { id } of ACTIONS) {
      const first = holder.get(table[id])
      // (An action still on its first key has no entry to drop: the other one's goes.)
      if (first) { drop = mine[id] ? id : first; break }
      holder.set(table[id], id)
    }
    if (!drop) return { table, map: { ...unknown, ...mine } }
    delete mine[drop]
  }
}

/** The entries a table is stored as: the actions that are not on their first key. */
export function changedKeys(table: KeyTable): Record<string, string> {
  return Object.fromEntries(ACTIONS.filter(a => table[a.id] !== a.key).map(a => [a.id, table[a.id]]))
}

export const isAction = (id: string): id is ActionId => byId.has(id)

// ---- what a key is called -----------------------------------------------------------------------------------------

const NAMED: Record<string, string> = {
  Space: 'SPACE', ShiftLeft: 'L SHIFT', ShiftRight: 'R SHIFT', Enter: 'ENTER',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`Numpad${i}`, `NUM ${i}`])),
  NumpadAdd: 'NUM +', NumpadSubtract: 'NUM -', NumpadMultiply: 'NUM *', NumpadDivide: 'NUM /', NumpadDecimal: 'NUM .',
  Insert: 'INS', Delete: 'DEL', Home: 'HOME', End: 'END',
}
const PUNCTUATION: Record<string, string> = {
  Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
  BracketLeft: 'LBRACK', BracketRight: 'RBRACK', Backslash: 'BSLASH', Backquote: 'TICK', IntlBackslash: '<',
}
/** What both of the game's pixel faces draw. */
const DRAWN = /^[A-Z0-9ÆØÅ .,!?'":;\-()/#%&+=*·↑↓←→<]+$/

export interface LayoutMap { get(code: string): string | undefined }
let layout: LayoutMap | null = null
const seen = new Map<string, string>()

/** A key's one character as a name, if the face has it. */
function letter(key: string | undefined): string | null {
  if (!key || key.length !== 1 || key === ' ') return null
  const up = key.toUpperCase()
  return up.length === 1 && DRAWN.test(up) ? up : null
}

/**
 * A key's name on this keyboard, in capitals, 8 at most: the named keys; else what the browser's layout map says, what
 * the key typed this session, a punctuation mark's usual name, and at last the code itself. Never stored.
 */
export function keyName(code: string): string {
  return NAMED[code]
    ?? letter(layout?.get(code))
    ?? seen.get(code)
    ?? PUNCTUATION[code]
    ?? code.replace(/^(Key|Digit)/, '').toUpperCase().slice(0, 8)
}

/** What a key typed (pressed without Shift). */
export function noteKey(code: string, key: string) {
  const name = letter(key)
  if (!code || !name || seen.get(code) === name) return
  const before = keyName(code)
  seen.set(code, name)
  if (keyName(code) !== before && primaryOf(code, current)) changed('names')
}

/** The browser's keyboard layout (`navigator.keyboard.getLayoutMap`), where it tells. */
export function setLayoutMap(map: LayoutMap | null) {
  layout = map
  changed('names')
}

/** The names the painters say beside a keyboard (the same object until a key or a name changes). */
export function keyboardKeys(): HudKeys {
  if (names) return names
  const n = (a: ActionId) => keyName(current[a])
  const menu: MenuKeys = { items: n('pItems'), moves: n('pMoves'), map: n('pMap'), log: n('pLog'), keys: n('pKeys'), view: n('view'), sound: n('sound'), town: n('town') }
  names = { a: n('a'), b: n('b'), cycle: n('cycle'), roll: n('roll'), menu }
  return names
}
