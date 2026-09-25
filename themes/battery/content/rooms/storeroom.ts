/**
 * Attic Storeroom (Espen). Where the chandelier cord drops him: the floor
 * hatch he was yanked through, the dumbwaiter, the trunk of Torvald's
 * letters, a costume trunk, the mannequin he interviews, the radio with no
 * antenna (his ears become the antenna), a rocking horse, and the heavy
 * trunk on castors in front of the study door (PUSH fails, PULL works).
 *
 * Local flags: storeroom.lettersOpen, storeroom.costumesOpen,
 * storeroom.trunkT / storeroom.rockT (s.time when the trunk rolled / the
 * horse was pushed, for the painter), storeroom.interviewed.
 */
import type { Ctx, RoomDef, Script } from '../../types'
import { F } from '../flags'

/** Where things are, shared with the painter (render/rooms/storeroom.ts). */
export const STOREROOM = {
  w: 460,
  /** Heavy trunk's left edge before and after it rolls. */
  trunkX0: 400,
  trunkX1: 348,
  trunkY: 84,
  trunkW: 50,
} as const

const LETTERS_OPEN = 'storeroom.lettersOpen'
const COSTUMES_OPEN = 'storeroom.costumesOpen'
const TRUNK_T = 'storeroom.trunkT'
const ROCK_T = 'storeroom.rockT'
const INTERVIEWED = 'storeroom.interviewed'

function* rock(c: Ctx, line: string): Script {
  c.set(ROCK_T, c.s.time)
  yield c.sfx('creak')
  yield c.say(line)
}

function* takeLetters(c: Ctx): Script {
  if (c.is(F.lettersTaken)) { yield c.say('I\'ve got them. The trunk is just old socks now.'); return }
  yield c.pose('pickup', 0.5)
  yield c.sfx('pickup')
  c.give('letters')
  c.set(F.lettersTaken)
  yield c.solve('letters')
  yield c.say('A bundle of letters with a pink ribbon. Evidence! Of something!')
}

function* interview(c: Ctx): Script {
  const first = !c.is(INTERVIEWED)
  c.set(INTERVIEWED)
  yield c.face('right')
  if (first) {
    yield c.say('Welcome back to Spøkelsesjegerne, the podcast. I\'m here with a special guest.')
    yield c.say('She has been in this attic for a hundred years. She has a very small waist.')
  } else {
    yield c.say('And we\'re back. Still recording. Still in the attic.')
  }
  const asked = new Set<string>()
  for (;;) {
    const id: string = yield c.choose([
      { id: 'name', text: 'For the listeners: what is your name?', when: !asked.has('name') },
      { id: 'die', text: 'How did you die?', when: !asked.has('die') },
      { id: 'knock', text: 'If you are a ghost, knock once.', when: !asked.has('knock') },
      { id: 'prof', text: 'Did you know Professor Voltvik?', when: !asked.has('prof') },
      { id: 'fans', text: 'Any message for my eleven listeners?', when: asked.size >= 2 && !asked.has('fans') },
      { id: 'bye', text: 'That\'s all we have time for.' },
    ])
    asked.add(id)
    if (id === 'name') {
      yield c.wait(1.2)
      yield c.say('She won\'t say. Shy. I\'ll call her Margit. She looks like a Margit.')
    } else if (id === 'die') {
      yield c.wait(1.2)
      yield c.say('Silence. Which is exactly what a ghost would say. Chilling.')
    } else if (id === 'knock') {
      yield c.wait(0.8)
      yield c.sfx('thud')
      yield c.shake(0.3, 1)
      yield c.say('THAT WAS A KNOCK! That was a rafter settling. That was a KNOCK!')
      yield c.say('I\'m counting it. It\'s my podcast.')
    } else if (id === 'prof') {
      yield c.wait(1)
      yield c.say('She\'s wearing the Professor\'s old lab coat. With a cat hair on it. A white one.')
      yield c.say('Margit, I think you know more than you\'re letting on.')
    } else if (id === 'fans') {
      yield c.wait(1.2)
      yield c.say('"Like and subscribe." She didn\'t say that. But she thought it. Very loudly.')
    } else {
      yield c.say('Margit, thank you. You have been a wonderful guest. A bit wooden.')
      return
    }
  }
}

