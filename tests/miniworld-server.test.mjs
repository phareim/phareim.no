// The wallet and Mini World's neighbourhood API rules, driven against both
// stores: the memory store (dev) and the D1 store's real SQL on node's
// built-in SQLite with the repo's migrations.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { load } from './miniworld-load.mjs'

const m = await load()
// node:sqlite arrived in Node 22.5; without it only the memory store runs.
const d1 = await import('./miniworld-d1.mjs').then(x => x.d1, () => null)

/** Every private id made by world(); no answer may carry one but the caller's own. */
const privateIds = new Set()
let answers = 0

/**
 * The route rules, with every answer checked for leaks: the caller is
 * named by private id (playerId, or viewer for a house, or player for
 * their own state/wallet); any other private id in the JSON fails the test.
 */
const api = new Proxy(m.api, {
  get(target, name) {
    const fn = target[name]
    if (typeof name !== 'string' || !/(Get|Post)$/.test(name)) return fn
    return async (store, input, ...rest) => {
      const out = await fn(store, input, ...rest)
      const caller = input?.viewer ?? input?.playerId ?? input?.player
      const json = JSON.stringify(out)
      for (const id of privateIds) {
        if (id !== caller) assert.ok(!json.includes(id), `${name} answered another player's private id`)
      }
      answers++
      return out
    }
  },
})

/** A fresh memory store with `n` registered players. */
function memoryWorld(n) {
  const players = new Map()
  const ids = []
  for (let i = 0; i < n; i++) {
    const id = randomUUID()
    players.set(id, { name: `PLAYER ${i}` })
    ids.push(id)
    privateIds.add(id)
  }
  return { store: new m.MemoryMwStore(async id => players.get(id) ?? null), ids }
}

/** A fresh SQLite database behind the D1 store, with `n` registered players. */
function d1World(n) {
  const db = d1()
  const ids = []
  for (let i = 0; i < n; i++) {
    const id = randomUUID()
    db.raw.prepare('INSERT INTO players (id, name) VALUES (?, ?)').run(id, `PLAYER ${i}`)
    ids.push(id)
    privateIds.add(id)
  }
  return { store: new m.D1MwStore(db), ids }
}

async function rejects(p, status, code) {
  await assert.rejects(p, (e) => {
    assert.ok(e instanceof api.MwError, `expected MwError, got ${e}`)
    assert.equal(e.code, code)
    assert.equal(e.status, status)
    return true
  })
}

const op = (id, delta, reason = 'test') => ({ id, delta, reason })
/** A player's public id, as other players know them. */
const pub = async (store, id) => (await store.publicIds([id])).get(id)

