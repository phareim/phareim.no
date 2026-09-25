/**
 * The intro (a new game), the midnight strike (USE clock key on the
 * foyer's grandfather clock) and the finale with the credits.
 *
 * Scripts move actors with `place` (instant) in small steps for the
 * cartoon moves (Brunhilde rolling in, Dag down the chute, Espen up the
 * chandelier cord), cut to other rooms with `view`, and use a DOTT split
 * screen for the strike. The driveway's car and gate read the local
 * `driveway.*` flags (see rooms/driveway.ts).
 */
import type { Ctx, Handler, HeroId, RoomId, Script } from '../types'
import { F } from './flags'
import { CAR, GATE, SPOT } from './rooms/driveway'
import { ROOF } from './rooms/roof'
import { LAB as LABROOM } from './rooms/lab'
import { PANTRY as PANTRYROOM } from './rooms/pantry'

// ---------------------------------------------------------------------------
// Where things are in the other floors' rooms
// ---------------------------------------------------------------------------

/** Foyer (rooms/foyer.ts header). */
const FOYER = {
  door: { x: 220, y: 108 },
  trapdoor: { x: 180, y: 128 },
  chandelier: { x: 260, y: 122 },
  clock: { x: 106, y: 110 },
  stairsFoot: { x: 286, y: 110 },
  kitchenDoor: { x: 14, y: 124 },
  kjell: { x: 220, y: 128 },
} as const

/*
 * The rooms import each other in a ring (story → roof → parlour → foyer →
 * story), so nothing from a room module is read at module level here: the
 * getters below run only when a script does.
 */

/** Pantry: Dag drops down the chute onto the mattress, then stands (his start). */
const pantry = () => ({ x: PANTRYROOM.dag.x, y: PANTRYROOM.dag.y, chuteX: PANTRYROOM.chute.x, mattressY: PANTRYROOM.chute.mattressY })
/** Storeroom: the floor hatch Espen pops out of (his start). */
const STOREROOM = { x: 150, y: 124 }
/** Conservatory: the junction box on the wall (rooms/conservatory.ts, hotspot 'junction'). */
const CONSERVATORY = { junctionX: 249 }
/** Lab (rooms/lab.ts). Dag waits by the machine's right end for the strike. */
const lab = () => ({
  machineX: LABROOM.machine.x,
  boothX: LABROOM.booth.cx,
  paneX: 212,
  prof: LABROOM.professor,
  profOut: LABROOM.professorOut,
  unbolt: { x: 222, y: 120 },
  dagAt: { x: 240, y: 122 },
  carry: { x: 176, y: 124 },
})

// ---------------------------------------------------------------------------
// Little helpers
// ---------------------------------------------------------------------------

const HEROES: readonly HeroId[] = ['kjell', 'dag', 'espen']

/** Move an actor in a straight line by placing it, frame by frame (falls, lifts, the car). */
function* glide(c: Ctx, who: HeroId | 'professor', room: RoomId, x0: number, y0: number, x1: number, y1: number, s: number): Script {
  const n = Math.max(1, Math.round(s * 30))
  for (let i = 1; i <= n; i++) {
    const t = i / n
    yield c.place(who, room, Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t))
    yield c.wait(1 / 30)
  }
}

/** Where the three sit inside Brunhilde (hidden), relative to her middle. */
const SEATS: Record<HeroId, number> = { kjell: 16, espen: -2, dag: -20 }

/** Brunhilde from x0 to x1, easing out, with the three hidden inside her. */
function* drive(c: Ctx, x0: number, x1: number, s: number, passengers = true): Script {
  const n = Math.max(1, Math.round(s * 30))
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const e = x1 > x0 ? 1 - (1 - t) * (1 - t) : t * t
    const x = Math.round(x0 + (x1 - x0) * e)
    c.set(CAR.x, x)
    if (passengers) for (const h of HEROES) yield c.place(h, 'driveway', x + SEATS[h], CAR.seatY)
    yield c.wait(1 / 30)
  }
}

function* chimes(c: Ctx, n: number, gap: number): Script {
  for (let i = 0; i < n; i++) {
    yield c.sfx('clock-chime')
    yield c.wait(gap)
  }
}

// ---------------------------------------------------------------------------
// The intro
// ---------------------------------------------------------------------------