function* radio(c: Ctx): Script {
  if (c.is(F.radioHeard)) {
    yield c.sfx('radio-static')
    yield c.sayAs('narrator', '"…a storm peaking at the stroke of midnight. And now: the shipping forecast, sung…"')
    yield c.say('Still 1987 in there. The same forecast, over and over. Midnight. Midnight. MIDNIGHT.')
    return
  }
  yield c.sfx('radio-static')
  yield c.say('Only static. There\'s no antenna. Where do I find an antenna in an attic, at night, in a storm?')
  yield c.pose('think', 1.4)
  yield c.wait(1)
  yield c.say('…Wait. My ears.')
  yield c.pose('reach', 0.8)
  yield c.sfx('squeak')
  c.set(F.earsFlop)
  yield c.wait(0.5)
  yield c.say('Coat-hanger wire. It kept my ears up all night. Now it serves a higher purpose.')
  yield c.sfx('radio-static')
  yield c.wait(0.4)
  yield c.sfx('radio-voice')
  c.set(F.radioHeard)
  yield c.sayAs('narrator', '"…Coast Radio, eleven fifty-eight. Storm warning for the coast road."')
  yield c.sayAs('narrator', '"The storm will peak at the stroke of midnight. Stay indoors. Especially you, Professor Voltvik."')
  yield c.sayAs('narrator', '"And now, the number one song this September, nineteen eighty-seven…"')
  yield c.sfx('radio-static')
  yield c.say('Nineteen eighty-seven? The radio is stuck in 1987. The clocks are stuck. The HOUSE is stuck!')
  yield c.say('At the stroke of midnight. If midnight ever comes. Episode twelve is writing itself.')
}

const emfBeep = (line: string) => function* (c: Ctx): Script {
  yield c.sfx('emf')
  yield c.say(line)
}

