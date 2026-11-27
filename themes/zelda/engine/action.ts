/**
 * The A button: what a press would do, decided once and read twice. `aPlan` is the engine's own choice of branch
 * (`hero.ts` `stepHero` asks it, then does it) and `aWould` is the touch deck's picture of it. Both are pure.
 */
import type { ExitSpot, GameState, ItemId, Npc, TileChar, World } from '../types'
import { HERO_R } from '../types'
import { TILE_INFO } from '../world/tiles'
import { ctx, type Ctx } from './combat'
import { enemyActive } from './enemies'
import { condMet, has, hasBigKey, keyCount, tileAt } from './map'
import { canComet, canTempest } from './moves'
import { iceUnder, puzzlePart, tubeWords } from './puzzles/index'
import { outOfReach, terrainLevel } from './terrain'
import { sideStanding } from './side'
import { lieAhead } from './lens'
import { dirVec } from './util'

/** What the press would do, as the button shows it. */
export type AWould = 'blade' | 'talk' | 'read' | 'lift' | 'throw' | 'open' | 'door' | 'key' | 'pull' | 'buy'

/** What stands before the hero for A to use. */
export type AThing =
  | { do: 'luna'; lines: string[]; set?: string }
  /** `talk` false: nothing to say just now (the press is still theirs: no swing). */
  | { do: 'npc'; npc: Npc; talk: boolean }
  /** A solid exit: a cabinet, a terminal, a panel, the NEW GAME machine. */
  | { do: 'exit'; exit: ExitSpot; lines: string[] | undefined }
  /** Lines to read: a sign, a tap or a socket, a moon block with nobody to move it. */
  | { do: 'words'; lines: string[] }
  /** The Steamhouse's rack, with a robe to hang on it. */
  | { do: 'rack' }
  | { do: 'psi'; tx: number; ty: number }
  | { do: 'lever'; tx: number; ty: number }
  /** A mirror, a valve, a lumen tube (`hitPuzzle`). */
  | { do: 'part'; tx: number; ty: number; t: TileChar }
  | { do: 'chest'; tx: number; ty: number; id: string; item: ItemId }
  /** A false chest (`lens.ts`): it opens, to nothing. */
  | { do: 'lie'; i: number }
  | { do: 'ware'; id: string }
  | { do: 'lift'; tx: number; ty: number; what: 'pot' | 'rock' }
  /** A locked door: `key`, the hero holds what opens it; else A only says so. */
  | { do: 'lock'; tx: number; ty: number; t: TileChar; key: boolean }

export type APlan =
  | AThing
  | { do: 'throw' }
  | { do: 'tempest' }
  | { do: 'comet' }
  /** The blade: a swing, or the press waits for one. */
  | { do: 'blade' }
  /** The blade too, and the rest after a talk starts again. */
  | { do: 'rest' }

/**
 * A fresh press of A with the hero standing on his own feet (`stepHero` has dealt with a shove, the air, a roll and
 * the rest before it asks): the branch it takes.
 */
export function aPlan(c: Ctx): APlan {
  const s = c.s
  const h = s.hero
  if (h.carry) return { do: 'throw' }
  // Late in the finisher, or just after it: the TEMPEST. Just after a back flip or a wall spring: the COMET.
  // (Neither leaves the ground from ice: the press goes on down the list.)
  if (s.inv.sword && !h.spin && !iceUnder(c)) {
    if (canTempest(h)) return { do: 'tempest' }
    if (!h.swing && canComet(h)) return { do: 'comet' }
  }
  if (h.swing || h.spin) return { do: 'blade' }
  // A tap too many at the end of someone's lines must not start them over:
  // until A has rested it only swings.
  if (h.talkRest > 0) return { do: 'rest' }
  return aThing(c) ?? { do: 'blade' }
}

