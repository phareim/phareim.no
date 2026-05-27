# CLAUDE.md

## Commands

- `npm run dev` — dev server on port 3030 (host 0.0.0.0)
- `npm run build` — production build (`NITRO_PRESET=cloudflare-pages`)
- `npm run preview` — preview built site
- `npm run sync:almanac` — refresh `assets/themes/_tokens-generated.css` from `~/github/almanac-design/tokens/tokens.json` (also runs automatically via `predev` / `prebuild`)
- `npm run qa:almanac` — Playwright-driven screenshot + CSS-var sweep over every surviving route

## Stack

- **Framework**: Nuxt 3 + Vue 3 Composition API + TypeScript
- **Hosting**: Cloudflare Pages
- **Database**: Cloudflare D1 (SQLite) — binding `DB`, database `phareim-rpg`
- **Object Storage**: Cloudflare R2 — binding `BUCKET`, bucket `phareim-assets`
- **AI APIs**: Venice AI, FAL AI, OpenAI, Wavespeed
- **State**: Pinia (client-side)

## Project Structure

```
app.vue              — root shell: Almanac page class, menu
pages/
  index.vue           — /  — Almanac homepage with categorised index + recent strip
  about.vue           — /about
  now.vue             — /now
  uses.vue            — /uses
  colophon.vue        — /colophon
  projects.vue        — /projects
  feed.vue            — /feed
  gallery.vue         — /gallery
  guestbook.vue       — /guestbook
  lab.vue             — /lab — experiments index
  lab/
    imagine.vue       — /lab/imagine — AI image generator (was /playground)
  games/
    index.vue         — /games — playable things
    space-invaders.vue — /games/space-invaders — full-screen game, score HUD,
                         localStorage high score, v1
  playground/
    index.vue         — /playground — toys index
    terminal.vue      — /playground/terminal
    morse.vue         — /playground/morse
    launch.vue        — /playground/launch
  drafts/             — experimental pages
components/           — Vue components (AlmanacFrame is the shared page chrome)
composables/          — useTheme (Almanac-only shim), useNavPages
server/api/           — H3 API routes
  menu.ts             — static menu items list
  feed.ts             — fetches phareim's public Bluesky posts (AT Protocol API)
  rss.xml.ts          — RSS 2.0 feed of Bluesky posts, served at /api/rss.xml
  projects.ts         — fetches phareim's public GitHub repos
  guestbook.ts        — GET/POST guestbook entries (D1)
  gallery.ts          — lists images from R2 `generated/` prefix, returns URLs + metadata
server/utils/         — db.ts, r2.ts, storage.ts, image-providers.ts, etc.
types/                — shared TypeScript interfaces
assets/themes/        — almanac.css + _tokens-generated.css (vendored from
                        ~/github/almanac-design/tokens/tokens.json)
public/_redirects     — Cloudflare Pages redirect map for archived/renamed routes
scripts/sync-almanac-tokens.mjs — regenerates _tokens-generated.css
database/schema.sql   — D1 schema (applied during CI deploy)
```

## Theme

One theme: **Almanac**. Warm paper (`#f4f0e8`) / midnight paper (`#161b24→#0e1219`)
gradient based on `prefers-color-scheme`. Tokens live in `assets/themes/almanac.css`
and are kept in lockstep with `~/github/almanac-design/tokens/tokens.json` via the
`prebuild`/`predev` script in `package.json`.

Rules (from `~/github/almanac-design/DESIGN.md`):
1. Hairline rules, never boxed cards (data grids exempt).
2. One accent (rust light / amber dark) per screen, at the moment of attention.
3. Source Serif 4 body, never sans for prose.
4. Sparse stars in dark only.
5. No chrome: no gradients except night sky, no shadows except dark amber glow,
   no rounded buttons.

**Page rule:** *Almanac frame, native interior*. Reading pages (about, now, uses,
colophon) get the full Almanac treatment. Tool/toy pages (terminal, morse, launch,
games, gallery grid, guestbook form) keep their distinctive interiors inside a thin
Almanac chrome via `<AlmanacFrame title="..." back="/">`.

**Convention:** always use `var(--theme-*, fallback)` in `.vue` files — never
hardcode hex. (Lint rule is a TODO; for now: grep `'#[0-9a-fA-F]'` in pages/
periodically to catch regressions.)

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
- `[` / `]` navigate to previous / next page in `NAV_PAGES` order:
  `/`, `/about`, `/now`, `/projects`, `/feed`, `/gallery`, `/guestbook`,
  `/lab`, `/playground`, `/games`, `/uses`, `/colophon`
- `?` or `/` toggles the keyboard shortcuts overlay

## Rebuild — May 2026

The site was rebuilt in May 2026 around a single Almanac aesthetic.
Council run: `~/council/runs/2026-05-27-2208-phareim-no-rebuild/`.

**Archived routes** (handled by `public/_redirects`):
- `/clock` → `/playground`
- `/focus` → `/playground`
- `/stats` → `/projects`
- `/activity` → `/feed`
- `/meta` → `/projects`
- `/terminal` → `/playground/terminal`
- `/morse` → `/playground/morse`
- `/launch` → `/playground/launch`
- `/playground` (old AI gen page) → `/lab/imagine`

**Removed themes:** scandi, hacker, space. Almanac is the only aesthetic.

**Removed components:** `HackerRain`, `ScandiAurora`, `SpaceStarfield`,
`ThemeTransition`, and the theme switcher in `app.vue`.

**Removed routes:** `server/api/debug-env.ts` (leaked Cloudflare env-binding
key list to anonymous callers).

**Out-of-scope follow-ups** (filed as sfl metas):
- Space Invaders: D1 high-scores, mobile touch polish, sound.
- Flatboy/redhat: build a real platformer or delete the (now-deleted) sprites.
- Lint rule banning literal hex values in `pages/*.vue`.
- Auth reimplementation.
