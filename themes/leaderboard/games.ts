/**
 * The score games that report to the Hall of Fame, in the order the
 * board scrolls through them (the swipe order of the arcade). The id is the
 * theme id, which is also the `game` column in D1. Shared by the theme,
 * the composable and the server (validation).
 */
export interface GameEntry {
  id: string
  /** Big title on the board. */
  title: string
  /** One line under the title. */
  tagline: string
  /** Largest score the API accepts — a plausibility cap, not a design limit. */
  maxScore: number
}

export const GAMES: readonly GameEntry[] = [
  { id: 'hacker', title: 'Cyberpunk', tagline: 'Green shmup · gold powerups', maxScore: 500_000 },
  { id: 'breakout', title: 'Breakout', tagline: 'Paddle · ball · pink bricks', maxScore: 500_000 },
  { id: 'rtype', title: 'R-Type', tagline: 'Side-scroller · charge beam', maxScore: 1_000_000 },
  { id: 'invaders', title: 'Space Invaders', tagline: '5 × 11 formation · one shot', maxScore: 500_000 },
  { id: 'starfox', title: 'Star Fox', tagline: 'On rails · barrel roll', maxScore: 1_000_000 },
  { id: 'tetris', title: 'Tetris', tagline: 'Endless · line clears', maxScore: 2_000_000 },
] as const

export const GAME_IDS = GAMES.map(g => g.id)

export function gameById(id: unknown): GameEntry | undefined {
  return typeof id === 'string' ? GAMES.find(g => g.id === id) : undefined
}

/** How many rows a board shows at most. */
export const TOP_N = 10

/** Wire shapes shared by the API and the client. */
export interface BoardRow {
  rank: number
  name: string
  score: number
  playerId: string
}

export interface GameBoard {
  top: BoardRow[]
  /** Rows on this game (players with a score). */
  total: number
  /** The requesting player's row, if they have one (also present when inside `top`). */
  me: BoardRow | null
}

export interface LeaderboardResponse {
  boards: Record<string, GameBoard>
  /** The requesting player, if `?player=` named a known one. */
  player: { id: string, name: string } | null
}
