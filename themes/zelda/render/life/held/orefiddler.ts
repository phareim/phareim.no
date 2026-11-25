/**
 * Ore fiddlers (docs/art/life-catalog.json → orefiddler). A quartz beetle sits below a lumen-ore column in
 * Lumenby Quarry and plucks it with its forelegs like a harp string; the rock answers with two ripples of cyan
 * light. Frames drawn by Codex (scripts/life-lab/draw.sh).
 * Placement: one in five lumen-ore tiles 'е' with quarry floor '-' directly south. Lumenby is iso only.
 */
import type { Critter } from '../types'

const LOOP = 3.6
// Pluck starts inside the loop: [start, end) of each pose.
function poseAt(t: number): 'Rest' | 'Pluck' | 'Recoil' {
  if (t >= 2.6 && t < 2.8) return 'Pluck'
  if (t >= 2.8 && t < 2.98) return 'Recoil'
  if (t >= 2.98 && t < 3.14) return 'Pluck'
  return 'Rest'
}
const PLUCKS = [2.6, 2.98]

const beetle: Critter = {
  id: 'orefiddler',
  realms: ['lumenby'],
  when: 'always',
  pal: {o: '#6a5aa0', r: '#8d7bc4', j: '#d2b0e8', q: '#d8c8f4', h: '#e3d6f7', p: '#f5edff', k: '#187b9d', c: '#2ff3ff', C: '#b3ffff', s: '#ffffff'},
  frames: {
    orefiddler_Rest: [
      '...j...j...',
      '...oj.jo...',
      '.jj.ooo.jj.',
      '.ojohqhojo.',
      '..oqhphqo..',
      '.orqCccqro.',
      '.ojqcCkqjo.',
      '..orqqqro..',
      '...ooooo...',
    ],
    orefiddler_Pluck: [
      '.s.j...j...',
      '.j.oj.jo...',
      '.jo.ooo.jj.',
      '..johqhojo.',
      '..oqhphqo..',
      '.orqCccqro.',
      '.ojqcCkqjo.',
      '..orqqqro..',
      '...ooooo...',
    ],
    orefiddler_Recoil: [
      '...j...j...',
      '...oj.jo...',
      '....o.o....',
      '..jjooojj..',
      '..ojhqhjo..',
      '.orqpccqro.',
      '.ojhCccqjo.',
      '.orqkckqro.',
      '..ooooooo..',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const a0 = ctx.sun < 0 ? 0.23 : ctx.sun < 0.35 ? 0.17 : 0.09
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        if (ctx.at(x, y) !== 'е' || ctx.at(x, y + 1) !== '-') continue
        if (ctx.seed(x, y, 801) > 0.2) continue
        const t = (time + ctx.seed(x, y, 802) * LOOP) % LOOP
        const bx = x + 0.5
        const by = y + 1.5
        // Self-lit: the quarry's red grade darkens the pale art, so the beetle carries its own additive bloom.
        const plucking = !ctx.reduced && (poseAt(t) !== 'Rest')
        ctx.draw(bx, by - 0.02, 5, (g, px, py) => {
          const r = plucking ? 10 : 8
          const gr = g.createRadialGradient(px, py, 0, px, py, r)
          gr.addColorStop(0, '#9ffcff')
          gr.addColorStop(0.35, '#2ff3ff')
          gr.addColorStop(1, 'rgba(0,0,0,0)')
          g.globalCompositeOperation = 'lighter'
          g.globalAlpha = plucking ? 0.5 : 0.4
          g.fillStyle = gr
          g.fillRect(px - r, py - r, r * 2, r * 2)
        })
        ctx.add(beetle, `orefiddler_${poseAt(t)}`, bx, by)
        // Always a little light: a cyan glimmer at the beetle and a slow pulse on the ore face between plucks.
        const pulse = ctx.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * 2.2 + x * 1.7)
        ctx.glow(bx, by - 0.3, 0.6, '#2ff3ff', 0.3)
        ctx.glow(bx, y + 0.8, 0.5, '#2ff3ff', a0 * (0.35 + 0.35 * pulse))
        if (ctx.reduced) continue
        for (const p0 of PLUCKS) {
          const age = t - p0
          if (age < 0 || age >= 0.6) continue
          const k = age / 0.6
          // The ore face answers: a cyan glow that swells and fades, and two pixels stepping outward.
          ctx.glow(bx, y + 0.8, 0.3 + 0.8 * k, '#2ff3ff', a0 * 1.6 * (1 - k))
          const off = 3 + Math.floor(age / 0.1)
          ctx.draw(bx, by + 0.02, 12, (g, px, py) => {
            g.globalAlpha = 1 - k * 0.6
            g.fillStyle = '#2ff3ff'
            g.fillRect(px - off - 1, py, 1, 1)
            g.fillRect(px + off, py, 1, 1)
          })
          // And a ring of light running out from the plucked string (drawn at the beetle: the ore column would hide it).
          ctx.draw(bx, by + 0.02, 8, (g, px, py) => {
            g.globalAlpha = (1 - k) * 0.8
            g.strokeStyle = '#2ff3ff'
            g.lineWidth = 1
            g.beginPath()
            g.ellipse(px, py, 3 + k * 9, 1.5 + k * 4.5, 0, 0, Math.PI * 2)
            g.stroke()
          })
        }
      }
    }
  },
}
export default beetle
