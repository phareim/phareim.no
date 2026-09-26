// Mini World's pure core: the save and its actions, placement rules,
// contests, the crown, names and the Neon Shrine hero colours.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './miniworld-load.mjs'

const m = await load()
const { catalog } = m

const ok = (r) => {
  assert.equal(typeof r, 'object', `expected a save, got ${r}`)
  return r
}
const withPerson = (name = 'Ulrikke') => ok(m.createPerson(m.newSave(), name))
const uidOf = (save, id) => save.furniture.find(f => f.id === id).uid
const buyF = (save, id) => {
  const next = ok(m.buyFurniture(save, id))
  return [next, next.furniture.at(-1).uid]
}

// ---------------------------------------------------------------- new save and parse

test('a new save has the starter closet, surfaces and a furnished house, no welcome', () => {
  const s = m.newSave()
  assert.deepEqual(s.closet, catalog.STARTER_CLOSET)
  assert.deepEqual(s.floors, [catalog.STARTER_FLOOR])
  assert.deepEqual(s.walls, [catalog.STARTER_WALL])
  assert.deepEqual(s.furniture.map(f => f.id), catalog.STARTER_FURNITURE)
  assert.equal(s.house.items.length, catalog.STARTER_FURNITURE.length, 'every starter piece placed')
  for (const it of s.house.items) assert.ok(m.canPlace(s, it.uid, it))
  assert.equal(s.persons.length, 0)
  assert.equal(s.active, '')
  assert.ok(!s.prizes.includes('welcome'))
})

test('parseSave round-trips a real save and rejects what is not one', () => {
  let s = withPerson()
  s = ok(m.buyClothing(s, 'cap-red'))
  s = ok(m.dress(s, s.active, 'hat', 'cap-red'))
  s = ok(m.craftWeapon(s, 'wand', 'stars', '#ff8ae0'))
  const back = m.parseSave(JSON.parse(JSON.stringify(s)))
  assert.deepEqual(back, s)
  assert.equal(m.parseSave(null), null)
  assert.equal(m.parseSave({ v: 2 }), null)
  assert.equal(m.parseSave('x'), null)
})

test('parseSave drops unknown ids, extra persons, bad names and unowned clothes', () => {
  const s = withPerson()
  const raw = JSON.parse(JSON.stringify(s))
  raw.closet.push('no-such-shirt', 'tiara')
  raw.floors.push('floor-lava')
  raw.furniture.push({ uid: 'zzzz1111', id: 'no-such-sofa', level: 1 }, { uid: 'bad uid!', id: 'sofa', level: 1 })
  const p = raw.persons[0]
  raw.persons.push(
    { ...p, id: 'p2p2p2p2', name: '<script>' },
    { ...p, id: 'p3p3p3p3', name: 'Emma' },
    { ...p, id: 'p4p4p4p4', name: 'Nora' },
    { ...p, id: 'p5p5p5p5', name: 'Ida' },
  )
  raw.persons[0].look.outfit.top = 'princess-gown' // not owned
  raw.persons[0].look.outfit.hat = 'jeans' // wrong slot
  raw.weapons = [{ uid: 'w1w1w1w1', base: 'nuke', magic: 'stars', color: '#fff000', level: 1, name: 'x' }]
  raw.equipped = 'w1w1w1w1'
  const back = m.parseSave(raw)
  assert.ok(back.closet.includes('tiara'))
  assert.ok(!back.closet.includes('no-such-shirt'))
  assert.ok(!back.floors.includes('floor-lava'))
  assert.equal(back.furniture.length, s.furniture.length)
  assert.equal(back.persons.length, 3, 'three persons at most')
  assert.deepEqual(back.persons.map(x => x.name), ['Ulrikke', 'Emma', 'Nora'])
  assert.equal(back.persons[0].look.outfit.top, 'tee-white', 'unowned top falls back to the starter')
  assert.equal(back.persons[0].look.outfit.hat, null)
  assert.equal(back.weapons.length, 0)
  assert.equal(back.equipped, null)
})

