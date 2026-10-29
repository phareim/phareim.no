# AGENTS.md

Personal site, Nuxt 4 on Cloudflare Pages. `/` is the **Portal**, a small
neon town you walk around in, whose buildings lead to everything else; each
game is a **theme** at `/?theme=<id>`, reached from its cabinet. The town is
the west end of Neon Shrine's world: the coast road east leads into the
adventure (one world since 2026-09-24). The theme system and how to
add a theme live in the project skill `.claude/skills/phareim-theme/SKILL.md`
(use it). The portal itself: `docs/games/portal.md`.

## Commands

- `npm run dev` — dev server on port 3030 (host 0.0.0.0). On Sleeper llm-gateway already holds 127.0.0.1:3030, so Nuxt takes another port: pass that address to lab scripts (`scripts/zelda-lab/*-shot.mjs` default to `http://127.0.0.1:3030/`)
- `npm test` — every `tests/*.test.mjs` in one pass (what the deploy runs). Per area:
  - `test:portal` — the town, every cabinet and link, the login console, the NEW LOOK stall, the newsstand, the coast road
  - `test:zelda` — Neon Shrine: exits, saves, a full run to the Sun Prism, the hero's look, audio, the Wildwood run, the views
  - `test:eschold` — the shared Escape tap/hold state machine
  - `test:tetris` — Russian Block Game gestures (tap, direction lock, drop, soft drop, hold)
  - `test:leaderboard` — Hall of Fame names and game list
  - `test:starfox`, `test:wingman` — Star Fox balance, story, arsenal, bosses; the wingman squad
  - `test:anotherworld` — Another Shore: physics, threats, a playtester through all five chapters, saves, audio
  - `test:galaga` — Space Voyagers I (parked): engine, encounters, bosses, the radio director, autopilot voyages, layout, audio
  - `test:voyagers2` — Space Voyagers II (the Wing Commander one): flight, damage, missiles and decoys, the two seats, sorties, the campaign tree and save, the bot table, the words, the layout; `docs/games/voyagers2.md`
  - `test:outrun` — Drive to the Mountains: road, driving, traffic, crashes, clock, banter, and that `public/outrun` holds exactly the listed pictures
  - `test:breakout` — Space Paddle — The Odyssey: the rules in `themes/breakout/engine.ts` (speed, boards, pulse bricks, the planet, capsules, lives, attract mode, a seeded autopilot run); `docs/games/breakout.md`
  - `test:battery` — Night of the Dead Battery: puzzles, story, audio, a walkthrough to the credits
  - `test:miniworld` — Mini World: save, contests, wallet and neighbourhood rules (memory and real D1 SQL), physics, obby, the sign-in gate
  - `test:figur` — Lag Din Figur: garments, packing, figures and save, Pip, the renderers, the Minecraft skin
- `npm run typecheck` — `nuxi typecheck` (vue-tsc); the Sleeper deploy runs this before build
- `npm run build` — production build; the `cloudflare-pages` preset is set in `nuxt.config.ts`, output goes to `dist/`
- `npm run preview` — preview built site

## Stack

