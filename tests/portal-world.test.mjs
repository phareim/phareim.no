// The town — phareim.no's front door, the west end of Neon Shrine's one
// world: the world validates, the start view shows the name and two
// buildings on a phone and a desktop, the town has no enemies, the arcade's
// cabinets are its nine games plus Adventure's and Pizza Rescue's links out, the two
// DJs on the beach lead to Jam and the radio, every exit
// leads where it says, a path-finding walker reaches and uses each one from
// the start without a scratch, coming back stands you in front of it, and
// the coast road leads to the Keeper's hut.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { load } from './portal-load.mjs'

let P
let W
before(async () => { P = await load(); W = P.WORLD })
/** The town is the overworld's first 40 columns. */
const TOWN_W = 40

const GAMES = ['anotherworld', 'galaga', 'breakout', 'rtype', 'invaders', 'starfox', 'outrun', 'russian', 'battery']
/** Ulrikke's games, in the VIP hall next door (moved out of the arcade 2026-09-29). */
const KIDS = ['miniworld', 'figur']
/** Eventyrland, Ulrikke's 3D storybook on its own page: a cabinet in the VIP hall that leaves for the URL. */
const VIP_ARTS = [...KIDS, 'eventyrland']
/** The cabinets that are links out, not themes: art → where they leave for. Adventure is Eventyrland's open instance
 * (no account); Pizza Rescue (Nova & Rex: The Pizza Rescue) is a side-scrolling fighter on its own page, opened in
 * its pixel look and told where the visit came from, so it can offer the way back. */