export const room: RoomDef = {
  id: 'storeroom',
  name: 'Attic Storeroom',
  floor: 'attic',
  w: STOREROOM.w,
  walk: [[[12, 110], [448, 110], [456, 141], [4, 141]]],
  hotspots: [
    {
      id: 'beams',
      name: 'roof beams',
      rect: [0, 0, 460, 16],
      far: true,
      verbs: {
        look: 'The roof beams. They lean like they\'ve had a long night. Same, beams. Same.',
        pull: 'I can\'t reach. I\'m built for radio, not rafters.',
        talk: 'Hello, beams. You\'ve seen things. Tell me everything. …Creak. That\'s a yes.',
      },
    },
    {
      id: 'dumbwaiter',
      name: 'dumbwaiter hatch',
      rect: [14, 56, 36, 38],
      at: [34, 114],
      face: 'up',
      verbs: {
        look: 'The dumbwaiter. A tiny lift for food. It goes down to Kjell\'s kitchen and Dag\'s pantry.',
        open: function* (c) {
          yield c.sfx('hatch')
          yield c.say('A shaft, straight down. Too small for me. I tried. My ears got stuck.')
          yield c.say('Things can go down it, though. I just give them to Kjell or Dag.')
        },
        close: 'It\'s closed. It\'s always closed. It opens on its own when something\'s sent.',
        talk: function* (c) {
          yield c.say('HELLO? KJELL? DAG? Can you hear me?')
          yield c.wait(0.8)
          yield c.sayAs('dag', 'Is that the dinner bell?')
          yield c.say('Dag can hear me. Dag thinks I\'m dinner.')
        },
        use: 'I can\'t fit. But things can: I just give them to Kjell or Dag.',
        pickup: 'It\'s part of the house. The house would notice.',
      },
      useWith: {
        emf: emfBeep('Beeeep. Voices in the walls! No, wait. That\'s Dag. Humming about ham.'),
      },
      anyItem: 'To send it, I give it to Kjell or Dag.',
    },
    {
      id: 'bell',
      name: 'little bell',
      rect: [27, 46, 12, 10],
      at: [34, 114],
      face: 'up',
      z: 1,
      default: 'pull',
      verbs: {
        look: 'A little brass bell on a spring. For calling the kitchen. DING. For soup.',
        pull: function* (c) {
          yield c.sfx('bell')
          yield c.wait(0.6)
          yield c.sayAs('kjell', 'Espen? Was that you? Is it soup? Please say there\'s soup.')
          yield c.say('Not soup, Kjell. Just checking the bell works. It works.')
        },
        use: function* (c) {
          yield c.sfx('bell')
          yield c.wait(0.6)
          yield c.sayAs('dag', 'Dinner?')
          yield c.say('No, Dag.')
        },
        push: 'I push the bell. It dings a tiny, sad ding.',
        pickup: 'It\'s screwed on. Everything nice is screwed on.',
      },
    },
    {
      id: 'portrait',
      name: 'portrait',
      rect: [56, 34, 40, 42],
      at: [76, 114],
      face: 'up',
      verbs: {
        look: c => c.is(F.lettersRead)
          ? 'Torvald! It has to be. And that magnificent thing on his chin must be Sigurd. Hello, Sigurd.'
          : 'A portrait of a man with an enormous ginger beard. The beard gets more of the canvas than he does.',
        talk: c => c.is(F.lettersRead) ? 'Sigurd. Looking good. Very combed.' : 'Nice beard. …He doesn\'t say thanks. The beard seems pleased.',
        pickup: 'It\'s nailed to the wall. Crooked. On purpose, I think.',
        push: 'I straighten it. It swings back crooked. The house likes it crooked.',
        pull: 'I straighten it. It swings back crooked. The house likes it crooked.',
      },
      useWith: { emf: emfBeep('Beep. The beard is giving off a reading. A strong, manly reading.') },
    },
    {
      id: 'lamp',
      name: 'oil lamp',
      rect: [238, 14, 14, 20],
      far: true,
      verbs: {
        look: 'An oil lamp hanging from the beam. Still burning. Who lit it? When? WHY? Episode twelve.',
        pickup: 'It\'s the only light up here. I\'m not taking it. I\'m not brave. I\'m a podcaster.',
        use: 'It\'s lit. I\'m not touching it. Fire and rabbit fur: bad podcast.',
      },
    },
    {
      id: 'letter-trunk',
      name: 'old trunk',
      rect: [52, 88, 50, 24],
      at: [78, 114],
      face: 'up',
      verbs: {
        look: c => c.is(LETTERS_OPEN)
          ? (c.is(F.lettersTaken) ? 'The old trunk. Moth-eaten socks and a smell of 1923.' : 'Letters in there! A whole bundle, tied with a ribbon.')
          : 'An old trunk with brass corners and the initials H.V. on the lid.',
        open: function* (c) {
          if (c.is(LETTERS_OPEN)) { yield c.say('It\'s open.'); return }
          c.set(LETTERS_OPEN)
          yield c.sfx('creak')
          yield c.say(c.is(F.lettersTaken) ? 'Socks.' : 'Letters! Bundles of them, tied with a pink ribbon. Somebody was in love.')
        },
        close: function* (c) {
          if (!c.is(LETTERS_OPEN)) { yield c.say('It\'s shut.'); return }
          c.clear(LETTERS_OPEN)
          yield c.sfx('trunk-thud')
        },
        pickup: function* (c) {
          if (!c.is(LETTERS_OPEN)) { yield c.say('The whole trunk? No. But what\'s in it, maybe.'); return }
          yield* takeLetters(c)
        },
        push: 'It\'s full of something. Heavy. Emotional baggage, probably.',
        pull: 'It\'s full of something. Heavy. Emotional baggage, probably.',
      },
      useWith: {
        emf: emfBeep('Beep. Beep. The needle points at the letters. Love is electromagnetic. I KNEW it.'),
      },
    },
    {
      id: 'letters',
      name: 'letters',
      rect: [60, 84, 26, 10],
      at: [78, 114],
      face: 'up',
      z: 2,
      when: s => !!s.flags[LETTERS_OPEN] && !s.flags[F.lettersTaken],
      default: 'pickup',
      verbs: {
        look: 'A bundle of letters, all addressed to "My dearest Hedvig". Tied with a pink ribbon.',
        pickup: c => takeLetters(c),
        open: 'I\'ll take them first. You don\'t read love letters in a trunk. You read them in a trunk-free zone.',
      },
    },
    {
      id: 'window',
      name: 'round window',
      rect: [110, 18, 38, 38],
      at: [128, 114],
      face: 'up',
      verbs: {
        look: c => c.pick([
          'A round window. The storm is right outside, pressing its face to the glass.',
          'Rain, rain and more rain. And the lighthouse, blinking. Or a ghost ship! It\'s the lighthouse.',
        ]),
        open: 'It\'s round. Round windows don\'t open. It\'s the rules.',
        push: 'It\'s round. Round windows don\'t open. It\'s the rules.',
        talk: 'Storm, if you can hear me: episode twelve. You\'d be the star.',
      },
      useWith: { emf: emfBeep('BEEEEP. The storm! The storm is full of electricity! This meter is a genius.') },
    },
    {
      id: 'hatch',
      name: 'floor hatch',
      rect: [134, 122, 34, 14],
      at: [176, 124],
      face: 'left',
      verbs: {
        look: 'The hatch I came up through. Well. Was pulled up through. By the chandelier. Upwards.',
        open: 'It\'s shut. The house locked it behind me. The house is playing games.',
        pull: 'It\'s shut from below. The house is playing games. I love games. I\'m scared of this one.',
        push: 'I jump on it. It holds. Of course it holds, now.',
        talk: function* (c) {
          yield c.say('KJELL? Can you hear me through the floor?')
          yield c.wait(0.7)
          yield c.say('Nothing. Just the house breathing. It\'s the wind. It\'s the wind breathing.')
        },
      },
      useWith: { emf: emfBeep('Beep! There\'s energy under this hatch. Or Kjell. Kjell is a kind of energy.') },
    },
    {
      id: 'horse',
      name: 'rocking horse',
      rect: [174, 72, 44, 40],
      at: [196, 116],
      face: 'up',
      verbs: {
        look: 'A rocking horse with a wild eye. It rocks by itself when the thunder rolls. Totally normal.',
        push: c => rock(c, 'Creak. Creak. Creak. I\'ll be hearing that in my sleep.'),
        pull: c => rock(c, 'Creak. Creak. Creak. I\'ll be hearing that in my sleep.'),
        use: c => rock(c, 'I\'m not riding it. I\'m a grown man in a rabbit suit. …I gave it a little push.'),
        talk: function* (c) {
          yield c.say('Easy, boy. Easy. What did you see in 1987?')
          yield c.wait(0.8)
          yield c.say('He\'s not saying. Horses never do. That\'s why they make bad witnesses.')
        },
        pickup: 'He\'s bigger than he looks. And he looks big.',
      },
      useWith: { emf: emfBeep('Beep. …It rocked when it beeped. That is NOT nothing.') },
    },
    {
      id: 'costumes',
      name: 'costume trunk',
      rect: [224, 84, 50, 28],
      at: [248, 114],
      face: 'up',
      verbs: {
        look: c => c.is(COSTUMES_OPEN)
          ? 'A pirate hat, a Viking helmet, a gorilla, a nun. And a rabbit suit. I\'m ahead of the game.'
          : 'A trunk stencilled COSTUMES. The lid won\'t quite shut: a feather boa is escaping.',
        open: function* (c) {
          if (c.is(COSTUMES_OPEN)) { yield c.say('It\'s open. The boa is free.'); return }
          c.set(COSTUMES_OPEN)
          yield c.sfx('creak')
          yield c.say('Costumes! A pirate hat. A Viking helmet. A nun. A gorilla. A rabbit suit…')
          yield c.say('I\'m already in a rabbit suit. We\'re already in rabbit suits. It WAS a costume party. In my heart.')
        },
        close: function* (c) {
          if (!c.is(COSTUMES_OPEN)) { yield c.say('It\'s closed. Mostly. The boa won\'t go in.'); return }
          c.clear(COSTUMES_OPEN)
          yield c.sfx('trunk-thud')
        },
        pickup: c => c.is(COSTUMES_OPEN)
          ? 'I try on the Viking helmet over my ears. The ears win. The helmet goes back.'
          : 'I\'d need to open it first. And I\'d need a reason. I\'m finding reasons.',
        use: c => c.is(COSTUMES_OPEN)
          ? 'I have a costume. It\'s working for me. Mostly the tail.'
          : 'It\'s closed.',
      },
      useWith: { emf: emfBeep('Beep. The gorilla costume is… no. No, it\'s the zip.') },
    },
    {
      id: 'mannequin',
      name: 'dress mannequin',
      rect: [276, 32, 26, 78],
      at: [262, 116],
      face: 'right',
      default: 'talk',
      verbs: {
        look: 'A dress mannequin in a feathered hat and an old lab coat. She looks like a very good listener.',
        talk: c => interview(c),
        pickup: 'She\'s not for sale. She\'s for interviewing.',
        push: 'I\'m not pushing a guest. That\'s bad podcast manners.',
        pull: 'She wobbles and gives me a look. Well. She would, if she had a face.',
      },
      useWith: { emf: emfBeep('BEEP! …No. That\'s the hat pin. A very magnetic hat pin.') },
      giveWith: { letters: 'She doesn\'t read. She\'s a mannequin. Also they\'re private.' },
    },
    {
      id: 'radio',
      name: 'old radio',
      rect: [304, 64, 40, 26],
      at: [324, 114],
      face: 'up',
      z: 1,
      default: 'use',
      verbs: {
        look: c => c.is(F.earsFlop)
          ? 'The old radio, with my ear wire for an antenna. My ears flop now. For science.'
          : 'A big wooden valve radio. Bakelite knobs, a glowing dial. And a hole where the antenna used to be.',
        use: c => radio(c),
        open: 'I open the back. Valves, dust, and a dead moth. I\'m calling him Gerald.',
        pull: c => c.is(F.earsFlop) ? 'The wire\'s in. I\'m not pulling my ears out twice.' : 'No antenna to pull out. That\'s the whole problem.',
        talk: 'Hello, radio. Any news? …It needs an antenna, not a chat.',
        pickup: 'It weighs as much as Dag. Not in a mean way.',
      },
      useWith: { emf: emfBeep('BEEEEEP. Well, yes. It\'s a radio. That was on me.') },
    },
    {
      id: 'heavy-trunk',
      name: 'heavy trunk',
      rect: [STOREROOM.trunkX0, 80, STOREROOM.trunkW, 32],
      at: [386, 116],
      face: 'right',
      z: 1,
      when: s => !s.flags[F.trunkMoved],
      verbs: {
        look: 'A huge trunk on little castors, parked right in front of a door. Someone didn\'t want visitors.',
        push: function* (c) {
          yield c.pose('strain', 1.4)
          yield c.sfx('thud')
          yield c.wait(0.8)
          yield c.say('Hnnnngh. It doesn\'t budge. It\'s against the wall. You can\'t push a trunk into a wall.')
        },
        pull: function* (c) {
          if (c.is(F.trunkMoved)) return
          yield c.pose('strain')
          yield c.say('Hnnngh…')
          yield c.sfx('trunk-roll')
          c.set(F.trunkMoved)
          c.set(TRUNK_T, c.s.time)
          yield c.walk(338, 118)
          yield c.face('right')
          yield c.pose('')
          yield c.sfx('trunk-thud')
          yield c.solve('trunk')
          yield c.say('It rolls! Castors! The castors were the secret all along.')
          yield c.say('And behind it: a door. There\'s always a door.')
        },
        open: 'It\'s locked. And it\'s standing in front of a door, which is the bigger problem.',
        pickup: 'I\'m small but I\'m weak. I mean: it\'s very heavy.',
        talk: 'Could you move? …Trunks never move when you ask.',
      },
      useWith: { emf: emfBeep('Nothing. The trunk is spiritually empty.') },
    },
    {
      id: 'heavy-trunk-moved',
      name: 'heavy trunk',
      rect: [STOREROOM.trunkX1, 80, STOREROOM.trunkW, 32],
      at: [330, 116],
      face: 'right',
      z: 1,
      when: s => !!s.flags[F.trunkMoved],
      verbs: {
        look: 'The heavy trunk, rolled aside. It sulks.',
        push: 'It\'s fine where it is. We\'re not doing that again.',
        pull: 'It\'s fine where it is. We\'re not doing that again.',
        open: 'Locked. I don\'t need what\'s in it. I needed what was behind it.',
      },
    },
    {
      id: 'door',
      name: s => s.flags[F.trunkMoved] ? 'door to the study' : 'door',
      rect: [402, 30, 40, 50],
      at: [422, 116],
      face: 'right',
      verbs: {
        look: c => c.is(F.trunkMoved)
          ? 'A door with a brass plate: STUDY. PRIVATE. SERIOUSLY.'
          : 'A door, mostly hidden behind a huge trunk. I can read STUDY on the brass plate.',
      },
      exit: {
        to: 'study', x: 40, y: 118, face: 'right',
        open: s => !!s.flags[F.trunkMoved],
        locked: 'There\'s a door behind this trunk. The trunk is not letting me through.',
      },
    },
  ],
}
