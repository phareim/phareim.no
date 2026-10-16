// Space Voyagers II: the campaign (themes/voyagers2/engine/campaign.ts,
// missions.ts, story/hub.ts): the tree, the save, the words between sorties,
// and that each kind of sortie can be won by the test pilot (and lost).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { TREE, ACTS, newSave, afterSortie, readSave, isEnd, SORTIE_TITLES } from '../themes/voyagers2/engine/campaign.ts'
import { MISSIONS } from '../themes/voyagers2/engine/missions.ts'
import { createWorld, step, calzone } from '../themes/voyagers2/engine/world.ts'
import { createBot, botInput } from '../themes/voyagers2/engine/bot.ts'
import { live } from '../themes/voyagers2/engine/ships.ts'
import { BRIEFINGS, DEBRIEFS, TALKS, GENERIC, HOROSCOPE, ROOMS, ENDINGS } from '../themes/voyagers2/story/hub.ts'
import { SPEAKERS } from '../themes/voyagers2/story/cues.ts'

const IDS = Object.keys(TREE)

test('every way through the tree is eight sorties to an ending, and each act has one deciding sortie', () => {
  const walk = (id, n, path) => {
    if (isEnd(id)) { assert.equal(n, 8, `ends after ${n}: ${path.join(' > ')}`); return 1 }
    const node = TREE[id]
    assert.ok(node, id)
    return walk(node.won, n + 1, [...path, id + '+']) + (node.won === node.lost ? 0 : walk(node.lost, n + 1, [...path, id + '-']))
  }
  assert.equal(walk('firstshift', 0, []), 8, 'two deciding sorties and two endings: eight ways through')
  for (const act of [1, 2, 3]) {
    const deciding = IDS.filter(id => TREE[id].act === act && TREE[id].decides)
    assert.ok(deciding.length <= 1, `act ${act}`)
  }
  assert.equal(ACTS.length, 4)
})

test('every sortie has its mission, its title, a briefing, a debrief for both outcomes and a horoscope', () => {
  for (const id of IDS) {
    const m = MISSIONS[id]
    assert.ok(m, id)
    assert.equal(m.id, id)
    assert.equal(m.act, TREE[id].act, `${id}: act`)
    assert.equal(SORTIE_TITLES[id], m.title)
    assert.ok(BRIEFINGS[id] && BRIEFINGS[id].says.length > 0, `${id}: briefing`)
    assert.ok(DEBRIEFS[id]?.won.length && DEBRIEFS[id]?.lost.length, `${id}: debrief`)
    assert.ok(HOROSCOPE[id], `${id}: horoscope`)
  }
})

test('the words between sorties fit their box and every face is on disk', () => {
  const says = []
  for (const b of Object.values(BRIEFINGS)) says.push(...b.says)
  for (const t of Object.values(TALKS)) for (const talk of Object.values(t)) {
    says.push(...talk.says)
    for (const c of talk.choice ?? []) { assert.ok(c.label.length <= 22, c.label); says.push(...c.reply) }
  }
  for (const d of Object.values(DEBRIEFS)) says.push(...d.won, ...d.lost)
  for (const g of Object.values(GENERIC)) says.push(...g)
  for (const s of says) {
    assert.ok(s.text.length <= 120, `${s.text.length}: ${s.text}`)
    assert.equal(s.text, s.text.toUpperCase())
    if (s.who === 'you' || s.who === 'partner') continue
    const sp = SPEAKERS[s.who]
    assert.ok(sp, s.who)
    const mood = s.mood ?? sp.moods[0]
    assert.ok(sp.moods.includes(mood), `${s.who} has no mood ${mood}`)
    assert.ok(existsSync(`public/${sp.dir}/portrait-${s.who}-${mood}.png`), `${s.who}-${mood}`)
  }
  for (const r of Object.values(ROOMS)) for (const p of r.people) assert.ok(SPEAKERS[p], p)
  for (const l of [...ENDINGS.won, ...ENDINGS.lost]) assert.ok(l.length <= 60, l)
})

test('the save: a sortie moves it along the tree and adds the score; it survives a trip through storage; junk is refused', () => {
  let s = newSave('nova')
  s = afterSortie(s, 'firstshift', 'won', 5000, 12)
  assert.equal(s.next, 'convoy')
  assert.equal(s.score, 5000)
  s = afterSortie(s, 'convoy', 'lost', 1000, 3)
  s = afterSortie(s, 'siege', 'lost', 2000, 4)
  assert.equal(s.next, 'spilled', 'losing the deciding sortie takes the losing track')
  assert.equal(s.history.length, 3)
  assert.ok(s.morale < 0.6)
  const back = readSave(JSON.stringify(s))
  assert.deepEqual(back, s)
  assert.equal(readSave('{"version":2}'), null)
  assert.equal(readSave('nonsense'), null)
  assert.equal(readSave(JSON.stringify({ ...s, next: 'nowhere' })), null)
})

/** Fly a sortie with a bot to the end. */
function fly(id, profile, seed, until = null) {
  const w = createWorld({ seed, mission: MISSIONS[id], pilot: seed % 2 ? 'rex' : 'nova' })
  const bot = createBot(profile, seed)
  for (let i = 0; i < 60 * 60 * 7 && w.mission.stage !== 'done'; i++) {
    step(w, botInput(bot, w))
    if (until && until(w)) return w
  }
  return w
}
const winsOnSome = (id, profile = 'sharp', seeds = [1, 2, 3]) => seeds.map(s => fly(id, profile, s)).filter(w => w.mission.result === 'won')

test('each kind of sortie can be won: kill (the outlet), protect (the convoy), defend (the oven), duel (the prince)', () => {
  for (const id of ['takeout', 'convoy', 'siege', 'dare']) {
    const won = winsOnSome(id)
    assert.ok(won.length > 0, `${id}: no sharp run of three won`)
  }
  const t = winsOnSome('takeout')[0]
  assert.ok(t.mission.flags.killed)
})

test('Hans Duo turns his guns on the Calzone at the second nav point', () => {
  const w = fly('hansshot', 'casual', 2, w => w.ships.some(s => s.pilot === 'duo' && s.side === 'them'))
  const duo = w.ships.find(s => s.pilot === 'duo')
  assert.ok(duo, 'Hans is in the sortie')
  assert.equal(duo.side, 'them')
  assert.equal(duo.target, w.player)
})

test('the finale ends when the vent goes, with the VOLCANO; the Hut is never a target', () => {
  const won = winsOnSome('finale', 'sharp', [1, 2, 3, 4])
  assert.ok(won.length > 0, 'a sharp run delivers')
  assert.equal(won[0].mission.why, 'delivered')
  const w = fly('finale', 'sharp', 1, w => w.ships.some(s => s.kind === 'hut'))
  const me = calzone(w)
  const hut = w.ships.find(s => s.kind === 'hut')
  for (let i = 0; i < 600; i++) { step(w, { pitch: 0, yaw: 0, roll: 0, burn: false, brake: false, fire: false, missile: false, nextTarget: i % 10 === 0, attacker: false, swap: false, auto: false, order: null, pick: hut.id, touch: false }); assert.notEqual(me.target, hut.id) }
})

test('help comes to the Deep Dish in the last slice, and the enemy runs', () => {
  const w = fly('lastslice', 'casual', 1, w => w.mission.flags.helped)
  assert.ok(w.mission.flags.helped)
  assert.ok(w.ships.some(s => s.kind === 'rig' && s.side === 'us' && live(s)))
})
