# AGENTS.md

Personal site, Nuxt 4 on Cloudflare Pages. `/` is the **Portal**, a small
neon town you walk around in, whose buildings lead to everything else; each
game is a **theme** at `/?theme=<id>`, reached from its cabinet. The town is
the west end of Neon Shrine's world. The theme system and how to add a theme
live in the project skill `.claude/skills/phareim-theme/SKILL.md` (use it).
The portal itself: `docs/games/portal.md`. Site-wide detail (stack, D1,
external APIs, fonts, icons, state, source layout, themes, cost of `/`, auth):
`docs/site.md`.

## Commands

- `npm run dev` — dev server on port 3030 (`docs/site.md`)
- `npm test` — every `tests/*.test.mjs` in one pass (what the deploy runs). Per area: `test:portal`, `test:zelda`, `test:eschold`, `test:tetris`, `test:leaderboard`, `test:starfox`, `test:wingman`, `test:anotherworld`, `test:galaga`, `test:voyagers2`, `test:outrun`, `test:breakout`, `test:invasive`, `test:battery`, `test:miniworld`, `test:figur`; what each covers: `docs/site.md` → "Test areas"
- `npm run typecheck` — `nuxi typecheck` (vue-tsc); the Sleeper deploy runs this before build
- `npm run build` — production build (`cloudflare-pages` preset in `nuxt.config.ts`, output `dist/`)
- `npm run preview` — preview built site

## Stack

Nuxt 4 + Vue 3 + TypeScript, source at the repo root; Cloudflare Pages project `phareim-no` with SSR in the Pages worker; one D1, `phareim-leaderboard` (`LEADERBOARD_DB`, schema in `migrations/`, no R2). Self-hosted fonts (`themes/base/fonts.css`; keep the `@import` lines above the `@font-face` rules), pixel-art icons and manifest, no service worker. State: the URL picks the theme, no cookie. External APIs: studio.phareim.no, the news feed, auth.phareim.no, wave-jobs and `mw-world` on Sleeper. All of it: `docs/site.md`.

## Project Structure

`app.vue` (root shell), `pages/index.vue` (active theme's Landing), `error.vue`, `plugins/`, `components/` (HomeChip, GameFrame), `server/` (the profile API: Hall of Fame, saves, wallet, Mini World, sign-in gate), `migrations/`, `composables/`, `themes/<id>/` (registry in `themes/index.ts`; see the phareim-theme skill). The file-by-file map: `docs/site.md` → "Source layout".

There is no menu and no page route but `/`. `servers/mw-world/` is not part of the site build: it runs on Sleeper under PM2 (see its README).

## Theme System (short version — the skill has the rest)

- Twenty-one themes in `themes/index.ts`: the portal (`home: true`), fourteen live, six parked (`disabled: true`, reachable with `?theme=<id>`; one of them is the studio's view stage, `stage`). Neon Shrine is not a theme: it is the portal's world. The list: `docs/site.md` → "Themes"; per game: the table under "Games → docs".
- **Nothing scrolls**: `html`/`body`/`#__nuxt` are `overflow: hidden`, every landing is locked to the viewport and fits a phone (checked at 375×667). Full-screen heights use `var(--app-height, 100dvh)` (defined in `app.vue`), never bare `100dvh`.
- **Bottom band**: `--app-safe-bottom` (defined in `app.vue`) is the strip along the bottom edge where nothing interactive or meaning-bearing may sit; backdrops may run through it. Anchor bottom UI as `calc(<gap> + var(--app-safe-bottom, 0px))`, never on the bare inset; canvas games take it as a bottom inset.
- The URL is the only source: `/` is the portal, `/?theme=<id>` that theme; legacy ids map first, an unknown id shows the portal. No cookie, no random pick. No way from one game straight to another.
- `launch(id)` pushes and the home chip / Escape (`goHome()`) steps back; a game sets `navigationLocked` while a run is on.
- Each `themes/<id>/theme.css` defines the `--theme-*` contract on `.{id}-page`; pages read `var(--theme-*, fallback)` and never hardcode colours or branch on `prefers-color-scheme`. Each `themes/<id>/Landing.vue` owns the landing page.

## Key Patterns

- **What `/` costs** (296 KB over the wire in 5 requests at last measurement; numbers in `docs/site.md`). Four rules, each broken once:
  - **A landing imports no game.** A `Landing.vue` reaches its game through `defineAsyncComponent(() => import(...))`, never a static import of `Game.vue`.
  - **No prefetch hints.** `server/plugins/no-prefetch.ts` strips them; it rewrites `html.head` as a string, and filtering that array removes the entire head.
  - **Styles are a file, not inline.** `features.inlineStyles: false` in `nuxt.config.ts`.
  - **No dead assets in `public/`.**
- No `runtimeConfig`: server routes read bindings and secrets from `event.context.cloudflare.env`. If it comes back, server code **must** call `useRuntimeConfig(event)`, or Workers return a config frozen before env vars exist (`docs/site.md` → "Config, geo and auth").
- Norway only for Ulrikke's games (Mini World, Lag Din Figur): `server/middleware/norway.ts` and `plugins/norway.server.ts`; `mw-world` has the same gate in nginx (`~/github/sleeper/geo/`).
- No auth system of its own; identity is auth.phareim.no's (cookie `session_token` on `.phareim.no`). **The auth gate**: Mini World and Lag Din Figur need a signed-in account, and the server is the actual lock (`server/utils/account.ts`, `sessionCheck.ts`, `accountLinks.ts`; fail closed). A new route for these games must call `requireAccountPlayer` (or go through `mwRoute`); `tests/miniworld-account.test.mjs` fails on an uncovered file under `server/api/mw/`. `server/utils/sessionCheck.ts` and `themes/zelda/account.ts` are shared with `mw-world`, so `deploy.sh` restarts it when they change. Details: `docs/site.md`, `docs/games/mini-world.md` (Sign-in), `docs/games/portal.md`.

## Deployment

- **Deploy**: push to `master` → signed `sleeper-deploy` webhook → `scripts/deploy.sh` on Sleeper, which builds committed `origin/master` (`scripts/deploy-site.sh --auto`: tests, typecheck, build, D1 migrations, publish to Pages). GitHub Actions is off; pull requests run no CI.
- **Branch previews**: `bash scripts/deploy-site.sh --branch <name>` publishes `<name>.phareim-no.pages.dev` without migrations. A preview shares production's D1, so saves and scores made there are real: never finish a game run in a preview.
- Manual run, credentials, locks, logs and health: `docs/site.md` → "Deployment extras".

## Keyboard and Escape

The shell leaves the arrow keys to the games. In a game, an Escape tap pauses and a 3-second hold quits the run; `P` pauses too. A game that uses Escape outside a run must `preventDefault`. Shared code: `themes/base/escHold.ts` and `EscHold.vue`. The full contract: `docs/games/escape.md`.

## Hall of Fame and the radio

- Every score game calls `submitScore('<id>', score)` on game over (never a 0); API failures are silent. API, avatars and name rules: `docs/games/hall-of-fame.md`.
- `RadioWidget.vue` in `app.vue` is the site-wide radio (`themes/radio/engine.ts`, `catalog.ts`). Wiring and the contract with each `audio.ts`: `docs/games/global-radio.md`.

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
| Invasive (Invaders Mk II) | `docs/games/invasive.md` | `themes/invasive/` (engine.ts, pixel.ts, audio.ts, Game.vue, Landing.vue), `scripts/invasive-lab/` |
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
