/**
 * Conservatory (Kjell's floor, 400 wide). Gustav the carnivorous plant
 * (HRRMM; snaps at rabbits; GIVE him the sandwich and he burps up the clock
 * key and falls asleep), the junction box where the lightning cable comes
 * down from the roof and goes on to the cellar (chewed through: the poker
 * bridges it, with rubber gloves on and Gustav asleep), wet leather gloves
 * (a red herring), a watering can, buckets under the leaks.
 */
import type { Ctx, HotspotDef, RoomDef, Script } from '../../types'
import { F } from '../flags'
import { warmHouse } from './foyer'

const G = (c: Ctx, text: string) => c.sayAs('gustav', text)

function* snap(c: Ctx): Script {
  yield c.pose('snap', undefined, 'gustav')
  yield c.sfx('plant-snap')
  yield c.pose('scared', 0.9)
  yield c.wait(0.7)
  yield c.pose('', undefined, 'gustav')
}

const awake = (c: Ctx) => !c.is(F.gustavFed)

const gustav: HotspotDef = {
  id: 'gustav',
  name: 'Gustav',
  rect: [270, 36, 62, 88],
  at: [254, 124],
  face: 'right',
  actor: 'gustav',
  z: 2,
  verbs: {
    look: function* (c) {
      if (!awake(c)) { yield c.say('Gustav, asleep. Full of Dag\'s ham sandwich, snoring like a tuba.'); return }
      yield c.say('Gustav. It says so on the pot. A carnivorous plant the size of a wardrobe, with more teeth than a wardrobe needs.')
      yield c.say('He\'s looking at my ears. He thinks I\'m a rabbit. He\'s got a point.')
    },
    talk: function* (c) {
      if (!awake(c)) { yield c.say('He\'s snoring. I\'m not waking him. Never wake a sleeping wardrobe.'); return }
      if (!c.is('conservatory.met')) {
        c.set('conservatory.met')
        yield c.say('Hello. I\'m Kjell.')
        yield G(c, 'HRRMM.')
        yield* snap(c)
      } else yield G(c, 'HRRMM?')
      for (let i = 0; i < 20; i++) {
        const id: string = yield c.choose([
          { id: 'rabbit', text: 'I\'m not a rabbit. It\'s a costume.' },
          { id: 'key', text: 'Have you seen a small brass key?' },
          { id: 'hungry', text: 'Are you hungry?' },
          { id: 'pot', text: 'Nice pot.' },
          { id: 'cable', text: 'Did you chew that cable?' },
          { id: 'bye', text: 'Bye, Gustav.' },
        ])
        if (id === 'bye') { yield G(c, 'HRRMM.'); return }
        if (id === 'rabbit') {
          yield G(c, 'HRRMM.')
          yield* snap(c)
          yield c.say('He doesn\'t believe me. I wouldn\'t believe me either.')
        } else if (id === 'key') {
          yield G(c, 'HRRMM…')
          yield c.say('That was a guilty HRRMM. His eyes went to the side. I know that look. It\'s the look of a plant with a key inside it.')
        } else if (id === 'hungry') {
          yield G(c, 'HRRRRRMMMMM.')
          yield c.say('Yes, then. Something meaty. That isn\'t me. I\'m mostly polyester.')
        } else if (id === 'pot') {
          yield G(c, 'HRRMM!')
          yield c.say('He liked that. He did a little wiggle.')
        } else {
          yield G(c, 'HRRMM.')
          yield c.say('He\'s picking his teeth with a leaf. There\'s a bit of cable insulation in there.')
        }
      }
    },
    pickup: function* (c) {
      if (!awake(c)) { yield c.say('He\'s asleep, and he still weighs as much as a wardrobe. A wardrobe full of ham.'); return }
      yield* snap(c)
      yield c.say('He\'s the size of a wardrobe. A wardrobe with teeth.')
    },
    push: function* (c) {
      if (!awake(c)) { yield c.say('I prod him. He mumbles HRRMM in his sleep and smacks his lips.'); return }
      yield* snap(c)
      yield c.say('I got close enough to push him. He got close enough to push back. With teeth.')
    },
    pull: function* (c) {
      if (!awake(c)) { yield c.say('I\'m not pulling a sleeping plant\'s leaves. I have some manners left.'); return }
      yield* snap(c)
      yield c.say('Pull his leaf? He nearly pulled my ear.')
    },
    use: 'I\'m not using Gustav. Nobody uses Gustav. Gustav uses you.',
  },
  giveWith: {
    sandwich: function* (c) {
      if (!awake(c)) { yield c.say('He\'s asleep. And he\'s already had it.'); return }
      yield c.say('Here, Gustav. A ham sandwich. Dag\'s. It\'s been in his suit all evening.')
      c.take('sandwich')
      yield c.pose('snap', undefined, 'gustav')
      yield c.sfx('plant-snap')
      yield c.wait(0.4)
      yield c.pose('chomp', undefined, 'gustav')
      yield c.sfx('munch')
      yield c.wait(1.5)
      yield G(c, 'HRRMM. HRRMM. HRRMMMM.')
      yield c.pose('', undefined, 'gustav')
      yield c.wait(0.6)
      yield c.pose('burp', undefined, 'gustav')
      yield c.sfx('burp')
      c.set(F.gustavFed)
      yield G(c, 'HRRRRRMMMP.')
      yield c.sfx('drop')
      yield c.say('He burped something up. Something brass. Something with little wings.')
      yield c.pose('sleep', undefined, 'gustav')
      yield c.sfx('snore')
      yield c.solve('gustav')
      yield c.say('And he\'s asleep. Full of ham and at peace with the world. I\'d like to know what that feels like.')
    },
    sardines: function* (c) { yield G(c, 'HRRMM.'); yield c.say('He sniffs the tin. He can\'t open it either. Nobody can. It\'s a tin of mystery.') },
    cat: function* (c) { yield c.say('Absolutely not. She\'d win, and he\'d never forgive me.') },
    umbrella: function* (c) {
      if (awake(c)) { yield* snap(c); yield c.say('He bit the duck. The duck is fine. The duck has seen things.'); return }
      yield c.say('I\'m not putting anything near him while he sleeps. He chews in his sleep.')
    },
    manual: function* (c) { yield c.say('He tries to eat Brunhilde\'s manual. I snatch it back. Nobody eats the manual.') },
    letters: function* (c) { yield G(c, 'HRRMM…'); yield c.say('He sniffs the love letters and goes a bit pink. Well. A bit less green.') },
    oil: function* (c) { yield G(c, 'HRRMM.'); yield c.say('No oil. He\'s on a diet: meat. Only meat.') },
    gloves: 'He\'d eat them. Then I\'d need them. Then I\'d have to go in after them. No.',
    poker: 'Poke Gustav? With a poker? That\'s how you lose a poker. And an arm.',
    jam: 'Jam is for Dag. And Gustav wants meat.',
    clockkey: 'He\'s had his turn with it. Twenty years, by the look of it.',
  },
  anyItem: function* (c) { yield G(c, 'HRRMM.'); yield c.say('He sniffs it and sneers. Gustav has standards: meat, or something that has been near meat.') },
}

