// Mini World's shared world: the room logic (servers/mw-world/room.ts) with
// fake sockets and a fake clock, the real service end to end with two `ws`
// clients, and the browser link (themes/miniworld/net/link.ts) against a
// fake WebSocket and against the real service. Node strips the TypeScript.
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRoom, CLOSE } from '../servers/mw-world/room.ts'
import { MAX_MSGS_PER_SEC, SEND_HZ } from '../themes/miniworld/net/protocol.ts'
import { createWorldLink, worldUrl } from '../themes/miniworld/net/link.ts'

const require = createRequire(import.meta.url)
const WebSocket = require('ws')
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

const info = (name = 'Ulrikke', pub = 'p' + name) => ({ pub, name, title: null, look: { hair: 1 }, held: null })
const state = (pl = 'town', x = 0, extra = {}) => ({ pl, x, y: 0, z: 0, r: 0, a: 'idle', s: 0, ...extra })

// ---------------------------------------------------------------- room

function roomRig(opts = {}) {
  let t = 1_000_000
  const room = createRoom({ now: () => t, ...opts })
  const client = () => {
    const sock = {
      out: [], closedWith: null,
      send(s) { this.out.push(JSON.parse(s)) },
      close(code, reason) { this.closedWith = { code, reason } },
    }
    const conn = room.open(sock)
    const say = (m) => room.message(conn, typeof m === 'string' ? m : JSON.stringify(m))
    const take = () => sock.out.splice(0)
    return { sock, conn, say, take, hello: (n, st = state()) => say({ t: 'hello', v: 1, info: info(n), state: st }) }
  }
  return { room, client, tick: (ms) => { t += ms } }
}

test('room: welcome lists who is here, joins and leaves go to everyone else', () => {
  const { room, client } = roomRig()
  const a = client(), b = client()
  a.hello('Anna')
  const [wa] = a.take()
  assert.equal(wa.t, 'welcome')
  assert.deepEqual(wa.peers, [])
  b.hello('Bo', state('town', 2))
  const [wb] = b.take()
  assert.equal(wb.peers.length, 1)
  assert.equal(wb.peers[0].id, wa.id)
  assert.equal(wb.peers[0].info.name, 'Anna')
  const [join] = a.take()
  assert.deepEqual(join, { t: 'join', id: wb.id, info: info('Bo'), state: state('town', 2) })
  assert.equal(room.peers, 2)
  room.close(b.conn)
  room.close(b.conn) // twice is harmless
  assert.deepEqual(a.take(), [{ t: 'leave', id: wb.id }])
  assert.equal(room.peers, 1)
})

test('room: state, info and fx are relayed to others, never back to the sender', () => {
  const { client } = roomRig()
  const a = client(), b = client(), c = client()
  a.hello('Anna'); b.hello('Bo'); c.hello('Cy')
  a.take(); b.take(); c.take()
  a.say({ t: 's', state: state('town', 1.23456) })
  assert.equal(a.take().length, 0)
  const [sb] = b.take()
  assert.equal(sb.t, 's')
  assert.equal(sb.state.x, 1.23) // packed to centimetres
  assert.equal(c.take().length, 1)
  a.say({ t: 'info', info: { ...info('Anna'), title: 'queen' } })
  assert.equal(b.take()[0].info.title, 'queen')
  assert.equal(a.take().length, 0)
  a.say({ t: 'fx', fx: { k: 'emote', e: 'wave' } })
  assert.deepEqual(b.take(), [{ t: 'fx', id: sb.id, fx: { k: 'emote', e: 'wave' } }])
  assert.equal(a.take().length, 0)
})

test('room: states and fx stay in their place; changing place is seen on both sides', () => {
  const { client } = roomRig()
  const a = client(), b = client(), c = client()
  a.hello('Anna'); b.hello('Bo'); c.hello('Cy', state('stars'))
  const idOf = {}
  for (const [k, x] of [['a', a], ['b', b], ['c', c]]) idOf[k] = x.take().find(m => m.t === 'welcome').id
  a.take(); b.take()

  // Anna moves in town: Bo (town) hears it, Cy (stars) does not.
  a.say({ t: 's', state: state('town', 1) })
  assert.equal(b.take().length, 1)
  assert.equal(c.take().length, 0)
  a.say({ t: 'fx', fx: { k: 'emote', e: 'cheer' } })
  assert.equal(b.take().length, 1)
  assert.equal(c.take().length, 0)

  // Cy moves about in the stars while Anna is in town: Anna's view of Cy goes stale.
  c.say({ t: 's', state: state('stars', 5) })
  assert.equal(a.take().length, 0)

  // Anna goes to the stars: town (Bo) sees her leave, the stars (Cy) see her arrive,
  // and Anna gets everyone's latest state.
  a.say({ t: 's', state: state('stars', 0) })
  assert.equal(b.take()[0].state.pl, 'stars')
  assert.equal(c.take()[0].state.pl, 'stars')
  const fresh = a.take()
  assert.deepEqual(fresh.map(m => m.id).sort(), [idOf.b, idOf.c].sort())
  assert.equal(fresh.find(m => m.id === idOf.c).state.x, 5)

  // Now Bo's moves in town are not sent to Anna.
  b.say({ t: 's', state: state('town', 3) })
  assert.equal(a.take().length, 0)
  assert.equal(c.take().length, 0)
})