/** Talk / read / open / buy / lift in front of the hero. Null: nothing there. */
function aThing(c: Ctx): AThing | null {
  const s = c.s
  const h = s.hero
  const v = dirVec(h.dir)
  const fx = h.x + v.x * 0.8
  const fy = h.y + v.y * 0.8
  const tx = Math.floor(fx)
  const ty = Math.floor(fy)
  const t = tileAt(s.map, tx, ty)
  // (In the air of a side map A only cuts.)
  if (c.info.def.kind === 'side' && !sideStanding(h)) return null
  // On terrain, what stands higher than the hero is out of reach (a chest on a ledge). (The level is asked of the
  // spot he stands on now: `m.terrain.z` is a step old between frames.)
  if (s.map.terrain && outOfReach(s, tx, ty, terrainLevel(s.map, h.x, h.y, HERO_R))) return null

  // Luna, a step behind — she talks only when nothing is attacking (in a fight, A swings).
  const L = s.luna
  const calm = !s.map.enemies.some(e => enemyActive(c, e) && Math.hypot(e.x - h.x, e.y - h.y) < 8)
  if (L && calm && Math.hypot(L.x - fx, L.y - fy) < 0.75 && c.w.luna) {
    const br = c.w.luna.find(b => condMet(s, c.w, b.when, -1))
    if (br) return { do: 'luna', lines: br.lines, set: br.set }
  }
  // NPCs in front (also across a counter).
  // (Awake foes near, A is the blade for people too: the press swings, and THE NO's window opens.)
  for (const n of calm ? s.map.npcs : []) {
    const near = Math.hypot(n.x - fx, n.y - fy) < 0.75
    const across = t === 'n' && Math.hypot(n.x - (h.x + v.x * 1.8), n.y - (h.y + v.y * 1.8)) < 0.8
    if (near || across) return { do: 'npc', npc: n, talk: hasWords(c, n.id) }
  }
  const idx = ty * s.map.w + tx
  const exit = c.info.exits.get(idx)
  if (exit && !exit.walk) return { do: 'exit', exit, lines: c.info.exitLines.get(idx) }
  if (t === 'S') {
    const sign = c.info.signs.get(idx)
    if (sign?.robe && h.robe) return { do: 'rack' }
    if (sign) return { do: 'words', lines: sign.alt && condMet(s, c.w, sign.alt.when, -1) ? sign.alt.lines : sign.lines }
  }
  if (t === 'B') {
    if (s.luna) return { do: 'psi', tx, ty }
    const heavy = 'A HEAVY BLOCK WITH A MOON CARVED IN IT. IT WON\'T BUDGE.'
    if (has(s, 'luna.home')) return { do: 'words', lines: [heavy, 'LUNA COULD MOVE IT. SHE IS WAITING AT HER FORT IN THE BRAMBLES.'] }
    return { do: 'words', lines: [heavy, 'SOMEONE WITH A STRONGER MIND MIGHT MOVE IT.'] }
  }
  // A lever thrown is thrown for good: only the blade is left.
  if (t === '}') return has(s, c.info.levers.get(idx) ?? '') ? null : { do: 'lever', tx, ty }
  // A mirror turns, a valve opens or shuts, a lumen tube turns (`puzzles/`); a tap or a socket says what it is.
  if (puzzlePart(c, t)) return { do: 'part', tx, ty, t }
  const words = tubeWords(c, idx, t)
  if (words) return { do: 'words', lines: words }
  if (t === '$') {
    const chest = c.info.chests.get(idx)
    return chest && !has(s, `chest:${chest.id}`) ? { do: 'chest', tx, ty, id: chest.id, item: chest.item } : null
  }
  const lie = lieAhead(c)
  if (lie !== null) return { do: 'lie', i: lie }
  const shop = s.map.pickups.find(p => p.shop && Math.floor(p.x) === tx && Math.floor(p.y) === ty)
  if (shop && shop.shop) return { do: 'ware', id: shop.id }
  const what = TILE_INFO[t].lift
  if (what) return { do: 'lift', tx, ty, what }
  if (t === 'L' || t === 'K') return { do: 'lock', tx, ty, t, key: t === 'L' ? keyCount(s) > 0 : hasBigKey(s) }
  return null
}

/** Has this NPC a branch to say now (`hero.ts` `talkTo`)? */
function hasWords(c: Ctx, id: string): boolean {
  return c.info.marks.some(m => m.ent.t === 'npc' && m.ent.id === id && m.ent.talk.some(br => condMet(c.s, c.w, br.when, -1)))
}

/** The picture of a plan. */
function picture(p: APlan): AWould {
  switch (p.do) {
    case 'throw': return 'throw'
    case 'luna': return 'talk'
    case 'npc': return p.talk ? 'talk' : 'blade'
    case 'words': return 'read'
    case 'exit': {
      const to = p.exit.to
      // The NEW GAME machine reads out what it would wipe; the answer comes after.
      if ('reset' in to) return 'read'
      if (!('panel' in to)) return 'door'
      // The newsstand is read, the viewfinder turns the view, the console and the mirror open.
      return to.panel === 'news' ? 'read' : to.panel === 'view' ? 'pull' : 'open'
    }
    case 'psi': case 'lever': case 'part': case 'rack': return 'pull'
    // (A false chest promises what a real one does.)
    case 'chest': case 'lie': return 'open'
    case 'ware': return 'buy'
    case 'lift': return 'lift'
    // A locked door without its key: no promise is made.
    case 'lock': return p.key ? 'key' : 'blade'
    case 'tempest': case 'comet': case 'blade': case 'rest': return 'blade'
  }
}

/**
 * What a press of A would do this instant, for the button's picture. The blade wherever the press does not look at
 * what is in front (a shove, a fall, the air, a roll, a door's walk, a dialog). The picture is never anything but
 * what the press does: with a foe at arm's length and a pot in front it says Lift, because the press lifts.
 *
 * Cost: a few tile and flag look-ups, and one pass over the map's foes, people and pickups.
 */
export function aWould(world: World, s: GameState): AWould {
  const h = s.hero
  if (s.mode !== 'play' || s.demo) return 'blade'
  if (h.carry) return 'throw'
  if (h.auto || s.hook || h.knock || h.air || h.roll || h.act === 'fall') return 'blade'
  return picture(aPlan(ctx(world, s, [])))
}
