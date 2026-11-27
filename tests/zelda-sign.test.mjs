// Neon Shrine, Relight the Sign (engine/puzzles/tubes.ts, world/tubes.ts, Lumenby's boards): the seven boards as
// data, the whole sign lit by a scripted hero turning tubes with A (an open end holding the gas back first), what it
// pays, and the blade and the disc turning only the tube they mean.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'

let Z
/** The tubes' data (`world/tubes.ts`), bundled on its own. */
let T
before(async () => {
  Z = await load()
  const out = createRequire(import.meta.url)('esbuild').buildSync({
    stdin: { contents: `export * from './world/tubes'`, resolveDir: new URL('../themes/zelda', import.meta.url).pathname, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  T = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const A = () => inp({ aPress: true, a: true })
const LETTERS = 'LUMENBY'

function lumenby(flags = {}) {
  const s = Z.createGame(Z.WORLD, { seed: 5, at: { map: 'lumenby', entry: 'camp' } })
  s.mode = 'play'
  s.dialog = null
  s.inv.sword = true
  // (The land's first-visit words have been read.)
  s.flags['realm:lumenby'] = true
  Object.assign(s.flags, flags)
  if (Object.keys(flags).length) Z.enterMap(Z.WORLD, s, 'lumenby', 'camp', [])
  s.mode = 'play'
  s.dialog = null
  for (const e of s.map.enemies) { e.dead = true; e.x = -9; e.y = -9 }
  const go = (i = inp(), n = 1) => { for (let k = 0; k < n; k++) Z.stepGame(Z.WORLD, s, 1 / 60, i) }
  return { s, go }
}
const info = () => Z.mapInfo(Z.WORLD, 'lumenby')
const boards = () => Z.puzzleInfo(info()).boards
/** The board whose socket lights `letter`. */
function boardOf(letter) {
  const p = Z.puzzleInfo(info())
  return p.boards.find(b => b.sockets.some(i => p.sockets.get(i)?.letter === letter))
}
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }

/** Turn every tube of board `b` back to how the map draws it, by A from a tile beside it, as a player would. */
function solveByHand(s, go, b, except = -1) {
  const base = info().base
  const w = s.map.w
  for (const i of b.tubes) {
    if (i === except || !T.turns(s.map.tiles[i])) continue
    let n = 0
    while (s.map.tiles[i] !== base[i] && n < 4) { s.map.tiles[i] = T.turnTube(s.map.tiles[i]); n++ }
    // Back as it was, then the same turns by hand.
    s.map.tiles[i] = T.turnTube(s.map.tiles[i], 4 - n)
    const x = i % w
    const y = Math.floor(i / w)
    const [dir, [dx, dy]] = Object.entries(DIRS).find(([, [dx, dy]]) => {
      const t = s.map.tiles[(y - dy) * w + (x - dx)]
      return t && !Z.TILE_INFO[t].solid && t !== '~' && t !== 'O'
    })
    for (let k = 0; k < n; k++) {
      s.hero.x = x - dx + 0.5
      s.hero.y = y - dy + 0.5
      s.hero.dir = dir
      s.hero.aim = undefined
      go()
      while (s.mode === 'dialog') { go(inp(), 18); go(A()) }
      go(A())
      go(inp(), 24)
      while (s.mode === 'dialog') { go(inp(), 18); go(A()) }
    }
    assert.equal(s.map.tiles[i], base[i], `tube ${x},${y} turned true by hand`)
  }
}

describe('Neon Shrine, Relight the Sign', () => {
  it('has seven boards in Lumenby, one a letter, each solved as the map draws it', () => {
    const p = Z.puzzleInfo(info())
    assert.equal(p.on, true)
    assert.equal(p.physical, false, 'tubes leave the combat as it was')
    assert.equal(boards().length, 7)
    const letters = []
    for (const b of boards()) {
      assert.ok(b.taps.length >= 1, 'a tap')
      assert.equal(b.sockets.length, 1, 'one socket')
      const so = p.sockets.get(b.sockets[0])
      letters.push(so.letter)
      assert.equal(so.flag, `q.lumenby.sign${LETTERS.indexOf(so.letter) + 1}`)
      assert.ok(Z.boardSolved(info().base, info().w, b), `the ${so.letter} board as drawn`)
      assert.ok(b.tubes.some(i => T.turns(info().base[i])), `the ${so.letter} board has tubes to turn`)
    }
    assert.deepEqual(letters.sort(), [...LETTERS].sort())
    // The sign on the hill reads the same flags, letter by letter.
    const lit = Z.WORLD.maps.lumenby.isoLandmarks.filter(l => /^quarry_letter_/.test(l.art)).map(l => [l.art, l.lit.flag])
    assert.deepEqual(lit, [...'lumenby'].map((ch, i) => [`quarry_letter_${ch}_off`, `q.lumenby.sign${i + 1}`]))
  })

  it('lights by hand from L to Y, says so, keeps what is lit, and pays: Gunn a heart piece, the vending unit twenty bits', () => {
    // Every board is out of true on arrival, the same way each time.
    const first = lumenby().s
    const { s } = lumenby()
    assert.deepEqual(s.map.tiles, first.map.tiles)
    for (const bd of boards()) assert.equal(Z.boardSolved(s.map.tiles, s.map.w, bd), false)
    const ev = []
    let said = []
    const go = (i, n = 1) => { for (let k = 0; k < n; k++) { ev.push(...Z.stepGame(Z.WORLD, s, 1 / 60, i ?? inp())); const line = s.mode === 'dialog' && s.dialog.lines.join(' '); if (line && !said.includes(line)) said.push(line) } }
    for (const [n, letter] of [...LETTERS].entries()) {
      const b = boardOf(letter)
      said = []
      if (letter === 'N') {
        // One capped end left turned away: the gas reaches the socket but hisses out there.
        const cap = b.tubes.find(i => [1, 2, 4, 8].includes(T.armsOf(info().base[i])))
        solveByHand(s, go, b, cap)
        if (s.map.tiles[cap] === info().base[cap]) s.map.tiles[cap] = T.turnTube(s.map.tiles[cap])
        s.map.version++
        go(inp(), 2)
        const gas = s.map.phys.gas
        assert.ok(gas.leaks.length > 0, 'an open end')
        assert.ok(gas.tubes.some(t => b.tubes.includes(t.idx)), 'the gas is in the line')
        assert.equal(gas.fed.includes(b.sockets[0]), false)
        assert.ok(!s.flags['q.lumenby.sign5'])
      }
      solveByHand(s, go, b)
      go(inp(), 2)
      assert.equal(s.flags[`q.lumenby.sign${n + 1}`], true, `the ${letter} lights`)
      assert.match(said.join(' '), new RegExp(`THE ${letter} ON THE HILL SIGN LIGHTS UP! \\(${n + 1}/7\\)`))
      while (s.mode === 'dialog') { go(inp(), 18); go(A()) }
      go(inp(), 40) // (a rested A talks and turns again)
    }
    assert.ok(ev.some(e => e.type === 'tube') && ev.some(e => e.type === 'secret'))
    assert.match(said.join(' '), /GUNN/, 'the last letter says where to go')
    // Turned away again, the gas stops short and the letter stays lit; walked in anew, every board lies as drawn.
    const L = boardOf('L')
    const i = L.tubes.find(j => T.turns(s.map.tiles[j]))
    s.map.tiles[i] = T.turnTube(s.map.tiles[i])
    s.map.version++
    go(inp(), 2)
    assert.equal(s.flags['q.lumenby.sign1'], true)
    Z.enterMap(Z.WORLD, s, 'lumenby', 'camp', [])
    go()
    for (const bd of boards()) assert.ok(s.map.phys.gas.fed.includes(bd.sockets[0]))
    // The pay.
    const P = walker(Z)
    const { pieces, bits } = s.inv
    P.talkTo(s, 'q.gunn')
    assert.equal(s.inv.pieces, (pieces + 1) % 4)
    assert.ok(s.flags['q.lumenby.sign.done'])
    P.talkTo(s, 'lumenby.vending')
    assert.equal(s.inv.bits, bits + 20)
  })

  it('turns only the tube faced with the blade, and the first one past the hero\'s feet with the disc', () => {
    // A room: a tap, a line of tubes east, a socket; tubes north-east and south-east of a hero facing floor.
    const rows = [
      '##########',
      '#...┌....#',
      '#.@.....##',
      '#...└....#',
      '#Θ─────Λ.#',
      '#........#',
      '##########',
    ]
    const W = {
      start: { map: 'room', entry: 'start' },
      maps: { room: { id: 'room', name: 'ROOM', kind: 'interior', track: 'indoor', rows, marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'right' } } } } },
    }
    const s = Z.createGame(W)
    s.mode = 'play'
    s.dialog = null
    s.inv.sword = true
    s.inv.disc = true
    const go = (i = inp(), n = 1) => { for (let k = 0; k < n; k++) Z.stepGame(W, s, 1 / 60, i) }
    const at = (x, y) => s.map.tiles[y * s.map.w + x]
    // (Out of true on arrival; set them as drawn.)
    for (let x = 2; x <= 6; x++) s.map.tiles[4 * s.map.w + x] = '─'
    s.map.tiles[1 * s.map.w + 4] = '┌'
    s.map.tiles[3 * s.map.w + 4] = '└'
    // The blade, faced at floor between two tubes: it swings and turns neither.
    s.hero.x = 3.5; s.hero.y = 2.5; s.hero.dir = 'right'; s.hero.aim = undefined
    go()
    go(A())
    go(inp(), 30)
    assert.equal(at(4, 1), '┌')
    assert.equal(at(4, 3), '└')
    // The disc thrown east along the line from on it: the tube underfoot stays, the next one turns.
    s.hero.x = 2.5; s.hero.y = 4.5; s.hero.dir = 'right'; s.hero.aim = undefined
    s.inv.selected = 'disc'
    go()
    go(inp({ bPress: true }))
    go(inp(), 90)
    assert.equal(at(2, 4), '─', 'the tube underfoot')
    assert.equal(at(3, 4), '│', 'the first one ahead')
    assert.equal(at(4, 4), '─', 'and only that one')
  })
})
