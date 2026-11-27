// THE LATE SHOW's key invariant: at every state of the chain, which of the dungeon's locked doors can be reached? The
// walk starts at the screen's door and floods the six maps through their warps, the locks and gates as that state
// has them. It is generous: a side room is walked as if a hero could fly (every open tile joins its neighbours), so a
// lock it does not reach cannot be reached by any jump. Wanted: with a small key in hand, exactly one lock.
//   node scripts/zelda-lab/lateshow-keys.mjs
import { load } from '../../tests/zelda-load.mjs'

const Z = await load()
const MAPS = ['showbooth', 'reel1958', 'reel1986', 'chase1986', 'reel2086', 'weaver']

/** A lock's name by its map and tile: the run's first tile. */
const NAMES = { 'showbooth:27,2': 'L1 (the booth, 1986)', 'showbooth:40,2': 'L2 (the Snack Bar, 2086)', 'reel2086:28,20': 'L3 (the Last Reel)', 'showbooth:23,10': 'K (the great door)' }

function reach(opened, flags) {
  const seen = new Set()
  const locks = new Set()
  const chests = new Set()
  const todo = [['showbooth', Math.floor(Z.mapInfo(Z.WORLD, 'showbooth').entries.door.x), Math.floor(Z.mapInfo(Z.WORLD, 'showbooth').entries.door.y)]]
  while (todo.length) {
    const [id, x, y] = todo.pop()
    const info = Z.mapInfo(Z.WORLD, id)
    const k = `${id}:${x},${y}`
    if (x < 0 || y < 0 || x >= info.w || y >= info.h || seen.has(k)) continue
    const i = y * info.w + x
    let t = info.base[i]
    if (t === 'L' || t === 'K') {
      // The whole run is one door: named by its first tile.
      let j = i
      while (info.base[j - 1] === t) j--
      while (info.base[j - info.w] === t) j -= info.w
      const name = NAMES[`${id}:${j % info.w},${Math.floor(j / info.w)}`]
      if (!opened.has(name)) { locks.add(name); continue }
      t = '.'
    }
    const gate = info.gates.find(g => g.tiles.includes(i) && !g.trap)
    if (gate && !flags.has(gate.open.flag)) continue
    const ch = info.chests.get(i)
    if (ch && (!ch.appear || flags.has(ch.appear.flag))) { chests.add(ch.id); continue }
    // Cracked floor gives way to the stomp; a spring pad is floor.
    if (!gate && t !== '%' && t !== 'O' && Z.TILE_INFO[t].solid) continue
    seen.add(k)
    const w = info.warps.find(v => x >= v.x && x < v.x + v.w && y >= v.y && y < v.y + v.h)
    if (w && MAPS.includes(w.to)) {
      const e = Z.mapInfo(Z.WORLD, w.to).entries[w.entry]
      todo.push([w.to, Math.floor(e.x), Math.floor(e.y)])
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) todo.push([id, x + dx, y + dy])
  }
  return { locks: [...locks].sort(), chests: [...chests].sort() }
}

const L1 = 'L1 (the booth, 1986)'
const L2 = 'L2 (the Snack Bar, 2086)'
const L3 = 'L3 (the Last Reel)'
const K = 'K (the great door)'
const STATES = [
  ['at the door, nothing', [], [], 0],
  ['key 1 in hand', [], [], 1],
  ['L1 opened', [L1], [], 0],
  ['COPILOT down', [L1], ['lateshow.copilot'], 0],
  ['key 2 in hand', [L1], ['lateshow.copilot'], 1],
  ['L2 opened', [L1, L2], ['lateshow.copilot'], 0],
  ['key 3 in hand', [L1, L2], ['lateshow.copilot'], 1],
  ['L3 opened', [L1, L2, L3], ['lateshow.copilot'], 0],
  ['the Big Key in hand, K opened', [L1, L2, L3, K], ['lateshow.copilot'], 0],
]
/** Each key's chest must be reachable in the state before it is in hand. */
const FINDS = { 'key 1 in hand': 'lateshow.key1', 'key 2 in hand': 'lateshow.key2', 'key 3 in hand': 'lateshow.key3' }
let bad = 0
for (const [name, opened, flags, keys] of STATES) {
  const r = reach(new Set(opened), new Set(flags))
  const small = r.locks.filter(l => l !== K)
  const ok = keys ? small.length === 1 && r.chests.includes(FINDS[name]) : true
  if (!ok) bad++
  console.log(`${name.padEnd(32)} locked doors reached: ${r.locks.join(', ') || 'none'}${keys ? `   small locks ${small.length} ${ok ? 'ok' : 'WRONG'}` : ''}`)
}
// Behind the last lock: the Big Key's chest; behind the great door: the Screen.
if (!reach(new Set([L1, L2, L3]), new Set(['lateshow.copilot'])).chests.includes('lateshow.bigkey')) { bad++; console.log('the Big Key is out of reach') }
console.log(bad ? `${bad} WRONG` : 'the invariant holds: one small lock whenever a small key is in hand')
process.exit(bad ? 1 : 0)
