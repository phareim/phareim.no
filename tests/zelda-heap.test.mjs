// Neon Shrine, THE HEAP (docs/games/neon-shrine-heap.md), under the Underglow's rails: the whole way through it by one
// scripted player, from the hollow wall to the Weight; that the Scrape Golem punishes standing still and gives way to
// nothing but a cart; what the Magnet leaves in a save; and the two maps' own bargain with the world. Nobody plays it
// by hand before it ships, so the play-through is the proof that every room can be left the way it says.
//
// `HEAP_LOG=1` prints the play-through's checkpoints.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'

let Z
let P
before(async () => { Z = await load(); P = walker(Z) })

/** The rooms' top-left tiles (cells of 16 × 12); a room's own coordinates are added to them. */
const ROOMS = {
  heap1: { hollow: [0, 0], sorting: [16, 0], strongroom: [32, 0], line: [16, 12], pump: [32, 12], dark: [48, 12] },
  heap2: { foot: [0, 0], heap: [16, 0] },
}
const tileAt = (s, x, y) => s.map.tiles[y * s.map.w + x]

describe('the Heap', () => {
  it('is played from the hollow wall to the Weight, with the blade and what the Heap gives', () => {
    const log = []
    let s
    let room = 'rails'
    /** One checkpoint: what was done in which room. A failure names its place and what was passed before it. */
    const check = (step, fn) => {
      try { fn() } catch (e) {
        e.message = `${room}: ${step}: FAILED at ${s.map.id} ${s.hero.x.toFixed(2)},${s.hero.y.toFixed(2)} (${s.mode})\n${e.message}\n--- passed:\n${log.join('\n')}`
        throw e
      }
      log.push(`${room}: ${step}: ok`)
    }
    /** Where tile (x, y) of the room is on its map. */
    const at = (x, y) => { const [ox, oy] = ROOMS[s.map.id][room]; return [ox + x, oy + y] }
    const tile = (x, y) => tileAt(s, ...at(x, y))
    const walk = (x, y) => P.walkTo(s, ...at(x, y))
    const stands = (x, y) => {
      const [tx, ty] = at(x, y)
      assert.ok(Math.hypot(s.hero.x - tx - 0.5, s.hero.y - ty - 0.5) < 0.7, `not at ${x},${y}: ${s.hero.x - at(0, 0)[0]},${s.hero.y - at(0, 0)[1]}`)
    }
    /** Walk on through a doorway until the camera stands in the next room. */
    const cross = (to, x, y) => {
      const [ox, oy] = ROOMS[s.map.id][to]
      P.walkTo(s, ox + x, oy + y)
      P.until(s, () => s.mode === 'play')
      room = to
      assert.deepEqual([s.zone.x, s.zone.y], [ox, oy], `not in the ${to}`)
    }
    /** B with the Magnet, facing `dir`, played out until nothing flies; returns what it said. */
    const latch = (dir) => {
      P.frames(s, 30)
      s.hero.dir = dir
      const ev = P.step(s, P.inp({ bPress: true }))
      for (let k = 0; k < 240 && (s.hook || s.map.iron?.flights.length); k++) { s.hero.invuln = 1; ev.push(...P.step(s)) }
      P.frames(s, 30)
      return ev.map(e => e.type)
    }

    // --- the rails: the hollow wall --------------------------------------------------------------------------------
    s = Z.createGame(Z.WORLD, { seed: 5, at: { map: 'underglow1', entry: 'up' } })
    Object.assign(s.inv, { sword: true, bombBag: true, bombs: 8, selected: 'bombs' })
    check('a bomb opens the crack', () => {
      P.walkTo(s, 27, 10)
      assert.equal(tileAt(s, 27, 11), '%')
      s.hero.dir = 'down'
      P.step(s, P.inp({ bPress: true }))
      P.walkTo(s, 24, 9)
      P.frames(s, 90)
      assert.equal(tileAt(s, 27, 11), '.')
    })
    check('the hole leads into the Heap', () => {
      P.walkTo(s, 27, 11)
      P.until(s, () => s.map.id === 'heap1' && s.mode === 'play', P.inp())
      P.frames(s, 5)
      P.settle(s)
      room = 'hollow'
      assert.deepEqual(s.entry, { map: 'heap1', entry: 'door' })
      assert.ok(s.flags['heap1.hollow'], 'the hollow has had its say')
    })

    // --- the sorting floor: the Magnet, a crate to a plate, across by a bolt ---------------------------------------
    check('the chest holds the Magnet', () => {
      cross('sorting', 1, 5)
      walk(3, 4)
      s.hero.dir = 'left'
      P.pressA(s)
      assert.equal(s.inv.magnet, true)
      assert.equal(s.inv.selected, 'magnet')
    })
    check('station A: the crate comes over the pit onto the plate, and the shutter opens', () => {
      walk(2, 8)
      assert.equal(tile(7, 5), 'X')
      assert.ok(latch('right').includes('latch'))
      assert.equal(tile(3, 8), '▣')
      assert.equal(tile(6, 8), '.')
      assert.equal(tile(7, 5), '.')
      assert.equal(tile(7, 6), '.')
    })
    check('station B: the bolt takes the hero to the far lip', () => {
      walk(3, 2)
      assert.ok(latch('right').includes('latch'))
      stands(6, 2)
    })
    check('the strongroom is through the shutter', () => { cross('strongroom', 1, 5) })

    // --- the strongroom: the cart in two taps ----------------------------------------------------------------------
    check('the first tap rolls the cart half way', () => {
      walk(7, 6)
      latch('left')
      assert.equal(tile(2, 2), '.')
      assert.equal(tile(7, 2), '▦')
      assert.equal(tile(3, 8), 'X')
    })
    check('the second sends it onto the plate, and the bars open', () => {
      walk(12, 6)
      latch('left')
      assert.equal(tile(12, 2), '▦')
      assert.equal(tile(3, 8), '.')
      assert.equal(tile(3, 9), '.')
    })
    check('the small key', () => {
      walk(2, 8)
      s.hero.dir = 'left'
      P.pressA(s)
      assert.equal(Z.keyCount(s), 1)
    })

    // --- back over the sorting floor, and the line -----------------------------------------------------------------
    check('station C: the bolt in the rim brings the hero home', () => {
      cross('sorting', 14, 5)
      walk(6, 2)
      assert.equal(tile(6, 8), '▣', 'the crate went home')
      latch('left')
      stands(1, 2)
    })
    check('down to the line', () => { cross('line', 2, 1) })
    check('over by the pillar bolt, from the west lip', () => {
      walk(5, 8)
      assert.equal(tile(6, 5), 'X', 'the drawbridge is up')
      latch('right')
      stands(10, 8)
    })
    check('the lever lets the drawbridge down', () => {
      walk(13, 9)
      s.hero.dir = 'down'
      P.pressA(s)
      P.frames(s, 10)
      assert.ok(s.flags['heap1.bridge'])
      for (let x = 6; x <= 9; x++) for (const y of [5, 6]) assert.equal(tile(x, y), '.')
      walk(3, 5)
    })
    check('the islet and its piece of heart, there and on by bolts', () => {
      walk(5, 2)
      latch('right')
      stands(8, 2)
      walk(7, 2)
      P.settle(s)
      assert.ok(s.flags['took:heap1.piece'])
      walk(8, 3)
      latch('right')
      stands(10, 3)
    })

    // --- a reload --------------------------------------------------------------------------------------------------
    check('a reloaded tab goes on from the hollow, with all that was opened', () => {
      const saved = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
      assert.equal(Z.awayMap(Z.WORLD, saved.map, saved.entry), true)
      const spot = Z.loadSpot(Z.WORLD, saved, { map: 'overworld', entry: 'start' }, true)
      assert.equal(spot, null, 'the tab continues where the save is')
      s = Z.createGame(Z.WORLD, { seed: 6, save: saved, at: spot })
      room = 'hollow'
      P.settle(s)
      assert.deepEqual([s.map.id, s.entry.entry], ['heap1', 'door'])
      assert.equal(Z.keyCount(s), 1)
      assert.equal(s.inv.selected, 'magnet')
      assert.equal(tileAt(s, 23, 5), '.', 'the sorting floor shutter')
      assert.equal(tileAt(s, 35, 8), '.', 'the strongroom bars')
      assert.equal(tileAt(s, 22, 17), '.', 'the drawbridge')
      assert.equal(tileAt(s, 22, 8), '▣', 'the crate at home')
      assert.equal(tileAt(s, 34, 2), '▦', 'the cart at home')
    })

    // --- the pump house's door -------------------------------------------------------------------------------------
    check('walking all the way to the east bank', () => {
      cross('sorting', 1, 5)
      cross('line', 2, 1)
      walk(14, 5)
    })
    check('the key opens the door to the Pump House', () => {
      assert.equal(tile(15, 5), 'L')
      for (let k = 0; k < 90 && tile(15, 5) === 'L'; k++) { s.hero.invuln = 1; P.step(s, P.inp({ move: { x: 1, y: 0 } })) }
      assert.equal(tile(15, 5), '.')
      assert.equal(tile(15, 6), '.')
      assert.equal(Z.keyCount(s), 0)
      cross('pump', 1, 5)
    })

    // --- the fights: real input, no god mode ------------------------------------------------------------------------
    const foes = kind => s.map.enemies.filter(e => e.kind === kind)
    const far = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
    const stick = (dx, dy, k = 1) => { const d = Math.hypot(dx, dy) || 1; return { x: (dx / d) * k, y: (dy / d) * k } }
    /** The stick toward point p, by the tiles' path where something is in the straight way. */
    const toward = (p) => {
      const h = s.hero
      let to = p
      if (!Z.lineClear(Z.WORLD, s.map, h.x, h.y, p.x, p.y)) {
        const way = P.path(s, Math.floor(p.x), Math.floor(p.y))
        if (way?.length > 1) to = { x: way[1][0] + 0.5, y: way[1][1] + 0.5 }
      }
      return stick(to.x - h.x, to.y - h.y)
    }
    /** The stick out of any lane painted under the hero, to the nearer side of it; null where they stand in none. */
    const dodge = (list) => {
      const h = s.hero
      for (const e of list) for (const st of Z.stencilsOf(e)) {
        if (!Z.inStencil({ ...st, w: st.w + 0.4, cap: st.cap + 0.2 }, h.x, h.y)) continue
        const flat = Math.abs(Math.cos(st.a)) > 0.5
        const side = [-1, 1].map(k => (flat ? { x: h.x, y: st.y0 + k * (st.w / 2 + 0.35) } : { x: st.x0 + k * (st.w / 2 + 0.35), y: h.y }))
          .filter(p => !Z.circleBlocked(Z.WORLD, s.map, p.x, p.y, 0.34)).sort((a, b) => far(h, a) - far(h, b))[0]
        if (side) return stick(side.x - h.x, side.y - h.y)
      }
      return null
    }
    /** One frame toward an open foe, or of the blade at it. */
    const cut = (e) => {
      const h = s.hero
      const at = stick(e.x - h.x, e.y - h.y)
      if (far(h, e) > 1.35 + e.r * 0.3) return P.step(s, P.inp({ move: toward(e) }))
      if (!h.swing && !(h.cooldown > 0)) return P.step(s, P.inp({ move: at, a: true, aPress: true }))
      return P.step(s, P.inp({ aPress: !!h.swing && h.swing.t > 0.1 }))
    }
    /** B with the stick toward `at`: a tap. */
    const tap = at => P.step(s, P.inp({ move: stick(at.x - s.hero.x, at.y - s.hero.y, 0.2), bPress: true }))
    const flying = () => !!s.map.iron?.flights.length || (s.map.iron?.rest ?? 0) > 0

    // --- the pump house: GROK ---------------------------------------------------------------------------------------
    const shut = tiles => tiles.every(([x, y]) => tile(x, y) === 'X')
    const open = tiles => tiles.every(([x, y]) => tile(x, y) === '.')
    const PUMP_WAYS = [[0, 5], [0, 6], [15, 5], [15, 6], [12, 2], [13, 2], [14, 2]]
    check('the pump house shuts its three ways on GROK', () => {
      P.settle(s)
      for (let k = 0; k < 30; k++) P.step(s)
      assert.ok(s.flags['heap1.grok.met'], 'its card was read')
      assert.ok(shut(PUMP_WAYS))
    })
    check('GROK falls to two crates and the blade, one drilled through on the way', () => {
      const [g] = foes('grok')
      const met = new Set()
      let iron = false
      for (let k = 0; k < 60 * 60 && !g.dead && s.mode === 'play'; k++) {
        if (g.ai.mode === 'dazed') iron ||= g.ai.t > 2
        else iron = false
        met.add(g.ai.mode)
        // First west of the crates, which stop its roll; then under their column, with two pulled into a stack.
        const two = g.hp <= g.maxHp / 2
        const [hx, hy] = at(...(two ? [4, 10] : [1, 3]))
        const home = { x: hx + 0.5, y: hy + 0.5 }
        const stacked = [9, 8].filter(y => tile(4, y) === '▣').length
        const out = dodge([g])
        if (iron && Z.bossOpen(g)) cut(g)
        else if (out) P.step(s, P.inp({ move: out }))
        else if (far(s.hero, home) > 0.15) P.step(s, P.inp({ move: toward(home) }))
        else if (two && stacked < 2 && !flying() && !s.hero.swing) tap({ x: s.hero.x, y: s.hero.y - 3 })
        else P.step(s)
      }
      assert.ok(g.dead, `GROK stands: ${g.hp} hp, the hero ${s.hero.hp}`)
      assert.ok(met.has('drill'), 'it drilled')
      assert.ok(s.flags['heap.grok'])
      P.frames(s, 10)
      assert.ok(open(PUMP_WAYS))
    })

    // --- the dark shift: five PHI ------------------------------------------------------------------------------------
    check('the dark shift shuts behind the hero', () => {
      cross('dark', 1, 5)
      P.walkTo(s, ...at(2, 5))
      P.settle(s)
      for (let k = 0; k < 30; k++) { s.hero.invuln = 1; P.step(s) }
      assert.ok(s.flags['heap1.phi.met'], 'the lamps are out')
      assert.equal(foes('phi').filter(e => !e.dead).length, 5)
      assert.ok(shut([[0, 5], [0, 6]]))
      assert.equal(tile(13, 5), '.', 'no chest yet')
    })
    check('the five come to the Magnet, one by one, and fall to the blade', () => {
      s.hero.invuln = 0
      let pulled = 0
      for (let k = 0; k < 60 * 90 && foes('phi').some(e => !e.dead) && s.mode === 'play'; k++) {
        const h = s.hero
        const live = foes('phi').filter(e => !e.dead)
        const ready = live.filter(e => Z.bossOpen(e)).sort((a, b) => far(h, a) - far(h, b))[0]
        const out = dodge(live)
        if (out) P.step(s, P.inp({ move: out }))
        else if (ready) cut(ready)
        else {
          const mark = !flying() && !h.swing && !live.some(e => e.ai.mode === 'pulled')
            && live.map(e => Z.magnetPlan(Z.WORLD, s, Math.atan2(e.y - h.y, e.x - h.x))).find(p => p?.t === 'phi')
          const [mx, my] = at(8, 5)
          if (mark) pulled += tap(mark).filter(e => e.type === 'latch').length
          else P.step(s, P.inp({ move: far(h, { x: mx, y: my + 0.5 }) > 0.5 ? toward({ x: mx, y: my + 0.5 }) : { x: 0, y: 0 } }))
        }
      }
      assert.deepEqual(foes('phi').filter(e => !e.dead), [], `PHI left, the hero ${s.hero.hp}`)
      assert.ok(pulled >= 1)
      for (let n = 1; n <= 5; n++) assert.ok(s.flags[`heap.phi${n}`])
    })
    check('the Big Key, in a lit room', () => {
      P.frames(s, 20)
      P.settle(s)
      assert.ok(open([[0, 5], [0, 6]]))
      assert.equal(tile(13, 5), '$')
      walk(12, 5)
      s.hero.dir = 'right'
      P.pressA(s)
      assert.equal(Z.hasBigKey(s), true)
    })

    // --- the stair, the foot and the Heap's door --------------------------------------------------------------------
    check('back through the Pump House and down its stair', () => {
      cross('pump', 14, 5)
      walk(13, 1)
      P.walkTo(s, ...at(14, 1))
      P.until(s, () => s.map.id === 'heap2' && s.mode === 'play')
      P.settle(s)
      room = 'foot'
      assert.deepEqual(s.entry, { map: 'heap2', entry: 'down' })
    })
    check('the Big Key opens the door at the Foot, and the Heap is through it', () => {
      assert.equal(tile(15, 5), 'K')
      walk(14, 5)
      for (let k = 0; k < 90 && tile(15, 5) === 'K'; k++) P.step(s, P.inp({ move: { x: 1, y: 0 } }))
      assert.equal(tile(15, 5), '.')
      assert.equal(tile(15, 6), '.')
      cross('heap', 1, 5)
      assert.equal(s.area, 'THE FOOT OF THE HEAP')
      assert.equal(s.zoneIndex, 1)
    })

    // --- the Scrape Golem: real input, no god mode ------------------------------------------------------------------
    const [golem] = foes('golem')
    check('the Golem has its say', () => {
      // (The walk in may have read its card already.)
      for (let k = 0; k < 10; k++) P.step(s)
      P.settle(s)
      assert.ok(s.flags['heap2.golem.met'], 'its card was read')
      assert.deepEqual([golem.hp, golem.x - at(0, 0)[0], golem.y - at(0, 0)[1]], [18, 8, 6])
    })
    check('chokes on the carts, eats when a pull is let by, grows, and falls to the fourth choke', () => {
      s.hero.invuln = 0
      s.hero.hp = s.hero.maxHp
      /** The two pads, and where each one's cart waits. */
      const sends = [{ pad: at(5, 1), cart: [2, 4] }, { pad: at(10, 1), cart: [13, 4] }]
      const mid = ([x, y]) => ({ x: x + 0.5, y: y + 0.5 })
      const centre = ([x, y]) => mid(at(x, y))
      /** The stick toward p, round the carts and scraps (which a shot's line passes over). */
      const round = (p) => {
        const h = s.hero
        const straight = Array.from({ length: 20 }, (_, i) => (i + 1) / 20).every(k => !Z.circleBlocked(Z.WORLD, s.map, h.x + (p.x - h.x) * k, h.y + (p.y - h.y) * k, 0.34))
        const way = straight ? null : P.path(s, Math.floor(p.x), Math.floor(p.y))
        const to = way?.length > 1 ? { x: way[1][0] + 0.5, y: way[1][1] + 0.5 } : p
        return stick(to.x - h.x, to.y - h.y)
      }
      const seen = { chokes: 0, modes: new Set(), scraps: [], healed: 0 }
      let was = ''
      let hp = golem.hp
      for (let k = 0; k < 60 * 90 && !golem.dead && s.mode === 'play'; k++) {
        const mode = golem.ai.mode
        if (mode !== was && mode === 'choke') seen.chokes++
        was = mode
        seen.modes.add(`${mode}${golem.ai.phase === 2 ? ' grown' : ''}`)
        if (golem.hp > hp) seen.healed += golem.hp - hp
        hp = golem.hp
        const h = s.hero
        // Out of the spat piece's lane (the pull's own ring is the pads' business: they stand outside it).
        const lane = Z.stencilsOf(golem).find(st => st.t === 'lane' && Z.inStencil({ ...st, w: st.w + 0.5, cap: st.cap + 0.2 }, h.x, h.y))
        const parked = s.map.tiles.some((t, i) => t === '▥' && far({ x: (i % s.map.w) + 0.5, y: Math.floor(i / s.map.w) + 0.5 }, golem) <= Z.GOLEM.ring[golem.ai.phase === 2 ? 1 : 0])
        // Once it has been cut, one pull is let by on purpose: it eats the two scraps inside its ring.
        const letBy = seen.chokes === 1 && seen.healed === 0
        const ready = sends.filter(v => tile(...v.cart) === '▥').sort((a, b) => far(h, mid(a.pad)) - far(h, mid(b.pad)))[0]
        const goal = mid(ready?.pad ?? sends[0].pad)
        if (lane) {
          const n = { x: -Math.sin(lane.a), y: Math.cos(lane.a) }
          const side = (h.x - lane.x0) * n.x + (h.y - lane.y0) * n.y >= 0 ? 1 : -1
          const way = [side, -side].find(v => !Z.circleBlocked(Z.WORLD, s.map, h.x + n.x * v * 0.8, h.y + n.y * v * 0.8, 0.34)) ?? side
          P.step(s, P.inp({ move: { x: n.x * way, y: n.y * way } }))
        } else if (Z.bossOpen(golem)) {
          if (far(h, golem) > golem.r + 0.8) P.step(s, P.inp({ move: round(golem) }))
          else cut(golem)
        } else if (far(h, goal) > 0.35) P.step(s, P.inp({ move: round(goal) }))
        else if (ready && !parked && !letBy && !flying() && !h.swing) tap(centre(ready.cart))
        else P.step(s)
      }
      assert.ok(golem.dead, `the Golem stands: ${golem.hp} hp after ${seen.chokes} chokes, the hero ${s.hero.hp}`)
      assert.equal(seen.healed, 2, 'the two scraps inside the small ring')
      assert.equal(seen.chokes, 4)
      for (const m of ['tell', 'pull', 'spit', 'choke', 'grow', 'tell grown', 'choke grown']) assert.ok(seen.modes.has(m), m)
      assert.ok(s.flags['heap.golem'])
      assert.equal(s.map.tiles.filter(t => t === '▤').length, 2, 'what it ate is gone')
    })
    check('the Weight lies where it fell, the room says its line, and CREDIT is in hand', () => {
      const said = []
      for (let k = 0; k < 60 * 8 && !(s.flags['heap2.named'] && Z.hasWeight(s, 'weightCredit') && s.mode === 'play'); k++) {
        if (s.mode === 'dialog' || s.mode === 'get') {
          if (s.dialog) said.push(...s.dialog.lines)
          P.settle(s)
          continue
        }
        const w = s.map.pickups.find(p => p.item === 'weightCredit' && !p.hidden)
        // (Onto it once the room has spoken, which waits for the heap to fade.)
        P.step(s, P.inp({ move: w && s.flags['heap2.named'] ? toward(w) : { x: 0, y: 0 } }))
      }
      assert.ok(said.some(l => l.includes('THE NAMES WERE ALWAYS THERE')), said.join(' | '))
      assert.ok(Z.hasWeight(s, 'weightCredit'))
      assert.ok(s.flags['took:heap2.weight'])
      const again = Z.createGame(Z.WORLD, { seed: 7, save: Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s)))) })
      assert.ok(Z.hasWeight(again, 'weightCredit'))
      Z.enterMap(Z.WORLD, again, 'heap2', 'down', [], { x: 17.5, y: 5.5 })
      assert.deepEqual(again.map.enemies.filter(e => !e.dead), [], 'it stays down')
    })
    if (process.env.HEAP_LOG) console.log(log.join('\n'))
  })

  it('beats a hero who stands still before the Golem, and gives no way past it without a cart', () => {
    /** The Heap's room as a hero comes into it, the card read. */
    const arrive = () => {
      const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'heap2', entry: 'down' } })
      Object.assign(s.inv, { sword: true, magnet: true, selected: 'magnet' })
      Z.enterMap(Z.WORLD, s, 'heap2', 'down', [], { x: 17.5, y: 5.5 })
      s.mode = 'play'
      P.frames(s, 5)
      P.settle(s)
      return s
    }
    // Just inside the door, outside both rings: what it spits still finds them.
    const still = arrive()
    for (let k = 0; k < 60 * 60 && still.mode === 'play'; k++) P.step(still)
    assert.equal(still.mode, 'dying', `still standing with ${still.hero.hp}`)

    // The blade alone, for two minutes, by a hero nothing can hurt.
    const s = arrive()
    const g = s.map.enemies.find(e => e.kind === 'golem')
    let clanks = 0
    for (let k = 0; k < 60 * 120; k++) {
      s.hero.invuln = 1
      const dx = g.x - s.hero.x
      const dy = g.y - s.hero.y
      const d = Math.hypot(dx, dy)
      const near = d <= g.r + 0.8
      const swing = near && !s.hero.swing && k % 20 === 0
      const ev = P.step(s, P.inp({ move: near ? { x: (dx / d) * 0.2, y: (dy / d) * 0.2 } : { x: dx / d, y: dy / d }, a: swing, aPress: swing }))
      clanks += ev.filter(e => e.type === 'clank').length
      if (s.mode !== 'play') P.settle(s)
    }
    assert.ok(clanks > 10, 'the blade reached it')
    assert.deepEqual([g.hp, g.dead, !!s.flags['heap.golem']], [18, false, false])
  })

  it('keeps the Magnet in a save as an item and a flag and nothing else', () => {
    const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'heap1', entry: 'door' } })
    s.inv.sword = true
    const before = Z.toSave(s)
    Z.grant(s, 'magnet')
    Z.enterMap(Z.WORLD, s, 'heap1', 'door', [], { x: 18.5, y: 8.5 })
    s.mode = 'play'
    s.hero.dir = 'right'
    P.step(s, P.inp({ bPress: true }))
    assert.equal(s.map.iron.flights.length, 1, 'iron is in the air')
    const flying = Z.toSave(s)
    assert.deepEqual(Object.keys(flying).sort(), Object.keys(before).sort())
    assert.deepEqual(flying.inv, { ...before.inv, magnet: true, selected: 'magnet' })
    assert.deepEqual(flying.flags.filter(f => !before.flags.includes(f)), ['item:magnet'])

    const loaded = Z.parseSave(JSON.parse(JSON.stringify(flying)))
    assert.deepEqual([loaded.inv.magnet, loaded.inv.selected], [true, 'magnet'])
    const again = Z.createGame(Z.WORLD, { seed: 2, save: loaded })
    assert.equal(again.inv.selected, 'magnet')
    assert.equal(tileAt(again, 22, 8), '▣', 'the iron stands where the map has it')

    const old = JSON.parse(JSON.stringify(before))
    delete old.inv.magnet
    const parsed = Z.parseSave(old)
    assert.ok(parsed, 'a save from before the Magnet loads')
    assert.equal(parsed.inv.magnet, false)
    assert.ok(!Z.useItems(Z.createGame(Z.WORLD, { save: parsed })).includes('magnet'))
  })

  it('is a wing of the Underglow that fits the world: valid maps, a key for every lock, a door you can walk to', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD), [])
    // The Underglow's one keyring, the wing's key and locks with the floors'.
    const ring = Object.values(Z.WORLD.maps).filter(d => d.keyring === 'underglow')
    assert.deepEqual(ring.map(d => d.id).sort(), ['heap1', 'heap2', 'underglow1', 'underglow2', 'underglow3'])
    const items = ring.flatMap(d => Object.values(d.marks).map(m => m.ent.item))
    /** Locked doors of one kind: runs of touching lock tiles. */
    const doors = ch => ring.reduce((n, d) => {
      const seen = new Set()
      d.rows.forEach((r, y) => [...r].forEach((t, x) => {
        if (t !== ch || seen.has(`${x},${y}`)) return
        n++
        for (const st = [[x, y]]; st.length;) {
          const [a, b] = st.pop()
          if (seen.has(`${a},${b}`) || d.rows[b]?.[a] !== ch) continue
          seen.add(`${a},${b}`)
          st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1])
        }
      }))
      return n
    }, 0)
    assert.deepEqual([items.filter(i => i === 'smallKey').length, doors('L')], [4, 4])
    assert.deepEqual([items.filter(i => i === 'bigKey').length, doors('K')], [1, 1])
    // The rails room keeps its size; the hole in its wall and the way back are where the Heap says.
    const under = Z.WORLD.maps.underglow1
    assert.deepEqual([under.rows[0].length, under.rows.length], [48, 24])
    const info = Z.mapInfo(Z.WORLD, 'underglow1')
    const hole = info.warps.find(w => w.to === 'heap1')
    assert.ok(Z.mapInfo(Z.WORLD, hole.to).entries[hole.entry], 'the hole lands on an entry')
    assert.ok(Z.mapInfo(Z.WORLD, 'heap1').entries.door && info.entries.heap)
    const s = Z.createGame(Z.WORLD, { at: { map: 'underglow1', entry: 'up' } })
    assert.equal(tileAt(s, hole.x, hole.y), '%')
    assert.ok(P.path(s, hole.x, hole.y - 1), 'the hollow wall can be walked up to')
  })
})
