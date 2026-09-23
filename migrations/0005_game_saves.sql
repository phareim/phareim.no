-- Profile saves (2026-09-23). One save slot per player per adventure game
-- (Neon Shrine first): the game's own JSON in `data`, NULL when no run is
-- in progress (after a win or a new game). `saved_at` is the client's
-- wall clock in ms — newest write wins, so a stale tab cannot roll a save
-- back. `best_seconds` and `clears` outlive the save itself.
CREATE TABLE IF NOT EXISTS game_saves (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  data TEXT,
  saved_at INTEGER NOT NULL,
  best_seconds REAL,
  clears INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (player_id, game)
);
