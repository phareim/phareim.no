// Neon Shrine's hero model for the 16-bit view (render/iso/figure.ts): a pure
// renderer into typed arrays, bundled with esbuild like the other zelda tests.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')

async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: `export * from './render/iso/figure'; export { DRAWN_LOOK, GIRL_LOOK, parseHeroLook } from './render/heroLook'; export { HAIR_STYLES, HEADWEAR, BOTTOMS } from './render/heroFrames'`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let M
before(async () => { M = await load() })

const ACTS = ['idle', 'walk', 'swing', 'spin', 'lift', 'carry', 'push', 'hurt', 'get', 'use', 'fall', 'dead']
const YAWS = [0, Math.PI / 4, Math.PI / 2, 2.2, Math.PI, -Math.PI / 2, -2.6, 7.5]
const blade = (a, over = {}) => ({ a, reach: 1.2, trail: [], kind: 'sword', charge: 0, flash: false, ...over })
const hexOf = (s, i) => '#' + [s.albedo[i], s.albedo[i + 1], s.albedo[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('')

/** Every pixel with something in it: its index (×4), x and y. */
function* pixels(s) {
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.albedo[(y * s.w + x) * 4 + 3]) yield [(y * s.w + x) * 4, x, y]
}
const count = s => [...pixels(s)].length
const same = (a, b) => Buffer.compare(Buffer.from(a.albedo), Buffer.from(b.albedo)) === 0 && Buffer.compare(Buffer.from(a.normal), Buffer.from(b.normal)) === 0

/** Where the scene's projection puts a point `tiles` out along world angle `a`, `up` px above the ground. */
function onScreen(a, tiles, up = 14) {
  return { x: M.FIG.ax + tiles * 32 * (Math.cos(a) - Math.sin(a)), y: M.FIG.ay - up + tiles * 16 * (Math.cos(a) + Math.sin(a)) }
}

describe('the figure cell', () => {
  it('is 160 × 96 with the ground point at (80, 66)', () => {
    assert.deepEqual({ ...M.FIG }, { w: 160, h: 96, ax: 80, ay: 66 })
    const s = M.renderFigure({ yaw: 1, act: 'idle', t: 0 }, M.DRAWN_LOOK)
    assert.deepEqual([s.w, s.h, s.ax, s.ay], [160, 96, 80, 66])
    assert.equal(s.albedo.length, 160 * 96 * 4)
    assert.equal(s.normal.length, 160 * 96 * 4)
    assert.ok(s.albedo instanceof Uint8ClampedArray && s.normal instanceof Uint8ClampedArray)
  })

  it('stands on the ground point at the classic hero\'s size', () => {
    for (const yaw of YAWS) {
      const s = M.renderFigure({ yaw, act: 'idle', t: 0 }, { ...M.DRAWN_LOOK, head: 'none' })
      const [x0, y0, x1, y1] = s.box
      assert.ok(y1 - y0 >= 32 && y1 - y0 <= 38, `yaw ${yaw}: ${y1 - y0} px tall`)
      assert.ok(x1 - x0 >= 20 && x1 - x0 <= 28, `yaw ${yaw}: ${x1 - x0} px wide`)
      assert.ok(y1 >= M.FIG.ay && y1 <= M.FIG.ay + 5, `yaw ${yaw}: the feet end at ${y1}`)
      assert.ok(Math.abs((x0 + x1) / 2 - M.FIG.ax) <= 3, `yaw ${yaw}: the middle is at ${(x0 + x1) / 2}`)
    }
  })
})

describe('rendering', () => {
  it('gives the same pixels for the same pose, in a new sprite or a used one', () => {
    const poses = [
      { yaw: 0.7, act: 'walk', t: 0.3 },
      { yaw: 2, act: 'swing', t: 0.5, blade: blade(2.4, { trail: [2.2, 2, 1.7] }) },
      { yaw: -1, act: 'carry', t: 0.6, moving: true },
      { yaw: 4, act: 'dead', t: 0.4 },
      { yaw: 1, act: 'idle', t: 2, blade: blade(1, { charge: 1, flash: true, kind: 'arc', reach: 1.4 }) },
    ]
    const fresh = poses.map(p => M.renderFigure(p, M.GIRL_LOOK))
    const out = M.renderFigure({ yaw: 3, act: 'spin', t: 0.4, blade: blade(5, { reach: 1.55, trail: [4.8, 4.5, 4.2, 3.9] }) }, M.DRAWN_LOOK)
    for (let round = 0; round < 2; round++) {
      poses.forEach((p, k) => {
        const again = M.renderFigure(p, M.GIRL_LOOK, out)
        assert.equal(again, out)
        assert.ok(same(again, fresh[k]), `${p.act} differs when the sprite is reused`)
        assert.deepEqual([...again.box], [...fresh[k].box])
      })
    }
  })

  it('draws every act at several yaws inside the cell, and the box holds every pixel', () => {
    for (const act of ACTS) {
      for (const yaw of YAWS) {
        for (const t of [0, 0.3, 0.6, 0.9]) {
          const a = yaw + 0.5
          const pose = { yaw, act, t, moving: t > 0.5 }
          if (act === 'swing' || act === 'spin') pose.blade = blade(a, { reach: act === 'spin' ? 1.55 : 1.2, trail: [a - 0.2, a - 0.45, a - 0.7, a - 1] })
          const s = M.renderFigure(pose, M.DRAWN_LOOK)
          const [x0, y0, x1, y1] = s.box
          assert.ok(x0 >= 0 && y0 >= 0 && x1 <= s.w && y1 <= s.h && x0 < x1 && y0 < y1, `${act} at ${yaw}, t ${t}: box ${s.box}`)
          let n = 0
          for (const [, x, y] of pixels(s)) {
            n++
            if (x < x0 || x >= x1 || y < y0 || y >= y1) assert.fail(`${act} at ${yaw}, t ${t}: pixel (${x}, ${y}) outside the box ${s.box}`)
          }
          assert.ok(n > (act === 'fall' ? 0 : 300), `${act} at ${yaw}, t ${t}: ${n} pixels`)
        }
      }
    }
  })

  it('takes any yaw: a whole turn more is the same picture', () => {
    for (const yaw of [0.3, 1.9, -2.4]) {
      const a = M.renderFigure({ yaw, act: 'walk', t: 0.25 }, M.DRAWN_LOOK)
      const b = M.renderFigure({ yaw: yaw + Math.PI * 6, act: 'walk', t: 0.25 }, M.DRAWN_LOOK)
      let off = 0
      for (let i = 0; i < a.albedo.length; i++) if (a.albedo[i] !== b.albedo[i]) off++
      assert.ok(off < 40, `${off} bytes differ`)
    }
  })

  it('has hard pixels: alpha is 0 or 255 outside the trail, and only the blade glows', () => {
    for (const act of ACTS) {
      for (const yaw of YAWS) {
        const s = M.renderFigure({ yaw, act, t: 0.4, moving: true }, M.GIRL_LOOK)
        for (const [i] of pixels(s)) {
          assert.equal(s.albedo[i + 3], 255, `${act}: alpha ${s.albedo[i + 3]}`)
          assert.equal(s.normal[i + 3], 0, `${act}: a pixel of the body glows`)
        }
      }
    }
    const a = 0.9
    const s = M.renderFigure({ yaw: 0.5, act: 'swing', t: 0.5, blade: blade(a, { trail: [a - 0.3, a - 0.6, a - 0.9] }) }, M.DRAWN_LOOK)
    let soft = 0
    let glowing = 0
    for (const [i] of pixels(s)) {
      if (s.normal[i + 3]) glowing++
      if (s.albedo[i + 3] < 255) {
        soft++
        assert.ok(s.normal[i + 3] > 0 && s.normal[i + 3] < 255, 'a see-through pixel that is not the trail')
      }
    }
    assert.ok(soft > 40, `the trail has ${soft} see-through pixels`)
    assert.ok(glowing > soft, 'the blade glows too')
    // Without a trail the blade is hard as well.
    const hard = M.renderFigure({ yaw: 0.5, act: 'swing', t: 0.5, blade: blade(a) }, M.DRAWN_LOOK)
    for (const [i] of pixels(hard)) assert.equal(hard.albedo[i + 3], 255)
  })

  it('has unit normals wherever there is a pixel', () => {
    const a = 2
    const poses = [
      { yaw: 1, act: 'idle', t: 0 }, { yaw: -2, act: 'walk', t: 0.4 }, { yaw: 0, act: 'dead', t: 1 }, { yaw: 3, act: 'fall', t: 0.5 },
      { yaw: 2, act: 'spin', t: 0.5, blade: blade(a, { reach: 1.55, charge: 1, flash: true, trail: [a - 0.3, a - 0.7, a - 1.2, a - 2] }) },
    ]
    for (const p of poses) {
      const s = M.renderFigure(p, M.GIRL_LOOK)
      for (const [i] of pixels(s)) {
        const n = [0, 1, 2].map(k => s.normal[i + k] / 127.5 - 1)
        const l = Math.hypot(...n)
        assert.ok(Math.abs(l - 1) < 0.05, `${p.act}: a normal of length ${l}`)
      }
    }
  })

  it('is nothing at the bottom of a fall', () => {
    const s = M.renderFigure({ yaw: 1, act: 'fall', t: 1 }, M.DRAWN_LOOK)
    assert.equal(count(s), 0)
    assert.deepEqual([...s.box], [0, 0, 0, 0])
    const sizes = [0, 0.3, 0.6, 0.9].map(t => count(M.renderFigure({ yaw: 1, act: 'fall', t }, M.DRAWN_LOOK)))
    for (let k = 1; k < sizes.length; k++) assert.ok(sizes[k] < sizes[k - 1], `the fall does not shrink: ${sizes}`)
  })
})

describe('motion', () => {
  it('walks in a cycle that closes, bobbing twice a round', () => {
    for (const yaw of [0.4, 2.5]) {
      const at = t => M.renderFigure({ yaw, act: 'walk', t }, M.DRAWN_LOOK)
      assert.ok(same(at(0), at(1)), 'the cycle does not close')
      assert.ok(same(at(0.25), at(3.25)))
      assert.ok(same(at(0.3), at(-0.7)))
      const tops = []
      for (let k = 0; k < 16; k++) tops.push(at(k / 16).box[1])
      assert.ok(!same(at(0), at(0.25)) && !same(at(0.25), at(0.75)), 'the legs do not move')
      assert.equal(Math.max(...tops) - Math.min(...tops), 1, `the head bobs ${tops}`)
      let dips = 0
      for (let k = 0; k < 16; k++) if (tops[k] > tops[(k + 15) % 16]) dips++
      assert.equal(dips, 2, `the head dips ${tops}`)
    }
  })

  it('breathes a pixel when standing', () => {
    const tops = new Set()
    for (let t = 0; t < 2.6; t += 0.2) tops.add(M.renderFigure({ yaw: 1, act: 'idle', t }, M.DRAWN_LOOK).box[1])
    assert.equal(tops.size, 2)
  })

  it('faces the viewer when it holds a find up, whatever the yaw', () => {
    const a = M.renderFigure({ yaw: 0, act: 'get', t: 1 }, M.DRAWN_LOOK)
    const b = M.renderFigure({ yaw: 2.5, act: 'get', t: 1 }, M.DRAWN_LOOK)
    assert.ok(same(a, b))
    // The hands are up beside where the find goes: skin above the head.
    const skin = M.DRAWN_LOOK.skin
    const top = Math.min(...[...pixels(a)].filter(([i]) => hexOf(a, i) === skin).map(([, , y]) => y))
    assert.ok(M.FIG.ay - top >= 30, `the hands reach ${M.FIG.ay - top} px up`)
  })

  it('holds what it carries at the head\'s sides, 24 to 28 px up', () => {
    const s = M.renderFigure({ yaw: Math.PI / 4, act: 'carry', t: 0 }, M.DRAWN_LOOK)
    const skin = M.DRAWN_LOOK.skin
    const hands = [...pixels(s)].filter(([i, x]) => hexOf(s, i) === skin && Math.abs(x - M.FIG.ax) >= 10)
    assert.ok(hands.length >= 8, 'no hands beside the head')
    const up = hands.map(([, , y]) => M.FIG.ay - y)
    assert.ok(Math.min(...up) >= 21 && Math.max(...up) <= 31, `the hands are ${Math.min(...up)}..${Math.max(...up)} px up`)
  })

  it('lies down when dead and stays down', () => {
    const s = M.renderFigure({ yaw: 2, act: 'dead', t: 0.5 }, M.DRAWN_LOOK)
    const [x0, y0, x1, y1] = s.box
    assert.ok(x1 - x0 > y1 - y0 + 6, `lying, the figure is ${x1 - x0} × ${y1 - y0}`)
    assert.ok(same(s, M.renderFigure({ yaw: 2, act: 'dead', t: 1 }, M.DRAWN_LOOK)))
  })

  it('shows its eyes from the front and not from behind', () => {
    const eyes = yaw => {
      const s = M.renderFigure({ yaw, act: 'idle', t: 0 }, M.DRAWN_LOOK)
      return [...pixels(s)].filter(([i]) => hexOf(s, i) === '#1c1030').length
    }
    assert.equal(eyes(Math.PI / 4), 8)
    assert.equal(eyes(Math.PI * 1.25), 0)
    // In profile, one eye.
    const side = eyes(-Math.PI / 4)
    assert.ok(side >= 2 && side <= 4, `${side} eye pixels in profile`)
  })
})

describe('the blade', () => {
  /** The blade's pixel farthest out along the screen direction of world angle a. */
  function tip(s, a) {
    const dx = Math.cos(a) - Math.sin(a)
    const dy = (Math.cos(a) + Math.sin(a)) / 2
    let best = null
    for (const [i, x, y] of pixels(s)) {
      if (s.normal[i + 3] < 200) continue
      const d = (x + 0.5 - M.FIG.ax) * dx + (y + 0.5 - M.FIG.ay) * dy
      if (!best || d > best.d) best = { d, x: x + 0.5, y: y + 0.5 }
    }
    return best
  }

  it('reaches where the scene\'s projection says, at every angle', () => {
    for (const [act, reach, kind] of [['swing', 1.2, 'sword'], ['swing', 1.4, 'arc'], ['spin', 1.55, 'sword'], ['idle', 1.2, 'sword'], ['walk', 1.4, 'arc']]) {
      for (let k = 0; k < 16; k++) {
        const a = k * Math.PI / 8 + 0.1
        const s = M.renderFigure({ yaw: a - 0.6, act, t: 0.5, blade: blade(a, { reach, kind, charge: act === 'idle' ? 0.8 : 0 }) }, M.DRAWN_LOOK)
        const at = tip(s, a)
        const want = onScreen(a, reach)
        assert.ok(at, `${act} at ${a}: no blade`)
        assert.ok(Math.hypot(at.x - want.x, at.y - want.y) <= 2, `${act} ${kind} at ${a.toFixed(2)}: tip at (${at.x}, ${at.y}), wanted (${want.x.toFixed(1)}, ${want.y.toFixed(1)})`)
      }
    }
  })

  it('goes behind the body when it points away from the viewer, and in front when it points at them', () => {
    const glowAt = (s, p) => s.normal[(Math.floor(p.y) * s.w + Math.floor(p.x)) * 4 + 3]
    const alphaAt = (s, p) => s.albedo[(Math.floor(p.y) * s.w + Math.floor(p.x)) * 4 + 3]
    for (const yaw of [Math.PI / 4, -Math.PI * 0.75, 1.5]) {
      const away = -Math.PI * 0.75
      const far = M.renderFigure({ yaw, act: 'swing', t: 0.5, blade: blade(away) }, M.DRAWN_LOOK)
      // Half a tile out the blade is behind the head: the head is drawn there, not the steel.
      const hidden = onScreen(away, 0.5)
      assert.equal(alphaAt(far, hidden), 255)
      assert.equal(glowAt(far, hidden), 0, `yaw ${yaw}: the blade shows through the head`)
      // Past the head it comes out again.
      assert.ok(glowAt(far, onScreen(away, 1.05)) > 0, `yaw ${yaw}: the blade does not come out behind the head`)
      const toward = Math.PI / 4
      const near = M.renderFigure({ yaw, act: 'swing', t: 0.5, blade: blade(toward) }, M.DRAWN_LOOK)
      assert.ok(glowAt(near, onScreen(toward, 0.5)) > 0, `yaw ${yaw}: the blade is hidden in front of the legs`)
    }
  })

  it('leaves a trail between the oldest angle and the blade, fading toward its tail', () => {
    const a = 0.2
    const trail = [a - 0.25, a - 0.5, a - 0.75, a - 1]
    const s = M.renderFigure({ yaw: 0, act: 'swing', t: 0.6, blade: blade(a, { trail }) }, M.DRAWN_LOOK)
    const bare = M.renderFigure({ yaw: 0, act: 'swing', t: 0.6, blade: blade(a) }, M.DRAWN_LOOK)
    assert.ok(count(s) > count(bare) + 100, 'no trail')
    // Sampled along the tip's arc: bright near the blade, fainter toward the tail, nothing beyond either end.
    const alpha = ang => { const p = onScreen(ang, 1.2 * 0.93); return s.albedo[(Math.floor(p.y) * s.w + Math.floor(p.x)) * 4 + 3] }
    const lead = alpha(a - 0.12)
    const tail = alpha(a - 0.8)
    assert.ok(lead > 0 && lead < 255 && tail > 0 && tail < lead, `alpha ${lead} near the blade, ${tail} near the tail`)
    assert.equal(alpha(a - 1.25), 0)
    assert.equal(alpha(a + 0.3), 0)
    // The other way round the trail lies on the other side.
    const back = M.renderFigure({ yaw: 0, act: 'swing', t: 0.6, blade: blade(a, { trail: trail.map(v => 2 * a - v) }) }, M.DRAWN_LOOK)
    const p = onScreen(a + 0.5, 1.2 * 0.93)
    assert.ok(back.albedo[(Math.floor(p.y) * back.w + Math.floor(p.x)) * 4 + 3] > 0)
  })

  it('is gold for the Arc Blade and longer', () => {
    const a = 0
    const sword = M.renderFigure({ yaw: 0, act: 'swing', t: 0.5, blade: blade(a) }, M.DRAWN_LOOK)
    const arc = M.renderFigure({ yaw: 0, act: 'swing', t: 0.5, blade: blade(a, { kind: 'arc', reach: 1.4 }) }, M.DRAWN_LOOK)
    const tint = s => { let r = 0, b = 0; for (const [i] of pixels(s)) if (s.normal[i + 3] === 200) { r += s.albedo[i]; b += s.albedo[i + 2] } return r - b }
    assert.ok(tint(sword) < 0, 'the sword\'s edge is not cyan')
    assert.ok(tint(arc) > 0, 'the Arc Blade\'s edge is not gold')
    assert.ok(tip(arc, a).d > tip(sword, a).d + 5)
  })

  it('glows more when charged, with a spark at the tip on a flash', () => {
    const held = (charge, flash) => M.renderFigure({ yaw: 1, act: 'idle', t: 0, blade: blade(1, { charge, flash }) }, M.DRAWN_LOOK)
    const glow = s => { let g = 0; for (const [i] of pixels(s)) g += s.normal[i + 3]; return g }
    assert.ok(glow(held(1, false)) > glow(held(0.1, false)), 'a charged blade glows no more')
    assert.ok(count(held(1, true)) > count(held(1, false)), 'no spark')
    for (const [i] of pixels(held(1, true))) assert.equal(held(1, true).albedo[i + 3], 255)
  })

  it('is left out when the hands are full', () => {
    for (const act of ['lift', 'carry', 'push', 'hurt', 'get', 'use', 'fall', 'dead']) {
      const s = M.renderFigure({ yaw: 1, act, t: 0.5, blade: blade(1, { trail: [0.5, 0] }) }, M.DRAWN_LOOK)
      for (const [i] of pixels(s)) assert.equal(s.normal[i + 3], 0, `${act} draws a blade`)
    }
  })
})

describe('the looks', () => {
  const colours = s => { const set = new Set(); for (const [i] of pixels(s)) set.add(hexOf(s, i)); return set }

  it('wears every colour of the look', () => {
    const looks = [
      M.DRAWN_LOOK, M.GIRL_LOOK,
      { hair: 'tail', head: 'bow', bottom: 'shorts', skin: '#80492b', hairColor: '#ffd23f', headColor: '#b6ff4a', top: '#ff3b5c', stripe: '#1c1030', belt: '#fff4ff', bottomColor: '#4f9a2a', shoes: '#2f5fd0' },
      { hair: 'pigtails', head: 'band', bottom: 'dress', skin: '#ffe3d2', hairColor: '#1c1030', headColor: '#9a4ff0', top: '#fff4ff', stripe: '#ff2fa0', belt: '#ff8a3d', bottomColor: '#4f9a2a', shoes: '#3fd8b0' },
      { hair: 'long', head: 'none', bottom: 'skirt', skin: '#7fd4ff', hairColor: '#ff3b5c', headColor: '#b6ff4a', top: '#5a5285', stripe: '#ffd23f', belt: '#1c1030', bottomColor: '#ff8ae0', shoes: '#6a4432' },
    ]
    for (const look of looks) {
      const seen = new Set()
      for (const yaw of [Math.PI / 4, Math.PI / 4 + 0.7, Math.PI * 1.25]) for (const c of colours(M.renderFigure({ yaw, act: 'idle', t: 0 }, look))) seen.add(c)
      const want = { skin: look.skin, hair: look.hairColor, top: look.top, stripe: look.stripe, belt: look.belt, shoes: look.shoes }
      if (look.head !== 'none') want.head = look.headColor
      if (look.bottom !== 'dress') want.bottom = look.bottomColor
      for (const [part, c] of Object.entries(want)) assert.ok(seen.has(c), `${look.hair}/${look.head}/${look.bottom}: the ${part} colour ${c} is not worn`)
      if (look.head === 'none' && look.headColor !== look.hairColor) assert.ok(!seen.has(look.headColor), 'a bare head wears the headwear colour')
      if (look.bottom === 'dress') assert.ok(!seen.has(look.bottomColor), 'a dress takes the top\'s colour')
    }
  })

  it('has no pure black and few colours', () => {
    for (const look of [M.DRAWN_LOOK, M.GIRL_LOOK]) {
      for (const yaw of YAWS) {
        const set = colours(M.renderFigure({ yaw, act: 'walk', t: 0.25 }, look))
        assert.ok(!set.has('#000000'))
        // Eight parts, each an outline, a shade, its colour and at most a light, and the eyes.
        assert.ok(set.size <= 30, `${set.size} colours`)
      }
    }
  })

  it('gives every hair, headwear and bottom its own shape', () => {
    const shot = look => {
      const out = []
      for (const yaw of [Math.PI / 4, Math.PI * 1.25, -Math.PI / 4]) out.push(Buffer.from(M.renderFigure({ yaw, act: 'idle', t: 0 }, look).albedo).toString('base64'))
      return out.join()
    }
    for (const [key, values] of [['hair', M.HAIR_STYLES], ['head', M.HEADWEAR], ['bottom', M.BOTTOMS]]) {
      const seen = new Set(values.map(v => shot({ ...M.DRAWN_LOOK, [key]: v })))
      assert.equal(seen.size, values.length, `two ${key} choices look the same`)
    }
    for (const hair of M.HAIR_STYLES) for (const head of M.HEADWEAR) for (const bottom of M.BOTTOMS) {
      const look = M.parseHeroLook({ ...M.DRAWN_LOOK, hair, head, bottom })
      for (const act of ['walk', 'swing', 'dead']) {
        const s = M.renderFigure({ yaw: 2, act, t: 0.7, blade: act === 'swing' ? blade(2.5, { trail: [2.2, 1.9] }) : undefined }, look)
        assert.ok(count(s) > 300, `${hair}/${head}/${bottom} ${act}`)
      }
    }
  })

  it('follows a change of look from one frame to the next', () => {
    const out = M.renderFigure({ yaw: 1, act: 'idle', t: 0 }, M.DRAWN_LOOK)
    const red = { ...M.DRAWN_LOOK, top: '#ff3b5c' }
    const set = colours(M.renderFigure({ yaw: 1, act: 'idle', t: 0 }, red, out))
    assert.ok(set.has('#ff3b5c') && !set.has(M.DRAWN_LOOK.top))
  })
})

describe('speed', () => {
  it('renders a frame in a fraction of a millisecond', () => {
    const out = M.renderFigure({ yaw: 0, act: 'idle', t: 0 }, M.DRAWN_LOOK)
    for (let k = 0; k < 200; k++) M.renderFigure({ yaw: k * 0.1, act: 'walk', t: k / 30 }, M.DRAWN_LOOK, out)
    const time = pose => {
      const t0 = performance.now()
      for (let k = 0; k < 400; k++) M.renderFigure(pose(k), M.DRAWN_LOOK, out)
      return (performance.now() - t0) / 400
    }
    const walk = time(k => ({ yaw: k * 0.1, act: 'walk', t: k / 30 }))
    const spin = time(k => { const a = k * 0.2; return { yaw: 0, act: 'spin', t: 0.5, blade: blade(a, { reach: 1.55, trail: Array.from({ length: 10 }, (_, j) => a - (j + 1) * 0.22) }) } })
    // The aim is well under 1 ms and 2 ms on a laptop; the bounds leave room for a busy machine.
    assert.ok(walk < 3, `a walking frame takes ${walk.toFixed(3)} ms`)
    assert.ok(spin < 6, `a spin with a full trail takes ${spin.toFixed(3)} ms`)
  })
})
