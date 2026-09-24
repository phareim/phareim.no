/**
 * Puts a real top three on the arcade's HIGH SCORES sign: one Hall of Fame
 * game, picked at random among those with scores, fetched once when Neon
 * Shrine mounts. The engine keeps a reference to the sign's lines, so the
 * array is rewritten in place. If the API fails or no game has scores, the
 * sign keeps its offline text.
 */
import { GAMES, type LeaderboardResponse } from '~/themes/leaderboard/games'
import { HIGH_SCORE_SIGN } from './world/interiors'

let loaded = false

export async function loadHighScoreSign(): Promise<void> {
  if (loaded) return
  try {
    // No ?player=: reading the board must not register this browser.
    const res = await fetch('/api/leaderboard', { cache: 'no-store' })
    if (!res.ok) return
    const { boards } = await res.json() as LeaderboardResponse
    const withScores = GAMES.filter(g => (boards[g.id]?.top.length ?? 0) > 0)
    const game = withScores[Math.floor(Math.random() * withScores.length)]
    if (!game) return
    const rows = boards[game.id]!.top.slice(0, 3).map(r => `${r.rank}. ${r.name} ${r.score}`)
    HIGH_SCORE_SIGN.splice(0, HIGH_SCORE_SIGN.length,
      `HIGH SCORES · ${game.title}\n${rows.join('\n')}`,
      'THE CABINETS STAND IN THE ARCADE ON PHAREIM.NO. THE WAY HOME IS THROUGH THE KEEPER\'S HUT.',
    )
    loaded = true
  } catch { /* the board is a bonus */ }
}