test('parseSave sends layout items that break a rule back to storage', () => {
  let s = m.newSave()
  let sofa
  ;[s, sofa] = buyF(s, 'sofa')
  const raw = JSON.parse(JSON.stringify(s))
  const bed = raw.house.items[0]
  raw.house.items.push({ uid: sofa, x: bed.x, z: bed.z, rot: 0 }) // on top of the bed
  raw.house.items.push({ uid: 'notowned', x: 5, z: 5, rot: 0 })
  raw.house.floor = 'floor-marble' // not owned
  const back = m.parseSave(raw)
  assert.ok(!back.house.items.some(i => i.uid === sofa))
  assert.ok(!back.house.items.some(i => i.uid === 'notowned'))
  assert.equal(back.house.floor, catalog.STARTER_FLOOR)
  assert.equal(back.house.items.length, s.house.items.length)
})

// ---------------------------------------------------------------- persons and clothes

test('persons: name rules, three at most, active moves on delete', () => {
  let s = m.newSave()
  assert.equal(m.createPerson(s, '   '), 'bad-name')
  assert.equal(m.createPerson(s, 'Abcdefghijklm'), 'bad-name')
  assert.equal(m.createPerson(s, 'R2D2'), 'bad-name')
  s = ok(m.createPerson(s, 'Ulrikke'))
  const first = s.active
  assert.deepEqual(s.persons[0].look.outfit, catalog.STARTER_OUTFIT)
  s = ok(m.createPerson(s, 'Ås-Øyvind', { hair: 'afro', hairColor: 'rainbow' }))
  assert.equal(s.persons[1].look.hair, 'afro')
  assert.equal(s.active, s.persons[1].id, 'a new person becomes active')
  s = ok(m.createPerson(s, 'Emma Lie'))
  assert.equal(m.createPerson(s, 'Nora'), 'full')
  s = ok(m.setActive(s, first))
  s = ok(m.deletePerson(s, first))
  assert.equal(s.persons.length, 2)
  assert.equal(s.active, s.persons[0].id)
  assert.equal(m.setActive(s, first), 'no-person')
  s = ok(m.updatePerson(s, s.active, { name: 'Kari', look: { skin: 's5', cheeks: false } }))
  assert.equal(s.persons[0].name, 'Kari')
  assert.equal(s.persons[0].look.skin, 's5')
  assert.equal(m.updatePerson(s, s.active, { look: { skin: 's9' } }), 'bad-look')
})

test('dress: must own, slot must match, only hat/face/back come off', () => {
  let s = withPerson()
  const id = s.active
  assert.equal(m.dress(s, id, 'top', 'dress-party'), 'not-owned')
  s = ok(m.buyClothing(s, 'dress-party'))
  assert.equal(m.dress(s, id, 'hat', 'dress-party'), 'wrong-slot')
  s = ok(m.dress(s, id, 'top', 'dress-party'))
  assert.equal(s.persons[0].look.outfit.top, 'dress-party')
  assert.equal(m.dress(s, id, 'top', null), 'wrong-slot')
  assert.equal(m.dress(s, id, 'nope', 'x'), 'unknown')
  s = ok(m.buyClothing(s, 'sunglasses'))
  s = ok(m.dress(s, id, 'face', 'sunglasses'))
  s = ok(m.dress(s, id, 'face', null))
  assert.equal(s.persons[0].look.outfit.face, null)
})

test('buying: shop pieces only, once for clothes and surfaces, many for furniture', () => {
  let s = m.newSave()
  assert.equal(m.buyClothing(s, 'tee-white'), 'owned')
  assert.equal(m.buyClothing(s, 'crown-king'), 'not-for-sale')
  assert.equal(m.buyClothing(s, 'obby-hoodie'), 'not-for-sale')
  assert.equal(m.buyClothing(s, 'nope'), 'unknown')
  s = ok(m.buyClothing(s, 'tiara'))
  assert.equal(m.buyFurniture(s, 'trophy-easy'), 'not-for-sale')
  s = ok(m.buyFurniture(s, 'sofa'))
  s = ok(m.buyFurniture(s, 'sofa'))
  const sofas = s.furniture.filter(f => f.id === 'sofa')
  assert.equal(sofas.length, 2)
  assert.notEqual(sofas[0].uid, sofas[1].uid)
  assert.equal(m.buyFloor(s, catalog.STARTER_FLOOR), 'owned')
  s = ok(m.buyFloor(s, 'floor-stars'))
  s = ok(m.buyWall(s, 'wall-hearts'))
  s = ok(m.setSurface(s, 'floor', 'floor-stars'))
  assert.equal(s.house.floor, 'floor-stars')
  assert.equal(m.setSurface(s, 'wall', 'wall-rainbow'), 'not-owned')
  assert.equal(m.setSurface(s, 'wall', 'nope'), 'unknown')
})

