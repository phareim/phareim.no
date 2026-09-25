/**
 * The Professor's Study (Espen). Her desk (the drawer holds the spare
 * monocle, the diary lies on top), a telescope aimed at the gate,
 * bookshelves, a bust of Volta in a scarf, and Count Flapula hanging from
 * the dormer window's latch. Feed him the opened jam and he flutters up to
 * a rafter; then the window opens onto the roof.
 *
 * Local flags: study.drawerOpen, study.batTalked.
 */
import type { Ctx, RoomDef, Script } from '../../types'
import { F } from '../flags'

/** Where the Count hangs (the latch) and where he dines (a rafter). */
export const BAT_LATCH = { x: 300, y: 60 } as const
export const BAT_RAFTER = { x: 214, y: 13 } as const

const DRAWER_OPEN = 'study.drawerOpen'
const BAT_TALKED = 'study.batTalked'

function* batTalk(c: Ctx): Script {
  yield c.face(c.is(F.batFed) ? 'up' : 'right')
  if (c.is(F.batFed)) {
    yield c.sayAs('bat', c.pick([
      'Slurrrp. Go away, rabbit. I am dining.',
      'Blood of the lingon. A fine vintage. Nineteen eighty-seven.',
      'Do not look at me while I feed. It is very personal. Slurp.',
    ]))
    return
  }
  if (!c.is(BAT_TALKED)) {
    c.set(BAT_TALKED)
    yield c.sfx('bat-squeak')
    yield c.sayAs('bat', 'Good EVENING. I am Count Flapula. Terror of the attic. Lord of the latch.')
    yield c.sayAs('bat', 'And you are… a very large rabbit.')
    yield c.say('I\'m Espen. It\'s a costume. I host a podcast about ghosts.')
    yield c.sayAs('bat', 'Of course you do, rabbit.')
  } else {
    yield c.sayAs('bat', 'The rabbit returns. Have you brought me BLOOD?')
  }
  const asked = new Set<string>()
  for (;;) {
    const id: string = yield c.choose([
      { id: 'move', text: 'Could you move? I need that window.', when: !asked.has('move') },
      { id: 'blood', text: 'What kind of blood, exactly?', when: !asked.has('blood') },
      { id: 'rabbit', text: 'I\'m not a rabbit. It\'s a costume.', when: !asked.has('rabbit') },
      { id: 'veg', text: 'Are you… a vegetarian?', when: asked.has('blood') && !asked.has('veg') },
      { id: 'prof', text: 'Did you know the Professor?', when: !asked.has('prof') },
      { id: 'pod', text: 'Can I interview you for my podcast?', when: !asked.has('pod') },
      { id: 'bye', text: 'I\'ll be back. With blood. Probably.' },
    ])
    asked.add(id)
    if (id === 'move') {
      yield c.sayAs('bat', 'MOVE? I have hung from this latch since 1987. The latch and I are one.')
      yield c.sayAs('bat', 'Bring me BLOOD, rabbit, and I shall consider a small flutter.')
    } else if (id === 'blood') {
      yield c.sayAs('bat', 'Red. Rich. Thick. Sweet… ish. Something RED, rabbit.')
      yield c.sayAs('bat', 'I am not fussy. I am extremely fussy. It must be red.')
    } else if (id === 'rabbit') {
      yield c.sayAs('bat', 'Of course. And I am not hanging from a latch. We all have our little stories.')
    } else if (id === 'veg') {
      yield c.sayAs('bat', '…')
      yield c.sayAs('bat', 'How DARE you. I am a creature of the NIGHT. I drink the blood of the living!')
      yield c.wait(0.6)
      yield c.sayAs('bat', '(Is there beetroot? Do not tell anyone I asked about beetroot.)')
    } else if (id === 'prof') {
      yield c.sayAs('bat', 'Ottilie. She knitted me this cape. Then one night: a great flash. And no more Ottilie.')
      yield c.sayAs('bat', 'Only that CAT. The cat looks at me the way Ottilie looked at me. Disappointed.')
    } else if (id === 'pod') {
      yield c.sayAs('bat', 'A pod-cast? Is it a kind of coffin?')
      yield c.say('Sort of. Eleven people listen to it.')
      yield c.sayAs('bat', 'Eleven! That is ten more than my crypt. Very well. Say I was TERRIFYING.')
    } else {
      yield c.sayAs('bat', 'Go, rabbit. Hop into the darkness.')
      return
    }
  }
}

