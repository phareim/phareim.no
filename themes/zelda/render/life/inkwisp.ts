/**
 * Inkwell wisps (docs/art/life-catalog.json → inkwisp). A tilted ink bottle sits on the sand beside the
 * path. Every seven seconds a rose wisp climbs out, borrows a golden feather and scrawls a crooked
 * star on the sand (a 12x12 drawn sprite), then ducks back inside. The glow is rose at noon, violet at dusk and dawn, cyan at night. Near the hero it stays in the bottle. Frames drawn by Codex (scripts/life-lab/draw.sh).
 */
import type { Critter } from './types'

const ink: Critter = {
  id: 'inkwisp',
  maps: ['overworld'],
  when: 'always',
  pal: {o: '#101731', b: '#15223f', e: '#43648e', t: '#2ff3ff', s: '#8e6e62', S: '#b28b72', c: '#7c5949', C: '#b08262', w: '#804a75', r: '#d989ac', R: '#f6b3cc', m: '#ffe6e7', g: '#bb8343', Y: '#ffd23f', p: '#3c2647', f: '#ff7fb0', H: '#ffd0e0'},
  frames: {
    inkwisp_Bottle: [
      '.........',
      '.........',
      '.........',
      '...oeo...',
      '..oetbo..',
      '.oebbo.cs',
      '.obbbo.cC',
      'sSoooSSs.',
    ],
    inkwisp_Quill: [
      '.....Yg..',
      '..wRrg...',
      '..worw...',
      '...oeo...',
      '..oetbo..',
      '.oebbo.cs',
      '.obbbo.cC',
      'sSoooSSs.',
    ],
    inkwisp_Sign: [
      '...Rr..Y.',
      '..wor.gY.',
      '..wrmrg..',
      '...oeo...',
      '..oetbo..',
      '.oebbo.cs',
      '.obbbo.cC',
      'sSoooSSs.',
    ],
    inkwisp_Star: [
      '....ppp.....',
      '...ppHpp....',
      '...pfpfp....',
      'ppppfpfppppp',
      'pHffpppfffHp',
      'ppfpp.pppfpp',
      '.ppfp..pfpp.',
      '.ppfppppfp..',
      '.pfppfppfpp.',
      '.pfffpffpfp.',
      '.pHpppppfHp.',
      '.ppp...pppp.',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time, sun } = ctx
    const hero = ctx.s.hero
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        if (ctx.at(x, y) !== '-') continue
        if (ctx.seed(x, y, 523) > 1 / 4) continue
        // Beach-ish sand within three tiles of a path.
        let path = false
        for (let j = -3; j <= 3 && !path; j++) {
          for (let i = -3; i <= 3; i++) if (ctx.at(x + i, y + j) === ',') { path = true; break }
        }
        if (!path) continue
        const bx = x + 0.5
        const by = y + 0.62
        const near = Math.hypot(hero.x - bx, hero.y - by) < 1.4
        const phase = ctx.reduced ? 0 : (time + ctx.seed(x, y, 524) * 7) % 7
        let name = 'inkwisp_Bottle'
        let grow = 0 // 0..1: how much of the star is inked so far
        let fade = 1
        if (!near && phase >= 4.6 && phase < 5.0) {
          name = 'inkwisp_Quill'
          grow = (phase - 4.6) / 0.4
        } else if (!near && phase >= 5.0 && phase < 6.3) {
          name = 'inkwisp_Sign'
          grow = 1
          // The finished star holds for the whole second, then melts away.
          fade = phase < 6.0 ? 1 : 1 - (phase - 6.0) / 0.3
        }
        ctx.add(ink, name, bx, by, 0)
        if (grow === 0) continue
        const rgb = sun > 0.35 ? '#ff7fb0' : sun > -0.3 ? '#c79bff' : '#2ff3ff'
        const mx = bx + 16 / 16
        // The star is a sprite (so it scales with the view); the sprite is pale rose, the glow carries the hour.
        ctx.add(ink, 'inkwisp_Star', mx, by + 0.08, 1, false, Math.min(1, grow * 1.4) * fade)
        ctx.glow(mx, by - 0.1, 0.9, rgb, (name === 'inkwisp_Sign' ? 0.35 : 0.15 + 0.2 * grow) * fade)
      }
    }
  },
}

export default ink
