// Lag Din Figur's renderers: the four styles draw every body without
// throwing, stand on the same floor line in larger buffers, leave the
// backdrop out when asked, show every garment and drawn textures; the
// Minecraft skin is a full 64 × 64 skin with the hat in its second layer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './figur-load.mjs'

const m = await load()
const { catalog, render, pixels, mcskin } = m
const { STYLES, frameFor, styleById, minecraftSkinFor } = render
const HEX = /^#[0-9a-f]{6}$/
const pose0 = { bob: 0, blink: false, cheer: 0 }
const base = () => m.newFigure('Figur 1', m.makeRng(1))
const draw = (fig, style, o = {}) => frameFor(fig, o.closet ?? [], style, { t: o.t ?? 1, pose: o.pose ?? pose0, backdrop: o.backdrop ?? false, w: o.w, h: o.h })
const painted = (buf) => buf.px.filter(Boolean).length
const same = (a, b) => a.px.every((c, i) => c === b.px[i])
const slotOf = (kind) => m.KIND_SLOT[kind]

/** Bounding box of the painted pixels. */
function bbox(buf) {
  let x0 = buf.w, y0 = buf.h, x1 = -1, y1 = -1
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) if (buf.px[y * buf.w + x]) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
  }
  return { x0, y0, x1, y1 }
}

test('the registry: four styles in order, sizes, labels, lookup', () => {
  assert.deepEqual(STYLES.map(s => s.id), ['minecraft', 'roblox', 'toca', 'avatar'])
  for (const s of STYLES) {
    assert.ok(s.label && s.short && HEX.test(s.bg), s.id)
    assert.ok(s.size.w >= 20 && s.size.h >= 40, s.id)
    const b = draw(base(), s)
    assert.equal(b.w, s.size.w); assert.equal(b.h, s.size.h); assert.equal(b.px.length, b.w * b.h)
    assert.equal(styleById(s.id), s)
  }
  assert.equal(styleById('nope'), STYLES[0])
  assert.equal(draw(base(), 'toca').w, styleById('toca').size.w, 'a style id works too')
})

test('every style draws every hair × eyes × mouth, on every skin, with and without blink', () => {
  // The full product with skins cycling through all nine (each skin meets every hair style).
  let i = 0
  for (const s of STYLES) {
    for (const hair of catalog.HAIR_STYLES) for (const eyes of catalog.EYES) for (const mouth of catalog.MOUTHS) {
      const skin = catalog.SKINS[i++ % catalog.SKINS.length].id
      const hairColor = i % 7 === 0 ? 'rainbow' : catalog.HAIR_COLORS[i % catalog.HAIR_COLORS.length].color
      const f = base()
      const fig = { ...f, body: { ...f.body, hair: hair.id, eyes: eyes.id, mouth: mouth.id, skin, hairColor, freckles: i % 2 === 0, cheeks: i % 3 !== 0 } }
      for (const blink of [false, true]) {
        const b = draw(fig, s, { pose: { bob: i % 2, blink, cheer: 0 } })
        assert.equal(b.px.length, s.size.w * s.size.h)
        assert.ok(painted(b) > 150, `${s.id} ${hair.id} ${eyes.id} ${mouth.id}: paints the figure`)
        for (const c of b.px) if (c !== null) assert.match(c, HEX)
      }
    }
  }
})

test('each hair style, eye and mouth changes the picture in every style', () => {
  for (const s of STYLES) {
    const f = base()
    const ref = draw(f, s)
    for (const hair of catalog.HAIR_STYLES) if (hair.id !== f.body.hair) assert.ok(!same(ref, draw({ ...f, body: { ...f.body, hair: hair.id } }, s)), `${s.id} hair ${hair.id}`)
    for (const e of catalog.EYES) if (e.id !== f.body.eyes) assert.ok(!same(ref, draw({ ...f, body: { ...f.body, eyes: e.id } }, s)), `${s.id} eyes ${e.id}`)
    for (const mo of catalog.MOUTHS) if (mo.id !== f.body.mouth) assert.ok(!same(ref, draw({ ...f, body: { ...f.body, mouth: mo.id } }, s)), `${s.id} mouth ${mo.id}`)
    assert.ok(!same(ref, draw(f, s, { pose: { bob: 0, blink: true, cheer: 0 } })), `${s.id} blink`)
    assert.ok(!same(ref, draw(f, s, { pose: { bob: 1, blink: false, cheer: 0 } })), `${s.id} bob`)
    assert.ok(!same(ref, draw(f, s, { pose: { bob: 0, blink: false, cheer: 0.7 } })), `${s.id} cheer`)
  }
})

