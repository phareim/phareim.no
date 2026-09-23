import type { ChapterId, CutId, Game, Input, ShoreSave, World } from '../types'
import { stepActors, touchThings } from './actors'
import { buildChapter, scriptOwnsPlayer, stepScript } from './levels'
import { latchInput, resetControls, stepPlayer } from './player'
import { DEATH_TIME, FIXED_STEP, GRAVITY, MAX_FALL, MAX_FRAME_DT, emit } from './util'

// The crossing as a whole: cuts between chapters, the death vignette and
// the hard cut back to the last lamp, the play clock, and the save.
// Deterministic: same inputs, same world.

export const CUT_LENGTH: Record<CutId, number> = {
  prologue: 23,
  card: 2.4,
  capture: 6.5,
  ending: 27,
}

export const NONE: Input = { left: false, right: false, up: false, down: false, action: false }

function substep(world: World, input: Input, h: number): void {
  const p = world.player

  if (world.dying) {
    // The vignette: no control, the world goes on. A fall keeps falling.
    world.dying.t += h
    if (world.dying.cause === 'fall') {
      p.vy = Math.min(p.vy + GRAVITY * h, MAX_FALL)
      p.y += p.vy * h
    }
    stepActors(world, h, false)
    return
  }

  if (scriptOwnsPlayer(world)) {
    stepScript(world, input, h)
    stepActors(world, h, true)
    return
  }

  stepPlayer(world, input, h)
  const cause = stepActors(world, h, true)
  if (cause) {
    die(world, cause)
    return
  }
  if (p.y > world.killY) {
    die(world, 'fall')
    return
  }
  touchThings(world)
  stepScript(world, input, h)
}

function die(world: World, cause: import('../types').DeathCause): void {
  const p = world.player
  world.dying = { cause, t: 0 }
  p.vx = 0
  p.holdT = 0
  p.mantle = null
  if (cause !== 'fall') p.vy = 0
  emit(world, { type: 'death', cause })
}

/** One frame of a chapter. The caller rebuilds the chapter when the vignette ends. */
export function stepWorld(world: World, input: Input, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return
  const frame = Math.min(dt, MAX_FRAME_DT)
  latchInput(world, input)
  const n = Math.max(1, Math.ceil(frame / FIXED_STEP))
  const h = frame / n
  for (let i = 0; i < n; i++) {
    if (world.exit) break
    substep(world, input, h)
    world.time += h
  }
}

// ---- the game ----

export interface NewGame {
  chapter?: ChapterId
  checkpoint?: number
  hasGun?: boolean
  deaths?: number
  elapsed?: number
  /** start in the chapter, not the prologue */
  skipPrologue?: boolean
}

export function createGame(opts: NewGame = {}): Game {
  const chapter = opts.chapter ?? 1
  const world = buildChapter(chapter, opts.checkpoint ?? -1, opts.hasGun ?? false)
  const fresh = chapter === 1 && (opts.checkpoint ?? -1) < 0 && !opts.skipPrologue
  return {
    mode: 'cut',
    cut: { id: fresh ? 'prologue' : 'card', t: 0, length: CUT_LENGTH[fresh ? 'prologue' : 'card'] },
    world,
    elapsed: opts.elapsed ?? 0,
    deaths: opts.deaths ?? 0,
    events: [{ type: 'cut', id: fresh ? 'prologue' : 'card' }],
  }
}

function startCut(game: Game, id: CutId): void {
  game.mode = 'cut'
  game.cut = { id, t: 0, length: CUT_LENGTH[id] }
  game.events.push({ type: 'cut', id })
}

function nextChapter(game: Game, chapter: ChapterId): void {
  const hasGun = game.world.player.hasGun
  game.world = buildChapter(chapter, -1, hasGun)
  game.events.push({ type: 'chapter', chapter })
  startCut(game, 'card')
}

/** Ends the current cut now (Enter / tap). The ending cannot be skipped past the result. */
export function skipCut(game: Game): void {
  if (game.mode !== 'cut' || !game.cut) return
  game.cut.t = game.cut.length
  finishCut(game)
}

function finishCut(game: Game): void {
  const cut = game.cut
  if (!cut) return
  game.cut = null
  switch (cut.id) {
    case 'prologue':
      game.events.push({ type: 'chapter', chapter: 1 })
      startCut(game, 'card')
      return
    case 'card':
      game.mode = 'play'
      resetControls(game.world)
      return
    case 'capture':
      nextChapter(game, 3)
      return
    case 'ending':
      game.mode = 'done'
      return
  }
}

export function stepGame(game: Game, input: Input, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return
  if (game.mode === 'done') return
  if (game.mode === 'cut' && game.cut) {
    game.cut.t += Math.min(dt, MAX_FRAME_DT)
    // The world keeps breathing behind a chapter card.
    if (game.cut.id === 'card') game.world.time += Math.min(dt, MAX_FRAME_DT)
    if (game.cut.t >= game.cut.length) finishCut(game)
    return
  }
  const w = game.world
  stepWorld(w, input, dt)
  game.elapsed += Math.min(dt, MAX_FRAME_DT)
  for (const e of w.events) {
    game.events.push(e)
    if (e.type === 'death') game.deaths += 1
  }
  w.events.length = 0

  if (w.dying && w.dying.t >= DEATH_TIME) {
    // The hard cut back to the last lamp: the chapter as it was then.
    game.world = buildChapter(w.chapter, w.checkpoint, w.player.hasGun)
    return
  }
  if (w.exit) {
    if (w.exitCut) startCut(game, w.exitCut)
    else if (w.chapter < 5) nextChapter(game, (w.chapter + 1) as ChapterId)
  }
}

/** Drains the events since the last call (audio, effects). */
export function drainEvents(game: Game): import('../types').GameEvent[] {
  const out = game.events
  game.events = []
  return out
}

// ---- saves ----

export function saveOf(game: Game, savedAt: number): ShoreSave {
  const w = game.world
  // A capture or an ending in progress saves as the chapter it leads to.
  let chapter = w.chapter
  let checkpoint = w.checkpoint
  if (game.cut?.id === 'capture') { chapter = 3; checkpoint = -1 }
  return {
    v: 1,
    chapter,
    checkpoint,
    hasGun: w.player.hasGun,
    deaths: game.deaths,
    elapsed: Math.round(game.elapsed * 10) / 10,
    savedAt,
  }
}

export function parseSave(raw: unknown): ShoreSave | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.v !== 1) return null
  const ch = r.chapter
  if (ch !== 1 && ch !== 2 && ch !== 3 && ch !== 4 && ch !== 5) return null
  const num = (v: unknown, lo: number, hi: number): number | null =>
    typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null
  const checkpoint = num(r.checkpoint, -1, 8)
  const deaths = num(r.deaths, 0, 1e6)
  const elapsed = num(r.elapsed, 0, 1e7)
  const savedAt = num(r.savedAt, 0, 1e15)
  if (checkpoint === null || deaths === null || elapsed === null || savedAt === null) return null
  return {
    v: 1, chapter: ch, checkpoint: Math.floor(checkpoint), hasGun: r.hasGun === true,
    deaths: Math.floor(deaths), elapsed, savedAt,
  }
}

export function gameFromSave(save: ShoreSave): Game {
  return createGame({
    chapter: save.chapter,
    checkpoint: save.checkpoint,
    hasGun: save.hasGun,
    deaths: save.deaths,
    elapsed: save.elapsed,
    skipPrologue: true,
  })
}
