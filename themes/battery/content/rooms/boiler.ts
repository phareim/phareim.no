/**
 * The boiler room (Dag, cellar). The cold furnace, the damp coal, the pipes
 * that run up through the whole house, and Mr Bones on his stool, shivering
 * so hard his jaw falls off. The iron door to the lab.
 *
 * Puzzles: 4 (furnace: refusal, kindling, lit), 5 (Bones' key, the lab
 * door), 6 (the jam lid on the lit furnace).
 *
 * Local flags: boiler.door (furnace door open), bones.met, bones.asked.<id>,
 * boiler.assembleAt (s.time when Bones started putting himself together:
 * the painter animates it), boiler.jaw (times the jaw has fallen off).
 */
import type { Ctx, RoomDef, Script } from '../../types'
import { F } from '../flags'

/** Where things are, for the painters and the story. */
export const BOILER = {
  furnace: { x: 88, door: [74, 70, 28, 26] as const },
  stool: { x: 290, y: 120 },
  labDoor: { x: 352, y: 114 },
}

const once = (c: Ctx, id: string) => !c.is('solved.' + id)

function* jawFalls(c: Ctx): Script {
  c.bump('boiler.jaw')
  yield c.sfx('bones-rattle')
  yield c.pose('nojaw', undefined, 'bones')
  yield c.sayAs('bones', c.pick(['Mmf. Nnf-nnf.', 'Hnn. Mmmf.', 'Nng-nng. Nnf.']))
  yield c.pose('pickup', 0.6)
  yield c.wait(0.3)
  yield c.say(c.pick(['Here. You dropped your face.', 'Got it. Again.', 'Your jaw, Mr Bones. It went under the stool.']))
  yield c.sfx('squeak')
  yield c.pose(c.is(F.furnaceLit) ? '' : 'shiver', undefined, 'bones')
  yield c.sayAs('bones', c.pick(['Most kind, sir.', 'Thank you, sir. It does that.', 'Apologies, sir. The cold.']))
}

/** The warm-up, the first time Dag talks to him after the furnace is lit. */
function* warmThanks(c: Ctx): Script {
  yield c.pose('', undefined, 'bones')
  yield c.sayAs('bones', 'Sir. Sir! Do you feel that? That is warmth. I have not felt warmth since 1987.')
  yield c.sayAs('bones', 'I have toes again. Well. I had them all along. But now I can feel them. I counted. Ten.')
  yield c.say('Glad to help. It was mostly Kjell\'s manual. Don\'t tell him.')
  yield c.sayAs('bones', 'Then allow me, sir. The Professor left this in my care, "for whoever brings the heat back".')
  yield c.pose('give', undefined, 'bones')
  yield c.sfx('pickup')
  yield c.pose('reach', 0.6)
  c.give('labkey', 'dag')
  c.set(F.bonesKey)
  if (once(c, 'bones-key')) yield c.solve('bones-key')
  yield c.wait(0.3)
  yield c.pose('', undefined, 'bones')
  yield c.sayAs('bones', 'The laboratory key. I believe she meant the heat literally. She usually did.')
  yield c.say('A key shaped like a lightning bolt. Subtle.')
}

interface Topic { id: string; text: string; when?: (c: Ctx) => boolean }

const TOPICS: Topic[] = [
  { id: 'cold', text: 'You look cold.', when: c => !c.is(F.furnaceLit) },
  { id: 'who', text: 'Who are you, exactly?' },
  { id: 'prof', text: 'Where\'s the Professor?' },
  { id: 'cat', text: 'Tell me about the cat.', when: c => c.is('bones.asked.prof') },
  { id: 'lab', text: 'What\'s behind the iron door?', when: c => !c.is(F.labOpen) },
  { id: 'lever', text: 'What does the big lever do?', when: c => c.is(F.labOpen) },
  { id: 'house', text: 'Is this house… alive?' },
  { id: 'food', text: 'Is there any food down here?' },
  { id: 'suit', text: 'I\'m not a rabbit, you know.' },
]

function options(c: Ctx) {
  const avail = TOPICS.filter(t => !t.when || t.when(c))
  const fresh = avail.filter(t => !c.is('bones.asked.' + t.id))
  const old = avail.filter(t => c.is('bones.asked.' + t.id))
  // The wide panel shows five lines: four topics and goodbye.
  const shown = [...fresh, ...old].slice(0, 4)
  return [
    ...shown.map(t => ({ id: t.id, text: t.text })),
    { id: 'bye', text: c.is(F.furnaceLit) ? 'Enjoy the warmth, Mr Bones.' : 'I\'ll let you get back to shivering.' },
  ]
}

