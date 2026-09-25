/**
 * The three friends: where they start, how they sound, and what they say
 * when a sentence doesn't work.
 */
import type { HeroDef, HeroId, NpcDef } from '../types'

export const HEROES: Record<HeroId, HeroDef> = {
  kjell: {
    id: 'kjell',
    name: 'Kjell',
    color: '#8fe8ff',
    floor: 'ground',
    start: { room: 'foyer', x: 220, y: 128, face: 'down' },
    inv: ['manual', 'keys'],
    speed: 58,
    talkY: 58,
    fail: {
      give: ['I\'d rather keep it.', 'Nobody wants that. I barely want it.'],
      pickup: ['I can\'t pick that up.', 'That stays where it is. I\'ve decided.', 'My back says no. My back always says no.'],
      use: ['I don\'t know how to use that.', 'That doesn\'t do anything.', 'There\'s no manual for that. I checked.'],
      open: ['It doesn\'t open.', 'I can\'t open that.', 'Not a thing that opens.'],
      look: ['Hm.', 'Nothing special about it.', 'It\'s exactly as crooked as everything else.'],
      push: ['It won\'t budge.', 'I pushed. Nothing happened. Story of my life.'],
      close: ['It doesn\'t close.', 'Can\'t close that.'],
      talk: ['It isn\'t much of a talker.', 'Hello? No. Nothing.', 'I\'m not talking to that. People already think I\'m odd.'],
      pull: ['It won\'t budge.', 'I pulled. It stayed.'],
    },
    failWith: ['That won\'t work.', 'Those two don\'t go together.', 'Brunhilde\'s manual says nothing about that. So: no.'],
  },
  dag: {
    id: 'dag',
    name: 'Dag',
    color: '#ffc26b',
    floor: 'cellar',
    start: { room: 'pantry', x: 200, y: 124, face: 'down' },
    inv: ['sandwich'],
    speed: 46,
    talkY: 54,
    fail: {
      give: ['I\'ll hang on to it.', 'Finders keepers. Well, keepers.'],
      pickup: ['Nah.', 'I could lift it. I just don\'t want to.', 'That\'s not coming with me.'],
      use: ['Doesn\'t do anything.', 'I don\'t see how.', 'Hmm. No.'],
      open: ['Doesn\'t open.', 'Nope. Shut.'],
      look: ['Yep. That\'s a thing.', 'Not edible.', 'I\'ve seen worse. Not often.'],
      push: ['It\'s not going anywhere. Neither am I, apparently.', 'Nope.'],
      close: ['Doesn\'t close.', 'Already closed. Or not a closing sort of thing.'],
      talk: ['Hey. …Nothing.', 'It doesn\'t want to chat.', 'I talk to my plants at home. They don\'t answer either.'],
      pull: ['It\'s stuck.', 'Nope.'],
    },
    failWith: ['Nope.', 'Those don\'t go together.', 'I\'m not a chef. Well. I am a little.'],
  },
  espen: {
    id: 'espen',
    name: 'Espen',
    color: '#c7a6ff',
    floor: 'attic',
    start: { room: 'storeroom', x: 150, y: 124, face: 'down' },
    inv: ['emf'],
    speed: 64,
    talkY: 56,
    fail: {
      give: ['It stays with me. For the podcast.', 'That\'s evidence.'],
      pickup: ['Can\'t pick that up.', 'Too heavy. I\'m built for radio.', 'I\'d love to. But no.'],
      use: ['Nothing happens. Suspicious.', 'I don\'t know what that does. Yet.', 'That\'s not how you use that. Probably.'],
      open: ['It won\'t open. Something is holding it shut. Or it\'s just shut.', 'Doesn\'t open.'],
      look: ['Fascinating. No, wait. Just old.', 'The EMF meter is silent. Disappointing.', 'That is going in the episode.'],
      push: ['It\'s not moving.', 'Nope. Solid.'],
      close: ['It doesn\'t close.', 'Can\'t.'],
      talk: ['Hello? Is anybody in there? …Nothing.', 'If you can hear me, knock twice. …No knocking.', 'It\'s shy.'],
      pull: ['Won\'t come.', 'Nope.'],
    },
    failWith: ['That doesn\'t work.', 'No. Although: what if? …No.', 'Those two don\'t go together. Scientifically.'],
  },
}

export const NPCS: Record<string, NpcDef> = {
  bones: { id: 'bones', name: 'Mr Bones', color: '#e8e4d0', start: { room: 'boiler', x: 290, y: 120, face: 'left', pose: 'shiver' }, talkY: 56 },
  hedvig: { id: 'hedvig', name: 'Aunt Hedvig', color: '#7dffb8', start: { room: 'parlour', x: 196, y: 112, face: 'down' }, talkY: 52 },
  gustav: { id: 'gustav', name: 'Gustav', color: '#b6ff4a', start: { room: 'conservatory', x: 300, y: 122, face: 'left' }, talkY: 80 },
  cat: { id: 'cat', name: 'Mrs Whiskers', color: '#ffd23f', start: { room: 'kitchen', x: 300, y: 58, face: 'left', pose: 'sleep' }, talkY: 18 },
  bat: { id: 'bat', name: 'Count Flapula', color: '#ff5c7a', start: { room: 'study', x: 300, y: 60, face: 'down', pose: 'hang' }, talkY: 6 },
  professor: { id: 'professor', name: 'Professor Voltvik', color: '#ffffff', start: { room: null, x: 0, y: 0, face: 'down', visible: false }, talkY: 56 },
  narrator: { id: 'narrator', name: '', color: '#fff4ff', start: { room: null, x: 0, y: 0, face: 'down', visible: false }, talkY: 0 },
}
