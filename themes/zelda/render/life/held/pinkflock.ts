/**
 * Flamingo stand-in (docs/art/life-catalog.json → pinkflock). In Rerun a cream wind-up chick with a pink beak and
 * a metal key hops out from behind a lawn flamingo to the lawn one tile beside it and holds the same one-legged
 * pose, beak the same way, then hops back. Stand within 1.5 tiles and it wobbles on every other 120 ms step.
 * Frames drawn by Codex (scripts/life-lab/draw.sh). Placement is computed from each `rerun_flamingo` landmark:
 * the west or east lawn tile (by hash) one step away must be lawn ('.' ',' ':' ';'); every flamingo qualifies,
 * the hash only offsets the clock. Classic has only a plain post where the flamingo stands (standIns.ts), so
 * there the critter draws a Codex lawn flamingo (`pinkflock_Flamingo`) over it; the isometric view has its
 * own modelled flamingo (the atlas canvas is 1024 square), so there it draws only the chick. A 6.5 s loop:
 * gone 3.4 s, Hop .24 (fading in), Copy 2.2, Hop .24, gone .42. Reduced motion: a still Copy.
 */
import type { Critter } from '../types'

const LOOP = 6.5
const LAWN = '.,:;'
const REACH = 1

const chick: Critter = {
  id: 'pinkflock',
  realms: ['rerun'],
  when: 'always',
  pal: {o: '#3b2d50', b: '#242035', r: '#ae4e81', f: '#ff2fa0', h: '#ff9ed0', c: '#fff1b4', y: '#ffda73', d: '#d9a34f', p: '#ee86b1', s: '#eef8ff', m: '#a5b7d4', g: '#647594'},
  frames: {
    pinkflock_Hop: [
      '..........',
      '..........',
      '......ooo.',
      '.sg..ococp',
      's.m..ocyo.',
      '.msmoccyo.',
      '...gocccyo',
      '....ocpydo',
      '.....oooo.',
      '.....oo.oo',
      '..........',
    ],
    pinkflock_Flamingo: [
      '.......ooo..',
      '......ohhfo.',
      '.....ohbffpb',
      '.....ohfrobb',
      '......ohfo..',
      '.......oho..',
      '.......ofo..',
      '..ooooohfo..',
      '.ohhfffhro..',
      'orffhhffo...',
      '.orffffro...',
      '..oooooo....',
      '......prp...',
      '......r.p...',
      '......p.....',
      '......pp....',
    ],
    pinkflock_Copy: [
      '......ooo.',
      '.....ocbcp',
      '.....ocyp.',
      '......oco.',
      'sm....oyo.',
      'smgocccyo.',
      '..goccyyo.',
      '...ooydo..',
      '......rpp.',
      '......r.p.',
      '......pp..',
    ],
    pinkflock_Wobble: [
      '.....ooo..',
      '....ocbcp.',
      '....ocyp..',
      '.....oco..',
      'sm....oyo.',
      'smgocccyo.',
      '..gopcyyo.',
      '...opydo..',
      '......rpp.',
      '......r.p.',
      '......pp..',
    ],
  },
  queue(ctx) {
    const { hx, hy, range, time } = ctx
    const hero = ctx.s.hero
    const classic = !(ctx.g.canvas.width >= 1024 && ctx.g.canvas.height >= 1024)
    for (const l of ctx.landmarks) {
      if (!l.art.startsWith('rerun_flamingo')) continue
      const tx = Math.floor(l.x)
      const ty = Math.floor(l.y)
      if (Math.abs(tx - hx) > range + 1 || Math.abs(ty - hy) > range + 1) continue
      const seed = ctx.seed(tx, ty, 733)
      const side = ctx.seed(tx, ty, 734) < 0.5 ? -1 : 1
      if (!LAWN.includes(ctx.at(Math.floor(l.x + side * REACH), ty))) continue
      const x0 = l.x + side * 0.15
      const x1 = l.x + side * REACH
      const y = l.y
      const t = ctx.reduced ? 4 : (time + seed * LOOP) % LOOP
      // Both face right, like the flamingo, so the copy reads as a copy; only the hop's own direction changes.
      const flip = false
      const keyDir = -1
      let pose = ''
      let x = x1
      let lift = 0
      let alpha = 1
      let hopStart = -1
      if (t >= 3.4 && t < 3.64) { pose = 'Hop'; const k = (t - 3.4) / 0.24; x = x0 + (x1 - x0) * k; lift = Math.sin(k * Math.PI) * 3; alpha = Math.min(1, k * 3); hopStart = t - 3.4 }
      else if (t >= 3.64 && t < 5.84) pose = 'Copy'
      else if (t >= 5.84 && t < 6.08) { pose = 'Hop'; const k = (t - 5.84) / 0.24; x = x1 + (x0 - x1) * k; lift = Math.sin(k * Math.PI) * 3; alpha = Math.min(1, (1 - k) * 3); hopStart = t - 5.84 }
      if (!pose) continue
      const hopFlip = pose === 'Hop' && (side < 0) !== (t >= 5.84)
      if (pose === 'Copy' && Math.hypot(hero.x - x1, hero.y - y) < 1.5 && Math.floor(t / 0.12) % 2 === 0) pose = 'Wobble'
      // Classic stands a plain post where the flamingo is (standIns.ts): draw the lawn flamingo over it. The
      // isometric view has its modelled flamingo (its atlas canvas is 1024 square), so there it stays out.
      if (classic) ctx.add(chick, 'pinkflock_Flamingo', l.x, l.y + 0.02)
      ctx.add(chick, `pinkflock_${pose}`, x, y + 0.04, lift, pose === 'Hop' ? hopFlip : flip, alpha)
      const posed = pose === 'Copy' || pose === 'Wobble'
      const keyTone = ctx.sun > 0.35 ? '#ffc2d8' : '#ffd23f'
      // The key's shine: a gold pool (rose at noon) that you can find, plus hot pink over the body at night.
      const kx = x + keyDir * 0.28
      ctx.glow(kx, y - 0.4 - lift / 16, 0.5, keyTone, 0.3 * alpha)
      if (posed && ctx.night) ctx.glow(x, y - 0.35, 0.5, '#ff2fa0', 0.18)
      // A two-pixel gold spark off the key: blinking while it holds the pose, and in the first 80 ms of each hop.
      const blink = posed && (ctx.reduced || Math.floor(time * 4) % 2 === 0)
      if (blink || (hopStart >= 0 && hopStart < 0.08)) {
        ctx.draw(x, y, lift, (g, px, py) => {
          g.fillStyle = '#ffd23f'
          g.fillRect(px + keyDir * 6, py - 10, 1, 3)
          g.fillRect(px + keyDir * 5, py - 9, 3, 1)
          g.fillStyle = '#ffffff'
          g.fillRect(px + keyDir * 6, py - 9, 1, 1)
        })
      }
    }
  },
}

export default chick
