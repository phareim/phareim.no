// Night of the Dead Battery: the cellar (Dag's floor). Every cellar puzzle
// through the engine: the furnace (refusal, kindling, lit), Bones' key only
// once he is warm, the lab door, the jam lid (cold vs lit), the sandwich
// refused before the jam and sent after, the cat into the booth, the lever.
import test from 'node:test'
import assert from 'node:assert/strict'
import { load } from './battery-load.mjs'
import { hs, item, hero, settle, doing } from './battery-helpers.mjs'

// The other floors are built at the same time as this one; if the whole
// game doesn't bundle, test the cellar with the other rooms stubbed.
async function loadCellar() {
  try { return await load() } catch {
    console.warn('[cellar] the full content does not bundle; testing the cellar with the other floors stubbed')
    const { createRequire } = await import('node:module')
    const { fileURLToPath } = await import('node:url')
    const { join, dirname } = await import('node:path')
    const esbuild = createRequire(import.meta.url)('esbuild')
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'battery')
    const floors = { driveway: 'outside', foyer: 'ground', parlour: 'ground', kitchen: 'ground', conservatory: 'ground', storeroom: 'attic', study: 'attic', roof: 'attic' }
    const stub = {
      name: 'stub',
      setup(b) {
        b.onResolve({ filter: /^\.\/(story|hints|rooms\/[a-z]+)$/ }, a => {
          const id = a.path.replace('./rooms/', '').replace('./', '')
          if (id in floors || id === 'story' || id === 'hints') return { path: id, namespace: 'stub' }
          return undefined
        })
        b.onLoad({ filter: /.*/, namespace: 'stub' }, a => {
          if (a.path === 'story') return { contents: 'export const intro = undefined; export const midnight = function* () {}', loader: 'js' }
          if (a.path === 'hints') return { contents: 'export function hint() {}; export function lookHero() {}', loader: 'js' }
          return { contents: `import { placeholderRoom } from ${JSON.stringify(join(root, 'content/rooms/_placeholder.ts'))}; export const room = placeholderRoom('${a.path}', '${a.path}', '${floors[a.path]}')`, loader: 'ts', resolveDir: root }
        })
      },
    }
    const out = esbuild.buildSync({
      stdin: { contents: `export * from './engine/index'; export * from './types'; export { CONTENT } from './content/index'; export { F } from './content/flags'`, resolveDir: root, loader: 'ts' },
      bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'silent', plugins: [stub],
    })
    return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
  }
}

const M = await loadCellar()
const { Game, CONTENT, F } = M

/** A fresh game with Dag in `room` at (x, y), holding `inv`. */
function dagIn(room, x = 200, y = 124, inv = []) {
  const g = new Game(CONTENT)
  g.resize(320, 200)
  g.s.hero = 'dag'
  Object.assign(g.s.actors.dag, { room, x, y })
  for (const it of inv) {
    for (const h of ['kjell', 'dag', 'espen']) g.s.inv[h] = g.s.inv[h].filter(i => i !== it)
    g.s.inv.dag.push(it)
  }
  g.resume()
  g.drain()
  return g
}

const solved = (g, id) => !!g.s.flags['solved.' + id]
function solves(g) { return Object.keys(g.s.flags).filter(k => k.startsWith('solved.')).map(k => k.slice(7)) }

test('the three cellar rooms are wide enough and Dag can reach every hotspot', () => {
  for (const id of ['pantry', 'boiler', 'lab']) {
    const r = CONTENT.rooms[id]
    assert.equal(r.floor, 'cellar')
    assert.ok(r.w >= 400, id + ' is at least 400 wide')
    for (const h of r.hotspots) {
      const [x, y, w, hh] = h.rect
      assert.ok(x >= 0 && y >= 0 && x + w <= r.w && y + hh <= 144, `${id}/${h.id} rect inside the room`)
      if (h.at && !(h.when && !h.when(dagIn(id).s))) {
        const g = dagIn(id, h.at[0], h.at[1])
        // Walking to it from the room's middle arrives there.
        Object.assign(g.s.actors.dag, { x: r.w / 2, y: 130 })
        g.act(null, hs(h.id))
        settle(g)
        if (!h.exit) {
          const a = g.s.actors.dag
          assert.ok(Math.hypot(a.x - h.at[0], a.y - h.at[1]) < 4, `${id}/${h.id}: Dag reached ${h.at} (got ${a.x.toFixed(0)},${a.y.toFixed(0)})`)
        }
      }
    }
  }
})

