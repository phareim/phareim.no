// ACT THREE: the play from its door to its Weight, on a game it did not make. `tests/zelda-act-three.test.mjs` plays it on
// the game it makes; `tests/zelda-whole-game.test.mjs` plays it with the one hero who goes through everything.
import assert from 'node:assert/strict'
import { reelPlayer } from '../zelda-reel.mjs'
import { awaitBags, fightBard, fightHallucinator, fightUnderstudy } from '../zelda-act-three-bots.mjs'

let Z
/** The engine the helpers here play on. */
export function use(engine) { Z = engine }

export const json = x => JSON.parse(JSON.stringify(x))
/** The tab reloaded: the save as it is stored, and the game begun where a page load begins it (`loadSpot`). */
export function reload(s) {
  const save = Z.parseSave(json({ ...Z.toSave(s), savedAt: 1 }))
  return Z.createGame(Z.WORLD, { save, at: Z.loadSpot(Z.WORLD, save, null, Z.awayMap(Z.WORLD, save.map, save.entry)) })
}

/** The side player of the Late Show (`zelda-reel.mjs`), with this climb's own moves. */
export function climber(s) {
  const P = reelPlayer(Z, s)
  /** Turn `way` (-1 left, 1 right) and press A. */
  const use = (way) => {
    P.step({ move: { x: 0.4 * way, y: 0 } })
    P.step({ aPress: true, a: true })
  }
  const open = (id, way) => {
    use(way)
    assert.ok(Z.has(s, `chest:${id}`), `${id} opens: ${P.where()}`)
    P.settle()
  }
  /** Stand still until the glass is up and the picture has changed. */
  const look = () => {
    let i = 0
    for (; i < 180 && !(Z.lensUp(s) && s.lens.k === 1); i++) P.step()
    assert.ok(Z.lensUp(s), `the glass never rose: ${P.where()}`)
    return i / 60
  }
  /** Push into a locked door on the floor, `way` of the hero, until it gives. */
  const unlock = (tx, ty, way = 1) => P.until(() => Z.tileAt(s.map, tx, ty) === '.', { x: way, y: 0 })
  /** Wait for the bags, then jump. */
  const across = (x, row, what, dur = 1) => { awaitBags(Z, s, P, x, dur, row); P.jump(x, row, what) }
  /** Wait for the bags, then walk. */
  const hurry = (x) => { awaitBags(Z, s, P, x, Math.abs(s.hero.x - x) / Z.HERO_SPEED + 0.25); P.walk(x) }
  return { ...P, use, open, look, unlock, across, hurry }
}

