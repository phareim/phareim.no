/**
 * The game: state, the script runner, the SCUMM sentence, walking, the
 * storm, and input from the shell (pointer and keys in logical pixels).
 * Pure: no DOM. The shell calls `update(dt)` at 60 Hz, reads the fields the
 * renderer needs, and drains `events` for audio and saves.
 */
import type {
  ActorId, ActorState, ChoiceOption, Cmd, Ctx, Dir, Floor, GameEvent, GameState, Handler, HandlerResult,
  HeroDef, HeroId, HotspotDef, ItemDef, ItemId, NpcDef, Pt, RoomDef, RoomId, Script, Speech, Verb,
} from '../types'
import { HERO_IDS, ROOM_H, VERB_KEY, VERB_LABEL } from '../types'
import { findPath } from './walk'
import { hit, layout, type Layout } from './layout'

export interface Content {
  rooms: Record<RoomId, RoomDef>
  items: Record<ItemId, ItemDef>
  heroes: Record<HeroId, HeroDef>
  npcs: Record<string, NpcDef>
  /** A new game starts with this (the intro). */
  intro?: Handler
  /** TALK TO a friend's portrait. */
  hint(c: Ctx, to: HeroId): HandlerResult
  /** LOOK AT a friend's portrait. */
  lookHero?(c: Ctx, at: HeroId): HandlerResult
}

export type Target =
  | { kind: 'hotspot'; id: string }
  | { kind: 'item'; id: ItemId }
  | { kind: 'hero'; id: HeroId }

type UiHit =
  | { kind: 'verb'; verb: Verb }
  | { kind: 'item'; id: ItemId }
  | { kind: 'hero'; id: HeroId }
  | { kind: 'invUp' }
  | { kind: 'invDown' }
  | { kind: 'choice'; i: number }
  | { kind: 'scene'; x: number; y: number; hs: HotspotDef | null }
  | null

interface Walker { path: Pt[]; speed: number }

interface Frame { gen: Script; resume?: unknown }

const SPEECH_MIN = 1.5
const SPEECH_MAX = 6.5
const FADE_S = 0.28

export function speechDuration(text: string): number {
  return Math.max(SPEECH_MIN, Math.min(SPEECH_MAX, 0.9 + text.length * 0.052))
}

export function newState(content: Content): GameState {
  const actors: Record<string, ActorState> = {}
  for (const h of HERO_IDS) {
    const d = content.heroes[h]
    actors[h] = { room: d.start.room, x: d.start.x, y: d.start.y, face: d.start.face, visible: true, pose: '' }
  }
  for (const n of Object.values(content.npcs)) {
    actors[n.id] = { room: n.start.room, x: n.start.x, y: n.start.y, face: n.start.face, visible: n.start.visible ?? true, pose: n.start.pose ?? '' }
  }
  return {
    v: 1,
    hero: 'kjell',
    actors,
    inv: { kjell: [...content.heroes.kjell.inv], dag: [...content.heroes.dag.inv], espen: [...content.heroes.espen.inv] },
    flags: {},
    time: 0,
  }
}

/** A loaded save, checked and brought up to date with the content; null if it isn't one. */
export function parseState(raw: unknown, content: Content): GameState | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<GameState>
  if (r.v !== 1 || !r.actors || !r.inv || !r.flags || typeof r.hero !== 'string' || !HERO_IDS.includes(r.hero as HeroId)) return null
  const fresh = newState(content)
  const actors: Record<string, ActorState> = { ...fresh.actors }
  for (const [id, a] of Object.entries(r.actors)) {
    if (!actors[id] || !a || typeof a !== 'object') continue
    const room = a.room === null || (typeof a.room === 'string' && a.room in content.rooms) ? a.room : actors[id]!.room
    actors[id] = {
      room,
      x: Number.isFinite(a.x) ? a.x : actors[id]!.x,
      y: Number.isFinite(a.y) ? a.y : actors[id]!.y,
      face: (['left', 'right', 'up', 'down'] as const).includes(a.face) ? a.face : 'down',
      visible: a.visible !== false,
      pose: typeof a.pose === 'string' ? a.pose : '',
    }
  }
  const inv = { kjell: [] as ItemId[], dag: [] as ItemId[], espen: [] as ItemId[] }
  const seen = new Set<string>()
  for (const h of HERO_IDS) {
    const list = Array.isArray(r.inv[h]) ? r.inv[h] : []
    for (const it of list) if (typeof it === 'string' && it in content.items && !seen.has(it)) { inv[h].push(it as ItemId); seen.add(it) }
  }
  const flags: GameState['flags'] = {}
  for (const [k, v] of Object.entries(r.flags)) if (['boolean', 'number', 'string'].includes(typeof v)) flags[k] = v
  return { v: 1, hero: r.hero as HeroId, actors, inv, flags, time: Number.isFinite(r.time) ? r.time! : 0 }
}

