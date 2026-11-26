/**
 * The iso art packs, loaded (ART-PLAN phase 3b): the stalls (part 26), the machines (part 25) and each realm's kit with
 * its gate arches. A pack is two PNGs in the fixer art library, pinned in `artIndex.ts` by URL and sha256: an albedo
 * with each px's depth in its alpha, and a normal map with its glow in its alpha (`scripts/zelda-lab/lib/artpack.mjs`).
 * `loadPack` fetches both the first time a pack is asked for, checks their hashes and decodes them with `artPng.ts`,
 * never through a canvas (which would premultiply the colour by the depth). A fetch that failed is tried again after
 * `RETRY_MS`, not at every ask, as the old chunks were (`frontierArt/index.ts`).
 *
 * `loadKit` gives a pack's pieces as the atlas takes them (`things.ts` `withThings` copies each rect, `paintPacked`);
 * their geometry is `ART_INDEX`'s, here before the pixels are.
 */
import { ART_INDEX, PACKS, type ArtFile, type ArtRect } from './artIndex'
import { decodePng } from './artPng'

/** A pack's two maps, decoded: w × h px, four bytes a px. */
export interface DecodedPack { name: string; w: number; h: number; albedo: Uint8Array; normal: Uint8Array }

/** A piece of a loaded pack: its rect and anchor (`ArtRect`) and the pack it is in. */
export interface PackedThing extends ArtRect { img: DecodedPack }

export type PackedKit = Record<string, PackedThing>

/** A fetch that failed (offline) is tried again after this long, not every frame. */
export const RETRY_MS = 10_000

const hexOf = (b: ArrayBuffer): string => [...new Uint8Array(b)].map(v => v.toString(16).padStart(2, '0')).join('')

async function fetchFile(f: ArtFile): Promise<Uint8Array> {
  const res = await fetch(f.url, { mode: 'cors' })
  if (!res.ok) throw new Error(`${f.url}: HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  // (A rewritten picture, a zone's image "optimising" say, would come out wrong in every px of depth: refuse it.)
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error(`${f.url}: no crypto.subtle (an insecure page), so the pinned sha256 cannot be checked`)
  const got = hexOf(await subtle.digest('SHA-256', buf))
  if (got !== f.sha256) throw new Error(`${f.url}: sha256 ${got}, pinned ${f.sha256}`)
  return new Uint8Array(buf)
}

const packs = new Map<string, DecodedPack>()
const pending = new Map<string, Promise<DecodedPack>>()
const failedAt = new Map<string, number>()

/** Is there a pinned pack of this name? */
export const hasPack = (name: string): boolean => Object.prototype.hasOwnProperty.call(PACKS, name)

/** Fetch and decode a pack (once; again only RETRY_MS after a failure, which rejects meanwhile). */
export function loadPack(name: string): Promise<DecodedPack> {
  const have = packs.get(name)
  if (have) return Promise.resolve(have)
  let p = pending.get(name)
  if (p) return p
  const pin = PACKS[name]
  if (!pin) return Promise.reject(new Error(`no art pack ${name}`))
  const failed = failedAt.get(name)
  if (failed !== undefined && Date.now() - failed < RETRY_MS) return Promise.reject(new Error(`art pack ${name}: failed, not tried again yet`))
  p = Promise.all([fetchFile(pin.albedo), fetchFile(pin.normal)]).then(([a, n]) => {
    const albedo = decodePng(a)
    const normal = decodePng(n)
    if (albedo.w !== pin.w || albedo.h !== pin.h || normal.w !== pin.w || normal.h !== pin.h) throw new Error(`art pack ${name}: not ${pin.w}x${pin.h}`)
    const d: DecodedPack = { name, w: pin.w, h: pin.h, albedo: albedo.data, normal: normal.data }
    packs.set(name, d)
    pending.delete(name)
    failedAt.delete(name)
    return d
  }).catch((e: unknown) => {
    // (A fetch, a hash, a decode or a size that failed: all retried after RETRY_MS.)
    pending.delete(name)
    failedAt.set(name, Date.now())
    throw e
  })
  pending.set(name, p)
  return p
}

const kits = new Map<string, PackedKit>()

/** A pack's pieces in its index's order (the same object every time), once its pixels are here. */
export function loadKit(name: string): Promise<PackedKit> {
  const have = kits.get(name)
  if (have) return Promise.resolve(have)
  return loadPack(name).then(img => {
    let k = kits.get(name)
    if (!k) {
      k = {}
      for (const [id, r] of Object.entries(ART_INDEX)) if (r.pack === name) k[id] = { ...r, img }
      kits.set(name, k)
    }
    return k
  })
}

/** A piece's place in its pack, synchronously (the geometry is in the bundle). */
export const artRect = (id: string): ArtRect | undefined => ART_INDEX[id]