test('room: a returning peer does not see a ghost (the stale-place case)', () => {
  const { client } = roomRig()
  const a = client(), b = client(), c = client()
  a.hello('Anna'); b.hello('Bo'); c.hello('Cy')
  const cid = c.take()[0].id
  a.take(); b.take()
  // Anna leaves town for the stars; Cy walks from town to obby:easy while she is away.
  a.say({ t: 's', state: state('stars') })
  a.take()
  c.say({ t: 's', state: state('obby:easy') })
  // Anna never heard that (she is in the stars)…
  assert.equal(a.take().length, 0)
  // …but coming back to town she gets Cy's real place.
  a.say({ t: 's', state: state('town') })
  const cy = a.take().find(m => m.id === cid)
  assert.equal(cy.state.pl, 'obby:easy')
})

test('room: full at MAX_PEERS', () => {
  const { room, client } = roomRig({ maxPeers: 3 })
  for (const n of ['Anna', 'Bo', 'Cy']) client().hello(n)
  const d = client()
  d.hello('Dag')
  assert.deepEqual(d.take(), [{ t: 'full' }])
  assert.equal(d.sock.closedWith.code, CLOSE.full)
  assert.equal(room.peers, 3)
})

test('room: invalid messages are dropped, a wrong protocol version is closed', () => {
  const { room, client } = roomRig()
  const a = client(), b = client()
  a.say('not json')
  a.say({ t: 's', state: state() }) // before hello
  a.say({ t: 'hello', v: 1, info: info('Anna'), state: { ...state(), pl: 'moon' } })
  a.say({ t: 'hello', v: 1, info: { ...info(), name: '<script>' }, state: state() })
  a.say([1, 2, 3])
  assert.equal(a.take().length, 0)
  assert.equal(room.peers, 0)
  a.hello('Anna'); b.hello('Bo')
  a.take(); b.take()
  a.say({ t: 's', state: { ...state(), x: Infinity } })
  a.say({ t: 's', state: { ...state(), a: 'fly' } })
  a.say({ t: 'fx', fx: { k: 'magic', magic: 'FIRE!', level: 9, dx: 0, dy: 0, dz: 0 } })
  a.say({ t: 'info', info: { ...info(), look: 'x'.repeat(10) } })
  a.say({ t: 'hello', v: 1, info: info('Anna'), state: state() }) // a second hello
  a.say('x'.repeat(5000))
  assert.equal(b.take().length, 0)
  const c = client()
  c.say({ t: 'hello', v: 2, info: info('Cy'), state: state() })
  assert.equal(c.sock.closedWith.code, CLOSE.protocol)
})

test('room: ping answers pong, the rate limit drops the excess', () => {
  const { client, tick } = roomRig()
  const a = client(), b = client()
  a.say({ t: 'ping' })
  assert.deepEqual(a.take(), [{ t: 'pong' }])
  a.hello('Anna'); b.hello('Bo')
  a.take(); b.take()
  for (let i = 0; i < MAX_MSGS_PER_SEC + 20; i++) a.say({ t: 's', state: state('town', i) })
  assert.equal(b.take().length, MAX_MSGS_PER_SEC - 2) // ping and hello counted in this second
  tick(1000)
  a.say({ t: 's', state: state('town', 99) })
  assert.equal(b.take().length, 1)
})

