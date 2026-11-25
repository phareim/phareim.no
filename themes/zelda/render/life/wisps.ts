/**
 * Will-o-wisps (docs/art/life-catalog.json → wisps). Over the deep water south of the Wildwood, two little
 * processions of three wisps bob along like lanterns on a string, flickering, with a faint reflection pixel
 * on the water under each. They keep about 3 tiles from the hero (they slide further out onto the lake when he is
 * on the shore). Frames drawn by Codex (scripts/life-lab/draw.sh).
 * Placement: a lane per procession over the water rows (`~`), the leader's position a function of the clock;
 * "drift ahead when followed" would need memory of the hero's heading, so they only keep their distance.
 */
import type { Critter } from './types'

/** Each procession: lane row, start offset, speed in tiles per second (negative goes west). */
const LANES = [
  { y: 47.6, speed: 0.55, off: 0.1, a: 5 },
  { y: 49.6, speed: -0.45, off: 0.62, a: 7 },
] as const
const SPACING = 1.6

const wisps: Critter = {
  id: 'wisps',
  maps: ['wildwood'],
  when: 'dark',
  pal: {n: '#172943', t: '#207b80', e: '#0b1e33', g: '#3af4cc', h: '#a3ffea', w: '#f3fff9'},
  frames: {
    wisps_0: [
      '..t...',
      '..gt..',
      '..hgt.',
      '.ghgt.',
      'thewet',
      'tgwwgt',
      '.tggt.',
      '..tt..',
      '...n..',
    ],
    wisps_1: [
      '...t..',
      '..tg..',
      '.tghg.',
      '.ghgt.',
      'thewet',
      'tgwwgt',
      '.tggt.',
      '..tt..',
      '...n..',
    ],
    wisps_2: [
      '......',
      '.tg...',
      '.ghg..',
      '.ghgt.',
      'thewet',
      'tgwwgt',
      '.tggt.',
      '..tt..',
      '...n..',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    const w = ctx.s.map.w
    const span = w + 8
    for (const [li, lane] of LANES.entries()) {
      for (let i = 0; i < 3; i++) {
        // Position along the lane, wrapping around the lake with a margin so they never pop in view.
        const base = (lane.off * span + time * lane.speed - i * SPACING * Math.sign(lane.speed) + span * 4) % span
        const lx = base - 4
        if (Math.abs(lx - hx) > range + 3) continue
        const clock = time + i * 0.9 + li
        let wx = lx
        let wy = lane.y + Math.sin(lx * 0.15 + li) * 1.1
        if (ctx.at(Math.floor(wx), Math.floor(wy)) !== '~') continue
        // Keep about 3 tiles from the hero, pushing out onto the lake.
        const dx = wx - hero.x
        const dy = wy - hero.y
        if (Math.hypot(dx, dy) < 3.2) wy = hero.y + Math.sqrt(Math.max(0, 3.2 * 3.2 - dx * dx))
        wy = Math.min(wy, 50.8)
        const lift = 7 + Math.sin(clock * 2.1) * 2.5
        const fr = ctx.reduced ? 0 : Math.floor(clock * 7 + i * 3) % 3
        // Fade at the lane's edges so they do not blink in at the screen edge.
        const edge = Math.min(1, Math.max(0, (range + 3 - Math.abs(lx - hx)) / 2))
        ctx.add(wisps, `wisps_${fr}`, wx, wy, lift, false, edge)
        const flick = ctx.reduced ? 0 : 0.1 * Math.sin(clock * 11) + 0.06 * Math.sin(clock * 23)
        ctx.glow(wx, wy - lift / 16 - 0.35, 1.8, '#4ff7d0', Math.max(0, (0.5 + flick) * edge))
        // Reflection: three faded pixels in the water below.
        ctx.draw(wx, wy, -3, (g, px, py) => {
          g.fillStyle = '#7ffbe0'
          g.globalAlpha = 0.35 * edge
          g.fillRect(px - 1, py, 3, 1)
          g.globalAlpha = 0.18 * edge
          g.fillRect(px - 2 + (Math.floor(clock * 3) % 2), py + 2, 4, 1)
        })
      }
    }
  },
}

export default wisps
