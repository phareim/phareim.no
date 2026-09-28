/**
 * Mini World's catalog: skin tones, hair, every piece of clothing and
 * furniture, floors, wallpapers and the weapon workshop's parts, with
 * prices in bits. Pure data (the server validates gift ids against it).
 * Names are Norwegian: the player is seven.
 */
import type {
  ClothingDef, FurnitureDef, SurfaceDef, WeaponBaseDef, WeaponMagicDef,
  SkinId, HairStyleId, HairColorId, EyesId, MouthId, ClothingSlot, FashionTag, Outfit, ClothesShopId,
} from './types'

// ---------------------------------------------------------------- body

export const SKINS: { id: SkinId; color: string; shade: string }[] = [
  { id: 's1', color: '#ffe0cc', shade: '#e8b9a0' },
  { id: 's2', color: '#f5c3a8', shade: '#c98576' },
  { id: 's3', color: '#e0a47a', shade: '#b27552' },
  { id: 's4', color: '#b97a50', shade: '#8a5434' },
  { id: 's5', color: '#8a5632', shade: '#5e3620' },
  { id: 's6', color: '#5c3620', shade: '#3a2012' },
]

export const HAIR_STYLES: { id: HairStyleId; name: string }[] = [
  { id: 'short', name: 'Kort' },
  { id: 'bob', name: 'Pageklipp' },
  { id: 'long', name: 'Langt' },
  { id: 'ponytail', name: 'Hestehale' },
  { id: 'pigtails', name: 'To musefletter' },
  { id: 'bun', name: 'Knute' },
  { id: 'curly', name: 'Krøller' },
  { id: 'spiky', name: 'Piggete' },
  { id: 'braids', name: 'Fletter' },
  { id: 'afro', name: 'Afro' },
  { id: 'none', name: 'Skallet' },
]

/** `rainbow` hair is drawn in stripes of the regnbue colours. */
export const HAIR_COLORS: { id: HairColorId; name: string; color: string; shade: string }[] = [
  { id: 'black', name: 'Svart', color: '#2a2230', shade: '#15101a' },
  { id: 'brown', name: 'Brun', color: '#6a4432', shade: '#3a2418' },
  { id: 'blond', name: 'Blond', color: '#ffd978', shade: '#d9a640' },
  { id: 'ginger', name: 'Rød', color: '#e0703a', shade: '#a8461c' },
  { id: 'white', name: 'Hvit', color: '#f4f0ff', shade: '#c8c0e0' },
  { id: 'pink', name: 'Rosa', color: '#ff8ae0', shade: '#d0509e' },
  { id: 'blue', name: 'Blå', color: '#5fb8ff', shade: '#2f6fd0' },
  { id: 'purple', name: 'Lilla', color: '#b07aff', shade: '#7a3ad0' },
  { id: 'mint', name: 'Mint', color: '#7ff0c8', shade: '#3fb890' },
  { id: 'rainbow', name: 'Regnbue', color: '#ff6fb0', shade: '#b04fd0' },
]

export const RAINBOW = ['#ff4f6f', '#ff9f3f', '#ffe14f', '#6fe07f', '#4fb8ff', '#a86fff']

export const EYES: { id: EyesId; name: string }[] = [
  { id: 'dots', name: 'Prikker' },
  { id: 'big', name: 'Store' },
  { id: 'happy', name: 'Glade' },
  { id: 'lashes', name: 'Vipper' },
  { id: 'wink', name: 'Blunk' },
]

export const MOUTHS: { id: MouthId; name: string }[] = [
  { id: 'smile', name: 'Smil' },
  { id: 'grin', name: 'Glis' },
  { id: 'open', name: 'Åpen' },
  { id: 'tongue', name: 'Tunge' },
  { id: 'cat', name: 'Katt' },
]

// ---------------------------------------------------------------- clothes

const c = (d: ClothingDef): ClothingDef => d