test('room: idle and hello-less sockets are dropped by the sweep', () => {
  const { room, client, tick } = roomRig()
  const a = client(), b = client(), lurker = client()
  a.hello('Anna'); b.hello('Bo')
  const aid = a.take()[0].id
  b.take()
  tick(11_000)
  room.sweep()
  assert.equal(lurker.sock.closedWith.reason, 'no hello')
  assert.equal(room.sockets, 2)
  for (let i = 0; i < 6; i++) { tick(10_000); b.say({ t: 'ping' }) }
  room.sweep()
  assert.equal(a.sock.closedWith.code, CLOSE.idle)
  assert.equal(b.sock.closedWith, null)
  assert.ok(b.take().some(m => m.t === 'leave' && m.id === aid))
  assert.equal(room.peers, 1)
})

// ---------------------------------------------------------------- the real service

async function startService() {
  const child = spawn(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', join(repo, 'servers/mw-world/server.ts')], {
    env: { ...process.env, MW_WORLD_PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'],
  })
  const port = await new Promise((resolve, reject) => {
    let buf = ''
    child.stdout.on('data', d => {
      buf += d
      const m = /listening on 127\.0\.0\.1:(\d+)/.exec(buf)
      if (m) resolve(Number(m[1]))
    })
    child.once('exit', code => reject(new Error(`service exited ${code}`)))
  })
  return { port, stop: () => new Promise(r => { child.once('exit', r); child.kill('SIGTERM') }) }
}

const ORIGIN = 'http://localhost:3035'
function wsClient(port, origin = ORIGIN) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin })
  const inbox = []
  const waiters = []
  ws.on('message', d => {
    const m = JSON.parse(String(d))
    const i = waiters.findIndex(w => w.pred(m))
    if (i >= 0) waiters.splice(i, 1)[0].resolve(m)
    else inbox.push(m)
  })
  const next = (pred = () => true) => {
    const i = inbox.findIndex(pred)
    if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0])
    return new Promise((resolve, reject) => {
      const w = { pred, resolve }
      waiters.push(w)
      setTimeout(() => reject(new Error('timed out waiting for a message')), 3000).unref()
    })
  }
  const opened = new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); ws.once('unexpected-response', (_req, res) => reject(new Error(`HTTP ${res.statusCode}`))) })
  return { ws, next, opened, send: m => ws.send(JSON.stringify(m)) }
}

test('service: health, origins, two players see each other', async () => {
  const svc = await startService()
  try {
    const health = await (await fetch(`http://127.0.0.1:${svc.port}/health`)).json()
    assert.equal(health.ok, true)
    assert.equal(health.peers, 0)
    assert.equal(typeof health.uptime, 'number')

    await assert.rejects(wsClient(svc.port, 'https://evil.example').opened, /HTTP 403/)
    await assert.rejects(wsClient(svc.port, 'https://phareim.no.evil.example').opened, /HTTP 403/)
    for (const ok of ['https://phareim.no', 'https://www.phareim.no', 'https://abc123.phareim-no.pages.dev', 'http://127.0.0.1:3035']) {
      const c = wsClient(svc.port, ok)
      await c.opened
      c.ws.close()
    }

    const a = wsClient(svc.port), b = wsClient(svc.port)
    await Promise.all([a.opened, b.opened])
    a.send({ t: 'hello', v: 1, info: info('Anna'), state: state() })
    const wa = await a.next(m => m.t === 'welcome')
    b.send({ t: 'hello', v: 1, info: info('Bo'), state: state('town', 1) })
    const wb = await b.next(m => m.t === 'welcome')
    assert.equal(wb.peers[0].id, wa.id)
    assert.equal((await a.next(m => m.t === 'join')).id, wb.id)
    assert.equal((await (await fetch(`http://127.0.0.1:${svc.port}/health`)).json()).peers, 2)

    b.send({ t: 's', state: state('town', 4, { a: 'walk', s: 0.5 }) })
    const s = await a.next(m => m.t === 's')
    assert.deepEqual(s, { t: 's', id: wb.id, state: state('town', 4, { a: 'walk', s: 0.5 }) })
    a.send({ t: 'ping' })
    assert.equal((await a.next(m => m.t === 'pong')).t, 'pong')

    b.ws.close()
    assert.deepEqual(await a.next(m => m.t === 'leave'), { t: 'leave', id: wb.id })
    a.ws.close()
  } finally {
    await svc.stop()
  }
})

// ---------------------------------------------------------------- the link

class FakeSocket {
  static all = []
  readyState = 0
  sent = []
  onopen = null; onmessage = null; onclose = null; onerror = null
  constructor(url) { this.url = url; FakeSocket.all.push(this) }
  send(s) { this.sent.push(JSON.parse(s)) }
  close() { this.readyState = 3 }
  // the service's side
  open() { this.readyState = 1; this.onopen?.({}) }
  deliver(m) { this.onmessage?.({ data: JSON.stringify(m) }) }
  drop(code = 1006) { this.readyState = 3; this.onclose?.({ code }) }
}