test('in a wider or taller buffer the figure is centred and keeps its floor line', () => {
  for (const s of STYLES) {
    const a = bbox(draw(base(), s))
    for (const [dw, dh] of [[30, 0], [0, 20], [41, 17]]) {
      const b = bbox(draw(base(), s, { w: s.size.w + dw, h: s.size.h + dh }))
      assert.equal(b.y1 - dh, a.y1, `${s.id} +${dw}×${dh}: same distance from the bottom`)
      assert.equal(b.x0 - Math.floor(dw / 2), a.x0, `${s.id} +${dw}×${dh}: centred`)
      assert.equal(b.x1 - Math.floor(dw / 2), a.x1)
    }
    // Centred in its own frame too (±1 for odd widths and the Minecraft turn).
    const mid = (a.x0 + a.x1) / 2
    assert.ok(Math.abs(mid - s.size.w / 2) <= 2, `${s.id}: centred, mid ${mid}`)
  }
})

test('backdrop false leaves the corners transparent; with it the frame is full', () => {
  for (const s of STYLES) {
    for (const [w, h] of [[s.size.w, s.size.h], [s.size.w + 24, s.size.h + 10]]) {
      const b = draw(base(), s, { w, h, backdrop: false })
      for (const i of [0, w - 1, (h - 1) * w, h * w - 1]) assert.equal(b.px[i], null, `${s.id} corner`)
      const full = draw(base(), s, { w, h, backdrop: true, t: 2.5 })
      assert.equal(painted(full), w * h, `${s.id}: the backdrop fills ${w}×${h}`)
    }
  }
})

test('every garment changes the picture in every style', () => {
  for (const s of STYLES) {
    for (const d of catalog.GARMENTS) {
      const slot = slotOf(d.kind)
      const without = m.wear(base(), slot, null)
      const withIt = m.wear(base(), slot, { id: d.id })
      assert.ok(!same(draw(without, s), draw(withIt, s)), `${s.id}: ${d.id} shows`)
      if (d.kind === 'wings' || d.kind === 'cape') {
        // Back pieces peek out beside the body: pixels outside the bare figure.
        const bare = draw(without, s)
        const worn = draw(withIt, s)
        const outside = worn.px.filter((c, i) => c && !bare.px[i]).length
        assert.ok(outside >= 12, `${s.id}: ${d.id} peeks out (${outside} px)`)
      }
    }
  }
})

test('a recolour shows in every style', () => {
  for (const s of STYLES) {
    const a = draw(m.wear(base(), 'top', { id: 'genser', color: '#3fbf5f' }), s)
    const b = draw(m.wear(base(), 'top', { id: 'genser', color: '#e8333d' }), s)
    assert.ok(!same(a, b), s.id)
  }
})

function randomTexture(kind, seed) {
  const t = m.blankTexture(kind)
  const mask = m.maskFor(kind)
  const cols = ['#11ee22', '#ee11dd', '#22ddee', '#eedd11', '#7711ee']
  let x = seed
  for (let i = 0; i < t.px.length; i++) {
    x = (x * 16807) % 2147483647
    if (mask[i]) t.px[i] = cols[x % cols.length]
  }
  return { tex: t, cols }
}

test('a drawn texture (random pixels) shows up in every style', () => {
  for (const [kind, slot] of [['long', 'top'], ['pants', 'bottom'], ['dress', 'top'], ['hat', 'hat'], ['boot', 'shoes']]) {
    const { tex, cols } = randomTexture(kind, 99)
    const d = { id: 'd-test0001', name: 'Test', kind, tex: m.packTexture(tex), createdAt: 1 }
    const fig = m.wear(base(), slot, { id: d.id })
    for (const s of STYLES) {
      const b = draw(fig, s, { closet: [d] })
      const seen = new Set(b.px.filter(c => c && cols.includes(c)))
      assert.ok(seen.size >= 3, `${s.id} ${kind}: ${seen.size} of the drawn colours show`)
    }
  }
})

