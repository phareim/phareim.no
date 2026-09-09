-- Player ships (2026-09-09). The Hangar profile theme lets the player pick
-- between ships; the pick shows in every ship game. Unlock is derived live
-- from COUNT(DISTINCT game) in scores (>= 4 unlocks the second ship), so no
-- backfill is needed. xp/level columns are reserved for the next iteration
-- (cross-game XP, per-ship upgrades) — nothing reads them yet.
ALTER TABLE players ADD COLUMN selected_ship TEXT NOT NULL DEFAULT 'dart';

CREATE TABLE IF NOT EXISTS player_ships (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  ship_id TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (player_id, ship_id)
);