export const CLOTHES: ClothingDef[] = [
  // --- tops
  c({ id: 'tee-white', slot: 'top', name: 'Hvit T-skjorte', price: 0, rarity: 'basic', shape: 'tee', colors: { main: '#f4f0ff' }, tags: ['sport'] }),
  c({ id: 'tee-blue', slot: 'top', name: 'Blå T-skjorte', price: 0, rarity: 'basic', shape: 'tee', colors: { main: '#4fb8ff' }, tags: ['sport', 'strand'] }),
  c({ id: 'tank-lime', slot: 'top', name: 'Grønn singlet', price: 15, rarity: 'shop', shape: 'tank', colors: { main: '#9fef5a' }, tags: ['strand', 'sport'] }),
  c({ id: 'stripes-top', slot: 'top', name: 'Stripete genser', price: 20, rarity: 'shop', shape: 'sweater', colors: { main: '#2f4fa0', second: '#f4f0ff' }, pattern: 'stripes', tags: ['strand'] }),
  c({ id: 'hoodie-pink', slot: 'top', name: 'Rosa hettegenser', price: 25, rarity: 'shop', shape: 'hoodie', colors: { main: '#ff8ae0', second: '#ffffff' }, tags: ['sport'] }),
  c({ id: 'football-shirt', slot: 'top', name: 'Fotballdrakt', price: 30, rarity: 'shop', shape: 'tee', colors: { main: '#ff3b5c', second: '#ffffff', accent: '#ffd23f' }, pattern: 'stripes', tags: ['sport'] }),
  c({ id: 'jacket-denim', slot: 'top', name: 'Dongerijakke', price: 35, rarity: 'shop', shape: 'jacket', colors: { main: '#5a7ad0', second: '#f4f0ff', accent: '#ffd23f' }, tags: [] }),
  c({ id: 'sweater-winter', slot: 'top', name: 'Strikkegenser', price: 35, rarity: 'shop', shape: 'sweater', colors: { main: '#e0304a', second: '#ffffff' }, pattern: 'snow', tags: ['vinter'] }),
  c({ id: 'dress-flower', slot: 'top', name: 'Blomsterkjole', price: 40, rarity: 'shop', shape: 'dress', colors: { main: '#ffb0d8', second: '#ffe14f', accent: '#6fe07f' }, pattern: 'flowers', tags: ['strand', 'fest'] }),
  c({ id: 'rainbow-sweater', slot: 'top', name: 'Regnbuegenser', price: 45, rarity: 'shop', shape: 'sweater', colors: { main: '#ff6fb0' }, pattern: 'rainbow', tags: ['regnbue', 'vinter'] }),
  c({ id: 'dress-party', slot: 'top', name: 'Festkjole', price: 60, rarity: 'shop', shape: 'dress', colors: { main: '#9a4ff0', second: '#ff8ae0', accent: '#fff1b0' }, pattern: 'sparkle', tags: ['fest'] }),
  c({ id: 'tiger-top', slot: 'top', name: 'Tigergenser', price: 40, rarity: 'shop', shape: 'hoodie', colors: { main: '#ff9f3f', second: '#2a2230' }, pattern: 'stripes', tags: ['dyr'] }),
  c({ id: 'knight-top', slot: 'top', name: 'Riddertunika', price: 55, rarity: 'shop', shape: 'tee', colors: { main: '#c8c0e0', second: '#2f4fa0', accent: '#ffd23f' }, pattern: 'checks', tags: ['eventyr'] }),
  c({ id: 'space-suit', slot: 'top', name: 'Romdrakt', price: 90, rarity: 'shop', shape: 'suit', colors: { main: '#f4f0ff', second: '#2ff3ff', accent: '#ff3b5c' }, tags: ['verdensrom'] }),
  c({ id: 'princess-gown', slot: 'top', name: 'Prinsessekjole', price: 120, rarity: 'shop', shape: 'gown', colors: { main: '#ff8ae0', second: '#ffd23f', accent: '#fff4ff' }, pattern: 'sparkle', tags: ['prinsesse', 'fest'] }),
  c({ id: 'obby-hoodie', slot: 'top', name: 'Obby-hettegenser', price: 0, rarity: 'prize', shape: 'hoodie', colors: { main: '#6fe07f', second: '#2a2230', accent: '#ffe14f' }, pattern: 'checks', tags: ['sport'] }),
  c({ id: 'star-top', slot: 'top', name: 'Stjernetopp', price: 0, rarity: 'prize', shape: 'tank', colors: { main: '#2a1a4c', second: '#ffe14f' }, pattern: 'stars', tags: ['verdensrom', 'fest'] }),
  c({ id: 'royal-robe', slot: 'top', name: 'Kongekappe', price: 0, rarity: 'royal', shape: 'gown', colors: { main: '#b01874', second: '#fff4ff', accent: '#ffd23f' }, pattern: 'dots', tags: ['prinsesse', 'eventyr', 'fest'] }),

  // --- bottoms
  c({ id: 'jeans', slot: 'bottom', name: 'Olabukse', price: 0, rarity: 'basic', shape: 'pants', colors: { main: '#3a5ab0' }, tags: [] }),
  c({ id: 'shorts-denim', slot: 'bottom', name: 'Dongerishorts', price: 15, rarity: 'shop', shape: 'shorts', colors: { main: '#5a7ad0' }, tags: ['strand'] }),
  c({ id: 'shorts-sport', slot: 'bottom', name: 'Treningsshorts', price: 15, rarity: 'shop', shape: 'shorts', colors: { main: '#2a2230', second: '#ffffff' }, pattern: 'stripes', tags: ['sport'] }),
  c({ id: 'skirt-pink', slot: 'bottom', name: 'Rosa skjørt', price: 20, rarity: 'shop', shape: 'skirt', colors: { main: '#ff8ae0' }, tags: ['fest'] }),
  c({ id: 'leggings-dots', slot: 'bottom', name: 'Prikkete tights', price: 20, rarity: 'shop', shape: 'pants', colors: { main: '#6a2a7c', second: '#ffe14f' }, pattern: 'dots', tags: ['sport'] }),
  c({ id: 'pants-cargo', slot: 'bottom', name: 'Turbukse', price: 25, rarity: 'shop', shape: 'pants', colors: { main: '#5e7a3c', accent: '#3a2418' }, tags: ['vinter'] }),
  c({ id: 'skirt-tutu', slot: 'bottom', name: 'Tyllskjørt', price: 35, rarity: 'shop', shape: 'tutu', colors: { main: '#ffb0d8', second: '#fff4ff' }, pattern: 'sparkle', tags: ['prinsesse', 'fest'] }),
  c({ id: 'pants-snow', slot: 'bottom', name: 'Skibukse', price: 30, rarity: 'shop', shape: 'pants', colors: { main: '#2ff3ff', second: '#1a2f78' }, tags: ['vinter', 'sport'] }),
  c({ id: 'pants-rainbow', slot: 'bottom', name: 'Regnbuebukse', price: 45, rarity: 'shop', shape: 'pants', colors: { main: '#ff6fb0' }, pattern: 'rainbow', tags: ['regnbue'] }),
  c({ id: 'pants-space', slot: 'bottom', name: 'Rombukse', price: 60, rarity: 'shop', shape: 'pants', colors: { main: '#f4f0ff', second: '#2ff3ff' }, pattern: 'stripes', tags: ['verdensrom'] }),
  c({ id: 'skirt-star', slot: 'bottom', name: 'Stjerneskjørt', price: 0, rarity: 'prize', shape: 'skirt', colors: { main: '#2a1a4c', second: '#ffe14f' }, pattern: 'stars', tags: ['verdensrom', 'fest'] }),

  // --- shoes
  c({ id: 'sneakers-white', slot: 'shoes', name: 'Hvite joggesko', price: 0, rarity: 'basic', shape: 'sneakers', colors: { main: '#f4f0ff', second: '#ff3b5c' }, tags: ['sport'] }),
  c({ id: 'sandals', slot: 'shoes', name: 'Sandaler', price: 15, rarity: 'shop', shape: 'sandals', colors: { main: '#e07a4e' }, tags: ['strand'] }),
  c({ id: 'sneakers-pink', slot: 'shoes', name: 'Rosa joggesko', price: 20, rarity: 'shop', shape: 'sneakers', colors: { main: '#ff8ae0', second: '#ffffff' }, tags: ['sport'] }),
  c({ id: 'boots-rain', slot: 'shoes', name: 'Gule støvler', price: 20, rarity: 'shop', shape: 'boots', colors: { main: '#ffd23f' }, tags: ['vinter'] }),
  c({ id: 'boots-winter', slot: 'shoes', name: 'Vinterstøvler', price: 30, rarity: 'shop', shape: 'boots', colors: { main: '#6a4432', second: '#f4f0ff' }, tags: ['vinter'] }),
  c({ id: 'shoes-party', slot: 'shoes', name: 'Glitresko', price: 35, rarity: 'shop', shape: 'party', colors: { main: '#c8c0e0', second: '#ff8ae0' }, pattern: 'sparkle', tags: ['fest', 'prinsesse'] }),
  c({ id: 'skates', slot: 'shoes', name: 'Rulleskøyter', price: 60, rarity: 'shop', shape: 'skates', colors: { main: '#4fb8ff', second: '#ffe14f' }, tags: ['sport', 'regnbue'] }),
  c({ id: 'shoes-gold', slot: 'shoes', name: 'Gullsko', price: 0, rarity: 'prize', shape: 'party', colors: { main: '#ffd23f', second: '#fff1b0' }, pattern: 'sparkle', tags: ['fest', 'prinsesse'] }),

  // --- hats (and things on the head)
  c({ id: 'cap-red', slot: 'hat', name: 'Rød caps', price: 15, rarity: 'shop', shape: 'cap', colors: { main: '#ff3b5c', second: '#ffffff' }, tags: ['sport', 'strand'] }),
  c({ id: 'bow-pink', slot: 'hat', name: 'Rosa sløyfe', price: 15, rarity: 'shop', shape: 'bow', colors: { main: '#ff5fb8' }, tags: ['fest'] }),
  c({ id: 'beanie', slot: 'hat', name: 'Lue', price: 20, rarity: 'shop', shape: 'beanie', colors: { main: '#4fb8ff', second: '#ffffff' }, pattern: 'stripes', tags: ['vinter'] }),
  c({ id: 'party-hat', slot: 'hat', name: 'Festhatt', price: 20, rarity: 'shop', shape: 'party', colors: { main: '#ffe14f', second: '#ff3b5c' }, pattern: 'dots', tags: ['fest'] }),
  c({ id: 'sun-hat', slot: 'hat', name: 'Solhatt', price: 25, rarity: 'shop', shape: 'sunhat', colors: { main: '#fff1b0', second: '#ff8ae0' }, tags: ['strand'] }),
  c({ id: 'flower-crown', slot: 'hat', name: 'Blomsterkrans', price: 30, rarity: 'shop', shape: 'flowers', colors: { main: '#6fe07f', second: '#ff8ae0', accent: '#ffe14f' }, tags: ['prinsesse', 'strand', 'eventyr'] }),
  c({ id: 'bunny-ears', slot: 'hat', name: 'Kaninører', price: 35, rarity: 'shop', shape: 'bunny', colors: { main: '#ffffff', second: '#ffb0d8' }, tags: ['dyr'] }),
  c({ id: 'cat-ears', slot: 'hat', name: 'Katteører', price: 35, rarity: 'shop', shape: 'cat', colors: { main: '#2a2230', second: '#ff8ae0' }, tags: ['dyr'] }),
  c({ id: 'wizard-hat', slot: 'hat', name: 'Trollmannshatt', price: 50, rarity: 'shop', shape: 'wizard', colors: { main: '#54259e', second: '#ffe14f' }, pattern: 'stars', tags: ['eventyr'] }),
  c({ id: 'space-helmet', slot: 'hat', name: 'Romhjelm', price: 60, rarity: 'shop', shape: 'helmet', colors: { main: '#f4f0ff', second: '#2ff3ff' }, tags: ['verdensrom'] }),
  c({ id: 'unicorn-horn', slot: 'hat', name: 'Enhjørninghorn', price: 70, rarity: 'shop', shape: 'unicorn', colors: { main: '#fff4ff', second: '#ff8ae0', accent: '#ffe14f' }, pattern: 'rainbow', tags: ['eventyr', 'dyr', 'regnbue'] }),
  c({ id: 'tiara', slot: 'hat', name: 'Tiara', price: 80, rarity: 'shop', shape: 'tiara', colors: { main: '#c8c0e0', accent: '#ff8ae0' }, pattern: 'sparkle', tags: ['prinsesse', 'fest'] }),
  c({ id: 'crown-king', slot: 'hat', name: 'Kongekrone', price: 0, rarity: 'royal', shape: 'crown', colors: { main: '#ffd23f', accent: '#ff3b5c' }, tags: ['prinsesse', 'eventyr', 'fest'] }),
  c({ id: 'crown-queen', slot: 'hat', name: 'Dronningkrone', price: 0, rarity: 'royal', shape: 'crown', colors: { main: '#ffd23f', accent: '#ff8ae0' }, pattern: 'sparkle', tags: ['prinsesse', 'eventyr', 'fest'] }),
  c({ id: 'crown-prince', slot: 'hat', name: 'Prinsekrone', price: 0, rarity: 'royal', shape: 'crown', colors: { main: '#c8c0e0', accent: '#4fb8ff' }, tags: ['prinsesse', 'eventyr'] }),
  c({ id: 'tiara-princess', slot: 'hat', name: 'Prinsessetiara', price: 0, rarity: 'royal', shape: 'tiara', colors: { main: '#ffd23f', accent: '#b07aff' }, pattern: 'sparkle', tags: ['prinsesse', 'fest'] }),

  // --- face
  c({ id: 'glasses-round', slot: 'face', name: 'Runde briller', price: 15, rarity: 'shop', shape: 'round', colors: { main: '#2a2230' }, tags: [] }),
  c({ id: 'sunglasses', slot: 'face', name: 'Solbriller', price: 20, rarity: 'shop', shape: 'shades', colors: { main: '#15101a', second: '#4fb8ff' }, tags: ['strand'] }),
  c({ id: 'mask-hero', slot: 'face', name: 'Heltemaske', price: 25, rarity: 'shop', shape: 'mask', colors: { main: '#ff3b5c' }, tags: ['eventyr'] }),
  c({ id: 'heart-glasses', slot: 'face', name: 'Hjertebriller', price: 30, rarity: 'shop', shape: 'hearts', colors: { main: '#ff3b8a', second: '#ffb0d8' }, tags: ['fest', 'regnbue'] }),
  c({ id: 'star-glasses', slot: 'face', name: 'Stjernebriller', price: 0, rarity: 'prize', shape: 'stars', colors: { main: '#ffd23f', second: '#ff9f3f' }, tags: ['fest', 'verdensrom'] }),

  // --- back
  c({ id: 'backpack', slot: 'back', name: 'Ryggsekk', price: 25, rarity: 'shop', shape: 'backpack', colors: { main: '#ff9f3f', second: '#3a2418' }, tags: ['sport'] }),
  c({ id: 'cat-tail', slot: 'back', name: 'Kattehale', price: 30, rarity: 'shop', shape: 'tail', colors: { main: '#2a2230', second: '#ff8ae0' }, tags: ['dyr'] }),
  c({ id: 'cape-red', slot: 'back', name: 'Heltekappe', price: 40, rarity: 'shop', shape: 'cape', colors: { main: '#ff3b5c', second: '#ffd23f' }, tags: ['eventyr'] }),
  c({ id: 'fairy-wings', slot: 'back', name: 'Feevinger', price: 80, rarity: 'shop', shape: 'fairy', colors: { main: '#c4fbff', second: '#ff8ae0' }, pattern: 'sparkle', tags: ['eventyr', 'prinsesse', 'regnbue'] }),
  c({ id: 'jetpack', slot: 'back', name: 'Jetpakke', price: 100, rarity: 'shop', shape: 'jetpack', colors: { main: '#c8c0e0', second: '#ff3b5c', accent: '#ffd23f' }, tags: ['verdensrom'] }),
  c({ id: 'royal-cape', slot: 'back', name: 'Kongelig kappe', price: 0, rarity: 'royal', shape: 'cape', colors: { main: '#9a4ff0', second: '#fff4ff', accent: '#ffd23f' }, pattern: 'dots', tags: ['prinsesse', 'eventyr', 'fest'] }),

  // --- Glitterbutikken: party, princess, sparkle, jewellery, wings
  c({ id: 'sequin-dress', slot: 'top', name: 'Paljettkjole', price: 70, rarity: 'shop', shop: 'glitter', shape: 'dress', colors: { main: '#ffd23f', second: '#fff4ff', accent: '#ff5fb8' }, pattern: 'sparkle', tags: ['fest', 'prinsesse'] }),
  c({ id: 'ice-gown', slot: 'top', name: 'Iskjole', price: 110, rarity: 'shop', shop: 'glitter', shape: 'gown', colors: { main: '#8fd8ff', second: '#ffffff', accent: '#c4fbff' }, pattern: 'snow', tags: ['prinsesse', 'vinter', 'fest'] }),
  c({ id: 'ballet-top', slot: 'top', name: 'Ballettdrakt', price: 30, rarity: 'shop', shop: 'glitter', shape: 'tank', colors: { main: '#ffb0d8', second: '#ffffff' }, pattern: 'sparkle', tags: ['prinsesse', 'fest'] }),
  c({ id: 'glitter-hoodie', slot: 'top', name: 'Glitterhettegenser', price: 40, rarity: 'shop', shop: 'glitter', shape: 'hoodie', colors: { main: '#b07aff', second: '#fff4ff' }, pattern: 'sparkle', tags: ['fest', 'sport'] }),
  c({ id: 'skirt-gold', slot: 'bottom', name: 'Gullskjørt', price: 30, rarity: 'shop', shop: 'glitter', shape: 'skirt', colors: { main: '#ffd23f', second: '#fff1b0' }, pattern: 'sparkle', tags: ['fest', 'prinsesse'] }),
  c({ id: 'tutu-rainbow', slot: 'bottom', name: 'Regnbuetyll', price: 45, rarity: 'shop', shop: 'glitter', shape: 'tutu', colors: { main: '#ff6fb0', second: '#fff4ff' }, pattern: 'rainbow', tags: ['regnbue', 'prinsesse', 'fest'] }),
  c({ id: 'pants-glitter', slot: 'bottom', name: 'Glitterbukse', price: 35, rarity: 'shop', shop: 'glitter', shape: 'pants', colors: { main: '#c8c0e0', second: '#ff8ae0' }, pattern: 'sparkle', tags: ['fest'] }),
  c({ id: 'ballet-shoes', slot: 'shoes', name: 'Ballettsko', price: 30, rarity: 'shop', shop: 'glitter', shape: 'ballet', colors: { main: '#ffb0d8', second: '#ff8ae0' }, tags: ['prinsesse', 'fest'] }),
  c({ id: 'boots-glitter', slot: 'shoes', name: 'Glitterstøvler', price: 45, rarity: 'shop', shop: 'glitter', shape: 'boots', colors: { main: '#ff5fb8', second: '#fff4ff' }, pattern: 'sparkle', tags: ['fest', 'vinter'] }),
  c({ id: 'star-crown', slot: 'hat', name: 'Stjernekrone', price: 60, rarity: 'shop', shop: 'glitter', shape: 'starcrown', colors: { main: '#ffe14f', second: '#fff1b0', accent: '#ff8ae0' }, tags: ['fest', 'prinsesse', 'verdensrom'] }),
  c({ id: 'headphones', slot: 'hat', name: 'Hodetelefoner', price: 40, rarity: 'shop', shop: 'glitter', shape: 'headphones', colors: { main: '#ff8ae0', second: '#2a2230', accent: '#2ff3ff' }, tags: ['fest', 'sport'] }),
  c({ id: 'bow-gold', slot: 'hat', name: 'Gullsløyfe', price: 20, rarity: 'shop', shop: 'glitter', shape: 'bow', colors: { main: '#ffd23f' }, tags: ['fest', 'prinsesse'] }),
  c({ id: 'pearl-necklace', slot: 'face', name: 'Perlekjede', price: 35, rarity: 'shop', shop: 'glitter', shape: 'necklace', colors: { main: '#fff4ff', second: '#ff8ae0' }, tags: ['prinsesse', 'fest'] }),
  c({ id: 'bowtie', slot: 'face', name: 'Butterfly', price: 25, rarity: 'shop', shop: 'glitter', shape: 'bowtie', colors: { main: '#ff3b8a', second: '#ffe14f' }, tags: ['fest'] }),
  c({ id: 'shades-pink', slot: 'face', name: 'Rosa solbriller', price: 20, rarity: 'shop', shop: 'glitter', shape: 'shades', colors: { main: '#ff5fb8', second: '#ffe14f' }, tags: ['strand', 'fest'] }),
  c({ id: 'butterfly-wings', slot: 'back', name: 'Sommerfuglvinger', price: 60, rarity: 'shop', shop: 'glitter', shape: 'fairy', colors: { main: '#ffb040', second: '#2a2230' }, tags: ['dyr', 'eventyr', 'regnbue'] }),
  c({ id: 'cape-glitter', slot: 'back', name: 'Glitterkappe', price: 50, rarity: 'shop', shop: 'glitter', shape: 'cape', colors: { main: '#ff8ae0', second: '#ffd23f', accent: '#fff4ff' }, pattern: 'sparkle', tags: ['fest', 'prinsesse'] }),

  // --- Kostymebutikken: dress up as a dinosaur, a bee, a pirate, a mermaid, a witch, a hero
  c({ id: 'dino-suit', slot: 'top', name: 'Dinosaurdrakt', price: 70, rarity: 'shop', shop: 'kostyme', shape: 'onesie', colors: { main: '#5fcf6f', second: '#ffd23f', accent: '#c8f5a0' }, tags: ['dyr', 'eventyr'] }),
  c({ id: 'bee-suit', slot: 'top', name: 'Biedrakt', price: 60, rarity: 'shop', shop: 'kostyme', shape: 'onesie', colors: { main: '#ffd23f', second: '#2a2230' }, pattern: 'stripes', tags: ['dyr'] }),
  c({ id: 'hero-suit', slot: 'top', name: 'Superheltdrakt', price: 55, rarity: 'shop', shop: 'kostyme', shape: 'hero', colors: { main: '#2f6fd0', second: '#ff3b5c', accent: '#ffe14f' }, tags: ['eventyr', 'sport'] }),
  c({ id: 'pirate-shirt', slot: 'top', name: 'Piratskjorte', price: 30, rarity: 'shop', shop: 'kostyme', shape: 'tee', colors: { main: '#f4f0ff', second: '#ff3b5c' }, pattern: 'stripes', tags: ['eventyr', 'strand'] }),
  c({ id: 'witch-dress', slot: 'top', name: 'Heksekjole', price: 50, rarity: 'shop', shop: 'kostyme', shape: 'dress', colors: { main: '#3a2a5c', second: '#9fef5a', accent: '#ff9f3f' }, pattern: 'stars', tags: ['eventyr'] }),
  c({ id: 'mermaid-tail', slot: 'bottom', name: 'Havfruehale', price: 80, rarity: 'shop', shop: 'kostyme', shape: 'mermaid', colors: { main: '#2fb8a8', second: '#7ff0c8', accent: '#b07aff' }, pattern: 'scales', tags: ['eventyr', 'strand', 'dyr'] }),
  c({ id: 'pirate-pants', slot: 'bottom', name: 'Piratbukse', price: 25, rarity: 'shop', shop: 'kostyme', shape: 'shorts', colors: { main: '#3a2418', accent: '#ffd23f' }, tags: ['eventyr'] }),
  c({ id: 'dino-feet', slot: 'shoes', name: 'Dinoføtter', price: 40, rarity: 'shop', shop: 'kostyme', shape: 'claws', colors: { main: '#5fcf6f', second: '#fff4ff' }, tags: ['dyr'] }),
  c({ id: 'boots-pirate', slot: 'shoes', name: 'Piratstøvler', price: 35, rarity: 'shop', shop: 'kostyme', shape: 'boots', colors: { main: '#2a2230', second: '#ffd23f' }, tags: ['eventyr'] }),
  c({ id: 'dino-hood', slot: 'hat', name: 'Dinohette', price: 50, rarity: 'shop', shop: 'kostyme', shape: 'dino', colors: { main: '#5fcf6f', second: '#ffd23f', accent: '#ffffff' }, tags: ['dyr', 'eventyr'] }),
  c({ id: 'pirate-hat', slot: 'hat', name: 'Piratlue', price: 45, rarity: 'shop', shop: 'kostyme', shape: 'pirate', colors: { main: '#2a2230', second: '#ffd23f', accent: '#ffffff' }, tags: ['eventyr'] }),
  c({ id: 'witch-hat', slot: 'hat', name: 'Heksehatt', price: 45, rarity: 'shop', shop: 'kostyme', shape: 'witch', colors: { main: '#3a2a5c', second: '#9fef5a', accent: '#ffd23f' }, tags: ['eventyr'] }),
  c({ id: 'antennae', slot: 'hat', name: 'Følehorn', price: 25, rarity: 'shop', shop: 'kostyme', shape: 'antennae', colors: { main: '#2a2230', second: '#ffd23f' }, tags: ['dyr', 'verdensrom'] }),
  c({ id: 'eyepatch', slot: 'face', name: 'Øyeklapp', price: 15, rarity: 'shop', shop: 'kostyme', shape: 'eyepatch', colors: { main: '#2a2230' }, tags: ['eventyr'] }),
  c({ id: 'cat-nose', slot: 'face', name: 'Kattesnute', price: 20, rarity: 'shop', shop: 'kostyme', shape: 'nose', colors: { main: '#ff8ae0', second: '#2a2230' }, tags: ['dyr'] }),
  c({ id: 'bee-wings', slot: 'back', name: 'Bievinger', price: 35, rarity: 'shop', shop: 'kostyme', shape: 'bee', colors: { main: '#e8f8ff', second: '#2a2230' }, tags: ['dyr'] }),
  c({ id: 'dragon-wings', slot: 'back', name: 'Dragevinger', price: 70, rarity: 'shop', shop: 'kostyme', shape: 'bat', colors: { main: '#ff5f4f', second: '#ffb040', accent: '#ffe14f' }, tags: ['eventyr', 'dyr'] }),
  c({ id: 'turtle-shell', slot: 'back', name: 'Skilpaddeskall', price: 45, rarity: 'shop', shop: 'kostyme', shape: 'shell', colors: { main: '#3fae5a', second: '#9fef5a', accent: '#8a5632' }, tags: ['dyr', 'strand'] }),
]

