/**
 * Birchback lanterns (docs/art/life-catalog.json → birchghost). A birch spirit sits in the branches on a sleeping
 * troll's back in Seter Fell and cups a leaf lantern; whenever the troll breathes in, the lantern peeks through
 * its fingers, then eases shut again. Frames drawn by Codex (scripts/life-lab/draw.sh).
 * Placement: every second `seter_troll_big_0` landmark, hashed on its anchor tile; dusk and dawn.
 * (Seter Fell has the isometric view only, so the troll is found among `ctx.landmarks`.)
 */
import type { Critter } from './types'

const LOOP = 5

type Pose = 'Cup' | 'Crack' | 'Open'
function poseAt(t: number): { pose: Pose, age: number } {
  if (t < 2) return { pose: 'Cup', age: t }
  if (t < 2.4) return { pose: 'Crack', age: t - 2 }
  if (t < 3.5) return { pose: 'Open', age: t - 2.4 }
  return { pose: 'Cup', age: t - 3.5 }
}
const GLOW: Record<Pose, number> = { Cup: 0.22, Crack: 0.3, Open: 0.42 }

const spirit: Critter = {
  id: 'birchghost',
  realms: ['seterfell'],
  when: 'dusk-dawn',
  pal: {r: '#f4efff', w: '#ffffff', p: '#d8d2e6', s: '#8f889e', d: '#38394a', g: '#ffd23f', m: '#fff2b6', b: '#b78242', h: '#ee89ac'},
  frames: {
    birchghost_Cup: [
      '............',
      '.....rr.....',
      '....rwwr....',
      '...rwpppr...',
      '..rwpppssr..',
      '..rwpdpdpr..',
      '..rwpppssr..',
      '.rwpsppsspr.',
      '.rpswppwspr.',
      '.rsswpgwpsr.',
      '.rspwwwwssr.',
      '..rssppssr..',
      '...rsspsr...',
      '....rrrr....',
    ],
    birchghost_Crack: [
      '......rr....',
      '.....rwwr...',
      '...rrwppr...',
      '..rwpppssr..',
      '..rwpdpdpr..',
      '..rwpppssr..',
      '.rwpsppsspr.',
      '.rswspgswpr.',
      '.rswpbmbwsr.',
      '.rspwwgwspr.',
      '..rssppssr..',
      '...rsspsr...',
      '....rrrr....',
      '............',
    ],
    birchghost_Open: [
      '.....rr.....',
      '....rwwr....',
      '...rwpppr...',
      '..rwppphsr..',
      '..rwpdpdpr..',
      '..rwpppssr..',
      '.rwpspgsspr.',
      '.rswpgmgspr.',
      '.rswggmggwr.',
      '.rspwgmgswr.',
      '..rsspgssr..',
      '...rsspsr...',
      '....rrrr....',
      '............',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    for (const lm of ctx.landmarks) {
      if (lm.art !== 'seter_troll_big_0') continue
      const tx = Math.floor(lm.x)
      const ty = Math.floor(lm.y)
      if (Math.abs(tx - hx) > range + 2 || Math.abs(ty - hy) > range + 2) continue
      if (ctx.seed(tx, ty, 611) > 0.5) continue
      const t = (time + ctx.seed(tx, ty, 612) * LOOP) % LOOP
      const { pose, age } = poseAt(t)
      // On the birch at the troll's back: a little up and to the back of its anchor.
      const bx = lm.x - 0.25
      const by = lm.y - 0.1
      const lift = 6 + (pose === 'Cup' ? 0 : 1)
      ctx.add(spirit, `birchghost_${pose}`, bx, by, lift)
      // A warm glow that never goes out, so the lantern shows even shut; it swells as the leaf opens.
      const gy = by - (lift + 5) / 16
      ctx.glow(bx, gy, pose === 'Open' ? 0.85 : 0.6, '#ffd23f', GLOW[pose])
      if (pose !== 'Open' || ctx.reduced) continue
      // A rose pinprick on the branch above, and three motes of leaf light drifting up and away.
      ctx.draw(bx, by, lift + 16, (g, px, py) => {
        g.fillStyle = '#ee89ac'
        g.fillRect(px, py, 1, 1)
      })
      const k = age / 1.1
      for (let i = 0; i < 3; i++) {
        const kk = Math.min(1, k + i * 0.08)
        ctx.draw(bx + Math.sin(kk * 5 + i * 2) * 0.18 + (i - 1) * 0.12, by, lift + 8 + kk * 16 + i * 2, (g, px, py) => {
          g.globalAlpha = 1 - kk
          g.fillStyle = kk < 0.4 ? '#fff2b6' : '#ffd23f'
          g.fillRect(px, py, i === 0 ? 2 : 1, i === 0 ? 2 : 1)
        })
      }
    }
  },
}
export default spirit
