# AGENTS.md

Personal site, Nuxt 3 on Cloudflare Pages. `/` is the **Portal**, a small
neon town you walk around in, whose buildings lead to everything else; each
game is a **theme** at `/?theme=<id>`, reached from its cabinet. The town is
the west end of Neon Shrine's world: the coast road east leads into the
adventure (one world since 2026-09-24). The theme system and how to
add a theme live in the project skill `.claude/skills/phareim-theme/SKILL.md`
(use it). The portal itself: `docs/games/portal.md`.

## Commands

- `npm run dev` — dev server on port 3030 (host 0.0.0.0)
- `npm run test:portal` — the town: start view, no enemies, exits, every cabinet and link, the beach party's two DJ booths (Jam and the radio), the login console and its auth.phareim.no client (fake fetch), the coast road to the Keeper
- `npm run test:zelda` — Neon Shrine: the first minute from the town, exits, saves, a full scripted run to the Sun Prism; the audio data; the Wildwood's rules and a full run from the town's thicket to the Gate shutting (2026-09-24)
- `npm run test:eschold` — the shared Escape tap/hold state machine
- `npm run test:tetris` — gesture regression tests (tap, direction lock, drop, soft drop, hold); CI runs these before typecheck
- `npm run test:leaderboard` — Hall of Fame name generator/validator and game list (2026-09-08)
- `npm run test:starfox` — Star Fox: balance, story and director, arsenal, encounter scripts, the five bosses' fairness (2026-09-25)
- `npm run test:wingman` — Star Fox wingman brain and the three-wingman squad (2026-09-25)
- `npm run test:anotherworld` — Another Shore: physics, threats, a playtester that crosses all five chapters without dying, cuts, saves; plus the audio module against a fake Web Audio (rebuilt 2026-09-23)
- `npm run test:outrun` — OutRun engine: road and forks, tunnels, driving model, traffic, close-pass chain and crashes, clock and stage times, goal, autopilot (rebuilt 2026-09-11, tunnels and chain 2026-09-23)
- `npm run test:battery` — Night of the Dead Battery: the engine, each floor's puzzles, the story and finale, the audio, and a walkthrough from a new game to the credits (2026-09-26)
- `npm run test:miniworld` — Mini World: the save and its actions, contests, crown and titles, the wallet and neighbourhood server rules (memory store and real D1 SQL), physics, every obby jump, models, audio (2026-09-26)
- `npm run test:figur` — Lag Din Figur: every garment's texture, packing, the drawing ops, figures and the save, Pip's reading of Norwegian, the hero colours, the four renderers and the Minecraft skin (2026-09-26)
- `npm run typecheck` — `nuxi typecheck` (vue-tsc); CI runs this before build
- `npm run build` — production build; the `cloudflare-pages` preset is set in `nuxt.config.ts`, output goes to `dist/`
- `npm run preview` — preview built site

## Stack

