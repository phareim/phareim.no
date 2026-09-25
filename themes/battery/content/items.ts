/**
 * Every item: its name, what LOOK AT says, what USE on its own does, and
 * the dumbwaiter's rules. What an item does to a thing in a room lives on
 * that room's hotspot (`useWith` / `giveWith`).
 *
 * Shared flags (the puzzle state other floors read) are listed in flags.ts.
 */
import type { ItemDef, ItemId } from '../types'
import { F } from './flags'

export const ITEMS: Record<ItemId, ItemDef> = {
  manual: {
    id: 'manual',
    name: 'Volvo manual',
    look: c => c.by({
      kjell: 'Brunhilde\'s owner\'s manual. 312 pages. Forty of them are about the ashtray. I\'ve read them all twice.',
      dag: 'Kjell\'s car manual. Dry. Very dry. Wonderfully flammable.',
      espen: 'Kjell\'s Volvo manual. He reads it at parties.',
    }),
    useAlone: c => c.by({
      kjell: 'Chapter nine: "Your ashtray and you". Not now. Not even I can do chapter nine now.',
      dag: 'I read a page. I feel drier already.',
      espen: 'There\'s nothing about ghosts in here. I checked the index.',
    }),
    arrive: { dag: 'Got the manual. Kjell sounded like he was crying a bit.' },
  },
  keys: {
    id: 'keys',
    name: 'car keys',
    look: 'Brunhilde\'s keys. The fob is a tiny Volvo 240. Of course it is.',
    useAlone: 'I\'d need a car for that. And a battery for the car.',
    send: c => c.by({
      kjell: 'Brunhilde\'s keys stay with me. They have never left my pocket. Not once. Not even in the sauna.',
      dag: 'They\'re Kjell\'s. I\'d never hear the end of it.',
      espen: 'Kjell would kill me.',
    }),
  },
  sandwich: {
    id: 'sandwich',
    name: 'ham sandwich',
    look: c => c.by({
      dag: 'My emergency sandwich. Ham, butter, a pickle. It has been in my suit all evening. It\'s warm now. Like a friend.',
      kjell: 'Dag\'s sandwich. It\'s warm. I don\'t want to know why.',
      espen: 'Dag\'s sandwich. He\'d want it back.',
    }),
    useAlone: c => c.hero === 'dag'
      ? (c.is(F.dagAte) ? 'I\'m full of jam. The sandwich can wait. The sandwich understands.' : 'Not yet. It\'s an emergency sandwich. This isn\'t an emergency yet. It\'s close.')
      : 'It isn\'t mine to eat.',
    send: c => {
      if (c.hero === 'dag' && !c.is(F.dagAte)) {
        return c.pick([
          'No. The sandwich stays with me. We\'ve been through a lot tonight.',
          'I\'m not sending my sandwich anywhere. I\'m hungry. There\'s jam down here but I can\'t get into it.',
        ])
      }
      return undefined
    },
    arrive: { kjell: 'Dag sent his sandwich. He must really trust me. Or he found something better.' },
  },
  emf: {
    id: 'emf',
    name: 'EMF meter',
    look: c => c.by({
      espen: 'My EMF meter. It measures electromagnetic fields, which is how you find ghosts. It beeps near fridges, too. Ghosts love fridges.',
      kjell: 'Espen\'s ghost beeper.',
      dag: 'Espen\'s beeper.',
    }),
    useAlone: function* (c) {
      yield c.sfx('emf')
      yield c.say(c.pick([
        'Beep. Beep. Beeeep. Either a ghost or my own phone.',
        'Nothing. The ghosts are being coy.',
        'It\'s picking something up. It\'s picking up the storm. And possibly me.',
      ]))
    },
    send: c => c.hero === 'espen' ? 'The meter stays with me. It\'s the only thing on this podcast with a proper job.' : undefined,
  },
  matches: {
    id: 'matches',
    name: 'matchbox',
    look: 'A box of matches. I shook it: one match left. One. The pressure.',
    useAlone: 'I\'m not wasting our only match on nothing.',
    arrive: { dag: 'Matches. One of them. No pressure, Dag.' },
  },
  oil: {
    id: 'oil',
    name: 'cooking oil',
    look: 'A bottle of olive oil, 1987. It has gone thick, like a smoothie. It still pours. Just about.',
    useAlone: 'I\'m not drinking it.',
    arrive: { espen: 'Oil? Kjell sent me oil. Is this a hint? Is Kjell hinting?' },
  },
  sardines: {
    id: 'sardines',
    name: 'sardine tin',
    look: 'A tin of sardines. No ring pull. No tin opener. A tin you can only look at.',
    useAlone: 'It won\'t open. I tried my teeth. I have regrets.',
  },
  umbrella: {
    id: 'umbrella',
    name: 'umbrella',
    look: 'A black umbrella with a duck-head handle. The duck looks disappointed in me.',
    useAlone: 'Opening an umbrella indoors is bad luck. And we\'re already having a night.',
    send: () => 'It\'s too long for the dumbwaiter.',
  },
  monocle: {
    id: 'monocle',
    name: 'monocle',
    look: c => c.by({
      espen: 'The Professor\'s spare monocle. Brass rim, a chain, a tiny engraving: O.V.',
      kjell: 'A monocle. The one in the portrait. Or its twin.',
      dag: 'A monocle. Fancy.',
    }),
    useAlone: c => c.by({
      kjell: 'I put it in my eye. I can see less. I look like a lawyer. I take it out.',
      dag: 'It won\'t stay in. My face is too happy.',
      espen: 'I look distinguished. And like I can only see from one eye. Which is true.',
    }),
    arrive: { kjell: 'A monocle. Why would Espen send me a monocle?' },
  },
  letters: {
    id: 'letters',
    name: 'letters',
    look: function* (c) {
      if (!c.is(F.lettersRead)) {
        c.set(F.lettersRead)
        yield c.say('Love letters, tied with a ribbon. "My dearest Hedvig," from someone called Torvald.')
        yield c.say('"…and Sigurd sends his love, too. He has grown two inches this winter and I have combed him every evening, thinking of you."')
        yield c.say('Sigurd is… his beard. He named his beard Sigurd. Torvald, you absolute legend.')
        return
      }
      yield c.say('Torvald\'s letters to Hedvig. His beard was called Sigurd. I will never forget this.')
    },
    verbs: { open: 'I\'ve read them. Sigurd the beard. It\'s all in there.' },
    arrive: { kjell: 'Love letters? From Espen? …Oh. They\'re not from Espen.' },
  },
  jam: {
    id: 'jam',
    name: s => s.flags[F.jamOpen] ? 'open jam jar' : 'jar of jam',
    look: c => c.is(F.jamOpen)
      ? 'Lingonberry jam, 1987, open at last. It smells like a Sunday.'
      : 'A jar of lingonberry jam. The label says LINGON 1987 in the Professor\'s handwriting.',
    useAlone: function* (c) {
      if (c.is(F.jamOpen)) {
        yield c.say(c.by({
          dag: 'One more spoonful. For strength. …Two. For balance.',
          kjell: 'It\'s Dag\'s jam, really.',
          espen: 'I\'m not a jam person. I\'m a ghost person.',
        }))
        return
      }
      yield c.pose('strain', 1.2)
      yield c.say(c.by({
        dag: 'Nnngh. Stuck. 1987 was a strong year for lids.',
        kjell: 'It won\'t open. Nothing in this house opens.',
        espen: 'Welded shut by time itself.',
      }))
    },
    arrive: {
      espen: 'Jam! Dag sent me jam! …Why did Dag send me jam?',
      kjell: 'Jam. Thanks, Dag.',
    },
  },
  labkey: {
    id: 'labkey',
    name: 'iron key',
    look: 'A big iron key. The bow is shaped like a lightning bolt. Subtle.',
    useAlone: 'Keys want locks.',
  },
  cat: {
    id: 'cat',
    name: 'Mrs Whiskers',
    look: c => c.by({
      kjell: 'Mrs Whiskers, wearing the monocle. She looks like she\'s about to mark my homework.',
      dag: 'A cat in a monocle. She looks at the machines like she owns them.',
      espen: 'A cat with a monocle. This house has everything.',
    }),
    useAlone: 'I scratch her behind the ears. She allows it for exactly one second.',
    verbs: { talk: function* (c) { yield c.say('Who\'s a good… colleague?'); yield c.sayAs('cat', 'Mrrp.') } },
    arrive: {
      dag: 'Kjell just sent me a cat. In a monocle. Okay. Hello, Mrs Whiskers.',
      espen: 'A cat came up the dumbwaiter. She looks annoyed at me personally.',
      kjell: 'Mrs Whiskers is back. She is not amused.',
    },
  },
  gloves: {
    id: 'gloves',
    name: 'rubber gloves',
    look: 'Yellow rubber gloves, frozen stiff and now thawed. There\'s a label: "FOR ELECTRICITY. AND WASHING UP."',
    useAlone: 'I put them on and take them off again. They squeak. I\'ll wear them when it counts.',
  },
  poker: {
    id: 'poker',
    name: 'fireplace poker',
    look: 'Aunt Hedvig\'s poker. Long, iron, with a brass knob. Excellent at carrying heat. And, I suspect, electricity.',
    useAlone: 'I poke the air. The air doesn\'t react.',
    send: () => 'The poker\'s too long for the dumbwaiter.',
  },
  clockkey: {
    id: 'clockkey',
    name: 'clock key',
    look: 'A brass winding key, a little slimy from its years inside Gustav. For a clock. A grand one.',
    useAlone: 'It winds a clock. I need the clock.',
  },
}
