import { ref, computed, watch, type ComputedRef, type Ref } from 'vue'
import type {
  MiniWorldSave, Person, PersonLook, ClothingSlot, HouseLayout, Gift, RoyalTitle,
  WeaponBaseId, WeaponMagicId,
} from '~/themes/miniworld/types'
import { clothing, furniture, floorDef, wallDef, weaponBase, weaponMagic, upgradeCost as catalogUpgradeCost } from '~/themes/miniworld/catalog'
import * as core from '~/themes/miniworld/core/save'
import { isSaveError, SAVE_ERROR_TEXT, type SaveError } from '~/themes/miniworld/core/save'
import { finishContest as scoreContest, type ContestResult, type ContestOutcome } from '~/themes/miniworld/core/contests'
import { royalPrizes } from '~/themes/miniworld/core/royal'
import { writeHeroColors } from '~/themes/miniworld/core/outfit'
import { HERO_COLORS_KEY } from '~/themes/miniworld/types'
import { useWallet, syncWallet } from '~/composables/useWallet'
import { useGameSave } from '~/composables/useGameSave'
import { useLeaderboard } from '~/composables/useLeaderboard'
import { publishProfile } from '~/composables/useMiniWorldSocial'

/**
 * Mini World's game state for the UI (2026-09-26): the save from
 * core/save.ts as reactive state, with every action wrapped so it pays
 * from the site wallet and persists. The save lives in localStorage
 * `miniworld.save` (written at once) and in the profile slot `miniworld`
 * (debounced; newest `savedAt` wins, like Neon Shrine's profileSync). The
 * UI codes against `MiniWorldApi`; the implementation follows it.
 */

/** Why an action did not happen: 'poor' (not enough bits) or a rule from core/save.ts. */
export type MwFail = 'poor' | SaveError

/** Every action answers this; `message` is Norwegian, ready to show the child. */
export type ActionResult =
  | { ok: true; /** The new furniture or weapon uid, for buy/craft/receive. */ uid?: string }
  | { ok: false; error: MwFail; message: string }

/** The body parts of a look (everything but the outfit, which `dress` changes). */
export type LookBody = Omit<PersonLook, 'outfit'>

export interface MiniWorldApi {
  /** The save. Read it; change it only through the actions. */
  save: Readonly<Ref<MiniWorldSave>>
  /** The person you play, or null before the first person exists. */
  active: ComputedRef<Person | null>
  /** The wallet balance (site-wide bits), live. */
  bits: Ref<number>
  /** True once the local save is loaded and the profile has answered (or timed out). Wait for it before play. */
  ready: Ref<boolean>

  // --- people
  /** Makes a person in the starter outfit and plays as them. 'full' at three, 'bad-name'. The first person ever brings the 50-bit welcome. */
  createPerson(name: string, look?: Partial<LookBody>): ActionResult
  /** Renames and/or changes body parts. */
  updatePerson(id: string, patch: { name?: string; look?: Partial<LookBody> }): ActionResult
  /** Removes a person; if they were active, the next one takes over. */
  deletePerson(id: string): ActionResult
  setActive(id: string): ActionResult
  /** Puts an owned piece on a person (null takes off a hat, face or back piece). */
  dress(personId: string, slot: ClothingSlot, clothingId: string | null): ActionResult

  // --- shops (price checked and paid here)
  buyClothing(id: string): ActionResult
  /** The new piece goes to storage; `uid` in the result. */
  buyFurniture(id: string): ActionResult
  buyFloor(id: string): ActionResult
  buyWall(id: string): ActionResult
  /** Lays an owned floor or wallpaper. */
  setSurface(kind: 'floor' | 'wall', id: string): ActionResult

  // --- house
  /** Takes the house editor's layout after a move, turn or store (validated). */
  setLayout(layout: HouseLayout): ActionResult

  // --- workshop
  /** Bits to take a furniture uid or weapon uid one level up, or null at level 3 / unknown. */
  upgradeCost(kind: 'furniture' | 'weapon', uid: string): number | null
  upgradeFurniture(uid: string): ActionResult
  upgradeWeapon(uid: string): ActionResult
  /** Bits a new weapon costs (base + magic). */
  weaponCost(base: WeaponBaseId, magic: WeaponMagicId): number
  /** Makes (and pays for) a weapon; `uid` in the result. It is not equipped automatically. */
  craftWeapon(base: WeaponBaseId, magic: WeaponMagicId, color: string): ActionResult
  /** Weapon in hand, or null. */
  equip(uid: string | null): ActionResult

  // --- contests
  /** Records a finished contest, pays its bits and gives first-win prizes. */
  finishContest(result: ContestResult): ContestOutcome
  /** Bits from a popped balloon or similar small find. */
  earn(n: number, reason: string): void

