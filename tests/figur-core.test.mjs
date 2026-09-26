// Lag Din Figur's pure core: the catalog, garment textures and their
// masks, packing, the drawing board's operations, outfits, figures, the
// save and its limits, Pip reading Norwegian, and Neon Shrine's colours.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './figur-load.mjs'

const m = await load()
const { catalog } = m
const HEX = /^#[0-9a-f]{6}$/
const ok = (r) => {
  assert.equal(typeof r, 'object', `expected a save, got ${r}`)
  return r
}
const painted = (tex) => tex.px.filter(Boolean).length

// ---------------------------------------------------------------- catalog

test('the catalog is complete, lower-case and consistent', () => {
  assert.equal(catalog.PALETTE.length, 24)
  assert.equal(new Set(catalog.PALETTE).size, 24)
  for (const c of catalog.PALETTE) assert.match(c, HEX)
  assert.deepEqual(catalog.SKINS.map(s => s.id).sort(), ['bla', 'brun', 'gronn', 'honning', 'lilla', 'lys', 'mork', 'oliven', 'porselen'])
  for (const s of catalog.SKINS) { assert.match(s.color, HEX); assert.match(s.shade, HEX) }
  for (const h of catalog.HAIR_COLORS) assert.ok(h.color === 'rainbow' || HEX.test(h.color), h.id)
  assert.equal(catalog.RAINBOW.length, 6)
  assert.equal(catalog.HAIR_STYLES.length, 9)
  assert.equal(catalog.EYES.length, 6)
  assert.equal(catalog.MOUTHS.length, 5)
  for (const c of catalog.EYE_COLORS) assert.match(c, HEX)

  const ids = catalog.GARMENTS.map(g => g.id)
  assert.equal(new Set(ids).size, ids.length, 'unique ids')
  const count = (...kinds) => catalog.GARMENTS.filter(g => kinds.includes(g.kind)).length
  assert.ok(count('tee', 'long', 'tank', 'hoodie', 'shirt') >= 8)
  assert.ok(count('dress') >= 4)
  assert.ok(count('pants', 'shorts', 'skirt', 'leggings') >= 6)
  assert.ok(count('sneaker', 'boot', 'flat') >= 5)
  assert.ok(count('hat') >= 9)
  assert.ok(count('glasses') >= 4)
  assert.ok(count('cape', 'wings') >= 4)
  for (const g of catalog.GARMENTS) {
    assert.match(g.color, HEX, g.id)
    assert.match(g.color2, HEX, g.id)
    assert.ok(g.words.length > 0 && g.words.every(w => w === w.toLowerCase()), g.id)
    assert.equal(catalog.garment(g.id), g)
  }
  assert.equal(catalog.garment('nope'), undefined)
  assert.equal(catalog.DRAW_TEMPLATES.length, 9)
})

test("every Pip theme wears real pieces in their right slots, with a line", () => {
  assert.ok(catalog.PIP_THEMES.length >= 12)
  for (const t of catalog.PIP_THEMES) {
    assert.ok(t.line.length > 5 && t.words.length, t.id)
    assert.ok(t.outfit.top, `${t.id} has a top`)
    for (const [slot, w] of Object.entries(t.outfit)) {
      if (!w) continue
      const def = catalog.garment(w.id)
      assert.ok(def, `${t.id}: ${w.id}`)
      assert.equal(m.KIND_SLOT[def.kind], slot, `${t.id}: ${w.id} in ${slot}`)
      if (w.color) assert.match(w.color, HEX)
      if (w.color2) assert.match(w.color2, HEX)
    }
  }
})

// ---------------------------------------------------------------- textures

test('every garment generates a texture of its layout, inside its mask, with pixels', () => {
  for (const def of catalog.GARMENTS) {
    for (const [c1, c2] of [[undefined, undefined], ['#ff0000', '#00ff00'], ['#22222b', '#ffffff']]) {
      const tex = m.garmentTexture(def, c1, c2)
      const { w, h } = m.LAYOUTS[m.layoutOf(def.kind)]
      assert.equal(tex.w, w, def.id)
      assert.equal(tex.h, h, def.id)
      assert.equal(tex.px.length, w * h, def.id)
      const mask = m.maskFor(def.kind)
      tex.px.forEach((c, i) => {
        if (!mask[i]) assert.equal(c, null, `${def.id} paints outside its mask at ${i % w},${Math.floor(i / w)}`)
        if (c) assert.match(c, HEX, def.id)
      })
      assert.ok(painted(tex) >= 8, `${def.id} paints only ${painted(tex)} pixels`)
    }
  }
})

