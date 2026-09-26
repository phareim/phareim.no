// Lag Din Figur's sheets: the four styles drawn with the real renderers.
// Bundled by sheet.mjs; `window.__sheet(section)` fills the page.
// Sections: lineup, themes, hair, faces-<style>, clothes-<style>, skin, drawn, sizes.
import { STYLES, frameFor, minecraftSkinFor } from '../../themes/figur/render/styles'
import { writeRGBA } from '../../themes/figur/render/pixels'
import { newFigure, randomFigure, makeRng, wear } from '../../themes/figur/core/figure'
import { applyTheme } from '../../themes/figur/core/helper'
import { packTexture, blankTexture } from '../../themes/figur/core/textures'
import { GARMENTS, PIP_THEMES, HAIR_STYLES, HAIR_COLORS, EYES, MOUTHS, SKINS } from '../../themes/figur/catalog'
import type { DrawnGarment, Figure, FigureStyle, GarmentKind, PixelBuffer, Texture } from '../../themes/figur/types'

const SCALE: Record<string, number> = { minecraft: 6, roblox: 4, toca: 3, avatar: 3 }
const css = `
body{margin:0;background:#2a2230;font:12px monospace;color:#f4eefc}
h2{margin:8px 10px 2px;font-size:14px}
.row{display:flex;flex-wrap:wrap;gap:6px;padding:4px 10px;align-items:flex-end}
.cell{display:flex;flex-direction:column;align-items:center;background:#3a3044;padding:3px}
.cell canvas{image-rendering:pixelated;display:block;background:repeating-conic-gradient(#555 0 25%,#444 0 50%) 0 0/16px 16px}
.cell span{max-width:220px;overflow:hidden;white-space:nowrap;font-size:10px}
.group{display:flex;gap:2px;background:#4a3f55;padding:3px}
`
const pose0 = { bob: 0, blink: false, cheer: 0 }

function page(title: string) {
  document.head.innerHTML = `<style>${css}</style>`
  document.body.innerHTML = `<h2>${title}</h2>`
}
function row(label?: string, parent: HTMLElement = document.body) {
  if (label) { const h = document.createElement('h2'); h.textContent = label; parent.appendChild(h) }
  const r = document.createElement('div'); r.className = 'row'; parent.appendChild(r); return r
}
function canvasOf(buf: PixelBuffer | Texture, scale: number, crop?: { y: number; h: number }): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = buf.w; c.height = buf.h
  const g = c.getContext('2d')!
  const img = g.createImageData(buf.w, buf.h)
  writeRGBA(buf as PixelBuffer, img.data)
  g.putImageData(img, 0, 0)
  if (!crop) { c.style.width = `${buf.w * scale}px`; c.style.height = `${buf.h * scale}px`; return c }
  const d = document.createElement('canvas')
  d.width = buf.w; d.height = crop.h
  d.getContext('2d')!.drawImage(c, 0, -crop.y)
  d.style.width = `${buf.w * scale}px`; d.style.height = `${crop.h * scale}px`
  return d
}
function cell(r: HTMLElement, canvas: HTMLCanvasElement, label: string) {
  const c = document.createElement('div'); c.className = 'cell'
  const s = document.createElement('span'); s.textContent = label
  c.append(canvas, s); r.appendChild(c)
}
const draw = (fig: Figure, s: FigureStyle, o: { closet?: DrawnGarment[]; backdrop?: boolean; pose?: typeof pose0; t?: number; w?: number; h?: number } = {}) =>
  frameFor(fig, o.closet ?? [], s, { t: o.t ?? 1.3, pose: o.pose ?? pose0, backdrop: o.backdrop ?? true, w: o.w, h: o.h })

/** One figure in all four styles, side by side. */
function group(r: HTMLElement, fig: Figure, label: string, o: Parameters<typeof draw>[2] = {}, scaleDiv = 1) {
  const g = document.createElement('div'); g.className = 'group'
  for (const s of STYLES) {
    const c = document.createElement('div'); c.className = 'cell'
    c.appendChild(canvasOf(draw(fig, s, o), SCALE[s.id]! / scaleDiv))
    g.appendChild(c)
  }
  const wrap = document.createElement('div'); wrap.className = 'cell'
  const s = document.createElement('span'); s.textContent = label
  wrap.append(g, s); r.appendChild(wrap)
}

