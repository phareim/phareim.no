/**
 * Buttoncap parasol (docs/art/life-catalog.json → sporeparasol). Two little mushroom folk beside a giant
 * mushroom in the Sporelight: the small one unfolds its crumpled cap into an umbrella and the two stand
 * under it together, a cyan (night) or violet (otherwise) light under the rim, two lit pixels drifting
 * together on the ground. Come within 2 tiles and they peek out, turned towards you.
 * Frames drawn by Codex (scripts/life-lab/draw.sh).
 * Placement: every second giant `sporelight_mushroom_*` landmark (the catalogue says 1 in 8), on open ground
 * beside its stem.
 */
import type { Critter } from './types'

const LOOP = 5.4
const OPEN = '.,:;'

const folk: Critter = {
  id: 'sporeparasol',
  realms: ['sporelight'],
  when: 'always',
  pal: {c: '#2ff3ff', t: '#2799b0', v: '#a681de', l: '#c7a3f3', p: '#e7a6ec', w: '#fff8f7', s: '#664f91', d: '#203449', k: '#302543', i: '#fff1ca', j: '#e0bda3', r: '#e289ba', m: '#a65089', a: '#a0cbc3', b: '#558b93', h: '#ffe484', o: '#ff9d56'},
  frames: {
    sporeparasol_folded: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '.k..............',
      'klsk............',
      'ksvsk.....iii...',
      '.kvlk....irrrmi.',
      '..ikiii.imrrrmi.',
      '..iiaaabiihij...',
      '..jiihij.jioj...',
      '....jiojjiijj...',
      '....jbij.jrrj...',
      '...iikii.iikii..',
      '................',
    ],
    sporeparasol_raise: [
      '................',
      '................',
      '....cc..........',
      '..cclpcc........',
      '.cvlwpppc.......',
      'cvvlpppsscc.....',
      'ctsstcccc.......',
      '..i.iii.........',
      '..iiaaabi.iii...',
      '..jiihij.irrrmi.',
      '....jiojimrrrmi.',
      '....jbjj.ihij...',
      '....jbijjiojj...',
      '....jbij.jrrj...',
      '...iikii.iikii..',
      '................',
    ],
    sporeparasol_share: [
      '......cccc......',
      '....ccllvvcc....',
      '..ccvlwpppppcc..',
      '.cvlvllppwpppsc.',
      'cvlwvlppppppplsc',
      'cvtvvsllplllvssc',
      '.cccccccccccccc.',
      '..ict......tc...',
      '..i......iii....',
      '..i..iiijrrrmi..',
      '..jiiaaabdmrrmi.',
      '....ihoj.ihoj...',
      '....jiojjiojj...',
      '....jbij.jrrj...',
      '...iikii.iikii..',
      '....t......t....',
    ],
    sporeparasol_peek: [
      '.......cccc.....',
      '.....ccllvvcc...',
      '...ccvlwpppppcc.',
      '.cvvlvllppwpppsc',
      'cvlwvlppppppplsc',
      'cvtvvsllplllvssc',
      '.cccccccccccccc.',
      '..ict......tc...',
      '..i.......iii...',
      '..i...iiijrrrmi.',
      '..jiiiaaabdmrrmi',
      '.....ihki.ihki..',
      '....jiojjiojj...',
      '....jbij.jrrj...',
      '...iikii.iikii..',
      '.....t......t...',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    for (const l of ctx.landmarks) {
      if (!l.art.startsWith('sporelight_mushroom') || l.art.includes('small')) continue
      const tx = Math.floor(l.x)
      const ty = Math.floor(l.y + 0.25)
      if (Math.abs(tx - hx) > range + 2 || Math.abs(ty - hy) > range + 1) continue
      const seed = ctx.seed(tx, ty, 641)
      if (seed > 0.5) continue
      // Out of the stem's shadow, on the lit path side.
      const x = l.x + (l.art.includes('large') ? 2.1 : 1.7)
      if (!OPEN.includes(ctx.at(Math.floor(x), ty))) continue
      const y = l.y + 0.3
      const t = ctx.reduced ? 0 : (time + seed * LOOP) % LOOP
      const near = Math.hypot(hero.x - x, hero.y - y) < 2
      let pose = 'folded'
      if (t >= 3.2 && t < 3.4) pose = 'raise'
      else if (t >= 3.4 && t < 5.2) pose = near ? 'peek' : 'share'
      else if (t >= 5.2) pose = 'raise'
      const flip = near && hero.x < x
      ctx.add(folk, `sporeparasol_${pose}`, x, y, 0, flip)
      const open = pose === 'share' || pose === 'peek'
      const tone = ctx.night ? '#2ff3ff' : '#8fe8ff'
      // A steady cyan glow under the cap, brighter while it is open.
      ctx.glow(x, y - 0.5, 0.9, tone, ctx.reduced ? 0.3 : open ? 0.4 : 0.18)
      if (!open) continue
      // Spore motes rise from under the cap, four of them, each a slow 2 s loop.
      ctx.draw(x, y, 0, (g, px, py) => {
        for (let i = 0; i < 4; i++) {
          const p = (time * 0.5 + i / 4 + seed) % 1
          g.globalAlpha = Math.sin(Math.PI * p)
          g.fillStyle = i % 2 ? '#ffb1d7' : '#c9f6ff'
          g.fillRect(px - 5 + i * 3 + Math.round(Math.sin(p * 6 + i)), py - 3 - Math.floor(p * 10), 1, 1)
        }
        g.globalAlpha = 1
      })
    }
  },
}

export default folk
