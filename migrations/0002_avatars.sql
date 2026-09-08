-- Player avatars (2026-09-08). Each player gets a painted portrait of their
-- name's animal as a space pilot, generated on Sleeper (wave-jobs
-- POST /avatar → gpt-image-2 low) and stored in the fixer.ink media
-- library; we keep only the filename and compose the public URLs from it.
-- avatar_name is the name the picture was painted for (a reroll repaints),
-- avatar_gens bounds how many paintings one player can cost, and
-- avatar_started_at stops two requests from painting the same name at once.
ALTER TABLE players ADD COLUMN avatar_file TEXT;
ALTER TABLE players ADD COLUMN avatar_name TEXT;
ALTER TABLE players ADD COLUMN avatar_gens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN avatar_started_at TEXT;
