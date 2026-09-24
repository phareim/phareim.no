/** Enemy stats and construction (no other engine imports, so no cycles). */
import type { Dir, Enemy, EnemyKind, ItemId } from '../types'

export interface EnemyStats { hp: number; r: number; dmg: number; invulnerable?: boolean; flying?: boolean }

export const STATS: Record<EnemyKind, EnemyStats> = {
  blob: { hp: 2, r: 0.38, dmg: 1 },
  spitter: { hp: 2, r: 0.4, dmg: 1 },
  sentry: { hp: 4, r: 0.4, dmg: 2 },
  bat: { hp: 1, r: 0.34, dmg: 1, flying: true },
  dasher: { hp: 2, r: 0.36, dmg: 1 },
  zapper: { hp: 3, r: 0.42, dmg: 1 },
  skull: { hp: 3, r: 0.4, dmg: 2 },
  eye: { hp: 1, r: 0.45, dmg: 0, invulnerable: true },
  blade: { hp: 1, r: 0.45, dmg: 2, invulnerable: true },
  knight: { hp: 8, r: 0.72, dmg: 2 },
  king: { hp: 16, r: 1.15, dmg: 2, flying: true },
  hound: { hp: 3, r: 0.38, dmg: 1 },
  drone: { hp: 2, r: 0.36, dmg: 1, flying: true },
  llama: { hp: 10, r: 0.8, dmg: 2 },
  mistral: { hp: 12, r: 1.1, dmg: 2, flying: true },
  deepseek: { hp: 8, r: 0.9, dmg: 2 },
  gemini: { hp: 8, r: 0.62, dmg: 2, flying: true },
}

export function spawnEnemy(
  id: string, kind: EnemyKind, x: number, y: number, dir: Dir, cell: number, once?: string, carries?: ItemId,
): Enemy {
  const st = STATS[kind]
  return {
    id, kind, x, y, r: st.r, hp: st.hp, maxHp: st.hp, dir, cell,
    invuln: 0, stun: 0, knock: null,
    ai: { mode: 'idle', t: 0.3 + ((x * 7 + y * 13) % 10) / 10, tell: 0 },
    once, carries, home: { x, y }, dead: false, flash: 0,
  }
}

export function resetEnemy(e: Enemy) {
  const st = STATS[e.kind]
  e.x = e.home.x
  e.y = e.home.y
  e.hp = st.hp
  e.dead = false
  e.invuln = 0
  e.stun = 0
  e.knock = null
  e.flash = 0
  e.ai = { mode: 'idle', t: 0.4, tell: 0 }
}
