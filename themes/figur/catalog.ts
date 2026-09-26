/**
 * Lag Din Figur's catalog: the drawing palette, skins, hair and eyes,
 * the built-in wardrobe, what the drawing board offers, and Pip's theme
 * ideas. Pure data. Names are Norwegian (bokmål): the player is seven.
 * Everything is free.
 *
 * `words` are what Pip (core/helper.ts) knows a piece by: lower case,
 * with the forms a child types (kjole, kjolen, kjola). Pip folds æøå and
 * hyphens away before it compares (ø → o, å → a, æ → ae), so each form is
 * written once. A generic word ("kjole") sits on several pieces; the one
 * worn wins, else the first in this list.
 *
 * `shape` picks the generator's detail within a kind (core/garments.ts):
 *   tee:      'crew' (round neck), 'vneck'
 *   long:     'crew', 'hero' (belt, emblem and cuffs in color2)
 *   hoodie:   'hood' (hood rim, strings, pocket)
 *   tank:     'tank'
 *   shirt:    'collar' (collar, placket, buttons, pocket)
 *   dress:    'princess' (puff sleeves, sash, trimmed hem), 'strap'
 *             (thin straps), 'tee' (short sleeves), 'long' (long sleeves)
 *   pants:    'jeans' (pockets, fly, stitching), 'jogger' (cuffs, side stripe)
 *   shorts:   'plain'; skirt: 'pleat', 'tulle'; leggings: 'plain'
 *   sneaker:  'sneaker'; boot: 'boot', 'rain'; flat: 'ballet', 'sandal'
 *   hat:      'cap', 'beanie', 'crown', 'tiara', 'cat', 'bunny', 'bow',
 *             'witch', 'party', 'cowboy'
 *   glasses:  'round', 'sun', 'heart', 'star'
 *   cape:     'cape'; wings: 'angel', 'butterfly', 'dragon', 'fairy'
 */
import type { FigureBody, GarmentDef, GarmentKind, Hex, SkinId, HairStyle, EyeStyle, MouthStyle, Slot, Worn } from './types'

// ---------------------------------------------------------------- colours

/** The drawing board's 24 colours, also offered for recolouring. */
export const PALETTE: Hex[] = [
  '#ffffff', '#c9c9d6', '#7d7d8f', '#22222b',
  '#f5c9a8', '#c68a5c', '#7a4a2c', '#e8333d',
  '#a3202d', '#ff7eb6', '#ffc2dd', '#ff3d9a',
  '#ff8a2a', '#ffd93b', '#e0a92a', '#3fbf5f',
  '#a4e86b', '#1f7a4a', '#3a8dff', '#9fd4ff',
  '#1f3f9f', '#3fd6cf', '#9b5cff', '#d6b3ff',
]

// ---------------------------------------------------------------- body

export const SKINS: Array<{ id: SkinId; name: string; color: Hex; shade: Hex }> = [
  { id: 'porselen', name: 'Porselen', color: '#ffe6d6', shade: '#e8bfa8' },
  { id: 'lys', name: 'Lys', color: '#f7cfb0', shade: '#d9a283' },
  { id: 'honning', name: 'Honning', color: '#e2a878', shade: '#b97a52' },
  { id: 'oliven', name: 'Oliven', color: '#c08a5c', shade: '#95623c' },
  { id: 'brun', name: 'Brun', color: '#8d5a38', shade: '#653c22' },
  { id: 'mork', name: 'Mørk', color: '#5a3620', shade: '#3b2213' },
  { id: 'bla', name: 'Blå', color: '#7fb2ff', shade: '#4f7fd6' },
  { id: 'gronn', name: 'Grønn', color: '#8fe08a', shade: '#56a856' },
  { id: 'lilla', name: 'Lilla', color: '#c79bff', shade: '#9468d6' },
]

