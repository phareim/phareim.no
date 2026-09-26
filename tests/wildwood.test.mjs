// The Wildwood and Project Horizon's labs: the new rules one by one (the
// hook, Luna and her psi blocks, letter stones, crystal groups across
// floors, holes, keyrings, the bosses' rules, old saves), then a full
// scripted run from the town's west road to the Gate shutting, with a
// path-finding walker (god mode, bosses killed directly).
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'

let Z
let P
before(async () => { Z = await load(); P = walker(Z) })

const tile = (s, x, y) => s.map.tiles[y * s.map.w + x]

/** A game standing at `entry` of `map` with the blade (and whatever `inv` adds). */
function at(map, entry, inv = {}, flags = []) {
  const s = Z.createGame(Z.WORLD, { seed: 3, at: { map, entry } })
  Object.assign(s.inv, { sword: true }, inv)
  for (const f of flags) s.flags[f] = true
  for (let k = 0; k < 60 && s.hero.auto; k++) P.step(s)
  return s
}

describe('the hook', () => {
  it('reels the hero over water to a post, and never ends in the water', () => {
    const s = at('lab1', 'start', { hook: true })
    // The vault: from the south shore to the island post.
    Z.enterMap(Z.WORLD, s, 'lab1', 'start', [], { x: 7.5, y: 8.5 })
    P.useB(s, 'hook', 'up')
    assert.deepEqual([s.hero.x, s.hero.y], [7.5, 5.5])
    assert.equal(s.hook, null)
    assert.equal(s.hero.act, 'idle')
  })

  it('bounces off a wall and stuns a foe', () => {
    const s = at('lab1', 'start', { hook: true })
    const ev = []
    s.inv.selected = 'hook'
    P.face(s, 'up')
    ev.push(...P.step(s, P.inp({ bPress: true })))
    for (let k = 0; k < 120 && s.hook; k++) ev.push(...P.step(s))
    assert.ok(ev.some(e => e.type === 'hook'))
    assert.equal(s.hook, null)
    assert.equal(s.hero.y, 34.5, 'did not move')
  })
})

describe('Luna', () => {
  it('joins after a waffle, follows, and slides a psi block until it stops', () => {
    const s = at('wildwood', 'brambles', { bombBag: true }, [])
    s.hero.x = 37.5; s.hero.y = 32.5
    P.face(s, 'up')
    P.pressA(s)
    assert.ok(!s.flags.luna, 'no waffle, no Luna')
    s.flags['item:waffle'] = true
    P.pressA(s)
    assert.ok(s.flags.luna)
    assert.ok(s.luna)
    assert.equal(s.map.npcs.some(n => n.id === 'luna'), false)
    // She follows a step behind.
    P.walkTo(s, 37, 36 - 2)
    assert.ok(Math.hypot(s.luna.x - s.hero.x, s.luna.y - s.hero.y) < 2)
    // The lab door's block: pushed east from the west, it slides to the fence.
    s.hero.x = 51.5; s.hero.y = 21.5
    P.face(s, 'right')
    P.pressA(s)
    P.frames(s, 60)
    assert.equal(tile(s, 52, 21), '.')
    assert.equal(tile(s, 59, 21), 'B')
    // …and stays moved when the map loads again.
    Z.enterMap(Z.WORLD, s, 'wildwood', 'lab', [])
    assert.equal(tile(s, 52, 21), '.')
    assert.equal(tile(s, 59, 21), 'B')
    assert.ok(s.luna, 'Luna came along')
  })

  it('waits at her fort when walked back to it, and comes along again when fetched', () => {
    const s = at('wildwood', 'brambles', {}, ['item:waffle'])
    s.hero.x = 37.5; s.hero.y = 32.5
    P.face(s, 'up')
    P.pressA(s)
    assert.ok(s.luna)
    // Right after joining she is at the fort: she does not sit straight back down.
    P.walkTo(s, 37, 33)
    assert.ok(s.luna && !s.flags['luna.home'])
    // Away (through the brambles) and back: she sits down where she was found.
    P.walkTo(s, 37, 34)
    P.swing(s, 'down')
    P.walkTo(s, 37, 36)
    assert.ok(s.luna)
    P.walkTo(s, 37, 33, { keepDialog: true })
    assert.equal(s.mode, 'dialog')
    assert.equal(s.dialog.who, 'luna')
    P.settle(s)
    assert.ok(s.flags['luna.home'])
    assert.equal(s.luna, null)
    assert.ok(s.map.npcs.some(n => n.id === 'luna'))
    // She stays there across a reload and a save.
    const back = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
    assert.ok(back.flags.includes('luna.home'))
    Z.enterMap(Z.WORLD, s, 'wildwood', 'lab', [])
    assert.equal(s.luna, null)
    assert.ok(s.map.npcs.some(n => n.id === 'luna'))
    // The lab door's block: without her, a hint where she is.
    s.hero.x = 51.5; s.hero.y = 21.5
    P.face(s, 'right')
    P.step(s, P.inp({ aPress: true, a: true }))
    assert.match(s.dialog.lines.join(' '), /WAITING AT HER FORT/)
    P.settle(s)
    assert.equal(tile(s, 52, 21), 'B')
    // Fetch her: talk, and she follows again.
    s.hero.x = 37.5; s.hero.y = 33.5
    P.walkTo(s, 37, 32)
    P.face(s, 'up')
    P.pressA(s)
    assert.ok(s.luna)
    assert.ok(!s.flags['luna.home'])
    assert.equal(s.map.npcs.some(n => n.id === 'luna'), false)
    P.walkTo(s, 37, 34)
    P.swing(s, 'down')
    P.walkTo(s, 37, 36)
    assert.ok(s.luna, 'still following')
  })

  it('without Luna the block will not budge', () => {
    const s = at('wildwood', 'compound')
    s.hero.x = 51.5; s.hero.y = 21.5
    P.face(s, 'right')
    P.step(s, P.inp({ aPress: true, a: true }))
    assert.equal(s.mode, 'dialog')
    P.settle(s)
    assert.equal(tile(s, 52, 21), 'B')
  })
})