/** What every new player owns, and what a new person wears. */
export const STARTER_CLOSET = ['tee-white', 'tee-blue', 'jeans', 'sneakers-white']
export const STARTER_OUTFIT: Outfit = { top: 'tee-white', bottom: 'jeans', shoes: 'sneakers-white', hat: null, face: null, back: null }

export const SLOT_NAMES: Record<ClothingSlot, string> = {
  top: 'Overdel', bottom: 'Underdel', shoes: 'Sko', hat: 'Hode', face: 'Ansikt', back: 'Rygg',
}

// ---------------------------------------------------------------- furniture

const f = (d: FurnitureDef): FurnitureDef => d

export const FURNITURE: FurnitureDef[] = [
  // sleeping, sitting
  f({ id: 'bed', name: 'Seng', price: 30, rarity: 'shop', kind: 'floor', size: [1, 2], model: 'bed', colors: { main: '#4fb8ff', second: '#f4f0ff', accent: '#8a5632' }, use: 'sleep' }),
  f({ id: 'bed-canopy', name: 'Himmelseng', price: 120, rarity: 'shop', kind: 'floor', size: [2, 2], model: 'canopyBed', colors: { main: '#ff8ae0', second: '#fff4ff', accent: '#ffd23f' }, use: 'sleep' }),
  f({ id: 'sofa', name: 'Sofa', price: 45, rarity: 'shop', kind: 'floor', size: [2, 1], model: 'sofa', colors: { main: '#9a4ff0', second: '#c8a0ff' }, use: 'sit' }),
  f({ id: 'sofa-pink', name: 'Rosa sofa', price: 45, rarity: 'shop', kind: 'floor', size: [2, 1], model: 'sofa', colors: { main: '#ff8ae0', second: '#ffd0f0' }, use: 'sit' }),
  f({ id: 'armchair', name: 'Lenestol', price: 25, rarity: 'shop', kind: 'floor', size: [1, 1], model: 'armchair', colors: { main: '#6fe07f', second: '#b8f5c0' }, use: 'sit' }),
  f({ id: 'chair', name: 'Stol', price: 10, rarity: 'shop', kind: 'floor', size: [1, 1], model: 'chair', colors: { main: '#e0a47a', second: '#ff8ae0' }, use: 'sit' }),
  f({ id: 'beanbag', name: 'Saccosekk', price: 20, rarity: 'shop', kind: 'floor', size: [1, 1], model: 'beanbag', colors: { main: '#ff9f3f' }, use: 'sit' }),
  f({ id: 'throne', name: 'Trone', price: 150, rarity: 'shop', kind: 'floor', size: [1, 1], model: 'throne', colors: { main: '#ffd23f', second: '#b01874', accent: '#2ff3ff' }, use: 'sit' }),
  // tables and storage
  f({ id: 'table-round', name: 'Rundt bord', price: 25, rarity: 'shop', kind: 'floor', size: [1, 1], surface: 0.75, model: 'tableRound', colors: { main: '#f4f0ff', second: '#e0a47a' } }),
  f({ id: 'table-long', name: 'Langbord', price: 35, rarity: 'shop', kind: 'floor', size: [2, 1], surface: 0.75, model: 'tableLong', colors: { main: '#b97a50', second: '#8a5632' } }),
  f({ id: 'bookshelf', name: 'Bokhylle', price: 30, rarity: 'shop', kind: 'floor', size: [1, 1], surface: 1.6, model: 'bookshelf', colors: { main: '#8a5632', second: '#ff6fb0', accent: '#4fb8ff' } }),
  f({ id: 'dresser', name: 'Kommode', price: 30, rarity: 'shop', kind: 'floor', size: [1, 1], surface: 0.9, model: 'dresser', colors: { main: '#fff1b0', second: '#ff9f3f' } }),
  f({ id: 'kitchen', name: 'Kjøkkenbenk', price: 70, rarity: 'shop', kind: 'floor', size: [2, 1], surface: 0.9, model: 'kitchen', colors: { main: '#f4f0ff', second: '#6fe07f', accent: '#c8c0e0' } }),
  f({ id: 'fridge', name: 'Kjøleskap', price: 40, rarity: 'shop', kind: 'floor', size: [1, 1], model: 'fridge', colors: { main: '#c4fbff', second: '#ff8ae0' } }),
  // fun
  f({ id: 'tv', name: 'TV', price: 50, rarity: 'shop', kind: 'floor', size: [1, 1], model: 'tv', colors: { main: '#2a2230', second: '#4fb8ff' }, use: 'light' }),
  f({ id: 'piano', name: 'Piano', price: 90, rarity: 'shop', kind: 'floor', size: [2, 1], model: 'piano', colors: { main: '#15101a', second: '#f4f0ff' }, use: 'music' }),
  f({ id: 'aquarium', name: 'Akvarium', price: 70, rarity: 'shop', kind: 'floor', size: [2, 1], model: 'aquarium', colors: { main: '#4fb8ff', second: '#ff9f3f', accent: '#6fe07f' }, use: 'swim' }),
  f({ id: 'fireplace', name: 'Peis', price: 80, rarity: 'shop', kind: 'floor', size: [2, 1], surface: 1.1, model: 'fireplace', colors: { main: '#c8c0e0', second: '#ff9f3f' }, use: 'light' }),
  f({ id: 'bathtub', name: 'Badekar', price: 60, rarity: 'shop', kind: 'floor', size: [2, 1], model: 'bathtub', colors: { main: '#f4f0ff', second: '#8fd8ff' }, use: 'swim' }),
  f({ id: 'dollhouse', name: 'Dukkehus', price: 45, rarity: 'shop', kind: 'floor', size: [1, 1], model: 'dollhouse', colors: { main: '#ffb0d8', second: '#ffe14f' } }),
  f({ id: 'trampoline', name: 'Trampoline', price: 60, rarity: 'shop', kind: 'floor', size: [2, 2], model: 'trampoline', colors: { main: '#2a2230', second: '#4fb8ff' }, use: 'bounce' }),
  f({ id: 'slide', name: 'Sklie', price: 80, rarity: 'shop', kind: 'floor', size: [1, 3], model: 'slide', colors: { main: '#ffe14f', second: '#ff3b5c' }, use: 'slide' }),
  f({ id: 'disco', name: 'Diskokule', price: 55, rarity: 'shop', kind: 'floor', size: [1, 1], model: 'disco', colors: { main: '#c8c0e0', second: '#ff8ae0' }, use: 'light' }),
  f({ id: 'cat-bed', name: 'Kattekurv', price: 20, rarity: 'shop', kind: 'floor', size: [1, 1], model: 'catBed', colors: { main: '#e07a4e', second: '#ff9f3f' }, use: 'sleep' }),
  f({ id: 'plant-big', name: 'Stor plante', price: 12, rarity: 'shop', kind: 'floor', size: [1, 1], model: 'plantBig', colors: { main: '#3fb870', second: '#e07a4e' } }),
  f({ id: 'lamp-floor', name: 'Stålampe', price: 15, rarity: 'shop', kind: 'floor', size: [1, 1], model: 'lampFloor', colors: { main: '#fff1b0', second: '#2a2230' }, use: 'light' }),
  f({ id: 'balloons', name: 'Ballonger', price: 10, rarity: 'shop', kind: 'floor', size: [1, 1], model: 'balloons', colors: { main: '#ff3b5c', second: '#4fb8ff', accent: '#ffe14f' } }),
  // rugs
  f({ id: 'rug-round', name: 'Rundt teppe', price: 15, rarity: 'shop', kind: 'rug', size: [2, 2], model: 'rugRound', colors: { main: '#ffb0d8', second: '#ff6fb0' } }),
  f({ id: 'rug-rainbow', name: 'Regnbueteppe', price: 30, rarity: 'shop', kind: 'rug', size: [3, 2], model: 'rugRainbow', colors: { main: '#ff6fb0' } }),
  f({ id: 'rug-star', name: 'Stjerneteppe', price: 25, rarity: 'shop', kind: 'rug', size: [2, 2], model: 'rugStar', colors: { main: '#2a1a4c', second: '#ffe14f' } }),
  // small things (stand on the floor or on a surface)
  f({ id: 'lamp-table', name: 'Bordlampe', price: 10, rarity: 'shop', kind: 'small', size: [1, 1], model: 'lampTable', colors: { main: '#ff8ae0', second: '#fff1b0' }, use: 'light' }),
  f({ id: 'plant-small', name: 'Liten plante', price: 6, rarity: 'shop', kind: 'small', size: [1, 1], model: 'plantSmall', colors: { main: '#6fe07f', second: '#ff9f3f' } }),
  f({ id: 'vase', name: 'Blomstervase', price: 8, rarity: 'shop', kind: 'small', size: [1, 1], model: 'vase', colors: { main: '#4fb8ff', second: '#ff3b5c', accent: '#ffe14f' } }),
  f({ id: 'teddy', name: 'Bamse', price: 12, rarity: 'shop', kind: 'small', size: [1, 1], model: 'teddy', colors: { main: '#b97a50', second: '#ffb0d8' } }),
  f({ id: 'cake', name: 'Bløtkake', price: 15, rarity: 'shop', kind: 'small', size: [1, 1], model: 'cake', colors: { main: '#fff4ff', second: '#ff3b5c' } }),
  f({ id: 'goldfish', name: 'Gullfiskbolle', price: 18, rarity: 'shop', kind: 'small', size: [1, 1], model: 'fishbowl', colors: { main: '#c4fbff', second: '#ff9f3f' }, use: 'swim' }),
  // wall
  f({ id: 'painting-sun', name: 'Solmaleri', price: 20, rarity: 'shop', kind: 'wall', size: [1, 1], model: 'painting', colors: { main: '#ffe14f', second: '#4fb8ff', accent: '#8a5632' } }),
  f({ id: 'painting-cat', name: 'Kattemaleri', price: 20, rarity: 'shop', kind: 'wall', size: [1, 1], model: 'painting', colors: { main: '#ff9f3f', second: '#6fe07f', accent: '#ffd23f' } }),
  f({ id: 'clock', name: 'Klokke', price: 15, rarity: 'shop', kind: 'wall', size: [1, 1], model: 'clock', colors: { main: '#f4f0ff', second: '#ff3b5c' } }),
  f({ id: 'mirror', name: 'Speil', price: 25, rarity: 'shop', kind: 'wall', size: [1, 1], model: 'mirror', colors: { main: '#c4fbff', second: '#ffd23f' } }),
  f({ id: 'window', name: 'Vindu', price: 20, rarity: 'shop', kind: 'wall', size: [1, 1], model: 'window', colors: { main: '#8fd8ff', second: '#f4f0ff' } }),
  f({ id: 'fairy-lights', name: 'Lysslynge', price: 25, rarity: 'shop', kind: 'wall', size: [2, 1], model: 'fairyLights', colors: { main: '#ffe14f', second: '#ff8ae0', accent: '#2ff3ff' }, use: 'light' }),
  // prizes: trophies from the contests
  f({ id: 'trophy-easy', name: 'Obby-pokal (bronse)', price: 0, rarity: 'prize', kind: 'small', size: [1, 1], model: 'trophy', colors: { main: '#e07a4e', second: '#8a5632' } }),
  f({ id: 'trophy-medium', name: 'Obby-pokal (sølv)', price: 0, rarity: 'prize', kind: 'small', size: [1, 1], model: 'trophy', colors: { main: '#c8c0e0', second: '#5a5285' } }),
  f({ id: 'trophy-hard', name: 'Obby-pokal (gull)', price: 0, rarity: 'prize', kind: 'small', size: [1, 1], model: 'trophy', colors: { main: '#ffd23f', second: '#c4861c' } }),
  f({ id: 'trophy-stars', name: 'Stjernepokal', price: 0, rarity: 'prize', kind: 'small', size: [1, 1], model: 'trophyStar', colors: { main: '#ffe14f', second: '#4fb8ff' } }),
  f({ id: 'trophy-fashion', name: 'Motepokal', price: 0, rarity: 'prize', kind: 'small', size: [1, 1], model: 'trophyStar', colors: { main: '#ff8ae0', second: '#9a4ff0' } }),
  f({ id: 'trophy-memory', name: 'Huskepokal', price: 0, rarity: 'prize', kind: 'small', size: [1, 1], model: 'trophy', colors: { main: '#6fe07f', second: '#2f6fd0' } }),
  f({ id: 'royal-banner', name: 'Kongelig banner', price: 0, rarity: 'royal', kind: 'wall', size: [1, 1], model: 'banner', colors: { main: '#9a4ff0', second: '#ffd23f' } }),
]