/** Hair colours; 'rainbow' is drawn in stripes of RAINBOW. */
export const HAIR_COLORS: Array<{ id: string; name: string; color: Hex | 'rainbow' }> = [
  { id: 'blond', name: 'Blond', color: '#ffd466' },
  { id: 'lysebrun', name: 'Lysebrun', color: '#a8703f' },
  { id: 'brun', name: 'Brun', color: '#5e3a24' },
  { id: 'svart', name: 'Svart', color: '#241c26' },
  { id: 'rod', name: 'Rød', color: '#d9622b' },
  { id: 'rosa', name: 'Rosa', color: '#ff86c8' },
  { id: 'bla', name: 'Blå', color: '#4f9dff' },
  { id: 'lilla', name: 'Lilla', color: '#a974ff' },
  { id: 'gronn', name: 'Grønn', color: '#5fd46f' },
  { id: 'turkis', name: 'Turkis', color: '#3fd6cf' },
  { id: 'hvit', name: 'Hvit', color: '#f4f2fa' },
  { id: 'regnbue', name: 'Regnbue', color: 'rainbow' },
]

/** Rainbow stripes, top to bottom (hair, and the rainbow pattern). */
export const RAINBOW: Hex[] = ['#ff4f5e', '#ff9f3a', '#ffe14f', '#5fd46f', '#4f9dff', '#a974ff']

export const HAIR_STYLES: Array<{ id: HairStyle; name: string }> = [
  { id: 'short', name: 'Kort' },
  { id: 'long', name: 'Langt' },
  { id: 'ponytail', name: 'Hestehale' },
  { id: 'pigtails', name: 'Musefletter' },
  { id: 'curly', name: 'Krøller' },
  { id: 'bun', name: 'Knute' },
  { id: 'spiky', name: 'Piggsveis' },
  { id: 'afro', name: 'Afro' },
  { id: 'none', name: 'Skallet' },
]

export const EYES: Array<{ id: EyeStyle; name: string }> = [
  { id: 'round', name: 'Runde' },
  { id: 'happy', name: 'Glade' },
  { id: 'sparkle', name: 'Glitreøyne' },
  { id: 'sleepy', name: 'Søvnige' },
  { id: 'wink', name: 'Blunk' },
  { id: 'star', name: 'Stjerneøyne' },
]

export const MOUTHS: Array<{ id: MouthStyle; name: string }> = [
  { id: 'smile', name: 'Smil' },
  { id: 'grin', name: 'Stort smil' },
  { id: 'open', name: 'Åpen' },
  { id: 'tongue', name: 'Tunge ut' },
  { id: 'small', name: 'Liten' },
]

/** Eye colours: brun, blå, grønn, grå, hassel, svart, lilla, rosa. */
export const EYE_COLORS: Hex[] = ['#6b3f24', '#3a7bd5', '#3f9f4f', '#7d8a99', '#9a6b2f', '#22222b', '#8a4fd6', '#e0569a']

// ---------------------------------------------------------------- garments

const g = (
  id: string, name: string, kind: GarmentKind, color: Hex, color2: Hex,
  pattern: GarmentDef['pattern'], shape: string, words: string[],
): GarmentDef => ({ id, name, kind, color, color2, pattern, shape, words })

