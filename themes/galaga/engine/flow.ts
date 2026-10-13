/**
 * Space Voyagers: the run. A voyage is five sectors; a sector is a card,
 * wave 1, wave 2, the bonus run, waves 3 and 4 with the sector's event
 * running through them, and the boss (two of them in sector 5). After the
 * fifth: the ending, then the next voyage, harder, the score running on.
 */
import { BONUS, PLAYER, SCORE, SECTORS, STAGE, TALK } from './balance.ts'
import { addScore } from './combat.ts'
import { SECTOR_CUE } from './cuemap.ts'
import { startBoss } from './bosses.ts'
import { eventBusy, startEvent } from './encounters.ts'
import { maybeDuo } from './friends.ts'
import type { Stage, World } from './types.ts'
import { bonusLeft, startBonus, startWave } from './waves.ts'
import { clearDanger, cue, emit, spawnPickup } from './world.ts'

/** Go to a stage; what it begins with happens on its first tick. */
export function go(w: World, stage: Stage): void {
  w.stage = stage
  w.stageT = -1
  w.pause = 0
}

function beginSector(w: World): void {
  const def = SECTORS[w.sector - 1]!
  w.gang = def.gang
  w.wave = 0
  w.eventStarted = false
  w.duoDone = false
  w.bossIdx = 0
  w.idleT = 0
  emit(w, 'card', 0, 0, 'sector', w.sector)
  if (w.voyage > 1 && w.sector === 1) cue(w, 'voyage2')
  cue(w, SECTOR_CUE[w.sector - 1]!)
}

export function stepFlow(w: World): void {
  w.stageT++
  const first = w.stageT === 0
  const def = SECTORS[w.sector - 1]!
  switch (w.stage) {
    case 'card':
      if (first) beginSector(w)
      if (w.stageT >= STAGE.card) { w.wave = 1; go(w, 'wave') }
      break

    case 'wave':
      if (first) {
        startWave(w, def.waves[w.wave - 1]!)
        if (w.wave === 3 && !w.eventStarted) startEvent(w)
        return
      }
      if (def.duo && w.wave === 2) maybeDuo(w)
      if (++w.idleT >= TALK.idle) { w.idleT = 0; cue(w, 'idle') }
      if (w.waveLeft > 0) break
      if (w.pause === 0) {
        w.pause = STAGE.betweenWaves
        cue(w, 'waveClear')
      } else if (w.pause > 1) w.pause--
      else if (w.wave === 2) go(w, 'bonus')
      else if (w.wave < 4) { w.wave++; go(w, 'wave') } else if (!eventBusy(w)) go(w, 'boss')
      break

    case 'bonus':
      if (first) {
        clearDanger(w, 0)
        startBonus(w)
        emit(w, 'card', 0, 0, 'bonus', w.sector)
        cue(w, 'bonus.start')
        return
      }
      if (bonusLeft(w) > 0) break
      if (w.pause === 0) {
        w.pause = STAGE.betweenWaves
        if (w.bonusHits >= w.bonusTotal) {
          // PERFECT: the big bonus, and a tube for the trouble.
          addScore(w, BONUS.perfect, false)
          emit(w, 'card', 0, 0, 'perfect', BONUS.perfect)
          cue(w, 'bonus.perfect')
          spawnPickup(w, 'tube', w.w / 2, 30)
        } else cue(w, 'bonus.miss')
      } else if (w.pause > 1) w.pause--
      else { w.wave = 3; go(w, 'wave') }
      break

    case 'boss':
      if (first) {
        emit(w, 'card', 0, 0, 'boss', w.sector)
        startBoss(w, def.bosses[0]!)
        return
      }
      if (w.boss.active) break
      if (++w.bossIdx < def.bosses.length) startBoss(w, def.bosses[w.bossIdx]!)
      else go(w, 'clear')
      break

    case 'clear':
      if (first) {
        const p = w.player
        w.stats.sectorsCleared++
        addScore(w, SCORE.sector * w.sector + p.hull * SCORE.valve, false)
        if (p.hull < PLAYER.hull) { p.hull++; emit(w, 'mend', p.x, p.y, '', p.hull) }
        emit(w, 'sectorClear', 0, 0, def.name, w.sector)
        emit(w, 'card', 0, 0, 'clear', w.sector)
      }
      if (w.stageT >= STAGE.clear) {
        if (w.sector < SECTORS.length) { w.sector++; go(w, 'card') } else go(w, 'ending')
      }
      break

    case 'ending':
      if (first) {
        emit(w, 'ending', 0, 0, '', w.voyage)
        emit(w, 'card', 0, 0, 'ending', w.voyage)
      }
      if (w.stageT >= STAGE.ending) {
        // The next voyage: the same five sectors, harder. The score runs on; friends are made again.
        w.voyage++
        w.sector = 1
        w.friends.length = 0
        w.passQueue.length = 0
        w.passDue = 0
        w.noCavalrySaid = false
        emit(w, 'voyage', 0, 0, '', w.voyage)
        emit(w, 'card', 0, 0, 'voyage', w.voyage)
        go(w, 'card')
      }
      break

    case 'over':
    case 'idle':
      break
  }
}

/** For the console: how far through the voyage the run is, 0 to 1. */
export function voyageProgress(w: World): number {
  const steps = ['card', 'wave', 'wave', 'bonus', 'wave', 'wave', 'boss', 'clear']
  let i = 0
  if (w.stage === 'wave') i = w.wave <= 2 ? w.wave : w.wave + 1
  else if (w.stage === 'bonus') i = 3
  else if (w.stage === 'boss') i = 6
  else if (w.stage === 'clear') i = 7
  else if (w.stage === 'ending') return 1
  return Math.min(1, (w.sector - 1 + i / steps.length) / SECTORS.length)
}

