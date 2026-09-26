## Mini World — Ulrikke's game (2026-09-26)

`?theme=miniworld`, cabinet ten in the portal's arcade (right of the
HANGAR door). Designed by Ulrikke (7): Roblox's blocky 3D world crossed
with Toca World's people and houses. Norwegian throughout. The design,
the town's layout, the look and the code map are in
`themes/miniworld/DESIGN.md`; this file is how it works and how to check it.

**What is in it.** Up to three people (name, skin, hair, eyes, mouth,
clothes); a shared closet that starts with two tees, jeans and sneakers;
Klesbutikken and Møbelbutikken; your house on Nabogata with a Pynt mode
(drag on a grid, turn, put away, floors and wallpapers); Verkstedet for
upgrades (levels 1–3 on furniture and weapons) and fantasy weapons
(base × magic × colour) that pop balloons in Ballongparken; four
contests on Tivoliet: the obby in three levels, Stjernejakt, Motevisning
(dress to a theme, three judges) and Huskespill; Slottet for friends
(six-letter codes), one neighbourhood per player, votes for the crown,
royal titles and their clothes, gifts to the postkasse, and visits to
friends' houses. Kart fast-travels. A new player gets 50 bits once.

**Money is the site wallet.** Bits are one balance for the whole site:
`composables/useWallet.ts` keeps `phareim.wallet` in localStorage (the
server's balance plus pending ops with random ids) and sends ops to
`POST /api/wallet` once the browser has a Hall of Fame player; the
server applies each op id once, clamps to 0..99 999 and answers the
balance. Neon Shrine's hero picks up and spends the same bits (its bridge
is described in `docs/games/neon-shrine.md`).

**Saves.** `useMiniWorld()` keeps the save (`MiniWorldSave` in
`types.ts`) in localStorage `miniworld.save` and on the profile slot
`miniworld` (`SAVE_GAMES`, 32 KB, newest write wins, like Neon Shrine).
Play waits for `ready`, so a fresh tab cannot overwrite the profile copy
before it arrives. The Hangar shows N PERSONER · M TING.

**The neighbourhood API** (`server/api/mw/*`, rules in
`server/utils/miniworldApi.ts`, stores in `server/utils/miniworld.ts`,
tables in `migrations/0006_miniworld.sql`): state, profile (what others
see: active person and house), friend/unfriend by code, hood
(create/join/leave/vote/crown/title), gift and gift/open, house (friends
and neighbours only). No auth, like the rest of the profile API; ids,
catalog ids and sizes are validated, 30 friends, 12 per neighbourhood, 40
unopened gifts. Bits gifts are debited on send and credited on open.
D1 binds at most 100 values per query, so the wallet applies up to 50
ops in a handful of statements in one batch.

**One shared world** (2026-09-26, Petter's call: anyone may meet anyone
for now). Everyone who plays walks in the same town and sees the others
live, in the same place only (town, one house, one obby course, the
meadow). The wire format is `themes/miniworld/net/protocol.ts`; the
browser side is `net/link.ts` (one WebSocket, reconnect with backoff,
closed while the tab is hidden, 10 state updates a second at most); the
runtime draws peers ~120 ms behind, interpolated (`scene/peers.ts`,
`scene/peerMotion.ts`). The relay is `servers/mw-world/` on Sleeper:
Node 22 running the TypeScript directly, only dependency `ws`, PM2
`mw-world`, 127.0.0.1:3034, nginx `sleeper.phareim.no/mw-world/`
(WebSocket upgrade), origins phareim.no, its Pages previews and local
dev. It keeps nothing on disk: a restart drops everyone for a moment and
they reconnect. At most 40 players, 30 messages a second each. A push
that touches the service or `protocol.ts` restarts it (`deploy.sh`, run
by the sleeper-deploy webhook). Peers are not solid. There is no chat:
players wave, dance, cheer or send a heart (keys 1–4 or the buttons),
and tapping another player opens their card: BLI VENNER (friend by
public id, `POST /api/mw/friend { playerId, id }`), send a gift, visit
their house. The HUD shows N HER; offline, the game plays solo. The
names children type are visible to everyone playing. Identity on the
wire is the public id the client says it has; the service cannot check
it (a spoofed id only misdirects a friend tap).
`scripts/miniworld-lab/live-two.mjs` plays two players in one browser.

**Into Neon Shrine.** The active person's colours go to localStorage
`miniworld.heroColors`; Neon Shrine's hero wears them.

**Look and feel.** three.js into a low-res target (~330 logical px on the
short side, 250 in low-power mode), whole-number upscale, toon shading,
a one-pixel outline, daylight candy palette. Panels are `.px-box` /
`.px-btn` in the pixel font in `--mw-*` candy colours (`ui/mw.css`). The
pixel font draws Å with its ring since 2026-09-26. Physics runs at 120 Hz
fixed steps (walk 8 u/s, jump 2.2 units, coyote time, jump buffer,
moving platforms, trampolines, kill bricks). Own music and sounds
(`audio.ts`, `audioScore.ts`), so the site radio stays silent here
(`ownRadio`).

**Controls.** Keys: WASD/arrows, Space jumps, E/Enter acts, F fires
magic, drag turns the camera, wheel zooms, Esc closes a panel (and in a
contest a tap pauses, a hold goes back to town). Touch: a floating stick
on the left, drag right to turn, pinch to zoom, HOPP / the action word /
MAGI bottom-right above the bottom band.

**Checks.** `npm run test:miniworld` (in CI): the save and every action,
placement rules, contests, royal rules, names, hero colours, the server
rules against the memory store and the real D1 SQL (node's SQLite with
every migration), the character controller, every obby jump against the
jump reach, the model tables, the audio against a fake Web Audio.
`tests/zelda-wallet.test.mjs` (in `test:zelda`) covers Neon Shrine's
wallet bridge. Lab scripts, all run as `flock /tmp/claude-1000/chrome.lock
node …`: `scripts/miniworld-lab/avatar-sheet.mjs` (every hair style,
clothing item, furniture model, weapon and the house),
`world-shot.mjs` + `world-play.mjs` (town, places and a scripted run of
the runtime). In the dev server, `window.__mw` exposes the runtime, the
game, the social API and the panel context.

**Verified 2026-09-26** in headless Chromium against the dev server: the
first run, shops, the workshop, persons, memory, the fashion show, the
obby and the star hunt from their booths, Pynt, Kart, a neighbourhood
with a vote and a crowning, and — with a second player made through the
API — a friend code, two gifts in the postkasse and a visit. **Not yet:**
a real iPhone or iPad (touch feel, the on-screen keyboard in the name
field, frame rate), music heard by a person, two real players on two
devices.