test('garments recolour, and cache per colours', () => {
  const tee = catalog.garment('tskjorte')
  const a = m.garmentTexture(tee)
  assert.equal(m.garmentTexture(tee), a, 'cached')
  const red = m.garmentTexture(tee, '#e8333d')
  assert.notEqual(red, a)
  assert.equal(m.topColors(red).main, '#e8333d')
  assert.equal(m.garmentTexture(tee, 'not a colour'), a, 'a bad colour falls back to the default')
  // The heart sweater's heart is in color2, on the torso.
  const heart = m.garmentTexture(catalog.garment('hjertegenser'), '#ffffff', '#ff0000')
  const reds = heart.px.map((c, i) => c === '#ff0000' ? i % 16 : -1).filter(x => x >= 0)
  assert.ok(reds.length >= 20 && reds.every(x => x >= 3 && x <= 12), 'heart centred on the torso')
})

test('masks follow the layouts', () => {
  const at = (kind, x, y) => m.maskFor(kind)[y * m.LAYOUTS[m.layoutOf(kind)].w + x]
  assert.ok(at('tee', 0, 4) && !at('tee', 0, 5), 'short sleeves to row 4')
  assert.ok(at('long', 0, 12) && !at('long', 0, 13), 'long sleeves leave the hand')
  assert.ok(!at('tank', 1, 0) && at('tank', 5, 0), 'no sleeves on a tank')
  assert.ok(at('dress', 3, 14) && !at('dress', 2, 14) && at('dress', 1, 23) && !at('dress', 0, 23), 'the skirt trapezoid')
  assert.ok(at('shorts', 0, 5) && !at('shorts', 0, 6))
  assert.ok(at('skirt', 0, 7) && !at('skirt', 0, 8) && !at('skirt', 0, 0), 'a skirt flares')
  assert.ok(!at('sneaker', 2, 0) && at('sneaker', 2, 1) && !at('flat', 2, 1) && at('boot', 2, 0))
  assert.ok(m.maskFor('hat').every(Boolean))
  for (const kind of Object.keys(m.KIND_SLOT)) {
    assert.equal(m.guideFor(kind).length, m.maskFor(kind).length, kind)
    assert.ok(m.guideFor(kind).some(Boolean), `${kind} has a guide`)
  }
})

test('pack and unpack round-trip, and bad packs are refused', () => {
  for (const def of catalog.GARMENTS) {
    const tex = m.garmentTexture(def)
    const p = m.packTexture(tex)
    assert.equal(p.data.length, tex.w * tex.h)
    assert.deepEqual(m.unpackTexture(JSON.parse(JSON.stringify(p))), tex, def.id)
  }
  const good = m.packTexture(m.garmentTexture(catalog.garment('joggesko')))
  const bad = [
    null, 'x', [], { ...good, w: 7 }, { ...good, w: 5, h: 5 }, { ...good, data: good.data.slice(1) },
    { ...good, data: good.data.replace(/[^.]/, 'Z') }, { ...good, data: good.data.replace(/./, '#') },
    { ...good, pal: ['red'] }, { ...good, pal: 'abc' }, { ...good, pal: new Array(63).fill('#000000') },
  ]
  for (const b of bad) assert.equal(m.unpackTexture(b), null, JSON.stringify(b)?.slice(0, 80))
  // Upper-case colours are accepted and lowered.
  assert.equal(m.unpackTexture({ ...good, pal: good.pal.map(c => c.toUpperCase()) }).px.find(Boolean), good.pal[0])
})