const clockKey: HotspotDef = {
  id: 'clockkey',
  name: 'clock key',
  rect: [258, 120, 16, 9],
  at: [256, 130],
  face: 'right',
  z: 5,
  when: s => !!s.flags[F.gustavFed] && !s.flags[F.clockKeyTaken],
  verbs: {
    look: 'A brass winding key with little wings. Slimy. It spent a long time in Gustav. It looks relieved.',
    pickup: function* (c) {
      c.give('clockkey')
      c.set(F.clockKeyTaken)
      yield c.pose('pickup', 0.6)
      yield c.sfx('pickup')
      yield c.say('The key to the grandfather clock. Slimy, but whole. I wipe it on my suit. The suit has seen worse tonight.')
    },
  },
}

const junction: HotspotDef = {
  id: 'junction',
  name: 'junction box',
  rect: [236, 42, 32, 30],
  at: [250, 112],
  face: 'up',
  z: 2,
  verbs: {
    look: function* (c) {
      if (c.is(F.junctionBridged)) { yield c.say('The poker is wedged across the gap. It hums. I\'m never touching it again.'); return }
      if (c.is(F.junctionOpen)) {
        yield c.say('Inside, the cable is chewed clean through. Tooth marks. Big ones. HRRMM-shaped ones.')
        yield c.say('Two bare ends, a hand apart. Something long and metal would bridge them. Something I\'m not holding in my bare hands.')
        return
      }
      yield c.say('A junction box with a skull on it. The big cable from the lightning rod comes down from the roof into it…')
      yield c.say('…and goes on down through the floor, to the cellar. The skull is a nice touch.')
    },
    open: function* (c) {
      if (c.is(F.junctionOpen)) { yield c.say('It\'s open.'); return }
      c.set(F.junctionOpen)
      yield c.sfx('creak')
      yield c.say('The door swings open. Inside, the cable\'s been chewed clean through.')
      if (awake(c)) {
        yield* snap(c)
        yield c.say('And Gustav snapped at my tail the whole time. He\'s very protective of that cable. He\'s been eating it.')
      }
    },
    close: function* (c) {
      if (c.is(F.junctionBridged)) { yield c.say('It won\'t close with a poker in it. And I\'m not taking the poker out.'); return }
      if (!c.is(F.junctionOpen)) { yield c.say('It\'s shut.'); return }
      c.clear(F.junctionOpen)
      yield c.sfx('door')
    },
    use: 'I\'m not putting my hand in a lightning box. I\'m anxious, not stupid.',
    pickup: 'It\'s bolted to the pillar. So is the cable. So, very nearly, was I.',
    talk: 'It buzzes faintly. It\'s the most alarming conversation I\'ve had tonight, and I\'ve met a ghost.',
  },
  useWith: {
    poker: function* (c) {
      if (c.is(F.junctionBridged)) return
      if (!c.is(F.junctionOpen)) { yield c.say('I\'d have to open the box first.'); return }
      if (awake(c)) {
        yield c.pose('reach', 0.5)
        yield* snap(c)
        yield c.say('Every time I reach for the box, Gustav reaches for me. I need him busy. Or asleep. Or both.')
        return
      }
      if (!c.has('gloves')) {
        yield c.say('Bare hands, an iron poker and a lightning cable.')
        yield c.say('Brunhilde\'s manual has a whole chapter on this. It\'s called "Don\'t". I need something rubber between me and it.')
        return
      }
      yield c.say('Rubber gloves on. Squeak. Deep breath.')
      yield c.pose('strain', 1.2)
      yield c.sfx('spark')
      c.take('poker')
      c.set(F.junctionBridged)
      yield c.flash('#cfe8ff', 0.5)
      yield c.sfx('zap')
      yield c.pose('scared', 0.8)
      yield c.solve('junction')
      yield c.say('The poker bridges the cut. It sparked. I\'m alive. I\'m a genius, and I\'m alive, in that order.')
    },
    gloves: 'The gloves are ready. Now I need something long and metal to bridge the gap. Something that isn\'t me.',
    keys: 'Brunhilde\'s keys across a lightning cable? She\'d be a widow.',
    umbrella: 'The umbrella has a metal tip and a wooden duck. Too short, and I\'d be holding the metal end.',
    clockkey: 'Much too short. I\'d be the rest of the bridge.',
    matches: 'Fire and electricity. That\'s not a bridge, that\'s a news story.',
  },
  anyItem: 'That won\'t bridge the gap. It needs to be long, and metal, and not me.',
}

