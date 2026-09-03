# CLAUDE.md

## ⚠️ History note — lots of reverted work worth mining

On **2026-05-28** the top of `master` was intentionally reset back to the **April 2 snapshot** (commit `887aa6a`) via a single snapshot-revert commit (`66d257c`). This was a taste decision: the owner disliked the page-shift navigation animations and the cinematic theme-switch effect and prefers the calmer, simpler look. **No history was lost** — the reverted commits are all still in the graph.

The reverted range `887aa6a..4b93c52` contains **~217 commits** (≈2 months of work) with a lot worth bringing back later: many content pages (`/now`, `/feed`, `/uses`, `/colophon`, `/guestbook`, `/gallery`, `/stats`, `/activity`, …), backend APIs (unified Bluesky/X feed, RSS, D1 guestbook, R2 gallery, richer projects API), a Cmd+K command palette, keyboard navigation, accessibility wins, **and a later single-theme "Almanac" paper redesign** (`dc02650`, `c70bba1`, `b24da6b`, `d706eff`) that itself removed the canvas animations + theme-switch cinematics — it may match the owner's calm taste better than this April-2 base while keeping the features.

When restoring things: cherry-pick onto this base, and **leave out the background-canvas animations, page slide/zoom transitions, theme-switch cinematics, menu stagger, and count-up effects** — that motion is exactly what was reverted. A full per-bucket triage of all 217 commits was done; ask the owner for it or re-run the analysis. Tier-1 hardening (security dep bumps to 0 vulns, Vue3 `beforeUnmount` fix, SSR hydration fix, CI injection fix) was already brought forward in commit `1a1b7d5`.

> Tip: `git log --oneline 887aa6a..4b93c52` lists everything; `git show <sha>` to inspect; preview the Almanac end-state with `git checkout 4b93c52 && npm run dev`.

## Commands

- `npm run dev` — dev server on port 3030 (host 0.0.0.0)
- `npm run typecheck` — `nuxi typecheck` (vue-tsc); CI runs this before build
- `npm run build` — production build; the `cloudflare-pages` preset is set in `nuxt.config.ts`, output goes to `dist/`
- `npm run preview` — preview built site

## Stack

- **Framework**: Nuxt 3 + Vue 3 Composition API + TypeScript (`pages/index.vue` is still Options API)
- **Hosting**: Cloudflare Pages, project `phareim-no`
- **Database / storage**: none. D1 (`phareim-rpg`) was deleted 2026-07-23 (final export at `~/backups/d1/2026-07-23/phareim-rpg.sql` on Sleeper). The R2 binding and the image-generation API (Venice/FAL/OpenAI/Wavespeed) were removed 2026-09-03 — nothing in the frontend called them. Restore from git history if needed.
- **External APIs**: GitHub REST only (`/api/projects`, `/api/meta`)
- **State**: Nuxt `useState` + localStorage (no state library)

## Project Structure

```
app.vue              — root shell: theme class, starfield, menu
pages/               — file-based routing
  index.vue          — landing page (full-screen canvas, removes scrollable)
  about.vue          — /about — brief bio, photo, social links
  projects.vue       — /projects — GitHub repos fetched live from GitHub API
  meta.vue           — /meta — commit log of this site from the GitHub API
components/          — Vue components
composables/         — useTheme
server/api/          — Nitro API routes (h3 helpers are auto-imported)
  menu.ts            — static menu items list
  projects.ts        — phareim's public GitHub repos
  meta.ts            — this repo's commits, paginated
server/utils/        — github.ts (headers + optional token)
assets/themes/       — scandinavian.css, hacker.css, space.css, tufte.css
public/game/         — sprite sheets, currently unreferenced (2026-09-03)
```

## Theme System

Four themes: **Scandinavian Glass** (default), **Cyberpunk**, **Space**, **Tufte** (warm paper / ET Book serif / one crimson accent, from the tufte-viz design system; fonts bundled at `public/fonts/et-book/`; no landing-page bubbles — calm paper).

- Each theme file defines `--theme-*` CSS custom properties on `.{theme}-page`
- `composables/useTheme.ts` provides `activeTheme`, `themePageClass`, `cx()`, `setTheme()`
- Persisted to localStorage
- **Convention**: always use `var(--theme-*, fallback)` — never hardcode colors
- Don't use `@media (prefers-color-scheme: dark)` — the theme system handles this
- Don't put theme variables on `:root` — they go in `.{theme}-page` selectors

## Key Patterns

- Runtime secrets via `nuxt.config.ts` `runtimeConfig`, set on Cloudflare by `NUXT_`-prefixed env vars (`NUXT_GITHUB_TOKEN` → `githubToken`).
- **Always `useRuntimeConfig(event)` in server code.** Without the event, Workers return a config frozen at module init, before env vars exist — the token silently never applies. (Found 2026-09-03; the old image API had this bug and was always 503 in production.)
- No auth system.

## Deployment

- **CI/CD**: `.github/workflows/deploy.yml` — `build` job (npm ci → typecheck → build → artifact) on push and PR; `deploy` job (wrangler `pages deploy dist`) on push to `master` only, then notifies Sleeper.
- `wrangler.toml` carries `pages_build_output_dir = "dist"` and `nodejs_compat`; no bindings.
- No automated test suite.

## Keyboard Shortcuts

- `M` key toggles the global menu (disabled on admin pages)
