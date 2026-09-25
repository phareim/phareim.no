/**
 * Parlour (Kjell's floor, 400 wide). Aunt Hedvig's endless séance for "the
 * spirits of the living", her poker on its hook by the fire (hers until the
 * séance is done), the moose in a party hat, the piano, the gramophone.
 *
 * `seance` is the séance itself: the roof's chimney runs it when Espen
 * talks down it (Espen is the hero; Hedvig answers from the parlour, and
 * the view cuts down to her and back).
 */
import type { Ctx, Handler, HotspotDef, RoomDef, Script } from '../../types'
import { F } from '../flags'
import { warmHouse } from './foyer'

const H = (c: Ctx, text: string) => c.sayAs('hedvig', text)

/** The séance, seen from the roof: Espen down the chimney, Hedvig at her table. */
export const seance: Handler = function* (c) {
  yield c.sfx('ghost-woo')
  if (c.is(F.seanceDone)) {
    yield c.say('Hello again, down there! It\'s the spirits of the living!')
    yield c.view('parlour', true)
    yield H(c, 'Spirits! I\'ve done as you asked. The rabbit may take the poker. Do write.')
    yield c.view(null, true)
    return
  }
  yield c.say(c.pick(['Helloooo down there! This is Espen, from the podcast! Can anybody hear me?', 'Hello? HELLO? Is anyone down there? This is for episode twelve!']))
  yield c.music('seance')
  c.set('parlour.seanceLive')
  yield c.pose('trance', undefined, 'hedvig')
  yield c.view('parlour', true)
  yield c.sfx('ghost-gasp')
  yield H(c, 'A voice! From the beyond! From… above! Just as the book said. Speak, spirit!')
  yield H(c, 'Are you… could you be… a spirit of the LIVING?')
  const who: string = yield c.choose([
    { id: 'yes', text: 'Yes! Very living. Extremely alive. Eleven listeners alive.' },
    { id: 'ghost', text: 'No, I\'m a ghost hunter. Are you a ghost? Say something spooky!' },
    { id: 'wrong', text: 'Sorry, wrong chimney.' },
  ])
  if (who === 'wrong') {
    yield H(c, 'Wrong chimney? There\'s only one chimney! Come back, spirit!')
    yield* endSeance(c, false)
    return
  }
  if (who === 'ghost') {
    yield c.pose('shock', undefined, 'hedvig')
    yield H(c, 'A HUNTER? Hunt somewhere else, dear. I\'m in session.')
    yield c.say('No, wait, I only hunt them with a microphone!')
    yield c.pose('trance', undefined, 'hedvig')
    yield H(c, 'Hmph. Very well. But you sound very alive for a ghost hunter. Are you a spirit of the living or not?')
    yield c.say('I am! Totally! Living, and a spirit, and very much of the living.')
  }
  yield H(c, 'At last! Ninety-four years of teacups and nobody from your side ever called.')
  yield H(c, 'But I must be sure. Anyone can shout down a chimney. Uncle Harald did it for decades.')
  yield H(c, 'Tell me, spirit. What did my Torvald call his beard?')
  for (let tries = 0; tries < 20; tries++) {
    const a: string = yield c.choose([
      { id: 'sigurd', text: 'Sigurd.', when: c.is(F.lettersRead) },
      { id: 'olav', text: 'Olav?' },
      { id: 'beardy', text: 'Mr Beardy?' },
      { id: 'fluffy', text: 'Fluffy?' },
      { id: 'later', text: 'I… will get back to you on that.' },
    ])
    if (a === 'sigurd') {
      yield c.pose('shock', undefined, 'hedvig')
      yield c.sfx('ghost-gasp')
      yield H(c, 'SIGURD! Oh, Sigurd. He combed him every evening. Nobody else in the world knew that name.')
      c.set(F.seanceDone)
      yield c.solve('seance')
      yield c.pose('trance', undefined, 'hedvig')
      yield H(c, 'The spirits of the living have spoken! Ask, spirit. Whatever you want from this side is yours.')
      yield c.say('Great! Could the living have, um… what have you got?')
      yield H(c, 'My pearls? My tea? My poker? My spare séance?')
      yield c.say('The poker! Sounds useful. Give the poker to the tall worried rabbit downstairs. His name is Kjell.')
      yield H(c, 'The rabbit may have my poker. The living have decreed it. I shall inform the paperwork.')
      yield c.say('Episode twelve. EPISODE TWELVE.')
      yield* endSeance(c, true)
      return
    }
    if (a === 'later') {
      yield H(c, 'The spirits are shy tonight. I\'ll keep the tea warm. I always keep the tea warm.')
      yield* endSeance(c, false)
      return
    }
    yield c.pose('shock', 1, 'hedvig')
    if (a === 'olav') yield H(c, 'Olav was his BROTHER. The beard and Olav did not get on.')
    else if (a === 'beardy') yield H(c, 'Mr Beardy? Torvald was a sea captain, not a birthday clown.')
    else yield H(c, 'Fluffy was the cat. The old cat, before the present cat. Before… the present cat.')
    yield H(c, c.pick(['Wrong! Try again, spirit. I have all night. I have all eternity, actually.', 'No. Think, spirit. What would a sea captain call his beard?', 'Wrong again. The spirits of the living are worse at this than the dead.']))
    if (!c.is(F.lettersRead) && tries === 1) yield c.say('I need to find out about Torvald. There must be something about him in this house. Old letters, maybe.')
  }
  yield* endSeance(c, false)
}

