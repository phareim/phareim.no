// ACT THREE (docs/worlds/act-three.md): a few end-to-end tests, four at the most (Petter, 2026-11-27). A scripted
// player goes from the stair under Fogstage's stage to the Weight and Vega, pressing what a player presses; one who
// only stands before the boss falls; saves load where they should; and the maps hold together. The jump's reach in these rooms is measured by
// `scripts/zelda-lab/actthree-measure.mjs`, not pinned here.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'
import { json, reload, climber, play, use } from './zelda-plays/act-three.mjs'

let Z
before(async () => { Z = await load(); use(Z) })

const MAPS = ['actunder', 'actdoors', 'actbard', 'actflats', 'actwings', 'actloft', 'actstudy', 'actcable', 'actgondola']

describe('Act Three', () => {
  it('is climbed from the stair under the stage to the Weight in the gondola and Vega\'s finale, with a reload on the way', () => {
    const s = Z.createGame(Z.WORLD, { seed: 7, at: { map: 'understage', entry: 'door' } })
    Z.grant(s, 'sword')
    play(Z, s)
  })

  it('is lost by a hero who only stands in the gondola: the glass comes up and does not save him', () => {
    const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'actgondola', entry: 'stair' } })
    Z.grant(s, 'sword')
    Z.grant(s, 'lens')
    // (Three hearts, said here: a fall gives back all he has, so a hero with more takes longer.)
    s.hero.hp = s.hero.maxHp = 6
    const step = (o) => Z.stepGame(Z.WORLD, s, 1 / 60, { ...Z.NO_INPUT, ...o })
    let frames = 0
    let glass = false
    while (s.mode !== 'dying' && frames < 60 * 30) {
      step(s.mode === 'dialog' && frames % 12 === 0 ? { aPress: true } : {})
      if (s.mode === 'play') frames++
      glass ||= Z.lensUp(s)
    }
    assert.ok(glass && s.mode === 'dying' && frames / 60 > 7 && frames / 60 < 11, `fell after ${frames / 60} s, glass ${glass}`)
    // The retry: at the stair, the fight from its start.
    for (let i = 0; i < 400 && s.mode !== 'play'; i++) step()
    assert.deepEqual([s.map.id, s.entry.entry, s.hero.hp, Z.halluBodies(s.map).map(e => e.hp)], ['actgondola', 'stair', 6, [10, 10, 10]])
  })

  it('loads a save made in the climb at its last stair, with doors and finds as they were and the glass never in it', () => {
    // In the Wings: the glass up over the hidden ledges, a key held, then the first door opened.
    let s = Z.createGame(Z.WORLD, { seed: 5, at: { map: 'actwings', entry: 'wings' } })
    Z.grant(s, 'sword')
    Z.grant(s, 'lens')
    Z.grant(s, 'smallKey')
    let P = climber(s)
    P.walk(7)
    P.look()
    assert.ok(s.map.lensSeen.length > 0)
    P.walk(11.4)
    P.unlock(12, 9)
    const save = Z.toSave(s)
    assert.ok(!/"lens(Seen|Gone)?":|"card/.test(JSON.stringify(save)), 'no glass, nothing it showed, no card and no list of cards in a save')
    assert.ok(save.flags.includes('item:lens'))
    const again = reload(s)
    assert.deepEqual([again.map.id, again.entry.entry], ['actwings', 'wings'])
    assert.deepEqual([Z.tileAt(again.map, 12, 8), Z.tileAt(again.map, 12, 9)], ['.', '.'], 'the door stays open')
    assert.ok(!Z.has(again, 'chest:actthree.heart') && Z.has(again, 'item:lens') && Z.keyCount(again) === 0)
    assert.ok(!again.lens && !again.map.lensSeen, 'the glass starts down, and has shown nothing')

    // A reload in a scene plays its card again; a death does not.
    s = Z.createGame(Z.WORLD, { seed: 5, at: { map: 'actunder', entry: 'foot' } })
    Z.grant(s, 'sword')
    climber(s).card()
    Z.hurtHero(Z.ctx(Z.WORLD, s, []), 99, s.hero.x - 1, s.hero.y)
    for (let i = 0; i < 200 && s.mode !== 'play'; i++) Z.stepGame(Z.WORLD, s, 1 / 60, Z.NO_INPUT)
    assert.deepEqual([s.map.id, s.mode, s.card], ['actunder', 'play', undefined])
    assert.equal(reload(s).card?.title, 'SCENE ONE.')

    // A save made up the cable loads at its foot, and the card plays again.
    s = Z.createGame(Z.WORLD, { seed: 5, at: { map: 'actcable', entry: 'foot' } })
    Z.grant(s, 'sword')
    P = climber(s)
    P.card()
    P.walk(8.4)
    P.jump(9.4, 20, 'the first clamp')
    P.walk(8.7)
    P.jump(5.8, 18, 'the second')
    const up = reload(s)
    assert.deepEqual([up.map.id, up.entry.entry, up.card?.title], ['actcable', 'foot', 'SCENE FOUR.'])
    assert.ok(Math.abs(up.hero.y + Z.HERO_R - 22) < 0.3, 'back on the foot ledge')

    // A save from before there was a Lens loads without it, and standing still shows nothing.
    const old = json({ ...Z.toSave(s), savedAt: 1 })
    old.flags = old.flags.filter(f => f !== 'item:lens')
    const back = Z.createGame(Z.WORLD, { save: Z.parseSave(old), at: Z.loadSpot(Z.WORLD, Z.parseSave(old), null, true) })
    for (let i = 0; i < 120; i++) Z.stepGame(Z.WORLD, back, 1 / 60, Z.NO_INPUT)
    assert.ok(!Z.lensUp(back) && !Z.has(back, 'item:lens'))
  })

  it('holds together: the validator, its keys and doors, the stair under the stage, nothing needed hidden, the shaft, the stage floor and the doorways', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD).filter(p => /fogstage|understage|^act/.test(p)), [])
    const defs = MAPS.map(id => Z.WORLD.maps[id])
    assert.ok(defs.every(d => d.kind === 'side' && d.keyring === 'actthree' && d.resume && !d.away && d.realm === 'fogstage'))
    // No room taller than the 24 rows the side view is proven at.
    for (const id of MAPS) {
      const info = Z.mapInfo(Z.WORLD, id)
      for (let i = 0; i < info.cols * info.rows; i++) assert.ok(Z.cellRect(info, i).h <= 24 && info.cw === 16, id)
    }

    // The ring: as many small keys as locked doors (a run of lock tiles is one door), and one great key and lock.
    const count = { smallKey: 0, bigKey: 0, L: 0, K: 0 }
    for (const id of MAPS) {
      const info = Z.mapInfo(Z.WORLD, id)
      for (const c of info.chestList) if (c.item in count) count[c.item]++
      info.base.forEach((t, i) => { if ((t === 'L' || t === 'K') && info.base[i - 1] !== t && info.base[i - info.w] !== t) count[t]++ })
    }
    assert.deepEqual(count, { smallKey: 2, bigKey: 1, L: 2, K: 1 })

    // The stair under the stage: the land and its cellar as big as they were, reached on foot.
    const size = id => [Z.WORLD.maps[id].rows[0].length, Z.WORLD.maps[id].rows.length]
    assert.deepEqual([size('fogstage'), size('understage')], [[88, 52], [16, 10]])
    const s = Z.createGame(Z.WORLD, { seed: 1, at: { map: 'understage', entry: 'door' } })
    assert.ok(walker(Z).path(s, 8, 1), 'reached on foot from the cellar\'s door')
    // Every stair lands on a real entry, and the map it lands in has a stair back.
    for (const id of ['understage', ...MAPS]) {
      for (const w of Z.mapInfo(Z.WORLD, id).warps) {
        assert.ok(Z.hasEntry(Z.WORLD, w.to, w.entry), `${id} → ${w.to}:${w.entry}`)
        // (The gondola's other stair is the way out, behind its gate: it comes down at the RAINCHECK's gangway.)
        if (!(id === 'actgondola' && w.to === 'fogstage')) assert.ok(Z.mapInfo(Z.WORLD, w.to).warps.some(b => b.to === id), `no way back from ${w.to} to ${id}`)
      }
    }
    // Paint is air, and nothing the way on needs is hidden: no key, lens or door.
    for (const id of MAPS) {
      const info = Z.mapInfo(Z.WORLD, id)
      for (const t of Z.glassThings(info)) {
        if (t.is === 'cache') assert.ok(!['smallKey', 'bigKey', 'lens'].includes(info.chests.get(t.i).item), `${id}: a hidden ${info.chests.get(t.i).item}`)
        if (t.is === 'ledge' || t.is === 'chest') assert.equal(info.base[t.i], '.', `${id}: paint at ${t.x},${t.y} is air`)
      }
    }
    // With the hidden platforms taken out, every key and door is still where the way goes.
    const bare = Object.fromEntries(Object.entries(Z.WORLD.maps).map(([id, d]) => [id, MAPS.includes(id)
      ? { ...d, marks: Object.fromEntries(Object.entries(d.marks).map(([ch, m]) => [ch, m.ent.t === 'veil' ? { tile: '.', ent: { t: 'lie', as: 'ledge' } } : m])) }
      : d]))
    assert.deepEqual(Z.validateWorld({ ...Z.WORLD, maps: bare }).filter(p => /^act/.test(p)), [])

    // Down the Boards' shaft from the Flats: the first natural press leads down the ladder, and none sends him back up the stair.
    const down = (move) => {
      const g = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'actbard', entry: 'shaft' } })
      Z.grant(g, 'sword')
      g.flags['actthree.bard'] = true
      g.card = null
      g.map.enemies = []
      for (let i = 0; i < 240; i++) Z.stepGame(Z.WORLD, g, 1 / 60, { ...Z.NO_INPUT, move })
      return [g.map.id, g.hero.y > 8]
    }
    for (const move of [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0.707, y: 0.707 }, { x: 1, y: 0.6 }]) assert.deepEqual(down(move), ['actbard', true], `pressing ${JSON.stringify(move)}`)
    assert.equal(down({ x: 1, y: 0 })[0], 'actbard', 'RIGHT alone stays in the room')
    assert.deepEqual([down({ x: 0, y: 0 }), down({ x: -1, y: 0 })], [['actbard', false], ['actbard', false]], 'hands off, or LEFT still held from the Flats: hanging on the ladder, under the stair')

    // BARD's floor has no free corner: with the hero standing at each spot, some piece's blow is stencilled on it.
    for (let x = 1.5; x <= 14.5; x += 0.25) {
      const g = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'actbard', entry: 'trapdoor' } })
      g.hero.invuln = 99
      const bard = g.map.enemies.find(e => e.kind === 'bard')
      const hit = ['door', 'chest', 'rope'].some(piece => {
        g.card = g.dialog = null
        g.mode = 'play'
        g.hero.x = x
        g.hero.y = 11.66
        bard.x = bard.y = -30
        bard.ai = { mode: 'hide', t: 0, tell: 0, piece }
        Z.stepGame(Z.WORLD, g, 1 / 60, Z.NO_INPUT)
        return Z.bardBoxes(g.map, bard).some(b => x >= b.x0 && x <= b.x1 && g.hero.y >= b.y0 && g.hero.y <= b.y1)
      })
      assert.ok(hit, `no blow of BARD's reaches a hero standing at ${x}`)
    }

    // A blow in the doorway does not throw the hero out of the room by the stair he stands beside.
    let thrown = 0
    for (const [map, entry] of [['actwings', 'wings'], ['actstudy', 'studyin']]) {
      const g = Z.createGame(Z.WORLD, { seed: 3, at: { map, entry } })
      g.card = null
      for (let i = 0; i < 30; i++) Z.stepGame(Z.WORLD, g, 1 / 60, Z.NO_INPUT)
      Z.hurtHero(Z.ctx(Z.WORLD, g, []), 1, g.hero.x + 1, g.hero.y)
      for (let i = 0; i < 120; i++) Z.stepGame(Z.WORLD, g, 1 / 60, Z.NO_INPUT)
      assert.deepEqual([g.map.id, g.mode], [map, 'play'], `hit at the entry of ${map}`)
      // Thrown onto the stair he stays, until he pushes afresh: then it takes him.
      if (g.map.shoved) {
        thrown++
        for (let i = 0; i < 40 && g.mode === 'play'; i++) Z.stepGame(Z.WORLD, g, 1 / 60, { ...Z.NO_INPUT, move: { x: -1, y: 0 } })
        assert.equal(g.mode, 'warp', `a fresh push on the stair of ${map} takes it`)
      }
    }
    assert.ok(thrown > 0, 'neither blow threw the hero onto a stair')
  })
})
