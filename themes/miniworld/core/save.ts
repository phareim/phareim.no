/**
 * Mini World's save: a new save, a strict parser, and every action as a
 * pure function. An action returns a new save, or a `SaveError` string
 * when a rule says no; it never mutates its input. Prices are the
 * caller's business (useMiniWorld spends from the wallet first).
 */
import {
  MAX_PERSONS, HOUSE_W, HOUSE_D,
  type MiniWorldSave, type Person, type PersonLook, type Outfit, type ClothingSlot,
  type OwnedFurniture, type PlacedItem, type HouseLayout, type Weapon, type WeaponBaseId,
  type WeaponMagicId, type ContestRecord, type Gift, type FurnitureDef,
  type SkinId, type HairStyleId, type HairColorId, type EyesId, type MouthId,
} from '../types'
import {
  SKINS, HAIR_STYLES, HAIR_COLORS, EYES, MOUTHS,
  STARTER_CLOSET, STARTER_OUTFIT, STARTER_FLOOR, STARTER_WALL, STARTER_FURNITURE,
  WEAPON_COLORS, clothing, furniture, floorDef, wallDef, weaponBase, weaponMagic,
} from '../catalog'
import { cleanName, weaponName } from './names'
import { randomId } from './rng'

export type SaveError =
  /** Three persons already. */
  | 'full'
  | 'bad-name'
  | 'no-person'
  /** Not in the catalog. */
  | 'unknown'
  | 'not-owned'
  /** Already owned (clothes, floors, walls). */
  | 'owned'
  | 'wrong-slot'
  /** A prize or royal piece: won, never bought. */
  | 'not-for-sale'
  | 'max-level'
  /** A layout breaks a placement rule. */
  | 'bad-place'
  /** Too many weapons or furniture. */
  | 'too-many'
  /** The only piece left for a slot a person must wear. */
  | 'last-piece'
  | 'not-giftable'
  | 'opened'
  | 'bad-look'

export const isSaveError = (r: unknown): r is SaveError => typeof r === 'string'

/** Norwegian, for the child. */
export const SAVE_ERROR_TEXT: Record<SaveError, string> = {
  'full': 'Du har allerede tre personer.',
  'bad-name': 'Navnet kan ha 1 til 12 bokstaver.',
  'no-person': 'Fant ikke personen.',
  'unknown': 'Den finnes ikke.',
  'not-owned': 'Den har du ikke.',
  'owned': 'Den har du allerede!',
  'wrong-slot': 'Den passer ikke der.',
  'not-for-sale': 'Den kan du bare vinne.',
  'max-level': 'Den er allerede magisk!',
  'bad-place': 'Den får ikke plass der.',
  'too-many': 'Du har ikke plass til flere.',
  'last-piece': 'Du trenger den selv.',
  'not-giftable': 'Den kan du ikke gi bort.',
  'opened': 'Den gaven er allerede åpnet.',
  'bad-look': 'Det gikk ikke.',
}

export const MAX_FURNITURE = 150
export const MAX_WEAPONS = 24
const MAX_OPENED = 100
const MAX_PRIZES = 100
const REQUIRED_SLOTS: ClothingSlot[] = ['top', 'bottom', 'shoes']
const OPTIONAL_SLOTS: ClothingSlot[] = ['hat', 'face', 'back']
const SLOTS: ClothingSlot[] = [...REQUIRED_SLOTS, ...OPTIONAL_SLOTS]

const UID_RE = /^[a-z0-9]{4,16}$/
const HEX_RE = /^#[0-9a-f]{6}$/i

// ---------------------------------------------------------------- new save

const emptyRecord = (): ContestRecord => ({ plays: 0, wins: 0, best: null })

function newUid(taken: Iterable<string>): string {
  const used = new Set(taken)
  for (;;) {
    const id = randomId(8)
    if (!used.has(id)) return id
  }
}

/** A default look for a person made without choices. */
export function defaultLook(): PersonLook {
  return { skin: 's2', hair: 'short', hairColor: 'brown', eyes: 'dots', mouth: 'smile', cheeks: true, outfit: { ...STARTER_OUTFIT } }
}

