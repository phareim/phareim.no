import type { FrontierCreature } from '../../frontierSprites'
import type { MatName, Pick, Solids } from '../props'
import { RERUN_THINGS } from './rerun'
import { SPORELIGHT_THINGS } from './sporelight'

type Thing = (solids: Solids) => void

function turned(b: Solids): Solids {
  const rotate = (pick: Pick): Pick => typeof pick === 'string' ? pick :
    (x, y, z, nx, ny, nz) => pick(-x, -y, z, -nx, -ny, nz)
  return {
    ball: (x, y, z, rx, ry, rz, pick) => b.ball(-x, -y, z, rx, ry, rz, rotate(pick)),
    post: (x, y, z0, z1, r, pick) => b.post(-x, -y, z0, z1, r, rotate(pick)),
    box: (x0, y0, z0, x1, y1, z1, pick) => b.box(-x1, -y1, z0, -x0, -y0, z1, rotate(pick)),
  }
}

function beetle(step: number): Thing {
  return b => {
    const bark: Pick = (x, y, z) => {
      if (Math.abs(x) < 0.8) return 'ink'
      if ((Math.floor(y + x * 0.34) & 3) === 0 && z > 10) return 'lip'
      return 'chestWood'
    }
    for (const x of [-1, 1]) for (const y of [-5, 0, 6]) {
      b.ball(x * 7.5, y + (step ? 1 : -1) * x, 3, 3.8, 1.65, 2.3, 'wood')
    }
    b.ball(0, -1, 7.8, 7.1, 9.8, 6.3, bark)
    b.ball(0, 7.6, 5.8, 4.5, 4.4, 3.8, 'ink')
    for (const x of [-3.1, 3.1]) {
      b.ball(x, 11, 6.6, 0.9, 0.85, 1, 'bandCyan')
      b.ball(x * 1.45, 11.6, 4.8, 1.1, 3.1, 1.3, 'lip')
    }
  }
}

function hopper(step: number): Thing {
  return b => {
    const z = step ? 8 : 0
    const vein: Pick = (x, y, h) => {
      const d = Math.abs(h - z - 7 - Math.sin((x - y) / 4) * 3)
      return d < 1 ? 'glassCyan' : d < 2.5 ? 'bandCyan' : 'stone'
    }
    b.ball(0, 0, z + 7, 8, 7, 7, vein)
    b.ball(-3.6, -3.4, z + 12, 4, 3.2, 5.5, vein)
    b.ball(3.5, 3, z + 7, 5.6, 4, 6, vein)
    for (const x of [-3.4, 3.4]) b.ball(x, 6.4, z + 6.3, 0.9, 0.65, 0.85, 'core')
  }
}

function halfBoat(size: number, row: boolean, strand = false): Thing {
  return b => {
    const stern = strand ? -3 : 0
    b.ball(0, 0, 3 * size, 6.5 * size, 11.5 * size, 3 * size, 'wood')
    b.box(-5.4 * size, -8 * size, 4 * size, 5.4 * size, -6 * size, 7.2 * size, 'lip')
    for (const x of [-4, 0, 4]) b.box(x * size, -8 * size, 5 * size, (x + 1.5) * size, -5 * size, 8.7 * size, 'chestWood')
    b.ball(0, stern, 13 * size, 5.2 * size, 4 * size, 7.6 * size, 'shrine')
    b.ball(0, 2 * size, 21 * size, 4.8 * size, 4.1 * size, 5.5 * size, 'moss')
    for (const [x, y, h] of [[-4, 1, 3.4], [4, 0, 2.5], [-3, -3, 3.7]] as const) {
      b.ball(x * size, y * size, 20 * size, 1.5 * size, 1.9 * size, h * size, 'moss')
    }
    for (const x of [-2.3, 2.3]) b.ball(x * size, 5.4 * size, 21.4 * size, 1.05 * size, 0.9 * size, 1 * size, 'glassCyan')
    if (size > 1) b.box(-3.8 * size, 4.4 * size, 23.5 * size, 3.8 * size, 5.5 * size, 25.4 * size, 'gold')
    const side = row ? 1 : -1
    for (let i = 0; i < 6; i++) {
      const x = side * (2.8 + i * 2)
      b.ball(x * size, (i - 2) * size, (13 - i * 1.3) * size, (i === 5 ? 2.6 : 1.6) * size, 1.2 * size, 0.9 * size, 'wood')
    }
  }
}

