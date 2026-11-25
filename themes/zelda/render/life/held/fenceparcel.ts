/**
 * Acorn post (docs/art/life-catalog.json → fenceparcel). By day, a squirrel hops onto the open end of some Wildwood
 * fences, tips an acorn with a leaf tucked under the cap onto the post, and is gone; the acorn stays a while,
 * glinting once. The moss saddle on the post is always there. Frames drawn by Codex (scripts/life-lab/draw.sh).
 * Placement: fence tiles 'F' with a fence neighbour on exactly one side and open ground to the south and east (a tree or roof there hides it in iso: only the Wildwood pen's corner at 68,34 qualifies); mirrored so the squirrel stands on the free side, away from the rail.
 */
import type { Critter } from '../types'

const LOOP = 10
const W = 16
const H = 16

const post: Critter = {
  id: 'fenceparcel',
  maps: ['wildwood'],
  when: 'dusk-dawn',
  pal: {o: '#322936', t: '#995554', f: '#d98761', h: '#f5a879', c: '#ffe3ba', e: '#241a2c', s: '#385b4f', m: '#6d9c66', v: '#94eb57', g: '#ffd23f', p: '#fff0a0', r: '#98613e', b: '#a77550', n: '#d5a274', l: '#365839', k: '#664553'},
  frames: {
    fenceparcel_Empty: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '......mvm.......',
      '......sss.......',
    ],
    fenceparcel_Arrive: [
      '................',
      '................',
      '..ooo...........',
      '.ohhfo.oo.o.....',
      'ohfftoohfohoo...',
      'offttoofhffhoo..',
      'oftooohffefhfo..',
      'otftoofhffccceo.',
      '.otftoofhtccco..',
      '..otttofhfcoogo.',
      '...ooofhfcohpbo.',
      '....otffhftoono.',
      '....ofhfftooo...',
      '.....oootoo.....',
      '......mvm.......',
      '......sss.......',
    ],
    fenceparcel_Present: [
      '................',
      '................',
      '................',
      '..ooo...........',
      '.ohhfooo.o......',
      'ohfftohfohoo....',
      'offtofhffhfoo...',
      'oftofhffehffeo..',
      '.otoffokofccco..',
      '.otoftopgoocho..',
      '..oftopggrolll..',
      '..otfornbrovvl..',
      '...ofonbbllll...',
      '....oooooo......',
      '......mvm.......',
      '......sss.......',
    ],
    fenceparcel_Parcel: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '.......k........',
      '......opgo......',
      '.....opggrolll..',
      '.....ornbrovvl..',
      '.....onbbllll...',
      '......oooo......',
      '......mvm.......',
      '......sss.......',
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
        // In the isometric view a tree or roof on the near side (south, east, up to two tiles) hides the squirrel: only
        // ends with open ground there get a post (the gate gaps and the pen corner by the cabin are skipped; the far pen corner stays).
        let shut = false
        for (const [a, b] of [[0, 1], [1, 1], [-1, 1], [1, 0], [2, 0], [2, 1], [2, -1]] as const) {
          const c = ctx.at(x + a, y + b)
          if (c === 'T' || c === 'H') shut = true
        }
        if (shut) continue
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
        const fx = x + 0.5
        const fy = y + 0.62
        const LIFT = 6
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
            g.fillRect(left + cap(10), top + 8, 1, 1)
            g.fillRect(left + cap(5), top + 9, 1, 1)
          })
        }
      }
    }
  },
}

export default post
