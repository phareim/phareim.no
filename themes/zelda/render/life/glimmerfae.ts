/**
 * Glimmer fairies (docs/art/life-catalog.json → glimmerfae). Tiny fairies dance figure-eights over the
 * Neon Coast's glowing flowers in the dark hours, trailing glitter; when the hero comes close they scatter
 * to a safe distance and hover there, peeking back. Frames drawn by Codex (scripts/life-lab/draw.sh).
 *
 * The reference critter for `render/life/`: a placement rule over tiles, a frame from the clock, a reaction
 * from the hero's distance (no memory), a glow per body and freehand pixels for the trail.
 */
import type { Critter } from './types'

const COLORS = [
  { key: '', glow: '#ff2fa0' },
  { key: 'c', glow: '#2ff3ff' },
  { key: 'g', glow: '#ffd23f' },
] as const

const fae: Critter = {
  id: 'glimmerfae',
  maps: ['overworld'],
  when: 'dark',
  pal: {h: '#362449', i: '#ad7bc5', n: '#ac91af', W: '#fff8f6', w: '#626582', m: '#b6c5ea', v: '#e9f1ff', p: '#632458', r: '#c7318b', P: '#ff2fa0', R: '#ffade2', c: '#194d65', b: '#168fae', C: '#2ff3ff', B: '#b2fbff', g: '#61415d', y: '#c18532', G: '#ffd23f', Y: '#fff0ac'},
  frames: {
    glimmerfae_0: [
      'w..hih..w',
      'mv.iWh.vm',
      'wmvhnhvmw',
      '.wmwnwmw.',
      '..wpRpw..',
      '...rPp...',
      '..pRPrp..',
      '..rPPrr..',
      '...h.h...',
      '....P....',
    ],
    glimmerfae_1: [
      '...hih...',
      '...iWh...',
      '.w.hnh.w.',
      'mvmwnwmvm',
      'wmwpRpwmw',
      '.w.rPp.w.',
      '..pRPrp..',
      '..rPPrr..',
      '...h.h...',
      '....P....',
    ],
    glimmerfae_2: [
      '...hih...',
      '...iWh...',
      '...hnh...',
      '..wwnww..',
      '.mvpRpvm.',
      'wv.rPp.vw',
      'm.pRPrp.m',
      'w.rPPrr.w',
      '...h.h...',
      '....P....',
    ],
    glimmerfae_3: [
      '...hih...',
      '...iWh...',
      'w..hnh..w',
      'mvmwnwmvm',
      '.wmpRpmw.',
      '..wrPpw..',
      '..pRPrp..',
      '..rPPrr..',
      '...h.h...',
      '....P....',
    ],
    glimmerfae_c0: [
      'w..hih..w',
      'mv.iWh.vm',
      'wmvhnhvmw',
      '.wmwnwmw.',
      '..wcBcw..',
      '...bCc...',
      '..cBCbc..',
      '..bCCbb..',
      '...h.h...',
      '....C....',
    ],
    glimmerfae_c1: [
      '...hih...',
      '...iWh...',
      '.w.hnh.w.',
      'mvmwnwmvm',
      'wmwcBcwmw',
      '.w.bCc.w.',
      '..cBCbc..',
      '..bCCbb..',
      '...h.h...',
      '....C....',
    ],
    glimmerfae_c2: [
      '...hih...',
      '...iWh...',
      '...hnh...',
      '..wwnww..',
      '.mvcBcvm.',
      'wv.bCc.vw',
      'm.cBCbc.m',
      'w.bCCbb.w',
      '...h.h...',
      '....C....',
    ],
    glimmerfae_c3: [
      '...hih...',
      '...iWh...',
      'w..hnh..w',
      'mvmwnwmvm',
      '.wmcBcmw.',
      '..wbCcw..',
      '..cBCbc..',
      '..bCCbb..',
      '...h.h...',
      '....C....',
    ],
    glimmerfae_g0: [
      'w..hih..w',
      'mv.iWh.vm',
      'wmvhnhvmw',
      '.wmwnwmw.',
      '..wgYgw..',
      '...yGg...',
      '..gYGyg..',
      '..yGGyy..',
      '...h.h...',
      '....G....',
    ],
    glimmerfae_g1: [
      '...hih...',
      '...iWh...',
      '.w.hnh.w.',
      'mvmwnwmvm',
      'wmwgYgwmw',
      '.w.yGg.w.',
      '..gYGyg..',
      '..yGGyy..',
      '...h.h...',
      '....G....',
    ],
    glimmerfae_g2: [
      '...hih...',
      '...iWh...',
      '...hnh...',
      '..wwnww..',
      '.mvgYgvm.',
      'wv.yGg.vw',
      'm.gYGyg.m',
      'w.yGGyy.w',
      '...h.h...',
      '....G....',
    ],
    glimmerfae_g3: [
      '...hih...',
      '...iWh...',
      'w..hnh..w',
      'mvmwnwmvm',
      '.wmgYgmw.',
      '..wyGgw..',
      '..gYGyg..',
      '..yGGyy..',
      '...h.h...',
      '....G....',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        if (ctx.at(x, y) !== ':') continue
        const seed = ctx.seed(x, y, 907)
        if (seed > 0.22) continue
        const col = COLORS[Math.floor(seed * 1000) % 3]!
        const clock = time + seed * 40
        // A figure-eight over the flower, about 0.6 tiles wide.
        let fx = x + 0.5 + Math.sin(clock * 1.3) * 0.32
        let fy = y + 0.55 + Math.sin(clock * 2.6) * 0.14
        let lift = 9 + Math.sin(clock * 1.9) * 3
        // Scatter: pushed out to about 2.5 tiles from the hero, eased by how close he is.
        const dx = fx - hero.x
        const dy = fy - hero.y
        const d = Math.hypot(dx, dy)
        if (d < 2.5) {
          const k = (2.5 - d) / 2.5
          const n = d || 1
          fx += (dx / n) * k * 2.2
          fy += (dy / n) * k * 1.6
          lift += k * 10
        }
        const wing = ctx.reduced ? 0 : Math.floor(clock * 12) % 4
        const flip = Math.cos(clock * 1.3) < 0
        ctx.add(fae, `glimmerfae_${col.key}${wing}`, fx, fy, lift, flip)
        ctx.glow(fx, fy - lift / 16 - 0.3, 1.2, col.glow, 0.55 + 0.2 * Math.sin(clock * 5))
        // Glitter: five fading pixels along the path just behind.
        if (ctx.reduced) continue
        for (let i = 1; i <= 5; i++) {
          const c2 = clock - i * 0.07
          const tx = x + 0.5 + Math.sin(c2 * 1.3) * 0.32 + (fx - (x + 0.5 + Math.sin(clock * 1.3) * 0.32))
          const ty = y + 0.55 + Math.sin(c2 * 2.6) * 0.14 + (fy - (y + 0.55 + Math.sin(clock * 2.6) * 0.14))
          const tl = lift - 4 + i * 0.6
          const a = (1 - i / 6) * (0.5 + 0.5 * Math.sin(clock * 17 + i * 2.1))
          ctx.draw(tx, ty, tl, (g, px, py) => {
            g.globalAlpha = a
            g.fillStyle = i < 3 ? '#ffffff' : col.glow
            g.fillRect(px, py, 1, 1)
          })
        }
      }
    }
  },
}

export default fae