function* endSeance(c: Ctx, done: boolean): Script {
  c.clear('parlour.seanceLive')
  yield c.pose('', undefined, 'hedvig')
  yield c.view(null, true)
  yield c.music('auto')
  if (!done) yield c.say(c.pick(['She\'s still down there. Waiting for the right answer.', 'Torvald\'s beard. Who names a beard?']))
}

const hedvig: HotspotDef = {
  id: 'hedvig',
  name: 'Aunt Hedvig',
  rect: [180, 50, 34, 48],
  at: [234, 128],
  face: 'left',
  actor: 'hedvig',
  z: 3,
  verbs: {
    look: function* (c) {
      yield c.say('A ghost. A green, see-through lady in pearls, having tea at a séance table. That\'s a ghost.')
      yield c.say('Espen would give a kidney for this. I would give a kidney to be in my Volvo.')
    },
    talk: function* (c) {
      if (!c.is('parlour.met')) {
        c.set('parlour.met')
        yield c.pose('shock', 1.2, 'hedvig')
        yield H(c, 'Oh! A rabbit! How festive. Do come in, dear. Don\'t touch the ball.')
        yield c.say('I\'m… not really a rabbit. It\'s a costume. We thought it was a party. It was a quiz.')
        yield H(c, 'Aren\'t we all, dear. Aren\'t we all.')
      } else yield H(c, c.pick(['Back again, rabbit? The spirits are on hold.', 'Hush, dear. I\'m listening for the living.', 'Tea? It\'s ghost tea. It goes straight through you.']))
      for (let i = 0; i < 30; i++) {
        const id: string = yield c.choose([
          { id: 'who', text: 'Who are you?' },
          { id: 'what', text: 'What are you doing?' },
          { id: 'me', text: 'I\'m alive! You can talk to me.', when: c.is('parlour.askedWhat') },
          { id: 'poker', text: 'Could I borrow your poker?', when: !c.is(F.pokerTaken) },
          { id: 'prof', text: 'Where is the Professor?' },
          { id: 'battery', text: 'Have you seen a car battery?' },
          { id: 'torvald', text: 'Who was Torvald?', when: c.is(F.lettersRead) || c.has('letters') },
          { id: 'sigurd', text: 'Sigurd says hello.', when: c.is(F.lettersRead) && !c.is(F.seanceDone) },
          { id: 'bye', text: 'I\'ll let you get back to it.' },
        ])
        if (id === 'bye') {
          yield H(c, 'Do. And shut the door on your way out. There\'s a draught from the other side.')
          return
        }
        yield* answer(c, id)
      }
    },
    pickup: function* (c) {
      yield c.say('I reach for her and my hand goes right through. It\'s like putting my arm in a fridge.')
      yield H(c, 'Do you MIND, dear?')
    },
    push: 'My hand goes through her. She shivers. I shiver. We\'re even.',
    pull: 'My hand goes through her. She shivers. I shiver. We\'re even.',
  },
  giveWith: {
    sandwich: function* (c) { yield H(c, 'Ghosts don\'t eat, dear. We just look at food wistfully.'); yield H(c, 'Ham. With butter. Oh, go away.') },
    umbrella: function* (c) { yield H(c, 'Keep it, dear. Rain goes straight through me. So does everything. It\'s very freeing.') },
    letters: function* (c) {
      yield c.pose('shock', 1.5, 'hedvig')
      yield H(c, 'Torvald\'s hand! Put those away, dear. I shan\'t read old letters with a rabbit.')
      yield H(c, 'If the spirits of the living want to tell me something, they can say it themselves. From above.')
    },
    monocle: function* (c) { yield H(c, 'Ottilie\'s monocle! She never went anywhere without it. Well. She went somewhere without it.') },
    cat: function* (c) {
      yield H(c, 'Hello, Ottilie. …I mean, hello, puss. Force of habit.')
      yield c.say('Did you just call the cat Ottilie?')
      yield H(c, 'Did I? It must be the tea.')
    },
    poker: function* (c) { yield H(c, 'No, no, you keep it, dear. The living decreed it. I don\'t argue with the living. It\'s bad manners.') },
    sardines: function* (c) { yield H(c, 'Sardines? Give those to the cat. No, don\'t. She\'ll be insulted. She has standards.') },
    manual: function* (c) { yield H(c, '"Volvo 240, owner\'s manual." Is this a book of spells?'); yield c.say('In a way. Yes.') },
  },
  anyItem: function* (c) { yield H(c, 'Put it on the table, dear, and the spirits will think we\'re having a jumble sale.') },
}

