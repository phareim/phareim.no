/**
 * Neon dragonflies (docs/art/life-catalog.json → dragonfly). They hover over the shallows,
 * dart a tile or two in a straight line, hover again, wings flickering pink and cyan. They dart away
 * when the hero gets close; a white glint shows at each hover and a soft glow follows each one. Frames drawn by Codex
 * (scripts/life-lab/draw.sh).
 */
import type { Critter } from '../types'

const BODIES = ['', 'c', 'p'] as const
const STEP = 1.5 // seconds per hover-and-dart step
const DART = 0.22

const fly: Critter = {
  id: 'dragonfly',
  maps: ['overworld', 'wildwood'],
  when: 'always',
  pal: {n: '#132443', e: '#fff6de', t: '#1fd6b0', s: '#169f98', b: '#2f9bff', d: '#336ec7', p: '#ff4fa8', q: '#c43589', w: '#d8fbff', v: '#a5eaf4', c: '#2ff3ff', g: '#ffffff'},
  frames: {
    dragonfly_0: [
      '.....cv..cg....',
      '....vv..ww..cw.',
      '...cv..ww.ww.vc',
      '.nnntvwwvwwvv..',
      'nettttttttttssn',
      '.nnnn..........',
      '...............',
      '...............',
      '...............',
    ],
    dragonfly_1: [
      '...............',
      '...............',
      '...............',
      '.nnnt..........',
      'nettttttttttssn',
      '.nnnnvwwvwwvv..',
      '...cv..ww.ww.vc',
      '....vv..ww..cw.',
      '.....cv..cg....',
    ],
    dragonfly_c0: [
      '.....cv..cg....',
      '....vv..ww..cw.',
      '...cv..ww.ww.vc',
      '.nnnbvwwvwwvv..',
      'nebbbbbbbbbbddn',
      '.nnnn..........',
      '...............',
      '...............',
      '...............',
    ],
    dragonfly_c1: [
      '...............',
      '...............',
      '...............',
      '.nnnb..........',
      'nebbbbbbbbbbddn',
      '.nnnnvwwvwwvv..',
      '...cv..ww.ww.vc',
      '....vv..ww..cw.',
      '.....cv..cg....',
    ],
    dragonfly_p0: [
      '.....cv..cg....',
      '....vv..ww..cw.',
      '...cv..ww.ww.vc',
      '.nnnpvwwvwwvv..',
      'neppppppppppqqn',
      '.nnnn..........',
      '...............',
      '...............',
      '...............',
    ],
    dragonfly_p1: [
      '...............',
      '...............',
      '...............',
      '.nnnp..........',
      'neppppppppppqqn',
      '.nnnnvwwvwwvv..',
      '...cv..ww.ww.vc',
      '....vv..ww..cw.',
      '.....cv..cg....',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        if (ctx.at(x, y) !== '~') continue
        if (ctx.seed(x, y, 733) > 0.07) continue
        // Shallow water: a shore tile touching land.
        let shore = false
        let path = false
        for (let j = -1; j <= 1 && !shore; j++) for (let i = -1; i <= 1; i++) {
          const t = ctx.at(x + i, y + j)
          if (t === ',') { shore = false; path = true }
          if (t !== '~' && t !== '' && t !== '#' && t !== ',') { shore = true; break }
        }
        if (!shore || path) continue
        const seed = ctx.seed(x, y, 734)
        const clock = time + seed * 100
        const n = Math.floor(clock / STEP)
        const local = clock - n * STEP
        // Each step has its own hover spot within about a tile and a half of the tile's centre.
        const spot = (k: number): [number, number] => [
          x + 0.5 + (ctx.seed(x + k, y, 735) - 0.5) * 1.2,
          y + 0.5 + (ctx.seed(x, y + k, 736) - 0.5) * 0.8,
        ]
        const a = spot(n)
        const b = spot(n + 1)
        const hover = 0.4 + ctx.seed(x, y, 737 + (n & 7)) * 0.8
        const t = ctx.reduced ? 0 : Math.max(0, Math.min(1, (local - (STEP - DART)) / DART))
        let fx = a[0] + (b[0] - a[0]) * t
        let fy = a[1] + (b[1] - a[1]) * t
        let lift = 30 + (ctx.reduced ? 0 : Math.sin(clock * 3 + seed * 9) * 1.5)
        const dx = fx - hero.x
        const dy = fy - hero.y
        const d = Math.hypot(dx, dy)
        if (d < 1.5) {
          const k = (1.5 - d) / 1.5
          fx += (dx / (d || 1)) * k * 2
          fy += (dy / (d || 1)) * k * 1.5
          lift += k * 4
        }
        const body = BODIES[Math.floor(seed * 1000) % 3]!
        const wing = ctx.reduced ? 0 : Math.floor(clock * 16) % 2
        const heading = b[0] - a[0]
        const flip = heading < 0
        ctx.add(fly, `dragonfly_${body}${wing}`, fx, fy, lift, flip)
        ctx.glow(fx, fy, 0.6, body === 'p' ? '#ff4fa8' : body === 'c' ? '#2f9bff' : '#1fd6b0', 0.32)
        // A little pink-and-cyan dust behind it while it darts.
        if (!ctx.reduced && t > 0 && t < 1) {
          for (let i = 1; i <= 3; i++) {
            const tt = Math.max(0, t - i * 0.12)
            ctx.draw(a[0] + (b[0] - a[0]) * tt, a[1] + (b[1] - a[1]) * tt, lift - 1, (g, px, py) => {
              g.globalAlpha = 0.8 - i * 0.2
              g.fillStyle = i % 2 ? '#ff78bc' : '#80f6ff'
              g.fillRect(px, py, 2, 2)
            })
          }
        }
        // A glint on the wing while it hovers.
        if (!ctx.reduced && local < hover && Math.floor(clock * 6) % 3 === 0) {
          ctx.draw(fx, fy, lift + 3, (g, px, py) => {
            g.fillStyle = '#ffffff'
            g.fillRect(px + (flip ? 1 : -1), py - 1, 1, 1)
          })
        }
      }
    }
  },
}

export default fly
