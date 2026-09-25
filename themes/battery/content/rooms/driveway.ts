/**
 * The Driveway (outside, 480 wide): the coast road at the iron gate of
 * Villa Voltvik, the house on its cliff behind, the sea far below on the
 * left, and Brunhilde. Only the intro and the ending come here; during
 * play no hero is ever outside, but everything still answers.
 *
 * Local state the painter reads (the story sets it):
 *   driveway.car    'lit' (driving in, headlights) | 'dead' (bonnet shut,
 *                   hazards) | 'open' (bonnet up, hazards; the default) |
 *                   'running' (headlights, exhaust)
 *   driveway.car.x  Brunhilde's middle (default CAR.stop)
 *   driveway.gate   the iron gate stands open
 */
import type { GameState, RoomDef } from '../../types'
import { F } from '../flags'

export const CAR = {
  /** Flag: Brunhilde's state. */
  state: 'driveway.car',
  /** Flag: her middle x. */
  x: 'driveway.car.x',
  /** Where she dies (her middle x) and stays. */
  stop: 190,
  /** Wheels on the road (the car's ground line). */
  y: 120,
  /** Feet y for the (hidden) passengers, so their voices come from the car. */
  seatY: 122,
} as const

/** Flag: the gate stands open. */
export const GATE = 'driveway.gate'

/** Where people stand in the story. */
export const SPOT = {
  /** Out of the driver's door. */
  kjell: { x: 206, y: 130 },
  espen: { x: 176, y: 134 },
  dag: { x: 148, y: 130 },
  /** In front of the bonnet, looking in (face left). */
  bonnet: { x: 250, y: 126 },
  /** In the gateway, on the path up to the house. */
  gate: { x: 306, y: 104 },
} as const

export function carState(s: GameState): 'lit' | 'dead' | 'open' | 'running' {
  const v = s.flags[CAR.state]
  return v === 'lit' || v === 'dead' || v === 'running' ? v : 'open'
}

export function carX(s: GameState): number {
  const v = s.flags[CAR.x]
  return typeof v === 'number' ? v : CAR.stop
}

export const room: RoomDef = {
  id: 'driveway',
  name: 'Driveway',
  floor: 'outside',
  w: 480,
  walk: [
    [[0, 110], [480, 110], [480, 142], [0, 142]],
    // The gateway, up to the foot of the path.
    [[284, 98], [328, 98], [332, 112], [280, 112]],
  ],
  hotspots: [
    {
      id: 'brunhilde',
      name: 'Brunhilde',
      rect: [140, 84, 100, 38],
      at: [SPOT.bonnet.x, SPOT.bonnet.y],
      face: 'left',
      verbs: {
        look: c => c.is(F.won)
          ? 'Brunhilde, humming. A 1987 Volvo 240 estate in brick red, and the finest thing on four wheels.'
          : c.by({
            kjell: 'Brunhilde. 1987 Volvo 240 estate, brick red, roof box. Dead battery, cracked right across.',
            dag: 'Kjell\'s car. There are crisps in the glovebox. I checked earlier.',
            espen: 'Brunhilde. Kjell loves her more than he loves us. He says that isn\'t true. It\'s true.',
          }),
        open: 'The bonnet\'s up. It\'s the battery. It\'s always the battery.',
        use: 'Click. Click. Click. She needs a new heart.',
        talk: c => c.by({
          kjell: 'Hold on, girl. I\'ll find you a battery. A good one. A Swedish one, if they have it.',
          dag: 'Good car. Sorry about the seat.',
          espen: 'Brunhilde, if you can hear me, blink twice. …She blinked! Oh. Hazard lights.',
        }),
        push: 'We pushed her the last kilometre. That\'s why Dag\'s knees are muddy.',
        pickup: 'Not even Dag can lift a Volvo. He tried once, at a party.',
      },
    },
    {
      id: 'gate',
      name: 'iron gate',
      rect: [270, 56, 70, 50],
      at: [SPOT.gate.x, SPOT.gate.y + 6],
      face: 'up',
      verbs: {
        look: 'A tall iron gate, curled like a question mark. A V is worked into the top, and a lightning bolt.',
        open: 'It\'s open. It creaked like it was expecting us.',
        close: 'I\'m not shutting the only way out.',
        push: 'It swings. It creaks. It sounds amused.',
      },
    },
    {
      id: 'house',
      name: 'Villa Voltvik',
      rect: [222, 0, 230, 62],
      far: true,
      verbs: {
        look: c => c.by({
          kjell: 'Villa Voltvik. Crooked turrets, lit windows, a lightning rod. Not the sort of house that sells car batteries.',
          dag: 'Big house. Big kitchen, probably. Big pantry.',
          espen: 'Villa Voltvik. Every window lit, and nobody\'s lived there since 1987. Chills. Actual chills.',
        }),
      },
    },
    {
      id: 'sea',
      name: 'the sea',
      rect: [0, 54, 150, 44],
      far: true,
      verbs: {
        look: 'The sea, a long way down, throwing itself at the rocks. There\'s a lighthouse out there, blinking.',
        talk: 'HELLO, SEA! …It just keeps doing that.',
      },
    },
  ],
}
