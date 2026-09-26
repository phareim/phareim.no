/**
 * Lag Din Figur's save: a new save, a strict parser, and every action as
 * a pure function. An action returns a new save, or a `SaveError` string
 * when a rule says no; it never mutates its input and never stamps
 * `savedAt` (useFigur does, when it stores).
 *
 * Size: the profile slot takes 32 KB of JSON. A drawn piece keeps at most
 * MAX_DRAWN_COLORS colours (more are merged into the nearest, which a
 * child will hardly see), so 8 figures and 40 drawn dresses stay under it.
 */
import {
  MAX_FIGURES, MAX_DRAWN, KIND_SLOT, SLOTS,
  type DrawnGarment, type Figure, type FigurSave, type GarmentKind,
} from '../types'
import { newFigure, newId, parseFigure, cleanName, type Rng } from './figure'
import { isDrawableKind, unpackTexture, packTexture, applyMask, fitsKind, limitColors } from './textures'

export type SaveError =
  /** MAX_FIGURES figures already. */
  | 'full'
  /** MAX_DRAWN drawn pieces already. */
  | 'closet-full'
  | 'no-figure'
  /** The last figure cannot go: there is always one to dress. */
  | 'last-figure'
  | 'bad-figure'
  | 'bad-name'
  /** Not a drawable kind, or a texture that is not one. */
  | 'bad-garment'
  | 'no-garment'

export const isSaveError = (r: unknown): r is SaveError => typeof r === 'string'

/** Norwegian, for the child. */
export const SAVE_ERROR_TEXT: Record<SaveError, string> = {
  'full': `Du har allerede ${MAX_FIGURES} figurer. Slett en først.`,
  'closet-full': `Du har allerede ${MAX_DRAWN} klær. Slett noen først.`,
  'no-figure': 'Fant ikke figuren.',
  'last-figure': 'Du må ha minst én figur.',
  'bad-figure': 'Det gikk ikke.',
  'bad-name': 'Navnet kan ha 1 til 20 bokstaver.',
  'bad-garment': 'Det plagget gikk ikke å lagre.',
  'no-garment': 'Fant ikke plagget.',
}

export const MAX_DRAWN_COLORS = 16
export const MAX_DRAWN_NAME = 20
export const DRAWN_ID_RE = /^d-[a-z0-9]{8}$/

// ---------------------------------------------------------------- new and parse

/** One figure, active, an empty closet. */
export function newSave(rng: Rng = Math.random): FigurSave {
  const fig = newFigure('Figur 1', rng)
  return { v: 1, figures: [fig], active: fig.id, closet: [], savedAt: 0 }
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

/**
 * A drawn piece from a save, or null. Its texture is clipped to the
 * kind's mask and held to MAX_DRAWN_COLORS.
 */
export function parseDrawn(raw: unknown): DrawnGarment | null {
  if (!isObj(raw)) return null
  if (typeof raw.id !== 'string' || !DRAWN_ID_RE.test(raw.id)) return null
  const name = cleanName(raw.name, MAX_DRAWN_NAME)
  if (!name) return null
  if (!isDrawableKind(raw.kind)) return null
  const kind = raw.kind
  const tex = unpackTexture(raw.tex)
  if (!tex || !fitsKind(tex, kind)) return null
  const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) && raw.createdAt >= 0 ? Math.floor(raw.createdAt) : 0
  return { id: raw.id, name, kind, tex: packTexture(limitColors(applyMask(tex, kind), MAX_DRAWN_COLORS)), createdAt }
}

/**
 * A save from storage (object or JSON string), or null when it is not
 * one. Broken figures and drawn pieces are dropped, extras beyond the
 * limits cut, duplicates skipped; worn pieces missing from the closet
 * are taken off. An active id that is gone falls back to the first figure.
 */
export function parseSave(raw: unknown): FigurSave | null {
  let v = raw
  if (typeof v === 'string') { try { v = JSON.parse(v) } catch { return null } }
  if (!isObj(v) || v.v !== 1 || !Array.isArray(v.figures) || !Array.isArray(v.closet)) return null
  const closet: DrawnGarment[] = []
  for (const d of v.closet) {
    if (closet.length >= MAX_DRAWN) break
    const p = parseDrawn(d)
    if (p && !closet.some(c => c.id === p.id)) closet.push(p)
  }
  const figures: Figure[] = []
  for (const f of v.figures) {
    if (figures.length >= MAX_FIGURES) break
    const p = parseFigure(f, closet)
    if (p && !figures.some(x => x.id === p.id)) figures.push(p)
  }
  const active = figures.some(f => f.id === v.active) ? (v.active as string) : figures[0]?.id ?? ''
  const savedAt = typeof v.savedAt === 'number' && Number.isFinite(v.savedAt) && v.savedAt >= 0 ? Math.floor(v.savedAt) : 0
  return { v: 1, figures, active, closet, savedAt }
}

/** The figure on screen, or null when there is none. */
export function activeFigure(save: FigurSave): Figure | null {
  return save.figures.find(f => f.id === save.active) ?? save.figures[0] ?? null
}

// ---------------------------------------------------------------- figures

/** "Figur N" with the smallest N not taken. */
export function nextFigureName(save: FigurSave): string {
  const names = new Set(save.figures.map(f => f.name))
  for (let n = 1; ; n++) if (!names.has(`Figur ${n}`)) return `Figur ${n}`
}