describe('letter stones', () => {
  it('ECHO answers the owl; a wrong letter starts over', () => {
    const s = at('wildwood', 'grove')
    const stones = { E: [39, 2], C: [41, 3], H: [42, 5], O: [41, 7], N: [37, 3] }
    const on = ch => { const [x, y] = stones[ch]; s.hero.x = x + 0.5; s.hero.y = y + 0.5; P.frames(s, 2); s.hero.x = x + 0.5; s.hero.y = y + 1.5; P.frames(s, 2) }
    on('E'); on('N')
    assert.equal(s.map.spell, '')
    on('E'); on('C'); on('H')
    assert.equal(s.map.spell, 'ECH')
    on('O')
    assert.ok(s.flags.riddle1)
    P.frames(s, 30)
    assert.equal(tile(s, 34, 2), '$', 'the chest appeared')
  })
})

describe('the labs', () => {
  it('one crystal switch changes every floor', () => {
    const s = at('lab1', 'down')
    assert.equal(s.map.crystalAll, 'pink')
    s.hero.x = 38.5; s.hero.y = 27.5
    P.swing(s, 'up')
    assert.equal(s.map.crystalAll, 'cyan')
    assert.ok(s.flags['crystal:lab1'])
    Z.enterMap(Z.WORLD, s, 'lab1b', 'up', [])
    assert.equal(s.map.crystalAll, 'cyan')
    assert.equal(Z.raised(Z.WORLD, s.map, 33, 29), false, 'the pink blocks on B1 dropped')
  })

  it('a hole drops the hero to the same spot on the floor below', () => {
    const s = at('lab1', 'start', {}, ['lab1.power'])
    Z.enterMap(Z.WORLD, s, 'lab1', 'start', [], { x: 21.5, y: 17.5 })
    P.until(s, () => s.map.id === 'lab1b', P.inp({ move: { x: 1, y: 0 } }))
    P.frames(s, 40)
    assert.equal(s.mode, 'play')
    assert.ok(Math.floor(s.hero.x) >= 22 && Math.floor(s.hero.x) <= 25 && Math.floor(s.hero.y) === 17, `landed at ${s.hero.x},${s.hero.y}`)
    assert.deepEqual(s.entry, { map: 'lab1', entry: 'start' }, 'the continue point stays upstairs')
  })

  it('keys belong to their dungeon', () => {
    const s = at('lab1', 'start')
    s.inv.keys = 2
    assert.equal(Z.keyCount(s), 0)
    Z.addKeys(s, 1)
    assert.equal(Z.keyCount(s), 1)
    assert.equal(s.inv.keys, 2)
    s.flags['bigkey:lab1'] = true
    assert.equal(Z.hasBigKey(s), true)
    Z.enterMap(Z.WORLD, s, 'shrine', 'start', [])
    assert.equal(Z.keyCount(s), 2)
    assert.equal(Z.hasBigKey(s), false)
  })

  it('every dungeon holds as many small keys as locked doors, and one big key per great lock', () => {
    const rings = {}
    for (const def of Object.values(Z.WORLD.maps)) {
      const r = (rings[def.keyring ?? 'shrine'] ??= { keys: 0, doors: 0, big: 0, bigDoors: 0 })
      const w = def.rows[0].length
      const tileAtXY = (x, y) => { const ch = def.rows[y]?.[x]; const m = def.marks[ch]; return m ? m.tile : ch }
      const seen = new Set()
      def.rows.forEach((row, y) => {
        for (let x = 0; x < w; x++) {
          const e = def.marks[row[x]]?.ent
          if (e?.t === 'chest' && e.item === 'smallKey') r.keys++
          if (e?.t === 'enemy' && e.carries === 'smallKey') r.keys++
          if (e?.t === 'chest' && e.item === 'bigKey') r.big++
          const t = tileAtXY(x, y)
          if ((t !== 'L' && t !== 'K') || seen.has(y * w + x)) continue
          // One door is a run of touching lock tiles; a key opens the whole run.
          for (const st = [[x, y]]; st.length;) {
            const [a, b] = st.pop()
            if (seen.has(b * w + a) || tileAtXY(a, b) !== t) continue
            seen.add(b * w + a)
            st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1])
          }
          if (t === 'L') r.doors++
          else r.bigDoors++
        }
      })
    }
    for (const [ring, r] of Object.entries(rings)) {
      assert.equal(r.keys, r.doors, `${ring}: ${r.keys} small keys for ${r.doors} locked doors`)
      assert.equal(r.big, r.bigDoors ? 1 : 0, `${ring}: ${r.big} big keys for ${r.bigDoors} great locks`)
    }
    assert.deepEqual(rings.deep, { keys: 2, doors: 2, big: 1, bigDoors: 1 })
  })

  it('a hero who follows the block down the Deep Lab chute climbs back up the ladder', () => {
    const s = at('deep1', 'start', { hook: true }, ['mistral'])
    s.inv.keyrings = { deep: 1 }
    P.walkTo(s, 17, 18)
    P.until(s, () => tile(s, 16, 18) === '.', P.inp({ move: { x: -1, y: 0 } }))
    P.walkTo(s, 11, 16)
    P.until(s, () => s.map.id === 'deep2', P.inp({ move: { x: 0, y: -1 } }))
    P.frames(s, 40)
    P.settle(s)
    P.walkTo(s, 12, 14)
    P.until(s, () => s.map.id === 'deep1', P.inp({ move: { x: 0, y: -1 } }))
    P.frames(s, 40)
    assert.deepEqual([Math.floor(s.hero.x), Math.floor(s.hero.y)], [12, 13], 'back in the chute room')
    P.walkTo(s, 20, 18) // and out through the open door to the hall
  })
})

