#!/usr/bin/env node
// feedback: reads the store folder directly (works with the service down).
//   feedback list [--all]   feedback show [<id|prefix>]   feedback done <id>
// FEEDBACK_ROOT picks the folder (default ~/data/feedback).
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ID_RE, listIds, readMeta, setDone } from './store.ts'

const root = process.env.FEEDBACK_ROOT || join(homedir(), 'data', 'feedback')
// Stored text is Petter's words but still data: no control characters reach the terminal.
const clean = (v) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '?')
const fail = (msg) => { console.error(msg); process.exit(1) }
const stamp = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? '?' : d.toLocaleString('sv-SE').slice(0, 16) }
const where = (m) => {
  const w = m.client?.where ?? {}
  const t = w.tile && typeof w.tile.x === 'number' ? `${w.tile.x},${w.tile.y}` : '?'
  return `${clean(w.map?.name ?? w.map?.id ?? '?')} · ${clean(w.area ?? '?')} · TILE ${t}`
}
const abs = (id, name) => join(root, id, name)

async function resolve(arg) {
  const ids = await listIds(root)
  if (!arg) {
    for (const id of ids) { const m = await readMeta(root, id); if (m && m.status === 'open') return m }
    fail('no open entries')
  }
  const hits = ids.filter(id => id.startsWith(arg))
  if (hits.length === 0) fail(`no entry matches ${clean(arg)}`)
  if (hits.length > 1) fail(`${hits.length} entries match ${clean(arg)}: be more exact`)
  const m = await readMeta(root, hits[0])
  if (!m) fail('entry unreadable')
  return m
}

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'list' && args.every(a => a === '--all')) {
  const all = args.includes('--all')
  for (const id of await listIds(root)) {
    const m = await readMeta(root, id)
    if (!m || (!all && m.status !== 'open')) continue
    console.log(`${id}  ${stamp(m.createdAt)}  ${m.status}  ${where(m)}  ${clean(m.text).replace(/\s+/g, ' ').slice(0, 70)}`)
  }
} else if (cmd === 'show' && args.length <= 1) {
  const m = await resolve(args[0])
  const c = m.client ?? {}
  const v = c.version ?? {}
  console.log(`${m.id}  ${stamp(m.createdAt)}  ${m.status}`)
  console.log(where(m))
  console.log(`version: ${clean(v.n ?? '?')} ${clean(v.hash ?? '')} ${clean(v.date ?? '')}`.trim())
  console.log('')
  console.log(clean(m.text) || '(no text)')
  console.log('')
  console.log(`meta: ${abs(m.id, 'meta.json')}`)
  console.log(`shot: ${abs(m.id, 'shot.jpg')}${m.files?.shot ? '' : ' (none)'}`)
  console.log(`save: ${abs(m.id, 'save.json')}${m.files?.save ? '' : ' (none)'}`)
  const w = c.where ?? {}
  const num = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : 'null')
  console.log(`replay: createGame(WORLD,{save}) then enterMap(WORLD, s, '${clean(w.map?.id ?? '?')}', '${clean(w.entry?.entry ?? '?')}', [], {x:${num(w.pos?.x)},y:${num(w.pos?.y)}})`)
} else if (cmd === 'done' && args.length === 1) {
  if (!ID_RE.test(args[0])) fail('done needs the full id')
  if (!(await setDone(root, args[0]))) fail('no such entry')
  console.log(`done ${args[0]}`)
} else {
  fail('usage: feedback list [--all] | show [<id|prefix>] | done <id>')
}
