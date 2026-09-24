## The Portal — phareim.no's front door (built 2026-09-24)

`/` is the Portal: a small neon town you walk around in, drawn with Neon
Shrine's engine, renderer and audio. Petter's name is painted on the roof
of his house. The buildings lead to everything else on the site: the
arcade (a cabinet per game, the Hall of Fame board, the Hangar door), the
Keeper's hut (into Neon Shrine), Petter's house (who he is, three terminals
to his profiles), the PHAREIM.MD newsstand and the GAMES.PHAREIM.NO
signpost. It replaced Player One and the random first-visit theme. Design
and the reasoning behind the layout: `themes/portal/DESIGN.md`.

**Files.**

| File | Job |
|---|---|
| `themes/portal/world/plaza.ts` | The town square, 40×38: house and name, arcade, hut, fountain, newsstand, signpost, pier, the kid and the cat |
| `themes/portal/world/arcade.ts` | The hall, 17×11 (fits one desktop screen): four cabinets beside the Hall of Fame board on the back wall, four on an island, a carpet loop, the HANGAR door, the prize counter and vendor, the robot |
| `themes/portal/world/home.ts` | Petter's house, 15×10: the LinkedIn, GitHub and Bluesky terminals (no email, on purpose), Petter at his desk, shelves, sofa, rug, aquarium, plants, a framed print |
| `themes/portal/world/index.ts` | `PORTAL_WORLD` (`peaceful: true`), `portalExits()`, `worldStartingAt()` |
| `themes/portal/Portal.vue` | The shell: loop, input, touch A button, audio, exits, the way back |
| `themes/portal/Landing.vue` | The page: canvas, the first-move hint, the hidden link index |
| `themes/zelda/input.ts` | Keyboard, pointer and floating-stick input, shared with Neon Shrine's `Zelda.vue` |

**Controls.** Arrows or WASD walk; Space, J, Z or Enter is A (talk, read,
use). Touch: drag anywhere on the left 60 % for a floating stick; the A
button sits bottom right, and a tap on the right of the world is A too.
Any tap moves a dialog on. There is no sword, no pause, no save, and the
hero cannot be hurt. The portal locks theme navigation while it is shown,
so arrows and swipes walk the hero. Tab is left to the browser.

**Leaving and coming back.** A cabinet, the board, the kiosk, the signpost
and the terminals show their lines when you face them and press A; closing
the lines fades out and leaves. The hut door and the HANGAR door leave as
you step on them. On the engine's `exit` event the shell writes
sessionStorage `portal.return` = `{ map, entry: <exit id> }`, then calls
`useTheme().launch(theme)` or `location.assign(url)`. On mount it reads
`portal.return`, checks the map and entry exist (`worldStartingAt`), and
starts there: in front of the cabinet, outside the door. Back from a URL
through the browser's page cache, `pageshow` restarts at that spot; a theme
exit that has not navigated after 2.5 s comes back too.

**Neon Shrine from the hut.** `launch('zelda')` records `portalLaunch`.
Neon Shrine's `Landing.vue` takes it when it is under 10 s old, keeps the
title hidden while the profile save syncs (at most 1.5 s), then calls
`Zelda.vue`'s exposed `start()`: it continues the save, or starts a new game
with the hero stepping out of the hut door. Inside the hut, THE WAY HOME
(an exit `{ home: true }`) saves and calls `goHome()`. Audio for a run that
began without a key or tap wakes on the first one.

**Page.** The canvas fills the locked viewport. The hint ("ARROWS TO WALK ·
SPACE TO TALK" / "DRAG TO WALK · A TO TALK") fades in and goes at the first
step; it is skipped once `portal.return` exists. A visually hidden `nav`
holds the h1 name, the blurbs from `themes/content.ts`, a link to every game
in the rotation, phareim.md, games.phareim.no and the three profiles. It
shows as a panel while one of its links has keyboard focus.

**Checks** (2026-09-24). `npm run test:portal` (in CI): the world validates;
it is peaceful and starts facing the name; the cabinets are exactly the
eight arcade games, each ending on INSERT COIN? PRESS {A}.; every exit goes
where it should and nothing carries an email address; at the start the name
and at least two buildings are in view at phone and desktop view sizes; a
path-finding walker reaches and uses every exit from the start and gets the
right `exit` event, taking no damage on the way; coming back stands the hero
in front of the exit used; the kid and Petter say their lines. Checked in
headless Chromium over CDP the same day at 390×844 (3×, touch and keyboard)
and 1280×800: the start views, the Galaga cabinet's lines, launch, back
button to the cabinet, Petter's house, the hut into Neon Shrine without the
title, and THE WAY HOME back to `/`. Not checked: a real phone, iOS audio
wake-up, and the phareim.md and games.phareim.no exits leaving the site.

**What would make it redundant.** A different front door for phareim.no.
Then delete `themes/portal/`, `tests/portal-*.mjs` and `test:portal`, and
point `/` at the new landing in `useTheme`.
