import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  SCRIPTS, FILLER, SET_PIECE_POLICY, DENSITY, RING_GATE,
  createEncounterRunner, runEncounter, mulberry32, densityCap, eventWeight,
  ringGateLine, signatureKinds, echoExtra,
} from '../themes/starfox/encounters.ts'
import { TRAVEL_TIME, HORNET, SIGNATURE_KINDS, PICKABLE_KINDS } from '../themes/starfox/balance.ts'
import { DROP } from '../themes/starfox/arsenal.ts'
import { BOSSES, absoluteSector } from '../themes/starfox/ids.ts'

const SEEDS = [1, 7, 42, 1234, 99991]
const run = (i, loop, seed = 7) => runEncounter(i, loop, mulberry32(seed))

/** Every enemy kind an event puts in the air (missiles via their carriers). */
function kindsOf(ev) {
  switch (ev.type) {
    case 'formation': return ev.kinds
    case 'enemy': return ev.missiles ? [ev.kind, 'missile'] : [ev.kind]
    case 'carrier': return ev.missiles ? ['carrier', 'missile', 'drone'] : ['carrier', 'drone']
    case 'turrets': return ['turret']
    default: return []
  }
}

function maxWindow(evs) {
  let max = 0
  for (const e of evs) {
    let w = 0
    for (const f of evs) if (f.t > e.t - DENSITY.window && f.t <= e.t) w += eventWeight(f)
    max = Math.max(max, w)
  }
  return max
}

