/**
 * Neon Shrine (theme id `zelda`) — authored world data, phase 1.
 *
 * Pure data only: room tile maps, enemy/loot placements, portals with
 * explicit trigger rects and safe arrival points, chest/key/door wiring.
 * Imports only types from ./types. The engine copies the tile grid via
 * buildTiles(); validateWorld() pins the authoring rules so new rooms
 * cannot ship with broken links, spawns inside walls or unreachable loot.
 *
 * Positions are in TILE UNITS: a 15x11 room spans x 0..15, y 0..11.
 * Chest x/y are integer tile columns/rows; everything else is a float
 * centre point. See PLAN.md for the design and types.ts for the contract.
 */
import type {
  ChestPlacement,
  EnemyPlacement,
  Portal,
  Room,
  TileChar,
  World,
} from './types'

/** Phase 1 room width in tiles (informational; rooms may differ later). */
export const ROOM_W = 15
/** Phase 1 room height in tiles (informational; rooms may differ later). */
export const ROOM_H = 11

// ---------------------------------------------------------------------------
// Room maps
// ---------------------------------------------------------------------------
//
// Legend (from types.ts): '#' wall, '.' floor, ',' path (walkable, drawn as a worn trail), '~' grass,
// 'o' pot, 'T' tree, 'G' gravestone, 'W' water, 'L' locked door,
// 'B' Boss Key door, 'S' shut door.
//
// The meadow reads west -> east along row 5: spawn, sword, pot, grass,
// chaser, east portal — and that row is the authored path (',' tiles), with
// the pot standing in the road and a spur north to the small-key chest.
// Trees cluster north-west as the landmark.

const MEADOW_ROWS: string[] = [
  '###############',
  '#..TTT........#',
  '#..TT.........#',
  '#...T.......,.#',
  '#.......~~~.,.#',
  '#,,,,,,o,,,,,,,',
  '#.......~~...,,',
  '#.............#',
  '#..T..........#',
  '#.............#',
  '###############',
]

// The glade is split by an inner wall (column 7, rows 1-9) with a single
// locked door at (7, 5). Everything east of it — the heart-container chest,
// the water pool and the turret — is reachable only through that door.
// The west side carries the gravestone landmark silhouette and wanderers.

const GLADE_ROWS: string[] = [
  '###############',
  '#......#.WW...#',
  '#..G...#.WW...#',
  '#......#......#',
  '#..G...#....,.#',
  ',,,,,,,L,,,,,.#',
  ',,.....#......#',
  '#......#......#',
  '#......#......#',
  '#......#......#',
  '###############',
]

const MEADOW_ENEMIES: EnemyPlacement[] = [
  { id: 'meadow.chaser1', kind: 'chaser', x: 11, y: 5.5 },
]

const MEADOW_CHESTS: ChestPlacement[] = [
  { id: 'meadow.key', x: 12, y: 2, reward: { kind: 'smallKey' } },
]

const MEADOW_PORTALS: Portal[] = [
  {
    id: 'meadow.east',
    x: 14,
    y: 4.5,
    w: 1,
    h: 2,
    toRoom: 'glade',
    toX: 1.6,
    toY: 5.5,
    dir: 'right',
  },
]

const GLADE_ENEMIES: EnemyPlacement[] = [
  { id: 'glade.wander1', kind: 'wanderer', x: 4, y: 7.5 },
  { id: 'glade.wander2', kind: 'wanderer', x: 3, y: 3.5 },
  { id: 'glade.turret1', kind: 'turret', x: 12, y: 8.5, facing: 'left' },
]

const GLADE_CHESTS: ChestPlacement[] = [
  { id: 'glade.heart', x: 12, y: 3, reward: { kind: 'heartContainer' } },
]

const GLADE_PORTALS: Portal[] = [
  {
    id: 'glade.west',
    x: 0,
    y: 4.5,
    w: 1,
    h: 2,
    toRoom: 'meadow',
    toX: 13.4,
    toY: 5.5,
    dir: 'left',
  },
]

const MEADOW: Room = {
  id: 'meadow',
  area: 'overworld',
  name: 'THE MEADOW',
  rows: MEADOW_ROWS,
  enemies: MEADOW_ENEMIES,
  chests: MEADOW_CHESTS,
  pickups: [{ id: 'meadow.sword', x: 5, y: 5.5, reward: { kind: 'sword' } }],
  portals: MEADOW_PORTALS,
  entries: {
    start: { x: 2.5, y: 5.5, facing: 'right' },
    'meadow.east': { x: 13.4, y: 5.5, facing: 'left' },
  },
}

