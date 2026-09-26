/**
 * How Pip reads (helper.ts has the rules in words): the lexicon built
 * from the catalog and words.ts, splitting a sentence into parts, and
 * the plan — which colours, patterns and styles belong to which thing.
 * Pure; helper.ts turns a plan into changes and sentences.
 */
import type { EyeStyle, HairStyle, MouthStyle, PatternId } from '../types'
import { GARMENTS, PIP_THEMES, type PipTheme } from '../catalog'
import {
  fold, COLOR_WORDS, HAIR_STYLE_WORDS, HAIR_NOUNS, EYE_NOUNS, EYE_STYLE_WORDS, MOUTH_NOUNS, MOUTH_WORDS,
  SKIN_NOUNS, CHEEK_WORDS, FRECKLE_WORDS, PATTERN_WORDS, NEG_WORDS, SURPRISE_WORDS, SPLIT_WORDS, STOP_WORDS,
  type ColorWord,
} from './words'

// ---------------------------------------------------------------- the lexicon

export type Meaning =
  | { k: 'color'; c: ColorWord }
  | { k: 'garment'; ids: string[] }
  | { k: 'hair' }
  | { k: 'hairstyle'; style: HairStyle; adj: boolean }
  | { k: 'eyes' }
  | { k: 'eyestyle'; style: EyeStyle; compound: boolean }
  | { k: 'mouthnoun' }
  | { k: 'mouth'; mouth: MouthStyle; alone: boolean }
  | { k: 'skin' }
  | { k: 'cheeks' }
  | { k: 'freckles' }
  | { k: 'pattern'; pattern: PatternId }
  | { k: 'theme'; theme: PipTheme }
  | { k: 'surprise' }
  | { k: 'neg' }

const LEX = new Map<string, Meaning[]>()
const add = (words: readonly string[], m: Meaning) => {
  for (const w of words) {
    const f = fold(w)
    const list = LEX.get(f) ?? []
    if (m.k === 'garment') {
      const g = list.find(x => x.k === 'garment') as { k: 'garment'; ids: string[] } | undefined
      if (g) { if (!g.ids.includes(m.ids[0]!)) g.ids.push(m.ids[0]!); continue }
      list.push({ k: 'garment', ids: [...m.ids] })
    } else if (!list.some(x => x.k === m.k)) list.push(m)
    LEX.set(f, list)
  }
}
for (const c of COLOR_WORDS) add(c.words, { k: 'color', c })
for (const g of GARMENTS) add([...g.words, g.name], { k: 'garment', ids: [g.id] })
add(HAIR_NOUNS, { k: 'hair' })
for (const h of HAIR_STYLE_WORDS) add(h.words, { k: 'hairstyle', style: h.style, adj: h.adj })
add(EYE_NOUNS, { k: 'eyes' })
for (const e of EYE_STYLE_WORDS) add(e.words, { k: 'eyestyle', style: e.style, compound: e.compound })
add(MOUTH_NOUNS, { k: 'mouthnoun' })
for (const m of MOUTH_WORDS) add(m.words, { k: 'mouth', mouth: m.mouth, alone: m.alone })
add(SKIN_NOUNS, { k: 'skin' })
add(CHEEK_WORDS, { k: 'cheeks' })
add(FRECKLE_WORDS, { k: 'freckles' })
for (const p of PATTERN_WORDS) add(p.words, { k: 'pattern', pattern: p.pattern })
for (const t of PIP_THEMES) add(t.words, { k: 'theme', theme: t })
add(NEG_WORDS, { k: 'neg' })
add(SURPRISE_WORDS, { k: 'surprise' })

const STOP = new Set(STOP_WORDS.map(fold))
const SPLIT = new Set(SPLIT_WORDS.map(fold))
const FUZZY_KEYS = [...LEX.keys()].filter(k => k.length >= 5)

/** At most one edit apart (insert, delete, change, or two letters swapped). */
function nearlySame(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (i === a.length && i === b.length) return true
  const ra = a.slice(i + 1)
  const rb = b.slice(i + 1)
  if (a.length === b.length) return ra === rb || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1)
}

