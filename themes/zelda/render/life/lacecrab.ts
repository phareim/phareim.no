/**
 * Lacework crabs (docs/art/life-catalog.json → lacecrab). On the Neon Coast's wet sand a crab rakes a
 * scalloped pattern into the beach, twice every few seconds, and the lace stays for the rest of the loop
 * (peach by day, rose at dusk, pink and cyan peaks at night). Come close and it presses a shell into the
 * middle. Frames drawn by Codex (scripts/life-lab/draw.sh). Placement: about 2 in 5 shore sand tiles '-' (the coast has only ~14, so 1 in 12 would show none) with sand beside them.
 */
import type { Critter } from './types'

const LOOP = 6
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const

const crab: Critter = {
  id: 'lacecrab',
  maps: ['overworld'],
  when: 'always',
  pal: {l: '#262745', v: '#514060', c: '#9c405e', r: '#e07b98', b: '#ffadc1', d: '#6b385b', g: '#874260', e: '#ffe2ef', p: '#ffc2a5', s: '#fff0ca'},
  frames: {
    lacecrab_Rest: [
      '...e.e.s.',
      'r..d.d.ps',
      '.rcrbrcrc',
      'ccbrgrcc.',
      '.vcrrrcv.',
      'v.vcccv.v',
      '.........',
    ],
    lacecrab_Rake: [
      '.......s.',
      '..e.e..ps',
      '..cdbdcrc',
      '.cbrgrcc.',
      '.rcrrrcv.',
      '.rccccv.v',
      '.r.r.....',
    ],
    lacecrab_Stamp: [
      '...e.e..b',
      '...d.d.cr',
      '..crbrcr.',
      '.cbrgrcc.',
      'vrcrrrc.v',
      '.vcccv.v.',
      '..sp.....',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    const nightly = ctx.sun <= 0.12
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        if (ctx.at(x, y) !== '-') continue
        if (ctx.seed(x, y, 641) > 0.4) continue
        // On the shore: sand to either side and water in one cardinal direction (clockwise from north).
        const sandSides = ctx.at(x - 1, y) === '-' || ctx.at(x + 1, y) === '-'
        if (!sandSides) continue
        const face = DIRS.find(([dx, dy]) => ctx.at(x + dx, y + dy) === '~')
        if (!face) continue
        const t = (time + ctx.seed(x, y, 642) * LOOP) % LOOP
        const near = Math.hypot(hero.x - (x + 0.5), hero.y - (y + 0.5)) < 1.6
        const raking = (t >= 3 && t < 3.3) || (t >= 3.45 && t < 3.75)
        const pose = near ? 'Stamp' : raking ? 'Rake' : 'Rest'
        // Stays inside its own tile, nudged toward the water it faces.
        const cx = x + 0.5 + face[0] * 0.14
        const cy = y + 0.62 + face[1] * 0.14
        ctx.add(crab, `lacecrab_${pose}`, cx, cy, 0, face[0] > 0)
        // The lace: drawn from the first rake until the loop ends; whole while the hero admires it.
        const shown = near || t >= 3
        if (!shown) continue
        const fade = near || t < 5.5 ? 1 : (6 - t) / 0.5
        const done = near || t >= 3.45
        const lace = nightly ? null : ctx.sun > 0.35 ? '#ffc2a5' : '#e07b98'
        ctx.draw(cx, cy, 0, (g, px, py) => {
          g.globalAlpha = Math.max(0, fade)
          // Five arcs under the crab: crests on the top row, troughs joining them one row below.
          for (let i = 0; i < 5; i++) {
            const ox = px - 6 + i * 3
            if (i >= 2 && !done) continue
            const cyan = nightly && !ctx.reduced && (Math.floor(time / 0.3) + i) % 2 === 1
            g.fillStyle = nightly ? (cyan ? '#2ff3ff' : '#ff2fa0') : lace!
            g.fillRect(ox, py + 2, 1, 1)
            if (i < 4 || done) {
              g.fillStyle = nightly ? '#9a4a8a' : (ctx.sun > 0.35 ? '#e8a98f' : '#b05a77')
              g.fillRect(ox + 1, py + 3, 2, 1)
            }
          }
          if (near) {
            g.globalAlpha = 1
            g.fillStyle = '#ff9fc4'
            g.fillRect(px, py + 3, 1, 1)
          }
        })
        if (near && nightly) ctx.glow(cx, cy + 0.12, 0.45, '#ff2fa0', 0.16)
      }
    }
  },
}
export default crab