  // --- gifts and titles (useMiniWorldSocial calls these; the UI rarely needs to)
  /** Checks that a gift can leave (without changing anything). */
  canGiveAway(kind: 'clothing' | 'furniture', idOrUid: string): ActionResult
  /** Removes a clothing id or furniture uid that was sent as a gift. */
  giveAway(kind: 'clothing' | 'furniture', idOrUid: string): ActionResult
  /** Takes an opened gift in (clothing to the closet, furniture to storage; bits are the server's). */
  receive(gift: Gift): ActionResult
  /** Gives a royal title's clothes and banner once. */
  applyTitle(title: RoyalTitle | null): string[]

  /** Writes the profile copy now (the UI calls it when leaving the game). */
  flush(): void
}

const LOCAL_KEY = 'miniworld.save'
const PUSH_DELAY_MS = 2000
/** How long the first load waits for the profile before playing on the local save. */
const PULL_TIMEOUT_MS = 3000
/** A profile that has not answered by then is taken as offline (pushes may go). */
const PULL_GIVE_UP_MS = 20_000
const WELCOME_BITS = 50
const POOR_TEXT = 'Du har ikke nok bits.'

function readLocal(): MiniWorldSave | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? core.parseSave(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function writeLocal(save: MiniWorldSave): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(save))
  } catch {
    // storage full or unavailable: the profile copy still goes up
  }
}

const fail = (error: MwFail): ActionResult =>
  ({ ok: false, error, message: error === 'poor' ? POOR_TEXT : SAVE_ERROR_TEXT[error] })

let shared: MiniWorldApi | null = null

/**
 * The shared game state (one per page). Call it first from a component's
 * setup: the profile sync needs the Nuxt app.
 */
export function useMiniWorld(): MiniWorldApi {
  if (typeof window === 'undefined') return build(false)
  return (shared ??= build(true))
}

