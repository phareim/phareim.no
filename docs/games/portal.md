## The Portal — phareim.no's front door (built 2026-09-24, one world since the same day)

`/` is the Portal: a small neon town you walk around in, and the west end
of Neon Shrine's world. Petter's name is painted on the roof of his house.
The buildings lead to everything else on the site: the arcade (a cabinet
per game, one more that leaves for Nova & Rex: The Pizza Rescue on fighter.phareim.no, the
Hall of Fame board, the Hangar door), the VIP hall next door
(Ulrikke's games and a bar, for logged-in visitors), Petter's house (who he
is, three terminals to his profiles, the login console), the PHAREIM.MD newsstand, the
GAMES.PHAREIM.NO signpost, and east of the pier a quiet beach: two hippie
DJs (the one building loops live leads to jam.phareim.no, the one with the
records to the generative radio at radio.phareim.no, which shows a ⌂ TOWN chip back when the visit came from here) and people lying
about round a bonfire (2026-09-26; it replaced the radio studio by the
road). West, the shore road ends in a thicket: cut it
with the blade and it leads into the Wildwood (`docs/games/wildwood.md`).
The coast road runs east along the water into
Home Glade and round to the Keeper's hut, where the adventure begins
(`docs/games/neon-shrine.md`). It replaced Player One, the random
first-visit theme and, later the same day, Neon Shrine's own theme page.
Design and the reasoning behind the layout: `themes/portal/DESIGN.md`.

**Files.**

| File | Job |
|---|---|
| `themes/zelda/world/overworld.ts` | The overworld, 104×48. The town is columns 0–39 (`TOWN_W`): house and name, arcade, fountain, newsstand, signpost, pier, the beach east of it (two DJ booths, a bonfire and the people round it, tiki torches), the kid and the cat, the coast road east, the thicket and warp west into the Wildwood |
| `themes/zelda/world/town.ts` | The arcade, 17×11 (eleven cabinets: nine games and two that leave the site, Adventure for `adventure.phareim.no`, Eventyrland's open instance, and Pizza Rescue for `fighter.phareim.no`; the board, HANGAR door, prize counter and vendor, the robot, the HIGH SCORES sign, a chest), the VIP hall, 17×11 (Mini World, Lag Din Figur and Eventyrland, a bar with its bartender, a mirror ball, a sign) and Petter's house, 15×10 (LinkedIn, GitHub and Bluesky terminals, the red NEW GAME machine, the login console, no email on purpose, Petter at his desk) |
| `themes/zelda/engine/map.ts` | `setSession`: the shell's word on the login; the rope tiles follow it |
| `themes/zelda/world/index.ts` | `WORLD` (the one world), `worldExits()`, `worldStartingAt()` |
| `themes/zelda/Zelda.vue` | The shell: loop, input, touch deck, audio, saves, pause menu, exits, the way back, the account panel |
| `themes/zelda/AccountConsole.vue` | The login console's panel: session check, LOG IN / CREATE ACCOUNT / LOG OUT, its own keys |
| `themes/zelda/account.ts` | auth.phareim.no: `AUTH_BASE`, `fetchSession`, `signOut`, `authPageUrl`; `fetch` passed in |
| `themes/portal/Landing.vue` | The page: the shell, the first-move hint, the ending panel, the hidden link index |

**Controls.** Arrows or WASD walk; Space, J, Z or Enter is A (talk, read,
use; with the blade, swing). K/X/Shift is B and Q swaps once there is an
item; Tab swaps only then too, otherwise it reaches the page's link index.
P or an Escape tap pauses. Touch: drag anywhere on the left 60 % for a
floating stick. The world fills the whole screen and the buttons float
half see-through over it, bottom right: A and a pause chip, with B and
SWAP once there is an item. Any tap moves a dialog
on. The page locks theme navigation while it is shown, so arrows and swipes
walk the hero.

**Before the blade.** A visitor starts with nothing: no HUD, no swing, B
silent, the clock still. The town has no enemies or hazards. Nothing is
saved and no Hall of Fame player is created until the hero has the blade.

**Leaving and coming back.** A cabinet, the board, the kiosk, the radio
station's door, the signpost and the terminals show their lines when you
face them and press A. The last line is a question (INSERT COIN?, OPEN
IT?, TUNE IN? …) with YES and NO under it, YES picked: A answers, any
arrow moves the cursor, a tap on the left half of the screen is YES and on
the right half NO. YES fades out and leaves; NO closes the lines and the
hero stays at the machine. B, Backspace or an Escape tap back out on any
line (2026-09-26; before that every press led into the game). The HANGAR
door leaves as you step on it.
On the engine's `exit` event the shell saves (with the blade), writes
sessionStorage `portal.return` = `{ map, entry: <exit id> }`, then calls
`useTheme().launch(theme)` or `location.assign(url)`. On mount it starts at
`portal.return` if the world has that spot, else on the plaza start (just
below Petter's door, facing the name), with the local save's items,
hearts, flags and play time. The profile's copy is pulled in the
background and replaces the run only if nothing has been saved this
session. Back from a URL through the browser's page cache, `pageshow`
restarts at the exit; a theme exit that has not navigated after 2.5 s
comes back too. TO TOWN, NEW GAME and a new quest clear `portal.return`.

**The arcade's layout** (2026-10-06). Three cabinets stand on the island
between the two pillars, straight ahead of the door: Adventure (7,4), Pizza
Rescue (8,4, the door's own column) and Night of the Dead Battery (9,4). They
are the long games, and Petter wanted them where a visitor looks first. The
other eight line the back wall, four each side of the board: Another Shore,
Galaga, Breakout, R-Type on the left; Space Invaders, Star Fox, OutRun and
Tetris on the right, with the HANGAR door above the gap between the last two
pairs. Every cabinet has a stool in front of it. The robot's welcome names
the three in the middle.

**Pizza Rescue's cabinet** (2026-10-05; renamed and moved 2026-10-06). Like
Adventure's beside it, this cabinet is not a theme: Nova & Rex: The Pizza
Rescue (Slop Fighter until 2026-10-06) is a side-scrolling fighter on its own
site, so the cabinet is an exit with
`to: { url: 'https://fighter.phareim.no/?look=wasteland&from=phareim' }`, the
same kind of exit as Eventyrland's cabinet and the beach's booths. `look`
opens the game's pixel look, Wasteland '89. `from=phareim` tells the game
where the visit came from: its title and its pause panel then show a third
button, ARCADE, that loads `https://phareim.no/`, and `portal.return` stands
the hero in front of the cabinet again. The cabinet's pitch says so (PAUSE
THERE AND PICK ARCADE). It stands in the middle of the island (tile 8,4 of
`arcade`, exit id and art `pizzarescue`, label PIZZA RESCUE, used from 8,5).
It is the hall's only rust-orange machine: N and R in white either side of a
slice of pizza on the marquee, and Nova and a Dead Paddy trading a punch and
a kick under a striped sun on the screen (`CABS.pizzarescue` and `drawScreen`
in `render/exits.ts`). The robot counts eleven cabinets, and the hidden link
index lists it under Writing and projects, as it does every exit with a URL.

**VIP hall** (2026-09-29). Ulrikke's games, Mini World and Lag Din Figur
(moved out of the arcade) and Eventyrland (a cabinet that leaves for
`eventyrland.phareim.no`), have a room of their own, a building north of the
arcade (overworld cols 2–10, rows 3–7, VIP in gold on the roof, door `ß` at
6,7; the room is `VIP` in `town.ts`, 17×11, back out to entry `vip`). Its
door is open only to a visitor logged in on auth.phareim.no:

- *Logged in:* the velvet rope in front of the door (tile `¤`, row 8, cols
  5–7) is gone, and the guard beside it (NPC `vipguard`, look `guard`, 8,8)
  only says the rope is down for you.
- *Not logged in* (or the auth server unreachable): the rope is solid, the
  door cannot be reached, and the guard asks for an account. When his lines
  close, the login console's panel opens over the world (`TalkBranch.panel`,
  the engine's `panel` event). LOG IN saves the spot as `{ overworld,
  vipguard }` (a registered entry in front of him), so the auth page's
  redirect brings the hero back to the guard.

Inside (17×11): the three cabinets along the back wall with stools, the sign,
and a bar in the right-hand corner: a shelf of bottles (tile `q`), a counter
(`n`) with the bartender behind it (NPC `bartender`, look `barmaid`; she is
talked to across the counter like the arcade's vendor; a different line
once the King is beaten) and stools in front. It is a dim club, not
daylight: `MapDef.ambient` sets the light map's base colour, and
`MapDef.props` add a mirror ball (`discoball`, four coloured spots circling
the dance floor rug) and neon glows (`glow`, radius in `w`); the neon
lettering VIP LOUNGE and BAR are decals. Eventyrland's cabinet has its own
marquee and screen (`CABS.eventyrland` and `drawScreen` in `render/exits.ts`).

The engine holds the answer in `GameState.session` (not a flag, so never in
a save); the shell sets it (`setSession` in `engine/map.ts`, `applySession`
in `Zelda.vue`) from `fetchSession()` on mount and on a `pageshow` from the
page cache, and from `AccountConsole.vue`'s `session` event (its own check
on open, and LOG OUT). `setSession` opens or closes the rope on the map the
hero is on, unless the hero stands on a rope tile (it stays open until the
map loads again); every other map reads `session` in `loadMap`. Until the
first answer arrives the rope is up. `Cond` has `{ session: boolean }` for
NPC talk and hide. **The games themselves still open without a login**
(`?theme=miniworld|figur` by URL; Norway-only stays as before): login on the
games is the next round.

**Pause menu.** RESUME · SOUND ON/OFF (M; the game's sound, the same flag as the arcade ♪ toggle, 2026-09-30) · TO TOWN (T): saves and puts the hero on the plaza
start, hearts full. Holding Escape for 3 s does the same (pill: HOLD ESC
FOR TOWN). A hidden tab saves, and pauses once the hero has the blade.

**NEW GAME machine** (moved out of the pause menu 2026-09-26, so wiping the
quest is a place you go to, not a menu line). A red cabinet on the back
wall of Petter's house, right of the terminals: an exit with
`to: { reset: true }` that leaves nothing. Before the blade it says there
is nothing to wipe. After, its lines warn what goes; closing them makes the
engine emit `startOver` (mode stays `play`), and the shell stops the world
and asks START OVER? Keyboard: Y yes, N/Backspace/Esc/P no (Enter and
Space are A, so mashing through the lines never answers); touch: YES / NO
buttons, and YES is ignored for the first 600 ms. No puts the hero back at
the machine. Yes drops the save here and on the profile (best time kept)
and starts a fresh quest on the plaza. Petter mentions the machine when
you talk to him.

**Signed in: the save follows the account** (2026-09-29). Nobody has to sign in to walk the town, but when the session
check finds an account (`Zelda.vue` `checkSession`, or the console just signed one in), `usePortalAccountLink`
(`composables/useAccount.ts`) posts `/api/account/link` and the browser adopts the account's player profile, then
`syncProfile` brings the profile's save in (newest `savedAt` wins, as before). One account, one profile on every
device: Neon Shrine's save and best time, the bits wallet, the hero's colours and the Hall of Fame scores. A profile
that belongs to an account answers `/api/save` only to its owner (401/403 otherwise); anonymous play is unchanged.
A different account than the last one signing in on the browser clears the local copies (`zeldaSave`, `zeldaBest`,
`zeldaClearedAt`, the wallet, the profile) and reloads. Signing out in the console keeps the local copy and does not
reload, so writes fail (403) until someone signs in again. Outside Norway `/api/account/*` answers 403, so the link
is skipped and the town plays anonymously. Tests: `tests/miniworld-account.test.mjs` ("Neon Shrine's slot").

**Login console.** Sleeper, Petter's server, stands against the east wall
of his house by the aquarium (tile 13,3 of `home`; exit id `login`, look
`console`, target `{ panel: 'account' }`): a violet tower with a glowing
login prompt, a blinking cursor and status lights, drawn in
`render/exits.ts`. Facing it and pressing A makes the engine emit `panel`
(no lines, no fade); the shell opens `AccountConsole.vue` over the world,
which stands still but keeps glowing, with the touch deck and the Escape
pill out of the way. Petter mentions it when you talk to him.

The panel is Neon Shrine's dialog box in the pixel font (SLEEPER ACCOUNT).
On open it asks `GET https://auth.phareim.no/api/session` with the cookie
(`credentials: 'include'`, 6 s timeout) and shows one of:

- signed out: NOBODY LOGGED IN, then LOG IN, CREATE ACCOUNT, CLOSE and the
  note that new accounts need the invite phrase;
- signed in: LOGGED IN AS the name (or the email's first part) and the
  email, then LOG OUT (`POST /api/sign-out` with the cookie, then the
  signed-out view) and CLOSE;
- unreachable, refused or a body that is not the contract (local dev: the
  server's CORS only reflects phareim.no and *.phareim.no): NO CARRIER, and
  still LOG IN and CREATE ACCOUNT.

LOG IN and CREATE ACCOUNT save (with the blade), write `portal.return` =
`{ map: 'home', entry: 'login' }`, close the panel and load
`https://auth.phareim.no/?theme=neon&redirect=<origin>/` (plus
`&mode=signup`), so the auth page's redirect brings the hero back standing
at the console. A modified click (new tab) is left to the browser. The auth
address lives only in `account.ts` (`AUTH_BASE`).

Keys belong to the panel while it is open, caught on `window` in the
capture phase: arrows / WASD / Tab choose, Enter / Space / J / Z press,
Escape / Backspace / K / X close (the hero stays in the house). Presses in
the first 350 ms are ignored, so the A that opened it does not also press
LOG IN. Touch: tap a button; a tap beside the box closes it. The box is at
most 360 px wide, centred above the bottom band.

**Page.** The canvas fills the locked viewport. The hint ("ARROWS TO WALK ·
SPACE TO TALK" / "DRAG TO WALK · A TO TALK") fades in and goes at the first
step; it is skipped once `portal.return` exists. Winning shows the ending
panel (THE SUN SETS AT LAST, play time, NEW BEST!); Enter or a tap after
1.2 s closes it and play goes on where the prism was taken, the run kept
(the NEW GAME machine in Petter's house is the way to a fresh quest). A visually hidden `nav` holds the
h1 name, the blurbs from `themes/content.ts`, a link to every live game,
phareim.md, games.phareim.no and the three profiles. It shows as a panel
while one of its links has keyboard focus.

**The loop.** `frame()` runs on every animation frame, but most frames do
nothing. Paused, the world is drawn with `dt` 0, so the output is the previous
frame again: it is drawn once on the frame that changed the picture and then
left alone. The ending and an open panel keep a soft glow going, which a
redraw at a fifth of the rate cannot show. A hidden tab draws nothing. The
rAF stays scheduled throughout, so no state has to remember to restart it —
input and unpausing are handled by listeners, not the loop (2026-09-30).

**Checks** (2026-09-24; NEW GAME machine 2026-09-26). `npm run test:portal` (in CI): the world
validates; it starts on the plaza facing the name, and the town and its
rooms have no enemies; the arcade's cabinets are exactly its nine games, Adventure and Pizza Rescue (the VIP hall's are Mini World, Lag Din Figur and Eventyrland),
each ending on INSERT COIN? PRESS {A}.; PIZZA RESCUE leaves for `https://fighter.phareim.no/?look=wasteland&from=phareim`,
is no id in the theme registry, has its own marquee and screen, and blocks nothing in the hall (every exit, the counter, the robot, the signs and the chest are still walked up to; 2026-10-05); Adventure, Pizza Rescue and Night of the Dead Battery stand side by side on the island, the middle one in the door's column and all three nearer the door than any other cabinet (2026-10-06); the NEW GAME machine
says there is nothing to wipe before the blade, and after it asks once and
never leaves the game; the beach lies only east of the pier and has two DJ booths
on the sand between the road and the sea, blocked behind and beside, open
in front, Jam on the left to jam.phareim.no and the records on the right to
radio.phareim.no (`?from=phareim`), a bonfire, a smoker, a guitar and a sleeper among at least
six who stay put, and the sand plays the `beach` track while the road plays
the town's (2026-09-26); every
exit goes where it should and
nothing carries an email address; at the start the name and at least two
buildings are in view at phone and desktop view sizes; a path-finding
walker reaches and uses every exit (but the NEW GAME machine) from the start without a scratch;
coming back stands the hero in front of the exit used (and the old `plaza`
map id is refused); the login console sits on a machine tile in Petter's
house, is walked to from the plaza with or without the blade, and A emits
one `panel` event and never leaves (`tests/portal-world.test.mjs`);
`tests/portal-account.test.mjs` runs `account.ts` against a fake fetch (in,
out, refused, 500, bad bodies, a hang past the timeout, sign-out), checks
the auth page links and that the address lives in one place, and reads the
shell's source for the event → panel wiring; the coast road leads to the Keeper's hut and the Keeper
tells the story on the way. Checked headless in the dev server the same
day at 1280×800 and 390×844 (3×, touch): the start, the road and the
Keeper's story, the blade, the HUD and the floating buttons, pause → TO TOWN,
back in front of the Galaga cabinet after a reload, the cabinet into
Galaga and the back button to the cabinet; no page errors. The NEW GAME
machine headless at 1280×800 on 2026-09-26: A mashed through its lines
leaves the question open, N plays on with the save kept, Y clears the save
and `portal.return` and starts on the plaza. Not checked: the touch YES/NO
buttons, a real phone, iOS audio wake-up, the phareim.md and games.phareim.no exits
leaving the site.

The login console headless in the dev server on 2026-09-26 at 375×667
(2×, touch) and 1280×800, with auth.phareim.no faked over CDP
(`scripts/zelda-lab/console-shot.mjs`): unreachable, signed out, signed in,
LOG OUT, Escape closing it in the house, LOG IN leaving for the auth page
and coming back at the console; no page errors. Not checked: the real
auth.phareim.no (not live then), its cookie on a real phone, Safari.

The YES / NO question at the Galaga cabinet headless in the dev server on
2026-09-26 at 1280×800 and 390×844 (2×, touch)
(`scripts/zelda-lab/exit-shot.mjs`): → then Space stays, an Escape tap
stays, a tap on the right half stays. `test:portal` runs every exit with
lines through B, NO, a NO tap and YES. Not checked: a real phone.

The VIP hall (2026-09-29): `tests/portal-world.test.mjs` checks the rope
(three solid tiles in the row in front of the door, gone with a session, back
without one, never closing on the hero), the guard's two branches (a
`panel` event for `account` and no exit when not logged in, no panel and no
exit when logged in), the return entry in front of him, that a save never
holds the session, that the bar has its counter, shelf and a bartender who talks across it, and that a path-finding walker reaches the door and the
cabinets only with a session. Headless in the dev server at 1280×800
and 375×667 with auth faked over CDP (`scripts/zelda-lab/vip-shot.mjs`):
the rope holds against walking into it (the inside of the hall: `scripts/zelda-lab/vip-inside-shot.mjs`), the guard's lines open the panel,
and with a session the rope is gone and the hero walks in to both cabinets;
no page errors. Not checked: the real auth.phareim.no, a real phone.

The arcade's layout and Pizza Rescue's cabinet (2026-10-06): rendered by the
look lab, without Nuxt (`node scripts/zelda-lab/shot.mjs <outDir> r-arcade,r-fighter`:
the hall from the door, and the hero at the cabinet with its label) at
1280×800 and 390×844 (3×). The game's side of the way back (the ARCADE
button with `from=phareim`, none without) is checked by its own
`tools/check-live.mjs`. The whole loop was walked on the live sites the same
day in headless Chromium, at 1280×800 and at 844×390 with touch: standing at
the cabinet, A through the pitch and YES, the game's title with ARCADE,
into a game, pause, ARCADE, and the hero in front of the cabinet again with
`portal.return` = `{ arcade, pizzarescue }`; no page errors. Not checked: a
real phone, and the touch YES tap on this cabinet.

**Known.** On a desktop, once the hero has the blade, the HUD (hearts,
bits, item box) sits over the left end of PETTER HAREIM at the start, as
the HUD sits over the world everywhere.

**What would make it redundant.** A different front door for phareim.no.
Then point `/` at the new landing in `useTheme`, and decide whether Neon
Shrine gets its own theme page back or the town's maps go.
