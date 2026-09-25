/**
 * Foyer (Kjell's floor, 440 wide). The grandfather clock stopped at 11:59
 * (USE clock key → the midnight strike in story.ts), the Professor's
 * portrait, the staircase folded into the ceiling, the armour that only
 * echoes, the coat rack and umbrella, the telephone, the front door.
 *
 * Coordinates the story uses: Kjell starts at (220, 128); the trapdoor tile
 * is at (180, 124); the chandelier hangs at x 260 (y 10–33); the front door
 * is x 196–244 (stand at 220, 108); the clock stands at x 90–120 (stand at
 * 106, 110); the stairs come down from x 346 at the ceiling to x 280 at the
 * floor when F.stairsDown (stand at 286, 110).
 */
import type { Handler, HotspotDef, RoomDef } from '../../types'
import { F } from '../flags'
import { midnight } from '../story'

/**
 * The first time Kjell walks into a ground-floor room after Dag lights the
 * furnace: the radiators hiss, and he thinks of the freezer. Every ground
 * room's `enter` runs it.
 */
export const warmHouse: Handler = function* (c) {
  if (c.hero !== 'kjell' || !c.is(F.furnaceLit) || c.is('ground.warm')) return
  c.set('ground.warm')
  yield c.sfx('pipes-knock')
  yield c.say('The pipes are knocking and the radiators are hissing. Dag got the furnace going!')
  yield c.say('The whole house is warming up. Even the kitchen freezer must be thawing.')
}

const clock: HotspotDef = {
  id: 'clock',
  name: 'grandfather clock',
  rect: [88, 14, 34, 88],
  at: [106, 110],
  face: 'up',
  verbs: {
    look: function* (c) {
      if (c.is(F.struck)) { yield c.say('Midnight, at last. The pendulum swings like it never stopped. It looks relieved.'); return }
      yield c.say('A grandfather clock, stopped at 11:59. The pendulum hangs dead still.')
      yield c.say('There\'s a winding keyhole in the dial. Somebody lost the key. In this house, probably inside something.')
    },
    open: function* (c) {
      yield c.pose('strain', 0.8)
      yield c.say('The case is locked. Behind the glass: the pendulum, and a keyhole in the dial for a winding key.')
    },
    use: 'I nudge the minute hand. It won\'t go past 11:59. It\'s been waiting for something, and it isn\'t me.',
    push: 'You don\'t push grandfathers. Not even wooden ones.',
    pull: 'I pull the pendulum. It goes back to hanging there, sulking.',
    talk: function* (c) {
      yield c.say('Tick? …Tock?')
      yield c.say('Nothing. Not even a tick. That\'s the loudest silence I\'ve ever heard.')
    },
    pickup: 'It\'s taller than me. And it has a better posture.',
    close: 'It\'s closed. It\'s very closed.',
  },
  useWith: {
    // Called late: story.ts sits in an import cycle with the rooms (story → roof → parlour → foyer).
    clockkey: c => midnight(c),
    keys: 'Brunhilde\'s key is for Brunhilde. The clock needs a winding key, a brass one with wings.',
    poker: 'Poke a clock? I\'ve seen what happens to people who poke antiques on TV.',
    umbrella: 'I hook the pendulum with the duck and give it a swing. It swings once, gives the duck a look, and stops.',
    manual: 'The manual has a chapter on Brunhilde\'s clock. It\'s broken too. Everything I own stops at some point.',
  },
}

const portrait: HotspotDef = {
  id: 'portrait',
  name: 'portrait',
  rect: [124, 18, 44, 50],
  at: [146, 110],
  face: 'up',
  verbs: {
    look: function* (c) {
      if (c.is(F.catMonocle)) {
        yield c.say('The Professor. White hair, one dark streak. A monocle on a chain.')
        yield c.say('The cat has a white streak. The cat now has a monocle. The cat looked at me like…')
        yield c.say('No. Don\'t be silly, Kjell. You\'re tired, and dressed as a rabbit.')
        return
      }
      if (c.bump('foyer.portraitLooks') === 1) {
        yield c.say('"Professor Ottilie Voltvik, 1987." Wild white hair with one dark streak, and a monocle.')
        yield c.say('She looks like she\'s about to invent something at me.')
        return
      }
      yield c.say('The monocle, the streak, the smile of someone who owns a lot of lightning. I\'ve seen that streak somewhere tonight.')
    },
    talk: 'Professor? We\'re very sorry about the door. And the tile. And the chandelier. And us.',
    pickup: 'It\'s screwed to the wall. The whole house is screwed to the wall. Except the stairs.',
    push: 'I straighten it. It tilts back. The house likes it crooked.',
    pull: 'I straighten it. It tilts back. The house likes it crooked.',
    use: 'I straighten it. It tilts back. The house likes it crooked.',
  },
}