test('Dag starts in the pantry, and every pantry and boiler hotspot answers LOOK AT', () => {
  const g = new Game(CONTENT)
  assert.equal(g.s.actors.dag.room, 'pantry')
  for (const id of ['pantry', 'boiler', 'lab']) {
    const room = CONTENT.rooms[id]
    for (const h of room.hotspots) {
      if (h.exit) continue
      if (h.when && !h.when(g.s)) continue
      const d = dagIn(id)
      const said = doing(d, 'look', hs(h.id))
      assert.ok(said.length > 0, `${id}/${h.id} says something on LOOK AT`)
    }
  }
})

test('the pantry: one jar of jam, and the shelf stays full', () => {
  const g = dagIn('pantry', 134, 118)
  doing(g, 'pickup', hs('jam'))
  assert.ok(g.s.inv.dag.includes('jam'))
  const said = doing(g, 'pickup', hs('jam'))
  assert.equal(g.s.inv.dag.filter(i => i === 'jam').length, 1)
  assert.ok(said.some(l => /already|open/i.test(l)))
})

test('the pantry exits: to the boiler room, and the nailed door until the stairs come down', () => {
  const g = dagIn('pantry', 380, 122)
  doing(g, null, hs('to-boiler'))
  assert.equal(g.s.actors.dag.room, 'boiler')
  const p = dagIn('pantry', 100, 120)
  const said = doing(p, 'open', hs('stairs'))
  assert.equal(p.s.actors.dag.room, 'pantry')
  assert.ok(said.some(l => /nail|door/i.test(l)))
})

test('the furnace: the match is refused on damp coal, then kindling, then it roars', () => {
  const g = dagIn('boiler', 100, 126, ['matches', 'manual'])
  let said = doing(g, 'use', item('matches'), hs('furnace'))
  assert.ok(said.some(l => /damp/i.test(l) && /match/i.test(l)), said.join('\n'))
  assert.ok(g.s.inv.dag.includes('matches'), 'the match is not used up')
  assert.ok(!g.s.flags[F.furnaceLit])

  said = doing(g, 'use', item('manual'), hs('furnace'))
  assert.ok(!g.s.inv.dag.includes('manual'), 'the manual went in')
  assert.ok(g.s.flags[F.furnaceKindling])
  assert.ok(!g.s.flags[F.furnaceLit])

  g.act('use', item('matches'), hs('furnace'))
  const events = []
  for (let i = 0; i < 60 * 60 && !(g.idle && i > 0); i++) { g.update(1 / 60); events.push(...g.drain()) }
  assert.ok(g.s.flags[F.furnaceLit])
  assert.ok(!g.s.inv.dag.includes('matches'), 'the match is spent')
  assert.ok(solved(g, 'furnace'))
  const sfx = events.filter(e => e.t === 'sfx').map(e => e.name)
  assert.ok(sfx.includes('furnace-whoosh') && sfx.includes('pipes-knock'), sfx.join(','))
  assert.ok(events.some(e => e.t === 'shake'))
  assert.equal(events.filter(e => e.t === 'solve').length, 1)
})

test('Mr Bones: no key while he is cold (and his jaw falls off); the key once the furnace is lit', () => {
  const g = dagIn('boiler', 262, 124)
  const said = doing(g, 'talk', hs('bones'), undefined, { answers: ['cold', 'lab', 'bye'] })
  assert.ok(said.some(l => /carrots/i.test(l)), 'the carrots line')
  assert.ok(g.s.flags['boiler.jaw'] >= 1, 'the jaw fell off')
  assert.ok(!g.s.inv.dag.includes('labkey'))
  assert.ok(!g.s.flags[F.bonesKey])
  assert.equal(g.s.actors.bones.pose, 'shiver')

  g.s.flags[F.furnaceLit] = true
  doing(g, 'talk', hs('bones'), undefined, { answers: ['bye'] })
  assert.ok(g.s.inv.dag.includes('labkey'))
  assert.ok(g.s.flags[F.bonesKey])
  assert.ok(solved(g, 'bones-key'))
  assert.equal(g.s.actors.bones.pose, '', 'warm: no more shivering')

  // Talking again gives no second key, and every topic has an answer.
  const topics = ['who', 'prof', 'cat', 'house', 'food', 'suit', 'lab']
  for (const t of topics) {
    const opts = []
    g.act('talk', hs('bones'))
    for (let i = 0; i < 3600 && !g.choice; i++) g.update(1 / 60)
    for (const o of g.shownChoices()) opts.push(o.id)
    assert.ok(g.shownChoices().length <= 5, 'at most five lines fit the panel')
    const pick = opts.includes(t) ? t : 'bye'
    settle(g, { answers: pick === 'bye' ? ['bye'] : [pick, 'bye'] })
  }
  assert.equal(g.s.inv.dag.filter(i => i === 'labkey').length, 1)
})

