// Tough foes (docs/games/neon-shrine.md, "Tough foes"): a sentry or a hound whose mark says `tough`. More hit
// points, a bar over its head, and poise: the blade's blows hurt it but neither shove nor stop it, until it has
// spent its strike (until then the blade only clanks off it). These are the fights themselves, played by scripted
// players over four seeds each (a seed also moves hero and foe, so the fights differ; these four put one or the other
// on the first and the last row), because nobody plays them by hand before they ship:
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

const SEEDS = [1, 3, 4, 5]
const FPS = 60
const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })

/**
 * A bare room, 16 by 7 tiles of floor: the hero west of the middle, one tough foe from a real mark east of him. The
 * seed also moves the two (the foe four to six tiles off, on another row), so that the fights differ where
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
const REACT = 6
/** How long the dancer stays in an opening before he leaves, counted by himself from the moment the bar turns gold. */
const STAY = 0.65

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
    it('hurts a hero who walks up and hammers A, at least twice before it falls, with the Arc Blade too', () => {
      for (const gear of [{}, { arc: true }]) {
        for (const seed of SEEDS) {
          const r = fight(kind, mash, seed, 45, gear)
          assert.ok(r.hurts >= 2, `seed ${seed}${gear.arc ? ', the Arc Blade' : ''}: hammering cost ${r.hurts} blows (won ${r.won} in ${r.seconds.toFixed(1)} s)`)
        }
      }
    })

    it('hurts a hero who only throws the disc and cuts while it is stunned: it cannot be stunned again at once', () => {
      for (const seed of SEEDS) {
        const r = fight(kind, discLoop, seed, 45, { disc: true })
        assert.ok(r.hurts >= 1, `seed ${seed}: the disc alone won it unharmed in ${r.seconds.toFixed(1)} s`)
      }
    })

    it('falls, without landing a blow, to a hero who rolls off its strike (a tenth of a second late, or 0.15 s) and cuts while it is open', () => {
      for (const react of [6, 9]) {
        for (const seed of SEEDS) {
          const r = fight(kind, dance, seed, 45, { react })
          const at = `seed ${seed}, ${react} frames`
          assert.ok(r.won, `${at}: not beaten in 45 s (${r.left} left, ${r.hurts} blows taken)`)
          assert.equal(r.hurts, 0, `${at}: took ${r.hurts} blows`)
          // (The quick hand's fight is timed: not too short to be a fight, nor too long for one foe.)
          if (react === 6) assert.ok(r.seconds >= 6 && r.seconds <= 20, `${at}: ${r.seconds.toFixed(1)} s, a fight takes 6 to 20`)
        }
      }
    })

    it('punishes a hero who rolls before the tell is over: it aims when the tell ends', () => {
      let hurts = 0
      for (const seed of SEEDS) hurts += fight(kind, dance, seed, 20, { react: -9 }).hurts
      assert.ok(hurts >= SEEDS.length, `early rolls cost ${hurts} blows over ${SEEDS.length} fights`)
    })
  })
}
