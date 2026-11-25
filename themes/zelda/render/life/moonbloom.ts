/**
 * Moonblooms (docs/art/life-catalog.json → moonbloom). Pale lilac flowers in rare clumps on the grass of the Green
 * Miles (meadow) and the Neon Coast. They are closed bud by day and open as the night deepens (half, open, wide);
 * open ones give off a soft white-violet glow and let motes of pale gold pollen drift up in a slow wavy line,
 * fading. Come within 2.5 tiles and they lean a pixel toward you and open one step further.
 * Frames drawn by Codex (scripts/life-lab/draw.sh). The sprite cannot be rotated through `LifeCtx.add`, so the lean
 * is a one-pixel shift of the whole flower.
 */
import type { Critter } from './types'

const moonbloom: Critter = {
  id: 'moonbloom',
  maps: ['overworld'],
  realms: ['meadow'],
  when: 'always',
  pal: {o: '#332346', q: '#9a79cb', p: '#c9afef', h: '#e9d9ff', w: '#fff6ff', e: '#24504e', g: '#4e9479', s: '#8bc9a0', a: '#fff0af'},
  frames: {
    moonbloom_0: [
      '.......',
      '...o...',
      '..opo..',
      '..oqho.',
      '...oo..',
      '...g...',
      '.esg...',
      '..eg...',
      '...g...',
    ],
    moonbloom_1: [
      '.......',
      '..o.o..',
      '.ophpo.',
      '.oqhpo.',
      '..oqo..',
      '...g...',
      '.esg...',
      '..eg...',
      '...g...',
    ],
    moonbloom_2: [
      '.......',
      '.o.a.o.',
      '.oh.ho.',
      '.opwpo.',
      '..oqo..',
      '...g...',
      '.esg...',
      '..eg...',
      '...g...',
    ],
    moonbloom_3: [
      '..a....',
      'o......',
      'oh...ho',
      'ophwhpo',
      '.oqpqo.',
      '...g...',
      '.esg...',
      '..eg...',
      '...g...',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time, sun } = ctx
    const hero = ctx.s.hero
    // The bud opens with the dark: closed, half, open, wide.
    const base = sun > 0.3 ? 0 : sun > 0.12 ? 1 : sun > -0.25 ? 2 : 3
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        const c = ctx.at(x, y)
        if (c !== ';' && c !== ':') continue
        const seed = ctx.seed(x, y, 521)
        if (seed > (c === ':' ? 0.12 : 0.08)) continue
        // A clump of two or three, the first at the tile's centre.
        const n = 1 + Math.floor(ctx.seed(x, y, 522) * 3)
        for (let i = 0; i < n; i++) {
          const bx = x + 0.5 + (i === 0 ? 0 : (ctx.seed(x, y, 523 + i) - 0.5) * 0.9)
          const by = y + 0.8 + (i === 0 ? 0 : (ctx.seed(x, y, 530 + i) - 0.5) * 0.4)
          const dx = hero.x - bx
          const d = Math.hypot(dx, hero.y - by)
          const near = d < 2.5
          const stage = Math.min(3, base + (near && base >= 1 ? 1 : 0))
          const lean = near ? Math.sign(dx) / 16 : 0
          const clock = time + seed * 50 + i * 3
          const sway = ctx.reduced ? 0 : Math.sin(clock * 0.7) * 0.02
          ctx.add(moonbloom, `moonbloom_${stage}`, bx + lean + sway, by)
          if (stage < 2) continue
          const breathe = ctx.reduced ? 0 : 0.5 + 0.5 * Math.sin(clock * 1.1)
          ctx.glow(bx, by - 0.35, stage === 3 ? 1 : 0.8, '#d9c6ff', 0.28 + 0.12 * breathe + (stage === 3 ? 0.08 : 0))
          if (ctx.reduced) continue
          // Three motes in flight at once, each rising 2 tiles over 4.5 s in a wavy line.
          for (let m = 0; m < 3; m++) {
            const life = (clock * 0.22 + m / 3) % 1
            const id = Math.floor(clock * 0.22 + m / 3)
            const off = ctx.seed(x * 7 + i, y * 5 + m, 540 + (id & 15)) * 6.28
            const wx = bx + Math.sin(life * 7 + off) * 0.18
            const fade = Math.sin(life * Math.PI)
            ctx.draw(wx, by, 8 + life * 30, (g, px, py) => {
              g.globalAlpha = fade * 0.9
              g.fillStyle = life < 0.5 ? '#ffe9a0' : '#fff3c4'
              g.fillRect(px, py, 1, 1)
            })
          }
        }
      }
    }
  },
}

export default moonbloom