const cableUp: HotspotDef = {
  id: 'cable',
  name: 'cable',
  rect: [244, 0, 12, 42],
  at: [250, 112],
  face: 'up',
  z: 1,
  verbs: {
    look: 'The lightning cable, thick as my wrist, coming down from the rod on the roof. Espen is up there somewhere.',
    pull: 'It\'s bolted all the way up. And pulling a lightning cable in a storm is on page one of "Don\'t".',
    pickup: 'It\'s bolted all the way up. And pulling a lightning cable in a storm is on page one of "Don\'t".',
  },
}

const cableDown: HotspotDef = {
  id: 'cable-down',
  name: 'cable',
  rect: [244, 72, 12, 32],
  at: [250, 112],
  face: 'up',
  z: 3,
  verbs: {
    look: 'The cable goes on down through the floor. To the cellar. To whatever the Professor built down there.',
    pull: 'It doesn\'t budge. The cellar is holding on to it.',
  },
}

const leatherGloves: HotspotDef = {
  id: 'leathergloves',
  name: 'leather gloves',
  rect: [113, 70, 24, 12],
  at: [124, 112],
  face: 'up',
  z: 2,
  verbs: {
    look: 'Leather gardening gloves, soaking wet from the leaks. Chewed at the fingertips. Gustav again.',
    pickup: 'Wet leather near electricity: the perfect way to become a lamp. No, thank you.',
    use: 'Wet leather near electricity: the perfect way to become a lamp. No, thank you.',
  },
}

