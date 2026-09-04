---
name: phareim-theme
description: Add, change, or debug a theme on phareim.no — the swipeable landing-page themes in `themes/<id>/`. Use when asked for a new theme/look/skin for the site, when a theme's landing page or colours need work, when the swipe/arrow theme switching misbehaves, or when the --theme-* tokens need extending. Covers the registry, the default landing shell, the CSS token contract, the navigation lock, and how to preview one theme with ?theme=<id>.
---

# Themes on phareim.no

A theme is a folder in `themes/` that owns the whole landing page. Visitors
walk the theme list by swiping left/right, pressing ArrowLeft/ArrowRight, or
using the faint edge arrows and dots (`components/ThemePager.vue`). A first
visit gets a random theme; the choice is stored in a `theme` cookie and
resolved during SSR, so the first paint is already correct.

## Files

```
themes/
  index.ts            registry — ordered list, imports every theme.css
  content.ts          default landing content (name, blurbs, location, socials)
  base/
    DefaultLanding.vue  the default shell: card + text + socials, slots for the rest
    ProfileCard.vue     flip card
    SocialLink.vue      icon links
  _template/          copy this to start a theme
  <id>/
    theme.css         :root palette + `.{id}-page` token contract
    Landing.vue       the landing page (uses DefaultLanding or not)
    *.vue             anything private to the theme (canvas, game, …)
composables/useTheme.ts            state, cookie, setTheme/next/previous, navigationLocked
composables/useThemeNavigation.ts  swipe + arrow keys (called once in app.vue)
```

## Add a theme

1. `cp -r themes/_template themes/<id>` and rename `mytheme` → `<id>` in
   `theme.css` (the root class must be `<id>-page`).
2. Register it in `themes/index.ts`: add `import './<id>/theme.css'` and an
   entry `{ id, name, themeColor, themeColorDark?, landing, backdrop?, scrollable? }`.
   Position in the array is the swipe order.
3. Preview with `npm run dev` and `http://localhost:3030/?theme=<id>`. The
   query wins over the cookie and sets it, so the theme sticks while you work.
4. Check `/about`, `/projects`, `/meta` and a 404 (`/nope`) — they only get
   the tokens, so the palette has to carry them. `error.vue` has a per-theme
   404 block; add one if the default (scandi) block looks wrong in the theme.
5. `npm run typecheck`, commit, push. CI deploys `master`.

## Three levels of ambition

- **Colours only.** Keep `Landing.vue` as the template ships it (a bare
  `<DefaultLanding />`) and write `theme.css`. No current theme is this
  plain, so `_template` is the reference.
- **Background + default content.** Fill the `#background` slot. If the
  background reacts to the visitor, listen to DefaultLanding's events:
  `overlay-click`, `flip`, `flip-start`, `flip-stop`. `scandi` (bubbles)
  is this. A canvas that should sit behind *every* route (not just the
  landing) goes in the registry as `backdrop` instead — `space` does that
  with its starfield.
- **Own the page.** Replace slots (`card`, `body`, `footer`) or skip
  DefaultLanding entirely. `hacker` and `breakout` replace `body` with a game HUD;
  `almanac` skips the shell and renders a serif index page; `desk` skips it
  too and lays a grained paper sheet (`.desk-sheet`, `.desk-stamp`,
  `.desk-rule` are global classes from its theme.css) on the desk. Default rule:
  the root fills the viewport and does not scroll. A landing that is
  legitimately taller than a phone screen sets `scrollable: true` in the
  registry (almanac does) and the page scrolls normally.

`themes/content.ts` is the default copy. A theme may pass its own `content`
prop to DefaultLanding, reword it, or ignore it.

## The token contract

Every page and shared component reads `var(--theme-*, fallback)` — never a
theme's private variables, never hardcoded colours. `.{id}-page` must set:

```
--theme-bg  --theme-text  --theme-text-muted  --theme-text-subtle
--theme-accent
--theme-card-bg  --theme-card-border  --theme-card-shadow  --theme-card-radius
--theme-font-body
```

Rules that keep four themes from fighting:
- Private variables are namespaced (`--<id>-*`) and live on `:root`.
  `--theme-*` never goes on `:root`, only on `.{id}-page`.
- Dark mode is the theme's business: a `@media (prefers-color-scheme: dark)`
  block that overrides its own `:root` palette. Pages never branch on it.
- Add a token only when a second theme needs it. Unused tokens were the
  main dead weight cleaned out in September 2026.
- Theme-only styling on shared pages goes in that page as
  `:global(.<id>-page) .selector` (see the hacker overrides at the bottom
  of `pages/projects.vue`), not in `theme.css`.

## Navigation lock

The shell listens for ArrowLeft/ArrowRight and horizontal swipes on
`document`. A theme that needs those (a game, a slider) sets
`useTheme().navigationLocked.value = true` while it needs them and resets it
on game over and in `onBeforeUnmount`. `hacker/Landing.vue` and
`breakout/Landing.vue` show the pattern; both games also start on *tap*, not on
touchstart, so a swipe on the idle game still changes theme.

## Taste

The owner reverted two months of work in May 2026 because of page-transition
animation and cinematic theme switches. The switch is a 180 ms fade
(`pages/index.vue`) and stays that way. Backgrounds may move; chrome does not.
