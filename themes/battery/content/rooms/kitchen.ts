/**
 * Kitchen (Kjell's floor, 400 wide). Mrs Whiskers asleep on the humming
 * fridge (she hisses at rabbits until she gets the monocle, then hops down
 * to the side counter and lets Kjell carry her), the drawer with one match,
 * the cupboard with the oil and the sardines, the frozen freezer (thawed
 * once the furnace is lit: the rubber gloves), the cold stove, and the
 * dumbwaiter hatch with its bell.
 *
 * The cat: on the fridge at (300, 58) pose 'sleep'; after the monocle,
 * on the side counter at (352, 78) pose 'monocle'; once picked up, room null.
 */
import type { Handler, HandlerMap, HotspotDef, ItemId, RoomDef } from '../../types'
import { F } from '../flags'
import { warmHouse } from './foyer'

const CAT_COUNTER: readonly [number, number] = [352, 78]

const giveMonocle: Handler = function* (c) {
  if (c.is(F.catMonocle)) { yield c.say('She already has one. She would like to point out that one is plenty.'); return }
  yield c.say('Um. Mrs Whiskers? I think this might be yours.')
  yield c.pose('peek', undefined, 'cat')
  yield c.wait(0.9)
  yield c.pose('sit', undefined, 'cat')
  yield c.sfx('cat-meow')
  yield c.wait(0.5)
  c.take('monocle')
  c.set(F.catMonocle)
  yield c.pose('monocle', undefined, 'cat')
  yield c.sfx('cat-purr')
  yield c.say('She took it with one paw and screwed it into her eye. Like she\'d done it a thousand times.')
  yield c.wait(1.2)
  yield c.say('She\'s looking at me. Not like a cat looks at a man. Like a professor looks at a bad essay.')
  yield c.sfx('thud')
  yield c.place('cat', 'kitchen', CAT_COUNTER[0], CAT_COUNTER[1], 'left')
  yield c.pose('monocle', undefined, 'cat')
  yield c.wait(0.4)
  yield c.say('And down she hops. I think that means I\'m allowed to carry her. Barely.')
}

const sardinesToCat: Handler = function* (c) {
  if (c.is(F.catMonocle)) {
    yield c.say('She looks at the tin, then at me, and adjusts her monocle. The answer is no.')
    return
  }
  yield c.pose('peek', undefined, 'cat')
  yield c.wait(1)
  yield c.say('She opens one eye. She looks at the sardines. She looks at me. She looks at the sardines.')
  yield c.say('She sighs. Cats can\'t sigh. She sighs anyway, and goes back to sleep.')
  yield c.pose('sleep', undefined, 'cat')
}

const hiss = function* (c: Parameters<Handler>[0], line: string) {
  yield c.pose('hiss', undefined, 'cat')
  yield c.sfx('cat-hiss')
  yield c.pose('scared', 1)
  yield c.wait(0.5)
  yield c.pose('sleep', undefined, 'cat')
  yield c.say(line)
}

const catVerbs: HandlerMap = {
  look: c => c.is(F.catMonocle)
    ? 'Mrs Whiskers, in the monocle, sitting up like the chair of a committee. She\'s waiting for me to catch up.'
    : 'Mrs Whiskers, asleep on the humming fridge. Charcoal fur, a white streak on her head, and a white ring round one eye. Like a monocle.',
  pickup: function* (c) {
    if (!c.is(F.catMonocle)) {
      yield c.pose('reach', 0.5)
      yield* hiss(c, c.pick([
        'She hissed at me. It\'s the suit. She hates rabbits. Tonight, so do I.',
        'She spat at my ears. Both of them. The bent one took it personally.',
        'She won\'t let a rabbit touch her. I\'d need to be less rabbit. Or more… something she likes.',
      ]))
      return
    }
    if (c.is('kitchen.catTaken')) return
    c.set('kitchen.catTaken')
    yield c.pose('pickup', 0.6)
    c.give('cat')
    yield c.place('cat', null, 0, 0)
    yield c.sfx('cat-purr')
    yield c.solve('cat')
    yield c.say('I pick her up. She allows it, the way a queen allows a sedan chair.')
  },
  talk: function* (c) {
    if (c.is(F.catMonocle)) {
      yield c.say('Who\'s a clever… colleague?')
      yield c.sayAs('cat', 'Mrrp.')
      yield c.say('That was a very precise mrrp.')
      return
    }
    yield c.say('Puss puss puss?')
    yield* hiss(c, 'She opened one eye, saw the ears, and hissed. I don\'t blame her. I saw them in the hall mirror.')
  },
  push: c => c.is(F.catMonocle) ? 'I don\'t push professors. I mean cats. I don\'t push cats.' : 'Wake a sleeping cat on purpose? I still have two good eyes. For now.',
  use: c => c.is(F.catMonocle) ? 'I scratch behind her ear. She tolerates it for exactly one second.' : 'I\'m not touching her while she\'s like that. She\'s like a loaded mousetrap.',
  pull: 'Pull a cat\'s tail? In a rabbit suit? In HER kitchen?',
}

