/**
 * Acorn post (docs/art/life-catalog.json → fenceparcel). By day, a squirrel hops onto the open end of some Wildwood
 * fences, tips an acorn with a leaf tucked under the cap onto the post, and is gone; the acorn stays a while,
 * glinting once. The moss saddle on the post is always there. Frames drawn by Codex (scripts/life-lab/draw.sh).
 * Placement: fence tiles 'F' with a fence neighbour on exactly one side (the Wildwood has four such ends, so all of
 * them get a post rather than 1 in 10); mirrored so the squirrel stands on the free side, away from the rail.
 */
import type { Critter } from '../types'

const LOOP = 10
const W = 14
const H = 14

const post: Critter = {
  id: 'fenceparcel',
  maps: ['wildwood'],
  when: 'dusk-dawn',
  pal: {o: '#322136', s: '#995554', f: '#d98761', h: '#ffad70', e: '#23182e', n: '#61364a', b: '#ffe3ba', c: '#e7a87e', m: '#6d9c66', M: '#8abe71', L: '#94eb57', g: '#e7a130', G: '#ffd23f', t: '#a77550', T: '#e7af72'},
  frames: {
    fenceparcel_Empty: [
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '......mMm.....',
    ],
    fenceparcel_Arrive: [
      '..............',
      '..ooo.........',
      '.ofhho........',
      'ohhfso........',
      'ohfsso.oo.....',
      'offsso.oho....',
      'osffo.ofefoo..',
      '.ofsfoofbbhno.',
      '.ossfofbbbbcL.',
      '..ossoffbgGGo.',
      '...oosfbcoTto.',
      '....osffcoto..',
      '.....ofooo....',
      '......mMm.....',
    ],
    fenceparcel_Present: [
      '..............',
      '..ooo.........',
      '.ofhho........',
      'ohhfso........',
      'ohfsso........',
      'offsso.oo.....',
      'osffo..ohooo..',
      '.ofsfooffhefo.',
      '.ossfofffbbbno',
      '..ososffbbLo..',
      '...oosfgGGo...',
      '....offoTto...',
      '.....ofoto....',
      '......mMm.....',
    ],
    fenceparcel_Parcel: [
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..........L...',
      '.......gGGo...',
      '.......oTto...',
      '........to....',
      '......mMm.....',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        if (ctx.at(x, y) !== 'F') continue
        let n = 0
        let east = false
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (ctx.at(x + a, y + b) === 'F') { n++; east = a === 1 }
        }
        if (n !== 1) continue
        const seed = ctx.seed(x, y, 733)
        const t = ctx.reduced ? 0 : (time + seed * LOOP * 5) % LOOP
        let name = 'fenceparcel_Empty'
        let hop = 0
        if (t >= 6 && t < 6.6) {
          name = 'fenceparcel_Arrive'
          hop = t < 6.2 ? 3 * Math.sin(((t - 6) / 0.2) * Math.PI) : 0
        } else if (t >= 6.6 && t < 7.8) name = 'fenceparcel_Present'
        else if (t >= 7.8) name = 'fenceparcel_Parcel'
        // The art extends to the right of its saddle; flip it when the rail is on that side.
        const flip = east
        const fx = x + 0.5 + (flip ? 1 : -1) / 16
        const fy = y + 0.8
        const LIFT = 5
        ctx.add(post, name, fx, fy, LIFT + hop, flip)
        // Two gold glints near the cap as the parcel is left.
        if (name === 'fenceparcel_Parcel' && t < 8.4) {
          ctx.draw(fx, fy, LIFT, (g, px, py) => {
            const left = px - W / 2
            const top = py - H
            const cap = (c: number) => (flip ? W - 1 - c : c)
            g.fillStyle = '#ffd23f'
            const on = Math.floor(t * 8) % 2 === 0
            if (!on) return
            g.fillRect(left + cap(8), top + 8, 1, 1)
            g.fillRect(left + cap(11), top + 7, 1, 1)
          })
        }
      }
    }
  },
}

export default post
