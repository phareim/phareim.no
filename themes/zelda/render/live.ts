/**
 * The studio's live art. Sprites redrawn in the studio (studio.phareim.no, repo
 * phareim/studio-web) and published there replace the registry's rows without a deploy.
 *
 * The last copy this browser saw is applied at once, so the first frame already wears it; then
 * the studio is asked for the current one after mount, and again when the page comes back to
 * the foreground (at most once a minute). Every failure is silent: the game always has its own
 * art. `?sprites=draft` asks for the studio's unpublished drafts instead, which needs Petter's
 * sign-in on auth.phareim.no; that copy is never kept.
 */
import { setSpriteOverrides } from './sheet'

export const STUDIO_BASE = 'https://studio.phareim.no'
export const LIVE_PACK = 'neon-shrine'
const STORE_KEY = 'studio.live.' + LIVE_PACK
const TIMEOUT_MS = 4000
const REFRESH_MS = 60_000

export interface LiveArt {
  pack: string
  /** The release number, or 'draft'. */
  release: number | string
  sprites: Record<string, string[]>
}

/** The studio's answer, or null if it is not one (wrong pack, wrong format, ragged rows). */
export function parseLive(data: unknown): LiveArt | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (d.format !== 1 || d.pack !== LIVE_PACK || !d.sprites || typeof d.sprites !== 'object') return null
  const sprites: Record<string, string[]> = {}
  for (const [name, rows] of Object.entries(d.sprites as Record<string, unknown>)) {
    if (!Array.isArray(rows) || !rows.length) continue
    const w = typeof rows[0] === 'string' ? rows[0].length : 0
    if (w && rows.every(r => typeof r === 'string' && r.length === w)) sprites[name] = rows as string[]
  }
  return { pack: LIVE_PACK, release: typeof d.release === 'number' || typeof d.release === 'string' ? d.release : 0, sprites }
}

export interface LiveOptions {
  /** location.search: `?sprites=draft` shows the drafts. */
  search: string
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  fetcher?: typeof fetch
  /** After a new set is applied (canvases made from sprites elsewhere can be rebuilt). */
  onApplied?: (art: LiveArt) => void
}

/** Apply the kept copy now and fetch the current one; returns a stop function. */
export function startLiveSprites(opts: LiveOptions): () => void {
  const draft = new URLSearchParams(opts.search).get('sprites') === 'draft'
  const store = opts.storage ?? null
  const fetcher = opts.fetcher ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : null)
  let last = ''
  let askedAt = 0
  let stopped = false

  const apply = (text: string) => {
    if (stopped || text === last) return
    let art: LiveArt | null = null
    try { art = parseLive(JSON.parse(text)) } catch { art = null }
    if (!art) return
    last = text
    setSpriteOverrides(art.sprites)
    opts.onApplied?.(art)
    if (!draft) try { store?.setItem(STORE_KEY, text) } catch { /* private mode, full storage */ }
  }

  const ask = async () => {
    if (!fetcher || stopped) return
    askedAt = Date.now()
    const url = draft ? `${STUDIO_BASE}/api/packs/${LIVE_PACK}/draft.json` : `${STUDIO_BASE}/live/${LIVE_PACK}.json`
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null
    const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null
    try {
      const res = await fetcher(url, { credentials: draft ? 'include' : 'omit', cache: 'no-cache', signal: ctrl?.signal })
      if (res.ok) apply(await res.text())
    } catch { /* offline, studio down, blocked: the drawn art stays */ }
    finally { if (timer) clearTimeout(timer) }
  }

  if (!draft) {
    let kept: string | null = null
    try { kept = store?.getItem(STORE_KEY) ?? null } catch { kept = null }
    if (kept) apply(kept)
  }
  void ask()

  const onVisible = () => {
    if (document.visibilityState === 'visible' && Date.now() - askedAt > REFRESH_MS) void ask()
  }
  const doc = typeof document !== 'undefined' ? document : null
  doc?.addEventListener('visibilitychange', onVisible)
  return () => {
    stopped = true
    doc?.removeEventListener('visibilitychange', onVisible)
  }
}
