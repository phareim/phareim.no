import type { Pick, Solids } from '../props'

type Thing = (solids: Solids) => void

const sandstone: Pick = (x, y, z, _nx, _ny, nz) => {
  if (nz > 0.6) return Math.sin(x / 4 + y / 9) > 0.65 ? 'sand' : 'rock'
  const band = Math.floor(z + Math.sin((x + y) / 7) * 2)
  return band % 8 === 0 ? 'carve' : band % 8 < 3 ? 'shrine' : 'stone'
}

function island(size: number, lower = false): Thing {
  return b => {
    const z = lower ? 3 : 16
    const r = size * 13
    // Tapered lower fragments show the shadow gap under the plateau.
    b.ball(0, 0, z + 7, r * 0.56, r * 0.45, 7, 'shrine')
    b.ball(-r * 0.13, r * 0.08, z + 12, r * 0.83, r * 0.63, 10, sandstone)
    b.ball(r * 0.08, -r * 0.08, z + 19, r, r * 0.77, 10, sandstone)
    b.post(-3, -2, z + 25, z + 49, 2.3, 'chestWood')
    b.ball(-3, -2, z + 48, 8.5, 8, 9, 'moss')
    b.ball(-8, 1, z + 47, 5, 6, 5, 'moss')
    b.ball(2, -5, z + 51, 5.5, 5.5, 6.5, 'moss')
    for (const [x, y] of [[-7, 4], [0, 3], [4, -2]] as const) {
      b.ball(x, y, z + 29, 5, 1.7, 1.8, 'chestWood')
    }
    b.ball(1, 4.5, z + 31, 3, 2.5, 4, 'gold')
    b.ball(1.5, 5.5, z + 32, 1.2, 1, 1.6, 'core')
  }
}

function lens(direction: number): Thing {
  return b => {
    b.box(-8, -8, 0, 8, 8, 3, 'carve')
    b.box(-6, -6, 3, 6, 6, 5, 'chrome')
    b.post(0, 0, 5, 20, 2.5, 'pole')
    const side = direction % 2 === 0
    const dx = direction === 1 ? 1 : direction === 3 ? -1 : 0
    const dy = direction === 0 ? 1 : direction === 2 ? -1 : 0
    b.ball(0, 0, 22, side ? 8 : 3, side ? 3 : 8, 8, 'chrome')
    b.ball(dx * 2.5, dy * 2.5, 22, side ? 5.7 : 2, side ? 2 : 5.7, 6, 'gold')
    b.ball(dx * 3.8, dy * 3.8, 23, side ? 2.4 : 1, side ? 1 : 2.4, 2.7, 'core')
  }
}

export const STILLSAND_THINGS: Record<string, Thing> = {
  stillsand_island_small: island(1.2),
  stillsand_island_medium: island(1.8),
  stillsand_island_large: island(2.5),
  stillsand_island_lowered: island(1.8, true),
  stillsand_lens_0: lens(0),
  stillsand_lens_1: lens(1),
  stillsand_lens_2: lens(2),
  stillsand_lens_3: lens(3),
}