// ---------------------------------------------------------------- placement

test('footprint turns with the rotation; wall items span along their wall', () => {
  const sofa = catalog.furniture('sofa')
  assert.deepEqual(m.footprint(sofa, { uid: 'a', x: 1, z: 2, rot: 0 }), { x: 1, z: 2, w: 2, d: 1 })
  assert.deepEqual(m.footprint(sofa, { uid: 'a', x: 1, z: 2, rot: 1 }), { x: 1, z: 2, w: 1, d: 2 })
  const lights = catalog.furniture('fairy-lights')
  assert.deepEqual(m.footprint(lights, { uid: 'a', x: 3, z: 0, rot: 1 }), { x: 3, z: 0, w: 2, d: 1 })
})

test('placement: bounds, overlaps, rugs underneath, small things on surfaces, walls', () => {
  let s = m.newSave()
  s = { ...s, house: { ...s.house, items: [] } }
  let sofa, rug, rug2, table, vase, vase2, cake, lights, clock, plant
  ;[s, sofa] = buyF(s, 'sofa')
  ;[s, rug] = buyF(s, 'rug-round')
  ;[s, rug2] = buyF(s, 'rug-star')
  ;[s, table] = buyF(s, 'table-long')
  ;[s, vase] = buyF(s, 'vase')
  ;[s, vase2] = buyF(s, 'lamp-table')
  ;[s, cake] = buyF(s, 'cake')
  ;[s, lights] = buyF(s, 'fairy-lights')
  ;[s, clock] = buyF(s, 'clock')
  ;[s, plant] = buyF(s, 'plant-big')
  const W = m.HOUSE_W, D = m.HOUSE_D
  // bounds, with rotation
  assert.ok(!m.canPlace(s, sofa, { uid: sofa, x: W - 1, z: 0, rot: 0 }))
  assert.ok(m.canPlace(s, sofa, { uid: sofa, x: W - 1, z: 0, rot: 1 }))
  assert.ok(!m.canPlace(s, sofa, { uid: sofa, x: 0, z: D - 1, rot: 1 }))
  assert.ok(!m.canPlace(s, sofa, { uid: sofa, x: -1, z: 0, rot: 0 }))
  s = ok(m.placeItem(s, sofa, { uid: sofa, x: 2, z: 2, rot: 0 }))
  // floor items do not overlap
  assert.ok(!m.canPlace(s, plant, { uid: plant, x: 3, z: 2, rot: 0 }))
  // a rug may lie under the sofa, but not on another rug
  s = ok(m.placeItem(s, rug, { uid: rug, x: 2, z: 2, rot: 0 }))
  assert.equal(m.placeItem(s, rug2, { uid: rug2, x: 3, z: 3, rot: 0 }), 'bad-place')
  // small on the floor acts like a floor item
  assert.ok(!m.canPlace(s, vase, { uid: vase, x: 2, z: 2, rot: 0 }))
  // small things on a surface, within its top and not on each other
  s = ok(m.placeItem(s, table, { uid: table, x: 5, z: 5, rot: 0 }))
  s = ok(m.placeItem(s, vase, { uid: vase, x: 5, z: 5, rot: 0, on: table }))
  assert.ok(!m.canPlace(s, cake, { uid: cake, x: 5, z: 5, rot: 0, on: table }), 'two things in one spot')
  s = ok(m.placeItem(s, cake, { uid: cake, x: 6, z: 5, rot: 0, on: table }))
  assert.ok(!m.canPlace(s, vase2, { uid: vase2, x: 7, z: 5, rot: 0, on: table }), 'off the edge of the table')
  assert.ok(!m.canPlace(s, vase2, { uid: vase2, x: 2, z: 2, rot: 0, on: sofa }), 'a sofa has no top')
  assert.ok(!m.canPlace(s, plant, { uid: plant, x: 5, z: 5, rot: 0, on: table }), 'only small things stand on a surface')
  // wall items: along the wall, z 0, no overlap on the same wall
  s = ok(m.placeItem(s, lights, { uid: lights, x: 0, z: 0, rot: 0 }))
  assert.ok(!m.canPlace(s, clock, { uid: clock, x: 1, z: 0, rot: 0 }))
  assert.ok(m.canPlace(s, clock, { uid: clock, x: 1, z: 0, rot: 3 }), 'another wall is free')
  assert.ok(!m.canPlace(s, clock, { uid: clock, x: D, z: 0, rot: 1 }), 'the side walls are shorter')
  assert.ok(!m.canPlace(s, clock, { uid: clock, x: 2, z: 1, rot: 0 }))
  // moving the table carries what stands on it
  s = ok(m.placeItem(s, table, { uid: table, x: 5, z: 6, rot: 0 }))
  assert.deepEqual(s.house.items.find(i => i.uid === vase), { uid: vase, x: 5, z: 6, rot: 0, on: table })
  // turning it sends them to storage
  s = ok(m.placeItem(s, table, { uid: table, x: 5, z: 5, rot: 1 }))
  assert.ok(!s.house.items.some(i => i.uid === vase || i.uid === cake))
  assert.ok(m.stored(s).some(o => o.uid === vase))
  // storing a surface takes its riders too
  s = ok(m.placeItem(s, vase, { uid: vase, x: 5, z: 5, rot: 0, on: table }))
  s = m.storeItem(s, table)
  assert.ok(!s.house.items.some(i => i.uid === vase || i.uid === table))
  // setLayout checks a whole layout
  assert.equal(m.setLayout(s, { ...s.house, items: [...s.house.items, { uid: plant, x: 2, z: 2, rot: 0 }] }), 'bad-place')
  assert.equal(m.setLayout(s, { ...s.house, items: [...s.house.items, { uid: 'ghost123', x: 9, z: 7, rot: 0 }] }), 'not-owned')
  assert.equal(m.setLayout(s, { ...s.house, floor: 'floor-marble' }), 'not-owned')
  ok(m.setLayout(s, { ...s.house, items: [...s.house.items, { uid: plant, x: 9, z: 7, rot: 0 }] }))
})