export const FLOORS: SurfaceDef[] = [
  { id: 'floor-wood', name: 'Tregulv', price: 0, colors: { main: '#c8905a', second: '#a8703e' }, pattern: 'wood' },
  { id: 'floor-pink', name: 'Rosa fliser', price: 20, colors: { main: '#ffd0f0', second: '#ffb0d8' }, pattern: 'tiles' },
  { id: 'floor-checker', name: 'Sjakkgulv', price: 20, colors: { main: '#f4f0ff', second: '#2a2230' }, pattern: 'checks' },
  { id: 'floor-grass', name: 'Gressteppe', price: 25, colors: { main: '#6fe07f', second: '#3fb870' }, pattern: 'grass' },
  { id: 'floor-stars', name: 'Stjernegulv', price: 30, colors: { main: '#2a1a4c', second: '#ffe14f' }, pattern: 'stars' },
  { id: 'floor-marble', name: 'Marmor', price: 40, colors: { main: '#f4f0ff', second: '#c8c0e0' }, pattern: 'marble' },
  { id: 'floor-rainbow', name: 'Regnbuegulv', price: 50, colors: { main: '#ff6fb0' }, pattern: 'rainbow' },
]

export const WALLS: SurfaceDef[] = [
  { id: 'wall-cream', name: 'Lys vegg', price: 0, colors: { main: '#fff1dc', second: '#f0dcc0' }, pattern: 'plain' },
  { id: 'wall-stripes', name: 'Rosa striper', price: 20, colors: { main: '#ffd0f0', second: '#ffb0d8' }, pattern: 'stripes' },
  { id: 'wall-dots', name: 'Blå prikker', price: 20, colors: { main: '#c4e8ff', second: '#4fb8ff' }, pattern: 'dots' },
  { id: 'wall-hearts', name: 'Hjertetapet', price: 25, colors: { main: '#fff4ff', second: '#ff6fb0' }, pattern: 'hearts' },
  { id: 'wall-flowers', name: 'Blomstertapet', price: 25, colors: { main: '#e8ffe8', second: '#ff8ae0', accent: '#ffe14f' }, pattern: 'flowers' },
  { id: 'wall-night', name: 'Stjernehimmel', price: 30, colors: { main: '#1c1440', second: '#ffe14f' }, pattern: 'stars' },
  { id: 'wall-rainbow', name: 'Regnbuetapet', price: 50, colors: { main: '#ff6fb0' }, pattern: 'rainbow' },
]

