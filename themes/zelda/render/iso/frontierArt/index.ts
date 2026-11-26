import { loadKit, type PackedKit } from '../artPack'

type Kit = PackedKit

/**
 * Each realm's scenery is an art pack of its own (`../artPack.ts`, pinned in `../artIndex.ts`), fetched the first time
 * the view needs it, so a visit to the town never downloads the lands' art. A realm with a gate arch has its arches
 * (`gate_<realm>_<road>_<off|on>`, `gates.ts`) in its own pack. The isometric renderer puts the current map's kits on
 * the GPU (`view.ts`, `kitsFor`); until they are here their landmarks are not drawn.
 * `coast` is the hand-made maps' waymarks and barriers by the gates. The packs are baked by
 * `scripts/zelda-lab/art-pack.mjs` (docs/games/neon-shrine.md, "The art packs").
 */
export const REALM_ART_LOADERS: Record<string, () => Promise<Kit>> = {
  fogstage: () => loadKit('fogstage'),
  rerun: () => loadKit('rerun'),
  sporelight: () => loadKit('sporelight'),
  stillsand: () => loadKit('stillsand'),
  lumenby: () => loadKit('quarry'),
  underglow: () => loadKit('underglow'),
  seterfell: () => loadKit('seter'),
  yulefjord: () => loadKit('fjord'),
  meadow: () => loadKit('meadow'),
  landing: () => loadKit('landing'),
  coast: () => loadKit('coast'),
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

/**
 * The kits a map draws its landmarks from: its realm's, any it names besides (`MapDef.kits`), and on a hand-made
 * map with the gates' waymarks and barriers, the coast's (`coast`). Empty for a map with none.
 */
export function kitsFor(def: { realm?: string; kits?: readonly string[]; isoLandmarks?: ReadonlyArray<{ art: string }> } | null | undefined): string[] {
  const out = [def?.realm, ...(def?.kits ?? [])]
  if (def?.isoLandmarks?.some(lm => lm.art.startsWith('waymark_') || lm.art.startsWith('border_'))) out.push('coast')
  return [...new Set(out.filter(hasRealmArt))]
}