const bench: HotspotDef = {
  id: 'bench',
  name: 'potting bench',
  rect: [86, 62, 68, 42],
  at: [120, 112],
  face: 'up',
  verbs: {
    look: 'A potting bench: pots, a trowel, a seed box, and a seedling that has grown tiny teeth. Gustav has a son.',
    pickup: 'The seedling snaps at my finger. Like father, like son.',
    use: 'I pot nothing. It\'s surprisingly calming.',
  },
}

const wateringCan: HotspotDef = {
  id: 'wateringcan',
  name: 'watering can',
  rect: [156, 96, 24, 14],
  at: [168, 118],
  face: 'up',
  z: 1,
  verbs: {
    look: 'A watering can. The roof is doing its job for it.',
    pickup: 'It\'s full. Of roof.',
    use: 'Everything in here is already wet. Including me.',
  },
}

const bucket1: HotspotDef = {
  id: 'bucket',
  name: 'bucket',
  rect: [50, 96, 20, 18],
  at: [60, 120],
  face: 'up',
  z: 1,
  verbs: {
    look: 'A bucket catching a leak. Plink. Plonk. The roof is playing a very slow song.',
    push: 'If I move it, the leak finds my head. It\'s been waiting for my head.',
    pickup: 'If I move it, the leak finds my head. It\'s been waiting for my head.',
  },
}

const bucket2: HotspotDef = {
  id: 'bucket2',
  name: 'bucket',
  rect: [190, 100, 20, 18],
  at: [200, 124],
  face: 'up',
  z: 1,
  verbs: {
    look: 'Another bucket, nearly full. Plonk. Plink. The song has a second verse.',
    push: 'I\'ll leave it. It\'s doing more for this house than I am.',
    pickup: 'I\'ll leave it. It\'s doing more for this house than I am.',
  },
}

const glass: HotspotDef = {
  id: 'glass',
  name: 'glass roof',
  rect: [20, 0, 360, 76],
  far: true,
  z: -1,
  verbs: {
    look: 'Glass walls, a glass roof, and a storm on the other side of all of it. Someone built a greenhouse for lightning.',
    open: 'Open the glass in a storm? The buckets are losing already.',
  },
}

const palms: HotspotDef = {
  id: 'plants',
  name: 'ferns',
  rect: [170, 58, 30, 44],
  at: [184, 112],
  face: 'up',
  verbs: {
    look: 'Ferns and palms. Normal plants. I like them. They don\'t have faces.',
    talk: 'Hello, normal plant. You\'re my favourite.',
  },
}

const toFoyer: HotspotDef = {
  id: 'to-foyer',
  name: 'foyer',
  rect: [0, 34, 20, 84],
  at: [15, 126],
  face: 'left',
  exit: { to: 'foyer', x: 368, y: 114, face: 'down' },
}

export const room: RoomDef = {
  id: 'conservatory',
  name: 'Conservatory',
  floor: 'ground',
  w: 400,
  enter: warmHouse,
  walk: [[[20, 106], [380, 106], [398, 142], [2, 142]]],
  blocks: [[[272, 104], [328, 104], [330, 124], [270, 124]]],
  hotspots: [gustav, clockKey, junction, cableUp, cableDown, leatherGloves, bench, wateringCan, bucket1, bucket2, palms, glass, toFoyer],
}