function* answer(c: Ctx, id: string): Script {
  const lit = c.is(F.furnaceLit)
  const again = c.is('bones.asked.' + id)
  c.set('bones.asked.' + id)
  switch (id) {
    case 'cold':
      yield c.sayAs('bones', 'I have no flesh, sir, and the furnace has been out since 1987.')
      yield c.sayAs('bones', 'I am, if you will pardon the expression, chilled to the bone. There is nothing else to be chilled to.')
      yield* jawFalls(c)
      yield c.sayAs('bones', 'If one could light the furnace… but the coal is damp, there is no kindling, and I have no fingertips.')
      yield c.say('Damp coal. Needs something dry and boring under it. I know just the book.')
      return
    case 'who':
      yield c.sayAs('bones', 'Bones, sir. Mr Bones. Butler to Professor Voltvik since 1961.')
      yield c.sayAs('bones', 'I was fuller in the face then.')
      if (!again) yield c.say('You\'ve kept yourself well. Considering.')
      return
    case 'prof':
      yield c.sayAs('bones', 'On the twenty-fifth of September, 1987, at eleven fifty-nine, the Professor went into her laboratory.')
      yield c.sayAs('bones', 'There was a great flash. She did not come out. In the morning there was a cat.')
      yield c.sayAs('bones', 'A coincidence, I\'m sure. Very sure. Sir.')
      if (!lit) yield* jawFalls(c)
      return
    case 'cat':
      yield c.sayAs('bones', 'Mrs Whiskers arrived the night the Professor left. She takes her tea at four.')
      yield c.sayAs('bones', 'She sleeps on the refrigerator, corrects my posture, and has a ring round one eye. Just like a monocle.')
      yield c.say('Huh. The Professor had a monocle.')
      yield c.sayAs('bones', 'So she did, sir. So she did. I say nothing. I am a butler. It is most of the job.')
      return
    case 'lab':
      yield c.sayAs('bones', 'The laboratory, sir. I keep the key. The Professor\'s orders.')
      if (lit) {
        yield c.sayAs('bones', c.has('labkey') ? 'And now you keep it, sir. Mind the lever. Mind everything.' : 'You have been in, sir. I heard the door. I hear everything. I have very little else to do.')
        return
      }
      yield c.sayAs('bones', 'I would hand it over, but my fingers are rather… rather…')
      yield* jawFalls(c)
      yield c.sayAs('bones', '…cold, sir. Warm me, and we shall see.')
      return
    case 'lever':
      yield c.sayAs('bones', 'It arms the Lightning Machine, sir. The Professor pulled it at eleven fifty-eight, every time.')
      yield c.sayAs('bones', 'Then she waited for midnight, and the storm did the rest. She called it "letting the weather help".')
      return
    case 'house':
      yield c.sayAs('bones', 'It has moods, sir. Tonight it is in the mood for guests. It shut the stairs so you would stay.')
      yield c.sayAs('bones', 'In 1994 it kept a plumber for three weeks. He still sends a card every Christmas. From inside the walls.')
      if (!again) yield c.say('I\'ve stayed longer places for worse reasons.')
      return
    case 'food':
      yield c.sayAs('bones', 'There is jam in the pantry, sir. Lingonberry, 1987. The Professor did up the lids herself.')
      yield c.sayAs('bones', 'She had forearms like a blacksmith. Warm the lid, sir. Warm lids open. Everyone knows that.')
      if (!lit) yield c.say('Warm. Right. Nothing down here is warm.')
      return
    case 'suit':
      yield c.sayAs('bones', 'Of course not, sir. Very good, sir.')
      yield c.sayAs('bones', 'It is only the ears, sir. And the tail. And the air of a gentleman who might eat a lettuce.')
      yield c.say('I might, to be fair.')
      return
  }
}

