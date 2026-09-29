import type { H3Event } from 'h3'

/**
 * Norway only for Ulrikke's games (Mini World, Lag Din Figur), 2026-09-29:
 * nobody outside Norway needs them. The country is Cloudflare's
 * (`request.cf.country`); with no country (local dev, `npm run preview`)
 * everyone is let in. Sleeper's own addresses (Hetzner, they geolocate to
 * Finland) always pass, so agents there can check the live site. Mini World's
 * shared world has its own door in nginx on Sleeper (~/github/sleeper/geo).
 */
export const NORWAY_ONLY_THEMES = ['miniworld', 'figur']

const isSleeper = (ip: string | null | undefined) =>
  ip === '77.42.67.18' || String(ip ?? '').toLowerCase().startsWith('2a01:4f9:c014:cc95:')

export function norwayOk(event: H3Event): boolean {
  if (isSleeper(getRequestHeader(event, 'cf-connecting-ip'))) return true
  const cf = (event.context.cloudflare?.request as { cf?: { country?: string } } | undefined)?.cf
  const country = cf?.country
  return !country || country.toUpperCase() === 'NO'
}
