import type { MatName, Pick, Solids } from '../props'
import { RIM, lamplight, onRim } from './nightPanes'

type Thing = (solids: Solids) => void

const spotlight: Thing = b => {
  b.box(-6, -5, 0, 6, 5, 3, 'carve')
  b.post(0, 0, 3, 34, 1.7, 'pole')
  b.box(-5, -4, 33, 5, 4, 41, 'chrome')
  b.ball(0, 4, 37, 4.3, 1.6, 3.4, 'gold')
  b.ball(0, 5.1, 37, 2.6, 1.3, 2.1, 'core')
  b.box(-6, 3, 40, 6, 8, 42, 'ink')
}

/**
 * The spotlight with a head that turns (L2), for a beam the renderer draws: `dir` in eighths of a turn clockwise
 * seen from above, `_0` east, `_1` south-east, `_2` south, … `_6` north, `_7` north-east (the fjord lighthouse's
 * quarters are `_0`, `_2`, `_4`, `_6` here). The same foot and pole as `fogstage_spotlight`; on top a yoke and a
 * round barrel tipped a little down, its lens a gold ring with a white heart on the end the light leaves by,
 * a dark cap on the other. Turned away, the ring still shows round the barrel's far end.
 */
function turningSpot(dir: number): Thing {
  const angle = (dir * Math.PI) / 4
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  return b => {
    b.box(-6, -5, 0, 6, 5, 3, 'carve')
    b.post(0, 0, 3, 32, 1.7, 'pole')
    b.post(0, 0, 32, 34, 3.4, 'chrome')
    // The yoke: two arms either side of the barrel, across the way it points.
    for (const s of [-1, 1]) {
      const yx = -dy * 5.6 * s
      const yy = dx * 5.6 * s
      b.post(yx, yy, 33, 40, 0.9, 'pole')
      b.ball(yx, yy, 38, 1.4, 1.4, 1.4, 'chrome')
    }
    b.box(-1.2, -1.2, 33, 1.2, 1.2, 34.4, 'pole')
    // The barrel, from its cap to its lens, a little lower at the front.
    for (let t = -5; t <= 3; t += 0.5) {
      b.ball(dx * t, dy * t, 38 - t * 0.18, 4, 4, 3.8, t > 2 ? 'ink' : 'chrome')
    }
    b.ball(-dx * 5.6, -dy * 5.6, 39, 2.6, 2.6, 2.6, 'ink')
    // The lens's ring stands a px proud of the barrel all round, so turned away it still shows as a lit rim.
    b.ball(dx * 4, dy * 4, 37.3, 4.7, 4.7, 4.5, 'gold')
    b.ball(dx * 6.9, dy * 6.9, 37.1, 2.4, 2.4, 2.3, 'core')
    // A visor over the lens.
    b.ball(dx * 4.6, dy * 4.6, 42, 3.4, 3.4, 0.8, 'ink')
  }
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

/**
 * A house of the Ticket Hill (art round 4): a narrow painted timber house on the 3 x 3 `H` block, its ridge running
 * north-south, so its narrow gable end faces the road, and before that end a tall stage-flat FALSE FRONT standing
 * above the roof (stepped top, braces behind it like a flat's), two upper windows, the door with a little marquee
 * canopy over it and its row of bulbs (always lit: the show has always already started). Windows on the east wall.
 * `night`: the same solids, the panes lamplight in a rim of spill light (the panes' boxes are the night build's masks).
 */
function hillHouse(night: boolean): Thing {
  const pane = (a: number, z: number, w: number, h: number): MatName => {
    if (!night) return Math.floor(a) === Math.floor(w / 2) || Math.floor(z) === Math.floor(h / 2) ? 'ink' : 'gold'
    if (onRim(a, z, w, h)) return RIM
    if (Math.floor(a) === Math.floor(w / 2)) return 'ink'
    return lamplight(a, z, w, h)
  }
  // The long wall: painted clapboards, a window on each floor at two places along it.
  const wall: Pick = (x, y, z, nx, _ny, nz) => {
    if (nz > 0.5) return 'shrine'
    if (z < 4) return 'stone'
    if (nx > 0.5) {
      for (const c of [-20, 6]) {
        for (const [z0, z1] of [[14, 26], [32, 42]] as const) {
          if (Math.abs(y - c) < 6 && z > z0 && z < z1) return pane(y - (c - 6), z - z0, 12, z1 - z0)
          if (Math.abs(y - c) < 7.4 && z > z0 - 1.4 && z < z1 + 1.4) return 'lip'
        }
      }
    }
    return Math.floor(z) % 4 === 0 ? 'wood' : 'velvet'
  }
  // The false front: painted boards, trim round its stepped top, two upper windows and the door.
  const front: Pick = (x, _y, z, _nx, ny, nz) => {
    if (nz > 0.5 || ny < 0.5) return 'chestWood'
    for (const c of [-12, 12]) {
      if (Math.abs(x - c) < 5 && z > 42 && z < 56) return pane(x - (c - 5), z - 42, 10, 14)
      if (Math.abs(x - c) < 6.4 && z > 40.6 && z < 57.4) return 'lip'
    }
    if (Math.abs(x) < 6 && z < 25) return Math.abs(x) < 0.6 ? 'ink' : 'dark'
    if (Math.abs(x) < 7.4 && z < 26.4) return 'lip'
    if (z > 64 && z < 66) return 'lip'
    return Math.floor(x + 64) % 5 === 0 ? 'blockPink' : 'clay'
  }
  return b => {
    b.box(-30, -44, 0, 30, 44, 4, 'stone')
    b.box(-24, -38, 4, 24, 34, 48, wall)
    for (let i = 0; i < 11; i++) b.box(-27 + i * 2.4, -41, 47 + i * 2, 27 - i * 2.4, 34, 49 + i * 2, (_x, _y, _z, nx, ny) => (ny > 0.5 && Math.abs(nx) < 0.5 ? 'wood' : 'shrine'))
    // The chimney, on the ridge's north end.
    b.box(-4, -30, 60, 4, -22, 76, (_x, _y, z) => (Math.floor(z) % 4 === 0 ? 'carve' : 'stone'))
    // The false front and its stepped top.
    b.box(-28, 34, 0, 28, 38, 76, front)
    b.box(-18, 34, 76, 18, 38, 86, front)
    b.box(-8, 34, 86, 8, 38, 94, front)
    b.box(-29, 38, 74, 29, 39.4, 76.4, 'lip')
    // Braces behind it, as a flat's.
    for (const x of [-20, 20]) for (let k = 0; k < 6; k++) b.box(x - 1, 30 - k * 4, 76 - k * 3.4, x + 1, 34 - k * 4, 79 - k * 3.4, 'chestWood')
    // The marquee canopy over the door and its bulbs.
    b.box(-13, 38, 26, 13, 46, 30, 'lip')
    for (let k = 0; k < 6; k++) b.ball(-11 + k * 4.4, 46.4, 27.6, 1.3, 1.3, 1.3, 'core')
    // The step before the door.
    b.box(-8, 38, 0, 8, 43, 2, 'stone')
  }
}

export const FOGSTAGE_THINGS: Record<string, Thing> = {
  fogstage_spotlight: spotlight,
  ...Object.fromEntries([...Array(8)].map((_, dir) => [`fogstage_spotlight_${dir}`, turningSpot(dir)])),
  fogstage_flat: flat,
  fogstage_sandbags: sandbags,
  ...Object.fromEntries(posters.map((_, frame) => [`fogstage_poster_${frame}`, poster(frame)])),
  fogstage_raincheck: blimp,
  fogstage_gangway: gangway,
  fogstage_house: hillHouse(false),
  fogstage_house_night: hillHouse(true),
}