function* talkBones(c: Ctx): Script {
  const lit = c.is(F.furnaceLit)
  if (!c.is('bones.met')) {
    c.set('bones.met')
    yield c.sayAs('bones', 'Good evening, sir. Welcome to Villa Voltvik.')
    yield c.sayAs('bones', 'Will the gentlemen be staying for dinner? I\'m afraid we are out of carrots.')
    yield c.say('It\'s a suit. I\'m not a rabbit. I\'m Dag.')
    yield c.sayAs('bones', 'Of course, Mr Dag. The carrots, however, remain out.')
    if (!lit) yield* jawFalls(c)
  }
  if (lit && !c.is(F.bonesKey)) yield* warmThanks(c)
  else if (c.is('bones.met.twice')) yield c.sayAs('bones', lit ? 'Sir. Toasty as a crumpet, sir.' : c.pick(['S-s-sir.', 'Sir? B-brr.', 'Still here, sir. Still cold.']))
  c.set('bones.met.twice')
  for (;;) {
    const id: string = yield c.choose(options(c))
    if (id === 'bye') {
      yield c.sayAs('bones', c.is(F.furnaceLit) ? 'I shall, sir. I shall bask. Quietly.' : 'V-very good, sir.')
      return
    }
    yield* answer(c, id)
  }
}

function* pushBones(c: Ctx): Script {
  yield c.say('Just a friendly nudge.')
  yield c.sfx('bones-collapse')
  yield c.shake(0.25, 1)
  yield c.pose('pile', undefined, 'bones')
  yield c.wait(0.8)
  yield c.sayAs('bones', 'Sir.')
  yield c.say('Sorry. I don\'t know my own strength. I do, actually. It\'s a lot.')
  c.set('boiler.assembleAt', c.s.time)
  yield c.pose('assemble', undefined, 'bones')
  yield c.sfx('bones-rattle')
  yield c.wait(1.6)
  yield c.pose(c.is(F.furnaceLit) ? '' : 'shiver', undefined, 'bones')
  yield c.sayAs('bones', 'There. Every bone accounted for. Save one. It is always under the stool.')
}

function* lightFurnace(c: Ctx): Script {
  if (!c.is('boiler.door')) { yield c.sfx('creak'); c.set('boiler.door') }
  yield c.pose('reach', 0.5)
  yield c.sfx('match-strike')
  yield c.wait(0.5)
  yield c.say('One match. One go. Come on…')
  c.take('matches')
  c.set(F.furnaceLit)
  yield c.sfx('furnace-whoosh')
  yield c.flash('#ffb060', 0.55)
  yield c.shake(0.6, 2)
  yield c.pose('scared', 0.9)
  if (once(c, 'furnace')) yield c.solve('furnace')
  yield c.wait(0.4)
  yield c.sfx('pipes-knock')
  yield c.say('WHOA. There she goes.')
  yield c.sfx('pipes-knock')
  yield c.say('Hear the pipes? That goes all the way up the house. Kjell\'ll feel it in his socks.')
  yield c.pose('', undefined, 'bones')
  yield c.sayAs('bones', 'Oh. Oh my. Is that… is that warmth? Sir, a word, when you have a moment.')
}

function* kindle(c: Ctx): Script {
  if (!c.is('boiler.door')) { yield c.sfx('creak'); c.set('boiler.door') }
  yield c.say('Sorry, Kjell. It\'s for a good cause.')
  yield c.pose('strain', 0.8)
  yield c.sfx('paper-rip')
  yield c.wait(0.3)
  yield c.sfx('paper-rip')
  c.take('manual')
  c.set(F.furnaceKindling)
  yield c.pose('reach', 0.5)
  yield c.say('Chapter nine, "Your ashtray and you". Nice and dry. Under the coal it goes.')
  yield c.say('I kept the index. No, I didn\'t. It\'s all in there.')
}

function* warmJam(c: Ctx): Script {
  if (!c.is('boiler.door')) { yield c.sfx('creak'); c.set('boiler.door') }
  yield c.say('Just hold the lid near the heat a moment…')
  yield c.pose('reach', 1.4)
  yield c.wait(1.2)
  yield c.pose('strain', 0.6)
  yield c.sfx('jar-pop')
  c.set(F.jamOpen)
  if (once(c, 'jam')) yield c.solve('jam')
  yield c.say('Pop! Warm lids open. Everyone knows that.')
  yield c.pose('eat', 1.4)
  yield c.sfx('slurp')
  c.set(F.dagAte)
  yield c.wait(0.6)
  yield c.say('Mmm. 1987 was a strong year for lingonberries, too.')
  yield c.say('There. Something in my belly. I could part with the sandwich now. Kjell looked hungry.')
}