test('the drawing board paints, fills and mirrors inside the mask', () => {
  let t = m.clearTexture('tee')
  assert.equal(painted(t), 0)
  t = m.paintCell(t, 'tee', 4, 2, '#ff0000', true)
  assert.equal(t.px[2 * 16 + 4], '#ff0000')
  assert.equal(t.px[2 * 16 + 11], '#ff0000', 'mirrored')
  const same = m.paintCell(t, 'tee', 0, 10, '#ff0000', false)
  assert.equal(same, t, 'outside the mask: nothing changes')
  const one = m.paintCell(t, 'tee', 5, 5, '#00ff00', false)
  assert.equal(one.px[5 * 16 + 10], null, 'no mirror when off')
  const erased = m.paintCell(t, 'tee', 4, 2, null, false)
  assert.equal(erased.px[2 * 16 + 4], null)
  assert.equal(erased.px[2 * 16 + 11], '#ff0000')
  assert.equal(t.px[2 * 16 + 4], '#ff0000', 'the input is not changed')

  const filled = m.fillArea(m.clearTexture('tee'), 'tee', 5, 5, '#0000ff', false)
  const mask = m.maskFor('tee')
  filled.px.forEach((c, i) => assert.equal(c, mask[i] ? '#0000ff' : null))
  // A wall of red splits the torso: the fill stays on its side.
  let wall = m.clearTexture('tee')
  for (let y = 0; y < 14; y++) wall = m.paintCell(wall, 'tee', 7, y, '#ff0000', false)
  const half = m.fillArea(wall, 'tee', 10, 8, '#00ff00', false)
  assert.equal(half.px[8 * 16 + 4], null, 'the other side stays empty')
  assert.equal(half.px[8 * 16 + 10], '#00ff00')
  const both = m.fillArea(wall, 'tee', 10, 8, '#00ff00', true)
  assert.equal(both.px[8 * 16 + 4], '#00ff00', 'mirror fills the other side too')
  assert.equal(m.fillArea(filled, 'tee', 5, 5, '#0000ff', false), filled, 'same colour: unchanged')
  assert.equal(m.paintCell(m.clearTexture('hat'), 'tee', 1, 1, '#ff0000', false).px.filter(Boolean).length, 0, 'wrong size: unchanged')
})

test('topColors, limitColors and sampleTexture', () => {
  const t = { w: 2, h: 2, px: ['#111111', '#111111', '#222222', null] }
  assert.deepEqual(m.topColors(t), { main: '#111111', second: '#222222' })
  assert.deepEqual(m.topColors(t, { x: 0, y: 1, w: 2, h: 1 }), { main: '#222222', second: null })
  assert.equal(m.sampleTexture(t, 0, 0), '#111111')
  assert.equal(m.sampleTexture(t, 0.99, 0.99), null)
  assert.equal(m.sampleTexture(t, 1.5, -1), '#111111', 'clamped')
  const many = { w: 20, h: 1, px: Array.from({ length: 20 }, (_, i) => '#' + (i * 10).toString(16).padStart(2, '0').repeat(3)) }
  const few = m.limitColors(many, 4)
  assert.equal(new Set(few.px).size, 4)
  assert.equal(m.limitColors(t, 4), t)
})

test('resolveOutfit: built-ins in worn colours, drawn pieces, a dress hides the bottom, unknowns are nothing', () => {
  const drawnTex = m.paintCell(m.clearTexture('hat'), 'hat', 3, 3, '#123456', true)
  const drawn = { id: 'd-abcdefgh', name: 'Min hatt', kind: 'hat', tex: m.packTexture(drawnTex), createdAt: 1 }
  let fig = m.newFigure('Test', m.makeRng(3))
  fig = m.wear(fig, 'top', { id: 'tskjorte', color: '#ff0000' })
  fig = m.wear(fig, 'hat', { id: 'd-abcdefgh' })
  let r = m.resolveOutfit(fig, [drawn])
  assert.equal(r.kind.top, 'tee')
  assert.equal(m.topColors(r.tex.top).main, '#ff0000')
  assert.equal(r.kind.bottom, 'pants')
  assert.equal(r.kind.hat, 'hat')
  assert.equal(r.tex.hat.px[3 * 16 + 3], '#123456')
  assert.equal(r.tex.face, null)

  fig = m.wear(fig, 'top', { id: 'prinsessekjole' })
  r = m.resolveOutfit(fig, [drawn])
  assert.equal(r.kind.top, 'dress')
  assert.equal(r.tex.top.h, 24)
  assert.equal(r.tex.bottom, null)
  assert.equal(r.kind.bottom, null)

  const ghost = { ...fig, outfit: { ...fig.outfit, hat: { id: 'd-zzzzzzzz' }, face: { id: 'no-such' }, shoes: { id: 'krone' } } }
  r = m.resolveOutfit(ghost, [drawn])
  assert.equal(r.tex.hat, null)
  assert.equal(r.tex.face, null)
  assert.equal(r.tex.shoes, null, 'a hat in the shoe slot is nothing')
})

