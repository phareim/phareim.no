# The frame: a game on another address, inside this page

Six cabinets lead to games on their own addresses: Adventure
(`adventure.phareim.no`), Pizza Rescue (`fighter.phareim.no`), its sequel
Solo Rescue (`nova.phareim.no`, since 2026-10-13), Eventyrland
(`eventyrland.phareim.no`), Supermusene (`maileg.phareim.no`, since
2026-10-21) and Vector Horizon (`space.phareim.no`, since 2026-10-28, the
arcade's machine under test). In a browser tab the cabinet loads the address, as
before. Installed as a web app (Home Screen), leaving the app's own address
makes the phone open its browser sheet over the game, with an address bar and
a Done button. No manifest setting avoids that on iOS: an app's scope is one
origin. So the installed app never leaves: the game is shown in an `<iframe>`
that fills the screen, on `/?frame=<id>` (2026-10-12).

## Files

| File | What |
|---|---|
| `themes/frames.ts` | `FRAMED_GAMES`: exit id → name and address; `framedGame(id)`; the message names |
| `composables/useFrame.ts` | `isInstalledApp()`; `framed` (from the route), `enter(id)`, `leave()` |
| `components/GameFrame.vue` | The frame: the iframe, the insets it measures, the fallback house |
| `app.vue` | Renders `GameFrame` instead of the page when the route names a framed game |
| `themes/zelda/Zelda.vue` `leave()` | Asks `enterFrame(id)` first, then `location.assign` |

`/?frame=<id>` names an entry in `FRAMED_GAMES` or nothing; an address is never
read from the URL (a dev server takes `&src=http://localhost:…` to frame
another dev server; a build ignores it). `enter` pushes a history entry and
`leave` steps back to the town, where `portal.return` stands the hero in front
of the cabinet, as after a theme. Opened directly, `/?frame=pizzarescue` shows
the frame in any browser, which is how to look at it on a desktop.

## What the frame and a game say to each other

`postMessage`, each message an object with a `type`:

| From | Message | Meaning |
|---|---|---|
| game | `phareim:hello` | The game listens and has no way home on screen: tell it about the screen, and keep (or bring back) the frame's ⌂ |
| game | `phareim:ready` | The game's own way home is on screen: the frame's ⌂ goes |
| game | `phareim:home` | Back to the town |
| frame | `phareim:frame`, `insets: { top, right, bottom, left }`, `installed` | The screen's safe edges in CSS px and whether the page is an installed app; sent as the answer to any message and again on resize |

The frame reads a message only from its own iframe's window and the framed
address's origin. A game reads `phareim:frame` only from its parent window.
No message carries anything but its name and the four numbers.

**The way home.** The frame shows a ⌂ in HomeChip's corner 2.5 s after it
opens and keeps it until the game says `phareim:ready`. A page that never says
it (blocked outside Norway, offline, an old cached build) therefore still has
a way out. A game says `phareim:hello` again when something covers its way
home: Eventyrland does when its sign-in window comes up over the game, and the
⌂ returns. Escape leaves too while the game does not hold the keys.

**What the game may use.** The iframe's `allow` list: `autoplay`,
`fullscreen`, `gamepad`, `screen-wake-lock`, and `accelerometer`, `gyroscope`,
`magnetometer` for Eventyrland's tilt steering. A feature a game adds later
(the camera, sharing) needs its word there, or the frame refuses it.

**The insets.** The frame measures `env(safe-area-inset-*)` itself and sends
them, because a page in a frame may read them as 0. Each game takes the larger
of its own reading and the frame's.

## The games' side

| Game | Framing allowed by | Hello / insets | Way home |
|---|---|---|---|
| Eventyrland, Adventure (one build) | `frame-ancestors https://phareim.no` in `public/_headers` and `public/_worker.js` | `joinArcade()` in `src/game/arcade.ts`, first thing at boot (sets the page's `--inset-*`) | "Tilbake til spillehallen" in the settings; `src/game/arcade.ts` |
| Pizza Rescue | no header: any page may frame it | `src/main.ts` (`--frame-*` in `ui.css`, `data-edges` for the pixel look's own readouts) | ARCADE on the title and the pause panel |
| Solo Rescue (`~/github/nova`, built on Pizza Rescue's engine) | no header: any page may frame it | the same code in its `src/main.ts` | ARCADE on the title and the pause panel |
| Supermusene (`~/github/maileg`) | no header: any page may frame it | `src/game/arcade.ts`, at boot when the address says `from=phareim` | "Til arkaden" on the title and in the pause menu |
| Vector Horizon (`space.phareim.no`, 2026-10-28) | not known here: the game's own repo decides | not known here | ARCADE back to `https://phareim.no/` when the address says `from=phareim` |

## Adding a game

1. Add its exit id and address to `FRAMED_GAMES`; the address must be the
   exit's own (`tests/portal-world.test.mjs` compares them).
2. In the game: allow `https://phareim.no` as a frame ancestor if it sends a
   `frame-ancestors` or `X-Frame-Options` header.
3. In the game: say `phareim:hello` at start, take `phareim:frame`'s insets,
   say `phareim:ready` once a way home is on screen, and send `phareim:home`
   from it when `window.parent !== window`. A link to `https://phareim.no/`
   would load the town inside the frame.

The beach's two booths (Jam, the radio) and the KODING KATA stand
(kata.phareim.no, 2026-10-27) still leave the app. The radio needs
step 3 in `components/TownChip.client.vue`; Jam sits behind Reader's login,
whose page must be seen to work in a frame first.

## What is and is not checked

Checked 2026-10-12: `npm run test:portal` (the table against the town's exits,
what may be framed, the messages), and `scripts/zelda-lab/frame-shot.mjs` on
zap (headless Chrome, 1280×800, `navigator.standalone` faked, safe edges faked
to 47 px top and 34 px bottom) against dev servers of all three sites:

- YES at the Pizza Rescue cabinet stays on the page, on `/?frame=pizzarescue`;
  the live game (a build from before this) says nothing, the ⌂ shows after
  3 s, and it puts the hero back in front of the cabinet.
- Pizza Rescue's new build in the frame: told 47 and 34 px, its buttons move
  down, the ⌂ never shows, ARCADE puts the hero back in front of the cabinet.
- Eventyrland's new build in the frame: told the insets while the loading
  screen is up, the ⌂ goes at the first frame, and "Tilbake til
  spillehallen" → "Ja, ut av Eventyrland!" in the settings puts the hero back.
- With `navigator.standalone` not set, the same YES loads the address, as
  before.

The same day against the live site, after all three had deployed
(`frame-shot.mjs https://phareim.no/ <out> --live` from zap, in Norway):

- YES at the cabinet stays on `https://phareim.no/?frame=pizzarescue`.
- Pizza Rescue (live) in the frame: told the insets, says ready, ARCADE
  returns to `/`.
- Adventure (live, v1225) in the frame: `frame-ancestors https://phareim.no`
  lets it load, it is told the insets, says ready at the first frame, and the
  settings' way back returns to `/`.

Solo Rescue, 2026-10-13, against the live site the same way
(`frame-shot.mjs https://phareim.no/ <out> --live`, Chrome on the Mac):
`/?frame=nova` shows `https://nova.phareim.no/?from=phareim`, the game is told
the insets (47 and 34 px), says ready, and ARCADE returns to `/`. Not walked
there: YES at its cabinet (the script walks Pizza Rescue's; the shell's code
is the same for every framed exit).

Vector Horizon, 2026-10-28: only `npm run test:portal` (the table against
the town's exit, `/?frame=horizon`). `frame-shot.mjs --live` has a
`liveHorizon` step (it clicks the game's ARCADE), but it was not run: the
cabinet was not on phareim.no yet, and space.phareim.no still served an older
page that morning. Open: whether the game allows the frame, says hello and
ready, and takes the insets; until it says ready the frame's ⌂ is the way
home.

In the first run the live Pizza Rescue, on another site than the dev page, read its
own `env()` insets as 0 inside the frame; the dev servers on localhost read
the faked ones. That is Chrome. What iOS gives a framed page is not known,
which is why the frame sends them.

Not checked: a real iPhone or iPad with the site on the Home Screen. Open
there: that no browser bar shows, that sound starts after the first tap
inside the game, that the HUD clears the notch and the home indicator in
both games, standing and lying, that signing in to Eventyrland works inside
the frame (the window signs in with `fetch`; "Spør en voksen" loads
auth.phareim.no in the frame and comes back), and that tilt steering gets its
permission there.

A Home Screen app keeps its own storage, apart from Safari's. A framed
Eventyrland therefore starts without Safari's save: a signed-in player gets
hers from the account, a guest on Adventure starts new there.

## What would make it redundant

Scope extensions for web apps on iOS (one installed app covering several
origins). Then the exits can load the address again and this page can go.
