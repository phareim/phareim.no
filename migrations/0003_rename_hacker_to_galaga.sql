-- The Cyberpunk theme was renamed to Galaga on 2026-09-08 and its id changed
-- from `hacker` to `galaga`. The `game` column is that id, so the existing
-- Hall of Fame rows move with it. No `galaga` rows exist yet, so the
-- (game, player_id) primary key cannot collide.
UPDATE scores SET game = 'galaga' WHERE game = 'hacker';
