/**
 * Pip's vocabulary (core/helper.ts reads with it): colour words with the
 * forms a sentence needs, body words, pattern words, and the small words
 * Pip skips. Every key is written the way a child types it; `fold`
 * (below) makes æøå optional, so "bla", "blå" and "blaa" are one word.
 */
import type { EyeStyle, HairStyle, Hex, MouthStyle, PatternId, SkinId } from '../types'

/** Lower case, æ → ae, ø → o, å → a (and aa → a), accents off, hyphens out. */
export function fold(word: string): string {
  return word.toLowerCase().normalize('NFC')
    .replace(/æ/g, 'ae').replace(/[øö]/g, 'o').replace(/[åä]/g, 'a').replace(/aa/g, 'a')
    .replace(/[éèê]/g, 'e').replace(/ü/g, 'u')
    .replace(/[-']/g, '')
}

export interface ColorWord {
  id: string
  /** For a garment; null: this word does not colour clothes ("lys", "mørk"). */
  hex: Hex | null
  /** Adjective forms for sentences: [en-word, et-word, plural]. */
  forms: [string, string, string]
  /** HAIR_COLORS id, if hair can take it. */
  hair: string | null
  /** Eye colour, if eyes can take it. */
  eye: Hex | null
  /** Skin, if skin can take it. */
  skin: SkinId | null
  words: string[]
}

const c = (id: string, hex: Hex | null, forms: [string, string, string], hair: string | null, eye: Hex | null, skin: SkinId | null, words: string[]): ColorWord =>
  ({ id, hex, forms, hair, eye, skin, words })

export const COLOR_WORDS: ColorWord[] = [
  c('lysebla', '#9fd4ff', ['lyseblå', 'lyseblått', 'lyseblå'], 'bla', '#3a7bd5', 'bla', ['lyseblå', 'lyseblått', 'lyseblåe', 'himmelblå', 'himmelblått', 'babyblå']),
  c('morkebla', '#1f3f9f', ['mørkeblå', 'mørkeblått', 'mørkeblå'], 'bla', '#3a7bd5', 'bla', ['mørkeblå', 'mørkeblått', 'mørkeblåe', 'marineblå', 'marineblått', 'navy']),
  c('bla', '#3a8dff', ['blå', 'blått', 'blå'], 'bla', '#3a7bd5', 'bla', ['blå', 'blått', 'blåe', 'blåa', 'blue', 'blåfarget', 'blått', 'blaat', 'blot']),
  c('morkerod', '#a3202d', ['mørkerød', 'mørkerødt', 'mørkerøde'], 'rod', '#a3202d', null, ['mørkerød', 'mørkerødt', 'mørkerøde', 'vinrød', 'vinrødt', 'vinrøde']),
  c('rod', '#e8333d', ['rød', 'rødt', 'røde'], 'rod', '#e8333d', null, ['rød', 'rødt', 'røde', 'rødfarget', 'red', 'raud', 'raudt', 'raude', 'rod']),
  c('lyserosa', '#ffc2dd', ['lyserosa', 'lyserosa', 'lyserosa'], 'rosa', '#e0569a', 'porselen', ['lyserosa', 'babyrosa']),
  c('knallrosa', '#ff3d9a', ['knallrosa', 'knallrosa', 'knallrosa'], 'rosa', '#e0569a', null, ['knallrosa', 'cerise', 'fuchsia', 'magenta']),
  c('rosa', '#ff7eb6', ['rosa', 'rosa', 'rosa'], 'rosa', '#e0569a', 'porselen', ['rosa', 'rossa', 'roza', 'rosafarget', 'pink', 'rosarød']),
  c('lyselilla', '#d6b3ff', ['lyselilla', 'lyselilla', 'lyselilla'], 'lilla', '#8a4fd6', 'lilla', ['lyselilla', 'lavendel', 'syrin']),
  c('lilla', '#9b5cff', ['lilla', 'lilla', 'lilla'], 'lilla', '#8a4fd6', 'lilla', ['lilla', 'lila', 'lillla', 'fiolett', 'fiolette', 'purpur', 'lillafarget', 'purple']),
  c('oransje', '#ff8a2a', ['oransje', 'oransje', 'oransje'], 'rod', '#9a6b2f', 'honning', ['oransje', 'oransj', 'oranje', 'orange', 'oransjefarget']),
  c('gull', '#e0a92a', ['gyllen', 'gyllent', 'gylne'], 'blond', '#9a6b2f', 'honning', ['gull', 'gyllen', 'gyllent', 'gylne', 'gullfarget', 'gullfarga', 'gold']),
  c('gul', '#ffd93b', ['gul', 'gult', 'gule'], 'blond', '#9a6b2f', 'honning', ['gul', 'gult', 'gule', 'gulfarget', 'yellow']),
  c('solv', '#c9c9d6', ['sølvfarget', 'sølvfarget', 'sølvfargede'], 'hvit', '#7d8a99', null, ['sølv', 'sølvfarget', 'sølvfarga', 'sølvete', 'silver']),
  c('lysegronn', '#a4e86b', ['lysegrønn', 'lysegrønt', 'lysegrønne'], 'gronn', '#3f9f4f', 'gronn', ['lysegrønn', 'lysegrønt', 'lysegrønne', 'lime', 'limegrønn', 'eplegrønn']),
  c('morkegronn', '#1f7a4a', ['mørkegrønn', 'mørkegrønt', 'mørkegrønne'], 'gronn', '#3f9f4f', 'gronn', ['mørkegrønn', 'mørkegrønt', 'mørkegrønne', 'skoggrønn']),
  c('gronn', '#3fbf5f', ['grønn', 'grønt', 'grønne'], 'gronn', '#3f9f4f', 'gronn', ['grønn', 'grønt', 'grønne', 'grøn', 'grønnt', 'green', 'grønnfarget']),
  c('turkis', '#3fd6cf', ['turkis', 'turkis', 'turkise'], 'turkis', '#3f9f4f', 'bla', ['turkis', 'turkist', 'turkise', 'turkois', 'mint', 'mintgrønn']),
  c('svart', '#22222b', ['svart', 'svart', 'svarte'], 'svart', '#22222b', 'mork', ['svart', 'svarte', 'sort', 'sorte', 'svat', 'black']),
  c('hvit', '#ffffff', ['hvit', 'hvitt', 'hvite'], 'hvit', '#7d8a99', 'porselen', ['hvit', 'hvitt', 'hvite', 'kvit', 'kvitt', 'kvite', 'vit', 'white', 'snøhvit']),
  c('lysegra', '#c9c9d6', ['lysegrå', 'lysegrått', 'lysegrå'], 'hvit', '#7d8a99', null, ['lysegrå', 'lysegrått']),
  c('gra', '#7d7d8f', ['grå', 'grått', 'grå'], 'hvit', '#7d8a99', null, ['grå', 'grått', 'gråe', 'grey', 'gray']),
  c('lysebrun', '#c68a5c', ['lysebrun', 'lysebrunt', 'lysebrune'], 'lysebrun', '#9a6b2f', 'oliven', ['lysebrun', 'lysebrunt', 'lysebrune', 'beige']),
  c('brun', '#7a4a2c', ['brun', 'brunt', 'brune'], 'brun', '#6b3f24', 'brun', ['brun', 'brunt', 'brune', 'brown', 'sjokolade']),
  c('blond', '#ffd93b', ['blond', 'blondt', 'blonde'], 'blond', null, null, ['blond', 'blondt', 'blonde', 'blondine']),
  c('regnbue', null, ['regnbuefarget', 'regnbuefarget', 'regnbuefargede'], 'regnbue', null, null, ['regnbue', 'regnbuefarget', 'regnbuefarga', 'regnbuefargede', 'regnbuer', 'regnbuefarger', 'rainbow']),
  // Light and dark: hair and skin only.
  c('lys', null, ['lys', 'lyst', 'lyse'], 'blond', null, 'lys', ['lys', 'lyst', 'lyse']),
  c('mork', null, ['mørk', 'mørkt', 'mørke'], 'brun', '#6b3f24', 'mork', ['mørk', 'mørkt', 'mørke']),
]

/** Hair colour ids → the neuter adjective ("blått hår"). Rainbow is "regnbuehår". */
export const HAIR_ADJ: Record<string, string> = {
  blond: 'blondt', lysebrun: 'lysebrunt', brun: 'brunt', svart: 'svart', rod: 'rødt', rosa: 'rosa',
  bla: 'blått', lilla: 'lilla', gronn: 'grønt', turkis: 'turkis', hvit: 'hvitt',
}

/** Hair styles: adjectives go with "hår" ("langt hår"); nouns stand alone ("hestehale"). */
export const HAIR_STYLE_WORDS: Array<{ style: HairStyle; adj: boolean; words: string[] }> = [
  { style: 'long', adj: true, words: ['lang', 'langt', 'lange', 'langhåret', 'langhåra'] },
  { style: 'short', adj: true, words: ['kort', 'korte', 'korthåret', 'kortklipt'] },
  { style: 'curly', adj: false, words: ['krøller', 'krøllete', 'krøllet', 'krølla', 'krølle', 'krølletopp', 'krøllhår'] },
  { style: 'spiky', adj: false, words: ['piggsveis', 'piggete', 'pigger', 'piggsveisen', 'spiky'] },
  { style: 'ponytail', adj: false, words: ['hestehale', 'hestehalen', 'hestehaler', 'hestehala', 'hestehalle', 'rumpetroll'] },
  { style: 'pigtails', adj: false, words: ['fletter', 'flette', 'fletta', 'flettene', 'musefletter', 'musefletta', 'musefletten', 'museflette', 'flettet'] },
  { style: 'bun', adj: false, words: ['knute', 'knuten', 'topknute', 'topknuten', 'hårknute', 'bolle', 'dansebolle'] },
  { style: 'afro', adj: false, words: ['afro', 'afroen', 'afrohår'] },
  { style: 'none', adj: false, words: ['skallet', 'skallete', 'snauklipt', 'hårløs'] },
]

/** What a hair style is called in Pip's sentences. */
export const HAIR_STYLE_SAY: Record<HairStyle, { adj?: string; noun?: string }> = {
  short: { adj: 'kort' }, long: { adj: 'langt' }, curly: { adj: 'krøllete' }, spiky: { adj: 'piggete' },
  ponytail: { noun: 'hestehale' }, pigtails: { noun: 'musefletter' }, bun: { noun: 'knute' }, afro: { noun: 'afro' }, none: {},
}

export const HAIR_NOUNS = ['hår', 'håret', 'hårr', 'håre', 'haaret', 'frisyre', 'frisyren', 'sveis', 'sveisen', 'hårfarge', 'hårfargen', 'hair']

export const EYE_NOUNS = ['øyne', 'øynene', 'øyner', 'øyene', 'øye', 'øyet', 'øya', 'auge', 'augo', 'augene', 'eyes']
/** Eye style words; `compound` ones mean the eyes themselves ("stjerneøyne"), the others need "øyne". */
export const EYE_STYLE_WORDS: Array<{ style: EyeStyle; compound: boolean; words: string[] }> = [
  { style: 'star', compound: true, words: ['stjerneøyne', 'stjerneøye', 'stjerneøynene'] },
  { style: 'sparkle', compound: true, words: ['glitreøyne', 'glitterøyne', 'glitreøye', 'glitterøye'] },
  { style: 'sparkle', compound: false, words: ['glitrende', 'glitrete', 'skinnende', 'blanke'] },
  { style: 'happy', compound: false, words: ['glade', 'glad', 'blide', 'blid'] },
  { style: 'sleepy', compound: false, words: ['søvnige', 'søvnig', 'trøtte', 'trøtt', 'trøtta'] },
  { style: 'round', compound: false, words: ['runde', 'rund', 'store', 'normale', 'vanlige'] },
  { style: 'wink', compound: true, words: ['blunk', 'blunke', 'blunker', 'blunking', 'blinke', 'blunkeøye'] },
  { style: 'star', compound: false, words: ['stjerne', 'stjerner', 'stjernete'] },
]
export const EYE_STYLE_SAY: Record<EyeStyle, { adj?: string; compound?: string }> = {
  round: { adj: 'runde' }, happy: { adj: 'glade' }, sleepy: { adj: 'søvnige' },
  sparkle: { compound: 'glitreøyne' }, star: { compound: 'stjerneøyne' }, wink: {},
}

export const MOUTH_NOUNS = ['munn', 'munnen', 'munnene', 'lepper', 'leppene']
/** Mouth words; `alone` ones need no "munn" ("smil", "tunge"). */
export const MOUTH_WORDS: Array<{ mouth: MouthStyle; alone: boolean; words: string[] }> = [
  { mouth: 'grin', alone: true, words: ['stortsmil', 'glis', 'glisende', 'flir', 'kjempesmil'] },
  { mouth: 'smile', alone: true, words: ['smil', 'smilet', 'smile', 'smiler', 'smilende', 'smilefjes'] },
  { mouth: 'tongue', alone: true, words: ['tunge', 'tunga', 'tungen', 'rekketunge', 'tungeut'] },
  { mouth: 'open', alone: false, words: ['åpen', 'åpne', 'åpent', 'overrasket'] },
  { mouth: 'small', alone: false, words: ['liten', 'lita', 'lille', 'små'] },
  { mouth: 'grin', alone: false, words: ['glad', 'blid', 'stor'] },
]
export const MOUTH_SAY: Record<MouthStyle, string> = {
  smile: 'Nå smiler du.', grin: 'Nå har du et stort smil.', open: 'Nå har du åpen munn.',
  tongue: 'Nå rekker du tunge!', small: 'Nå har du en liten munn.',
}

export const SKIN_NOUNS = ['hud', 'huden', 'hudfarge', 'hudfargen', 'skinn', 'skinnet', 'kropp', 'kroppen', 'skin']
export const SKIN_SAY: Record<SkinId, string> = {
  porselen: 'veldig lys hud', lys: 'lys hud', honning: 'gyllen hud', oliven: 'olivenfarget hud', brun: 'brun hud',
  mork: 'mørk hud', bla: 'blå hud', gronn: 'grønn hud', lilla: 'lilla hud',
}

export const CHEEK_WORDS = ['kinn', 'kinnene', 'kinna', 'rødmende']
export const FRECKLE_WORDS = ['fregner', 'fregnene', 'fregne', 'fregnete', 'fregnet', 'fregnar']

/** Pattern words: a piece with this pattern ("kjole med stjerner"). */
export const PATTERN_WORDS: Array<{ pattern: PatternId; words: string[] }> = [
  { pattern: 'stripes', words: ['striper', 'stripete', 'stripa', 'stripet', 'stripe', 'stripene'] },
  { pattern: 'dots', words: ['prikker', 'prikkete', 'prikket', 'prikk', 'prikkene', 'prikka'] },
  { pattern: 'heart', words: ['hjerte', 'hjerter', 'hjertet', 'hjertene', 'hjerta'] },
  { pattern: 'star', words: ['stjerne', 'stjerner', 'stjernen', 'stjernene', 'stjerna', 'stjernete'] },
  { pattern: 'sparkle', words: ['glitter', 'glitrende', 'glitrete', 'glitra', 'paljetter', 'glans'] },
  { pattern: 'check', words: ['rutete', 'ruter', 'rutet', 'ruta'] },
]

/** Words that take something off: "ingen hatt", "uten briller", "ta av lua". */
export const NEG_WORDS = ['ingen', 'ikke', 'uten', 'fjern', 'fjerne', 'ingenting', 'intet']

/** Pip makes a whole new figure for these. */
export const SURPRISE_WORDS = ['overrask', 'overraske', 'overraskelse', 'tilfeldig', 'tilfeldige', 'hvasomhelst', 'random']

/** Words that split a sentence into parts; 'med' ties its part to the one before. */
export const SPLIT_WORDS = ['og', 'men', 'så', 'eller', 'pluss', 'med']

/** Small words Pip skips without reporting them. */
export const STOP_WORDS = [
  'jeg', 'eg', 'je', 'vil', 'ville', 'ha', 'hun', 'han', 'hen', 'den', 'det', 'de', 'du', 'dere', 'vi', 'meg', 'deg', 'seg', 'oss',
  'min', 'mi', 'mitt', 'mine', 'din', 'di', 'ditt', 'dine', 'sin', 'si', 'sitt', 'sine', 'en', 'et', 'ei', 'som', 'er', 'var', 'være',
  'bli', 'blir', 'ble', 'skal', 'skulle', 'kan', 'kunne', 'må', 'gjerne', 'lag', 'lage', 'lager', 'laget', 'gi', 'gir', 'sett', 'sette',
  'setter', 'på', 'i', 'til', 'fra', 'av', 'å', 'også', 'bare', 'litt', 'veldig', 'kjempe', 'masse', 'mye', 'mange', 'store', 'stort',
  'ny', 'nytt', 'nye', 'nå', 'hei', 'hallo', 'heisann', 'hey', 'pip', 'takk', 'please', 'plis', 'figur', 'figuren', 'figurer', 'farge',
  'farger', 'fargen', 'farget', 'farga', 'klær', 'klærne', 'klesplagg', 'plagg', 'ut', 'se', 'ser', 'like', 'liker', 'elsker', 'ønsker',
  'ønske', 'snill', 'fin', 'fint', 'fine', 'pen', 'pent', 'pene', 'kul', 'kult', 'kule', 'søt', 'søte', 'nei', 'ja', 'helt', 'hel', 'hele',
  'alle', 'all', 'alt', 'noe', 'noen', 'to', 'tre', 'par', 'sånn', 'slik', 'dette', 'denne', 'disse', 'der', 'her', 'hva', 'hvordan',
  'man', 'mer', 'mest', 'enn', 'gjøre', 'gjør', 'ta', 'tar', 'bytt', 'bytte', 'bytter', 'endre', 'forandre', 'kledd', 'kle', 'dusk',
  'ok', 'okei', 'kanskje', 'litegrann', 'skikkelig', 'superfin', 'superfint', 'nydelig', 'lik', 'dens', 'om', 'at', 'the', 'and',
  'with', 'a', 'med', 'ein', 'eit', 'ikkje', 'eg', 'meir', 'mykje', 'vere', 'veldig', 'hvis', 'når', 'vær', 'værsågod', 'god', 'både', 'akkurat', 'også', 'jo', 'da', 'nok', 'igjen', 'annen', 'annet',
  'andre', 'farge', 'fargene', 'fargede', 'kjoleaktig', 'type', 'slags', 'sånne', 'sånt', 'sin', 'hennes', 'hans', 'venn', 'venninne',
]

/** Grammatical gender of built-in pieces for Pip's sentences: 'et' words and plurals; the rest are 'en'. */
export const GARMENT_GENDER: Record<string, 'en' | 'et' | 'pl'> = {
  skjort: 'et', tyllskjort: 'et',
  jeans: 'pl', shorts: 'pl', leggings: 'pl',
  joggesko: 'pl', stovler: 'pl', ballerinasko: 'pl', gummistovler: 'pl', sandaler: 'pl',
  kattorer: 'pl', kaninorer: 'pl',
  briller: 'pl', solbriller: 'pl', hjertebriller: 'pl', stjernebriller: 'pl',
  englevinger: 'pl', sommerfuglvinger: 'pl', drakevinger: 'pl', fevinger: 'pl',
}