function nokk(eyesOnly: boolean, step: number): Thing {
  return b => {
    b.ball(0, 0, 0.6, 9, 7, 0.6, 'shrine')
    if (!eyesOnly) {
      b.ball(0, -1, 4, 6.4, 8.7, 4.5, 'moss')
      b.ball(0, 2, 9 + step, 3.5, 4, 8, 'stone')
      b.ball(0, 6, 15 + step, 4, 5.2, 4.3, 'chrome')
      b.ball(0, 9, 13 + step, 3, 4, 2.1, 'carve')
      for (const x of [-2.7, 2.7]) b.ball(x, 4.7, 18 + step, 1, 1.1, 2, 'pole')
    }
    for (const x of [-2.7, 2.7]) b.ball(x, eyesOnly ? 1.1 : 7.7, eyesOnly ? 2 : 16 + step, 1.2, 0.8, 0.85, 'glassCyan')
  }
}

function bird(size: number, pose: string, step: number): Thing {
  return b => {
    const airborne = pose === 'fly' || pose === 'dive'
    const z = airborne ? 12 + step * 4 : 0
    const edge: Pick = (x, y, h, _nx, _ny, nz) => (Math.floor((x - y) * 0.6 + h) & 7) < 2 ? 'carve' : nz > 0.4 ? 'chrome' : 'rock'
    b.ball(0, 0, (z + 10) * size, 6.5 * size, 9.1 * size, 7 * size, edge)
    b.ball(0, 6.6 * size, (z + 16) * size, 4.1 * size, 4.7 * size, 4.6 * size, 'stone')
    b.ball(0, 10.9 * size, (z + 14.5) * size, 2.9 * size, 3.8 * size, 1.6 * size, 'gold')
    const eye = pose === 'blind' ? 'chrome' : 'bandCyan'
    for (const x of [-2.7, 2.7]) b.ball(x * size, 9.4 * size, (z + 16.7) * size, 1.1 * size, 0.75 * size, 0.95 * size, eye)
    for (const sign of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const wing = airborne ? 5 + i * 3.6 : 5 + i * 0.68
        const featherY = airborne ? -1 - i * 0.8 : -1 - i * 1.6
        b.ball(sign * wing * size, featherY * size, (z + (airborne ? 12 + i * (pose === 'dive' ? -1.05 : 0.65) : 9)) * size,
          (airborne ? 4 : 3.3) * size, (5.4 - i * 0.55) * size, (2.6 - i * 0.26) * size, edge)
      }
      if (!airborne) b.box((sign * 2.8 - 1.2) * size, 1 * size, 0, (sign * 2.8 + 1.2) * size, 4 * size, 4.5 * size, 'carve')
    }
    if (size > 1) b.ball(0, 8.5 * size, (z + 8.6) * size, 2.5 * size, 1.5 * size, 3.1 * size, pose === 'quartz' ? 'core' : 'gold')
  }
}

const lawnFoe = (name: 'mowermob' | 'flamingomob' | 'mailboxmob', step: number): Thing => b => {
  if (name === 'mowermob') {
    RERUN_THINGS.rerun_lawnmower!(b)
    b.box(-4.5, 5, 5.1, 4.5, 9 + step, 7.1, 'bandPink')
    b.box(-2.4, 7.5, 4, 2.4, 9.3, 5.9, 'pole')
  } else if (name === 'mailboxmob') {
    RERUN_THINGS.rerun_mailbox!(b)
    b.box(4.1, -3.6, 21 + step, 7.9, 3.6, 25.2 + step, 'pole')
    for (const y of [-2, 0, 2]) b.box(7.1, y, 20.6 + step, 8, y + 0.7, 22.4 + step, 'chrome')
    b.ball(4.1, 4.3, 25.5, 1.2, 0.8, 0.9, 'glassPink')
  } else {
    for (const [x, y, h] of [[-5, 1, 0], [1, -5, 1], [5, 4, 0]] as const) {
      b.post(x, y, 0, 6, 0.6, 'sand')
      b.ball(x, y, 7 + h, 3.9, 2.8, 2.3, 'velvet')
      b.ball(x + 2.5, y + 1.2, 10 + h + step, 1.15, 1.1, 3.5, 'bandPink')
      b.ball(x + 3.5, y + 1.4, 13 + h + step, 1.8, 1.5, 1.5, 'velvet')
      b.box(x + 4, y + 1, 12.7 + h + step, x + 6, y + 1.7, 13.5 + h + step, 'gold')
    }
  }
}