test('Mr Bones collapses when pushed and puts himself back together', () => {
  const g = dagIn('boiler', 262, 124)
  g.act('push', hs('bones'))
  let sawPile = false
  for (let i = 0; i < 60 * 60 && !(g.idle && i > 0); i++) { g.update(1 / 60); g.drain(); if (g.s.actors.bones.pose === 'pile') sawPile = true }
  assert.ok(sawPile)
  assert.equal(g.s.actors.bones.pose, 'shiver')
})

test('the lab door: locked until Dag uses the lab key on it', () => {
  const g = dagIn('boiler', 340, 118)
  doing(g, null, hs('labdoor'))
  assert.equal(g.s.actors.dag.room, 'boiler', 'locked')
  g.s.inv.dag.push('labkey')
  doing(g, 'use', item('labkey'), hs('labdoor'))
  assert.ok(g.s.flags[F.labOpen])
  assert.ok(solved(g, 'lab'))
  doing(g, null, hs('labdoor'))
  assert.equal(g.s.actors.dag.room, 'lab')
  doing(g, null, hs('to-boiler'))
  assert.equal(g.s.actors.dag.room, 'boiler')
})

test('the jam: stuck on its own, cold on the cold furnace, pops on the lit one', () => {
  const g = dagIn('boiler', 100, 126, ['jam'])
  let said = doing(g, 'use', item('jam'), item('jam'))
  assert.ok(said.some(l => /1987/.test(l)), 'the strong-lid line from items.ts')
  said = doing(g, 'use', item('jam'), hs('furnace'))
  assert.ok(said.some(l => /cold/i.test(l)))
  assert.ok(!g.s.flags[F.jamOpen])
  g.s.flags[F.furnaceLit] = true
  doing(g, 'use', item('jam'), hs('furnace'))
  assert.ok(g.s.flags[F.jamOpen])
  assert.ok(g.s.flags[F.dagAte])
  assert.ok(solved(g, 'jam'))
  assert.equal(CONTENT.items.jam.name(g.s), 'open jam jar')
})

test('the sandwich: Dag refuses to send it before the jam, and sends it after', () => {
  const g = dagIn('boiler', 100, 126, ['jam'])
  doing(g, 'give', item('sandwich'), hero('kjell'))
  assert.ok(g.s.inv.dag.includes('sandwich'), 'refused')
  assert.ok(!g.s.inv.kjell.includes('sandwich'))
  g.s.flags[F.furnaceLit] = true
  doing(g, 'use', item('jam'), hs('furnace'))
  doing(g, 'give', item('sandwich'), hero('kjell'))
  assert.ok(g.s.inv.kjell.includes('sandwich'), 'sent up')
  assert.ok(!g.s.inv.dag.includes('sandwich'))
})

test('the booth: Dag puts the cat in, the door shuts, she sits on the small seat', () => {
  const g = dagIn('lab', 352, 128, ['cat'])
  g.s.flags[F.labOpen] = true
  g.s.actors.cat.visible = false
  g.s.actors.cat.room = null
  doing(g, 'use', item('cat'), hs('booth'))
  assert.ok(!g.s.inv.dag.includes('cat'))
  assert.ok(g.s.flags[F.catInBooth])
  assert.ok(g.s.flags[F.boothClosed])
  assert.ok(solved(g, 'booth'))
  const cat = g.s.actors.cat
  assert.equal(cat.room, 'lab')
  assert.ok(cat.visible)
  assert.equal(cat.pose, 'booth')
  assert.ok(g.hotspots().some(h => h.id === 'booth-cat'), 'she can be looked at in there')
  // GIVE works as well as USE.
  const h = dagIn('lab', 352, 128, ['cat'])
  doing(h, 'give', item('cat'), hs('booth'))
  assert.ok(h.s.flags[F.catInBooth])
  // Opening the booth afterwards doesn't let her out.
  doing(g, 'open', hs('booth'))
  assert.ok(g.s.flags[F.catInBooth] && !g.s.flags['lab.booth'])
})

