/**
 * Fjord crown jellies (docs/art/life-catalog.json → fjordcrown). Tiny jellyfish drift in the dark water of Yule
 * Fjord beside the ice floes. Every few seconds one presses its bell to the ice, lifts three little prongs like a
 * crown, and the ice shows a three-pixel reflection of it a beat later. Cyan and violet glow colours alternate.
 * Frames drawn by Codex (scripts/life-lab/draw.sh). Placement: up to three open-water tiles around each
 * `fjord_floe_*` landmark (the floes are landmarks; the tiles under them are water). Yule Fjord is iso only.
 */
import type { Critter } from './types'

const LOOP = 3.4

type Pose = 'Bell' | 'Lift' | 'Crown'
function poseAt(t: number): { pose: Pose, age: number } {
  if (t < 1.6) return { pose: 'Bell', age: t }
  if (t < 1.9) return { pose: 'Lift', age: t - 1.6 }
  if (t < 2.7) return { pose: 'Crown', age: t - 1.9 }
  return { pose: 'Bell', age: t - 2.7 }
}

const jelly: Critter = {
  id: 'fjordcrown',
  realms: ['yulefjord'],
  when: 'dark',
  pal: {s: '#b9adff', b: '#8f84ff', t: '#c9bcff', p: '#e6ccff', c: '#2ff3ff', w: '#ffffff', h: '#a79aff', d: '#5fe0f0', v: '#c08cff'},
  frames: {
    fjordcrown_Bell: [
      '........',
      '..ssss..',
      '.shhtbs.',
      'sbbdbbbs',
      'sbbhhbbs',
      '.sthhts.',
      '..t.t.t.',
      '.h...t.h',
      '..h.h.h.',
    ],
    fjordcrown_Lift: [
      '........',
      '........',
      '.ssssss.',
      'shhccbbs',
      'sbbbhtbs',
      '.sthhts.',
      '..t.t.t.',
      '...h.h.h',
      '....h.h.',
    ],
    fjordcrown_Crown: [
      '...w....',
      '.p.p..p.',
      '.thptht.',
      'shhcbhbs',
      'sbbhhbbs',
      '.sthhts.',
      '..t.t.t.',
      '..h.h..h',
      '..h.h.ht',
    ],
    fjordcrown_BellV: [
      '........',
      '..ssss..',
      '.shhtbs.',
      'sbbvbbbs',
      'sbbhhbbs',
      '.sthhts.',
      '..t.t.t.',
      '.h...t.h',
      '..h.h.h.',
    ],
    fjordcrown_LiftV: [
      '........',
      '........',
      '.ssssss.',
      'shhppbbs',
      'sbbbhtbs',
      '.sthhts.',
      '..t.t.t.',
      '...h.h.h',
      '....h.h.',
    ],
    fjordcrown_CrownV: [
      '...w....',
      '.p.p..p.',
      '.thptht.',
      'shhpbhbs',
      'sbbhhbbs',
      '.sthhts.',
      '..t.t.t.',
      '..h.h..h',
      '..h.h.ht',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    for (const lm of ctx.landmarks) {
      if (!lm.art.startsWith('fjord_floe_')) continue
      const ax = lm.x
      const ay = lm.y - 0.35
      if (Math.abs(ax - hx) > range + 3 || Math.abs(ay - hy) > range + 3) continue
      const tx = Math.floor(lm.x)
      const ty = Math.floor(lm.y)
      for (let k = 0; k < 3; k++) {
        if (ctx.seed(tx, ty, 740 + k) > 0.75) continue
        // Around the floe at a hashed angle, on the water side of its edge.
        const ang = ((k + ctx.seed(tx, ty, 750 + k) * 0.7) / 3) * Math.PI * 2
        const dist = 0.8 + ctx.seed(tx, ty, 760 + k) * 0.3
        let jx = ax + Math.cos(ang) * dist
        let jy = ay + Math.sin(ang) * dist * 0.75
        if (ctx.at(Math.floor(jx - 0.3), Math.floor(jy - 0.3)) !== '~' || ctx.at(Math.floor(jx + 0.3), Math.floor(jy + 0.1)) !== '~') continue
        const violet = ctx.seed(tx, ty, 770 + k) < 0.5
        const t = (time + ctx.seed(tx, ty, 780 + k) * LOOP) % LOOP
        const { pose, age } = poseAt(t)
        // Toward the ice: 2 px in Lift and Crown.
        const dx = ax - jx
        const dy = ay - jy
        const n = Math.hypot(dx, dy) || 1
        const ux = dx / n
        const uy = dy / n
        const push = pose === 'Bell' ? 0 : 2 / 16
        jx += ux * push
        jy += uy * push
        const bob = ctx.reduced ? 0 : Math.sin(time * 1.4 + k * 2 + tx) * 1.2
        const lift = 3 + bob
        ctx.add(jelly, `fjordcrown_${pose}${violet ? 'V' : ''}`, jx, jy, lift)
        const col = violet ? '#c698ff' : '#2ff3ff'
        const crowning = pose === 'Crown'
        ctx.glow(jx, jy - 0.4, crowning ? 1 : pose === 'Lift' ? 0.75 : 0.6, col, crowning ? 0.55 : pose === 'Lift' ? 0.4 : 0.32)
        // The bell lights itself: a small additive bloom over the sprite, so it shines against the dark water.
        const bloom = crowning ? 0.6 : pose === 'Lift' ? 0.45 : 0.35
        ctx.draw(jx, jy, lift + 4, (g, x, y) => {
          const r = crowning ? 9 : 7
          const gr = g.createRadialGradient(x, y, 0, x, y, r)
          gr.addColorStop(0, col)
          gr.addColorStop(1, 'rgba(0,0,0,0)')
          g.globalCompositeOperation = 'lighter'
          g.globalAlpha = bloom * 0.6
          g.fillStyle = gr
          g.fillRect(x - r, y - r, r * 2, r * 2)
        })
        if (!crowning || ctx.reduced || age < 0.18 || age > 0.7) continue
        // The ice's reflection: three pixels along the edge, cyan and cream.
        const ex = jx + ux * 0.5
        const ey = jy + uy * 0.5
        const px = -uy
        const py = ux
        for (let i = -1; i <= 1; i++) {
          ctx.draw(ex + px * i * 0.11, ey + py * i * 0.11, 5, (g, x, y) => {
            g.fillStyle = i === 0 ? '#eefcff' : '#2ff3ff'
            g.fillRect(x, y, i === 0 ? 2 : 1, 1)
          })
        }
      }
    }
  },
}
export default jelly