const armour: HotspotDef = {
  id: 'armour',
  name: 'suit of armour',
  rect: [160, 14, 38, 90],
  at: [176, 110],
  face: 'up',
  verbs: {
    look: 'A suit of armour with a pot belly and a poleaxe. Nobody inside. I knocked. It echoed.',
    talk: function* (c) {
      const n = c.bump('foyer.armourTalks')
      if (n === 1) {
        yield c.say('Excuse me. Is anyone in there?')
        yield c.sayAs('narrator', '…in there… in there…')
        yield c.say('It\'s an echo. Of course it\'s an echo.')
        yield c.sayAs('narrator', '…of course… echo…')
        return
      }
      if (n === 2) {
        yield c.say('Do you know where I can get a car battery?')
        yield c.sayAs('narrator', '…battery… battery…')
        yield c.say('Helpful.')
        yield c.sayAs('narrator', '…helpful…')
        return
      }
      yield c.say('Brunhilde is the best car ever built.')
      yield c.sayAs('narrator', '…ever built… ever built…')
      yield c.say('At last. Somebody in this house who agrees with me.')
    },
    pickup: 'It weighs as much as Dag. It would make a lot more noise falling down the stairs, too.',
    open: 'I lift the visor. Empty. Smells of old soup. It shuts again with a clang.',
    push: 'It rocks, and the poleaxe comes a bit too close to my ear. My bent ear. I leave it.',
    pull: 'It rocks, and the poleaxe comes a bit too close to my ear. My bent ear. I leave it.',
    use: 'I\'m not wearing it. I\'m already wearing one ridiculous suit tonight.',
    close: 'The visor is shut. It sulks behind it.',
  },
  anyItem: 'It has no hands to hold it. Well. It has hands. It has no people in the hands.',
}

const coatRack: HotspotDef = {
  id: 'coatrack',
  name: 'coat rack',
  rect: [26, 18, 18, 82],
  at: [40, 112],
  face: 'up',
  verbs: {
    look: 'A coat rack with a violet coat, a bowler hat and a lot of opinions about posture.',
    pickup: function* (c) {
      yield c.say('I try on the bowler hat. It rests on my ears. It looks like a very small roof.')
      yield c.say('I put it back.')
    },
    use: 'I hang up nothing. It\'s very satisfying.',
    push: 'It wobbles and leans back. Everything in this house leans back.',
  },
}

const umbrella: HotspotDef = {
  id: 'umbrella',
  name: 'umbrella',
  rect: [42, 58, 14, 40],
  at: [46, 112],
  face: 'up',
  z: 2,
  when: s => !s.inv.kjell.includes('umbrella') && !s.inv.dag.includes('umbrella') && !s.inv.espen.includes('umbrella'),
  verbs: {
    look: 'A black umbrella with a duck-head handle. The duck looks disappointed in me.',
    pickup: function* (c) {
      c.give('umbrella')
      yield c.sfx('pickup')
      yield c.say('Taken. If the storm gets in, I\'m ready. If the storm gets in, we have bigger problems.')
    },
    open: 'Open an umbrella indoors? In THIS house? I\'m not tempting anything.',
    use: 'Open an umbrella indoors? In THIS house? I\'m not tempting anything.',
    talk: 'I say hello to the duck. The duck says nothing. The duck has seen things.',
  },
}

const phone: HotspotDef = {
  id: 'phone',
  name: 'telephone',
  rect: [56, 56, 30, 44],
  at: [70, 112],
  face: 'up',
  verbs: {
    look: 'A red rotary telephone. It would take a week to dial a tow truck. If there were a line.',
    use: function* (c) {
      yield c.pose('reach', 0.5)
      yield c.sfx('phone-jingle')
      yield c.wait(0.8)
      const n = c.bump('foyer.phoneCalls')
      if (n === 1) {
        yield c.say('No dial tone. Just a radio jingle: "Radio Voltvik, ninety-one point one! All the hits of 1987!"')
        yield c.say('Then a man tells me the weather. It\'s a storm. It has been a storm since 1987.')
      } else if (n === 2) {
        yield c.say('"…and a big hello to the Professor, who\'s bottling lightning tonight! Don\'t stay up too late!"')
        yield c.say('They\'re going to be very late with that.')
      } else yield c.say(c.pick(['The jingle again. It\'s catchy. I hate that it\'s catchy.', '"Ninety-one point one!" I hum along. I stop myself.', 'The jingle. Then an advert for a Volvo 240, brand new. I have to put the phone down.']))
    },
    pickup: function* (c) {
      yield c.sfx('phone-jingle')
      yield c.say('Hello? Tow truck?')
      yield c.sayAs('narrator', '"…Radio Voltvik, ninety-one point one, all the hits of 1987!"')
      yield c.say('No, thank you.')
    },
    talk: 'I say "hello" at it. It doesn\'t ring back. Nobody has rung this house since 1987.',
    push: 'It\'s a phone, not a doorbell.',
  },
  useWith: {
    keys: 'You can\'t dial with car keys. I tried. Twice.',
    manual: 'The manual lists a helpline. It closed in 1993.',
  },
}

