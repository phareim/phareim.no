// THE LATE SHOW: the play from its door to its Weight, on a game it did not make. `tests/zelda-lateshow.test.mjs` plays it on
// the game it makes; `tests/zelda-whole-game.test.mjs` plays it with the one hero who goes through everything.
import assert from 'node:assert/strict'
import { reelPlayer } from '../zelda-reel.mjs'

let Z
/** The engine the helpers here play on. */
export function use(engine) { Z = engine }

export const json = x => JSON.parse(JSON.stringify(x))
/** The tab reloaded: the save as it is stored, and the game begun where a page load begins it (`loadSpot`). */
export function reload(s) {
  const save = Z.parseSave(json({ ...Z.toSave(s), savedAt: 1 }))
  return Z.createGame(Z.WORLD, { save, at: Z.loadSpot(Z.WORLD, save, null, Z.awayMap(Z.WORLD, save.map, save.entry)) })
}

/** From the door in the drive-in's screen to the Weight, with a reload on the way. Returns the game as it ends (a reload on the way makes a new one). */
export function play(engine, g, opts = {}) {
  use(engine)
  let s = g
  let P = reelPlayer(Z, s)
  const pieces0 = s.inv.pieces

  // Through the door in the middle of the screen: the Scaffold, its line once, and on into the booth.
  P.warpBy({ x: 1, y: 0 }, 'showbooth')
  P.settle()
  assert.ok(Z.has(s, 'lateshow.seen'), 'the back of the screen has been looked at')
  assert.ok(P.heard.some(l => /SKY IS PAINTED/.test(l)))
  P.walkTo(15, 5)
  P.walkTo(20, 3)
  assert.equal(s.zoneIndex, 1, `the booth: ${P.where()}`)

  // Up into the 1958 lens: Main Street, under its card.
  P.warpBy({ x: 0, y: -1 }, 'reel1958')
  assert.equal(s.card?.title, '1958.', 'the intertitle stands')
  P.card()

  P.mainStreetEast()
  assert.equal(Z.keyCount(s), 1, `the key off the shop roof: ${P.where()}`)
  P.backlotToStomp()
  assert.ok(s.inv.stomp, `the Stomp off the alcove ledge: ${P.where()}`)
  // The first lessons, taken where it was found: the blob below, then the cracked floor to the west.
  P.stompTheBlob()
  P.stompTheFloor()
  assert.ok(Z.has(s, 'chest:lateshow.nook'), `the chest under the floor: ${P.where()}`)
  P.backlotWest()
  P.mainStreetWest()
  assert.equal(s.map.id, 'showbooth', P.where())
  assert.equal(s.entry.entry, 'lens1')

  // The locked lens opens to the hero's own bump, and 1986 lies behind it. The Snack Bar is shut.
  assert.equal(Z.tileAt(s.map, 31, 5), 'X', 'the Snack Bar waits for the next feature')
  P.walkTo(27, 3)
  P.until(() => Z.tileAt(s.map, 27, 2) === '.', { x: 0, y: -1 })
  assert.equal(Z.keyCount(s), 0)
  P.warpBy({ x: 0, y: -1 }, 'reel1986')
  assert.equal(s.card?.title, '1986.')
  P.card()

  // The Video Store: both pads, the heart piece, and the door on the balcony to the Road.
  P.videoStore()
  assert.equal(s.inv.pieces, (pieces0 + 1) % 4, 'the heart piece')
  assert.equal(s.card?.title, 'MEANWHILE...')
  P.card()
  // The screen holds still while COPILOT is named, and starts a moment after.
  P.idle(2)
  assert.deepEqual([s.mode, s.dialog?.lines[0]], ['dialog', 'COPILOT. ONE OF THEM IS DRIVING.'])
  P.idle(120)
  assert.equal(s.map.chase.left, 0, 'nothing moves under the words')
  P.settle()
  // COPILOT, by the blade alone; and all along, its bar is gold exactly while the blade bites.
  const seen = new Set()
  P.theRoad({
    watch(car, i) {
      if (car.dead || car.ai.mode === 'idle' || (seen.has(car.ai.mode) && i % 5)) return
      seen.add(car.ai.mode)
      const copy = structuredClone(s)
      const e = copy.map.enemies.find(o => o.id === car.id)
      const bites = src => { e.invuln = 0; const hp = e.hp; Z.hitEnemy(Z.ctx(Z.WORLD, copy, []), e, 1, e.x - 2, e.y, src); return e.hp < hp || e.dead }
      assert.equal(bites('sword'), Z.bossOpen(car), `COPILOT ${car.ai.mode}: the bar and the blade differ`)
      // One stomp a stall: a second rings off.
      if (car.ai.mode === 'stall' && e.hp > 6) assert.deepEqual([bites('stomp'), bites('stomp')], [!car.ai.stomped, false])
    },
  })
  assert.deepEqual([...seen].sort(), ['back', 'behind', 'honk', 'leave', 'pass', 'rev', 'stall'])
  assert.deepEqual([s.map.id, s.entry.entry, Z.keyCount(s)], ['showbooth', 'lens2', 1])

  // Halfway: the tab reloads, and the booth is where it comes back, with everything done as it was.
  s = reload(s)
  P = reelPlayer(Z, s)
  P.idle(30)
  assert.deepEqual([s.map.id, s.entry.entry], ['showbooth', 'lens2'])
  assert.ok(s.inv.stomp && Z.keyCount(s) === 1 && Z.has(s, 'lateshow.copilot'))

  // COPILOT's fall has opened the gate. The Snack Bar's own shuts behind him until the Usher is down.
  assert.equal(Z.tileAt(s.map, 31, 5), '.', 'the gate is open')
  P.walkTo(35, 5)
  P.idle(10)
  P.settle()
  assert.ok(P.heard.some(l => /SEATS ARE ASSIGNED/.test(l)))
  P.idle(2)
  assert.equal(Z.tileAt(s.map, 32, 5), 'X', 'shut behind him')
  P.usher()
  assert.equal(Z.tileAt(s.map, 32, 5), '.', 'and open again')
  P.walkTo(40, 3)
  P.until(() => Z.tileAt(s.map, 40, 2) === '.', { x: 0, y: -1 })
  assert.equal(Z.keyCount(s), 0)
  P.warpBy({ x: 0, y: -1 }, 'reel2086')
  assert.equal(s.card?.title, '2086.')
  P.card()

  P.overgrownLot()
  assert.equal(Z.keyCount(s), 1, `the third key: ${P.where()}`)
  P.lastReel()
  assert.ok(Z.hasBigKey(s, 'lateshow'), 'the Big Key')
  assert.ok(P.heard.some(l => /THE LAST REEL!/.test(l)))
  assert.deepEqual([s.entry.entry, Z.keyCount(s)], ['lens3', 0])

  // The great door in the booth's south wall, and the stair under it.
  P.walkTo(23, 9)
  P.until(() => Z.tileAt(s.map, 23, 10) === '.', { x: 0, y: 1 })
  P.warpBy({ x: 0, y: 1 }, 'weaver')
  P.idle(10)
  P.settle()
  assert.ok(P.heard.some(l => /NEVER SEEN ONE/.test(l)))
  assert.deepEqual([s.map.id, s.entry.entry, s.mode], ['weaver', 'stair', 'play'])

  // THE UNCANNY WEAVER: three fingers, up the steps the hands leave, and two yawns of its face.
  const opened = []
  let was = ''
  P.theWeaver({ watch: e => { if (e.ai.mode !== was && (e.ai.mode === 'rest' || e.ai.mode === 'yawn')) opened.push(`${e.ai.mode} ${e.hp}`); was = e.ai.mode } })
  assert.deepEqual(opened, ['rest 12', 'rest 10', 'rest 8', 'yawn 6', 'yawn 3'], 'three hands and two yawns, none wasted')
  assert.ok(Z.has(s, 'weaver') && !Z.has(s, 'item:weightFingers'))
  P.takeTheWeight()
  assert.ok(P.heard.some(l => /NOBODY ASKED FOR ANOTHER/.test(l)), 'the room has its line')
  assert.ok(Z.hasWeight(s, 'weightFingers'), `the Weight in hand: ${P.where()}`)
  assert.ok(s.hero.hp > 0 && !s.card)
  return s
}