function* answer(c: Ctx, id: string): Script {
  switch (id) {
    case 'who':
      yield H(c, 'Hedvig Voltvik. Aunt to the Professor, medium to the stars, and since 1931, deceased.')
      yield H(c, 'Mostly deceased. I kept the pearls.')
      return
    case 'what':
      c.set('parlour.askedWhat')
      yield H(c, 'A séance, dear. I\'m contacting the spirits of the living.')
      yield c.say('Isn\'t it usually the other way round?')
      yield H(c, 'Exactly! The dead get all the attention. Nobody ever asks the living how THEY are doing.')
      return
    case 'me':
      yield H(c, 'You\'re living, dear, but you\'re not a SPIRIT of the living. There\'s a difference.')
      yield H(c, 'There\'s paperwork.')
      yield c.say('So where does a spirit of the living come from?')
      yield H(c, 'From above, of course. They always come from above. Down the chimney, if they have any manners.')
      return
    case 'poker':
      if (c.is(F.seanceDone)) {
        yield H(c, 'The spirits of the living have spoken. The poker is yours, rabbit. Mind the brass knob.')
        return
      }
      yield H(c, 'My poker? Certainly not. It\'s for the spirits of the living, when they come. They\'re always cold.')
      yield H(c, 'Only a spirit of the living may say who touches that poker.')
      return
    case 'prof':
      yield H(c, 'Ottilie? She went down to her laboratory in 1987 to bottle lightning. Midnight, she said. Maximum voltage.')
      yield H(c, 'The clock stopped at 11:59 that night, and it hasn\'t moved since. The cat arrived that very night, too.')
      yield H(c, 'Odd little thing. Takes her tea with lemon. Reads over your shoulder.')
      return
    case 'battery':
      yield H(c, 'A battery? Uncle Harald had a battery. Of artillery. We don\'t talk about Uncle Harald.')
      yield c.say('A car battery. Twelve volts. Brunhilde\'s is cracked.')
      yield H(c, 'Ottilie put one into her lightning machine, down in the cellar. She called it the machine\'s heart.')
      return
    case 'torvald':
      yield H(c, 'Torvald! My Torvald. A sea captain with the kindest eyes and the finest beard on the coast.')
      yield H(c, 'If you\'re going to make me cry, dear, warn me first. Ectoplasm stains.')
      return
    case 'sigurd':
      yield c.pose('shock', 1.5, 'hedvig')
      yield H(c, 'SIGURD? How does a living rabbit know about Sigurd?')
      yield H(c, 'You\'ve been snooping. No, dear. The spirits of the living must say it themselves. From above.')
      return
  }
}