// ---------------------------------------------------------------- figures

test('new and random figures are valid; the same seed gives the same figure', () => {
  const f = m.newFigure('Ulrikke', m.makeRng(1))
  assert.match(f.id, /^f-[a-z0-9]{8}$/)
  assert.deepEqual(m.parseFigure(f, []), f)
  assert.deepEqual(Object.values(f.outfit).filter(Boolean).map(w => w.id), ['tskjorte', 'jeans', 'joggesko'])
  for (let seed = 1; seed <= 60; seed++) {
    const r = m.randomFigure(m.makeRng(seed))
    assert.deepEqual(m.parseFigure(JSON.parse(JSON.stringify(r)), []), r, `seed ${seed}`)
    assert.ok(r.outfit.top && r.outfit.shoes)
    const dress = catalog.garment(r.outfit.top.id).kind === 'dress'
    assert.equal(!!r.outfit.bottom, !dress, 'bottom unless a dress')
  }
  assert.deepEqual(m.randomFigure(m.makeRng(7)), m.randomFigure(m.makeRng(7)))
  assert.notDeepEqual(m.randomFigure(m.makeRng(7)), m.randomFigure(m.makeRng(8)))
})

test('wear, setBody and parseFigure validate', () => {
  const f = m.newFigure('Ida', m.makeRng(2))
  assert.equal(m.wear(f, 'shoes', { id: 'krone' }), f, 'a hat is not shoes')
  assert.equal(m.wear(f, 'hat', { id: 'krone', color: '#FF0000' }).outfit.hat.color, '#ff0000')
  assert.equal(m.wear(f, 'hat', { id: 'krone', color: 'red' }).outfit.hat.color, undefined)
  assert.equal(m.wear(f, 'top', null).outfit.top, null)
  assert.equal(m.setBody(f, { skin: 'bla', hair: 'nope' }).body.skin, 'bla')
  assert.equal(m.setBody(f, { hair: 'nope' }), f)
  assert.equal(m.setBody(f, { hairColor: 'rainbow' }).body.hairColor, 'rainbow')

  const raw = JSON.parse(JSON.stringify(m.wear(m.wear(f, 'hat', { id: 'd-11112222' }), 'face', { id: 'briller' })))
  assert.equal(m.parseFigure(raw, ['d-11112222']).outfit.hat.id, 'd-11112222')
  assert.equal(m.parseFigure(raw, []).outfit.hat, null, 'a drawn piece not in the closet comes off')
  assert.equal(m.parseFigure(raw, [{ id: 'd-11112222', kind: 'tee' }]).outfit.hat, null, 'a drawn top on the head comes off')
  assert.equal(m.parseFigure({ ...raw, outfit: { ...raw.outfit, top: { id: 'tskjorte', color: 'blue' } } }, []).outfit.top, null)
  for (const bad of [
    null, { ...raw, id: 'x' }, { ...raw, name: '' }, { ...raw, name: 'x'.repeat(17) }, { ...raw, name: '<b>' },
    { ...raw, style: 'lego' }, { ...raw, body: { ...raw.body, skin: 'rosa' } }, { ...raw, body: { ...raw.body, cheeks: 1 } },
    { ...raw, body: { ...raw.body, eyeColor: '#12345' } },
  ]) assert.equal(m.parseFigure(bad, []), null, JSON.stringify(bad)?.slice(0, 60))
  assert.equal(m.cleanName('  Ulrikke   Hareim '), 'Ulrikke Hareim')
  assert.equal(m.cleanName('Figur 2'), 'Figur 2')
  assert.equal(m.cleanName('--'), null)
})

