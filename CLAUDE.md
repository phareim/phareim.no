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
- `npm run typecheck` — `nuxi typecheck` (vue-tsc); CI runs this before build
- `npm run build` — production build; the `cloudflare-pages` preset is set in `nuxt.config.ts`, output goes to `dist/`
- `npm run preview` — preview built site

## Stack

- **Framework**: Nuxt 3 + Vue 3 Composition API + TypeScript (`themes/scandi/Bubbles.vue` is Options API, moved verbatim)
- **Hosting**: Cloudflare Pages, project `phareim-no`. SSR runs in the Pages worker (`_routes.json` sends everything except static assets to it), which is what lets the random first-visit theme be picked server-side.
- **Database / storage**: none. D1 (`phareim-rpg`) was deleted 2026-07-23 (final export at `~/backups/d1/2026-07-23/phareim-rpg.sql` on Sleeper). The R2 binding and the image-generation API were removed 2026-09-03. Restore from git history if needed.
- **External APIs**: GitHub REST only (`/api/projects`, `/api/meta`)
- **Dependencies of note**: `three` 0.185 (+ `@types/three`), used only by the Star Fox theme and loaded as an async chunk (2026-09-05); `@fontsource/space-grotesk` + `@fontsource/space-mono` (self-hosted fonts, 2026-09-06)
- **Fonts** (2026-09-06): two faces, the Neon Dreams split — `--font-person` (Space Grotesk at weight 300, the face's lightest, for body, name and page titles; 400/500 for emphasis: name, blurbs, prose) and `--font-machine` (Space Mono: HUD, hints, over-titles, canvas score pops, shas). Defined on `:root` in `themes/base/fonts.css` (imported first in `themes/index.ts`), latin subsets only; canvas code imports `MACHINE_FONT` from `themes/base/fonts.ts`. Nothing loads from Google Fonts any more (Comfortaa and the preconnects are gone). The parked themes keep their own faces (desk: ET Book).
- **State**: Nuxt `useState` + a `theme` cookie (no state library, no localStorage)

## Project Structure

```
app.vue              — root shell: theme class, theme backdrop, <NuxtPage>, ThemePager; global CSS locks the document (no scrolling)
pages/
  index.vue          — renders the active theme's Landing component (180 ms fade on switch)
  about.vue          — /about — brief bio, photo, social links (scrolls inside `.page-scroll`)
  projects.vue       — /projects — GitHub repos fetched live from the GitHub API (same)
  meta.vue           — /meta — commit log of this site from the GitHub API (same)
error.vue            — per-theme 404 blocks
components/
  ThemePager.vue     — neon edge chevrons (all devices since 2026-09-07; hidden while a theme locks navigation) + dots; the only site chrome
composables/
  useTheme.ts        — active theme, cookie, setTheme/next/previous, navigationLocked
  useThemeNavigation.ts — swipe + ArrowLeft/ArrowRight, called once from app.vue
  useInputMode.ts    — keyboard vs touch, so game hints say PRESS ENTER or TAP, never both (2026-09-06). SSR guess from sec-ch-ua-mobile/UA, then `(hover: none) and (pointer: coarse)` at mount, then the first keydown/touch/mouse press wins. `hint(keyboardText, touchText)` in templates.
themes/              — see the phareim-theme skill
  index.ts           — registry (order = swipe order) and every theme.css import
  content.ts         — default landing copy
  base/              — DefaultLanding shell, ProfileCard, SocialLink, fonts.css + fonts.ts (site fonts, 2026-09-06), neonHorizon.js (the shared synthwave backdrop: sky, stars, striped sun, ridge, grid, heartbeat, wave-clear flare — used by Breakout, Invaders and Tetris since 2026-09-06; Star Fox draws its own in three.js)
  _template/         — starting point for a new theme
  anotherworld/ scandi/ hacker/ breakout/ rtype/ invaders/ starfox/ tetris/ space/ desk/
server/api/          — Nitro API routes (h3 helpers are auto-imported)
  projects.ts        — phareim's public GitHub repos
  meta.ts            — this repo's commits, paginated
server/utils/        — github.ts (headers + optional token)
```

There is no menu (removed 2026-09-03). `/about`, `/projects` and `/meta` are
reachable by URL only; a theme may link to them if it wants to.

## Theme System (short version — the skill has the rest)

- Twelve themes, nine live (2026-09-07). **Scandinavian Glass**, **Space** and **Tufte Desk** are parked since 2026-09-06 (`disabled: true` in `themes/index.ts`: out of swipe, pager, cookie and random pick; still reachable with `?theme=<id>`; nothing deleted). In swipe order: **Player One** (the profile theme, first in the list, added 2026-09-07 — see below), **Another Shore**, **Another Shore II**, **Scandinavian Glass**, **Cyberpunk** (a loose Space-Invaders-inspired shmup; the green outlier of the Neon Dreams family since 2026-09-06 — same text/glow/card recipes, own hues, gold powerups), **Breakout** (the arcade classic, added 2026-09-04; same canvas-behind-the-card pattern as Cyberpunk, plays itself until Enter. Re-skinned 2026-09-06 onto the Neon Dreams design system, `~/github/neon-dreams-design`: three neons with three jobs — cyan paddle/ball/HUD, pink bricks in three tints, gold armoured bricks and powerups — over the shared horizon backdrop `themes/base/neonHorizon.js`, which beats on every hit; done as two parallel Muse jobs via `/musecode`, Claude reviewed), **R-Type** (endless side-scrolling shooter in neon-vector outline style, added 2026-09-05; attract-mode autopilot until Enter/tap, Force pod on Shift/double-tap, charge beam on held Space, procedural cave walls that narrow with distance, kill-streak multiplier; built by Muse Spark via `/musecode` in three parallel variants, this one won; on the Neon Dreams contract since 2026-09-06 — violet-black ground, cyan snapped to `#2ff3ff`, orange kept as its danger hue, gold multiplier from x4), **Space Invaders** (the faithful 1978 formation game in a synthwave look, added 2026-09-05: 5×11 formation with the original sprites, step-timer march that quickens as invaders die, eroding bunkers, mystery UFO, one shot on screen, kill-combo multiplier; sprite-shatter kills, screen shake, heartbeat-coupled grid and sun, pre-rendered glow sprite cache for phones; the backdrop comes from `themes/base/neonHorizon.js` since 2026-09-06. Also `/musecode`: three looks (phosphor cabinet, risograph paper, synthwave) → review/polish → two effect packages on the winner → review/fix; the losers are in git history, commits `8344268`..`d5436f7`), **Star Fox** (on-rails 3D flight shooter in three.js, added 2026-09-05: camera behind a low-poly Arwing, twin lasers, barrel roll with immunity on Shift/double-tap, rings to fly through, enemy formations, ground pillars and rocks, 3-hit shield, kill-streak multiplier; synthwave look that shares the Space Invaders palette — striped sun, pulsing grid, mountain silhouettes. Attract-mode autopilot until Enter/tap. Also `/musecode`: three looks (Super FX pixel render, neon vector, synthwave) → Claude review + Muse fix round → synthwave won; the losers are in git history up to commit `dbede6f`. three.js is loaded lazily by `starfox/Landing.vue` so the other themes do not pay for it), **Tetris** (playable Tetris, ported from `tetris-theme-legacy` and reworked for Neon Dreams on 2026-09-06: cyan active piece/ghost, pink stacked blocks, gold line clears, shared horizon with lock/clear pulses. Drag sideways to move, tap to rotate, fast down flick to hard drop, slow down drag to lower, up swipe or HOLD to stash. ROTATE/DROP, pause/resume and exit buttons work on touch and mouse. A gesture stops controlling pieces when its original piece locks or swaps; idle swipes still switch theme. The board sizes to its actual remaining container space with ResizeObserver; mobile profile hides during play/pause, landscape phones use two columns), **Space**, **Tufte Desk** (the tactile paper-on-desk layer from the tufte-viz design system, added 2026-09-03; it replaced the flat Tufte theme 2026-09-04 and carries the ET Book @font-face). **Nothing scrolls** (2026-09-05): `html`/`body`/`#__nuxt` are `overflow: hidden` with `overscroll-behavior: none`, every landing is locked to the viewport, and the three content routes scroll inside their own `.page-scroll` container. Almanac, the one landing that needed the page to scroll, was removed the same day. First visit: random. Then: the `theme` cookie (one year). `?theme=<id>` overrides and re-sets the cookie.
- Each `themes/<id>/theme.css` defines the `--theme-*` contract on `.{id}-page` (ten tokens, listed in the skill). Pages read `var(--theme-*, fallback)` and never hardcode colours or branch on `prefers-color-scheme` — dark mode is each theme's own business.
- Each `themes/<id>/Landing.vue` owns the landing page. Most wrap `themes/base/DefaultLanding.vue`; a theme may replace the whole page.
- A theme that uses arrow keys or horizontal touch itself (the Cyberpunk and Breakout games) sets `navigationLocked` while it does.
- A landing must fit a phone viewport (checked at 375×667): the document does not scroll, so anything below the fold is unreachable.

## Key Patterns

- Runtime secrets via `nuxt.config.ts` `runtimeConfig`, set on Cloudflare by `NUXT_`-prefixed env vars (`NUXT_GITHUB_TOKEN` → `githubToken`).
- **Always `useRuntimeConfig(event)` in server code.** Without the event, Workers return a config frozen at module init, before env vars exist — the token silently never applies. (Found 2026-09-03; the old image API had this bug and was always 503 in production.)
- No auth system.

## Deployment

- **CI/CD**: `.github/workflows/deploy.yml` — `build` job (npm ci → test:tetris → typecheck → build → artifact) on push and PR; `deploy` job (wrangler `pages deploy dist`) on push to `master` only, then notifies Sleeper.
- `wrangler.toml` carries `pages_build_output_dir = "dist"` and `nodejs_compat`; no bindings.
- Tetris gesture regression tests: `npm run test:tetris` (added 2026-09-06).

## Player One (2026-09-07)

`?theme=playerone` is the one theme whose job is Petter, not a game: a
blueprint panel over the shared Neon Dreams horizon
(`themes/base/neonHorizon.js` through `playerone/Horizon.vue`) with the flip
photo, the name in Space Grotesk 300, the two blurbs, a ROLE/BASE readout,
and three contact rows — LinkedIn, GitHub, Bluesky. **No email address on
purpose** (decided 2026-09-07). A slim ABOUT · PROJECTS · META row is the
only link to the three content routes, which are otherwise URL-only.

Nothing moves but the backdrop, and nothing locks navigation. Wide screens
put the panel left of centre so the striped sun reads; phones drop the hint
and pad 46 px so the pager chevrons stay clear; landscape phones go
two-column and hide the HUD corners. Verified 2026-09-07 in headless
Chromium at 1440×900, 375×667, 390×844 and 667×375, plus `/about` and a 404.

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
World homage built from scratch on branch `aw-fresh`: fixed frames and hard
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