export const room: RoomDef = {
  id: 'boiler',
  name: 'Boiler room',
  floor: 'cellar',
  w: 400,
  walk: [[[4, 108], [396, 108], [399, 142], [1, 142]]],
  blocks: [
    [[44, 104], [134, 104], [134, 114], [44, 114]], // furnace
    [[136, 104], [186, 104], [186, 113], [136, 113]], // coal
    [[279, 108], [301, 108], [301, 122], [279, 122]], // Bones' stool
  ],
  first: function* (c) {
    if (c.hero !== 'dag') return
    yield c.sayAs('bones', 'Ah. A guest. Do come in, sir. Mind the coal. And the cold. Mostly the cold.')
  },
  hotspots: [
    {
      id: 'to-pantry', name: 'Pantry', rect: [0, 22, 22, 86], at: [12, 124], face: 'left',
      exit: { to: 'pantry', x: 376, y: 122, face: 'left' },
    },
    {
      id: 'furnace',
      name: s => s.flags[F.furnaceLit] ? 'Roaring furnace' : 'Furnace',
      rect: [44, 30, 90, 80], at: [92, 124], face: 'up',
      verbs: {
        look: c => c.is(F.furnaceLit)
          ? 'It\'s roaring. It sounds like a happy dragon. I could live here. I might.'
          : c.is(F.furnaceKindling)
            ? 'Coal on top, Kjell\'s manual underneath. It just needs a spark.'
            : 'A big fat iron furnace. Stone cold. The pipes go from it up into the whole house.',
        open: function* (c) {
          if (c.is('boiler.door')) { yield c.say('It\'s open.'); return }
          yield c.sfx('creak')
          c.set('boiler.door')
          yield c.say(c.is(F.furnaceLit)
            ? 'Hot! Hot hot hot. Lovely.'
            : c.is(F.furnaceKindling) ? 'Coal, and Kjell\'s manual, waiting.' : 'Inside: cold coal, grey ash, and one very old sock.')
        },
        close: function* (c) {
          if (!c.is('boiler.door')) { yield c.say('It\'s shut.'); return }
          yield c.sfx('creak')
          c.clear('boiler.door')
          yield c.say(c.is(F.furnaceLit) ? 'Keeps the heat in. Good door.' : 'Clang.')
        },
        use: c => c.is(F.furnaceLit) ? 'It\'s doing its job. I\'m doing mine: standing near it.' : 'It needs something dry to burn and something to light it with.',
        push: 'It weighs more than Brunhilde. And Brunhilde weighs a lot. Kjell told me. Twice.',
        pull: 'It weighs more than Brunhilde. And Brunhilde weighs a lot. Kjell told me. Twice.',
        pickup: 'It\'s a furnace. I\'m strong, but I\'m not stupid. Not in that way.',
        talk: c => c.is(F.furnaceLit) ? 'We\'re friends now, the furnace and me.' : 'Come on, old thing. Wake up.',
      },
      useWith: {
        matches: function* (c) {
          if (!c.is(F.furnaceKindling)) {
            yield c.say('The coal\'s damp. I\'d waste our only match.')
            yield c.say('It needs something dry under it first. Paper. Something boring and dry.')
            return
          }
          yield* lightFurnace(c)
        },
        manual: function* (c) {
          if (c.is(F.furnaceKindling)) { yield c.say('There\'s plenty of manual in there already.'); return }
          yield* kindle(c)
        },
        jam: function* (c) {
          if (c.is(F.jamOpen)) { yield c.say('It\'s open. The jam doesn\'t need to get any warmer. I do.'); return }
          if (!c.is(F.furnaceLit)) { yield c.say('It\'s cold. The lid is colder.'); return }
          yield* warmJam(c)
        },
        sandwich: 'A toasted sandwich. Tempting. But I\'d have to put my hand in there, and I need that hand for eating.',
        labkey: 'It\'s an iron key, not a poker.',
        cat: 'Absolutely not.',
      },
      anyItem: c => c.is(F.furnaceLit) ? 'I\'m not burning that. It hasn\'t done anything.' : 'That won\'t burn. Or it would, but not with damp coal on top.',
    },
    {
      id: 'coal', name: 'Coal pile', rect: [136, 86, 50, 26], at: [160, 122], face: 'up',
      verbs: {
        look: c => c.is(F.furnaceLit) ? 'The coal\'s drying out by the fire. Everything\'s cheering up down here.' : 'Coal. Damp. Everything in this house is damp except the jam.',
        pickup: 'It\'s wet and black and it\'s coal. My suit is white. Was white.',
        use: 'Wet coal on a cold fire needs something dry under it. Paper. Something boring and dry.',
        push: 'I kick the pile. The pile wins.',
        talk: 'Hello, coal. …Coal doesn\'t talk. Coal just sits there being damp.',
      },
      useWith: {
        matches: 'Straight on the coal? It\'s damp. I\'d waste our only match.',
        manual: 'The kindling goes in the furnace. Under the coal. I\'ve read a book. Well, a leaflet.',
      },
    },
    {
      id: 'shovel', name: 'Shovel', rect: [170, 70, 12, 22], at: [168, 122], face: 'up', z: 1,
      verbs: {
        look: 'A coal shovel, stuck in the coal. It\'s been waiting for someone since 1987.',
        pickup: 'I\'m not shovelling damp coal at midnight. I\'m on holiday. Sort of.',
        use: 'The furnace has enough coal. What it doesn\'t have is fire.',
        pull: 'It comes out, I look at it, I put it back. We both feel better.',
      },
    },
    {
      id: 'pipes', name: 'Pipes', rect: [138, 0, 190, 32], at: [214, 118], face: 'up',
      verbs: {
        look: c => c.is(F.furnaceLit)
          ? 'The pipes are knocking and steaming. The whole house is getting warm, floor by floor.'
          : 'Pipes. They go up into the house. Some of them loop for no reason. I respect that.',
        use: 'I\'m not a plumber. Although, the house kept one once.',
        pull: 'I don\'t pull on pipes. That\'s rule one of cellars.',
        push: 'I don\'t push on pipes either. That\'s rule two.',
        talk: c => c.is(F.furnaceLit) ? 'Bang. Bang-bang. They\'re answering. I think they\'re saying thank you.' : 'I knock on them. Silence. Cold, sulky silence.',
      },
    },
    {
      id: 'gauge', name: 'Pressure gauge', rect: [204, 38, 18, 20], at: [214, 118], face: 'up', z: 1,
      verbs: {
        look: c => c.is(F.furnaceLit)
          ? 'The needle\'s up in the green. The word under it says "COSY". The Professor made her own gauges.'
          : 'A pressure gauge. The needle\'s at the bottom, on a word: "SULKING".',
        use: 'I tap it. The needle wobbles. That\'s all you can ask of a needle.',
        pull: 'Gauges don\'t come off. That\'s their whole thing.',
      },
    },
    {
      id: 'sampler', name: 'Sampler', rect: [190, 62, 40, 32], at: [210, 116], face: 'up',
      verbs: {
        look: function* (c) {
          yield c.say('An embroidered sampler: HOME SWEET HOME. There\'s a little skull stitched in the corner.')
          if (c.actor('bones').room === 'boiler') yield c.sayAs('bones', 'My own work, sir. Forty years of evenings. The skull is a self-portrait.')
        },
        pickup: 'It\'s Mr Bones\' work. You don\'t take a man\'s embroidery. Even if he isn\'t, strictly, a man any more.',
        use: 'I straighten it. It swings back crooked. The whole house is like that.',
      },
    },
    {
      id: 'calendar', name: 'Calendar', rect: [232, 34, 24, 30], at: [244, 116], face: 'up',
      verbs: {
        look: function* (c) {
          yield c.say('A calendar. SEPTEMBER 1987. Every day\'s crossed off until the twenty-fifth.')
          yield c.say('The twenty-fifth is circled three times. It says "LIGHTNING!!" and there\'s a little drawing of a cat. With a question mark.')
        },
        pickup: 'It stays. It\'s the only thing in here that knows what day it is. Well. Knew.',
        use: 'I\'d need a pen. And a new calendar. And thirty-nine years.',
      },
    },
    {
      id: 'bones', name: 'Mr Bones', actor: 'bones', rect: [272, 66, 30, 56], at: [254, 124], face: 'right', z: 2,
      when: s => s.actors.bones?.room === 'boiler',
      verbs: {
        look: c => c.is(F.furnaceLit)
          ? 'Mr Bones. Warm, calm, and very, very thin. He\'s humming.'
          : 'A skeleton in a tailcoat, on a stool, shivering. His teeth are going like a sewing machine.',
        talk: talkBones,
        push: pushBones,
        pull: function* (c) {
          yield c.say('I tug his sleeve. His arm comes with it.')
          yield c.sfx('bones-rattle')
          yield c.say('I put it back. We don\'t talk about it.')
          yield c.sayAs('bones', 'We do not, sir.')
        },
        pickup: 'He\'s a butler, not a coat.',
        use: 'He\'s not a tool. He\'s staff. There\'s a difference. He\'d tell you.',
        open: 'He\'s quite open enough. You can see right through him.',
        close: 'His coat\'s buttoned. He\'s very correct.',
      },
      giveWith: {
        sandwich: function* (c) { yield c.sayAs('bones', 'Most kind, sir, but it would go straight through me.') },
        jam: function* (c) { yield c.sayAs('bones', 'I have no stomach for it, sir. None at all. Look.') },
        matches: function* (c) { yield c.sayAs('bones', 'I have no fingertips, sir. Striking is quite beyond me.') },
        manual: function* (c) { yield c.sayAs('bones', 'I have read it, sir. Twice. Chapter nine is a masterpiece.') },
        labkey: function* (c) { yield c.sayAs('bones', 'Keep it, sir. I have no pockets worth the name.') },
        cat: function* (c) {
          yield c.sayAs('bones', 'Madam.')
          yield c.sayAs('cat', 'Mrrp.')
          yield c.sayAs('bones', 'She prefers to be carried by guests, sir. It is a test. You are passing.')
        },
      },
      anyItem: function* (c) { yield c.sayAs('bones', 'Most kind, sir, but I couldn\'t possibly.') },
    },
    {
      id: 'labdoor',
      name: s => s.flags[F.labOpen] ? 'Laboratory' : 'Iron door',
      rect: [326, 22, 54, 84], at: [352, 114], face: 'up',
      verbs: {
        look: c => c.is(F.labOpen)
          ? 'The lab door, open. There\'s a green glow in there. Green light is either very good or very bad.'
          : 'A big iron door with a keyhole shaped like a lightning bolt. There\'s a sign: LABORATORIUM. DANGER. 10 000 VOLT.',
        talk: 'Open sesame. …No. Worth a go.',
        close: c => c.is(F.labOpen) ? 'I\'ll leave it open. It took long enough.' : 'It\'s shut. Very shut.',
      },
      useWith: {
        labkey: function* (c) {
          if (c.is(F.labOpen)) { yield c.say('It\'s open already.'); return }
          yield c.sfx('key-turn')
          yield c.wait(0.5)
          yield c.say('A key shaped like lightning, in a keyhole shaped like lightning.')
          yield c.sfx('creak')
          c.set(F.labOpen)
          c.take('labkey')
          if (once(c, 'lab')) yield c.solve('lab')
          yield c.say('I\'ll leave the key in the lock. Keys are happiest in locks.')
        },
      },
      anyItem: 'That doesn\'t fit a lightning-shaped keyhole. Not much does.',
      exit: {
        to: 'lab', x: 36, y: 124, face: 'right',
        open: s => !!s.flags[F.labOpen],
        locked: function* (c) {
          yield c.sfx('lock-rattle')
          yield c.say(c.has('labkey')
            ? 'Locked. But I\'ve got a key shaped like a lightning bolt. Might as well try it.'
            : c.pick(['Locked. Iron door, lightning-shaped keyhole. Someone takes their keyholes seriously.', 'Locked. Mr Bones had a look when I tried it. A butler look.']))
        },
      },
    },
    {
      id: 'mousehole', name: 'Mouse hole', rect: [384, 96, 12, 12], at: [380, 120], face: 'right',
      verbs: {
        look: 'A mouse hole with a tiny doormat and a tiny doorbell. I\'m not ringing it. It\'s late.',
        use: 'I ring the tiny doorbell. …Nobody. They\'re out. Or they\'re pretending.',
        talk: 'Evening. …Nothing. Probably upstairs, at the party we weren\'t at.',
        open: 'It\'s their house. I\'m not barging in.',
      },
      anyItem: 'I\'m not posting anything through a mouse\'s front door.',
    },
  ],
}