// ---------------------------------------------------------------- save

const drawnDress = (save, rng, colors = 8) => {
  let t = m.clearTexture('dress')
  const mask = m.maskFor('dress')
  t = { ...t, px: t.px.map((_, i) => mask[i] ? catalog.PALETTE[Math.floor(rng() * colors)] : null) }
  return { id: m.newDrawnId(save, rng), name: m.nextDrawnName(save, 'dress'), kind: 'dress', tex: m.packTexture(t), createdAt: 1790000000000 }
}

test('a new save has one active figure and round-trips through parseSave', () => {
  const s = m.newSave(m.makeRng(1))
  assert.equal(s.figures.length, 1)
  assert.equal(s.active, s.figures[0].id)
  assert.equal(m.activeFigure(s), s.figures[0])
  assert.deepEqual(m.parseSave(JSON.parse(JSON.stringify(s))), s)
  assert.deepEqual(m.parseSave(JSON.stringify(s)), s)
  for (const bad of [null, 'x', '{', { v: 2, figures: [], closet: [] }, { v: 1, figures: 'x', closet: [] }]) {
    assert.equal(m.parseSave(bad), null)
  }
})

test('figure actions keep their limits', () => {
  const rng = m.makeRng(4)
  let s = m.newSave(rng)
  for (let i = 2; i <= m.MAX_FIGURES; i++) {
    s = ok(m.addFigure(s, undefined, rng))
    assert.equal(m.activeFigure(s).name, `Figur ${i}`)
  }
  assert.equal(m.addFigure(s, undefined, rng), 'full')
  assert.equal(m.SAVE_ERROR_TEXT.full.includes('8'), true)
  const [a, b] = s.figures
  s = ok(m.setActive(s, a.id))
  assert.equal(m.setActive(s, 'f-nothere'), 'no-figure')
  s = ok(m.removeFigure(s, a.id))
  assert.equal(s.active, b.id, 'the next one becomes active')
  s = ok(m.updateFigure(s, b.id, { ...b, name: 'Ulrikke', id: 'f-changeme' }))
  assert.equal(s.figures[0].name, 'Ulrikke')
  assert.equal(s.figures[0].id, b.id, 'the id is kept')
  assert.equal(m.updateFigure(s, b.id, { ...b, name: '' }), 'bad-figure')
  let one = m.newSave(rng)
  assert.equal(m.removeFigure(one, one.active), 'last-figure')
  // A given figure with a taken id gets a fresh one.
  one = ok(m.addFigure(one, one.figures[0], rng))
  assert.notEqual(one.figures[0].id, one.figures[1].id)
})

test('drawn clothes: save, replace, rename, name, delete undresses', () => {
  const rng = m.makeRng(5)
  let s = m.newSave(rng)
  const d = drawnDress(s, rng)
  assert.equal(d.name, 'Min kjole')
  s = ok(m.saveDrawn(s, d))
  assert.equal(m.nextDrawnName(s, 'dress'), 'Min kjole 2')
  assert.equal(m.nextDrawnName(s, 'skirt'), 'Mitt skjørt')
  assert.equal(m.nextDrawnName(s, 'sneaker'), 'Mine sko')
  s = ok(m.updateFigure(s, s.active, m.wear(m.activeFigure(s), 'top', { id: d.id })))
  assert.equal(m.activeFigure(s).outfit.top.id, d.id)
  // Replace by id keeps one piece.
  s = ok(m.saveDrawn(s, { ...d, name: 'Festkjole' }))
  assert.equal(s.closet.length, 1)
  assert.equal(s.closet[0].name, 'Festkjole')
  s = ok(m.renameDrawn(s, d.id, 'Solkjole'))
  assert.equal(s.closet[0].name, 'Solkjole')
  assert.equal(m.renameDrawn(s, d.id, ''), 'bad-name')
  assert.equal(m.renameDrawn(s, 'd-nothere0', 'X'), 'no-garment')
  // Bad pieces are refused.
  assert.equal(m.saveDrawn(s, { ...d, id: 'd-other001', kind: 'wings' }), 'bad-garment')
  assert.equal(m.saveDrawn(s, { ...d, id: 'd-other001', kind: 'tee' }), 'bad-garment', 'a dress texture is not a tee')
  assert.equal(m.saveDrawn(s, { ...d, id: 'x' }), 'bad-garment')
  assert.equal(m.saveDrawn(s, { ...d, name: '' }), 'bad-name')
  // Deleting takes it off the figure.
  s = ok(m.deleteDrawn(s, d.id))
  assert.equal(s.closet.length, 0)
  assert.equal(m.activeFigure(s).outfit.top, null)
  assert.equal(m.deleteDrawn(s, d.id), 'no-garment')
})