/** The starter closet and house (bed, lamp, plant placed), no persons, no welcome yet. */
export function newSave(): MiniWorldSave {
  const owned: OwnedFurniture[] = []
  for (const id of STARTER_FURNITURE) {
    if (furniture(id)) owned.push({ uid: newUid(owned.map(o => o.uid)), id, level: 1 })
  }
  let save: MiniWorldSave = {
    v: 1,
    persons: [],
    active: '',
    closet: STARTER_CLOSET.filter(id => clothing(id)),
    furniture: owned,
    house: { floor: STARTER_FLOOR, wall: STARTER_WALL, items: [] },
    floors: [STARTER_FLOOR],
    walls: [STARTER_WALL],
    weapons: [],
    equipped: null,
    prizes: [],
    contests: {
      obby: { easy: emptyRecord(), medium: emptyRecord(), hard: emptyRecord() },
      stars: emptyRecord(),
      fashion: emptyRecord(),
      memory: emptyRecord(),
    },
    openedGifts: [],
    savedAt: 0,
  }
  // Bed in the back-left corner with the lamp beside it, the plant in the far corner.
  const hints = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: HOUSE_W - 1, z: 0 }]
  for (const [i, o] of owned.entries()) {
    const spot = firstFreeSpot(save, o.uid, hints[i] ?? { x: 0, z: 0 })
    if (spot) save = { ...save, house: { ...save.house, items: [...save.house.items, spot] } }
  }
  return save
}

// ---------------------------------------------------------------- parsing

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const oneOf = <T extends string>(list: { id: T }[], v: unknown): v is T => typeof v === 'string' && list.some(x => x.id === v)
const lvl = (v: unknown): 1 | 2 | 3 | null => (v === 1 || v === 2 || v === 3 ? v : null)

/** A body part list check, shared with the server's profile validation. */
export function parseLookBody(x: unknown): Omit<PersonLook, 'outfit'> | null {
  if (!isObj(x)) return null
  if (!oneOf<SkinId>(SKINS, x.skin) || !oneOf<HairStyleId>(HAIR_STYLES, x.hair) || !oneOf<HairColorId>(HAIR_COLORS, x.hairColor)
    || !oneOf<EyesId>(EYES, x.eyes) || !oneOf<MouthId>(MOUTHS, x.mouth)) return null
  return { skin: x.skin, hair: x.hair, hairColor: x.hairColor, eyes: x.eyes, mouth: x.mouth, cheeks: x.cheeks === true }
}

/**
 * An outfit made of real catalog pieces in their right slots. With `closet`,
 * pieces not owned fall back to the starter piece (required slots) or
 * nothing; without it (another player's profile) any catalog piece counts.
 */
export function parseOutfit(x: unknown, closet?: readonly string[]): Outfit {
  const src = isObj(x) ? x : {}
  // Filled slot by slot; required slots always get a string below.
  const out: Record<ClothingSlot, string | null> = { ...STARTER_OUTFIT }
  for (const slot of SLOTS) {
    const id = src[slot]
    const def = typeof id === 'string' ? clothing(id) : undefined
    const ok = def && def.slot === slot && (!closet || closet.includes(def.id))
    if (ok) out[slot] = def.id
    else if (OPTIONAL_SLOTS.includes(slot)) out[slot] = null
    else out[slot] = fallbackPiece(slot, closet)
  }
  return out as unknown as Outfit
}

export function parseLook(x: unknown, closet?: readonly string[]): PersonLook | null {
  const body = parseLookBody(x)
  if (!body || !isObj(x)) return null
  return { ...body, outfit: parseOutfit(x.outfit, closet) }
}

/** The piece a required slot falls back to: the starter piece if owned, else the first owned piece of the slot. */
function fallbackPiece(slot: ClothingSlot, closet?: readonly string[]): string {
  const starter = STARTER_OUTFIT[slot] as string
  if (!closet || closet.includes(starter)) return starter
  return closet.find(id => clothing(id)?.slot === slot) ?? starter
}

function parseRecord(x: unknown): ContestRecord {
  if (!isObj(x)) return emptyRecord()
  const n = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? Math.min(v, 1e6) : 0)
  const best = typeof x.best === 'number' && Number.isFinite(x.best) && x.best >= 0 ? x.best : null
  return { plays: n(x.plays), wins: n(x.wins), best }
}

/**
 * Reads a save from storage or the profile. Hard on everything: unknown
 * catalog ids are dropped, the starter things put back, persons capped at
 * three with clean names and owned clothes, layout items must be owned and
 * placed by the rules (the rest go back to storage). Null only when it is
 * not a Mini World save at all.
 */