const LINK_CABINETS = {
  eventyrland: 'https://eventyrland.phareim.no',
  adventure: 'https://adventure.phareim.no',
  pizzarescue: 'https://fighter.phareim.no/?look=wasteland&from=phareim',
}
const AWAY = LINK_CABINETS
const ARCADE_ARTS = [...GAMES, 'adventure', 'pizzarescue']
const EXPECTED = {
  // cabinets
  ...Object.fromEntries(GAMES.map(g => [g, { map: 'arcade', to: { theme: g }, look: 'cabinet' }])),
  ...Object.fromEntries(KIDS.map(g => [g, { map: 'vip', to: { theme: g }, look: 'cabinet' }])),
  eventyrland: { map: 'vip', to: { url: LINK_CABINETS.eventyrland }, look: 'cabinet' },
  adventure: { map: 'arcade', to: { url: LINK_CABINETS.adventure }, look: 'cabinet' },
  pizzarescue: { map: 'arcade', to: { url: LINK_CABINETS.pizzarescue }, look: 'cabinet' },
  leaderboard: { map: 'arcade', to: { theme: 'leaderboard' }, look: 'board' },
  hangar: { map: 'arcade', to: { theme: 'hangar' }, look: 'door' },
  kiosk: { map: 'overworld', to: { url: 'https://phareim.md' }, look: 'kiosk' },
  games: { map: 'overworld', to: { url: 'https://games.phareim.no' }, look: 'sign' },
  radio: { map: 'overworld', to: { url: 'https://radio.phareim.no/?from=phareim' }, look: 'booth' },
  jam: { map: 'overworld', to: { url: 'https://jam.phareim.no' }, look: 'booth' },
  linkedin: { map: 'home', to: { url: 'https://www.linkedin.com/in/phareim' }, look: 'terminal' },
  github: { map: 'home', to: { url: 'https://github.com/phareim' }, look: 'terminal' },
  bluesky: { map: 'home', to: { url: 'https://bsky.app/profile/phareim.no' }, look: 'terminal' },
  // Leaves nothing: its lines close into the shell's start-over question.
  newgame: { map: 'home', to: { reset: true }, look: 'cabinet' },
  // Leaves nothing either: A opens the shell's account panel (auth.phareim.no).
  login: { map: 'home', to: { panel: 'account' }, look: 'console' },
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
 * A game plus everything it has said, and a hero that must never get hurt
 * (`step` checks it on every frame; `safe: false` for walks out of town).
 */
function session(world = W, safe = true, opts = {}) {
  const s = P.createGame(world, { seed: 7, ...opts })
  const events = []
  const step = (i = inp(), dt = 1 / 60) => {
    const ev = P.stepGame(world, s, dt, i)
    events.push(...ev)
    if (!safe) return ev
    assert.equal(s.hero.hp, s.hero.maxHp, 'the hero lost health in the town')
    for (const e of ev) assert.ok(!['hurt', 'swing', 'spin', 'died', 'shock'].includes(e.type), `the town emitted ${e.type}`)
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
  let last = null
  for (let n = 0; n < budget; n++) {
    if (s.mode === 'exit') return
    if (s.mode === 'dialog') { g.step(inp(), 0.5); g.step(inp({ aPress: true, a: true })); continue }
    if (s.mode !== 'play' || s.hero.auto) { g.step(); continue }
    if (s.map.id !== map) return
    const h = s.hero
    if (Math.floor(h.x) === tx && Math.floor(h.y) === ty && Math.hypot(h.x - tx - 0.5, h.y - ty - 0.5) < 0.12) return
    while (i < p.length - 1 && Math.floor(h.x) === p[i][0] && Math.floor(h.y) === p[i][1] && Math.hypot(h.x - p[i][0] - 0.5, h.y - p[i][1] - 0.5) < 0.25) i++
    // Stuck on a wandering NPC: back off from it for a moment, then find a new path.
    if (n % 30 === 0) {
      if (last && Math.hypot(h.x - last.x, h.y - last.y) < 0.05) {
        const npc = s.map.npcs.reduce((a, b) => (Math.hypot(b.x - h.x, b.y - h.y) < Math.hypot(a.x - h.x, a.y - h.y) ? b : a))
        const ax = h.x - npc.x
        const ay = h.y - npc.y
        const al = Math.hypot(ax, ay) || 1
        for (let k = 0; k < 20; k++) g.step(inp({ move: { x: ax / al, y: ay / al } }))
        p = path(g, tx, ty) ?? p
        i = 0
      }
      last = { x: h.x, y: h.y }
    }
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
  // Every inside map hangs off the overworld.
  if (s.map.id !== 'overworld' && map !== 'overworld') goToMap(g, 'overworld')
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
  const spot = placedExits().find(e => e.id === id)
  // The VIP hall's door is roped off until somebody is logged in.
  const g = session(W, true, { session: spot.map === 'vip' })
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

  it('starts in the town facing the name, and the town has no enemies', () => {
    const s = P.createGame(W, { seed: 1 })
    assert.equal(s.mode, 'play')
    assert.equal(s.map.id, 'overworld')
    assert.equal(s.area, 'PHAREIM.NO')
    assert.ok(s.hero.x < TOWN_W)
    assert.equal(s.hero.dir, 'up')
    assert.equal(s.dialog, null)
    assert.equal(s.inv.sword, false)
    assert.ok(!s.map.enemies.some(e => e.x < TOWN_W), 'an enemy in the town')
    for (const id of ['arcade', 'home', 'vip']) assert.equal(P.createGame(W, { at: { map: id, entry: 'door' } }).map.enemies.length, 0, `an enemy in ${id}`)
  })

  it('has one cabinet per arcade game plus Adventure\'s and Pizza Rescue\'s, and Ulrikke\'s three in the VIP hall, each with a pitch that ends on the coin line', () => {
    const cabinets = placedExits().filter(e => e.ent.look === 'cabinet' && (e.map === 'arcade' || e.map === 'vip'))
    assert.deepEqual(cabinets.filter(c => c.map === 'arcade').map(c => c.ent.art).sort(), [...ARCADE_ARTS].sort())
    assert.deepEqual(cabinets.filter(c => c.map === 'vip').map(c => c.ent.art).sort(), [...VIP_ARTS].sort())
    for (const c of cabinets) {
      assert.ok(c.map === 'arcade' || c.map === 'vip')
      assert.deepEqual(c.ent.to, c.ent.art in LINK_CABINETS ? { url: LINK_CABINETS[c.ent.art] } : { theme: c.ent.art })
      assert.ok(c.ent.label, `${c.id} has no label`)
      assert.ok(c.ent.lines.length >= 2 && c.ent.lines.length <= 3, `${c.id} has ${c.ent.lines.length} lines`)
      assert.equal(c.ent.lines.at(-1), 'INSERT COIN?')
      assert.equal(P.mapInfo(W, c.map).base[c.y * P.mapInfo(W, c.map).w + c.x], 'M', `${c.id} is not on a machine tile`)
    }
  })

  it('has a cabinet in the arcade for PIZZA RESCUE that leaves for fighter.phareim.no and is not a theme', () => {
    const spot = placedExits().find(e => e.id === 'pizzarescue')
    assert.ok(spot, 'no Pizza Rescue cabinet')
    assert.equal(spot.map, 'arcade')
    assert.equal(spot.ent.look, 'cabinet')
    assert.equal(spot.ent.label, 'PIZZA RESCUE')
    // A link, not a theme: the target is the address alone, and the registry knows no such id.
    // The address says where the visit came from: the game then shows ARCADE, its way back, on its title and pause panel.
    assert.deepEqual(spot.ent.to, { url: LINK_CABINETS.pizzarescue })
    assert.match(spot.ent.to.url, /[?&]from=phareim(&|$)/)
    assert.ok(!GAMES.includes(spot.ent.art) && !KIDS.includes(spot.ent.art))
    assert.doesNotMatch(readFileSync(new URL('../themes/index.ts', import.meta.url), 'utf8'), /pizzarescue|slopfighter|fighter\.phareim/i, 'Pizza Rescue is in the theme registry')
    // Its own marquee and screen, not the default cabinet's.
    const paint = readFileSync(new URL('../themes/zelda/render/exits.ts', import.meta.url), 'utf8')
    assert.match(paint, /^  pizzarescue: \{/m, 'no cabinet style for Pizza Rescue')
    assert.match(paint, /case 'pizzarescue':/, 'no screen for Pizza Rescue')
    // The pitch opens on the game's full name, names the two buttons and says how to come back; the robot counts the hall's cabinets.
    assert.match(spot.ent.lines[0], /^NOVA & REX: THE PIZZA RESCUE\./)
    assert.match(spot.ent.lines.join(' '), /A PUNCHES, B KICKS/)
    assert.match(spot.ent.lines.join(' '), /PAUSE THERE AND PICK ARCADE/)
    assert.equal(placedExits().filter(e => e.map === 'arcade' && e.ent.look === 'cabinet').length, 11)
    const robot = Object.values(W.maps.arcade.marks).find(m => m.ent.t === 'npc' && m.ent.id === 'robot').ent.talk[0].lines.join(' ')
    assert.match(robot, /ELEVEN CABINETS/)
    // It stands in nobody's way: every exit in the hall, the vendor's counter, the robot, the sign and the chest can still be walked up to.
    const g = session()
    goToMap(g, 'arcade')
    const m = g.s.map
    const free = (x, y) => !P.solidTile(W, m, x, y, 'hero') && !!path(g, x, y)
    const beside = (x, y) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => free(x + dx, y + dy))
    for (const e of placedExits().filter(x => x.map === 'arcade')) {
      const walk = !P.TILE_INFO[m.tiles[e.y * m.w + e.x]].solid
      assert.ok(path(g, e.x, walk ? e.y : e.y + 1), `${e.id} cannot be reached`)
    }
    const vendor = m.npcs.find(n => n.id === 'vendor')
    assert.ok(free(Math.floor(vendor.x), Math.floor(vendor.y) + 2), 'no way to the front of the prize counter')
    const robotAt = m.npcs.find(n => n.id === 'robot')
    assert.ok(beside(Math.floor(robotAt.x), Math.floor(robotAt.y)), 'the robot cannot be reached')
    W.maps.arcade.rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if ('$QS'.includes(r[x])) assert.ok(beside(x, y), `${r[x]} at ${x},${y} cannot be reached`) })
    // Using it leaves for the address; coming back stands the hero in front of it.
    const { event } = useExit('pizzarescue')
    assert.deepEqual(event.to, { url: LINK_CABINETS.pizzarescue })
    const back = P.createGame(P.worldStartingAt('arcade', 'pizzarescue'), { seed: 1 })
    assert.deepEqual([back.map.id, Math.floor(back.hero.x), Math.floor(back.hero.y), back.hero.dir], ['arcade', spot.x, spot.y + 1, 'up'])
  })

  it('stands Adventure, Pizza Rescue and Night of the Dead Battery on the island straight ahead of the door', () => {
    const at = id => placedExits().find(e => e.map === 'arcade' && e.id === id)
    const [adventure, pizza, battery] = ['adventure', 'pizzarescue', 'battery'].map(at)
    const door = P.createGame(W, { at: { map: 'arcade', entry: 'door' } }).hero
    // Side by side in that order, the middle one in the door's own column, nearer the door than any other cabinet.
    assert.deepEqual([adventure.x, battery.x], [pizza.x - 1, pizza.x + 1])
    assert.ok(adventure.y === pizza.y && battery.y === pizza.y)
    assert.equal(pizza.x, Math.floor(door.x))
    assert.equal(door.dir, 'up')
    const others = placedExits().filter(e => e.map === 'arcade' && e.ent.look === 'cabinet' && !['adventure', 'pizzarescue', 'battery'].includes(e.id))
    assert.equal(others.length, 8)
    for (const c of others) assert.ok(c.y < pizza.y, `${c.id} stands nearer the door than the island`)
    // A pillar at each end, and nothing but floor between the door and the middle cabinet's stool.
    const rows = W.maps.arcade.rows
    assert.equal(rows[pizza.y][adventure.x - 1] + rows[pizza.y][battery.x + 1], 'II')
    for (let y = pizza.y + 1; y < Math.floor(door.y); y++) assert.match(rows[y][pizza.x], /[.,i]/, `row ${y} blocks the way from the door`)
    // The robot's welcome points at them.
    const robot = Object.values(W.maps.arcade.marks).find(m => m.ent.t === 'npc' && m.ent.id === 'robot').ent.talk[0].lines.join(' ')
    assert.match(robot, /ADVENTURE, PIZZA RESCUE, NIGHT OF THE DEAD BATTERY/)
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
    const def = W.maps.overworld
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
    assert.ok(blocks.length >= 3, 'house, arcade and newsstand')
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
      if ('reset' in want.to || 'panel' in want.to) continue
      const { event, lines } = useExit(id)
      assert.equal(event.id, id)
      assert.deepEqual(event.to, want.to, `${id} leads to the wrong place`)
      const ent = placedExits().find(e => e.id === id).ent
      if (ent.lines) assert.deepEqual(lines, ent.lines, `${id}: the lines are the confirmation`)
    }
  })

  it('asks YES or NO on the last line of every exit, and backs out without leaving', () => {
    const asking = placedExits().filter(e => e.ent.lines && !('reset' in e.ent.to) && !('panel' in e.ent.to))
    assert.ok(asking.length >= 16, `only ${asking.length} exits with lines`)
    /** Stand at the exit, press A, and type out every line but the last. */
    const open = (e) => {
      const w = P.worldStartingAt(e.map, e.id)
      const s = P.createGame(w, { seed: 1 })
      const ev = []
      const step = (i = inp(), dt = 1 / 60) => ev.push(...P.stepGame(w, s, dt, i))
      step(inp({ aPress: true, a: true }))
      assert.equal(s.mode, 'dialog', `${e.id}: A should open its lines`)
      return { s, ev, step }
    }
    const toLast = ({ s, step }) => {
      while (s.dialog.line < s.dialog.lines.length - 1) { step(inp(), 0.5); step(inp({ aPress: true, a: true })) }
      while (s.dialog.chars < s.dialog.lines[s.dialog.line].length) step(inp(), 0.1)
      assert.equal(P.asksToLeave(s.dialog), true)
    }
    const stays = ({ s, ev, step }, why) => {
      for (let k = 0; k < 60; k++) step()
      assert.equal(s.mode, 'play', why)
      assert.ok(!ev.some(x => x.type === 'exit'), why)
      assert.ok(ev.some(x => x.type === 'back'), why)
    }
    for (const e of asking) {
      assert.doesNotMatch(e.ent.lines.at(-1), /PRESS/, `${e.id}: the question still says PRESS`)
      // Nothing asked before the last line.
      const first = open(e)
      assert.equal(P.asksToLeave(first.s.dialog), e.ent.lines.length === 1)
      // B on the first line backs out.
      first.step(inp({ bPress: true }))
      stays(first, `${e.id}: B on the first line`)
      // B on the question backs out.
      const b = open(e); toLast(b); b.step(inp({ bPress: true }))
      stays(b, `${e.id}: B on the question`)
      // Right, then A: NO.
      const no = open(e); toLast(no)
      no.step(inp({ move: { x: 1, y: 0 } }))
      assert.equal(no.s.dialog.choice, 1)
      no.step(); no.step(inp({ aPress: true, a: true }))
      stays(no, `${e.id}: NO`)
      // A tap on the right half: NO.
      const tap = open(e); toLast(tap)
      tap.step(inp({ aPress: true, a: true, tapSide: 1 }))
      stays(tap, `${e.id}: a tap on NO`)
      // Down, down (back to YES), then a tap on the left half: YES leaves.
      const yes = open(e); toLast(yes)
      yes.step(inp({ move: { x: 0, y: 1 } })); yes.step(); yes.step(inp({ move: { x: 0, y: 1 } })); yes.step()
      assert.equal(yes.s.dialog.choice, 0)
      yes.step(inp({ aPress: true, a: true, tapSide: -1 }))
      for (let k = 0; k < 120 && yes.s.mode !== 'exit'; k++) yes.step()
      assert.equal(yes.s.mode, 'exit', `${e.id}: YES should leave`)
    }
    // An arrow still held from walking up does not move the cursor to NO.
    const held = open(asking[0])
    while (held.s.dialog.line < held.s.dialog.lines.length - 1) { held.step(inp({ move: { x: 1, y: 0 } }), 0.5); held.step(inp({ move: { x: 1, y: 0 }, aPress: true, a: true })) }
    while (held.s.dialog.chars < held.s.dialog.lines.at(-1).length) held.step(inp({ move: { x: 1, y: 0 } }), 0.1)
    held.step(inp({ move: { x: 1, y: 0 } }))
    assert.equal(held.s.dialog.choice, 0)
  })

  it('has a NEW GAME machine in Petter\'s house that asks, and leaves nothing, only once there is a quest', () => {
    const spot = placedExits().find(e => e.id === 'newgame')
    assert.equal(P.mapInfo(W, 'home').base[spot.y * P.mapInfo(W, 'home').w + spot.x], 'M')
    const use = (sword) => {
      const g = session()
      goToMap(g, 'home')
      g.s.inv.sword = sword
      walkTo(g, spot.x, spot.y + 1)
      g.s.hero.dir = 'up'
      g.step(inp({ aPress: true, a: true }))
      assert.equal(g.s.mode, 'dialog')
      const lines = g.s.dialog.lines
      readThrough(g)
      for (let k = 0; k < 30; k++) g.step()
      assert.equal(g.s.mode, 'play', 'the machine left the game')
      assert.equal(g.s.map.id, 'home')
      assert.ok(!g.events.some(e => e.type === 'exit'))
      return { lines, asked: g.events.filter(e => e.type === 'startOver').length }
    }
    // Before the blade: nothing to wipe, nothing asked.
    const before = use(false)
    assert.equal(before.asked, 0)
    assert.match(before.lines[0], /NOTHING TO WIPE/)
    // With the blade: its own lines, then the question, once.
    const after = use(true)
    assert.deepEqual(after.lines, spot.ent.lines)
    assert.equal(after.asked, 1)
  })

  it('has a login console in Petter\'s house: A opens the account panel, and nothing leaves', () => {
    const spot = placedExits().find(e => e.id === 'login')
    const info = P.mapInfo(W, 'home')
    assert.equal(spot.map, 'home')
    assert.equal(info.base[spot.y * info.w + spot.x], 'M', 'the console is not a machine')
    assert.equal(spot.ent.label, 'LOGIN')
    assert.equal(spot.ent.lines, undefined, 'the panel is the console\'s text')
    for (const sword of [false, true]) {
      // Walked to from the plaza, blade or not.
      const g = session()
      g.s.inv.sword = sword
      goToMap(g, 'home')
      walkTo(g, spot.x, spot.y + 1)
      g.s.hero.dir = 'up'
      g.step(inp({ aPress: true, a: true }))
      const opened = g.events.filter(e => e.type === 'panel')
      assert.deepEqual(opened, [{ type: 'panel', id: 'login', panel: 'account' }])
      for (let k = 0; k < 60; k++) g.step()
      assert.equal(g.s.mode, 'play', 'the console left the game')
      assert.equal(g.s.map.id, 'home')
      assert.ok(!g.events.some(e => e.type === 'exit' || e.type === 'startOver'))
      // Pressed again (after the panel closed), it opens again.
      g.step(inp({ aPress: true, a: true }))
      assert.equal(g.events.filter(e => e.type === 'panel').length, 2)
    }
    // Petter mentions it.
    const petter = Object.values(W.maps.home.marks).find(m => m.ent.t === 'npc').ent.talk[0].lines.join(' ')
    assert.match(petter, /SLEEPER/)
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
    assert.equal(P.worldStartingAt('plaza', 'start'), null) // the town's old map id, from before 2026-09-24
    assert.equal(P.worldStartingAt('nowhere', 'galaga'), null)
    assert.equal(P.worldStartingAt('arcade', 'nope'), null)
    assert.equal(P.worldStartingAt('arcade', '__proto__'), null)
    assert.equal(P.worldStartingAt(42, 'galaga'), null)
  })

  it('has a quiet beach east of the pier: the DJ building it live leads to Jam, the one with the records to the radio', () => {
    const def = W.maps.overworld
    const s = P.createGame(W, { seed: 1 })
    const tile = (x, y) => s.map.tiles[y * s.map.w + x]
    const booths = placedExits().filter(e => e.ent.look === 'booth')
    assert.deepEqual(booths.map(b => [b.id, b.ent.art, b.ent.label]).sort(), [['jam', 'mixer', 'JAM'], ['radio', 'records', 'RADIO']])
    assert.ok(booths.find(b => b.id === 'jam').x < booths.find(b => b.id === 'radio').x, 'Jam is the left booth')
    for (const b of booths) {
      assert.equal(b.map, 'overworld')
      assert.ok(b.x < TOWN_W, `${b.id} is outside the town`)
      // Speakers left and right, the DJ's spot behind: all blocked. Sand in front, open to stand on.
      for (const [dx, dy] of [[-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1]]) assert.equal(tile(b.x + dx, b.y + dy), 'Z', `${b.id}: ${dx},${dy} is not blocked`)
      assert.equal(tile(b.x, b.y + 1), '-', `${b.id}: no sand in front`)
      assert.ok(!P.TILE_INFO[tile(b.x, b.y + 1)].solid)
      assert.ok(!s.map.npcs.some(n => Math.floor(n.x) === b.x && Math.floor(n.y) === b.y + 1), `${b.id}: someone stands in front`)
      assert.ok(b.ent.lines.at(-1).endsWith('?'))
    }
    assert.equal(booths.find(b => b.id === 'radio').ent.lines.at(-1), 'TUNE IN?')
    // On the beach: sand behind the DJ, the sea a few steps in front.
    for (const b of booths) {
      assert.equal(tile(b.x, b.y - 2), '-', `${b.id}: no sand behind the DJ`)
      assert.ok([2, 3, 4, 5].some(d => tile(b.x, b.y + d) === '~'), `${b.id}: the sea is not in front`)
    }
    // The people on the sand, around a fire, none of them wandering off; one of them smoking.
    const crowd = s.map.npcs.filter(n => ['hippie', 'smoker', 'guitar', 'sleeper', 'twirler', 'bonfire'].includes(n.look))
    assert.ok(crowd.length >= 6, `only ${crowd.length} on the beach`)
    for (const n of crowd) {
      assert.equal(tile(Math.floor(n.x), Math.floor(n.y)), '-', `${n.id} is not on the sand`)
      assert.ok(!n.wander, `${n.id} wanders`)
    }
    assert.deepEqual(['bonfire', 'smoker', 'guitar', 'sleeper'].filter(l => !crowd.some(n => n.look === l)), [])
    // Only east of the pier: the west side is still the old shore and the sea.
    const pier = def.rows[36].indexOf('=')
    for (let y = 28; y < 34; y++) for (let x = 2; x < pier; x++) assert.notEqual(tile(x, y), '-', `sand west of the pier at ${x},${y}`)
    for (const b of booths) assert.ok(b.x > pier, `${b.id} is west of the pier`)
    // The radio studio is gone: no RADIO sign on a roof.
    assert.ok(!def.decals.some(d => d.text === 'RADIO'))
  })

  it('plays the party on the sand and the town again on the road', () => {
    const g = session()
    const jam = placedExits().find(e => e.id === 'jam')
    walkTo(g, jam.x, jam.y + 1)
    const onSand = g.events.filter(e => e.type === 'area').at(-1)
    assert.deepEqual([onSand.name, onSand.track], ['THE BEACH', 'beach'])
    walkTo(g, jam.x, jam.y - 4)
    const back = g.events.filter(e => e.type === 'area').at(-1)
    assert.deepEqual([back.name, back.track], ['PHAREIM.NO', 'village'])
    // Coming back from Jam or the radio starts the party track at once.
    for (const id of ['jam', 'radio']) assert.equal(P.createGame(P.worldStartingAt('overworld', id), { seed: 1 }).area, 'THE BEACH', id)
  })

  it('talks: the kid explains, Petter introduces himself', () => {
    const talk = (map, id) => Object.values(W.maps[map].marks).find(m => m.ent.t === 'npc' && m.ent.id === id).ent.talk[0].lines.join(' ')
    assert.match(talk('overworld', 'townkid'), /PRESS \{A\}/)
    const petter = talk('home', 'petter')
    assert.match(petter, /FATHER, HUSBAND, GEEK, ASPIRING GOOD GUY\./)
    assert.match(petter, /HELP FOLKS\. WRITE CODE\. BUILD THINGS\./)
    assert.equal(Object.values(W.maps.home.marks).find(m => m.ent.t === 'npc').ent.look, 'petter')
  })
})

