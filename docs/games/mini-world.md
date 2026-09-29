## Mini World — Ulrikke's game (2026-09-26)

`?theme=miniworld`, the left cabinet in the portal's VIP hall (next door to the arcade, for
visitors who are logged in; moved there from the arcade 2026-09-29). Designed by Ulrikke (7): Roblox's blocky 3D world crossed
with Toca World's people and houses. Norwegian throughout. The design,
the town's layout, the look and the code map are in
`themes/miniworld/DESIGN.md`; this file is how it works and how to check it.

**What is in it.** Up to three people (name, skin, hair, eyes, mouth,
clothes); a shared closet that starts with two tees, jeans and sneakers;
three clothes shops (Klesbutikken, Glitterbutikken, Kostymebutikken) and
Møbelbutikken; your house on Nabogata with a Pynt mode
(drag on a grid, turn, put away, floors and wallpapers); Verkstedet for
upgrades (levels 1–3 on furniture and weapons) and fantasy weapons
(base × magic × colour) that pop balloons in Ballongparken; four
contests on Tivoliet: the obby in three levels, Stjernejakt, Motevisning
(dress to a theme, three judges) and Huskespill; Slottet, a throne hall to walk around in, for friends
(six-letter codes), one neighbourhood per player, votes for the crown,
royal titles and their clothes, gifts to the postkasse, and visits to
friends' houses. Kart fast-travels. A new player gets 50 bits once.

**Slottet inside** (2026-09-29, Petter's wish). The castle gate on the
hill is a door into a throne hall (`scene/castle.ts`, place `castle`):
a carpet up a two-step dais to the big throne and two small ones, pillars
with lanterns, stained glass, a piano, a banquet table with a cake, and
Slottsboka on a lectern by the gate, which opens the friends and
neighbourhood panel (zone `castle-book`; the gate itself used to open it).
Sitting on the big throne plays a fanfare with gold stars. The seats and
the piano use the house's usables (`usables()` on a place, offered in your
own house and here). The hall is shared: everyone in it has place key
`castle` and sees each other. No ceiling and a low front wall, like the
houses, so the camera never needs to dodge a wall.

**Storeys** (2026-09-28, Ulrikke's wish). A house has up to three
(`MAX_STOREYS`); the save keeps the ground storey in `house` and the ones
above in `house.up`, each with its own floor, wallpaper and items, and a
`stair` (a 1 × 4 strip: three steps and a foot cell) on every storey with
one above. The storey above has the opening over the same cells; both
strips are blocked for furniture (`blockedCells` in `core/save.ts`). Pynt
builds a storey (`addStorey`: 100 then 200 bits; the stairs go where they
move the fewest things, off the front wall, clear of the door, the
wardrobe and the windows; what stood there goes to storage). In the house
(`scene/home.ts`) one `createHouse` handle per storey stacks 4 units apart;
the storeys above yours hide. The top step or the Gå opp zone takes you up,
the opening or Gå ned down; the runtime sends `storey` events and Pynt's
▼/▲ picks the storey to decorate. Old saves and profiles without `up` are
one storey. Visitors walk the stairs too. The house in town, yours and your
friends', stands as tall as its storeys (`paintHouse` in `scene/town.ts`,
drawn by `neighbors.ts`).

**Money is the site wallet.** Bits are one balance for the whole site:
`composables/useWallet.ts` keeps `phareim.wallet` in localStorage (the
server's balance plus pending ops with random ids) and sends ops to
`POST /api/wallet` once the browser has a Hall of Fame player; the
server applies each op id once, clamps to 0..99 999 and answers the
balance. Neon Shrine's hero picks up and spends the same bits (its bridge
is described in `docs/games/neon-shrine.md`).

**Shops.** Five doors on Butikkgata open a panel (`ui/Shop.vue`,
`kind` `clothes`, `glitter`, `kostyme` or `furniture`). A clothes shop
shows the pieces `shopClothes()` gives it (by `ClothingDef.shop`, none
for Klesbutikken) and a tab only for slots it has wares for. The costume
pieces brought their own shapes (a onesie with a tail, a superhero suit,
a mermaid tail that hides the shoes, ballet shoes, dino feet, a pirate
bicorne, a witch's hat, a dinosaur hood, feelers, headphones, a star
crown, an eye patch, a bow tie, a necklace, a cat's nose, dragon, bee
and turtle backs), drawn in `scene/clothes.ts`.

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
and neighbours only). Every route needs a signed-in account that owns the
player id it names (see **Sign-in** below); ids,
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
it (a spoofed id only misdirects a friend tap). Who may connect is
checked (see **Sign-in**).
`scripts/miniworld-lab/live-two.mjs` plays two players in one browser.

**Sign-in** (2026-09-29, Petter: "vi legger på pålogging på alle tre").
The account is the site-wide one at auth.phareim.no (Reader keeps users
and sessions; the httpOnly cookie `session_token`, Domain `.phareim.no`).
Mini World and Lag Din Figur work the same way; this is the whole story.