export function grok(pose: string, step: number): Thing {
  return b => {
    const open = pose === 'dazed'
    const drilling = pose === 'drill'
    const rings = drilling ? 6 : pose === 'ram' ? 4 : 3
    const advance = pose === 'roll' ? 2 : 0
    for (const x of [-18, 18]) {
      b.box(x - 6, -16, 0, x + 6, 14, 10, (px, y, _z, _nx, _ny, nz) =>
        nz > 0.5 || (Math.floor(px + y + step * 2 + advance) & 5) === 0 ? 'carve' : 'pole')
      for (const y of [-10, -3, 5, 11]) b.ball(x, y + advance, 5, 6.2, 4.7, 5.1, 'chrome')
    }
    b.ball(0, -2, 19, 16, 18, 15, (x, y, z) => {
      if (z < 17 && Math.abs(x) > 11 && Math.floor((y + 16) / 3) % 2 === 0) return open ? 'bandPink' : 'carve'
      return z > 27 ? 'chrome' : 'stone'
    })
    b.box(-12, 9, 12, 12, 16, 26, 'shrine')
    b.box(-10.5, 15.4, 18, -4.5, 18, 23, open ? 'gold' : 'glassCyan')
    b.box(4.5, 15.4, 18, 10.5, 18, 23, open ? 'gold' : 'glassCyan')
    b.ball(0, 19 + advance, 10, 12, pose === 'ram' ? 8.1 : 5.2, 7.2, 'chrome')
    for (let i = 0; i < rings; i++) {
      const r = 8.2 - i * 1.05
      const x = Math.sin(i + step) * (drilling ? 2.1 : 0.85)
      b.ball(x, 20 + advance + i * (drilling ? 3.65 : 2.2), 10, r, 2.8, r * 0.77,
        drilling && i % 3 === 1 ? 'bandPink' : i % 2 ? 'rock' : 'chrome')
    }
    for (const x of [-13.5, 13.5]) b.ball(x, 14.8, 12, 1.5, 1.05, 2, 'gold')
    if (open) for (const x of [-10, 10]) b.box(x - 1, -6, 27, x + 1, 0, 33, 'bandPink')
  }
}

function phi(pose: string, step: number): Thing {
  return b => {
    const head = 24
    for (let i = 0; i <= head; i++) {
      const a = i * 0.415 + step * 0.35
      const radius = 4 + i * 0.83
      const height = pose === 'eat' ? 5 + i * 0.5 : 7 + Math.sin(i * 0.3) * 3 + i * 0.25
      const r = i === head ? 6.5 : 3 + i * 0.084
      const color: MatName = i === 13 && pose === 'lit' ? 'glassCyan' : i % 3 === 0 ? 'gold' : 'clay'
      const x = Math.cos(a) * radius
      const y = Math.sin(a) * radius
      b.ball(x, y, height, r, r, r * 0.9, color)
      if (i === head) {
        for (const dx of [-2.2, 2.2]) b.ball(x + dx, y + r * 0.83, height + 1.3, 1.25, 0.9, 1, 'core')
      }
    }
  }
}

function mixtral(pose: string, step: number): Thing {
  return b => {
    b.ball(0, 0, 13, 24, 15, 13, 'stone')
    b.ball(-13, -6, 24, 9, 12, 6, 'moss')
    b.ball(12, 1, 22, 10, 10, 5, 'moss')
    const eye = pose === 'left' ? -1 : pose === 'right' ? 1 : 0
    for (const s of [-1, 0, 1]) {
      const z = 31 - Math.abs(s) * 5 + (s === eye ? step * 2 : 0)
      const x = s * 14
      b.ball(x, 4, z, 9, 9, 10, 'rock')
      b.ball(x, 1, z + 5, 7.8, 8.2, 5.6, 'moss')
      b.ball(x + 1.2, 12.5, z - 1, 2.7, 3.8, 2.8, 'carve')
      for (const dx of [-3.6, 3.6]) b.ball(x + dx, 11.4, z + 0.4, 2.1, 1.55, 1.6, 'pole')
      if (s === eye) b.ball(x + 2.5, 13.0, z + 0.8, 2.0, 1.7, 1.7, 'gold')
    }
  }
}

