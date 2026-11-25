/**
 * Wicktail geckos (docs/art/life-catalog.json → wicktail). A tiny gecko clings to some Neon Coast lamp posts
 * after dark and polishes the post with its tail; at the end of each stroke it lights the tail tip like a wick
 * and drops two embers. Close to the post it ducks behind the edge and peeps with one cyan eye.
 * Frames drawn by Codex (scripts/life-lab/draw.sh). Placement: every lamp post 't' with a path below (about 17 on the overworld).
 */
import type { Critter } from '../types'

const LOOP = 4

const gecko: Critter = {
  id: 'wicktail',
  maps: ['overworld'],
  when: 'dark',
  pal: {n: '#101a30', t: '#177c7e', l: '#45bda4', r: '#d96291', m: '#883c69', p: '#ff2fa0', g: '#ffd23f', w: '#fff0ae', c: '#2ff3ff', h: '#b49a59'},
  frames: {
    wicktail_Cling: [
      '..........',
      '...nnn....',
      '..ngltn...',
      '.ntttn.l..',
      '.lttltlt..',
      '..nttln...',
      '..ltntn...',
      '....nttl..',
      '....nrmn..',
      '.rn.nrn...',
      '.mrrpn....',
      '..nnn.....',
    ],
    wicktail_Polish: [
      '..........',
      '....nn....',
      '...nltgn..',
      '..ntttnl..',
      '.lttltlt..',
      '..nttln..p',
      '..ltntn.rp',
      '....nttlr.',
      '....nrmr..',
      '.....nn...',
      '..........',
      '..........',
    ],
    wicktail_Wick: [
      '..........',
      '...nnn....',
      '..ngltn...',
      '.ntttn.l..',
      '.lthltlt..',
      '..nttln...',
      '..ltntn..w',
      '....nttlgg',
      '....nrmnp.',
      '.....mrrr.',
      '......nn..',
      '..........',
    ],
    wicktail_Peep: [
      '..........',
      '..........',
      '.......n..',
      '.......l..',
      '......nc..',
      '.......t..',
      '..........',
      '.......l..',
      '..........',
      '..........',
      '..........',
      '..........',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        if (ctx.at(x, y) !== 't' || ctx.at(x, y + 1) !== ',') continue
        const t = (time + ctx.seed(x, y, 812) * LOOP) % LOOP
        // The sprite hugs the post's left edge: its right-hand 2 columns are the post itself.
        const gx = x + 0.25
        const gy = y + 1.0
        const peep = Math.hypot(hero.x - (x + 0.5), hero.y - (y + 0.5)) < 1.3
        let pose = 'Cling'
        if (peep) pose = 'Peep'
        else if (t >= 2.4 && t < 2.6) pose = 'Polish'
        else if (t >= 2.6 && t < 3.2) pose = 'Wick'
        ctx.add(gecko, `wicktail_${pose}`, gx, gy, 0)
        if (pose !== 'Wick') continue
        // The lit tail tip: the sprite's right edge, 5 px up from its feet.
        const tx = gx + 4.5 / 16
        const age = t - 2.6
        const pulse = ctx.reduced ? 1 : 0.8 + 0.2 * Math.sin(age * 18)
        ctx.glow(tx, gy - 5.5 / 16, 0.7, '#ffd23f', 0.36 * pulse)
        ctx.glow(tx, gy - 5.5 / 16, 0.25, '#fff0ae', 0.3 * pulse)
        // A 2-3 px lit tip over the tail.
        ctx.draw(tx, gy, 5, (g, px, py) => {
          g.fillStyle = '#fff0ae'
          g.fillRect(px - 1, py - 1, 2, 2)
          g.fillStyle = '#ffd23f'
          g.fillRect(px - 2, py, 1, 2)
        })
        if (age >= 0.4) {
          const fall = (age - 0.4) / 0.2
          for (const drop of [1, 3]) {
            ctx.draw(tx, gy, 4 - drop - fall * 2, (g, px, py) => {
              g.fillStyle = '#ff2fa0'
              g.fillRect(px, py, 1, 1)
            })
          }
        }
      }
    }
  },
}
export default gecko