const base = () => newFigure('Figur 1', makeRng(1))

// ---------------------------------------------------------------- drawn fixtures

function tex(kind: GarmentKind, paint: (x: number, y: number) => string | null): Texture {
  const t = blankTexture(kind)
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) t.px[y * t.w + x] = paint(x, y)
  return t
}
function drawn(id: string, name: string, kind: GarmentKind, t: Texture): DrawnGarment {
  return { id, name, kind, tex: packTexture(t), createdAt: 1 }
}
export function fixtures(): DrawnGarment[] {
  // A dress: pink top with a yellow belt, a blue skirt with white dots.
  const dress = tex('dress', (x, y) => {
    const arm = x <= 2 || x >= 13
    if (y < 14) { if (arm && y > 3) return null; if (y === 0 && x >= 6 && x <= 9) return null; return y === 12 || y === 13 ? '#ffd93b' : '#ff7eb6' }
    const widen = Math.min(2, Math.floor((y - 14) / 3))
    if (x < 3 - widen || x > 12 + widen) return null
    return (x + y) % 4 === 0 ? '#ffffff' : '#3a8dff'
  })
  // A hat: a green crown with red jewels, taller than the head.
  const hat = tex('hat', (x, y) => {
    if (y < 2 || y > 7 || x < 3 || x > 12) return null
    if (y < 4 && x % 3 !== 0) return null
    return y === 5 && x % 3 === 1 ? '#e8333d' : '#3fbf5f'
  })
  // A tee with a smiley.
  const tee = tex('tee', (x, y) => {
    const arm = x <= 2 || x >= 13
    if (arm && y >= 5) return null
    if (y === 0 && x >= 6 && x <= 9) return null
    if ((y === 4 && (x === 6 || x === 9)) || (y === 7 && x >= 6 && x <= 9) || (y === 6 && (x === 5 || x === 10))) return '#22222b'
    return '#ffd93b'
  })
  // Random-pixel trousers.
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const noisy = tex('pants', () => ['#e8333d', '#3fbf5f', '#3a8dff', '#ffd93b', '#9b5cff'][Math.floor(rnd() * 5)]!)
  const boots = tex('boot', (x, y) => (y === 3 ? '#22222b' : x % 2 ? '#ff3d9a' : '#ffc2dd'))
  return [
    drawn('d-dress001', 'Min kjole', 'dress', dress),
    drawn('d-hat00001', 'Min krone', 'hat', hat),
    drawn('d-tee00001', 'Smil', 'tee', tee),
    drawn('d-pants001', 'Prikker', 'pants', noisy),
    drawn('d-boots001', 'Støvler', 'boot', boots),
  ]
}

// ---------------------------------------------------------------- sections

