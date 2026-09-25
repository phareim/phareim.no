/**
 * The laboratory (Dag, cellar). The Lightning Machine with a car battery
 * bolted into its heart, the transmogrifier booth (in the foreground: the
 * heroes walk behind it, never in front), the big ARM lever, the
 * blackboard, the lightning cable from the roof, a brain in a jar (a
 * cauliflower).
 *
 * Puzzles: 10 (the cat into the booth), 21 (the lever).
 *
 * Local flags: lab.booth (the booth door open), lab.doodle (Dag drew a
 * sandwich on the blackboard).
 */
import type { Ctx, RoomDef, Script } from '../../types'
import { F } from '../flags'

/** Where things are, for the painter and the finale (story.ts). */
export const LAB = {
  /** The booth: its glass cylinder (x, y, w, h) and base centre. */
  booth: { x: 282, y: 62, w: 56, h: 72, cx: 310, base: 134 },
  /** Mrs Whiskers on the small seat inside the booth (feet). */
  boothCat: { x: 297, y: 118 },
  /** The Professor standing inside the booth (feet), and where to place her once she steps out. */
  professor: { x: 318, y: 134 },
  professorOut: { x: 262, y: 126 },
  /** The car battery in the machine's porthole (centre). */
  battery: { x: 199, y: 78 },
  /** The machine's middle, the two coil tops, where the cable comes through the ceiling. */
  machine: { x: 198, y: 60 },
  coils: [[170, 12], [228, 12]] as const,
  cable: { x: 199, y: 0 },
  /** The lever's handle, and Dag's spot in front of it. */
  lever: { x: 361, y: 60 },
  dagLever: { x: 360, y: 114 },
}

const once = (c: Ctx, id: string) => !c.is('solved.' + id)

function* catIntoBooth(c: Ctx): Script {
  if (c.is(F.catInBooth)) { yield c.say('She\'s in. One cat per booth.'); return }
  if (!c.is('lab.booth')) {
    yield c.sfx('booth-door')
    c.set('lab.booth')
    yield c.say('Door first.')
  }
  yield c.pose('reach', 0.7)
  c.take('cat')
  yield c.show('cat', true)
  yield c.place('cat', 'lab', LAB.boothCat.x, LAB.boothCat.y, 'right')
  yield c.pose('booth', undefined, 'cat')
  yield c.sfx('cat-meow')
  yield c.say('In you go, Mrs Whiskers. There\'s a little seat with a cushion. Somebody made you a cushion.')
  yield c.sayAs('cat', 'Mrrrp.')
  yield c.sfx('booth-door')
  c.clear('lab.booth')
  c.set(F.boothClosed)
  c.set(F.catInBooth)
  if (once(c, 'booth')) yield c.solve('booth')
  yield c.say('She sat straight down on the small seat. Like she knew which one was hers.')
}

function* pullLever(c: Ctx): Script {
  if (c.is(F.leverArmed)) {
    yield c.pose('strain', 0.6)
    yield c.say('It\'s down already. Any further down and it\'s the floor.')
    return
  }
  yield c.pose('strain', 1.0)
  yield c.wait(0.6)
  yield c.sfx('lever-clunk')
  yield c.shake(0.35, 1)
  c.set(F.leverArmed)
  yield c.sfx('machine-hum')
  yield c.flash('#9fffd0', 0.35)
  if (once(c, 'lever')) yield c.solve('lever')
  yield c.say('CLUNK. Now it\'s humming. I\'m humming too. I think it\'s catching.')
  if (!c.is(F.junctionBridged)) yield c.say('The little lamp says ARMED. The cable from the roof\'s still dead, though. Armed and waiting. Like me at a buffet.')
  else yield c.say('ARMED, says the lamp. All it needs now is midnight. And a lot of weather.')
}

function* lookBoard(c: Ctx): Script {
  yield c.say('The blackboard. "MIDNIGHT = MAXIMUM VOLTAGE". Underlined three times.')
  yield c.say('"TO UNDO: SAME SUBJECT, SAME BOOTH, REVERSE POLARITY." And a drawing of a lady turning into a cat.')
  yield c.say('The lady in the drawing has a monocle. The cat in the drawing has a ring round one eye. I\'m just saying.')
  if (c.is('lab.doodle')) yield c.say('And my sandwich, bottom right. It really brings the board together.')
}