test('saveDrawn clips to the mask and holds a piece to 16 colours', () => {
  const rng = m.makeRng(6)
  let s = m.newSave(rng)
  const full = { w: 16, h: 14, px: Array.from({ length: 16 * 14 }, (_, i) => catalog.PALETTE[i % 24]) }
  s = ok(m.saveDrawn(s, { id: 'd-aaaa1111', name: 'Min genser', kind: 'tee', tex: m.packTexture(full), createdAt: 1 }))
  const back = m.unpackTexture(s.closet[0].tex)
  const mask = m.maskFor('tee')
  back.px.forEach((c, i) => { if (!mask[i]) assert.equal(c, null) })
  assert.ok(s.closet[0].tex.pal.length <= m.MAX_DRAWN_COLORS)
})

test('the closet holds at most MAX_DRAWN, and a full save stays under 32 KB', () => {
  const rng = m.makeRng(7)
  let s = m.newSave(rng)
  while (s.figures.length < m.MAX_FIGURES) s = ok(m.addFigure(s, m.randomFigure(rng, `Figur ${s.figures.length + 1}`), rng))
  for (let i = 0; i < m.MAX_DRAWN; i++) {
    const d = drawnDress(s, rng, 24)
    s = ok(m.saveDrawn(s, { ...d, name: `Kjempefin kjole ${i + 1}`.slice(0, 20) }))
  }
  assert.equal(s.closet.length, m.MAX_DRAWN)
  assert.equal(m.saveDrawn(s, drawnDress(s, rng)), 'closet-full')
  // Every figure wears drawn pieces and every slot, to be as big as it gets.
  s = { ...s, figures: s.figures.map((f, i) => ({ ...f, name: `Figurnavn nr ${i + 1}`, outfit: {
    top: { id: s.closet[i].id }, bottom: { id: 'joggebukse', color: '#ffffff', color2: '#000000' },
    shoes: { id: 'gummistovler', color: '#ffffff', color2: '#000000' }, hat: { id: 'bursdagshatt', color: '#ffffff', color2: '#000000' },
    face: { id: 'stjernebriller', color: '#ffffff', color2: '#000000' }, back: { id: 'sommerfuglvinger', color: '#ffffff', color2: '#000000' },
  } })), savedAt: Date.now() }
  const json = JSON.stringify(s)
  assert.ok(json.length < 32_768, `the save is ${json.length} bytes`)
  assert.deepEqual(m.parseSave(json), s)
})

// ---------------------------------------------------------------- Pip

const base = () => m.newFigure('Ulrikke', m.makeRng(11))
const say = (text, fig = base()) => m.understand(text, fig, m.makeRng(12))

