// What the A button says it will do (engine/action.ts `aWould`, the touch deck's picture) and what a press then
// does, on the real maps; and the hut-to-Prism play-through ending where it ended before the A handling asked
// `aPlan` for its branch.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'
import { prismRun } from './zelda-prism-run.mjs'

let Z, P
before(async () => { Z = await load(); P = walker(Z) })

const OX = 40
const HUT = { map: 'overworld', entry: 'hut' }

function newGame(seed) {
  const s = Z.createGame(Z.WORLD, { seed, at: HUT })
  for (let k = 0; k < 120 && s.hero.auto; k++) P.step(s)
  return s
}

/** One fresh press of A and what it set off (nothing settled yet). */
const press = s => P.step(s, P.inp({ aPress: true, a: true })).map(e => e.type)

describe('the A button', () => {
  it('says what a press will do, and the press does that', () => {
    const s = newGame(7)
    const would = (want, where) => assert.equal(Z.aWould(Z.WORLD, s), want, where)
    const goTo = (x, y, dir) => { P.walkTo(s, x, y); if (dir) P.face(s, dir) }
    const away = (x, y) => { goTo(x, y, 'down'); would('blade', `walked off to ${x},${y}`) }
    const go = (map, entry) => { Z.enterMap(Z.WORLD, s, map, entry, []); P.frames(s, 30); P.settle(s) }
    const tile = (x, y) => s.map.tiles[y * s.map.w + x]

    // A chest: the blade, beside the Keeper's door.
    goTo(OX + 6, 30, 'up')
    would('open', 'the chest')
    assert.ok(press(s).includes('chest'))
    assert.equal(s.inv.sword, true)
    P.settle(s)
    would('blade', 'the chest is open')

    // A sign.
    goTo(OX + 3, 32, 'up')
    const sign = Z.mapInfo(Z.WORLD, 'overworld').signs.get(31 * s.map.w + OX + 3)
    would('read', 'the sign')
    press(s)
    assert.deepEqual(s.dialog?.lines, sign.lines)
    would('blade', 'in a dialog')
    P.settle(s)
    // A foe awake beside it changes nothing: the press still reads, so the picture still says so.
    const st = Z.STATS.blob
    const foe = { id: 'foe', kind: 'blob', x: s.hero.x + 1.2, y: s.hero.y, r: st.r, hp: 9, maxHp: 9, dir: 'left', cell: s.zoneIndex, invuln: 0, stun: 0, knock: null, ai: { mode: 'idle', t: 99, tell: 0 }, home: { x: s.hero.x + 1.2, y: s.hero.y }, dead: false, flash: 0 }
    s.map.enemies.push(foe)
    would('read', 'a foe beside the sign')
    foe.calm = true
    would('read', 'a calm foe beside the sign')
    s.map.enemies.splice(s.map.enemies.indexOf(foe), 1)
    would('read', 'the foe gone')
    away(OX + 3, 33)

    // A pot: lifted, carried, thrown.
    goTo(OX + 5, 32, 'up')
    would('lift', 'the pot')
    assert.ok(press(s).includes('lift'))
    assert.equal(s.hero.carry, 'pot')
    would('throw', 'the pot going up')
    P.frames(s, 30)
    goTo(OX + 5, 33, 'down')
    would('throw', 'a pot in hand')
    assert.ok(press(s).includes('throw'))
    assert.equal(s.hero.carry, null)
    P.frames(s, 60)
    would('blade', 'the pot thrown')

    // A person.
    goTo(OX + 8, 30, 'up')
    would('talk', 'the Keeper')
    // A foe awake within 8 tiles: A is the blade for people too, and the picture says so; the foe gone, the Keeper again.
    s.map.enemies.push({ ...foe, x: s.hero.x + 3, y: s.hero.y })
    would('blade', 'the Keeper, with a foe awake')
    assert.ok(press(s).includes('swing'))
    assert.equal(s.dialog, null)
    s.map.enemies.pop()
    P.frames(s, 40)
    would('talk', 'the Keeper, the foe gone')
    assert.ok(press(s).includes('talk'))
    assert.equal(s.dialog?.who, 'keeper')
    // The lines closed and A not yet rested: a tap too many only swings, and the button says so.
    for (let k = 0; k < 900 && s.mode !== 'play'; k++) {
      if (s.mode === 'dialog') { P.step(s, P.inp(), 0.3); P.step(s, P.inp({ aPress: true, a: true })) } else P.step(s)
    }
    would('blade', 'right after the talk')
    assert.ok(press(s).includes('swing'))
    assert.equal(s.mode, 'play')
    P.frames(s, 60)
    would('talk', 'rested')
    away(OX + 8, 32)

    // A door A uses: a cabinet in the arcade.
    go('arcade', 'door')
    goTo(6, 5, 'up')
    would('door', 'a cabinet')
    press(s)
    assert.equal(s.dialog?.after?.exit?.id, 'pizzarescue')
    P.step(s, P.inp({ bPress: true }))
    assert.equal(s.mode, 'play')
    away(6, 6)

    // A lever.
    go('underglow2', 'up')
    s.map.enemies = []
    Object.assign(s.hero, { x: 10.5, y: 15.5 })
    P.frames(s, 60)
    P.settle(s)
    s.map.enemies = []
    goTo(10, 14, 'up')
    would('pull', 'the lever')
    assert.ok(press(s).includes('lever'))
    assert.equal(s.flags['underglow2.shortcut'], true)
    P.settle(s)
    P.face(s, 'up')
    would('blade', 'the lever is thrown')

    // A locked door, without its key (A only says so: no promise) and with it.
    go('shrine', 'start')
    P.walkTo(s, 17, 29)
    P.frames(s, 30)
    P.killCell(s)
    goTo(17, 29, 'left')
    assert.equal(tile(16, 29), 'L')
    assert.equal(s.inv.keys, 0)
    would('blade', 'locked, no key')
    press(s)
    assert.match(s.dialog?.lines[0] ?? '', /^LOCKED/)
    assert.equal(tile(16, 29), 'L')
    P.settle(s)
    Z.addKeys(s, 1)
    would('key', 'locked, key in hand')
    assert.ok(press(s).includes('unlock'))
    assert.equal(tile(16, 29), '.')
    assert.equal(s.inv.keys, 0)
    P.face(s, 'right')
    would('blade', 'turned from the door')
  })

  it('plays hut to Prism to the same end as before, the button right at every press', () => {
    const s = newGame(11)
    const said = {}
    const pressA = g => {
      const before = JSON.stringify(g)
      const would = Z.aWould(Z.WORLD, g)
      assert.equal(JSON.stringify(g), before, 'asking changes nothing')
      const did = press(g)
      const sign = { open: 'chest', blade: 'swing' }[would]
      assert.ok(sign && did.includes(sign), `said ${would} at ${g.map.id} ${g.hero.x.toFixed(1)},${g.hero.y.toFixed(1)}; the press did: ${did}`)
      said[would] = (said[would] ?? 0) + 1
      P.settle(g)
    }
    prismRun(s, { ...P, Z, OX, pressA })
    assert.deepEqual(said, { open: 6, blade: 2 })
    // Taken from the same walk on the engine as it was before the refactor. (Bits left out: they fall by chance.)
    // (What the walk ends holding, of what it held when this was recorded: a treasure added to the game since is not its business.)
    const inv = Object.fromEntries(Object.keys(BEFORE.inv).map(k => [k, s.inv[k]]))
    assert.deepEqual({ map: s.map.id, mode: s.mode, hp: s.hero.maxHp, inv, flags: Object.keys(s.flags).sort() }, BEFORE)
  })
})

const BEFORE = {
  map: 'shrine', mode: 'play', hp: 8,
  inv: { sword: true, bombBag: true, bombs: 8, disc: true, keys: 0, bigKey: true, pieces: 1, selected: 'disc', prism: true, hook: false, arc: false, echo: false, lamp: false, bigBag: false, shrooms: 0, keyrings: {} },
  flags: [
    'appear:shrine.bigkey', 'appear:shrine.key1', 'appear:shrine.key2', 'bomb:overworld:513', 'bomb:overworld:514',
    'bomb:overworld:584', 'boss', 'chest:ow.bombbag', 'chest:ow.sword', 'chest:shrine.bigkey', 'chest:shrine.disc',
    'chest:shrine.key1', 'chest:shrine.key2', 'door:shrine:1159', 'door:shrine:1160', 'door:shrine:1408',
    'door:shrine:1456', 'door:shrine:599', 'door:shrine:600', 'gate:shrine.39,24', 'gateShut', 'item:bigKey',
    'item:bombBag', 'item:disc', 'item:heartContainer', 'item:heartPiece', 'item:prism', 'item:smallKey',
    'item:sword', 'miniboss', 'took:ow.piece.woods', 'took:shrine.container', 'took:shrine.prism', 'won',
  ],
}