function build(client: boolean): MiniWorldApi {
  const save = ref<MiniWorldSave>((client && readLocal()) || core.newSave()) as Ref<MiniWorldSave>
  const ready = ref(!client)
  const wallet = useWallet()
  const profile = useGameSave('miniworld')
  const { ensurePlayer } = useLeaderboard()

  const active = computed(() => core.activePerson(save.value))

  // --- persistence

  /** Pushes wait until the profile has answered once, so a fresh tab cannot overwrite a newer profile copy. */
  let pulled = !client
  let pushTimer: ReturnType<typeof setTimeout> | null = null
  let dirty = false
  let playerAsked = false

  function pushNow(): void {
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null }
    if (!dirty || !pulled || !save.value.persons.length) return
    dirty = false
    profile.push({ data: save.value, savedAt: save.value.savedAt })
  }

  function schedulePush(): void {
    dirty = true
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(pushNow, PUSH_DELAY_MS)
  }

  /** Makes a new save the state: stamped, stored locally at once, the profile later. */
  function commit(next: MiniWorldSave): void {
    const stamped = { ...next, savedAt: Math.max(Date.now(), save.value.savedAt + 1) }
    save.value = stamped
    if (!client) return
    writeLocal(stamped)
    if (!stamped.persons.length) return
    // The first real save makes the player, so the wallet and the neighbourhood have one.
    if (!playerAsked && !profile.hasPlayer()) {
      playerAsked = true
      // With the player: pending bits go up, and others can see the person (the watcher below skipped it without a player).
      void ensurePlayer()
        .then(() => {
          void syncWallet()
          if (save.value.persons.length) publishProfile(core.publicData(save.value))
        })
        .catch(() => { playerAsked = false })
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
        // Play on the local save meanwhile, but push nothing until the profile has answered:
        // a fresh or broken local save must not overwrite the profile's copy.
        ready.value = true
        remote = await Promise.race([pull, new Promise<'offline'>(resolve => setTimeout(() => resolve('offline'), PULL_GIVE_UP_MS))])
      }
      if (remote === 'offline') return
      const local = save.value
      const theirs = remote?.data ? core.parseSave(remote.data) : null
      if (remote && theirs && remote.savedAt > base) {
        save.value = { ...theirs, savedAt: Math.max(remote.savedAt, local.savedAt) }
        writeLocal(save.value)
      } else if (local.persons.length && (!remote || remote.savedAt < local.savedAt)) {
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
    // Another tab of the game saved: take its newer copy.
    window.addEventListener('storage', (e) => {
      if (e.key !== LOCAL_KEY || !e.newValue) return
      try {
        const theirs = core.parseSave(JSON.parse(e.newValue))
        if (theirs && theirs.savedAt > save.value.savedAt) save.value = theirs
      } catch { /* a half-written value: the next write fixes it */ }
    })
    // Neon Shrine's hero wears the active person; with nobody left it goes back to its own clothes.
    watch(() => active.value?.look, (look) => {
      if (look) writeHeroColors(look)
      else try { localStorage.removeItem(HERO_COLORS_KEY) } catch { /* no storage */ }
    }, { immediate: true, deep: true })
    // What others see: published when it changes (the social composable debounces).
    watch(
      () => (save.value.persons.length ? JSON.stringify(core.publicData(save.value)) : ''),
      (json) => { if (json && profile.hasPlayer()) publishProfile(JSON.parse(json)) },
      { immediate: true },
    )
  }

  // --- action helpers

  /** Commits a pure action's result. */
  function run(r: MiniWorldSave | SaveError, uid?: string): ActionResult {
    if (isSaveError(r)) return fail(r)
    commit(r)
    return uid ? { ok: true, uid } : { ok: true }
  }

  /** Checks the action first, then takes the bits, then commits: nothing is paid for a refusal. */
  function paid(price: number, reason: string, r: MiniWorldSave | SaveError, uid?: string): ActionResult {
    if (isSaveError(r)) return fail(r)
    if (!wallet.spend(price, reason)) return fail('poor')
    commit(r)
    return uid ? { ok: true, uid } : { ok: true }
  }

  const lastUid = (list: { uid: string }[]) => list[list.length - 1]?.uid

  function upgradeCost(kind: 'furniture' | 'weapon', uid: string): number | null {
    if (kind === 'furniture') {
      const o = save.value.furniture.find(f => f.uid === uid)
      const def = furniture(o?.id)
      return o && def && o.level < 3 ? catalogUpgradeCost(def.price, o.level as 1 | 2) : null
    }
    const w = save.value.weapons.find(x => x.uid === uid)
    return w && w.level < 3 ? catalogUpgradeCost(weaponCost(w.base, w.magic), w.level as 1 | 2) : null
  }

  function weaponCost(base: WeaponBaseId, magic: WeaponMagicId): number {
    return (weaponBase(base)?.price ?? 0) + (weaponMagic(magic)?.price ?? 0)
  }

  function applyTitle(title: RoyalTitle | null): string[] {
    if (!title) return []
    const fresh = royalPrizes(title).filter(id => !save.value.prizes.includes(id))
    if (fresh.length) commit(core.grantPrizes(save.value, fresh))
    return fresh
  }

  return {
    save,
    active,
    bits: wallet.bits,
    ready,

    createPerson(name, look) {
      const r = core.createPerson(save.value, name, look)
      if (isSaveError(r)) return fail(r)
      if (!r.prizes.includes('welcome')) {
        commit(core.grantPrizes(r, ['welcome']))
        wallet.earn(WELCOME_BITS, 'mw:welcome')
      } else {
        commit(r)
      }
      return { ok: true }
    },
    updatePerson: (id, patch) => run(core.updatePerson(save.value, id, patch)),
    deletePerson: id => run(core.deletePerson(save.value, id)),
    setActive: id => run(core.setActive(save.value, id)),
    dress: (personId, slot, id) => run(core.dress(save.value, personId, slot, id)),

    buyClothing: id => paid(clothing(id)?.price ?? 0, 'mw:clothes', core.buyClothing(save.value, id)),
    buyFurniture(id) {
      const r = core.buyFurniture(save.value, id)
      return paid(furniture(id)?.price ?? 0, 'mw:furniture', r, isSaveError(r) ? undefined : lastUid(r.furniture))
    },
    buyFloor: id => paid(floorDef(id)?.price ?? 0, 'mw:floor', core.buyFloor(save.value, id)),
    buyWall: id => paid(wallDef(id)?.price ?? 0, 'mw:wall', core.buyWall(save.value, id)),
    setSurface: (kind, id) => run(core.setSurface(save.value, kind, id)),

    setLayout: layout => run(core.setLayout(save.value, layout)),

    upgradeCost,
    upgradeFurniture(uid) {
      const cost = upgradeCost('furniture', uid)
      const r = core.upgradeFurniture(save.value, uid)
      return paid(cost ?? 0, 'mw:upgrade', r)
    },
    upgradeWeapon(uid) {
      const cost = upgradeCost('weapon', uid)
      const r = core.upgradeWeapon(save.value, uid)
      return paid(cost ?? 0, 'mw:upgrade', r)
    },
    weaponCost,
    craftWeapon(base, magic, color) {
      const r = core.craftWeapon(save.value, base, magic, color)
      return paid(weaponCost(base, magic), 'mw:weapon', r, isSaveError(r) ? undefined : lastUid(r.weapons))
    },
    equip: uid => run(core.equip(save.value, uid)),

    finishContest(result) {
      const outcome = scoreContest(save.value, result)
      commit(outcome.save)
      if (outcome.bits > 0) wallet.earn(outcome.bits, `mw:${result.contest}`)
      return { ...outcome, save: save.value }
    },
    earn: (n, reason) => wallet.earn(n, reason),

    canGiveAway(kind, idOrUid) {
      const r = core.giveAway(save.value, kind, idOrUid)
      return isSaveError(r) ? fail(r) : { ok: true }
    },
    giveAway: (kind, idOrUid) => run(core.giveAway(save.value, kind, idOrUid)),
    receive(gift) {
      const r = core.receiveGift(save.value, gift)
      if (isSaveError(r)) return fail(r)
      commit(r)
      // The server credited a bits gift when it was opened: fetch the balance.
      if (gift.kind === 'bits') void syncWallet()
      return gift.kind === 'furniture' ? { ok: true, uid: lastUid(r.furniture) } : { ok: true }
    },
    applyTitle,

    flush: pushNow,
  }
}
