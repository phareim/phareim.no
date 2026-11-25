/**
 * Pit weavers (docs/art/life-catalog.json → pitweaver). In the Wildwood's big pit, a spider hangs from the trees
 * above the north rim. Every 8 s it lowers itself a few pixels on a violet thread, stitching a tiny cyan crescent
 * pixel by pixel, hangs there to admire it (the crescent glows), then climbs back and the stitches fade.
 * Frames drawn by Codex (scripts/life-lab/draw.sh). Placement: pit tiles 'O' with a tree 'T' directly north
 * (the pit has five of them, so 3 in 5 get a weaver rather than the catalogue's 1 in 13).
 */
import type { Critter } from './types'

/** The crescent: seven fixed pixels beside the thread (dx from the thread column, dy from the top of the spider at rest). */
const STITCH: readonly (readonly [number, number])[] = [[5, 0], [6, 2], [6, 4], [6, 6], [5, 8], [4, 9], [2, 10]]
const LOOP = 8

const weaver: Critter = {
  id: 'pitweaver',
  maps: ['wildwood'],
  when: 'dark',
  pal: {s: '#151930', p: '#5e3a77', h: '#80529e', j: '#ad79d8', g: '#ffd23f', c: '#2ff3ff', t: '#defcff'},
  frames: {
    pitweaver_Hang: [
      '...j...',
      '..jsj..',
      '.jhphj.',
      'jscscsj',
      '.jpgpj.',
      's.sss.s',
      '.j...j.',
    ],
    pitweaver_Stitch: [
      '...j...',
      '..jsj..',
      'tjhphjt',
      '.scscs.',
      '.jpgpj.',
      's.sss.s',
      '.j...j.',
    ],
    pitweaver_Admire: [
      '...j...',
      '..jsj..',
      '.scscs.',
      '.jphpj.',
      '.spgps.',
      '.jsssj.',
      '..j.j..',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        if (ctx.at(x, y) !== 'O' || ctx.at(x, y - 1) !== 'T') continue
        const seed = ctx.seed(x, y, 613)
        if (seed > 0.6) continue
        // Reduced motion: a calm Hang at the rim, no stitching.
        const t = ctx.reduced ? 1 : (time + seed * LOOP * 7) % LOOP
        let d = 0
        let name = 'pitweaver_Hang'
        let shown = 0
        let fade = 1
        if (t >= 4.4 && t < 5) {
          const u = (t - 4.4) / 0.6
          d = 4 * u
          name = 'pitweaver_Stitch'
          shown = Math.min(7, Math.floor((t - 4.4) / 0.08) + 1)
        } else if (t >= 5 && t < 6.8) {
          d = 4
          name = 'pitweaver_Admire'
          shown = 7
        } else if (t >= 6.8) {
          const u = (t - 6.8) / 1.2
          d = 4 * (1 - u)
          shown = 7
          fade = 1 - u
        }
        d = Math.round(d)
        const cxT = x + 0.5
        // The spider hangs in the pit's mouth, just in front of the north rim, from a thread tied up in the trees
        // (a spider lowered below the rim vanishes behind the pit wall in the iso view).
        const fy = y + 0.45
        const L0 = 9
        const lift = L0 - d
        // The thread runs from the canopy down to the spider's top pixel.
        ctx.draw(cxT, fy, lift, (g, px, py) => {
          g.globalAlpha = 0.9
          g.fillStyle = '#ad79d8'
          g.fillRect(px, py - 7 - 12, 1, 12)
        })
        ctx.add(weaver, name, cxT, fy, lift)
        // The stitches stay put as the spider descends: positioned from the rest height.
        if (shown > 0 && fade > 0) {
          ctx.draw(cxT, fy, L0, (g, px, py) => {
            g.fillStyle = '#2ff3ff'
            for (let i = 0; i < shown; i++) {
              const p = STITCH[i]!
              g.globalAlpha = fade * (name === 'pitweaver_Admire' ? 0.75 + 0.25 * Math.sin(time * 6 + i) : 1)
              g.fillRect(px + p[0], py - 7 + p[1], 1, 1)
            }
          })
        }
        if (name === 'pitweaver_Admire') ctx.glow(cxT + 0.3, fy - (lift + 4) / 16, 0.8, '#2ff3ff', 0.32)
        else if (shown > 0 && fade > 0) ctx.glow(cxT + 0.3, fy - (lift + 4) / 16, 0.5, '#2ff3ff', 0.1 * fade)
        // A faint violet gleam on the spider itself, so it can be found in the dark.
        ctx.glow(cxT, fy - (lift + 4) / 16, 0.45, '#9a6bff', 0.2)
      }
    }
  },
}

export default weaver
