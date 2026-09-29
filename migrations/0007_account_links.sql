-- Site accounts and player profiles (2026-09-29). Mini World and Lag Din
-- Figur need a signed-in account (auth.phareim.no); the profile the games
-- keep their saves, bits and neighbourhood on stays the player (a UUID
-- from the browser's localStorage). This table says whose profile it is:
-- one row per account, at most one account per profile.
--
-- A row is made the first time an account uses one of the games' routes,
-- or asks /api/account/link: the profile the browser already has is
-- claimed (so existing saves are kept), or a fresh one is made. `user_id`
-- is the account's id from auth (Reader's user id), never an email.
-- Nothing is backfilled: the rows appear as people sign in.
CREATE TABLE IF NOT EXISTS account_links (
  user_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  linked_at INTEGER NOT NULL
);
