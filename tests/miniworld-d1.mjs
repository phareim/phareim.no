// A D1-shaped wrapper around node's built-in SQLite, with the repo's
// migrations applied, so the server tests can run the D1 store's real SQL.
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const migrations = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

class Prepared {
  constructor(db, sql, params = []) {
    this.db = db
    this.sql = sql
    this.params = params
  }
  bind(...values) { return new Prepared(this.db, this.sql, values) }
  stmt() { return this.db.prepare(this.sql) }
  async first() { return this.stmt().get(...this.params) ?? null }
  async all() { return { results: this.stmt().all(...this.params) } }
  async run() { return { meta: { changes: Number(this.stmt().run(...this.params).changes) } } }
}

export function d1() {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  for (const f of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(migrations, f), 'utf8'))
  }
  return {
    raw: db,
    prepare: sql => new Prepared(db, sql),
    // D1 runs a batch as one transaction.
    async batch(stmts) {
      db.exec('BEGIN')
      try {
        const out = stmts.map(s => ({ results: s.stmt().all(...s.params) }))
        db.exec('COMMIT')
        return out
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
  }
}
