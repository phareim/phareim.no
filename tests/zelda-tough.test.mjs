// Tough foes (docs/games/neon-shrine.md, "Tough foes"): a sentry or a hound whose mark says `tough`. More hit
// points, a bar over its head, and poise: the blade's blows hurt it but neither shove nor stop it, until it has
// spent its strike (until then the blade only clanks off it). These are the fights themselves, played by scripted
// players over eight seeds each (a seed also moves hero and foe, so the eight fights differ), because nobody plays
// them by hand before they ship:
//   - one who stands still is hurt;
//   - one who walks up and hammers A is hurt again and again, with the Arc Blade too;
//   - one who throws the disc, cuts while it is stunned and never dodges is hurt too: the disc is a tool, not a way round;
//   - one who waits for the strike, rolls off its line a tenth of a second after it starts (or 0.15 s) and cuts
//     while the foe is open wins without a scratch; one who rolls early is hit.
// The numbers that make this true live in `TOUGH` (types.ts). Tune those, never these assertions.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'

let Z
before(async () => { Z = await load() })

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]
const FPS = 60
const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })

/**
 * A bare room, 16 by 7 tiles of floor: the hero west of the middle, one tough foe from a real mark east of him. The
 * seed also moves the two (the foe four to six tiles off, on another row), so that the eight fights differ where
 * the foe's own brain draws no numbers: other angles, other lines for the strike, other walls behind the hero.
 */
function ring(kind, seed) {
  const rows = ['##################', '#................#', '#................#', '#................#', '#................#', '#................#', '#................#', '#................#', '##################'].map(r => [...r])
  const hy = 2 + (seed % 5)
  const fy = 2 + ((seed * 3 + 1) % 5)
  rows[hy][5 + (seed % 2)] = '@'
  rows[fy][10 + (seed % 3)] = 'z'
  const W = {
    start: { map: 'ring', entry: 'start' },
    maps: {
      ring: {
        id: 'ring', name: 'RING', kind: 'interior', track: 'indoor',
        rows: rows.map(r => r.join('')),
        marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'right' } }, z: { ent: { t: 'enemy', kind, dir: 'left', tough: true } } },
      },
    },
  }
  const s = Z.createGame(W, { seed })
  s.mode = 'play'
  s.dialog = null
  s.inv.sword = true
  s.hero.dir = 'right'
  s.hero.aim = 0
  return { W, s, e: s.map.enemies[0] }
}

const gap = (s, e) => Math.hypot(e.x - s.hero.x, e.y - s.hero.y)
const unit = (x, y, k = 1) => { const d = Math.hypot(x, y) || 1; return { x: (x / d) * k, y: (y / d) * k } }
const toward = (s, e, k = 1) => unit(e.x - s.hero.x, e.y - s.hero.y, k)
const away = (s, e, k = 1) => unit(s.hero.x - e.x, s.hero.y - e.y, k)
/** Whether the hero stands within a blade's length of the foe's body. */
const inReach = (s, e) => gap(s, e) < Z.SWORD_REACH + e.r - 0.15

/** Stands where he is. */
const still = () => inp()

/** Walks up and hammers A, never rolls, never backs off. */
function mash(s, e, f) {
  if (!inReach(s, e)) return inp({ move: toward(s, e) })
  return inp({ move: toward(s, e, 0.05), aPress: f % 5 === 0, a: true })
}

/**
 * The dancer's reaction time: frames from the moment the strike starts to the press of the roll (6: a tenth of a
 * second). Below zero he goes early, that many frames before the tell runs out, which the foe punishes: it aims
 * when the tell ends.
 */
const REACT = Number(process.env.TOUGH_REACT ?? 6)
/** How long the dancer stays in an opening before he leaves, counted by himself from the moment the bar turns gold. */
const STAY = Number(process.env.TOUGH_STAY ?? 0.65)

/**
 * Plays it properly, on what a player can see. Keeps three to four tiles off; when the strike comes (`charge` or
 * `lunge`, the way the foe moves in `ai.vx`, `ai.vy`) rolls off its line `REACT` frames later, toward the middle of
 * the room; while the foe is open (`toughOpen`: the gold bar) runs in and cuts, and leaves after `STAY` seconds of
 * it by his own count, not by the foe's clock.
 */
