/**
 * The land beyond the map's edge, as pictures (`../beyond.ts` says what is
 * there). It has no end, so it is painted a block at a time, the first time
 * a block comes into sight, by the same painters as the map itself, and the
 * blocks least lately seen are let go again.
 *
 * A block holds two pictures, as a map does: the ground, and what stands on
 * it on a clear ground. Tiles inside the map are left clear in both: the
 * map's own pictures go there.
 */
import type { MapKind, TileChar } from '../../types'
import { TILE } from '../../types'
import { makeCanvas } from '../sheet'
import { paintField } from '../tiles'

type G = CanvasRenderingContext2D

/** Tiles along a block's side. */
const BLOCK = 16
const PX = BLOCK * TILE

interface Block { base: HTMLCanvasElement; objects: HTMLCanvasElement; seen: number }

export interface Lands {
  /**
   * Lay the blocks under the window (bx, by, bw, bh; classic px, the map's
   * own origin) on `g`, whose origin is the window's corner. Returns true
   * when a block had to be painted for it (a long frame that says nothing
   * of the GPU).
   */
  draw(g: G, pass: 'base' | 'objects', bx: number, by: number, bw: number, bh: number): boolean
}

/**
 * `tile` is the field (the map inside its edge, the land beyond outside it);
 * the map is mapW × mapH tiles, and `reach` tiles of land are kept round it.
 */
export function createLands(kind: MapKind, look: string | undefined, tile: (x: number, y: number) => TileChar, mapW: number, mapH: number, reach: number, keep = 28): Lands {
  const blocks = new Map<number, Block>()
  let clock = 0
  const beyond = (x: number, y: number) => (x < 0 || y < 0 || x >= mapW || y >= mapH) && x >= -reach && y >= -reach && x < mapW + reach && y < mapH + reach

  function block(cx: number, cy: number): Block {
    const key = (cy + 512) * 4096 + cx + 512
    let b = blocks.get(key)
    if (!b) {
      b = { base: makeCanvas(PX, PX), objects: makeCanvas(PX, PX), seen: 0 }
      const x0 = cx * BLOCK
      const y0 = cy * BLOCK
      for (const pass of ['base', 'objects'] as const) {
        const g = b[pass].getContext('2d')!
        g.imageSmoothingEnabled = false
        paintField(kind, look, g, tile, beyond, x0, y0, x0 + BLOCK - 1, y0 + BLOCK - 1, x0, y0, pass)
      }
      blocks.set(key, b)
      if (blocks.size > keep) {
        let old = -1
        let oldSeen = Infinity
        for (const [k, q] of blocks) if (q.seen < oldSeen) { oldSeen = q.seen; old = k }
        if (old !== key) blocks.delete(old)
      }
    }
    return b
  }

  return {
    draw(g, pass, bx, by, bw, bh) {
      clock++
      let painted = false
      const cx0 = Math.floor(bx / PX)
      const cy0 = Math.floor(by / PX)
      const cx1 = Math.floor((bx + bw - 1) / PX)
      const cy1 = Math.floor((by + bh - 1) / PX)
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        // A block that lies wholly inside the map has nothing of its own.
        if (cx * BLOCK >= 0 && cy * BLOCK >= 0 && (cx + 1) * BLOCK <= mapW && (cy + 1) * BLOCK <= mapH) continue
        const b = block(cx, cy)
        if (b.seen === 0) painted = true
        b.seen = clock
        g.drawImage(b[pass], cx * PX - bx, cy * PX - by)
      }
      return painted
    },
  }
}