function bloom(pose: string, step: number): Thing {
  return b => {
    const lower = pose === 'kneel' ? 10 : 0
    for (const x of [-8, 8]) b.ball(x, step ? 3 : -3, 3.5, 5, 6, 3.5, 'moss')
    b.ball(0, 0, 21 - lower * 0.6, 17, 13, 19 - lower * 0.6, 'moss')
    b.ball(0, 2, 39 - lower, 10.6, 8.5, 10, 'moss')
    for (const x of [-17, 17]) b.ball(x, 2, 18 - lower * 0.55, 6.6, 6.8, 13, 'moss')
    for (const x of [-4, 4]) b.ball(x, 9.6, 40 - lower, 1.4, 1.0, 1.2, 'glassCyan')
    for (const [x, y, z] of [[-7, 0, 47], [5, -1, 48], [13, -4, 31], [-13, 1, 35]] as const) {
      b.ball(x, y, z - lower, 5, 5.8, 3, 'bandPink')
      b.ball(x, y, z + 2.5 - lower, 1.5, 1.6, 1.2, 'gold')
    }
    if (pose !== 'calm') {
      b.box(9, 10, 21 - lower * 0.5, 12, 16, 25 - lower * 0.5, 'chrome')
      b.box(8, 15, 20 - lower * 0.5, 13, 17, 26 - lower * 0.5, 'pole')
    }
    if (pose === 'ring') {
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6
        b.ball(Math.cos(a) * 26, Math.sin(a) * 26, 3, 3, 3, 3, i % 2 ? 'bandPink' : 'bandCyan')
      }
    }
  }
}

function bard(pose: string, step: number): Thing {
  return b => {
    const mouth = pose === 'sing' ? 17 : pose === 'dazed' ? 6 : 11
    for (const x of [-10, 10]) b.box(x - 4, -5 + step, 0, x + 4, 5 + step, 11, 'ink')
    b.box(-18, -10, 9, 18, 10, 43, 'chestWood')
    b.box(-15, 9, 13, 15, 11, 41, 'gold')
    b.box(-13, 10, 16, 13, 12, 38, 'velvet')
    b.box(-9, 11, 18, 9, 13, 18 + mouth, 'dark')
    for (const x of [-10.5, 9]) b.box(x, 12, 18, x + 1.5, 13.8, 38, 'blockPink')
    for (const x of [-5.5, 5.5]) b.ball(x, 13.3, 34.5, 1.85, 1.1, 2, pose === 'dazed' ? 'chrome' : 'bandPink')
    for (const x of [-16, 16]) {
      b.post(x, -5, 40, 47, 0.85, 'gold')
      b.ball(x, -5, 48, 1.7, 1.8, 1.9, 'gold')
    }
  }
}

function copilot(pose: string): Thing {
  return b => {
    RERUN_THINGS.rerun_station_wagon!(b)
    const signal: MatName = pose === 'neon' ? 'glassPink' : pose === 'rust' ? 'wood' : 'gold'
    b.box(22.5, -6.9, 7, 24, 6.9, 9, 'pole')
    for (const y of [-5.6, 5.6]) b.box(23, y - 1.35, 8, 24.5, y + 1.35, 10.4, signal)
    b.box(-1.8, 7.5, 13, 4.5, 8.3, 18, 'sand')
    b.box(-0.4, 8.2, 14.6, 1, 8.8, 16.8, 'chestWood')
    if (pose === 'honk') for (const y of [-7, 0, 7]) b.ball(29, y, 7.2, 1.5, 0.9, 1.2, 'bandCyan')
    if (pose === 'neon') b.box(-19, 8, 8.5, 21, 8.7, 9.7, 'bandPink')
    if (pose === 'rust') {
      b.box(10, -6.4, 10.9, 20, 7.4, 11.3, (x, y) =>
        (Math.floor(x * 2 + y) * 5 & 7) < 3 ? 'clay' : 'chestWood')
      for (const x of [-15, -5, 15]) b.box(x, 8, 5.5, x + 3, 8.3, 7.4, 'chestWood')
    }
  }
}

export function creaturePose(name: FrontierCreature, back: boolean, step: number, pose = ''): Thing {
  const frame = (() => {
    switch (name) {
      case 'timberbeetle': return beetle(step)
      case 'orehopper': return hopper(step)
      case 'draug': return halfBoat(0.9, step === 1)
      case 'nokk': return nokk(pose === 'eyes', step)
      case 'stonebird': return bird(1, pose || 'perch', step)
      case 'grazer': return SPORELIGHT_THINGS[`sporelight_grazer_${pose.startsWith('angry') ? 'angry' : 'calm'}_${pose === 'angryb' ? 1 : step}`]!
      case 'mowermob': case 'flamingomob': case 'mailboxmob': return lawnFoe(name, step)
      case 'grok': return grok(pose, step)
      case 'phi': return phi(pose, step)
      case 'mixtral': return mixtral(pose, step)
      case 'orca': return halfBoat(1.7, pose === 'row' || step === 1, pose === 'strand')
      case 'falcon': return bird(1.8, pose || 'perch', step)
      case 'bloom': return bloom(pose, step)
      case 'bard': return bard(pose, step)
      case 'copilot': return copilot(pose)
    }
  })()
  return back ? b => frame(turned(b)) : frame
}
