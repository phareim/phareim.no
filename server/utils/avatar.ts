import type { H3Event } from 'h3'
import type { Player, Store } from './store'

/**
 * Player avatars (2026-09-08). The painting happens on Sleeper: wave-jobs'
 * `POST /avatar` runs gpt-image-2 (quality low) through the wave CLI and
 * uploads to the fixer.ink media library, answering with the filename after
 * ~35-45 s. We call it inside waitUntil so registering a player, or opening
 * the board, never waits for it; the next board fetch shows the picture.
 * Needs the `WAVE_JOBS_KEY` Pages secret — without it (nuxi dev) nothing is
 * painted and every avatar stays null.
 */

const FORGE_URL = 'https://sleeper.phareim.no/wave-jobs/avatar'

interface CloudflareContext {
  cloudflare?: {
    env?: Record<string, unknown>
    context?: { waitUntil?: (p: Promise<unknown>) => void }
  }
}

function forgeKey(event: H3Event): string | null {
  const key = (event.context as CloudflareContext).cloudflare?.env?.WAVE_JOBS_KEY
  return typeof key === 'string' && key ? key : null
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
  waitUntil(event, paint(store, player.id, player.name, key).catch(() => {
    // The board is a bonus and the avatar is a bonus on the bonus: a failed
    // painting leaves the previous one (or none) and the claim's cooldown
    // stops a retry storm.
  }))
}

async function paint(store: Store, id: string, name: string, key: string): Promise<void> {
  if (!(await store.claimAvatar(id, name))) return
  const res = await fetch(FORGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) return
  const { file } = await res.json() as { file?: unknown }
  if (typeof file !== 'string' || !/^[A-Za-z0-9._-]+$/.test(file)) return
  await store.setAvatar(id, name, file)
}
