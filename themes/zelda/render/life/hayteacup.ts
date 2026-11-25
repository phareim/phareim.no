/**
 * Haystack tea (docs/art/life-catalog.json → hayteacup). A field mouse beside a haystack on Seter Fell sets a
 * thimble on a bit of straw, pours tea from a seedpod (a gold drop falls) and sips it. Come within 1.6 tiles and
 * it holds the cup up to you, turning to face you. Any hour. Frames drawn by Codex (scripts/life-lab/draw.sh).
 * Placement: every second `meadow_hay_*` landmark (the catalogue says 1 in 3; the Lower Pasture has four stacks),
 * the mouse on the ground tile just south of the stack.
 */
import type { Critter } from './types'

const LOOP = 6
const OPEN = '.,:;'

const mouse: Critter = {
  id: 'hayteacup',
  realms: ['seterfell'],
  when: 'always',
  pal: {o: '#3a2c33', n: '#25212a', e: '#191823', f: '#7d6a5f', l: '#a08c7c', i: '#8e6d73', p: '#b29983', h: '#e5cfaa', r: '#367b9b', c: '#59b8ca', q: '#c4f5ed', b: '#c68a35', g: '#ffd23f', k: '#ffe788', w: '#fff3bc', s: '#e6cc85', d: '#ad8d60'},
  frames: {
    hayteacup_set: [
      '................',
      '................',
      '................',
      '................',
      '....oo.oo.......',
      '...oiooio.......',
      '...offfoo.......',
      '..offefon.......',
      'o.oflllo........',
      'o.ofllpo.rrrrr..',
      '.oofllp..rqccr..',
      '..oopopo..rcr...',
      '.........wswwss.',
      '........swdssdw.',
      '................',
      '................',
    ],
    hayteacup_pour: [
      '................',
      '................',
      '................',
      '................',
      '....oo.oo.......',
      '...oiooio.ooo...',
      '...offfooobggbo.',
      '..offefonpbbok..',
      'o.oflllop.o.g...',
      'o.ofllpo.rrrrr..',
      '.oofllp..rqccr..',
      '..oopopo..rcr...',
      '.........wswwss.',
      '........swdssdw.',
      '................',
      '................',
    ],
    hayteacup_sip: [
      '................',
      '................',
      '................',
      '................',
      '....oo.oo.......',
      '...oiooio.......',
      '...offooo.......',
      '..offhlon.......',
      'o.oflllrrrrr....',
      'o.ofllppqccr....',
      '.oofllpprcr.....',
      '..oopopo........',
      '.........wswwss.',
      '........swdssdw.',
      '................',
      '................',
    ],
    hayteacup_offer: [
      '................',
      '................',
      '............w...',
      '....oo.oo.rrrrr.',
      '...oiooio.rqccr.',
      '...offfoo.rcccr.',
      '...offefonprrrp.',
      '...oflllopooopo.',
      'o..oflloo..oo...',
      'o.oflloo........',
      '.ooflfo.........',
      '...opopo........',
      '....p.p..wswwss.',
      '........swdssdw.',
      '................',
      '................',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    for (const l of ctx.landmarks) {
      if (!l.art.startsWith('meadow_hay')) continue
      const tx = Math.floor(l.x)
      const ty = Math.floor(l.y) + 1
      if (Math.abs(tx - hx) > range + 1 || Math.abs(ty - hy) > range + 1) continue
      const seed = ctx.seed(tx, ty, 311)
      if (seed > 0.5 || !OPEN.includes(ctx.at(tx, ty))) continue
      const x = l.x + 0.3
      const y = l.y + 0.95
      const near = Math.hypot(hero.x - x, hero.y - y) < 1.6
      const flip = near ? hero.x < x : false
      const t = ctx.reduced ? 0 : (time + seed * LOOP) % LOOP
      let pose = 'set'
      if (near) pose = 'offer'
      else if (t >= 2.8 && t < 3.3) pose = 'pour'
      else if (t >= 3.3 && t < 4) pose = 'sip'
      ctx.add(mouse, `hayteacup_${pose}`, x, y, 0, flip)
      // A sprite column (0..15) as a screen offset from the feet; mirrored when flipped.
      const col = (c: number) => (flip ? 15 - c : c) - 8
      // The cup sits at the right of the sprite, in `offer` held up high. A steady warm glow under it.
      const cupC = pose === 'offer' ? 12 : pose === 'sip' ? 10 : 11
      const cupR = pose === 'offer' ? 4 : pose === 'sip' ? 8 : 10
      ctx.glow(x + col(cupC) / 16, y - (15 - cupR) / 16, 0.5, '#ffd23f', ctx.reduced ? 0.25 : 0.3 + (pose === 'pour' ? 0.1 : 0))
      if (ctx.reduced) continue
      // Steam: two cream pixels drift up from the cup on a slow loop, one half a loop behind the other.
      ctx.draw(x, y, 0, (g, px, py) => {
        for (let i = 0; i < 2; i++) {
          const p = (time * 0.7 + seed + i * 0.5) % 1
          g.globalAlpha = 1 - p
          g.fillStyle = i ? '#9de3df' : '#fff3bc'
          g.fillRect(px + col(cupC) + Math.round(Math.sin(p * 6.3 + i * 2)), py - 15 + cupR - 2 - Math.floor(p * 9), 1, 1)
        }
        g.globalAlpha = 1
        // A twinkle at the rim: a cream cross flashes once a second.
        if ((time + seed) % 1 < 0.15) {
          g.fillStyle = '#ffffff'
          const cx = px + col(cupC), cy = py - 15 + cupR
          g.fillRect(cx - 1, cy, 3, 1)
          g.fillRect(cx, cy - 1, 1, 3)
        }
        if (pose === 'pour') {
          // The gold drop falls from the seedpod lip into the cup, one step every 90 ms.
          const step = Math.floor((t - 2.8) / 0.09) % 3
          g.fillStyle = '#ffd23f'
          g.fillRect(px + col(cupC + 1), py - 15 + cupR - 3 + step, 1, 1)
        }
      })
    }
  },
}

export default mouse