export class Game {
  s: GameState
  readonly content: Content
  // --- ui ---
  verb: Verb | null = null
  /** First object of USE … WITH / GIVE … TO. */
  obj1: ItemId | null = null
  hover: UiHit = null
  invScroll = 0
  lay: Layout = layout(320, 200)
  pointer: { x: number; y: number } | null = null
  /** A portrait flashes when something arrives by dumbwaiter. */
  arrived: Partial<Record<HeroId, number>> = {}
  // --- presentation ---
  speech: Speech | null = null
  choice: ChoiceOption[] | null = null
  card: { text: string; age: number; s: number } | null = null
  /** 0 = clear, 1 = black. */
  fade = 0
  viewRoom: RoomId | null = null
  split: { room: RoomId; x: number }[] | null = null
  camX = 0
  camFixed: number | null = null
  /** Storm light, 0–1, decaying. */
  flash = 0
  shake = 0
  shakePx = 0
  ended = false
  events: GameEvent[] = []
  /** Seconds since the game began (for animation). */
  clock = 0
  // --- scripts ---
  private stack: Frame[] = []
  private cmd: Cmd | null = null
  private cmdAge = 0
  private soft = false
  private walkers = new Map<string, Walker>()
  private fadeTarget = 0
  private fadeRate = 1 / FADE_S
  private seed = 1234567
  private stormNext = 6
  private wasBusy = false
  private floorPlaying: Floor | null = null
  private musicForced: string | null | undefined = undefined

  constructor(content: Content, state?: GameState) {
    this.content = content
    this.s = state ?? newState(content)
  }

  // ------------------------------------------------------------------
  // Queries
  // ------------------------------------------------------------------

  get hero(): HeroId { return this.s.hero }
  heroDef(id: HeroId = this.s.hero): HeroDef { return this.content.heroes[id] }
  actor(id: ActorId): ActorState {
    const a = this.s.actors[id]
    if (!a) throw new Error(`no actor ${id}`)
    return a
  }
  /** The room on screen. */
  get room(): RoomId { return this.viewRoom ?? this.actor(this.s.hero).room ?? 'foyer' }
  roomDef(id: RoomId = this.room): RoomDef { return this.content.rooms[id] }
  /** A script is running that input may not interrupt. */
  get busy(): boolean { return (this.stack.length > 0 && !this.soft) || this.card !== null || this.fade > 0.99 && this.fadeTarget > 0 }
  get running(): boolean { return this.stack.length > 0 }
  walking(id: ActorId): boolean { return this.walkers.has(id) }
  /** Items shown in the current hero's inventory. */
  get inventory(): ItemId[] { return this.s.inv[this.s.hero] }

  hotspots(room: RoomId = this.room): HotspotDef[] {
    const r = this.content.rooms[room]
    return r.hotspots.filter(h => !h.when || h.when(this.s))
  }

  hotspot(id: string, room: RoomId = this.room): HotspotDef | undefined {
    return this.content.rooms[room].hotspots.find(h => h.id === id)
  }

  nameOf(t: Target): string {
    if (t.kind === 'hero') return this.content.heroes[t.id].name
    if (t.kind === 'item') { const n = this.content.items[t.id].name; return typeof n === 'function' ? n(this.s) : n }
    const h = this.hotspot(t.id)
    if (!h) return ''
    return typeof h.name === 'function' ? h.name(this.s) : h.name
  }

  itemName(id: ItemId): string { return this.nameOf({ kind: 'item', id }) }

  /** The sentence line. */
  sentence(): string {
    const v = this.verb
    const hov = this.hoverTarget()
    const hovName = hov ? this.nameOf(hov) : ''
    if (this.obj1) {
      const join = v === 'give' ? 'to' : 'with'
      return `${VERB_LABEL[v ?? 'use']} ${this.itemName(this.obj1)} ${join} ${hovName}`.trim()
    }
    const label = v ? VERB_LABEL[v] : 'Walk to'
    return hovName ? `${label} ${hovName}` : label
  }

  /** The verb to light for what's under the pointer (right-click does it). */
  litVerb(): Verb | null {
    const h = this.hover
    if (!h || this.verb || this.obj1) return null
    if (h.kind === 'scene' && h.hs) return this.defaultVerb(h.hs)
    if (h.kind === 'item') return 'look'
    return null
  }

  private defaultVerb(hs: HotspotDef): Verb {
    if (hs.default) return hs.default
    if (hs.exit) return 'open'
    if (hs.actor) return 'talk'
    return 'look'
  }

  private hoverTarget(): Target | null {
    const h = this.hover
    if (!h) return null
    if (h.kind === 'scene') return h.hs ? { kind: 'hotspot', id: h.hs.id } : null
    if (h.kind === 'item') return { kind: 'item', id: h.id }
    if (h.kind === 'hero') return { kind: 'hero', id: h.id }
    return null
  }

  // ------------------------------------------------------------------
  // Layout and hit-testing
  // ------------------------------------------------------------------

  resize(vw: number, vh: number, safeBottom = 0) {
    this.lay = layout(vw, vh, safeBottom)
    this.clampScroll()
  }

  private clampScroll() {
    const per = this.lay.cols
    const n = this.inventory.length
    const maxScroll = Math.max(0, Math.ceil(n / per) - this.lay.rows)
    this.invScroll = Math.max(0, Math.min(this.invScroll, maxScroll))
  }

