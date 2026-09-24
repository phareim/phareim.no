// A scripted player for Neon Shrine tests: step, press A, walk a
// path-finding route (god mode: full hearts, always invulnerable), use the
// B item, clear a room. `Z` is the bundled engine (zelda-load.mjs).
import assert from 'node:assert/strict'

export function walker(Z, W = Z.WORLD) {
  const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
  const step = (s, i = inp(), dt = 1 / 60) => Z.stepGame(W, s, dt, i)
  const frames = (s, n, i) => { for (let k = 0; k < n; k++) { s.hero.invuln = Math.max(s.hero.invuln, 0.2); step(s, i) } }

  /** Press A through any dialog / item-get in progress. */
  function settle(s, max = 900) {
    for (let i = 0; i < max && s.mode !== 'play' && s.mode !== 'won'; i++) {
      if (s.mode === 'dialog') { step(s, inp(), 0.3); step(s, inp({ aPress: true, a: true })) } else step(s)
    }
  }

  /** BFS over tiles the hero can stand on. */
  function path(s, tx, ty) {
    const m = s.map
    const sx = Math.floor(s.hero.x)
    const sy = Math.floor(s.hero.y)
    const npc = new Set(m.npcs.flatMap(n => [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]].map(([a, b]) => Math.floor(n.y + b) * m.w + Math.floor(n.x + a))))
    const ok = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && !Z.solidTile(W, m, x, y, 'hero') && m.tiles[y * m.w + x] !== 'O' && !npc.has(y * m.w + x)
    const prev = new Map()
    const key = (x, y) => y * m.w + x
    const q = [[sx, sy]]
    prev.set(key(sx, sy), null)
    while (q.length) {
      const [x, y] = q.shift()
      if (x === tx && y === ty) break
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (!ok(nx, ny) || prev.has(key(nx, ny))) continue
        prev.set(key(nx, ny), [x, y])
        q.push([nx, ny])
      }
    }
    if (!prev.has(key(tx, ty))) return null
    const out = []
    let cur = [tx, ty]
    while (cur) { out.unshift(cur); cur = prev.get(key(cur[0], cur[1])) }
    return out
  }

  /** Walk to tile (tx, ty); stops early if the map changes (a door, stairs, a hole). */
  function walkTo(s, tx, ty, { map = s.map.id, budget = 6000, keepDialog = false } = {}) {
    let p = path(s, tx, ty)
    assert.ok(p, `no path in ${s.map.id} from ${Math.floor(s.hero.x)},${Math.floor(s.hero.y)} to ${tx},${ty} (${s.map.tiles[ty * s.map.w + tx]})`)
    let i = 0
    for (let n = 0; n < budget; n++) {
      s.hero.hp = s.hero.maxHp
      s.hero.invuln = 1
      if (keepDialog && s.mode === 'dialog') return true
      if (s.mode === 'dialog' || s.mode === 'get') { settle(s); continue }
      if (s.mode === 'won') return true
      if (s.mode !== 'play') { step(s); continue }
      if (s.map.id !== map) return true
      const h = s.hero
      if (Math.floor(h.x) === tx && Math.floor(h.y) === ty && Math.hypot(h.x - tx - 0.5, h.y - ty - 0.5) < 0.12) return true
      while (i < p.length - 1 && Math.floor(h.x) === p[i][0] && Math.floor(h.y) === p[i][1] && Math.hypot(h.x - p[i][0] - 0.5, h.y - p[i][1] - 0.5) < 0.25) i++
      const [gx, gy] = p[Math.min(i, p.length - 1)]
      const dx = gx + 0.5 - h.x
      const dy = gy + 0.5 - h.y
      const d = Math.hypot(dx, dy) || 1
      step(s, inp({ move: { x: dx / d, y: dy / d } }))
      if (n % 90 === 89) { p = path(s, tx, ty) ?? p; i = 0 }
    }
    assert.fail(`walkTo ${tx},${ty} timed out at ${s.hero.x.toFixed(2)},${s.hero.y.toFixed(2)} in ${s.map.id}`)
  }

  /** Walk a list of tiles in order (to steer round things a shortest path would step on). */
  function route(s, pts) { for (const [x, y] of pts) walkTo(s, x, y) }

  /** Wait (in play) until the map is `id`, stepping `i`. */
  function until(s, pred, i = inp(), max = 600) {
    for (let k = 0; k < max && !pred(); k++) {
      s.hero.invuln = 1
      if (s.mode === 'dialog' || s.mode === 'get') settle(s)
      else step(s, i)
    }
    assert.ok(pred(), 'until: condition never held')
  }

  function face(s, dir) { s.hero.dir = dir }
  function pressA(s) { step(s, inp({ aPress: true, a: true })); settle(s) }
  function swing(s, dir) { face(s, dir); step(s, inp({ aPress: true, a: true })); frames(s, 30); settle(s) }

  /** Use the B item facing `dir` and let it play out (the hook reels in, a bomb goes off). */
  function useB(s, item, dir, wait = 150) {
    s.inv.selected = item
    face(s, dir)
    step(s, inp({ bPress: true }))
    for (let k = 0; k < wait; k++) { s.hero.invuln = 1; step(s); if (item === 'hook' && !s.hook) break }
    settle(s)
  }

  /** Kill every enemy in the hero's room. */
  function killCell(s) {
    const c = Z.ctx(W, s, [])
    for (const e of s.map.enemies) if (e.cell === s.zoneIndex && !e.dead && e.kind !== 'eye') Z.killEnemy(c, e)
    frames(s, 5)
  }

  return { inp, step, frames, settle, path, walkTo, route, until, face, pressA, swing, useB, killCell }
}
