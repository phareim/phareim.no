/**
 * The pantry (Dag, cellar). Where the chute from the foyer dropped him, onto
 * a mattress that is suspiciously well placed. Jam shelves (LINGON 1987),
 * the herring barrel, the dumbwaiter hatch with its bell, the coal chute
 * with the rain coming in, and the stairs up to a door nailed shut from the
 * other side (open once the house lets the stairs down: F.stairsDown).
 *
 * Puzzle 6 starts here: PICK UP jam.
 *
 * Local flags: pantry.jam (jars taken), pantry.hatch (hatch open),
 * pantry.barrel (herring lid off).
 */
import type { Ctx, RoomDef, Script } from '../../types'
import { F } from '../flags'

/** Where things are, for the painters and the story (the intro drops Dag down the chute). */
export const PANTRY = {
  /** The hole in the ceiling: centre x, and the mattress Dag lands on (top y). */
  chute: { x: 200, y: 0, mattressY: 108 },
  /** Dag's start: on his feet in front of the mattress. */
  dag: { x: 200, y: 124 },
  hatch: { x: 254, y: 62 },
  stairsDoor: { x: 22, y: 48 },
}

function* takeJam(c: Ctx): Script {
  const holder = c.who('jam')
  if (holder === c.hero) { yield c.say(c.is(F.jamOpen) ? 'I\'ve got one open. One at a time. I\'m greedy, not a monster.' : 'I\'ve got one already. One stuck jar is enough for any man.'); return }
  if (holder) { yield c.say('One jar\'s out in the world already. I\'m pacing myself.'); return }
  if (c.is(F.batFed)) { yield c.say('I\'ll leave the rest. For next time we break down here. There will be a next time. It\'s Brunhilde.'); return }
  yield c.pose('pickup', 0.5)
  yield c.sfx('pickup')
  c.give('jam')
  const n = c.bump('pantry.jam')
  yield c.say(n === 1
    ? 'One jar of LINGON 1987. The Professor would want it eaten. I can tell. I have a feeling for these things.'
    : 'Another jar. The shelf doesn\'t even notice.')
}

