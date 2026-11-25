/**
 * Haystack tea (docs/art/life-catalog.json → hayteacup). A field mouse beside a haystack in the meadow sets a
 * thimble on a bit of straw, pours tea from a seedpod (a gold drop falls) and sips it. Come within 1.6 tiles and
 * it holds the cup up to you, turning to face you. Any hour. Frames drawn by Codex (scripts/life-lab/draw.sh).
 * Placement: every second `meadow_hay_*` landmark (the catalogue says 1 in 3; a meadow region has only one or two
 * stacks), the mouse on the ground tile just south of the stack.
 */
import type { Critter } from '../types'

const LOOP = 6
const OPEN = '.,:;'

const mouse: Critter = {
  id: 'hayteacup',
  realms: ['meadow'],
  when: 'always',
  pal: {b: '#8a5e58', s: '#bc896d', t: '#e3b58a', f: '#f8d6ae', h: '#ffe8ce', p: '#f5b4c7', r: '#d6809f', e: '#644b59', n: '#b97077', d: '#367b9b', c: '#59b8ca', i: '#9de3df', w: '#fff3bc', g: '#ffd23f', a: '#c68a35', k: '#94644a', y: '#d5a256', v: '#a6cbc0'},
  frames: {
    hayteacup_set: [
      '................',
      '................',
      '...bbbb.........',
      '..bppprb........',
      '..bppprbb.......',
      '..bprrbffb......',
      '...bbfhfefb.....',
      '...bthfffhn..w..',
      '...btfffttb.v...',
      '..bsffttbtb.....',
      '..bstttsb.wggww.',
      '.bbstssb..diccd.',
      'bssbbttb...dcd..',
      '.bb..bbb.kywyyyk',
      '..........kyy.k.',
      '................',
    ],
    hayteacup_pour: [
      '................',
      '................',
      '...bbbb.........',
      '..bppprb........',
      '..bppprbb.......',
      '..bprrbffb..ag..',
      '...bbfhfefbagya.',
      '...bthfffhnagak.',
      '...btffftthag...',
      '..bsffttbtf.g...',
      '..bstttsb.wggww.',
      '.bbstssb..diccd.',
      'bssbbttb...dcd..',
      '.bb..bbb.kywyyyk',
      '..........kyy.k.',
      '................',
    ],
    hayteacup_sip: [
      '................',
      '................',
      '...bbbb.........',
      '..bppprb........',
      '..bppprbb.......',
      '..bprrbfbb..v...',
      '...bbfhfhbbw....',
      '...bthfffwggww..',
      '...btffftdiccdt.',
      '..bsffttsfdcdt..',
      '..bstttsb.......',
      '.bbstssb........',
      'bssbbttb........',
      '.bb..bbb.kywyyyk',
      '..........kyy.k.',
      '................',
    ],
    hayteacup_offer: [
      '................',
      '................',
      '...bbbb......v..',
      '..bppprb.....w..',
      '..bppprbb..wggww',
      '..bprrbffbtdicct',
      '...bbfhfett.dcd.',
      '...bthfffhs.....',
      '...btfffttb.....',
      '...btfftsb......',
      '...bsftsb.......',
      '..bbstsb........',
      '.bsbbtb.........',
      'bsb.btb..kywyyyk',
      '.b...b....kyy.k.',
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
      const y = l.y + 0.6
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
      const cupC = pose === 'offer' ? 13 : 12
      const cupR = pose === 'offer' ? 5 : 11
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