function* feedBat(c: Ctx): Script {
  yield c.face('right')
  if (!c.is(F.jamOpen)) {
    yield c.say('Here. It\'s red. It\'s… sort of blood-adjacent?')
    yield c.sayAs('bat', 'It is in a JAR, rabbit. With a LID. I cannot drink through GLASS.')
    yield c.say('I can\'t get the lid off either. Somebody strong needs to warm it up. Or somebody with a furnace.')
    return
  }
  yield c.say('Count! Fresh blood. Well. Fresh-ish. Red, anyway.')
  yield c.sayAs('bat', 'Sniff. Sniff sniff.')
  yield c.sayAs('bat', 'It\'s red. That will do.')
  yield c.sfx('bat-flap')
  c.take('jam')
  c.set(F.batFed)
  // He flutters up to a rafter with the jar, in little hops.
  yield c.pose('fly', undefined, 'bat')
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = Math.round(BAT_LATCH.x + (BAT_RAFTER.x - BAT_LATCH.x) * t)
    const y = Math.round(BAT_LATCH.y + (BAT_RAFTER.y - BAT_LATCH.y) * t - Math.sin(t * Math.PI) * 14)
    yield c.place('bat', 'study', x, y, 'left')
    yield c.wait(0.07)
  }
  yield c.pose('rafter', undefined, 'bat')
  yield c.sfx('slurp')
  yield c.solve('bat')
  yield c.sayAs('bat', 'Slurrrp. Ahh. Blood of the lingon. My favourite victim.')
  yield c.say('The latch is free! The window, the window!')
}

