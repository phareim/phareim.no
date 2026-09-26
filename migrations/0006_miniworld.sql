-- Mini World (2026-09-26): the site-wide wallet and Mini World's
-- neighbourhood. `players.bits` is the balance of bits, shared by Neon
-- Shrine and Mini World; clients send it changes as ops with random ids,
-- and wallet_ops remembers applied ids so a retried request never pays
-- twice (pruned after 60 days: no client retries that long). `req` is the
-- request that applied the op; the balance moves by the sum of the ops a
-- request newly inserted.
ALTER TABLE players ADD COLUMN bits INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS wallet_ops (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  op_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  at INTEGER NOT NULL,
  req TEXT NOT NULL,
  PRIMARY KEY (player_id, op_id)
);

-- What others see of a player in Mini World (active person, house) and
-- their six-letter friend code. `data` is JSON checked by the server.
CREATE TABLE IF NOT EXISTS mw_profiles (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  data TEXT,
  updated_at INTEGER NOT NULL DEFAULT 0
);

-- Friendship is mutual: one row each way.
CREATE TABLE IF NOT EXISTS mw_friends (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, friend_id)
);

-- A neighbourhood (Nabolag). Deleted when its last member leaves.
CREATE TABLE IF NOT EXISTS mw_hoods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- One neighbourhood per player (the primary key). vote_for is the member
-- this one votes for as ruler; title is set by the ruler.
CREATE TABLE IF NOT EXISTS mw_members (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  hood_id TEXT NOT NULL REFERENCES mw_hoods(id) ON DELETE CASCADE,
  vote_for TEXT,
  title TEXT,
  joined_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS mw_members_hood ON mw_members (hood_id, joined_at);

-- Gifts waiting in (or taken from) a player's mailbox. Bits are taken
-- from the sender when sent and given to the receiver when opened.
CREATE TABLE IF NOT EXISTS mw_gifts (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  item TEXT,
  level INTEGER,
  amount INTEGER,
  sent_at INTEGER NOT NULL,
  opened_at INTEGER
);
CREATE INDEX IF NOT EXISTS mw_gifts_to ON mw_gifts (to_id, opened_at);