const lamp: HotspotDef = {
  id: 'lamp',
  name: 'lamp',
  rect: [71, 54, 14, 12],
  at: [74, 112],
  face: 'up',
  z: 1,
  verbs: {
    look: 'A pink table lamp. Still on after all these years. The electricity bill must be a horror novel.',
    use: 'I switch it off. The foyer gets scarier. I switch it on again. Nobody needs to know.',
    pickup: 'It\'s the only thing in the house that works. I\'m leaving it where it is.',
  },
}

const frontDoor: HotspotDef = {
  id: 'frontdoor',
  name: 'front door',
  rect: [194, 22, 52, 82],
  at: [220, 108],
  face: 'up',
  exit: {
    to: 'driveway', x: 220, y: 120, face: 'down',
    open: s => !!s.flags[F.frontDoorOpen],
    locked: function* (c) {
      const n = c.bump('foyer.doorTries')
      yield c.pose('strain', 1)
      yield c.sfx('lock-rattle')
      if (n === 1) {
        yield c.say('Locked. And when I pulled on the handle, it growled at me.')
        yield c.say('Doors should not growl. Brunhilde\'s doors don\'t growl. They squeak, like civilised doors.')
      } else yield c.say(c.pick(['It growls again. Lower this time. Like it means it.', 'Locked. The keyhole narrows its eyes at me.', 'The door isn\'t letting anyone out until the house is finished with us.']))
    },
  },
  verbs: {
    look: c => c.is(F.frontDoorOpen)
      ? 'The front door is open. Rain, the drive, and Brunhilde at the gate, blinking. Waiting for us.'
      : 'The front door. Big, red, studded, and slammed shut behind us. The knots in the wood look like a scowl.',
    talk: function* (c) {
      yield c.say('Please let us out. We\'ll pay for the tile.')
      yield c.sfx('door-locked')
      yield c.say('It rattled. I think that was a no.')
    },
    push: function* (c) {
      if (c.is(F.frontDoorOpen)) { yield c.go('driveway', 220, 120, 'down'); return }
      yield c.pose('strain', 1)
      yield c.say('I put my shoulder into it. The door puts its shoulder back into me.')
    },
    close: c => c.is(F.frontDoorOpen) ? 'No. It\'s open. I\'m never closing it again.' : 'It\'s shut. It\'s the most shut thing I\'ve ever seen.',
    pickup: 'It\'s a door.',
  },
  useWith: {
    keys: 'Brunhilde\'s key doesn\'t fit. It wouldn\'t want to.',
    umbrella: 'I knock with the duck. The door knocks back, from the inside. I stop.',
    poker: 'I could lever it. Or I could not anger a door that growls.',
    clockkey: 'It\'s a clock key. The door looks insulted.',
  },
}

const stairs: HotspotDef = {
  id: 'stairs',
  name: 'staircase',
  rect: [268, 0, 90, 26],
  at: [300, 110],
  face: 'up',
  when: s => !s.flags[F.stairsDown],
  verbs: {
    look: function* (c) {
      yield c.say('The staircase folded itself up into the ceiling like a sulky accordion.')
      yield c.say('The bottom step dangles up there on one hinge. Out of reach. Espen is up there somewhere.')
    },
    pull: function* (c) {
      yield c.pose('cheer', 0.8)
      yield c.say('I jump. I\'m a tall man in a rabbit suit and I\'m still a metre short.')
    },
    pickup: 'I\'d need to be a lot taller. Or the stairs a lot less proud.',
    talk: function* (c) {
      yield c.say('Come on. Come down. Nobody\'s angry.')
      yield c.sfx('creak')
      yield c.say('It creaked. I think it said "later".')
    },
    push: 'I can\'t reach. The step knows I can\'t reach.',
  },
  useWith: {
    umbrella: function* (c) {
      yield c.pose('back', 1.2)
      yield c.say('I hook the duck over the bottom step and pull.')
      yield c.sfx('creak')
      yield c.say('The stairs pull back. The stairs win. The duck looks even more disappointed.')
    },
    poker: 'I poke at the step. It swings away, like it saw it coming.',
  },
}