test('firstFreeSpot finds room near a point, small things on tables when the floor is full', () => {
  let s = m.newSave()
  let sofa
  ;[s, sofa] = buyF(s, 'sofa')
  const spot = m.firstFreeSpot(s, sofa, { x: 5, z: 4 })
  assert.ok(spot && m.canPlace(s, sofa, spot))
  assert.ok(Math.abs(spot.x - 5) + Math.abs(spot.z - 4) <= 1)
  // fill the floor with tables, then a vase goes on one
  s = { ...s, house: { ...s.house, items: [] } }
  for (let z = 0; z < m.HOUSE_D; z++) {
    for (let x = 0; x < m.HOUSE_W; x++) {
      let t
      ;[s, t] = buyF(s, 'table-round')
      s = ok(m.placeItem(s, t, { uid: t, x, z, rot: 0 }))
    }
  }
  let sofa2, vase, clock
  ;[s, sofa2] = buyF(s, 'sofa')
  assert.equal(m.firstFreeSpot(s, sofa2), null)
  ;[s, vase] = buyF(s, 'vase')
  const on = m.firstFreeSpot(s, vase)
  assert.ok(on && on.on, 'on a table')
  ;[s, clock] = buyF(s, 'clock')
  assert.equal(m.firstFreeSpot(s, clock).rot, 0, 'the back wall first')
})

// ---------------------------------------------------------------- workshop, gifts, prizes

test('upgrades stop at level 3; weapons get names from their parts', () => {
  let s = m.newSave()
  const bed = uidOf(s, 'bed')
  s = ok(m.upgradeFurniture(s, bed))
  s = ok(m.upgradeFurniture(s, bed))
  assert.equal(s.furniture.find(f => f.uid === bed).level, 3)
  assert.equal(m.upgradeFurniture(s, bed), 'max-level')
  assert.equal(m.upgradeFurniture(s, 'nope1234'), 'not-owned')
  assert.equal(m.craftWeapon(s, 'wand', 'stars', 'red'), 'unknown')
  s = ok(m.craftWeapon(s, 'blaster', 'bubbles', '#4FB8FF'))
  const w = s.weapons[0]
  assert.equal(w.name, 'Boble-blaster')
  assert.equal(w.color, '#4fb8ff')
  assert.equal(m.weaponName('wand', 'stars'), 'Stjerne-tryllestav')
  assert.equal(m.weaponName('sword', 'dragon'), 'Drage-sverd')
  s = ok(m.upgradeWeapon(s, w.uid))
  s = ok(m.equip(s, w.uid))
  assert.equal(s.equipped, w.uid)
  assert.equal(m.equip(s, 'nope1234'), 'not-owned')
  s = ok(m.equip(s, null))
  assert.equal(s.equipped, null)
})

