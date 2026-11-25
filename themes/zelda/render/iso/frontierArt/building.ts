import type { MatName, Pick, Solids } from '../props'

type Thing = (solids: Solids) => void

function block(surface: Pick): Thing {
  return b => b.box(-16, -16, 0, 16, 16, 32, surface)
}

const dirt: Pick = (x, y, z, _nx, _ny, nz) => {
  const grain = (Math.floor(x * 3 + y) * 17 ^ Math.floor(z + y * 3) * 13) & 15
  return grain < 2 ? 'wood' : (nz > 0.5 || z > 22) && grain > 8 ? 'clay' : 'chestWood'
}

const sand: Pick = (x, y, z, nx, _ny, nz) => {
  const along = nx > 0.5 ? y : x
  const ripple = nz > 0.5 ? y + Math.sin(x / 5) * 2 : z + Math.sin(along / 8) * 1.5
  return Math.floor(ripple + 24) % 7 === 0 ? 'clay' : 'sand'
}

const stone: Exclude<Pick, MatName> = (x, y, z, nx, _ny, nz) => {
  const along = nx > 0.5 ? y : x
  if (nz < 0.5 && Math.floor(z + ((Math.floor(along / 10) & 1) ? 2 : 0)) % 9 === 0) return 'carve'
  if (nz > 0.5 && Math.floor(y - x * 0.25 + 50) % 13 === 0) return 'carve'
  return 'stone'
}

const timber: Pick = (x, y, z, nx, _ny, nz) => {
  const grain = nz > 0.5 ? y + 16 : nx > 0.5 ? z + y / 4 : z
  if (Math.floor(grain) % 8 === 0) return 'ink'
  return Math.floor(grain) % 8 === 1 ? 'lip' : 'wood'
}

function ore(core: MatName, rim: MatName, seam: number): Pick {
  return (x, y, z, nx, ny, nz) => {
    const along = ny > 0.5 ? x : y
    const height = nz > 0.5 ? x - y * 0.3 : z - along * 0.45
    const offset = Math.abs(height - seam - Math.floor(along / 5) % 3)
    const shard = ((Math.floor(along + 32) * 13 ^ Math.floor(height) * 7) & 7)
    if (offset < 1.5 && shard < 5) return core
    if (offset < 3 || (offset < 6 && shard === 3)) return rim
    return stone(x, y, z, nx, ny, nz)
  }
}

function slope(surface: Pick, steps: number): Thing {
  return b => {
    const run = 32 / steps
    for (let i = 0; i < steps; i++) {
      const y = 16 - (i + 1) * run
      b.box(-16, y, 0, 16, y + run, (i + 1) * run, surface)
    }
  }
}

const bridge: Thing = b => {
  for (let x = -11; x <= 11; x += 22) b.box(x - 1.5, -16, 0, x + 1.5, 16, 2, 'ink')
  for (let y = -16; y < 16; y += 4) b.box(-16, y + 0.35, 2, 16, y + 4, 4, timber)
}

const door: Thing = b => {
  b.box(-12, -2, 0, 12, 2, 28, timber)
  for (const x of [-13, 10]) b.box(x, -3, 0, x + 3, 3, 31, 'ink')
  b.box(-13, -3, 28, 13, 3, 32, 'lip')
  for (const z of [6, 22]) {
    b.box(-11, 2, z, -5, 3, z + 2, 'chrome')
    b.box(-10, 3, z, -8, 4, z + 2, 'pole')
  }
  b.box(6, 2, 13, 9, 4, 16, 'gold')
}

const lamp: Thing = b => {
  b.box(-4, -4, 0, 4, 4, 3, 'stone')
  b.post(0, 0, 3, 23, 1.3, 'pole')
  b.post(0, 0, 11, 13, 2, 'gold')
  b.box(-4, -4, 21, 4, 4, 23, 'chrome')
  b.box(-3.5, -3.5, 23, 3.5, 3.5, 29, 'pole')
  b.box(-3, -3.6, 24, 3, 3.6, 28, 'glassCyan')
  b.box(-3.6, -3, 24, 3.6, 3, 28, 'glassCyan')
  b.box(-4.5, -4.5, 29, 4.5, 4.5, 31, 'chrome')
}

export const BUILDING_THINGS: Record<string, Thing> = {
  building_dirt: block(dirt),
  building_sand: block(sand),
  building_stone: block(stone),
  building_timber: block(timber),
  building_lumen: block(ore('glassCyan', 'bandCyan', 10)),
  building_chrome: block(ore('chrome', 'rock', 12)),
  building_sunstone: block(ore('gold', 'clay', 13)),
  building_stone_ramp: slope(stone, 32),
  building_timber_ramp: slope(timber, 32),
  building_stone_stairs: slope(stone, 4),
  building_timber_stairs: slope(timber, 4),
  building_bridge: bridge,
  building_lamp: lamp,
  building_door: door,
}