function dance(s, e, f, mem) {
  const react = mem.react ?? REACT
  const h = s.hero
  const d = gap(s, e)
  const mode = e.ai.mode
  if (mode === 'charge' || mode === 'lunge') {
    const vx = Number(e.ai.vx) || 0
    const vy = Number(e.ai.vy) || 0
    // Square to the strike; of the two ways, the one that leads to the middle of the room (4.5 down, 9 across).
    let p = unit(-vy, vx)
    if (p.x * (9 - h.x) + p.y * (4.5 - h.y) < 0) p = { x: -p.x, y: -p.y }
    // One roll for each strike: pressed (after the reaction time) until it starts, then not again before the foe's
    // mode has changed.
    if (mem.mode !== mode) { mem.mode = mode; mem.owed = react >= 0 || !h.roll; mem.since = 0 }
    if (h.roll) mem.owed = false
    return inp({ move: p, rollPress: mem.owed && mem.since++ >= react })
  }
  mem.mode = mode
  mem.open = Z.toughOpen(e) ? (mem.open ?? 0) + 1 : 0
  if (Z.toughOpen(e)) {
    if (mem.open > STAY * FPS) return inp({ move: away(s, e), rollPress: !h.roll && !h.swing && d < 2 })
    if (!inReach(s, e)) return inp({ move: toward(s, e) })
    return inp({ move: toward(s, e, 0.05), aPress: f % 4 === 0, a: true })
  }
  if (mode === 'tell') {
    // A dancer who goes early (REACT below zero) rolls that many frames before the tell runs out, square to the foe.
    if (react < 0 && Number(e.ai.tell) * FPS <= -react) {
      let p = unit(-(h.y - e.y), h.x - e.x)
      if (p.x * (9 - h.x) + p.y * (4.5 - h.y) < 0) p = { x: -p.x, y: -p.y }
      if (mem.told !== true) { mem.told = true; mem.owed = true }
      if (h.roll) mem.owed = false
      return inp({ move: p, rollPress: mem.owed })
    }
    mem.told = false
    return inp({ move: toward(s, e, 0.05) })
  }
  mem.told = false
  if (d < 3) return inp({ move: away(s, e) })
  if (d > 4) return inp({ move: toward(s, e) })
  return inp({ move: toward(s, e, 0.05) })
}

/** Throws the disc whenever the foe is not stunned, runs in and hammers A while it is, and never dodges. */
function discLoop(s, e, f) {
  if (e.stun > 0) return mash(s, e, f)
  return inp({ move: toward(s, e, 0.05), bPress: f % 20 === 0 })
}

/**
 * Plays `seconds` of a fight (or until someone falls). The hero has `hearts` so that every blow can be counted, and
 * what `gear` gives him (`arc`: the Arc Blade; `disc`: the disc, on B).
 */
function fight(kind, policy, seed, seconds, gear = {}, hearts = 15) {
  const { W, s, e } = ring(kind, seed)
  s.hero.maxHp = s.hero.hp = hearts * 2
  if (gear.arc) s.inv.arc = true
  if (gear.disc) { s.inv.disc = true; s.inv.selected = 'disc' }
  const mem = { react: gear.react }
  let hurts = 0
  let hp = s.hero.hp
  let f = 0
  for (; f < seconds * FPS && !e.dead && s.mode === 'play'; f++) {
    Z.stepGame(W, s, 1 / FPS, policy(s, e, f, mem))
    if (s.hero.hp < hp) hurts++
    hp = s.hero.hp
  }
  return { hurts, won: e.dead, seconds: f / FPS, left: e.hp, lost: hearts * 2 - s.hero.hp }
}

