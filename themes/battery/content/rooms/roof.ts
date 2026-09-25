/**
 * The Roof (Espen), out through the study's dormer window. A flat lead
 * walkway behind an iron railing (nobody falls off), the slates rising to
 * the ridge, the chimney (sound carries down to the parlour: TALK TO it
 * for the séance), the lightning rod lying in its rusted socket (oil, then
 * PULL), the rooster weather vane, and far below Brunhilde at the gate.
 *
 * Coordinates the finale uses: ROOF (below).
 */
import type { Ctx, RoomDef, Script } from '../../types'
import { F } from '../flags'
// The séance lives with Aunt Hedvig in the parlour; the chimney only carries the voices.
import { seance } from './parlour'

export const ROOF = {
  w: 460,
  /** The rod's socket (its foot) and its tip when raised. */
  socket: { x: 340, y: 102 },
  rodTip: { x: 340, y: 12 },
  /** Where Espen stands to hold the rod (feet), facing right. */
  holdRod: { x: 326, y: 118 },
  chimney: { x: 168, y: 14, standAt: { x: 168, y: 118 } },
  window: { x: 54, y: 80, standAt: { x: 56, y: 116 } },
} as const

function* raiseRod(c: Ctx): Script {
  if (c.is(F.rodUp)) {
    yield c.say('It\'s up. It took all I had. It stays up.')
    return
  }
  yield c.face('right')
  yield c.pose('strain', 1.3)
  yield c.sfx('rust-squeal')
  yield c.wait(1)
  if (!c.is(F.socketOiled)) {
    yield c.say('Nnnngh! Rusted solid. The socket hasn\'t moved since 1987.')
    yield c.say('It needs oil. Or a very strong podcaster. Oil, then.')
    return
  }
  yield c.sfx('rust-squeal')
  yield c.pose('strain', 0.8)
  yield c.wait(0.6)
  c.set(F.rodUp)
  yield c.sfx('rod-clang')
  yield c.shake(0.3, 1)
  yield c.pose('cheer', 1.2)
  yield c.solve('rod')
  yield c.say('CLANG! The lightning rod is up! Come on then, sky. Hit me. Not me. Hit THAT.')
  yield c.lightning(0.6)
  yield c.say('Its cable runs down the wall, past the parlour, into the conservatory. Somewhere below: the lab.')
}

function* oilSocket(c: Ctx): Script {
  if (c.is(F.socketOiled)) { yield c.say('It\'s oiled already. Any more and it\'s a salad.'); return }
  yield c.pose('reach', 1)
  yield c.sfx('glug')
  c.set(F.socketOiled)
  c.take('oil')
  yield c.wait(0.6)
  yield c.say('Glug, glug. 1987 olive oil, all over the rusty socket. Kjell, you genius. You weird genius.')
}

