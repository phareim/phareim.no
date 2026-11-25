// What a save points at in the frontier (themes/zelda/world/gen/), region by
// region: chest ids, places and contents, the heart piece, folk, entries,
// caves (and their chests), the Underglow's layers and the buried dig caches.
// A save's `chest:`/`took:` flags and continue points name these, so they must
// never move. tests/zelda-frontier-fingerprint.json is this, taken before the
// gates were cut; tests/zelda-gates.test.mjs ('moves nothing a save points at')
// compares the world against it.
//
// Regenerate (only when a change is MEANT to move saved things, and say so in
// the docs): node tests/zelda-fingerprint.mjs > tests/zelda-frontier-fingerprint.json

/** The saved things of one generated map. */
export function mapPrint(def) {
  const chests = []
  const folk = []
  def.rows.forEach((row, y) => {
    let x = 0
    for (const ch of row) {
      const e = def.marks[ch]?.ent
      if (e?.t === 'chest') chests.push([e.id, x, y, e.item])
      else if (e?.t === 'npc') folk.push([e.id, x, y])
      x++
    }
  })
  const entries = Object.fromEntries(Object.entries(def.entries ?? {}).map(([k, v]) => [k, [v.x, v.y, v.dir]]).sort(([a], [b]) => (a < b ? -1 : 1)))
  const caches = (def.dig?.caches ?? []).map(c => [c.id, c.x, c.y, c.item])
  return { chests, folk, entries, ...(caches.length ? { caches } : {}) }
}

/** Every region of the frontier, with its caves and layers, by id. */
export function fingerprint(Z) {
  const out = {}
  for (let ry = 0; ry < 12; ry++) for (let rx = 0; rx < 12; rx++) {
    const id = `fr:${rx},${ry}`
    const d = Z.WORLD.generate(id)
    if (!d) continue
    out[id] = mapPrint(d)
    for (const k of Object.keys(d.entries).sort()) {
      const m = /^cave(\d+)$/.exec(k)
      if (m) out[`${id}:cave${m[1]}`] = mapPrint(Z.WORLD.generate(`${id}:cave${m[1]}`))
      if (k === 'deep') for (let n = 1; n <= 6; n++) out[`${id}:deep${n}`] = mapPrint(Z.WORLD.generate(`${id}:deep${n}`))
    }
  }
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { load } = await import('./zelda-load.mjs')
  const Z = await load()
  const fp = fingerprint(Z)
  // One map per line: small diffs when a map does change.
  process.stdout.write('{\n' + Object.entries(fp).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n}\n')
}