describe('the bosses', () => {
  const boss = (map, entry, kind, flags = [], pos = null) => {
    const s = at(map, entry, { hook: true, arc: false }, flags)
    if (pos) Z.enterMap(Z.WORLD, s, map, entry, [], pos)
    const e = s.map.enemies.find(o => o.kind === kind)
    return { s, e, c: Z.ctx(Z.WORLD, s, []) }
  }

  it('LLAMA: the blade bounces off the wool; its own spit hurts it', () => {
    const { e, c } = boss('lab1', 'start', 'llama')
    assert.equal(Z.hitEnemy(c, e, 2, e.x, e.y + 1, 'sword'), false)
    assert.equal(e.hp, 10)
    e.invuln = 0
    assert.equal(Z.hitEnemy(c, e, 2, e.x, e.y + 1, 'spit'), true)
    assert.equal(e.hp, 8)
  })

  it('MISTRAL: untouchable in the air until the hook pulls it down', () => {
    const { e, c } = boss('lab1', 'start', 'mistral')
    assert.equal(Z.hitEnemy(c, e, 1, e.x, e.y + 1, 'sword'), false)
    e.invuln = 0
    assert.equal(Z.hitEnemy(c, e, 1, e.x, e.y + 1, 'hook'), false, 'not while it drifts')
    e.invuln = 0
    e.ai.mode = 'inhale'
    assert.equal(Z.hitEnemy(c, e, 1, e.x, e.y + 1, 'hook'), true)
    assert.equal(e.ai.mode, 'down')
    e.invuln = 0
    assert.equal(Z.hitEnemy(c, e, 2, e.x, e.y + 1, 'sword'), true)
    assert.equal(e.hp, 10)
  })

  it('DEEPSEEK: under the floor only the hook reaches it', () => {
    const { e, c } = boss('deep1', 'start', 'deepseek')
    e.ai.mode = 'under'
    assert.equal(Z.hitEnemy(c, e, 2, e.x, e.y + 1, 'sword'), false)
    e.invuln = 0
    assert.equal(Z.hitEnemy(c, e, 1, e.x, e.y + 1, 'hook'), true)
    assert.equal(e.ai.mode, 'hauled')
    e.invuln = 0
    assert.equal(Z.hitEnemy(c, e, 2, e.x, e.y + 1, 'sword'), true)
  })

  it('GEMINI: a twin at zero gets up again unless the other falls too', () => {
    const { s, c } = boss('deep2', 'down', 'gemini', ['gemini.met'], { x: 23.5, y: 10.5 })
    const [a, b] = s.map.enemies.filter(o => o.kind === 'gemini')
    a.invuln = 0
    Z.hitEnemy(c, a, 8, a.x, a.y + 1, 'sword')
    assert.equal(a.dead, false)
    assert.equal(a.ai.mode, 'down')
    // Left alone it gets up.
    P.frames(s, 60 * 5)
    assert.equal(a.ai.mode, 'orbit')
    assert.equal(a.hp, 4)
    // Both down together: both gone, the flag set.
    a.invuln = 0; b.invuln = 0
    Z.hitEnemy(c, a, 8, a.x, a.y + 1, 'sword')
    Z.hitEnemy(c, b, 8, b.x, b.y + 1, 'sword')
    assert.ok(a.dead && b.dead)
    assert.ok(s.flags.gemini)
  })
})

