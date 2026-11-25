/**
 * Prism hares (docs/art/life-catalog.json → quartzhare). A sand hare at the foot of a Still Sand quartz island
 * tips one glassy ear and then the other into the sun; when both line up, a four-colour spectrum lands on the
 * sand in front of it and slides sideways. Come within 1.4 tiles and it sits low, the rainbow gone. Any hour,
 * and the Still Sand is isometric only. Frames drawn by Codex (scripts/life-lab/draw.sh).
 * Placement: every second `stillsand_island_*` landmark (the quartz stands on the islands; the catalogue's 1 in 7
 * would leave a region with none), on the first open sand tile south of its cliff.
 */
import type { Critter } from './types'

const LOOP = 6
const OPEN = '.,:;-'
const SPECTRUM = ['#ed81b0', '#ffd23f', '#2ff3ff', '#ac75e6'] as const

const hare: Critter = {
  id: 'quartzhare',
  realms: ['stillsand'],
  when: 'always',
  pal: {p: '#3a2a4a', m: '#7a5670', s: '#a8744c', d: '#c48e5c', f: '#dcab78', h: '#fff0c8', w: '#fff9ed', r: '#ed81b0', c: '#2ff3ff', v: '#ac75e6'},
  frames: {
    quartzhare_low: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '....ppppp.......',
      '...ppppdfhcsp...',
      '..pfmffppppsv...',
      '..hffdfffffdp...',
      '..ppsdffhdffpw..',
      '....psddsfdphw..',
      '....pdpdsddsp...',
      '...psppssdds....',
      '.....pppppppp...',
    ],
    quartzhare_left: [
      '................',
      '.......p........',
      '......pcp.......',
      '......pch.......',
      '.....pchp.......',
      '.....pch........',
      '.....pcd........',
      '....pcfp........',
      '...pppp.pppp....',
      '..pfmffppppsv...',
      '..hffdfffffdp...',
      '..ppsdffhdffpw..',
      '....psddsfdphw..',
      '....pdpdsddsp...',
      '...psppssdds....',
      '.....pppppppp...',
    ],
    quartzhare_both: [
      '................',
      '.......p...p....',
      '......pcp.pfp...',
      '......pch.prp...',
      '.....pchp.prp...',
      '.....pch.prp....',
      '.....pcdprp.....',
      '....pcfhrp......',
      '...ppppp........',
      '..pfmffpppp.....',
      '..hffdfffffdp...',
      '..ppsdffhdffpw..',
      '....psddsfdphw..',
      '....pdpdsddsp...',
      '...psppssdds....',
      '.....pppppppp...',
    ],
    quartzhare_right: [
      '................',
      '...........p....',
      '..........pfp...',
      '..........pvp...',
      '..........pvp...',
      '.........pvp....',
      '........pvp.....',
      '....ppppvp......',
      '...pppppfhcsp...',
      '..pfmffpppp.....',
      '..hffdfffffdp...',
      '..ppsdffhdffpw..',
      '....psddsfdphw..',
      '....pdpdsddsp...',
      '...psppssdds....',
      '.....pppppppp...',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    for (const l of ctx.landmarks) {
      if (!l.art.startsWith('stillsand_island')) continue
      const lx = Math.floor(l.x)
      if (Math.abs(lx - hx) > range + 2) continue
      let ty = Math.floor(l.y) + 1
      while (ty < Math.floor(l.y) + 7 && !OPEN.includes(ctx.at(lx, ty))) ty++
      if (!OPEN.includes(ctx.at(lx, ty)) || Math.abs(ty - hy) > range + 1) continue
      const seed = ctx.seed(lx, ty, 523)
      if (seed > 0.5) continue
      // Out on the open sand, a little way from the foot of the cliff, so its shade does not swallow the hare.
      const x = lx + 1.9 + (seed - 0.25) * 0.6
      const y = ty + 1.6
      if (!OPEN.includes(ctx.at(Math.floor(x), Math.floor(y)))) continue
      const near = Math.hypot(hero.x - x, hero.y - y) < 1.4
      const t = ctx.reduced ? 0 : (time + seed * LOOP) % LOOP
      let pose = 'low'
      if (!near) {
        if (t >= 3 && t < 3.4) pose = 'left'
        else if (t >= 3.4 && t < 4.8) pose = 'both'
        else if (t >= 4.8 && t < 5.2) pose = 'right'
      }
      ctx.add(hare, `quartzhare_${pose}`, x, y)
      if (pose !== 'both') continue
      // The prism: a beam from the cyan ear tip down to the sand, where it fans into four bands
      // (3 px tall, 6 to 12 px wide) that slide sideways and fade in and out over the 1.4 s.
      const u = (t - 3.4) / 1.4
      const fade = Math.sin(Math.PI * u)
      const slide = Math.floor(u * 8)
      ctx.draw(x, y, 0, (g, px, py) => {
        const tipX = px + 3, tipY = py - 16
        const endX = px - 14, endY = py - 8
        g.globalAlpha = 0.85 * fade
        for (let i = 0; i <= 12; i++) {
          g.fillStyle = i % 4 === Math.floor(time * 10) % 4 ? '#ffffff' : '#fff0c8'
          g.fillRect(Math.round(tipX + (endX - tipX) * i / 12), Math.round(tipY + (endY - tipY) * i / 12), 1, 1)
        }
        for (let i = 0; i < 4; i++) {
          g.fillStyle = SPECTRUM[i]!
          const w = 6 + i * 2
          g.fillRect(px - 24 - i + slide, py - 11 + i * 3, w, 3)
        }
        g.globalAlpha = fade
        g.fillStyle = '#ffffff'
        for (let i = 0; i < 4; i++) {
          if (Math.floor(time * 6 + i * 1.7) % 3 === 0) g.fillRect(px - 22 + i * 5 + slide, py - 12 + (i % 2) * 7, 1, 1)
        }
        g.globalAlpha = 1
      })
      ctx.glow(x - 1.1 + slide / 16, y - 0.4, 0.7, '#fff0c8', 0.3 * fade)
      ctx.glow(x - 1.1 + slide / 16, y - 0.4, 0.4, '#ed81b0', 0.2 * fade)
    }
  },
}

export default hare