  /** Inventory slots on screen: item + box. */
  invSlots(): { id: ItemId; x: number; y: number; w: number; h: number }[] {
    const L = this.lay
    const out: { id: ItemId; x: number; y: number; w: number; h: number }[] = []
    const start = this.invScroll * L.cols
    const inv = this.inventory
    for (let i = 0; i < L.cols * L.rows; i++) {
      const id = inv[start + i]
      if (!id) break
      out.push({ id, x: L.inv.x + (i % L.cols) * L.cell.w, y: L.inv.y + Math.floor(i / L.cols) * L.cell.h, w: L.cell.w, h: L.cell.h })
    }
    return out
  }

  canScroll(dir: -1 | 1): boolean {
    if (dir < 0) return this.invScroll > 0
    return (this.invScroll + this.lay.rows) * this.lay.cols < this.inventory.length
  }

  /** Room x of the view's left edge (negative: the room is narrower than the view). */
  sceneToRoom(x: number, y: number): [number, number] {
    return [x - this.lay.scene.x + this.camX, y - this.lay.scene.y]
  }

  private hitTest(x: number, y: number): UiHit {
    const L = this.lay
    if (this.choice) {
      if (hit(L.choices, x, y)) {
        const i = Math.floor((y - L.choices.y) / L.choiceLineH)
        const shown = this.shownChoices()
        if (i >= 0 && i < shown.length) return { kind: 'choice', i }
      }
      if (hit(L.scene, x, y)) return { kind: 'scene', x, y, hs: null }
      return null
    }
    if (hit(L.scene, x, y)) {
      if (this.split || this.viewRoom) return { kind: 'scene', x, y, hs: null }
      const [rx, ry] = this.sceneToRoom(x, y)
      return { kind: 'scene', x: rx, y: ry, hs: this.hotspotAt(rx, ry) }
    }
    for (const v of L.verbs) if (hit(v, x, y)) return { kind: 'verb', verb: v.verb }
    for (const p of L.portraits) if (hit(p, x, y)) return { kind: 'hero', id: p.hero }
    for (const s of this.invSlots()) if (hit(s, x, y)) return { kind: 'item', id: s.id }
    if (hit(L.invUp, x, y) && this.canScroll(-1)) return { kind: 'invUp' }
    if (hit(L.invDown, x, y) && this.canScroll(1)) return { kind: 'invDown' }
    return null
  }

  hotspotAt(rx: number, ry: number): HotspotDef | null {
    let best: HotspotDef | null = null
    let bz = -Infinity
    let bArea = Infinity
    for (const h of this.hotspots()) {
      const [x, y, w, hh] = h.rect
      if (rx < x || ry < y || rx >= x + w || ry >= y + hh) continue
      const z = h.z ?? 0
      const area = w * hh
      // Higher z wins; on a tie the smaller rect (the thing on the thing).
      if (z > bz || (z === bz && area < bArea)) { best = h; bz = z; bArea = area }
    }
    return best
  }

  shownChoices(): ChoiceOption[] {
    return (this.choice ?? []).filter(o => o.when !== false)
  }

  // ------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------

  pointerMove(x: number, y: number) {
    this.pointer = { x, y }
    this.hover = this.hitTest(x, y)
  }

  pointerLeave() {
    this.pointer = null
    this.hover = null
  }

  /** button 0 = primary, 2 = secondary (the default verb). */
  pointerDown(x: number, y: number, button = 0) {
    this.pointer = { x, y }
    const h = this.hitTest(x, y)
    this.hover = h
    if (this.ended) return
    // Cards and lines are skipped by any click.
    if (this.card) { this.card.age = this.card.s; return }
    if (this.choice) {
      if (h?.kind === 'choice') this.pick(h.i)
      return
    }
    if (this.cmd?.t === 'say' && this.stack.length && !this.soft) { this.skipLine(); return }
    if (this.busy) return
    if (!h) return
    switch (h.kind) {
      case 'verb':
        this.obj1 = null
        this.verb = this.verb === h.verb ? null : h.verb
        return
      case 'invUp': this.invScroll--; return
      case 'invDown': this.invScroll++; return
      case 'hero': return this.clickHero(h.id, button)
      case 'item': return this.clickItem(h.id, button)
      case 'scene': return this.clickScene(h.x, h.y, h.hs, button)
      case 'choice': return
    }
  }

  key(k: string) {
    if (this.ended) return
    const key = k.toLowerCase()
    if (key === '.' || key === 'enter') {
      if (this.card) this.card.age = this.card.s
      else if (this.cmd?.t === 'say') this.skipLine()
      return
    }
    if (this.choice) {
      const n = Number(key)
      if (n >= 1 && n <= this.shownChoices().length) this.pick(n - 1)
      return
    }
    if (this.busy) return
    if (key === '1' || key === '2' || key === '3') { this.switchHero(HERO_IDS[Number(key) - 1]!); return }
    for (const [v, kk] of Object.entries(VERB_KEY) as [Verb, string][]) {
      if (kk === key) { this.obj1 = null; this.verb = v; return }
    }
  }