export const room: RoomDef = {
  id: 'pantry',
  name: 'Pantry',
  floor: 'cellar',
  w: 400,
  walk: [[[6, 108], [394, 108], [399, 142], [1, 142]]],
  blocks: [
    [[170, 104], [230, 104], [230, 117], [170, 117]], // the mattress under the chute
    [[282, 104], [326, 104], [326, 114], [282, 114]], // herring barrel
  ],
  hotspots: [
    {
      id: 'stairs',
      name: s => s.flags[F.stairsDown] ? 'Stairs up' : 'Cellar stairs',
      rect: [4, 4, 84, 100], at: [92, 118], face: 'left',
      verbs: {
        look: c => c.is(F.stairsDown)
          ? 'The door at the top is open. The house has changed its mind about us.'
          : 'Stairs up to the house. The door at the top is nailed shut from the other side. I can see the nail tips. Somebody didn\'t want the jam getting out.',
        talk: 'Hello? Anyone up there? …Just the house, breathing. Houses don\'t breathe. This one does.',
        push: 'I pushed the door. The nails pushed back.',
        pickup: 'Stairs are for climbing, not carrying. I\'m not doing either tonight.',
      },
      exit: {
        to: 'foyer', x: 60, y: 126, face: 'right',
        open: s => !!s.flags[F.stairsDown],
        locked: function* (c) {
          yield c.sfx('door-locked')
          yield c.say(c.pick([
            'Nailed shut. From the other side. It\'s not going anywhere, and neither am I.',
            'I leaned on it. It leaned back. The door wins.',
          ]))
        },
      },
    },
    {
      id: 'crate', name: 'Potato crate', rect: [30, 78, 34, 26], at: [60, 118], face: 'left', z: 1,
      verbs: {
        look: 'A crate of potatoes. They\'ve grown long pale arms, reaching for the light. I know the feeling.',
        pickup: 'Too heavy. And they\'d grab me.',
        open: 'It\'s open. That\'s how they got their arms out.',
        talk: 'Evening, spuds. …They wave. Slowly.',
        use: 'Raw potato. I have limits. Not many. That\'s one.',
      },
    },
    {
      id: 'jam', name: 'Jam shelves', rect: [96, 12, 78, 88], at: [134, 118], face: 'up',
      default: 'pickup',
      verbs: {
        look: function* (c) {
          yield c.say('Jam. Shelves and shelves of jam. LINGON 1987, every jar, in the Professor\'s handwriting.')
          if (!c.is('pantry.jam')) yield c.say('I think I\'ve found my people.')
        },
        pickup: takeJam,
        use: takeJam,
        open: 'On the shelf? Where anyone could see? I\'ll take one first. Manners.',
        push: 'The shelves lean enough already. They\'re on a slant. Like the rest of the house.',
        talk: 'Hello, jam. …I think they heard me.',
      },
      useWith: {
        jam: 'I put it back. …No. I take it out again. It\'s mine now. We\'ve bonded.',
      },
    },
    {
      id: 'mattress', name: 'Mattress', rect: [168, 90, 64, 26], at: [200, 124], face: 'up',
      verbs: {
        look: 'An old mattress, right under the chute. Either the Professor planned for this, or it happens a lot.',
        pickup: 'I\'m not carrying a mattress. I\'d lie on one, though.',
        use: function* (c) {
          yield c.pose('lie', 1.8)
          yield c.wait(1.6)
          yield c.say('Five minutes. …No. Kjell would worry. Kjell always worries.')
        },
        push: 'It\'s soft. I push, it squishes, I stop. Nobody wins.',
        talk: 'Thanks for catching me.',
      },
    },
    {
      id: 'chute', name: 'Hole in the ceiling', rect: [184, 0, 32, 14], far: true,
      verbs: {
        look: 'That\'s where I came in. The floor upstairs just… let go. Luckily there was a mattress. Luckily, or suspiciously.',
        use: 'I can\'t reach it. And I\'m not going back up. Down is where the jam is.',
        talk: 'KJELL? …Nothing. It only goes one way. Down. Like most things tonight.',
      },
    },
    {
      id: 'onions', name: 'Onions', rect: [279, 6, 14, 30], at: [288, 120], face: 'up',
      verbs: {
        look: 'Onions and garlic, hanging from the beam. Garlic\'s good against vampires. I\'ll keep that in mind.',
        pickup: 'They\'re holding up the ceiling. Probably not. I\'m not risking it.',
        use: 'Raw onion. Even I have limits. I have about two.',
      },
    },
    {
      id: 'bulb', name: 'Light bulb', rect: [227, 10, 10, 24], at: [232, 118], face: 'up', z: 1,
      verbs: {
        look: 'One bare bulb. It does its best.',
        pull: function* (c) {
          yield c.sfx('squeak')
          yield c.say('Click. …Click. It likes being on. I\'ll leave it.')
        },
        use: 'It\'s already on. As on as it gets.',
        pickup: 'It\'s hot, and it\'s the only light I\'ve got.',
      },
    },
    {
      id: 'hatch',
      name: 'Dumbwaiter',
      rect: [238, 38, 32, 44], at: [254, 116], face: 'up',
      verbs: {
        look: function* (c) {
          yield c.say('The dumbwaiter hatch. A little lift for food. It goes up to the kitchen and on to the attic.')
          yield c.say('Anything small I give Kjell or Espen goes up in it. Food goes down, mostly. Like me.')
        },
        open: function* (c) {
          if (c.is('pantry.hatch')) { yield c.say('It\'s open.'); return }
          yield c.sfx('hatch')
          c.set('pantry.hatch')
          yield c.say('The shaft goes up into the dark. It smells of ham. Old ham. Good ham.')
        },
        close: function* (c) {
          if (!c.is('pantry.hatch')) { yield c.say('It\'s shut.'); return }
          yield c.sfx('hatch')
          c.clear('pantry.hatch')
        },
        use: 'I\'d fit one leg in it. One leg\'s no use to anyone up there.',
        talk: function* (c) {
          yield c.say('Hellooo?')
          yield c.wait(0.6)
          yield c.say('…The shaft says hellooo back. That\'s either an echo or Espen.')
        },
        push: 'It slides up, it slides down. It\'s a lift. That\'s all it knows.',
      },
      anyItem: 'Give it to Kjell or Espen and it goes up in the lift by itself. The hatch just holds it.',
    },
    {
      id: 'bell', name: 'Bell', rect: [248, 26, 12, 12], at: [254, 116], face: 'up', z: 2,
      verbs: {
        look: 'A little brass bell on a spring. For "food\'s ready". I\'ve never needed one of those. I always know.',
        use: function* (c) { yield c.sfx('bell'); yield c.say('Ding! …Somewhere upstairs, Kjell just jumped out of his suit.') },
        pull: function* (c) { yield c.sfx('bell'); yield c.say('Ding! I love a bell.') },
        push: function* (c) { yield c.sfx('bell'); yield c.say('Ding.') },
      },
    },
    {
      id: 'barrel',
      name: 'Herring barrel',
      rect: [282, 66, 44, 46], at: [304, 122], face: 'up',
      verbs: {
        look: 'A barrel of pickled herring. SILD, it says. It smells like my grandad\'s boat. And my grandad.',
        open: function* (c) {
          if (c.is('pantry.barrel')) { yield c.say('It\'s open. They\'re still looking.'); return }
          yield c.sfx('creak')
          c.set('pantry.barrel')
          yield c.say('Herring. Hundreds. All looking at me.')
          yield c.say('I\'m hungry. But I\'m not that hungry. Nobody\'s ever been that hungry.')
        },
        close: function* (c) {
          if (!c.is('pantry.barrel')) { yield c.say('It\'s shut. For everyone\'s sake.'); return }
          yield c.sfx('thud')
          c.clear('pantry.barrel')
          yield c.say('Lid on. Sorry, lads.')
        },
        pickup: 'The herring stay together. They\'re a family.',
        push: function* (c) { yield c.sfx('splash'); yield c.say('It sloshes. Something in there sloshes back.') },
        talk: 'Evening, lads. …They\'re not big talkers. They\'re pickled.',
        use: 'I could eat a herring. I could. I won\'t. They know too much.',
      },
    },
    {
      id: 'coalchute', name: 'Coal chute', rect: [332, 4, 44, 106], at: [352, 120], face: 'up',
      verbs: {
        look: 'The coal chute. The rain\'s coming down it. It\'s about as wide as one of my legs.',
        use: 'I got my head in. My head\'s fine. It\'s the rest of me that\'s the problem. It usually is.',
        open: 'It\'s open to the rain already. That\'s its problem.',
        close: 'The flap at the top is rusted open. The rain has a key.',
        pickup: 'Wet coal crumbs. No thanks.',
        talk: 'HELLO, GARDEN. …The garden says drip.',
        push: 'It\'s bolted to the wall. Everything that isn\'t bolted down here has gone mouldy.',
      },
    },
    {
      id: 'to-boiler', name: 'Boiler room', rect: [378, 20, 22, 88], at: [388, 122], face: 'right',
      exit: { to: 'boiler', x: 24, y: 124, face: 'right' },
    },
  ],
}
