import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  ROOM_W,
  ROOM_H,
  WORLD,
  buildTiles,
  validateWorld,
} from '../themes/zelda/world.ts'

function cloneWorld() {
  return structuredClone(WORLD)
}

/** Replace one char in a row string. */
function setChar(row, x, ch) {
  return row.slice(0, x) + ch + row.slice(x + 1)
}

function meadow(world) {
  return world.rooms.meadow
}

/** Rect hit test: is point (x, y) inside the portal trigger? */
function insideTrigger(p, x, y) {
  return x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h
}

/** Gap between a point and a trigger rect (0 = inside). */
function gapToTrigger(p, x, y) {
  const dx = Math.max(0, p.x - x, x - (p.x + p.w))
  const dy = Math.max(0, p.y - y, y - (p.y + p.h))
  return Math.hypot(dx, dy)
}

/** Minimal local flood fill for the alcove test (no imports from world). */
function floodTiles(room, walkable) {
  const h = room.rows.length
  const w = room.rows[0].length
  const seen = new Set()
  const start = room.entries.start
  const queue = [[Math.floor(start.x), Math.floor(start.y)]]
  while (queue.length > 0) {
    const [x, y] = queue.pop()
    const key = x + ',' + y
    if (seen.has(key)) continue
    if (y < 0 || y >= h || x < 0 || x >= w) continue
    if (!walkable(room.rows[y][x])) continue
    seen.add(key)
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
  return seen
}

describe('zelda world', () => {
  it('validates clean: validateWorld(WORLD) is empty', () => {
    assert.deepEqual(validateWorld(WORLD), [])
  })

  it('catches a wrong row length', () => {
    const broken = cloneWorld()
    meadow(broken).rows[0] += '#'
    const problems = validateWorld(broken)
    assert.ok(problems.length > 0, 'expected problems, got none')
    assert.match(problems.join('\n'), /length/)
  })

  it('catches an unknown tile char', () => {
    const broken = cloneWorld()
    meadow(broken).rows[9] = setChar(meadow(broken).rows[9], 9, 'X')
    const problems = validateWorld(broken)
    assert.ok(problems.length > 0, 'expected problems, got none')
    assert.match(problems.join('\n'), /unknown char/)
  })

  it('catches a portal to a missing room', () => {
    const broken = cloneWorld()
    meadow(broken).portals[0].toRoom = 'void'
    const problems = validateWorld(broken)
    assert.ok(problems.length > 0, 'expected problems, got none')
    assert.match(problems.join('\n'), /missing room/)
  })

  it('catches a chest on a wall', () => {
    const broken = cloneWorld()
    meadow(broken).chests[0].x = 0
    meadow(broken).chests[0].y = 0
    const problems = validateWorld(broken)
    assert.ok(problems.length > 0, 'expected problems, got none')
    assert.match(problems.join('\n'), /not on a floor tile/)
  })

  it('catches a duplicate id across rooms', () => {
    const broken = cloneWorld()
    broken.rooms.glade.enemies[0].id = 'meadow.chaser1'
    const problems = validateWorld(broken)
    assert.ok(problems.length > 0, 'expected problems, got none')
    assert.match(problems.join('\n'), /duplicate id/)
  })

  it('catches an unreachable sword', () => {
    const broken = cloneWorld()
    const rows = meadow(broken).rows
    // Ring tile (5, 5) — the sword pickup tile — with walls.
    rows[5] = setChar(rows[5], 4, '#')
    rows[5] = setChar(rows[5], 6, '#')
    rows[4] = setChar(rows[4], 5, '#')
    rows[6] = setChar(rows[6], 5, '#')
    const problems = validateWorld(broken)
    assert.ok(problems.length > 0, 'expected problems, got none')
    assert.match(problems.join('\n'), /sword.*not reachable/)
  })

  it('keeps the meadow sword within 3.5 tiles of the start entry', () => {
    const room = meadow(WORLD)
    const start = room.entries.start
    const sword = room.pickups.find((p) => p.reward.kind === 'sword')
    assert.ok(sword, 'meadow has no sword pickup')
    const dist = Math.hypot(sword.x - start.x, sword.y - start.y)
    assert.ok(dist <= 3.5, 'sword is ' + dist + ' tiles from start')
  })

  it('is 15x11 in every room and buildTiles parses row-major', () => {
    assert.equal(ROOM_W, 15)
    assert.equal(ROOM_H, 11)
    for (const room of Object.values(WORLD.rooms)) {
      assert.equal(room.rows.length, ROOM_H, room.id + ' height')
      for (const row of room.rows) assert.equal(row.length, ROOM_W, room.id + ' width')
      const tiles = buildTiles(room)
      assert.equal(tiles.length, ROOM_H)
      assert.equal(tiles[0].length, ROOM_W)
      assert.equal(tiles.flat().length, ROOM_W * ROOM_H)
      // Spot check: the meadow pot and the glade locked door survive parsing.
      if (room.id === 'meadow') assert.equal(tiles[5][7], 'o')
      if (room.id === 'glade') assert.equal(tiles[5][7], 'L')
    }
  })

  it('round-trips meadow.east without bouncing', () => {
    const east = meadow(WORLD).portals.find((p) => p.id === 'meadow.east')
    const back = WORLD.rooms.glade.portals.find((p) => p.id === 'glade.west')
    assert.ok(east && back, 'both portals exist')
    assert.equal(east.toRoom, 'glade')
    assert.equal(back.toRoom, 'meadow')
    // The glade arrival must NOT sit inside the return trigger (no bounce) …
    assert.equal(insideTrigger(back, east.toX, east.toY), false)
    // … but must be adjacent to it (a short walk back).
    assert.ok(gapToTrigger(back, east.toX, east.toY) < 1.5)
  })

  it('round-trips glade.west without bouncing', () => {
    const east = meadow(WORLD).portals.find((p) => p.id === 'meadow.east')
    const back = WORLD.rooms.glade.portals.find((p) => p.id === 'glade.west')
    assert.ok(east && back, 'both portals exist')
    assert.equal(insideTrigger(east, back.toX, back.toY), false)
    assert.ok(gapToTrigger(east, back.toX, back.toY) < 1.5)
    // The return arrival is the room's recorded entry for coming back.
    assert.deepEqual(WORLD.rooms.meadow.entries['meadow.east'], {
      x: back.toX,
      y: back.toY,
      facing: 'left',
    })
  })

  it('locks the glade alcove chest behind the L door', () => {
    const glade = WORLD.rooms.glade
    const chest = glade.chests.find((c) => c.id === 'glade.heart')
    assert.ok(chest, 'glade has no heart chest')
    const base = (ch) => ch === '.' || ch === ',' || ch === '~'
    const shut = floodTiles(glade, base)
    assert.equal(shut.has(chest.x + ',' + chest.y), false, 'chest reachable with L shut')
    const open = floodTiles(glade, (ch) => base(ch) || ch === 'L')
    assert.equal(open.has(chest.x + ',' + chest.y), true, 'chest unreachable with L open')
  })
})