describe('Star Fox encounter scripts', () => {
  it('has five scripts, sorted, inside the corridor and before WARNING', () => {
    assert.equal(SCRIPTS.length, 5)
    for (const script of SCRIPTS) {
      for (let k = 1; k < script.length; k++) assert.ok(script[k].at >= script[k - 1].at)
      for (const b of script) {
        assert.ok(b.at > 0 && b.at < TRAVEL_TIME - FILLER.tailQuiet)
        const s = b.spec
        if ('x' in s && s.x !== null) assert.ok(Math.abs(s.x) <= 1)
        if ('y' in s) assert.ok(s.y >= 0 && s.y <= 1)
        if (s.type === 'turrets') for (const x of s.xs) assert.ok(Math.abs(x) <= 1)
      }
    }
  })

  it('runs deterministically for a seed', () => {
    for (let i = 0; i < 5; i++) {
      assert.deepEqual(run(i, 0, 3), run(i, 0, 3))
      assert.deepEqual(run(i, 2, 3), run(i, 2, 3))
    }
    assert.notDeepEqual(run(1, 0, 3), run(1, 0, 4))
  })

  it('emits the same scripted beats whatever the frame rate', () => {
    for (let i = 0; i < 5; i++) {
      const a = runEncounter(i, 0, mulberry32(5), 1 / 120).filter(e => e.scripted).map(e => e.type)
      const b = runEncounter(i, 0, mulberry32(5), 1 / 20).filter(e => e.scripted).map(e => e.type)
      assert.deepEqual(a, b)
    }
  })

  it('ends every sector in WARNING for its boss, and nothing after', () => {
    for (let i = 0; i < 5; i++) for (const loop of [0, 1]) {
      const r = createEncounterRunner(i, loop, mulberry32(9))
      const evs = []
      while (!r.done) for (const e of r.step(1 / 30)) evs.push({ ...e })
      const last = evs[evs.length - 1]
      assert.equal(last.type, 'warning')
      assert.equal(last.boss, BOSSES[i])
      assert.equal(last.story, 'boss:warning')
      assert.ok(last.t >= TRAVEL_TIME && last.t < TRAVEL_TIME + 0.1)
      assert.equal(evs.filter(e => e.type === 'warning').length, 1)
      assert.equal(r.step(1).length, 0, 'done stays quiet')
      assert.equal(r.sector, absoluteSector(i, loop))
    }
  })

  it('introduces each sector\'s signature kinds with a meet cue', () => {
    for (let i = 0; i < 5; i++) {
      const evs = run(i, 0)
      const kinds = new Set(evs.flatMap(kindsOf))
      for (const k of signatureKinds(i)) {
        assert.ok(kinds.has(k), `sector ${i + 1} meets ${k}`)
        const cues = evs.filter(e => e.story === `meet:${k}`)
        assert.equal(cues.length, 1, `one meet:${k} in sector ${i + 1}`)
        assert.ok(cues[0].scripted)
      }
      // the meet comes no later than the first appearance of the kind
      for (const k of signatureKinds(i)) {
        const first = evs.find(e => kindsOf(e).includes(k))
        const meet = evs.find(e => e.story === `meet:${k}`)
        assert.ok(meet.t <= first.t + HORNET.warnLead + 1, `${k}: meet ${meet.t} first ${first.t}`)
      }
    }
    assert.deepEqual(SIGNATURE_KINDS.map((_, i) => signatureKinds(i)), SIGNATURE_KINDS)
  })

  it('keeps the coast gentle: gnats and two spikes only on the first pass', () => {
    for (const seed of SEEDS) {
      const kinds = new Set(run(0, 0, seed).flatMap(kindsOf))
      assert.deepEqual([...kinds].sort(), ['drone', 'kamikaze'])
    }
  })

  it('runs one set piece or more per sector, with its cue and quiet filler', () => {
    for (let i = 0; i < 5; i++) for (const seed of SEEDS) {
      const evs = run(i, 0, seed)
      const starts = evs.filter(e => e.type === 'setPiece' && e.phase === 'start')
      const ends = evs.filter(e => e.type === 'setPiece' && e.phase === 'end')
      assert.ok(starts.length >= 1)
      assert.equal(starts.length, ends.length)
      for (let k = 0; k < starts.length; k++) {
        const s = starts[k], e = ends[k]
        assert.equal(s.id, e.id)
        assert.equal(s.story, `set:${s.id}`)
        assert.ok(e.t - s.t >= 8, 'a set piece lasts a while')
        const pol = SET_PIECE_POLICY[s.id]
        const inside = evs.filter(x => !x.scripted && x.t > s.t && x.t < e.t)
        if (pol.enemies === 0) assert.ok(!inside.some(x => x.type === 'formation'), `${s.id}: no filler enemies`)
        if (!pol.obstacles) assert.ok(!inside.some(x => x.type === 'obstacle'), `${s.id}: no filler obstacles`)
        if (!pol.rings) assert.ok(!inside.some(x => x.type === 'ring'), `${s.id}: no filler rings`)
      }
    }
    const ids = new Set(SCRIPTS.flatMap(s => s.filter(b => b.spec.type === 'setPiece').map(b => b.spec.id)))
    assert.deepEqual([...ids].sort(), ['ambush', 'carrier', 'rings', 'turrets'])
  })

  it('places three gold rings per sector, off the easy line', () => {
    for (let i = 0; i < 5; i++) {
      const golds = run(i, 0).filter(e => e.type === 'goldRing')
      assert.equal(golds.length, 3)
      for (const g of golds) assert.ok(Math.abs(g.x) >= 0.75 || g.y >= 0.85 || g.y <= 0.12, `gold at ${g.x},${g.y}`)
    }
  })

  it('spaces capsules regularly; the first on the coast is a laser', () => {
    for (let i = 0; i < 5; i++) {
      const caps = run(i, 0).filter(e => e.type === 'capsule')
      assert.ok(caps.length >= 4)
      for (let k = 1; k < caps.length; k++) assert.ok(caps[k].t - caps[k - 1].t >= DROP.minGap)
      assert.ok(caps[0].t <= DROP.maxGap)
      assert.ok(TRAVEL_TIME - caps[caps.length - 1].t <= DROP.maxGap)
    }
    assert.equal(run(0, 0).find(e => e.type === 'capsule').capsule, 'laser')
  })

  it('warns before every hornet from behind', () => {
    for (let i = 0; i < 5; i++) for (const loop of [0, 2]) {
      const evs = run(i, loop)
      for (const h of evs.filter(e => e.type === 'enemy' && e.behind)) {
        assert.equal(h.kind, 'dasher')
        const warn = evs.filter(e => e.type === 'ambush' && e.t <= h.t - HORNET.warnLead + 1e-6 && e.story === 'warn:behind')
        assert.ok(warn.length > 0, `hornet at ${h.t} was announced`)
      }
      for (const a of evs.filter(e => e.type === 'ambush')) {
        const after = evs.filter(e => e.behind && e.t > a.t && e.t < a.t + HORNET.warnLead + 2)
        assert.ok(after.length >= a.count)
      }
    }
  })

  it('never packs the corridor past the density cap, any loop, any seed', () => {
    for (let i = 0; i < 5; i++) for (const loop of [0, 1, 2, 3, 6]) for (const seed of SEEDS) {
      const evs = run(i, loop, seed)
      const cap = densityCap(absoluteSector(i, loop))
      const m = maxWindow(evs)
      assert.ok(m <= cap, `sector ${i + 1} loop ${loop} seed ${seed}: ${m} > ${cap}`)
    }
    assert.ok(DENSITY.capMax <= 18, 'leaves room in the 28-enemy pool for mites and gnats')
    for (let s = 1; s < 60; s++) assert.ok(densityCap(s + 1) >= densityCap(s))
  })

  it('stops filler before WARNING and near scripted beats', () => {
    for (let i = 0; i < 5; i++) for (const seed of SEEDS) {
      const evs = run(i, 0, seed)
      assert.ok(!evs.some(e => !e.scripted && e.t > TRAVEL_TIME - FILLER.tailQuiet && e.type !== 'ring'))
      const beats = SCRIPTS[i].filter(b => ['formation', 'enemy', 'carrier', 'turrets', 'ambush'].includes(b.spec.type)).map(b => b.at)
      for (const f of evs.filter(e => !e.scripted && e.type === 'formation')) {
        assert.ok(beats.every(at => Math.abs(at - f.t) >= FILLER.clearOfBeat - 1 / 30), `filler at ${f.t}`)
        for (const k of f.kinds) assert.ok(PICKABLE_KINDS.includes(k))
      }
    }
  })

  it('gets busier with every ECHO loop', () => {
    for (let i = 0; i < 5; i++) {
      let prev = 0
      for (const loop of [0, 1, 2, 3]) {
        let sum = 0
        for (const seed of SEEDS) sum += run(i, loop, seed).reduce((a, e) => a + eventWeight(e), 0)
        assert.ok(sum >= prev, `sector ${i + 1} loop ${loop}: ${sum} < ${prev}`)
        prev = sum
      }
    }
    assert.equal(echoExtra(0), 0)
    assert.ok(echoExtra(3) > echoExtra(1))
  })

  it('unlocks missiles in the Crown and every ECHO', () => {
    assert.ok(!run(3, 0).some(e => e.missiles))
    assert.ok(run(4, 0).some(e => e.type === 'carrier' && e.missiles))
    assert.ok(run(3, 1).some(e => e.type === 'carrier' && e.missiles))
  })

  it('draws ring gates as a flyable slalom', () => {
    for (const seed of SEEDS) {
      const { xs, ys } = ringGateLine(8, mulberry32(seed))
      assert.equal(xs.length, 8)
      for (let k = 0; k < xs.length; k++) {
        assert.ok(Math.abs(xs[k]) <= 0.9 && ys[k] >= 0.15 && ys[k] <= 0.85)
        if (k) {
          assert.ok(Math.abs(xs[k] - xs[k - 1]) <= RING_GATE.maxStep + 1e-9)
          assert.ok(Math.abs(ys[k] - ys[k - 1]) <= 0.2 + 1e-9)
        }
      }
    }
    const gate = run(0, 0).find(e => e.type === 'ringGate')
    assert.ok(gate && gate.xs.length === 7 && gate.spacing === RING_GATE.spacing)
  })

  it('reuses one output array per runner', () => {
    const r = createEncounterRunner(0, 0, mulberry32(1))
    const a = r.step(0.1)
    const b = r.step(0.1)
    assert.equal(a, b)
    assert.equal(createEncounterRunner(7, 0).index, 2, 'index wraps')
  })
})
