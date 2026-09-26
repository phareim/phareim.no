/**
 * Pip, the helper: reads what a seven-year-old types in Norwegian and
 * dresses the figure. Nothing leaves the device.
 *
 * How it reads (words.ts has the vocabulary):
 *  1. Lower case, æøå optional ("bla" is "blå"), punctuation out. Two
 *     words that make a known word together are joined ("prinsesse
 *     kjole", "lyse blå", "stjerne øyne"). A long word one letter off a
 *     known one counts as it ("prinsesekjole").
 *  2. The text splits into parts at commas and at "og", "men", "så",
 *     "eller" and "med". A part that starts with "med" belongs to the
 *     part before it: "kjole med stjerner", "hår med fletter".
 *  3. A theme word ("ninja") dresses the whole figure first; the rest
 *     changes it after ("prinsesse med blått hår").
 *  4. In each part a colour belongs to the next thing after it ("blått
 *     hår"), else the last one before it ("kjolen skal være rosa").
 *     A part with only colours lends them to its neighbour: "rød og hvit
 *     genser" is a red sweater with white; "kjole som er rosa og hvit"
 *     the same. A lone colour with nothing to colour ("rosa!") colours
 *     the top. Two colours on one piece: the first is its colour, the
 *     second its trim or pattern.
 *  5. Pattern words pick the piece with that pattern: "genser med
 *     hjerter" is the heart sweater, "kjole med stjerner" the star dress;
 *     a colour on the pattern is the pattern's colour ("med hvite
 *     stjerner"). A pattern word with no piece anywhere changes the top
 *     to one with that pattern, if there is one. "Stjerner" next to
 *     "øyne" means star eyes instead.
 *  6. "ingen", "uten", "ikke", "ta av" before a piece take it off ("uten
 *     briller"); before hair it means bald.
 *  7. A generic word ("kjole", "sko", "hatt") keeps the piece worn if it
 *     is one; else the first in the catalog.
 *
 * `did` says what changed, in short sentences; `missed` lists words that
 * look like things Pip does not know.
 */
import type { EyeStyle, Figure, GarmentDef, HairStyle, Hex, PatternId, Slot, Worn } from '../types'
import { KIND_SLOT } from '../types'
import { GARMENTS, HAIR_COLORS, PIP_THEMES, garment, type PipTheme } from '../catalog'
import { emptyOutfit, pick, randomFigure, setBody, wear, type Rng } from './figure'
import { HAIR_ADJ, HAIR_STYLE_SAY, EYE_STYLE_SAY, MOUTH_SAY, SKIN_SAY, GARMENT_GENDER, type ColorWord } from './words'
import { read, plan, type Noun } from './reader'

export { fold } from './words'

export interface PipResult {
  figure: Figure
  /** What Pip did, one short sentence each. */
  did: string[]
  /** Words Pip did not know that look like things (as typed). */
  missed: string[]
}

// ---------------------------------------------------------------- doing it

function article(def: GarmentDef, color: ColorWord | null): string {
  const g = GARMENT_GENDER[def.id] ?? 'en'
  const name = def.name.startsWith('T-') ? def.name : def.name[0]!.toLowerCase() + def.name.slice(1)
  const adj = color ? color.forms[g === 'en' ? 0 : g === 'et' ? 1 : 2] + ' ' : ''
  return g === 'pl' ? `${adj}${name}` : `${g} ${adj}${name}`
}

const OFF: Record<Slot, string> = {
  top: 'Nå har du ingen topp.', bottom: 'Nå har du ingen bukse.', shoes: 'Nå er du barbeint.',
  hat: 'Nå har du ingenting på hodet.', face: 'Nå har du ingen briller.', back: 'Nå har du ingenting på ryggen.',
}

/** Which built-in piece a garment noun means, given what is worn and the patterns asked for. */
function chooseGarment(n: Noun, fig: Figure): GarmentDef | null {
  let cands = (n.ids ?? []).map(garment).filter((d): d is GarmentDef => !!d)
  if (!cands.length) {
    // A lone colour: the top worn, or a T-skjorte.
    const worn = fig.outfit.top && garment(fig.outfit.top.id)
    cands = [worn || garment('tskjorte')!]
  }
  const wornId = fig.outfit[KIND_SLOT[cands[0]!.kind]]?.id
  const wantRainbow = n.colors.some(c => c.id === 'regnbue')
  const want = n.patterns.at(-1) ?? (wantRainbow ? 'rainbow' : null)
  if (want) {
    const withPattern = cands.filter(d => d.pattern === want)
    if (withPattern.length) return withPattern.find(d => d.id === wornId) ?? withPattern[0]!
  }
  return cands.find(d => d.id === wornId) ?? cands[0]!
}

