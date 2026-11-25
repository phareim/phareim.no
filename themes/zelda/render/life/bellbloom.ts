/**
 * Bell choirs (docs/art/life-catalog.json → bellbloom). Three bellflowers share a stem in the Neon Coast's
 * glowing flower beds at the edge of daylight and practise a round: the small middle bell comes in early,
 * then the left, then the right, each flashing its throat and shaking a few sparks loose. Near the hero the
 * round speeds up. Frames drawn by Codex (scripts/life-lab/draw.sh). Placement: 1 in 9 flower tiles ':'
 * with a flower neighbour. The game has no dusk/dawn flag, so the spark colour (pink or gold) is by tile.
 */
import type { Critter } from './types'

type Pose = 'Closed' | 'Small' | 'Left' | 'Right'
/** Where each bell's throat sits in its frame: px from the sprite's middle and up from its feet. */
const THROAT = { Small: [1, 4], Left: [-5, 6], Right: [4, 5] } as const
/** [pose, length] runs of one round; `Closed` takes the rest of the period. */
function pose(t: number, near: boolean): { pose: Pose; age: number } {
  const hold = near ? 2.65 : 2.8
  const small = near ? 0.12 : 0.22
  const runs: [Pose, number, number][] = [['Closed', 0, hold], ['Small', hold, small], ['Left', hold + small, 0.22], ['Right', hold + small + 0.22, 0.22]]
  for (const [p, start, len] of runs) if (t >= start && t < start + len) return { pose: p, age: t - start }
  return { pose: 'Closed', age: 0 }
}

const bells: Critter = {
  id: 'bellbloom',
  maps: ['overworld'],
  when: 'dusk-dawn',
  pal: {s: '#203e42', l: '#4c9f83', d: '#3a2f66', m: '#7d5bc0', p: '#aa74d7', h: '#c79bf0', r: '#e0b8ff', q: '#fff2c1', t: '#ff2fa0'},
  frames: {
    bellbloom_Closed: [
      '..........ls.',
      '..sll...sll..',
      '..l.sllls.hp.',
      '.hp...ls.dhmd',
      'dhmd..l..dhmd',
      'prrp..h..dhmd',
      '.p...hmd.prrp',
      '.....prp...p.',
      '......p......',
      '......ls.....',
      '.....slls....',
    ],
    bellbloom_Small: [
      '..........ls.',
      '..sll...sll..',
      '..l.sllls.hp.',
      '.hp...ls.dhmd',
      'dhmd..l..dhmd',
      'prrp..h..dhmd',
      '.p...htd.prrp',
      '.....rqp...p.',
      '......p......',
      '......ls.....',
      '.....slls....',
    ],
    bellbloom_Left: [
      '..........ls.',
      '..sll...sll..',
      '..l.sllls.hp.',
      '.hp...ls.dhmd',
      'htd...l..dhmd',
      'qrrd..h..dhmd',
      'p....hmd.prrp',
      '.....prp...p.',
      '......p......',
      '......ls.....',
      '.....slls....',
    ],
    bellbloom_Right: [
      '..........ls.',
      '..sll...sll..',
      '..l.sllls.hp.',
      '.hp...ls.dhmd',
      'dhmd..l...hmd',
      'prrp..h..dhtm',
      '.p...hmd.rrqq',
      '.....prp....p',
      '......p......',
      '......ls.....',
      '.....slls....',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        if (ctx.at(x, y) !== ':') continue
        if (ctx.seed(x, y, 523) > 1 / 9) continue
        if (ctx.at(x - 1, y) !== ':' && ctx.at(x + 1, y) !== ':' && ctx.at(x, y - 1) !== ':' && ctx.at(x, y + 1) !== ':') continue
        const dist = Math.hypot(hero.x - (x + 0.5), hero.y - (y + 0.5))
        // Not right on top of the hero: his sprite would hide the bells and the sparks would crowd him.
        if (dist < 1.1) continue
        const near = dist < 2
        const period = near ? 3.6 : 4
        const t = (time + ctx.seed(x, y, 524) * period) % period
        const { pose: p, age } = pose(t, near)
        const bx = x + 0.5
        const by = y + 0.85
        ctx.add(bells, `bellbloom_${p}`, bx, by)
        if (p === 'Closed') continue
        const [ox, oy] = THROAT[p]
        const col = ctx.seed(x, y, 525) < 0.5 ? '#ff2fa0' : '#ffd23f'
        const tx = bx + ox / 16
        // The throat's glow follows the bell that is singing.
        ctx.glow(tx, by - oy / 16, 0.65, col, 0.2)
        if (ctx.reduced) continue
        // A pixel falls at 80 ms; at 150 ms two more drift out to the sides.
        if (age >= 0.08) {
          ctx.draw(tx, by, oy - 2 - (age - 0.08) * 10, (g, px, py) => {
            g.fillStyle = col
            g.fillRect(px, py, 1, 1)
          })
        }
        if (age >= 0.15) {
          for (const side of [-1, 1]) {
            ctx.draw(tx, by, oy - 3, (g, px, py) => {
              g.fillStyle = '#fff2c1'
              g.fillRect(px + side * 3, py, 1, 1)
            })
          }
        }
      }
    }
  },
}
export default bells
