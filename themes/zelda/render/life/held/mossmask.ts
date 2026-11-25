/**
 * Moss masks (docs/art/life-catalog.json → mossmask). A little face in the moss at the foot of some Wildwood
 * trees. In bright hours it sleeps (Fold). At dusk and night it watches the trail, blinking now and then, and when
 * the hero comes within 2.5 tiles it goes "ooh" with a gold mouth that lights the bark; its pupils follow the hero
 * sideways (the art's pupils lean right, so the sprite is mirrored when the hero is to its left).
 * Frames drawn by Codex (scripts/life-lab/draw.sh). Placement: 1 in 11 trees 'T' with floor directly south.
 */
import type { Critter } from '../types'

const FLOOR = '.,'

const mask: Critter = {
  id: 'mossmask',
  maps: ['wildwood'],
  when: 'always',
  pal: {s: '#292738', b: '#594552', t: '#463749', m: '#375f59', l: '#72a77b', v: '#8d61bf', p: '#45345e', g: '#ffd23f', h: '#fff1af'},
  frames: {
    mossmask_Fold: [
      '..sms...',
      '.slmms..',
      'slmslmss',
      'smmmlmms',
      'stmbbmbs',
      '.smbsbts',
      '.stbbts.',
      '..stss..',
    ],
    mossmask_Glance: [
      '..sms...',
      '.slmms..',
      'slmbmlss',
      'svpbmvps',
      'stmsbmbs',
      '.smssbts',
      '.stbbts.',
      '..stss..',
    ],
    mossmask_Ooh: [
      '..sms...',
      '.llmlls.',
      'svpbmvps',
      'smmbbmms',
      'stmghmbs',
      '.smbgbts',
      '.stbbts.',
      '..stss..',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    // Fold at noon and by day; Glance/Ooh at dusk and night (the stuck dusk is sun ≈ 0.1).
    const awake = ctx.sun <= 0.35
    for (let y = hy - range; y <= hy + range; y++) {
      for (let x = hx - range; x <= hx + range; x++) {
        if (ctx.at(x, y) !== 'T' || !FLOOR.includes(ctx.at(x, y + 1) || '#')) continue
        const seed = ctx.seed(x, y, 521)
        if (seed > 1 / 11) continue
        const fx = x + 0.5
        const fy = y + 0.88
        const dx = hero.x - fx
        const dy = hero.y - fy
        const dist = Math.hypot(dx, dy)
        const flip = dist < 9 && dx < -0.3
        let name = 'mossmask_Fold'
        if (awake) {
          const blink = ctx.reduced ? false : (time + seed * 5 * 9) % 5 < 0.14
          name = blink ? 'mossmask_Fold' : dist < 2.5 ? 'mossmask_Ooh' : 'mossmask_Glance'
        }
        // Drawn freehand at 2x so the face reads against the dark trees (ctx.add only draws 1x).
        const rows = mask.frames[name]!
        const S = 2
        ctx.draw(fx, fy, 3, (g, px, py) => {
          const left = px - (8 * S) / 2
          const top = py - 8 * S
          const pc = mask.pal
          // Faint rim light behind the face.
          if (name !== 'mossmask_Fold') {
            g.fillStyle = name === 'mossmask_Ooh' ? 'rgba(255,210,63,0.22)' : 'rgba(141,97,191,0.42)'
            g.fillRect(left - 1, top + 1, 8 * S + 2, 8 * S - 2)
            g.fillRect(left + 1, top - 1, 8 * S - 2, 8 * S + 2)
          }
          for (let r = 0; r < 8; r++) {
            const row = rows[r]!
            for (let c = 0; c < 8; c++) {
              const ch = row[flip ? 7 - c : c]!
              const col = pc[ch]
              if (ch === '.' || !col) continue
              g.fillStyle = col
              g.fillRect(left + c * S, top + r * S, S, S)
            }
          }
          if (name === 'mossmask_Glance') {
            // Bright violet eyes (the sprite's own eye pixels at row 3, columns 1 and 5).
            g.fillStyle = '#c9a0ff'
            g.fillRect(left + (flip ? 6 : 1) * S, top + 3 * S, S, 1)
            g.fillRect(left + (flip ? 2 : 5) * S, top + 3 * S, S, 1)
          }
        })
        if (name === 'mossmask_Glance') {
          ctx.glow(fx, fy - 0.35, 0.7, '#8d61bf', 0.35)
        } else if (name === 'mossmask_Ooh') {
          const a = ctx.reduced || Math.floor(time / 0.22) % 2 === 0 ? 0.3 : 0.2
          ctx.glow(fx, fy - 0.35, 0.8, '#ffd23f', a)
        }
      }
    }
  },
}

export default mask