describe('the VIP hall', () => {
  const def = () => W.maps.overworld
  const ropeTiles = (s) => { const out = []; s.map.tiles.forEach((t, i) => { if (t === '¤') out.push([i % s.map.w, Math.floor(i / s.map.w)]) }); return out }
  const door = () => P.mapInfo(W, 'overworld').warps.find(w => w.to === 'vip')
  /** Press A facing the guard from the tile below them; returns the events once the lines are read. */
  const talkToGuard = (g) => {
    const guard = g.s.map.npcs.find(n => n.id === 'vipguard')
    walkTo(g, Math.floor(guard.x), Math.floor(guard.y) + 1)
    g.s.hero.dir = 'up'
    g.step(inp({ aPress: true, a: true }))
    assert.equal(g.s.mode, 'dialog', 'A should open the guard\'s lines')
    const lines = g.s.dialog.lines
    const before = g.events.length
    readThrough(g)
    for (let k = 0; k < 10; k++) g.step()
    return { lines, events: g.events.slice(before) }
  }

  it('stands next to the arcade, with its door, a rope across it and a guard beside the rope', () => {
    const d = door()
    assert.ok(d, 'no door to the VIP hall')
    const info = P.mapInfo(W, 'overworld')
    const arcade = info.warps.find(w => w.to === 'arcade')
    assert.ok(Math.abs(d.x - arcade.x) < 8 && d.y < arcade.y && arcade.y - d.y < 12, 'the VIP door is not by the arcade')
    assert.ok(def().decals.some(x => x.text === 'VIP'), 'no VIP sign on the roof')
    const s = P.createGame(W, { seed: 1 })
    const rope = ropeTiles(s)
    assert.ok(rope.length >= 3, 'the rope is too short')
    assert.ok(rope.every(([x, y]) => y === d.y + 1), 'the rope is not in one row in front of the door')
    assert.ok(rope.some(([x]) => x === d.x), 'the rope does not cover the door')
    const guard = s.map.npcs.find(n => n.id === 'vipguard')
    assert.equal(guard.look, 'guard')
    assert.ok(!guard.wander)
    assert.equal(Math.floor(guard.y), d.y + 1, 'the guard is not beside the rope')
    assert.ok(rope.some(([x]) => Math.abs(x - Math.floor(guard.x)) === 1), 'the guard is not next to the rope')
    for (const [x, y] of rope) assert.equal(P.TILE_INFO[s.map.tiles[y * s.map.w + x]].solid, true)
  })

  it('is closed to a visitor who is not logged in: the rope holds and the guard asks for the login', () => {
    const g = session()
    const d = door()
    assert.equal(g.s.session, false)
    assert.equal(path(g, d.x, d.y), null, 'a way to the door past the rope')
    const { lines, events } = talkToGuard(g)
    assert.match(lines.join(' '), /LOG IN/)
    const panel = events.filter(e => e.type === 'panel')
    assert.equal(panel.length, 1, 'the guard should open the login panel')
    assert.deepEqual([panel[0].id, panel[0].panel], ['vipguard', 'account'])
    assert.equal(g.s.mode, 'play', 'the panel leaves the hero standing')
    assert.ok(!events.some(e => e.type === 'exit' || e.type === 'warp'))
    // Coming back from the auth page stands the hero in front of the guard.
    const back = P.worldStartingAt('overworld', 'vipguard')
    assert.ok(back)
    const h = P.createGame(back, { seed: 1 }).hero
    assert.equal(Math.floor(h.x), Math.floor(g.s.map.npcs.find(n => n.id === 'vipguard').x))
    assert.equal(Math.floor(h.y), Math.floor(g.s.map.npcs.find(n => n.id === 'vipguard').y) + 1)
  })

  it('is open to a visitor who is logged in: no rope, a guard who does nothing, and the kids\' cabinets inside', () => {
    const g = session(W, true, { session: true })
    const d = door()
    assert.equal(ropeTiles(g.s).length, 0, 'the rope is still up')
    const { lines, events } = talkToGuard(g)
    assert.doesNotMatch(lines.join(' '), /LOG IN/)
    assert.ok(!events.some(e => e.type === 'panel' || e.type === 'exit'), 'the guard did something')
    assert.equal(g.s.hero.hp, g.s.hero.maxHp)
    goToMap(g, 'vip')
    assert.equal(g.s.map.id, 'vip')
    const cabs = g.s.map.exits.filter(e => e.look === 'cabinet').map(e => e.art).sort()
    assert.deepEqual(cabs, [...VIP_ARTS].sort())
    // Back out through the door lands in front of the building, not on the rope's row.
    goToMap(g, 'overworld')
    assert.equal(Math.floor(g.s.hero.x), d.x)
    assert.ok(g.s.hero.y > d.y + 1)
  })

  it('follows the login live: the rope drops when the shell says so and rises again on logout', () => {
    const g = session()
    const rope = ropeTiles(g.s)
    const v0 = g.s.map.version
    P.setSession(W, g.s, true)
    assert.equal(g.s.session, true)
    assert.equal(ropeTiles(g.s).length, 0)
    assert.ok(g.s.map.version > v0, 'the tile layer is not told to repaint')
    const d = door()
    assert.ok(path(g, d.x, d.y), 'no way to the door once the rope is down')
    P.setSession(W, g.s, true) // no change, no repaint
    const v1 = g.s.map.version
    P.setSession(W, g.s, true)
    assert.equal(g.s.map.version, v1)
    P.setSession(W, g.s, false)
    assert.deepEqual(ropeTiles(g.s), rope)
    // Maps load with the current answer: signed in inside the hall, out again, then back to the town.
    const h = session(W, true, { session: true })
    goToMap(h, 'vip')
    P.setSession(W, h.s, false)
    goToMap(h, 'overworld')
    assert.deepEqual(ropeTiles(h.s), rope)
  })

  it('never puts the login into a save', () => {
    const g = session(W, true, { session: true })
    g.s.inv.sword = true
    const save = P.toSave(g.s)
    assert.ok(save.flags.every(f => !/session|vip/.test(f)), 'the login is in the save')
    assert.equal(P.createGame(W, { save }).session, false)
  })

  it('leaves the hero where they stand when the rope goes back up under them', () => {
    const g = session(W, true, { session: true })
    const d = door()
    g.s.hero.x = d.x + 0.5
    g.s.hero.y = d.y + 1.5
    P.setSession(W, g.s, false)
    const i = (d.y + 1) * g.s.map.w + d.x
    assert.notEqual(g.s.map.tiles[i], '¤', 'the rope closed on the hero')
  })

  it('has a bar: a bartender behind the counter who talks and serves, on a shelf of bottles, in a dim room', () => {
    const g = session(W, true, { session: true })
    goToMap(g, 'vip')
    const def = P.mapInfo(W, 'vip').def
    assert.ok(def.ambient, 'the hall is as bright as daylight')
    assert.ok(def.props.some(p => p.kind === 'discoball'), 'no mirror ball')
    const bt = g.s.map.npcs.find(n => n.id === 'bartender')
    assert.ok(bt, 'no bartender')
    assert.equal(bt.look, 'barmaid')
    const m = g.s.map
    assert.equal(m.tiles[(Math.floor(bt.y) + 1) * m.w + Math.floor(bt.x)], 'n', 'no counter in front of her')
    assert.equal(m.tiles[(Math.floor(bt.y) - 1) * m.w + Math.floor(bt.x)], 'q', 'no shelf behind her')
    walkTo(g, Math.floor(bt.x), Math.floor(bt.y) + 2)
    g.s.hero.dir = 'up'
    g.step(inp({ aPress: true, a: true }))
    assert.equal(g.s.mode, 'dialog', 'she does not talk across the bar')
    assert.match(g.s.dialog.lines.join(' '), /BARTENDER/)
    assert.match(g.s.dialog.lines.join(' '), /ON THE HOUSE/)
  })
})

