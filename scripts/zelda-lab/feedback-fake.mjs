#!/usr/bin/env node
// A fake of the feedback service's two routes, `GET /can` and `POST /entry` (docs/games/neon-shrine-feedback.md),
// for a dev server and the two checks. It keeps the contract's rules for the game's requests, with one difference:
// it reflects any Origin (the dev page is http://localhost:3030). It enforces the caps, the JPEG's first bytes and
// `meta.app` / `meta.v`, so a client that slips on the contract fails here. It asks nobody who anybody is.
//
//   node scripts/zelda-lab/feedback-fake.mjs [yes|no|drop|slow|500]      on port 3957, for `npm run dev`
//
// Modes: yes (200 and 201) · no (the one refusal, no CORS headers) · drop (the socket of /entry is destroyed) ·
// slow (/entry is never answered) · 500 (/entry answers 500). What it receives is written to a temporary folder.
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const CAPS = { body: 600_000, meta: 32_768, textChars: 4000, textBytes: 16_000, shot: 400_000, save: 65_536 }
export const MODES = ['yes', 'no', 'drop', 'slow', '500']

/** The one refusal: the same for every reason, and without CORS headers. */
function refuse(res) {
  res.writeHead(404, { 'content-type': 'text/plain', 'content-length': '0', 'cache-control': 'no-store' })
  res.end()
}

function answer(res, origin, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json', 'content-length': Buffer.byteLength(text), 'cache-control': 'no-store',
    'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', vary: 'Origin',
  })
  res.end(text)
}

/** The whole body, or null when it is over the cap (read to its end all the same, so the answer arrives). */
async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size <= CAPS.body) chunks.push(c)
  }
  return size > CAPS.body ? null : Buffer.concat(chunks)
}

const bad = why => Object.assign(new Error(why), { bad: why.slice(0, 60) })

function json(text, what) {
  try { return JSON.parse(text) } catch { throw bad(`${what} is not JSON`) }
}

/** The parts the contract names, checked; any other part is ignored. */
async function parts(req, body) {
  const type = req.headers['content-type'] ?? ''
  if (!type.startsWith('multipart/form-data')) throw bad('not multipart')
  let form
  try { form = await new Response(body, { headers: { 'content-type': type } }).formData() } catch { throw bad('not multipart') }
  const metaText = form.get('meta')
  if (typeof metaText !== 'string') throw bad('no meta')
  if (Buffer.byteLength(metaText) > CAPS.meta) throw bad('meta over its cap')
  const meta = json(metaText, 'meta')
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw bad('meta is not an object')
  if (typeof meta.app !== 'string' || meta.app.length < 1 || meta.app.length > 32) throw bad('meta.app')
  if (meta.v !== 1) throw bad('meta.v')
  const text = form.get('text')
  if (typeof text !== 'string') throw bad('no text')
  if (text.length > CAPS.textChars || Buffer.byteLength(text) > CAPS.textBytes) throw bad('text over its cap')
  let shot = null
  const file = form.get('shot')
  if (file !== null) {
    if (typeof file === 'string' || file.name !== 'shot.jpg' || file.type !== 'image/jpeg') throw bad('shot is not shot.jpg, image/jpeg')
    shot = Buffer.from(await file.arrayBuffer())
    if (shot.length > CAPS.shot) throw bad('shot over its cap')
    if (shot[0] !== 0xff || shot[1] !== 0xd8 || shot[2] !== 0xff) throw bad('shot is not a JPEG')
  }
  let save = null
  const saveText = form.get('save')
  if (saveText !== null) {
    if (typeof saveText !== 'string' || Buffer.byteLength(saveText) > CAPS.save) throw bad('save over its cap')
    save = json(saveText, 'save')
  }
  return { meta, text, shot, save }
}

export async function startFake({ port = 3957, mode = 'yes' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'feedback-fake-'))
  const requests = []
  const entries = []
  let now = mode

  async function serve(req, res) {
    const path = new URL(req.url, 'http://fake').pathname
    requests.push({ method: req.method, path })
    const can = req.method === 'GET' && path === '/can'
    const entry = req.method === 'POST' && path === '/entry'
    const origin = req.headers.origin
    if ((!can && !entry) || !origin || now === 'no') { req.resume(); return refuse(res) }
    if (can) return answer(res, origin, 200, { ok: true })
    if (now === 'drop') return req.socket.destroy()
    if (now === 'slow') return void req.resume()
    if (now === '500') { await readBody(req); return answer(res, origin, 500, { ok: false, error: 'server' }) }
    const body = await readBody(req)
    if (!body) return answer(res, origin, 413, { ok: false, error: 'too-large' })
    let got
    try { got = await parts(req, body) } catch (e) {
      if (!e.bad) throw e
      console.error(`feedback-fake: bad request: ${e.bad}`)
      return answer(res, origin, 400, { ok: false, error: 'bad-request', why: e.bad })
    }
    const id = `${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}Z-${Math.random().toString(36).slice(2, 6).padEnd(4, '0')}`
    const folder = join(dir, id)
    mkdirSync(folder)
    writeFileSync(join(folder, 'meta.json'), JSON.stringify({ id, text: got.text, client: got.meta }, null, 1))
    if (got.shot) writeFileSync(join(folder, 'shot.jpg'), got.shot)
    if (got.save !== null) writeFileSync(join(folder, 'save.json'), JSON.stringify(got.save))
    entries.push(got)
    answer(res, origin, 201, { ok: true, id })
  }

  const server = createServer((req, res) => {
    serve(req, res).catch((e) => {
      console.error('feedback-fake:', e)
      if (!res.headersSent) refuse(res)
    })
  })
  await new Promise((done, fail) => {
    server.once('error', fail)
    server.listen(port, done)
  })
  return {
    port: server.address().port,
    dir,
    setMode(m) {
      if (!MODES.includes(m)) throw new Error(`feedback-fake: no mode ${m}`)
      now = m
    },
    requests,
    entries: () => [...entries],
    async close() {
      server.closeAllConnections()
      await new Promise(done => server.close(done))
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] ?? 'yes'
  if (!MODES.includes(mode)) { console.error(`usage: feedback-fake.mjs [${MODES.join('|')}]`); process.exit(2) }
  const fake = await startFake({ mode })
  console.log(`feedback fake on http://localhost:${fake.port}, mode ${mode}; entries in ${fake.dir}`)
  let seen = 0
  let kept = 0
  setInterval(() => {
    for (; seen < fake.requests.length; seen++) console.log(`${fake.requests[seen].method} ${fake.requests[seen].path}`)
    for (const all = fake.entries(); kept < all.length; kept++) console.log(`  entry ${kept + 1}: "${all[kept].text.slice(0, 60)}" shot ${all[kept].shot?.length ?? 0} B`)
  }, 300)
}