const catWith: Partial<Record<ItemId, Handler | string>> = {
  monocle: giveMonocle,
  sardines: sardinesToCat,
  umbrella: 'Poke a cat with an umbrella? I\'ve seen how that ends. On the internet. Many times.',
  sandwich: 'She sniffs at the idea of Dag\'s sandwich and turns her back. She has standards.',
  gloves: 'She eyes the rubber gloves as if I\'m about to do something to her. I\'m not. I promise.',
  poker: 'No. Absolutely not. Who pokes a cat?',
  manual: 'She reads a paragraph over my shoulder, sniffs, and looks away. Everyone\'s a critic.',
  letters: 'She glances at the letters, then away, like she knows who wrote them.',
}

const catOnFridge: HotspotDef = {
  id: 'cat',
  name: 'Mrs Whiskers',
  rect: [286, 44, 28, 16],
  at: [300, 112],
  face: 'up',
  actor: 'cat',
  z: 3,
  default: 'look',
  when: s => s.actors['cat']?.room === 'kitchen' && !s.flags[F.catMonocle],
  verbs: catVerbs,
  useWith: catWith,
  giveWith: catWith,
  anyItem: 'She opens one eye, looks at it, looks at me, and shuts the eye. Rejected.',
}

const catOnCounter: HotspotDef = {
  id: 'cat-counter',
  name: 'Mrs Whiskers',
  rect: [340, 56, 24, 24],
  at: [352, 112],
  face: 'up',
  actor: 'cat',
  z: 3,
  default: 'pickup',
  when: s => s.actors['cat']?.room === 'kitchen' && !!s.flags[F.catMonocle],
  verbs: catVerbs,
  useWith: catWith,
  giveWith: catWith,
  anyItem: 'She adjusts her monocle and declines.',
}

const fridge: HotspotDef = {
  id: 'fridge',
  name: 'fridge',
  rect: [270, 58, 60, 46],
  at: [300, 112],
  face: 'up',
  verbs: {
    look: 'A fat 1950s fridge with a badge: VOLTVIK FRIGIDOR. It hums like it\'s proud of itself. It\'s the warmest spot in the kitchen.',
    open: function* (c) {
      yield c.sfx('creak')
      yield c.say('Butter from 1987. Milk that became cheese, then became something after cheese.')
      yield c.say('I close it again, with respect.')
    },
    talk: 'It hums back. It knows one note and it\'s sticking to it.',
    push: 'It\'s heavier than Brunhilde. And it has a cat on it.',
    close: 'It\'s closed. Let\'s keep it that way.',
    pickup: 'It\'s a fridge. With a cat on it. So: no, twice.',
  },
  anyItem: 'I\'m not putting that in the fridge. Things go into that fridge and come out as history.',
}