const GLADE: Room = {
  id: 'glade',
  area: 'overworld',
  name: 'THE GLADE',
  rows: GLADE_ROWS,
  enemies: GLADE_ENEMIES,
  chests: GLADE_CHESTS,
  pickups: [],
  portals: GLADE_PORTALS,
  entries: {
    start: { x: 1.6, y: 5.5, facing: 'right' },
    'glade.west': { x: 1.6, y: 5.5, facing: 'right' },
  },
}

/** Phase 1 content: the start room plus one test-connection room. */
export const WORLD: World = {
  rooms: { meadow: MEADOW, glade: GLADE },
  startRoom: 'meadow',
  startEntry: 'start',
}

// ---------------------------------------------------------------------------
// buildTiles
// ---------------------------------------------------------------------------

function toTile(ch: string): TileChar {
  switch (ch) {
    case '#':
      return '#'
    case '.':
      return '.'
    case ',':
      return ','
    case '~':
      return '~'
    case 'o':
      return 'o'
    case 'T':
      return 'T'
    case 'G':
      return 'G'
    case 'W':
      return 'W'
    case 'L':
      return 'L'
    case 'B':
      return 'B'
    case 'S':
      return 'S'
    default:
      throw new Error('zelda/world: unknown tile char ' + JSON.stringify(ch))
  }
}

/** Parse a room's row strings into the row-major grid the engine copies. */
export function buildTiles(room: Room): TileChar[][] {
  const tiles: TileChar[][] = []
  for (const row of room.rows) {
    const out: TileChar[] = []
    for (const ch of row) out.push(toTile(ch))
    tiles.push(out)
  }
  return tiles
}

// ---------------------------------------------------------------------------
// validateWorld
// ---------------------------------------------------------------------------

function isBaseWalkable(ch: string): boolean {
  return ch === '.' || ch === ',' || ch === '~'
}

interface WalkOpts {
  potsOpen: boolean
  doorsOpen: boolean
}

function isWalkable(ch: string | undefined, opts: WalkOpts): boolean {
  if (ch === undefined) return false
  if (isBaseWalkable(ch)) return true
  if (ch === 'o' && opts.potsOpen) return true
  if (ch === 'L' && opts.doorsOpen) return true
  return false
}

function tileAt(room: Room, x: number, y: number): string | undefined {
  if (y < 0 || y >= room.rows.length) return undefined
  const row = room.rows[y]
  if (x < 0 || x >= row.length) return undefined
  return row[x]
}

/** Tile-rect overlap: does tile (tx, ty) intersect the portal trigger? */
function triggerHitsTile(
  p: Pick<Portal, 'x' | 'y' | 'w' | 'h'>,
  tx: number,
  ty: number,
): boolean {
  return tx < p.x + p.w && tx + 1 > p.x && ty < p.y + p.h && ty + 1 > p.y
}

/**
 * Flood fill over walkable tiles across the whole world, following portals:
 * a portal whose trigger overlaps a reached tile seeds its arrival point.
 * Keys are 'room:x,y' tile coords.
 */
function flood(world: World, opts: WalkOpts): Set<string> {
  const seen = new Set<string>()
  const queue: Array<{ room: string; x: number; y: number }> = []
  const startRoom = world.rooms[world.startRoom]
  if (startRoom !== undefined) {
    const entry = startRoom.entries[world.startEntry]
    if (entry !== undefined) {
      queue.push({
        room: world.startRoom,
        x: Math.floor(entry.x),
        y: Math.floor(entry.y),
      })
    }
  }
  let guard = 100000
  while (queue.length > 0 && guard > 0) {
    guard -= 1
    const cur = queue.pop()
    if (cur === undefined) break
    const key = cur.room + ':' + cur.x + ',' + cur.y
    if (seen.has(key)) continue
    const room = world.rooms[cur.room]
    if (room === undefined) continue
    if (!isWalkable(tileAt(room, cur.x, cur.y), opts)) continue
    seen.add(key)
    queue.push({ room: cur.room, x: cur.x + 1, y: cur.y })
    queue.push({ room: cur.room, x: cur.x - 1, y: cur.y })
    queue.push({ room: cur.room, x: cur.x, y: cur.y + 1 })
    queue.push({ room: cur.room, x: cur.x, y: cur.y - 1 })
    for (const portal of room.portals) {
      if (!triggerHitsTile(portal, cur.x, cur.y)) continue
      const dest = world.rooms[portal.toRoom]
      if (dest === undefined) continue
      queue.push({
        room: portal.toRoom,
        x: Math.floor(portal.toX),
        y: Math.floor(portal.toY),
      })
    }
  }
  return seen
}

function pointTile(p: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.floor(p.x), y: Math.floor(p.y) }
}

