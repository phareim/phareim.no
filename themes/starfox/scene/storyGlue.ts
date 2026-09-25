/**
 * The story in play: story.ts's director on the game clock (paused =
 * frozen), the teaching nudges, first sightings, ambient chatter, and the
 * line on screen handed to the shell for the Intercom.
 */
import {
  controlVars, createDirector, createNudges, deathCues, meetCue, nameLine, sectorCue, sectorVars, visibleChars,
  type Director, type Skill,
} from '../story'
import { live, type Ctx } from './ctx'

export interface StoryGlue {
  readonly director: Director
  cue(key: string, vars?: Record<string, string | number>): boolean
  wing(event: string, slot: number): boolean
  meet(kind: string): void
  used(skill: Skill): void
  /** New run: launch, briefing or retry, with the callsign and squad. */
  startRun(cs: string): void
  /** A sector's opening line. */
  sector(index: number): void
  /** The player went down: Claude's last word and one wingman still up. */
  death(alive: readonly boolean[]): void
  hush(): void
  /** Claude's hello on the title screen (once per page load). */
  idle(): void
  update(dt: number): void
}

const AMBIENT_EVERY = 11

export function createStoryGlue(ctx: Ctx): StoryGlue {
  const director = createDirector({ reduced: ctx.reduced })
  const nudges = createNudges()
  let lastId = 0
  let lastShown = -1
  let ambientT = AMBIENT_EVERY
  const nudgeCtx = { flying: false, bombs: 0 }

  function emitLine() {
    const cur = director.spoken
    const id = cur?.id ?? 0
    if (id !== lastId) {
      lastId = id
      lastShown = -1
      ctx.out.intercom(cur ? { id: cur.id, who: cur.who, name: nameLine(cur.who, director.squad), text: cur.text } : null)
    }
    if (!cur) return
    const shown = ctx.reduced ? cur.text.length : visibleChars(cur, director.now)
    if (shown !== lastShown) {
      lastShown = shown
      ctx.out.intercomShown(shown)
    }
  }

  return {
    director,
    cue: (key, vars) => director.cue(key, vars),
    wing: (event, slot) => director.wing(event, slot),
    meet(kind) { director.cue(meetCue(kind)) },
    used(skill) { nudges.used(skill) },
    startRun(cs) {
      nudges.reset()
      ambientT = AMBIENT_EVERY
      director.startRun({ cs, run: ctx.runs, ...controlVars(ctx.touch), squad: ctx.squadIds } as unknown as Parameters<Director['startRun']>[0])
    },
    sector(index) {
      director.cue(sectorCue(index), sectorVars(index))
    },
    death(alive) {
      director.hush()
      for (const k of deathCues(ctx.squadIds, alive)) director.cue(k)
    },
    hush() { director.hush() },
    idle() {
      director.setVars(controlVars(ctx.touch))
      director.cue('idle')
    },
    update(dt) {
      director.tick(dt)
      if (live(ctx)) {
        nudgeCtx.flying = ctx.phase === 'travel' && !ctx.sets.rivalActive && !ctx.sets.dingoActive
        nudgeCtx.bombs = ctx.arsenal.bombs
        const key = nudges.tick(dt, nudgeCtx)
        if (key) director.cue(key)
        ambientT -= dt
        if (ambientT <= 0 && nudgeCtx.flying) {
          ambientT = AMBIENT_EVERY
          if (ctx.sector >= 2 && Math.random() < 0.3) director.cue('taunt')
          else director.cue('chatter')
        }
      }
      emitLine()
    },
  }
}
