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
- `npm run typecheck` — `nuxi typecheck` (vue-tsc); CI runs this before build
- `npm run build` — production build; the `cloudflare-pages` preset is set in `nuxt.config.ts`, output goes to `dist/`
- `npm run preview` — preview built site

## Stack

- **Framework**: Nuxt 3 + Vue 3 Composition API + TypeScript (`themes/scandi/Bubbles.vue` is Options API, moved verbatim)
- **Hosting**: Cloudflare Pages, project `phareim-no`. SSR runs in the Pages worker (`_routes.json` sends everything except static assets to it), which is what lets the random first-visit theme be picked server-side.
- **Database / storage**: none. D1 (`phareim-rpg`) was deleted 2026-07-23 (final export at `~/backups/d1/2026-07-23/phareim-rpg.sql` on Sleeper). The R2 binding and the image-generation API were removed 2026-09-03. Restore from git history if needed.
- **External APIs**: GitHub REST only (`/api/projects`, `/api/meta`)
- **Dependencies of note**: `three` 0.185 (+ `@types/three`), used only by the Star Fox theme and loaded as an async chunk (2026-09-05)
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
  ThemePager.vue     — edge arrows (hover devices only) + dots; the only site chrome
composables/
  useTheme.ts        — active theme, cookie, setTheme/next/previous, navigationLocked
  useThemeNavigation.ts — swipe + ArrowLeft/ArrowRight, called once from app.vue
themes/              — see the phareim-theme skill
  index.ts           — registry (order = swipe order) and every theme.css import
  content.ts         — default landing copy
  base/              — DefaultLanding shell, ProfileCard, SocialLink
  _template/         — starting point for a new theme
  scandi/ hacker/ breakout/ rtype/ invaders/ starfox/ space/ desk/
server/api/          — Nitro API routes (h3 helpers are auto-imported)
  projects.ts        — phareim's public GitHub repos
  meta.ts            — this repo's commits, paginated
server/utils/        — github.ts (headers + optional token)
```

There is no menu (removed 2026-09-03). `/about`, `/projects` and `/meta` are
reachable by URL only; a theme may link to them if it wants to.

## Theme System (short version — the skill has the rest)

- Eight themes, in swipe order: **Scandinavian Glass**, **Cyberpunk** (a loose Space-Invaders-inspired shmup), **Breakout** (the arcade classic, added 2026-09-04; same canvas-behind-the-card pattern as Cyberpunk, plays itself until Enter), **R-Type** (endless side-scrolling shooter in neon-vector outline style, added 2026-09-05; attract-mode autopilot until Enter/tap, Force pod on Shift/double-tap, charge beam on held Space, procedural cave walls that narrow with distance, kill-streak multiplier; built by Muse Spark via `/musecode` in three parallel variants, this one won), **Space Invaders** (the faithful 1978 formation game in a synthwave look, added 2026-09-05: 5×11 formation with the original sprites, step-timer march that quickens as invaders die, eroding bunkers, mystery UFO, one shot on screen, kill-combo multiplier; sprite-shatter kills, screen shake, heartbeat-coupled grid and sun, pre-rendered glow sprite cache for phones. Also `/musecode`: three looks (phosphor cabinet, risograph paper, synthwave) → review/polish → two effect packages on the winner → review/fix; the losers are in git history, commits `8344268`..`d5436f7`), **Star Fox** (on-rails 3D flight shooter in three.js, added 2026-09-05: camera behind a low-poly Arwing, twin lasers, barrel roll with immunity on Shift/double-tap, rings to fly through, enemy formations, ground pillars and rocks, 3-hit shield, kill-streak multiplier; synthwave look that shares the Space Invaders palette — striped sun, pulsing grid, mountain silhouettes. Attract-mode autopilot until Enter/tap. Also `/musecode`: three looks (Super FX pixel render, neon vector, synthwave) → Claude review + Muse fix round → synthwave won; the losers are in git history up to commit `dbede6f`. three.js is loaded lazily by `starfox/Landing.vue` so the other themes do not pay for it), **Space**, **Tufte Desk** (the tactile paper-on-desk layer from the tufte-viz design system, added 2026-09-03; it replaced the flat Tufte theme 2026-09-04 and carries the ET Book @font-face). **Nothing scrolls** (2026-09-05): `html`/`body`/`#__nuxt` are `overflow: hidden` with `overscroll-behavior: none`, every landing is locked to the viewport, and the three content routes scroll inside their own `.page-scroll` container. Almanac, the one landing that needed the page to scroll, was removed the same day. First visit: random. Then: the `theme` cookie (one year). `?theme=<id>` overrides and re-sets the cookie.
- Each `themes/<id>/theme.css` defines the `--theme-*` contract on `.{id}-page` (ten tokens, listed in the skill). Pages read `var(--theme-*, fallback)` and never hardcode colours or branch on `prefers-color-scheme` — dark mode is each theme's own business.
- Each `themes/<id>/Landing.vue` owns the landing page. Most wrap `themes/base/DefaultLanding.vue`; a theme may replace the whole page.
- A theme that uses arrow keys or horizontal touch itself (the Cyberpunk and Breakout games) sets `navigationLocked` while it does.
- A landing must fit a phone viewport (checked at 375×667): the document does not scroll, so anything below the fold is unreachable.

## Key Patterns

- Runtime secrets via `nuxt.config.ts` `runtimeConfig`, set on Cloudflare by `NUXT_`-prefixed env vars (`NUXT_GITHUB_TOKEN` → `githubToken`).
- **Always `useRuntimeConfig(event)` in server code.** Without the event, Workers return a config frozen at module init, before env vars exist — the token silently never applies. (Found 2026-09-03; the old image API had this bug and was always 503 in production.)
- No auth system.

## Deployment

- **CI/CD**: `.github/workflows/deploy.yml` — `build` job (npm ci → typecheck → build → artifact) on push and PR; `deploy` job (wrangler `pages deploy dist`) on push to `master` only, then notifies Sleeper.
- `wrangler.toml` carries `pages_build_output_dir = "dist"` and `nodejs_compat`; no bindings.
- No automated test suite.

## Keyboard

- `←` / `→` switch theme (unless a theme has locked navigation).
