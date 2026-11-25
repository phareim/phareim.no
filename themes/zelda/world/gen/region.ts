/**
 * One region of the frontier: an ordinary overworld MapDef made from the
 * frontier's seed, the region's place on the macro map and its realm. The
 * same numbers give the same map on every device.
 *
 * The recipe, in order:
 * 1. The land: height, moisture and detail noise in WORLD coordinates (so a
 *    realm's land runs on across its regions), read through the realm's
 *    terrain mix: water, sand, cliffs, woods, grass, flowers, bushes, rocks.
 * 2. The rim: a band of the realm's edge (woods, cliffs or sea) round the
 *    region, broken by passes where a neighbour lies. A pass's place is a
 *    hash of the edge, so both regions cut the same gap.
 * 3. Places (`stamps.ts`): the camp first, then the realm's points of
 *    interest, set down where they fit.
 * 4. Roads: every pass and place joined by a spanning tree of paths, which
 *    bridge water and cut through woods and cliffs.
 * 5. Who is there: folk, chests, signs and foes, only on tiles the road
 *    network reaches; no foe near the camp or a pass.
 */
import type { Dir, EnemyKind, EntDef, ItemId, Mark, MapDef, Prop, Rect, Spot, TileChar } from '../../types'
import { Rng, fbm, hash } from './rng'
import { STAMPS, type Stamp } from './stamps'
import type { FrontierSpec, RealmSpec, Site } from './types'
import type { BattleFoeId, BattleGroupDef } from '../../battleTypes'
import { puzzleKits, stampKit } from '../../engine/puzzles/kits'

/** Rim thickness, in tiles. */
export const RIM = 2
const PASS_W = 3

export interface RegionCtx {
  F: FrontierSpec
  realm: RealmSpec
  rx: number
  ry: number
  id: string
  /** Map ids of the neighbours, where there is one. */
  edges: Partial<Record<'n' | 's' | 'e' | 'w', string>>
  /** Regions (manhattan) from the Landing: foes grow with it. */
  depth: number
  landing: boolean
  /** This region holds the realm's heart piece. */
  heart: boolean
}

/** Where the passes of one edge lie: offsets along it, the same from either side. */
export function passesOf(seed: number, key: [string, number, number], len: number): number[] {
  const h = hash(seed, key[0] === 'v' ? 1 : 2, key[1], key[2])
  const r = new Rng(h)
  const n = r.chance(0.45) ? 2 : 1
  const out: number[] = []
  const lo = RIM + 4
  const hi = len - RIM - 4 - PASS_W
  if (n === 1) out.push(r.int(lo + 4, hi - 4))
  else {
    const mid = Math.floor(len / 2)
    out.push(r.int(lo, mid - PASS_W - 3), r.int(mid + 3, hi))
  }
  return out
}

const OPEN_GROUND = new Set<TileChar>(['.', ',', ':', ';', '-', '='])
const WALKABLE = new Set<TileChar>(['.', ',', ':', ';', '-', '=', '_', 'D', '>', 'i', 'f', '{'])