const freezer: HotspotDef = {
  id: 'freezer',
  name: 'freezer',
  rect: [222, 32, 40, 72],
  at: [240, 112],
  face: 'up',
  verbs: {
    look: function* (c) {
      if (!c.is(F.furnaceLit)) {
        yield c.say('The freezer is frozen shut. Through the frosty window I can see a block of ice.')
        yield c.say('Frozen inside it: yellow rubber gloves, and a note that says DON\'T.')
        yield c.say('Don\'t what? DON\'T WHAT, Professor?')
        return
      }
      if (!c.is('kitchen.freezerOpen')) { yield c.say('The frost is gone. Water drips from the seal. The whole house is warming up.'); return }
      yield c.say('The ice has melted into a very large puddle. The note reads: DON\'T FORGET TO DEFROST.')
      yield c.say('Too late, Professor.')
    },
    open: function* (c) {
      if (!c.is(F.furnaceLit)) {
        yield c.pose('strain', 1.2)
        yield c.sfx('lock-rattle')
        yield c.say(c.pick([
          'Frozen solid. It isn\'t a freezer any more. It\'s a glacier with a handle.',
          'I pull until my ears stand up. It doesn\'t move. The whole house would need warming up.',
          'Nope. Nothing short of a heatwave is opening that.',
        ]))
        return
      }
      if (c.is('kitchen.freezerOpen')) { yield c.say('It\'s open. It\'s very open. It\'s also leaking on my feet.'); return }
      c.set('kitchen.freezerOpen')
      yield c.sfx('creak')
      yield c.sfx('splash')
      yield c.say('It opens with a slurp. A wave of meltwater washes over my rabbit feet.')
      if (!c.is(F.glovesTaken)) yield c.say('The gloves are free. And the note says: DON\'T FORGET TO DEFROST. That\'s all it said.')
    },
    close: function* (c) {
      if (!c.is('kitchen.freezerOpen')) { yield c.say('It\'s shut. It\'s the most shut thing in the house, and that includes the front door.'); return }
      c.clear('kitchen.freezerOpen')
      yield c.sfx('door')
      yield c.say('Closed. It gurgles sadly.')
    },
    pull: c => c.is(F.furnaceLit) ? 'Just open it. It\'s thawed.' : 'I pull. It stays frozen. My shoulder files a complaint.',
    talk: 'Please? …It crackles. That was ice for "no".',
    use: 'It\'s not on. Nothing in here has been switched on since 1987, except the fridge.',
  },
  useWith: {
    matches: 'One match against a glacier? The glacier would win. The whole house would need to warm up.',
    poker: 'I chip at the ice. The ice chips back at my confidence.',
    umbrella: 'I chip at the ice with the duck. The duck is now also disappointed in the ice.',
    manual: 'Chapter four: "Defrosting your windscreen". Blow on it and wait. I blow on it. I wait. Nothing.',
    keys: 'Brunhilde\'s key wasn\'t built for ice. Well, she was built in Sweden. But no.',
  },
}

const gloves: HotspotDef = {
  id: 'gloves',
  name: 'rubber gloves',
  rect: [234, 54, 22, 20],
  at: [240, 112],
  face: 'up',
  z: 4,
  when: s => !!s.flags['kitchen.freezerOpen'] && !s.flags[F.glovesTaken],
  verbs: {
    look: 'Yellow rubber gloves. Rubber. Doesn\'t conduct electricity. Brunhilde\'s manual taught me that, in chapter eleven.',
    pickup: function* (c) {
      c.give('gloves')
      c.set(F.glovesTaken)
      yield c.sfx('squeak')
      yield c.solve('gloves')
      yield c.say('Rubber gloves. Cold, wet and squeaky, and exactly what a careful man needs near a big cable.')
    },
  },
}

const note: HotspotDef = {
  id: 'note',
  name: 'note',
  rect: [228, 40, 14, 12],
  at: [240, 112],
  face: 'up',
  z: 4,
  when: s => !!s.flags['kitchen.freezerOpen'],
  verbs: {
    look: '"DON\'T FORGET TO DEFROST." In the Professor\'s handwriting. And a tiny drawing of a cat, for some reason.',
    pickup: 'It\'s soggy. It falls apart a bit. I leave it be. It did its best.',
  },
}

