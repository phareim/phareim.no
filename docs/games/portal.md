## The Portal — phareim.no's front door (built 2026-09-24, one world since the same day)

`/` is the Portal: a small neon town you walk around in, and the west end
of Neon Shrine's world. Petter's name is painted on the roof of his house.
The buildings lead to everything else on the site: the arcade (a cabinet
per game, the Hall of Fame board, the Hangar door), Petter's house (who he
is, three terminals to his profiles, the login console), the PHAREIM.MD newsstand, the radio
station (the generative radio, `docs/games/radio.md`; 2026-09-25) and the
GAMES.PHAREIM.NO signpost. West, the shore road ends in a thicket: cut it
with the blade and it leads into the Wildwood (`docs/games/wildwood.md`).
The coast road runs east along the water into
Home Glade and round to the Keeper's hut, where the adventure begins
(`docs/games/neon-shrine.md`). It replaced Player One, the random
first-visit theme and, later the same day, Neon Shrine's own theme page.
Design and the reasoning behind the layout: `themes/portal/DESIGN.md`.

**Files.**

| File | Job |
|---|---|
| `themes/zelda/world/overworld.ts` | The overworld, 104×48. The town is columns 0–39 (`TOWN_W`): house and name, arcade, fountain, newsstand, radio station, signpost, pier, the kid and the cat, the coast road east, the thicket and warp west into the Wildwood |
| `themes/zelda/world/town.ts` | The arcade, 17×11 (eleven cabinets, Mini World's the tenth by the HANGAR door and Lag Din Figur's the eleventh in the corner beside it, the board, HANGAR door, prize counter and vendor, the robot, the HIGH SCORES sign, a chest) and Petter's house, 15×10 (LinkedIn, GitHub and Bluesky terminals, the red NEW GAME machine, the login console, no email on purpose, Petter at his desk) |
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
station's door, the signpost and the terminals show their lines when you face them and press A; closing
the lines fades out and leaves. The HANGAR door leaves as you step on it.
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

**Pause menu.** RESUME · TO TOWN (T): saves and puts the hero on the plaza
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

**Checks** (2026-09-24; NEW GAME machine 2026-09-26). `npm run test:portal` (in CI): the world
validates; it starts on the plaza facing the name, and the town and its
rooms have no enemies; the cabinets are exactly the ten arcade games,
each ending on INSERT COIN? PRESS {A}.; the NEW GAME machine
says there is nothing to wipe before the blade, and after it asks once and
never leaves the game; the radio station's door sits in
its wall under a RADIO sign and leads to `?theme=radio` (2026-09-25); every
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

**Known.** On a desktop, once the hero has the blade, the HUD (hearts,
bits, item box) sits over the left end of PETTER HAREIM at the start, as
the HUD sits over the world everywhere.

**What would make it redundant.** A different front door for phareim.no.
Then point `/` at the new landing in `useTheme`, and decide whether Neon
Shrine gets its own theme page back or the town's maps go.
