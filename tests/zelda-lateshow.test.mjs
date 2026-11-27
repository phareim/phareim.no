// THE LATE SHOW (docs/worlds/atlas.md "The Late Show"; docs/games/neon-shrine.md "The Stomp"): a few end-to-end
// tests, four at the most (Petter, 2026-11-27). A scripted player goes from the door in the drive-in screen as far as
// the dungeon goes, pressing what a player presses; saves load where they should; and the maps hold together. The
// jump's reach in these rooms is measured by `scripts/zelda-lab/lateshow-measure.mjs`, not pinned here.
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

const MAPS = ['showbooth', 'reel1958', 'reel1986']
const json = x => JSON.parse(JSON.stringify(x))
/** The tab reloaded: the save as it is stored, and the game begun where a page load begins it (`loadSpot`). */
function reload(s) {
  const save = Z.parseSave(json({ ...Z.toSave(s), savedAt: 1 }))
  return Z.createGame(Z.WORLD, { save, at: Z.loadSpot(Z.WORLD, save, null, Z.awayMap(Z.WORLD, save.map, save.entry)) })
}

describe('the Late Show', () => {
  it('is played from the door in the screen to the lens of 1986, with a reload on the way', () => {
    let s = Z.createGame(Z.WORLD, { seed: 11, at: { map: 'rerun', entry: 'screen' } })
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

    // Halfway: the tab reloads, and the booth is where it comes back, with everything done as it was.
    s = reload(s)
    P = reelPlayer(Z, s)
    P.idle(30)
    assert.deepEqual([s.map.id, s.entry.entry], ['showbooth', 'lens1'])
    assert.ok(s.inv.stomp && Z.keyCount(s) === 1)

    // The locked lens opens to the hero's own bump, and 1986 lies behind it.
    P.walkTo(27, 3)
    P.until(() => Z.tileAt(s.map, 27, 2) === '.', { x: 0, y: -1 })
    assert.equal(Z.keyCount(s), 0)
    P.warpBy({ x: 0, y: -1 }, 'reel1986')
    assert.equal(s.entry.entry, 'lens')
    // Reel two is its floor and its way out so far.
    P.idle(30)
    P.warpBy({ x: -1, y: 0 }, 'showbooth')
    assert.equal(s.entry.entry, 'lens2')
    assert.equal(s.hero.hp > 0, true)
  })

  it('loads a save made in a reel at its lens, with the cards and the screen never in it', () => {
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
  })

  it('holds together: the validator, its keys and doors, the door in the screen, its words', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD).filter(p => /rerun|showbooth|reel/.test(p)), [])
    const defs = MAPS.map(id => Z.WORLD.maps[id])
    assert.ok(defs.every(d => d.keyring === 'lateshow' && d.resume && !d.away && d.realm === 'rerun'))

    // The ring: as many small keys as locked doors (a run of lock tiles is one door), no great lock yet.
    const count = { smallKey: 0, bigKey: 0, L: 0, K: 0 }
    for (const id of MAPS) {
      const info = Z.mapInfo(Z.WORLD, id)
      for (const c of info.chestList) if (c.item in count) count[c.item]++
      info.base.forEach((t, i) => { if ((t === 'L' || t === 'K') && info.base[i - 1] !== t && info.base[i - info.w] !== t) count[t]++ })
    }
    assert.deepEqual(count, { smallKey: 1, bigKey: 0, L: 1, K: 0 })

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
    for (const item of ['stomp']) for (const l of Z.itemText(s, item)) assert.ok(font.wrapText(font.subst(l, font.TOUCH_KEYS), 180).length <= 3, l)
  })
})
