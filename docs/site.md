# Site-wide detail

Stack, storage, external APIs, fonts, icons, state, source layout, the theme
system's rules, the cost of `/`, auth and the test areas. AGENTS.md points
here; per-game detail lives in `docs/games/`.

## Test areas

`npm test` runs every `tests/*.test.mjs` in one pass (what the deploy runs).
Per area:

- `test:portal` — the town, every cabinet and link, the login console, the NEW LOOK stall, the newsstand, the coast road
- `test:zelda` — Neon Shrine: exits, saves, a full run to the Sun Prism, the hero's look, audio (both chips), the Wildwood run, the views (the registry, the 16-bit view's camera, how tiles stand, the turn), the HUD skins
- `test:eschold` — the shared Escape tap/hold state machine
- `test:tetris` — Russian Block Game gestures (tap, direction lock, drop, soft drop, hold)
- `test:leaderboard` — Hall of Fame names and game list
- `test:starfox`, `test:wingman` — Star Fox balance, story, arsenal, bosses; the wingman squad
- `test:anotherworld` — Another Shore: physics, threats, a playtester through all five chapters, saves, audio
- `test:galaga` — Space Voyagers I (parked): engine, encounters, bosses, the radio director, autopilot voyages, layout, audio
- `test:voyagers2` — Space Voyagers II (the Wing Commander one): flight, damage, missiles and decoys, the two seats, sorties, the campaign tree and save, the bot table, the words, the layout; `docs/games/voyagers2.md`
- `test:outrun` — Drive to the Mountains: road, driving, traffic, crashes, clock, banter, and that `public/outrun` holds exactly the listed pictures
- `test:breakout` — Space Paddle — The Odyssey: the rules in `themes/breakout/engine.ts` (speed, boards, pulse bricks, the planet, capsules, lives, attract mode, a seeded autopilot run); `docs/games/breakout.md`
- `test:invasive` — Invasive (Invaders Mk II): the rules in `themes/invasive/engine.ts` (cuts and what they sever, the lance and the hearts, roots and windows, an unplayed run, autopilot runs on a phone and a desk field); `docs/games/invasive.md`
- `test:battery` — Night of the Dead Battery: puzzles, story, audio, a walkthrough to the credits
- `test:miniworld` — Mini World: save, contests, wallet and neighbourhood rules (memory and real D1 SQL), physics, obby, the sign-in gate
- `test:figur` — Lag Din Figur: garments, packing, figures and save, Pip, the renderers, the Minecraft skin

`npm run dev` listens on port 3030 (host 0.0.0.0). On Sleeper llm-gateway
already holds 127.0.0.1:3030, so Nuxt takes another port: pass that address
to lab scripts (`scripts/zelda-lab/*-shot.mjs` default to
`http://127.0.0.1:3030/`). `npm run build` uses the `cloudflare-pages` preset
set in `nuxt.config.ts`; output goes to `dist/`.

## Stack

- **Framework**: Nuxt 4 + Vue 3 Composition API + TypeScript (`themes/scandi/Bubbles.vue` is Options API, moved verbatim). The source stays at the repo root, not in `app/`: with no `app/` directory Nuxt 4 keeps the root as `srcDir` by itself. `nuxt.config.ts` turns Nuxt 4's `noUncheckedIndexedAccess` back off, and the root `tsconfig.json` still extends the single `.nuxt/tsconfig.json` (app, server and `themes/` in one project), not the split `tsconfig.app/server/shared.json`.
- **Hosting**: Cloudflare Pages, project `phareim-no`. SSR runs in the Pages worker (`_routes.json` sends everything except static assets to it), so the first paint is already the theme the URL names.
- **Dependencies of note**: `three` 0.185 (+ `@types/three`), used by Star Fox and Mini World and loaded only in their async chunks, never the entry (last checked 2026-09-25); `@fontsource/space-grotesk` + `@fontsource/space-mono` (self-hosted fonts).
- One world: the town is the west end of Neon Shrine's world; the coast road east leads into the adventure.

## Database

One D1, `phareim-leaderboard` (id `54e101f9-4026-4fd1-a78a-7a8976e1301e`), bound as `LEADERBOARD_DB` in `wrangler.toml`, schema in `migrations/`, applied from Sleeper before every deploy. It holds the player profiles: Hall of Fame scores, Hangar ships and the adventure save slots (Neon Shrine, Another Shore, Night of the Dead Battery, Mini World, Lag Din Figur) — `docs/games/hall-of-fame.md`. Also the site-wide bits wallet (`players.bits`, `wallet_ops`) and Mini World's neighbourhood tables (`mw_*`) — `docs/games/mini-world.md`. No R2 binding.

