/**
 * mw-world: Mini World's shared world on Sleeper. An HTTP server on
 * 127.0.0.1:3034 with `GET /health` and the WebSocket on `/ws`; nginx serves
 * it as `https://sleeper.phareim.no/mw-world/`. The room logic is in
 * room.ts, the wire format in themes/miniworld/net/protocol.ts.
 *
 * Run: `node server.ts` (Node 22 strips the types); it listens as soon as
 * it loads. MW_WORLD_PORT picks the port (0 = any, for tests). Logs go to stdout.
 */
import http from 'node:http'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { createRequire } from 'node:module'
import { networkInterfaces } from 'node:os'
import { MAX_MSG_BYTES } from '../../themes/miniworld/net/protocol.ts'
import { createRoom } from './room.ts'
import type { Conn } from './room.ts'

// ws has no types in this repo; the few parts used, typed here.
interface WsSocket {
  send(data: string): void
  close(code?: number, reason?: string): void
  terminate(): void
  ping(): void
  on(ev: 'message', fn: (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => void): void
  on(ev: 'pong' | 'close', fn: () => void): void
  on(ev: 'error', fn: (err: Error) => void): void
}
interface WsServer {
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer, cb: (ws: WsSocket) => void): void
  close(): void
}
const require = createRequire(import.meta.url)
const { WebSocketServer } = require('ws') as { WebSocketServer: new (o: { noServer: true; maxPayload: number }) => WsServer }

const PING_MS = 25_000
const SWEEP_MS = 5_000

// ---------------------------------------------------------------- origins

const PROD_ORIGINS = new Set(['https://phareim.no', 'https://www.phareim.no'])
const PAGES_RE = /^https:\/\/[a-z0-9-]+\.phareim-no\.pages\.dev$/
const DEV_HOST_RE = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/

/** Private LAN / Tailscale addresses of this machine, for phones on the same network during dev. */
function lanHosts(): Set<string> {
  const out = new Set<string>()
  const priv = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal && priv.test(a.address)) out.add(a.address)
  }
  return out
}
const LAN = lanHosts()
const EXTRA = new Set((process.env.MW_WORLD_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean))

function originAllowed(origin: string | undefined): boolean {
  if (!origin) return false
  if (PROD_ORIGINS.has(origin) || PAGES_RE.test(origin) || DEV_HOST_RE.test(origin) || EXTRA.has(origin)) return true
  const m = /^http:\/\/([0-9.]+)(:\d{1,5})?$/.exec(origin)
  return !!m && LAN.has(m[1])
}

// ---------------------------------------------------------------- server

function startServer(port: number, host = '127.0.0.1'): Promise<{ port: number; close: () => Promise<void> }> {
  const started = Date.now()
  const room = createRoom({ log: line => console.log(`[mw-world] ${line}`) })
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG_BYTES })
  const alive = new Map<WsSocket, boolean>()

  const server = http.createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0]
    if (req.method === 'GET' && path === '/health') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      res.end(JSON.stringify({ ok: true, peers: room.peers, uptime: Math.round((Date.now() - started) / 1000) }))
      return
    }
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end('{"error":"not found"}')
  })

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = (req.url ?? '/').split('?')[0]
    const refuse = (status: string) => { socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); socket.destroy() }
    if (path !== '/ws') return refuse('404 Not Found')
    if (!originAllowed(req.headers.origin)) {
      console.log(`[mw-world] refused origin ${JSON.stringify(String(req.headers.origin ?? '').slice(0, 80))}`)
      return refuse('403 Forbidden')
    }
    wss.handleUpgrade(req, socket, head, ws => {
      const conn: Conn = room.open({ send: t => ws.send(t), close: (code, reason) => ws.close(code, reason) })
      alive.set(ws, true)
      ws.on('pong', () => alive.set(ws, true))
      ws.on('message', (data, isBinary) => {
        if (isBinary) return
        room.message(conn, Array.isArray(data) ? Buffer.concat(data).toString() : Buffer.from(data as ArrayBuffer).toString())
      })
      ws.on('close', () => { alive.delete(ws); room.close(conn) })
      ws.on('error', () => { /* 'close' follows */ })
    })
  })

  // Keepalive: a ws ping every 25 s; a socket that did not answer the last one is cut.
  const pinger = setInterval(() => {
    for (const [ws, ok] of alive) {
      if (!ok) { ws.terminate(); continue }
      alive.set(ws, false)
      try { ws.ping() } catch { /* closing */ }
    }
  }, PING_MS)
  const sweeper = setInterval(() => room.sweep(), SWEEP_MS)
  pinger.unref(); sweeper.unref()

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      const addr = server.address()
      const bound = typeof addr === 'object' && addr ? addr.port : port
      resolve({
        port: bound,
        close: () => new Promise<void>(done => {
          clearInterval(pinger); clearInterval(sweeper)
          for (const ws of alive.keys()) ws.terminate()
          wss.close()
          server.close(() => done())
        }),
      })
    })
  })
}

const port = Number(process.env.MW_WORLD_PORT ?? 3034)
const { port: bound, close } = await startServer(port)
console.log(`[mw-world] listening on 127.0.0.1:${bound}`)
const stop = () => { close().then(() => process.exit(0)) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