export const intro: Handler = function* (c) {
  yield c.music('intro')
  // Everyone into the car, out of sight; Brunhilde just off the left edge.
  c.set(CAR.state, 'lit')
  c.clear(GATE)
  for (const h of HEROES) {
    yield c.show(h, false)
    yield c.place(h, 'driveway', -80 + SEATS[h], CAR.seatY, 'right')
  }
  c.set(CAR.x, -80)
  yield c.card('Friday night. A storm on the coast road.', 2.4)
  yield c.card('Three friends drive home from what Espen promised was a costume party.', 3.0)
  yield c.card('It was a quiz night.', 1.8)

  // Brunhilde chugs in, coughs, and dies at the gate.
  yield c.sfx('car-cough')
  yield* drive(c, -80, 110, 1.6)
  yield c.sfx('car-cough')
  yield* drive(c, 110, CAR.stop, 1.1)
  yield c.sfx('car-cough')
  c.set(CAR.state, 'dead')
  yield c.wait(0.6)
  yield c.say('No. No, no, no. Brunhilde, not here. Not tonight.')
  for (let i = 0; i < 3; i++) { yield c.sfx('car-click'); yield c.wait(0.35) }
  yield c.say('Click-click-click. The worst sound in the world.')

  // Out into the rain.
  yield c.sfx('door')
  yield c.place('kjell', 'driveway', SPOT.kjell.x, SPOT.kjell.y, 'right')
  yield c.place('espen', 'driveway', SPOT.espen.x, SPOT.espen.y, 'right')
  yield c.place('dag', 'driveway', SPOT.dag.x, SPOT.dag.y, 'right')
  for (const h of HEROES) yield c.show(h, true)
  yield c.walkAs('kjell', SPOT.bonnet.x, SPOT.bonnet.y)
  yield c.face('left')
  yield c.pose('reach', 0.6)
  yield c.sfx('bonnet')
  c.set(CAR.state, 'open')
  yield c.wait(0.4)
  yield c.say('Dead, and cracked. Brunhilde has never let me down. Except tonight. And in 2019. And twice in 2021.')

  yield c.face('right', 'espen')
  yield c.pose('point', 1.6, 'espen')
  yield c.sayAs('espen', 'GUYS. Villa Voltvik! Professor Voltvik vanished there in 1987, bottling lightning. I did an episode!')
  yield c.sayAs('dag', 'On Spøkelsesjegerne? The podcast with eleven listeners?')
  yield c.sayAs('espen', 'Eleven LOYAL listeners.')
  yield c.sayAs('dag', 'Do you think she has food in there?')
  yield c.say('She\'s been missing for thirty-nine years, Dag.')
  yield c.sayAs('dag', 'Jam keeps.')
  yield c.face('right')
  yield c.say('Fine. A house that size must have a battery. Or a phone. Or a sensible adult.')
  yield c.sayAs('dag', 'At least we came fourth.')
  yield c.say('There were four teams.')

  // Through the gate, up the path.
  const GATE_AT = SPOT.gate
  yield c.walkAs('kjell', GATE_AT.x - 10, GATE_AT.y + 8)
  yield c.pose('reach', 0.5)
  yield c.sfx('creak')
  c.set(GATE)
  yield c.wait(0.3)
  yield c.walkAs('kjell', GATE_AT.x, GATE_AT.y, false)
  yield c.walkAs('espen', GATE_AT.x - 4, GATE_AT.y + 4, false)
  yield c.walkAs('dag', GATE_AT.x - 22, GATE_AT.y + 12, false)
  yield c.wait(0.9)
  yield c.fade(1, 0.6)

  // The foyer. The door swung open before they could knock.
  c.set(F.frontDoorOpen)
  c.set(F.stairsDown)
  yield c.place('kjell', 'foyer', FOYER.door.x, FOYER.door.y + 2, 'down')
  yield c.place('espen', 'foyer', FOYER.door.x + 22, FOYER.door.y + 4, 'down')
  yield c.place('dag', 'foyer', FOYER.door.x - 24, FOYER.door.y + 4, 'down')
  yield c.sfx('creak')
  yield c.fade(0, 0.6)
  yield c.walkAs('kjell', FOYER.kjell.x, FOYER.kjell.y - 6, false)
  yield c.walkAs('espen', FOYER.chandelier.x - 14, FOYER.chandelier.y, false)
  yield c.walkAs('dag', FOYER.door.x - 26, FOYER.door.y + 10)
  yield c.sfx('emf')
  yield c.sayAs('espen', 'It opened by itself! That\'s going in the episode.')
  yield c.say('Hello? Sorry. Our car broke down, and we\'re dressed as rabbits.')

  // Dag finds the loose tile.
  yield c.walkAs('dag', FOYER.trapdoor.x, FOYER.trapdoor.y)
  yield c.sayAs('dag', 'Hello? We\'d take a battery. Or a snack. Either.')
  yield c.sfx('creak')
  c.set('foyer.trapOpen')
  yield c.wait(0.25)
  yield c.pose('fall', undefined, 'dag')
  yield c.sfx('drop')
  yield c.wait(0.35)
  yield c.place('dag', null, 0, 0)
  yield c.wait(0.4)
  c.clear('foyer.trapOpen')
  yield c.sfx('thud')
  yield c.shake(0.3, 1)
  yield c.face('left')
  yield c.pose('scared', 1.2)
  yield c.say('Dag?!')
  yield c.face('left', 'espen')
  yield c.sayAs('espen', 'The house TOOK him! Kjell, this is the best night of my life.')

  // Espen steps back under the chandelier.
  yield c.walkAs('espen', FOYER.chandelier.x, FOYER.chandelier.y)
  yield c.face('right', 'espen')
  yield c.sayAs('espen', 'Stay calm. Houses like this want you to panic. Just don\'t touch any c-')
  yield c.sfx('squeak')
  yield c.pose('scared', undefined, 'espen')
  yield c.wait(0.3)
  yield* glide(c, 'espen', 'foyer', FOYER.chandelier.x, FOYER.chandelier.y, FOYER.chandelier.x, 34, 0.45)
  yield c.sfx('hatch')
  yield c.place('espen', null, 0, 0)
  yield c.shake(0.25, 1)
  yield c.face('right')
  yield c.say('Espen!')

  // The house makes up its mind.
  yield c.sfx('creak')
  yield c.shake(0.9, 2)
  c.clear(F.stairsDown)
  yield c.sfx('thud')
  yield c.wait(0.5)
  yield c.face('right')
  yield c.say('The stairs just folded into the ceiling. Like a sulky accordion.')
  yield c.face('up')
  yield c.sfx('door')
  c.clear(F.frontDoorOpen)
  yield c.shake(0.4, 2)
  yield c.wait(0.3)
  yield c.face('down')
  yield c.say('And the door. Naturally.')

  // Meanwhile, in the cellar…
  const PANTRY = pantry()
  yield c.view('pantry', true)
  yield c.wait(0.4)
  yield c.pose('fall', undefined, 'dag')
  yield* glide(c, 'dag', 'pantry', PANTRY.chuteX, 0, PANTRY.chuteX, PANTRY.mattressY + 4, 0.35)
  yield c.sfx('thud')
  yield c.shake(0.4, 2)
  yield c.pose('lie', undefined, 'dag')
  yield c.wait(0.6)
  yield c.place('dag', 'pantry', PANTRY.x, PANTRY.y)
  yield c.pose('', undefined, 'dag')
  yield c.face('left', 'dag')
  yield c.wait(0.35)
  yield c.face('right', 'dag')
  yield c.wait(0.35)
  yield c.face('down', 'dag')
  yield c.sayAs('dag', 'There\'s a lot of jam down here.')

  // …and in the attic.
  yield c.view('storeroom', true)
  yield c.wait(0.3)
  c.set('storeroom.hatchOpen')
  yield c.sfx('hatch')
  yield c.pose('cheer', undefined, 'espen')
  yield* glide(c, 'espen', 'storeroom', STOREROOM.x, 160, STOREROOM.x, STOREROOM.y - 18, 0.25)
  yield* glide(c, 'espen', 'storeroom', STOREROOM.x, STOREROOM.y - 18, STOREROOM.x, STOREROOM.y, 0.15)
  yield c.sfx('thud')
  yield c.sayAs('espen', 'I\'M IN THE ATTIC! Nobody has ever been this haunted! EPISODE TWELVE!')
  yield c.pose('', undefined, 'espen')
  yield c.walkAs('espen', STOREROOM.x + 24, STOREROOM.y)
  c.clear('storeroom.hatchOpen')
  yield c.sfx('hatch')
  yield c.face('left', 'espen')

  // Back to Kjell, alone. Voices in the walls.
  yield c.view(null, true)
  yield c.sfx('bell')
  yield c.wait(0.4)
  yield c.sayAs('dag', 'Kjell? There\'s a little hatch down here with a bell. It goes up.')
  yield c.sayAs('espen', 'Up here too! A dumbwaiter! A tiny lift for food, right through the house!')
  yield c.say('Right. We pass things along by dumbwaiter, find a battery, go home.')
  yield c.sayAs('narrator', 'GIVE a thing to a friend\'s portrait to send it. Pick a portrait to play him. TALK TO one for ideas.')

  // Everyone where the game starts them.
  yield c.walk(FOYER.kjell.x, FOYER.kjell.y, false)
  yield c.place('dag', 'pantry', PANTRY.x, PANTRY.y, 'down')
  yield c.place('espen', 'storeroom', STOREROOM.x, STOREROOM.y, 'down')
  yield c.arrive('kjell')
  yield c.place('kjell', 'foyer', FOYER.kjell.x, FOYER.kjell.y, 'down')
  yield c.music('auto')
}