export const room: RoomDef = {
  id: 'roof',
  name: 'The Roof',
  floor: 'attic',
  w: ROOF.w,
  walk: [[[20, 108], [398, 108], [402, 133], [16, 133]]],
  blocks: [[[232, 106], [270, 106], [270, 115], [232, 115]]],
  first: function* (c) {
    yield c.lightning(1)
    yield c.say('I\'m on the roof. In a storm. In a rabbit suit.')
    yield c.say('My mum would be so worried. My listeners would be so pleased.')
  },
  hotspots: [
    {
      id: 'sky',
      name: 'storm',
      rect: [0, 0, 460, 60],
      far: true,
      verbs: {
        look: c => c.is(F.rodUp)
          ? 'The storm is right above us. The rod is pointing at it. Go on. Go ON.'
          : 'Black clouds rolling in off the sea, lit from inside. It\'s building up to something.',
        talk: 'Storm! Do your worst! …Not literally. Medium worst.',
      },
      useWith: { emf: c => emf(c, 'BEEEEEEEP. The needle is hitting the end. The storm is ALL ghosts. Or electricity.') },
    },
    {
      id: 'town',
      name: 'town across the bay',
      rect: [80, 56, 60, 10],
      far: true,
      verbs: {
        look: 'Across the bay: the town and the lighthouse. Everyone there is dry, with a car that starts.',
      },
    },
    {
      id: 'window-in',
      name: 'dormer window',
      rect: [30, 62, 48, 40],
      at: [56, 116],
      face: 'left',
      verbs: {
        look: 'The dormer window, back into the study. Warm, dry, and full of a bat eating jam.',
      },
      exit: { to: 'study', x: 300, y: 114, face: 'down' },
    },
    {
      id: 'chimney',
      name: 'chimney',
      rect: [148, 6, 44, 98],
      at: [168, 118],
      face: 'up',
      default: 'talk',
      verbs: {
        look: function* (c) {
          yield c.say('A crooked chimney with three crooked pots. Warm air coming up. And… humming?')
          yield c.say('A woman humming, far below. Something old and sad. The chimney goes down to the parlour.')
        },
        talk: c => seance(c),
        use: 'I peer down the chimney. Soot in the eye. Very authentic.',
        pickup: 'It\'s a chimney. Even Dag couldn\'t.',
      },
      useWith: {
        emf: c => emf(c, 'BEEP BEEP BEEP. Something in the chimney! Something below the chimney! A presence!'),
      },
    },
    {
      id: 'rod',
      name: 'lightning rod',
      rect: [286, 82, 56, 18],
      at: [ROOF.holdRod.x, ROOF.holdRod.y],
      face: 'right',
      when: s => !s.flags[F.rodUp],
      verbs: {
        look: c => c.is(F.socketOiled)
          ? 'The lightning rod. The socket is oiled now. It\'s just lying there, waiting to be stood up.'
          : 'A long copper lightning rod, lying flat in a rusted socket. The socket looks welded by weather.',
        pull: c => raiseRod(c),
        use: c => raiseRod(c),
        pickup: c => raiseRod(c),
        push: 'It\'s lying down already. It\'s the only relaxed thing on this roof.',
        talk: 'Rise, rod. RISE. …It\'s not a talker.',
      },
      useWith: { oil: c => oilSocket(c), emf: c => emf(c, 'Beep. It\'s copper. It\'s ready. It\'s waiting for its moment.') },
    },
    {
      id: 'rod-up',
      name: 'lightning rod',
      rect: [334, 8, 14, 94],
      at: [ROOF.holdRod.x, ROOF.holdRod.y],
      face: 'right',
      when: s => !!s.flags[F.rodUp],
      verbs: {
        look: 'The lightning rod, standing proud, higher than the chimney. Come on then, sky.',
        pull: 'It\'s up. It took all I had. It stays up.',
        push: 'It\'s up. It took all I had. It stays up.',
        use: 'I give it a pat. It hums a little. That\'s either the storm or my imagination. Probably both.',
        talk: 'You\'re doing great. Just stand there. That\'s the whole job.',
      },
      useWith: { emf: c => emf(c, 'BEEEP! It\'s full of static. My ears would stand up, if they still could.') },
    },
    {
      id: 'socket',
      name: s => s.flags[F.socketOiled] ? 'oiled socket' : 'rusty socket',
      rect: [334, 96, 14, 12],
      at: [ROOF.holdRod.x, ROOF.holdRod.y],
      face: 'right',
      z: 1,
      verbs: {
        look: c => c.is(F.socketOiled)
          ? 'The rod\'s socket, glistening with 1987 olive oil. Smells like a salad in a thunderstorm.'
          : 'The socket the rod pivots in. Solid rust. The hinge hasn\'t hinged since 1987.',
        use: c => raiseRod(c),
        pull: c => raiseRod(c),
        open: 'It\'s a socket, not a jar. Although, after Dag\'s jam, who knows.',
      },
      useWith: { oil: c => oilSocket(c) },
    },
    {
      id: 'cable',
      name: 'rod cable',
      rect: [348, 100, 28, 40],
      at: [ROOF.holdRod.x, ROOF.holdRod.y],
      face: 'right',
      verbs: {
        look: 'Copper cable from the rod, over the edge and down the wall. To the conservatory, then the cellar.',
        pull: 'It\'s pinned all the way down the wall. Kjell\'s floor is where it goes next.',
        use: 'I\'m not touching a lightning cable in a thunderstorm. I\'m credulous, not stupid.',
        pickup: 'I\'m not touching a lightning cable in a thunderstorm. I\'m credulous, not stupid.',
      },
      useWith: { emf: c => emf(c, 'Beep. There\'s charge on it already. It WANTS to be struck.') },
    },
    {
      id: 'vane',
      name: 'weather vane',
      rect: [236, 18, 34, 46],
      far: true,
      verbs: {
        look: 'A copper rooster on the ridge. It points north. The wind is from the west. He does not care.',
        talk: 'Cock-a-doodle… no. He\'s not a morning bird. It\'s nearly midnight. It\'s always nearly midnight here.',
        push: c => spinVane(c),
        pull: c => spinVane(c),
        use: c => spinVane(c),
        pickup: 'It\'s up on the ridge. I\'m not climbing the ridge. The walkway is where I live now.',
      },
      useWith: { emf: c => emf(c, 'Beep. A haunted rooster? No: a rooster in a storm, on a metal pole. Same energy.') },
    },
    {
      id: 'deckchair',
      name: 'deckchair',
      rect: [234, 94, 38, 22],
      at: [250, 122],
      face: 'up',
      verbs: {
        look: function* (c) {
          yield c.say('A deckchair, soaked, facing the sea. A thermos. A teacup full of rain.')
          yield c.say('The Professor watched storms from up here. With tea. What a woman.')
        },
        use: 'I sit down. It\'s full of water. I stand up. I\'m full of water.',
        pickup: 'It\'s hers. It\'s been waiting since 1987 for her to come back up with a fresh pot of tea.',
        open: 'It\'s as open as a deckchair gets. Any more open and it\'s a plank.',
        close: 'I fold it. It unfolds itself with a wet slap. Fine. You stay.',
      },
      useWith: { emf: c => emf(c, 'Beep… beep… A faint reading on the thermos. Old tea has a lot of feelings.') },
    },
    {
      id: 'slates',
      name: 'roof slates',
      rect: [80, 64, 200, 38],
      far: true,
      verbs: {
        look: 'Wet slates, some loose, all crooked. They slope up to the ridge like a frozen wave.',
        pickup: 'One comes loose. I put it back. Gently. The roof and I have an understanding.',
        push: 'Slippery. I\'m staying on the walkway.',
      },
    },
    {
      id: 'railing',
      name: 'railing',
      rect: [0, 128, 400, 16],
      far: true,
      verbs: {
        look: 'A low iron railing. The only thing between me and the driveway. I\'m holding it emotionally.',
        use: 'I hold on. I\'m holding on. Everything is fine.',
        pull: 'It wobbles. Everything wobbles. Let\'s never do that again.',
        push: 'It wobbles. Everything wobbles. Let\'s never do that again.',
      },
    },
    {
      id: 'brunhilde',
      name: 'Brunhilde',
      rect: [412, 104, 44, 24],
      far: true,
      verbs: {
        look: 'Brunhilde, far below at the gate. Waiting in the rain like a loyal, rust-coloured dog.',
        talk: function* (c) {
          yield c.say('BRUNHILDE! Kjell says hi! He loves you! We\'re getting you a battery!')
          yield c.wait(0.6)
          yield c.say('Her hazard lights blinked. Twice. That\'s car for "thank you".')
        },
        use: 'She\'s forty metres down. I\'d get there fast, but only once.',
      },
      useWith: { emf: c => emf(c, 'Nothing. Brunhilde\'s battery is so dead it doesn\'t even register.') },
    },
  ],
}

function* spinVane(c: Ctx): Script {
  yield c.sfx('squeak')
  yield c.say('I can just reach its tail with the window pole. It creaks round and points at me. Rude.')
}

function* emf(c: Ctx, line: string): Script {
  yield c.sfx('emf')
  yield c.say(line)
}