const sections: Record<string, () => void> = {
  lineup() {
    page('lineup: default, six random figures (seeded), with idle bob / blink / cheer')
    const r = row()
    group(r, base(), 'default')
    const rng = makeRng(42)
    for (let i = 0; i < 6; i++) group(r, randomFigure(rng), `random ${i + 1}`)
    const r2 = row('poses (default): bob, blink, cheer 0.7, cheer 0.3')
    group(r2, base(), 'bob', { pose: { bob: 1, blink: false, cheer: 0 } })
    group(r2, base(), 'blink', { pose: { bob: 0, blink: true, cheer: 0 } })
    group(r2, base(), 'cheer .7', { pose: { bob: 0, blink: false, cheer: 0.7 } })
    group(r2, base(), 'cheer .3', { pose: { bob: 0, blink: false, cheer: 0.3 } })
  },
  themes() {
    page('Pip themes')
    const r = row()
    for (const th of PIP_THEMES) group(r, applyTheme(base(), th), th.name, {}, 1.5)
  },
  hair() {
    page('hair styles (colours vary; last row: skins)')
    for (const s of STYLES) {
      const r = row(s.id)
      HAIR_STYLES.forEach((h, i) => {
        const col = HAIR_COLORS[(i * 5 + 2) % HAIR_COLORS.length]!.color
        const f = base()
        const fig = { ...f, body: { ...f.body, hair: h.id, hairColor: col } }
        cell(r, canvasOf(draw(fig, s), SCALE[s.id]! * 0.8), `${h.id} ${col}`)
      })
    }
    for (const s of STYLES) {
      const r = row(`${s.id} skins`)
      SKINS.forEach((sk, i) => {
        const f = base()
        cell(r, canvasOf(draw({ ...f, body: { ...f.body, skin: sk.id, hair: HAIR_STYLES[i % 8]!.id } }, s, { backdrop: false }), SCALE[s.id]! * 0.6), sk.id)
      })
    }
  },
  skin() {
    page('Minecraft skins (64×64 at ×8)')
    const r = row()
    const rng = makeRng(42)
    const figs = [base(), randomFigure(rng), randomFigure(rng), applyTheme(base(), PIP_THEMES[0]!), applyTheme(base(), PIP_THEMES[4]!), applyTheme(base(), PIP_THEMES[10]!)]
    for (const f of figs) cell(r, canvasOf(minecraftSkinFor(f, []), 5), f.name)
  },
  drawn() {
    page('drawn fixtures on the default figure')
    const closet = fixtures()
    const r = row()
    for (const d of closet) {
      const slot = d.kind === 'dress' || d.kind === 'tee' ? 'top' : d.kind === 'hat' ? 'hat' : d.kind === 'boot' ? 'shoes' : 'bottom'
      group(r, wear(base(), slot, { id: d.id }), d.name, { closet })
    }
    let all = wear(base(), 'top', { id: 'd-tee00001' })
    all = wear(all, 'bottom', { id: 'd-pants001' })
    all = wear(all, 'shoes', { id: 'd-boots001' })
    all = wear(all, 'hat', { id: 'd-hat00001' })
    group(r, all, 'all drawn', { closet })
  },
  sizes() {
    page('wider and taller buffers, backdrop off')
    const r = row()
    for (const s of STYLES) {
      cell(r, canvasOf(draw(base(), s, { w: s.size.w + 30, h: s.size.h }), SCALE[s.id]! * 0.7), `${s.id} wide`)
      cell(r, canvasOf(draw(base(), s, { w: s.size.w, h: s.size.h + 20 }), SCALE[s.id]! * 0.7), `${s.id} tall`)
      cell(r, canvasOf(draw(base(), s, { backdrop: false }), SCALE[s.id]! * 0.7), `${s.id} no backdrop`)
    }
  },
}

for (const s of STYLES) {
  sections[`faces-${s.id}`] = () => {
    page(`faces in ${s.id}: rows eyes (last: blink), columns mouths`)
    const crop = { y: 0, h: Math.round(s.size.h * 0.55) }
    for (const e of [...EYES.map(e => e.id), 'blink']) {
      const r = row()
      for (const m of MOUTHS) {
        const f = base()
        const fig = { ...f, body: { ...f.body, eyes: e === 'blink' ? 'round' : e, mouth: m.id, freckles: m.id === 'grin' } } as Figure
        cell(r, canvasOf(draw(fig, s, { pose: { bob: 0, blink: e === 'blink', cheer: 0 } }), SCALE[s.id]! * 1.4, crop), `${e} ${m.id}`)
      }
    }
  }
  sections[`clothes-${s.id}`] = () => {
    page(`every garment in ${s.id}`)
    const r = row()
    for (const d of GARMENTS) {
      const slot = d.kind === 'dress' ? 'top' : (['tee', 'long', 'tank', 'hoodie', 'shirt'].includes(d.kind) ? 'top'
        : ['pants', 'shorts', 'skirt', 'leggings'].includes(d.kind) ? 'bottom'
          : ['sneaker', 'boot', 'flat'].includes(d.kind) ? 'shoes' : d.kind === 'hat' ? 'hat' : d.kind === 'glasses' ? 'face' : 'back')
      let f = wear(base(), slot as never, { id: d.id })
      if (slot === 'hat') f = { ...f, body: { ...f.body, hair: 'long' } }
      cell(r, canvasOf(draw(f, s), SCALE[s.id]! * 0.75), d.id)
    }
  }
}

;(window as unknown as { __sheet: (s: string) => void }).__sheet = (s: string) => {
  const fn = sections[s]
  if (!fn) throw new Error('unknown section ' + s)
  fn()
}