/** The starter wardrobe: every piece free, every piece recolourable. */
export const GARMENTS: GarmentDef[] = [
  // tops
  g('tskjorte', 'T-skjorte', 'tee', '#3a8dff', '#ffffff', 'plain', 'crew',
    ['t-skjorte', 't-skjorta', 't-skjorten', 't-skjorter', 't-shirt', 'tshirt', 'tisjorte', 'tee']),
  g('genser', 'Genser', 'long', '#3fbf5f', '#ffffff', 'plain', 'crew',
    ['genser', 'genseren', 'gensern', 'gensere', 'genseran', 'gensar', 'gensa', 'sweater', 'jumper']),
  g('stripegenser', 'Stripete genser', 'long', '#1f3f9f', '#ffffff', 'stripes', 'crew',
    ['stripete-genser', 'stripegenser', 'stripegenseren', 'sjømannsgenser', 'genser', 'genseren']),
  g('hettegenser', 'Hettegenser', 'hoodie', '#9b5cff', '#ffffff', 'plain', 'hood',
    ['hettegenser', 'hettegenseren', 'hettegensern', 'hoodie', 'hoodien', 'hettejakke', 'hette', 'genser', 'genseren']),
  g('singlet', 'Singlet', 'tank', '#ff7eb6', '#ffffff', 'plain', 'tank',
    ['singlet', 'singleten', 'singlen', 'topp', 'toppen', 'topper', 'top']),
  g('skjorte', 'Skjorte', 'shirt', '#e8333d', '#ffffff', 'check', 'collar',
    ['skjorte', 'skjorta', 'skjorten', 'skjorter', 'rutete-skjorte', 'ruteskjorte', 'bluse', 'blusen']),
  g('hjertegenser', 'Hjertegenser', 'long', '#ffc2dd', '#e8333d', 'heart', 'crew',
    ['hjertegenser', 'hjertegenseren', 'hjertegensern', 'hjertetopp', 'genser', 'genseren']),
  g('stjernetopp', 'Stjernetopp', 'tee', '#1f3f9f', '#ffd93b', 'star', 'crew',
    ['stjernetopp', 'stjernetoppen', 'stjerne-t-skjorte', 'stjernegenser', 'topp', 'toppen', 't-skjorte', 't-skjorta']),
  g('superheltdrakt', 'Superheltdrakt', 'long', '#e8333d', '#ffd93b', 'star', 'hero',
    ['superheltdrakt', 'superheltdrakten', 'superhelt-drakt', 'heltedrakt', 'superheltkostyme', 'drakt', 'drakten']),
  g('regnbuegenser', 'Regnbuegenser', 'long', '#ffffff', '#ffffff', 'rainbow', 'crew',
    ['regnbuegenser', 'regnbuegenseren', 'regnbuetopp', 'genser', 'genseren']),

  // dresses (top slot, cover the legs)
  g('prinsessekjole', 'Prinsessekjole', 'dress', '#ffc2dd', '#ffd93b', 'plain', 'princess',
    ['prinsessekjole', 'prinsessekjolen', 'prinsessekjola', 'ballkjole', 'ballkjolen', 'kjole', 'kjolen', 'kjola', 'kjoler', 'kjolene', 'kjol', 'kjoll', 'sjole']),
  g('sommerkjole', 'Sommerkjole med prikker', 'dress', '#ffd93b', '#ffffff', 'dots', 'strap',
    ['sommerkjole', 'sommerkjolen', 'sommerkjola', 'prikkekjole', 'prikkete-kjole', 'kjole', 'kjolen', 'kjola']),
  g('regnbuekjole', 'Regnbuekjole', 'dress', '#ffffff', '#ffffff', 'rainbow', 'tee',
    ['regnbuekjole', 'regnbuekjolen', 'regnbuekjola', 'kjole', 'kjolen', 'kjola']),
  g('glitterkjole', 'Glitterkjole', 'dress', '#9b5cff', '#ffffff', 'sparkle', 'strap',
    ['glitterkjole', 'glitterkjolen', 'glitterkjola', 'glitrekjole', 'glitrende-kjole', 'paljettkjole', 'kjole', 'kjolen', 'kjola']),
  g('stjernekjole', 'Stjernekjole', 'dress', '#1f3f9f', '#ffd93b', 'star', 'long',
    ['stjernekjole', 'stjernekjolen', 'stjernekjola', 'kjole', 'kjolen', 'kjola']),

  // bottoms
  g('jeans', 'Jeans', 'pants', '#3a6fc4', '#e0a92a', 'plain', 'jeans',
    ['jeans', 'jeansen', 'jeansa', 'dongeri', 'olabukse', 'olabukser', 'bukse', 'bukser', 'buksa', 'buksen', 'buksene', 'bokse']),
  g('shorts', 'Shorts', 'shorts', '#ff8a2a', '#ffffff', 'plain', 'plain',
    ['shorts', 'shortsen', 'shortsa', 'shortz', 'kortbukse', 'kortbukser', 'kortebukser', 'kortebukse']),
  g('skjort', 'Skjørt', 'skirt', '#e8333d', '#ffffff', 'plain', 'pleat',
    ['skjørt', 'skjørtet', 'skjørta', 'skjørter', 'sjørt', 'skjort']),
  g('tyllskjort', 'Tyllskjørt', 'skirt', '#ffc2dd', '#ffffff', 'sparkle', 'tulle',
    ['tyllskjørt', 'tyllskjørtet', 'tyll', 'tutu', 'tutuen', 'ballettskjørt', 'skjørt', 'skjørtet']),
  g('joggebukse', 'Joggebukse', 'pants', '#7d7d8f', '#ffffff', 'plain', 'jogger',
    ['joggebukse', 'joggebuksa', 'joggebuksen', 'joggebukser', 'treningsbukse', 'treningsbukser', 'bukse', 'bukser', 'buksa']),
  g('leggings', 'Leggings', 'leggings', '#9b5cff', '#ffffff', 'plain', 'plain',
    ['leggings', 'leggingsen', 'leggingsa', 'tights', 'strømpebukse', 'strømpebukser']),

  // shoes
  g('joggesko', 'Joggesko', 'sneaker', '#e8333d', '#ffffff', 'plain', 'sneaker',
    ['joggesko', 'joggeskoa', 'joggeskoene', 'sneakers', 'turnsko', 'sko', 'skoa', 'skoene', 'skoen']),
  g('stovler', 'Støvler', 'boot', '#7a4a2c', '#22222b', 'plain', 'boot',
    ['støvler', 'støvel', 'støvlene', 'støvlane', 'støvla', 'boots']),
  g('ballerinasko', 'Ballerinasko', 'flat', '#ff7eb6', '#ffffff', 'plain', 'ballet',
    ['ballerinasko', 'ballerinaskoa', 'ballerinaskoene', 'ballettsko', 'ballettskoa', 'sko', 'skoa']),
  g('gummistovler', 'Gummistøvler', 'boot', '#ffd93b', '#22222b', 'plain', 'rain',
    ['gummistøvler', 'gummistøvel', 'gummistøvlene', 'regnstøvler', 'støvler', 'støvlene']),
  g('sandaler', 'Sandaler', 'flat', '#c68a5c', '#ff7eb6', 'plain', 'sandal',
    ['sandaler', 'sandal', 'sandalene', 'sandalen', 'sandalane']),

  // hats
  g('caps', 'Caps', 'hat', '#3a8dff', '#ffffff', 'plain', 'cap',
    ['caps', 'capsen', 'kaps', 'kapsen', 'cap', 'skyggelue', 'skyggelua']),
  g('lue', 'Lue med dusk', 'hat', '#e8333d', '#ffffff', 'stripes', 'beanie',
    ['lue', 'lua', 'luen', 'luer', 'dusklue', 'dusklua', 'topplue', 'topplua', 'lue-med-dusk']),
  g('krone', 'Krone', 'hat', '#ffd93b', '#e8333d', 'plain', 'crown',
    ['krone', 'krona', 'kronen', 'kroner', 'gullkrone', 'gullkrona']),
  g('tiara', 'Tiara', 'hat', '#c9c9d6', '#ff7eb6', 'plain', 'tiara',
    ['tiara', 'tiaraen', 'tiaraer', 'diadem', 'diademet']),
  g('kattorer', 'Kattører', 'hat', '#22222b', '#ff7eb6', 'plain', 'cat',
    ['kattører', 'kattøre', 'kattørene', 'katteører', 'katteøre', 'kattøyrer', 'ører', 'ørene', 'øre']),
  g('kaninorer', 'Kaninører', 'hat', '#ffffff', '#ffc2dd', 'plain', 'bunny',
    ['kaninører', 'kaninøre', 'kaninørene', 'hareører', 'hareøre', 'kaninøyrer']),
  g('sloyfe', 'Sløyfe', 'hat', '#ff3d9a', '#ffc2dd', 'plain', 'bow',
    ['sløyfe', 'sløyfa', 'sløyfen', 'sløyfer', 'sløife', 'hårsløyfe', 'rosett']),
  g('cowboyhatt', 'Cowboyhatt', 'hat', '#7a4a2c', '#22222b', 'plain', 'cowboy',
    ['cowboyhatt', 'cowboyhatten', 'cowboy-hatt', 'hatt', 'hatten', 'hatter', 'hat']),
  g('heksehatt', 'Heksehatt', 'hat', '#22222b', '#9b5cff', 'plain', 'witch',
    ['heksehatt', 'heksehatten', 'trollmannshatt', 'trollhatt', 'hatt', 'hatten']),
  g('bursdagshatt', 'Bursdagshatt', 'hat', '#3fd6cf', '#ffd93b', 'stripes', 'party',
    ['bursdagshatt', 'bursdagshatten', 'festhatt', 'partyhatt', 'hatt', 'hatten']),

  // face
  g('briller', 'Briller', 'glasses', '#22222b', '#cfe8ff', 'plain', 'round',
    ['briller', 'brillene', 'brilla', 'brillen', 'brile', 'briler', 'brill']),
  g('solbriller', 'Solbriller', 'glasses', '#22222b', '#2a2a55', 'plain', 'sun',
    ['solbriller', 'solbrillene', 'solbrilla', 'solbriler']),
  g('hjertebriller', 'Hjertebriller', 'glasses', '#ff3d9a', '#ff7eb6', 'plain', 'heart',
    ['hjertebriller', 'hjertebrillene', 'hjertebriler']),
  g('stjernebriller', 'Stjernebriller', 'glasses', '#ffd93b', '#ff8a2a', 'plain', 'star',
    ['stjernebriller', 'stjernebrillene', 'stjernebriler']),

  // back
  g('kappe', 'Kappe', 'cape', '#e8333d', '#ffd93b', 'plain', 'cape',
    ['kappe', 'kappa', 'kappen', 'kapper', 'cape', 'capen', 'superheltkappe']),
  g('englevinger', 'Englevinger', 'wings', '#ffffff', '#9fd4ff', 'plain', 'angel',
    ['englevinger', 'englevinge', 'engelvinger', 'vinger', 'vingene', 'vinge', 'vingar']),
  g('sommerfuglvinger', 'Sommerfuglvinger', 'wings', '#ff7eb6', '#9b5cff', 'plain', 'butterfly',
    ['sommerfuglvinger', 'sommerfuglvinge', 'sommerfuglvingene', 'sommerfugl', 'sommerfuglen']),
  g('drakevinger', 'Drakevinger', 'wings', '#3fbf5f', '#a4e86b', 'plain', 'dragon',
    ['drakevinger', 'dragevinger', 'drakevingene', 'dragevingene', 'flaggermusvinger']),
  g('fevinger', 'Fevinger', 'wings', '#9fd4ff', '#ffffff', 'sparkle', 'fairy',
    ['fevinger', 'fevingene', 'alvevinger', 'glittervinger']),
]