export const room: RoomDef = {
  id: 'study',
  name: 'The Professor\'s Study',
  floor: 'attic',
  w: 420,
  walk: [[[14, 110], [408, 110], [416, 141], [6, 141]]],
  first: function* (c) {
    // The Count hangs from the latch until he is fed (older saves: put him back).
    if (!c.is(F.batFed)) yield c.place('bat', 'study', BAT_LATCH.x, BAT_LATCH.y, 'down')
    yield c.say('The Professor\'s study! Nobody has been in here since 1987. Except me. Now.')
  },
  hotspots: [
    {
      id: 'to-storeroom',
      name: 'door to the storeroom',
      rect: [4, 36, 30, 72],
      at: [22, 118],
      face: 'left',
      exit: { to: 'storeroom', x: 414, y: 118, face: 'left' },
    },
    {
      id: 'shelves',
      name: 'bookshelves',
      rect: [40, 20, 64, 88],
      at: [72, 116],
      face: 'up',
      verbs: {
        look: c => c.pick([
          '"Lightning and You". "Lightning and You II: The Return". "Knitting for Bats".',
          '"Cats: Nine Lives, One Owner". "Polarity for Beginners". "So You Have Become an Animal".',
          '"The Care and Feeding of Vampire Bats (Vegetarian Edition)". Interesting.',
        ]),
        pickup: 'I pull out a book. In films a wall swings open now. This is not a film. Yet.',
        pull: 'I pull out a book. In films a wall swings open now. This is not a film. Yet.',
        push: 'Nothing swings open. I pushed every book. It\'s just a shelf. A shelf with no secrets.',
        use: 'I\'d love to read them all. I have a storm to get through first.',
      },
      useWith: { emf: emfBeep('Beep. One book is humming. "So You Have Become an Animal". Page 9 is folded down.') },
    },
    {
      id: 'desk',
      name: 'desk',
      rect: [110, 64, 80, 44],
      at: [150, 118],
      face: 'up',
      verbs: {
        look: 'The Professor\'s desk. Brass instruments, dry ink, a diary, and a drawer with a little brass knob.',
        open: c => openDrawer(c),
        pull: c => openDrawer(c),
        close: c => closeDrawer(c),
        push: 'It\'s bolted to the floor. Inventors bolt everything down. Explosions, I suppose.',
        use: 'I sit at the desk. I feel cleverer already. The feeling passes.',
      },
    },
    {
      id: 'drawer',
      name: 'drawer',
      rect: [136, 88, 30, 10],
      at: [150, 118],
      face: 'up',
      z: 1,
      default: 'open',
      verbs: {
        look: c => c.is(DRAWER_OPEN)
          ? (c.is(F.monocleTaken) ? 'Pencil stubs and a biscuit from 1987. The biscuit stays.' : 'There\'s a monocle in the drawer! Brass, with a chain.')
          : 'A drawer with a little brass knob shaped like a lightning bolt.',
        open: c => openDrawer(c),
        pull: c => openDrawer(c),
        close: c => closeDrawer(c),
        push: c => closeDrawer(c),
      },
    },
    {
      id: 'monocle',
      name: 'monocle',
      rect: [142, 89, 16, 8],
      at: [150, 118],
      face: 'up',
      z: 2,
      default: 'pickup',
      when: s => !!s.flags[DRAWER_OPEN] && !s.flags[F.monocleTaken],
      verbs: {
        look: 'A monocle with a brass rim and a chain. Engraved: O.V. The one from the portrait downstairs, maybe.',
        pickup: function* (c) {
          if (c.is(F.monocleTaken)) return
          yield c.sfx('pickup')
          c.give('monocle')
          c.set(F.monocleTaken)
          yield c.solve('monocle')
          yield c.say('The Professor\'s spare monocle! She always wore one. Episode four: "The Woman With One Lens".')
        },
      },
    },
    {
      id: 'diary',
      name: 'diary',
      rect: [114, 60, 22, 8],
      at: [132, 118],
      face: 'up',
      z: 2,
      verbs: {
        look: c => readDiary(c),
        open: c => readDiary(c),
        use: c => readDiary(c),
        pickup: 'It\'s her private diary. I\'ll read it here, where it lives. Like a gentleman.',
      },
      useWith: { emf: emfBeep('Beep beep beep. The diary is VERY charged. Emotionally and literally.') },
    },
    {
      id: 'deskclock',
      name: 'desk clock',
      rect: [141, 53, 14, 12],
      at: [150, 118],
      face: 'up',
      z: 2,
      verbs: {
        look: 'A brass desk clock. Stopped at 11:59. Every clock in this house is stuck at one minute to midnight.',
        use: 'I tap it. The second hand twitches towards twelve, thinks better of it, and goes back.',
        pickup: 'It\'s screwed to the desk. Somebody really didn\'t want this clock to go anywhere. Or any when.',
        talk: 'Tick? …Tock? Come on. One more minute. You can do it.',
      },
      useWith: { emf: emfBeep('Beep. Time itself is haunted. Or it\'s the brass. Probably the brass. But what if time.') },
    },
    {
      id: 'lamp',
      name: 'desk lamp',
      rect: [170, 46, 14, 20],
      at: [168, 118],
      face: 'up',
      z: 1,
      verbs: {
        look: 'A green banker\'s lamp, still on after all these years. The electricity bill must be haunting.',
        use: 'I click it off. I click it on again quickly. It\'s very dark in here otherwise.',
        pickup: 'It\'s wired in. And I\'d have to give up light. No.',
      },
    },
    {
      id: 'bust',
      name: 'bust of Volta',
      rect: [196, 46, 30, 62],
      at: [212, 118],
      face: 'up',
      verbs: {
        look: 'Alessandro Volta, inventor of the battery. Someone knitted him a scarf. He looks cosy and smug.',
        talk: function* (c) {
          yield c.say('Signor Volta. Big fan. Huge. Would you happen to have a spare battery?')
          yield c.wait(1)
          yield c.say('He\'s plaster. And Italian. And dead since 1827. Three strikes.')
        },
        pickup: 'He\'s solid plaster. He weighs a ton. He invented the battery, not the lightweight bust.',
        pull: 'I want his scarf. But he\'s a bust. No body heat. He needs it more than I do.',
        use: 'I pat his head for luck. Every inventor could use some tonight.',
        push: 'He wobbles. I steady him. We share a moment.',
      },
      useWith: { emf: emfBeep('Beep! Faint, but there. Volta\'s ghost? Or just a very proud bust.') },
    },
    {
      id: 'window',
      name: 'dormer window',
      rect: [278, 18, 44, 42],
      at: [278, 116],
      face: 'right',
      when: s => !s.flags[F.windowOpen],
      verbs: {
        look: c => c.is(F.batFed)
          ? 'The dormer window. The latch is free now. The roof is right outside.'
          : 'The dormer window, out onto the roof. There\'s a bat hanging from the latch. Of course there is.',
        open: function* (c) {
          if (!c.is(F.batFed)) {
            yield c.say('The Count is hanging from the latch. I can\'t open the window without opening him.')
            yield c.sayAs('bat', 'Touch my latch, rabbit, and I shall BITE your EARS.')
            return
          }
          yield c.pose('reach', 0.8)
          yield c.sfx('window-open')
          c.set(F.windowOpen)
          yield c.lightning(0.8)
          yield c.solve('window')
          yield c.say('Whoa. Rain. Wind. Lightning. The ROOF.')
          yield c.say('Of course I\'m going out on the roof. In a thunderstorm. Wearing ears. Episode twelve!')
        },
        push: 'I\'d rather OPEN it, like a normal person. A normal person on a roof in a storm.',
        pull: 'I\'d rather OPEN it, like a normal person. A normal person on a roof in a storm.',
      },
      useWith: { emf: emfBeep('BEEP! That\'s the storm. And… a small, angry, cape-shaped reading.') },
    },
    {
      id: 'window-out',
      name: 'roof',
      rect: [278, 18, 44, 42],
      at: [300, 114],
      face: 'up',
      when: s => !!s.flags[F.windowOpen],
      verbs: {
        look: 'The dormer window, wide open. Rain is coming in sideways. The roof is out there.',
        close: 'I\'d be shutting myself in. I\'m not great at that tonight.',
      },
      exit: { to: 'roof', x: 60, y: 118, face: 'right' },
    },
    {
      id: 'bat',
      name: 'Count Flapula',
      rect: [BAT_LATCH.x - 10, BAT_LATCH.y - 2, 21, 30],
      at: [276, 118],
      face: 'right',
      z: 3,
      actor: 'bat',
      when: s => !s.flags[F.batFed],
      verbs: {
        look: 'A small bat in a velvet cape, hanging from the window latch, eyeing my neck. Theatrically.',
        talk: c => batTalk(c),
        pickup: function* (c) {
          yield c.sfx('bat-squeak')
          yield c.sayAs('bat', 'UNHAND me, rabbit! I am nobility!')
        },
        pull: function* (c) {
          yield c.sfx('bat-squeak')
          yield c.sayAs('bat', 'I grip this latch with the strength of a thousand nights. And quite strong toes.')
        },
        push: function* (c) {
          yield c.sayAs('bat', 'Wheee! …I mean: HOW DARE YOU.')
        },
      },
      giveWith: { jam: c => feedBat(c) },
      useWith: {
        jam: c => feedBat(c),
        emf: function* (c) {
          yield c.sfx('emf')
          yield c.say('Beep. Beep. Beep. He\'s undead! Maybe! He\'s at least very dramatic.')
          yield c.sayAs('bat', 'Stop pointing that at me. It is rude to measure a count.')
        },
      },
      anyItem: function* (c) {
        yield c.sayAs('bat', 'Is it red? Is it BLOOD? No? Then take it away, rabbit.')
      },
    },
    {
      id: 'bat-rafter',
      name: 'Count Flapula',
      rect: [BAT_RAFTER.x - 10, BAT_RAFTER.y - 3, 28, 30],
      at: [188, 120],
      face: 'right',
      z: 3,
      actor: 'bat',
      when: s => !!s.flags[F.batFed],
      verbs: {
        look: 'The Count, upside down on a rafter, drinking lingonberry jam through a straw. Living his truth.',
        talk: c => batTalk(c),
        pickup: 'He\'s up on a rafter now, and happy. Let him have this.',
      },
      anyItem: function* (c) {
        yield c.sayAs('bat', 'I have my blood, rabbit. Leave me to it.')
      },
    },
    {
      id: 'telescope',
      name: 'telescope',
      rect: [336, 42, 44, 66],
      at: [352, 118],
      face: 'right',
      default: 'use',
      verbs: {
        look: c => lookScope(c),
        use: c => lookScope(c),
        push: 'I nudge it. Now it\'s looking at a cloud. I nudge it back. Brunhilde again.',
        pickup: 'It\'s brass, and taller than me. And it\'s looking at something.',
      },
      useWith: { emf: emfBeep('Nothing. Telescopes are rarely haunted. Rarely.') },
    },
    {
      id: 'porthole',
      name: 'little window',
      rect: [388, 36, 26, 26],
      at: [396, 116],
      face: 'right',
      verbs: {
        look: 'A little round window in the gable. Through it: rain, the gate and a very small Volvo.',
        open: 'Painted shut. Everything in this house is painted shut, bolted down or a bat.',
      },
    },
    {
      id: 'catbed',
      name: 'cat bed',
      rect: [264, 100, 24, 9],
      at: [276, 116],
      face: 'up',
      verbs: {
        look: 'A velvet cat bed, full of white hairs. Someone still sleeps here when nobody\'s looking.',
        pickup: 'It\'s somebody\'s bed. You don\'t take somebody\'s bed. Even a cat\'s. ESPECIALLY a cat\'s.',
        use: 'I\'m not getting in. …It does look very comfortable.',
        talk: 'Here, kitty kitty? …Nobody home. Just hairs, and a smell of old books.',
      },
      useWith: { emf: emfBeep('BEEP. BEEP. A strong reading from a cat bed. Whose cat is this? WHO is this cat?') },
    },
    {
      id: 'books',
      name: 'stack of books',
      rect: [232, 86, 30, 22],
      at: [246, 116],
      face: 'up',
      verbs: {
        look: 'A stack of books as tall as me. The top one: "Midnight: Why It Matters".',
        pickup: 'If I take one from the bottom, it\'s the end of me. I\'ve seen the cartoons.',
        use: '"At midnight, a storm\'s charge is at its peak." Underlined three times. Somebody cared a lot.',
        push: 'It sways. I un-sway it. Nobody saw.',
      },
    },
  ],
}

