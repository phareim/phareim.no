import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  SCRIPTS, FILLER, SET_PIECE_POLICY, DENSITY, RING_GATE,
  createEncounterRunner, runEncounter, mulberry32, densityCap, eventWeight,
  ringGateLine, signatureKinds, echoExtra, dingoChasers, OUTCOME_CUES,
} from '../themes/starfox/encounters.ts'
import { TRAVEL_TIME, HORNET, SIGNATURE_KINDS, PICKABLE_KINDS, RIVAL, DINGO_TROUBLE, rivalHp } from '../themes/starfox/balance.ts'
import { DROP } from '../themes/starfox/arsenal.ts'
import { BOSSES, absoluteSector } from '../themes/starfox/ids.ts'

const SEEDS = [1, 7, 42, 1234, 99991]
const START_CUES = { dingoTrouble: 'dingo:trouble', cobra: 'cobra:flyby', rivalDuel: null }
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
      const duelEnd = evs.find(e => e.type === 'setPiece' && e.id === 'rivalDuel' && e.phase === 'end')
      const hold = i === 4 ? Math.max(TRAVEL_TIME, duelEnd.t) : TRAVEL_TIME
      assert.ok(last.t >= hold && last.t < hold + 0.1, `warning at ${last.t}`)
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
        const want = s.id === 'rivalDuel' ? (i === 4 ? 'cobra:duel' : 'cobra:arrive') : START_CUES[s.id] ?? `set:${s.id}`
        assert.equal(s.story, want)
        assert.ok(e.t - s.t >= (s.id === 'cobra' ? RIVAL.flybyTime - 0.1 : 8), 'a set piece lasts a while')
        const pol = SET_PIECE_POLICY[s.id]
        const inside = evs.filter(x => !x.scripted && x.t > s.t && x.t < e.t)
        if (pol.enemies === 0) assert.ok(!inside.some(x => x.type === 'formation'), `${s.id}: no filler enemies`)
        if (!pol.obstacles) assert.ok(!inside.some(x => x.type === 'obstacle'), `${s.id}: no filler obstacles`)
        if (!pol.rings) assert.ok(!inside.some(x => x.type === 'ring'), `${s.id}: no filler rings`)
      }
    }
    const ids = new Set(SCRIPTS.flatMap(s => s.filter(b => b.spec.type === 'setPiece').map(b => b.spec.id)))
    assert.deepEqual([...ids].sort(), ['ambush', 'carrier', 'rings', 'turrets'])
    for (const [id, pol] of Object.entries(SET_PIECE_POLICY)) assert.ok(typeof pol.holdScript === 'boolean', id)
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

  it('gets busier with ECHO loops', () => {
    // the knobs are monotonic; the totals too, within filler noise (5 %)
    for (let i = 0; i < 5; i++) {
      let prev = 0
      for (const loop of [0, 1, 2, 3]) {
        let sum = 0
        for (const seed of SEEDS) sum += run(i, loop, seed).reduce((a, e) => a + eventWeight(e), 0)
        if (loop === 1) assert.ok(sum > prev * 1.15, `sector ${i + 1}: ECHO I clearly busier`)
        else assert.ok(sum >= prev * 0.95, `sector ${i + 1} loop ${loop}: ${sum} < ${prev}`)
        prev = sum
      }
    }
    for (let s = 1; s < 30; s++) {
      assert.ok(densityCap(s + 5) >= densityCap(s))
      assert.ok(rivalHp(s + 5, true) > rivalHp(s, true))
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

// ---- the squad and MEGA COBRA in the scripts (2026-09-25) ----------------------

const setPieces = (evs, id) => evs.filter(e => e.type === 'setPiece' && e.id === id)

describe('Star Fox squad and rival set pieces', () => {
  it('puts DINGO in trouble in the woods and again at the lake, with 3 then 4 chasers', () => {
    const woods = run(1, 0)
    const lake = run(3, 0)
    const w = woods.find(e => e.type === 'dingoTrouble')
    const l = lake.find(e => e.type === 'dingoTrouble')
    assert.equal(w.chasers, 3)
    assert.equal(l.chasers, 4)
    assert.equal(dingoChasers(1, 1), 4)
    for (let i of [0, 2, 4]) assert.ok(!run(i, 0).some(e => e.type === 'dingoTrouble'))
    const start = setPieces(woods, 'dingoTrouble').find(e => e.phase === 'start')
    assert.equal(start.story, 'dingo:trouble')
    assert.ok(start.t < 60, 'the first one comes early (sector 2)')
  })

  it('skips DINGO\'s trouble when DINGO is not flying', () => {
    for (const i of [1, 3]) {
      const evs = runEncounter(i, 0, mulberry32(7), 1 / 30, { squad: () => ['heron', 'bison'] })
      assert.ok(!evs.some(e => e.type === 'dingoTrouble' || (e.type === 'setPiece' && e.id === 'dingoTrouble')))
    }
    // and DINGO flying again later counts
    let now = 0
    const evs = runEncounter(1, 0, mulberry32(7), 1 / 30, { squad: () => (now > 40 ? ['heron', 'bison', 'dingo'] : ['heron']), onEvent: e => { now = e.t } })
    assert.ok(evs.some(e => e.type === 'dingoTrouble'))
  })

  it('loses DINGO at the deadline unless the scene saves him', () => {
    const lost = run(1, 0)
    const s = setPieces(lost, 'dingoTrouble')
    assert.equal(s[1].outcome, 'lost')
    assert.equal(s[1].story, 'dingo:lost')
    assert.ok(Math.abs(s[1].t - s[0].t - DINGO_TROUBLE.time) < 0.05)
    // drive by hand: resolve 5 s in
    const r = createEncounterRunner(1, 0, mulberry32(7))
    const evs = []
    let startT = -1
    while (!r.done) {
      for (const e of r.step(1 / 30)) {
        evs.push({ ...e })
        if (e.type === 'dingoTrouble') startT = e.t
      }
      if (startT >= 0 && r.t > startT + 5 && r.setPiece === 'dingoTrouble') assert.ok(r.resolve('dingoTrouble', 'saved'))
    }
    const end = setPieces(evs, 'dingoTrouble')[1]
    assert.equal(end.outcome, 'saved')
    assert.equal(end.story, OUTCOME_CUES.dingoTrouble.saved)
    assert.ok(end.t - startT < 5.2)
    assert.equal(r.resolve('dingoTrouble', 'saved'), false, 'nothing to resolve after')
  })

  it('holds scripted enemies while DINGO is chased or a duel runs', () => {
    for (const i of [1, 2, 3, 4]) {
      const evs = run(i, 0)
      for (const id of ['dingoTrouble', 'rivalDuel']) {
        const sp = setPieces(evs, id)
        if (!sp.length) continue
        const inside = evs.filter(e => e.t > sp[0].t && e.t < sp[1].t && ['formation', 'enemy', 'carrier', 'turrets', 'ambush'].includes(e.type))
        assert.equal(inside.filter(e => !(e.type === 'enemy' && e.behind)).length, 0, `${id} in sector ${i + 1}`)
      }
    }
  })

  it('flies MEGA COBRA past in the woods: a taunt, no fight', () => {
    const evs = run(1, 0)
    const fly = evs.find(e => e.type === 'rival')
    assert.equal(fly.mode, 'flyby')
    assert.equal(eventWeight(fly), 0)
    const sp = setPieces(evs, 'cobra')
    assert.equal(sp[0].story, 'cobra:flyby')
    assert.equal(sp[1].outcome, 'done')
    assert.ok(!run(0, 0).some(e => e.type === 'rival'), 'not on the coast')
  })

  it('duels MEGA COBRA in sector 3 (he escapes) and sector 5 (to the end)', () => {
    const ember = run(2, 0)
    const d3 = ember.find(e => e.type === 'rival')
    assert.equal(d3.mode, 'duel')
    assert.equal(d3.hp, rivalHp(3, false))
    const sp3 = setPieces(ember, 'rivalDuel')
    assert.equal(sp3[0].story, 'cobra:arrive')
    assert.equal(sp3[1].outcome, 'escape')
    assert.equal(sp3[1].story, 'cobra:escape')
    assert.ok(Math.abs(sp3[1].t - sp3[0].t - RIVAL.duelTime) < 0.05)
    assert.ok(ember[ember.length - 1].t < TRAVEL_TIME + 0.1, 'sector 3 WARNING on time')

    // sector 5: the final duel holds WARNING until he is down
    const r = createEncounterRunner(4, 0, mulberry32(7))
    const evs = []
    let duelT = -1
    while (!r.done) {
      for (const e of r.step(1 / 30)) {
        evs.push({ ...e })
        if (e.type === 'rival') duelT = e.t
      }
      if (duelT >= 0 && r.t > TRAVEL_TIME + 10 && r.setPiece === 'rivalDuel') r.resolve('rivalDuel', 'down')
    }
    const fin = evs.find(e => e.type === 'rival')
    assert.equal(fin.mode, 'final')
    assert.equal(fin.hp, rivalHp(5, true))
    const sp5 = setPieces(evs, 'rivalDuel')
    assert.equal(sp5[0].story, 'cobra:duel')
    assert.equal(sp5[1].outcome, 'down')
    assert.equal(sp5[1].story, 'cobra:down')
    const warn = evs[evs.length - 1]
    assert.equal(warn.type, 'warning')
    assert.ok(warn.t >= sp5[1].t && warn.t > TRAVEL_TIME + 10)
    assert.ok(sp5[0].t < TRAVEL_TIME, 'the duel starts before the Crown')
  })
})