export function generateRegion(ctx: RegionCtx): MapDef {
  const { F, realm, rx, ry } = ctx
  const W = F.w
  const H = F.h
  const T = realm.terrain
  const rng = new Rng(hash(F.seed, rx, ry, 77))
  const g: TileChar[] = new Array(W * H)
  /** Tiles a place has claimed (roads go round their solid parts). */
  const claimed = new Uint8Array(W * H)
  const at = (x: number, y: number) => g[y * W + x]!
  const set = (x: number, y: number, t: TileChar) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = t }

  // --- 1. the land --------------------------------------------------------------
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const gx = rx * W + x
      const gy = ry * H + y
      const h = fbm(F.seed + 11, gx, gy, T.scale, 4)
      const m = fbm(F.seed + 23, gx, gy, T.scale * 0.7, 3)
      const d = hash(F.seed + 37, gx, gy) / 4294967296
      const d2 = hash(F.seed + 41, gx, gy) / 4294967296
      let t: TileChar = T.ground
      if (h < T.water) t = '~'
      else if (h < T.water + T.sand) t = '-'
      else if (h > T.cliff) t = '#'
      else if (m > T.wood && d < T.trees) t = 'T'
      else if (m > T.wood - 0.06 && d < T.trees * 0.25) t = 'T'
      else {
        let acc = 0
        const roll = (p: number | undefined) => { acc += p ?? 0; return d2 < acc }
        if (roll(T.grass)) t = ';'
        else if (roll(T.flowers)) t = ':'
        else if (roll(T.bushes)) t = '*'
        else if (roll(T.rocks)) t = 'r'
        else if (roll(T.graves)) t = 'G'
        else if (roll(T.pillars)) t = 'I'
        else if (roll(T.lamps)) t = 't'
      }
      g[y * W + x] = t
    }
  }

  // --- 2. the rim and its passes ------------------------------------------------
  const rimTile = (x: number, y: number): TileChar => {
    const t = at(x, y)
    if (t === '~') return '~'
    // (Where the axe fells trees, the rim is cliff: dig & build must not open a way off the map's edge.)
    return T.cliff < 0.7 || realm.special === 'dig' ? '#' : 'T'
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x < RIM || y < RIM || x >= W - RIM || y >= H - RIM) set(x, y, rimTile(x, y))
  }
  // Where the land meets no neighbour, the rim is the sea's or the cliff's, two deeper.
  const sides: Array<{ side: 'n' | 's' | 'e' | 'w'; key: [string, number, number]; len: number }> = [
    { side: 'n', key: ['h', rx, ry], len: W },
    { side: 's', key: ['h', rx, ry + 1], len: W },
    { side: 'w', key: ['v', rx, ry], len: H },
    { side: 'e', key: ['v', rx + 1, ry], len: H },
  ]
  /** Road nodes: the inner end of every pass, then every place. */
  const nodes: Array<{ x: number; y: number }> = []
  const passTiles: Array<{ x: number; y: number }> = []
  for (const sd of sides) {
    if (!ctx.edges[sd.side]) continue
    for (const off of passesOf(F.seed, sd.key, sd.len)) {
      const depth = RIM + 3
      for (let k = 0; k < PASS_W; k++) {
        for (let dd = 0; dd < depth; dd++) {
          let x = 0
          let y = 0
          if (sd.side === 'n') { x = off + k; y = dd } else if (sd.side === 's') { x = off + k; y = H - 1 - dd } else if (sd.side === 'w') { x = dd; y = off + k } else { x = W - 1 - dd; y = off + k }
          set(x, y, at(x, y) === '~' ? '=' : ',')
          claimed[y * W + x] = 2
          if (dd === 0) passTiles.push({ x, y })
        }
      }
      const mid = off + 1
      const inn = RIM + 3
      nodes.push(sd.side === 'n' ? { x: mid, y: inn } : sd.side === 's' ? { x: mid, y: H - 1 - inn } : sd.side === 'w' ? { x: inn, y: mid } : { x: W - 1 - inn, y: mid })
    }
  }

  // --- 3. places ----------------------------------------------------------------
  interface Placed { stamp: Stamp; x: number; y: number; name: string }
  const placed: Placed[] = []
  const rects: Rect[] = []
  const fits = (x: number, y: number, w: number, h: number, pad: number) => {
    if (x < RIM + 1 + pad || y < RIM + 1 + pad || x + w > W - RIM - 1 - pad || y + h > H - RIM - 1 - pad) return false
    for (const r of rects) if (x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y) return false
    for (const p of passTiles) if (Math.abs(p.x - (x + w / 2)) < w / 2 + 4 && Math.abs(p.y - (y + h / 2)) < h / 2 + 4) return false
    let wet = 0
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (at(x + i, y + j) === '~') wet++
    return wet <= (w * h) * 0.2
  }
  /** A site's own chars, by tile index, resolved into marks below. */
  const own = new Map<number, Mark>()
  const put = (name: string, fixed?: { x: number; y: number }, site?: Site): Placed | null => {
    const st: Stamp | undefined = site ? { rows: site.rows, props: site.props, pad: 0 } : STAMPS[name]
    if (!st) return null
    const sh = st.rows.length
    const sw = st.rows[0]!.length
    let pos = fixed ?? null
    for (let tries = 0; !pos && tries < 80; tries++) {
      const x = rng.int(RIM + 1, W - RIM - 1 - sw)
      const y = rng.int(RIM + 1, H - RIM - 1 - sh)
      if (fits(x, y, sw, sh, st.pad ?? 0)) pos = { x, y }
    }
    if (!pos) return null
    for (let j = 0; j < sh; j++) {
      const row = st.rows[j]!
      for (let i = 0; i < sw; i++) {
        const ch = row[i]!
        if (ch === ' ') continue
        const x = pos.x + i
        const y = pos.y + j
        claimed[y * W + x] = 1
        const mk = site?.marks?.[ch]
        const ground = site?.ground ?? T.ground
        if (mk) { own.set(y * W + x, mk); g[y * W + x] = ground; continue }
        // A place's plain ground is the realm's own (sand in the quarry and the desert). Slots are resolved below.
        g[y * W + x] = ch === '.' ? ground : ch as TileChar
      }
    }
    rects.push({ x: pos.x, y: pos.y, w: sw, h: sh })
    const p = { stamp: st, x: pos.x, y: pos.y, name }
    placed.push(p)
    // The road meets a place just under the middle of its lowest row (which a stamp keeps open), so it never cuts through one.
    nodes.push({ x: pos.x + Math.floor(sw / 2), y: Math.min(H - RIM - 1, pos.y + sh) })
    return p
  }
  if (ctx.landing) {
    const st = STAMPS.landing!
    const sw = st.rows[0]!.length
    // The ferry comes in from the south: the dock runs out of the region's south rim.
    const flipped: Stamp = { ...st, rows: [...st.rows].reverse() }
    STAMPS['landing:s'] = flipped
    const p = put('landing:s', { x: Math.floor((W - sw) / 2), y: H - flipped.rows.length })
    if (p) for (let i = 0; i < sw; i++) claimed[(H - 1) * W + p.x + i] = 1
  } else put('camp')
  for (const site of F.sites ?? []) {
    if (site.region !== ctx.id) continue
    if (!put(site.id, site.at, site)) put(site.id, undefined, site)
  }
  // A puzzle realm's regions each hold a walled puzzle or two (the puzzles' kits) with a chest that appears when it is solved.
  if (realm.special === 'puzzles' && !ctx.landing) {
    const n = rng.chance(0.4) ? 2 : 1
    // (A kit that finds no room tries the others, smallest last: a fjord region is mostly water.)
    for (let i = 0; i < n; i++) {
      const order = rng.shuffle([...puzzleKits]).sort((a, b) => (i === 0 ? 0 : b.w * b.h - a.w * a.h))
      for (const k of order) { const site = puzzleSite(k, `${ctx.id}.pz${i}`); if (put(site.id, undefined, site)) break }
    }
  }
  for (const poi of realm.pois) {
    if (poi.chance !== undefined && !rng.chance(poi.chance)) continue
    const n = rng.int(poi.min, poi.max)
    for (let i = 0; i < n; i++) put(poi.stamp)
  }
  // The realm's heart piece must stand: where no random spot is left, the first spot that fits (scanned, unpadded last).
  if (ctx.heart && !put('relic')) {
    const st = STAMPS.relic!
    let spot: { x: number; y: number } | undefined
    for (const pad of [st.pad ?? 0, 0]) for (let y = 0; y < H && !spot; y++) for (let x = 0; x < W && !spot; x++) if (fits(x, y, st.rows[0]!.length, st.rows.length, pad)) spot = { x, y }
    if (spot) put('relic', spot)
  }

  // --- 4. roads -----------------------------------------------------------------
  const carve = (x: number, y: number) => {
    if (x < RIM || y < RIM || x >= W - RIM || y >= H - RIM) return
    const i = y * W + x
    if (claimed[i] === 1) {
      // Through a place only over its open ground.
      return
    }
    const t = g[i]!
    if (t === '~') g[i] = '='
    else if (!WALKABLE.has(t) || t === '.' || t === '-' || t === ';' || t === ':') g[i] = ','
  }
  /**
   * The cheapest way from a to b (Dijkstra on the tiles): open ground is
   * cheap, woods, rocks and water dearer, cliffs dearest; a place's solid
   * parts and the rim cannot be crossed. A little noise per tile makes it
   * wander like a road walked into being.
   */
  const road = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const cost = (i: number): number => {
      const x = i % W
      const y = (i - x) / W
      if (x < RIM || y < RIM || x >= W - RIM || y >= H - RIM) return claimed[i] === 2 ? 1 : Infinity
      const t = g[i]!
      if (claimed[i] === 1) return WALKABLE.has(t) ? 1 : Infinity
      const wob = (hash(F.seed + 59, rx * W + x, ry * H + y) & 7) / 8
      if (t === ',' || t === '=') return 0.6
      if (WALKABLE.has(t)) return 1 + wob
      if (t === '~') return 4
      if (t === '#') return 6
      return 2.5 + wob
    }
    const N = W * H
    const dist = new Float64Array(N).fill(Infinity)
    const prev = new Int32Array(N).fill(-1)
    const src = a.y * W + a.x
    const dst = b.y * W + b.x
    dist[src] = 0
    // A binary heap of [distance, tile].
    const heap: Array<[number, number]> = [[0, src]]
    const push = (e: [number, number]) => {
      heap.push(e)
      let i = heap.length - 1
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p]![0] <= e[0]) break; heap[i] = heap[p]!; i = p }
      heap[i] = e
    }
    const pop = (): [number, number] => {
      const top = heap[0]!
      const last = heap.pop()!
      if (heap.length) {
        let i = 0
        for (;;) {
          const l = 2 * i + 1
          const r = l + 1
          let m = i
          const mv = (k: number) => (k === i ? last[0] : heap[k]![0])
          if (l < heap.length && heap[l]![0] < mv(m)) m = l
          if (r < heap.length && heap[r]![0] < mv(m)) m = r
          if (m === i) break
          heap[i] = heap[m]!
          i = m
        }
        heap[i] = last
      }
      return top
    }
    while (heap.length) {
      const [d, i] = pop()
      if (d > dist[i]!) continue
      if (i === dst) break
      const x = i % W
      for (const j of [x + 1 < W ? i + 1 : -1, x > 0 ? i - 1 : -1, i + W < N ? i + W : -1, i - W >= 0 ? i - W : -1]) {
        if (j < 0) continue
        const c = cost(j)
        if (c === Infinity) continue
        const nd = d + c
        if (nd < dist[j]!) { dist[j] = nd; prev[j] = i; push([nd, j]) }
      }
    }
    if (dist[dst] === Infinity) return
    for (let i = dst; i !== -1; i = prev[i]!) carve(i % W, Math.floor(i / W))
  }
  // A spanning tree over the nodes (Prim), nearest first.
  if (nodes.length > 1) {
    const inTree = [0]
    const rest = nodes.map((_, i) => i).slice(1)
    while (rest.length) {
      let best = -1
      let from = -1
      let bd = Infinity
      for (const r of rest) for (const t of inTree) {
        const d = Math.abs(nodes[r]!.x - nodes[t]!.x) + Math.abs(nodes[r]!.y - nodes[t]!.y)
        if (d < bd) { bd = d; best = r; from = t }
      }
      road(nodes[from]!, nodes[best]!)
      inTree.push(best)
      rest.splice(rest.indexOf(best), 1)
    }
  }

  // --- 5. who is there ----------------------------------------------------------
  const marks: Record<string, Mark> = {}
  let nextMark = 0xe000
  const markOf = (ent: EntDef, tile?: TileChar): string => {
    const ch = String.fromCharCode(nextMark++)
    // Someone standing on the realm's own ground (sand in the quarry and the desert), not on grass.
    const under = tile ?? (T.ground !== '.' && (ent.t === 'npc' || ent.t === 'enemy') ? T.ground : undefined)
    marks[ch] = under ? { ent, tile: under } : { ent }
    return ch
  }
  const entries: Record<string, Spot> = {}
  const foeMarks = new Map<EnemyKind, string>()
  const foeMark = (k: EnemyKind) => {
    let ch = foeMarks.get(k)
    if (!ch) { ch = markOf({ t: 'enemy', kind: k }); foeMarks.set(k, ch) }
    return ch
  }
  /** A battle realm's foes stand in groups that fight in place (`MapDef.battle`); elsewhere they are the field's foes. */
  const groups: BattleGroupDef[] = []
  const foeAt = (x: number, y: number) => {
    if (realm.special !== 'battle') { cell(x, y, foeMark(rng.weighted(realm.foes))); return }
    if (rows[y]![x] === '3') cell(x, y, T.ground)
    const size = Math.min(4, rng.int(1, 2) + (ctx.depth > 3 ? 1 : 0) + (rng.chance(0.2) ? 1 : 0))
    const foes: BattleFoeId[] = []
    for (let k = 0; k < size; k++) foes.push(BATTLE_FOE[rng.weighted(realm.foes)] ?? 'goo')
    groups.push({ id: `${ctx.id}.g${groups.length}`, x: x + 0.5, y: y + 0.5, foes, ...(rng.chance(0.35) ? { sight: 3 } : {}) })
  }
  const rows: string[][] = []
  for (let y = 0; y < H; y++) rows.push(g.slice(y * W, y * W + W) as string[])
  let chests = 0
  let folk = 0
  let caves = 0
  const loot = (): ItemId => rng.weighted(realm.loot)
  const props: Prop[] = []
  for (const p of placed) {
    for (const pr of p.stamp.props ?? []) props.push({ ...pr, x: pr.x + p.x, y: pr.y + p.y })
  }
  const cell = (x: number, y: number, ch: string) => { rows[y]![x] = ch }
  for (const [i, mk] of own) {
    if (mk.ent.t === 'entry') { entries[mk.ent.id] = { x: (i % W) + 0.5, y: Math.floor(i / W) + 0.5, dir: mk.ent.dir ?? 'down' }; rows[Math.floor(i / W)]![i % W] = mk.tile ?? T.ground; continue }
    cell(i % W, Math.floor(i / W), markOf(mk.ent, mk.tile))
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = rows[y]![x]!
    switch (ch) {
      case '1': {
        const f = rng.pick(realm.folk)
        const id = `${ctx.id}.npc${folk++}`
        const says = rng.pick(f.says)
        cell(x, y, markOf({ t: 'npc', id, look: f.look, talk: [{ lines: says }], wander: f.wander }))
        break
      }
      case '2': cell(x, y, markOf({ t: 'chest', id: `${ctx.id}.c${chests++}`, item: loot() })); break
      case '7': cell(x, y, markOf({ t: 'chest', id: `${ctx.id}.heart`, item: 'heartPiece', big: true })); break
      case '3': if (ctx.landing) cell(x, y, '.'); else foeAt(x, y); break
      case '4': entries.camp = { x: x + 0.5, y: y + 0.5, dir: 'down' }; cell(x, y, ','); break
      case '5': {
        const n = caves++
        const cave = `${ctx.id}:cave${n}`
        cell(x, y, markOf({ t: 'warp', to: cave, entry: 'in' }, '>'))
        entries[`cave${n}`] = { x: x + 0.5, y: y + 1.5, dir: 'down' }
        break
      }
      case '6': cell(x, y, markOf({ t: 'sign', lines: signLines(realm, rng) })); break
      case '8': cell(x, y, markOf({ t: 'warp', to: 'overworld', entry: 'ferry' }, '=')); break
      default: break
    }
  }
  // Foes on the open land the roads reach, away from the passes and every entry (the camp, a cave's mouth, a site's
  // way back up): the hero must not arrive within a group's sight. (10 tiles, manhattan: more than sight, cluster and mill.)
  const reach = reachable(rows, W, H, entries.camp ?? { x: nodes[0]?.x ?? W / 2, y: nodes[0]?.y ?? H / 2 })
  if (!ctx.landing) {
    let open = 0
    for (let i = 0; i < W * H; i++) if (reach[i]) open++
    // (A battle realm's foes stand in groups of one to four: fewer places for them.)
    const want = Math.round((open / 100) * realm.density * (1 + 0.2 * Math.min(ctx.depth, 6)) * (realm.special === 'battle' ? 0.4 : 1))
    const keepOff = [...passTiles, ...Object.values(entries)]
    for (let n = 0, tries = 0; n < want && tries < want * 30; tries++) {
      const x = rng.int(RIM + 1, W - RIM - 2)
      const y = rng.int(RIM + 1, H - RIM - 2)
      const i = y * W + x
      if (!reach[i] || claimed[i] || !OPEN_GROUND.has(rows[y]![x]! as TileChar) || rows[y]![x] === '=') continue
      if (keepOff.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) < 10)) continue
      foeAt(x, y)
      n++
    }
  }
  if (!entries.camp) entries.camp = { x: (nodes[0]?.x ?? W / 2) + 0.5, y: (nodes[0]?.y ?? H / 2) + 0.5, dir: 'down' }

  const def: MapDef = {
    id: ctx.id,
    name: realm.name,
    kind: 'overworld',
    track: realm.track,
    rows: rows.map(r => r.join('')),
    marks,
    entries,
    areas: [{
      x: 0, y: 0, w: W, h: H, name: realm.name, track: realm.track, entry: 'camp',
      intro: { lines: [realm.lore[0]!], who: null, flag: `realm:${realm.id}` },
    }],
    edges: ctx.edges,
    realm: realm.id,
  }
  if (groups.length) def.battle = { groups }
  if (realm.special === 'dig') digOf(def, ctx, rng, reach, W, H, entries.camp)
  if (realm.look) def.look = realm.look
  if (realm.views) def.views = realm.views
  if (props.length) def.props = props
  return def
}