  /**
   * Do a sentence as if it had been clicked (tests, and the shell's
   * keyboard shortcuts): `act('use', item('oil'), hotspot('socket'))`.
   * Walking is included; call update() until `idle`.
   */
  act(verb: Verb | null, a: Target, b?: Target) {
    this.resetSentence()
    if (b) {
      if (a.kind !== 'item') throw new Error('act: the first of two objects must be an item')
      this.verb = verb ?? 'use'
      this.obj1 = a.id
      this.dispatch(b)
      return
    }
    this.verb = verb
    this.dispatch(a)
  }

  private dispatch(t: Target) {
    if (t.kind === 'hotspot') {
      const hs = this.hotspot(t.id)
      if (!hs || (hs.when && !hs.when(this.s))) throw new Error(`act: no hotspot ${t.id} in ${this.room}`)
      this.clickScene(hs.at?.[0] ?? 0, hs.at?.[1] ?? 0, hs, 0)
    } else if (t.kind === 'item') {
      if (!this.inventory.includes(t.id)) throw new Error(`act: ${this.hero} has no ${t.id}`)
      this.clickItem(t.id, 0)
    } else this.clickHero(t.id, 0)
  }

  /** Nothing running and nobody walking. */
  get idle(): boolean { return !this.stack.length && !this.walkers.size && !this.choice && !this.card && this.fade === 0 }

  /** Pick a shown dialogue option by id (tests). */
  chooseId(id: string): boolean {
    const i = this.shownChoices().findIndex(o => o.id === id)
    if (i < 0) return false
    this.pick(i)
    return true
  }

  private resetSentence() {
    this.verb = null
    this.obj1 = null
  }

  private clickHero(id: HeroId, button: number) {
    const v = this.verb
    if (this.obj1 && v === 'give') {
      const item = this.obj1
      this.resetSentence()
      this.run(() => this.sendItem(item, id))
      return
    }
    if (this.obj1) { const it = this.obj1; this.resetSentence(); this.runLine(this.content.heroes[this.hero].failWith, it); return }
    if (v === 'talk' && id !== this.hero) { this.resetSentence(); this.run(c => this.content.hint(c, id)); return }
    if (v === 'look' || (button === 2 && id !== this.hero)) {
      this.resetSentence()
      this.run(c => this.content.lookHero?.(c, id))
      return
    }
    if (v === 'give' || v === 'use') return // waiting for an item first
    this.resetSentence()
    this.switchHero(id)
  }

  private clickItem(id: ItemId, button: number) {
    const def = this.content.items[id]
    if (this.obj1) {
      const a = this.obj1
      const v = this.verb ?? 'use'
      this.resetSentence()
      if (a === id) return
      if (v === 'give') { this.runLine(this.heroDef().failWith, a); return }
      const h = def.combine?.[a] ?? this.content.items[a].combine?.[id]
      this.run(h ?? (() => this.pickLine(this.heroDef().failWith)))
      return
    }
    const v: Verb = button === 2 ? 'look' : this.verb ?? 'use'
    if (v === 'use' && !def.useAlone) { this.verb = 'use'; this.obj1 = id; return }
    if (v === 'give') { this.verb = 'give'; this.obj1 = id; return }
    this.resetSentence()
    if (v === 'look') { this.run(def.look); return }
    if (v === 'use') { this.run(def.useAlone!); return }
    const h = def.verbs?.[v]
    this.run(h ?? (() => this.failLine(v)))
  }

  private clickScene(rx: number, ry: number, hs: HotspotDef | null, button: number) {
    if (this.split || this.viewRoom) return
    if (!hs) {
      if (this.obj1 || this.verb) { this.resetSentence() }
      this.walkHero(rx, ry)
      return
    }
    if (this.obj1) {
      const item = this.obj1
      const v = this.verb ?? 'use'
      this.resetSentence()
      const table = v === 'give' ? hs.giveWith : hs.useWith
      const h = table?.[item] ?? hs.anyItem
      this.sentenceOn(hs, h ?? (() => this.pickLine(this.heroDef().failWith)), v)
      return
    }
    let v = this.verb
    if (button === 2) v = this.defaultVerb(hs)
    this.resetSentence()
    if (!v) {
      if (hs.exit) this.goThrough(hs)
      else if (hs.far) this.walkHero(rx, ry)
      else this.sentenceOn(hs, null)
      return
    }
    if (v === 'give' || v === 'use') {
      const h0 = hs.verbs?.[v]
      if (!h0 && v === 'give') { this.verb = null; return }
      if (!h0 && hs.exit) { this.goThrough(hs); return }
      this.sentenceOn(hs, h0 ?? (() => this.failLine(v)), v)
      return
    }
    const h = hs.verbs?.[v]
    if (!h && hs.exit && (v === 'open' || v === 'push' || v === 'pull')) { this.goThrough(hs); return }
    if (!h && hs.exit && v === 'close') { this.sentenceOn(hs, () => this.pickLine(['It is closed enough.', 'Fine as it is.'])); return }
    this.sentenceOn(hs, h ?? (() => this.failLine(v)), v)
  }

  // ------------------------------------------------------------------
  // Sentences
  // ------------------------------------------------------------------

  private walkHero(x: number, y: number) {
    this.cancelSoft()
    const hero = this.hero
    const room = this.actor(hero).room
    if (!room) return
    this.setPath(hero, x, y)
  }