/** The known word one letter off `f`, if any. */
function fuzzy(f: string): Meaning[] | null {
  const key = FUZZY_KEYS.find(k => nearlySame(f, k))
  return key ? LEX.get(key)! : null
}

function lookup(f: string): Meaning[] | null {
  const hit = LEX.get(f)
  if (hit) return hit
  if (STOP.has(f)) return []
  return f.length >= 5 ? fuzzy(f) : null
}

const NOUN_KINDS: ReadonlyArray<Meaning['k']> = ['garment', 'hair', 'eyes', 'skin', 'cheeks']

/** A colour word glued to a thing ("regnbuehår" → regnbue + hår), or null. */
function colorCompound(f: string): [{ f: string; m: Meaning[] }, { f: string; m: Meaning[] }] | null {
  for (let k = 3; k <= f.length - 3; k++) {
    const pre = LEX.get(f.slice(0, k))
    if (!pre?.some(m => m.k === 'color')) continue
    const sf = f.slice(k)
    const suf = sf === 'har' ? [{ k: 'hair' } as Meaning] : LEX.get(sf)
    if (suf?.some(m => NOUN_KINDS.includes(m.k))) return [{ f: f.slice(0, k), m: pre }, { f: sf, m: suf }]
  }
  return null
}

// ---------------------------------------------------------------- reading

export interface Tok { raw: string; f: string; m: Meaning[] }
export interface Part { toks: Tok[]; med: boolean }

const isColor = (t: Tok | undefined) => !!t?.m.some(m => m.k === 'color' || (m.k === 'hairstyle' && m.adj))

/** Split into parts and look every word up. Unknown words go to `missed`. */
export function read(text: string, missed: string[]): Part[] {
  const words = text.toLowerCase().replace(/[,.!?;:\n]+/g, ' , ').replace(/[^\p{L}\p{N}\s,-]/gu, ' ').split(/\s+/).filter(Boolean)
  const parts: Part[] = [{ toks: [], med: false }]
  const raws: string[][] = [[]]
  for (const w of words) {
    const f = fold(w)
    if (w === ',' || SPLIT.has(f)) {
      parts.push({ toks: [], med: f === 'med' })
      raws.push([])
    } else raws[raws.length - 1]!.push(w)
  }
  raws.forEach((ws, pi) => {
    const toks = parts[pi]!.toks
    for (let i = 0; i < ws.length; i++) {
      // Two words that are one known word together ("prinsesse kjole", even "prinsese kjole").
      if (i + 1 < ws.length) {
        const joined = fold(ws[i]! + ws[i + 1]!)
        const m = LEX.get(joined) ?? (joined.length >= 8 ? fuzzy(joined) : null)
        if (m) { toks.push({ raw: `${ws[i]} ${ws[i + 1]}`, f: joined, m }); i++; continue }
      }
      const raw = ws[i]!
      const f = fold(raw)
      const prev = toks[toks.length - 1]
      if (f === 'av' && i > 0 && fold(ws[i - 1]!) === 'ta') { toks.push({ raw, f, m: [{ k: 'neg' }] }); continue }
      // A colour glued to its thing: "regnbuehår", "rosakjole".
      const split = LEX.has(f) ? null : colorCompound(f)
      if (split) { toks.push({ raw, f: split[0].f, m: split[0].m }, { raw, f: split[1].f, m: split[1].m }); continue }
      // "har" is the verb, unless it is hair written without å: "blått har".
      if (f === 'har' && raw !== 'hår') {
        const last = i === ws.length - 1
        if (isColor(prev) || (last && toks.some(isColor))) toks.push({ raw, f, m: [{ k: 'hair' }] })
        continue
      }
      const m = lookup(f)
      if (m) { if (m.length) toks.push({ raw, f, m }); continue }
      if (/^\p{L}{3,}$/u.test(raw) && !missed.includes(raw)) missed.push(raw)
    }
  })
  return parts.filter(p => p.toks.length)
}

