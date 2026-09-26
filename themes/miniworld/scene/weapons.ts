/**
 * Mini World's fantasy weapons (avatar/house agent): five toy bases —
 * Tryllestav, Sverd, Pipehammer, Blaster, Bue — in any colour, with the
 * magic shown at the tip (a star, a heart, a flower, a snowflake, a bolt,
 * a rainbow, bubbles, confetti or a little dragon head). Level 2 adds
 * gold bands and a gem, level 3 makes the magic glow with twinkles
 * around it; each level is bigger.
 *
 * Grip at the origin, pointing along +z; `muzzle` is where magic leaves.
 */
import * as THREE from 'three'
import type { BuildWeaponModel, WeaponModelHandle } from './contracts'
import type { Weapon, WeaponBaseId, WeaponMagicId } from '../types'
import { WEAPON_MAGIC } from '../catalog'
import { Kit, disposeTree, darken, lighten, sparkles } from './meshkit'
import { PartSet } from './clothes'

const GOLD = '#ffd23f'

/** Pixel maps for the magic motifs: a/b/c = the magic's colours, w white, k ink. */
const MOTIF: Record<WeaponMagicId, string[]> = {
  stars: ['...a...', '..aaa..', 'aaabaaa', '.aabaa.', '..aaa..', '.aa.aa.', '.a...a.'],
  hearts: ['.aa.aa.', 'aabaaaa', 'aaaaaaa', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...'],
  flowers: ['..a.a..', '.aaaaa.', 'aaabaaa', '.abbba.', 'aaabaaa', '.aaaaa.', '..a.a..'],
  snow: ['a..a..a', '.a.a.a.', '..aaa..', 'aaabaaa', '..aaa..', '.a.a.a.', 'a..a..a'],
  lightning: ['...aa', '..aa.', '.aa..', 'aaaaa', '..aa.', '.aa..', 'aa...', 'a....'],
  rainbow: ['..aaaaa..', '.abbbbba.', 'abcccccba', 'abc...cba', 'abc...cba'],
  bubbles: ['.aa..', 'awaa.', 'aaaa.', '.aa.b', '...bb'],
  confetti: ['a.b.c', '.c.a.', 'b.a.b', '.b.c.', 'c.a.a'],
  dragon: ['..a.a...', '.aaaaa..', 'aakaaaaa', 'aaaaaabw', 'aaaaaaa.', '.aa.bb..', '..b.b...'],
}

function motifPal(magic: WeaponMagicId): Record<string, string> {
  const m = WEAPON_MAGIC.find(x => x.id === magic)!
  const c = m.colors
  if (magic === 'rainbow') return { a: '#ff4f6f', b: '#ffe14f', c: '#4fb8ff' }
  if (magic === 'dragon') return { a: '#6fe07f', b: '#ff9f3f', k: '#2a2230', w: '#ffffff' }
  if (magic === 'confetti') return { a: c[0]!, b: c[2]!, c: c[4] ?? c[1]! }
  return { a: c[0]!, b: c[1] ?? '#ffffff', c: c[2] ?? '#ffffff', w: '#ffffff', k: '#2a2230' }
}

/** The motif, standing in the y/z plane (seen from the side), centred on (0, y, z). */
function motif(kit: Kit, magic: WeaponMagicId, y: number, z: number, px: number) {
  kit.voxels(MOTIF[magic], motifPal(magic), 0, y, z, px, px * 1.4, Math.PI / 2)
}

type Base = (ps: PartSet, color: string, magic: WeaponMagicId, level: 1 | 2 | 3, magicKit: Kit) => THREE.Vector3

const BASES: Record<WeaponBaseId, Base> = {
  wand(ps, color, magic, level, mk) {
    ps.vc.box(0, 0, 0.32, 0.07, 0.07, 0.86, color)
    ps.vc.box(0, 0, -0.08, 0.1, 0.1, 0.12, darken(color, 0.3))
    ps.vc.box(0, 0, 0.08, 0.09, 0.09, 0.04, lighten(color, 0.5))
    if (level >= 2) { ps.vc.box(0, 0, 0.2, 0.1, 0.1, 0.04, GOLD); ps.vc.box(0, 0, 0.6, 0.1, 0.1, 0.04, GOLD) }
    motif(mk, magic, 0, 0.9, 0.05)
    return new THREE.Vector3(0, 0, 1.0)
  },
  sword(ps, color, magic, level, mk) {
    ps.vc.box(0, 0, 0, 0.08, 0.08, 0.26, darken(color, 0.35))
    ps.vc.box(0, 0, -0.16, 0.11, 0.11, 0.08, level >= 2 ? GOLD : color)
    ps.vc.box(0, 0, 0.16, 0.42, 0.09, 0.08, level >= 2 ? GOLD : color)
    ps.vc.box(0, 0, 0.62, 0.05, 0.16, 0.84, lighten(color, 0.55))
    ps.vc.box(0, 0, 0.6, 0.06, 0.05, 0.7, WEAPON_MAGIC.find(x => x.id === magic)!.colors[0]!)
    ps.vc.cone(0, 0, 1.1, 0.09, 0.16, lighten(color, 0.55), 4, 0, { x: Math.PI / 2, y: Math.PI / 4 })
    motif(mk, magic, 0, 0.17, 0.045)
    if (level >= 2) { ps.vc.box(0.2, 0, 0.16, 0.06, 0.12, 0.1, GOLD); ps.vc.box(-0.2, 0, 0.16, 0.06, 0.12, 0.1, GOLD) }
    return new THREE.Vector3(0, 0, 1.2)
  },
  hammer(ps, color, magic, level, mk) {
    ps.vc.box(0, 0, 0.3, 0.08, 0.08, 0.8, darken(color, 0.25))
    ps.vc.box(0, 0, -0.08, 0.1, 0.1, 0.1, lighten(color, 0.4))
    ps.vc.cyl(0, 0, 0.78, 0.2, 0.5, color, 10, { z: Math.PI / 2 })
    const band = level >= 2 ? GOLD : lighten(color, 0.55)
    ps.vc.cyl(0.26, 0, 0.78, 0.21, 0.06, band, 10, { z: Math.PI / 2 })
    ps.vc.cyl(-0.26, 0, 0.78, 0.21, 0.06, band, 10, { z: Math.PI / 2 })
    for (const s of [-1, 1]) mk.voxels(MOTIF[magic], motifPal(magic), s * 0.3, 0, 0.78, 0.035, 0.04, Math.PI / 2 * s)
    return new THREE.Vector3(0, 0.24, 0.78)
  },
  blaster(ps, color, magic, level, mk) {
    ps.vc.box(0, -0.12, -0.02, 0.1, 0.28, 0.14, darken(color, 0.25), { x: -0.25 })
    ps.vc.box(0, 0.06, 0.2, 0.18, 0.2, 0.62, color)
    ps.vc.box(0, -0.06, 0.12, 0.06, 0.06, 0.14, darken(color, 0.4))
    ps.vc.cyl(0, 0.06, 0.6, 0.075, 0.26, lighten(color, 0.5), 8, { x: Math.PI / 2 })
    ps.vc.cyl(0, 0.06, 0.74, 0.09, 0.05, level >= 2 ? GOLD : '#ffffff', 8, { x: Math.PI / 2 })
    const m = WEAPON_MAGIC.find(x => x.id === magic)!
    ps.see(m.colors[0]!, 0.7).ball(0, 0.26, 0.18, 0.13, m.colors[0]!, 1)
    ps.vc.box(0, 0.17, 0.18, 0.16, 0.04, 0.16, level >= 2 ? GOLD : lighten(color, 0.4))
    motif(mk, magic, 0.2, 0.3, 0.035)
    if (level >= 2) ps.vc.box(0, 0.17, 0.44, 0.19, 0.04, 0.06, GOLD)
    return new THREE.Vector3(0, 0.06, 0.8)
  },
  bow(ps, color, magic, level, mk) {
    const R = 0.58
    const n = 9
    for (let i = 0; i < n; i++) {
      const a = -1.1 + (2.2 * i) / (n - 1)
      const y = R * Math.sin(a), z = -0.5 + R * Math.cos(a) - 0.02
      const tip = i === 0 || i === n - 1
      ps.vc.box(0, y, z, 0.08, 0.17, 0.08, tip && level >= 2 ? GOLD : i === (n - 1) / 2 ? darken(color, 0.3) : color, { x: -a })
    }
    const ty = R * Math.sin(1.1), tz = -0.5 + R * Math.cos(1.1) - 0.02
    ps.vc.box(0, 0, tz, 0.02, ty * 2, 0.02, '#ffffff')
    ps.vc.box(0, 0, 0.15, 0.03, 0.03, 0.9, '#c8905a')
    ps.vc.box(0, 0, tz + 0.04, 0.02, 0.1, 0.08, lighten(color, 0.4))
    motif(mk, magic, 0, 0.62, 0.03)
    return new THREE.Vector3(0, 0, 0.7)
  },
}

export const WEAPON_BUILDERS = BASES

export const buildWeaponModel: BuildWeaponModel = (weapon: Weapon): WeaponModelHandle => {
  const group = new THREE.Group()
  group.name = 'miniworld-weapon'
  const inner = new THREE.Group()
  const level = weapon.level
  const scale = level === 3 ? 1.3 : level === 2 ? 1.15 : 1
  inner.scale.setScalar(scale)
  group.add(inner)
  const ps = new PartSet()
  const mk = level === 3 ? ps.glowing : ps.vc
  const tip = (BASES[weapon.base] ?? BASES.wand)(ps, weapon.color, weapon.magic, level, mk)
  ps.flush(inner)
  if (level === 3) {
    const m = WEAPON_MAGIC.find(x => x.id === weapon.magic)!
    const box = new THREE.Box3(tip.clone().addScalar(-0.28), tip.clone().addScalar(0.28))
    const sp = sparkles(8, box, [...m.colors, '#ffffff'], { size: 0.16, seed: weapon.uid.length + 3 })
    sp.points.onBeforeRender = () => sp.tick(performance.now() / 1000)
    inner.add(sp.points)
  }
  const muzzle = tip.multiplyScalar(scale)
  return {
    group,
    muzzle,
    magic: weapon.magic,
    level,
    dispose() { disposeTree(group) },
  }
}
