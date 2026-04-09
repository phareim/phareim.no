import { defineEventHandler, readBody, getHeader, createError, setResponseStatus } from 'h3'
import { getDB } from '~/server/utils/db'

export interface GuestbookEntry {
  id: string
  name: string
  message: string
  created_at: string
}

async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + 'phareim-gb-2024')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

export default defineEventHandler(async (event) => {
  const db = getDB(event)

  if (event.method === 'GET') {
    const rows = await db
      .prepare('SELECT id, name, message, created_at FROM guestbook_entries ORDER BY created_at DESC LIMIT 60')
      .all<GuestbookEntry>()
    return rows.results ?? []
  }

  if (event.method === 'POST') {
    const body = await readBody(event)
    const name = (body?.name ?? '').toString().trim().slice(0, 60)
    const message = (body?.message ?? '').toString().trim().slice(0, 280)

    if (!name || !message) {
      throw createError({ statusCode: 400, statusMessage: 'name and message are required' })
    }

    const ip =
      getHeader(event, 'cf-connecting-ip') ??
      getHeader(event, 'x-forwarded-for')?.split(',')[0].trim() ??
      'unknown'
    const ipHash = await hashIP(ip)

    const recent = await db
      .prepare("SELECT id FROM guestbook_entries WHERE ip_hash = ? AND created_at > datetime('now', '-24 hours')")
      .bind(ipHash)
      .first<{ id: string }>()

    if (recent) {
      throw createError({ statusCode: 429, statusMessage: 'one entry per 24 hours please' })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await db
      .prepare('INSERT INTO guestbook_entries (id, name, message, ip_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, name, message, ipHash, now)
      .run()

    setResponseStatus(event, 201)
    return { id, name, message, created_at: now } as GuestbookEntry
  }

  throw createError({ statusCode: 405, statusMessage: 'method not allowed' })
})