export const STARTER_FLOOR = 'floor-wood'
export const STARTER_WALL = 'wall-cream'
/** Furniture a new player gets for free, placed by `newSave` (a bed and a lamp, so the house is not bare). */
export const STARTER_FURNITURE = ['bed', 'lamp-floor', 'plant-small']

// ---------------------------------------------------------------- workshop

export const WEAPON_BASES: WeaponBaseDef[] = [
  { id: 'wand', name: 'Tryllestav', price: 20 },
  { id: 'sword', name: 'Sverd', price: 25 },
  { id: 'hammer', name: 'Pipehammer', price: 25 },
  { id: 'blaster', name: 'Blaster', price: 30 },
  { id: 'bow', name: 'Bue', price: 30 },
]

export const WEAPON_MAGIC: WeaponMagicDef[] = [
  { id: 'bubbles', name: 'Boble', price: 10, colors: ['#c4fbff', '#8fd8ff', '#ffb0d8'] },
  { id: 'stars', name: 'Stjerne', price: 15, colors: ['#ffe14f', '#fff1b0', '#ff9f3f'] },
  { id: 'hearts', name: 'Hjerte', price: 15, colors: ['#ff3b8a', '#ff8ae0', '#ffb0d8'] },
  { id: 'flowers', name: 'Blomster', price: 20, colors: ['#ff8ae0', '#ffe14f', '#6fe07f'] },
  { id: 'snow', name: 'Snø', price: 20, colors: ['#ffffff', '#c4fbff', '#8fd8ff'] },
  { id: 'confetti', name: 'Konfetti', price: 20, colors: ['#ff4f6f', '#ffe14f', '#4fb8ff', '#6fe07f', '#a86fff'] },
  { id: 'rainbow', name: 'Regnbue', price: 30, colors: RAINBOW },
  { id: 'lightning', name: 'Lyn', price: 30, colors: ['#fff1b0', '#2ff3ff', '#ffffff'] },
  { id: 'dragon', name: 'Drage', price: 40, colors: ['#ff9f3f', '#ff4f6f', '#ffe14f'] },
]

