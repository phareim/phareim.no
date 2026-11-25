import type { MatName, Pick, Solids } from '../props'

type Thing = (solids: Solids) => void

const spotlight: Thing = b => {
  b.box(-6, -5, 0, 6, 5, 3, 'carve')
  b.post(0, 0, 3, 34, 1.7, 'pole')
  b.box(-5, -4, 33, 5, 4, 41, 'chrome')
  b.ball(0, 4, 37, 4.3, 1.6, 3.4, 'gold')
  b.ball(0, 5.1, 37, 2.6, 1.3, 2.1, 'core')
  b.box(-6, 3, 40, 6, 8, 42, 'ink')
}

const flat: Thing = b => {
  // A paper-thin painted front, with a stepped gable and two braces visible past its east edge.
  const scenery: Pick = (x, _y, z, _nx, _ny, nz) => {
    if (nz > 0.5 || Math.abs(x) > 23) return 'ink'
    if (Math.abs(x + 8) < 5 && z > 15 && z < 24) return 'bandCyan'
    if (Math.abs(x - 11) < 4 && z > 16 && z < 25) return 'gold'
    if (Math.abs(x - 3) < 6 && z < 19) return 'pole'
    return Math.floor(z) % 6 === 0 ? 'chestWood' : 'velvet'
  }
  for (let step = 0; step < 4; step++) {
    b.box(25 - step * 5, -3 - step * 4, step * 7, 28 - step * 5, 0, step * 7 + 4, 'chestWood')
  }
  b.box(-25, -1.5, 0, 25, 1.5, 31, scenery)
  for (let i = 0; i < 10; i++) b.box(-26 + i * 2.2, -2.5, 31 + i * 1.5, 26 - i * 2.2, 2.5, 33 + i * 1.5, 'shrine')
}
const sandbags: Thing = b => {
  for (const [x, y, z] of [[-8, -2, 3], [1, 0, 3], [8, 4, 3], [-4, -1, 7]] as const) {
    b.ball(x, y, z, 6.5, 4.2, 3, (px, _py, _pz, nx) => Math.abs(px - x) > 4.5 || nx < -0.7 ? 'wood' : 'sand')
  }
  // A short coil and a loose end on the ground beside the bags.
  for (let i = 0; i < 18; i++) {
    const a = i * Math.PI / 9
    b.ball(10 + 3.7 * Math.cos(a), -7 + 3 * Math.sin(a), 1, 1.1, 1.1, 0.8, 'clay')
  }
  b.box(10, -13, 0, 11.5, -9, 1.2, 'clay')
}

const posters = [
  ['bandPink', 'pole', ['..####..', '.##..##.', '##....##', '......##', '.....##.', '....##..', '........', '....##..']],
  ['gold', 'shrine', ['...##...', '..####..', '.##..##.', '.##..##.', '.######.', '##....##', '##....##', '........']],
  ['bandCyan', 'wood', ['...##...', '..####..', '.#.##.#.', '#..##..#', '..####..', '...##...', '..#..#..', '.#....#.']],
  ['neon', 'carve', ['##....##', '###..###', '##.##.##', '##.##.##', '##....##', '##....##', '##....##', '........']],
  ['glassCyan', 'dark', ['...#....', '..###...', '.#####..', '########', '.######.', '..####..', '.#....#.', '##....##']],
  ['gold', 'blockPink', ['..####..', '.######.', '##....##', '##....##', '##.##.##', '##..###.', '.######.', '......##']],
  ['bandPink', 'chestWood', ['.##..##.', '########', '########', '.######.', '..####..', '...##...', '........', '..####..']],
  ['core', 'pole', ['########', '#..##..#', '#..##..#', '#..##..#', '#..##..#', '#..##..#', '#......#', '########']],
] satisfies Array<[MatName, MatName, string[]]>

function poster(frame: number): Thing {
  return b => {
    const [ink, paper, glyph] = posters[frame]!
    for (const x of [-11, 9]) b.box(x, -2, 0, x + 2, 2, 24, 'pole')
    b.box(-14, -2.5, 7, 14, 2.5, 32, (x, _y, z, _nx, ny) => {
      if (ny < 0.5 || Math.abs(x) >= 12 || z < 9 || z > 30) return 'chestWood'
      const ix = Math.floor((x + 12) / 3)
      const iy = Math.floor((29 - z) / 2.4)
      return glyph[iy]?.[ix] === '#' ? ink : paper
    })
  }
}

const blimp: Thing = b => {
  b.ball(0, 0, 56, 61, 29, 16, (x, y, z, nx, _ny, nz) => {
    if (Math.abs(x + y * 0.33) < 1 || Math.abs(z - 56) < 1) return 'shrine'
    if (nz > -0.2 && nx > 0.22 && Math.abs(z - 61) < 2) return 'bandPink'
    return nz > 0.25 ? 'rock' : 'chrome'
  })
  b.box(-65, -2, 50, -44, 2, 65, 'pole')
  b.box(-62, -14, 54, -48, 14, 57, 'shrine')
  for (const x of [-13, 12]) b.post(x, 0, 27, 45, 0.85, 'pole')
  b.box(-17, -7, 20, 17, 7, 31, (x, _y, z, _nx, ny) =>
    z > 24 && z < 29 && ny > 0.5 && (Math.floor((x + 16) / 4) % 2 === 0) ? 'gold' : 'wood')
  b.box(-19, -8, 30, 19, 8, 33, 'ink')
  b.box(9, 7, 21, 14, 8, 29, 'dark')
}

const gangway: Thing = b => {
  for (let step = 0; step < 12; step++) {
    const y = 18 - step * 3
    b.box(-6, y, step * 1.75, 6, y + 3, step * 1.75 + 1.5, 'wood')
    if (step % 3 === 0) for (const x of [-6, 5]) b.box(x, y, step * 1.75, x + 1, y + 1, step * 1.75 + 7, 'pole')
    for (const x of [-6, 5]) b.box(x, y, step * 1.75 + 7, x + 1, y + 3, step * 1.75 + 8.5, 'lip')
  }
}

export const FOGSTAGE_THINGS: Record<string, Thing> = {
  fogstage_spotlight: spotlight,
  fogstage_flat: flat,
  fogstage_sandbags: sandbags,
  ...Object.fromEntries(posters.map((_, frame) => [`fogstage_poster_${frame}`, poster(frame)])),
  fogstage_raincheck: blimp,
  fogstage_gangway: gangway,
}
