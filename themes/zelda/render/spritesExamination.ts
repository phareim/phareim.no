/**
 * THE EXAMINATION's pictures. The five panes of round two's board (32×32, a photo each: sky over sand, one subject)
 * are STAND-INS until they are drawn: `pane_cactus`, `pane_palm`, `pane_stone`, `pane_cloud`, `pane_bones`.
 */
type Grid = string[][]

/** One pane: the shared backdrop, then what `draw` paints on it. */
function pane(draw: (rect: (x: number, y: number, w: number, h: number, c: string) => void, oval: (cx: number, cy: number, rx: number, ry: number, c: string, edge?: string) => void) => void): string[] {
  const g: Grid = Array.from({ length: 32 }, (_, y) => Array<string>(32).fill(y < 23 ? 'b' : 'd'))
  const set = (x: number, y: number, c: string) => { if (x >= 0 && x < 32 && y >= 0 && y < 32) g[y]![x] = c }
  const rect = (x: number, y: number, w: number, h: number, c: string) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c) }
  const oval = (cx: number, cy: number, rx: number, ry: number, c: string, edge?: string) => {
    const inside = (x: number, y: number, a: number, b: number) => ((x + 0.5 - cx) / a) ** 2 + ((y + 0.5 - cy) / b) ** 2 <= 1
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (edge && inside(x, y, rx + 1, ry + 1) && !inside(x, y, rx, ry)) set(x, y, edge)
      else if (inside(x, y, rx, ry)) set(x, y, c)
    }
  }
  // The horizon and grains in the sand.
  rect(0, 22, 32, 1, 'e')
  for (const [x, y] of [[4, 26], [9, 29], [25, 27], [28, 24], [3, 30], [20, 30], [13, 25]] as const) rect(x, y, 2, 1, 'x')
  draw(rect, oval)
  return g.map(r => r.join(''))
}

export const EXAM_RAW: Record<string, string[]> = {
  pane_cactus: pane((rect) => {
    // A saguaro: a tall trunk and two raised arms, outlined, ribbed.
    const limb = (x: number, y: number, w: number, h: number) => { rect(x - 1, y - 1, w + 2, h + 2, 'k'); }
    limb(13, 5, 6, 22); limb(6, 11, 4, 8); limb(9, 16, 5, 3); limb(22, 8, 4, 8); limb(18, 13, 5, 3)
    rect(13, 5, 6, 22, 'L'); rect(6, 11, 4, 8, 'L'); rect(9, 16, 5, 3, 'L'); rect(22, 8, 4, 8, 'L'); rect(18, 13, 5, 3, 'L')
    rect(15, 6, 1, 20, 'l'); rect(7, 12, 1, 6, 'l'); rect(23, 9, 1, 6, 'l')
    rect(17, 6, 1, 20, 'F'); rect(9, 12, 1, 4, 'F'); rect(25, 9, 1, 6, 'F')
    rect(14, 3, 4, 2, 'p')
    rect(8, 27, 16, 2, 'x')
  }),
  pane_palm: pane((rect, oval) => {
    // A palm: a bent brown trunk, ringed, under a crown of long fronds.
    for (let i = 0; i < 17; i++) {
      const x = 17 - Math.round(Math.sin((i / 16) * Math.PI) * 4)
      rect(x - 1, 27 - i, 5, 1, 'k')
      rect(x, 27 - i, 3, 1, i % 3 === 0 ? 'N' : 'n')
    }
    for (const [dx, dy] of [[-1, 0], [-1, 1], [1, 0], [1, 1], [-1, -0.4], [1, -0.4]] as const) {
      for (let i = 0; i < 12; i++) {
        const x = 17 + dx * i
        const y = Math.round(9 + (dy < 0 ? dy * i : dy * ((i * i) / 14)))
        rect(Math.round(x), y, 2, 3, i % 4 === 3 ? 'T' : 't')
      }
    }
    oval(16, 11, 2, 2, 'o', 'N'); oval(20, 12, 2, 2, 'o', 'N')
    rect(10, 28, 14, 2, 'x')
  }),
  pane_stone: pane((rect, oval) => {
    // A grey boulder with a lit shoulder and a crack, a pebble by it.
    rect(4, 26, 25, 3, 'x')
    oval(15, 19, 11, 8, 'g', 'k')
    oval(12, 16, 6, 3.5, 'W')
    oval(19, 23, 7, 3, 'G')
    for (const [x, y] of [[19, 13], [18, 14], [18, 15], [17, 16], [18, 17], [19, 18], [19, 19]] as const) rect(x, y, 1, 1, 'k')
    oval(27, 26, 3, 2, 'g', 'k')
  }),
  pane_cloud: pane((rect, oval) => {
    // A white cloud on the blue, flat under.
    oval(11, 13, 6, 5, 'w', 'W'); oval(19, 10, 7, 6, 'w', 'W'); oval(24, 15, 5, 4, 'w', 'W'); oval(16, 15, 12, 4, 'w')
    rect(5, 17, 23, 2, 'W')
    rect(3, 5, 5, 1, 'W'); rect(23, 3, 6, 1, 'W')
  }),
  pane_bones: pane((rect, oval) => {
    // A skull on the sand and a bone beside it.
    oval(12, 17, 8, 7, 'w', 'k')
    rect(8, 22, 9, 5, 'w'); rect(7, 23, 1, 4, 'k'); rect(17, 23, 1, 4, 'k'); rect(8, 27, 9, 1, 'k')
    oval(9, 17, 2, 2.5, 'k'); oval(15, 17, 2, 2.5, 'k')
    rect(11, 21, 2, 2, 'k'); rect(10, 25, 1, 2, 'k'); rect(13, 25, 1, 2, 'k')
    for (let i = 0; i < 10; i++) { rect(21 + i - 2, 26 - Math.round(i * 0.8), 3, 3, 'w') }
    oval(19, 28, 2, 1.5, 'w', 'k'); oval(29, 18, 2, 1.5, 'w', 'k')
  }),
}
