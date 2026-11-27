/**
 * The feedback store: one folder per entry under a root directory, written
 * into `<id>.tmp/` and renamed to `<id>/` so a reader never sees half an
 * entry. Used by the service (app.ts) and the CLI (cli.mjs); no framework,
 * no dependencies. Node strips the types.
 */
import { mkdir, writeFile, rename, readFile, readdir, rm, stat } from 'node:fs/promises'
import { randomInt } from 'node:crypto'
import { join } from 'node:path'

export const ID_RE = /^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\dZ-[a-z0-9]{4}$/
export type Status = 'open' | 'done'
export type Json = Record<string, any>
export type EntryMeta = {
  v: 1
  id: string
  createdAt: string
  status: Status
  doneAt: string | null
  by: string
  text: string
  client: Json
  files: { shot: number | null; save: number | null }
}
export type NewEntry = { by: string; text: string; client: Json; shot: Buffer | null; save: string | null }
export type Item = {
  id: string
  createdAt: string
  status: Status
  text: string
  where: { map: string | null; area: string | null; tile: { x: number; y: number } | null }
  shot: boolean
}

const FILES = new Set(['meta.json', 'shot.jpg', 'save.json'])
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function newId(now = new Date()): string {
  let tail = ''
  for (let i = 0; i < 4; i++) tail += ALPHABET[randomInt(ALPHABET.length)]
  return `${now.toISOString().slice(0, 19).replace(/:/g, '-')}Z-${tail}`
}

export async function ensureRoot(root: string): Promise<void> {
  await mkdir(root, { recursive: true, mode: 0o700 })
}

/** Writes one entry; returns its id and the bytes it took. */
export async function writeEntry(root: string, e: NewEntry): Promise<{ id: string; bytes: number }> {
  await ensureRoot(root)
  for (let attempt = 0; attempt < 6; attempt++) {
    const id = newId()
    const tmp = join(root, `${id}.tmp`)
    const final = join(root, id)
    try { await mkdir(tmp, { mode: 0o700 }) } catch (err: any) {
      if (err?.code === 'EEXIST') continue
      throw err
    }
    const saveBuf = e.save === null ? null : Buffer.from(e.save, 'utf8')
    const meta: EntryMeta = {
      v: 1, id, createdAt: new Date().toISOString(), status: 'open', doneAt: null, by: e.by, text: e.text,
      client: e.client, files: { shot: e.shot ? e.shot.length : null, save: saveBuf ? saveBuf.length : null },
    }
    const metaBuf = Buffer.from(JSON.stringify(meta, null, 1), 'utf8')
    try {
      await writeFile(join(tmp, 'meta.json'), metaBuf, { mode: 0o600 })
      if (e.shot) await writeFile(join(tmp, 'shot.jpg'), e.shot, { mode: 0o600 })
      if (saveBuf) await writeFile(join(tmp, 'save.json'), saveBuf, { mode: 0o600 })
      await rename(tmp, final)
    } catch (err: any) {
      await rm(tmp, { recursive: true, force: true }).catch(() => {})
      if (err?.code === 'ENOTEMPTY' || err?.code === 'EEXIST') continue
      throw err
    }
    return { id, bytes: metaBuf.length + (e.shot?.length ?? 0) + (saveBuf?.length ?? 0) }
  }
  throw new Error('no free id')
}

/** Entry ids on disk, newest first; `*.tmp` and anything else is skipped. */
export async function listIds(root: string): Promise<string[]> {
  let names: string[]
  try { names = await readdir(root) } catch (err: any) { if (err?.code === 'ENOENT') return []; throw err }
  return names.filter(n => ID_RE.test(n)).sort().reverse()
}

export async function readMeta(root: string, id: string): Promise<EntryMeta | null> {
  if (!ID_RE.test(id)) return null
  try { return JSON.parse(await readFile(join(root, id, 'meta.json'), 'utf8')) } catch { return null }
}

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' ? v.slice(0, max) : null
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function toItem(m: EntryMeta): Item {
  const w = m.client?.where ?? {}
  const t = w.tile && num(w.tile.x) !== null && num(w.tile.y) !== null ? { x: w.tile.x as number, y: w.tile.y as number } : null
  return {
    id: m.id,
    createdAt: m.createdAt,
    status: m.status === 'done' ? 'done' : 'open',
    text: String(m.text ?? '').slice(0, 300),
    where: { map: str(w.map?.name, 200) ?? str(w.map?.id, 200), area: str(w.area, 200), tile: t },
    shot: !!m.files?.shot,
  }
}

/** One page, newest first, open and done mixed. `next` is the last id of a full page that has more after it. */
export async function listPage(root: string, before: string | null, limit = 30): Promise<{ items: Item[]; next: string | null }> {
  const ids = (await listIds(root)).filter(id => !before || id < before)
  const items: Item[] = []
  let used = 0
  for (const id of ids) {
    used++
    const m = await readMeta(root, id)
    if (m) items.push(toItem(m))
    if (items.length >= limit) break
  }
  const more = used < ids.length
  return { items, next: more && items.length ? items[items.length - 1].id : null }
}

/** A stored file by fixed name; null when the id or name is not allowed or the file is missing. */
export async function readEntryFile(root: string, id: string, name: string): Promise<Buffer | null> {
  if (!ID_RE.test(id) || !FILES.has(name)) return null
  try { return await readFile(join(root, id, name)) } catch { return null }
}

/** Sets status done (once; doneAt stays at the first time). False when there is no such entry. */
export async function setDone(root: string, id: string): Promise<boolean> {
  const m = await readMeta(root, id)
  if (!m) return false
  if (m.status !== 'done') {
    m.status = 'done'
    m.doneAt = new Date().toISOString()
    const tmp = join(root, id, 'meta.json.tmp')
    await writeFile(tmp, JSON.stringify(m, null, 1), { mode: 0o600 })
    await rename(tmp, join(root, id, 'meta.json'))
  }
  return true
}

/** Total bytes of every file under the root (counted once at start). */
export async function storeSize(root: string): Promise<number> {
  let total = 0
  let names: string[]
  try { names = await readdir(root) } catch { return 0 }
  for (const n of names) {
    const dir = join(root, n)
    let files: string[]
    try { files = await readdir(dir) } catch { continue }
    for (const f of files) {
      try { total += (await stat(join(dir, f))).size } catch { /* gone */ }
    }
  }
  return total
}

/** Deletes `*.tmp` folders older than `maxAgeMs`. Returns how many. */
export async function sweepTmp(root: string, maxAgeMs = 10 * 60_000, now = Date.now()): Promise<number> {
  let names: string[]
  try { names = await readdir(root) } catch { return 0 }
  let n = 0
  for (const name of names) {
    if (!name.endsWith('.tmp') || name.includes('/')) continue
    const p = join(root, name)
    try {
      const s = await stat(p)
      if (s.isDirectory() && now - s.mtimeMs > maxAgeMs) { await rm(p, { recursive: true, force: true }); n++ }
    } catch { /* gone */ }
  }
  return n
}