// ---------------------------------------------------------------------------
// Midnight
// ---------------------------------------------------------------------------

type Missing = 'rod' | 'junction' | 'lever' | 'booth'

/** The first piece missing, top of the house to the bottom, the way the bolt runs. */
export function missingPiece(c: Pick<Ctx, 'is'>): Missing | null {
  if (!c.is(F.rodUp)) return 'rod'
  if (!c.is(F.junctionBridged)) return 'junction'
  if (!c.is(F.leverArmed)) return 'lever'
  if (!c.is(F.catInBooth)) return 'booth'
  return null
}

/** USE clock key on the grandfather clock (foyer): the midnight strike. */
export const midnight: Handler = function* (c) {
  if (c.is(F.struck)) { yield c.say('It\'s midnight already. It\'s been midnight since the good bit.'); return }
  const tries = c.bump(F.midnightTries)
  yield c.music('tension')
  yield c.face('up')
  yield c.pose('reach', 1.4)
  yield c.sfx('clock-wind')
  yield c.say(tries === 1
    ? 'The key fits. Round she goes. Come on then, house. Midnight.'
    : c.pick(['Round again. Midnight, please. Properly this time.', 'Wind, wind, wind. Let\'s try that again.', 'Once more. I have a good feeling. I had one last time too.']))
  yield c.sfx('clock-tick')
  yield c.wait(0.7)
  yield c.sfx('clock-tick')
  yield c.wait(0.7)
  yield c.lightning(0.5)
  const miss = missingPiece(c)
  if (miss) { yield* failedStrike(c, miss, tries); return }
  yield* finale(c)
}