- **Framework**: Nuxt 4 (since 2026-10-29) + Vue 3 Composition API + TypeScript (`themes/scandi/Bubbles.vue` is Options API, moved verbatim). The source stays at the repo root, not in `app/`: with no `app/` directory Nuxt 4 keeps the root as `srcDir` by itself. `nuxt.config.ts` turns Nuxt 4's `noUncheckedIndexedAccess` back off, and the root `tsconfig.json` still extends the single `.nuxt/tsconfig.json` (app, server and `themes/` in one project), not the split `tsconfig.app/server/shared.json`
- **Hosting**: Cloudflare Pages, project `phareim-no`. SSR runs in the Pages worker (`_routes.json` sends everything except static assets to it), so the first paint is already the theme the URL names.
- **Database / storage**: one D1, `phareim-leaderboard` (id `54e101f9-4026-4fd1-a78a-7a8976e1301e`, created 2026-09-08), bound as `LEADERBOARD_DB` in `wrangler.toml`, schema in `migrations/`, applied from Sleeper before every deploy. It holds the player profiles: Hall of Fame scores, Hangar ships and, since 2026-09-23, the adventure save slots (Neon Shrine, Another Shore, Night of the Dead Battery, Mini World, Lag Din Figur) — see `docs/games/hall-of-fame.md`. Since 2026-09-26 also the site-wide bits wallet (`players.bits`, `wallet_ops`) and Mini World's neighbourhood tables (`mw_*`) — see `docs/games/mini-world.md`. No R2 binding.
- **External APIs**: five. studio.phareim.no (2026-10-20): Neon Shrine reads the studio's published sprites from `/live/neon-shrine.json` after mount (public, no cookie) and draws them over its own (`themes/zelda/render/live.ts`, `docs/games/neon-shrine.md` → "Live art from the studio"); the build writes `public/studio/neon-shrine.json` for the studio to edit against. sleeper.phareim.md (2026-10-13): the newsstand on the portal's coast fetches the feed's reader JSON (`/reader/index.json`, `/reader/<slug>.json`) from the browser, no cookie, and shows the pieces in a panel; the address is `NEWS_BASE` in `themes/zelda/newsLinks.ts` (`docs/games/portal.md` → "The newsstand"). auth.phareim.no, the site-wide account (2026-09-26): the login console in Petter's house asks `GET /api/session` and `POST /api/sign-out` cross-origin with the cookie and links to its sign-in page; the address is `AUTH_BASE` in `themes/zelda/account.ts` (`docs/games/portal.md`). Since 2026-09-29 Mini World and Lag Din Figur also sign in through it (`POST /api/sign-in` from their own windows, `composables/useAccount.ts`) and the site's server and `mw-world` ask `GET /api/session` with the request's `session_token` cookie to lock them (see Key Patterns). Two on Sleeper — wave-jobs (`POST https://sleeper.phareim.no/wave-jobs/avatar`, Bearer `WAVE_JOBS_KEY`) paints the Hall of Fame avatars (2026-09-08); and `mw-world` (`wss://sleeper.phareim.no/mw-world/ws`, PM2, port 3034, code in `servers/mw-world/`, deployed by the sleeper-deploy webhook's `deploy.sh`) relays Mini World's shared world (2026-09-26). Mini World plays solo when it is down. `server/` came back 2026-09-08 with the Hall of Fame routes (`/api/leaderboard`, `/api/player`, `/api/score`, and `/api/avatar` for wave-jobs' callback); since 2026-09-26 also `/api/wallet` and Mini World's `/api/mw/*`.
- **Dependencies of note**: `three` 0.185 (+ `@types/three`), used by Star Fox, the Hangar and Mini World and loaded only in their async chunks, never the entry (checked 2026-09-25); `@fontsource/space-grotesk` + `@fontsource/space-mono` (self-hosted fonts, 2026-09-06)
- **Fonts** (2026-09-06): two faces, the Neon Dreams split — `--font-person` (Space Grotesk at weight 300, the face's lightest, for body, name and page titles; 400/500 for emphasis: name, blurbs, prose) and `--font-machine` (Space Mono: HUD, hints, over-titles, canvas score pops, shas). Defined on `:root` in `themes/base/fonts.css` (imported first in `themes/index.ts`), latin subsets only; canvas code imports `MACHINE_FONT` from `themes/base/fonts.ts`. A third face since 2026-09-24: `--font-pixel` (Neon Pixel, Neon Shrine's 5×7 canvas font as a 3 KB webfont in `public/fonts/`, for the pixel games' HTML text; `docs/games/pixel-look.md`). Nothing loads from Google Fonts. The parked themes keep their own faces (desk: ET Book). The `@import` lines must stay **above** the `@font-face` rules: below them, Vite emits no woff2 at all and the site silently falls back to system fonts (fixed 2026-09-30).
- **Icons** (2026-09-08): `public/favicon.ico` (16/32/48) and `public/apple-touch-icon.png` (180) are pixel art (2026-09-25): the pixel look's dusk — striped sun, violet ridge, teal grass, the rose path — drawn on a 16/32/36-pixel grid and scaled up nearest-neighbour by `scripts/make-favicon.py` (Pillow). Linked from `nuxt.config.ts` `app.head.link`, along with `theme-color` `#0b0616`. `public/manifest.webmanifest` (2026-09-24) makes the site installable: `display: fullscreen` on Android (standalone on iOS, where `black-translucent` puts the page under the status bar), icons `icon-192.png`/`icon-512.png` from the same script. `html`/`body` carry `touch-action: manipulation`, which stops Safari's double-tap zoom (it ignores `user-scalable=no`). No service worker, on purpose (2026-09-26): the installed app loads fresh HTML on every cold start. While it stays open, `plugins/build-check.client.ts` asks `/_nuxt/builds/latest.json` each time it comes back to the foreground (Nuxt itself asks once an hour); a new build makes the next navigation a full load, never a reload mid-run. A service worker would only earn its place for offline play.
- **State**: the URL picks the theme (`/?theme=<id>`, no cookie since 2026-09-24); Nuxt `useState` for the navigation lock (no state library). sessionStorage `portal.return` puts the portal's hero back where they left. localStorage holds per-game high scores and, since 2026-09-08, the browser's Hall of Fame player (`phareim.player`); since 2026-09-26 the bits wallet (`phareim.wallet`, shared by Neon Shrine and Mini World). Neon Shrine's hero wears the newest choice (2026-10-13): the look chosen at the NEW LOOK stall on the square (`zelda.heroLook`, this browser only) until the made figure is changed after it, else the colours of Lag Din Figur's active figure (`figur.heroColors`), else Mini World's active person (`miniworld.heroColors`).

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
  GameFrame.vue      — a game on another address in an iframe that fills the screen, for the installed app (`/?frame=<id>`, `composables/useFrame.ts`, `themes/frames.ts`; docs/games/frame.md, 2026-10-12)
server/
  api/               — leaderboard.get, player.post, score.post, avatar.post (the Hall of Fame API, 2026-09-08); profile.get, ship/select.post (Hangar); save.get/.post (profile save slots: Neon Shrine, Another Shore, Night of the Dead Battery, Mini World); wallet.get/.post (site bits); mw/* (Mini World's neighbourhood)
  utils/store.ts     — D1 store + in-memory dev store behind one interface, id validation
  utils/avatar.ts    — asks wave-jobs on Sleeper to paint a player's pilot (callback into avatar.post)
  utils/miniworld*.ts — the wallet and neighbourhood stores (D1 + memory) and route rules
  utils/account.ts, accountLinks.ts, sessionCheck.ts — the sign-in gate for Mini World and Lag Din Figur (2026-09-29); api/account/link.post
migrations/          — D1 schema for phareim-leaderboard, numbered SQL, applied by the Sleeper deploy
composables/
  useTheme.ts        — active theme from the URL, isHome, launch/goHome (router.push), navigationLocked
  useThemeNavigation.ts — Escape back to the portal, and the 3 s grace after a game lets go; called once from app.vue
  useInputMode.ts    — keyboard vs touch, so game hints say PRESS ENTER or TAP, never both (2026-09-06). SSR guess from sec-ch-ua-mobile/UA, then `(hover: none) and (pointer: coarse)` at mount, then the first keydown/touch/mouse press wins. `hint(keyboardText, touchText)` in templates.
  useDeviceCapability.ts — what the device can afford (2026-09-30): `isLowPowerDevice()` (few cores, or touch with little memory — Mini World's ladder, lifted out) and `canvasPixelRatio(max)`, which every canvas game's ratio runs through (Space Voyagers alone does not: one small buffer and one blit a frame, whole device pixels at the real ratio on a wide screen, the frame at a whole scale fitted by CSS on a narrow one; `docs/games/galaga.md`). Whole ratios only.
  useLeaderboard.ts  — the browser's Hall of Fame player (localStorage), submitScore / fetchBoards / reroll (2026-09-08)
  useAccount.ts      — the site account inside Mini World and Lag Din Figur: session, sign-in, link to the player profile, Logg ut (2026-09-29)
  useWallet.ts       — the site's bits, one balance for Neon Shrine and Mini World (2026-09-26); useMiniWorld.ts / useMiniWorldSocial.ts — Mini World's save and neighbourhood
themes/              — see the phareim-theme skill
  index.ts           — registry, `liveThemes` (not parked, not the portal) and every theme.css import
  content.ts         — default landing copy (DefaultLanding)
  base/pixel/        — the pixel look (2026-09-24): stage (buffer, whole-number scale, light map, bloom, scanlines), sprites + 5×7 font, side-view scenery, pixel.css (text, and `.px-box`/`.px-btn`, Neon Shrine's dialog box for HTML). Every live page uses it since 2026-09-25: `docs/games/pixel-look.md`
  base/              — DefaultLanding shell, SocialLink, EscHold (shared Escape tap/hold), fonts.css + fonts.ts (site fonts, 2026-09-06)
  _template/         — starting point for a new theme
  portal/            — the home theme on `/`: the page (hint, hidden link index, ending panel) around the world shell
  zelda/             — the one world: engine, world data (town + Neon Shrine), renderer (classic and isometric views, `views.ts`), audio, and the shell `Zelda.vue`
  radio/             — engine.ts + catalog.ts: the widget's six game stations (the generative radio is radio.phareim.no, a link out from the beach since 2026-09-28)
  battery/          — Night of the Dead Battery: engine/, content/, render/, audio.ts; Landing.vue loads Game.vue as its own chunk
  galaga/           — Rex & Nova: Space Voyagers I (parked 2026-10-16; the id stays `galaga`): engine/, story/, render/, audio.ts; Landing.vue loads Game.vue as its own chunk
  voyagers2/        — Rex & Nova: Space Voyagers II, a cockpit space-combat campaign in three.js (the SPACE VOYAGERS cabinet since 2026-10-16): engine/, story/, render/, audio.ts; Campaign.vue and Game.vue their own chunks
  miniworld/        — Mini World (Ulrikke's game): core/ (pure rules), scene/ (three.js), ui/ (panels), Game.vue as its own chunk
  figur/            — Lag Din Figur (Ulrikke's second): core/ (garment textures, save, Pip), render/ (the four game looks), ui/, Game.vue as its own chunk
  anotherworld/ shore/ scandi/ breakout/ rtype/ invaders/ starfox/ outrun/ tetris/ leaderboard/ hangar/ ships/ space/ desk/
```

There is no menu and no page route but `/`. The site's own server code is
the profile API in `server/` (Hall of Fame, saves, wallet, Mini World's
neighbourhood); `servers/mw-world/` is not part of the site build: it runs
on Sleeper under PM2 (see its README). Who Petter is and how to reach him lives in the
portal (his house, and a visually hidden HTML block for search engines and
screen readers).

## Theme System (short version — the skill has the rest)

- Eighteen themes in `themes/index.ts` (verified 2026-09-28): the portal (`home: true`), thirteen live and four parked. Live: Lag Din Figur, Mini World, Night of the Dead Battery, Another Shore, Rex & Nova: Space Voyagers II (id `voyagers2`, since 2026-10-16), Space Paddle — The Odyssey (`breakout`), G-Type, Space Invaders, Star Fox, Drive to the Mountains (`outrun`), Russian Block Game, Hall of Fame, Hangar. Neon Shrine is not a theme: it is the portal's world. Parked (`disabled: true`: no way in from the portal; still reachable with `?theme=<id>`): Rex & Nova: Space Voyagers I (`galaga`, 2026-10-16), Another Shore II, Scandinavian Glass, Space, Tufte Desk. Per-game detail: the table under "Games → docs".
- **Nothing scrolls**: `html`/`body`/`#__nuxt` are `overflow: hidden` with `overscroll-behavior: none`, and every landing is locked to the viewport. Full-screen heights use `var(--app-height, 100dvh)` (defined in `app.vue`), never bare `100dvh`: in the iOS home-screen app 100dvh comes up a status bar short and leaves a white strip at the bottom.
- **Bottom band** (2026-09-24): `--app-safe-bottom` (defined in `app.vue`) is the strip along the bottom edge where nothing interactive or meaning-bearing may sit: buttons, text, hints, the player's ship or paddle. Backdrops may run through it. In a browser tab it equals `env(safe-area-inset-bottom)`; installed as a web app (`display-mode: standalone/fullscreen`) it is `max(48px, inset + 30px)`, clear of the home indicator and system swipes. Anchor bottom UI as `calc(<gap> + var(--app-safe-bottom, 0px))`, never on the bare inset; canvas games take it as a bottom inset.
- The URL is the only source: `/` is the portal, `/?theme=<id>` that theme; legacy ids map first (`hacker` → galaga, `playerone` → portal, `zelda` → portal, `tetris` → russian), an unknown id shows the portal. No cookie, no random pick.
- No way from one game straight to another (2026-09-24: arrows, swipes, chevrons and dots removed on Petter's wish). You walk out to the portal and into the next cabinet.
- History: the portal's `launch(id)` pushes and the home chip / Escape (`goHome()`) steps back to it, so the back button walks between portal and game; both ignore the navigation lock.
- Each `themes/<id>/theme.css` defines the `--theme-*` contract on `.{id}-page` (ten tokens, listed in the skill). Pages read `var(--theme-*, fallback)` and never hardcode colours or branch on `prefers-color-scheme` — dark mode is each theme's own business.
- Each `themes/<id>/Landing.vue` owns the landing page. Most wrap `themes/base/DefaultLanding.vue`; a theme may replace the whole page.
- A game sets `navigationLocked` while a run is on; Escape and the home chip leave it alone then.
- A landing must fit a phone viewport (checked at 375×667): the document does not scroll, so anything below the fold is unreachable.

## Key Patterns

- **What `/` costs** (measured 2026-09-30, 4× CPU, 1.6 Mbps, 150 ms RTT, cold): 296 KB over the wire in 5 requests — the document plus 4 files. Since Nuxt 4 (2026-10-29) the entry is split into about ten modulepreloaded files (Vue's runtime, EscHold and the pixel stage now sit in their own chunks; async chunks reach the entry through an import map), the same bytes in more requests. Four rules keep it there, each of which was broken and is easy to break again:
  - **A landing imports no game.** `themes/index.ts` imports every `Landing.vue` statically so a cabinet has no waiting, but a `Landing.vue` must reach its game through `defineAsyncComponent(() => import(...))`. Battery, Mini World, Lag Din Figur, Space Voyagers and Star Fox's views do. Importing `Game.vue` in `themes/galaga/Landing.vue` puts the whole game in the entry, which `/` pays for on every visit. The title screen still server-renders, so this costs the first paint nothing.
  - **No prefetch hints.** `server/plugins/no-prefetch.ts` strips the `<link rel=prefetch>` tags Vite emits (21 of them, 465 KB) from the rendered head. It rewrites the one-element `html.head` array as a string; filtering that array instead removes the entire head.
  - **Styles are a file, not inline.** `features.inlineStyles: false` in `nuxt.config.ts`. All 19 theme stylesheets are global and total 82 KB; the HTML here is `cf-cache-status DYNAMIC` (the Norway gate and the sign-in cookie), so anything inlined is re-sent every visit and can never be cached.
  - **No dead assets in `public/`.** They are shipped, un-hashed and un-referenced.
  - Since 2026-10-20 the portal makes one more request after mount, to studio.phareim.no for the live art (`render/live.ts`): small, never awaited, and not in the 296 KB above. `public/studio/neon-shrine.json` (≈100 KB) is generated and read only by the studio, never by a page.
- No `runtimeConfig` (2026-09-07). The Hall of Fame routes read their D1 binding and the `WAVE_JOBS_KEY` secret from `event.context.cloudflare.env` (2026-09-08), which needs no config; background work goes through `event.context.cloudflare.context.waitUntil`. If `runtimeConfig` comes back: secrets are set on Cloudflare by `NUXT_`-prefixed env vars, and server code **must** call `useRuntimeConfig(event)` — without the event, Workers return a config frozen at module init, before env vars exist, so the value silently never applies.
- Norway only for Ulrikke's games (2026-09-29): `server/middleware/norway.ts` answers 403 outside Norway to `/?theme=miniworld|figur`, `/api/mw/*` and `/api/account/*` (country from `request.cf`, none in dev = allowed, Sleeper's addresses always allowed; `server/utils/norway.ts`), and `plugins/norway.server.ts` hands the answer to the page so a cabinet opened from the portal shows "BARE ÅPENT I NORGE" instead of loading the game. `mw-world` has the same gate in nginx on Sleeper (`~/github/sleeper/geo/`).
- No auth system of its own; identity is auth.phareim.no's (Reader keeps users and sessions, cookie `session_token` on `.phareim.no`).
- **The auth gate for Ulrikke's games**: Mini World and Lag Din Figur need a signed-in auth.phareim.no account, in the browser (`Landing.vue` renders the game only when `useAccount().state` is `in`) and on the server, which is the actual lock (`server/utils/account.ts`, `sessionCheck.ts`, `accountLinks.ts`; fail closed when auth is down). A new route for these games must call `requireAccountPlayer` (or go through `mwRoute`); `tests/miniworld-account.test.mjs` fails on an uncovered file under `server/api/mw/`. `server/utils/sessionCheck.ts` and `themes/zelda/account.ts` are shared with `mw-world`, so `deploy.sh` restarts it when they change. Hall of Fame scores stay open. The portal needs no login, but a signed-in visitor plays under the account's profile (`usePortalAccountLink`), and once a profile is an account's, `/api/save` for every slot needs its owner's session (`guardLinkedPlayer`); another account signing in on the browser clears the local copies. Under `nuxi dev` the games show the retry window (auth refuses localhost); `scripts/login-lab/shots.mjs` fakes auth. Details: `docs/games/mini-world.md` (Sign-in), `docs/games/portal.md`.

## Deployment

- **Deploy**: push to `master` → signed `sleeper-deploy` webhook → `scripts/deploy.sh` on Sleeper. It preserves the Mini World server deploy, then `scripts/deploy-site.sh --auto` builds committed `origin/master` in an isolated worktree through `heavy`. `npm test` runs every `tests/*.test.mjs` file in one pass, then typecheck and build run. GitHub Actions is off; pull requests run no CI.
- D1 migrations apply before publishing to Pages (`phareim-no`, production branch `master`). `wrangler.toml` carries the output dir, compatibility flags and `LEADERBOARD_DB` binding. Credentials: `~/.config/phareim-deploy/env` (600), with Pages and D1 edit rights.
- **Branch previews**: `bash scripts/deploy-site.sh --branch <name>` builds a branch with the same tests, typecheck and build and publishes it as a Pages preview (`<name>.phareim-no.pages.dev`), without migrations. A preview shares production's D1, so saves and scores made there are real. The standing `beta` branch and beta.phareim.no were retired 2026-10-14.
- Manual: `bash scripts/deploy-site.sh [--branch <name>] [commit]`. File lock and successful revision: `~/.local/state/phareim-deploy/`. Busy pushes coalesce in the webhook queue; duplicate revisions skip work. Logs: `pm2 logs sleeper-deploy`; status: `https://sleeper.phareim.no/deploy/health`.

## Keyboard and Escape

The shell leaves the arrow keys to the games. In a game, an Escape tap pauses and a 3-second hold quits the run into game over; `P` pauses too. Escape goes back to the portal only when the game is not using it (no run, no `preventDefault`), and stays blocked for 3 s after a run ends. A game that uses Escape outside a run must `preventDefault`. Shared code: `themes/base/escHold.ts` and `EscHold.vue`. The full contract: `docs/games/escape.md`.

## Hall of Fame and the radio

- Every score game calls `submitScore('<id>', score)` on game over (never a 0); the D1 board is a bonus, so API failures are silent. API, avatars and name rules: `docs/games/hall-of-fame.md`.
- `RadioWidget.vue` in `app.vue` is the site-wide radio (`themes/radio/engine.ts`, `catalog.ts`). Space Voyagers uses it as its soundtrack; a game with its own music suspends it during a run, and a theme with `ownRadio` hides it. Wiring and the contract with each `audio.ts`: `docs/games/global-radio.md`.

## Games → docs

| Game / feature | Docs | Code |
|---|---|---|
| Portal (home, on `/`) | `docs/games/portal.md` | `themes/portal/`, `themes/zelda/world/` |
| The pixel look (shared) | `docs/games/pixel-look.md` | `themes/base/pixel/` |
| Escape and the keyboard (shared) | `docs/games/escape.md` | `themes/base/escHold.ts`, `EscHold.vue` |
| The frame (installed app: Adventure, Pizza Rescue, Solo Rescue, Vector Horizon, Eventyrland and Supermusene without leaving the page) | `docs/games/frame.md` | `components/GameFrame.vue`, `composables/useFrame.ts`, `themes/frames.ts` |
| Mini World (Ulrikke's game) | `docs/games/mini-world.md` | `themes/miniworld/` (DESIGN.md), `scripts/miniworld-lab/` |
| Lag Din Figur (Ulrikke's second) | `docs/games/lag-din-figur.md` | `themes/figur/` (DESIGN.md), `scripts/figur-lab/` |
| Night of the Dead Battery | `docs/games/night-of-the-dead-battery.md` | `themes/battery/` (DESIGN.md, BUILD.md), `scripts/battery-lab/` |
| Another Shore | `docs/games/another-shore.md` | `themes/anotherworld/` |
| Another Shore II | `docs/games/another-shore-ii.md` | `themes/shore/` (parked) |
| Space Invaders | `docs/games/space-invaders.md` | `themes/invaders/` |
| Star Fox (Operation Nightlight) | `docs/games/star-fox.md` | `themes/starfox/` (scene/, models/, pure tuning in `*.ts`), `public/starfox/pilots/` |
| Nova & Rex' Drive to the Mountains (`outrun`) | `docs/games/outrun.md` | `themes/outrun/`, `public/outrun/` (its pictures), `scripts/outrun-lab/` (shots and how the pictures are made) |
| Neon Shrine (the portal's world) | `docs/games/neon-shrine.md` | `themes/zelda/` |
| The Wildwood (Neon Shrine's second act) | `docs/games/wildwood.md` | `themes/zelda/world/wildwood.ts`, `lab1.ts`, `lab2.ts` |
| Hall of Fame | `docs/games/hall-of-fame.md` | `themes/leaderboard/`, `server/api/` |
| Rex & Nova: Space Voyagers II (theme id `voyagers2`) | `docs/games/voyagers2.md` | `themes/voyagers2/` (DESIGN.md; engine/, story/, render/), `scripts/voyagers2-lab/`, `public/voyagers2/` |
| Rex & Nova: Space Voyagers I (theme id `galaga`, parked) | `docs/games/galaga.md` | `themes/galaga/` (DESIGN.md; engine/, story/, render/), `scripts/galaga-lab/`, `public/galaga/` |
| Global radio | `docs/games/global-radio.md` | `themes/radio/engine.ts`, `catalog.ts`, `components/RadioWidget.vue` |
| G-Type | `docs/games/r-type.md` | `themes/rtype/` |
| Hangar | `docs/games/hangar.md` | `themes/ships/`, `themes/hangar/` |
| Space Paddle — The Odyssey (`breakout`) | `docs/games/breakout.md` | `themes/breakout/` (engine.ts, pixel.ts, Breakout.vue, Landing.vue) |
| Russian Block Game | `docs/games/parked-and-classic.md` | `themes/tetris/` |
| Scandinavian Glass (parked) | `docs/games/parked-and-classic.md` | `themes/scandi/` |
| Space (parked) | `docs/games/parked-and-classic.md` | `themes/space/` |
| Tufte Desk (parked) | `docs/games/parked-and-classic.md` | `themes/desk/` |

AGENTS.md describes what applies to the whole repo today. Per-game detail
goes in `docs/games/<game>.md`; replace outdated text there instead of
appending a new dated section. History belongs in `git log`.

Reverted-but-recoverable work from the May 2026 reset: `docs/history.md`.