const drawer: HotspotDef = {
  id: 'drawer',
  name: 'drawer',
  rect: [108, 81, 34, 14],
  at: [124, 112],
  face: 'up',
  verbs: {
    look: c => c.is('kitchen.drawerOpen')
      ? (c.is(F.matchesTaken) ? 'Cutlery, string and a rubber band. The matches are with me.' : 'Cutlery, string, a rubber band and a matchbox.')
      : 'A kitchen drawer. Every kitchen drawer in the world has matches and string in it. Let\'s test that.',
    open: function* (c) {
      if (c.is('kitchen.drawerOpen')) { yield c.say('It\'s open.'); return }
      c.set('kitchen.drawerOpen')
      yield c.sfx('drawer')
      yield c.say(c.is(F.matchesTaken) ? 'Cutlery and string.' : 'Cutlery, string, a rubber band… and a matchbox. The theory holds.')
    },
    close: function* (c) {
      if (!c.is('kitchen.drawerOpen')) { yield c.say('It\'s closed.'); return }
      c.clear('kitchen.drawerOpen')
      yield c.sfx('drawer')
    },
    pull: function* (c) {
      if (c.is('kitchen.drawerOpen')) { yield c.say('It\'s out as far as it goes.'); return }
      c.set('kitchen.drawerOpen')
      yield c.sfx('drawer')
      yield c.say('Out it comes. Cutlery, string, and a matchbox.')
    },
    push: function* (c) {
      if (!c.is('kitchen.drawerOpen')) { yield c.say('It\'s already in.'); return }
      c.clear('kitchen.drawerOpen')
      yield c.sfx('drawer')
    },
    pickup: 'The whole drawer? I\'ll take what\'s in it.',
  },
}

const matches: HotspotDef = {
  id: 'matches',
  name: 'matchbox',
  rect: [119, 81, 10, 7],
  at: [124, 112],
  face: 'up',
  z: 4,
  when: s => !!s.flags['kitchen.drawerOpen'] && !s.flags[F.matchesTaken],
  verbs: {
    look: 'A matchbox. I shake it. One match. One.',
    pickup: function* (c) {
      c.give('matches')
      c.set(F.matchesTaken)
      yield c.sfx('pickup')
      yield c.solve('matches')
      yield c.say('One match. I\'m not going to waste it. I\'m going to worry about it instead.')
    },
    use: 'Strike our only match on nothing? I\'d need something worth lighting.',
  },
}

const cupboard: HotspotDef = {
  id: 'cupboard',
  name: 'cupboard',
  rect: [108, 18, 62, 40],
  at: [138, 112],
  face: 'up',
  verbs: {
    look: c => c.is('kitchen.cupboardOpen')
      ? 'Tins, a teapot, cooking oil and a tin of sardines. The pantry of a woman who planned to be back by breakfast.'
      : 'A wall cupboard, hung slightly crooked. Like everything here. Like my ear.',
    open: function* (c) {
      if (c.is('kitchen.cupboardOpen')) { yield c.say('It\'s open.'); return }
      c.set('kitchen.cupboardOpen')
      yield c.sfx('cupboard')
      yield c.say('Tins, a teapot, a bottle of cooking oil and a tin of sardines.')
    },
    close: function* (c) {
      if (!c.is('kitchen.cupboardOpen')) { yield c.say('It\'s closed.'); return }
      c.clear('kitchen.cupboardOpen')
      yield c.sfx('cupboard')
    },
    pickup: 'It\'s nailed to the wall. Wonky, but nailed.',
  },
}

const oil: HotspotDef = {
  id: 'oil',
  name: 'cooking oil',
  rect: [134, 35, 12, 18],
  at: [138, 112],
  face: 'up',
  z: 4,
  when: s => !!s.flags['kitchen.cupboardOpen'] && !s.flags[F.oilTaken],
  verbs: {
    look: 'Olive oil, 1987. Thick as syrup. Good for frying. Good for rusty things, Brunhilde\'s manual says. Chapter six.',
    pickup: function* (c) {
      c.give('oil')
      c.set(F.oilTaken)
      yield c.sfx('pickup')
      yield c.solve('oil')
      yield c.say('Cooking oil. It\'s gone thick, like a smoothie. It still pours. Just about.')
    },
  },
}