const stairsDown: HotspotDef = {
  id: 'stairsdown',
  name: 'stairs',
  rect: [274, 0, 86, 106],
  at: [286, 110],
  face: 'up',
  when: s => !!s.flags[F.stairsDown],
  verbs: {
    look: 'The stairs are down. The house has decided we can all go home.',
    use: 'Up there it\'s Espen\'s floor. The house finally let them down. I\'m staying near the door.',
    talk: 'Thank you, stairs.',
  },
}

const chandelier: HotspotDef = {
  id: 'chandelier',
  name: 'chandelier',
  rect: [244, 8, 32, 26],
  far: true,
  verbs: {
    look: 'The chandelier. Its cord yanked Espen up through the ceiling like a fish. It\'s swinging a bit. Smugly.',
    pull: 'Out of reach. Probably for the best: the last man who pulled on it is in the attic now.',
    use: 'Out of reach. Probably for the best: the last man who pulled on it is in the attic now.',
    talk: 'Give him back! …Well, keep him a bit longer. But be nice to him.',
  },
}

const trapdoor: HotspotDef = {
  id: 'trapdoor',
  name: 'loose tile',
  rect: [166, 118, 30, 12],
  at: [180, 132],
  face: 'up',
  default: 'look',
  verbs: {
    look: 'The tile Dag fell through. It\'s shut again and pretending to be an ordinary tile. It\'s a bad actor.',
    push: function* (c) {
      yield c.pose('cheer', 0.5)
      yield c.sfx('thud')
      yield c.say('I jump on it. Nothing. It only eats people who aren\'t expecting it.')
    },
    open: 'No handle, no gap. I scratch at the edge. My fingernails lose.',
    pull: 'No handle, no gap. I scratch at the edge. My fingernails lose.',
    talk: function* (c) {
      yield c.say('Dag? Are you down there?')
      yield c.say('Nothing. The dumbwaiter in the kitchen is the only way to reach him.')
    },
    pickup: 'It\'s a tile. It\'s a very sneaky tile.',
  },
}

const radiator: HotspotDef = {
  id: 'radiator',
  name: 'radiator',
  rect: [392, 80, 24, 24],
  at: [398, 116],
  face: 'up',
  verbs: {
    look: c => c.is(F.furnaceLit)
      ? 'The radiator is hot and hissing. Dag got the furnace going. The whole house is thawing out.'
      : 'A cast-iron radiator, stone cold. The pipes run down to the cellar. Somewhere down there is a furnace.',
    use: c => c.is(F.furnaceLit) ? 'I warm my paws. It\'s been a long, wet night for paws.' : 'I turn the valve. Nothing. The heat has to come from somewhere first.',
    talk: c => c.is(F.furnaceLit) ? 'It hisses at me. The friendly sort of hiss.' : 'Cold, and silent. We have that in common tonight.',
    pickup: 'It\'s bolted to the floor, and the floor is bolted to the dread.',
  },
}

const conservatoryDoor: HotspotDef = {
  id: 'to-conservatory',
  name: 'glass door',
  rect: [348, 34, 42, 70],
  at: [368, 110],
  face: 'up',
  exit: { to: 'conservatory', x: 34, y: 124, face: 'right' },
  verbs: {
    look: 'A glass door to the conservatory. Something big and green is pressed up against the glass.',
  },
}

const toKitchen: HotspotDef = {
  id: 'to-kitchen',
  name: 'kitchen',
  rect: [0, 34, 20, 84],
  at: [14, 124],
  face: 'left',
  exit: { to: 'kitchen', x: 372, y: 124, face: 'left' },
}

const toParlour: HotspotDef = {
  id: 'to-parlour',
  name: 'parlour',
  rect: [420, 36, 20, 84],
  at: [426, 128],
  face: 'right',
  exit: { to: 'parlour', x: 30, y: 124, face: 'right' },
}

export const room: RoomDef = {
  id: 'foyer',
  name: 'Foyer',
  floor: 'ground',
  w: 440,
  walk: [[[22, 104], [418, 108], [436, 142], [4, 142]]],
  enter: warmHouse,
  hotspots: [clock, portrait, armour, coatRack, umbrella, phone, lamp, frontDoor, stairs, stairsDown, chandelier, trapdoor, radiator, conservatoryDoor, toKitchen, toParlour],
}