  /** Walk to the hotspot (soft: a click cancels), then run the handler (hard). */
  private sentenceOn(hs: HotspotDef, h: Handler | string | null | undefined, verb: Verb | null = null) {
    const game = this
    this.cancelSoft()
    this.start(function* (): Script {
      if (hs.at && !hs.far) {
        yield { t: 'walk', who: game.hero, x: hs.at[0], y: hs.at[1] }
        if (hs.face) yield { t: 'face', who: game.hero, dir: hs.face }
        else yield { t: 'face', who: game.hero, dir: faceToward(game.actor(game.hero), hs) }
      }
      game.soft = false
      // Hands-on verbs reach for the thing, DOTT-style.
      if (verb && REACH.has(verb) && !hs.far) yield { t: 'pose', who: game.hero, pose: 'reach', s: 0.45 }
      if (h == null) return
      yield* game.toScript(h)
    }, true)
  }

  private goThrough(hs: HotspotDef) {
    const ex = hs.exit!
    const game = this
    this.cancelSoft()
    this.start(function* (): Script {
      if (hs.at) yield { t: 'walk', who: game.hero, x: hs.at[0], y: hs.at[1] }
      game.soft = false
      if (ex.open && !ex.open(game.s)) {
        if (hs.face) yield { t: 'face', who: game.hero, dir: hs.face }
        yield* game.toScript(ex.locked ?? 'It won\'t open.')
        return
      }
      yield { t: 'go', room: ex.to, x: ex.x, y: ex.y, face: ex.face }
    }, true)
  }

  private *sendItem(item: ItemId, to: HeroId): Script {
    const c = this.ctx()
    if (to === this.hero) { yield c.say(c.pick(['That\'s me.', 'I already have it. I\'m holding it.'])); return }
    const def = this.content.items[item]
    const refuse = def.send?.(c, to)
    if (typeof refuse === 'string') { yield c.say(refuse); return }
    if (refuse) { yield* refuse; return }
    if (!this.s.inv[this.hero].includes(item)) return
    const up = floorRank(this.content.heroes[to].floor) > floorRank(this.heroDef().floor)
    yield c.say(c.pick(up
      ? ['Sending it up the dumbwaiter.', 'Up it goes.', `Coming up, ${this.content.heroes[to].name}.`]
      : ['Sending it down the dumbwaiter.', 'Down it goes.', `Coming down, ${this.content.heroes[to].name}.`]))
    yield c.sfx('dumbwaiter')
    c.give(item, to)
    this.arrived[to] = this.clock
    const line = def.arrive?.[to]
    if (line) {
      yield c.wait(0.4)
      yield c.sayAs(to, line)
    }
    this.events.push({ t: 'save' })
  }

  private runLine(lines: readonly string[], _item?: ItemId) {
    this.run(() => this.pickLine(lines))
  }

  private failLine(v: Verb): string {
    return this.pickLine(this.heroDef().fail[v])
  }

  private pickLine(lines: readonly string[]): string {
    return lines[this.rand(lines.length)] ?? '…'
  }