test('giving clothes away: worn pieces fall back, the last piece of a slot stays, prizes stay', () => {
  let s = withPerson()
  s = ok(m.createPerson(s, 'Emma'))
  const [a, b] = s.persons.map(p => p.id)
  s = ok(m.buyClothing(s, 'hoodie-pink'))
  s = ok(m.dress(s, a, 'top', 'hoodie-pink'))
  s = ok(m.dress(s, b, 'top', 'tee-blue'))
  s = ok(m.giveAway(s, 'clothing', 'hoodie-pink'))
  assert.ok(!s.closet.includes('hoodie-pink'))
  assert.equal(s.persons[0].look.outfit.top, 'tee-white')
  // giving the starter tee away moves its wearers to the other tee
  s = ok(m.giveAway(s, 'clothing', 'tee-white'))
  assert.equal(s.persons[0].look.outfit.top, 'tee-blue')
  assert.equal(m.giveAway(s, 'clothing', 'tee-blue'), 'last-piece')
  assert.equal(m.giveAway(s, 'clothing', 'jeans'), 'last-piece')
  s = ok(m.buyClothing(s, 'cap-red'))
  s = ok(m.dress(s, b, 'hat', 'cap-red'))
  s = ok(m.giveAway(s, 'clothing', 'cap-red'))
  assert.equal(s.persons[1].look.outfit.hat, null)
  s = m.grantPrizes(s, ['crown-king'])
  assert.equal(m.giveAway(s, 'clothing', 'crown-king'), 'not-giftable')
  assert.equal(m.giveAway(s, 'clothing', 'tiara'), 'not-owned')
  assert.ok(m.isGiftable('clothing', 'tiara'))
  assert.ok(!m.isGiftable('furniture', 'trophy-hard'))
})

test('giving furniture away unplaces it and what stands on it', () => {
  let s = m.newSave()
  let table, vase
  ;[s, table] = buyF(s, 'table-round')
  ;[s, vase] = buyF(s, 'vase')
  s = ok(m.placeItem(s, table, { uid: table, x: 5, z: 5, rot: 0 }))
  s = ok(m.placeItem(s, vase, { uid: vase, x: 5, z: 5, rot: 0, on: table }))
  s = ok(m.giveAway(s, 'furniture', table))
  assert.ok(!s.furniture.some(f => f.uid === table))
  assert.ok(s.furniture.some(f => f.uid === vase), 'the vase is still owned')
  assert.ok(!s.house.items.some(i => i.uid === vase || i.uid === table))
})

test('receiving gifts: once per gift id, furniture keeps its level', () => {
  let s = m.newSave()
  const from = { playerId: 'x', playerName: 'NEON OTTER', personName: 'Emma' }
  s = ok(m.receiveGift(s, { id: 'gift0001', from, kind: 'clothing', item: 'tiara', sentAt: 1 }))
  assert.ok(s.closet.includes('tiara'))
  assert.equal(m.receiveGift(s, { id: 'gift0001', from, kind: 'clothing', item: 'tiara', sentAt: 1 }), 'opened')
  s = ok(m.receiveGift(s, { id: 'gift0002', from, kind: 'furniture', item: 'piano', level: 3, sentAt: 2 }))
  assert.deepEqual(s.furniture.at(-1).id, 'piano')
  assert.equal(s.furniture.at(-1).level, 3)
  s = ok(m.receiveGift(s, { id: 'gift0003', from, kind: 'bits', amount: 20, sentAt: 3 }))
  assert.deepEqual(s.openedGifts, ['gift0001', 'gift0002', 'gift0003'])
  assert.equal(m.receiveGift(s, { id: 'gift0004', from, kind: 'furniture', item: 'nope', sentAt: 4 }), 'unknown')
})