/** A lone pattern word: the top (same kind family if possible) with that pattern. */
function topWithPattern(fig: Figure, pattern: PatternId): GarmentDef | null {
  const worn = fig.outfit.top ? garment(fig.outfit.top.id) : undefined
  const tops = GARMENTS.filter(d => KIND_SLOT[d.kind] === 'top' && d.pattern === pattern)
  const sameFamily = tops.filter(d => (d.kind === 'dress') === (worn?.kind === 'dress'))
  return sameFamily[0] ?? tops[0] ?? null
}

/** Put a theme on: its body changes and its outfit (every slot it leaves out is emptied). */
export function applyTheme(fig: Figure, theme: PipTheme): Figure {
  let next = setBody(fig, theme.body ?? {})
  next = { ...next, outfit: emptyOutfit() }
  for (const [slot, w] of Object.entries(theme.outfit) as Array<[Slot, Worn | null]>) next = wear(next, slot, w)
  return next
}

function hairSentence(style: HairStyle | undefined, colorId: string | undefined): string | null {
  if (style === 'none') return 'Nå er du skallet.'
  const say = style ? HAIR_STYLE_SAY[style] : {}
  const rainbow = colorId === 'regnbue'
  const colorAdj = colorId && !rainbow ? HAIR_ADJ[colorId] : undefined
  const base = rainbow ? 'regnbuehår' : colorAdj ? `${colorAdj} hår` : null
  if (say.noun) return base ? `Nå har du ${base} med ${say.noun}.` : `Nå har du ${say.noun}.`
  if (say.adj) return `Nå har du ${say.adj}${base ? (rainbow ? ' ' : ', ') + base : ' hår'}.`
  return base ? `Nå har du ${base}.` : null
}

function eyeSentence(style: EyeStyle | undefined, color: ColorWord | undefined): string | null {
  const colorPl = color?.eye ? color.forms[2] : null
  if (style === 'wink') return colorPl ? `Nå blunker du med ${colorPl} øyne.` : 'Nå blunker du.'
  const say = style ? EYE_STYLE_SAY[style] : {}
  if (say.compound) return `Nå har du ${colorPl ? colorPl + ' ' : ''}${say.compound}.`
  if (say.adj) return `Nå har du ${say.adj}${colorPl ? ', ' + colorPl : ''} øyne.`
  return colorPl ? `Nå har du ${colorPl} øyne.` : null
}

/**
 * Read `text` and dress `figure` by it. The figure keeps its id, name
 * and style. `rng` only matters for "overrask meg".
 */