/** Add a figure (a new default one without `fig`); it becomes active. */
export function addFigure(save: FigurSave, fig?: Figure, rng: Rng = Math.random): FigurSave | SaveError {
  if (save.figures.length >= MAX_FIGURES) return 'full'
  let next = fig ? parseFigure(fig, save.closet) : newFigure(nextFigureName(save), rng)
  if (!next) return 'bad-figure'
  if (save.figures.some(f => f.id === next!.id)) next = { ...next, id: newId('f-', rng, save.figures.map(f => f.id)) }
  return { ...save, figures: [...save.figures, next], active: next.id }
}

/** Remove a figure; the one after it (or before) becomes active if it was. */
export function removeFigure(save: FigurSave, id: string): FigurSave | SaveError {
  const i = save.figures.findIndex(f => f.id === id)
  if (i < 0) return 'no-figure'
  if (save.figures.length <= 1) return 'last-figure'
  const figures = save.figures.filter(f => f.id !== id)
  const active = save.active === id ? (figures[i] ?? figures[i - 1])!.id : save.active
  return { ...save, figures, active }
}

export function setActive(save: FigurSave, id: string): FigurSave | SaveError {
  if (!save.figures.some(f => f.id === id)) return 'no-figure'
  return save.active === id ? save : { ...save, active: id }
}

/** Replace a figure by id with `fig` (validated; its id is kept). */
export function updateFigure(save: FigurSave, id: string, fig: Figure): FigurSave | SaveError {
  const i = save.figures.findIndex(f => f.id === id)
  if (i < 0) return 'no-figure'
  const next = parseFigure({ ...fig, id }, save.closet)
  if (!next) return 'bad-figure'
  const figures = save.figures.slice()
  figures[i] = next
  return { ...save, figures }
}

// ---------------------------------------------------------------- drawn clothes

/** Take `id` off every figure wearing it. */
function undress(figures: Figure[], id: string): Figure[] {
  return figures.map(f => {
    if (!SLOTS.some(s => f.outfit[s]?.id === id)) return f
    const outfit = { ...f.outfit }
    for (const s of SLOTS) if (outfit[s]?.id === id) outfit[s] = null
    return { ...f, outfit }
  })
}

/**
 * Store a drawn piece: replaces the one with the same id, else adds it
 * (at most MAX_DRAWN). The texture must be the kind's size; it is
 * clipped to the mask and held to MAX_DRAWN_COLORS. If a replaced piece
 * changed slot, figures wearing it take it off.
 */
export function saveDrawn(save: FigurSave, drawn: DrawnGarment): FigurSave | SaveError {
  const name = cleanName(drawn?.name, MAX_DRAWN_NAME)
  if (!name) return 'bad-name'
  const clean = parseDrawn({ ...drawn, name })
  if (!clean) return 'bad-garment'
  const i = save.closet.findIndex(d => d.id === clean.id)
  if (i < 0) {
    if (save.closet.length >= MAX_DRAWN) return 'closet-full'
    return { ...save, closet: [...save.closet, clean] }
  }
  const closet = save.closet.slice()
  const old = closet[i]!
  closet[i] = clean
  const figures = KIND_SLOT[old.kind] === KIND_SLOT[clean.kind] ? save.figures : undress(save.figures, clean.id)
  return { ...save, closet, figures }
}

/** Delete a drawn piece; every figure wearing it takes it off. */
export function deleteDrawn(save: FigurSave, id: string): FigurSave | SaveError {
  if (!save.closet.some(d => d.id === id)) return 'no-garment'
  return { ...save, closet: save.closet.filter(d => d.id !== id), figures: undress(save.figures, id) }
}

export function renameDrawn(save: FigurSave, id: string, name: string): FigurSave | SaveError {
  const i = save.closet.findIndex(d => d.id === id)
  if (i < 0) return 'no-garment'
  const clean = cleanName(name, MAX_DRAWN_NAME)
  if (!clean) return 'bad-name'
  const closet = save.closet.slice()
  closet[i] = { ...closet[i]!, name: clean }
  return { ...save, closet }
}

/** A fresh id for a drawn piece, unique in the closet. */
export function newDrawnId(save: FigurSave, rng: Rng = Math.random): string {
  return newId('d-', rng, save.closet.map(d => d.id))
}

/** "Min kjole", "Mitt skjørt", "Mine sko": the possessive and noun per kind. */
const KIND_NOUN: Record<GarmentKind, [string, string]> = {
  tee: ['Min', 'T-skjorte'], long: ['Min', 'genser'], tank: ['Min', 'singlet'], hoodie: ['Min', 'hettegenser'],
  shirt: ['Min', 'skjorte'], dress: ['Min', 'kjole'], pants: ['Min', 'bukse'], shorts: ['Mine', 'shorts'],
  skirt: ['Mitt', 'skjørt'], leggings: ['Mine', 'leggings'], sneaker: ['Mine', 'sko'], boot: ['Mine', 'støvler'],
  flat: ['Mine', 'sko'], hat: ['Min', 'hatt'], glasses: ['Mine', 'briller'], cape: ['Min', 'kappe'], wings: ['Mine', 'vinger'],
}

/** The name a new drawn piece gets: "Min kjole", then "Min kjole 2", … (the smallest free number). */
export function nextDrawnName(save: FigurSave, kind: GarmentKind): string {
  const [my, noun] = KIND_NOUN[kind]
  const base = `${my} ${noun}`
  const names = new Set(save.closet.map(d => d.name))
  if (!names.has(base)) return base
  for (let n = 2; ; n++) if (!names.has(`${base} ${n}`)) return `${base} ${n}`
}