test('grantPrizes gives each id once; non-catalog ids are only remembered', () => {
  let s = m.newSave()
  s = m.grantPrizes(s, ['welcome', 'obby-hoodie', 'trophy-easy'])
  assert.ok(s.closet.includes('obby-hoodie'))
  assert.equal(s.furniture.filter(f => f.id === 'trophy-easy').length, 1)
  s = m.grantPrizes(s, ['trophy-easy', 'welcome'])
  assert.equal(s.furniture.filter(f => f.id === 'trophy-easy').length, 1)
  assert.deepEqual(s.prizes, ['welcome', 'obby-hoodie', 'trophy-easy'])
})

test('publicData shows the active person and only placed furniture', () => {
  let s = withPerson()
  let sofa
  ;[s, sofa] = buyF(s, 'sofa')
  const d = m.publicData(s)
  assert.equal(d.person.name, 'Ulrikke')
  assert.equal(d.kinds[sofa], undefined)
  assert.equal(Object.keys(d.kinds).length, s.house.items.length)
})

// ---------------------------------------------------------------- contests

test('obby pays by level, a best-time bonus, and trophies on the first finish', () => {
  let s = withPerson()
  let r = m.finishContest(s, { contest: 'obby', level: 'easy', seconds: 61.24 })
  assert.equal(r.bits, 15 + 10)
  assert.ok(r.newBest && r.firstWin)
  assert.deepEqual(r.prizes, ['trophy-easy', 'obby-hoodie'])
  assert.ok(r.save.closet.includes('obby-hoodie'))
  s = r.save
  r = m.finishContest(s, { contest: 'obby', level: 'easy', seconds: 70 })
  assert.equal(r.bits, 15)
  assert.ok(!r.newBest && !r.firstWin)
  assert.deepEqual(r.prizes, [])
  assert.equal(r.save.contests.obby.easy.best, 61.2)
  assert.equal(r.save.contests.obby.easy.plays, 2)
  r = m.finishContest(r.save, { contest: 'obby', level: 'hard', seconds: 200 })
  assert.equal(r.bits, 70)
  assert.deepEqual(r.prizes, ['trophy-hard'])
})

test('star hunt: bits per star (capped), the star prizes once at 30', () => {
  const s = withPerson()
  assert.equal(m.finishContest(s, { contest: 'stars', stars: 12 }).bits, 12)
  assert.equal(m.finishContest(s, { contest: 'stars', stars: 60 }).bits, 45)
  const won = m.finishContest(s, { contest: 'stars', stars: 31 })
  assert.deepEqual(won.prizes, ['trophy-stars', 'star-top', 'skirt-star'])
  assert.ok(won.firstWin)
  const again = m.finishContest(won.save, { contest: 'stars', stars: 33 })
  assert.deepEqual(again.prizes, [])
  assert.equal(again.save.contests.stars.best, 33)
  assert.equal(again.save.contests.stars.wins, 2)
})

test('fashion: bits are twice the stars, the prizes once at 12', () => {
  const s = withPerson()
  assert.equal(m.finishContest(s, { contest: 'fashion', stars: 9 }).bits, 18)
  const won = m.finishContest(s, { contest: 'fashion', stars: 13 })
  assert.deepEqual(won.prizes, ['trophy-fashion', 'shoes-gold'])
})

test('memory: fewer moves pay more (at least 5), prizes on the first 10-pair win', () => {
  const s = withPerson()
  assert.equal(m.finishContest(s, { contest: 'memory', pairs: 6, moves: 6 }).bits, 18)
  assert.equal(m.finishContest(s, { contest: 'memory', pairs: 6, moves: 30 }).bits, 5)
  assert.deepEqual(m.finishContest(s, { contest: 'memory', pairs: 8, moves: 10 }).prizes, [])
  const won = m.finishContest(s, { contest: 'memory', pairs: 10, moves: 14 })
  assert.equal(won.bits, 26)
  assert.deepEqual(won.prizes, ['trophy-memory', 'star-glasses'])
})