function* failedStrike(c: Ctx, miss: Missing, tries: number): Script {
  const LAB = lab()
  yield* chimes(c, 4, 0.5)
  yield c.sayAs('narrator', 'BONG. BONG. BONG. BONG. BONG. BONG. BONG. BONG…')
  yield c.lightning(1)
  yield c.sfx('zap')
  c.set('midnight.fail', miss)
  const at = (h: HeroId, room: RoomId) => c.actor(h).room === room
  if (miss === 'rod') {
    yield c.view('roof', true, ROOF.socket.x - 160)
    yield c.lightning(1)
    yield c.flash('#e8ecff', 0.9)
    yield c.sfx('zap')
    yield c.shake(0.6, 2)
    yield c.wait(0.5)
    yield c.sayAs('espen', at('espen', 'roof')
      ? 'It hit the rooster! The weather vane! The rod\'s still lying flat in its socket. It needs to stand UP.'
      : 'Kjell? Something just hit the roof. Hard. I think the lightning wanted a rod, and the rod was lying down.')
  } else if (miss === 'junction') {
    yield c.view('conservatory', true, CONSERVATORY.junctionX - 160)
    yield c.sfx('spark')
    yield c.flash('#9ff3ff', 0.5)
    yield c.wait(0.3)
    yield c.sfx('spark')
    yield c.flash('#9ff3ff', 0.3)
    if (!c.is(F.gustavFed)) yield c.sayAs('gustav', 'HRRMM!')
    yield c.say('The conservatory. The bolt came down the cable, jumped at the cut in the junction box, and fizzled out.')
    yield c.say('That cable has to be joined up. With something that carries electricity. Held by someone who doesn\'t.')
  } else if (miss === 'lever') {
    yield c.view('lab', true, 120)
    yield c.sfx('machine-hum')
    yield c.flash('#ffd23f', 0.25)
    yield c.wait(0.8)
    yield c.sayAs('dag', at('dag', 'lab')
      ? 'The machine hummed, then sort of sighed. The big lever still says ARM. It needs arming.'
      : 'Something just hummed and sighed in the cellar. Like me after lunch. A machine that isn\'t armed, maybe?')
  } else {
    yield c.view('lab', true, LAB.boothX - 160)
    yield c.sfx('machine-charge')
    yield c.flash('#e8d0ff', 0.6)
    yield c.sfx('booth-door')
    yield c.wait(0.6)
    yield c.sayAs('dag', at('dag', 'lab')
      ? 'The glass booth lit up like a fridge. With nobody in it. Shouldn\'t something be in the booth?'
      : 'Something in the cellar flashed. Something with a booth. An empty booth. Shouldn\'t something be in the booth?')
  }
  yield c.view(null, true)
  c.clear('midnight.fail')
  yield c.sfx('clock-tick')
  yield c.shake(0.5, 1)
  yield c.sfx('clock-wind')
  yield c.pose('scared', 0.8)
  yield c.say('And the clock shudders back to 11:59. It clicks. It sounds disappointed in me.')
  if (tries >= 3) yield c.say('Rod up, cable joined, machine armed, something in the booth. Then midnight. I\'m writing it on my paw.')
  yield c.say(c.pick(['At least I kept the key.', 'The key\'s still in my paw. Again, then. Later.', 'Fine. I\'ll keep the key. I\'m good at keeping keys.']))
  yield c.music('auto')
}

