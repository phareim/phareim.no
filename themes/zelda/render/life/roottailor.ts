/**
 * Root tailors (docs/art/life-catalog.json → roottailor). In the Underglow's Upside Grove an upside-down cave imp
 * hangs from the tip of a hanging root and darns a split in it with a gold needle; the fresh stitch is hot pink,
 * which seems to be exactly what it wanted. Near the hero it turns its face his way (mirrors itself).
 * Frames drawn by Codex (scripts/life-lab/draw.sh).
 * Placement: root tiles 'T' with open cave floor '.' directly south, one in two (the layer has only ten roots).
 * The Underglow is iso only and a dungeon, so `kinds` says so.
 */
import type { Critter } from './types'

const LOOP = 5.2
const H = 16 // frame height, px
const TIP = 24 // how far above the floor a root branch tip hangs, classic px

type Pose = 'Dangle' | 'Needle' | 'Pull' | 'Knot'
function poseAt(t: number): { pose: Pose, age: number } {
  if (t < 3.4) return { pose: 'Dangle', age: t }
  if (t < 3.64) return { pose: 'Needle', age: t - 3.4 }
  if (t < 4) return { pose: 'Pull', age: t - 3.64 }
  return { pose: 'Knot', age: t - 4 }
}

const tailor: Critter = {
  id: 'roottailor',
  realms: ['underglow'],
  kinds: ['dungeon'],
  when: 'always',
  pal: {o: '#242039', s: '#54447a', l: '#ad8bc8', b: '#ccb0e3', r: '#e2c9f3', m: '#607a62', v: '#8fb08a', p: '#ff2fa0', g: '#ffd23f', e: '#ffe5ef'},
  frames: {
    roottailor_Dangle: [
      '.....m.....',
      '.....v.....',
      '....mv.....',
      '.....m.....',
      '...ososo...',
      '...orobo...',
      '....obo....',
      '...orbo....',
      '..olbboo...',
      '..olbbslo..',
      '..obooslo..',
      '.osrbbog...',
      '.oreoeslo..',
      '.olboblo...',
      '.obosoob...',
      '..o...o....',
    ],
    roottailor_Needle: [
      '.....m.....',
      '.....v.....',
      '....mv.....',
      '.....m.....',
      '...osog....',
      '...orobg...',
      '....obooro.',
      '...orboolo.',
      '..olbboso..',
      '..olbblo...',
      '..oboobo...',
      '.osrbbrso..',
      '.oreoeolo..',
      '.olboblo...',
      '.obosoob...',
      '..o...o....',
    ],
    roottailor_Pull: [
      '.....m.....',
      '.....v.....',
      '....mv.....',
      '.....m.....',
      '...osop....',
      '...orobp...',
      '....obo.po.',
      '...orbobbro',
      '...obbbsoo.',
      '...obblso..',
      '..olbboso..',
      '..osrbbrso.',
      '..oreoeolo.',
      '..olboblo..',
      '..obosoob..',
      '...o...o...',
    ],
    roottailor_Knot: [
      '.....m.....',
      '.....v.....',
      '....mv.....',
      '.....m.....',
      '...ososo...',
      '..orolobo..',
      '..obobolo..',
      '..olbpbro..',
      '..obpepbo..',
      '.ooblpboo..',
      '.olobooblo.',
      '.osrbbbrso.',
      '.oreoeoolo.',
      '.olsesolo..',
      '.oboosoob..',
      '..o....o...',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    const a = ctx.night ? 0.24 : 0.13
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        if (ctx.at(x, y) !== 'T' || ctx.at(x, y + 1) !== '.') continue
        if (ctx.seed(x, y, 901) > 0.5) continue
        const t = (time + ctx.seed(x, y, 902) * LOOP) % LOOP
        const { pose, age } = poseAt(t)
        const bx = x + 0.15
        const by = y + 0.95
        // Within 2 tiles it turns toward the hero (the thread mirrors with it).
        const flip = Math.hypot(hero.x - bx, hero.y - by) < 2 && hero.x < bx
        const lift = TIP - H
        ctx.add(tailor, `roottailor_${pose}`, bx, by, lift, flip)
        // The thread is in the frame (top rows). A steady dim pink glow on the imp; the knot swells it.
        const cy = by - (lift + 6) / 16
        ctx.glow(bx, cy, pose === 'Knot' ? 0.85 : 0.5, '#ff2fa0', pose === 'Knot' ? a * 2 : a * 0.55)
        if (ctx.reduced) continue
        if (pose === 'Knot' && age >= 1) {
          // The last 200 ms: the knot's centre turns gold.
          ctx.draw(bx, by, lift + 6, (g, px, py) => {
            g.fillStyle = '#ffd23f'
            g.fillRect(px, py, 2, 2)
          })
        }
      }
    }
  },
}
export default tailor
