// The portal (phareim.no's front door) on the Neon Shrine engine: the world
// validates, the start view shows the name and two buildings on a phone and
// a desktop, every exit leads where it says, a path-finding walker reaches
// and uses each one from the start, coming back stands you in front of it,
// and nothing here can hurt you.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './portal-load.mjs'

let P
let W
before(async () => { P = await load(); W = P.PORTAL_WORLD })

const GAMES = ['anotherworld', 'galaga', 'breakout', 'rtype', 'invaders', 'starfox', 'outrun', 'tetris']
const EXPECTED = {
  // cabinets
  ...Object.fromEntries(GAMES.map(g => [g, { map: 'arcade', to: { theme: g }, look: 'cabinet' }])),
  leaderboard: { map: 'arcade', to: { theme: 'leaderboard' }, look: 'board' },
  hangar: { map: 'arcade', to: { theme: 'hangar' }, look: 'door' },
  shrine: { map: 'plaza', to: { theme: 'zelda' }, look: 'door' },
  kiosk: { map: 'plaza', to: { url: 'https://phareim.md' }, look: 'kiosk' },
  games: { map: 'plaza', to: { url: 'https://games.phareim.no' }, look: 'sign' },
  linkedin: { map: 'home', to: { url: 'https://www.linkedin.com/in/phareim' }, look: 'terminal' },
  github: { map: 'home', to: { url: 'https://github.com/phareim' }, look: 'terminal' },
  bluesky: { map: 'home', to: { url: 'https://bsky.app/profile/phareim.no' }, look: 'terminal' },
}

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })

/** Every placed exit: { id, map, x, y, ent }. */
function placedExits() {
  const out = []
  for (const [map, def] of Object.entries(W.maps)) {
    def.rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const ent = def.marks[r[x]]?.ent
        if (ent?.t === 'exit') out.push({ id: ent.id, map, x, y, ent })
      }
    })
  }
  return out
}

// ---- walker ------------------------------------------------------------------------

/**
 * A game plus everything it has said, and a hero that must never get hurt.
 * `step` checks the peaceful rules on every frame.
 */
function session(world = W) {
  const s = P.createGame(world, { seed: 7 })
  const events = []
  const step = (i = inp(), dt = 1 / 60) => {
    const ev = P.stepGame(world, s, dt, i)
    events.push(...ev)
    assert.equal(s.hero.hp, s.hero.maxHp, 'the hero lost health in a peaceful world')
    for (const e of ev) assert.ok(!['hurt', 'swing', 'spin', 'died', 'shock'].includes(e.type), `peaceful world emitted ${e.type}`)
    return ev
  }
  return { s, events, step, world }
}

/** Tile path (BFS) over what the hero can stand on, around NPCs; the goal may be a walk-on exit or warp. */
function path(g, tx, ty) {
  const { s, world } = g
  const m = s.map
  const sx = Math.floor(s.hero.x)
  const sy = Math.floor(s.hero.y)
  const npc = new Set(m.npcs.flatMap(n => [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]].map(([a, b]) => Math.floor(n.y + b) * m.w + Math.floor(n.x + a))))
  const doors = new Set(P.mapInfo(world, m.id).warps.map(w => w.y * m.w + w.x))
  for (const e of m.exits) if (e.walk) doors.add(Math.floor(e.y) * m.w + Math.floor(e.x))
  const key = (x, y) => y * m.w + x
  // Doors and walk-on exits end a walk, so only the goal may be one.
  const ok = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && !P.solidTile(world, m, x, y, 'hero') && !npc.has(key(x, y)) && (!doors.has(key(x, y)) || (x === tx && y === ty))
  const prev = new Map([[key(sx, sy), null]])
  const q = [[sx, sy]]
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
  for (let cur = [tx, ty]; cur; cur = prev.get(key(cur[0], cur[1]))) out.unshift(cur)
  return out
}

/** Walk to tile (tx, ty) on the current map. Returns when there, or when the map or mode changes for good (a door, an exit). */
function walkTo(g, tx, ty, budget = 6000) {
  const { s } = g
  const map = s.map.id
  let p = path(g, tx, ty)
  assert.ok(p, `no path in ${map} from ${Math.floor(s.hero.x)},${Math.floor(s.hero.y)} to ${tx},${ty}`)
  let i = 0
  for (let n = 0; n < budget; n++) {
    if (s.mode === 'exit') return
    if (s.mode === 'dialog') { g.step(inp(), 0.5); g.step(inp({ aPress: true, a: true })); continue }
    if (s.mode !== 'play' || s.hero.auto) { g.step(); continue }
    if (s.map.id !== map) return
    const h = s.hero
    if (Math.floor(h.x) === tx && Math.floor(h.y) === ty && Math.hypot(h.x - tx - 0.5, h.y - ty - 0.5) < 0.12) return
    while (i < p.length - 1 && Math.floor(h.x) === p[i][0] && Math.floor(h.y) === p[i][1] && Math.hypot(h.x - p[i][0] - 0.5, h.y - p[i][1] - 0.5) < 0.25) i++
    const [gx, gy] = p[Math.min(i, p.length - 1)]
    const dx = gx + 0.5 - h.x
    const dy = gy + 0.5 - h.y
    const d = Math.hypot(dx, dy) || 1
    g.step(inp({ move: { x: dx / d, y: dy / d } }))
    if (n % 90 === 89) { p = path(g, tx, ty) ?? p; i = 0 }
  }
  assert.fail(`walkTo ${tx},${ty} timed out at ${s.hero.x.toFixed(2)},${s.hero.y.toFixed(2)} in ${s.map.id}`)
}