for (const kind of ['sentry', 'hound']) {
  describe(`a tough ${kind}, fought`, () => {
    it('is what its mark says: tough, with the hit points of TOUGH and a full bar', () => {
      const { e } = ring(kind, 1)
      assert.equal(e.tough, true)
      assert.equal(e.maxHp, Z.TOUGH.hp[kind])
      assert.equal(e.hp, e.maxHp)
      assert.ok(e.maxHp >= 2 * Z.STATS[kind].hp, 'at least twice a plain one')
      assert.equal(Z.toughOpen(e), false, 'it does not start open')
    })

    it('hurts a hero who only stands there', () => {
      for (const seed of SEEDS) {
        const r = fight(kind, still, seed, 12)
        assert.ok(r.hurts >= 1, `seed ${seed}: stood 12 s unharmed`)
      }
    })

    it('hurts a hero who walks up and hammers A, at least twice before it falls', () => {
      for (const seed of SEEDS) {
        const r = fight(kind, mash, seed, 45)
        assert.ok(r.hurts >= 2, `seed ${seed}: hammering cost ${r.hurts} blows (won ${r.won} in ${r.seconds.toFixed(1)} s)`)
      }
    })

    it('hurts the hammerer with the Arc Blade just as often: a closed foe gives the edge no more than a plain one', () => {
      for (const seed of SEEDS) {
        const r = fight(kind, mash, seed, 45, { arc: true })
        assert.ok(r.hurts >= 2, `seed ${seed}: the Arc Blade hammered through for ${r.hurts} blows (won ${r.won} in ${r.seconds.toFixed(1)} s)`)
      }
    })

    it('hurts a hero who only throws the disc and cuts while it is stunned: it cannot be stunned again at once', () => {
      for (const seed of SEEDS) {
        const r = fight(kind, discLoop, seed, 45, { disc: true })
        assert.ok(r.hurts >= 1, `seed ${seed}: the disc alone won it unharmed in ${r.seconds.toFixed(1)} s`)
      }
    })

    it('falls, without landing a blow, to a hero who rolls off its strike and cuts while it is open', () => {
      for (const seed of SEEDS) {
        const r = fight(kind, dance, seed, 45)
        assert.ok(r.won, `seed ${seed}: not beaten in 45 s (${r.left} left, ${r.hurts} blows taken)`)
        assert.equal(r.hurts, 0, `seed ${seed}: took ${r.hurts} blows`)
        assert.ok(r.seconds >= 6, `seed ${seed}: over in ${r.seconds.toFixed(1)} s, too short to be a fight`)
        assert.ok(r.seconds <= 20, `seed ${seed}: ${r.seconds.toFixed(1)} s, too long for one foe`)
      }
    })

    it('and to a slower hand too: a hero who rolls 0.15 s after the strike starts still wins untouched', () => {
      for (const seed of SEEDS) {
        const r = fight(kind, dance, seed, 45, { react: 9 })
        assert.ok(r.won, `seed ${seed}: not beaten in 45 s (${r.left} left, ${r.hurts} blows taken)`)
        assert.equal(r.hurts, 0, `seed ${seed}: took ${r.hurts} blows`)
      }
    })

    it('punishes a hero who rolls before the tell is over: it aims when the tell ends', () => {
      let hurts = 0
      for (const seed of SEEDS) hurts += fight(kind, dance, seed, 20, { react: -9 }).hurts
      assert.ok(hurts >= SEEDS.length, `early rolls cost ${hurts} blows over ${SEEDS.length} fights`)
    })
  })
}

// `TOUGH_TABLE=1 node --test tests/zelda-tough.test.mjs` prints every fight: blows taken / seconds, per seed.
if (process.env.TOUGH_TABLE) {
  describe('the fights, as a table', () => {
    it('prints them', () => {
      for (const kind of ['sentry', 'hound']) {
        for (const [name, policy, secs, gear] of [['still', still, 12, {}], ['mash', mash, 45, {}], ['mash+arc', mash, 45, { arc: true }], ['disc', discLoop, 45, { disc: true }], ['dance', dance, 45, {}], ['dance+arc', dance, 45, { arc: true }]]) {
          const row = SEEDS.map(seed => { const r = fight(kind, policy, seed, secs, gear); return `${r.hurts}/${r.seconds.toFixed(1)}${r.won ? '' : '*'}` })
          console.log(`${kind.padEnd(7)}${name.padEnd(10)}${row.join('  ')}`)
        }
      }
    })
  })
}