test('scoreFashion: deterministic, matches raise the stars, a full outfit helps', () => {
  const look = withPerson().persons[0].look
  const princess = { ...look, outfit: { ...look.outfit, top: 'princess-gown', shoes: 'shoes-party', hat: 'tiara', back: 'fairy-wings' } }
  const a = m.scoreFashion(princess, 'prinsesse', 42)
  assert.deepEqual(a, m.scoreFashion(princess, 'prinsesse', 42))
  assert.equal(a.matches.length, 4)
  assert.ok(a.total >= 12, `princess look scores ${a.total}`)
  for (const j of a.judges) {
    assert.ok(j.stars >= 1 && j.stars <= 5)
    assert.ok(typeof j.reason === 'string' && j.reason.length)
  }
  // across many seeds a matching look always beats the plain one
  for (let seed = 1; seed < 40; seed++) {
    const plain = m.scoreFashion(look, 'prinsesse', seed)
    assert.ok(plain.total <= 9, 'the starter look is no princess')
    assert.ok(m.scoreFashion(princess, 'prinsesse', seed).total > plain.total)
  }
  // the bottom does not count under a gown
  assert.ok(!m.wornPieces(princess.outfit).includes(princess.outfit.bottom))
})

test('drawFashionTheme is seeded and prefers themes the closet can dress', () => {
  assert.equal(m.drawFashionTheme(7), m.drawFashionTheme(7))
  const closet = [...catalog.STARTER_CLOSET]
  for (let seed = 0; seed < 30; seed++) assert.equal(m.drawFashionTheme(seed, closet), 'sport')
})

test('memoryDeck: pairs of different pictures, shuffled by seed', () => {
  for (const pairs of m.MEMORY_SIZES) {
    const deck = m.memoryDeck(pairs, 99)
    assert.equal(deck.length, pairs * 2)
    const counts = new Map()
    for (const c of deck) counts.set(c.id, (counts.get(c.id) ?? 0) + 1)
    assert.equal(counts.size, pairs)
    for (const n of counts.values()) assert.equal(n, 2)
    for (const c of deck) assert.ok(c.kind === 'clothing' ? catalog.clothing(c.id) : catalog.furniture(c.id))
  }
  assert.deepEqual(m.memoryDeck(8, 5), m.memoryDeck(8, 5))
  assert.notDeepEqual(m.memoryDeck(8, 5), m.memoryDeck(8, 6))
})

// ---------------------------------------------------------------- royal

test('the ruler has most votes; ties go to who joined first; no votes, no ruler', () => {
  assert.equal(m.rulerOf([{ playerId: 'a', votes: 0, joinedAt: 1 }]), null)
  assert.equal(m.rulerOf([{ playerId: 'a', votes: 1, joinedAt: 2 }, { playerId: 'b', votes: 2, joinedAt: 3 }]), 'b')
  assert.equal(m.rulerOf([{ playerId: 'a', votes: 2, joinedAt: 5 }, { playerId: 'b', votes: 2, joinedAt: 3 }]), 'b')
  const counts = m.countVotes([{ playerId: 'a', voteFor: 'b' }, { playerId: 'b', voteFor: 'b' }, { playerId: 'c', voteFor: 'gone' }])
  assert.equal(counts.get('b'), 2)
  assert.equal(counts.get('c'), 0)
})

test('titles: the ruler crowns themself and gives the rest, one king and one queen', () => {
  const holders = [{ playerId: 'r', title: null }, { playerId: 'x', title: null }, { playerId: 'y', title: null }]
  assert.equal(m.crown(holders, 'r', 'x', 'king'), 'not-ruler')
  assert.equal(m.crown(holders, 'r', 'r', 'prince'), 'bad-title')
  let t = m.crown(holders, 'r', 'r', 'king')
  assert.equal(t[0].title, 'king')
  assert.deepEqual(m.givableTitles('king'), ['queen', 'prince', 'princess'])
  assert.deepEqual(m.givableTitles(null), ['prince', 'princess'])
  assert.equal(m.giveTitle(t, 'r', 'r', 'x', 'king'), 'bad-title')
  t = m.giveTitle(t, 'r', 'r', 'x', 'queen')
  assert.equal(t[1].title, 'queen')
  assert.equal(m.giveTitle(t, 'r', 'r', 'y', 'queen'), 'title-taken')
  t = m.giveTitle(t, 'r', 'r', 'y', 'princess')
  assert.equal(t[2].title, 'princess')
  assert.equal(m.giveTitle(t, 'r', 'x', 'y', 'prince'), 'not-ruler')
  assert.equal(m.giveTitle(t, 'r', 'r', 'r', 'prince'), 'bad-title')
  assert.equal(m.giveTitle(t, 'r', 'r', 'z', 'prince'), 'not-member')
  t = m.giveTitle(t, 'r', 'r', 'y', null)
  assert.equal(t[2].title, null)
  // a new ruler taking the queen's crown takes it from the old queen
  const t2 = m.crown(t, 'y', 'y', 'queen')
  assert.equal(t2.find(h => h.playerId === 'x').title, null)
  assert.equal(t2.find(h => h.playerId === 'y').title, 'queen')
})

