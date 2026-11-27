// Neon Shrine's hero model for the 16-bit view (render/iso/figure.ts): every act draws inside its cell, the shipped
// figure pixel for pixel, the blade where the hit is, the booth's looks and shapes worn, and the finer density. A
// pure renderer into typed arrays, bundled with esbuild like the other zelda tests.
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

/** Every act, the fight's new ones (backhand, lunge, roll) with them. */
const ACTS = ['idle', 'walk', 'swing', 'spin', 'lift', 'carry', 'push', 'hurt', 'get', 'use', 'fall', 'dead', 'backhand', 'lunge', 'roll']
const BLADED = new Set(['swing', 'spin', 'backhand', 'lunge'])
const blade = (a, over = {}) => ({ a, reach: 1.2, trail: [], kind: 'sword', charge: 0, flash: false, ...over })
const hexOf = (s, i) => '#' + [s.albedo[i], s.albedo[i + 1], s.albedo[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('')

/** Every pixel with something in it: its index (×4), x and y. */
function* pixels(s) {
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.albedo[(y * s.w + x) * 4 + 3]) yield [(y * s.w + x) * 4, x, y]
}
const count = s => [...pixels(s)].length

/** Where the scene's projection puts a point `tiles` out along world angle `a`, `up` px above the ground. */
function onScreen(a, tiles, up = 14) {
  return { x: M.FIG.ax + tiles * 32 * (Math.cos(a) - Math.sin(a)), y: M.FIG.ay - up + tiles * 16 * (Math.cos(a) + Math.sin(a)) }
}

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

const cases = () => {
  const shape = (hair, head, bottom) => M.parseHeroLook({ ...M.DRAWN_LOOK, hair, head, bottom })
  const looks = [M.DRAWN_LOOK, M.GIRL_LOOK, shape('long', 'band', 'shorts'), shape('tail', 'bow', 'skirt'), shape('pigtails', 'band', 'dress')]
  const bl = (a, kind = 'sword', charge = 0, flash = false) => ({ a, reach: 1.2, trail: [a - 0.3, a - 0.6], kind, charge, flash })
  const poses = [
    { yaw: Math.PI / 4, act: 'idle', t: 0 }, { yaw: 1.25 * Math.PI, act: 'idle', t: 1.7 }, { yaw: 0.3, act: 'walk', t: 0.31 },
    { yaw: 2, act: 'swing', t: 0.5, blade: bl(2.2) }, { yaw: 4, act: 'spin', t: 0.6, blade: bl(1, 'arc') }, { yaw: 1, act: 'idle', t: 0, blade: bl(1, 'sword', 0.8, true) },
    { yaw: 0.8, act: 'lift', t: 0.5 }, { yaw: -1, act: 'carry', t: 0.4, moving: true }, { yaw: 2.5, act: 'push', t: 0.2 },
    { yaw: 0.2, act: 'hurt', t: 0.3 }, { yaw: 0, act: 'get', t: 0.5 }, { yaw: 1.4, act: 'use', t: 0.4 }, { yaw: 3, act: 'fall', t: 0.3 }, { yaw: 0.5, act: 'dead', t: 0.9 },
  ]
  return looks.flatMap(look => poses.map(pose => ({ look, pose })))
}
const fnv = (arrs) => { let h = 0x811c9dc5; for (const a of arrs) for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 0x01000193) >>> 0 } return h.toString(16).padStart(8, '0') }
// What the figure drew at its own density before part 15 (from part 14's figure.ts, these 70 cases): the 16-bit view's
// hero must stay pixel for pixel what it was (and so the 16-bit stills of part3/ref/).
const BEFORE = ["d30d512d","6e615aa4","9d5b867d","885033f4","26f3afc8","5ddfc74f","ba7a2b6d","29d35727","496244eb","bbb84de7","82eb09ed","e8f302ba","1d51f113","9dfc289f","d5cef56c","deeb01fb","b460065b","bb74c5ae","e56fe733","62484a1d","027b72fe","1f083b1a","5fa6fc53","4bc359e0","c2e7a631","1efc8d9a","00fcc677","d54bd960","4c678b93","744beed8","ebbc0503","ad189a89","d3a3f408","860d3296","e59a67e5","80bf6ce9","5726de9b","62416e2b","a92ba7ff","46f23a61","2976ea7c","aa61a8d4","a1cb020e","a4d78657","dafa5c3f","5b04aaa4","6e921cf4","a4438b17","d4b9eb2b","a02d1837","0e31ab0b","15cf3f20","201a0747","2ab7bd03","574ba5a4","e3fb57ba","c69df4dd","aa6a99bd","4f8aa666","0a411246","23a44c09","07c94da9","9e47367c","db4489df","0eb360f0","94adeeaa","561b3f64","4466b131","8267780e","cce56c9b"]
const hash = sp => fnv([sp.albedo, sp.normal])

