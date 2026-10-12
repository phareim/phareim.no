# The frame: a game on another address, inside this page

Three cabinets lead to games on their own addresses: Adventure
(`adventure.phareim.no`), Pizza Rescue (`fighter.phareim.no`) and Eventyrland
(`eventyrland.phareim.no`). In a browser tab the cabinet loads the address, as
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
| game | `phareim:hello` | The game listens: tell it about the screen |
| game | `phareim:ready` | The game's own way home is on screen |
| game | `phareim:home` | Back to the town |
| frame | `phareim:frame`, `insets: { top, right, bottom, left }`, `installed` | The screen's safe edges in CSS px and whether the page is an installed app; sent as the answer to any message and again on resize |

The frame reads a message only from its own iframe's window and the framed
address's origin. A game reads `phareim:frame` only from its parent window.
No message carries anything but its name and the four numbers.

**The way home.** The frame shows a ⌂ in HomeChip's corner 2.5 s after it
opens and keeps it until the game says `phareim:ready`. A page that never says
it (blocked outside Norway, offline, an old cached build) therefore still has
a way out. Escape leaves too while the game does not hold the keys.

**The insets.** The frame measures `env(safe-area-inset-*)` itself and sends
them, because a page in a frame may read them as 0. Each game takes the larger
of its own reading and the frame's.

## The games' side

| Game | Framing allowed by | Hello / insets | Way home |
|---|---|---|---|
| Eventyrland, Adventure (one build) | `frame-ancestors https://phareim.no` in `public/_headers` and `public/_worker.js` | the script at the top of `index.html` (`--frame-*`) | "Tilbake til spillehallen" in the settings; `src/game/arcade.ts` |
| Pizza Rescue | no header: any page may frame it | `src/main.ts` (`--frame-*` in `ui.css`, `data-edges` for the pixel look's own readouts) | ARCADE on the title and the pause panel |

## Adding a game

1. Add its exit id and address to `FRAMED_GAMES`; the address must be the
   exit's own (`tests/portal-world.test.mjs` compares them).
2. In the game: allow `https://phareim.no` as a frame ancestor if it sends a
   `frame-ancestors` or `X-Frame-Options` header.
3. In the game: say `phareim:hello` at start, take `phareim:frame`'s insets,
   say `phareim:ready` once a way home is on screen, and send `phareim:home`
   from it when `window.parent !== window`. A link to `https://phareim.no/`
   would load the town inside the frame.

The beach's two booths (Jam, the radio) still leave the app. The radio needs
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

In that run the live Pizza Rescue, on another site than the dev page, read its
own `env()` insets as 0 inside the frame; the dev servers on localhost read
the faked ones. That is Chrome. What iOS gives a framed page is not known,
which is why the frame sends them.

Not checked: a real iPhone or iPad with the site on the Home Screen. Open
there: that no browser bar shows, that sound starts after the first tap
inside the game, and that the HUD clears the notch and the home indicator in
both games, standing and lying.

A Home Screen app keeps its own storage, apart from Safari's. A framed
Eventyrland therefore starts without Safari's save: a signed-in player gets
hers from the account, a guest on Adventure starts new there.

## What would make it redundant

Scope extensions for web apps on iOS (one installed app covering several
origins). Then the exits can load the address again and this page can go.