/** Through the door that leads from the current map to `map`. */
function goToMap(g, map) {
  const { s, world } = g
  if (s.map.id === map) return
  // Every inside map hangs off the plaza.
  if (s.map.id !== 'plaza' && map !== 'plaza') goToMap(g, 'plaza')
  const door = P.mapInfo(world, s.map.id).warps.find(w => w.to === map)
  assert.ok(door, `no door from ${s.map.id} to ${map}`)
  walkTo(g, door.x, door.y)
  for (let k = 0; k < 120 && (s.map.id !== map || s.mode !== 'play'); k++) g.step()
  assert.equal(s.map.id, map)
}

/** Press A through a dialog until it closes (the exit fade starts on close). */
function readThrough(g) {
  for (let k = 0; k < 40 && g.s.mode === 'dialog'; k++) { g.step(inp(), 0.5); g.step(inp({ aPress: true, a: true })) }
}

/** From the start, go to exit `id` and use it; returns the `exit` event and the lines read on the way. */
function useExit(id) {
  const g = session()
  const spot = placedExits().find(e => e.id === id)
  goToMap(g, spot.map)
  const walk = !P.TILE_INFO[g.s.map.tiles[spot.y * g.s.map.w + spot.x]].solid
  let lines = null
  if (walk) {
    walkTo(g, spot.x, spot.y)
  } else {
    walkTo(g, spot.x, spot.y + 1)
    g.s.hero.dir = 'up'
    g.step(inp({ aPress: true, a: true }))
    assert.equal(g.s.mode, 'dialog', `${id}: A should open its lines`)
    lines = g.s.dialog.lines
    readThrough(g)
  }
  for (let k = 0; k < 120 && g.s.mode !== 'exit'; k++) g.step()
  assert.equal(g.s.mode, 'exit', `${id}: never left (mode ${g.s.mode})`)
  const exits = g.events.filter(e => e.type === 'exit')
  assert.equal(exits.length, 1, `${id}: expected one exit event`)
  return { event: exits[0], lines, g }
}

// ---- tests -----------------------------------------------------------------------------