/**
 * Validate authored world data. Returns a list of problems (empty = valid):
 * row lengths, unknown tile chars, portal links and arrival safety, entry
 * and placement walkability, duplicate ids, pot/grass on portal triggers,
 * sword reachability without crossing solids, chest reachability with the
 * one-key model, and walkable portal triggers.
 */
export function validateWorld(world: World): string[] {
  const problems: string[] = []

  if (world.rooms[world.startRoom] === undefined) {
    problems.push("startRoom '" + world.startRoom + "' does not exist")
  }
  const startRoom = world.rooms[world.startRoom]
  if (startRoom !== undefined && startRoom.entries[world.startEntry] === undefined) {
    problems.push(
      "startEntry '" + world.startEntry + "' missing in room '" + world.startRoom + "'",
    )
  }

  // Row shape and tile alphabet.
  for (const room of Object.values(world.rooms)) {
    if (room.rows.length === 0) {
      problems.push("room '" + room.id + "' has no rows")
      continue
    }
    const width = room.rows[0].length
    room.rows.forEach((row, y) => {
      if (row.length !== width) {
        problems.push(
          "room '" + room.id + "' row " + y + ' length ' + row.length + ' != ' + width,
        )
      }
      for (let x = 0; x < row.length; x += 1) {
        const ch = row[x]
        if (
          ch !== '#' &&
          ch !== '.' &&
          ch !== ',' &&
          ch !== '~' &&
          ch !== 'o' &&
          ch !== 'T' &&
          ch !== 'G' &&
          ch !== 'W' &&
          ch !== 'L' &&
          ch !== 'B' &&
          ch !== 'S'
        ) {
          problems.push(
            "room '" + room.id + "' tile (" + x + ', ' + y + ") unknown char " + JSON.stringify(ch),
          )
        }
      }
    })
  }

  // Duplicate ids across chests, pickups and enemies (one shared namespace).
  const seenIds = new Map<string, string>()
  const claimId = (id: string, where: string): void => {
    const first = seenIds.get(id)
    if (first !== undefined) {
      problems.push("duplicate id '" + id + "' (" + first + ' and ' + where + ')')
    } else {
      seenIds.set(id, where)
    }
  }

  const strictOpts: WalkOpts = { potsOpen: false, doorsOpen: false }

  for (const room of Object.values(world.rooms)) {
    const height = room.rows.length
    const width = room.rows.length > 0 ? room.rows[0].length : 0
    const inBounds = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < width && y < height

    for (const [name, entry] of Object.entries(room.entries)) {
      const t = pointTile(entry)
      if (!inBounds(t.x, t.y)) {
        problems.push(
          "room '" + room.id + "' entry '" + name + "' out of bounds (" + entry.x + ', ' + entry.y + ')',
        )
      } else if (!isBaseWalkable(tileAt(room, t.x, t.y) ?? '#')) {
        problems.push(
          "room '" + room.id + "' entry '" + name + "' is not on a walkable tile (" + entry.x + ', ' + entry.y + ')',
        )
      }
    }

    for (const e of room.enemies) {
      claimId(e.id, "enemy in room '" + room.id + "'")
      const tx = Math.floor(e.x)
      const ty = Math.floor(e.y)
      if (!inBounds(tx, ty)) {
        problems.push("enemy '" + e.id + "' out of bounds (" + e.x + ', ' + e.y + ')')
      } else if (!isBaseWalkable(tileAt(room, tx, ty) ?? '#')) {
        problems.push("enemy '" + e.id + "' is not on a walkable tile (" + e.x + ', ' + e.y + ')')
      }
    }

    for (const c of room.chests) {
      claimId(c.id, "chest in room '" + room.id + "'")
      if (!Number.isInteger(c.x) || !Number.isInteger(c.y)) {
        problems.push("chest '" + c.id + "' is not on an integer tile (" + c.x + ', ' + c.y + ')')
      } else if (!inBounds(c.x, c.y)) {
        problems.push("chest '" + c.id + "' out of bounds (" + c.x + ', ' + c.y + ')')
      } else if (!isBaseWalkable(tileAt(room, c.x, c.y) ?? '#')) {
        problems.push("chest '" + c.id + "' is not on a floor tile (" + c.x + ', ' + c.y + ')')
      }
    }

    for (const p of room.pickups) {
      claimId(p.id, "pickup in room '" + room.id + "'")
      const tx = Math.floor(p.x)
      const ty = Math.floor(p.y)
      if (!inBounds(tx, ty)) {
        problems.push("pickup '" + p.id + "' out of bounds (" + p.x + ', ' + p.y + ')')
      } else if (!isBaseWalkable(tileAt(room, tx, ty) ?? '#')) {
        problems.push("pickup '" + p.id + "' is not on a walkable tile (" + p.x + ', ' + p.y + ')')
      }
    }

    for (const portal of room.portals) {
      const dest = world.rooms[portal.toRoom]
      if (dest === undefined) {
        problems.push(
          "portal '" + portal.id + "' goes to missing room '" + portal.toRoom + "'",
        )
        continue
      }
      const destHeight = dest.rows.length
      const destWidth = dest.rows.length > 0 ? dest.rows[0].length : 0
      const atx = Math.floor(portal.toX)
      const aty = Math.floor(portal.toY)
      if (atx < 0 || aty < 0 || atx >= destWidth || aty >= destHeight) {
        problems.push(
          "portal '" + portal.id + "' arrival out of bounds (" + portal.toX + ', ' + portal.toY + ")",
        )
      } else if (!isBaseWalkable(tileAt(dest, atx, aty) ?? '#')) {
        problems.push(
          "portal '" + portal.id + "' arrival is not on a walkable tile (" + portal.toX + ', ' + portal.toY + ')',
        )
      }
    }
  }

  // No pots or grass on portal triggers (they would block or hide the exit).
  for (const room of Object.values(world.rooms)) {
    const height = room.rows.length
    const width = room.rows.length > 0 ? room.rows[0].length : 0
    for (const portal of room.portals) {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (!triggerHitsTile(portal, x, y)) continue
          const ch = tileAt(room, x, y)
          if (ch === 'o' || ch === '~') {
            problems.push(
              "portal '" + portal.id + "' trigger overlaps '" + ch + "' at (" + x + ', ' + y + ')',
            )
          }
        }
      }
    }
  }

  // Reachability, strict pass: pots, locked, boss and shut doors all solid.
  const strict = flood(world, strictOpts)
  const reachableKey = (roomId: string, x: number, y: number): boolean =>
    strict.has(roomId + ':' + x + ',' + y)

  // The sword must be reachable without crossing solids.
  for (const room of Object.values(world.rooms)) {
    for (const p of room.pickups) {
      if (p.reward.kind !== 'sword') continue
      if (!reachableKey(room.id, Math.floor(p.x), Math.floor(p.y))) {
        problems.push("sword pickup '" + p.id + "' is not reachable from the start")
      }
    }
  }

  // One-key model: a reachable small key opens 'L' doors; smashed pots ('o')
  // are walkable for the chest pass.
  let hasKey = false
  for (const room of Object.values(world.rooms)) {
    for (const p of room.pickups) {
      if (p.reward.kind === 'smallKey' && reachableKey(room.id, Math.floor(p.x), Math.floor(p.y))) {
        hasKey = true
      }
    }
    for (const c of room.chests) {
      if (c.reward.kind !== 'smallKey') continue
      if (
        reachableKey(room.id, c.x, c.y) ||
        reachableKey(room.id, c.x + 1, c.y) ||
        reachableKey(room.id, c.x - 1, c.y) ||
        reachableKey(room.id, c.x, c.y + 1) ||
        reachableKey(room.id, c.x, c.y - 1)
      ) {
        hasKey = true
      }
    }
  }
  const relaxed = flood(world, { potsOpen: true, doorsOpen: hasKey })
  const openKey = (roomId: string, x: number, y: number): boolean =>
    relaxed.has(roomId + ':' + x + ',' + y)

  for (const room of Object.values(world.rooms)) {
    for (const c of room.chests) {
      if (
        openKey(room.id, c.x, c.y) ||
        openKey(room.id, c.x + 1, c.y) ||
        openKey(room.id, c.x - 1, c.y) ||
        openKey(room.id, c.x, c.y + 1) ||
        openKey(room.id, c.x, c.y - 1)
      ) {
        continue
      }
      problems.push("chest '" + c.id + "' is not adjacent to a reachable floor tile")
    }
  }

  // Every portal trigger must overlap at least one walkable tile.
  const triggerOpts: WalkOpts = { potsOpen: true, doorsOpen: hasKey }
  for (const room of Object.values(world.rooms)) {
    const height = room.rows.length
    const width = room.rows.length > 0 ? room.rows[0].length : 0
    for (const portal of room.portals) {
      let ok = false
      for (let y = 0; y < height && !ok; y += 1) {
        for (let x = 0; x < width && !ok; x += 1) {
          if (triggerHitsTile(portal, x, y) && isWalkable(tileAt(room, x, y), triggerOpts)) {
            ok = true
          }
        }
      }
      if (!ok) {
        problems.push("portal '" + portal.id + "' trigger overlaps no walkable tile")
      }
    }
  }

  return problems
}