const crystalBall: HotspotDef = {
  id: 'ball',
  name: 'crystal ball',
  rect: [189, 88, 14, 14],
  at: [234, 128],
  face: 'left',
  z: 4,
  verbs: {
    look: 'A crystal ball. Inside I can see a worried face in a rabbit hood. It\'s mine. It\'s always mine.',
    pickup: function* (c) {
      yield c.pose('shock', 0.8, 'hedvig')
      yield H(c, 'Hands off the ball, dear. It\'s tuned.')
    },
    use: function* (c) {
      yield c.say('I wave my hands over it. Mysteriously.')
      yield H(c, 'Stop that. You\'ll get the spirits of the dead again, and they never stop talking.')
    },
    talk: function* (c) {
      yield c.say('Hello? Spirits? Tow truck?')
      yield H(c, 'They don\'t take calls from rabbits, dear.')
    },
  },
}

const table: HotspotDef = {
  id: 'table',
  name: 'séance table',
  rect: [168, 94, 58, 30],
  at: [234, 128],
  face: 'left',
  z: 1,
  verbs: {
    look: 'A round table with a velvet cloth, a crystal ball and four teacups, one for each spirit. All the cups are full. None of them are drunk.',
    pickup: 'I lift a teacup. It\'s full of cold tea and one very old lemon slice. I put it back, carefully.',
    push: 'It won\'t move. It has been in session since 1931.',
    use: 'I knock on the table, séance-style. Nothing knocks back. Good.',
  },
}

const poker: HotspotDef = {
  id: 'poker',
  name: 'poker',
  rect: [101, 56, 10, 42],
  at: [106, 112],
  face: 'up',
  z: 2,
  when: s => !s.flags[F.pokerTaken],
  verbs: {
    look: c => c.is(F.seanceDone)
      ? 'The poker. Long, iron, a brass knob. Hedvig has been told it\'s mine now. By the living.'
      : 'A long iron poker with a brass knob, on a hook by the fire. Hedvig keeps one eye on it at all times.',
    pickup: function* (c) {
      if (!c.is(F.seanceDone)) {
        yield c.pose('reach', 0.6)
        yield c.pose('shock', 1.4, 'hedvig')
        yield c.sfx('ghost-woo')
        yield H(c, 'Ah-ah-AH! Not the poker, dear. That poker is reserved for the spirits of the living.')
        yield c.pose('scared', 0.8)
        yield c.say('I let go. She said "dear" in a way that made my ears go flat.')
        return
      }
      c.give('poker')
      c.set(F.pokerTaken)
      yield c.sfx('pickup')
      yield c.solve('poker')
      yield H(c, 'Take it, rabbit. The living decreed it. Mind the brass.')
      yield c.say('A long iron rod. Good for heat. Probably good for electricity too. Hm.')
    },
    use: 'I\'d need to pick it up first. And I\'d need Hedvig\'s blessing for that.',
    pull: 'I\'d need to pick it up first. And I\'d need Hedvig\'s blessing for that.',
  },
}