describe('the hero figure', () => {
  it('draws every act inside the cell at two yaws and moments, the box holding every pixel, nothing at the bottom of a fall', () => {
    for (const act of ACTS) {
      for (const yaw of [Math.PI / 4, -2.6]) {
        for (const t of [0.3, 0.9]) {
          const a = yaw + 0.5
          const pose = { yaw, act, t, moving: t > 0.5, blade: BLADED.has(act) ? blade(a, { reach: act === 'spin' ? 1.55 : 1.2, trail: [a - 0.2, a - 0.45, a - 0.7, a - 1] }) : undefined }
          const s = M.renderFigure(pose, M.DRAWN_LOOK)
          const [x0, y0, x1, y1] = s.box
          assert.ok(x0 >= 0 && y0 >= 0 && x1 <= s.w && y1 <= s.h && x0 < x1 && y0 < y1, `${act} at ${yaw}, t ${t}: box ${s.box}`)
          let n = 0
          for (const [, x, y] of pixels(s)) {
            n++
            if (x < x0 || x >= x1 || y < y0 || y >= y1) assert.fail(`${act} at ${yaw}, t ${t}: pixel (${x}, ${y}) outside the box ${s.box}`)
          }
          assert.ok(n > (act === 'fall' ? 0 : 100), `${act} at ${yaw}, t ${t}: ${n} pixels`)
        }
      }
    }
    const gone = M.renderFigure({ yaw: 1, act: 'fall', t: 1 }, M.DRAWN_LOOK)
    assert.deepEqual([count(gone), ...gone.box], [0, 0, 0, 0, 0])
  })

  it('is pixel for pixel the 16-bit figure it was, drawn fresh or into a used sprite, whatever was drawn between', () => {
    const c = cases()
    assert.deepEqual(c.map(({ look, pose }) => hash(M.renderFigure(pose, look))), BEFORE)
    // Into one sprite, a finer figure and another look drawn between (each density has a bench of its own, and a
    // change of look shows from one frame to the next).
    const used = M.renderFigure({ yaw: 3, act: 'spin', t: 0.4, blade: blade(5, { reach: 1.55, trail: [4.8, 4.5, 4.2, 3.9] }) }, M.DRAWN_LOOK)
    for (const { look, pose } of c.slice(0, 10)) M.renderFigure(pose, look, undefined, 2)
    assert.deepEqual(c.map(({ look, pose }) => { const sp = M.renderFigure(pose, look, used); assert.equal(sp, used); return hash(sp) }), BEFORE)
  })

  it('reaches with the blade where the scene\'s projection says', () => {
    for (const [act, reach, kind] of [['swing', 1.2, 'sword'], ['swing', 1.4, 'arc'], ['spin', 1.55, 'sword']]) {
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + 0.1
        const s = M.renderFigure({ yaw: a - 0.6, act, t: 0.5, blade: blade(a, { reach, kind }) }, M.DRAWN_LOOK)
        const at = tip(s, a)
        const want = onScreen(a, reach)
        assert.ok(at, `${act} at ${a}: no blade`)
        assert.ok(Math.hypot(at.x - want.x, at.y - want.y) <= 2, `${act} ${kind} at ${a.toFixed(2)}: tip at (${at.x}, ${at.y}), wanted (${want.x.toFixed(1)}, ${want.y.toFixed(1)})`)
      }
    }
  })

  it('wears every colour of a look, and none of a part not worn', () => {
    const colours = s => { const set = new Set(); for (const [i] of pixels(s)) set.add(hexOf(s, i)); return set }
    const looks = [
      M.DRAWN_LOOK, M.GIRL_LOOK,
      { hair: 'pigtails', head: 'none', bottom: 'dress', skin: '#ffe3d2', hairColor: '#1c1030', headColor: '#9a4ff0', top: '#fff4ff', stripe: '#ff2fa0', belt: '#ff8a3d', bottomColor: '#4f9a2a', shoes: '#3fd8b0' },
    ]
    for (const look of looks) {
      const seen = new Set()
      for (const yaw of [Math.PI / 4, Math.PI / 4 + 0.7, Math.PI * 1.25]) for (const c of colours(M.renderFigure({ yaw, act: 'idle', t: 0 }, look))) seen.add(c)
      const want = { skin: look.skin, hair: look.hairColor, top: look.top, stripe: look.stripe, belt: look.belt, shoes: look.shoes }
      if (look.head !== 'none') want.head = look.headColor
      if (look.bottom !== 'dress') want.bottom = look.bottomColor
      for (const [part, c] of Object.entries(want)) assert.ok(seen.has(c), `${look.hair}/${look.head}/${look.bottom}: the ${part} colour ${c} is not worn`)
      if (look.head === 'none') assert.ok(!seen.has(look.headColor), 'a bare head wears the headwear colour')
      if (look.bottom === 'dress') assert.ok(!seen.has(look.bottomColor), 'a dress takes the top\'s colour')
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
  })

  it('is twice as fine at density 2: the cell twice as large each way, the figure the same size and in the same place', () => {
    const box = (sp) => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const [, x, y] of pixels(sp)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) } return [x0, y0, x1 + 1, y1 + 1] }
    const all = cases()
    for (const { look, pose } of [all[0], all[3], all[7]]) {
      const a = M.renderFigure(pose, look, undefined, 1), b = M.renderFigure(pose, look, undefined, 2)
      assert.deepEqual([b.w, b.h, b.ax, b.ay], [2 * a.w, 2 * a.h, 2 * a.ax, 2 * a.ay])
      const ba = box(a), bb = box(b).map(v => v / 2)
      for (let k = 0; k < 4; k++) assert.ok(Math.abs(ba[k] - bb[k]) <= 1.5, `${pose.act} ${look.hair}: ${ba} against ${bb}`)
    }
  })
})