## External APIs

Five.

- **studio.phareim.no**: Neon Shrine reads the studio's published sprites from `/live/neon-shrine.json` after mount (public, no cookie) and draws them over its own (`themes/zelda/render/live.ts`, `docs/games/neon-shrine.md` → "Live art from the studio"); the build writes `public/studio/neon-shrine.json` (about 100 KB) for the studio to edit against.
- **sleeper.phareim.md** (the news feed): the newsstand on the portal's coast fetches the feed's reader JSON (`/reader/index.json`, `/reader/<slug>.json`) from the browser, no cookie, and shows the pieces in a panel; the address is `NEWS_BASE` in `themes/zelda/newsLinks.ts` (`docs/games/portal.md` → "The newsstand").
- **auth.phareim.no**, the site-wide account: the login console in Petter's house asks `GET /api/session` and `POST /api/sign-out` cross-origin with the cookie and links to its sign-in page; the address is `AUTH_BASE` in `themes/zelda/account.ts` (`docs/games/portal.md`). Mini World and Lag Din Figur also sign in through it (`POST /api/sign-in` from their own windows, `composables/useAccount.ts`), and the site's server and `mw-world` ask `GET /api/session` with the request's `session_token` cookie to lock them.
- **wave-jobs** on Sleeper: `POST https://sleeper.phareim.no/wave-jobs/avatar`, Bearer `WAVE_JOBS_KEY`, paints the Hall of Fame avatars.
- **mw-world** on Sleeper: `wss://sleeper.phareim.no/mw-world/ws`, PM2, port 3034, code in `servers/mw-world/`, deployed by the sleeper-deploy webhook's `deploy.sh`; relays Mini World's shared world. Mini World plays solo when it is down.