const fireplace: HotspotDef = {
  id: 'fireplace',
  name: 'fireplace',
  rect: [26, 54, 76, 50],
  at: [64, 114],
  face: 'up',
  verbs: {
    look: 'A roaring fire. The chimney goes straight up through the house to the roof. Sound must carry all the way down.',
    use: 'I warm my hands. The fire is the only thing here that hasn\'t tried to eat, trap or growl at me.',
    talk: function* (c) {
      yield c.say('Hello? Anyone up the chimney?')
      yield c.say('Just wind, rain and, very far away, something that sounds like Espen narrating.')
    },
    pickup: 'It\'s a fire. I have learned that much in life.',
    open: 'It\'s already open. That\'s how fires work.',
    close: 'Hedvig would never forgive me. And I\'d never get warm.',
  },
  useWith: {
    matches: 'It\'s already lit. Wasting our only match on it would be like tipping a waiter who never came.',
    manual: 'Burn Brunhilde\'s manual? I\'d rather burn myself. Slightly. On a finger.',
    sandwich: 'Toast. Dag would approve. But it\'s not mine to toast.',
    sardines: 'Grilled sardines. The tin won\'t open, so it would be grilled tin.',
  },
  anyItem: 'I\'m not throwing that in the fire.',
}

const moose: HotspotDef = {
  id: 'moose',
  name: 'moose head',
  rect: [42, 4, 48, 46],
  at: [64, 114],
  face: 'up',
  verbs: {
    look: 'A moose head wearing a party hat. Either the party was a long time ago, or it never stopped.',
    talk: function* (c) {
      yield c.say('Happy birthday?')
      yield H(c, 'Don\'t encourage him, dear. He was the life of the party in 1926.')
    },
    pickup: 'It\'s his hat. It\'s his party.',
    pull: 'I tug the elastic of his hat. It snaps back. The moose looks at me. The other eye looks at the ceiling.',
  },
}

const windowHs: HotspotDef = {
  id: 'window',
  name: 'window',
  rect: [110, 10, 56, 64],
  at: [138, 112],
  face: 'up',
  verbs: {
    look: 'The storm, doing its absolute best. Down the drive, Brunhilde\'s hazard lights blink. She\'s waiting for me.',
    open: 'Painted shut. From the outside, somehow.',
    close: 'It\'s closed. The storm still gets in. Emotionally.',
    talk: 'Hang on, Brunhilde. I\'m coming. With a battery. Eventually.',
  },
}

const radiator: HotspotDef = {
  id: 'radiator',
  name: 'radiator',
  rect: [122, 78, 32, 20],
  at: [138, 112],
  face: 'up',
  z: 1,
  verbs: {
    look: c => c.is(F.furnaceLit) ? 'The radiator is hot and hissing. The furnace in the cellar is going.' : 'A cold radiator. The fire\'s doing all the work in here.',
    use: c => c.is(F.furnaceLit) ? 'Toasty. Dag did it. Of course Dag did it: it involved fire and it was near a pantry.' : 'Cold as a bank.',
  },
}

const piano: HotspotDef = {
  id: 'piano',
  name: 'piano',
  rect: [232, 28, 66, 74],
  at: [264, 112],
  face: 'up',
  verbs: {
    look: 'An upright piano with a candelabra, sheet music and a bust of a composer who looks a lot like the moose.',
    use: function* (c) {
      yield c.sfx('piano-plonk')
      const n = c.bump('parlour.piano')
      if (n === 1) {
        yield c.say('I play the only tune I know: the 1987 Volvo 240 advert. "Built to last… built for you…"')
        yield H(c, 'Bravo! Dreadful, but bravo.')
      } else yield c.say(c.pick(['Plonk. The middle C has died. It died a long time ago.', 'I play chopsticks. The moose seems to like it.', 'Plink, plonk. Hedvig\'s teacup trembles. That might be a review.']))
    },
    open: 'The lid\'s up. There are eighty-eight keys and at least thirty of them are opinions.',
    pickup: 'I\'m not a piano mover. I\'m a Volvo mover, and only by pushing.',
    talk: 'It says nothing. Very restful after the moose.',
    push: 'It groans across the floor half an inch. So do I.',
    close: 'I shut the lid. Hedvig tuts.',
  },
}

