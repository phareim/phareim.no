/**
 * Fairy rings (docs/art/life-catalog.json → fairyring). On a few bare patches beside trees in the Wildwood, eight
 * little mushrooms light up one after another, round and round, while a fairy in the middle spins. Each lap ends with
 * a puff of gold pollen. Step inside the ring (within 0.8 tiles of its middle) and every mushroom lights at once and
 * the fairy bows (it floats up over the hero's head). Frames drawn by Codex (scripts/life-lab/draw.sh).
 * Placement: a plain-ground tile ('.') with all eight neighbours plain and a tree 2-3 tiles away, its seed the lowest
 * in its 5x5 neighbourhood and under 0.03 (four rings in the whole Wildwood).
 */
import type { Critter } from './types'

const N = 8
const RX = 1.15
const RY = 0.95
const RATE = 6

const ring: Critter = {
  id: 'fairyring',
  maps: ['wildwood'],
  when: 'dusk-dawn',
  pal: {d: '#25163f', v: '#463060', m: '#684685', u: '#9066b0', p: '#ff2fa0', n: '#9a6bff', r: '#ff8fd7', s: '#82658e', b: '#c7a4b4', c: '#ffe8ce', k: '#59439b', l: '#a995ed', C: '#d0edff', g: '#a66a57', G: '#ffd23f', Y: '#fff0a0', H: '#ffdfb1', F: '#f1ae80', E: '#51305e', w: '#c6b1eb', W: '#fff8ff'},
  frames: {
    fairyring_shroom_off: [
      '.vuv.',
      'vmmuv',
      'dvvmd',
      '.scs.',
      '.dbd.',
    ],
    fairyring_shroom_on: [
      '.rWr.',
      'npprW',
      'dnnnd',
      '.scs.',
      '.dbd.',
    ],
    fairyring_fae_0: [
      '.H.Y.H.',
      '.G.F.G.',
      '..gFg..',
      'lCwWwCl',
      '.kYGYk.',
      '..GgG..',
      '..F.F..',
      '..Y....',
    ],
    fairyring_fae_1: [
      '..H.YH.',
      '..G.FG.',
      '...FEg.',
      'lCkwWl.',
      '.lCGYk.',
      '...gGG.',
      '...F.F.',
      '.....Y.',
    ],
    fairyring_fae_2: [
      '.H.Y.H.',
      '.G.Y.G.',
      '..gGG..',
      '.lCwCl.',
      '.kCGCk.',
      '..GgG..',
      '..F.F..',
      '....Y..',
    ],
    fairyring_fae_3: [
      '.HY.H..',
      '.GF.G..',
      '.gEF...',
      '.lWwkCl',
      '.kYGCl.',
      '.GGg...',
      '.F.F...',
      '.Y.....',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        if (ctx.at(x, y) !== '.') continue
        const seed = ctx.seed(x, y, 311)
        if (seed >= 0.03) continue
        if (!isRing(ctx, x, y, seed)) continue
        const cx = x + 0.5
        const cy = y + 0.5
        const inside = Math.hypot(hero.x - cx, hero.y - cy) < 0.8
        const lap = ctx.reduced ? 0 : time * RATE
        const head = Math.floor(lap) % N
        for (let k = 0; k < N; k++) {
          const a = (k / N) * Math.PI * 2 - Math.PI / 2
          const mx = cx + Math.cos(a) * RX
          const my = cy + Math.sin(a) * RY + 0.2
          const lit = inside || ctx.reduced ? ctx.reduced ? k === 0 : true : k === head || k === (head + N - 1) % N
          ctx.add(ring, lit ? 'fairyring_shroom_on' : 'fairyring_shroom_off', mx, my, 0)
          if (lit) ctx.glow(mx, my - 0.15, 0.8, k % 2 ? '#ff2fa0' : '#9a6bff', inside ? 0.45 : 0.55)
        }
        // The fairy spins in place, or bows up over the hero's head.
        const fr = ctx.reduced ? 0 : Math.floor(time * 8) % 4
        const bob = Math.sin(time * 3) * 1.5
        const lift = inside ? 19 + Math.sin(time * 2) : 5 + bob
        ctx.add(ring, `fairyring_fae_${inside ? 1 : fr}`, cx, cy + 0.35, lift)
        ctx.glow(cx, cy + 0.35 - lift / 16 - 0.3, 1.1, '#ffd23f', 0.28)
        // Pollen: after each lap a puff of gold pixels rises from the middle.
        if (ctx.reduced) continue
        const lapNo = Math.floor(lap / N)
        const p = (lap / N - lapNo) // 0..1 through the lap
        if (p < 0.6) {
          for (let j = 0; j < 7; j++) {
            const s2 = ctx.seed(x + j, lapNo & 255, 17)
            const u = p / 0.6
            const ox = (s2 - 0.5) * 20 + Math.sin(time * 4 + j) * 2
            const oy = 6 + u * (14 + s2 * 10)
            ctx.draw(cx, cy + 0.35, 0, (g, px, py) => {
              g.fillStyle = j % 2 ? '#fff0a0' : '#ffd23f'
              g.globalAlpha = (1 - u) * (0.6 + 0.4 * Math.sin(time * 15 + j * 2))
              g.fillRect(Math.round(px + ox), Math.round(py - oy), 1, 1)
            })
          }
        }
      }
    }
  },
}

/** Is (x, y) the middle of a ring: eight plain neighbours, a tree 2-3 tiles off, lowest seed in its 5x5. */
function isRing(ctx: Parameters<Critter['queue']>[0], x: number, y: number, seed: number): boolean {
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (ctx.at(x + i, y + j) !== '.') return false
  let tree = false
  for (let j = -3; j <= 3; j++) {
    for (let i = -3; i <= 3; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) >= 2 && ctx.at(x + i, y + j) === 'T') tree = true
    }
  }
  if (!tree) return false
  for (let j = -2; j <= 2; j++) {
    for (let i = -2; i <= 2; i++) {
      if (i === 0 && j === 0) continue
      if (ctx.seed(x + i, y + j, 311) < seed && ctx.at(x + i, y + j) === '.') return false
    }
  }
  return true
}

export default ring