const sardines: HotspotDef = {
  id: 'sardines',
  name: 'sardines',
  rect: [146, 44, 14, 9],
  at: [150, 112],
  face: 'up',
  z: 4,
  when: s => !!s.flags['kitchen.cupboardOpen'] && !s.flags['kitchen.sardinesTaken'],
  verbs: {
    look: 'A tin of sardines. No ring pull. The house probably has a tin opener somewhere. The house isn\'t telling.',
    pickup: function* (c) {
      c.give('sardines')
      c.set('kitchen.sardinesTaken')
      yield c.sfx('pickup')
      const cat = c.actor('cat')
      if (cat.room === 'kitchen' && !c.is(F.catMonocle)) {
        yield c.pose('peek', undefined, 'cat')
        yield c.wait(1)
        yield c.say('On the fridge, Mrs Whiskers opens one eye. She looks at the sardines. Then at me.')
        yield c.say('Like she isn\'t a common cat, and I\'m a very common rabbit.')
        yield c.pose('sleep', undefined, 'cat')
        return
      }
      yield c.say('Sardines. Every house needs a tin of something nobody can open.')
    },
  },
}

const stove: HotspotDef = {
  id: 'stove',
  name: 'stove',
  rect: [56, 10, 48, 94],
  at: [80, 112],
  face: 'up',
  verbs: {
    look: 'A cast-iron range, cold as a tax office. A pot and a kettle on top, both empty. Both judging.',
    open: function* (c) {
      yield c.sfx('creak')
      yield c.say('Ash, and a very old potato. I say hello to the potato. I close the door.')
    },
    use: 'Cold. Nothing to burn in it and nothing to cook. It\'s a big black sulk.',
    pickup: 'I lift the kettle. Empty. I put it back.',
    talk: 'It says nothing. Not even a tick of cooling metal. It\'s been cold for decades.',
    close: 'It\'s closed.',
  },
  useWith: {
    matches: 'Our only match, on a stove with no wood? Dag would never forgive me. Actually, Dag would. I wouldn\'t.',
    manual: 'Burn Brunhilde\'s manual? Over my cold, dead Volvo.',
    sardines: 'I\'d need to open the tin. And light the stove. And want sardines.',
  },
}

const hatch: HotspotDef = {
  id: 'hatch',
  name: 'dumbwaiter',
  rect: [22, 44, 30, 34],
  at: [37, 112],
  face: 'up',
  verbs: {
    look: function* (c) {
      yield c.say('A dumbwaiter: a tiny lift in the wall, for sending food between floors. It runs from the cellar to the attic.')
      yield c.say('If I GIVE something to Dag\'s or Espen\'s picture, it goes down or up in here. As long as it fits.')
    },
    open: function* (c) {
      if (c.is('kitchen.hatchOpen')) { yield c.say('It\'s open.'); return }
      c.set('kitchen.hatchOpen')
      yield c.sfx('hatch')
      yield c.say('I slide the hatch up. From below, Dag humming. From far above, Espen narrating to nobody.')
    },
    close: function* (c) {
      if (!c.is('kitchen.hatchOpen')) { yield c.say('It\'s shut.'); return }
      c.clear('kitchen.hatchOpen')
      yield c.sfx('hatch')
    },
    talk: function* (c) {
      const n = c.bump('kitchen.hatchTalks')
      if (n === 1) {
        yield c.say('Dag? Can you hear me?')
        yield c.sayAs('dag', 'Kjell! There\'s a lot of jam down here. A LOT of jam.')
        yield c.say('Is there a battery?')
        yield c.sayAs('dag', 'There\'s jam.')
      } else if (n === 2) {
        yield c.say('Espen? You up there?')
        yield c.sayAs('espen', 'Kjell! This house is INCREDIBLE. I\'ve found three cold spots and a dead moth. Episode twelve, Kjell!')
      } else yield c.say(c.pick(['I say "hello" down the shaft. It says "hello" back, a bit wetter.', 'Talking down a food lift. My mother always said I would.']))
    },
    use: 'I don\'t fit. Believe me, I measured with my eyes. And my ears.',
    pickup: 'It\'s built into the wall. The whole wall would come with it.',
  },
  anyItem: 'To send something, I give it to Dag\'s or Espen\'s picture. The dumbwaiter does the rest.',
}