function fakeDoc() {
  const fns = new Set()
  return {
    hidden: false,
    addEventListener: (_t, fn) => fns.add(fn),
    removeEventListener: (_t, fn) => fns.delete(fn),
    set(h) { this.hidden = h; for (const fn of fns) fn() },
  }
}

function linkRig() {
  FakeSocket.all = []
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000_000 })
  const doc = fakeDoc()
  const link = createWorldLink('ws://test/ws', { WebSocket: FakeSocket, doc, win: null, random: () => 0 })
  const events = [], statuses = []
  link.onPeer(e => events.push(e))
  link.onStatus(s => statuses.push(s))
  const sock = () => FakeSocket.all.at(-1)
  return { link, doc, events, statuses, sock, tick: ms => mock.timers.tick(ms) }
}

test('link: waits for info and state, says hello, goes online on welcome', (t) => {
  const r = linkRig()
  t.after(() => { r.link.close(); mock.timers.reset() })
  r.link.pushState(state())
  assert.equal(FakeSocket.all.length, 0) // no info yet
  r.link.setInfo(info('Anna'))
  assert.equal(FakeSocket.all.length, 1)
  assert.equal(r.link.status, 'connecting')
  r.sock().open()
  assert.deepEqual(r.sock().sent, [{ t: 'hello', v: 1, info: info('Anna'), state: state() }])
  r.sock().deliver({ t: 'welcome', id: 'me', peers: [{ id: 'bo', info: info('Bo'), state: state('town', 2) }] })
  assert.equal(r.link.status, 'online')
  assert.deepEqual(r.events, [{ t: 'join', id: 'bo', info: info('Bo'), state: state('town', 2) }])
  r.sock().deliver({ t: 's', id: 'bo', state: { ...state(), pl: 'nowhere' } }) // invalid: dropped
  r.sock().deliver({ t: 'leave', id: 'bo' })
  assert.deepEqual(r.events.at(-1), { t: 'leave', id: 'bo' })
  assert.equal(r.events.length, 2)
})

test('link: pushState is throttled to SEND_HZ, skips tiny changes, sends the exact state once stopped', (t) => {
  const r = linkRig()
  t.after(() => { r.link.close(); mock.timers.reset() })
  r.link.setInfo(info('Anna'))
  r.link.pushState(state())
  r.sock().open()
  r.sock().deliver({ t: 'welcome', id: 'me', peers: [] })
  const sent = () => r.sock().sent.filter(m => m.t === 's')

  // 60 frames a second for one second, moving 5 cm a frame.
  for (let i = 1; i <= 60; i++) { r.tick(1000 / 60); r.link.pushState(state('town', i * 0.05, { a: 'walk', s: 1 })) }
  const n = sent().length
  assert.ok(n <= SEND_HZ + 1 && n >= SEND_HZ - 2, `sent ${n} states in a second`)
  // Stops: the last frames differ by less than the thresholds, the exact final state still goes out.
  r.link.pushState(state('town', 3.01, { a: 'idle', s: 0 }))
  for (let i = 0; i < 30; i++) { r.tick(1000 / 60); r.link.pushState(state('town', 3.01, { a: 'idle', s: 0 })) }
  assert.deepEqual(sent().at(-1).state, state('town', 3.01, { a: 'idle', s: 0 }))
  const after = sent().length
  for (let i = 0; i < 60; i++) { r.tick(1000 / 60); r.link.pushState(state('town', 3.01, { a: 'idle', s: 0 })) }
  assert.equal(sent().length, after, 'standing still sends nothing')
  // Standing still, a ping every 20 s keeps the service from calling it idle.
  r.tick(20_000)
  assert.ok(r.sock().sent.some(m => m.t === 'ping'))
})