describe('saves', () => {
  it('a save from before the Wildwood loads, with the new things at their defaults', () => {
    const s = at('overworld', 'hut')
    const old = JSON.parse(JSON.stringify(Z.toSave(s)))
    for (const k of ['hook', 'arc', 'bigBag', 'shrooms', 'keyrings']) delete old.inv[k]
    const back = Z.parseSave(old)
    assert.ok(back)
    assert.equal(back.inv.hook, false)
    assert.deepEqual(back.inv.keyrings, {})
    const s2 = Z.createGame(Z.WORLD, { save: back })
    assert.equal(s2.inv.shrooms, 0)
  })
})

describe('full run through the Wildwood', () => {
  it('goes from the town to the Gate shutting', () => {
    const s = Z.createGame(Z.WORLD, { seed: 9 })
    const got = item => assert.ok(s.flags[`item:${item}`], `expected ${item}`)
    Object.assign(s.inv, { sword: true, bombBag: true, bombs: 12 })
    s.flags['item:sword'] = true
    s.flags['item:bombBag'] = true
    s.flags.intro = true

    // The thicket on the town's west road: cut it, walk west into the Wildwood.
    P.walkTo(s, 4, 26)
    P.swing(s, 'left')
    P.walkTo(s, 3, 26)
    P.swing(s, 'left')
    P.walkTo(s, 1, 26)
    P.until(s, () => s.map.id === 'wildwood', P.inp({ move: { x: -1, y: 0 } }))
    P.frames(s, 30)
    assert.equal(s.area, 'WILDWOOD SHORE')

    // Mossa's cottage: a waffle for the girl.
    P.walkTo(s, 72, 32)
    P.until(s, () => s.map.id === 'mossa')
    P.frames(s, 30)
    P.walkTo(s, 6, 4)
    P.face(s, 'up'); P.pressA(s)
    got('waffle')
    P.walkTo(s, 5, 8)
    P.until(s, () => s.map.id === 'wildwood')
    P.frames(s, 30)
    // The shroom on the beach, inside its ring of rocks: lift one out of the way.
    P.walkTo(s, 78, 40)
    P.face(s, 'down'); P.pressA(s)
    P.frames(s, 20)
    P.step(s, P.inp({ aPress: true, a: true })) // throw it
    P.frames(s, 40)
    P.walkTo(s, 78, 42)
    P.settle(s)
    assert.equal(s.inv.shrooms, 1)

    // The boulders: a bomb.
    P.walkTo(s, 62, 38)
    P.useB(s, 'bombs', 'left')
    assert.equal(tile(s, 61, 38), '.')
    assert.equal(tile(s, 61, 39), '.')

    // Max gives bombs; Luna in the brambles: cut in, give the waffle.
    P.walkTo(s, 52, 37)
    P.face(s, 'up'); P.pressA(s)
    P.walkTo(s, 37, 36)
    P.swing(s, 'up')
    P.walkTo(s, 37, 32)
    P.face(s, 'up'); P.pressA(s)
    assert.ok(s.flags.luna && s.luna, 'Luna joined')

    // The lab door: Luna slides the block away.
    P.walkTo(s, 51, 21)
    P.face(s, 'right'); P.pressA(s)
    P.frames(s, 60)
    P.walkTo(s, 52, 20)
    P.until(s, () => s.map.id === 'lab1')
    P.frames(s, 40)

    // --- Horizon Lab ---
    // Security (dark): drones, then the first key.
    P.walkTo(s, 3, 29)
    P.frames(s, 60)
    P.killCell(s)
    P.frames(s, 20)
    P.walkTo(s, 7, 30)
    P.face(s, 'up'); P.pressA(s)
    assert.equal(Z.keyCount(s), 1)
    // Stairwell: the switch to cyan, then down.
    P.walkTo(s, 38, 27)
    P.swing(s, 'up')
    assert.equal(s.map.crystalAll, 'cyan')
    P.walkTo(s, 45, 33)
    P.until(s, () => s.map.id === 'lab1b')
    P.frames(s, 30)
    // B1: through the dropped pink blocks and the locked door to the breaker.
    P.walkTo(s, 34, 29)
    P.until(s, () => tile(s, 32, 29) === '.', P.inp({ move: { x: -1, y: 0 } }))
    P.walkTo(s, 20, 27)
    P.face(s, 'up'); P.pressA(s)
    assert.ok(s.flags['lab1.power'])
    P.walkTo(s, 28, 34)
    P.face(s, 'up'); P.pressA(s)
    got('tube')
    P.walkTo(s, 45, 33)
    P.until(s, () => s.map.id === 'lab1')
    P.frames(s, 30)
    // The lobby's shutter is open now; the psi room east of the hub.
    P.walkTo(s, 23, 21)
    P.walkTo(s, 34, 20)
    P.face(s, 'right'); P.pressA(s)
    P.frames(s, 60)
    assert.equal(tile(s, 39, 20), 'B')
    P.walkTo(s, 39, 21)
    P.face(s, 'up'); P.pressA(s)
    P.frames(s, 60)
    assert.equal(tile(s, 39, 13), 'B')
    assert.ok(s.map.plates.includes('lab1.psi'))
    // The llama: the hook.
    P.walkTo(s, 40, 11)
    P.frames(s, 40)
    P.settle(s)
    P.killCell(s)
    assert.ok(s.flags.llama)
    P.frames(s, 20)
    P.walkTo(s, 40, 7)
    P.face(s, 'up'); P.pressA(s)
    got('hook')
    // The hub's shaft: drop to B1, clear it, the second key; back up the stairs.
    P.walkTo(s, 21, 17)
    P.until(s, () => s.map.id === 'lab1b', P.inp({ move: { x: 1, y: 0 } }))
    P.frames(s, 40)
    P.killCell(s)
    P.frames(s, 20)
    P.walkTo(s, 23, 21)
    P.face(s, 'up'); P.pressA(s)
    assert.equal(Z.keyCount(s), 1)
    P.walkTo(s, 45, 33)
    P.until(s, () => s.map.id === 'lab1')
    P.frames(s, 30)
    // Back to pink for the walkie-talkie in the dorms.
    P.walkTo(s, 38, 27)
    P.swing(s, 'up')
    assert.equal(s.map.crystalAll, 'pink')
    P.walkTo(s, 17, 17)
    P.until(s, () => tile(s, 16, 17) === '.', P.inp({ move: { x: -1, y: 0 } }))
    P.walkTo(s, 11, 21)
    P.face(s, 'up'); P.pressA(s)
    got('walkie')
    // The coolant vault: hook to the island, to the ledge, the big key, and back.
    P.walkTo(s, 7, 8)
    P.useB(s, 'hook', 'up')
    assert.deepEqual([s.hero.x, s.hero.y], [7.5, 5.5])
    P.walkTo(s, 6, 5)
    P.useB(s, 'hook', 'up')
    assert.deepEqual([s.hero.x, s.hero.y], [6.5, 2.5])
    P.walkTo(s, 8, 2)
    P.face(s, 'up'); P.pressA(s)
    assert.ok(s.flags['bigkey:lab1'])
    P.walkTo(s, 6, 2)
    P.useB(s, 'hook', 'down')
    assert.deepEqual([s.hero.x, s.hero.y], [6.5, 8.5])
    // Mistral.
    P.walkTo(s, 23, 13)
    P.until(s, () => tile(s, 23, 12) === '.', P.inp({ move: { x: 0, y: -1 } }))
    P.walkTo(s, 23, 8)
    P.frames(s, 60)
    P.settle(s)
    P.killCell(s)
    assert.ok(s.flags.mistral)
    P.frames(s, 30)
    P.settle(s)
    assert.ok(s.flags['mistral.told'], 'Luna spoke')
    P.walkTo(s, 23, 9)
    P.settle(s)
    assert.equal(s.hero.maxHp, 8)
    // Out, and give Toby his walkie and Dusty his tube on the way.
    P.walkTo(s, 23, 34)
    P.walkTo(s, 23, 35)
    P.until(s, () => s.map.id === 'wildwood')
    P.frames(s, 30)
    P.walkTo(s, 48, 37)
    P.face(s, 'up'); P.pressA(s)
    assert.ok(s.flags['got:toby:bits50'])

    // --- Over the ravine ---
    P.walkTo(s, 32, 37)
    P.useB(s, 'hook', 'left')
    assert.deepEqual([s.hero.x, s.hero.y], [26.5, 37.5])
    P.walkTo(s, 4, 26)
    P.settle(s)
    assert.equal(s.inv.shrooms, 2)
    P.walkTo(s, 10, 16)
    P.walkTo(s, 10, 15)
    P.until(s, () => s.map.id === 'deep1')
    P.frames(s, 40)

    // --- The Deep Lab ---
    // Room Eleven: Luna remembers; the first key.
    P.walkTo(s, 2, 5)
    P.frames(s, 30)
    P.settle(s)
    assert.ok(s.flags.room11)
    P.walkTo(s, 7, 10)
    P.face(s, 'up'); P.pressA(s)
    assert.equal(Z.keyCount(s), 1)
    // The coolant: hook to the island, down to the strip; Deepseek; back.
    P.walkTo(s, 34, 5)
    P.killCell(s) // the bats over the coolant would catch the hook
    P.useB(s, 'hook', 'right')
    assert.deepEqual([s.hero.x, s.hero.y], [41.5, 5.5])
    P.walkTo(s, 41, 6)
    P.useB(s, 'hook', 'down')
    assert.deepEqual([s.hero.x, s.hero.y], [41.5, 9.5])
    P.walkTo(s, 39, 13)
    P.frames(s, 30)
    P.settle(s)
    P.killCell(s)
    assert.ok(s.flags.deepseek)
    P.frames(s, 20)
    P.walkTo(s, 39, 22)
    P.face(s, 'up'); P.pressA(s)
    assert.equal(Z.keyCount(s), 2)
    P.walkTo(s, 41, 9)
    P.useB(s, 'hook', 'up')
    P.walkTo(s, 41, 6)
    P.useB(s, 'hook', 'left')
    assert.deepEqual([s.hero.x, s.hero.y], [34.5, 6.5])
    // The hall's west door, the chute: slide the block into the hole.
    P.walkTo(s, 23, 13)
    P.walkTo(s, 17, 18)
    P.until(s, () => tile(s, 16, 18) === '.', P.inp({ move: { x: -1, y: 0 } }))
    assert.equal(Z.keyCount(s), 1, 'the chute door took one key')
    P.walkTo(s, 2, 20)
    P.face(s, 'right'); P.pressA(s)
    P.frames(s, 60)
    assert.equal(tile(s, 11, 20), 'B')
    P.walkTo(s, 11, 21)
    P.face(s, 'up'); P.pressA(s)
    P.frames(s, 60)
    assert.ok(Object.keys(s.flags).some(f => f.startsWith('drop:deep2:')), 'the block fell to the floor below')
    // The word on the letter floor: D, U, S, K.
    P.route(s, [[15, 18], [17, 18], [17, 14], [20, 14], [20, 15], [21, 15], [21, 16], [22, 16], [22, 17], [21, 17], [20, 17], [20, 18], [26, 18], [26, 17]])
    assert.ok(s.flags['deep.dusk'], 'the vault listened')
    P.frames(s, 10)
    // The vault: the Arc Blade.
    P.walkTo(s, 23, 30)
    P.face(s, 'up'); P.pressA(s)
    got('arc')
    // The crystal relay: cyan, for the pink blocks downstairs.
    P.walkTo(s, 42, 28)
    P.swing(s, 'up')
    assert.equal(s.map.crystalAll, 'cyan')
    // The vines over the stairs: only the Arc Blade cuts them.
    P.walkTo(s, 7, 28)
    P.swing(s, 'left')
    assert.equal(tile(s, 6, 28), '.')
    P.walkTo(s, 5, 28)
    P.until(s, () => s.map.id === 'deep2', P.inp({ move: { x: -1, y: 0 } }))
    P.frames(s, 40)

    // --- The Other Side ---
    // The cage opened when the block landed on its plate: the big key.
    P.walkTo(s, 7, 23)
    P.frames(s, 20)
    assert.equal(tile(s, 6, 19), '.', 'the cage is open')
    P.walkTo(s, 6, 19)
    P.face(s, 'up'); P.pressA(s)
    assert.ok(s.flags['bigkey:deep'])
    // The static hall: the pink blocks are down (cyan), the locked door, the big-key door.
    P.walkTo(s, 23, 26)
    P.until(s, () => tile(s, 23, 24) === '.', P.inp({ move: { x: 0, y: -1 } }))
    assert.equal(Z.keyCount(s), 0, 'the static hall door took the last key')
    P.walkTo(s, 23, 13)
    P.until(s, () => tile(s, 23, 12) === '.', P.inp({ move: { x: 0, y: -1 } }))
    P.walkTo(s, 23, 10)
    P.frames(s, 30)
    P.settle(s)
    P.killCell(s)
    assert.ok(s.flags.gemini)
    P.frames(s, 30)
    P.settle(s)
    assert.ok(s.flags.gateShut, 'the Gate is shut')
    P.walkTo(s, 23, 8)
    P.settle(s)
    assert.equal(s.hero.maxHp, 10)
    // The lift goes straight up to the Deep Woods.
    P.walkTo(s, 29, 9)
    P.until(s, () => s.map.id === 'wildwood')
    P.frames(s, 30)
    assert.equal(s.area, 'THE DEEP WOODS')

    // Back in the Hollow Graves the vines are gone.
    Z.enterMap(Z.WORLD, s, 'overworld', 'graves', [])
    P.frames(s, 5)
    assert.equal(tile(s, 97, 5), '.')
    assert.equal(tile(s, 98, 5), '.')
  })
})
