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

/**
 * THE GOLD PYRAMID (world/stillsand.ts): a stepped mass of sandstone and gold over the 9 x 4 tile `H` block, the ground
 * under its middle at (45.5, 14). Five tiers, each stepping in on every side, a gold course along each tier's top edge;
 * the door to the Puzzle Lab a dark doorway in the base, in the middle of the south face (over the door tile (45, 15),
 * x -16..16, the face at y = 64), and a cluster of quartz at the apex that catches the light.
 */
const pyramid: Thing = b => {
  const tiers = 5
  for (let i = 0; i < tiers; i++) {
    const hx = 144 - i * 21
    const hy = 64 - i * 10.5
    const z0 = i * 32
    const z1 = z0 + 32
    b.box(-hx, -hy, z0, hx, hy, z1, (x, y, z, _nx, _ny, nz) => {
      if (nz > 0.6) return 'sand'
      if (z > z1 - 2.5) return 'gold'
      const course = Math.floor(z / 6.4)
      const joint = Math.floor((x + y + course * 7) / 12) % 2
      return course % 2 ? (joint ? 'stone' : 'shrine') : 'shrine'
    })
  }
  // The door: a deep dark doorway in the base, its gold lintel and jambs.
  b.box(-11, 58, 0, 11, 64.6, 26, 'dark')
  b.box(-14, 63.6, 26, 14, 66.2, 30, 'gold')
  for (const x of [-14, 11]) b.box(x, 63.6, 0, x + 3, 66.2, 26, 'gold')
  // The capstone and the quartz on it.
  b.box(-12, -6, 160, 12, 6, 166, 'gold')
  for (const [x, y, h, r] of [[0, 0, 30, 6], [-8, 2, 18, 3.6], [7.5, -1, 21, 3.8], [3, 4.5, 13, 2.6]] as const) {
    const n = Math.round(h / 2)
    for (let k = 0; k < n; k++) {
      const s = r * (1 - k / n) + 0.4
      b.box(x - s, y - s, 166 + (k * h) / n, x + s, y + s, 166 + ((k + 1) * h) / n, (_x, _y, _z, nx) => (nx > 0.5 ? 'glassViolet' : k === 1 ? 'core' : 'glassRose'))
    }
  }
}

/**
 * THE RIBS (art round 4): one rib pair of the stone bird's ribcage the Bone Road runs under, `span` tiles from foot to
 * foot north-south, arching over the road: two curved bones, bleached and sand-scoured, rising from sand drifts at the
 * ground and meeting at the top in a vertebra of the spine, which runs 2 tiles east-west, so the pairs set 2 tiles apart
 * along the road join into one backbone. The big pair (8 tiles) stands mid-cage, the small (6) at its two ends.
 */
function ribs(span: number): Thing {
  const half = span * 16
  const top = span * 16
  const bone: Pick = (x, y, z, _nx, _ny, nz) => {
    // Sand-scoured grooves along the bone, a crack now and then; sand settled where it faces up.
    if (nz > 0.75 && Math.sin(y / 3 + x) > 0.4) return 'sand'
    if (Math.floor(z + y * 0.3 + 64) % 9 === 0) return 'carve'
    return 'chrome'
  }
  return b => {
    for (const side of [-1, 1]) {
      // The rib: an arc from its foot up and in to the spine, thicker at the foot, a slight outward bulge.
      const n = 64
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * (Math.PI / 2)
        const y = side * half * Math.cos(t) * (1 + 0.08 * Math.sin(2 * t))
        const z = 4 + (top - 4) * Math.sin(t)
        const r = 5.2 - 1.6 * (i / n)
        b.ball(0, y, z, r * 1.5, r, r, bone)
      }
      // A hooked spur on the rib's back (a bird's rib has one), two thirds of the way up.
      const t = 0.62
      const sy = side * half * Math.cos(t) * (1 + 0.08 * Math.sin(2 * t))
      const sz = 4 + (top - 4) * Math.sin(t)
      for (let k = 0; k < 6; k++) b.ball(-6 - k * 2.2, sy - side * k * 0.6, sz - k * 1.6, 2.4 - k * 0.25, 2.2, 2.2, bone)
      // A drift of sand banked against the foot.
      b.ball(0, side * (half + 2), 1.5, 9, 7, 3.4, 'sand')
    }
    // The vertebra: a knuckled block of spine running east-west, a ridge of short spikes along its top.
    for (let x = -30; x <= 30; x += 3) b.ball(x, 0, top + 2, 5, 6, 5.5, bone)
    for (let k = 0; k < 4; k++) {
      const x = -22.5 + k * 15
      b.ball(x, 0, top + 2, 7, 8.5, 7, bone)
      b.ball(x + 1, 0, top + 9, 2.6, 2.4, 5, bone)
    }
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
  stillsand_pyramid: pyramid,
  stillsand_ribs: ribs(8),
  stillsand_ribs_small: ribs(6),
}