test('royal prizes: crowns and capes by title, a banner for all, all in the catalog', () => {
  assert.deepEqual(m.royalPrizes('king'), ['crown-king', 'royal-cape', 'royal-banner'])
  assert.deepEqual(m.royalPrizes('queen'), ['crown-queen', 'royal-robe', 'royal-banner'])
  assert.deepEqual(m.royalPrizes('prince'), ['crown-prince', 'royal-banner'])
  assert.deepEqual(m.royalPrizes('princess'), ['tiara-princess', 'royal-banner'])
  for (const t of m.TITLES) {
    for (const id of m.royalPrizes(t)) assert.ok(catalog.clothing(id) || catalog.furniture(id), id)
  }
})

// ---------------------------------------------------------------- names

test('cleanName: letters incl. ÆØÅ, space, hyphen, 1–12, trimmed', () => {
  assert.equal(m.cleanName('  Ulrikke  '), 'Ulrikke')
  assert.equal(m.cleanName('Åse-Marie'), 'Åse-Marie')
  assert.equal(m.cleanName('Emma   Lie'), 'Emma Lie')
  assert.equal(m.cleanName('Zoë'), null, 'the pixel font cannot draw ë')
  assert.equal(m.cleanName('José'), 'José')
  assert.equal(m.cleanName(''), null)
  assert.equal(m.cleanName('-'), null)
  assert.equal(m.cleanName('Tolvbokstaver'), null)
  assert.equal(m.cleanName('Tolvbokstave'), 'Tolvbokstave')
  assert.equal(m.cleanName('Kari<3'), null)
  assert.equal(m.cleanName(42), null)
})

test('codes: six letters without I, O, Q; typed codes are cleaned', () => {
  for (const ch of 'IOQ01') assert.ok(!m.CODE_ALPHABET.includes(ch))
  for (let i = 0; i < 50; i++) assert.ok(m.isCode(m.randomCode()))
  assert.equal(m.cleanCode(' abc def '), 'ABCDEF')
  assert.equal(m.cleanCode('ABCDEI'), null)
  assert.equal(m.cleanCode('ABCDE'), null)
})

test('hood names: at least 20 × 10 compounds that read as one place', () => {
  assert.ok(m.HOOD_FIRST.length >= 20)
  assert.ok(m.HOOD_PLACE.length >= 10)
  const rng = m.seeded(3)
  const names = new Set()
  for (let i = 0; i < 200; i++) {
    const n = m.hoodName(rng)
    assert.match(n, /^[A-ZÆØÅ][a-zæøå]+$/)
    names.add(n)
  }
  assert.ok(names.size > 100)
  assert.ok(m.HOOD_FIRST.includes('Solsikke') && m.HOOD_PLACE.includes('dalen'))
})

// ---------------------------------------------------------------- outfit

test('hero colours follow the look: dress covers the legs, rainbow hair is pink over violet, a hat is the band', () => {
  const look = withPerson().persons[0].look
  const c = m.heroColorsFor(look)
  const hex = /^#[0-9a-f]{6}$/i
  for (const v of Object.values(c)) assert.match(v, hex)
  assert.equal(c.top, catalog.clothing('tee-white').colors.main)
  assert.equal(c.bottom, catalog.clothing('jeans').colors.main)
  assert.equal(c.band, c.hair, 'no hat: the band is the hair')
  const fancy = { ...look, hairColor: 'rainbow', outfit: { ...look.outfit, top: 'dress-party', hat: 'cap-red' } }
  const f = m.heroColorsFor(fancy)
  assert.equal(f.hair, '#ff6fb0')
  assert.equal(f.hairShade, '#a86fff')
  assert.equal(f.band, catalog.clothing('cap-red').colors.main)
  assert.equal(f.top, catalog.clothing('dress-party').colors.main)
  assert.notEqual(f.bottom, catalog.clothing('jeans').colors.main, 'the dress hides the jeans')
  const bald = m.heroColorsFor({ ...look, hair: 'none' })
  assert.equal(bald.hair, bald.skin)
})