const bell: HotspotDef = {
  id: 'bell',
  name: 'bell',
  rect: [52, 42, 10, 26],
  at: [52, 112],
  face: 'up',
  z: 1,
  verbs: {
    look: 'A little brass bell with a pull cord. For calling the dumbwaiter. Or a butler.',
    pull: function* (c) {
      yield c.sfx('bell')
      const n = c.bump('kitchen.bell')
      if (n === 1) {
        yield c.say('Ding!')
        yield c.sayAs('dag', 'Room service?')
        yield c.say('Very funny.')
      } else yield c.sayAs('dag', c.pick(['Ding yourself.', 'Is it dinner?', 'Kjell, stop ringing, you\'re scaring the jam.']))
    },
    use: function* (c) {
      yield c.sfx('bell')
      yield c.sayAs('dag', c.pick(['Room service?', 'Is it dinner?', 'Kjell, stop ringing, you\'re scaring the jam.']))
    },
    pickup: 'It\'s screwed on. It rings when you touch it. It\'s a bell.',
  },
}

const windowHs: HotspotDef = {
  id: 'window',
  name: 'window',
  rect: [176, 16, 38, 48],
  at: [194, 112],
  face: 'up',
  z: 1,
  verbs: {
    look: 'Rain. Lightning. A dead herb on the sill that gave up in 1987, and I understand it.',
    open: 'The rain would come in sideways. It\'s already coming in sideways, through the frame.',
    close: 'It\'s closed. The rain doesn\'t care.',
  },
}

const sink: HotspotDef = {
  id: 'sink',
  name: 'sink',
  rect: [172, 66, 46, 38],
  at: [194, 112],
  face: 'up',
  verbs: {
    look: 'A deep sink with a gingham curtain underneath. It\'s surprisingly clean. Nobody has been washing up here.',
    use: function* (c) {
      yield c.sfx('drip')
      yield c.say('The tap coughs, gurgles, and gives me one brown drop. Very 1987.')
    },
    open: 'Behind the curtain: a bucket, a scrubbing brush, and a spider who was here first.',
  },
}

const calendar: HotspotDef = {
  id: 'calendar',
  name: 'calendar',
  rect: [253, 16, 20, 18],
  at: [262, 112],
  face: 'up',
  z: 1,
  verbs: {
    look: function* (c) {
      yield c.say('A calendar, still on September 1987. Friday the 25th is circled: "MIDNIGHT! LIGHTNING! (Feed cat?)"')
      yield c.say('Today is Friday the 25th. I\'m going to ignore that.')
    },
    pickup: 'I\'ll leave it. It\'s the only thing in the house that knows what day it is. Sort of.',
  },
}

const sideCounter: HotspotDef = {
  id: 'counter',
  name: 'counter',
  rect: [332, 76, 42, 28],
  at: [352, 112],
  face: 'up',
  verbs: {
    look: 'A side counter with a pink cat bowl on it. The bowl says MRS W. It has never had cat food in it. It smells of tea with lemon.',
    use: 'I lean on it. It leans back. Everything here leans back.',
  },
}

const spices: HotspotDef = {
  id: 'spices',
  name: 'spice rack',
  rect: [336, 42, 34, 12],
  at: [352, 112],
  face: 'up',
  z: 1,
  verbs: {
    look: 'Spices: salt, pepper, dill, more dill, "EXPERIMENTAL", and paprika.',
    pickup: 'I take the one marked EXPERIMENTAL and put it straight back.',
  },
}

const toFoyer: HotspotDef = {
  id: 'to-foyer',
  name: 'foyer',
  rect: [380, 36, 20, 84],
  at: [388, 124],
  face: 'right',
  exit: { to: 'foyer', x: 30, y: 124, face: 'right' },
}

export const room: RoomDef = {
  id: 'kitchen',
  name: 'Kitchen',
  floor: 'ground',
  w: 400,
  enter: warmHouse,
  walk: [[[20, 106], [380, 107], [398, 142], [2, 142]]],
  hotspots: [catOnFridge, catOnCounter, fridge, freezer, gloves, note, drawer, matches, cupboard, oil, sardines, stove, hatch, bell, windowHs, sink, calendar, sideCounter, spices, toFoyer],
}