/** Colours the workshop offers for a weapon. */
export const WEAPON_COLORS = ['#ff8ae0', '#4fb8ff', '#ffd23f', '#6fe07f', '#9a4ff0', '#ff3b5c', '#f4f0ff', '#2a2230']

/** Upgrade cost from `level` to `level + 1` (bits). */
export function upgradeCost(basePrice: number, level: 1 | 2): number {
  return level === 1 ? Math.max(10, Math.round(basePrice * 0.5)) : Math.max(20, basePrice)
}

// ---------------------------------------------------------------- lookups

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map(x => [x.id, x]))
const CLOTHES_BY_ID = byId(CLOTHES)
const FURNITURE_BY_ID = byId(FURNITURE)
const FLOORS_BY_ID = byId(FLOORS)
const WALLS_BY_ID = byId(WALLS)

export const clothing = (id: string | null | undefined): ClothingDef | undefined => (id ? CLOTHES_BY_ID.get(id) : undefined)
export const furniture = (id: string | null | undefined): FurnitureDef | undefined => (id ? FURNITURE_BY_ID.get(id) : undefined)
export const floorDef = (id: string): SurfaceDef | undefined => FLOORS_BY_ID.get(id)
export const wallDef = (id: string): SurfaceDef | undefined => WALLS_BY_ID.get(id)
export const weaponBase = (id: string) => WEAPON_BASES.find(b => b.id === id)
export const weaponMagic = (id: string) => WEAPON_MAGIC.find(m => m.id === id)