export function parseSave(x: unknown): MiniWorldSave | null {
  if (!isObj(x) || x.v !== 1) return null
  const base = newSave()
  const strings = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.length <= 40).slice(0, max) : [])
  const uniq = (list: string[]) => [...new Set(list)]

  const closet = uniq([...STARTER_CLOSET, ...strings(x.closet, 300).filter(id => clothing(id))])
  const floors = uniq([STARTER_FLOOR, ...strings(x.floors, 100).filter(id => floorDef(id))])
  const walls = uniq([STARTER_WALL, ...strings(x.walls, 100).filter(id => wallDef(id))])

  const owned: OwnedFurniture[] = []
  if (Array.isArray(x.furniture)) {
    for (const f of x.furniture) {
      if (owned.length >= MAX_FURNITURE) break
      if (!isObj(f) || typeof f.uid !== 'string' || !UID_RE.test(f.uid) || !furniture(f.id as string)) continue
      if (owned.some(o => o.uid === f.uid)) continue
      owned.push({ uid: f.uid, id: f.id as string, level: lvl(f.level) ?? 1 })
    }
  } else {
    owned.push(...base.furniture)
  }

  const persons: Person[] = []
  if (Array.isArray(x.persons)) {
    for (const p of x.persons) {
      if (persons.length >= MAX_PERSONS) break
      if (!isObj(p) || typeof p.id !== 'string' || !UID_RE.test(p.id) || persons.some(q => q.id === p.id)) continue
      const name = cleanName(p.name)
      const look = parseLook(p.look, closet)
      if (name && look) persons.push({ id: p.id, name, look })
    }
  }
  const active = persons.some(p => p.id === x.active) ? x.active as string : (persons[0]?.id ?? '')

  const weapons: Weapon[] = []
  if (Array.isArray(x.weapons)) {
    for (const w of x.weapons) {
      if (weapons.length >= MAX_WEAPONS) break
      if (!isObj(w) || typeof w.uid !== 'string' || !UID_RE.test(w.uid) || weapons.some(q => q.uid === w.uid)) continue
      if (!weaponBase(w.base as string) || !weaponMagic(w.magic as string)) continue
      const base = w.base as WeaponBaseId
      const magic = w.magic as WeaponMagicId
      const color = typeof w.color === 'string' && HEX_RE.test(w.color) ? w.color.toLowerCase() : WEAPON_COLORS[0]!
      weapons.push({ uid: w.uid, base, magic, color, level: lvl(w.level) ?? 1, name: weaponName(base, magic) })
    }
  }
  const equipped = weapons.some(w => w.uid === x.equipped) ? x.equipped as string : null

  const c = isObj(x.contests) ? x.contests : {}
  const obby = isObj(c.obby) ? c.obby : {}
  const contests: MiniWorldSave['contests'] = {
    obby: { easy: parseRecord(obby.easy), medium: parseRecord(obby.medium), hard: parseRecord(obby.hard) },
    stars: parseRecord(c.stars),
    fashion: parseRecord(c.fashion),
    memory: parseRecord(c.memory),
  }

  let save: MiniWorldSave = {
    v: 1,
    persons,
    active,
    closet,
    furniture: owned,
    house: { floor: STARTER_FLOOR, wall: STARTER_WALL, items: [] },
    floors,
    walls,
    weapons,
    equipped,
    prizes: uniq(strings(x.prizes, MAX_PRIZES).filter(s => /^[a-z0-9-]{1,40}$/.test(s))),
    contests,
    openedGifts: uniq(strings(x.openedGifts, MAX_OPENED).filter(s => /^[a-z0-9]{4,24}$/.test(s))),
    savedAt: typeof x.savedAt === 'number' && Number.isFinite(x.savedAt) && x.savedAt > 0 ? Math.floor(x.savedAt) : 0,
  }
  save = { ...save, house: parseLayout(x.house, save) }
  return save
}

/**
 * A layout kept to what the save owns and what fits: items are taken in
 * order and each one that breaks a rule goes back to storage (small items
 * after their surfaces, so a vase does not fall off because it came first).
 */
