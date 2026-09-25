## Hall of Fame — the global leaderboard (2026-09-08)

`?theme=leaderboard` is a live theme, reached from the board in the portal's arcade: the
world ranking of the seven score games (Galaga, Breakout, R-Type, Space
Invaders, Star Fox, OutRun, Tetris; Another Shore has no score) in one panel.
Up/down arrows, PageUp/Down, the mouse wheel, a vertical swipe, the ▲▼
buttons or the square pips beside the panel walk the games; the switch is
the site's 180 ms fade. Escape or the ⌂ chip goes back to the portal.

**Look (2026-09-25).** Neon Shrine's pixel look (`docs/games/pixel-look.md`).
The backdrop (`Hall.vue`, scene in `themes/leaderboard/pixel.ts`) is the
shrine's hall of champions at night on the pixel stage: a brick wall whose
top sinks into the dark, tall arched windows onto the dusk, the striped sun
low in the big arch, pillars with pink neon strips and torches, crown
banners, trophies (cups, a crown, crystals) on pedestals, and under the
big arch a stone statue of the hero raising a crystal blade between two
crystal braziers, a rose carpet running from it to the viewer. Torches,
braziers and trophies light the hall through the light map; flames,
embers, the blade's shimmer and trophy glints move. The arch sits right of
centre on wide screens (the panel is on the left) and in the middle on
phones, where the statue stands on a low plinth under the panel. Reduced
motion draws one frame.

The panel is Neon Shrine's dialog box (`.px-box` in `pixel.css`); all text
is the pixel font at 16 px (titles 32 px, 24 px on phones). Cyan is the
interface, gold the podium, pink you. Names are cut at a whole letter and
end in a dot when their column is too narrow (the widest name is 20
letters). Landscape phones keep the panel left of the radio.

**Players.** A player is a UUID plus a generated name kept in localStorage
(`phareim.player`), so the same person on a phone, in Chrome and in Safari
is three players — decided 2026-09-08. The player is created the first
time a browser enters the board (its first score, or opening the theme).
Names are one 80s/tech word and one animal from the two lists in
`themes/leaderboard/names.ts` (NEON OTTER, FLUX CAPYBARA; 64 × 72 = 4 608
combinations); the server only accepts names those lists can make, and a
name is unique across players (409 → the client rerolls). REROLL on the
board renames the player everywhere. No free-text names on purpose.

**Board.** One best score per player per game (`scores` has
`PRIMARY KEY (game, player_id)`; a lower run never overwrites). The theme
shows the top ten, podium ranks in gold, your row in pink with ◀ YOU, and
if you are outside the top ten a `· · ·` gap and your own row with its
rank, plus RANK n OF total. Short viewports show fewer rows (measured from
the space the panel has, minimum three). Empty game: NO SCORES YET.

**Avatars (2026-09-08).** Every player gets a painted portrait of their
name's animal as a space pilot — Petter's painterly Fortiche-style prompt,
animal edition, the name stencilled on the helmet as callsign — made by
gpt-image-2 at quality `low` through the wave CLI on Sleeper and stored in
the fixer.ink media library (tag `phareim-avatar`, rating G, **3:2** so the
picture can be a card or banner later; the prompt pins the head to the
centre for the board's round crop). The site never talks to WaveSpeed:
`server/utils/avatar.ts` posts the name, player id and a callback URL to
wave-jobs' `POST /avatar` (Bearer `WAVE_JOBS_KEY`, a Pages secret since
2026-09-08) inside `waitUntil`; wave-jobs answers 202 and, when the upload
is done, POSTs `{playerId, name, file}` to **`/api/avatar`** with the same
bearer, which stores the filename in `players.avatar_file`. (Cloudflare
ends `waitUntil` work 30 s after the response and a painting takes 35-45 s
— the first, synchronous version painted three pilots that never reached
D1; found and fixed 2026-09-08.) Filename in
(migration `0002_avatars.sql`; URLs are composed from it by
`avatarThumbUrl`/`avatarImageUrl` in `themes/leaderboard/games.ts` —
`media.fixer.ink/thumbnails/<stem>_thumb.jpg` is a 320 px thumbnail, what
the board shows). Painting starts on `POST /api/player` (new name)
and on `GET /api/leaderboard` for a known player whose picture is missing
or made for another name, so pre-avatar players catch up on their next
visit. Guards in the store: `claimAvatar` takes one painting per name, at
most `AVATAR_MAX_GENS` (6) per player, and not twice within three minutes;
wave-jobs adds a daily cap. ≈$0.02–0.06 per painting, ~35–45 s. On the
board the pilot is pixel art (`PixelAvatar.vue`): the painting shrunk into
12×12 pixels (16×16 beside YOU ARE in the footer) and shown at 2 CSS px per
pixel with a one-pixel edge, gold on the podium, pink on your row. The
footer's edge blinks while a painting is pending; the theme refetches the
board once or twice at 45 s while its own picture is missing. `nuxi dev`
has no key, so avatars stay null there. **REROLL is gone from the footer
since 2026-09-08** — a new name costs a painting; `useLeaderboard.reroll`
and the server's rename path remain for when it returns with a cap.

**Wiring.** The five arcade landings call `submitScore('<id>', score)` in
`onGameOver`; Tetris does it in `Game.vue` on top-out and on the Escape
hold. A run of 0 is not sent. When the API answers, the game-over screen
adds WORLD RANK #n · NAME. Failures are silent — the board is a bonus.

**API** (`server/api/`, store in `server/utils/store.ts`):
`GET /api/leaderboard?player=<id>` → `{ boards: { [game]: { top, total, me } }, player }`
(rows and `player` carry `avatar`, the thumbnail URL or null;
one window-function query plus a count, `Cache-Control: no-store`);
`POST /api/player { id, name }` → 400 bad id/name, 409 name taken;
`POST /api/avatar { playerId, name, file }` (Bearer `WAVE_JOBS_KEY`, called by wave-jobs) → 401/400/404, stores the painting;
`POST /api/score { playerId, game, score }` → `{ best, rank }`, 400 for an
unknown game or a score outside 1..`maxScore` (a per-game plausibility cap in
`themes/leaderboard/games.ts`), 404 unknown player (the client re-registers
and retries once). `GET /api/save?player=&game=` → `{ save: { data, savedAt, best, clears } | null }`
and `POST /api/save { playerId, game, data?, savedAt, best?, won? }` are the
adventure save slots (2026-09-23, migration `0005_game_saves.sql`, games in
`SAVE_GAMES` — Neon Shrine and, since the rebuild the same day, Another Shore): opaque JSON up to the game's `maxBytes`, newest `savedAt`
wins, `data: null` clears, `best` keeps the lowest (60 s–100 h, else
ignored), `won` counts a clear; 404 unknown player.
There is no auth and no rate limit: a determined person
can post any number under the cap, and a wipe is `DELETE FROM scores`.

**Dev.** `nuxi dev` has no D1, so `getStore` falls back to an in-memory
store with the same behaviour (production throws 500 if the binding is
missing rather than silently serving an empty board). Verified 2026-09-08
in headless Chromium (CDP script, no Playwright): 1440×900 keyboard walk,
reroll, ArrowRight still switching theme; 375×667 and 667×375 with emulated
touch swipes; a Space Invaders run to game over by keyboard producing the
WORLD RANK line and the highlighted row; `/nope`; no page errors or document
overflow. `npm run test:leaderboard` covers the name lists.

