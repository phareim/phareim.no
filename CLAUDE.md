# CLAUDE.md

## Commands

- `npm run dev` — dev server on port 3030 (host 0.0.0.0)
- `npm run build` — production build (`NITRO_PRESET=cloudflare-pages`)
- `npm run preview` — preview built site

## Stack

- **Framework**: Nuxt 3 + Vue 3 Composition API + TypeScript
- **Hosting**: Cloudflare Pages
- **Database**: Cloudflare D1 (SQLite) — binding `DB`, database `phareim-rpg`
- **Object Storage**: Cloudflare R2 — binding `BUCKET`, bucket `phareim-assets`
- **AI APIs**: Venice AI, FAL AI, OpenAI, Wavespeed
- **State**: Pinia (client-side)

## Project Structure

```
app.vue              — root shell: theme class, starfield, menu
pages/               — file-based routing
  index.vue          — landing page (full-screen canvas, removes scrollable)
  about.vue          — /about — brief bio, photo, social links
  projects.vue       — /projects — GitHub repos fetched live from GitHub API
  drafts/            — experimental pages
components/          — Vue components
composables/         — useTheme
server/api/          — H3 API routes
  menu.ts            — static menu items list
  projects.ts        — fetches phareim's public GitHub repos
server/utils/        — db.ts, r2.ts, storage.ts, image-providers.ts, etc.
types/               — shared TypeScript interfaces
assets/themes/       — scandinavian.css, hacker.css, space.css
database/schema.sql  — D1 schema (applied during CI deploy)
```

## Theme System

Three themes: **Scandinavian Glass** (default), **Cyberpunk**, **Space**.

- Each theme file defines `--theme-*` CSS custom properties on `.{theme}-page`
- `composables/useTheme.ts` provides `activeTheme`, `themePageClass`, `cx()`, `setTheme()`
- Persisted to localStorage
- **Convention**: always use `var(--theme-*, fallback)` — never hardcode colors
- Don't use `@media (prefers-color-scheme: dark)` — the theme system handles this
- Don't put theme variables on `:root` — they go in `.{theme}-page` selectors

## Key Patterns

- D1 access: `getDB(event)` from `server/utils/db.ts`
- R2 access: `server/utils/r2.ts` and `server/utils/storage.ts`
- Runtime secrets via `nuxt.config.ts` `runtimeConfig`, overridden by `NUXT_`-prefixed env vars on Cloudflare
- No auth system currently — removed, will be reimplemented from scratch

## Deployment

- **CI/CD**: GitHub Actions on push to `master` (`.github/workflows/deploy.yml`)
- Build → apply D1 schema → deploy to Cloudflare Pages → notify Sleeper Chat
- No automated test suite

## Keyboard Shortcuts

- `M` key toggles the global menu (disabled on admin pages)
