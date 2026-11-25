/**
 * Awning slugs (docs/art/life-catalog.json → awningslug). After dark a violet slug inches back and forth
 * along the foot of a shopfront, stringing a garland of pink pixels that fades behind it, with a small
 * pink glow at its head. Frames drawn by Codex (scripts/life-lab/draw.sh).
 * Placement: 1 in 6 buildings 'H' with a path ',' directly south; a 10 px crawl, triangle wave, 7 s.
 */
import type { Critter } from './types'

const PERIOD = 7
const SPAN = 10

const slug: Critter = {
  id: 'awningslug',
  maps: ['overworld'],
  when: 'dark',
  pal: {o: '#3a2060', v: '#c9a0f0', s: '#9c6bc5', g: '#e6d0ff', f: '#ffe4bc', p: '#ff2fa0', r: '#df79ab'},
  frames: {
    awningslug_Long: [
      '............',
      '.......pp.pp',
      '.......fo.of',
      '........v.v.',
      '..ooooooovvo',
      'oogvggggvvvo',
      'offfffffffso',
      '.oooooooooo.',
    ],
    awningslug_Hump: [
      '............',
      '........p..p',
      '.......pf.pf',
      '...ooo.vo.v.',
      '..ogggsvvvvo',
      '.osvvvggvvvo',
      '..offfffffso',
      '...oooooooo.',
    ],
    awningslug_Blink: [
      '............',
      '......r....f',
      '......fr..ff',
      '....oo.vo.ov',
      '...oggvvvvvo',
      '..ogvgggvvvo',
      '..offfffffso',
      '...oooooooo.',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        if (ctx.at(x, y) !== 'H' || ctx.at(x, y + 1) !== ',') continue
        if (ctx.seed(x, y, 733) > 1 / 6) continue
        const off = ctx.seed(x, y, 734) * PERIOD
        /** The crawl's offset in whole px at `at` seconds, and whether it is heading right. */
        const where = (at: number): { px: number; right: boolean; since: number } => {
          const u = (((at + off) % PERIOD) + PERIOD) % PERIOD / PERIOD
          const tri = u < 0.5 ? u * 2 : 2 - u * 2
          return { px: Math.round((tri - 0.5) * SPAN), right: u < 0.5, since: (u * PERIOD) % (PERIOD / 2) }
        }
        const now = where(time)
        const cx = x + 0.5 + now.px / 16
        const cy = y + 0.97
        const pose = !ctx.reduced && now.since < 0.16 ? 'Blink' : Math.floor(time / 0.25) % 2 === 0 || ctx.reduced ? 'Long' : 'Hump'
        // Garland: where the slug was 180, 360 and 540 ms ago, oldest in rose.
        if (!ctx.reduced) {
          const seen = new Set<number>([now.px])
          for (const [ms, col] of [[0.18, '#ff2fa0'], [0.36, '#ff2fa0'], [0.54, '#df79ab']] as const) {
            const p = where(time - ms).px
            if (seen.has(p)) continue
            seen.add(p)
            ctx.draw(x + 0.5 + p / 16, cy, 0, (g, px, py) => {
              g.fillStyle = col
              g.fillRect(px, py - 1, 1, 1)
            })
          }
        }
        ctx.add(slug, `awningslug_${pose}`, cx, cy, 0, !now.right)
        // The head is the right end of the sprite, the left end when it turns.
        const hxp = cx + (now.right ? 4.5 : -4.5) / 16
        ctx.glow(hxp, cy - 3 / 16, 0.45, '#ff2fa0', 0.18)
      }
    }
  },
}
export default slug