/** The field's foe kinds as battle foes (a battle realm's groups borrow the realm's foe table). */
const BATTLE_FOE: Partial<Record<EnemyKind, BattleFoeId>> = {
  blob: 'goo', bat: 'flitter', hound: 'hound', zapper: 'zapper', drone: 'drone', skull: 'skull', spitter: 'spitter', knight: 'knight',
  sentry: 'hound', dasher: 'hound', eye: 'drone', blade: 'skull',
}

/**
 * A puzzle kit as a place: walled in, its way in at the foot of the wall under the kit's entry, and a chest
 * beside the way in that appears once the puzzle holds (`chest.appear`). The kit's flags and plates are
 * prefixed with the place's id, so two of the same kit never share them.
 */
export function puzzleSite(kit: (typeof puzzleKits)[number], id: string): Site {
  const blank = { id, name: '', kind: 'overworld' as const, track: 'overworld' as const, rows: kit.rows.map(r => '.'.repeat(r.length)), marks: {} }
  const { def, solved } = stampKit(blank, kit, 0, 0, id)
  const w = kit.w + 2
  const door = kit.entry.x + 1
  const CHEST = '\uF8F0'
  const rows = ['#'.repeat(w), ...def.rows.map(r => `#${r}#`)]
  rows.push([...'#'.repeat(w)].map((c, i) => (i === door ? '.' : c)).join(''))
  const foot = [...'.'.repeat(w)]
  foot[door + 2 < w ? door + 2 : door - 2] = CHEST
  rows.push(foot.join(''), '.'.repeat(w))
  // On the floor the kit was solved on: blocks and mirrors are not pushed over the realm's sand (`PUSH_ONTO`).
  return { id, region: '', rows, ground: '.', marks: { ...def.marks, [CHEST]: { ent: { t: 'chest', id: `${id}.prize`, item: 'bits50', appear: solved } } } }
}