test('Pip understands what a seven-year-old types', () => {
  const cases = [
    ['jeg vil ha blått hår og rosa kjole', f => f.body.hairColor === '#4f9dff' && catalog.garment(f.outfit.top.id).kind === 'dress' && f.outfit.top.color === '#ff7eb6'],
    ['lag meg en ninja', f => f.outfit.top.color === '#22222b' && f.outfit.bottom.color === '#22222b'],
    ['grønne sko', f => f.outfit.shoes.id === 'joggesko' && f.outfit.shoes.color === '#3fbf5f'],
    ['langt lilla hår med fletter', f => f.body.hair === 'pigtails' && f.body.hairColor === '#a974ff'],
    ['krone og prinsessekjole', f => f.outfit.hat.id === 'krone' && f.outfit.top.id === 'prinsessekjole'],
    ['gul genser', f => f.outfit.top.id === 'genser' && f.outfit.top.color === '#ffd93b'],
    ['kattører', f => f.outfit.hat.id === 'kattorer'],
    ['stjerneøyne', f => f.body.eyes === 'star'],
    ['rosa kjole med hvite stjerner', f => f.outfit.top.id === 'stjernekjole' && f.outfit.top.color === '#ff7eb6' && f.outfit.top.color2 === '#ffffff'],
    ['rød og hvit stripete genser', f => f.outfit.top.id === 'stripegenser' && f.outfit.top.color === '#e8333d' && f.outfit.top.color2 === '#ffffff'],
    ['kjolen skal være rosa', f => f.outfit.top.id === 'prinsessekjole' && f.outfit.top.color === '#ff7eb6'],
    ['bla har og gronn kjole', f => f.body.hairColor === '#4f9dff' && f.outfit.top.color === '#3fbf5f'],
    ['blå hud og grønne øyne', f => f.body.skin === 'bla' && f.body.eyeColor === '#3f9f4f'],
    ['ta av buksa', f => f.outfit.bottom === null],
    ['uten sko', f => f.outfit.shoes === null],
    ['hestehale', f => f.body.hair === 'ponytail'],
    ['skallet', f => f.body.hair === 'none'],
    ['krøllete rødt hår', f => f.body.hair === 'curly' && f.body.hairColor === '#d9622b'],
    ['regnbuehår', f => f.body.hairColor === 'rainbow'],
    ['prinsese kjole', f => f.outfit.top.id === 'prinsessekjole'],
    ['genser med hjerter', f => f.outfit.top.id === 'hjertegenser'],
    ['glade øyne og tunge', f => f.body.eyes === 'happy' && f.body.mouth === 'tongue'],
    ['fregner og røde kinn', f => f.body.freckles && f.body.cheeks],
    ['jeg vil være en havfrue med rosa hår', f => f.outfit.top.id === 'glitterkjole' && f.body.hairColor === '#ff86c8'],
    ['svart caps og solbriller', f => f.outfit.hat.id === 'caps' && f.outfit.hat.color === '#22222b' && f.outfit.face.id === 'solbriller'],
    ['lyse blå t-skjorte', f => f.outfit.top.id === 'tskjorte' && f.outfit.top.color === '#9fd4ff'],
    ['englevinger', f => f.outfit.back.id === 'englevinger'],
    ['rosa!', f => f.outfit.top.id === 'tskjorte' && f.outfit.top.color === '#ff7eb6'],
  ]
  for (const [text, check] of cases) {
    const r = say(text)
    assert.ok(check(r.figure), `"${text}" → ${JSON.stringify(r.figure.outfit)} ${JSON.stringify(r.figure.body)}`)
    assert.ok(r.did.length > 0, `"${text}" says what it did`)
    assert.deepEqual(r.missed, [], `"${text}" missed ${r.missed}`)
    assert.ok(m.parseFigure(r.figure, []), `"${text}" gives a valid figure`)
  }
})

test("Pip's sentences are Norwegian and agree with the piece", () => {
  assert.deepEqual(say('jeg vil ha blått hår og rosa kjole').did, ['Nå har du blått hår.', 'Du har på deg en rosa prinsessekjole.'])
  assert.deepEqual(say('grønne sko').did, ['Du har på deg grønne joggesko.'])
  assert.deepEqual(say('rødt skjørt').did, ['Du har på deg et rødt skjørt.'])
  assert.deepEqual(say('langt lilla hår med fletter').did, ['Nå har du lilla hår med musefletter.'])
  assert.deepEqual(say('ingen briller').did, ['Nå har du ingen briller.'])
})

test("Pip lists words it does not know, keeps the figure's id, and says so when it understood nothing", () => {
  const f = base()
  const r = say('jeg vil ha en trampoline og en blå hatt', f)
  assert.deepEqual(r.missed, ['trampoline'])
  assert.equal(r.figure.outfit.hat.color, '#3a8dff')
  assert.equal(r.figure.id, f.id)
  assert.equal(r.figure.name, f.name)
  const none = say('hei hei', f)
  assert.deepEqual(none.did, [])
  assert.equal(none.figure, f)
  assert.equal(m.pipSay(none), m.PIP_HELP.nothing)
  assert.match(m.pipSay(r), /trampoline/)
  assert.equal(say('', f).figure, f)
})