test('link: reconnects with backoff, resets peers, says hello with the latest state', (t) => {
  const r = linkRig()
  t.after(() => { r.link.close(); mock.timers.reset() })
  r.link.setInfo(info('Anna'))
  r.link.pushState(state())
  r.sock().open()
  r.sock().deliver({ t: 'welcome', id: 'me', peers: [{ id: 'bo', info: info('Bo'), state: state() }] })
  r.sock().drop()
  assert.equal(r.link.status, 'offline')
  assert.deepEqual(r.events.at(-1), { t: 'reset' })
  r.link.pushState(state('stars', 1))
  assert.equal(FakeSocket.all.length, 1, 'pushState does not jump the backoff')
  r.tick(999)
  assert.equal(FakeSocket.all.length, 1)
  r.tick(1)
  assert.equal(FakeSocket.all.length, 2)
  // Fails again: 2 s, then 4 s.
  r.sock().drop()
  r.tick(1999); assert.equal(FakeSocket.all.length, 2)
  r.tick(1); assert.equal(FakeSocket.all.length, 3)
  r.sock().drop()
  r.tick(4000); assert.equal(FakeSocket.all.length, 4)
  r.sock().open()
  assert.deepEqual(r.sock().sent[0].state, state('stars', 1))
  r.sock().deliver({ t: 'welcome', id: 'me2', peers: [] })
  assert.equal(r.link.status, 'online')
  // After a success the backoff starts at 1 s again.
  r.sock().drop()
  r.tick(1000); assert.equal(FakeSocket.all.length, 5)
})

test('link: full waits long, hidden tab closes, visible reconnects, close stops everything', (t) => {
  const r = linkRig()
  t.after(() => { r.link.close(); mock.timers.reset() })
  r.link.setInfo(info('Anna'))
  r.link.pushState(state())
  r.sock().open()
  r.sock().deliver({ t: 'full' })
  r.sock().drop(4003)
  assert.equal(r.link.status, 'full')
  r.tick(29_000)
  assert.equal(FakeSocket.all.length, 1)
  r.tick(1_000)
  assert.equal(FakeSocket.all.length, 2)
  r.sock().open()
  r.sock().deliver({ t: 'welcome', id: 'me', peers: [{ id: 'bo', info: info('Bo'), state: state() }] })
  assert.equal(r.link.status, 'online')

  r.doc.set(true)
  assert.equal(r.link.status, 'offline')
  assert.deepEqual(r.events.at(-1), { t: 'reset' })
  r.tick(120_000)
  assert.equal(FakeSocket.all.length, 2, 'no reconnects while hidden')
  r.doc.set(false)
  assert.equal(FakeSocket.all.length, 3)

  // A socket that never answers is given up after a while.
  r.tick(20_000)
  assert.equal(r.link.status, 'offline')

  r.link.close()
  r.tick(120_000)
  const count = FakeSocket.all.length
  r.link.pushState(state('town', 9))
  r.link.sendFx({ k: 'emote', e: 'wave' })
  assert.equal(FakeSocket.all.length, count)
})

test('link: a WebSocket that throws never reaches the game', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] })
  t.after(() => mock.timers.reset())
  const link = createWorldLink('ws://test', { WebSocket: class { constructor() { throw new Error('nope') } }, doc: null, win: null })
  link.setInfo(info('Anna'))
  link.pushState(state())
  assert.equal(link.status, 'offline')
  link.close()
  assert.equal(worldUrl(), 'wss://sleeper.phareim.no/mw-world/ws')
})

test('link + service: two links see each other move', async () => {
  const svc = await startService()
  class OriginWS extends WebSocket { constructor(url) { super(url, { origin: ORIGIN }) } }
  const url = `ws://127.0.0.1:${svc.port}/ws`
  const a = createWorldLink(url, { WebSocket: OriginWS, doc: null, win: null })
  const b = createWorldLink(url, { WebSocket: OriginWS, doc: null, win: null })
  try {
    const seen = []
    const waitFor = (pred) => new Promise((resolve, reject) => {
      const off = b.onPeer(e => { if (pred(e)) { off(); resolve(e) } })
      setTimeout(() => reject(new Error('timed out')), 3000).unref()
    })
    b.onPeer(e => seen.push(e))
    const online = (l) => new Promise(res => { if (l.status === 'online') res(); else l.onStatus(s => s === 'online' && res()) })
    b.setInfo(info('Bo')); b.pushState(state())
    await online(b)
    const joined = waitFor(e => e.t === 'join')
    a.setInfo(info('Anna')); a.pushState(state('town', 1))
    await online(a)
    const j = await joined
    assert.equal(j.info.name, 'Anna')
    const moved = waitFor(e => e.t === 's' && e.state.x === 5)
    await new Promise(r => setTimeout(r, 120))
    a.pushState(state('town', 5, { a: 'run', s: 1 }))
    assert.equal((await moved).id, j.id)
    const left = waitFor(e => e.t === 'leave')
    a.close()
    assert.equal((await left).id, j.id)
  } finally {
    a.close(); b.close()
    await svc.stop()
  }
})
