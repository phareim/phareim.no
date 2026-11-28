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
import { json, reload, play, use } from './zelda-plays/late-show.mjs'

let Z, font
before(async () => {
  Z = await load()
  use(Z)
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const out = createRequire(import.meta.url)('esbuild').buildSync({
    stdin: { contents: "export { wrapText } from './themes/base/pixel/font'; export { speakerOf } from './themes/zelda/render/hud'; export { subst, TOUCH_KEYS } from './themes/zelda/keys'", resolveDir: repo, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  font = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

const MAPS = ['showbooth', 'reel1958', 'reel1986', 'chase1986', 'reel2086', 'weaver']

describe('the Late Show', () => {
  it('is played from the door in the screen to the Sacred Weight, with a reload on the way', () => {
    // (Any seed: `LATESHOW_SEED=n` runs it on another.)
    const s = Z.createGame(Z.WORLD, { seed: Number(process.env.LATESHOW_SEED ?? 11), at: { map: 'rerun', entry: 'screen' } })
    Z.grant(s, 'sword')
    play(Z, s)
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
    assert.ok(still.s.mode === 'dying' && t > 5 && t < 15, `three hearts last some twelve seconds: ${still.s.mode} after ${t.toFixed(1)} s`)

    // Alive and cutting for a minute and a half: the hands come down, lie, lift, and nothing ends.
    const { s, P } = enter(false)
    let lifts = 0
    P.theWeaver({ secs: 90, stomps: false, watch: e => { if (e.ai.mode === 'lift' && e.ai.t > 0.79) lifts++ } })
    const e = P.weaver()
    assert.ok(lifts >= 8, `${lifts} lifts`)
    assert.deepEqual([e.dead, e.hp, e.ai.n, s.mode], [false, 12, 0, 'play'])
    assert.ok(![1, 2, 3].some(n => Z.has(s, `weaver.h${n}`)))

    // The floor is no safe place: the slam comes down to it, and no finger is struck from it by a held jump that
    // is as high as a jump goes (the second and the third are for the step before them).
    const floor = (n) => {
      const g = Z.createGame(Z.WORLD, { seed: 4, at: { map: 'weaver', entry: 'stair' } })
      Z.grant(g, 'sword')
      Z.grant(g, 'stomp')
      for (let k = 1; k <= n; k++) g.flags[`weaver.h${k}`] = true
      Z.enterMap(Z.WORLD, g, 'weaver', 'stair', [], { x: 2.5 + 3 * n, y: 21 - Z.HERO_R })
      const F = reelPlayer(Z, g)
      F.idle(10)
      F.settle()
      return { g, F, e: F.weaver() }
    }
    const hit = floor(1)
    const hp0 = hit.g.hero.hp
    for (let i = 0; i < 600 && hit.e.ai.mode !== 'rest'; i++) hit.F.step()
    assert.deepEqual([hit.e.ai.mode, hit.g.hero.hp], ['rest', hp0 - Z.WEAVER.dmg], 'the hand comes down on the floor under it')
    for (const n of [1, 2]) {
      // (The hand held at rest over a floor with no steps on it: nothing to stand on but the floor.)
      const { g, F, e } = floor(0)
      Object.assign(e.ai, { n, mode: 'rest', t: 99 })
      g.hero.x = 2.5 + 3 * n
      const struck = () => F.events.some(v => v.type === 'stomp' && v.on === 'finger')
      for (let i = 0; i < 60 * 12 && !struck(); i++) {
        g.hero.hp = g.hero.maxHp
        Object.assign(e.ai, { mode: 'rest', t: 99, sk: '', clk: 0 })
        const f = Z.weaverFinger(Z.mapInfo(Z.WORLD, 'weaver'), e)
        const air = !F.standing()
        F.step({
          move: { x: air ? Math.sign(f.x - g.hero.x) : 0, y: 0 },
          ...(!air ? { bPress: true, jumpPress: true, jumpHeld: true } : { jumpHeld: true, aPress: true, a: true }),
        })
      }
      assert.ok(!struck() && e.ai.n === n, `hand ${n + 1} is not put right from the floor`)
    }
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

    // The face, cut once in a yawn: the hero steps out by the stair and comes back, and it has the wound. A death
    // starts it over at the part reached (three hands, no wound).
    const face = Z.createGame(Z.WORLD, { seed: 9, at: { map: 'weaver', entry: 'stair' } })
    for (const k of [1, 2, 3]) face.flags[`weaver.h${k}`] = true
    Z.enterMap(Z.WORLD, face, 'weaver', 'stair', [])
    Z.grant(face, 'sword')
    Z.grant(face, 'stomp')
    const V = reelPlayer(Z, face)
    V.idle(10)
    V.settle()
    assert.equal(V.weaver().hp, 6, 'three hands right')
    V.theWeaver({ until: e => e.hp <= 3 })
    assert.equal(V.weaver().hp, 3, 'cut once in its yawn')
    Z.enterMap(Z.WORLD, face, 'showbooth', 'kdoor', [])
    V.idle(10)
    Z.enterMap(Z.WORLD, face, 'weaver', 'stair', [])
    V.idle(10)
    V.settle()
    assert.equal(V.weaver().hp, 3, 'it keeps its wound when the hero steps out and back')
    Z.hurtHero(Z.ctx(Z.WORLD, face, []), 99, face.hero.x - 1, face.hero.y)
    for (let i = 0; i < 200 && face.mode !== 'play'; i++) Z.stepGame(Z.WORLD, face, 1 / 60, Z.NO_INPUT)
    V.idle(10)
    V.settle()
    assert.equal(V.weaver().hp, 6, 'a death starts the face over: the hands stay, the wound does not')
  })

  it('holds together: the validator, its keys and doors, the door in the screen, its words, and no way round the Stomp or the Usher', () => {
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
    // The heart piece under the cracked top is not reached by a jump: from the floor, from the sign's right edge,
    // held or tapped, east or still, and then on foot.
    const store = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'reel1986', entry: 'lens' } })
    Z.grant(store, 'sword')
    const S = reelPlayer(Z, store)
    S.card()
    let deepest = 0
    for (const [x, feet] of [[3.0, 21], [3.5, 21], [3.9, 21], [4.3, 21], [4.6, 21], [2.7, 20], [3.2, 20]]) for (const hold of [true, false]) for (const dir of [1, 0.4, 0]) {
      Z.enterMap(Z.WORLD, store, 'reel1986', 'lens', [], { x, y: feet - Z.HERO_R })
      S.idle(10)
      S.step({ move: { x: dir, y: 0 }, bPress: true, jumpPress: true, jumpHeld: true })
      for (let i = 0; i < 240; i++) {
        store.hero.hp = store.hero.maxHp
        S.step({ move: { x: i < 90 ? dir : 1, y: 0 }, ...(hold && i < 40 ? { jumpHeld: true } : {}) })
        // In the nook: east of the wall that closes it and down on the block's top.
        if (store.hero.x > 5.5 && S.feet() > 18.5 && S.feet() < 19.1 && store.hero.x < 7.2) deepest++
      }
      S.step({ aPress: true, a: true })
    }
    assert.ok(!Z.has(store, 'chest:lateshow.piece') && deepest === 0, `the heart piece waits for the Stomp (${deepest})`)

    // The 2086 lens is not reached while the Usher lives: with the key in hand and the Snack Bar's gate shut behind
    // him, up from in front of the lock goes nowhere.
    const snack = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'showbooth', entry: 'lens2' } })
    Z.grant(snack, 'sword')
    Z.grant(snack, 'smallKey')
    snack.flags['lateshow.copilot'] = true
    Z.enterMap(Z.WORLD, snack, 'showbooth', 'lens2', [], { x: 40.5, y: 4.5 })
    const U = reelPlayer(Z, snack)
    for (let i = 0; i < 240; i++) { snack.hero.hp = snack.hero.maxHp; U.step({ move: { x: 0, y: -1 } }) }
    assert.deepEqual([snack.map.id, Z.keyCount(snack), Z.tileAt(snack.map, 40, 2), Z.tileAt(snack.map, 40, 3)], ['showbooth', 1, 'L', 'X'], 'the lock waits for the Usher')

    const booth = Z.createGame(Z.WORLD, { seed: 1, at: { map: 'showbooth', entry: 'door' } })
    assert.match(Z.itemText(booth, 'bigKey')[0], /LAST REEL/)
    for (const item of ['stomp', 'bigKey']) for (const l of Z.itemText(booth, item)) assert.ok(font.wrapText(font.subst(l, font.TOUCH_KEYS), 180).length <= 3, l)
  })
})