// ---------------------------------------------------------------------------
// The finale
// ---------------------------------------------------------------------------

function* finale(c: Ctx): Script {
  const LAB = lab()
  yield c.music('finale')
  // Get everyone to their posts for the split screen.
  yield c.place('espen', 'roof', ROOF.holdRod.x, ROOF.holdRod.y, 'right')
  yield c.pose('back', undefined, 'espen')
  yield c.place('dag', 'lab', LAB.dagAt.x, LAB.dagAt.y, 'right')

  // Twelve.
  yield* chimes(c, 3, 0.45)
  yield c.say('Nine… ten… eleven…')
  yield c.sfx('clock-chime')
  yield c.lightning(0.8)
  yield c.say('TWELVE!')
  yield c.solve('midnight')

  // The bolt: roof, then the cable down through the house, then the lab.
  yield c.split([{ room: 'roof', x: ROOF.socket.x }])
  yield c.pose('cheer', undefined, 'espen')
  yield c.sayAs('espen', 'Here it comes. Here it comes. HERE IT COMES!')
  yield c.lightning(1)
  yield c.flash('#ffffff', 1)
  yield c.sfx('zap')
  yield c.shake(0.7, 3)
  yield c.wait(0.5)
  yield c.split([{ room: 'roof', x: ROOF.socket.x }, { room: 'conservatory', x: CONSERVATORY.junctionX }])
  yield c.sfx('spark')
  yield c.flash('#9ff3ff', 0.8)
  yield c.lightning(0.9)
  yield c.wait(0.6)
  yield c.split([{ room: 'roof', x: ROOF.socket.x }, { room: 'conservatory', x: CONSERVATORY.junctionX }, { room: 'lab', x: LAB.paneX }])
  yield c.sfx('machine-charge')
  yield c.pose('scared', undefined, 'dag')
  yield c.flash('#ffd23f', 0.9)
  yield c.shake(1.4, 2)
  c.set(F.struck)
  yield c.wait(0.8)
  yield c.lightning(1)
  yield c.sfx('zap')
  yield c.sayAs('espen', 'IT HIT! It went down the cable! I felt it in my ears!')
  yield c.sayAs('dag', 'The machine\'s glowing. The battery\'s glowing. Is it meant to glow?')

  // The booth.
  yield c.split(null)
  yield c.view('lab', false, LAB.boothX - 160)
  yield c.pose('', undefined, 'dag')
  yield c.face('right', 'dag')
  yield c.sfx('booth-door')
  yield c.flash('#e8d0ff', 1)
  yield c.sfx('magic')
  yield c.shake(0.5, 2)
  yield c.show('cat', false)
  yield c.place('cat', null, 0, 0)
  yield c.place('professor', 'lab', LAB.prof.x, LAB.prof.y, 'left')
  yield c.show('professor', true)
  yield c.sfx('poof')
  yield c.wait(1.0)
  yield c.sfx('booth-door')
  yield c.place('professor', 'lab', LAB.profOut.x, LAB.profOut.y, 'left')
  yield c.wait(0.3)
  yield c.pose('cheer', 1.6, 'professor')
  yield c.sayAs('professor', 'Ha! HANDS! I have hands again! And thumbs! Look at these thumbs!')
  yield c.sayAs('dag', 'Hello. I\'m Dag. You were a cat.')
  yield c.sayAs('professor', 'Professor Ottilie Voltvik. Delighted. Formerly Mrs Whiskers.')
  yield c.sayAs('professor', 'In 1987 I tried my transmogrifier on myself. The target: something with nine lives. Just in case.')
  yield c.sayAs('professor', 'It worked splendidly. Far too splendidly. Thirty-nine years on top of a fridge, waiting for midnight.')
  yield c.sayAs('dag', 'The fridge hums. I noticed.')
  yield c.sayAs('professor', 'In B flat. I shall never hear B flat again without hissing.')
  yield c.sayAs('professor', 'Thank you, young rabbits. Nobody else came in thirty-nine years. Well. One plumber. He left quickly.')
  yield c.sayAs('professor', 'And I\'m keeping the monocle. It suits me better than it ever suited the cat.')
  yield c.sayAs('dag', 'You were the cat.')
  yield c.sayAs('professor', 'Exactly.')

  // The battery.
  yield c.sayAs('professor', 'Now. You came for a battery, I believe.')
  yield c.walkAs('professor', LAB.unbolt.x, LAB.unbolt.y)
  yield c.face('left', 'professor')
  yield c.pose('strain', 1.2, 'professor')
  yield c.sfx('key-turn')
  yield c.wait(0.4)
  yield c.sfx('key-turn')
  yield c.wait(0.4)
  c.set(F.batteryOut)
  yield c.sfx('thud')
  yield c.sayAs('professor', 'Fully charged, by a little over a gigawatt of Norwegian weather. It\'s heavy. You\'ll want the big one.')
  yield c.sayAs('dag', 'That\'s me.')
  yield c.walkAs('dag', LAB.carry.x, LAB.carry.y)
  yield c.face('right', 'dag')
  yield c.pose('pickup', 0.6, 'dag')
  yield c.wait(0.6)
  yield c.pose('carry', undefined, 'dag')
  yield c.sayAs('dag', 'Oof. It\'s warm. Like a friend.')
  yield c.sayAs('professor', 'Listen. The house is letting you go. It only ever wanted someone to finish the experiment.')

  // The house lets go: the stairs come down in the foyer.
  yield c.view(null, true)
  yield c.sfx('creak')
  yield c.shake(1.0, 2)
  c.set(F.stairsDown)
  yield c.sfx('thud')
  yield c.wait(0.4)
  yield c.sfx('door')
  c.set(F.frontDoorOpen)
  yield c.face('right')
  yield c.say('The stairs! They\'re unfolding! And the door\'s open!')
  yield c.walk(FOYER.kjell.x, FOYER.kjell.y - 2, false)
  yield c.pose('cheer', undefined, 'espen')
  yield c.sfx('squeak')
  yield* glide(c, 'espen', 'foyer', 340, 40, FOYER.stairsFoot.x, FOYER.stairsFoot.y, 0.7)
  yield c.pose('', undefined, 'espen')
  yield c.place('dag', 'foyer', FOYER.kitchenDoor.x + 6, FOYER.kitchenDoor.y, 'right')
  yield c.walkAs('espen', FOYER.kjell.x + 30, FOYER.kjell.y - 4, false)
  yield c.walkAs('dag', FOYER.kjell.x - 32, FOYER.kjell.y - 2, false)
  yield c.sayAs('espen', 'KJELL! DAG! I rode a chandelier! I\'ve met a bat! Episode twelve is going to be two hours long!')
  yield c.arrive('espen')
  yield c.arrive('dag')
  yield c.arrive('kjell')
  yield c.face('left', 'espen')
  yield c.face('right', 'dag')
  yield c.face('down')
  yield c.say('You\'re alive. Both of you. And Dag, is that a battery?')
  yield c.sayAs('dag', 'Fully charged. And a jar of jam, for the road. She said I could.')
  yield c.pose('cheer', 1.6)
  yield c.pose('cheer', 1.6, 'espen')
  yield c.say('I could cry. I\'m going to cry a bit. Into the rabbit suit.')
  yield c.place('professor', 'foyer', FOYER.kitchenDoor.x + 20, FOYER.kitchenDoor.y - 4, 'right')
  yield c.walkAs('professor', FOYER.kjell.x - 62, FOYER.kjell.y - 8)
  yield c.sayAs('professor', 'Well, don\'t stand there dripping on my tiles. Brunhilde is waiting.')
  yield c.say('How do you know her name?')
  yield c.sayAs('professor', 'You said it forty times tonight, dear. I was on the fridge.')

  // Out to the driveway.
  yield c.fade(1, 0.8)
  yield c.music('credits')
  c.set(CAR.state, 'open')
  c.set(CAR.x, CAR.stop)
  c.set(GATE)
  yield c.place('professor', 'driveway', SPOT.gate.x + 4, SPOT.gate.y, 'left')
  yield c.place('kjell', 'driveway', SPOT.kjell.x + 4, SPOT.kjell.y, 'left')
  yield c.place('espen', 'driveway', SPOT.espen.x + 34, SPOT.espen.y + 6, 'left')
  yield c.place('dag', 'driveway', SPOT.bonnet.x + 22, SPOT.bonnet.y + 2, 'left')
  yield c.fade(0, 0.8)
  yield c.walkAs('dag', SPOT.bonnet.x, SPOT.bonnet.y)
  yield c.pose('pickup', 0.8, 'dag')
  yield c.sfx('thud')
  yield c.wait(0.8)
  yield c.sayAs('dag', 'In she goes.')
  yield c.walkAs('kjell', SPOT.bonnet.x - 6, SPOT.bonnet.y + 8)
  yield c.pose('reach', 0.5)
  yield c.sfx('bonnet')
  c.set(CAR.state, 'dead')
  yield c.wait(0.3)
  yield c.say('Right, old girl. Your big moment.')
  yield c.walkAs('kjell', SPOT.kjell.x, SPOT.kjell.y)
  yield c.show('kjell', false)
  yield c.sfx('door')
  yield c.wait(0.4)
  yield c.sfx('key-turn')
  yield c.sfx('car-cough')
  yield c.wait(1.0)
  yield c.say('Come on…')
  yield c.sfx('car-cough')
  yield c.wait(0.9)
  yield c.sfx('car-start')
  c.set(CAR.state, 'running')
  yield c.shake(0.5, 1)
  yield c.wait(0.6)
  yield c.say('SHE\'S RUNNING! Brunhilde, you magnificent brick!')
  yield c.pose('cheer', 2, 'espen')
  yield c.pose('wave', 3, 'professor')
  yield c.sayAs('professor', 'Drive carefully! Come back for dinner. Mr Bones will get some carrots in.')
  yield c.pose('eat', 1.4, 'dag')
  yield c.sayAs('dag', 'I\'m keeping the jam.')
  yield c.sayAs('espen', 'Episode twelve: Night of the Dead Battery. Eleven listeners are going to lose their minds.')
  yield c.sfx('door')
  yield c.show('espen', false)
  yield c.show('dag', false)
  yield c.wait(0.3)
  yield c.sfx('car-horn')
  yield c.pose('wave', undefined, 'professor')
  yield* drive(c, CAR.stop, 620, 3.2)
  yield c.wait(0.6)
  yield c.sayAs('professor', 'Lovely boys. Terrible ears.')
  yield c.wait(0.4)

  // Credits.
  yield c.fade(1, 1.2)
  c.set(F.won)
  yield c.card('NIGHT OF THE DEAD BATTERY', 3.4)
  yield c.card('Kjell, Dag and Espen, in rabbit suits', 3)
  yield c.card('Villa Voltvik and everyone in it: Mr Bones, Aunt Hedvig, Gustav, Count Flapula and Professor Ottilie Voltvik', 4.2)
  yield c.card('Brunhilde appears by kind permission of Kjell, who would like her back now', 3.4)
  yield c.card('Made overnight for Petter by Claude', 3.2)
  yield c.card('Thanks for playing. Drive home safe.', 3)
  yield c.end()
}