function parseLayout(x: unknown, save: MiniWorldSave): HouseLayout {
  const src = isObj(x) ? x : {}
  const floor = typeof src.floor === 'string' && save.floors.includes(src.floor) ? src.floor : STARTER_FLOOR
  const wall = typeof src.wall === 'string' && save.walls.includes(src.wall) ? src.wall : STARTER_WALL
  const raw = Array.isArray(src.items) ? src.items : []
  const cand: PlacedItem[] = []
  for (const it of raw) {
    const p = parsePlaced(it)
    if (p && !cand.some(q => q.uid === p.uid)) cand.push(p)
  }
  cand.sort((a, b) => (a.on ? 1 : 0) - (b.on ? 1 : 0))
  let state: HouseState = { house: { floor, wall, items: [] }, furniture: save.furniture }
  for (const p of cand) {
    if (canPlace(state, p.uid, p)) state = { ...state, house: { ...state.house, items: [...state.house.items, p] } }
  }
  return state.house
}

function parsePlaced(x: unknown): PlacedItem | null {
  if (!isObj(x) || typeof x.uid !== 'string' || !UID_RE.test(x.uid)) return null
  if (!Number.isInteger(x.x) || !Number.isInteger(x.z)) return null
  const rot = x.rot === 0 || x.rot === 1 || x.rot === 2 || x.rot === 3 ? x.rot : null
  if (rot === null) return null
  const p: PlacedItem = { uid: x.uid, x: x.x as number, z: x.z as number, rot }
  if (typeof x.on === 'string' && UID_RE.test(x.on)) p.on = x.on
  return p
}

// ---------------------------------------------------------------- placement

/** What placement needs: the layout and what each uid is. A MiniWorldSave is one. */
export interface HouseState {
  house: HouseLayout
  furniture: OwnedFurniture[]
}

/**
 * Cells an item covers. Floor, rug and small items: a rectangle of floor
 * cells, x in 0..HOUSE_W, z in 0..HOUSE_D, with odd rotations swapping the
 * size. Wall items: `x` is the position along wall `rot` (0 back, 1 right,
 * 2 front, 3 left; lengths HOUSE_W, HOUSE_D, HOUSE_W, HOUSE_D), `z` must be
 * 0, and the result is the span along that wall (z 0, d 1).
 */
export function footprint(def: FurnitureDef, placed: PlacedItem): { x: number; z: number; w: number; d: number } {
  const [sx, sz] = def.size
  if (def.kind === 'wall') return { x: placed.x, z: 0, w: sx, d: 1 }
  const odd = placed.rot % 2 === 1
  return { x: placed.x, z: placed.z, w: odd ? sz : sx, d: odd ? sx : sz }
}

/** Length of wall `rot` in cells. */
export const wallLength = (rot: number): number => (rot % 2 === 0 ? HOUSE_W : HOUSE_D)

