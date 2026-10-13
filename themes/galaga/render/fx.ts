/**
 * Space Voyagers: what the look remembers between ticks. The engine's events
 * last one tick; a pop, a banner or a shake lasts longer, so they are copied
 * out of the events here and counted down on the game clock (pause freezes
 * them with the world). Fixed pools, like the engine's.
 */
import { SECTORS } from '../engine/balance.ts'
import type { World } from '../engine/types.ts'

export interface Puff {
  active: boolean
  kind: 'pop' | 'spark' | 'bubble' | 'ring' | 'flash' | 'cancel'
  x: number
  y: number
  vx: number
  vy: number
  /** Ticks lived and ticks to live. */
  t: number
  life: number
  /** The palette it uses (a gang, `boss`, `ours`), and a size. */
  tone: string
  n: number
  seed: number
}

export interface Word {
  active: boolean
  text: string
  x: number
  y: number
  t: number
  life: number
  color: 'gold' | 'text' | 'pink' | 'green' | 'red'
}

export interface Banner {
  /** Big line, small line under it. */
  title: string
  sub: string
  t: number
  life: number
  color: 'gold' | 'text' | 'pink' | 'red' | 'green'
  /** The ending card is a bitmap with the words under it. */
  card: boolean
}

export interface Fx {
  puffs: Puff[]
  words: Word[]
  banner: Banner
  /** Ticks of shake left, and how hard. */
  shake: number
  shakeAmp: number
  /** Ticks the monitor's picture tears (a boss cutting in). */
  tear: number
  /** Ticks since the weapon changed or levelled (the dial blinks). */
  weaponT: number
  /** Ticks since a valve popped or was mended, and which. */
  valveT: number
  /** A white field for a few ticks (the mirror ball). */
  blink: number
  seed: number
}

const BOSS_NAMES: Record<string, string> = {
  knight: 'SATURDAY KNIGHT', humdinger: 'LORD HUMDINGER', durant: 'THE EXCESS MACHINE', cal: 'CAL 9000',
  fader: 'DARK FADER', deafstar: 'THE DEAF STAR',
}
export const PICK_NAMES: Record<string, string> = {
  tube: 'TUBE', blaster: 'BLASTER', disc: 'DISC', boombox: 'BOOMBOX', pizza: 'PIZZA', bubble: 'BUBBLE', cb: 'CB',
  mirrorball: 'MIRROR BALL', tracking: 'TRACKING', hairspray: 'EXTRA HOLD', magnet: 'MAGNET', quarter: 'QUARTER',
}
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
export const roman = (n: number): string => ROMAN[n] ?? String(n)

export function createFx(): Fx {
  const puffs: Puff[] = []
  for (let i = 0; i < 96; i++) puffs.push({ active: false, kind: 'pop', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0, tone: 'ours', n: 0, seed: 0 })
  const words: Word[] = []
  for (let i = 0; i < 12; i++) words.push({ active: false, text: '', x: 0, y: 0, t: 0, life: 0, color: 'text' })
  return {
    puffs, words,
    banner: { title: '', sub: '', t: 0, life: 0, color: 'text', card: false },
    shake: 0, shakeAmp: 0, tear: 0, weaponT: 999, valveT: 999, blink: 0, seed: 1,
  }
}

export function resetFx(fx: Fx): void {
  for (const p of fx.puffs) p.active = false
  for (const w of fx.words) w.active = false
  fx.banner.life = 0
  fx.shake = 0
  fx.tear = 0
  fx.blink = 0
  fx.weaponT = 999
  fx.valveT = 999
}

function puff(fx: Fx, kind: Puff['kind'], x: number, y: number, life: number, tone: string, n = 0, vx = 0, vy = 0): void {
  let slot: Puff | null = null
  for (const p of fx.puffs) if (!p.active) { slot = p; break }
  if (!slot) {
    // Full: the oldest goes.
    slot = fx.puffs[0]!
    for (const p of fx.puffs) if (p.t > slot.t) slot = p
  }
  slot.active = true
  slot.kind = kind; slot.x = x; slot.y = y; slot.vx = vx; slot.vy = vy
  slot.t = 0; slot.life = life; slot.tone = tone; slot.n = n
  slot.seed = fx.seed = (Math.imul(fx.seed, 1664525) + 1013904223) >>> 0
}

