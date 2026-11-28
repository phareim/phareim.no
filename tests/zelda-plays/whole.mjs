// One hero, one save, through everything: the driver of `tests/zelda-whole-game.test.mjs`. A new game; at each
// dungeon's door in its land with what he has won and what the land or the first game gives (`DOORS`); the
// dungeon's own play (this folder); a closed tab between each. Then the Sun Prism (the only way to the Balance's
// lid), the Balance, the second ending and the walk home. The order of the seven is the caller's.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { walker } from '../zelda-walk.mjs'
import { prismRun } from '../zelda-prism-run.mjs'
import * as echoBarrow from './echo-barrow.mjs'
import * as lighthouse from './lighthouse.mjs'
import * as steamhouse from './steamhouse.mjs'
import * as examination from './examination.mjs'
import * as lateShow from './late-show.mjs'
import * as heap from './heap.mjs'
import * as actThree from './act-three.mjs'
import * as balance from './balance.mjs'

/** The engine, the world, and the few things the plays and the checks read beside them. */
export async function load() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'themes', 'zelda')
  const out = createRequire(import.meta.url)('esbuild').buildSync({
    stdin: {
      contents: `export * from './engine/index'; export { WORLD, INTRO } from './world/index'; export * from './types'; export { TILE_INFO } from './world/tiles'; export * from './progress';
        export { itemsPageContent, sockets, pickCell } from './render/itemsPage'; export { saveGameById } from '../leaderboard/games'; ${steamhouse.STEAM_EXPORTS}`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

/**
 * The seven, in the design's order (`docs/worlds/sacred-weights.md`). `door`: the entry the dungeon's own test starts
 * from. `grant`: exactly what that test hands its hero beyond a new game (`hearts` in half hearts, at least; `bombs`
 * a bag with so many, on B; `bits` on top of his own). `still`: the test starts in play, past any walk out of a door.
 * `first`: the first room inside. `by`: what the play itself writes into the game, said in the account. `seed`: the die the
 * dungeon's own test starts with. `unpractised`: why this door sets his combo counts aside (below).
 */
export const DOORS = [
  { key: 'echo', seed: 11, name: 'THE ECHO BARROW', play: echoBarrow.play, door: ['seterfell', 'mounds'], first: ['echobarrow', 'start'], maps: ['echobarrow'], weight: 'weightMeaning', boss: 'parrot', treasure: 'echo', still: true, grant: { hearts: 20 }, by: 'nothing hurts him on the way between fights, his hearts are filled before the Parrot, two tiles are written to stand him in Mixtral\'s gate, and he is cut down once in the Shield Hall on purpose' },
  { key: 'lighthouse', seed: 11, name: 'THE LIGHTHOUSE', play: lighthouse.play, door: ['yulefjord', 'lighthouse'], first: ['lighthouse1', 'door'], maps: ['lighthouse0', 'lighthouse1', 'lighthouse2', 'lighthouse3'], weight: 'weightReasons', boss: 'lighthouse.box', treasure: 'lamp', still: true, grant: { hearts: 20 }, by: 'nothing hurts him outside the fights, and the walker kills the bats of the Quarters and the draugs of the Gallery outright', unpractised: 'ORCA falls to a mastered TEMPEST before it ever drags, so the lamp has nothing to stop' },
  { key: 'steamhouse', seed: 3, name: 'THE STEAMHOUSE', play: steamhouse.play, door: ['sporelight', 'steamhouse'], first: ['steamhouse', 'door'], maps: ['steamhouse', 'steamsuite'], weight: 'weightNo', boss: 'sycophant', treasure: 'no', grant: { hearts: 30, bombs: 5, bits: 37 }, by: 'his hearts are written down (to 2 twice for the baths, and 1½ off before the Sycophant)' },
  { key: 'examination', seed: 9, name: 'THE EXAMINATION', play: examination.play, door: ['puzzlelab', 'from-exam'], first: ['examination', 'desk'], maps: ['examination', 'examtop'], weight: 'weightSurprise', boss: 'examination.titan', treasure: 'duck', still: true, grant: { hearts: 30 } },
  { key: 'lateshow', seed: 11, name: 'THE LATE SHOW', side: true, play: lateShow.play, door: ['rerun', 'screen'], first: ['showbooth', 'door'], maps: ['showbooth', 'reel1958', 'reel1986', 'chase1986', 'reel2086', 'weaver'], weight: 'weightFingers', boss: 'weaver', treasure: 'stomp', grant: {} },
  { key: 'heap', seed: 5, name: 'THE HEAP', play: heap.play, door: ['underglow1', 'up'], first: ['heap1', 'door'], maps: ['heap1', 'heap2'], weight: 'weightCredit', boss: 'heap.golem', treasure: 'magnet', grant: { bombs: 8 }, by: 'the walker keeps him whole and unhurt between the fights, and his hearts are filled before the Golem' },
  { key: 'actthree', seed: 7, name: 'ACT THREE', side: true, play: actThree.play, door: ['understage', 'door'], first: ['actunder', 'foot'], maps: ['actunder', 'actdoors', 'actbard', 'actflats', 'actwings', 'actloft', 'actstudy', 'actcable', 'actgondola'], weight: 'weightSources', boss: 'hallucinator', treasure: 'lens', grant: {}, by: 'he is cut down once in the gondola on purpose, and after the Weight q.act.tape (Fogstage\'s errand) is set before Vega', unpractised: 'the understudy falls elsewhere, and the walk to its chest stops a hair short of the reach' },
]
export const BALANCE = { key: 'balance', seed: 7, by: 'nothing hurts him on the walks between the rooms, and his hearts are filled before the hounds and the machine', name: 'THE BALANCE', first: ['balance', 'lid'], maps: ['balance', 'supply', 'supplyroom'], boss: 'maximizer' }

/** The treasures: on B (a socket of the ITEMS page), or no slot (the page's ALWAYS row, by its flag). */
const ON_B = new Set(['echo', 'lamp', 'magnet', 'duck'])
const NO_SLOT = { no: 'item_no', stomp: 'item_stomp', lens: 'item_lens' }
/** The overworld's old west edge (`zelda-prism-run.mjs`). */
const OX = 40

const json = x => JSON.parse(JSON.stringify(x))
const isItem = f => f.startsWith('item:')

/** The save as the server measures it (`server/api/save.post.ts`). */
const saveBytes = (Z, s) => JSON.stringify({ ...Z.toSave(s), savedAt: 1_800_000_000_000 }).length

/** The tab closed and the game opened again: a new visit, which starts in town with all the save holds. */
export function reopen(Z, s) {
  const save = Z.parseSave(json({ ...Z.toSave(s), savedAt: 1 }))
  assert.ok(save, 'the save is taken back')
  const back = Z.createGame(Z.WORLD, { save, at: Z.loadSpot(Z.WORLD, save, null, false) })
  assert.deepEqual([Object.keys(back.flags).sort(), back.inv, back.hero.maxHp], [Object.keys(s.flags).sort(), save.inv, s.hero.maxHp], 'nothing is lost in the save')
  return back
}

/** Steps on with nothing pressed (A for words and cards) and nothing able to hurt him. */
function idle(Z, s, frames) {
  for (let k = 0; k < frames; k++) {
    s.hero.invuln = 1
    const a = (s.mode === 'dialog' || !!s.card) && k % 12 === 0
    Z.stepGame(Z.WORLD, s, 1 / 60, { ...Z.NO_INPUT, move: { x: 0, y: 0 }, a, aPress: a })
  }
}

/** Every B item he owns, chosen on the ITEMS page and pressed in the room at `entry`, each on a copy of the save. */
function pressEverything(Z, s, [map, entry]) {
  const owned = Z.useItems(s)
  for (const id of owned) {
    const c = reopen(Z, s)
    Z.enterMap(Z.WORLD, c, map, entry, [])
    c.hero.auto = null
    idle(Z, c, 240)
    assert.equal(c.mode, 'play', `${id} in ${map}: the room never let him play (${c.mode})`)
    assert.ok(Z.pickCell(c.inv, Z.sockets(c.inv).findIndex(v => v.id === id)), `${id} is on the ITEMS page`)
    assert.equal(c.inv.selected, id)
    Z.stepGame(Z.WORLD, c, 1 / 60, { ...Z.NO_INPUT, move: { x: 0, y: 0 }, bPress: true, jumpPress: true })
    idle(Z, c, 150)
    assert.notEqual(c.mode, 'dying', `${id} in ${map}`)
  }
  return owned
}

/** Every piece of heart and container the world holds, as the flag that says he has it. */
function heartSources(Z) {
  const out = new Map()
  const note = (flag, item) => { if (item === 'heartPiece' || item === 'heartContainer') out.set(flag, item) }
  for (const id of Object.keys(Z.WORLD.maps)) {
    for (const { ent: e } of Z.mapInfo(Z.WORLD, id).marks) {
      if (e.t === 'chest') note(`chest:${e.id}`, e.item)
      if (e.t === 'item' || (e.t === 'shop' && e.once)) note(`took:${e.id}`, e.item)
      if (e.t === 'npc') for (const b of e.talk) if (b.give) note(`got:${e.id}:${b.give}${b.set ? `:${b.set}` : ''}`, b.give)
    }
  }
  return out
}

function heartsAddUp(Z, s, sources, when) {
  const had = [...sources].filter(([f]) => s.flags[f]).map(([, item]) => item)
  const pieces = had.filter(i => i === 'heartPiece').length
  const containers = had.length - pieces
  assert.deepEqual([s.hero.maxHp, s.inv.pieces], [Z.START_HP + 2 * (Math.floor(pieces / 4) + containers), pieces % 4], `${when}: ${pieces} pieces and ${containers} containers`)
  return { pieces, containers }
}

function treasures(Z, s, won, when) {
  const page = Z.itemsPageContent(s)
  const onB = Z.useItems(s)
  for (const id of won) {
    const cell = page.cells.some(v => v.id === id)
    if (ON_B.has(id)) assert.ok(onB.includes(id) && cell, `${when}: ${id} is on the B list and the ITEMS page`)
    else assert.ok(s.flags[`item:${id}`] && page.always.includes(NO_SLOT[id]) && !onB.includes(id) && !cell, `${when}: ${id} is in the ITEMS page's ALWAYS row, with no slot`)
  }
}

/** No ring below nothing, and none with a key left in it. */
function emptyRings(s, when) {
  assert.deepEqual(Object.entries(s.inv.keyrings).filter(([, n]) => n !== 0), [], `${when}: a key left on a ring`)
  assert.equal(s.inv.keys, 0, `${when}: a key left on the Shrine's ring`)
}

/** What a finished dungeon left is still there: its flags, its Weight, and, on its maps as they load, gates, doors and the fallen. */
function stillFinished(Z, s, done, when) {
  for (const d of done) {
    const what = `${when}: ${d.name}`
    assert.deepEqual(d.record.filter(f => !s.flags[f]), [], `${what} lost a flag`)
    assert.ok(s.flags[d.boss], `${what}: ${d.boss} is down`)
    if (d.weight) assert.ok(Z.hasWeight(s, d.weight), `${what}: its Weight`)
    const seen = { fallen: 0, gates: 0, doors: 0 }
    for (const map of d.maps) {
      const info = Z.mapInfo(Z.WORLD, map)
      const c = reopen(Z, s)
      Z.enterMap(Z.WORLD, c, map, Object.keys(info.entries)[0], [])
      idle(Z, c, 30)
      for (const gate of info.gates) {
        if (gate.trap || !s.flags[`gate:${gate.id}`]) continue
        seen.gates++
        assert.deepEqual(gate.tiles.filter(i => c.map.tiles[i] === 'X'), [], `${what}: gate ${gate.id} is shut again`)
      }
      info.base.forEach((t, i) => {
        if ((t !== 'L' && t !== 'K') || !s.flags[`door:${map}:${i}`]) return
        seen.doors++
        assert.ok(c.map.tiles[i] !== t, `${what}: a door of ${map} is locked again`)
      })
      // (A foe felled for good is not made again with its map.)
      seen.fallen += info.marks.filter(m => m.ent.t === 'enemy' && s.flags[m.ent.once]).length
      assert.deepEqual(c.map.enemies.filter(e => !e.dead && e.once && s.flags[e.once]).map(e => e.kind), [], `${what}: a fallen foe of ${map} stands again`)
      assert.deepEqual(c.map.pickups.filter(p => !p.hidden && Z.isWeight(p.item) && s.flags[`item:${p.item}`]), [], `${what}: its Weight lies there again`)
    }
    assert.ok(seen.fallen && seen.gates, `${what}: something was there to look at (${JSON.stringify(seen)})`)
  }
}

/** Every flag name a dungeon's maps speak of (conditions, what falls, what a lever or a word sets, what a find or a
 * condition calls an item: `item:<id>`, which every grant writes). */
function namedBy(Z, maps) {
  const out = new Set()
  const seen = new Set()
  const walk = (o) => {
    if (!o || typeof o !== 'object' || seen.has(o)) return
    seen.add(o)
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && ['flag', 'set', 'once', 'lit', 'notFlag', 'clear', 'calm'].includes(k)) out.add(v)
      else if (typeof v === 'string' && ['item', 'give', 'carries'].includes(k)) out.add(`item:${v}`)
      else if (Array.isArray(v) && ['flags', 'not', 'set', 'clear'].includes(k) && v.every(f => typeof f === 'string')) for (const f of v) out.add(f)
      else walk(v)
    }
  }
  for (const id of maps) walk(Z.WORLD.maps[id])
  return out
}

/**
 * The engine, noting which of the `watched` flags it reads while it works (a getter on each, in every game the play
 * makes): a read by a test or a bot is not one. (A game made by a reload on the way is watched from its first step.)
 */
function listening(Z, watched, reads) {
  let inside = 0
  const listen = (s) => {
    for (const name of watched) {
      if (!Object.getOwnPropertyDescriptor(s.flags, name)?.writable) continue
      const flags = s.flags
      let value = flags[name]
      Object.defineProperty(flags, name, {
        configurable: true, enumerable: true,
        get: () => { if (inside) reads.add(name); return value },
        set: v => { value = v },
      })
    }
    return s
  }
  const engine = fn => (...args) => { inside++; try { return fn(...args) } finally { inside-- } }
  return { listen, Z: { ...Z, stepGame: engine(Z.stepGame), enterMap: engine(Z.enterMap), respawn: engine(Z.respawn), createGame: (...args) => listen(Z.createGame(...args)) } }
}

/** What the door lends him, and the way to take it back: what the dungeon gave him on top stays. */
function lend(s, grant) {
  const hearts = Math.max(0, (grant.hearts ?? 0) - s.hero.maxHp)
  s.hero.maxHp += hearts
  s.hero.hp = s.hero.maxHp
  assert.ok(!s.inv.bombBag, 'no bag of his own at a dungeon\'s door')
  if (grant.bombs) Object.assign(s.inv, { bombBag: true, bombs: grant.bombs, selected: 'bombs' })
  s.inv.bits += grant.bits ?? 0
  return (after) => {
    after.hero.maxHp -= hearts
    after.hero.hp = Math.min(after.hero.hp, after.hero.maxHp)
    if (grant.bombs) {
      Object.assign(after.inv, { bombBag: false, bombs: 0 })
      if (after.inv.selected === 'bombs') after.inv.selected = null
    }
    after.inv.bits -= grant.bits ?? 0
  }
}

/** What a door lent, in words. */
function lentText(d, s) {
  const g = d.grant
  const hearts = Math.max(g.hearts ?? 0, s.hero.maxHp) / 2
  return [`the blade`, `${hearts} hearts${g.hearts > s.hero.maxHp ? ` (${(g.hearts - s.hero.maxHp) / 2} lent over his own ${s.hero.maxHp / 2})` : ' (his own)'}`,
    ...(g.bombs ? [`a bomb bag with ${g.bombs}`] : []), ...(g.bits ? [`${g.bits} bits`] : [])].join(', ')
}

/**
 * The whole game on one save, the seven dungeons in the order of `keys`. Throws at the first thing that does not hold,
 * the step's name in front. `say` hears the account as it goes. Returns the last game and what was measured.
 *
 * The die: a save carries the game's random state (`rng`) from room to room. The moved controllers are tuned to the
 * throws their own test gets, and some miss on others (a foe wanders near and A cuts where they meant to talk), so
 * with `dice: 'own'` the die is set at each door as that dungeon's test sets it; `'carried'` leaves it as the save has
 * it. Nothing else of the save is written between a play and the next door but what the door lends.
 *
 * The combos: the blade's moves are counted in the save (`inv.moves`), and one done often enough is mastered and hits
 * harder, so a hero who has fought comes stronger to the next door than that dungeon's test makes him. With
 * `practice: 'doors'` the counts are set aside at the doors whose controllers are tuned to an unpractised blade
 * (`unpractised`) and given back, with what was added, as the play ends; `'carried'` never sets them aside, `'aside'`
 * does at every door.
 */
export async function wholeGame(Z, { keys = DOORS.map(d => d.key), seed = 7, dice = 'own', practice = 'doors', say = () => {} } = {}) {
  const order = keys.map(k => DOORS.find(d => d.key === k) ?? assert.fail(`no dungeon ${k}`))
  assert.deepEqual([...keys].sort(), DOORS.map(d => d.key).sort(), 'each of the seven, once')
  const cap = Z.saveGameById('zelda').maxBytes
  const sources = heartSources(Z)
  const done = []
  const curve = []
  let at = 'a new game'
  let s

  const measure = (when, from) => {
    const bytes = saveBytes(Z, s)
    assert.ok(bytes <= cap, `${when}: the save is ${bytes} bytes, the cap ${cap}`)
    const { pieces, containers } = heartsAddUp(Z, s, sources, when)
    curve.push({ when, bytes, flags: Object.keys(s.flags).length, hearts: s.hero.maxHp / 2, pieces, containers })
    say(`after ${when}: save ${bytes} B of ${cap} (${Object.keys(s.flags).length} flags), ${s.hero.maxHp / 2} hearts (${pieces} pieces, ${containers} containers), played in ${((Date.now() - from) / 1000).toFixed(1)} s`)
  }
  /** All that must hold between two dungeons, on the game just opened again. */
  const between = (when) => {
    stillFinished(Z, s, done, when)
    treasures(Z, s, done.map(d => d.treasure).filter(Boolean), when)
    assert.equal(Z.weightCount(s), done.filter(d => d.weight).length, when)
    assert.equal((Z.itemsPageContent(s).weights ?? []).filter(Boolean).length, Z.weightCount(s), `${when}: the pans of the ITEMS page`)
  }

  /** The flags the engine reads on any map at all (a dungeon's bookkeeping, run every frame): read in town. */
  const everywhere = (g, watched) => {
    const reads = new Set()
    const ear = listening(Z, watched, reads)
    const town = ear.listen(reopen(Z, g))
    for (let k = 0; k < 60; k++) ear.Z.stepGame(Z.WORLD, town, 1 / 60, { ...Z.NO_INPUT, move: { x: 0, y: 0 } })
    return reads
  }

  try {
    // A first visit: out on the plaza.
    let from = Date.now()
    s = Z.createGame(Z.WORLD, { seed })
    idle(Z, s, 120)
    measure(at, from)

    // No ring opens doors in two dungeons (a map with no ring of its own and a lock would take the Shrine's keys).
    const rings = [...DOORS, BALANCE].flatMap(d => [...new Set(d.maps
      .filter(m => Z.WORLD.maps[m].keyring || Z.mapInfo(Z.WORLD, m).base.some(t => t === 'L' || t === 'K'))
      .map(m => Z.WORLD.maps[m].keyring ?? 'shrine'))])
    assert.deepEqual(rings.filter((r, i) => r === 'shrine' || rings.indexOf(r) !== i), [], 'a keyring two dungeons share')

    for (const d of order) {
      at = d.name
      from = Date.now()
      s = reopen(Z, s)
      if (!s.inv.sword) Z.grant(s, 'sword')
      // What he has, pressed in this dungeon's first room.
      const pressed = pressEverything(Z, s, d.first)
      say(`${d.name}: door ${d.door.join(':')}${dice === 'own' ? ` (die ${d.seed})` : ''}; lent: ${lentText(d, s)}; brought: ${done.flatMap(v => [v.treasure, v.weight]).join(' ') || 'nothing'}${pressed.length ? `; B pressed in ${d.first[0]}: ${pressed.join(' ')}` : ''}`)

      if (d.by) say(`${d.name}: the play itself: ${d.by}`)
      const watched = done.flatMap(v => v.record)
      const reads = new Set()
      const ear = listening(Z, watched, reads)
      if (dice === 'own') s.rng = d.seed
      Z.enterMap(Z.WORLD, s, ...d.door, [])
      if (d.still) {
        Object.assign(s, { mode: 'play', dialog: null })
        s.hero.auto = null
      }
      const takeBack = lend(s, d.grant)
      const aside = practice === 'aside' || (practice === 'doors' && d.unpractised) ? s.inv.moves : undefined
      if (aside) {
        delete s.inv.moves
        say(`${d.name}: combo counts set aside at this door (${Object.entries(aside).map(([k, n]) => `${k} ${n}`).join(', ')})${d.unpractised ? `: ${d.unpractised}` : ''}`)
      }
      const before = new Set(Object.keys(s.flags))
      s = d.play(ear.Z, ear.listen(s))
      assert.ok(Z.hasWeight(s, d.weight), 'the Weight is in hand')
      takeBack(s)
      if (aside) {
        const moves = { ...aside }
        for (const [k, n] of Object.entries(s.inv.moves ?? {})) moves[k] = Math.min(999, (moves[k] ?? 0) + n)
        s.inv.moves = moves
      }
      const record = Object.keys(s.flags).filter(f => !before.has(f))
      emptyRings(s, d.name)

      s = reopen(Z, s)
      done.push({ ...d, record, reads: [...reads] })
      between(d.name)
      measure(d.name, from)
    }

    // ---- the first ending: the lid of the Balance opens to whoever holds the Sun Prism, and only the first ending
    // gives it. Played the way the full run of `zelda-engine.test.mjs` plays it.
    at = 'the Sun Prism'
    from = Date.now()
    s = reopen(Z, s)
    assert.ok(!s.flags.won && !s.flags['item:prism'], 'seven dungeons end nothing')
    const P = walker(Z)
    if (dice === 'own') s.rng = 11
    Z.enterMap(Z.WORLD, s, 'overworld', 'hut', [])
    for (let k = 0; k < 120 && s.hero.auto; k++) P.step(s)
    say('the Sun Prism: lent: nothing; the full run itself: nothing hurts him, gateShut is set by hand, and the Shrine\'s foes are killed outright')
    prismRun(s, { ...P, Z, OX })
    s = reopen(Z, s)
    assert.ok(s.flags.won && s.inv.prism && s.daytime !== null, 'the first ending: won, the prism, the sun set')
    assert.equal(s.inv.keys, 0, 'a key left on the Shrine\'s ring')
    between(at)
    measure(at, from)

    // ---- the Balance, the Supply Room, NO, the second ending, and home.
    at = BALANCE.name
    from = Date.now()
    s = reopen(Z, s)
    const pressed = pressEverything(Z, s, BALANCE.first)
    say(`${BALANCE.name}: the pedestal; lent: nothing; B pressed in ${BALANCE.first[0]}: ${pressed.join(' ')}`)
    say(`${BALANCE.name}: the play itself: ${BALANCE.by}`)
    const reads = new Set()
    const ear = listening(Z, done.flatMap(v => v.record), reads)
    const events = []
    const noting = { ...ear.Z, stepGame: (...args) => { const ev = ear.Z.stepGame(...args); events.push(...ev); return ev } }
    if (dice === 'own') s.rng = BALANCE.seed
    // (Beside the pedestal: a save that holds the prism finds the lid open as the map loads.)
    Z.enterMap(Z.WORLD, s, 'shrine', 'start', [], { x: 24.5, y: 9.5 })
    const before = new Set(Object.keys(s.flags))
    const first = JSON.stringify([s.flags.won, s.flags['item:prism'], s.inv.prism])
    s = balance.play(noting, ear.listen(s))
    assert.deepEqual([s.map.id, s.mode], ['shrine', 'play'], 'home in the Shrine')
    // The second ending writes nothing of the first.
    assert.equal(JSON.stringify([s.flags.won, s.flags['item:prism'], s.inv.prism]), first)
    assert.ok(!events.some(e => e.type === 'won') && events.some(e => e.type === 'end2'))
    const record = Object.keys(s.flags).filter(f => !before.has(f))
    assert.deepEqual(record.filter(f => /(^|[.:])won($|[.:])/.test(f)), [])
    emptyRings(s, BALANCE.name)
    s = reopen(Z, s)
    done.push({ ...BALANCE, record, reads: [...reads] })
    between(at)
    assert.ok(s.flags.ending2 && s.flags.maximizer && s.flags.won, 'both endings in the one save')
    measure(at, from)

    // ---- no flag of one dungeon is another's.
    at = 'the flags'
    const names = new Map()
    for (const d of done) for (const f of new Set([...namedBy(Z, d.maps), ...d.record])) names.set(f, [...names.get(f) ?? [], d.name])
    const shared = [...names].filter(([, by]) => by.length > 1).map(([flag, by]) => ({ flag, by }))
    for (const v of shared) say(`shared flag name: ${v.flag} (${v.by.join(', ')})`)
    assert.deepEqual(shared.filter(v => !isItem(v.flag)), [], 'a flag name two dungeons share')
    // And while it is played, no dungeon reads what an earlier one wrote: but for what is read on every map anyway,
    // and the items, which are the hero's to carry (said, so that a treasure read where it should not be is seen).
    const upkeep = everywhere(s, done.flatMap(v => v.record).filter(f => !isItem(f)))
    say(`flags read on any map at all, in town too: ${[...upkeep].join(' ') || 'none'}`)
    for (const d of done) if (d.reads.some(isItem)) say(`${d.name} reads, of what earlier dungeons gave: ${d.reads.filter(isItem).sort().join(' ')}`)
    const crossed = done.flatMap(d => d.reads.filter(f => !isItem(f) && !upkeep.has(f)).map(f => `${d.name} reads ${f}`))
    assert.deepEqual(crossed, [], 'a dungeon reads a flag an earlier one set')
    return { s, curve, shared, done }
  } catch (e) {
    e.step = at
    e.curve = curve
    e.message = `${at}${s ? ` (${s.map.id} ${s.hero.x.toFixed(2)},${s.hero.y.toFixed(2)}, ${s.mode}, order ${keys.join(' ')}, seed ${seed}, dice ${dice}, practice ${practice})` : ''}: ${e.message}`
    throw e
  }
}