/** A top that covers the legs, so the bottom is not drawn (dresses, gowns, a whole-body onesie). */
export const coversLegs = (topId: string): boolean => {
  const s = clothing(topId)?.shape
  return s === 'dress' || s === 'gown' || s === 'onesie'
}

/** A bottom that covers the feet (a mermaid tail): no shoes are drawn. */
export const coversFeet = (outfit: { top: string; bottom: string }): boolean =>
  !coversLegs(outfit.top) && clothing(outfit.bottom)?.shape === 'mermaid'

/** The clothes a shop sells: Klesbutikken (`'klær'`) sells every shop piece without a `shop`. */
export const shopClothes = (shop: ClothesShopId | 'klær'): ClothingDef[] =>
  CLOTHES.filter(d => d.rarity === 'shop' && d.price > 0 && (d.shop ?? 'klær') === shop)

export const FASHION_TAGS: { id: FashionTag; name: string }[] = [
  { id: 'sport', name: 'Sport' },
  { id: 'fest', name: 'Fest' },
  { id: 'strand', name: 'Stranda' },
  { id: 'vinter', name: 'Vinter' },
  { id: 'prinsesse', name: 'Prinsesse' },
  { id: 'verdensrom', name: 'Verdensrommet' },
  { id: 'eventyr', name: 'Eventyr' },
  { id: 'dyr', name: 'Dyr' },
  { id: 'regnbue', name: 'Regnbue' },
]
