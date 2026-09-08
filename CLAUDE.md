# CLAUDE.md

Personal site, Nuxt 3 on Cloudflare Pages. The landing page is a set of
swipeable **themes**; the theme system and how to add a theme live in the
project skill `.claude/skills/phareim-theme/SKILL.md` (use it).

## ⚠️ History note — lots of reverted work worth mining

On **2026-05-28** the top of `master` was intentionally reset back to the **April 2 snapshot** (commit `887aa6a`) via a single snapshot-revert commit (`66d257c`). This was a taste decision: the owner disliked the page-shift navigation animations and the cinematic theme-switch effect and prefers the calmer, simpler look. **No history was lost** — the reverted commits are all still in the graph.

The reverted range `887aa6a..4b93c52` contains **~217 commits** (≈2 months of work) with a lot worth bringing back later: many content pages (`/now`, `/feed`, `/uses`, `/colophon`, `/guestbook`, `/gallery`, `/stats`, `/activity`, …), backend APIs (unified Bluesky/X feed, RSS, D1 guestbook, R2 gallery, richer projects API), a Cmd+K command palette, keyboard navigation, accessibility wins, **and a later single-theme "Almanac" paper redesign** (`dc02650`, `c70bba1`, `b24da6b`, `d706eff`) — it was back as a theme (`themes/almanac/`) 2026-09-03 to 2026-09-05 and removed again because it was the only landing that needed to scroll (last commit with it: `1bd327a`).

When restoring things: cherry-pick onto this base, and **leave out the background-canvas animations, page slide/zoom transitions, theme-switch cinematics, menu stagger, and count-up effects** — that motion is exactly what was reverted. Tier-1 hardening (security dep bumps, Vue3 `beforeUnmount` fix, SSR hydration fix, CI injection fix) was already brought forward in commit `1a1b7d5`.

> Tip: `git log --oneline 887aa6a..4b93c52` lists everything; `git show <sha>` to inspect.

## Commands

- `npm run dev` — dev server on port 3030 (host 0.0.0.0)
- `npm run test:tetris` — gesture regression tests (tap, direction lock, drop, soft drop, hold); CI runs these before typecheck
- `npm run test:leaderboard` — Hall of Fame name generator/validator and game list (2026-09-08)
- `npm run typecheck` — `nuxi typecheck` (vue-tsc); CI runs this before build
- `npm run build` — production build; the `cloudflare-pages` preset is set in `nuxt.config.ts`, output goes to `dist/`
- `npm run preview` — preview built site

## Stack