function word(fx: Fx, text: string, x: number, y: number, color: Word['color'], life = 50): void {
  // Two words made in the same place (a crate of two) stand one above the other.
  for (let moved = true, n = 0; moved && n < 4; n++) {
    moved = false
    for (const o of fx.words) {
      if (o.active && o.t < 24 && Math.abs(o.y - y) < 9 && Math.abs(o.x - x) < 44) { y = o.y - 9; moved = true }
    }
  }
  let slot: Word | null = null
  for (const w of fx.words) if (!w.active) { slot = w; break }
  if (!slot) {
    slot = fx.words[0]!
    for (const w of fx.words) if (w.t > slot.t) slot = w
  }
  slot.active = true
  slot.text = text; slot.x = x; slot.y = y; slot.t = 0; slot.life = life; slot.color = color
}

function banner(fx: Fx, title: string, sub: string, life: number, color: Banner['color'], card = false): void {
  const b = fx.banner
  b.title = title; b.sub = sub; b.t = 0; b.life = life; b.color = color; b.card = card
}

function shake(fx: Fx, ticks: number, amp: number): void {
  if (amp >= fx.shakeAmp || fx.shake === 0) fx.shakeAmp = amp
  fx.shake = Math.max(fx.shake, ticks)
}

/** The gang in a bitmap's name (`enemy-hogs-tank`), or what else it is. */
function toneOf(kind: string): string {
  if (kind.startsWith('enemy-')) return kind.split('-')[1] ?? 'ours'
  if (kind.startsWith('boss-')) return 'boss'
  return 'ours'
}