const BY_ID = new Map(GARMENTS.map(d => [d.id, d]))

/** A built-in garment by id. */
export const garment = (id: string): GarmentDef | undefined => BY_ID.get(id)

// ---------------------------------------------------------------- drawing board

/** What the drawing board offers to draw from blank. */
export const DRAW_TEMPLATES: Array<{ kind: GarmentKind; name: string }> = [
  { kind: 'tee', name: 'T-skjorte' },
  { kind: 'long', name: 'Genser' },
  { kind: 'dress', name: 'Kjole' },
  { kind: 'pants', name: 'Bukse' },
  { kind: 'shorts', name: 'Shorts' },
  { kind: 'skirt', name: 'Skjørt' },
  { kind: 'sneaker', name: 'Sko' },
  { kind: 'boot', name: 'Støvler' },
  { kind: 'hat', name: 'Lue/hatt' },
]

// ---------------------------------------------------------------- Pip's ideas

export interface PipTheme {
  id: string
  name: string
  /** Words that ask for it ("lag meg en ninja"). */
  words: string[]
  /** Pip's one short sentence. */
  line: string
  body?: Partial<FigureBody>
  /** Every slot not listed is emptied. */
  outfit: Partial<Record<Slot, Worn | null>>
}

const w = (id: string, color?: Hex, color2?: Hex): Worn => ({ id, ...(color ? { color } : {}), ...(color2 ? { color2 } : {}) })