export function understand(text: string, figure: Figure, rng: Rng = Math.random): PipResult {
  const missed: string[] = []
  const parts = read(typeof text === 'string' ? text.slice(0, 300) : '', missed)
  const p = plan(parts)
  const did: string[] = []
  let fig = figure

  if (p.surprise) {
    const s = pipSurprise(rng, fig)
    fig = s.figure
    did.push(s.line)
  }
  if (p.theme) {
    fig = applyTheme(fig, p.theme)
    did.push(p.theme.line)
  }

  for (const n of p.nouns) {
    if (n.k === 'hair') {
      const color = n.colors.filter(c => c.hair).at(-1)
      const style: HairStyle | undefined = n.neg ? 'none' : n.hairStyle
      const patch: { hair?: HairStyle; hairColor?: Hex | 'rainbow' } = {}
      if (style) patch.hair = style
      const hc = color ? HAIR_COLORS.find(h => h.id === color.hair) : undefined
      if (hc && style !== 'none') patch.hairColor = hc.color
      if (patch.hair || patch.hairColor) {
        fig = setBody(fig, patch)
        const line = hairSentence(patch.hair, patch.hairColor ? hc!.id : undefined)
        if (line) did.push(line)
      }
    } else if (n.k === 'eyes') {
      const color = n.colors.filter(c => c.eye).at(-1)
      const patch: { eyes?: EyeStyle; eyeColor?: Hex } = {}
      if (n.eyeStyle) patch.eyes = n.eyeStyle
      if (color?.eye) patch.eyeColor = color.eye
      if (patch.eyes || patch.eyeColor) {
        fig = setBody(fig, patch)
        const line = eyeSentence(n.eyeStyle, color)
        if (line) did.push(line)
      }
    } else if (n.k === 'skin') {
      const skin = n.colors.map(c => c.skin).filter(Boolean).at(-1)
      if (skin) { fig = setBody(fig, { skin }); did.push(`Nå har du ${SKIN_SAY[skin]}.`) }
    } else if (n.k === 'cheeks') {
      fig = setBody(fig, { cheeks: !n.neg })
      did.push(n.neg ? 'Nå har du ikke røde kinn.' : 'Nå har du røde kinn.')
    } else if (n.k === 'freckles') {
      fig = setBody(fig, { freckles: !n.neg })
      did.push(n.neg ? 'Nå har du ingen fregner.' : 'Nå har du fregner.')
    } else if (n.k === 'pattern') {
      const def = topWithPattern(fig, n.pattern!)
      if (!def) continue
      const c2 = n.patternColors.find(c => c.hex)?.hex
      fig = wear(fig, 'top', { id: def.id, ...(c2 ? { color2: c2 } : {}) })
      did.push(`Du har på deg ${article(def, null)}.`)
    } else if (n.k === 'garment') {
      const def = chooseGarment(n, fig)
      if (!def) continue
      const slot = KIND_SLOT[def.kind]
      if (n.neg) {
        fig = wear(fig, slot, null)
        did.push(OFF[slot])
        continue
      }
      const colors = n.colors.filter(c => c.hex && c.id !== 'regnbue')
      const worn = fig.outfit[slot]
      const same = worn?.id === def.id
      const main = colors[0]?.hex ?? (same ? worn?.color : undefined)
      const second = colors[1]?.hex ?? n.patternColors.find(c => c.hex)?.hex ?? (same ? worn?.color2 : undefined)
      fig = wear(fig, slot, { id: def.id, ...(main ? { color: main } : {}), ...(second ? { color2: second } : {}) })
      did.push(`Du har på deg ${article(def, colors[0] ?? null)}.`)
    }
  }
  if (p.mouth) {
    fig = setBody(fig, { mouth: p.mouth })
    did.push(MOUTH_SAY[p.mouth])
  }
  return { figure: fig, did: [...new Set(did)], missed }
}

// ---------------------------------------------------------------- Pip's buttons

/** "Gi meg en idé": a theme on the figure, and its line. Avoids the theme already worn. */
export function pipIdea(figure: Figure, rng: Rng = Math.random): { figure: Figure; line: string } {
  const fresh = PIP_THEMES.filter(t => t.outfit.top?.id !== figure.outfit.top?.id || t.outfit.hat?.id !== figure.outfit.hat?.id)
  const theme = pick(rng, fresh.length ? fresh : PIP_THEMES)
  return { figure: applyTheme(figure, theme), line: theme.line }
}

const SURPRISE_LINES = [
  'Her er en helt ny figur!',
  'Ta-da! Hva synes du?',
  'Se her! Fargene passer sammen.',
  'Jeg lagde en til deg!',
]

/** "Lag en figur til meg!": a whole random figure that goes together. Keeps `base`'s id, name and style. */
export function pipSurprise(rng: Rng = Math.random, base?: Figure): { figure: Figure; line: string } {
  const f = randomFigure(rng, base?.name)
  const figure = base ? { ...f, id: base.id, name: base.name, style: base.style } : f
  return { figure, line: pick(rng, SURPRISE_LINES) }
}

/** Pip's fixed lines. */
export const PIP_HELP = {
  greeting: 'Hei! Jeg er Pip. Hva vil du lage?',
  buttons: {
    make: 'Lag en figur til meg!',
    idea: 'Gi meg en idé',
    draw: 'Hvordan tegner jeg klær?',
    write: 'Skriv hva du vil ha',
  },
  draw: [
    'Trykk TEGN og velg hva du vil lage.',
    'Trykk på rutene for å male. SPEIL maler begge sider.',
    'Trykk LAGRE. Da finner du det i Mine klær.',
  ],
  write: 'Skriv hva du vil ha! For eksempel: blått hår og rosa kjole.',
  nothing: 'Hmm, det skjønte jeg ikke. Prøv: rosa kjole og kattører.',
}

/** One reply for the speech box: what Pip did, and the words it did not know. */
export function pipSay(r: PipResult): string {
  const lines = [...r.did]
  if (r.missed.length) {
    const words = r.missed.slice(0, 3).map(w => `«${w}»`).join(', ')
    lines.push(r.missed.length === 1 ? `Ordet ${words} kjenner jeg ikke.` : `Disse ordene kjenner jeg ikke: ${words}.`)
  }
  return lines.length ? lines.join(' ') : PIP_HELP.nothing
}