describe('portal world', () => {
  it('validates', () => assert.deepEqual(P.validateWorld(W), []))

  it('is peaceful, and starts in the plaza facing the name', () => {
    assert.equal(W.peaceful, true)
    const s = P.createGame(W, { seed: 1 })
    assert.equal(s.mode, 'play')
    assert.equal(s.map.id, 'plaza')
    assert.equal(s.hero.dir, 'up')
    assert.equal(s.dialog, null)
    for (const def of Object.values(W.maps)) {
      for (const m of Object.values(def.marks)) assert.notEqual(m.ent.t, 'enemy', `${def.id} has an enemy`)
    }
  })

  it('has one cabinet per arcade game, each with a pitch that ends on the coin line', () => {
    const cabinets = placedExits().filter(e => e.ent.look === 'cabinet')
    assert.deepEqual(cabinets.map(c => c.ent.art).sort(), [...GAMES].sort())
    for (const c of cabinets) {
      assert.equal(c.map, 'arcade')
      assert.deepEqual(c.ent.to, { theme: c.ent.art })
      assert.ok(c.ent.label, `${c.id} has no label`)
      assert.ok(c.ent.lines.length >= 2 && c.ent.lines.length <= 3, `${c.id} has ${c.ent.lines.length} lines`)
      assert.match(c.ent.lines.at(-1), /^INSERT COIN\? PRESS \{A\}\.$/)
      assert.equal(P.mapInfo(W, 'arcade').base[c.y * P.mapInfo(W, 'arcade').w + c.x], 'M', `${c.id} is not on a machine tile`)
    }
  })

  it('leads everywhere it should, and nowhere else', () => {
    const got = Object.fromEntries(placedExits().map(e => [e.id, { map: e.map, to: e.ent.to, look: e.ent.look }]))
    assert.deepEqual(got, EXPECTED)
    // No email address anywhere, on purpose.
    const text = JSON.stringify(W)
    assert.ok(!/mailto:|@[a-z0-9-]+\.[a-z]/i.test(text), 'the world carries an email address')
  })

  it('shows the name and at least two buildings at the start, on a phone and on a desktop', () => {
    const s = P.createGame(W, { seed: 1 })
    const def = W.maps.plaza
    const name = def.decals.find(d => d.text === 'PETTER HAREIM')
    assert.equal(name.scale, 3)
    const nameW = (P.textWidth(name.text) * name.scale) / 16
    const nameH = (7 * name.scale) / 16
    // Building blocks: 4-connected runs of H (door tiles count as wall).
    const seen = new Set()
    const blocks = []
    def.rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        if (seen.has(`${x},${y}`) || !isWall(def, x, y)) continue
        const cells = []
        const stack = [[x, y]]
        seen.add(`${x},${y}`)
        while (stack.length) {
          const [cx, cy] = stack.pop()
          cells.push([cx, cy])
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const k = `${cx + dx},${cy + dy}`
            if (!seen.has(k) && isWall(def, cx + dx, cy + dy)) { seen.add(k); stack.push([cx + dx, cy + dy]) }
          }
        }
        blocks.push(cells)
      }
    })
    assert.ok(blocks.length >= 3, 'house, arcade and hut')
    // 390×844 phone at 3× (≈15×28 tiles) and 1280×800 desktop at 1× and 2× (≈20×12.5, ≈18×11).
    for (const [label, vw, vh] of [['phone', 14.6, 28], ['desktop 1x', 20, 12.5], ['desktop 2x', 17.8, 11.1]]) {
      const cam = P.cameraFor(s, vw, vh)
      const inView = (x, y, w, h) => x >= cam.x - 1e-6 && y >= cam.y - 1e-6 && x + w <= cam.x + vw + 1e-6 && y + h <= cam.y + vh + 1e-6
      assert.ok(inView(name.x - nameW / 2, name.y, nameW, nameH), `${label}: the name is cut off`)
      // A building counts when at least two of its tiles show.
      const shown = blocks.filter(b => b.filter(([x, y]) => inView(x, y, 1, 1)).length >= 2)
      assert.ok(shown.length >= 2, `${label}: only ${shown.length} building(s) in view`)
    }
  })

  it('reaches and uses every exit from the start', () => {
    for (const [id, want] of Object.entries(EXPECTED)) {
      const { event, lines } = useExit(id)
      assert.equal(event.id, id)
      assert.deepEqual(event.to, want.to, `${id} leads to the wrong place`)
      const ent = placedExits().find(e => e.id === id).ent
      if (ent.lines) assert.deepEqual(lines, ent.lines, `${id}: the lines are the confirmation`)
    }
  })

  it('coming back stands you in front of the exit you used', () => {
    for (const e of placedExits()) {
      const w = P.worldStartingAt(e.map, e.id)
      assert.ok(w, `${e.id}: no way back`)
      const s = P.createGame(w, { seed: 1 })
      assert.equal(s.map.id, e.map)
      assert.equal(s.mode, 'play')
      // One tile below it (every exit here opens to the south), and not on another exit or door.
      assert.equal(Math.floor(s.hero.x), e.x, `${e.id}: x`)
      assert.equal(Math.floor(s.hero.y), e.y + 1, `${e.id}: y`)
      const walk = !P.TILE_INFO[s.map.tiles[e.y * s.map.w + e.x]].solid
      assert.equal(s.hero.dir, walk ? 'down' : 'up', `${e.id}: facing`)
      // A few idle frames later nothing has fired.
      const ev = []
      for (let k = 0; k < 30; k++) ev.push(...P.stepGame(w, s, 1 / 60, inp()))
      assert.equal(s.mode, 'play')
      assert.ok(!ev.some(x => x.type === 'exit'))
    }
    assert.equal(P.worldStartingAt('nowhere', 'galaga'), null)
    assert.equal(P.worldStartingAt('arcade', 'nope'), null)
    assert.equal(P.worldStartingAt('arcade', '__proto__'), null)
    assert.equal(P.worldStartingAt(42, 'galaga'), null)
  })

  it('talks: the kid explains, Petter introduces himself', () => {
    const talk = (map, id) => Object.values(W.maps[map].marks).find(m => m.ent.t === 'npc' && m.ent.id === id).ent.talk[0].lines.join(' ')
    assert.match(talk('plaza', 'kid'), /PRESS \{A\}/)
    const petter = talk('home', 'petter')
    assert.match(petter, /FATHER, HUSBAND, GEEK, ASPIRING GOOD GUY\./)
    assert.match(petter, /HELP FOLKS\. WRITE CODE\. BUILD THINGS\./)
    assert.equal(Object.values(W.maps.home.marks).find(m => m.ent.t === 'npc').ent.look, 'petter')
  })
})

function isWall(def, x, y) {
  const ch = def.rows[y]?.[x]
  if (ch === undefined) return false
  const t = def.marks[ch]?.tile ?? ch
  return t === 'H' || ((t === 'D') && (def.rows[y - 1]?.[x] === 'H'))
}
