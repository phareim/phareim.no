import type { H3Event } from 'h3'
import type { Player, Store } from './store'

/**
 * Player avatars (2026-09-08). The painting happens on Sleeper: wave-jobs'
 * `POST /avatar` runs gpt-image-2 (quality low) through the wave CLI and
 * uploads to the fixer.ink media library. A painting takes 35-45 s and
 * Cloudflare ends a request's `waitUntil` work 30 s after the response, so
 * we cannot wait for it: we send the name with a callback URL, wave-jobs
 * answers 202 at once and POSTs the filename to `/api/avatar` (same bearer)
 * when the upload is done. Needs the `WAVE_JOBS_KEY` Pages secret —
 * without it (nuxi dev) nothing is painted and every avatar stays null.
 */

const FORGE_URL = 'https://sleeper.phareim.no/wave-jobs/avatar'

interface CloudflareContext {
  cloudflare?: {
    env?: Record<string, unknown>
    context?: { waitUntil?: (p: Promise<unknown>) => void }
  }
}

export function forgeKey(event: H3Event): string | null {
  const key = (event.context as CloudflareContext).cloudflare?.env?.WAVE_JOBS_KEY
  return typeof key === 'string' && key ? key : null
}

/** A filename as the fixer.ink library names them: hex or similar, one extension. */
export function isAvatarFile(file: unknown): file is string {
  return typeof file === 'string' && /^[A-Za-z0-9._-]{1,120}\.(png|jpe?g|webp)$/i.test(file)
}

function waitUntil(event: H3Event, p: Promise<unknown>): void {
  const cf = (event.context as CloudflareContext).cloudflare
  if (cf?.context?.waitUntil) cf.context.waitUntil(p)
  else void p
}

/** Paints `player.name` if the player has no picture of that name yet. */
export function scheduleAvatar(event: H3Event, store: Store, player: Pick<Player, 'id' | 'name'> & Partial<Player>): void {
  if (player.avatarName === player.name) return
  const key = forgeKey(event)
  if (!key) return
  const callback = `${getRequestURL(event).origin}/api/avatar`
  waitUntil(event, request(store, player.id, player.name, key, callback).catch(() => {
    // The board is a bonus and the avatar is a bonus on the bonus: a failed
    // request leaves the previous picture (or none) and the claim's cooldown
    // stops a retry storm.
  }))
}

async function request(store: Store, id: string, name: string, key: string, callback: string): Promise<void> {
  if (!(await store.claimAvatar(id, name))) return
  const res = await fetch(FORGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ name, playerId: id, callback }),
  })
  if (res.status === 202) return // the result arrives on /api/avatar
  if (!res.ok) return
  // A synchronous answer (an older wave-jobs) still carries the file.
  const { file } = await res.json() as { file?: unknown }
  if (isAvatarFile(file)) await store.setAvatar(id, name, file)
}