test('the lever: PULL arms the machine once, PUSH disarms it, PULL again re-arms', () => {
  const g = dagIn('lab', 300, 118)
  doing(g, 'pull', hs('lever'))
  assert.ok(g.s.flags[F.leverArmed])
  assert.ok(solved(g, 'lever'))
  doing(g, 'pull', hs('lever'))
  assert.ok(g.s.flags[F.leverArmed])
  doing(g, 'push', hs('lever'))
  assert.ok(!g.s.flags[F.leverArmed])
  g.act('pull', hs('lever'))
  const ev = []
  for (let i = 0; i < 3600 && !(g.idle && i > 0); i++) { g.update(1 / 60); ev.push(...g.drain()) }
  assert.ok(g.s.flags[F.leverArmed])
  assert.equal(ev.filter(e => e.t === 'solve').length, 0, 'the solve fires only once')
})

test('the whole cellar in order, from the pantry with what Kjell sends down', () => {
  const g = dagIn('pantry', 200, 124, ['matches', 'manual'])
  doing(g, 'pickup', hs('jam'))
  doing(g, null, hs('to-boiler'))
  doing(g, 'use', item('matches'), hs('furnace'))
  doing(g, 'use', item('manual'), hs('furnace'))
  doing(g, 'use', item('matches'), hs('furnace'))
  doing(g, 'use', item('jam'), hs('furnace'))
  doing(g, 'talk', hs('bones'), undefined, { answers: ['bye'] })
  doing(g, 'use', item('labkey'), hs('labdoor'))
  doing(g, null, hs('labdoor'))
  assert.equal(g.s.actors.dag.room, 'lab')
  g.s.inv.dag.push('cat')
  doing(g, 'use', item('cat'), hs('booth'))
  doing(g, 'pull', hs('lever'))
  for (const id of ['furnace', 'bones-key', 'lab', 'jam', 'booth', 'lever']) assert.ok(solved(g, id), id)
  assert.deepEqual(solves(g).sort(), ['bones-key', 'booth', 'furnace', 'jam', 'lab', 'lever'])
})

test('cellar scripts only use known sounds', async () => {
  const src = (await import('node:fs')).readFileSync
  const { SFX } = await (async () => {
    const txt = src(new URL('../themes/battery/content/sfx.ts', import.meta.url), 'utf8')
    return { SFX: [...txt.matchAll(/'([a-z-]+)'/g)].map(m => m[1]) }
  })()
  for (const f of ['pantry', 'boiler', 'lab']) {
    const txt = src(new URL(`../themes/battery/content/rooms/${f}.ts`, import.meta.url), 'utf8')
    for (const m of txt.matchAll(/c\.sfx\('([^']+)'\)/g)) assert.ok(SFX.includes(m[1]), `${f}: unknown sfx ${m[1]}`)
  }
})

// By clicks, as a player does it: USE, the item, then the furnace. Items
// with a use of their own (matches, manual, jam) still start "Use X with …";
// clicking the same item again uses it alone.
test('by clicks: USE matches WITH furnace reaches the furnace', () => {
  const g = dagIn('boiler', 100, 126, ['matches'])
  const L = g.lay
  const click = (x, y) => { g.pointerDown(x, y, 0); for (let i = 0; i < 5; i++) g.update(1 / 60) }
  const v = L.verbs.find(b => b.verb === 'use')
  click(v.x + 2, v.y + 2)
  const slot = g.invSlots().find(s => s.id === 'matches')
  click(slot.x + 2, slot.y + 2)
  assert.equal(g.obj1, 'matches', 'the sentence waits for a second object')
  const f = g.hotspot('furnace')
  click(f.rect[0] + 10 - g.camX + L.scene.x, f.rect[1] + 10 + L.scene.y)
  const said = settle(g)
  assert.ok(said.some(l => /damp/i.test(l)), said.join('\n'))
})
