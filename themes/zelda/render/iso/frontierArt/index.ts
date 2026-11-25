import type { ThingArt } from '../thingArt'

type Kit = Record<string, ThingArt>

/**
 * Each realm's scenery is a chunk of its own, fetched the first time the view needs it (or a neighbour of where
 * the hero is: `warmRealmArt`), so a visit to the town never downloads the frontier's art. The isometric renderer
 * only puts the current realm's kit on the GPU (`view.ts`); until it is here that realm's landmarks are not drawn.
 */
export const REALM_ART_LOADERS: Record<string, () => Promise<Kit>> = {
  fogstage: () => import('./fogstageData').then(m => m.FOGSTAGE_ART),
  rerun: () => import('./rerunData').then(m => m.RERUN_ART),
  sporelight: () => import('./sporelightData').then(m => m.SPORELIGHT_ART),
  stillsand: () => import('./stillsandData').then(m => m.STILLSAND_ART),
  lumenby: () => import('./quarryData').then(m => m.QUARRY_ART),
  underglow: () => import('./underglowData').then(m => m.UNDERGLOW_ART),
  seterfell: () => import('./seterData').then(m => m.SETER_ART),
  yulefjord: () => import('./fjordData').then(m => m.FJORD_ART),
}

/** A fetch that failed (offline) is tried again after this long, not every frame. */
const RETRY_MS = 10_000

const loaded = new Map<string, Kit>()
const pending = new Map<string, Promise<Kit | undefined>>()
const failedAt = new Map<string, number>()

/** Does this realm have a kit of its own (whether or not it is here yet)? */
export const hasRealmArt = (realm: string | undefined): realm is string => !!realm && Object.prototype.hasOwnProperty.call(REALM_ART_LOADERS, realm)

/** Fetch a realm's kit; resolves to it, or undefined for a realm with none or a fetch that failed. */
export function loadRealmArt(realm: string | undefined): Promise<Kit | undefined> {
  if (!hasRealmArt(realm)) return Promise.resolve(undefined)
  const have = loaded.get(realm)
  if (have) return Promise.resolve(have)
  let p = pending.get(realm)
  if (!p) {
    p = REALM_ART_LOADERS[realm]!().then(
      kit => { loaded.set(realm, kit); pending.delete(realm); return kit },
      () => { failedAt.set(realm, Date.now()); pending.delete(realm); return undefined },
    )
    pending.set(realm, p)
  }
  return p
}

/** A realm's kit if it is here; otherwise undefined, and its fetch is started (once, or again after a failure). */
export function realmArt(realm: string | undefined): Kit | undefined {
  if (!hasRealmArt(realm)) return undefined
  const have = loaded.get(realm)
  if (have) return have
  const failed = failedAt.get(realm)
  if (!pending.has(realm) && (failed === undefined || Date.now() - failed > RETRY_MS)) void loadRealmArt(realm)
  return undefined
}

/** Start fetching a realm's kit ahead of need (a neighbouring region's), without waiting for it. */
export function warmRealmArt(realm: string | undefined): void { realmArt(realm) }
