/**
 * The feedback service's HTTP app: Petter's in-game feedback box. Plain
 * node:http, no side effects on import; server.ts starts it. The contract
 * (routes, the one identical refusal, the gate order, the stored layout) is in
 * README.md. Everything client-sent is data: parsed inside try/catch, stored,
 * never evaluated and never used as a path.
 */
import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import { readFile, statfs } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sessionTokenFrom } from '../../server/utils/sessionCheck.ts'
import type { SessionChecker } from '../../server/utils/sessionCheck.ts'
import { ID_RE, ensureRoot, listIds, listPage, readEntryFile, readMeta, setDone, storeSize, sweepTmp, writeEntry } from './store.ts'

export interface Options {
  port: number
  host?: string
  root: string
  auth: SessionChecker
  allowedEmails: string[]
  allowedIds: string[]
  capBytes?: number
  minFreeBytes?: number
  log?: (line: string) => void
}

const HERE = dirname(fileURLToPath(import.meta.url))
const W_ORIGINS = new Set(['https://phareim.no', 'https://www.phareim.no'])
const R_ORIGIN = 'https://sleeper.phareim.no'
const BODY_CAP = 600_000
const META_CAP = 32_768
const TEXT_CHARS = 4000
const TEXT_BYTES = 16_000
const SHOT_CAP = 400_000
const SAVE_CAP = 65_536
const KNOWN_MS = 5 * 60_000
const PER_IP = 20
const OVERALL = 60

type Route =
  | { cls: 'W'; name: 'can' | 'entry' }
  | { cls: 'R'; name: 'page' | 'entries' | 'file' | 'done'; id?: string; file?: string }
  | { cls: 'H'; name: 'health' }

function route(method: string, path: string): Route | null {
  if (path === '/health') return method === 'GET' ? { cls: 'H', name: 'health' } : null
  if (path === '/can') return method === 'GET' ? { cls: 'W', name: 'can' } : null
  if (path === '/entry') return method === 'POST' ? { cls: 'W', name: 'entry' } : null
  if (path === '/') return method === 'GET' ? { cls: 'R', name: 'page' } : null
  if (path === '/entries') return method === 'GET' ? { cls: 'R', name: 'entries' } : null
  const m = /^\/entry\/([^/]+)\/(shot\.jpg|save\.json|meta\.json|done)$/.exec(path)
  if (!m) return null
  let id: string
  try { id = decodeURIComponent(m[1]) } catch { return null }
  if (!ID_RE.test(id)) return null
  if (m[2] === 'done') return method === 'POST' ? { cls: 'R', name: 'done', id } : null
  return method === 'GET' ? { cls: 'R', name: 'file', id, file: m[2] } : null
}

function norm(list: string[], lower: boolean): Set<string> {
  return new Set(list.map(s => (lower ? s.toLowerCase() : s).trim()).filter(Boolean))
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const JSON_CSP = "default-src 'none'; sandbox"
const SAFE = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }

export async function startServer(opts: Options): Promise<{ port: number; close: () => Promise<void> }> {
  const log = opts.log ?? (() => {})
  const emails = norm(opts.allowedEmails, true)
  const ids = norm(opts.allowedIds, false)
  const capBytes = opts.capBytes ?? 268_435_456
  const minFree = opts.minFreeBytes ?? 3_221_225_472
  const root = opts.root
  const started = Date.now()

  await ensureRoot(root)
  await sweepTmp(root)
  let size = await storeSize(root)
  let entryCount = 0
  let openCount = 0
  const recount = async () => {
    const all = await listIds(root)
    entryCount = all.length
    let o = 0
    for (const id of all) { const m = await readMeta(root, id); if (m && m.status !== 'done') o++ }
    openCount = o
  }
  await recount()

  // One write at a time.
  let chain: Promise<unknown> = Promise.resolve()
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const p = chain.then(fn, fn)
    chain = p.catch(() => {})
    return p
  }

  // Lookup budget and the "known good" tokens.
  const known = new Map<string, number>()
  const perIp = new Map<string, { start: number; n: number }>()
  let overall = { start: 0, n: 0 }
  function budgetOk(hash: string, ip: string, now: number): boolean {
    const until = known.get(hash)
    if (until !== undefined && until > now) return true
    if (now - overall.start >= 60_000) overall = { start: now, n: 0 }
    let slot = perIp.get(ip)
    if (!slot || now - slot.start >= 60_000) {
      if (perIp.size > 1000) for (const [k, v] of perIp) if (now - v.start >= 60_000) perIp.delete(k)
      slot = { start: now, n: 0 }
      perIp.set(ip, slot)
    }
    overall.n++
    slot.n++
    return slot.n <= PER_IP && overall.n <= OVERALL
  }
  function remember(hash: string, now: number): void {
    if (known.size > 200) for (const [k, v] of known) if (v <= now) known.delete(k)
    known.set(hash, now + KNOWN_MS)
  }

  // Refusals: one summary line a minute, counts per class.
  const refused = { W: 0, R: 0, H: 0, other: 0 }
  // Why, by gate step (a count per reason; never who).
  const why: Record<string, number> = {}
  const summary = setInterval(() => {
    const total = refused.W + refused.R + refused.H + refused.other
    if (total) log(`refused last minute: W=${refused.W} R=${refused.R} health=${refused.H} other=${refused.other}; why: ${Object.entries(why).map(([k, n]) => `${k}=${n}`).join(' ') || '-'}`)
    refused.W = refused.R = refused.H = refused.other = 0
    for (const k of Object.keys(why)) delete why[k]
  }, 60_000)
  summary.unref()
  const sweeper = setInterval(() => { sweepTmp(root).catch(() => {}) }, 3_600_000)
  sweeper.unref()

  function refuse(res: ServerResponse, cls: keyof typeof refused, reason = 'path'): void {
    refused[cls]++
    why[reason] = (why[reason] ?? 0) + 1
    res.writeHead(404, { 'content-type': 'text/plain', 'content-length': '0', 'cache-control': 'no-store', connection: 'close' })
    res.end()
  }

  function reply(res: ServerResponse, status: number, headers: Record<string, string>, body: string | Buffer = '', closeAfter = false): void {
    const h: Record<string, string> = { ...headers, 'content-length': String(Buffer.byteLength(body)) }
    if (closeAfter) h.connection = 'close'
    res.writeHead(status, h)
    res.end(body, () => { if (closeAfter) res.socket?.destroy() })
  }

  function readBody(req: IncomingMessage): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
      const parts: Buffer[] = []
      let total = 0
      let over = false
      req.on('data', (c: Buffer) => {
        if (over) return
        total += c.length
        if (total > BODY_CAP) { over = true; parts.length = 0; resolve(null); return }
        parts.push(c)
      })
      req.on('end', () => { if (!over) resolve(Buffer.concat(parts)) })
      req.on('error', reject)
      req.on('aborted', () => reject(new Error('aborted')))
    })
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? ''
    let path: string
    try { path = new URL(req.url ?? '/', 'http://x').pathname } catch { return refuse(res, 'other') }
    const r = route(method, path)
    if (!r) return refuse(res, 'other')

    if (r.cls === 'H') {
      if (req.headers['x-real-ip'] !== undefined) return refuse(res, 'H')
      return reply(res, 200, { 'content-type': 'application/json', ...SAFE }, JSON.stringify({ ok: true, entries: entryCount, open: openCount, uptime: Math.floor((Date.now() - started) / 1000) }))
    }

    // (2) Origin and Sec-Fetch-Site per class.
    const origin = req.headers.origin
    const sfs = req.headers['sec-fetch-site']
    if (r.cls === 'W') {
      if (typeof origin !== 'string' || !W_ORIGINS.has(origin)) return refuse(res, 'W', 'origin')
      if (sfs !== undefined && sfs !== 'same-site' && sfs !== 'same-origin') return refuse(res, 'W', 'fetch-site')
    } else {
      const post = method === 'POST'
      if (post ? origin !== R_ORIGIN : (origin !== undefined && origin !== R_ORIGIN)) return refuse(res, 'R', 'origin')
      const okSfs = r.name === 'page' ? ['same-origin', 'none', 'same-site'] : ['same-origin', 'none']
      if (sfs !== undefined && !okSfs.includes(sfs as string)) return refuse(res, 'R', 'fetch-site')
    }

    // (3) lookup budget, (4) auth, (5) allowlist.
    const cookie = req.headers.cookie
    const token = sessionTokenFrom(cookie)
    if (!token) return refuse(res, r.cls, 'no-cookie')
    const hash = sha(token)
    const ip = typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'].slice(0, 64) : 'local'
    const now = Date.now()
    if (!budgetOk(hash, ip, now)) return refuse(res, r.cls, 'budget')
    const verdict = await opts.auth.check(cookie)
    if (verdict.state !== 'in') return refuse(res, r.cls, `session-${verdict.state}`)
    const user = verdict.user
    if (!(emails.has(user.email.toLowerCase()) || ids.has(user.id))) return refuse(res, r.cls, 'not-on-list')
    remember(hash, Date.now())

    // Allowed. Class W answers carry CORS; class R never.
    const base: Record<string, string> = r.cls === 'W'
      ? { 'access-control-allow-origin': origin as string, 'access-control-allow-credentials': 'true', vary: 'Origin', ...SAFE }
      : { ...SAFE }
    const json = (status: number, body: unknown, close = false) =>
      reply(res, status, { ...base, 'content-type': 'application/json', 'content-security-policy': JSON_CSP }, JSON.stringify(body), close)

    try {
      if (r.name === 'can') return json(200, { ok: true })

      if (r.name === 'entry') return await postEntry(req, res, user.id, base, json)

      if (r.name === 'page') {
        let html: string
        try { html = await readFile(join(HERE, 'page.html'), 'utf8') } catch { return json(500, { ok: false, error: 'server' }) }
        const m = /<script>([\s\S]*?)<\/script>/.exec(html)
        const hashB64 = createHash('sha256').update(m ? m[1] : '').digest('base64')
        return reply(res, 200, {
          ...base,
          'content-type': 'text/html; charset=utf-8',
          'content-security-policy': `default-src 'none'; img-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; script-src 'sha256-${hashB64}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
          'x-frame-options': 'DENY',
          'referrer-policy': 'no-referrer',
          'x-robots-tag': 'noindex',
        }, html)
      }

      if (r.name === 'entries') {
        const before = new URL(req.url ?? '/', 'http://x').searchParams.get('before')
        if (before !== null && !ID_RE.test(before)) return json(400, { ok: false, error: 'bad-request' })
        const page = await listPage(root, before, 30)
        return json(200, { ok: true, items: page.items, next: page.next })
      }

      if (r.name === 'file') {
        const buf = await readEntryFile(root, r.id!, r.file!)
        if (!buf) return json(404, { ok: false, error: 'not-found' })
        if (r.file === 'shot.jpg') return reply(res, 200, { ...base, 'content-type': 'image/jpeg', 'content-security-policy': JSON_CSP }, buf)
        return reply(res, 200, { ...base, 'content-type': 'application/json', 'content-security-policy': JSON_CSP }, buf)
      }

      if (r.name === 'done') {
        const was = await readMeta(root, r.id!)
        const ok = await serial(() => setDone(root, r.id!))
        if (!ok) return json(404, { ok: false, error: 'not-found' })
        if (was && was.status !== 'done') openCount = Math.max(0, openCount - 1)
        return json(200, { ok: true })
      }
    } catch {
      if (!res.headersSent) json(500, { ok: false, error: 'server' })
      else res.destroy()
    }
  }

  async function postEntry(req: IncomingMessage, res: ServerResponse, by: string, _base: Record<string, string>,
    json: (status: number, body: unknown, close?: boolean) => void): Promise<void> {
    const bad = (why: string) => json(400, { ok: false, error: 'bad-request', why: why.slice(0, 60) })
    // Disk guards, before any body byte.
    let free = Infinity
    try { const s = await statfs(root); free = Number(s.bavail) * Number(s.bsize) } catch { /* unknown: do not block */ }
    if (size >= capBytes || free < minFree) return json(507, { ok: false, error: 'store-full' }, true)
    const declared = Number(req.headers['content-length'])
    if (Number.isFinite(declared) && declared > BODY_CAP) return json(413, { ok: false, error: 'too-large' }, true)
    const body = await readBody(req)
    if (!body) return json(413, { ok: false, error: 'too-large' }, true)

    const ct = String(req.headers['content-type'] ?? '')
    if (!/^multipart\/form-data\s*;/i.test(ct)) return bad('not multipart')
    let fd: FormData
    try { fd = await new Response(new Uint8Array(body), { headers: { 'content-type': ct } }).formData() } catch { return bad('not multipart') }

    const metaRaw = fd.get('meta')
    if (typeof metaRaw !== 'string') return bad('meta missing')
    if (Buffer.byteLength(metaRaw) > META_CAP) return bad('meta too big')
    let meta: any
    try { meta = JSON.parse(metaRaw) } catch { return bad('meta is not JSON') }
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return bad('meta is not an object')
    if (typeof meta.app !== 'string' || meta.app.length < 1 || meta.app.length > 32) return bad('meta.app wrong')
    if (meta.v !== 1) return bad('meta.v wrong')

    const textRaw = fd.get('text')
    if (textRaw !== null && typeof textRaw !== 'string') return bad('text wrong')
    const text = textRaw ?? ''
    if (text.length > TEXT_CHARS || Buffer.byteLength(text) > TEXT_BYTES) return bad('text too long')

    let shot: Buffer | null = null
    const shotRaw = fd.get('shot')
    if (shotRaw !== null) {
      if (typeof shotRaw === 'string') return bad('shot is not a file')
      if (shotRaw.type !== 'image/jpeg') return bad('shot is not a JPEG')
      if (shotRaw.size > SHOT_CAP) return bad('shot too big')
      shot = Buffer.from(await shotRaw.arrayBuffer())
      if (shot.length < 3 || shot[0] !== 0xff || shot[1] !== 0xd8 || shot[2] !== 0xff) return bad('shot is not a JPEG')
    }

    let save: string | null = null
    const saveRaw = fd.get('save')
    if (saveRaw !== null) {
      if (typeof saveRaw !== 'string') return bad('save wrong')
      if (Buffer.byteLength(saveRaw) > SAVE_CAP) return bad('save too big')
      try { JSON.parse(saveRaw) } catch { return bad('save is not JSON') }
      save = saveRaw
    }

    let url: string | null = null
    if (typeof meta.url === 'string') { try { const u = new URL(meta.url); url = u.origin + u.pathname } catch { url = null } }
    const client = { ...meta, url }

    const out = await serial(() => writeEntry(root, { by, text, client, shot, save }))
    size += out.bytes
    entryCount++
    openCount++
    log(`entry ${out.id} ${out.bytes} bytes`)
    return json(201, { ok: true, id: out.id })
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch(() => {
      try { if (!res.headersSent) refuse(res, 'other'); else res.destroy() } catch { /* nothing escapes */ }
    })
  })
  server.requestTimeout = 60_000
  server.headersTimeout = 20_000

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(opts.port, opts.host ?? '127.0.0.1', () => resolve())
  })
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : opts.port
  return {
    port,
    close: () => new Promise<void>(resolve => {
      clearInterval(summary)
      clearInterval(sweeper)
      server.close(() => resolve())
      server.closeAllConnections()
    }),
  }
}
