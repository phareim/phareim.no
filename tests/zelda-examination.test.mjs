// Neon Shrine, THE EXAMINATION (docs/games/neon-shrine-examination.md): the test behind the Puzzle Lab, played from
// its stair to the Weight by a scripted hero with the blade and what the dungeon gives; a hero who only stands in the
// Titan's hall; the smaller rules (the Duck in a save, a foe in a blow, Falcon's phase and its rise, the Weight under a stone); and the shape its maps must keep. At most four tests live here. `EXAM_LOG=1`:
// what each round and fight cost. `EXAM_SEED=n`: the play-through on another seed.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { load } from './zelda-load.mjs'
import { FPS, SEED, inp, ROOM, T, roomOf, tile, player, clearOfStamp, play, use } from './zelda-plays/examination.mjs'

let Z
before(async () => { Z = await load(); use(Z) })

/** The dungeon's painter, bundled for node (its layout of the Titan's cards is pure). */
async function painter() {
  const out = createRequire(import.meta.url)('esbuild').buildSync({
    entryPoints: [new URL('../themes/zelda/render/examination.ts', import.meta.url).pathname], bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

/** A new hero with the blade at the stair in the Puzzle Lab's last room. */
function atTheLab(seed) {
  const s = Z.createGame(Z.WORLD, { seed, at: { map: 'puzzlelab', entry: 'from-exam' } })
  s.inv.sword = true
  s.hero.maxHp = s.hero.hp = 30
  s.mode = 'play'
  s.dialog = null
  s.hero.auto = null
  return s
}

/** A hero in the Perch, come in from round four's side (Falcon on its perch, both doors to shut). */
function atThePerch() {
  const s = Z.createGame(Z.WORLD, { seed: SEED, at: { map: 'examination', entry: 'r4' } })
  s.inv.sword = true
  s.hero.maxHp = s.hero.hp = 30
  s.mode = 'play'
  s.dialog = null
  s.hero.auto = null
  const p = player(s)
  p.step()
  p.walk('r4', 14, 5)
  for (let k = 0; k < 200 && s.mode !== 'dialog'; k++) p.step(inp({ move: s.mode === 'play' ? { x: 1, y: 0 } : { x: 0, y: 0 } }))
  assert.equal(roomOf(s), 'perch')
  p.settle()
  return p
}

/**
 * The Titan at half its hit points aims its band at a hero who stands still, and the hero is `late` s slow to answer
 * (a thumb's reaction), with a pot in hand or not. Out of the band by the time it lands? The blows he took.
 */
function bandAnswered(late, pot) {
  const s = Z.createGame(Z.WORLD, { seed: SEED, at: { map: 'examtop', entry: 'stair' } })
  s.inv.sword = true
  s.hero.maxHp = s.hero.hp = 30
  const p = player(s)
  p.step()
  p.settle()
  const t = s.map.enemies.find(e => e.kind === 'titan')
  t.hp = Z.TITAN.half - 1
  s.hero.x = 8.5
  s.hero.y = 6.5
  if (pot) { s.hero.carry = 'pot'; s.hero.act = 'carry' }
  for (let k = 0; k < 20 * FPS && t.ai.mode !== 'tell'; k++) p.step()
  assert.equal(t.ai.mode, 'tell')
  assert.equal(t.ai.whole, Z.TITAN.tell2)
  assert.equal(Z.stencilsOf(t).length, 2, 'the band: two squares')
  const to = clearOfStamp(p, t)
  p.wait(late)
  for (let k = 0; k < 4 * FPS && t.ai.mode !== 'rest'; k++) {
    if (Math.hypot(s.hero.x - to.x, s.hero.y - to.y) < 0.12) p.step()
    else p.toward(to.x, to.y)
  }
  assert.equal(t.ai.mode, 'rest', 'both squares have landed')
  return p.hurts
}

// ================================================================================================================

describe('the Examination', () => {
  it('is sat from the stair in the Puzzle Lab to the Weight in hand with the blade and what the dungeon gives', () => {
    play(Z, atTheLab(SEED))
  })

  it('beats a hero who only stands in the Titan\'s hall, by its stamps', async () => {
    const s = Z.createGame(Z.WORLD, { seed: SEED, at: { map: 'examtop', entry: 'stair' } })
    s.inv.sword = true
    let stamps = 0
    let struck = 0
    // It walks out of its home from its first walk (nothing of the hall stands on its body).
    const t0 = s.map.enemies.find(e => e.kind === 'titan')
    const home = { x: t0.x, y: t0.y }
    let moved = 0
    for (let k = 0; k < 90 * FPS && s.mode !== 'dying'; k++) {
      if (k < 8 * FPS) moved = Math.max(moved, Math.hypot(t0.x - home.x, t0.y - home.y))
      const ev = Z.stepGame(Z.WORLD, s, 1 / FPS, inp({ aPress: s.mode === 'dialog' && k % 20 === 19 }))
      const boom = ev.some(e => e.type === 'boom')
      if (boom) stamps++
      if (boom && ev.some(e => e.type === 'hurt')) struck++
    }
    assert.ok(moved > 1, `the Titan walked ${moved.toFixed(2)} tiles from its home in its first walk`)
    assert.equal(s.mode, 'dying', `stood through ${stamps} stamps at ${s.hero.hp} hp`)
    assert.equal(struck, s.hero.maxHp / 2, 'every half heart gone to a stamp')
    // The retry: back at the stair with the Titan whole and its first two cards.
    Z.respawn(Z.WORLD, s)
    const t = s.map.enemies.find(e => e.kind === 'titan')
    assert.deepEqual([s.map.id, t.hp, t.ai.picA, t.dead], ['examtop', 15, undefined, false])
    // At half its hit points the band's tell is 0.8 s: a hero 0.3 s slow to answer is out of it still, with a pot in
    // hand (4.2 tiles a second) as without.
    assert.equal(bandAnswered(0.3, false), 0, 'out of the band, 0.3 s late')
    assert.equal(bandAnswered(0.3, true), 0, 'and with a pot in hand')
    // Its two cards never lie on it, nor on each other: over its head or either side, on a wide screen and a phone,
    // with it in the middle, at each edge and half off the screen, hung afresh or held from where they last were.
    const { titanBox, titanCardBoxes } = await painter()
    const meet = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
    const covered = []
    for (const area of [{ vw: 320, vh: 200 }, { vw: 195, vh: 422, pads: { w: 128, h: 82 } }]) {
      const screen = { top: 0, left: 0, right: 0, bottom: 0, ...area }
      const { vw, vh } = screen
      let was
      for (const [x, y] of [[vw / 2, vh / 2], [vw / 2, 66], [vw / 2, vh - 8], [20, vh / 2], [vw - 20, vh / 2], [vw - 40, 80], [-30, vh / 2]]) {
        const boxes = titanCardBoxes({ x, y }, { x: vw / 2, y: vh / 2 + 40 }, 1, screen, was)
        was = boxes.map(b => ({ x: b.x - x, y: b.y - y }))
        const body = titanBox({ x, y }, 1)
        if (boxes.some(b => meet(b, body) || b.x < 0 || b.y < 0 || b.x + b.w > vw || b.y + b.h > vh) || meet(...boxes)) covered.push({ vw, x, y, boxes })
      }
    }
    assert.deepEqual(covered, [])
  })

  it('keeps the smaller rules: the Duck is never saved nor draws a foe out of a blow, Falcon follows its hit points and rises, a stone never buries the Weight', () => {
    const s = Z.createGame(Z.WORLD, { seed: SEED, at: { map: 'examination', entry: 'desk' } })
    s.inv.sword = true
    Z.grant(s, 'duck')
    const p = player(s)
    p.step()
    p.step(inp({ bPress: true }))
    p.step()
    assert.ok(s.duck)
    const saved = JSON.parse(JSON.stringify(Z.toSave(s)))
    assert.ok(!('duck' in saved))
    const read = Z.parseSave(saved)
    assert.deepEqual([read.inv.duck, read.inv.selected], [true, 'duck'])
    const back = Z.createGame(Z.WORLD, { save: read, seed: SEED })
    assert.deepEqual([back.duck, back.inv.duck, back.inv.selected], [undefined, true, 'duck'])
    // A save from before the Duck loads without it.
    const old = JSON.parse(JSON.stringify(saved))
    delete old.inv.duck
    old.inv.selected = null
    assert.equal(Z.parseSave(old).inv.duck, false)

    // A foe in the middle of a blow is not drawn off it by the Duck, and none is left in one when a look ends.
    const r1 = Z.createGame(Z.WORLD, { seed: SEED, at: { map: 'examination', entry: 'r1' } })
    r1.inv.sword = true
    r1.hero.maxHp = r1.hero.hp = 30
    Z.grant(r1, 'duck')
    const q = player(r1)
    q.step()
    const foes = r1.map.enemies.filter(e => e.cell === r1.zoneIndex)
    const dasher = foes.find(e => e.kind === 'dasher')
    const guard = foes.find(e => e.kind === 'sentry')
    dasher.ai.mode = 'dash'
    dasher.ai.t = 1
    guard.ai.mode = 'alert'
    guard.ai.t = 0.45
    guard.ai.tell = 0.45
    r1.duck = { x: T('r1', 9, 8)[0] + 0.5, y: T('r1', 9, 8)[1] + 0.5 }
    q.step()
    assert.deepEqual([dasher.ai.lure, guard.ai.lure], [undefined, undefined], 'neither is lured out of its blow')
    assert.ok(dasher.ai.mode === 'dash' && guard.ai.mode === 'alert', 'both go on with it')
    // Calm again, the dasher looks. Then, in a blow somehow, it is never left in it: the look ends and it is calm.
    for (let k = 0; k < 600 && dasher.ai.lure === undefined; k++) q.step()
    assert.ok(dasher.ai.lure !== undefined, 'a calm dasher looks at the Duck')
    dasher.ai.mode = 'dash'
    dasher.ai.t = 1
    delete r1.duck
    q.step()
    assert.ok(dasher.ai.mode !== 'dash' && dasher.ai.tell === 0, `it does not dash on from a look (${dasher.ai.mode})`)
    for (let k = 0; k < 20; k++) q.step()
    assert.notEqual(dasher.ai.mode, 'dash')

    // Round four's HAND IN pad is never buried, and no block rests in a doorway: a push at either is refused.
    const r4 = Z.createGame(Z.WORLD, { seed: SEED, at: { map: 'examination', entry: 'r4' } })
    r4.inv.sword = true
    r4.hero.maxHp = r4.hero.hp = 30
    r4.flags['exam.r4'] = true
    const w4 = player(r4)
    w4.step()
    w4.step()
    assert.equal(tile(r4, ...T('r4', 0, 6)), '.', 'the west door is open')
    for (const [row, left, at] of [[3, 3, 2], [6, 3, 1]]) {
      const [bx, by] = T('r4', left, row)
      r4.map.tiles[by * r4.map.w + bx] = 'b'
      w4.walk('r4', left + 1, row)
      for (let k = 0; k < 150; k++) w4.step(inp({ move: { x: -1, y: 0 } }))
      assert.equal(tile(r4, ...T('r4', at, row)), 'b', `the block stops at ${at},${row}`)
      assert.notEqual(tile(r4, ...T('r4', at - 1, row)), 'b', 'and does not go on onto the pad or into the doorway')
      r4.map.tiles[by * r4.map.w + T('r4', at, row)[0]] = '.'
    }

    // FALCON: shut in the Perch on both sides, back in its second phase at its hit points, and it gathers itself
    // (harmless, shut to blows) between the sand and the air.
    const pp = atThePerch()
    const ps = pp.s
    pp.wait(1)
    for (const [x, y] of [[0, 5], [0, 6], [15, 5], [15, 6]]) assert.equal(tile(ps, ...T('perch', x, y)), 'X', `shut at ${x},${y}`)
    ps.hero.x = T('perch', 14, 5)[0] + 0.5
    ps.hero.y = T('perch', 14, 5)[1] + 0.5
    for (let k = 0; k < 90; k++) pp.step(inp({ move: { x: 1, y: 0 } }))
    assert.equal(roomOf(ps), 'perch', 'no way out by the east door while it lives')
    const f = ps.map.enemies.find(e => e.kind === 'falcon')
    f.hp = 4
    for (let k = 0; k < 15 * FPS && f.ai.mode !== 'tell'; k++) pp.step()
    assert.deepEqual([f.ai.mode, f.ai.phase, f.ai.whole], ['tell', 2, Z.FALCON.tell2], 'wounded to 4, it aims as at half')
    for (let k = 0; k < 60 * FPS && f.ai.mode !== 'stuck'; k++) pp.step()
    assert.equal(f.ai.mode, 'stuck')
    for (let k = 0; k < 6 * FPS && f.ai.mode !== 'rise'; k++) pp.step()
    assert.equal(f.ai.mode, 'rise')
    assert.equal(Z.bossOpen(f), false, 'shut to blows as it rises')
    const hp = ps.hero.hp
    let rose = 0
    const away = { x: f.x > T('perch', 8, 0)[0] ? T('perch', 4, 6)[0] + 0.5 : T('perch', 11, 6)[0] + 0.5, y: T('perch', 4, 6)[1] + 0.5 }
    // (Standing in it all the while it rises, and gone from it as it takes off.)
    while (f.ai.mode === 'rise' && rose < 120) {
      const last = f.ai.t < 1.5 / FPS
      ps.hero.x = last ? away.x : f.x
      ps.hero.y = last ? away.y : f.y
      ps.hero.invuln = 0
      pp.step()
      rose++
    }
    assert.equal(ps.hero.hp, hp, 'its touch is harmless as it rises')
    assert.ok(Math.abs(rose / FPS - Z.FALCON.rise) < 0.1, `it rose ${rose} frames`)
    assert.equal(f.ai.mode, 'fly')

    // The Weight under a stone: a stone that comes to rest where it lies moves it to open floor, and it is taken.
    const hall = Z.createGame(Z.WORLD, { seed: SEED, at: { map: 'examtop', entry: 'stair' } })
    hall.inv.sword = true
    hall.hero.maxHp = hall.hero.hp = 30
    const h = player(hall)
    h.step()
    h.settle()
    hall.map.enemies.find(e => e.kind === 'titan').dead = true
    hall.flags['examination.titan'] = true
    const weight = hall.map.pickups.find(w => w.id === 'examination.weight')
    weight.x = 4.5
    weight.y = 10.5
    h.step()
    h.settle()
    hall.flags['examination.boulder.w'] = true
    h.wait(5)
    assert.equal(tile(hall, 4, 10), 'κ', 'the stone rests where the Weight lay')
    assert.ok(!Z.circleBlocked(Z.WORLD, hall.map, weight.x, weight.y, Z.HERO_R), `the Weight is on open floor at ${weight.x},${weight.y}`)
    for (let k = 0; k < 900 && !hall.flags['item:weightSurprise']; k++) { if (hall.mode === 'play') h.toward(weight.x, weight.y); else h.step() }
    assert.ok(hall.flags['item:weightSurprise'], 'and it can be taken')
  })

  it('keeps its shape: no key anywhere, every room reached in order, the stair in the Lab\'s last room', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD).filter(q => /examination|examtop|puzzlelab|stillsand/.test(q)), [])
    for (const id of ['examination', 'examtop']) {
      const def = Z.WORLD.maps[id]
      const info = Z.mapInfo(Z.WORLD, id)
      assert.deepEqual([def.kind, def.keyring, def.resume, def.away, def.realm], ['dungeon', 'examination', true, undefined, 'stillsand'])
      assert.ok(!info.base.includes('L') && !info.base.includes('K'), `${id} has a locked door`)
      assert.deepEqual(info.chestList.filter(c => c.item === 'smallKey' || c.item === 'bigKey'), [])
      assert.ok(Z.awayMap(Z.WORLD, id))
    }
    assert.deepEqual(Object.values(Z.WORLD.maps.examination.cells).map(c => c.name).sort(),
      ['ROUND FOUR', 'ROUND ONE', 'ROUND THREE', 'ROUND TWO', 'THE FRONT DESK', 'THE MARKING ROOM', 'THE PERCH', 'THE STAFF ROOM'])
    assert.deepEqual([Z.WORLD.maps.examtop.rows[0].length, Z.WORLD.maps.examtop.rows.length], [16, 12])
    assert.equal(Z.WORLD.maps.examination.cells['1,0'].homeBlocks, true, 'round four\'s block is home on every entry, a resit too')

    /** What the hero reaches from `from` with the gates in `opened` out of the way (water, walls and pits stay). */
    const reach = (id, from, opened = []) => {
      const info = Z.mapInfo(Z.WORLD, id)
      const gone = new Set(info.gates.filter(g => g.trap || opened.includes(g.open.flag ?? g.open.plates?.[0] ?? 'stair')).flatMap(g => g.tiles))
      const seen = new Set()
      const q = [Math.floor(from.y) * info.w + Math.floor(from.x)]
      while (q.length) {
        const i = q.pop()
        if (seen.has(i)) continue
        seen.add(i)
        const x = i % info.w
        for (const j of [x ? i - 1 : -1, x < info.w - 1 ? i + 1 : -1, i - info.w, i + info.w]) {
          if (j < 0 || j >= info.base.length) continue
          const t = info.base[j]
          // (A pot or a stone is lifted out of the way.)
          if (gone.has(j) || t === 'o' || t === 'r' || (!Z.TILE_INFO[t].solid && t !== 'O')) q.push(j)
        }
      }
      return { seen, rooms: [...new Set([...seen].map(i => Object.keys(ROOM).find(k => (i % info.w) - ROOM[k][0] >= 0 && (i % info.w) - ROOM[k][0] < 16 && Math.floor(i / info.w) - ROOM[k][1] >= 0 && Math.floor(i / info.w) - ROOM[k][1] < 12)))].sort() }
    }
    const desk = Z.mapInfo(Z.WORLD, 'examination').entries.desk
    // (The Perch's trap gate is open to the walk: it is shut only while Falcon lives, and the play-through fells it.)
    const order = [['exam.r1', 'r2'], ['exam.r2', 'staff'], ['exam.pond', 'r3'], ['exam.r3', 'perch', 'r4'], ['exam.r4', 'marking']]
    const opened = []
    const rooms = ['desk', 'r1']
    assert.deepEqual(reach('examination', desk).rooms, [...rooms].sort())
    for (const [open, ...more] of order) {
      opened.push(open)
      rooms.push(...more)
      assert.deepEqual(reach('examination', desk, opened).rooms, [...rooms].sort(), `past ${open}`)
    }
    // The stair to the hall is behind all four passes; the lever's gate is the short way down.
    const info = Z.mapInfo(Z.WORLD, 'examination')
    const stair = info.warps.find(w => w.to === 'examtop')
    const at = stair.y * info.w + stair.x
    assert.ok(!reach('examination', desk, opened).seen.has(at))
    assert.ok(reach('examination', desk, [...opened, 'stair']).seen.has(at))
    assert.ok(reach('examination', desk, ['examination.back']).rooms.includes('marking'))
    const hall = Z.mapInfo(Z.WORLD, 'examtop')
    const door = hall.warps.find(w => w.to === 'examination')
    assert.ok(reach('examtop', hall.entries.stair).seen.has(door.y * hall.w + door.x))
    // The door in the land: a stair in the Lab's last room, reached from the way into that room; no size changed.
    const lab = Z.mapInfo(Z.WORLD, 'puzzlelab')
    assert.deepEqual([lab.w, lab.h], [48, 24])
    const up = lab.warps.find(w => w.to === 'examination')
    assert.ok(up.x < 16 && up.y < 12, 'in the last room')
    assert.ok(reach('puzzlelab', { x: 15, y: 4 }).seen.has(up.y * lab.w + up.x))
  })
})