`server/` holds the Hall of Fame routes (`/api/leaderboard`, `/api/player`, `/api/score`, and `/api/avatar` for wave-jobs' callback), `/api/wallet` and Mini World's `/api/mw/*`.

## Fonts

Two faces, the Neon Dreams split: `--font-person` (Space Grotesk at weight 300, the face's lightest, for body, name and page titles; 400/500 for emphasis: name, blurbs, prose) and `--font-machine` (Space Mono: HUD, hints, over-titles, canvas score pops, shas). Defined on `:root` in `themes/base/fonts.css` (imported first in `themes/index.ts`), latin subsets only; canvas code imports `MACHINE_FONT` from `themes/base/fonts.ts`. A third face, `--font-pixel` (Neon Pixel, Neon Shrine's 5×7 canvas font as a 3 KB webfont in `public/fonts/`, for the pixel games' HTML text; `docs/games/pixel-look.md`). Nothing loads from Google Fonts. The parked themes keep their own faces (desk: ET Book). The `@import` lines must stay **above** the `@font-face` rules: below them, Vite emits no woff2 at all and the site silently falls back to system fonts.

## Icons and installed app

- `public/favicon.ico` (16/32/48) and `public/apple-touch-icon.png` (180) are pixel art: the pixel look's dusk — striped sun, violet ridge, teal grass, the rose path — drawn on a 16/32/36-pixel grid and scaled up nearest-neighbour by `scripts/make-favicon.py` (Pillow). Linked from `nuxt.config.ts` `app.head.link`, along with `theme-color` `#0b0616`.
- `public/manifest.webmanifest` makes the site installable: `display: fullscreen` on Android (standalone on iOS, where `black-translucent` puts the page under the status bar), icons `icon-192.png`/`icon-512.png` from the same script.
- `html`/`body` carry `touch-action: manipulation`, which stops Safari's double-tap zoom (it ignores `user-scalable=no`).
- No service worker, on purpose: the installed app loads fresh HTML on every cold start. While it stays open, `plugins/build-check.client.ts` asks `/_nuxt/builds/latest.json` each time it comes back to the foreground (Nuxt itself asks once an hour); a new build makes the next navigation a full load, never a reload mid-run. A service worker would only earn its place for offline play.

## State

The URL picks the theme (`/?theme=<id>`, no cookie); Nuxt `useState` holds the navigation lock (no state library). sessionStorage `portal.return` puts the portal's hero back where they left. localStorage holds per-game high scores, the browser's Hall of Fame player (`phareim.player`) and the bits wallet (`phareim.wallet`, shared by Neon Shrine and Mini World). Neon Shrine's hero wears the newest choice: the look chosen at the NEW LOOK stall on the square (`zelda.heroLook`, this browser only) until the made figure is changed after it, else the colours of Lag Din Figur's active figure (`figur.heroColors`), else Mini World's active person (`miniworld.heroColors`).

## Source layout

- `app.vue` — root shell: theme class, theme backdrop, `<NuxtPage>`, HomeChip, page title; global CSS locks the document (no scrolling)
- `pages/index.vue` — renders the active theme's Landing component (180 ms fade on switch)
- `error.vue` — 404: a terminal block for the portal and the neon games, own blocks for a few themes; every one leads to `/`
- `plugins/build-check.client.ts` — a new deploy found when the app comes back to the foreground reloads on the next navigation
- `components/HomeChip.vue` — in games only: the ⌂ chip back to the portal (bottom-right), hidden while a game locks navigation; the only site chrome
- `components/GameFrame.vue` — a game on another address in an iframe that fills the screen, for the installed app (`/?frame=<id>`, `composables/useFrame.ts`, `themes/frames.ts`; `docs/games/frame.md`)
- `server/api/` — leaderboard.get, player.post, score.post, avatar.post (the Hall of Fame API); profile.get (Hangar); ship/select.post (the ship pick; no screen calls it since the Hangar dropped its picker); save.get/.post (profile save slots: Neon Shrine, Another Shore, Night of the Dead Battery, Mini World); wallet.get/.post (site bits); mw/* (Mini World's neighbourhood); account/link.post
- `server/utils/store.ts` — D1 store + in-memory dev store behind one interface, id validation
- `server/utils/avatar.ts` — asks wave-jobs on Sleeper to paint a player's pilot (callback into avatar.post)
- `server/utils/miniworld*.ts` — the wallet and neighbourhood stores (D1 + memory) and route rules
- `server/utils/account.ts`, `accountLinks.ts`, `sessionCheck.ts` — the sign-in gate for Mini World and Lag Din Figur
- `migrations/` — D1 schema for phareim-leaderboard, numbered SQL, applied by the Sleeper deploy
- `composables/useTheme.ts` — active theme from the URL, isHome, launch/goHome (router.push), navigationLocked
- `composables/useThemeNavigation.ts` — Escape back to the portal, and the 3 s grace after a game lets go; called once from app.vue
- `composables/useInputMode.ts` — keyboard vs touch, so game hints say PRESS ENTER or TAP, never both. SSR guess from sec-ch-ua-mobile/UA, then `(hover: none) and (pointer: coarse)` at mount, then the first keydown/touch/mouse press wins. `hint(keyboardText, touchText)` in templates.
- `composables/useDeviceCapability.ts` — what the device can afford: `isLowPowerDevice()` (few cores, or touch with little memory — Mini World's ladder, lifted out) and `canvasPixelRatio(max)`, which every canvas game's ratio runs through (Space Voyagers alone does not: one small buffer and one blit a frame, whole device pixels at the real ratio on a wide screen, the frame at a whole scale fitted by CSS on a narrow one; `docs/games/galaga.md`). Whole ratios only.
- `composables/useLeaderboard.ts` — the browser's Hall of Fame player (localStorage), submitScore / fetchBoards / reroll
- `composables/useAccount.ts` — the site account inside Mini World and Lag Din Figur: session, sign-in, link to the player profile, Logg ut
- `composables/useWallet.ts` — the site's bits, one balance for Neon Shrine and Mini World; `useMiniWorld.ts` / `useMiniWorldSocial.ts` — Mini World's save and neighbourhood
- `themes/index.ts` — registry, `liveThemes` (not parked, not the portal) and every theme.css import
- `themes/content.ts` — default landing copy (DefaultLanding)
- `themes/base/pixel/` — the pixel look: stage (buffer, whole-number scale, light map, bloom, scanlines), sprites + 5×7 font, side-view scenery, pixel.css (text, and `.px-box`/`.px-btn`, Neon Shrine's dialog box for HTML). Every live page uses it: `docs/games/pixel-look.md`
- `themes/base/` — DefaultLanding shell, SocialLink, EscHold (shared Escape tap/hold), fonts.css + fonts.ts (site fonts)
- `themes/_template/` — starting point for a new theme
- `themes/portal/` — the home theme on `/`: the page (hint, hidden link index, ending panel) around the world shell
- `themes/zelda/` — the one world: engine, world data (town + Neon Shrine), renderer (the classic view, the 16-bit isometric one a visit starts in, the pencil one; `views.ts`), audio, and the shell `Zelda.vue`
- `themes/radio/` — engine.ts + catalog.ts: the widget's six game stations (the generative radio is radio.phareim.no, a link out from the beach)
- `themes/battery/` — Night of the Dead Battery: engine/, content/, render/, audio.ts; Landing.vue loads Game.vue as its own chunk
- `themes/galaga/` — Rex & Nova: Space Voyagers I (parked; the id stays `galaga`): engine/, story/, render/, audio.ts; Landing.vue loads Game.vue as its own chunk
- `themes/voyagers2/` — Rex & Nova: Space Voyagers II, a cockpit space-combat campaign in three.js (the SPACE VOYAGERS cabinet): engine/, story/, render/, audio.ts; Campaign.vue and Game.vue their own chunks
- `themes/miniworld/` — Mini World (Ulrikke's game): core/ (pure rules), scene/ (three.js), ui/ (panels), Game.vue as its own chunk
- `themes/figur/` — Lag Din Figur (Ulrikke's second): core/ (garment textures, save, Pip), render/ (the four game looks), ui/, Game.vue as its own chunk
- Other themes: `anotherworld/ shore/ scandi/ breakout/ rtype/ invaders/ invasive/ starfox/ outrun/ tetris/ leaderboard/ hangar/ ships/ space/ desk/`

There is no menu and no page route but `/`. The site's own server code is the profile API in `server/`; `servers/mw-world/` is not part of the site build: it runs on Sleeper under PM2 (see its README). Who Petter is and how to reach him lives in the portal (his house, and a visually hidden HTML block for search engines and screen readers).

## Themes

Twenty-one themes in `themes/index.ts` (verified 2026-11-11): the portal (`home: true`), fourteen live and six parked. Live: Lag Din Figur, Mini World, Night of the Dead Battery, Another Shore, Rex & Nova: Space Voyagers II (id `voyagers2`), Space Paddle — The Odyssey (`breakout`), G-Type, Space Invaders, Invasive (Invaders Mk II), Star Fox, Drive to the Mountains (`outrun`), Russian Block Game, Hall of Fame, Hangar. Neon Shrine is not a theme: it is the portal's world. Parked (`disabled: true`: no way in from the portal; still reachable with `?theme=<id>`): Rex & Nova: Space Voyagers I (`galaga`), Another Shore II, Scandinavian Glass, Space, Tufte Desk, and the view stage (`stage`: Neon Shrine's world in the studio's frame, `docs/games/neon-shrine.md` → "The studio's stage").

- The URL is the only source: `/` is the portal, `/?theme=<id>` that theme; legacy ids map first (`hacker` → galaga, `playerone` → portal, `zelda` → portal, `tetris` → russian), an unknown id shows the portal. No cookie, no random pick.
- No way from one game straight to another (arrows, swipes, chevrons and dots were removed on Petter's wish). You walk out to the portal and into the next cabinet.
- History: the portal's `launch(id)` pushes and the home chip / Escape (`goHome()`) steps back to it, so the back button walks between portal and game; both ignore the navigation lock.
- Each `themes/<id>/theme.css` defines the `--theme-*` contract on `.{id}-page` (ten tokens, listed in the skill). Pages read `var(--theme-*, fallback)` and never hardcode colours or branch on `prefers-color-scheme` — dark mode is each theme's own business.
- Each `themes/<id>/Landing.vue` owns the landing page. Most wrap `themes/base/DefaultLanding.vue`; a theme may replace the whole page.
- A game sets `navigationLocked` while a run is on; Escape and the home chip leave it alone then.
- Nothing scrolls: `html`/`body`/`#__nuxt` are `overflow: hidden` with `overscroll-behavior: none`, and every landing is locked to the viewport; a landing must fit a phone viewport (checked at 375×667). Full-screen heights use `var(--app-height, 100dvh)` (defined in `app.vue`): in the iOS home-screen app 100dvh comes up a status bar short and leaves a white strip at the bottom.
- Bottom band: `--app-safe-bottom` (defined in `app.vue`) is the strip along the bottom edge where nothing interactive or meaning-bearing may sit: buttons, text, hints, the player's ship or paddle. Backdrops may run through it. In a browser tab it equals `env(safe-area-inset-bottom)`; installed as a web app (`display-mode: standalone/fullscreen`) it is `max(48px, inset + 30px)`, clear of the home indicator and system swipes. Canvas games take it as a bottom inset.

## What `/` costs

Measured 2026-09-30 (4× CPU, 1.6 Mbps, 150 ms RTT, cold): 296 KB over the wire in 5 requests — the document plus 4 files. Since Nuxt 4 the entry is split into about ten modulepreloaded files (Vue's runtime, EscHold and the pixel stage sit in their own chunks; async chunks reach the entry through an import map), the same bytes in more requests. Four rules keep it there, each of which was broken once:

- **A landing imports no game.** `themes/index.ts` imports every `Landing.vue` statically so a cabinet has no waiting, but a `Landing.vue` must reach its game through `defineAsyncComponent(() => import(...))`. Battery, Mini World, Lag Din Figur, Space Voyagers and Star Fox's views do. Importing `Game.vue` in `themes/galaga/Landing.vue` puts the whole game in the entry. The title screen still server-renders, so this costs the first paint nothing.
- **No prefetch hints.** `server/plugins/no-prefetch.ts` strips the `<link rel=prefetch>` tags Vite emits (21 of them, 465 KB) from the rendered head. It rewrites the one-element `html.head` array as a string; filtering that array instead removes the entire head.
- **Styles are a file, not inline.** `features.inlineStyles: false` in `nuxt.config.ts`. All 19 theme stylesheets are global and total 82 KB; the HTML here is `cf-cache-status DYNAMIC` (the Norway gate and the sign-in cookie), so anything inlined is re-sent every visit and can never be cached.
- **No dead assets in `public/`.** They are shipped, un-hashed and un-referenced.

The portal makes one more request after mount, to studio.phareim.no for the live art (`render/live.ts`): small, never awaited, and not in the 296 KB above.

Since 2026-11-12 a visit starts in the world's 16-bit view, which adds to that number (not measured again over the wire; gzip sizes of the built files): the view's own chunk, fetched before the first frame (the GPU engine with its shaders, the plants, the backdrop, the modelled hero and the land beyond the edge, 51 KB), about 14 KB more in the world's chunks (the second sound chip, the hi-res HUD and its font, the HTML dress) and the second pixel font (2 KB). The view's chunk stays out of the entry (`tests/zelda-views.test.mjs`); a browser that chose the classic view does not fetch it.

## Config, geo and auth

- No `runtimeConfig`. The Hall of Fame routes read their D1 binding and the `WAVE_JOBS_KEY` secret from `event.context.cloudflare.env`, which needs no config; background work goes through `event.context.cloudflare.context.waitUntil`. If `runtimeConfig` comes back: secrets are set on Cloudflare by `NUXT_`-prefixed env vars, and server code **must** call `useRuntimeConfig(event)` — without the event, Workers return a config frozen at module init, before env vars exist, so the value silently never applies.
- Norway only for Ulrikke's games: `server/middleware/norway.ts` answers 403 outside Norway to `/?theme=miniworld|figur`, `/api/mw/*` and `/api/account/*` (country from `request.cf`, none in dev = allowed, Sleeper's addresses always allowed; `server/utils/norway.ts`), and `plugins/norway.server.ts` hands the answer to the page so a cabinet opened from the portal shows "BARE ÅPENT I NORGE" instead of loading the game. `mw-world` has the same gate in nginx on Sleeper (`~/github/sleeper/geo/`).
- No auth system of its own; identity is auth.phareim.no's (Reader keeps users and sessions, cookie `session_token` on `.phareim.no`).
- The auth gate for Ulrikke's games: the browser renders the game only when `useAccount().state` is `in` (`Landing.vue`); the server is the actual lock (`server/utils/account.ts`, `sessionCheck.ts`, `accountLinks.ts`; fail closed when auth is down). `server/utils/sessionCheck.ts` and `themes/zelda/account.ts` are shared with `mw-world`, so `deploy.sh` restarts it when they change. Hall of Fame scores stay open. The portal needs no login, but a signed-in visitor plays under the account's profile (`usePortalAccountLink`), and once a profile is an account's, `/api/save` for every slot needs its owner's session (`guardLinkedPlayer`); another account signing in on the browser clears the local copies. Under `nuxi dev` the games show the retry window (auth refuses localhost); `scripts/login-lab/shots.mjs` fakes auth. Details: `docs/games/mini-world.md` (Sign-in), `docs/games/portal.md`.

## Deployment extras

- D1 migrations apply before publishing to Pages (`phareim-no`, production branch `master`). `wrangler.toml` carries the output dir, compatibility flags and `LEADERBOARD_DB` binding. Credentials: `~/.config/phareim-deploy/env` (600), with Pages and D1 edit rights.
- The deploy runs `npm test`, then typecheck and build, in an isolated worktree through `heavy`.
- Branch previews publish without migrations at `<name>.phareim-no.pages.dev`. There is no standing `beta` branch or beta.phareim.no.
- Manual: `bash scripts/deploy-site.sh [--branch <name>] [commit]`. File lock and successful revision: `~/.local/state/phareim-deploy/`. Busy pushes coalesce in the webhook queue; duplicate revisions skip work. Logs: `pm2 logs sleeper-deploy`; status: `https://sleeper.phareim.no/deploy/health`.