// ---------------------------------------------------------------- the plan

/** Something colours bind to. */
export interface Noun {
  k: 'garment' | 'hair' | 'eyes' | 'skin' | 'cheeks' | 'freckles' | 'pattern'
  i: number
  part: number
  colors: ColorWord[]
  neg: boolean
  ids?: string[]
  patterns: PatternId[]
  /** Colours for the pattern (color2). */
  patternColors: ColorWord[]
  pattern?: PatternId
  hairStyle?: HairStyle
  eyeStyle?: EyeStyle
}

const noun = (k: Noun['k'], i: number, part: number): Noun => ({ k, i, part, colors: [], neg: false, patterns: [], patternColors: [] })

export interface Plan {
  theme: PipTheme | null
  surprise: boolean
  nouns: Noun[]
  mouth: MouthStyle | null
}

export function plan(parts: Part[]): Plan {
  const out: Plan = { theme: null, surprise: false, nouns: [], mouth: null }
  const orphans: Array<{ part: number; colors: ColorWord[] }> = []
  const garmentsIn = (pi: number) => out.nouns.filter(n => n.part === pi && n.k === 'garment')

  parts.forEach((p, pi) => {
    const has = (k: Meaning['k']) => p.toks.some(t => t.m.some(m => m.k === k))
    const eyesHere = has('eyes') || p.toks.some(t => t.m.some(m => m.k === 'eyestyle' && m.compound))
    const mouthHere = has('mouthnoun')
    const garmentHere = has('garment')
    const hairHere = has('hair')
    const nouns: Noun[] = []
    const colors: Array<{ i: number; c: ColorWord }> = []
    const hairStyles: HairStyle[] = []
    const eyeStyles: EyeStyle[] = []
    let neg = false
    /** Patterns seen before the part's first piece ("stripete genser"). */
    const pending: PatternId[] = []

    p.toks.forEach((t, i) => {
      // One meaning per word, by what else the part holds.
      const m = t.m
      const get = <K extends Meaning['k']>(k: K) => m.find(x => x.k === k) as Extract<Meaning, { k: K }> | undefined
      const theme = get('theme')
      if (theme) { out.theme ??= theme.theme; return }
      if (get('surprise')) { out.surprise = true; return }
      if (get('neg')) { neg = true; return }
      const g = get('garment')
      if (g) { const n = noun('garment', i, pi); n.ids = g.ids; n.neg = neg; neg = false; nouns.push(n); return }
      const es = get('eyestyle')
      if (es && (es.compound || eyesHere)) {
        eyeStyles.push(es.style)
        if (es.compound) nouns.push(noun('eyes', i, pi))
        return
      }
      const mo = get('mouth')
      if (mo && (mo.alone || mouthHere)) { out.mouth = mo.mouth; return }
      if (get('mouthnoun')) return
      const c = get('color')
      if (c) { colors.push({ i, c: c.c }); return }
      const hs = get('hairstyle')
      if (hs) {
        if (!hs.adj || hairHere) hairStyles.push(hs.style)
        // A style word is the hair itself only when "hår" is not in the part ("blå fletter").
        if (!hs.adj && !hairHere) { const n = noun('hair', i, pi); n.neg = neg; neg = false; nouns.push(n) }
        return
      }
      if (get('hair')) { const n = noun('hair', i, pi); n.neg = neg; neg = false; nouns.push(n); return }
      if (get('eyes')) { nouns.push(noun('eyes', i, pi)); return }
      if (get('skin')) { nouns.push(noun('skin', i, pi)); return }
      if (get('cheeks')) { const n = noun('cheeks', i, pi); n.neg = neg; neg = false; nouns.push(n); return }
      if (get('freckles')) { const n = noun('freckles', i, pi); n.neg = neg; neg = false; nouns.push(n); return }
      const pat = get('pattern')
      if (pat) {
        // Next to a piece it describes the piece; alone it is a thing colours can go on.
        if (garmentHere) { const gn = nearestGarment(nouns, i); if (gn) gn.patterns.push(pat.pattern); else pending.push(pat.pattern) }
        else { const n = noun('pattern', i, pi); n.pattern = pat.pattern; nouns.push(n) }
      }
    })

    // Patterns that came before their piece in the same part.
    const firstG = nouns.find(n => n.k === 'garment')
    if (firstG) firstG.patterns.unshift(...pending)

    // Hair styles go on the part's hair noun (made if a style stood alone).
    if (hairStyles.length) {
      let h = nouns.find(n => n.k === 'hair')
      if (!h) { h = noun('hair', 0, pi); nouns.push(h) }
      h.hairStyle = hairStyles[hairStyles.length - 1]
    }
    if (eyeStyles.length) {
      let e = nouns.find(n => n.k === 'eyes')
      if (!e) { e = noun('eyes', 0, pi); nouns.push(e) }
      e.eyeStyle = eyeStyles[eyeStyles.length - 1]
    }

    // Colours: the next noun after, else the last one before.
    const lone: ColorWord[] = []
    for (const { i, c } of colors) {
      const target = nouns.filter(n => n.k !== 'freckles').sort((a, b) => a.i - b.i).find(n => n.i > i)
        ?? nouns.filter(n => n.k !== 'freckles' && n.i < i).sort((a, b) => b.i - a.i)[0]
      if (target) (target.k === 'pattern' ? target.patternColors : target.colors).push(c)
      else lone.push(c)
    }
    if (lone.length) orphans.push({ part: pi, colors: lone })

    // "hår med fletter": the style joins the hair before.
    if (p.med) {
      const prevHair = out.nouns.filter(n => n.part === pi - 1 && n.k === 'hair').at(-1)
      const hereHair = nouns.find(n => n.k === 'hair')
      if (prevHair && hereHair) {
        if (hereHair.hairStyle) prevHair.hairStyle = hereHair.hairStyle
        prevHair.colors.push(...hereHair.colors)
        prevHair.neg ||= hereHair.neg
        nouns.splice(nouns.indexOf(hereHair), 1)
      }
    }
    // A "med" part without a piece: its patterns go to the piece before.
    if (p.med && !garmentHere) {
      const prev = garmentsIn(pi - 1).at(-1)
      if (prev) {
        for (const n of nouns.filter(x => x.k === 'pattern')) {
          prev.patterns.push(n.pattern!)
          prev.patternColors.push(...n.patternColors)
        }
        nouns.splice(0, nouns.length, ...nouns.filter(x => x.k !== 'pattern'))
      }
    }
    out.nouns.push(...nouns)
  })

  // Colours with nothing in their part: to the next part's first noun if it starts
  // with a colour ("rød og hvit genser"), else to the previous part's last noun.
  for (const o of orphans) {
    const nextNoun = out.nouns.filter(n => n.part === o.part + 1).sort((a, b) => a.i - b.i)[0]
    const nextStartsWithColor = parts[o.part + 1]?.toks[0]?.m.some(m => m.k === 'color')
    const prevNoun = out.nouns.filter(n => n.part === o.part - 1).sort((a, b) => b.i - a.i)[0]
    const target = nextStartsWithColor && nextNoun ? nextNoun : prevNoun ?? nextNoun
    if (target) {
      if (target === nextNoun) target.colors.unshift(...o.colors)
      else (target.k === 'pattern' ? target.patternColors : target.colors).push(...o.colors)
    } else if (!out.nouns.length && !out.theme) {
      // Nothing to colour at all: the top.
      const n = noun('garment', 0, o.part)
      n.ids = []
      n.colors.push(...o.colors)
      out.nouns.push(n)
    }
  }
  return out
}

function nearestGarment(nouns: Noun[], i: number): Noun | undefined {
  return nouns.filter(n => n.k === 'garment' && n.i < i).sort((a, b) => b.i - a.i)[0]
}

