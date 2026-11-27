// A bare room for the combat tests: the hero in it with the blade, facing east, foes put where a test wants them.
// `Z` is the bundled engine (zelda-load.mjs).

const ROOM = ['##################', '#................#', '#................#', '#................#', '#.....@..........#', '#................#', '#................#', '#................#', '##################']

/**
 * `arena(Z, d, kind, rows, extra)`: a foe `d` tiles east of the hero (0: none). `rows` replaces the room ('@' the
 * hero); `extra` adds to its map. Returns the game, its events, `go(input, frames)`, `until(pred, frames, input)`,
 * `add(dx, dy, kind)` for more foes (99 hp, their brains idle) and the first foe.
 */
export function arena(Z, d = 1.6, kind = 'blob', rows = ROOM, extra = {}) {
  const W = {
    start: { map: 'pit', entry: 'start' },
    maps: { pit: { id: 'pit', name: 'ARENA', kind: 'interior', track: 'indoor', rows, marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'right' } } }, ...extra } },
  }
  const s = Z.createGame(W)
  s.mode = 'play'
  s.dialog = null
  s.inv.sword = true
  s.hero.dir = 'right'
  s.hero.aim = 0
  const foes = []
  const add = (dx, dy = 0, k = kind) => {
    const x = s.hero.x + dx
    const y = s.hero.y + dy
    const e = { id: `foe${foes.length}`, kind: k, x, y, r: Z.STATS[k].r, hp: 99, maxHp: 99, dir: 'left', cell: s.zoneIndex, invuln: 0, stun: 0, knock: null, ai: { mode: 'idle', t: 99, tell: 0 }, home: { x, y }, dead: false, flash: 0 }
    s.map.enemies.push(e)
    foes.push(e)
    return e
  }
  if (d) add(d)
  const ev = []
  const go = (i = { ...Z.NO_INPUT }, n = 1) => { for (let k = 0; k < n; k++) ev.push(...Z.stepGame(W, s, 1 / 60, i)) }
  /** Step until `f` holds (at most `n` frames); true if it did. */
  const until = (f, n = 120, i) => { for (let k = 0; k < n; k++) { if (f()) return true; go(i) } return f() }
  return { W, s, ev, go, until, add, foe: foes[0] }
}