test("Pip's ideas and surprises are whole, valid figures", () => {
  const f = base()
  for (let seed = 1; seed <= 30; seed++) {
    const idea = m.pipIdea(f, m.makeRng(seed))
    assert.ok(catalog.PIP_THEMES.some(t => t.line === idea.line))
    assert.ok(m.parseFigure(idea.figure, []))
    assert.equal(idea.figure.id, f.id)
    const s = m.pipSurprise(m.makeRng(seed), f)
    assert.ok(m.parseFigure(s.figure, []))
    assert.equal(s.figure.id, f.id)
    assert.equal(s.figure.name, f.name)
    assert.ok(s.line.length > 3)
  }
  assert.equal(m.PIP_HELP.draw.length, 3)
  assert.ok(m.PIP_HELP.greeting)
})

// ---------------------------------------------------------------- Neon Shrine

const FIELDS = ['skin', 'skinShade', 'hair', 'hairShade', 'band', 'top', 'topShade', 'topAccent', 'bottom', 'shoes']

test('heroColorsFor gives ten valid colours for any figure', () => {
  for (let seed = 1; seed <= 80; seed++) {
    const c = m.heroColorsFor(m.randomFigure(m.makeRng(seed)), [])
    assert.deepEqual(Object.keys(c).sort(), [...FIELDS].sort())
    for (const k of FIELDS) assert.match(c[k], HEX, `seed ${seed} ${k}`)
  }
})

test('heroColorsFor reads what is worn: top and stripe, skirt, hat band, bald and barefoot', () => {
  let f = m.newFigure('Hero', m.makeRng(9))
  f = m.wear(f, 'top', { id: 'stripegenser', color: '#1f3f9f', color2: '#ffffff' })
  f = m.wear(f, 'bottom', { id: 'leggings', color: '#e8333d' })
  f = m.wear(f, 'hat', { id: 'caps', color: '#3fbf5f' })
  let c = m.heroColorsFor(f, [])
  assert.equal(c.top, '#1f3f9f')
  assert.equal(c.topAccent, '#ffffff')
  assert.equal(c.bottom, '#e8333d')
  assert.equal(c.band, '#3fbf5f')
  assert.equal(c.hair, '#5e3a24')

  f = m.wear(m.wear(f, 'top', { id: 'sommerkjole', color: '#ffd93b' }), 'shoes', null)
  f = m.wear(f, 'hat', null)
  f = m.setBody(f, { hair: 'none' })
  c = m.heroColorsFor(f, [])
  assert.equal(c.bottom, '#ffd93b', "the dress's skirt is the trousers")
  assert.equal(c.hair, c.skin, 'bald: the head is skin')
  assert.equal(c.band, c.skin)
  assert.notEqual(c.shoes, c.bottom, 'barefoot: pale feet')

  f = m.setBody(f, { hair: 'long', hairColor: 'rainbow' })
  assert.equal(m.heroColorsFor(f, []).hair, '#ff6fb0')

  // A drawn top counts too.
  let t = m.clearTexture('tee')
  t = m.fillArea(t, 'tee', 7, 7, '#abcdef', false)
  const drawn = { id: 'd-hero0001', name: 'Min T-skjorte', kind: 'tee', tex: m.packTexture(t), createdAt: 1 }
  assert.equal(m.heroColorsFor(m.wear(f, 'top', { id: drawn.id }), [drawn]).top, '#abcdef')
})

test('writeHeroColors stores, removes, and stays quiet without storage', () => {
  const store = new Map()
  globalThis.localStorage = { setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k), getItem: k => store.get(k) ?? null }
  try {
    const f = m.newFigure('Hero', m.makeRng(10))
    m.writeHeroColors(f, [])
    assert.deepEqual(JSON.parse(store.get(m.FIGUR_HERO_KEY)), m.heroColorsFor(f, []))
    m.writeHeroColors(null, [])
    assert.equal(store.has(m.FIGUR_HERO_KEY), false)
  } finally {
    delete globalThis.localStorage
  }
  assert.doesNotThrow(() => m.writeHeroColors(m.newFigure('X', m.makeRng(1)), []))
})