/** Read one tick's events. Call after `step(world)`, before the next. */
export function takeEvents(fx: Fx, w: World): void {
  for (let i = 0; i < w.events.length; i++) {
    const e = w.events[i]!
    switch (e.type) {
      case 'pop': {
        const tone = toneOf(e.kind)
        const big = e.kind.endsWith('-tank') || e.kind.endsWith('-captor') || tone === 'boss'
        puff(fx, 'pop', e.x, e.y, big ? 22 : 16, tone, big ? 2 : 1)
        // The pilot drifts off in a bubble.
        if (tone !== 'boss' && e.n > 0 && !e.kind.endsWith('-mite')) puff(fx, 'bubble', e.x, e.y, 80, tone, 0, ((e.x * 7 + e.y * 3) % 5 - 2) * 0.12, -0.45)
        if (e.n >= 120) word(fx, String(e.n), e.x, e.y - 8, 'gold', 40)
        break
      }
      case 'hit':
        puff(fx, 'spark', e.x, e.y, 6, e.kind === 'armor' || e.kind === 'door' ? 'chromons' : 'ours', 0)
        break
      case 'split':
        puff(fx, 'ring', e.x, e.y, 10, toneOf(e.kind), 10)
        break
      case 'cancel':
        puff(fx, 'cancel', e.x, e.y, 14, 'boss', 0)
        break
      case 'chain':
        word(fx, `X${e.n}`, e.x, e.y - 14, 'pink', 55)
        break
      case 'pick':
        word(fx, PICK_NAMES[e.kind] ?? e.kind.toUpperCase(), e.x, e.y - 22, 'gold', 60)
        puff(fx, 'ring', e.x, e.y, 10, 'ours', 12)
        if (e.kind === 'tube' || e.kind === 'blaster' || e.kind === 'disc' || e.kind === 'boombox') fx.weaponT = 0
        break
      case 'power':
        if (e.kind === 'mirrorball') { fx.blink = 6; puff(fx, 'ring', e.x, e.y, 40, 'glitterati', 200) }
        break
      case 'valve':
        fx.valveT = 0
        shake(fx, 14, 3)
        puff(fx, 'pop', e.x, e.y, 14, 'ours', 1)
        break
      case 'mend':
        fx.valveT = 0
        break
      case 'bubble':
        puff(fx, 'ring', e.x, e.y, 12, 'ours', 20)
        break
      case 'tow':
        shake(fx, 24, 4)
        puff(fx, 'pop', e.x, e.y, 24, 'ours', 2)
        banner(fx, 'TOW', e.n > 0 ? `${e.n} LEFT` : 'THE LAST ONE', 120, 'red')
        break
      case 'gameover':
        shake(fx, 30, 4)
        puff(fx, 'pop', e.x, e.y, 30, 'ours', 3)
        break
      case 'partnerHit':
        puff(fx, 'spark', e.x, e.y, 8, 'ours', 0)
        break
      case 'limp':
        puff(fx, 'pop', e.x, e.y, 16, 'ours', 1)
        break
      case 'capture':
        word(fx, 'CAPTURED', e.x, e.y + 16, 'red', 80)
        break
      case 'freed':
        puff(fx, 'ring', e.x, e.y, 16, 'ours', 26)
        break
      case 'docked':
        word(fx, 'DOCKED', e.x, e.y - 26, 'gold', 80)
        puff(fx, 'ring', e.x, e.y, 14, 'ours', 22)
        break
      case 'duetOn':
        banner(fx, 'DUET', '', 70, 'pink')
        shake(fx, 10, 2)
        puff(fx, 'ring', e.x, e.y, 30, 'lovemachines', 150)
        break
      case 'bossIn':
        fx.tear = 24
        break
      case 'bossPhase':
        shake(fx, 20, 3)
        puff(fx, 'ring', e.x, e.y, 24, 'boss', 90)
        break
      case 'bossDown':
        shake(fx, 40, 4)
        for (let k = 0; k < 6; k++) puff(fx, 'pop', e.x + ((k * 37) % 70) - 35, e.y + ((k * 53) % 50) - 25, 26 + k * 3, 'boss', 3)
        break
      case 'convoySafe':
        banner(fx, 'CONVOY HOME', '+3000', 110, 'green')
        break
      case 'convoyLost':
        banner(fx, 'CARGO LOST', '', 110, 'red')
        break
      case 'rescued':
        banner(fx, 'JUMP START', '+3000', 110, 'green')
        puff(fx, 'ring', e.x, e.y, 18, 'ours', 30)
        break
      case 'rescueLost':
        banner(fx, 'TOWED AWAY', '', 110, 'red')
        break
      case 'card': {
        const name = SECTORS[w.sector - 1]?.name ?? ''
        // A later voyage's first sector opens under the voyage's own card (the two events are a tick apart).
        if (e.kind === 'sector' && e.n === 1 && w.voyage > 1) banner(fx, `VOYAGE ${roman(w.voyage)}`, 'SAME ORDER. HOTTER.', 170, 'pink')
        else if (e.kind === 'sector') banner(fx, `SECTOR ${e.n}`, name, 170, 'gold')
        else if (e.kind === 'bonus') banner(fx, 'BONUS RUN', 'NOTHING SHOOTS', 110, 'pink')
        else if (e.kind === 'perfect') banner(fx, 'PERFECT', `+${e.n}`, 120, 'gold')
        else if (e.kind === 'boss') banner(fx, 'WARNING', BOSS_NAMES[SECTORS[w.sector - 1]?.bosses[0] ?? ''] ?? '', 130, 'red')
        else if (e.kind === 'clear') banner(fx, 'SECTOR CLEAR', name, 170, 'green')
        else if (e.kind === 'ending') banner(fx, 'DELIVERED', 'ONE LARGE PEPPERONI', 590, 'gold', true)
        else if (e.kind === 'voyage') banner(fx, `VOYAGE ${roman(e.n)}`, 'SAME ORDER. HOTTER.', 170, 'pink')
        break
      }
      default:
        break
    }
    if (e.type === 'bossIn' && e.kind === 'deafstar') banner(fx, 'WARNING', BOSS_NAMES.deafstar!, 130, 'red')
  }
}

/** One tick of the game clock. */
export function stepFx(fx: Fx): void {
  for (const p of fx.puffs) {
    if (!p.active) continue
    p.x += p.vx
    p.y += p.vy
    if (++p.t >= p.life) p.active = false
  }
  for (const w of fx.words) {
    if (!w.active) continue
    if (w.t < 16) w.y -= 0.5
    if (++w.t >= w.life) w.active = false
  }
  const b = fx.banner
  if (b.life > 0 && ++b.t >= b.life) b.life = 0
  if (fx.shake > 0) fx.shake--
  if (fx.tear > 0) fx.tear--
  if (fx.blink > 0) fx.blink--
  fx.weaponT++
  fx.valveT++
}