- *The window* (`ui/SignIn.vue`, drawn in the game's look; Lag Din Figur
  has its own): `Landing.vue` renders the game only when
  `useAccount().state` is `in`, so before that not even the game's chunk
  loads. States: checking, out (e-mail, password with VIS/SKJUL, LOGG INN;
  "Feil e-post eller passord", "For mange forsøk, vent litt"), offline
  (auth or our server out of reach: "Får ikke kontakt akkurat nå" with
  PRØV IGJEN, never a blank page), in. Sign-up is invite-only and stays on
  the auth page: the window has only "Har du ikke konto? Spør en voksen",
  a link to `authPageUrl('signup', <this page>)`. No sign-up form and no
  invite phrase anywhere in the code (a test greps for it). **Logg ut** is
  the gear in the menu (Mini World, also on the welcome card as IKKE DEG?
  LOGG UT) / the header (Lag Din Figur): two taps, the last save and the
  wallet go up first, then the session ends and the page reloads. The tab
  coming back to the front, and any 401 from the game's routes, re-ask
  auth; an ended session brings the window back.
- *The lock* (server, `server/utils/account.ts` over `sessionCheck.ts`
  and `accountLinks.ts`): the request's `session_token` cookie (only that
  cookie) is sent to `GET auth.phareim.no/api/session`; the answer is
  cached per SHA-256 of the token, 5 minutes for yes, 30 s for no; the
  token is never logged or stored; auth unreachable is 401 `auth-down`
  (fail closed; the client shows the retry); no session is 401 `sign-in`.
  The Norway gate and mw-world's Origin check run as before, first.
  Enforced on: every `/api/mw/*` route and `POST /api/account/link`;
  `/api/save` for the slots `miniworld` and `figur` (Neon Shrine, Another
  Shore and the Battery stay open); `/api/wallet` when the client says
  `game: 'miniworld'` (Mini World sends it) **or** the player id is linked
  to an account (then only its owner's session; Neon Shrine's wallet for
  a profile nobody linked stays open); `/api/profile` leaves the two
  slots out unless the caller owns the profile; the mw-world WebSocket
  upgrade (401 before upgrading, Origin first). Hall of Fame routes are
  open as before. A signed-out browser is answered without asking auth.
  `tests/miniworld-account.test.mjs` lists every file under
  `server/api/mw/` and fails when one is not covered.
- *Profiles and saves.* The game's identity is still the browser's player
  id (`phareim.player`, a UUID); an account *owns* one such profile:
  table `account_links (user_id, player_id)` (`migrations/0007`, one row
  per account, one account per profile; the user id is auth's id, no
  email). After sign-in `POST /api/account/link { playerId }` answers the
  account's profile: its own if it has one (so a **new device gets the
  same saves**; the browser adopts that id), else the browser's profile
  is **claimed** (so a save made before logins is kept), else a fresh one
  is made. Any game route also claims a free profile on first use, and
  answers 403 `not-yours` for someone else's. The browser's local copies
  (`miniworld.save`, `figur.save`, hero colours, wallet, player) are
  cleared when a *different* account signs in on it than the last one
  (`phareim.account` remembers who), so one child's save is never pushed
  into another's profile; a browser from before logins keeps what it has,
  and the first account to sign in there claims it. A stray profile the
  browser had before is left on the server, untouched.
- *Ulrikke's progress.* Have her sign in **first on the device she has
  been playing on** (her iPad): that browser's profile, with her Mini
  World and Lag Din Figur saves and her bits, becomes her account's.
  Nothing to migrate by hand. If it was ever claimed by the wrong account:
  `DELETE FROM account_links WHERE user_id = '<auth id>'` (wrangler d1
  execute) frees it; to link by hand,
  `INSERT INTO account_links (user_id, player_id, linked_at) VALUES ('<auth id>', '<player id>', strftime('%s','now')*1000)`.
- *Dev.* Locally the cookie never reaches the dev server and auth refuses
  localhost, so the game shows the retry window. `scripts/login-lab/shots.mjs`
  fakes auth at both ends (Playwright route for the browser,
  `PHAREIM_DEV_AUTH_BASE` for the dev server's own check, honoured under
  `nuxi dev` only) and shoots both windows on iPad and iPhone sizes.

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
every migration), the character controller, the castle's throne hall (you
arrive free, and can walk from the gate to the throne and to Slottsboka;
`tests/miniworld-castle.test.mjs`), every obby jump against the
jump reach, the model tables, the three clothes shops' wares and the
costume shapes (`tests/miniworld-shops.test.mjs`), the audio against a
fake Web Audio.
`tests/zelda-wallet.test.mjs` (in `test:zelda`) covers Neon Shrine's
wallet bridge. Lab scripts, all run as `flock /tmp/claude-1000/chrome.lock
node …`: `scripts/miniworld-lab/avatar-sheet.mjs` (every hair style,
clothing item, furniture model, weapon and the house; `costumes` shows
the two newer shops' pieces and whole costumes from three sides),
`world-shot.mjs` (`hall`, `hall-throne`, `hall-sit`, `hall-book`, `hall-air` are the castle inside) + `world-play.mjs` (town, places and a scripted run of
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
