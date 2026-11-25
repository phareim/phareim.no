/**
 * Night owls (docs/art/life-catalog.json → owlwatch). Owls hidden in the dark tree crowns: only the big
 * gold eyes show. They blink, follow the hero with a glance as he passes, go wide-eyed when he is
 * close, and now and then one hoots and its eyes flash. Frames drawn by Codex (scripts/life-lab/draw.sh).
 */
import type { Critter } from './types'

const owl: Critter = {
  id: 'owlwatch',
  maps: ['overworld', 'wildwood'],
  when: 'dark',
  pal: {o: '#21152f', d: '#30203e', m: '#533356', f: '#79516a', s: '#bc752d', g: '#ffd23f', h: '#ffe67b', p: '#100a17', w: '#fff9e8'},
  frames: {
    owlwatch_l: [
      '.mo...om.',
      'omhdmdhmo',
      'opggdpggo',
      'omsdmdsmo',
      '.ommfmmo.',
      '..ooooo..',
    ],
    owlwatch_c: [
      '.mo...om.',
      'omhdmdhmo',
      'ogpgdgpgo',
      'omsdmdsmo',
      '.ommfmmo.',
      '..ooooo..',
    ],
    owlwatch_r: [
      '.mo...om.',
      'omhdmdhmo',
      'oggpdggpo',
      'omsdmdsmo',
      '.ommfmmo.',
      '..ooooo..',
    ],
    owlwatch_blink: [
      '.mo...om.',
      'ommdmdmmo',
      'osgsdsgso',
      'omddmddmo',
      '.ommfmmo.',
      '..ooooo..',
    ],
    owlwatch_wide: [
      '.mo...om.',
      'omhdmdhmo',
      'owpgdgpwo',
      'ogpsdspgo',
      '.osmfmso.',
      '..ooooo..',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    // The isometric view's crowns stand tall (lower eyes vanish behind them), so the eyes sit high and the
    // owl only lives where the classic view has more crown above it. (The contract has no view flag.)
    const lift = 40
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        if (ctx.at(x, y) !== 'T') continue
        if (ctx.seed(x, y, 641) > 0.035) continue
        if (ctx.at(x, y - 1) !== 'T' || ctx.at(x, y - 2) !== 'T') continue
        const ox = x + 0.5
        const oy = y + 1.3
        const dx = hero.x - ox
        const dist = Math.hypot(dx, hero.y - oy)
        const clock = time + ctx.seed(x, y, 642) * 60
        const blinkEvery = 3.5 + ctx.seed(x, y, 643) * 3
        const blinking = !ctx.reduced && clock % blinkEvery < 0.16
        // A hoot every ~17 s: wide eyes for 0.5 s and a flash.
        const hoot = !ctx.reduced && (clock + ctx.seed(x, y, 644) * 17) % 17 < 0.5
        let name = dx < -0.7 ? 'owlwatch_l' : dx > 0.7 ? 'owlwatch_r' : 'owlwatch_c'
        if (blinking) name = 'owlwatch_blink'
        if ((dist < 1.5 && !ctx.reduced) || hoot) name = 'owlwatch_wide'
        ctx.add(owl, name, ox, oy, lift)
        ctx.glow(ox, oy - lift / 16 + 0.2, 0.7, '#ffd23f', blinking ? 0.12 : hoot ? 0.7 : 0.5)
      }
    }
  },
}

export default owl