- **Framework**: Nuxt 3 + Vue 3 Composition API + TypeScript (`themes/scandi/Bubbles.vue` is Options API, moved verbatim)
- **Hosting**: Cloudflare Pages, project `phareim-no`. SSR runs in the Pages worker (`_routes.json` sends everything except static assets to it), which is what lets the random first-visit theme be picked server-side.
- **Database / storage**: one D1, `phareim-leaderboard` (id `54e101f9-4026-4fd1-a78a-7a8976e1301e`, created 2026-09-08), bound as `LEADERBOARD_DB` in `wrangler.toml`, schema in `migrations/`, applied by CI before every deploy. It holds the Hall of Fame only — see that section. The older D1 (`phareim-rpg`) was deleted 2026-07-23 (export at `~/backups/d1/2026-07-23/phareim-rpg.sql` on Sleeper); the R2 binding and the image-generation API were removed 2026-09-03.
- **External APIs**: one — wave-jobs on Sleeper (`POST https://sleeper.phareim.no/wave-jobs/avatar`, Bearer `WAVE_JOBS_KEY`) paints the Hall of Fame avatars (2026-09-08). `server/` came back 2026-09-08 with the Hall of Fame routes (`/api/leaderboard`, `/api/player`, `/api/score`, and `/api/avatar` for wave-jobs' callback) and nothing else.
- **Dependencies of note**: `three` 0.185 (+ `@types/three`), used only by the Star Fox theme and loaded as an async chunk (2026-09-05); `@fontsource/space-grotesk` + `@fontsource/space-mono` (self-hosted fonts, 2026-09-06)
- **Fonts** (2026-09-06): two faces, the Neon Dreams split — `--font-person` (Space Grotesk at weight 300, the face's lightest, for body, name and page titles; 400/500 for emphasis: name, blurbs, prose) and `--font-machine` (Space Mono: HUD, hints, over-titles, canvas score pops, shas). Defined on `:root` in `themes/base/fonts.css` (imported first in `themes/index.ts`), latin subsets only; canvas code imports `MACHINE_FONT` from `themes/base/fonts.ts`. Nothing loads from Google Fonts any more (Comfortaa and the preconnects are gone). The parked themes keep their own faces (desk: ET Book).
- **State**: Nuxt `useState` + a `theme` cookie (no state library). localStorage holds per-game high scores and, since 2026-09-08, the browser's Hall of Fame player (`phareim.player`).

## Project Structure

```
app.vue              — root shell: theme class, theme backdrop, <NuxtPage>, ThemePager; global CSS locks the document (no scrolling)
pages/
  index.vue          — renders the active theme's Landing component (180 ms fade on switch)
error.vue            — per-theme 404 blocks
components/
  ThemePager.vue     — neon edge chevrons (all devices since 2026-09-07; hidden while a theme locks navigation) + dots; the only site chrome
server/
  api/               — leaderboard.get, player.post, score.post, avatar.post (the Hall of Fame API, 2026-09-08)
  utils/store.ts     — D1 store + in-memory dev store behind one interface, id validation
  utils/avatar.ts    — asks wave-jobs on Sleeper to paint a player's pilot (callback into avatar.post)
migrations/          — D1 schema for phareim-leaderboard, numbered SQL, applied by CI
composables/
  useTheme.ts        — active theme, cookie, setTheme/next/previous, navigationLocked
  useThemeNavigation.ts — swipe + ArrowLeft/ArrowRight, called once from app.vue
  useInputMode.ts    — keyboard vs touch, so game hints say PRESS ENTER or TAP, never both (2026-09-06). SSR guess from sec-ch-ua-mobile/UA, then `(hover: none) and (pointer: coarse)` at mount, then the first keydown/touch/mouse press wins. `hint(keyboardText, touchText)` in templates.
  useLeaderboard.ts  — the browser's Hall of Fame player (localStorage), submitScore / fetchBoards / reroll (2026-09-08)
themes/              — see the phareim-theme skill
  index.ts           — registry (order = swipe order) and every theme.css import
  content.ts         — default landing copy
  base/              — DefaultLanding shell, ProfileCard, SocialLink, fonts.css + fonts.ts (site fonts, 2026-09-06), neonHorizon.js (the shared synthwave backdrop: sky, stars, striped sun, ridge, grid, heartbeat, wave-clear flare — used by Breakout, Invaders and Tetris since 2026-09-06; Star Fox draws its own in three.js)
  _template/         — starting point for a new theme
  anotherworld/ scandi/ hacker/ breakout/ rtype/ invaders/ starfox/ tetris/ leaderboard/ space/ desk/
```

There is no menu (removed 2026-09-03) and, since 2026-09-07, no page routes
but `/`: about, projects and meta are deleted, along with the GitHub token
that fed them. The only server code is the Hall of Fame API (2026-09-08). Who Petter is and how to reach him is the
**Player One** theme's job. Restore from git history if they are ever wanted
back.

## Theme System (short version — the skill has the rest)

- Thirteen themes, nine live (2026-09-08; the ninth is **Hall of Fame**, last in the rotation — see its section). **Another Shore II** (parked 2026-09-07 — the “WALK — ENTER” take), **Scandinavian Glass**, **Space** and **Tufte Desk** (parked 2026-09-06) (`disabled: true` in `themes/index.ts`: out of swipe, pager, cookie and random pick; still reachable with `?theme=<id>`; nothing deleted). In swipe order: **Player One** (the profile theme, first in the list, added 2026-09-07 — see below), **Another Shore**, **Another Shore II**, **Scandinavian Glass**, **Cyberpunk** (a loose Space-Invaders-inspired shmup; the green outlier of the Neon Dreams family since 2026-09-06 — same text/glow/card recipes, own hues, gold powerups), **Breakout** (the arcade classic, added 2026-09-04; same canvas-behind-the-card pattern as Cyberpunk, plays itself until Enter. Re-skinned 2026-09-06 onto the Neon Dreams design system, `~/github/neon-dreams-design`: three neons with three jobs — cyan paddle/ball/HUD, pink bricks in three tints, gold armoured bricks and powerups — over the shared horizon backdrop `themes/base/neonHorizon.js`, which beats on every hit; done as two parallel Muse jobs via `/musecode`, Claude reviewed), **R-Type** (endless side-scrolling shooter in neon-vector outline style, added 2026-09-05; attract-mode autopilot until Enter/tap, Force pod on Shift/double-tap, charge beam on held Space, procedural cave walls that narrow with distance, kill-streak multiplier; built by Muse Spark via `/musecode` in three parallel variants, this one won; on the Neon Dreams contract since 2026-09-06 — violet-black ground, cyan snapped to `#2ff3ff`, orange kept as its danger hue, gold multiplier from x4), **Space Invaders** (the faithful 1978 formation game in a synthwave look, added 2026-09-05: 5×11 formation with the original sprites, step-timer march that quickens as invaders die, eroding bunkers, mystery UFO, one shot on screen, kill-combo multiplier; sprite-shatter kills, screen shake, heartbeat-coupled grid and sun, pre-rendered glow sprite cache for phones; the backdrop comes from `themes/base/neonHorizon.js` since 2026-09-06. Also `/musecode`: three looks (phosphor cabinet, risograph paper, synthwave) → review/polish → two effect packages on the winner → review/fix; the losers are in git history, commits `8344268`..`d5436f7`), **Star Fox** (on-rails 3D flight shooter in three.js, added 2026-09-05: camera behind a low-poly Arwing, twin lasers, barrel roll with immunity on Shift/double-tap, rings to fly through, enemy formations, ground pillars and rocks, 3-hit shield, kill-streak multiplier; synthwave look that shares the Space Invaders palette — striped sun, pulsing grid, mountain silhouettes. Attract-mode autopilot until Enter/tap. Also `/musecode`: three looks (Super FX pixel render, neon vector, synthwave) → Claude review + Muse fix round → synthwave won; the losers are in git history up to commit `dbede6f`. three.js is loaded lazily by `starfox/Landing.vue` so the other themes do not pay for it), **Tetris** (playable Tetris, ported from `tetris-theme-legacy` and reworked for Neon Dreams on 2026-09-06: cyan active piece/ghost, pink stacked blocks, gold line clears, shared horizon with lock/clear pulses. Drag sideways to move, tap to rotate, fast down flick to hard drop, slow down drag to lower, up swipe or HOLD to stash. ROTATE/DROP, pause/resume and exit buttons work on touch and mouse. A gesture stops controlling pieces when its original piece locks or swaps; idle swipes still switch theme. The board sizes to its actual remaining container space with ResizeObserver; landscape phones use two columns. The profile column was removed 2026-09-07 — the cabinet is the whole theme now, and Player One carries the person), **Space**, **Tufte Desk** (the tactile paper-on-desk layer from the tufte-viz design system, added 2026-09-03; it replaced the flat Tufte theme 2026-09-04 and carries the ET Book @font-face). **Nothing scrolls** (2026-09-05): `html`/`body`/`#__nuxt` are `overflow: hidden` with `overscroll-behavior: none`, every landing is locked to the viewport — and since 2026-09-07 there is nothing but landings, so the `.page-scroll` container is gone too. Almanac, the one landing that needed the page to scroll, was removed 2026-09-05. First visit: random. Then: the `theme` cookie (one year). `?theme=<id>` overrides and re-sets the cookie.
- Each `themes/<id>/theme.css` defines the `--theme-*` contract on `.{id}-page` (ten tokens, listed in the skill). Pages read `var(--theme-*, fallback)` and never hardcode colours or branch on `prefers-color-scheme` — dark mode is each theme's own business.
- Each `themes/<id>/Landing.vue` owns the landing page. Most wrap `themes/base/DefaultLanding.vue`; a theme may replace the whole page.
- A theme that uses arrow keys or horizontal touch itself (the Cyberpunk and Breakout games) sets `navigationLocked` while it does.
- A landing must fit a phone viewport (checked at 375×667): the document does not scroll, so anything below the fold is unreachable.

## Key Patterns

- No `runtimeConfig` (2026-09-07). The Hall of Fame routes read their D1 binding and the `WAVE_JOBS_KEY` secret from `event.context.cloudflare.env` (2026-09-08), which needs no config; background work goes through `event.context.cloudflare.context.waitUntil`. If `runtimeConfig` comes back: secrets are set on Cloudflare by `NUXT_`-prefixed env vars, and server code **must** call `useRuntimeConfig(event)` — without the event, Workers return a config frozen at module init, before env vars exist, so the value silently never applies (found 2026-09-03).
- No auth system.

## Deployment

- **CI/CD**: `.github/workflows/deploy.yml` — `build` job (npm ci → test:tetris → typecheck → build → artifact) on push and PR; `deploy` job (wrangler `pages deploy dist`) on push to `master` only, then notifies Sleeper.
- `wrangler.toml` carries `pages_build_output_dir = "dist"`, `nodejs_compat` and the `LEADERBOARD_DB` D1 binding (2026-09-08). The deploy job runs `d1 migrations apply phareim-leaderboard --remote` before `pages deploy`, so the repo's `CLOUDFLARE_API_TOKEN` secret needs D1 edit rights (set to the host token 2026-09-08).
- Tetris gesture regression tests: `npm run test:tetris` (added 2026-09-06).

## Player One (2026-09-07)

`?theme=playerone` is the one theme whose job is Petter, not a game: a
blueprint panel over the shared Neon Dreams horizon
(`themes/base/neonHorizon.js` through `playerone/Horizon.vue`, with the sun
pushed right with its `sunX` option so it balances the panel instead of
sitting behind it) with the flip
photo, the name in Space Grotesk 300, the two blurbs, a ROLE/BASE readout,
and three contact rows — LinkedIn, GitHub, Bluesky. **No email address on
purpose** (decided 2026-09-07). It is the site's only profile surface: about/projects/meta were deleted the
same day, and Tetris lost its profile column.

Nothing moves but the backdrop, and nothing locks navigation. Wide screens
put the panel left of centre so the striped sun reads; phones drop the hint
and pad 46 px so the pager chevrons stay clear; landscape phones go
two-column and hide the HUD corners. Verified 2026-09-07 in headless
Chromium at 1440×900, 375×667, 390×844 and 667×375, plus a 404.

## Another Shore (2026-09-06)

`?theme=anotherworld` selects **Another Shore**, an original sidescrolling
platformer in the manner of Another World's flat polygon landscapes. First
in the live theme rotation. `themes/anotherworld/` holds `types.ts`,
`engine.ts` (pure physics + the authored level, no runtime imports),
`renderer.ts` (Canvas 2D through a 16-entry palette array) and
`Landing.vue` (loop, input, chrome). `DESIGN.md` there describes what is
built.

Reworked 2026-09-06 after an audit of the first version (branch `aw-fix`):
ground line at 84 % (80 % portrait), three background layers with mass
(monoliths, a headland, black arches and a foreground band), the sea as one
field with a horizon, moon top right clear of the profile and the
monoliths, slab edges from silhouette plus a lit top band. Sixteen colours
— 8 base + 8 lit — and four palettes that turn on a hard cut per beacon:
dusk → night → storm (one-frame lightning, not under reduced motion) →
dawn. The figure has six held run poses at 12 fps, hop vs running jump, a
landing crouch. Hazards have shape and show before they kill: a tide surge
on a 4 s cycle and a rockfall from a cracked overhang; deaths are 0.8 s
vignettes, then a hard cut to the checkpoint. The level is three places —
shore, causeway, tower — and the finish is climbing to the lamp. No HUD
boxes: beacon dots, pause/exit as text, outlined touch zones above the
pager dots. No sound.

Idle runs the same simulation on autopilot (it waits for the tide and the
rock, never dies, and holds the dawn 2.5 s before restarting); reduced
motion leaves the idle scene still. The game stays horizontal on phones
with a cropped following camera. No external assets, network calls or new
dependencies. Palette tokens also cover the content routes and the 404
block.

`npm run test:anotherworld` runs 14 engine tests (physics, tide, rockfall,
vignettes, demo traversal without deaths), also in CI.

Verified 2026-09-06 in headless Chromium: 1440×900, 375×667 and 667×375,
keyboard and touch, pause, the four palettes, a fall vignette, `/about` and
`/nope`; no console or page errors. (In a git worktree whose `node_modules`
is a symlink into the main clone, the dev server 403s the `@fontsource`
woff files — Vite's fs allow-list — so text renders in fallback fonts there;
the main clone and production are unaffected.) Move with arrows or A/D,
jump with Space/Up/W (hold for the full arc), pause with P/Escape.

## Another Shore II (2026-09-06)

`?theme=shore` selects **Another Shore II**, a second take on the Another
World homage built from scratch on branch `aw-fresh`. **Parked 2026-09-07**
(`disabled: true`): out of the swipe order, still reachable by deep link.
It is: fixed frames and hard
cuts instead of a scrolling camera. Registered directly after `anotherworld`
in `themes/index.ts` (live, `themeColor` = the night sky). `themes/shore/`
holds `DESIGN.md` (the shot list, palettes, movement, death vignettes,
module contract), `types.ts`, `palette.ts` (four 16-entry palettes: dusk →
night → storm → dawn, `dim()` for pause, `flash()` for lightning), `shots.ts`
(seven shots, each authored twice: 320×200 landscape and 200×320 portrait;
walkable solids in stage units), `engine.ts` (pure, deterministic:
`createWorld`/`stepWorld`/`demoInput`), `renderer.ts` (Canvas 2D, flat fills
through the palette array only, cached backgrounds) and `Landing.vue`.

Shots: tide pool → the arch (crouch under a lintel) → causeway (two long
jumps, a tide that covers one slab) → the stair (steps cut into a cliff) →
the beast (turns its head, harmless) → tower base (rockfall wedge, three
ledges) → the lamp (the one close shot). Three beacons turn the palette; the
lamp is the third and the win. Deaths are 0.75–0.9 s vignettes then a hard
cut to the last beacon. No HUD (progress is the tower's lamps), no sound.
Keys: arrows / A D, Space / ↑ / W, ↓ / S crouch, P / Esc, Enter. Touch: four
thin outlined zones along the bottom (◀ ▶ | ▼ ▲); the frame fits above them.

`npm run test:shore` (16 engine tests, in CI after `test:anotherworld`).
Verified 2026-09-07 in headless Chromium at 1440×900, 375×667 and 667×375:
idle attract loop, play, pause, `/about`, `/nope`, reduced motion, emulated
touch zones, and a deterministic keyboard replay of the autopilot to the win
overlay. Dev-only gotcha: in a git worktree whose `node_modules` is a symlink,
Vite refuses the @fontsource files (403) unless the real path is added to
`vite.server.fs.allow` (a local `.nuxtrc`, not committed).

## Keyboard

- `←` / `→` switch theme (unless a theme has locked navigation).

## Escape: tap pauses, 3 s hold quits (2026-09-08)

Every game theme shares one Escape contract: a quick tap pauses or resumes
the run, holding Escape for 3 seconds cancels the run into game over (the
score games show their GAME OVER screen; Another Shore I/II return to idle;
Tetris shows its GAME OVER overlay, where a further Esc tap dismisses to
idle). `P` pauses too, everywhere. Idle attract mode ignores Escape.

Implementation: `themes/base/escHold.ts` holds the framework-free
`EscHoldTracker` state machine (tap vs hold, `performance.now`-injected so
`tests/esc-hold.test.mjs` covers it in plain node, in CI as `test:eschold`);
`themes/base/EscHold.vue` wraps it with the window listeners and the fixed
progress pill (HOLD ESC TO QUIT with a filling bar) plus a PAUSED pill for
games with no paused UI of their own (the five arcade games freeze their
loop behind it; Tetris and the Shores pass `show-paused=false` and keep
their native paused states). Each game's `quitToGameOver` reuses its natural
death path so high-score persistence and the delayed `death`/`over` emits
behave exactly like losing.

## Mountain depth and steering (2026-09-07)

The shared Neon Horizon uses `themes/base/mountainTerrain.js`: a deterministic
XYZ heightfield projected into Canvas 2D, with irregular pointed peaks, dark
faces and violet triangle edges (mesh revision 2026-09-07). Geometry and
face/edge colours are built once per theme instance;
resize reprojects the same landscape. `horizon.setView(x, y)` accepts normalized
coordinates from -1 to 1; `update(dt)` smooths the camera response. Near terrain
moves farther than distant ridges, while the sun stays fixed.

Breakout follows the paddle, Invaders the cannon, Tetris the active piece's
occupied-cell centre (a change-only `view` event through Arcade and Landing),
and Player One the pointer. Reduced motion disables this parallax. Star Fox
uses an instanced, lit three.js heightfield with ship-driven parallax; its
mountain travel and parallax stop under reduced motion. These changes cover
the five synthwave mountain backgrounds; Another Shore's authored landscapes
and the other games keep their own renderers.

Verified 2026-09-07 in headless Chromium at 1440×900 and 375×667 for all
five themes: no page errors or document overflow; keyboard start/steering
smoke checks, Player One pointer input, and unchanged canvas under reduced
motion. Star Fox rendering was separately checked with SwiftShader enabled.

The shared sun now frames itself against the highest nearby terrain tips,
placing those tips about one third of the disc height above its bottom
(2026-09-07). Per-load jitter remains; steering does not move the sun.
An explicit `sunY` still overrides the automatic framing. Star Fox keeps its
separate terrain and sun. Verified 2026-09-07: Player One, Breakout, Invaders
and Tetris at 1440×900 and 375×667 in Chromium, no page errors or document
overflow; `npm run typecheck` passes.

## Space Invaders on phones (2026-09-08)

Portrait widths below 600 px use five columns, with 24–32 px tall sprites
at 320–390 px viewport widths (previously 16 px). Sprite scale also respects
available height. The cannon and bunkers leave finger space below the playfield,
including landscape phones; the live score sits at the top instead of covering
play. Mobile rendering omits chromatic sprite offsets and the marching camera
jolt, keeping the pixel silhouettes clear with fewer sprite draws.

Touch steering follows the finger directly, like Breakout. Holding a stationary
finger fires the next bolt as soon as the previous one clears; only one player
bolt exists at a time. The initiating touch owns control until release/cancel;
blur and page hiding clear held input. Idle swipes still navigate themes.
Shots and bombs check the distance travelled between frames for bunker/cannon/
invader collisions, so a slow frame cannot skip a small target or thin remnant.

`npm run test:invaders` covers layout, hold-to-fire, direct steering, extra
fingers/cancellation, idle tap versus swipe, cannon bounds and collision sweeps
(eight tests, included in CI). Verified 2026-09-08 in Chromium with emulated
touch at 320×568, 375×667, 390×844 and 667×375, plus keyboard at 1440×900:
held touch scores without further movement, HUD stays clear, no page errors
or document overflow. Physical-phone feel and frame rate are not measured.

## Space Invaders weapon pickups (2026-09-08)

The live formation marches 15% faster and base bolts travel about 20% faster;
wave breaks are 1.3 seconds. Holding Space/Up/W fires again when the current
bolt clears, matching held touch. Gold pickups drop every fifth invader kill
and on UFO kills, alternating P (Pierce) and B (Blast), with at most three
falling at once. Catch them with the cannon: Pierce passes through invaders
with a faster bolt; Blast damages a 1.35-cell-radius area and removes nearby
bombs, with extra particles and shockwaves. Bunkers still stop either bolt.

Each pickup replaces the weapon for 12 seconds of active play; the label and
remaining seconds appear below the cannon. Pause, death freezes and wave breaks
freeze pickup movement and duration. Losing a life or restarting clears weapons
and pickups. Existing bolts retain their weapon until impact. No extra controls.
The additions stay in `themes/invaders/Invaders.vue`; the mobile regression suite
also covers pickup lifecycle, piercing, blast damage and wave-clear behavior.
Typecheck, production build and engine tests verified 2026-09-08.
Chromium gameplay smoke checks also passed at 320×568, 375×667, 390×844,
667×375 and 1440×900 with touch/keyboard input, no page errors or document
overflow (2026-09-08). Physical-phone feel remains unmeasured.

## Hall of Fame — the global leaderboard (2026-09-08)

`?theme=leaderboard` is the ninth live theme, last in the rotation: the
world ranking of the six score games (Cyberpunk, Breakout, R-Type, Space
Invaders, Star Fox, Tetris; Another Shore has no score) in one blueprint
panel over the shared horizon, sun pushed right like Player One. Up/down
arrows, PageUp/Down, the mouse wheel, a vertical swipe, the ▲▼ buttons or
the dot rail beside the panel walk the games; the switch is the site's
180 ms fade. Left/right still switch theme — nothing here locks navigation.

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
board the pilot is a 20 px disc between rank and name at 55 % opacity — full
strength on your row, under the pointer, and beside YOU ARE in the footer,
where it breathes pink while a painting is pending; the theme refetches the
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
and retries once). There is no auth and no rate limit: a determined person
can post any number under the cap, and a wipe is `DELETE FROM scores`.

**Dev.** `nuxi dev` has no D1, so `getStore` falls back to an in-memory
store with the same behaviour (production throws 500 if the binding is
missing rather than silently serving an empty board). Verified 2026-09-08
in headless Chromium (CDP script, no Playwright): 1440×900 keyboard walk,
reroll, ArrowRight still switching theme; 375×667 and 667×375 with emulated
touch swipes; a Space Invaders run to game over by keyboard producing the
WORLD RANK line and the highlighted row; `/nope`; no page errors or document
overflow. `npm run test:leaderboard` covers the name lists.