  private rand(n: number): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff
    return n <= 0 ? 0 : this.seed % n
  }

  /** Run a handler as a hard script right away (no walking). */
  run(h: Handler | string | null | undefined) {
    if (h == null) return
    this.cancelSoft()
    const game = this
    this.start(function* (): Script { yield* game.toScript(h) }, false)
  }

  /** Start a script if nothing hard is running; returns false if it could not. */
  start(fn: () => Script, soft = false): boolean {
    if (this.stack.length && !this.soft) return false
    this.stack = [{ gen: fn() }]
    this.cmd = null
    this.soft = soft
    return true
  }

  /** A handler's result as a script. */
  *toScript(h: Handler | string): Script {
    if (typeof h === 'string') { yield { t: 'say', who: this.hero, text: h }; return }
    const r = h(this.ctx())
    if (typeof r === 'string') yield { t: 'say', who: this.hero, text: r }
    else if (r && typeof (r as Script).next === 'function') yield* r as Script
  }

  private cancelSoft() {
    if (this.stack.length && this.soft) {
      this.stack = []
      this.cmd = null
      this.soft = false
      this.walkers.delete(this.hero)
    }
  }

  switchHero(id: HeroId) {
    if (id === this.s.hero || this.busy) return
    this.cancelSoft()
    this.walkers.delete(this.s.hero)
    this.resetSentence()
    this.s.hero = id
    this.invScroll = 0
    this.camFixed = null
    this.snapCamera()
    this.events.push({ t: 'hero', id })
    this.syncMusic()
    this.events.push({ t: 'save' })
    this.hover = this.pointer ? this.hitTest(this.pointer.x, this.pointer.y) : null
  }

  private pick(i: number) {
    const opt = this.shownChoices()[i]
    if (!opt) return
    this.choice = null
    const top = this.stack[this.stack.length - 1]
    if (top) top.resume = opt.id
    // The hero says the chosen line, then the script gets the id.
    this.cmd = { t: 'say', who: this.hero, text: opt.text }
    this.beginCmd(this.cmd)
  }

  private skipLine() {
    if (this.speech) this.speech.age = this.speech.dur
  }

  // ------------------------------------------------------------------
  // Ctx
  // ------------------------------------------------------------------

  ctx(): Ctx {
    const g = this
    const s = this.s
    const c: Ctx = {
      s,
      get hero() { return g.s.hero },
      get room() { return g.actor(g.s.hero).room ?? 'foyer' },
      flag: n => s.flags[n],
      is: n => !!s.flags[n],
      set: (n, v = true) => { s.flags[n] = v },
      clear: n => { delete s.flags[n] },
      bump: (n, k = 1) => { const v = (typeof s.flags[n] === 'number' ? s.flags[n] as number : 0) + k; s.flags[n] = v; return v },
      has: (item, hero = g.s.hero) => s.inv[hero].includes(item),
      give: (item, hero = g.s.hero) => {
        for (const h of HERO_IDS) s.inv[h] = s.inv[h].filter(i => i !== item)
        s.inv[hero].push(item)
      },
      take: item => { for (const h of HERO_IDS) s.inv[h] = s.inv[h].filter(i => i !== item) },
      who: item => HERO_IDS.find(h => s.inv[h].includes(item)) ?? null,
      actor: id => g.actor(id),
      pick: opts => opts[g.rand(opts.length)]!,
      by: lines => lines[g.s.hero],
      say: text => ({ t: 'say', who: g.s.hero, text }),
      sayAs: (who, text) => ({ t: 'say', who, text }),
      walk: (x, y, wait = true) => ({ t: 'walk', who: g.s.hero, x, y, wait }),
      walkAs: (who, x, y, wait = true) => ({ t: 'walk', who, x, y, wait }),
      arrive: who => ({ t: 'arrive', who }),
      face: (dir, who = g.s.hero) => ({ t: 'face', who, dir }),
      pose: (pose, sec, who = g.s.hero) => ({ t: 'pose', who, pose, s: sec }),
      wait: sec => ({ t: 'wait', s: sec }),
      place: (who, room, x, y, face) => ({ t: 'place', who, room, x, y, face }),
      show: (who, visible) => ({ t: 'show', who, visible }),
      go: (room, x, y, face) => ({ t: 'go', room, x, y, face }),
      view: (room, fade, camX) => ({ t: 'view', room, fade, camX }),
      split: panes => ({ t: 'split', panes }),
      heroCmd: id => ({ t: 'hero', id }),
      choose: options => ({ t: 'choose', options }),
      card: (text, sec = 2.5) => ({ t: 'card', text, s: sec }),
      fade: (to, sec = 0.5) => ({ t: 'fade', to, s: sec }),
      sfx: name => ({ t: 'sfx', name }),
      music: name => ({ t: 'music', name }),
      flash: (color = '#ffffff', a = 0.8) => ({ t: 'flash', color, a }),
      shake: (sec = 0.4, px = 2) => ({ t: 'shake', s: sec, px }),
      lightning: a => ({ t: 'lightning', a }),
      solve: id => ({ t: 'solve', id }),
      end: () => ({ t: 'end' }),
    }
    return c
  }

  // ------------------------------------------------------------------
  // The loop
  // ------------------------------------------------------------------

  /** Begin a new game's intro (call once on a fresh state). */
  begin() {
    this.snapCamera()
    this.syncMusic()
    if (this.content.intro) this.run(this.content.intro)
  }

  /** Resume a loaded game. */
  resume() {
    this.snapCamera()
    this.syncMusic()
  }

  update(dt: number) {
    this.clock += dt
    if (!this.ended) this.s.time += dt
    // Fades
    if (this.fade !== this.fadeTarget) {
      const d = this.fadeRate * dt
      this.fade = this.fade < this.fadeTarget ? Math.min(this.fadeTarget, this.fade + d) : Math.max(this.fadeTarget, this.fade - d)
    }
    if (this.card) this.card.age += dt
    if (this.speech) this.speech.age += dt
    this.flash = Math.max(0, this.flash - dt * 2.2)
    this.shake = Math.max(0, this.shake - dt)
    this.flashA = Math.max(0, this.flashA - dt * 1.5)
    if (this.poseTimers.length) {
      this.poseTimers = this.poseTimers.filter(p => {
        if (this.clock < p.until) return true
        const a = this.s.actors[p.who]
        if (a && a.pose === p.pose) a.pose = ''
        return false
      })
    }
    this.storm(dt)
    this.moveWalkers(dt)
    this.stepScripts(dt)
    this.updateCamera(dt)
    const busy = this.stack.length > 0
    if (this.wasBusy && !busy) this.events.push({ t: 'save' })
    this.wasBusy = busy
    if (this.pointer && !this.stack.length) this.hover = this.hitTest(this.pointer.x, this.pointer.y)
  }

  drain(): GameEvent[] {
    const e = this.events
    this.events = []
    return e
  }

  private storm(dt: number) {
    this.stormNext -= dt
    if (this.stormNext <= 0) {
      this.stormNext = 7 + this.rand(1000) / 1000 * 12
      this.strike(0.5 + this.rand(100) / 200)
    }
  }

  private strike(a: number) {
    this.flash = Math.max(this.flash, a)
    this.events.push({ t: 'lightning', a })
  }

  private setPath(id: ActorId, x: number, y: number) {
    const a = this.actor(id)
    if (!a.room) return
    const path = findPath(this.content.rooms[a.room], [a.x, a.y], [x, y])
    if (!path.length) { this.walkers.delete(id); return }
    const speed = (HERO_IDS as readonly string[]).includes(id) ? this.content.heroes[id as HeroId].speed : 40
    this.walkers.set(id, { path, speed })
  }

  private moveWalkers(dt: number) {
    for (const [id, w] of this.walkers) {
      const a = this.actor(id as ActorId)
      let left = w.speed * dt
      while (left > 0 && w.path.length) {
        const [tx, ty] = w.path[0]!
        const dx = tx - a.x
        const dy = ty - a.y
        const d = Math.hypot(dx, dy)
        // Up and down the screen is depth: a little slower, like DOTT.
        const k = Math.abs(dy) > Math.abs(dx) ? 0.6 : 1
        a.face = Math.abs(dx) >= Math.abs(dy) * 0.8 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'
        if (d <= left * k) {
          a.x = tx
          a.y = ty
          left -= d / k
          w.path.shift()
        } else {
          a.x += (dx / d) * left * k
          a.y += (dy / d) * left * k
          left = 0
        }
      }
      if (!w.path.length) this.walkers.delete(id)
    }
  }

  private snapCamera() {
    this.camX = this.cameraTarget()
  }

  private cameraTarget(): number {
    const room = this.roomDef()
    const sw = this.lay.scene.w
    if (room.w <= sw) return Math.round((room.w - sw) / 2)
    if (this.camFixed !== null) return Math.max(0, Math.min(room.w - sw, this.camFixed))
    const a = this.actor(this.s.hero)
    const x = this.viewRoom ? room.w / 2 : a.x
    return Math.max(0, Math.min(room.w - sw, Math.round(x - sw / 2)))
  }

  private updateCamera(dt: number) {
    const target = this.cameraTarget()
    const d = target - this.camX
    if (Math.abs(d) < 1) { this.camX = target; return }
    // DOTT scrolls in steps; a quick ease reads the same on a phone.
    this.camX += Math.sign(d) * Math.max(1, Math.min(Math.abs(d), Math.abs(d) * dt * 6, 240 * dt))
    this.camX = Math.round(this.camX)
  }

  private syncMusic() {
    const floor = this.content.rooms[this.room].floor
    if (this.musicForced !== undefined) return
    if (floor !== this.floorPlaying) {
      this.floorPlaying = floor
      this.events.push({ t: 'music', name: 'auto', floor })
    }
  }

  private stepScripts(dt: number) {
    let guard = 200
    while (this.stack.length && guard-- > 0) {
      if (this.choice) return
      if (this.cmd) {
        if (!this.cmdDone(dt)) return
        dt = 0
        this.endCmd()
      }
      const top = this.stack[this.stack.length - 1]!
      const resume = top.resume
      top.resume = undefined
      let r: IteratorResult<Cmd, void>
      try {
        r = top.gen.next(resume)
      } catch (e) {
        console.error('[battery] script error', e)
        this.stack = []
        this.cmd = null
        this.soft = false
        return
      }
      if (r.done) { this.stack.pop(); continue }
      this.cmd = r.value
      this.beginCmd(r.value)
    }
    if (!this.stack.length) { this.soft = false; this.cmd = null }
  }

  private beginCmd(c: Cmd) {
    this.cmdAge = 0
    const s = this.s
    switch (c.t) {
      case 'say': {
        const text = c.text
        this.speech = { who: c.who, text, age: 0, dur: speechDuration(text) }
        this.events.push({ t: 'speak', who: c.who, text })
        return
      }
      case 'walk':
        this.setPath(c.who, c.x, c.y)
        if (c.wait === false) this.cmd = null
        return
      case 'arrive': return
      case 'face': this.actor(c.who).face = c.dir; this.cmd = null; return
      case 'pose': {
        const a = this.actor(c.who)
        a.pose = c.pose
        if (c.s) this.poseTimers.push({ who: c.who, pose: c.pose, until: this.clock + c.s })
        this.cmd = null
        return
      }
      case 'wait': return
      case 'place': {
        const a = this.actor(c.who)
        a.room = c.room
        a.x = c.x
        a.y = c.y
        if (c.face) a.face = c.face
        this.walkers.delete(c.who)
        if (c.who === s.hero) { this.snapCamera(); this.syncMusic() }
        this.cmd = null
        return
      }
      case 'show': this.actor(c.who).visible = c.visible; this.cmd = null; return
      case 'go':
        this.fadeTarget = 1
        this.fadeRate = 1 / FADE_S
        this.goPhase = 0
        return
      case 'view':
        if (c.fade) { this.fadeTarget = 1; this.fadeRate = 1 / FADE_S; this.viewPhase = 0 }
        else { this.setView(c.room, c.camX); this.cmd = null }
        return
      case 'split': this.split = c.panes; this.cmd = null; return
      case 'hero': {
        this.walkers.delete(s.hero)
        s.hero = c.id
        this.invScroll = 0
        this.snapCamera()
        this.events.push({ t: 'hero', id: c.id })
        this.syncMusic()
        this.cmd = null
        return
      }
      case 'choose':
        this.choice = c.options
        this.cmd = null
        return
      case 'card': this.card = { text: c.text, age: 0, s: c.s }; return
      case 'fade': this.fadeTarget = c.to; this.fadeRate = 1 / Math.max(0.05, c.s); return
      case 'sfx': this.events.push({ t: 'sfx', name: c.name }); this.cmd = null; return
      case 'music':
        if (c.name === 'auto') { this.musicForced = undefined; this.floorPlaying = null; this.syncMusic() }
        else { this.musicForced = c.name; this.events.push({ t: 'music', name: c.name, floor: this.content.rooms[this.room].floor }) }
        this.cmd = null
        return
      case 'flash': this.events.push({ t: 'flash', color: c.color, a: c.a }); this.flashColor = c.color; this.flashA = c.a; this.cmd = null; return
      case 'shake': this.shake = c.s; this.shakePx = c.px ?? 2; this.events.push({ t: 'shake', s: c.s, px: c.px ?? 2 }); this.cmd = null; return
      case 'lightning': this.strike(c.a ?? 1); this.cmd = null; return
      case 'solve': this.events.push({ t: 'solve', id: c.id }); s.flags['solved.' + c.id] = true; this.cmd = null; return
      case 'end': this.ended = true; this.events.push({ t: 'end' }); this.cmd = null; return
    }
  }

  /** A one-shot screen flash from a script (the renderer decays it). */
  flashColor = '#ffffff'
  flashA = 0
  private goPhase = 0
  private viewPhase = 0
  private poseTimers: { who: ActorId; pose: string; until: number }[] = []

  private setView(room: RoomId | null, camX?: number) {
    this.viewRoom = room
    this.camFixed = room && camX !== undefined ? camX : null
    this.snapCamera()
    this.syncMusic()
  }

  private cmdDone(dt: number): boolean {
    const c = this.cmd!
    this.cmdAge += dt
    switch (c.t) {
      case 'say': return !this.speech || this.speech.age >= this.speech.dur
      case 'walk': case 'arrive': return !this.walkers.has(c.who)
      case 'wait': return this.cmdAge >= c.s
      case 'card': return !this.card || this.card.age >= this.card.s
      case 'fade': return this.fade === this.fadeTarget
      case 'go': {
        if (this.goPhase === 0) {
          if (this.fade < 1) return false
          const a = this.actor(this.s.hero)
          a.room = c.room
          a.x = c.x
          a.y = c.y
          if (c.face) a.face = c.face
          this.walkers.delete(this.s.hero)
          this.viewRoom = null
          this.camFixed = null
          this.snapCamera()
          this.syncMusic()
          this.events.push({ t: 'room', room: c.room })
          this.fadeTarget = 0
          this.goPhase = 1
          return false
        }
        if (this.fade > 0) return false
        // Now the room's own scripts, on top of the one that walked us here.
        const room = this.content.rooms[c.room]
        const firstKey = 'visited.' + c.room
        const game = this
        const scripts: Script[] = []
        if (room.enter) scripts.push((function* () { yield* game.toScript(room.enter!) })())
        if (room.first && !this.s.flags[firstKey]) {
          this.s.flags[firstKey] = true
          scripts.push((function* () { yield* game.toScript(room.first!) })())
        } else this.s.flags[firstKey] = true
        // Pushed in reverse: `first` runs before `enter`.
        for (const sc of scripts) this.stack.push({ gen: sc })
        return true
      }
      case 'view': {
        if (this.viewPhase === 0) {
          if (this.fade < 1) return false
          this.setView(c.room, c.camX)
          this.fadeTarget = 0
          this.viewPhase = 1
          return false
        }
        return this.fade <= 0
      }
      default: return true
    }
  }

  private endCmd() {
    if (this.cmd?.t === 'say') this.speech = null
    if (this.cmd?.t === 'card') this.card = null
    this.cmd = null
  }

  /** Where the renderer should put a line: over the speaker's head (room coords), or null (off screen). */
  speechAnchor(): { x: number; y: number; color: string; room: RoomId | null } | null {
    const sp = this.speech
    if (!sp) return null
    const a = this.s.actors[sp.who]
    const hero = this.content.heroes[sp.who as HeroId]
    const npc = this.content.npcs[sp.who]
    const color = hero?.color ?? npc?.color ?? '#ffffff'
    const talkY = hero?.talkY ?? npc?.talkY ?? 40
    if (!a) return { x: 0, y: 0, color, room: null }
    return { x: a.x, y: a.y - talkY, color, room: a.room }
  }
}

const REACH: ReadonlySet<Verb> = new Set<Verb>(['give', 'pickup', 'use', 'open', 'push', 'close', 'pull'])

function floorRank(f: Floor): number {
  return f === 'cellar' ? 0 : f === 'ground' || f === 'outside' ? 1 : 2
}

function faceToward(a: ActorState, hs: HotspotDef): Dir {
  const [x, y, w, h] = hs.rect
  const cx = x + w / 2
  const cy = y + h / 2
  const dx = cx - a.x
  if (Math.abs(dx) > 12) return dx < 0 ? 'left' : 'right'
  return cy < a.y - 20 ? 'up' : 'down'
}

export { ROOM_H }