export const room: RoomDef = {
  id: 'lab',
  name: 'Laboratory',
  floor: 'cellar',
  w: 440,
  walk: [[[26, 110], [436, 110], [439, 142], [1, 142]]],
  blocks: [
    [[128, 104], [268, 104], [268, 114], [128, 114]], // the machine's plinth
    [[276, 124], [344, 124], [344, 144], [276, 144]], // the booth (foreground)
    [[382, 104], [440, 104], [440, 115], [382, 115]], // the bench
  ],
  first: function* (c) {
    if (c.hero !== 'dag') return
    yield c.say('Whoa.')
    yield c.say('A car battery. Right in the middle of all that. Kjell\'s going to want to marry it.')
  },
  hotspots: [
    {
      id: 'to-boiler', name: 'Boiler room', rect: [0, 20, 26, 92], at: [14, 124], face: 'left',
      exit: { to: 'boiler', x: 350, y: 118, face: 'down' },
    },
    {
      id: 'board', name: 'Blackboard', rect: [32, 14, 82, 54], at: [72, 116], face: 'up',
      verbs: {
        look: lookBoard,
        use: function* (c) {
          if (c.is('lab.doodle')) { yield c.say('It\'s perfect as it is. You don\'t touch a masterpiece.'); return }
          yield c.pose('reach', 1.2)
          yield c.sfx('squeak')
          yield c.wait(0.8)
          c.set('lab.doodle')
          yield c.say('I drew a sandwich in the corner. For morale.')
        },
        pickup: 'I\'ll leave the chalk. It\'s done enough, with all that maths.',
        push: 'It swivels. There\'s nothing on the back but more maths, and a shopping list: "BRASS. MORE BRASS. MILK."',
        talk: 'I read it out loud, slowly. It doesn\'t get simpler. It gets louder.',
      },
    },
    {
      id: 'machine',
      name: 'Lightning Machine',
      rect: [128, 8, 142, 104], at: [198, 118], face: 'up',
      verbs: {
        look: c => c.is(F.batteryOut)
          ? 'The Lightning Machine, with a hole in its heart where the battery was. It looks relieved.'
          : c.is(F.struck)
            ? 'It\'s glowing. Full to the brim with lightning. So\'s the battery.'
            : 'The Lightning Machine. Brass, glass, coils, bubbling tubes, and a car battery right in its heart.',
        use: 'There\'s no on switch. Just that big lever. Big levers are always the on switch.',
        push: 'It\'s bolted to the floor. Everything in this lab is bolted to something.',
        pull: 'It\'s bolted to the floor. Everything in this lab is bolted to something.',
        pickup: 'I carried a fridge once. This is not a fridge.',
        open: 'There are no doors on it. Just portholes, and the battery winking at me.',
        talk: 'Hello, machine. …It hummed. That was either hello or a warning.',
      },
      anyItem: 'It doesn\'t want that. It wants lightning. It\'s very single-minded.',
    },
    {
      id: 'battery', name: 'Car battery', rect: [184, 62, 30, 32], at: [198, 118], face: 'up', z: 2,
      when: s => !s.flags[F.batteryOut],
      verbs: {
        look: c => c.is(F.struck)
          ? 'The battery\'s charged. I can feel it in my beard.'
          : 'A car battery, bolted in with brass straps. Twelve volts. Flat as a pancake. And I know pancakes.',
        pickup: 'It\'s bolted in with brass bolts the size of my thumbs. I\'d need the Professor\'s spanner. Or the Professor.',
        use: 'It\'s flat. It needs a charge first. A big one.',
        pull: 'It doesn\'t budge. Brass bolts. Professor-strength brass bolts.',
        talk: 'Hang in there, little buddy. Kjell\'s coming for you. Kjell\'s always coming for batteries.',
      },
    },
    {
      id: 'coils', name: 'Coils', rect: [156, 2, 88, 38], at: [198, 118], face: 'up', z: 1,
      verbs: {
        look: c => c.is(F.leverArmed)
          ? 'The coils are crackling now. The metal doughnuts on top are angry.'
          : 'Two tall coils, with big metal doughnuts on top. I bet when this thing runs, the doughnuts get angry.',
        use: 'I\'m not touching the doughnuts. The metal ones.',
        pickup: 'Too high, too sparky.',
      },
    },
    {
      id: 'cable', name: 'Lightning cable', rect: [192, 0, 14, 22], at: [198, 118], face: 'up', z: 3,
      verbs: {
        look: c => c.is(F.junctionBridged)
          ? 'The cable from the roof. It\'s warm now. Somebody upstairs connected something. Kjell. Kjell connects things.'
          : 'A thick cable down through the ceiling, into the machine. It runs up the house to the roof. It\'s cold. Somewhere up there, it\'s broken.',
        pull: 'It\'s bolted to the ceiling. The ceiling\'s bolted to the house. The house has opinions.',
        use: 'I can\'t reach it. And I wouldn\'t.',
        talk: 'HELLO UP THERE. …It carries sound as well as lightning, apparently. Nobody answered.',
      },
    },
    {
      id: 'booth',
      name: 'Booth',
      rect: [278, 48, 64, 94], at: [352, 128], face: 'left',
      verbs: {
        look: c => c.is(F.catInBooth)
          ? 'Mrs Whiskers, sitting in the booth like she owns it. She might.'
          : 'A glass booth with a door. There are two seats inside: a big one, and a cat-sized one with a cushion.',
        open: function* (c) {
          if (c.is(F.catInBooth)) { yield c.say('She\'s comfortable. If I let her out now she\'d never forgive me. She\'ll never forgive me anyway.'); return }
          if (c.is('lab.booth')) { yield c.say('It\'s open.'); return }
          yield c.sfx('booth-door')
          c.set('lab.booth')
          yield c.say('The door swings open. It smells of ozone and cat.')
        },
        close: function* (c) {
          if (!c.is('lab.booth')) { yield c.say('It\'s shut.'); return }
          yield c.sfx('booth-door')
          c.clear('lab.booth')
        },
        use: 'I\'m not getting in there. I\'ve seen what it does. Well. I\'ve seen the blackboard.',
        push: 'It\'s bolted down. Of course it is.',
        talk: 'Anyone in there? …Just my reflection. It looks tired.',
        pickup: 'It\'s a booth. You don\'t pick up a booth. A booth picks you.',
      },
      useWith: { cat: catIntoBooth, sandwich: 'It\'s not a toaster. I checked. It\'s the first thing I checked.' },
      giveWith: { cat: catIntoBooth },
      anyItem: 'Only one thing belongs in there, the blackboard says. Same subject, same booth.',
    },
    {
      id: 'booth-cat', name: 'Mrs Whiskers', actor: 'cat', rect: [288, 102, 20, 18], at: [352, 128], face: 'left', z: 3,
      when: s => !!s.flags[F.catInBooth] && s.actors.cat?.room === 'lab' && s.actors.cat.visible,
      verbs: {
        look: 'Mrs Whiskers, in her monocle, in the booth. She looks like she\'s done this before.',
        talk: function* (c) { yield c.say('Comfy?'); yield c.sfx('cat-purr'); yield c.sayAs('cat', 'Mrrrrr.') },
        pickup: 'She\'s where she wants to be. She told me with her eyes.',
        open: 'She\'s comfortable. If I let her out now she\'d never forgive me.',
      },
      giveWith: {
        jam: function* (c) { yield c.sayAs('cat', 'Hsss.'); yield c.say('Not a jam cat. Noted.') },
        sandwich: function* (c) { yield c.sayAs('cat', '…'); yield c.say('She looked at the sandwich, then at me. I feel judged.') },
      },
    },
    {
      id: 'lever',
      name: 'Big lever',
      rect: [344, 32, 34, 66], at: [360, 114], face: 'up',
      default: 'pull',
      verbs: {
        look: c => c.is(F.leverArmed)
          ? 'The big lever, down. The little lamp says ARMED. The whole lab is humming along.'
          : 'A big lever. The sign says ARM. Next to "down" there\'s a little drawing of a man with no eyebrows.',
        pull: pullLever,
        use: pullLever,
        push: function* (c) {
          if (!c.is(F.leverArmed)) { yield c.say('It\'s up already. Up is off. I think. The man with no eyebrows is next to "down".'); return }
          yield c.pose('strain', 0.8)
          yield c.sfx('lever-clunk')
          c.clear(F.leverArmed)
          yield c.say('Back up. Safe. Quiet. Boring.')
        },
        talk: 'You and me, lever. Big night.',
      },
    },
    {
      id: 'labclock', name: 'Clock', rect: [352, 11, 18, 18], at: [360, 114], face: 'up', z: 1,
      verbs: {
        look: c => c.is(F.struck)
          ? 'Midnight, at last. The clock looks relieved. So does the house.'
          : 'A lab clock, stopped at 11:59. Like the one upstairs, Kjell says. This house really wants it to be midnight.',
        use: 'It won\'t wind from here. The big clock\'s upstairs. This one just copies it.',
        pickup: 'It\'s screwed to the wall. Time\'s stuck here in every way.',
      },
    },
    {
      id: 'brain', name: 'Brain in a jar', rect: [386, 54, 22, 30], at: [398, 120], face: 'up', z: 1,
      verbs: {
        look: function* (c) {
          yield c.say('A brain in a jar.')
          yield c.say('…No. It\'s a cauliflower. In brine. The label says "SPARE BRAIN". She had a sense of humour.')
        },
        pickup: 'I\'d eat it. But it\'s watching me.',
        open: 'Pickled cauliflower, 1987. Even I have limits. I have one limit. It\'s this.',
        talk: 'Any thoughts? …It\'s thinking about it.',
        use: 'It\'s not really a brain. It can\'t help. It\'s in the same boat as me, then.',
      },
    },
    {
      id: 'flasks', name: 'Flasks', rect: [410, 56, 28, 30], at: [414, 120], face: 'up', z: 1,
      verbs: {
        look: 'Flasks bubbling away with no flame under them. Green, pink, and one that\'s the colour of Tuesday.',
        pickup: 'They\'re boiling without a flame. I don\'t touch anything that boils out of spite.',
        use: 'I\'ve had worse at parties. No, I haven\'t.',
        talk: 'Blub. …They said blub.',
      },
      anyItem: 'I\'m not dipping anything in there. I want it back.',
    },
  ],
}