/** From the stair under Fogstage's stage to the Weight in the gondola and Vega's finale, with a reload on the way. Returns the game as it ends (a reload on the way makes a new one). */
export function play(engine, g, opts = {}) {
  use(engine)
  let s = g
  let P = climber(s)

  // The stair behind the paint, and scene one.
  P.walkTo(8, 2)
  P.warpBy({ x: 0, y: -1 }, 'actunder')
  assert.equal(s.card?.title, 'SCENE ONE.')
  P.card()

  // The Crawlspace: the curb, the blob, the ladder, two platforms and the top ladder.
  P.walk(3.9)
  P.jump(5.9, 21, 'the curb')
  P.walk(7.4)
  P.fell(s.map.enemies.find(e => e.kind === 'blob' && e.home.y > 20), 9.5)
  P.walk(8.5)
  P.climb(-1, 18)
  P.walk(8.4)
  P.jump(5.9, 16, 'west to the second platform')
  P.walk(4.5)
  P.open('actunder.bits', -1)
  P.walk(6.4)
  P.jump(8.9, 14, 'east to the top platform')
  P.walk(11.5)
  P.climb(-1, 11)

  // The Prop Room: the crate, the shelves, and the lens at the far end of the middle one.
  P.walk(10)
  P.jump(8, 10, 'onto the crate')
  P.walk(7.5)
  P.jump(5, 8, 'the first shelf')
  P.walk(5.4)
  P.jump(7.8, 6, 'the second shelf')
  P.walk(9.4)
  assert.ok(!Z.has(s, 'item:lens') && !s.lens, 'no glass before the lens')
  P.open('actthree.lens', 1)
  assert.ok(Z.has(s, 'item:lens'), 'THE LENS is held by its flag')
  assert.ok(P.heard.some(l => /STAND STILL A MOMENT/.test(l)))
  P.walk(7.5)
  P.jump(5.2, 4, 'the third shelf')
  P.walk(5.4)
  P.jump(7.9, 2, 'the stair shelf')
  P.walk(12.3)
  P.warpBy({ x: 1, y: 0 }, 'actdoors')

  // The Three Doors: the key in plain sight, and the glass over the painted two.
  P.walk(4.2)
  P.jump(6.6, 10, 'over the sign')
  P.walk(9.4)
  P.open('actthree.key1', 1)
  P.walk(8.5)
  P.events.length = 0
  const took = P.look()
  assert.ok(took >= 0.7 && took <= 1.2, `stillness, then the picture: ${took} s`)
  assert.equal(P.events.filter(e => e.type === 'lens').length, 1, 'the glass sounds once as it rises')
  P.step({ move: { x: 1, y: 0 } })
  assert.ok(!Z.lensUp(s) && s.lens.k > 0.9, 'a move drops the glass, and the paint comes back slowly')
  P.walk(8.6)
  P.jump(8.4, 8, 'onto the middle pad')
  P.walk(8.5)
  assert.equal(s.map.id, 'actdoors', 'a painted door does nothing')
  P.walk(9.4)
  P.jump(12.35, 8, 'one hop to the real door')
  P.warpBy({ x: 1, y: 0 }, 'actbard')
  assert.equal(s.card?.title, 'SCENE TWO.')
  P.card()

  // The Boards: BARD holds the shaft's doorway shut until it falls, to the blade and from all three of its pieces.
  assert.equal(Z.tileAt(s.map, 13, 9), 'X')
  // (A hero who leaves by the trapdoor stair mid-fight finds it as wounded as he left it, and starts over only by dying.)
  fightBard(Z, s, P, { until: e => e.hp <= 6 })
  const bardHp = s.map.enemies.find(e => e.kind === 'bard').hp
  assert.ok(bardHp <= 6 && bardHp > 0, `BARD is hurt: ${bardHp}`)
  P.warpBy({ x: -1, y: 0 }, 'actdoors')
  P.warpBy({ x: 1, y: 0 }, 'actbard')
  assert.equal(s.map.enemies.find(e => e.kind === 'bard').hp, bardHp, 'BARD keeps its wounds across the stair')
  P.card()
  P.settle()
  const bard = fightBard(Z, s, P)
  assert.ok(Z.has(s, 'actthree.bard') && P.heard.some(l => /EVERY PART/.test(l)), 'BARD is heard of, and falls')
  assert.ok(bard.openings >= 1, `it still has openings to give: ${bard.openings}`)
  P.idle(60)
  assert.deepEqual([Z.tileAt(s.map, 13, 8), Z.tileAt(s.map, 13, 9)], ['.', '.'], 'its fall opens the gate')
  // Up to the ledge by its ladder, through the doorway, and up.
  if (P.feet() < 11) P.walk(10.5)
  else { P.walk(9.5)
  P.climb(-1, 10) }
  P.walk(14.5)
  P.warpBy({ x: 0, y: -1 }, 'actflats')

  // Halfway: the tab reloads, and the climb goes on from the last stair, with everything as it was.
  s = reload(s)
  P = climber(s)
  P.idle(30)
  assert.deepEqual([s.map.id, s.entry.entry], ['actflats', 'foot'])
  assert.ok(Z.has(s, 'item:lens') && Z.keyCount(s) === 1)

  // The Flats: the painted step is air, the real one is beside it.
  P.fell(s.map.enemies.find(e => e.kind === 'sentry'), 6.4)
  P.fell(s.map.enemies.find(e => e.kind === 'bat'), 6.4)
  P.walk(3.2)
  P.jump(4.9, 10, 'onto the painted step: down to the floor again')
  P.walk(6.3)
  P.jump(7.9, 8, 'the real step')
  P.jump(7.6, 6, 'up among the chests')
  // A painted chest opens to nothing, and is gone for the visit.
  const had = { bits: s.inv.bits, keys: Z.keyCount(s) }
  P.walk(7.5)
  P.events.length = 0
  P.use(-1)
  assert.ok(P.events.some(e => e.type === 'puff') && s.map.lensGone.length === 1 && s.mode === 'play', `the painted chest puffs: ${P.where()}`)
  assert.deepEqual({ bits: s.inv.bits, keys: Z.keyCount(s) }, had)
  P.idle(20)
  P.walk(4.5)
  P.open('actthree.key2', -1)
  assert.equal(Z.keyCount(s), 2)
  P.jump(4.5, 4, 'up to the doors')
  P.walk(1.7)
  P.warpBy({ x: -1, y: 0 }, 'actwings')

  // The Wings: what the glass shows is solid, and stays faintly drawn; the heart piece at the top of it.
  // Not there until shown: air underfoot, and nothing for A to use.
  assert.deepEqual([Z.tileAt(s.map, 5, 8), Z.tileAt(s.map, 6, 3)], ['.', '.'], 'hidden things are air before the glass')
  P.walk(7)
  P.fell(s.map.enemies.find(e => e.kind === 'bat'), 7)
  P.look()
  assert.deepEqual([Z.tileAt(s.map, 5, 8), Z.tileAt(s.map, 6, 3)], ['¯', '$'], 'shown, they are there')
  const info = Z.mapInfo(Z.WORLD, 'actwings')
  const hidden = Z.glassThings(info).filter(t => t.is === 'veil' || t.is === 'cache')
  assert.ok(hidden.length > 4 && hidden.every(t => s.map.lensSeen.includes(t.i)), 'all of it has been shown')
  P.walk(5.4)
  P.jump(5.1, 8, 'the first hidden ledge')
  P.walk(4.6)
  P.jump(2.4, 6, 'the second')
  P.walk(2.6)
  P.jump(4.7, 4, 'the third')
  P.walk(5.5)
  const pieces = s.inv.pieces
  P.open('actthree.heart', 1)
  assert.equal(s.inv.pieces, (pieces + 1) % 4, 'a piece of heart, by the glass alone')
  P.walk(3.5)
  P.until(() => P.standing() && Math.abs(P.feet() - 10) < 0.01, { x: 0, y: 0 })
  P.walk(11.4)
  P.unlock(12, 9)
  P.warpBy({ x: 1, y: 0 }, 'actloft')

  // The Fly Loft: the Grid's catwalks under their bags, the ladder, and the Leg east to the second locked door.
  assert.equal(s.card?.title, 'SCENE THREE.')
  P.card()
  assert.equal(s.entry.entry, 'rope')
  for (const bat of s.map.enemies.filter(e => e.kind === 'bat' && e.home.y > 16)) P.fell(bat, 8)
  P.walk(8)
  P.across(8, 20, 'up onto the first catwalk')
  P.hurry(4.4)
  P.across(2.2, 18, 'to the west step')
  P.walk(2.6)
  P.across(4.6, 16, 'onto the second catwalk')
  P.hurry(8)
  P.hurry(10.5)
  P.across(12.6, 14, 'to the east step')
  P.walk(12.4)
  P.across(10.2, 12, 'onto the third catwalk')
  P.hurry(5.5)
  P.climb(-1, 8)
  P.walk(5.8)
  P.hurry(9.5)
  P.across(11.6, 8, 'over the sign', 1.6)
  assert.equal(Z.keyCount(s), 1)
  P.unlock(13, 7)
  assert.equal(Z.keyCount(s), 0)
  P.warpBy({ x: 1, y: 0 }, 'actstudy')

  // The Dressing Room: the understudy, and the great key it leaves in its chest.
  assert.ok(!Z.hasBigKey(s) && Z.tileAt(s.map, 13, 9) === '.')
  const under = fightUnderstudy(Z, s, P)
  assert.ok(under.openings >= 3 && under.ends.every(p => Math.abs(p.feet - 10) < 0.01), `its charges end on the floor: ${JSON.stringify(under.ends)}`)
  P.idle(40)
  P.walk(12.2)
  P.open('actthree.bigkey', 1)
  assert.ok(Z.hasBigKey(s))
  P.walk(2.4)
  P.warpBy({ x: -1, y: 0 }, 'actloft')

  // Back along the Leg to the great door.
  assert.equal(s.entry.entry, 'fromstudy')
  // (Wait in the doorway, out from under the bags, then go in one run.)
  awaitBags(Z, s, P, 9.5, 2)
  P.walk(12.2)
  P.jump(9.5, 8, 'back over the sign')
  P.hurry(5.9)
  awaitBags(Z, s, P, 2, 1.2)
  P.unlock(2, 7, -1)
  P.hurry(1.6)
  P.warpBy({ x: -1, y: 0 }, 'actcable')

  // The Cable: clamp by clamp over the fog, with one painted clamp trusted on the way.
  assert.equal(s.card?.title, 'SCENE FOUR.')
  P.card()
  P.walk(8.4)
  P.jump(9.4, 20, 'the first clamp')
  P.walk(8.7)
  P.jump(5.8, 18, 'the second')
  P.walk(6.4)
  P.jump(9, 16, 'the third, the real one of two')
  P.walk(8.4)
  P.jump(5.8, 14, 'the fourth')
  P.walk(6.4)
  P.jump(9, 12, 'the fifth')
  // The painted one: down into the fog, half a heart, and back onto the last safe clamp.
  P.walk(9.6)
  const hp = s.hero.hp
  P.events.length = 0
  P.step({ move: { x: 1, y: 0 }, bPress: true, jumpPress: true, jumpHeld: true })
  for (let i = 0; i < 300 && !P.events.some(e => e.type === 'fall'); i++) P.step({ move: { x: s.hero.x < 13.4 ? 1 : 0, y: 0 }, jumpHeld: true })
  assert.ok(P.events.some(e => e.type === 'fall'), `the painted clamp bears nothing: ${P.where()}`)
  P.until(() => P.standing(), { x: 0, y: 0 })
  P.idle(60)
  assert.deepEqual([s.hero.hp, Math.round(P.feet())], [hp - 1, 12])
  P.walk(8.5)
  P.jump(5.2, 10, 'the sixth, the real one')
  P.walk(6.4)
  P.jump(9, 8, 'the seventh')
  P.walk(8.5)
  P.jump(5.2, 6, 'the eighth')
  P.walk(5.5)
  P.jump(5.8, 4, 'the top')
  P.walk(6.4)
  P.jump(8.6, 4, 'over the sign')
  P.warpBy({ x: 1, y: 0 }, 'actgondola')

  // The gondola: the boss's card, three of it, the way out shut and the way back open.
  P.idle(10)
  P.settle()
  assert.ok(P.heard.some(l => /QUITE SURE/.test(l)))
  assert.deepEqual([s.entry.entry, Z.tileAt(s.map, 13, 10), Z.tileAt(s.map, 13, 11), Z.halluBodies(s.map).length], ['stair', 'X', 'X', 3])
  // THE HALLUCINATOR, with the glass he climbed here with: it falls to the blade, in its openings only.
  // Cut to half, the hero steps out by the stair and comes back: all three bodies stand as wounded as it was left, in the second half; a death starts it over.
  fightHallucinator(Z, s, P, { way: 'glass', react: 0.4, until: e => e.hp <= 6 })
  const hurt = Z.halluBodies(s.map)[0].hp
  assert.ok(hurt <= 6 && hurt > 0, `the Hallucinator is hurt: ${hurt}`)
  P.warpBy({ x: -1, y: 0 }, 'actcable')
  P.card()
  P.warpBy({ x: 1, y: 0 }, 'actgondola')
  P.settle()
  assert.deepEqual(Z.halluBodies(s.map).map(e => e.hp), [hurt, hurt, hurt], 'wounded as it was left, all three')
  P.idle(10)
  assert.ok(Z.halluBodies(s.map)[0].ai.phase === 2 && Z.halluBodies(s.map)[0].ai.mode !== 'idle', 'in its second half, the fight begun again')
  Z.hurtHero(Z.ctx(Z.WORLD, s, []), 99, s.hero.x - 1, s.hero.y)
  for (let i = 0; i < 400 && s.mode !== 'play'; i++) Z.stepGame(Z.WORLD, s, 1 / 60, Z.NO_INPUT)
  assert.deepEqual([s.map.id, Z.halluBodies(s.map).map(e => e.hp)], ['actgondola', [10, 10, 10]], 'a death starts the fight over')
  P.card()
  const won = fightHallucinator(Z, s, P, { way: 'glass', react: 0.4 })
  assert.ok(Z.has(s, 'hallucinator') && won.openings >= 3, `no opening gives more than four: ${won.openings}`)
  P.idle(10)
  P.settle()
  assert.ok(P.heard.some(l => /CRATES GO FLAT/.test(l)))
  assert.ok(Z.halluBodies(s.map).every(e => e.dead), 'all three go together')
  assert.deepEqual([Z.tileAt(s.map, 13, 10), Z.tileAt(s.map, 13, 11)], ['.', '.'], 'the way out opens')
  // (The Weight lies on the way out, at the east stair's side: a hero who walks on picks it up.)
  assert.ok(s.map.pickups.some(p => p.item === 'weightSources' && p.x > 10 && p.x < 12), 'the Weight lies where the way out crosses it')
  P.walk(11.5)
  P.settle()
  assert.ok(Z.has(s, 'item:weightSources') && P.heard.some(l => /STAMPED SOURCES/.test(l)), 'the Weight, in hand')

  // Out by the gondola's other stair, down at the gangway in the isometric land, and Vega.
  P.walk(12.4)
  P.warpBy({ x: 1, y: 0 }, 'fogstage')
  assert.equal(s.view, 'iso')
  s.flags['q.act.tape'] = true
  const vega = s.map.npcs.find(n => n.id === 'q.act.director')
  /** Walk to her side, face her and talk; the lines said. */
  const talk = () => {
    P.walkTo(Math.floor(vega.x) - 1, Math.floor(vega.y))
    for (let i = 0; i < 40; i++) P.step()
    P.step({ move: { x: 0.4, y: 0 } })
    P.heard.length = 0
    P.step({ aPress: true, a: true })
    assert.equal(s.mode, 'dialog', `Vega answers: ${P.where()}`)
    P.settle()
    return P.heard.join(' ')
  }
  const pieces2 = s.inv.pieces
  assert.match(talk(), /BROUGHT THE ENDING/)
  assert.ok(Z.has(s, 'q.act.done') && s.inv.pieces === (pieces2 + 1) % 4, 'her heart piece, once')
  assert.match(talk(), /SOURCES\. SO IT WAS WRITTEN DOWN.*PLACES, EVERYONE/)
  return s
}
