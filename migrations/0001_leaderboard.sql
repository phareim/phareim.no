-- Hall of Fame (2026-09-08). One player per browser (a UUID the client keeps
-- in localStorage) with a generated two-word name; one best score per player
-- per game. Names are unique so the board never shows two identical rows.
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scores (
  game TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  achieved_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (game, player_id)
);

CREATE INDEX IF NOT EXISTS scores_game_score ON scores (game, score DESC, achieved_at ASC);