for (const [kind, world] of [['memory', memoryWorld], ...(d1 ? [['d1', d1World]] : [])]) {
describe(kind, () => {
  // ---------------------------------------------------------------- wallet

  test('wallet: each op id applies once, balance clamped to 0..99 999', async () => {
    const { store, ids: [a] } = world(1)
    assert.deepEqual(await api.walletGet(store, { player: a }), { bits: 0 })
    assert.deepEqual(await api.walletPost(store, { playerId: a, ops: [op('aaaaaaaa1', 50), op('aaaaaaaa2', -20)] }), { bits: 30 })
    // a retry of the same request changes nothing
    assert.deepEqual(await api.walletPost(store, { playerId: a, ops: [op('aaaaaaaa1', 50), op('aaaaaaaa2', -20)] }), { bits: 30 })
    // a duplicate id inside one request counts once
    assert.deepEqual(await api.walletPost(store, { playerId: a, ops: [op('bbbbbbbb1', 5), op('bbbbbbbb1', 5)] }), { bits: 35 })
    assert.deepEqual(await api.walletPost(store, { playerId: a, ops: [op('cccccccc1', -2000)] }), { bits: 0 })
    const many = Array.from({ length: 50 }, (_, i) => op(`dddddddd${i}`, 2000))
    assert.deepEqual(await api.walletPost(store, { playerId: a, ops: many }), { bits: 99_999 })
    assert.deepEqual(await api.walletPost(store, { playerId: a, ops: [] }), { bits: 99_999 })
  })

  test('wallet: bad requests are refused', async () => {
    const { store, ids: [a] } = world(1)
    await rejects(api.walletPost(store, { playerId: 'nope', ops: [] }), 400, 'bad-player')
    await rejects(api.walletPost(store, { playerId: a, ops: 'x' }), 400, 'bad-ops')
    await rejects(api.walletPost(store, { playerId: a, ops: Array.from({ length: 51 }, (_, i) => op(`eeeeeeee${i}`, 1)) }), 400, 'bad-ops')
    await rejects(api.walletPost(store, { playerId: a, ops: [op('ffffffff1', 2001)] }), 400, 'bad-op')
    await rejects(api.walletPost(store, { playerId: a, ops: [op('ffffffff1', 1.5)] }), 400, 'bad-op')
    await rejects(api.walletPost(store, { playerId: a, ops: [op('BAD ID', 1)] }), 400, 'bad-op')
    await rejects(api.walletPost(store, { playerId: randomUUID(), ops: [] }), 404, 'no-player')
    await rejects(api.walletGet(store, { player: randomUUID() }), 404, 'no-player')
  })

  // ---------------------------------------------------------------- profiles and friends

  async function profileOf(store, id, name = 'Ulrikke') {
    let s = m.createPerson(m.newSave(), name)
    const data = m.publicData(s)
    await api.profilePost(store, { playerId: id, ...data })
    return s
  }

  test('state makes a friend code once; a profile is cleaned before it is stored', async () => {
    const { store, ids: [a, b] } = world(2)
    const s1 = await api.stateGet(store, { player: a })
    assert.ok(m.isCode(s1.me.code))
    assert.equal((await api.stateGet(store, { player: a })).me.code, s1.me.code)
    assert.deepEqual(s1.friends, [])
    assert.equal(s1.hood, null)
    assert.deepEqual(s1.inbox, [])

    const save = await profileOf(store, b)
    const junk = m.publicData(save)
    junk.kinds = { ...junk.kinds, hacked01: 'no-such-thing', hacked02: 'sofa' } // hacked02 is not placed
    junk.house = { ...junk.house, floor: 'floor-lava' }
    await api.profilePost(store, { playerId: b, ...junk })
    const { friend } = await api.friendPost(store, { playerId: a, code: (await api.stateGet(store, { player: b })).me.code })
    assert.equal(friend.person.name, 'Ulrikke')
    assert.equal(friend.house.floor, 'floor-wood')
    assert.deepEqual(Object.keys(friend.kinds).sort(), save.house.items.map(i => i.uid).sort())

    await rejects(api.profilePost(store, { playerId: b, person: { name: '<b>', look: save.persons[0].look }, house: null, levels: {}, kinds: {} }), 400, 'bad-person')
    await rejects(api.profilePost(store, { playerId: b, person: null, house: null, levels: {}, kinds: {}, pad: 'x'.repeat(25_000) }), 413, 'too-large')
    await rejects(api.profilePost(store, { playerId: randomUUID(), person: null }), 404, 'no-player')
  })

  test('friends: both ways at once by code, not yourself, at most 30, unfriend both ways', async () => {
    const { store, ids } = world(33)
    const [a, b] = ids
    const codeB = (await api.stateGet(store, { player: b })).me.code
    const codeA = (await api.stateGet(store, { player: a })).me.code
    await rejects(api.friendPost(store, { playerId: a, code: codeA }), 409, 'self')
    await rejects(api.friendPost(store, { playerId: a, code: 'ABC' }), 400, 'bad-code')
    await rejects(api.friendPost(store, { playerId: a, code: 'ZZZZZZ' === codeB ? 'YYYYYY' : 'ZZZZZZ' }), 404, 'not-found')
    const r = await api.friendPost(store, { playerId: a, code: codeB.toLowerCase() })
    const pubB = await pub(store, b)
    assert.match(pubB, /^[a-z0-9]{12}$/)
    assert.equal(r.friend.id, pubB)
    assert.equal(await pub(store, b), pubB, 'stable')
    assert.equal(r.already, false)
    assert.equal((await api.friendPost(store, { playerId: a, code: codeB })).already, true)
    const stateB = await api.stateGet(store, { player: b })
    assert.deepEqual(stateB.friends.map(f => f.id), [await pub(store, a)])
    assert.equal(stateB.me.id, pubB, 'I know my own public id')
    // 30 at most
    for (const other of ids.slice(2, 31)) {
      const code = (await api.stateGet(store, { player: other })).me.code
      await api.friendPost(store, { playerId: a, code })
    }
    assert.equal((await store.friendIds(a)).length, 30)
    const lastCode = (await api.stateGet(store, { player: ids[31] })).me.code
    await rejects(api.friendPost(store, { playerId: a, code: lastCode }), 409, 'friends-full')
    await rejects(api.friendPost(store, { playerId: ids[31], code: codeA }), 409, 'friends-full')
    await rejects(api.unfriendPost(store, { playerId: b, friendId: a }), 400, 'bad-player')
    await api.unfriendPost(store, { playerId: b, friendId: await pub(store, a) })
    assert.ok(!(await store.friendIds(a)).includes(b))
    assert.ok(!(await store.friendIds(b)).includes(a))
  })

  test('friends by public id (met in the shared world): no code, both ways, not yourself', async () => {
    const { store, ids: [a, b, c] } = world(3)
    await api.stateGet(store, { player: a })
    const pubB = await pub(store, b) // b has never opened the neighbourhood: no profile row yet
    await rejects(api.friendPost(store, { playerId: a, id: 'no such id!' }), 400, 'bad-player')
    await rejects(api.friendPost(store, { playerId: a, id: 'zzzzzzzzzzzz' === pubB ? 'yyyyyyyyyyyy' : 'zzzzzzzzzzzz' }), 404, 'not-found')
    await rejects(api.friendPost(store, { playerId: a, id: await pub(store, a) }), 409, 'self')
    const r = await api.friendPost(store, { playerId: a, id: pubB })
    assert.equal(r.friend.id, pubB)
    assert.equal(r.already, false)
    assert.ok(m.isCode(r.friend.code), 'b got a friend code on the way')
    assert.deepEqual((await api.stateGet(store, { player: b })).friends.map(f => f.id), [await pub(store, a)])
    assert.equal((await api.friendPost(store, { playerId: b, id: await pub(store, a) })).already, true)
    // the code still works next to it
    const codeC = (await api.stateGet(store, { player: c })).me.code
    assert.equal((await api.friendPost(store, { playerId: a, code: codeC })).already, false)
  })

  // ---------------------------------------------------------------- neighbourhood

  test('hood lifecycle: create, join by code, one hood each, votes, ruler, titles, leave', async () => {
    const { store, ids } = world(14)
    const [a, b, c, d] = ids
    const [pa, pb, pc, pd] = await Promise.all([a, b, c, d].map(id => pub(store, id)))
    let t = 1000
    const { hood } = await api.hoodPost(store, { playerId: a, action: 'create' }, t++)
    assert.match(hood.name, /^[A-ZÆØÅ][a-zæøå]+$/)
    assert.ok(m.isCode(hood.code))
    assert.equal(hood.members.length, 1)
    assert.equal(hood.ruler, null, 'no votes, no ruler')
    await rejects(api.hoodPost(store, { playerId: a, action: 'create' }, t++), 409, 'in-hood')
    await rejects(api.hoodPost(store, { playerId: b, action: 'join', code: 'ZZZZZZ' === hood.code ? 'YYYYYY' : 'ZZZZZZ' }, t++), 404, 'not-found')
    for (const p of [b, c]) await api.hoodPost(store, { playerId: p, action: 'join', code: hood.code }, t++)
    // joining your own hood again is harmless
    assert.equal((await api.hoodPost(store, { playerId: b, action: 'join', code: hood.code }, t++)).hood.members.length, 3)
    // d has its own hood and must leave it first
    await api.hoodPost(store, { playerId: d, action: 'create' }, t++)
    await rejects(api.hoodPost(store, { playerId: d, action: 'join', code: hood.code }, t++), 409, 'in-hood')

    // votes: a tie goes to who joined first
    await rejects(api.hoodPost(store, { playerId: b, action: 'vote', target: c }, t++), 400, 'bad-player')
    let h = (await api.hoodPost(store, { playerId: b, action: 'vote', target: pc }, t++)).hood
    assert.equal(h.ruler, pc)
    assert.equal(h.myVote, pc)
    h = (await api.hoodPost(store, { playerId: c, action: 'vote', target: pb }, t++)).hood
    assert.equal(h.ruler, pb, 'b joined before c')
    h = (await api.hoodPost(store, { playerId: a, action: 'vote', target: pc }, t++)).hood
    assert.equal(h.ruler, pc)
    assert.equal(h.members.find(x => x.id === pc).votes, 2)
    await rejects(api.hoodPost(store, { playerId: a, action: 'vote', target: pd }, t++), 409, 'not-member')
    await rejects(api.hoodPost(store, { playerId: a, action: 'vote', target: 'nobody000000' }, t++), 404, 'not-found')

    // titles
    await rejects(api.hoodPost(store, { playerId: a, action: 'crown', title: 'king' }, t++), 403, 'not-ruler')
    await rejects(api.hoodPost(store, { playerId: c, action: 'crown', title: 'prince' }, t++), 400, 'bad-title')
    h = (await api.hoodPost(store, { playerId: c, action: 'crown', title: 'queen' }, t++)).hood
    assert.equal(h.members.find(x => x.id === pc).title, 'queen')
    await rejects(api.hoodPost(store, { playerId: c, action: 'title', target: pa, title: 'queen' }, t++), 400, 'bad-title')
    h = (await api.hoodPost(store, { playerId: c, action: 'title', target: pa, title: 'king' }, t++)).hood
    assert.equal(h.members.find(x => x.id === pa).title, 'king')
    await rejects(api.hoodPost(store, { playerId: c, action: 'title', target: pb, title: 'king' }, t++), 409, 'title-taken')
    h = (await api.hoodPost(store, { playerId: c, action: 'title', target: pb, title: 'princess' }, t++)).hood
    await rejects(api.hoodPost(store, { playerId: a, action: 'title', target: pb, title: null }, t++), 403, 'not-ruler')
    await rejects(api.hoodPost(store, { playerId: c, action: 'title', target: pd, title: 'prince' }, t++), 409, 'not-member')
    await rejects(api.hoodPost(store, { playerId: c, action: 'title', target: pb, title: 'emperor' }, t++), 400, 'bad-title')

    // the ruler leaves: their votes go, the crown moves on, the hood lives
    await api.hoodPost(store, { playerId: c, action: 'leave' }, t++)
    h = (await api.stateGet(store, { player: a })).hood
    assert.equal(h.members.length, 2)
    assert.equal(h.ruler, null, 'the only votes were for c')
    assert.equal(h.myVote, null)
    // the last one out closes the hood and frees its code
    await api.hoodPost(store, { playerId: a, action: 'leave' }, t++)
    await api.hoodPost(store, { playerId: b, action: 'leave' }, t++)
    await rejects(api.hoodPost(store, { playerId: d, action: 'join', code: hood.code }, t++), 404, 'not-found')
    await rejects(api.hoodPost(store, { playerId: a, action: 'vote', target: pb }, t++), 409, 'no-hood')
    await rejects(api.hoodPost(store, { playerId: a, action: 'dance' }, t++), 409, 'no-hood')
  })

  test('profiles: more ids than D1 binds in one query', async () => {
    const { store, ids } = world(105)
    for (const id of ids) await api.ensureProfile(store, id)
    assert.equal((await store.profiles(ids)).length, 105)
  })

  test('a hood holds 12', async () => {
    const { store, ids } = world(14)
    const { hood } = await api.hoodPost(store, { playerId: ids[0], action: 'create' })
    for (const p of ids.slice(1, 12)) await api.hoodPost(store, { playerId: p, action: 'join', code: hood.code })
    await rejects(api.hoodPost(store, { playerId: ids[12], action: 'join', code: hood.code }), 409, 'hood-full')
    assert.equal((await store.members(hood.id)).length, 12)
  })

  // ---------------------------------------------------------------- gifts and visits

  async function friends(store, a, b) {
    const code = (await api.stateGet(store, { player: b })).me.code
    await api.stateGet(store, { player: a })
    await api.friendPost(store, { playerId: a, code })
  }

  test('gifts: only to friends or neighbours, catalog-checked, into the mailbox', async () => {
    const { store, ids: [a, b, c] } = world(3)
    await profileOf(store, a, 'Emma')
    await rejects(api.giftPost(store, { playerId: a, to: await pub(store, b), kind: 'clothing', item: 'tiara' }), 403, 'not-allowed')
    await friends(store, a, b)
    await rejects(api.giftPost(store, { playerId: a, to: await pub(store, a), kind: 'clothing', item: 'tiara' }), 409, 'self')
    await rejects(api.giftPost(store, { playerId: a, to: await pub(store, b), kind: 'clothing', item: 'crown-king' }), 400, 'not-giftable')
    await rejects(api.giftPost(store, { playerId: a, to: await pub(store, b), kind: 'furniture', item: 'nope' }), 400, 'not-giftable')
    await rejects(api.giftPost(store, { playerId: a, to: await pub(store, b), kind: 'rocket' }), 400, 'bad-kind')
    const { gift } = await api.giftPost(store, { playerId: a, to: await pub(store, b), kind: 'furniture', item: 'piano', level: 3 }, 5000)
    assert.equal(gift.item, 'piano')
    assert.equal(gift.level, 3)
    assert.equal(gift.from.personName, 'Emma')
    const inbox = (await api.stateGet(store, { player: b })).inbox
    assert.equal(inbox.length, 1)
    assert.equal(inbox[0].from.playerName, 'PLAYER 0')
    // opening: only the receiver, and it can be asked again
    await rejects(api.giftOpenPost(store, { playerId: c, id: gift.id }), 404, 'not-found')
    const opened = await api.giftOpenPost(store, { playerId: b, id: gift.id })
    assert.equal(opened.gift.id, gift.id)
    assert.equal((await api.giftOpenPost(store, { playerId: b, id: gift.id })).gift.id, gift.id)
    assert.equal((await api.stateGet(store, { player: b })).inbox.length, 0)
    // neighbours may send too
    const { hood } = await api.hoodPost(store, { playerId: c, action: 'create' })
    await api.hoodPost(store, { playerId: a, action: 'join', code: hood.code })
    await api.giftPost(store, { playerId: c, to: await pub(store, a), kind: 'clothing', item: 'cap-red' })
  })

  test('bits gifts: taken from the sender on send (refused when short), given once on open', async () => {
    const { store, ids: [a, b] } = world(2)
    await friends(store, a, b)
    await api.walletPost(store, { playerId: a, ops: [op('gggggggg1', 100)] })
    await rejects(api.giftPost(store, { playerId: a, to: await pub(store, b), kind: 'bits', amount: 101 }), 400, 'poor')
    await rejects(api.giftPost(store, { playerId: a, to: await pub(store, b), kind: 'bits', amount: 0 }), 400, 'bad-amount')
    await rejects(api.giftPost(store, { playerId: a, to: await pub(store, b), kind: 'bits', amount: 1001 }), 400, 'bad-amount')
    const sent = await api.giftPost(store, { playerId: a, to: await pub(store, b), kind: 'bits', amount: 40 })
    assert.equal(sent.bits, 60)
    assert.deepEqual(await api.walletGet(store, { player: b }), { bits: 0 }, 'nothing until opened')
    const first = await api.giftOpenPost(store, { playerId: b, id: sent.gift.id })
    assert.equal(first.bits, 40)
    const again = await api.giftOpenPost(store, { playerId: b, id: sent.gift.id })
    assert.equal(again.bits, 40, 'a second open pays nothing')
    assert.deepEqual(await api.walletGet(store, { player: a }), { bits: 60 })
  })

  test('a mailbox holds 40 unopened gifts', async () => {
    const { store, ids: [a, b] } = world(2)
    await friends(store, a, b)
    for (let i = 0; i < 40; i++) await api.giftPost(store, { playerId: a, to: await pub(store, b), kind: 'clothing', item: 'cap-red' }, 1000 + i)
    await rejects(api.giftPost(store, { playerId: a, to: await pub(store, b), kind: 'clothing', item: 'cap-red' }), 409, 'inbox-full')
    const inbox = (await api.stateGet(store, { player: b })).inbox
    assert.equal(inbox.length, 40)
    assert.ok(inbox.every((g, i) => i === 0 || g.sentAt >= inbox[i - 1].sentAt), 'oldest first')
  })

  test('houses: visible to yourself, friends and neighbours only', async () => {
    const { store, ids: [a, b, c] } = world(3)
    const save = await profileOf(store, a, 'Emma')
    const own = await api.houseGet(store, { player: await pub(store, a), viewer: a })
    assert.equal(own.profile.person.name, 'Emma')
    assert.equal(own.profile.house.items.length, save.house.items.length)
    await rejects(api.houseGet(store, { player: await pub(store, a), viewer: b }), 403, 'not-allowed')
    await friends(store, b, a)
    assert.equal((await api.houseGet(store, { player: await pub(store, a), viewer: b })).profile.id, await pub(store, a))
    const { hood } = await api.hoodPost(store, { playerId: a, action: 'create' })
    await api.hoodPost(store, { playerId: c, action: 'join', code: hood.code })
    assert.equal((await api.houseGet(store, { player: await pub(store, a), viewer: c })).profile.code.length, 6)
    // a neighbour who has published nothing yet: an empty lot
    const empty = await api.houseGet(store, { player: await pub(store, c), viewer: a })
    assert.equal(empty.profile.person, null)
    assert.equal(empty.profile.house, null)
  })
})
}