/**
 * Dig & build in a generated region (`MapDef.dig`): its cliffs inside the rim stand as stone columns two or three
 * high that the pickaxe takes down, a few rocks are lumen ore, and two caches lie buried on open ground.
 */
function digOf(def: MapDef, ctx: RegionCtx, rng: Rng, reach: Uint8Array, W: number, H: number, camp: Spot | undefined) {
  const rows = def.rows.map(r => [...r])
  const heights = rows.map(r => r.map(() => '.'))
  for (let y = RIM; y < H - RIM; y++) for (let x = RIM; x < W - RIM; x++) {
    const t = rows[y]![x]
    if (t === '#') { rows[y]![x] = 'а'; heights[y]![x] = hash(ctx.F.seed + 71, ctx.rx * W + x, ctx.ry * H + y) % 3 === 0 ? '3' : '2' }
    else if (t === 'r' && rng.chance(0.35)) { rows[y]![x] = 'е'; heights[y]![x] = '2' }
  }
  const caches: NonNullable<NonNullable<MapDef['dig']>['caches']> = []
  for (let tries = 0; caches.length < 2 && tries < 200; tries++) {
    const x = rng.int(RIM + 2, W - RIM - 3)
    const y = rng.int(RIM + 2, H - RIM - 3)
    if (!reach[y * W + x] || rows[y]![x] !== '.' && rows[y]![x] !== '-' && rows[y]![x] !== ';') continue
    if (camp && Math.abs(camp.x - x) + Math.abs(camp.y - y) < 6) continue
    caches.push({ x, y, id: `${ctx.id}.cache${caches.length}`, item: rng.weighted<ItemId>([['bits50', 3], ['bombs5', 2], ['heart', 1]]) })
  }
  def.rows = rows.map(r => r.join(''))
  def.dig = { build: true, heights: heights.map(r => r.join('')), caches }
}

