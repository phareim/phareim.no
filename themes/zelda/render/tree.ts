/**
 * The tree on the beach by the coast road. Its look says two things about
 * today: how many deploys Sleeper has run (the crown: bare, then fuller at
 * each stage) and how many different visitors came to phareim.no (the
 * fruit, one per visitor up to what the crown can hold). The portal sets
 * the counts (setTreeCounts); the renderer reads treeNow() each frame.
 * Pure apart from that one state, so tests/portal-tree.test.mjs can read it.
 */

const W = 16
const H = 32
/** Crown centre, in sprite pixels: x is fixed, y and the radii grow with the stage. */
const CX = 7.5
const CROWN: Array<{ rx: number; ry: number; cy: number } | null> = [
  null,
  { rx: 3, ry: 3, cy: 15 },
  { rx: 4.5, ry: 4.5, cy: 14 },
  { rx: 6, ry: 5.5, cy: 13 },
  { rx: 7.5, ry: 7, cy: 12 },
]
export const TREE_STAGES = CROWN.length
/** Most fruit a tree can show, whatever the visitor count. */
export const FRUIT_MAX = 12

export interface TreeCounts {
  deploys: number | null
  visitors: number | null
}

/** Deploys today → stage 0 (bare) to 4 (full). Unknown (Sleeper unreachable) → a small tree, the default look. */
export function stageFor(deploys: number | null): number {
  if (deploys === null) return 1
  if (deploys <= 0) return 0
  if (deploys <= 2) return 1
  if (deploys <= 5) return 2
  if (deploys <= 9) return 3
  return 4
}

/** Sprite rows for one stage: 16 × 32, trunk at the bottom, the crown above it. Palette letters from base/pixel/palette.ts. */
export function treeRows(stage: number): string[] {
  const grid: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'))
  // Trunk: two columns from the ground up into the crown, roots at the foot.
  for (let y = 18; y < H - 1; y++) {
    grid[y]![7] = 'n'
    grid[y]![8] = 'N'
  }
  grid[H - 1]!.fill('N', 5, 11)
  grid[H - 2]!.fill('N', 6, 10)
  const crown = CROWN[stage]
  if (!crown) {
    // Bare: two tufts at the top of the trunk.
    for (const [x, y] of [[6, 17], [7, 17], [8, 17], [9, 17], [6, 16], [9, 16]] as const) grid[y]![x] = 'L'
    return grid.map(r => r.join(''))
  }
  const inside = (x: number, y: number) => {
    const dx = (x + 0.5 - CX) / crown.rx
    const dy = (y + 0.5 - crown.cy) / crown.ry
    return dx * dx + dy * dy
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = inside(x, y)
      if (d > 1) {
        // Outline: the first pixel outside the crown, next to one inside it.
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => {
          const nx = x + ax!
          const ny = y + ay!
          return nx >= 0 && nx < W && ny >= 0 && ny < H && inside(nx, ny) <= 1
        })
        if (near) grid[y]![x] = 'k'
        continue
      }
      const lit = x + 0.5 - CX < -crown.rx * 0.3 && y + 0.5 - crown.cy < -crown.ry * 0.2 && d < 0.5
      grid[y]![x] = d > 0.6 ? 'T' : lit ? 'l' : 'L'
    }
  }
  return grid.map(r => r.join(''))
}

/** Leaf pixels a fruit can hang on: the crown's inside, not its edge or the outline. A bare tree has none. */
function leafCells(rows: string[]): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'L' || ch === 'l') cells.push([x, y]) }))
  return cells
}

/**
 * Where `count` fruit hang on this stage: a fixed order over the leaves, and
 * no two fruit touching. Fewer come back when the crown is too small.
 */
export function fruitSpots(stage: number, count: number): Array<[number, number]> {
  if (!CROWN[stage]) return []
  const rows = treeRows(stage)
  const order = leafCells(rows).sort(([ax, ay], [bx, by]) => ((ax * 31 + ay * 17) % 97) - ((bx * 31 + by * 17) % 97) || ay - by || ax - bx)
  const picked: Array<[number, number]> = []
  for (const [x, y] of order) {
    if (picked.length >= Math.min(count, FRUIT_MAX)) break
    if (picked.some(([px, py]) => Math.max(Math.abs(px - x), Math.abs(py - y)) < 3)) continue
    picked.push([x, y])
  }
  return picked
}

export interface TreeLook {
  stage: number
  /** Top-left corners of the fruit, in sprite pixels. */
  fruit: Array<[number, number]>
}

/** The sprites the renderer draws, `tree_0` … `tree_4` (merged into the sprite map in sprites.ts). */
export const TREE_RAW: Record<string, string[]> = Object.fromEntries(
  Array.from({ length: TREE_STAGES }, (_, s) => [`tree_${s}`, treeRows(s)]),
)

let counts: TreeCounts = { deploys: null, visitors: null }
let memo: { key: string; look: TreeLook } | null = null

/** The portal sets today's counts once they arrive; until then the tree has its default look. */
export function setTreeCounts(next: TreeCounts): void {
  counts = next
}

export function treeNow(): TreeLook {
  const stage = stageFor(counts.deploys)
  const count = Math.min(counts.visitors ?? 0, FRUIT_MAX)
  const key = `${stage}:${count}`
  if (memo?.key !== key) memo = { key, look: { stage, fruit: fruitSpots(stage, count) } }
  return memo.look
}
