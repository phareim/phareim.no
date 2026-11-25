/**
 * Paper understudy (docs/art/life-catalog.json → paperunderstudy). In Fogstage a folded paper actor steps out of
 * a painted flat onto the open stage floor, bows to the empty theatre under a gold spotlight ring and folds
 * itself away again. Come within 2.5 tiles and the bow becomes a flourish, the rose hat held out toward you,
 * with a glint at the hat tip. Frames drawn by Codex (scripts/life-lab/draw.sh), 14x16 with a cream outline so
 * the actor reads against the red flat and the dark floor. Placement: most `fogstage_flat` landmarks (a region
 * has only one or two), the actor stands 0.6 tiles south of the flat's base, needing open stage floor there.
 * An 8 s loop: gone 4.6 s, Step .3, Bow 1.2, Step .4, gone 1.5 (the catalogue's Flat pose is dropped: it would
 * only repeat the painted flat). The sprite faces right; Flourish mirrors toward the hero. Reduced motion:
 * a still bow in the light.
 */
import type { Critter } from './types'

const LOOP = 8
const FLOOR = '.,:;='
const OUT = 0.6

const actor: Critter = {
  id: 'paperunderstudy',
  realms: ['fogstage'],
  when: 'always',
  pal: {C: '#fff1d7', p: '#f2d9bb', s: '#b69ba7', j: '#34334d', b: '#769cc0', B: '#a5c6db', d: '#4a577d', R: '#ff9cc4', r: '#ed6aa5', v: '#8f467c'},
  frames: {
    paperunderstudy_Step: [
      '.......RR.....',
      '......RrrR....',
      '......Rrrv....',
      '.....RrrvvR...',
      '.....vCCCv....',
      '.....CpjpC....',
      '....BCpsC.....',
      '...BBbCbC.....',
      '..CbbbCjpC....',
      '..CBbdCpC.....',
      '.CBbddC.......',
      '.CCCpsC.......',
      '..CspCCpC.....',
      '..CpC..CspC...',
      '.CpC....CpC...',
      '.CC.....CCC...',
    ],
    paperunderstudy_Bow: [
      '..............',
      '..............',
      '..............',
      '..............',
      '.........RR...',
      '........RrrR..',
      '........vrrr..',
      '.....CBCRrrvvR',
      '....CBbCCppv..',
      '...CBbbCpjC...',
      '..CbbdCpCC....',
      '..CBddCjC.....',
      '..CCpCCpC.....',
      '..CpC..CspC...',
      '.CpC....CpC...',
      '.CC.....CCC...',
    ],
    paperunderstudy_Flourish: [
      '..............',
      '...........RR.',
      '..........RrrR',
      '..........Rrrv',
      '.........RrvvR',
      '.......CCpCv..',
      '......CpC.....',
      '.....CBC..CCC.',
      '....CBbCCppC..',
      '...CBbbCpjC...',
      '..CbbdCpCC....',
      '..CBddCjC.....',
      '..CCpCCpC.....',
      '..CpC..CspC...',
      '.CpC....CpC...',
      '.CC.....CCC...',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    for (const l of ctx.landmarks) {
      if (!l.art.startsWith('fogstage_flat')) continue
      const tx = Math.floor(l.x)
      const ty = Math.floor(l.y)
      if (Math.abs(tx - hx) > range + 1 || Math.abs(ty - hy) > range + 1) continue
      const seed = ctx.seed(tx, ty, 641)
      if (seed > 0.7 || !FLOOR.includes(ctx.at(Math.floor(l.x), Math.floor(l.y + OUT)))) continue
      const x = l.x
      const t = ctx.reduced ? 4.9 : (time + seed * LOOP) % LOOP
      let pose = ''
      let off = 0
      let beam = 0
      if (t >= 4.6 && t < 4.9) { pose = 'Step'; off = OUT / 2; beam = (t - 4.6) / 0.3 }
      else if (t >= 4.9 && t < 6.1) { pose = 'Bow'; off = OUT; beam = 1 }
      else if (t >= 6.1 && t < 6.5) { pose = 'Step'; off = OUT / 2; beam = 1 - (t - 6.1) / 0.4 }
      if (!pose) continue
      const near = Math.hypot(hero.x - x, hero.y - (l.y + OUT)) < 2.5
      if (pose === 'Bow' && near) pose = 'Flourish'
      const flip = pose === 'Flourish' ? hero.x < x : false
      const py = l.y + off
      // The spotlight: a gold pool with a clear ring, sinking a pixel over the first 200 ms of the bow.
      const sink = pose === 'Step' ? 0 : Math.min(1, (t - 4.9) / 0.2) / 16
      const a = (ctx.night ? 0.36 : 0.2) * beam
      ctx.glow(x, l.y + OUT + sink, 1.3, '#ffd23f', a)
      ctx.draw(x, l.y + OUT + sink, 0, (g, px, pyy) => {
        g.save()
        g.globalAlpha = 0.55 * beam
        g.strokeStyle = '#ffd23f'
        g.lineWidth = 1
        g.beginPath()
        g.ellipse(px, pyy, 13, 5, 0, 0, Math.PI * 2)
        g.stroke()
        g.restore()
      })
      ctx.add(actor, `paperunderstudy_${pose}`, x, py, 0, flip)
      // A rose glint at the hat tip for the first 400 ms of the flourish.
      if (pose === 'Flourish' && (ctx.reduced || t - 4.9 < 0.4)) {
        const dir = flip ? -1 : 1
        ctx.draw(x, py, 0, (g, px, pyy) => {
          g.fillStyle = '#ffffff'
          g.fillRect(px + dir * 5 - 1, pyy - 15, 3, 1)
          g.fillRect(px + dir * 5, pyy - 16, 1, 3)
          g.fillStyle = '#ff2fa0'
          g.fillRect(px + dir * 5, pyy - 15, 1, 1)
        })
      }
    }
  },
}

export default actor
