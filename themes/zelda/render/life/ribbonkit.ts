/**
 * Ribbon-tail kits (docs/art/life-catalog.json → ribbonkit). A little copper fox practises
 * pouncing on its own ribbon-shaped tail at the grass edge beside a path; when the hero comes close it
 * sits up straight like a formal portrait. Frames drawn by Codex (scripts/life-lab/draw.sh).
 */
import type { Critter } from './types'

const kit: Critter = {
  id: 'ribbonkit',
  maps: ['overworld', 'wildwood'],
  when: 'always',
  pal: {o: '#2a1a33', h: '#ffb070', f: '#f08a45', s: '#c25a2e', c: '#fff0cd', l: '#f7c49e', r: '#d0659d', d: '#a64580', p: '#ff2fa0', w: '#f4cee0', g: '#ffd23f'},
  frames: {
    ribbonkit_Stalk: [
      '....o..o......',
      '...ohooho.....',
      '...ochocho....',
      '.o.ohffhffooo.',
      'owohfoffffhffo',
      'ocpoccsffhffso',
      'orplccclfffsro',
      '.orpdolllsdrro',
      '..oprrrrpppro.',
      '...ooooooooo..',
    ],
    ribbonkit_Pounce: [
      '...o..o...g..c',
      '..ohooho...oo.',
      '..ocochoo.owco',
      '..ohfhffsopwro',
      '.ohfofffhprrdo',
      'oocccfffhprdso',
      '.oolccflprdsso',
      '...oslofpdrsfo',
      '....ooooooooo.',
      '..............',
    ],
    ribbonkit_Caught: [
      '..............',
      '..............',
      '...o..o.......',
      '..ohooho......',
      '..ochochooo...',
      '.ohfhffhffhoo.',
      'oofoffhfffffso',
      'occlcocolssrdo',
      'ocwplolprrrppo',
      '.oooooooooooo.',
    ],
    ribbonkit_Prim: [
      '...o...o......',
      '..oho.oho.....',
      '..ochohcho....',
      '..ohffhffo....',
      '.ohfoffffo.o..',
      'ooccchffsoopo.',
      '.ooccchffsprro',
      '...occlofsprro',
      '..ocwpprprrrdo',
      '...oooooooooo.',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    const dirs: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]] // N, E, S, W
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        if (ctx.at(x, y) !== ';') continue
        if (ctx.seed(x, y, 311) > 1 / 3) continue
        // The path side nearest the grass edge: N, E, S, W order breaks ties.
        let dir: readonly [number, number] | null = null
        for (const d of dirs) if (ctx.at(x + d[0], y + d[1]) === ',') { dir = d; break }
        if (!dir) continue
        const phase = ctx.reduced ? 0 : (time + ctx.seed(x, y, 312) * 5) % 5
        let name = 'ribbonkit_Stalk'
        let shift = 0 // classic px, along the path-to-grass axis (+ = into the grass)
        if (phase >= 3.6 && phase < 3.74) { name = 'ribbonkit_Pounce'; shift = 2 }
        else if (phase >= 3.74 && phase < 4.2) { name = 'ribbonkit_Caught'; shift = -1 }
        let ax = x + 0.5 + dir[0] * 0.3 - (dir[0] * shift) / 16
        let ay = y + 0.62 + dir[1] * 0.3 - (dir[1] * shift) / 16
        const dxh = hero.x - ax
        const near = Math.hypot(dxh, hero.y - ay) < 1.8
        if (near) { name = 'ribbonkit_Prim'; ax = x + 0.5; ay = y + 0.62 }
        // The drawn fox looks left; mirror it toward the hero when he is on its right.
        const flip = near ? dxh > 0 : (dir[0] !== 0 ? dir[0] > 0 : (x * 7 + y) % 2 === 0)
        ctx.add(kit, name, ax, ay, 0, flip)
        // A warm glow lifts the copper coat out of the dusk shade.
        ctx.glow(ax, ay - 0.3, 0.5, '#ffb070', 0.15)
        // A glint above the ribbon tip at the top of the pounce.
        if (name === 'ribbonkit_Pounce' && phase < 3.7 && !ctx.reduced) {
          const sx = flip ? -3 : 3
          ctx.draw(ax, ay, 9, (g, px, py) => {
            g.fillStyle = '#ffd23f'
            g.fillRect(px + sx, py - 1, 1, 1)
            g.fillStyle = '#fff0cd'
            g.fillRect(px + sx, py - 3, 1, 1)
          })
        }
      }
    }
  },
}

export default kit