function signLines(realm: RealmSpec, rng: Rng): string[] {
  const first = realm.lore[0]!
  const rest = realm.lore.slice(1)
  return rest.length ? [first, rng.pick(rest)] : [first]
}

/** Tiles reachable on foot from a spot (bridges, paths, doors; not over water or walls). */
export function reachable(rows: string[][] | string[], W: number, H: number, from: { x: number; y: number }): Uint8Array {
  const seen = new Uint8Array(W * H)
  const ok = (x: number, y: number) => {
    const ch = rows[y]![x]! as TileChar
    if (WALKABLE.has(ch)) return true
    return ch.charCodeAt(0) >= 0xe000 // a slot's mark: someone or something stands on open ground
  }
  const sx = Math.floor(from.x)
  const sy = Math.floor(from.y)
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return seen
  const q = [sy * W + sx]
  seen[q[0]!] = 1
  while (q.length) {
    const i = q.pop()!
    const x = i % W
    const y = (i - x) / W
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const j = ny * W + nx
      if (seen[j] || !ok(nx, ny)) continue
      seen[j] = 1
      q.push(j)
    }
  }
  return seen
}

export const DIRS: Record<'n' | 's' | 'e' | 'w', Dir> = { n: 'up', s: 'down', e: 'right', w: 'left' }