const gramophone: HotspotDef = {
  id: 'gramophone',
  name: 'gramophone',
  rect: [304, 22, 36, 80],
  at: [320, 112],
  face: 'up',
  verbs: {
    look: c => c.is('parlour.gramophone')
      ? 'A scratchy foxtrot from 1920-something. The horn is shaped like a very ambitious flower.'
      : 'A gramophone with a horn like an enormous golden flower. There\'s a record on it.',
    use: function* (c) {
      if (c.is('parlour.gramophone')) {
        c.clear('parlour.gramophone')
        yield c.sfx('gramophone')
        yield c.say('I lift the needle.')
        yield H(c, 'Ohhh. That was our song.')
        return
      }
      c.set('parlour.gramophone')
      yield c.sfx('gramophone')
      yield c.say('I wind it up and drop the needle. A scratchy foxtrot fills the room.')
      yield H(c, 'Oh, THIS one! Torvald and I danced to this at the lighthouse ball. His beard kept time.')
    },
    pull: 'I lift the needle.',
    pickup: 'It weighs as much as a small boat.',
    talk: 'I say something into the horn. It comes out of the horn. Louder. I apologise to the room.',
  },
}

const armchair: HotspotDef = {
  id: 'armchair',
  name: 'armchair',
  rect: [342, 52, 46, 50],
  at: [362, 112],
  face: 'up',
  verbs: {
    look: 'A big fat armchair with a lightning-bolt cushion. It has been sat in by the same bottom for eighty years.',
    use: function* (c) {
      yield c.pose('sit', 1.6)
      yield c.say('I sit. It swallows me up to the ears. It\'s the best thing that has happened to me tonight.')
      yield c.say('I get up before it digests me.')
    },
    push: 'It doesn\'t move. It\'s mostly stuffing and pride.',
    pickup: 'I take the cushion, look at it, and put it back. It\'s knitted. With a bolt. Of course.',
  },
}

const lamp: HotspotDef = {
  id: 'lamp',
  name: 'standard lamp',
  rect: [378, 20, 20, 20],
  at: [374, 112],
  face: 'up',
  z: 1,
  verbs: {
    look: 'A standard lamp with a fringed shade, glowing orange. Everything glows orange here. Except Hedvig.',
    use: 'I switch it off. Hedvig glows brighter, like a green nightlight. I switch it back on.',
  },
}

const painting: HotspotDef = {
  id: 'painting',
  name: 'painting',
  rect: [194, 26, 30, 24],
  at: [236, 112],
  face: 'left',
  z: 1,
  verbs: {
    look: 'A little painting of a boat in a storm. A bearded captain at the wheel. The beard is doing a lot of work.',
    pickup: 'It\'s crooked and it wants to stay crooked.',
  },
}

const toFoyer: HotspotDef = {
  id: 'to-foyer',
  name: 'foyer',
  rect: [0, 36, 20, 84],
  at: [15, 126],
  face: 'left',
  exit: { to: 'foyer', x: 410, y: 126, face: 'left' },
}

export const room: RoomDef = {
  id: 'parlour',
  name: 'Parlour',
  floor: 'ground',
  w: 400,
  enter: warmHouse,
  walk: [[[20, 110], [378, 105], [398, 142], [2, 142]]],
  blocks: [[[166, 100], [226, 100], [228, 124], [164, 124]]],
  hotspots: [hedvig, crystalBall, table, poker, fireplace, moose, windowHs, radiator, piano, gramophone, armchair, lamp, painting, toFoyer],
}