describe('the coast road', () => {
  it("leads from the start to the Keeper's hut, where the Keeper tells the story", () => {
    const g = session(W, false)
    const dialogs = []
    const step = g.step
    g.step = (...a) => { const ev = step(...a); if (g.s.dialog && !dialogs.includes(g.s.dialog.lines)) dialogs.push(g.s.dialog.lines); return ev }
    goToMap(g, 'hut')
    assert.equal(g.s.map.id, 'hut')
    assert.ok(dialogs.some(l => l === P.INTRO), 'the Keeper did not speak on the way')
  })
})

function isWall(def, x, y) {
  const ch = def.rows[y]?.[x]
  if (ch === undefined) return false
  const t = def.marks[ch]?.tile ?? ch
  return t === 'H' || ((t === 'D') && (def.rows[y - 1]?.[x] === 'H'))
}

describe('world data and the look', () => {
  it('names tones and light levels, never a hex colour', async () => {
    const { readdirSync } = await import('node:fs')
    const dir = new URL('../themes/zelda/world/', import.meta.url)
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.ts')) continue
      assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), /#[0-9a-fA-F]{6}\b/, `${f} carries a hex colour: name a Tone (types.ts) instead`)
    }
  })
  it('keeps the engine and the world free of the renderer', async () => {
    const { readdirSync } = await import('node:fs')
    for (const part of ['engine', 'world']) {
      const dir = new URL(`../themes/zelda/${part}/`, import.meta.url)
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.ts')) continue
        assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), /from '\.\.\/render\//, `${part}/${f} imports from render/`)
      }
    }
  })
})
