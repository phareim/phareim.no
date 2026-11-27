// THE LATE SHOW (docs/worlds/atlas.md "The Late Show"; docs/games/neon-shrine.md "The Stomp"): a few end-to-end
// tests, four at the most (Petter, 2026-11-27). A scripted player goes from the door in the drive-in screen to the
// Sacred Weight, pressing what a player presses; the Weaver beats who stands still and cannot be beaten without the
// stomp; saves load where they should; and the maps hold together. The jump's reach in these rooms, and the fingers',
// are measured by `scripts/zelda-lab/lateshow-measure.mjs`, not pinned here.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'
import { reelPlayer } from './zelda-reel.mjs'

let Z, font
before(async () => {
  Z = await load()
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const out = createRequire(import.meta.url)('esbuild').buildSync({
    stdin: { contents: "export { wrapText } from './themes/base/pixel/font'; export { speakerOf } from './themes/zelda/render/hud'; export { subst, TOUCH_KEYS } from './themes/zelda/keys'", resolveDir: repo, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  font = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

const MAPS = ['showbooth', 'reel1958', 'reel1986', 'chase1986', 'reel2086', 'weaver']
const json = x => JSON.parse(JSON.stringify(x))
/** The tab reloaded: the save as it is stored, and the game begun where a page load begins it (`loadSpot`). */
function reload(s) {
  const save = Z.parseSave(json({ ...Z.toSave(s), savedAt: 1 }))
  return Z.createGame(Z.WORLD, { save, at: Z.loadSpot(Z.WORLD, save, null, Z.awayMap(Z.WORLD, save.map, save.entry)) })
}

describe('the Late Show', () => {
  it('is played from the door in the screen to the Sacred Weight, with a reload on the way', () => {
    // (Any seed: `LATESHOW_SEED=n` runs it on another.)
    let s = Z.createGame(Z.WORLD, { seed: Number(process.env.LATESHOW_SEED ?? 11), at: { map: 'rerun', entry: 'screen' } })
    Z.grant(s, 'sword')
    let P = reelPlayer(Z, s)

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
    assert.equal(s.inv.pieces, 1, 'the heart piece')
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
  })

  it('is lost by who stands still before the Weaver, and never won by who does not stomp', () => {
    const enter = (stomp) => {
      const s = Z.createGame(Z.WORLD, { seed: 4, at: { map: 'weaver', entry: 'stair' } })
      Z.grant(s, 'sword')
      if (stomp) Z.grant(s, 'stomp')
      const P = reelPlayer(Z, s)
      P.idle(10)
      P.settle()
      return { s, P }
    }
    const still = enter(true)
    let t = 0
    for (; still.s.mode === 'play' && t < 30; t += 1 / 60) Z.stepGame(Z.WORLD, still.s, 1 / 60, Z.NO_INPUT)
    assert.ok(still.s.mode === 'dying' && t > 8 && t < 15, `three hearts last some twelve seconds: ${still.s.mode} after ${t.toFixed(1)} s`)

    // Alive and cutting for a minute and a half: the hands come down, lie, lift, and nothing ends.
    const { s, P } = enter(false)
    let lifts = 0
    P.theWeaver({ secs: 90, stomps: false, watch: e => { if (e.ai.mode === 'lift' && e.ai.t > 0.79) lifts++ } })
    const e = P.weaver()
    assert.ok(lifts >= 8, `${lifts} lifts`)
    assert.deepEqual([e.dead, e.hp, e.ai.n, s.mode], [false, 12, 0, 'play'])
    assert.ok(![1, 2, 3].some(n => Z.has(s, `weaver.h${n}`)))
  })

  it('loads a save made in a reel at its lens and before the Weaver at the part reached, no card or screen in it', () => {
    const s = Z.createGame(Z.WORLD, { seed: 5, at: { map: 'reel1958', entry: 'lens' } })
    Z.grant(s, 'sword')
    assert.equal(s.card?.title, '1958.')
    assert.deepEqual(s.cardsSeen, ['reel1958:0'])
    const P = reelPlayer(Z, s)
    P.card()
    // A death goes back to the lens, and the card does not play again.
    Z.hurtHero(Z.ctx(Z.WORLD, s, []), 99, s.hero.x - 1, s.hero.y)
    for (let i = 0; i < 200 && s.mode !== 'play'; i++) Z.stepGame(Z.WORLD, s, 1 / 60, Z.NO_INPUT)
    assert.deepEqual([s.map.id, s.mode, s.card], ['reel1958', 'play', undefined])
    // A cracked floor broken in play (the hero set down beside it), and the save of all that.
    Z.grant(s, 'stomp')
    Z.enterMap(Z.WORLD, s, 'reel1958', 'lens', [], { x: 22.5, y: 21 - Z.HERO_R })
    P.idle(20)
    P.stompTheFloorFrom(22.5)
    const save = Z.toSave(s)
    assert.ok(!/card/i.test(JSON.stringify(save)), 'neither the card nor the list of cards shown is saved')
    const again = reload(s)
    assert.deepEqual([again.map.id, again.entry.entry, again.inv.stomp], ['reel1958', 'lens', true])
    assert.equal(again.card?.title, '1958.', 'a reload plays the card again')
    assert.equal(Z.tileAt(again.map, 22, 21), '.', 'the broken floor stays broken')
    // A save from before there was a Stomp loads without it.
    const old = json({ ...save, savedAt: 1 })
    delete old.inv.stomp
    old.flags = old.flags.filter(f => f !== 'item:stomp')
    const back = Z.createGame(Z.WORLD, { save: Z.parseSave(old) })
    assert.deepEqual([back.map.id, back.inv.stomp], ['reel1958', false])

    // A save made on the Road, the screen well under way, loads at the Road's start: the screen at rest there,
    // COPILOT whole, the cards neither saved nor spent.
    const road = Z.createGame(Z.WORLD, { seed: 9, at: { map: 'chase1986', entry: 'start' } })
    Z.grant(road, 'sword')
    const R = reelPlayer(Z, road)
    R.card()
    R.idle(2)
    R.settle()
    for (let i = 0; i < 200; i++) R.step({ move: { x: i < 160 ? 1 : 0, y: 0 } })
    assert.ok(road.map.chase.left > 1, 'the screen is moving')
    const mid = Z.toSave(road)
    assert.deepEqual([mid.map, mid.entry], ['chase1986', 'start'])
    assert.ok(!/"card"|"cardsSeen"|"chase"/.test(JSON.stringify(mid)), 'neither a card nor the screen is saved')
    const re = reload(road)
    assert.deepEqual([re.map.id, re.entry.entry, re.map.chase.left, re.card?.title], ['chase1986', 'start', 0, 'MEANWHILE...'])
    assert.deepEqual(re.map.enemies.map(e => [e.kind, e.hp]), [['copilot', 8]])
    assert.ok(Math.abs(re.hero.x - 3.5) < 0.01 && Z.tileAt(re.map, 1, 20) === 'D', 'at the start, the way back still there')
    // Left to the screen, he is carried, caught at the first wagon and put on a mark ahead, half a heart poorer.
    const W2 = reelPlayer(Z, re)
    W2.card()
    W2.idle(2)
    const hp = re.hero.hp
    for (let i = 0; i < 900 && re.hero.hp === hp; i++) W2.step()
    assert.equal(re.hero.hp, hp - 1)
    assert.ok(re.hero.x >= re.map.chase.left + Z.CHASE.ahead - 0.05, `put ahead of the screen: ${W2.where()}, screen at ${re.map.chase.left}`)

    // Two of the Weaver's hands put right in play, then a death: back at the stair with two ledges standing, the
    // boss four lighter and the third hand next. A reload there finds the same.
    const fight = Z.createGame(Z.WORLD, { seed: 9, at: { map: 'weaver', entry: 'stair' } })
    Z.grant(fight, 'sword')
    Z.grant(fight, 'stomp')
    const F = reelPlayer(Z, fight)
    F.idle(10)
    F.settle()
    F.theWeaver({ until: e => e.ai.n === 2 })
    const reached = (g, how) => {
      const P = reelPlayer(Z, g)
      P.idle(10)
      P.settle()
      const e = P.weaver()
      assert.deepEqual([g.map.id, g.entry.entry, e.hp, e.ai.n], ['weaver', 'stair', 8, 2], how)
      // Rows 20, 19 and 18: the two steps there, the third still air.
      assert.deepEqual([[2, 20], [4, 20], [5, 19], [7, 19], [8, 18]].map(([x, y]) => Z.tileAt(g.map, x, y) === '¯'), [true, true, true, true, false], how)
      for (let i = 0; i < 200 && e.ai.mode !== 'draw'; i++) P.step()
      assert.equal(Z.weaverFootprint(Z.mapInfo(Z.WORLD, 'weaver'), e.ai.n).x, 8, `${how}: the third hand is drawn`)
    }
    Z.hurtHero(Z.ctx(Z.WORLD, fight, []), 99, fight.hero.x - 1, fight.hero.y)
    for (let i = 0; i < 200 && fight.mode !== 'play'; i++) Z.stepGame(Z.WORLD, fight, 1 / 60, Z.NO_INPUT)
    reached(fight, 'after a death')
    reached(reload(fight), 'after a reload')
  })

  it('holds together: the validator, its keys and doors, the door in the screen, its words', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD).filter(p => /rerun|showbooth|reel|chase|weaver/.test(p)), [])
    const defs = MAPS.map(id => Z.WORLD.maps[id])
    assert.ok(defs.every(d => d.keyring === 'lateshow' && d.resume && !d.away && d.realm === 'rerun'))

    // The ring: as many small keys as locked doors (a run of lock tiles is one door), and one great lock and its key.
    const count = { smallKey: 0, bigKey: 0, L: 0, K: 0 }
    for (const id of MAPS) {
      const info = Z.mapInfo(Z.WORLD, id)
      for (const c of info.chestList) if (c.item in count) count[c.item]++
      info.base.forEach((t, i) => { if ((t === 'L' || t === 'K') && info.base[i - 1] !== t && info.base[i - info.w] !== t) count[t]++ })
    }
    assert.deepEqual(count, { smallKey: 3, bigKey: 1, L: 3, K: 1 })

    // The door in the middle of the screen: the land as big as it was, the tile open, and a way to it on foot.
    const land = Z.WORLD.maps.rerun
    assert.deepEqual([land.rows[0].length, land.rows.length], [80, 40])
    const s = Z.createGame(Z.WORLD, { seed: 1, at: { map: 'rerun', entry: 'drivein' } })
    assert.equal(Z.solidTile(Z.WORLD, s.map, 76, 10, 'hero'), false)
    assert.ok([8, 9, 11, 12].every(y => Z.solidTile(Z.WORLD, s.map, 76, y, 'hero')), 'the rest of the screen stands')
    assert.ok(walker(Z).path(s, 76, 10), 'reached on foot from the drive-in')
    for (const id of ['rerun', ...MAPS]) for (const w of Z.mapInfo(Z.WORLD, id).warps) assert.ok(Z.hasEntry(Z.WORLD, w.to, w.entry), `${id} → ${w.to}:${w.entry}`)

    // The words: in the font, three rows of the narrowest box at the most, a speaker named first.
    for (const d of defs) {
      const lines = [d.name]
      for (const c of Object.values(d.cells)) lines.push(c.name, ...(c.events ?? []).flatMap(e => e.lines), ...(c.card?.lines ?? []))
      for (const m of Object.values(d.marks)) {
        if (m.ent.t === 'sign') lines.push(...m.ent.lines)
        if (m.ent.t !== 'npc') continue
        for (const b of m.ent.talk) {
          lines.push(...b.lines)
          assert.ok(font.speakerOf(b.lines[0], m.ent.look), `${m.ent.id} opens without a name: ${b.lines[0]}`)
        }
      }
      for (const c of Object.values(d.cells)) if (c.card) assert.ok(c.card.title.length <= 12 && c.card.lines.every(l => l.length <= 27), c.card.title)
      for (const l of lines) {
        assert.match(l, /^[A-Z0-9ÆØÅ .,!?'":;\-()/]*$/, `not in the font: ${l}`)
        assert.ok(font.wrapText(l, 180).length <= 3, `more than three rows: ${l}`)
      }
    }
    const booth = Z.createGame(Z.WORLD, { seed: 1, at: { map: 'showbooth', entry: 'door' } })
    assert.match(Z.itemText(booth, 'bigKey')[0], /LAST REEL/)
    for (const item of ['stomp', 'bigKey']) for (const l of Z.itemText(booth, item)) assert.ok(font.wrapText(font.subst(l, font.TOUCH_KEYS), 180).length <= 3, l)
  })
})