function* openDrawer(c: Ctx): Script {
  if (c.is(DRAWER_OPEN)) { yield c.say('It\'s open.'); return }
  c.set(DRAWER_OPEN)
  yield c.sfx('drawer')
  yield c.say(c.is(F.monocleTaken) ? 'Pencil stubs and a biscuit from 1987.' : 'There\'s a monocle in here! On a chain!')
}

function* closeDrawer(c: Ctx): Script {
  if (!c.is(DRAWER_OPEN)) { yield c.say('It\'s shut.'); return }
  c.clear(DRAWER_OPEN)
  yield c.sfx('drawer')
}

function* readDiary(c: Ctx): Script {
  if (c.is(F.diaryRead)) {
    yield c.say('"Test tonight. Subject: me. Target: something with nine lives, just in case." I read it four times.')
    yield c.say('And: "To undo: same subject, same booth, reverse polarity. At midnight." Whatever that means.')
    return
  }
  yield c.say('The Professor\'s diary. The last page is from September 1987.')
  yield c.say('"Friday. The storm is perfect. The transmogrifier is finished. The Count is sulking again."')
  yield c.say('"Test tonight. Subject: me. Target: something with nine lives, just in case."')
  yield c.say('"If it goes wrong: same subject, same booth, reverse polarity. At the stroke of midnight."')
  yield c.say('"P.S. Buy jam. The Count won\'t eat anything that isn\'t red."')
  c.set(F.diaryRead)
  yield c.solve('diary')
  yield c.pose('think', 1.5)
  yield c.say('Something with nine lives. A ghost? No. A cat? A cat that\'s secretly a professor?')
  yield c.say('No. That\'s crazy. That\'s episode THIRTEEN crazy. …I\'m writing it down anyway.')
}

function* lookScope(c: Ctx): Script {
  yield c.say('I look through it. Down at the gate: Brunhilde, blinking her hazard lights in the rain.')
  yield c.say('She looks lonely. Kjell would cry. Kjell would definitely cry.')
}

function emfBeep(line: string) {
  return function* (c: Ctx): Script {
    yield c.sfx('emf')
    yield c.say(line)
  }
}