export const PIP_THEMES: PipTheme[] = [
  { id: 'prinsesse', name: 'Prinsesse', words: ['prinsesse', 'prinsessa', 'prinsessen', 'prinsesser', 'dronning', 'dronninga'],
    line: 'Du er en prinsesse! Med krone og lang kjole.', body: { hair: 'long' },
    outfit: { top: w('prinsessekjole', '#ffc2dd', '#ffd93b'), shoes: w('ballerinasko', '#ff7eb6', '#ffffff'), hat: w('krone', '#ffd93b', '#e8333d') } },
  { id: 'ninja', name: 'Ninja', words: ['ninja', 'ninjaen', 'ninjaer'],
    line: 'Du er en ninja! Helt svart og helt stille.', body: { eyes: 'round', mouth: 'small' },
    outfit: { top: w('hettegenser', '#22222b', '#e8333d'), bottom: w('joggebukse', '#22222b', '#22222b'), shoes: w('stovler', '#22222b', '#22222b'), hat: w('lue', '#22222b', '#e8333d') } },
  { id: 'havfrue', name: 'Havfrue', words: ['havfrue', 'havfrua', 'havfruen', 'havfruer', 'havmann'],
    line: 'Du er en havfrue! Blått og glitrende.', body: { hair: 'long', hairColor: '#3fd6cf' },
    outfit: { top: w('glitterkjole', '#3fd6cf', '#ffffff'), hat: w('tiara', '#9fd4ff', '#ff7eb6') } },
  { id: 'astronaut', name: 'Astronaut', words: ['astronaut', 'astronauten', 'romfarer', 'romskip', 'verdensrommet'],
    line: 'Du er en astronaut! Klar for månen.',
    outfit: { top: w('genser', '#ffffff'), bottom: w('joggebukse', '#ffffff', '#e8333d'), shoes: w('stovler', '#c9c9d6', '#7d7d8f'), face: w('solbriller', '#c9c9d6', '#3a8dff') } },
  { id: 'superhelt', name: 'Superhelt', words: ['superhelt', 'superhelten', 'superhelter', 'superkvinne', 'supermann'],
    line: 'Du er en superhelt! Kappen er klar.',
    outfit: { top: w('superheltdrakt', '#e8333d', '#ffd93b'), bottom: w('leggings', '#1f3f9f'), shoes: w('stovler', '#e8333d', '#a3202d'), back: w('kappe', '#e8333d', '#ffd93b') } },
  { id: 'pirat', name: 'Sjørøver', words: ['pirat', 'piraten', 'pirater', 'sjørøver', 'sjørøveren', 'sjørøvere'],
    line: 'Du er en sjørøver! Hei hå, til sjøs!', body: { mouth: 'grin' },
    outfit: { top: w('stripegenser', '#ffffff', '#e8333d'), bottom: w('shorts', '#22222b'), shoes: w('stovler', '#22222b', '#7a4a2c'), hat: w('cowboyhatt', '#22222b', '#e8333d') } },
  { id: 'fe', name: 'Fe', words: ['fe', 'feen', 'fea', 'feer', 'alv', 'alven', 'tannfe'],
    line: 'Du er en fe! Med glitter og vinger.', body: { hair: 'bun', eyes: 'sparkle' },
    outfit: { top: w('glitterkjole', '#d6b3ff', '#ffffff'), shoes: w('ballerinasko', '#d6b3ff', '#ffffff'), hat: w('tiara', '#c9c9d6', '#9fd4ff'), back: w('fevinger', '#9fd4ff', '#ffffff') } },
  { id: 'katt', name: 'Katt', words: ['katt', 'katten', 'katta', 'katter', 'kattepus', 'pus', 'pusen', 'kattunge'],
    line: 'Mjau! Du er en katt.', body: { mouth: 'small', cheeks: true },
    outfit: { top: w('stripegenser', '#ff8a2a', '#ffc98a'), bottom: w('leggings', '#ff8a2a'), shoes: w('ballerinasko', '#ffc2dd', '#ffffff'), hat: w('kattorer', '#ff8a2a', '#ffc2dd') } },
  { id: 'robot', name: 'Robot', words: ['robot', 'roboten', 'roboter', 'robott'],
    line: 'Bip bop! Du er en robot.', body: { eyes: 'round', mouth: 'small' },
    outfit: { top: w('genser', '#c9c9d6'), bottom: w('joggebukse', '#7d7d8f', '#3fd6cf'), shoes: w('stovler', '#7d7d8f', '#22222b'), face: w('solbriller', '#22222b', '#3fd6cf') } },
  { id: 'zombie', name: 'Zombie', words: ['zombie', 'zombien', 'zombier', 'zombi', 'sombie'],
    line: 'Du er en snill zombie. Den spiser bare pannekaker!', body: { skin: 'gronn', eyes: 'sleepy', mouth: 'open' },
    outfit: { top: w('skjorte', '#7d7d8f', '#c9c9d6'), bottom: w('shorts', '#7a4a2c'), shoes: w('joggesko', '#7d7d8f', '#c9c9d6') } },
  { id: 'enhjorning', name: 'Enhjørning', words: ['enhjørning', 'enhjørningen', 'enhjørninger', 'enhjørninga', 'unicorn'],
    line: 'Du er en enhjørning! Regnbuehår og glitter.', body: { hairColor: 'rainbow', eyes: 'sparkle' },
    outfit: { top: w('regnbuegenser'), bottom: w('tyllskjort', '#ffffff', '#ffc2dd'), shoes: w('ballerinasko', '#ffffff', '#ff7eb6'), hat: w('tiara', '#ffd93b', '#ff7eb6') } },
  { id: 'fotball', name: 'Fotballspiller', words: ['fotball', 'fotballspiller', 'fotballspilleren', 'fotballjente', 'fotballgutt', 'keeper'],
    line: 'Du er en fotballspiller! Mål!', body: { hair: 'ponytail', mouth: 'grin' },
    outfit: { top: w('tskjorte', '#e8333d'), bottom: w('shorts', '#ffffff'), shoes: w('joggesko', '#22222b', '#ffffff') } },
  { id: 'kokk', name: 'Kokk', words: ['kokk', 'kokken', 'kokker', 'baker', 'bakeren'],
    line: 'Du er en kokk! Hva skal vi lage?',
    outfit: { top: w('skjorte', '#ffffff', '#ffffff'), bottom: w('jeans', '#22222b', '#7d7d8f'), shoes: w('joggesko', '#ffffff', '#c9c9d6'), hat: w('lue', '#ffffff', '#ffffff') } },
  { id: 'vampyr', name: 'Vampyr', words: ['vampyr', 'vampyren', 'vampyrer', 'vampir', 'dracula'],
    line: 'Du er en snill vampyr. Den drikker bare saft!', body: { skin: 'porselen', hairColor: '#241c26', mouth: 'grin' },
    outfit: { top: w('skjorte', '#ffffff', '#ffffff'), bottom: w('jeans', '#22222b', '#a3202d'), shoes: w('stovler', '#22222b', '#22222b'), back: w('kappe', '#22222b', '#e8333d') } },
  { id: 'heks', name: 'Heks', words: ['heks', 'heksa', 'heksen', 'hekser', 'trollmann', 'trollkvinne', 'trollmannen'],
    line: 'Du er en heks! Abrakadabra!', body: { hair: 'long' },
    outfit: { top: w('stjernekjole', '#1f3f9f', '#ffd93b'), shoes: w('stovler', '#22222b', '#22222b'), hat: w('heksehatt', '#22222b', '#9b5cff'), back: w('kappe', '#9b5cff', '#22222b') } },
  { id: 'cowboy', name: 'Cowboy', words: ['cowboy', 'cowboyen', 'cowgirl', 'cowboyer', 'kuvokter'],
    line: 'Du er en cowboy! Jiiihaa!', body: { mouth: 'grin' },
    outfit: { top: w('skjorte', '#e8333d', '#ffffff'), bottom: w('jeans'), shoes: w('stovler', '#7a4a2c', '#22222b'), hat: w('cowboyhatt', '#c68a5c', '#7a4a2c') } },
  { id: 'ballerina', name: 'Ballerina', words: ['ballerina', 'ballerinaen', 'ballettdanser', 'ballett', 'danser'],
    line: 'Du er en ballerina! Snurr rundt!', body: { hair: 'bun' },
    outfit: { top: w('singlet', '#ffc2dd'), bottom: w('tyllskjort', '#ffc2dd', '#ffffff'), shoes: w('ballerinasko', '#ffc2dd', '#ff7eb6'), hat: w('sloyfe', '#ff7eb6', '#ffc2dd') } },
  { id: 'engel', name: 'Engel', words: ['engel', 'engelen', 'engler', 'englene', 'engle'],
    line: 'Du er en engel! Myk og hvit.', body: { eyes: 'happy' },
    outfit: { top: w('glitterkjole', '#ffffff', '#ffd93b'), shoes: w('sandaler', '#ffd93b', '#ffffff'), hat: w('tiara', '#ffd93b', '#9fd4ff'), back: w('englevinger', '#ffffff', '#9fd4ff') } },
  { id: 'drage', name: 'Drage', words: ['drage', 'dragen', 'drake', 'draken', 'drager', 'dinosaur', 'dino'],
    line: 'Du er en drage! Men du spruter bare glitter.', body: { skin: 'gronn' },
    outfit: { top: w('hettegenser', '#3fbf5f', '#a4e86b'), bottom: w('leggings', '#1f7a4a'), shoes: w('stovler', '#1f7a4a', '#22222b'), back: w('drakevinger', '#3fbf5f', '#a4e86b') } },
]