- **Framework**: Nuxt 3 + Vue 3 Composition API + TypeScript (`themes/scandi/Bubbles.vue` is Options API, moved verbatim)
- **Hosting**: Cloudflare Pages, project `phareim-no`. SSR runs in the Pages worker (`_routes.json` sends everything except static assets to it), so the first paint is already the theme the URL names.
- **Database / storage**: one D1, `phareim-leaderboard` (id `54e101f9-4026-4fd1-a78a-7a8976e1301e`, created 2026-09-08), bound as `LEADERBOARD_DB` in `wrangler.toml`, schema in `migrations/`, applied by CI before every deploy. It holds the player profiles: Hall of Fame scores, Hangar ships and, since 2026-09-23, the adventure save slots (Neon Shrine, Another Shore, Night of the Dead Battery, Mini World, Lag Din Figur) — see `docs/games/hall-of-fame.md`. Since 2026-09-26 also the site-wide bits wallet (`players.bits`, `wallet_ops`) and Mini World's neighbourhood tables (`mw_*`) — see `docs/games/mini-world.md`. No R2 binding.
- **External APIs**: three. auth.phareim.no, the site-wide account (2026-09-26): the login console in Petter's house asks `GET /api/session` and `POST /api/sign-out` cross-origin with the cookie and links to its sign-in page; the address is `AUTH_BASE` in `themes/zelda/account.ts` (`docs/games/portal.md`). Two on Sleeper — wave-jobs (`POST https://sleeper.phareim.no/wave-jobs/avatar`, Bearer `WAVE_JOBS_KEY`) paints the Hall of Fame avatars (2026-09-08); and `mw-world` (`wss://sleeper.phareim.no/mw-world/ws`, PM2, port 3034, code in `servers/mw-world/`, deployed by the sleeper-deploy webhook's `deploy.sh`) relays Mini World's shared world (2026-09-26). Mini World plays solo when it is down. `server/` came back 2026-09-08 with the Hall of Fame routes (`/api/leaderboard`, `/api/player`, `/api/score`, and `/api/avatar` for wave-jobs' callback); since 2026-09-26 also `/api/wallet` and Mini World's `/api/mw/*`.
- **Dependencies of note**: `three` 0.185 (+ `@types/three`), used by Star Fox, the Hangar and Mini World and loaded only in their async chunks, never the entry (checked 2026-09-25); `@fontsource/space-grotesk` + `@fontsource/space-mono` (self-hosted fonts, 2026-09-06); the radio engine in `themes/radio/station/` imports with `.ts` extensions, so `nuxt.config.ts` sets `allowImportingTsExtensions` (2026-09-25); it loads as its own chunk with the radio theme
- **Fonts** (2026-09-06): two faces, the Neon Dreams split — `--font-person` (Space Grotesk at weight 300, the face's lightest, for body, name and page titles; 400/500 for emphasis: name, blurbs, prose) and `--font-machine` (Space Mono: HUD, hints, over-titles, canvas score pops, shas). Defined on `:root` in `themes/base/fonts.css` (imported first in `themes/index.ts`), latin subsets only; canvas code imports `MACHINE_FONT` from `themes/base/fonts.ts`. A third face since 2026-09-24: `--font-pixel` (Neon Pixel, Neon Shrine's 5×7 canvas font as a 3 KB webfont in `public/fonts/`, for the pixel games' HTML text; `docs/games/pixel-look.md`). Nothing loads from Google Fonts any more (Comfortaa and the preconnects are gone). The parked themes keep their own faces (desk: ET Book).
- **Icons** (2026-09-08): `public/favicon.ico` (16/32/48) and `public/apple-touch-icon.png` (180) are pixel art (2026-09-25): the pixel look's dusk — striped sun, violet ridge, teal grass, the rose path — drawn on a 16/32/36-pixel grid and scaled up nearest-neighbour by `scripts/make-favicon.py` (Pillow). Linked from `nuxt.config.ts` `app.head.link`, along with `theme-color` `#0b0616`. `public/manifest.webmanifest` (2026-09-24) makes the site installable: `display: fullscreen` on Android (standalone on iOS, where `black-translucent` puts the page under the status bar), icons `icon-192.png`/`icon-512.png` from the same script. `html`/`body` carry `touch-action: manipulation`, which stops Safari's double-tap zoom (it ignores `user-scalable=no`). No service worker, on purpose (2026-09-26): the installed app loads fresh HTML on every cold start. While it stays open, `plugins/build-check.client.ts` asks `/_nuxt/builds/latest.json` each time it comes back to the foreground (Nuxt itself asks once an hour); a new build makes the next navigation a full load, never a reload mid-run. A service worker would only earn its place for offline play.
- **State**: the URL picks the theme (`/?theme=<id>`, no cookie since 2026-09-24); Nuxt `useState` for the navigation lock (no state library). sessionStorage `portal.return` puts the portal's hero back where they left. localStorage holds per-game high scores and, since 2026-09-08, the browser's Hall of Fame player (`phareim.player`); since 2026-09-26 the bits wallet (`phareim.wallet`, shared by Neon Shrine and Mini World). Neon Shrine's hero wears the colours of Lag Din Figur's active figure (`figur.heroColors`), else Mini World's active person (`miniworld.heroColors`).

## Project Structure

```
app.vue              — root shell: theme class, theme backdrop, <NuxtPage>, HomeChip, page title; global CSS locks the document (no scrolling)
pages/
  index.vue          — renders the active theme's Landing component (180 ms fade on switch)
error.vue            — 404: a terminal block for the portal and the neon games, own blocks for a few themes; every one leads to `/`
plugins/
  build-check.client.ts — a new deploy found when the app comes back to the foreground reloads on the next navigation
components/
  HomeChip.vue       — in games only: the ⌂ chip back to the portal (bottom-right), hidden while a game locks navigation; the only site chrome
server/
  api/               — leaderboard.get, player.post, score.post, avatar.post (the Hall of Fame API, 2026-09-08); profile.get, ship/select.post (Hangar); save.get/.post (profile save slots: Neon Shrine, Another Shore, Night of the Dead Battery, Mini World); wallet.get/.post (site bits); mw/* (Mini World's neighbourhood)
  utils/store.ts     — D1 store + in-memory dev store behind one interface, id validation
  utils/avatar.ts    — asks wave-jobs on Sleeper to paint a player's pilot (callback into avatar.post)
  utils/miniworld*.ts — the wallet and neighbourhood stores (D1 + memory) and route rules
migrations/          — D1 schema for phareim-leaderboard, numbered SQL, applied by CI
composables/
  useTheme.ts        — active theme from the URL, isHome, launch/goHome (router.push), navigationLocked
  useThemeNavigation.ts — Escape back to the portal, and the 3 s grace after a game lets go; called once from app.vue
  useInputMode.ts    — keyboard vs touch, so game hints say PRESS ENTER or TAP, never both (2026-09-06). SSR guess from sec-ch-ua-mobile/UA, then `(hover: none) and (pointer: coarse)` at mount, then the first keydown/touch/mouse press wins. `hint(keyboardText, touchText)` in templates.
  useLeaderboard.ts  — the browser's Hall of Fame player (localStorage), submitScore / fetchBoards / reroll (2026-09-08)
  useWallet.ts       — the site's bits, one balance for Neon Shrine and Mini World (2026-09-26); useMiniWorld.ts / useMiniWorldSocial.ts — Mini World's save and neighbourhood
themes/              — see the phareim-theme skill
  index.ts           — registry, `liveThemes` (not parked, not the portal) and every theme.css import
  content.ts         — default landing copy (DefaultLanding)
  base/pixel/        — the pixel look (2026-09-24): stage (buffer, whole-number scale, light map, bloom, scanlines), sprites + 5×7 font, side-view scenery, pixel.css (text, and `.px-box`/`.px-btn`, Neon Shrine's dialog box for HTML). Every live page uses it since 2026-09-25: `docs/games/pixel-look.md`
  base/              — DefaultLanding shell, SocialLink, EscHold (shared Escape tap/hold), fonts.css + fonts.ts (site fonts, 2026-09-06)
  _template/         — starting point for a new theme
  portal/            — the home theme on `/`: the page (hint, hidden link index, ending panel) around the world shell
  zelda/             — the one world: engine, world data (town + Neon Shrine), renderer, audio, and the shell `Zelda.vue`
  radio/             — two radios: engine.ts + catalog.ts (the widget's six game stations) and the radio theme (Landing, Station, Dial, Channels; 2026-09-25) with station/, vendored from phareim/radio by scripts/sync-radio.mjs, never edited by hand
  battery/          — Night of the Dead Battery: engine/, content/, render/, audio.ts; Landing.vue loads Game.vue as its own chunk
  miniworld/        — Mini World (Ulrikke's game): core/ (pure rules), scene/ (three.js), ui/ (panels), Game.vue as its own chunk
  figur/            — Lag Din Figur (Ulrikke's second): core/ (garment textures, save, Pip), render/ (the four game looks), ui/, Game.vue as its own chunk
  anotherworld/ shore/ scandi/ galaga/ breakout/ rtype/ invaders/ starfox/ outrun/ tetris/ leaderboard/ hangar/ ships/ space/ desk/
```

There is no menu and no page route but `/`. The site's own server code is
the profile API in `server/` (Hall of Fame, saves, wallet, Mini World's
neighbourhood); `servers/mw-world/` is not part of the site build: it runs
on Sleeper under PM2 (see its README). Who Petter is and how to reach him lives in the
portal (his house, and a visually hidden HTML block for search engines and
screen readers). Player One, the old profile theme, was retired 2026-09-24;
`?theme=playerone` lands on the portal.

## Theme System (short version — the skill has the rest)

- Nineteen themes in `themes/index.ts` (verified 2026-09-26): the portal (`home: true`), fourteen live and four parked. Live: Lag Din Figur, Mini World, Night of the Dead Battery, Another Shore, Galaga, Breakout, R-Type, Space Invaders, Star Fox, OutRun, Tetris, Hall of Fame, Hangar, Radio (the record DJ on the town's beach, not a cabinet). Neon Shrine is not a theme: it is the portal's world. Parked (`disabled: true`: no way in from the portal; still reachable with `?theme=<id>`): Another Shore II, Scandinavian Glass, Space, Tufte Desk. Per-game detail: the table under "Games → docs".
- **Nothing scrolls**: `html`/`body`/`#__nuxt` are `overflow: hidden` with `overscroll-behavior: none`, and every landing is locked to the viewport. Full-screen heights use `var(--app-height, 100dvh)` (defined in `app.vue`), never bare `100dvh`: in the iOS home-screen app 100dvh comes up a status bar short and leaves a white strip at the bottom.
- **Bottom band** (2026-09-24): `--app-safe-bottom` (defined in `app.vue`) is the strip along the bottom edge where nothing interactive or meaning-bearing may sit: buttons, text, hints, the player's ship or paddle. Backdrops may run through it. In a browser tab it equals `env(safe-area-inset-bottom)`; installed as a web app (`display-mode: standalone/fullscreen`) it is `max(48px, inset + 30px)`, clear of the home indicator and system swipes. Anchor bottom UI as `calc(<gap> + var(--app-safe-bottom, 0px))`, never on the bare inset; canvas games take it as a bottom inset.
- The URL is the only source: `/` is the portal, `/?theme=<id>` that theme; legacy ids map first (`hacker` → galaga, `playerone` → portal, `zelda` → portal), an unknown id shows the portal. No cookie, no random pick.
- No way from one game straight to another (2026-09-24: arrows, swipes, chevrons and dots removed on Petter's wish). You walk out to the portal and into the next cabinet.
- History: the portal's `launch(id)` pushes and the home chip / Escape (`goHome()`) steps back to it, so the back button walks between portal and game; both ignore the navigation lock.
- Each `themes/<id>/theme.css` defines the `--theme-*` contract on `.{id}-page` (ten tokens, listed in the skill). Pages read `var(--theme-*, fallback)` and never hardcode colours or branch on `prefers-color-scheme` — dark mode is each theme's own business.
- Each `themes/<id>/Landing.vue` owns the landing page. Most wrap `themes/base/DefaultLanding.vue`; a theme may replace the whole page.
- A game sets `navigationLocked` while a run is on; Escape and the home chip leave it alone then.
- A landing must fit a phone viewport (checked at 375×667): the document does not scroll, so anything below the fold is unreachable.

## Key Patterns

- No `runtimeConfig` (2026-09-07). The Hall of Fame routes read their D1 binding and the `WAVE_JOBS_KEY` secret from `event.context.cloudflare.env` (2026-09-08), which needs no config; background work goes through `event.context.cloudflare.context.waitUntil`. If `runtimeConfig` comes back: secrets are set on Cloudflare by `NUXT_`-prefixed env vars, and server code **must** call `useRuntimeConfig(event)` — without the event, Workers return a config frozen at module init, before env vars exist, so the value silently never applies (found 2026-09-03).
- No auth system of its own: the login console reads the session from auth.phareim.no in the browser; nothing on the site's server checks it.

## Deployment

- **CI/CD**: `.github/workflows/deploy.yml` — `build` job (npm ci → every `test:*` suite → typecheck → build → artifact) on push and PR; `deploy` job (wrangler `pages deploy dist`) on push to `master` only, then notifies Sleeper. A new game test script must be added to that list.
- `wrangler.toml` carries `pages_build_output_dir = "dist"`, `nodejs_compat` and the `LEADERBOARD_DB` D1 binding (2026-09-08). The deploy job runs `d1 migrations apply phareim-leaderboard --remote` before `pages deploy`, so the repo's `CLOUDFLARE_API_TOKEN` secret needs D1 edit rights (set to the host token 2026-09-08).

## Keyboard

- The shell does not use the arrow keys: they belong to the games, and on the portal they walk the hero.
- `Esc` in a game goes back to the portal when the game is not using it: navigation not blocked, not a repeat, not in a form field, and no game listener called `preventDefault` (checked in a `setTimeout(0)` after the whole dispatch, since games listen on `window` too). A game that uses Escape outside a run must `preventDefault` (Tetris's GAME OVER dismiss, Another Shore's ending, Another Shore II's won screen do).
- After a game releases navigation at game over or exit, Escape and the home chip stay blocked for 3 seconds (2026-09-08), so the Escape that ended a run does not also leave the game. The shared watcher in `useThemeNavigation` starts the grace period synchronously. Starting another run clears the grace timer and keeps the game lock. A lock released because the route changed (back button, home chip) starts no grace period, and arriving on a theme by URL clears one.

## Escape: tap pauses, 3 s hold quits (2026-09-08)

Every game theme shares one Escape contract: a quick tap pauses or resumes
the run, holding Escape for 3 seconds cancels the run into game over (the
score games show their GAME OVER screen; Another Shore returns to its title with progress kept, Another Shore II to idle;
Tetris shows its GAME OVER overlay, where a further Esc tap dismisses to
idle; the portal's world saves and puts you back in town, its pill reads
HOLD ESC FOR TOWN). `P` pauses too, everywhere. Idle attract mode leaves Escape to the
shell, which goes back to the portal (see Keyboard).

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

## Hall of Fame API (shared by every score game)

Galaga, Breakout, R-Type, Space Invaders, Star Fox, OutRun and Tetris all
submit scores to the same D1-backed leaderboard: `server/api/leaderboard.get`,
`player.post`, `score.post`, `avatar.post`, store in `server/utils/store.ts`.
A run calls `submitScore('<id>', score)` on game over; a score of 0 is never
sent, and API failures are silent — the board is a bonus, not a blocker.
Full API shape, avatar painting, and player/name rules: `docs/games/hall-of-fame.md`.

## Global radio (shared by Galaga and OutRun)

`RadioWidget.vue` in `app.vue` is a persistent top-right music player
(`♪ STASJON n/6` + mute) backed by the singleton engine `themes/radio/engine.ts`
and `themes/radio/catalog.ts`. A game with its own soundtrack (Galaga, OutRun)
suspends the radio while a run is active and resumes it on stop; every other
game's one-shots and loops play over the radio untouched. Full wiring and the
contract with each game's `audio.ts`: `docs/games/global-radio.md`. The radio
theme (`ownRadio` in the registry) is a radio of its own: no widget there, and
it holds this radio silent (`docs/games/radio.md`).

## Games → docs

| Game / feature | Docs | Code |
|---|---|---|
| Portal (home, on `/`) | `docs/games/portal.md` | `themes/portal/`, `themes/zelda/world/` |
| The pixel look (shared) | `docs/games/pixel-look.md` | `themes/base/pixel/` |
| Mini World (Ulrikke's game) | `docs/games/mini-world.md` | `themes/miniworld/` (DESIGN.md), `scripts/miniworld-lab/` |
| Lag Din Figur (Ulrikke's second) | `docs/games/lag-din-figur.md` | `themes/figur/` (DESIGN.md), `scripts/figur-lab/` |
| Night of the Dead Battery | `docs/games/night-of-the-dead-battery.md` | `themes/battery/` (DESIGN.md, BUILD.md), `scripts/battery-lab/` |
| Another Shore | `docs/games/another-shore.md` | `themes/anotherworld/` |
| Another Shore II | `docs/games/another-shore-ii.md` | `themes/shore/` (parked) |
| Space Invaders | `docs/games/space-invaders.md` | `themes/invaders/` |
| Star Fox (Operation Nightlight) | `docs/games/star-fox.md` | `themes/starfox/` (scene/, models/, pure tuning in `*.ts`), `public/starfox/pilots/` |
| OutRun | `docs/games/outrun.md` | `themes/outrun/` |
| Neon Shrine (the portal's world) | `docs/games/neon-shrine.md` | `themes/zelda/` |
| The Wildwood (Neon Shrine's second act) | `docs/games/wildwood.md` | `themes/zelda/world/wildwood.ts`, `lab1.ts`, `lab2.ts` |
| Hall of Fame | `docs/games/hall-of-fame.md` | `themes/leaderboard/`, `server/api/` |
| Galaga | `docs/games/galaga.md` | `themes/galaga/` |
| Global radio | `docs/games/global-radio.md` | `themes/radio/engine.ts`, `catalog.ts`, `components/RadioWidget.vue` |
| Radio (the generative radio, vendored from phareim/radio) | `docs/games/radio.md` | `themes/radio/`, `themes/radio/station/`, `scripts/sync-radio.mjs` |
| R-Type | `docs/games/r-type.md` | `themes/rtype/` |
| Hangar | `docs/games/hangar.md` | `themes/ships/`, `themes/hangar/` |
| Breakout | `docs/games/parked-and-classic.md` | `themes/breakout/` |
| Tetris | `docs/games/parked-and-classic.md` | `themes/tetris/` |
| Scandinavian Glass (parked) | `docs/games/parked-and-classic.md` | `themes/scandi/` |
| Space (parked) | `docs/games/parked-and-classic.md` | `themes/space/` |
| Tufte Desk (parked) | `docs/games/parked-and-classic.md` | `themes/desk/` |

AGENTS.md describes what applies to the whole repo today. Per-game detail
goes in `docs/games/<game>.md`; replace outdated text there instead of
appending a new dated section. History belongs in `git log`.

Reverted-but-recoverable work from the May 2026 reset: `docs/history.md`.