const overlaps = (a: { x: number; z: number; w: number; d: number }, b: { x: number; z: number; w: number; d: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d

const inside = (a: { x: number; z: number; w: number; d: number }, b: { x: number; z: number; w: number; d: number }) =>
  a.x >= b.x && a.z >= b.z && a.x + a.w <= b.x + b.w && a.z + a.d <= b.z + b.d

const defOf = (s: HouseState, uid: string): FurnitureDef | undefined => furniture(s.furniture.find(o => o.uid === uid)?.id)

/** Which layer an item occupies: rugs lie under, things on a surface share only that surface. */
function layerOf(def: FurnitureDef, p: PlacedItem): string {
  if (def.kind === 'wall') return `wall:${p.rot}`
  if (def.kind === 'rug') return 'rug'
  if (def.kind === 'small' && p.on) return `on:${p.on}`
  return 'floor'
}

/**
 * True when owned item `uid` may stand at `placed`, given everything else
 * in the layout (itself and anything standing on it, which moves with it,
 * are ignored). Rules: inside the room or along a wall; rugs lie under
 * floor things but not on other rugs; small things may stand on a
 * `surface` item (`on`) within its top; wall things do not overlap on
 * the same wall.
 */
export function canPlace(s: HouseState, uid: string, placed: PlacedItem): boolean {
  const def = defOf(s, uid)
  if (!def || placed.uid !== uid) return false
  if (!Number.isInteger(placed.x) || !Number.isInteger(placed.z)) return false
  const fp = footprint(def, placed)
  if (def.kind === 'wall') {
    if (placed.z !== 0 || placed.on) return false
    if (fp.x < 0 || fp.x + fp.w > wallLength(placed.rot)) return false
  } else {
    if (fp.x < 0 || fp.z < 0 || fp.x + fp.w > HOUSE_W || fp.z + fp.d > HOUSE_D) return false
    if (placed.on) {
      if (def.kind !== 'small') return false
      const base = s.house.items.find(i => i.uid === placed.on)
      const baseDef = base && defOf(s, base.uid)
      if (!base || !baseDef || baseDef.surface === undefined || base.on || base.uid === uid) return false
      if (!inside(fp, footprint(baseDef, base))) return false
    }
  }
  const layer = layerOf(def, placed)
  for (const other of s.house.items) {
    if (other.uid === uid || other.on === uid) continue
    const od = defOf(s, other.uid)
    if (!od || layerOf(od, other) !== layer) continue
    if (overlaps(fp, footprint(od, other))) return false
  }
  return true
}

/**
 * A free spot for owned item `uid` (placed or not), nearest to `near`
 * (default: the back-left corner). Small things try the floor first, then
 * the tops of tables and shelves. Wall things try the back wall, then
 * left, right and front. Null when the room is full.
 */
export function firstFreeSpot(s: HouseState, uid: string, near?: { x: number; z: number }): PlacedItem | null {
  const def = defOf(s, uid)
  if (!def) return null
  const without: HouseState = { ...s, house: { ...s.house, items: s.house.items.filter(i => i.uid !== uid && i.on !== uid) } }
  const cands: PlacedItem[] = []
  if (def.kind === 'wall') {
    for (const rot of [0, 3, 1, 2] as const) {
      for (let x = 0; x + def.size[0] <= wallLength(rot); x++) cands.push({ uid, x, z: 0, rot })
    }
    return cands.find(c => canPlace(without, uid, c)) ?? null
  }
  const n = near ?? { x: 0, z: 0 }
  for (const rot of [0, 1] as const) {
    for (let z = 0; z < HOUSE_D; z++) for (let x = 0; x < HOUSE_W; x++) cands.push({ uid, x, z, rot })
  }
  const dist = (c: PlacedItem) => Math.abs(c.x - n.x) + Math.abs(c.z - n.z) + c.rot * 0.5
  cands.sort((a, b) => dist(a) - dist(b))
  const onFloor = cands.find(c => canPlace(without, uid, c))
  if (onFloor) return onFloor
  if (def.kind === 'small') {
    for (const base of without.house.items) {
      const bd = defOf(without, base.uid)
      if (!bd || bd.surface === undefined || base.on) continue
      const fp = footprint(bd, base)
      for (let z = fp.z; z < fp.z + fp.d; z++) {
        for (let x = fp.x; x < fp.x + fp.w; x++) {
          const c: PlacedItem = { uid, x, z, rot: 0, on: base.uid }
          if (canPlace(without, uid, c)) return c
        }
      }
    }
  }
  return null
}

/**
 * Places or moves owned item `uid`. Things standing on it move by the same
 * offset; after a turn, or if they no longer fit, they go to storage.
 */
export function placeItem<S extends HouseState>(s: S, uid: string, placed: PlacedItem): S | SaveError {
  if (!canPlace(s, uid, placed)) return 'bad-place'
  const before = s.house.items.find(i => i.uid === uid)
  let items = s.house.items.filter(i => i.uid !== uid)
  const riders = items.filter(i => i.on === uid)
  items = items.filter(i => i.on !== uid)
  items.push(placed)
  let next: S = { ...s, house: { ...s.house, items } }
  if (before && before.rot === placed.rot) {
    for (const r of riders) {
      const moved: PlacedItem = { ...r, x: r.x + placed.x - before.x, z: r.z + placed.z - before.z }
      if (canPlace(next, r.uid, moved)) next = { ...next, house: { ...next.house, items: [...next.house.items, moved] } }
    }
  }
  return next
}

/** Takes an item (and anything on it) back to storage. */
export function storeItem<S extends HouseState>(s: S, uid: string): S {
  return { ...s, house: { ...s.house, items: s.house.items.filter(i => i.uid !== uid && i.on !== uid) } }
}

/** Owned furniture not in the house. */
export function stored(s: HouseState): OwnedFurniture[] {
  const placed = new Set(s.house.items.map(i => i.uid))
  return s.furniture.filter(o => !placed.has(o.uid))
}

/** Checks a whole layout from the house editor: owned floor, wall and items, every rule. */
export function setLayout(save: MiniWorldSave, layout: HouseLayout): MiniWorldSave | SaveError {
  if (!save.floors.includes(layout.floor) || !save.walls.includes(layout.wall)) return 'not-owned'
  const seen = new Set<string>()
  for (const it of layout.items) {
    if (seen.has(it.uid)) return 'bad-place'
    seen.add(it.uid)
    if (!save.furniture.some(o => o.uid === it.uid)) return 'not-owned'
  }
  const state: HouseState = { house: { floor: layout.floor, wall: layout.wall, items: layout.items.map(i => ({ ...i })) }, furniture: save.furniture }
  for (const it of state.house.items) {
    // Each item against all the others (canPlace skips itself and its riders).
    if (!canPlace(state, it.uid, it)) return 'bad-place'
  }
  return { ...save, house: state.house }
}

// ---------------------------------------------------------------- persons

const personOf = (save: MiniWorldSave, id: string) => save.persons.find(p => p.id === id)

export function activePerson(save: MiniWorldSave): Person | null {
  return personOf(save, save.active) ?? null
}

/** A new person in the starter outfit, made active. */
export function createPerson(save: MiniWorldSave, name: string, look?: Partial<Omit<PersonLook, 'outfit'>>): MiniWorldSave | SaveError {
  if (save.persons.length >= MAX_PERSONS) return 'full'
  const clean = cleanName(name)
  if (!clean) return 'bad-name'
  const body = parseLookBody({ ...defaultLook(), ...look })
  if (!body) return 'bad-look'
  const id = newUid(save.persons.map(p => p.id))
  const person: Person = { id, name: clean, look: { ...body, outfit: parseOutfit(STARTER_OUTFIT, save.closet) } }
  return { ...save, persons: [...save.persons, person], active: id }
}

export function updatePerson(save: MiniWorldSave, id: string, patch: { name?: string; look?: Partial<Omit<PersonLook, 'outfit'>> }): MiniWorldSave | SaveError {
  const p = personOf(save, id)
  if (!p) return 'no-person'
  let name = p.name
  if (patch.name !== undefined) {
    const clean = cleanName(patch.name)
    if (!clean) return 'bad-name'
    name = clean
  }
  let look = p.look
  if (patch.look) {
    const { outfit: _ignored, ...current } = p.look
    const body = parseLookBody({ ...current, ...patch.look })
    if (!body) return 'bad-look'
    look = { ...body, outfit: p.look.outfit }
  }
  return { ...save, persons: save.persons.map(q => (q.id === id ? { ...q, name, look } : q)) }
}

export function deletePerson(save: MiniWorldSave, id: string): MiniWorldSave | SaveError {
  if (!personOf(save, id)) return 'no-person'
  const persons = save.persons.filter(p => p.id !== id)
  const active = save.active === id ? (persons[0]?.id ?? '') : save.active
  return { ...save, persons, active }
}

export function setActive(save: MiniWorldSave, id: string): MiniWorldSave | SaveError {
  if (!personOf(save, id)) return 'no-person'
  return { ...save, active: id }
}

/** Puts an owned piece on a person; null takes a hat, face or back piece off. */
export function dress(save: MiniWorldSave, personId: string, slot: ClothingSlot, id: string | null): MiniWorldSave | SaveError {
  const p = personOf(save, personId)
  if (!p) return 'no-person'
  if (id === null) {
    if (!OPTIONAL_SLOTS.includes(slot)) return 'wrong-slot'
  } else {
    const def = clothing(id)
    if (!def) return 'unknown'
    if (def.slot !== slot) return 'wrong-slot'
    if (!save.closet.includes(id)) return 'not-owned'
  }
  const outfit = { ...p.look.outfit, [slot]: id } as Outfit
  return { ...save, persons: save.persons.map(q => (q.id === personId ? { ...q, look: { ...q.look, outfit } } : q)) }
}

// ---------------------------------------------------------------- buying

const forSale = (rarity: string) => rarity === 'shop'

export function buyClothing(save: MiniWorldSave, id: string): MiniWorldSave | SaveError {
  const def = clothing(id)
  if (!def) return 'unknown'
  if (save.closet.includes(id)) return 'owned'
  if (!forSale(def.rarity)) return 'not-for-sale'
  return { ...save, closet: [...save.closet, id] }
}

/** Adds a new piece of furniture (level 1) to storage. The new uid is the last in `furniture`. */
export function buyFurniture(save: MiniWorldSave, id: string): MiniWorldSave | SaveError {
  const def = furniture(id)
  if (!def) return 'unknown'
  if (!forSale(def.rarity)) return 'not-for-sale'
  return addFurniture(save, id, 1)
}

function addFurniture(save: MiniWorldSave, id: string, level: 1 | 2 | 3): MiniWorldSave | SaveError {
  if (save.furniture.length >= MAX_FURNITURE) return 'too-many'
  const uid = newUid([...save.furniture.map(o => o.uid), ...save.weapons.map(w => w.uid)])
  return { ...save, furniture: [...save.furniture, { uid, id, level }] }
}

export function buyFloor(save: MiniWorldSave, id: string): MiniWorldSave | SaveError {
  if (!floorDef(id)) return 'unknown'
  if (save.floors.includes(id)) return 'owned'
  return { ...save, floors: [...save.floors, id] }
}

export function buyWall(save: MiniWorldSave, id: string): MiniWorldSave | SaveError {
  if (!wallDef(id)) return 'unknown'
  if (save.walls.includes(id)) return 'owned'
  return { ...save, walls: [...save.walls, id] }
}

export function setSurface(save: MiniWorldSave, kind: 'floor' | 'wall', id: string): MiniWorldSave | SaveError {
  const owned = kind === 'floor' ? save.floors : save.walls
  if (!(kind === 'floor' ? floorDef(id) : wallDef(id))) return 'unknown'
  if (!owned.includes(id)) return 'not-owned'
  return { ...save, house: { ...save.house, [kind]: id } }
}

// ---------------------------------------------------------------- workshop

export function upgradeFurniture(save: MiniWorldSave, uid: string): MiniWorldSave | SaveError {
  const o = save.furniture.find(f => f.uid === uid)
  if (!o) return 'not-owned'
  if (o.level >= 3) return 'max-level'
  const level = (o.level + 1) as 2 | 3
  return { ...save, furniture: save.furniture.map(f => (f.uid === uid ? { ...f, level } : f)) }
}

export function upgradeWeapon(save: MiniWorldSave, uid: string): MiniWorldSave | SaveError {
  const w = save.weapons.find(x => x.uid === uid)
  if (!w) return 'not-owned'
  if (w.level >= 3) return 'max-level'
  const level = (w.level + 1) as 2 | 3
  return { ...save, weapons: save.weapons.map(x => (x.uid === uid ? { ...x, level } : x)) }
}

/** A new level-1 weapon, named from its parts. The new uid is the last in `weapons`. */
export function craftWeapon(save: MiniWorldSave, base: WeaponBaseId, magic: WeaponMagicId, color: string): MiniWorldSave | SaveError {
  if (!weaponBase(base) || !weaponMagic(magic) || !HEX_RE.test(color)) return 'unknown'
  if (save.weapons.length >= MAX_WEAPONS) return 'too-many'
  const uid = newUid([...save.furniture.map(o => o.uid), ...save.weapons.map(w => w.uid)])
  const weapon: Weapon = { uid, base, magic, color: color.toLowerCase(), level: 1, name: weaponName(base, magic) }
  return { ...save, weapons: [...save.weapons, weapon] }
}

export function equip(save: MiniWorldSave, uid: string | null): MiniWorldSave | SaveError {
  if (uid !== null && !save.weapons.some(w => w.uid === uid)) return 'not-owned'
  return { ...save, equipped: uid }
}

// ---------------------------------------------------------------- gifts

/** Only everyday things travel: basic and shop pieces, never prizes or royal clothes. */
export function isGiftable(kind: 'clothing' | 'furniture', id: string): boolean {
  const def = kind === 'clothing' ? clothing(id) : furniture(id)
  return !!def && (def.rarity === 'basic' || def.rarity === 'shop')
}

/**
 * Gives away a clothing id (it leaves the closet and every person wearing
 * it changes to the starter piece, or another owned piece of the slot, or
 * nothing) or a furniture uid (it leaves the house; what stood on it goes
 * to storage). The last piece of a slot a person must wear stays.
 */
export function giveAway(save: MiniWorldSave, kind: 'clothing' | 'furniture', idOrUid: string): MiniWorldSave | SaveError {
  if (kind === 'furniture') {
    const o = save.furniture.find(f => f.uid === idOrUid)
    if (!o) return 'not-owned'
    if (!isGiftable('furniture', o.id)) return 'not-giftable'
    const next = storeItem(save, idOrUid)
    return { ...next, furniture: next.furniture.filter(f => f.uid !== idOrUid) }
  }
  const def = clothing(idOrUid)
  if (!def) return 'unknown'
  if (!save.closet.includes(idOrUid)) return 'not-owned'
  if (!isGiftable('clothing', idOrUid)) return 'not-giftable'
  const closet = save.closet.filter(id => id !== idOrUid)
  const required = REQUIRED_SLOTS.includes(def.slot)
  if (required && !closet.some(id => clothing(id)?.slot === def.slot)) return 'last-piece'
  const persons = save.persons.map((p) => {
    if (p.look.outfit[def.slot] !== idOrUid) return p
    const replacement = required ? fallbackPiece(def.slot, closet) : null
    return { ...p, look: { ...p.look, outfit: { ...p.look.outfit, [def.slot]: replacement } as Outfit } }
  })
  return { ...save, closet, persons }
}

/**
 * Takes an opened gift in: clothing to the closet (already owned: nothing
 * more), furniture as a new uid with the level it had. Bits are credited
 * by the server; here a bits gift is only remembered. 'opened' when this
 * gift id was taken in before.
 */
export function receiveGift(save: MiniWorldSave, gift: Gift): MiniWorldSave | SaveError {
  if (save.openedGifts.includes(gift.id)) return 'opened'
  const openedGifts = [...save.openedGifts, gift.id].slice(-MAX_OPENED)
  let next: MiniWorldSave = { ...save, openedGifts }
  if (gift.kind === 'clothing') {
    if (!gift.item || !clothing(gift.item)) return 'unknown'
    if (!next.closet.includes(gift.item)) next = { ...next, closet: [...next.closet, gift.item] }
  } else if (gift.kind === 'furniture') {
    if (!gift.item || !furniture(gift.item)) return 'unknown'
    const added = addFurniture(next, gift.item, lvl(gift.level) ?? 1)
    if (isSaveError(added)) return added
    next = added
  }
  return next
}

/**
 * Gives prizes once each: clothing ids to the closet, furniture ids as a
 * new level-1 uid (to storage), anything else (like 'welcome') is only
 * remembered. Ids already in `prizes` are skipped.
 */
export function grantPrizes(save: MiniWorldSave, ids: string[]): MiniWorldSave {
  let next = save
  for (const id of ids) {
    if (next.prizes.includes(id) || !/^[a-z0-9-]{1,40}$/.test(id)) continue
    if (clothing(id)) {
      if (!next.closet.includes(id)) next = { ...next, closet: [...next.closet, id] }
    } else if (furniture(id)) {
      const added = addFurniture(next, id, 1)
      if (isSaveError(added)) continue
      next = added
    }
    next = { ...next, prizes: [...next.prizes, id].slice(-MAX_PRIZES) }
  }
  return next
}

// ---------------------------------------------------------------- what others see

/** The profile others see: the active person and the house (with what each placed uid is). */
export function publicData(save: MiniWorldSave): {
  person: { name: string; look: PersonLook } | null
  house: HouseLayout
  levels: Record<string, 1 | 2 | 3>
  kinds: Record<string, string>
} {
  const p = activePerson(save)
  const placed = new Set(save.house.items.map(i => i.uid))
  const levels: Record<string, 1 | 2 | 3> = {}
  const kinds: Record<string, string> = {}
  for (const o of save.furniture) {
    if (!placed.has(o.uid)) continue
    levels[o.uid] = o.level
    kinds[o.uid] = o.id
  }
  return { person: p ? { name: p.name, look: p.look } : null, house: save.house, levels, kinds }
}

/**
 * Checks another player's published house: floor and wall from the
 * catalog, every item known in `kinds`, placed by the rules. Items that
 * break a rule are dropped. Used by the server.
 */
export function cleanPublicHouse(x: unknown, kinds: Record<string, string>, levels: Record<string, number>): HouseLayout | null {
  if (!isObj(x)) return null
  const owned: OwnedFurniture[] = Object.entries(kinds)
    .filter(([uid, id]) => UID_RE.test(uid) && furniture(id))
    .slice(0, MAX_FURNITURE)
    .map(([uid, id]) => ({ uid, id, level: lvl(levels[uid]) ?? 1 }))
  const floor = typeof x.floor === 'string' && floorDef(x.floor) ? x.floor : STARTER_FLOOR
  const wall = typeof x.wall === 'string' && wallDef(x.wall) ? x.wall : STARTER_WALL
  const pseudo = { ...newSave(), furniture: owned, floors: [floor], walls: [wall] }
  return parseLayout({ ...x, floor, wall }, pseudo)
}