test('frames are deterministic and cached work gives the same picture', () => {
  for (const s of STYLES) {
    const f = m.randomFigure(m.makeRng(5))
    const a = draw(f, s, { backdrop: true, t: 3 })
    const b = draw(JSON.parse(JSON.stringify(f)), s, { backdrop: true, t: 3 })
    assert.ok(same(a, b), s.id)
  }
})

test('minecraftSkin: 64 × 64, head, body, arms and legs filled, the hat in the second layer', () => {
  const P = mcskin.PARTS
  const full = (skin, r) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (!skin.px[y * 64 + x]) return false
    return true
  }
  const count = (skin, r) => {
    let n = 0
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (skin.px[y * 64 + x]) n++
    return n
  }
  const figs = [base(), m.randomFigure(m.makeRng(3)), m.applyTheme(base(), catalog.PIP_THEMES[0]), m.wear(m.wear(base(), 'top', null), 'bottom', null)]
  for (const f of figs) {
    const skin = minecraftSkinFor(f, [])
    assert.equal(skin.w, 64); assert.equal(skin.h, 64); assert.equal(skin.px.length, 64 * 64)
    for (const c of skin.px) if (c !== null) assert.match(c, HEX)
    for (const part of ['head', 'body', 'armR', 'armL', 'legR', 'legL']) {
      for (const face of ['front', 'back', 'left', 'right', 'top', 'bottom']) assert.ok(full(skin, P[part][face]), `${f.name} ${part} ${face}`)
    }
    // Nothing outside the skin's parts (the unused corners stay transparent).
    assert.equal(skin.px[0], null); assert.equal(skin.px[63], null)
  }
  const bare = minecraftSkinFor(base(), [])
  assert.equal(count(bare, P.hat.front), 0, 'no hat: the second layer is empty')
  for (const hat of catalog.GARMENTS.filter(d => d.kind === 'hat')) {
    const skin = minecraftSkinFor(m.wear(base(), 'hat', { id: hat.id }), [])
    assert.ok(count(skin, P.hat.front) >= 4, `${hat.id} in the overlay front`)
  }
  // The skin's front view is what the Minecraft style draws.
  const front = mcskin.skinFront(bare)
  assert.equal(front.w, 16); assert.equal(front.h, 32)
  const frame = draw(base(), 'minecraft')
  const colours = new Set(frame.px.filter(Boolean))
  for (const c of front.px) if (c) assert.ok(colours.has(c), `skin colour ${c} is drawn`)
})

test('writeRGBA: colours as bytes, empty pixels fully transparent', () => {
  const b = pixels.makeBuffer(2, 2)
  b.px[0] = '#ff8000'; b.px[3] = '#0000ff'
  const data = new Uint8ClampedArray(16).fill(9)
  pixels.writeRGBA(b, data)
  assert.deepEqual([...data], [255, 128, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255])
})

test('pixel helpers: resample keeps a one-row brim, mapTexture stretches, outline wraps', () => {
  const t = { w: 4, h: 4, px: [null, null, null, null, null, '#aaaaaa', '#aaaaaa', null, null, '#aaaaaa', '#aaaaaa', null, '#111111', '#111111', '#111111', '#111111'] }
  const r = pixels.resample(t, { x: 0, y: 0, w: 4, h: 4 }, 2, 2)
  assert.deepEqual(r.px.slice(2), ['#111111', '#111111'], 'the bottom row wins its vote')
  const b = pixels.makeBuffer(8, 8)
  pixels.mapTexture(b, t, { x: 0, y: 0, w: 4, h: 4 }, { x: 0, y: 0, w: 8, h: 8 })
  assert.equal(b.px[7 * 8], '#111111'); assert.equal(b.px[0], null)
  const o = pixels.makeBuffer(5, 5)
  pixels.set(o, 2, 2, '#ffffff')
  pixels.outline(o, '#000000')
  assert.equal(painted(o), 5)
})
