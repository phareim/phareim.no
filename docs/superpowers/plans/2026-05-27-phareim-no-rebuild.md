# phareim.no Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild phareim.no around a single Almanac aesthetic — collapse the four-theme system to Almanac only, prune 19 pages down to ≤12, restructure pages into a coherent IA (front matter / work / playground / games), and promote the existing `SpaceInvadersBackground` canvas to a real playable route at `/games/space-invaders`.

**Architecture:**
Keep Nuxt 3 + Cloudflare Pages + D1/R2/Bluesky/GitHub wiring. Apply the rule **"Almanac frame, native interior"** — reading pages (about/now/uses/colophon) get the full warm-paper Almanac treatment; tool/toy pages (terminal/morse/launch, the gallery grid, the space-invaders canvas) keep their distinctive interiors inside a thin Almanac chrome (hairline rule, serif title, "back to almanac" link). Themes other than Almanac are deleted wholesale. The homepage is rebuilt as a wiki-reader-style serif index — no canvas background.

**Tech Stack:** Nuxt 3, Vue 3 Composition API, TypeScript, Cloudflare Pages + D1 + R2, Playwright (existing QA rig at `scripts/almanac-qa.mjs`), Almanac design tokens at `~/github/almanac-design/tokens/tokens.json`.

**Reference docs read once before starting:**
- `/home/petter/council/runs/2026-05-27-2208-phareim-no-rebuild/frame/G1.md` — the per-page keep/archive/rebuild verdict table is the authoritative IA reference.
- `/home/petter/thoughts/wiki/almanac-qa-2026-05.md` — the 38-cell QA pass; target post-rebuild ≤5 broken cells.
- `/home/petter/github/almanac-design/DESIGN.md` — five Almanac rules (hairline not box, accent only at attention, serif body always, stars dark only, no chrome).
- `/home/petter/github/wiki-reader/templates/layout.html` + `/home/petter/github/wiki-reader/static/almanac.css` — the proven reference implementation of the warm-paper feel.

**Branch & commit convention:**
- Branch: work on `master` directly (this is the existing repo's convention; CI deploys on push to `master`).
- Commit per phase, not per task — the user prefers clustered commits over fine-grained ones (see the existing `/find-*` merge commit pattern in `git log`). Each phase ends with one `git add -A && git commit -m "..."` step.
- DO NOT push until Phase 9. Push once at the end so CI runs the final state.

**Verification reality check:** Most of these tasks are frontend UI changes. "Verification" is overwhelmingly: (1) `npm run build` green, (2) `scripts/almanac-qa.mjs` re-run and broken-cell count compared to baseline, (3) manual smoke in dev server. Where unit-testable logic exists (the space-invaders game state, the `useTheme` rewrite) we write Vitest tests. Otherwise we honestly mark "manual smoke" as the test step.

---

## Phase 1 — Preflight & Baseline

### Task 1: Verify clean working tree and baseline build

**Files:** none modified.

- [ ] **Step 1: Confirm clean tree**

Run: `cd ~/github/phareim.no && git status`
Expected: `nothing to commit, working tree clean` on branch `master`.

- [ ] **Step 2: Verify baseline build is green**

Run: `cd ~/github/phareim.no && npm run build 2>&1 | tail -20`
Expected: Nuxt build succeeds. If it fails, STOP — the baseline is broken and the rebuild needs to wait. Report to user.

- [ ] **Step 3: Capture QA baseline for comparison**

Run: `cd ~/github/phareim.no && node scripts/almanac-qa.mjs 2>&1 | tail -30 || true`
(If the QA rig fails to run because dev server isn't up, start it in the background first: `npm run dev &` then wait 10s.)
Expected: produces `.qa/almanac/*.png` and a console summary of broken/minor/ok cells. Note the baseline counts in `docs/superpowers/plans/2026-05-27-phareim-no-rebuild-baseline.md` for later comparison.

- [ ] **Step 4: Tag the baseline commit**

Run: `cd ~/github/phareim.no && git tag pre-almanac-rebuild`
This creates a local-only tag (no push) so we can `git diff pre-almanac-rebuild..HEAD` at the end and rollback with `git reset --hard pre-almanac-rebuild` if needed.

---

## Phase 2 — Theme Collapse (Almanac-only)

This phase is destructive but mechanical. The four-theme system collapses to one.

### Task 2: Delete the three non-Almanac theme CSS files and their background components

**Files:**
- Delete: `assets/themes/scandinavian.css`
- Delete: `assets/themes/hacker.css`
- Delete: `assets/themes/space.css`
- Delete: `components/HackerRain.vue`
- Delete: `components/ScandiAurora.vue`
- Delete: `components/SpaceStarfield.vue`
- Delete: `components/ThemeTransition.vue` (only purpose was crossfading between themes — useless with one theme)
- Modify: `nuxt.config.ts` (remove the three deleted CSS imports from the top-level `css: []` array)

- [ ] **Step 1: Search for inbound references**

Run: `cd ~/github/phareim.no && grep -rn "HackerRain\|ScandiAurora\|SpaceStarfield\|ThemeTransition\|scandinavian.css\|hacker.css\|space.css" --include='*.vue' --include='*.ts' --include='*.css' .`
List every match. You will need to remove every one in the next step.

The single most important match will be in `nuxt.config.ts:4-9` — the top-level `css: []` array hard-imports the three to-be-deleted stylesheets. If you skip this, the Nuxt build will fail at Phase 2 with "Cannot find module" errors.

- [ ] **Step 2: Patch nuxt.config.ts first**

Edit `nuxt.config.ts`. Replace the `css` array to keep only Almanac:

```ts
css: [
  '~/assets/themes/almanac.css'
],
```

- [ ] **Step 3: Delete the files**

```bash
cd ~/github/phareim.no
git rm assets/themes/scandinavian.css assets/themes/hacker.css assets/themes/space.css
git rm components/HackerRain.vue components/ScandiAurora.vue components/SpaceStarfield.vue components/ThemeTransition.vue
```

- [ ] **Step 4: Verify nothing references them anymore**

Run the grep from Step 1 again. Expected: no hits.
If there are still hits, fix the callers in Task 3 / Task 4 below.

- [ ] **Step 5: Sanity-check build before moving on**

Run: `cd ~/github/phareim.no && npm run build 2>&1 | tail -10`
Expected: either green, or breakage from Task 3/4/5 callsites — NOT "Cannot find module .../scandinavian.css". If you see the Cannot-find-module error, Step 2 failed and you must redo it.

### Task 3: Rewrite the `useTheme` composable as Almanac-only (light/dark aware)

**Files:**
- Modify: `composables/useTheme.ts` (full rewrite, ~30 lines)
- Create: `composables/useTheme.test.ts` (Vitest unit tests)

- [ ] **Step 1: Write failing tests**

Create `composables/useTheme.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

// We test the pure logic — themePageClass should always be 'almanac-page',
// activeTheme always 'almanac', and themeColor flips based on prefers-color-scheme.

describe('useTheme', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('dark'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  })

  it('always reports almanac as the active theme', async () => {
    const { useTheme } = await import('./useTheme')
    const { activeTheme, themePageClass } = useTheme()
    expect(activeTheme.value).toBe('almanac')
    expect(themePageClass.value).toBe('almanac-page')
  })

  it('themeColor follows prefers-color-scheme', async () => {
    const { useTheme } = await import('./useTheme')
    const { themeColor } = useTheme()
    // matchMedia stub above returns matches:true for dark
    expect(themeColor.value).toBe('#0e1219')
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd ~/github/phareim.no && npx vitest run composables/useTheme.test.ts 2>&1 | tail -10`
Expected: failure (composable still has multi-theme shape).
If Vitest isn't installed: `npm install -D vitest @vue/test-utils` and try again. If that pulls in too much (this is a small repo), skip the test file and mark this task as "manual verify via app: pages render, no theme switcher visible." Update Step 5 accordingly.

- [ ] **Step 3: Rewrite the composable**

Replace `composables/useTheme.ts` with:

```typescript
// The only theme is Almanac. This composable still exists for API compatibility
// (pages and components import `themePageClass`, `cx()`, `themeColor`). It is
// intentionally trivial — kept as a shim so we don't have to touch every page
// just to remove the `cx()` calls.

export const useTheme = () => {
  const activeTheme = useState('activeTheme', () => 'almanac')

  const themePageClass = computed(() => 'almanac-page')

  const themeColor = computed(() => {
    if (import.meta.client && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return '#0e1219'
    }
    return '#f4f0e8'
  })

  const cx = (suffix: string) => `almanac-${suffix}`

  // setTheme is a no-op — kept so existing callers don't break during the rebuild.
  // Remove after all callers are deleted in later tasks.
  const setTheme = (_themeId: string) => {}

  return {
    activeTheme,
    themes: [{ id: 'almanac', name: 'Almanac', icon: '◐', themeColor: '#f4f0e8', themeColorDark: '#0e1219' }],
    themePageClass,
    themeColor,
    cx,
    setTheme,
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd ~/github/phareim.no && npx vitest run composables/useTheme.test.ts 2>&1 | tail -10`
Expected: pass.

### Task 4: Strip theme-switcher chrome and `1/2/3` shortcuts from `app.vue`

**Files:**
- Modify: `app.vue` (currently 232 lines — strip theme-switcher UI, theme classname computation can stay since `themePageClass` still returns `almanac-page`)

- [ ] **Step 1: Read app.vue and identify theme-switcher chrome**

Run: `cd ~/github/phareim.no && cat app.vue`
Identify: theme picker buttons, `setTheme(...)` callsites, keydown handlers for `Digit1`/`Digit2`/`Digit3`, imports of HackerRain/ScandiAurora/SpaceStarfield/ThemeTransition.

- [ ] **Step 2: Remove all of the above**

Remove imports of deleted components. Remove their `<HackerRain v-if="...">`, `<ScandiAurora v-if="...">`, `<SpaceStarfield v-if="...">`, `<ThemeTransition>` usages. Remove the theme-switcher UI element. Remove `Digit1`/`Digit2`/`Digit3` keydown branches. Keep the `themePageClass` binding (it now always returns `almanac-page`, which is what we want).

- [ ] **Step 3: Verify app.vue compiles**

Run: `cd ~/github/phareim.no && npx vue-tsc --noEmit 2>&1 | tail -20`
Expected: no errors mentioning app.vue.

### Task 5: Update KeyboardShortcutsOverlay to remove theme shortcuts

**Files:**
- Modify: `components/KeyboardShortcutsOverlay.vue` (remove `1/2/3` theme rows)

- [ ] **Step 1: Edit the shortcut list**

Open `components/KeyboardShortcutsOverlay.vue`. Find the rows describing `1`, `2`, `3`. Delete them. The surviving shortcuts are: `M` (menu), `[` and `]` (prev/next page), `?` or `/` (toggle this overlay).

- [ ] **Step 2: Visual check**

`npm run dev`, navigate to any page, press `?`. The overlay should show only the four surviving shortcuts.

### Task 6: Commit Phase 2

```bash
cd ~/github/phareim.no
git add -A
git commit -m "refactor(theme): collapse four-theme system to Almanac only

Deletes scandi/hacker/space CSS + HackerRain/ScandiAurora/SpaceStarfield/
ThemeTransition components, the theme switcher in app.vue, and the 1/2/3
keyboard shortcuts. useTheme rewritten as an Almanac-only shim so existing
callers keep working without per-page edits.

Part of the phareim.no rebuild (council run 2026-05-27-2208).
"
```

Run: `cd ~/github/phareim.no && npm run build 2>&1 | tail -10`
Expected: build green. If broken, fix the immediate cause (likely a missed import or callsite from Task 2 Step 1's grep list) and amend the commit.

---

## Phase 3 — Archive Pages with Redirects

Five pages are archived (the verdict table in `frame/G1.md` is authoritative). One page is renamed to free its slug for the new toys index.

### Task 7: Create `public/_redirects` for archived routes

**Files:**
- Create: `public/_redirects`

- [ ] **Step 1: Write the redirects file**

Create `public/_redirects`:

```
# Archived during the 2026-05 rebuild (council run 2026-05-27-2208).
# Cloudflare Pages reads this at deploy time.
/clock      /playground   301
/focus      /playground   301
/stats      /projects     301
/activity   /feed         301
/meta       /projects     301

# Renamed: the old /playground (AI image generator) is now /lab/imagine.
# The slug /playground is reused as the toys index in Phase 4.
/playground/image  /lab/imagine  301
```

Note: the `/playground` → `/lab/imagine` mapping is for any historical inbound link that referenced the old AI-image-gen page by its old slug. The new `/playground` slug is taken over by the toys index in Phase 4 — Cloudflare matches more-specific paths first, so `/playground` (the new index) and `/playground/image` (the historical AI page) coexist.

### Task 8: Delete archived pages

**Files:**
- Delete: `pages/clock.vue`
- Delete: `pages/focus.vue`
- Delete: `pages/stats.vue`
- Delete: `pages/activity.vue`
- Delete: `pages/meta.vue`

- [ ] **Step 1: Search for inbound links from surviving pages**

Run: `cd ~/github/phareim.no && grep -rn -E '"/clock"|"/focus"|"/stats"|"/activity"|"/meta"' pages/ components/ composables/ app.vue 2>/dev/null`
Note each result — those links will become 404s for an instant before the redirect kicks in. Edit them in Step 3 below.

- [ ] **Step 2: Delete the page files**

```bash
cd ~/github/phareim.no
git rm pages/clock.vue pages/focus.vue pages/stats.vue pages/activity.vue pages/meta.vue
```

- [ ] **Step 3: Fix inbound links from surviving pages/menu**

For each match from Step 1, edit the source to point to the new destination (per `_redirects` above) — typically replace the link with the redirect target.

### Task 9: Move `/playground` (AI image gen) under `/lab/imagine`

**Files:**
- Create: `pages/lab/imagine.vue` (moved from `pages/playground.vue`)
- Delete: `pages/playground.vue`

- [ ] **Step 1: Move and rename**

```bash
cd ~/github/phareim.no
mkdir -p pages/lab
git mv pages/playground.vue pages/lab/imagine.vue
```

- [ ] **Step 2: Update any internal links**

Run: `cd ~/github/phareim.no && grep -rn '"/playground"' pages/ components/ composables/ app.vue 2>/dev/null | grep -v 'lab/imagine'`
Edit each match. The lab page (`pages/lab.vue`) should link to `/lab/imagine` as one of its experiments.

- [ ] **Step 3: Verify build**

Run: `cd ~/github/phareim.no && npm run build 2>&1 | tail -10`
Expected: green.

### Task 10: Commit Phase 3

```bash
cd ~/github/phareim.no
git add -A
git commit -m "refactor(routes): archive 5 thin pages, move AI playground under /lab

Archived: /clock, /focus, /stats, /activity, /meta — each was derivative
of a surviving page or not personal to the site. _redirects file maps old
URLs to the right surviving destination (301).

Renamed /playground → /lab/imagine. The /playground slug is repurposed in
Phase 4 as the toys index.

Part of the phareim.no rebuild (council run 2026-05-27-2208).
"
```

---

## Phase 4 — New IA: `/games` and `/playground` Index Pages

Two new top-level index pages: `/games` for playable things, `/playground` for the surviving toys (terminal, morse, launch).

### Task 11: Create `AlmanacFrame.vue` — the shared page-chrome component

**Files:**
- Create: `components/AlmanacFrame.vue`

This component is the heart of the "Almanac frame, native interior" rule. Every surviving page wraps its body in `<AlmanacFrame>`.

- [ ] **Step 1: Write the component**

```vue
<template>
  <article class="almanac-frame">
    <header class="almanac-frame__header">
      <NuxtLink v-if="back" :to="back" class="almanac-frame__back">← {{ backLabel }}</NuxtLink>
      <h1 class="almanac-frame__title">
        <span class="almanac-frame__glyph" aria-hidden="true">◐</span>
        {{ title }}
      </h1>
      <p v-if="kicker" class="almanac-frame__kicker">{{ kicker }}</p>
      <hr class="almanac-frame__rule" />
    </header>
    <section class="almanac-frame__body">
      <slot />
    </section>
    <footer v-if="$slots.footer" class="almanac-frame__footer">
      <hr class="almanac-frame__rule" />
      <slot name="footer" />
    </footer>
  </article>
</template>

<script setup lang="ts">
// One defineProps call. All four props declared together.
withDefaults(
  defineProps<{
    title: string
    kicker?: string
    back?: string
    backLabel?: string
  }>(),
  { backLabel: 'back to almanac' }
)
</script>

<style scoped>
.almanac-frame {
  max-width: 64ch;
  margin: 0 auto;
  padding: 4rem 2rem 6rem;
  font-family: 'Source Serif 4', Georgia, serif;
  color: var(--theme-ink, #1a1a1a);
}
.almanac-frame__back {
  display: inline-block;
  margin-bottom: 2rem;
  font-size: 0.85rem;
  letter-spacing: 0.02em;
  color: var(--theme-ink-muted, #555);
  text-decoration: none;
  border-bottom: 1px solid currentColor;
}
.almanac-frame__back:hover {
  color: var(--theme-accent, #c14a2a);
}
.almanac-frame__title {
  font-family: 'Source Serif 4', Georgia, serif;
  font-weight: 400;
  font-size: clamp(2rem, 4vw, 3rem);
  letter-spacing: -0.01em;
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 0.5em;
}
.almanac-frame__glyph {
  color: var(--theme-accent, #c14a2a);
  font-size: 0.7em;
  line-height: 1;
  /* The moon glyph is the only consistent accent appearance per page — Almanac's
     "one accent at the moment of attention" rule. Do not use the accent color
     elsewhere in the page chrome. */
}
.almanac-frame__kicker {
  margin: 0.5rem 0 0;
  font-style: italic;
  color: var(--theme-ink-muted, #555);
}
.almanac-frame__rule {
  border: 0;
  border-top: 1px solid var(--theme-rule, rgba(0,0,0,0.15));
  margin: 1.5rem 0 2rem;
}
.almanac-frame__footer {
  margin-top: 4rem;
  font-size: 0.85rem;
  color: var(--theme-ink-muted, #555);
}
</style>
```

- [ ] **Step 2: Verify it imports and renders**

Add a quick usage in `pages/about.vue` (temporarily) wrapping the existing content in `<AlmanacFrame title="About">`. Run `npm run dev`, hit `/about`, confirm the title + hairline + content show. Revert the test edit if you used about.vue as a scratchpad (or leave it — you'll do it for real in Task 14).

### Task 12: Create `pages/games/index.vue`

**Files:**
- Create: `pages/games/index.vue`

- [ ] **Step 1: Write the games index page**

```vue
<template>
  <AlmanacFrame title="Games" kicker="Things you can play.">
    <ul class="games-list">
      <li>
        <NuxtLink to="/games/space-invaders" class="games-list__link">
          <span class="games-list__title">Space Invaders</span>
          <span class="games-list__desc">Arrows to move, space to fire. A v1.</span>
        </NuxtLink>
      </li>
    </ul>
  </AlmanacFrame>
</template>

<script setup lang="ts">
useHead({ title: 'Games — phareim.no' })
</script>

<style scoped>
.games-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.games-list li {
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--theme-rule, rgba(0,0,0,0.1));
}
.games-list__link {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-decoration: none;
  color: inherit;
}
.games-list__title {
  font-size: 1.25rem;
  letter-spacing: -0.005em;
}
.games-list__title:hover {
  color: var(--theme-accent, #c14a2a);
}
.games-list__desc {
  font-style: italic;
  color: var(--theme-ink-muted, #555);
  font-size: 0.9rem;
}
</style>
```

### Task 13: Create `pages/playground/index.vue` and move toy pages into the folder

**Files:**
- Create: `pages/playground/index.vue`
- Move: `pages/terminal.vue` → `pages/playground/terminal.vue`
- Move: `pages/morse.vue` → `pages/playground/morse.vue`
- Move: `pages/launch.vue` → `pages/playground/launch.vue`

- [ ] **Step 1: Move the toy pages**

```bash
cd ~/github/phareim.no
mkdir -p pages/playground
git mv pages/terminal.vue pages/playground/terminal.vue
git mv pages/morse.vue pages/playground/morse.vue
git mv pages/launch.vue pages/playground/launch.vue
```

- [ ] **Step 2: Add redirects for the old slugs**

Append to `public/_redirects`:

```
/terminal   /playground/terminal   301
/morse      /playground/morse      301
/launch     /playground/launch     301
```

- [ ] **Step 3: Write the playground index**

Create `pages/playground/index.vue`:

```vue
<template>
  <AlmanacFrame title="Playground" kicker="Toys, oddities, mostly-finished experiments.">
    <ul class="toys-list">
      <li>
        <NuxtLink to="/playground/terminal" class="toys-list__link">
          <span class="toys-list__title">Terminal</span>
          <span class="toys-list__desc">An in-browser terminal. Try `help`.</span>
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/playground/morse" class="toys-list__link">
          <span class="toys-list__title">Morse</span>
          <span class="toys-list__desc">Text → dots and dashes, with Web Audio playback.</span>
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/playground/launch" class="toys-list__link">
          <span class="toys-list__title">Launch</span>
          <span class="toys-list__desc">A rocket countdown with a Web Audio rumble at zero.</span>
        </NuxtLink>
      </li>
    </ul>
  </AlmanacFrame>
</template>

<script setup lang="ts">
useHead({ title: 'Playground — phareim.no' })
</script>

<style scoped>
.toys-list { list-style: none; padding: 0; margin: 0; }
.toys-list li { padding: 1.25rem 0; border-bottom: 1px solid var(--theme-rule, rgba(0,0,0,0.1)); }
.toys-list__link { display: flex; flex-direction: column; gap: 0.25rem; text-decoration: none; color: inherit; }
.toys-list__title { font-size: 1.25rem; letter-spacing: -0.005em; }
.toys-list__title:hover { color: var(--theme-accent, #c14a2a); }
.toys-list__desc { font-style: italic; color: var(--theme-ink-muted, #555); font-size: 0.9rem; }
</style>
```

### Task 14: Update `useNavPages` composable to reflect the new IA

**Files:**
- Modify: `composables/useNavPages.ts`

- [ ] **Step 1: Rewrite the NAV_PAGES list**

Open `composables/useNavPages.ts`. Replace its page list with:

```typescript
export const NAV_PAGES = [
  '/',
  '/about',
  '/now',
  '/projects',
  '/feed',
  '/gallery',
  '/guestbook',
  '/lab',
  '/playground',
  '/games',
  '/uses',
  '/colophon',
] as const
```

This drives the `[` / `]` previous/next-page shortcuts. The order is intentional: front matter → work → playful → meta.

- [ ] **Step 2: Verify in the menu**

Run dev server, press `M`, confirm the menu reflects the new order and only shows surviving routes.

### Task 15: Commit Phase 4

```bash
cd ~/github/phareim.no
git add -A
git commit -m "feat(ia): introduce /games and /playground index pages; AlmanacFrame component

New IA:
- /games — landing for playable things (currently just space-invaders).
- /playground — landing for toys (terminal, morse, launch moved under it).
- AlmanacFrame.vue — shared page-chrome: hairline rule, serif title,
  optional 'back to almanac' link. Realises the 'Almanac frame, native
  interior' rule.

NAV_PAGES re-ordered to front-matter / work / playful / meta.

Part of the phareim.no rebuild (council run 2026-05-27-2208).
"
```

---

## Phase 5 — Space Invaders as a Real Game Page

The existing `SpaceInvadersBackground.vue` already has full game logic (player, bullets, enemies, scoring, restart, touch). The job here is structural: rename, give it a proper route, build a score HUD, remove it from being a background.

### Task 16: Rename `SpaceInvadersBackground.vue` → `SpaceInvadersGame.vue` and add `wave` emit

**Files:**
- Move: `components/SpaceInvadersBackground.vue` → `components/SpaceInvadersGame.vue`
- Modify: the renamed file — add `'wave'` to the `defineEmits` array and emit it whenever the existing `waveTimer` triggers a new wave.

- [ ] **Step 1: Rename**

```bash
cd ~/github/phareim.no
git mv components/SpaceInvadersBackground.vue components/SpaceInvadersGame.vue
```

- [ ] **Step 2: Add `wave` to emits**

Open `components/SpaceInvadersGame.vue`. Find `defineEmits(['score', 'death', 'restart', 'started'])` near the top. Change to:

```js
const emit = defineEmits(['score', 'death', 'restart', 'started', 'wave'])
```

- [ ] **Step 3: Wire the emit**

Find the existing wave-spawn logic — search for `waveTimer` and `waveInterval` references inside the component's animation loop. There will be a block that resets `waveTimer = 0` when it crosses `waveInterval` and spawns the next wave of enemies. Add a wave counter and emit:

```js
// Near the top with other state:
let waveNumber = 1
// ... in the wave-spawn block (where waveTimer is reset):
waveNumber += 1
emit('wave', waveNumber)
```

Also: in `resetGame()` (or whatever function the existing code uses to start fresh — search for `gameOver = false` or `score = 0` assignment), set `waveNumber = 1` and `emit('wave', 1)` so the HUD resets when restarting.

- [ ] **Step 4: Update inbound references to the rename**

Run: `cd ~/github/phareim.no && grep -rn "SpaceInvadersBackground" --include='*.vue' --include='*.ts' .`
The two callers should be `pages/index.vue` and `pages/colophon.vue`. Don't fix them here — they get fully removed in Task 18.

- [ ] **Step 5: Verify build**

Run: `cd ~/github/phareim.no && npm run build 2>&1 | tail -10`
Expected: build green. If broken, the most likely cause is the emit definition syntax — confirm you used the array form, not the object form.

### Task 17: Create `pages/games/space-invaders.vue` — the full-screen playable page

**Files:**
- Create: `pages/games/space-invaders.vue`

- [ ] **Step 1: Write the page**

```vue
<template>
  <div class="game-page">
    <header class="game-page__chrome">
      <NuxtLink to="/games" class="game-page__back">← games</NuxtLink>
      <div class="game-page__hud">
        <span class="game-page__hud-item">Wave <strong>{{ wave }}</strong></span>
        <span class="game-page__hud-item">Score <strong>{{ score }}</strong></span>
        <span v-if="lastDeath" class="game-page__hud-item">High <strong>{{ highScore }}</strong></span>
        <span v-if="!started" class="game-page__hud-hint">Press Enter to start</span>
        <span v-else-if="dead" class="game-page__hud-hint">Game over — Enter to restart</span>
      </div>
    </header>
    <div class="game-page__canvas-wrap">
      <SpaceInvadersGame
        @score="onScore"
        @death="onDeath"
        @restart="onRestart"
        @started="onStarted"
        @wave="onWave"
      />
      <transition name="wave-banner">
        <div v-if="waveBanner" class="game-page__wave-banner">
          Wave {{ toRoman(wave) }}
        </div>
      </transition>
    </div>
    <footer class="game-page__footer">
      <span>Arrows to move · space to fire · enter to restart</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
const score = ref(0)
const highScore = ref(0)
const started = ref(false)
const dead = ref(false)
const lastDeath = ref(false)
const wave = ref(1)
const waveBanner = ref(false)
let waveBannerTimer: ReturnType<typeof setTimeout> | null = null

const onScore = (n: number) => { score.value = n; if (n > highScore.value) highScore.value = n }
const onDeath = () => { dead.value = true; lastDeath.value = true }
const onRestart = () => { dead.value = false; score.value = 0; wave.value = 1 }
const onStarted = () => { started.value = true; dead.value = false; wave.value = 1 }
const onWave = (n: number) => {
  wave.value = n
  waveBanner.value = true
  if (waveBannerTimer) clearTimeout(waveBannerTimer)
  waveBannerTimer = setTimeout(() => { waveBanner.value = false }, 1500)
}

const toRoman = (n: number): string => {
  if (n <= 0) return ''
  const map: [number, string][] = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]
  let out = '', remaining = n
  for (const [v, s] of map) while (remaining >= v) { out += s; remaining -= v }
  return out
}

useHead({
  title: 'Space Invaders — phareim.no',
  meta: [{ name: 'theme-color', content: '#0e1219' }],
})

definePageMeta({ layout: false })  // bypass the default app shell — full screen game

if (import.meta.client) {
  const saved = localStorage.getItem('space-invaders-high')
  if (saved) highScore.value = parseInt(saved, 10) || 0
}
watch(highScore, (n) => {
  if (import.meta.client) localStorage.setItem('space-invaders-high', String(n))
})
</script>

<style scoped>
.game-page {
  position: fixed;
  inset: 0;
  background: #0e1219;
  color: #ebe4d4;
  display: flex;
  flex-direction: column;
  font-family: 'Source Serif 4', Georgia, serif;
}
.game-page__chrome {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(235, 228, 212, 0.15);
}
.game-page__back {
  font-size: 0.85rem;
  color: rgba(235, 228, 212, 0.75);
  text-decoration: none;
  border-bottom: 1px solid currentColor;
}
.game-page__back:hover { color: #d4a574; }
.game-page__hud { display: flex; gap: 1.5rem; align-items: baseline; font-size: 0.9rem; }
.game-page__hud-item { color: rgba(235, 228, 212, 0.75); }
.game-page__hud-item strong { color: #ebe4d4; font-weight: 600; margin-left: 0.25rem; }
.game-page__hud-hint { font-style: italic; color: #d4a574; }
.game-page__canvas-wrap { flex: 1; position: relative; overflow: hidden; }
.game-page__canvas-wrap > * { width: 100%; height: 100%; display: block; }

.game-page__wave-banner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: clamp(3rem, 8vw, 6rem);
  font-style: italic;
  font-weight: 300;
  color: #d4a574;
  text-shadow: 0 0 24px rgba(212, 165, 116, 0.35);
  letter-spacing: 0.08em;
}
.wave-banner-enter-active, .wave-banner-leave-active { transition: opacity 0.3s ease; }
.wave-banner-enter-from, .wave-banner-leave-to { opacity: 0; }
.game-page__footer {
  padding: 0.75rem 1.5rem;
  border-top: 1px solid rgba(235, 228, 212, 0.15);
  font-size: 0.8rem;
  font-style: italic;
  color: rgba(235, 228, 212, 0.5);
  text-align: center;
}
</style>
```

- [ ] **Step 2: Smoke test in dev**

Run: `cd ~/github/phareim.no && npm run dev` (or it's already running). Navigate to `http://localhost:3030/games/space-invaders`. Confirm: chrome header at top, full-canvas game underneath, footer at bottom. Press Enter — game starts. Arrows move, space fires. Die — HUD shows "Game over — Enter to restart". Hit Enter — restarts. Press back link — returns to /games.

If the canvas doesn't fill the wrap, that's because `SpaceInvadersGame.vue`'s `canvas` doesn't set width:100%/height:100% on the element itself but reads `canvas.offsetWidth/offsetHeight`. The `.game-page__canvas-wrap > *` rule above should cover it. If not, add `:deep(canvas) { width: 100%; height: 100%; display: block; }` to the page's `<style scoped>`.

### Task 18: Remove SpaceInvaders from `pages/index.vue` and `pages/colophon.vue`

**Files:**
- Modify: `pages/index.vue` (remove the `<SpaceInvadersGame>` / `<SpaceInvadersBackground>` usage)
- Modify: `pages/colophon.vue` (same)

- [ ] **Step 1: Remove from index.vue**

Open `pages/index.vue`. Find the `<SpaceInvadersBackground ...>` or `<SpaceInvadersGame ...>` element (depends on whether Task 16 has been done yet) and delete it along with any associated container/wrapper logic that only existed to host the canvas. Remove the import. The page gets rebuilt in Task 24, so leaving a minimal stub here is fine — the goal is just "no canvas, build green."

- [ ] **Step 2: Remove from colophon.vue**

Open `pages/colophon.vue`. Find and remove the same component reference + import.

- [ ] **Step 3: Verify build**

Run: `cd ~/github/phareim.no && npm run build 2>&1 | tail -10`
Expected: green.

### Task 19: Commit Phase 5

```bash
cd ~/github/phareim.no
git add -A
git commit -m "feat(games): /games/space-invaders as a real playable route

Renames SpaceInvadersBackground → SpaceInvadersGame (it was always a game,
just used as decor). New page at /games/space-invaders gives it a proper
home: Almanac chrome (hairline header with 'back to games' link + score
HUD, dark-paper footer with 'v1 — arrows to move, space to fire'),
localStorage high-score, full-screen canvas underneath.

Removes the canvas-as-background usage from pages/index.vue and
pages/colophon.vue.

Out of scope (filed as sfl follow-ups): D1 high-scores, mobile touch
controls polish, sound, sprite scaling on small screens.

Part of the phareim.no rebuild (council run 2026-05-27-2208).
"
```

---

## Phase 6 — Almanac Purification for Surviving Pages

The QA doc enumerates the per-page fixes. Apply them in batches by page-class.

### Task 20: Wrap reading pages (about, now, uses, colophon) in `AlmanacFrame`

**Files:**
- Modify: `pages/about.vue`
- Modify: `pages/now.vue`
- Modify: `pages/uses.vue`
- Modify: `pages/colophon.vue`

For each of the four pages:

- [ ] **Step 1: Wrap content in `<AlmanacFrame>`**

Replace the page's outer wrapper element (whatever it is currently — a `<div class="..page">`, a `<main>`, etc.) with `<AlmanacFrame title="..." kicker="..." back="/">`. Move the inner content into the default slot. Delete any per-page hardcoded chrome (page title heading, custom container styles) that the frame now provides.

- [ ] **Step 2: Audit per-page hex colors**

Run `grep -nE '#[0-9a-fA-F]{3,6}' pages/about.vue` (and the others). For each match, replace with `var(--theme-*, fallback)` per the Almanac convention. The `--theme-*` variables to use are defined in `assets/themes/almanac.css`.

- [ ] **Step 3: Smoke test each page in dev**

Each page should now show: hairline-ruled serif title at top, "back to almanac" link, original page body below in the Almanac font, no other chrome.

### Task 21: Apply Almanac frame to live-data pages (projects, feed, gallery, guestbook)

**Files:**
- Modify: `pages/projects.vue`
- Modify: `pages/feed.vue`
- Modify: `pages/gallery.vue`
- Modify: `pages/guestbook.vue`

These are the "frame + native interior" pages. The data display (cards, grid, form) keeps its identity; only the page chrome becomes Almanac.

- [ ] **Step 1: Wrap in `<AlmanacFrame>`**

Same as Task 20 Step 1.

- [ ] **Step 2: Audit chrome (NOT the data display)**

The frame replaces page title, hairline rule, container width. The card/grid/form interior keeps its structure. Audit and replace hex colors per the Almanac convention. **Do not flatten** the card design — the QA doc's failure mode was that the rebuild kept making everything literally hairline-only and lost density. Keep the cards as cards; just ensure their borders use `var(--theme-rule)`, their background uses `var(--theme-surface)`, their text uses `var(--theme-ink)`.

- [ ] **Step 3: Smoke test**

For each page: navigate in dev, confirm Almanac chrome top + back link, native interior below, no rogue hex colors. The `gallery` and `feed` pages should pull live data without errors.

### Task 22: Polish `pages/lab.vue`

**Files:**
- Modify: `pages/lab.vue`

The lab page is rated one of the lowest in the QA doc. It uses boxed LIVE badges and coloured chrome that violates Almanac.

- [ ] **Step 1: Wrap in `<AlmanacFrame>`**

Same shape: `<AlmanacFrame title="Lab" kicker="Live experiments and half-thoughts." back="/">`.

- [ ] **Step 2: Re-style LIVE badges as hairline + serif**

Find the existing badge markup. Replace boxed/coloured badges with:
```css
.badge-live {
  display: inline-block;
  padding: 0 0.4em;
  border: 1px solid var(--theme-accent, #c14a2a);
  color: var(--theme-accent, #c14a2a);
  font-family: 'Source Serif 4', Georgia, serif;
  font-style: italic;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: lowercase;
  vertical-align: middle;
}
```

(Hairline border + accent text. Lowercase italic 'live' looks more Almanac than uppercase boxed `LIVE`.)

- [ ] **Step 3: Update the experiment list**

Make sure `/lab/imagine` (the AI image gen page moved in Task 9) appears in lab's experiment list with a description.

- [ ] **Step 4: Smoke test**

Lab page renders with Almanac chrome, hairline-bordered italic 'live' badges, and links to /lab/imagine work.

### Task 23: Commit Phase 6

```bash
cd ~/github/phareim.no
git add -A
git commit -m "style(almanac): wrap surviving pages in AlmanacFrame, purge hex literals

Pages refit with Almanac chrome:
- Reading pages (about, now, uses, colophon) — full Almanac treatment.
- Live-data pages (projects, feed, gallery, guestbook) — Almanac frame
  + native interior; card/grid/form interiors keep their density.
- /lab — Almanac frame + hairline italic 'live' badges (no more boxed LIVE).

Hardcoded hex colors replaced with var(--theme-*) per the Almanac
convention. Tokens still live in assets/themes/almanac.css; tokens-as-source
wiring lands in Phase 8.

Part of the phareim.no rebuild (council run 2026-05-27-2208).
"
```

---

## Phase 7 — Homepage Rebuild

The homepage is the most-visible artifact of the rebuild. Aim for the wiki-reader feeling: serif title, hairline rule, categorised index, a small "recent activity" strip, colophon footer. No canvas.

### Task 24: Rewrite `pages/index.vue` as a wiki-reader-style serif homepage

**Files:**
- Modify: `pages/index.vue` (full rewrite)

- [ ] **Step 1: Write the new homepage**

```vue
<template>
  <AlmanacFrame title="An Almanac of Petter Hareim" kicker="Notes, projects, toys. Mostly serious. Sometimes not.">
    <p class="almanac-datestamp">
      <span>{{ datestamp.weekday }}</span>
      <span>·</span>
      <span>{{ datestamp.dateline }}</span>
      <span>·</span>
      <span>day {{ datestamp.dayOfYear }} of {{ datestamp.year }}</span>
      <span>·</span>
      <span>week {{ datestamp.week }}</span>
    </p>

    <section class="almanac-index">
      <div v-for="cat in categories" :key="cat.title" class="almanac-index__cat">
        <h2 class="almanac-index__cat-title">{{ cat.title }}</h2>
        <ul class="almanac-index__list">
          <li v-for="p in cat.pages" :key="p.path">
            <NuxtLink :to="p.path" class="almanac-index__link">
              <span class="almanac-index__link-title">{{ p.title }}</span>
              <span class="almanac-index__link-desc">{{ p.desc }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>

    <section v-if="recent.length" class="almanac-recent">
      <h2 class="almanac-recent__title">Recent</h2>
      <ul class="almanac-recent__list">
        <li v-for="item in recent" :key="item.id" class="almanac-recent__item">
          <time :datetime="item.iso" class="almanac-recent__time">{{ item.relative }}</time>
          <span class="almanac-recent__kind">{{ item.kind }}</span>
          <a :href="item.url" target="_blank" rel="noopener" class="almanac-recent__text">{{ item.text }}</a>
        </li>
      </ul>
    </section>

    <template #footer>
      <p>Built in Nuxt, deployed to Cloudflare Pages. Source on <a href="https://github.com/phareim/phareim.no">GitHub</a>. See <NuxtLink to="/colophon">colophon</NuxtLink> for design notes.</p>
    </template>
  </AlmanacFrame>
</template>

<script setup lang="ts">
useHead({
  title: 'phareim.no',
  meta: [{ name: 'description', content: 'An almanac of Petter Hareim — notes, projects, toys.' }],
})

// Almanac datestamp — purely client-side so SSR doesn't lock yesterday's date.
// Format: "Wednesday · 27 May 2026 · day 147 of 2026 · week 22".
const datestamp = computed(() => {
  const d = new Date()
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / 86400000)
  // ISO week (Mon-start).
  const target = new Date(d.valueOf())
  const dayNr = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'long' }),
    dateline: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    dayOfYear,
    year: d.getFullYear(),
    week,
  }
})

const categories = [
  {
    title: 'Front matter',
    pages: [
      { path: '/about', title: 'About', desc: 'Who and what.' },
      { path: '/now', title: 'Now', desc: 'What I am working on this season.' },
      { path: '/uses', title: 'Uses', desc: 'Tools, editors, hardware.' },
    ],
  },
  {
    title: 'The work',
    pages: [
      { path: '/projects', title: 'Projects', desc: 'Active and recent repos.' },
      { path: '/feed', title: 'Feed', desc: 'Bluesky + X, merged.' },
      { path: '/gallery', title: 'Gallery', desc: 'Generated images.' },
      { path: '/guestbook', title: 'Guestbook', desc: 'Leave a note.' },
      { path: '/lab', title: 'Lab', desc: 'Experiments and half-built things.' },
    ],
  },
  {
    title: 'Playful',
    pages: [
      { path: '/games', title: 'Games', desc: 'Things you can play.' },
      { path: '/playground', title: 'Playground', desc: 'Toys, oddities, mostly-finished experiments.' },
    ],
  },
  {
    title: 'Meta',
    pages: [
      { path: '/colophon', title: 'Colophon', desc: 'How this site is made.' },
    ],
  },
]

type RecentItem = { id: string; iso: string; relative: string; kind: string; text: string; url: string }
const recent = ref<RecentItem[]>([])

const relative = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime()
  const d = Math.floor(ms / 86400000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

onMounted(async () => {
  try {
    const [projects, feed] = await Promise.allSettled([
      $fetch<any[]>('/api/projects').catch(() => []),
      $fetch<any[]>('/api/feed').catch(() => []),
    ])
    const items: RecentItem[] = []
    if (projects.status === 'fulfilled' && Array.isArray(projects.value)) {
      for (const p of projects.value.slice(0, 3)) {
        if (p?.pushed_at) items.push({
          id: 'p-' + p.name,
          iso: p.pushed_at,
          relative: relative(p.pushed_at),
          kind: 'project',
          text: p.name + (p.description ? ' — ' + p.description : ''),
          url: p.html_url,
        })
      }
    }
    if (feed.status === 'fulfilled' && Array.isArray(feed.value)) {
      for (const post of feed.value.slice(0, 5)) {
        const iso = post?.created_at || post?.indexedAt
        if (iso) items.push({
          id: 'f-' + (post.uri || post.id || iso),
          iso,
          relative: relative(iso),
          kind: post.source || 'post',
          text: (post.text || '').slice(0, 120),
          url: post.url || post.uri || '#',
        })
      }
    }
    recent.value = items
      .sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime())
      .slice(0, 8)
  } catch { /* swallow — recent strip is optional */ }
})
</script>

<style scoped>
.almanac-datestamp {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
  margin: -1rem 0 3rem;
  font-style: italic;
  font-size: 0.9rem;
  color: var(--theme-ink-muted, #555);
}
.almanac-datestamp span:nth-child(2n) { /* the · separators */
  color: var(--theme-rule, rgba(0,0,0,0.3));
}

.almanac-index { display: grid; grid-template-columns: 1fr; gap: 2.5rem; }
@media (min-width: 720px) {
  .almanac-index { grid-template-columns: 1fr 1fr; gap: 2.5rem 3rem; }
}
.almanac-index__cat-title {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 500;
  margin: 0 0 0.75rem;
  color: var(--theme-ink-muted, #555);
}
.almanac-index__list { list-style: none; padding: 0; margin: 0; }
.almanac-index__list li {
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--theme-rule, rgba(0,0,0,0.08));
}
.almanac-index__list li:last-child { border-bottom: 0; }
.almanac-index__link {
  display: flex; flex-direction: column; gap: 0.1rem;
  text-decoration: none; color: inherit;
}
.almanac-index__link-title { font-size: 1.05rem; }
.almanac-index__link-title:hover { color: var(--theme-accent, #c14a2a); }
.almanac-index__link-desc {
  font-style: italic;
  font-size: 0.85rem;
  color: var(--theme-ink-muted, #555);
}

.almanac-recent { margin-top: 4rem; }
.almanac-recent__title {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 500;
  margin: 0 0 0.75rem;
  color: var(--theme-ink-muted, #555);
}
.almanac-recent__list { list-style: none; padding: 0; margin: 0; }
.almanac-recent__item {
  display: grid;
  grid-template-columns: 5rem 5rem 1fr;
  gap: 1rem;
  align-items: baseline;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--theme-rule, rgba(0,0,0,0.06));
  font-size: 0.9rem;
}
.almanac-recent__time, .almanac-recent__kind {
  color: var(--theme-ink-muted, #555);
  font-size: 0.8rem;
  letter-spacing: 0.02em;
}
.almanac-recent__text {
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid transparent;
}
.almanac-recent__text:hover {
  border-bottom-color: var(--theme-accent, #c14a2a);
  color: var(--theme-accent, #c14a2a);
}
</style>
```

- [ ] **Step 2: Smoke test**

Navigate to `/` in dev. Confirm: serif title, kicker italic, hairline rule, four categorised columns of links (or one column on narrow), recent strip below populated from `/api/projects` and `/api/feed`, colophon footer at bottom. NO canvas.

If `/api/feed` 500s in dev (it depends on Bluesky API), the recent strip should silently render only projects, or be empty — the `Promise.allSettled` + `try/catch` swallow individual failures.

### Task 25: Commit Phase 7

```bash
cd ~/github/phareim.no
git add -A
git commit -m "feat(homepage): rebuild / as a wiki-reader-style serif index

New homepage is wholly composed:
- Serif title 'An Almanac of Petter Hareim' with italic kicker.
- Four categorised columns (Front matter / The work / Playful / Meta)
  of all 12 surviving routes with one-line descriptions.
- 'Recent' strip pulling 3 latest projects + 5 latest feed posts via
  Promise.allSettled (gracefully empty if either upstream is down).
- Colophon footer linking to source and /colophon.

No canvas background. The space-shooter lives at /games/space-invaders.

Part of the phareim.no rebuild (council run 2026-05-27-2208).
"
```

---

## Phase 8 — Token Wiring + Cleanup

### Task 26: Vendor Almanac tokens — refresh-from-source on dev, ship the vendored file

**Files:**
- Create: `scripts/sync-almanac-tokens.mjs`
- Create: `assets/themes/_tokens-generated.css` (vendored output, committed to the repo)
- Modify: `assets/themes/almanac.css` — `@import` the vendored tokens
- Modify: `nuxt.config.ts` (no change — `css: ['~/assets/themes/almanac.css']` is already there from Task 2)
- Modify: `package.json` (add `predev` and `prebuild` scripts)

**Strategy.** The script reads `~/github/almanac-design/tokens/tokens.json` and writes `assets/themes/_tokens-generated.css`. The generated file is **committed** to phareim.no — Cloudflare CI does not have access to `~/github/almanac-design/`, so we ship the vendored file. The `predev`/`prebuild` script refreshes the vendored file locally; in CI, the script soft-fails and CI uses whatever was last committed. Drift is caught the next time the script runs locally (you'll see a non-empty `git diff assets/themes/_tokens-generated.css`).

- [ ] **Step 1: Write the sync script using the REAL tokens.json shape**

Create `scripts/sync-almanac-tokens.mjs`:

```js
#!/usr/bin/env node
// Reads ~/github/almanac-design/tokens/tokens.json and rewrites
// assets/themes/_tokens-generated.css with CSS variables matching
// the canonical Almanac palette. The output is committed to git;
// this script just refreshes it from source when run locally.
//
// tokens.json shape (verify at ~/github/almanac-design/tokens/tokens.json):
//   { palette: {
//       light: { paper, ink, mute, rust, rule },
//       dark:  { nightTop, nightBottom, nightInk, nightMute, amber, nightRule, nightHeaderRule }
//     },
//     type: { serif, mono, sizes, lineHeight, tracking, measureCh },
//     space: { gutter, sectionGap, hairline },
//   }

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const tokensPath = process.env.ALMANAC_TOKENS_PATH
  || join(homedir(), 'github/almanac-design/tokens/tokens.json')
const cssPath = resolve(here, '..', 'assets/themes/_tokens-generated.css')

if (!existsSync(tokensPath)) {
  console.warn(`[almanac-tokens] skipping: ${tokensPath} not present (this is expected on CI). Vendored file at ${cssPath} will be used.`)
  process.exit(0)
}

const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'))
const light = tokens?.palette?.light || {}
const dark = tokens?.palette?.dark || {}
const type = tokens?.type || {}
const space = tokens?.space || {}

const required = (path, value) => {
  if (!value) throw new Error(`[almanac-tokens] missing token: ${path}`)
  return value
}

const css = `/* DO NOT EDIT — generated by scripts/sync-almanac-tokens.mjs.
 * Source: ~/github/almanac-design/tokens/tokens.json (version ${tokens.version || '?'}).
 * Regenerate by running \`npm run sync:almanac\` (or \`npm run dev\` / \`npm run build\`,
 * which run this script via the predev/prebuild hooks).
 */

.almanac-page {
  /* Light (paper) */
  --theme-paper:        ${required('palette.light.paper', light.paper)};
  --theme-ink:          ${required('palette.light.ink', light.ink)};
  --theme-ink-muted:    ${required('palette.light.mute', light.mute)};
  --theme-accent:       ${required('palette.light.rust', light.rust)};
  --theme-rule:         ${required('palette.light.rule', light.rule)};
  --theme-surface:      ${light.paper};

  /* Typography */
  --theme-font-serif:   ${required('type.serif', type.serif)};
  --theme-font-mono:    ${required('type.mono', type.mono)};
  --theme-measure:      ${required('type.measureCh', type.measureCh)}ch;

  /* Spacing */
  --theme-gutter:       ${required('space.gutter', space.gutter)}px;
  --theme-hairline:     ${space.hairline ?? 1}px;
}

@media (prefers-color-scheme: dark) {
  .almanac-page {
    --theme-paper:      ${required('palette.dark.nightBottom', dark.nightBottom)};
    --theme-paper-top:  ${required('palette.dark.nightTop', dark.nightTop)};
    --theme-ink:        ${required('palette.dark.nightInk', dark.nightInk)};
    --theme-ink-muted:  ${required('palette.dark.nightMute', dark.nightMute)};
    --theme-accent:     ${required('palette.dark.amber', dark.amber)};
    --theme-rule:       ${required('palette.dark.nightRule', dark.nightRule)};
    --theme-surface:    ${dark.nightBottom};
  }
}
`

writeFileSync(cssPath, css)
console.log(`[almanac-tokens] wrote ${cssPath} from tokens v${tokens.version || '?'}`)
```

- [ ] **Step 2: Run it once and commit the output**

```bash
cd ~/github/phareim.no
node scripts/sync-almanac-tokens.mjs
```

Expected: writes `assets/themes/_tokens-generated.css`. `cat` it to verify the values look right (paper `#f4f0e8`, ink `#1a1a1a`, rust `#c14a2a`, dark amber `#d4a574`).

- [ ] **Step 3: Make `almanac.css` import the generated tokens at the top**

Open `assets/themes/almanac.css`. Add as the very first line:

```css
@import './_tokens-generated.css';
```

Then audit the file: any literal hex values that duplicate token values should be replaced with `var(--theme-*)`. The Phase 6 audit already did much of this for `pages/`; do the same surgery here for the canonical theme file.

- [ ] **Step 4: Wire into `package.json`**

In `package.json`, add to `scripts`:

```json
{
  "scripts": {
    "sync:almanac": "node scripts/sync-almanac-tokens.mjs",
    "prebuild": "node scripts/sync-almanac-tokens.mjs",
    "predev": "node scripts/sync-almanac-tokens.mjs"
  }
}
```

(Preserve all other existing scripts — only add these three.)

- [ ] **Step 5: Verify build green**

Run: `cd ~/github/phareim.no && npm run build 2>&1 | tail -10`
Expected: the `prebuild` runs, prints `[almanac-tokens] wrote ...`, and Nuxt build succeeds.

- [ ] **Step 6: Commit the vendored file**

```bash
cd ~/github/phareim.no
git add assets/themes/_tokens-generated.css scripts/sync-almanac-tokens.mjs package.json assets/themes/almanac.css
```

(The vendored file is intentionally **committed**, not gitignored. This is what ships to CI.)

### Task 27: Archive orphan game sprites

**Files:**
- Delete: `public/game/` (the orphan flatboy/redhat platformer sprites)

The Frame synthesis decided: archive these and file a follow-up sfl meta.

- [ ] **Step 1: Confirm no inbound references**

Run: `cd ~/github/phareim.no && grep -rn "/game/flatboy\|/game/redhat\|public/game" --include='*.vue' --include='*.ts' --include='*.css' --include='*.md' . 2>/dev/null | grep -v "CLAUDE.md\|README.md\|node_modules"`
Expected: no hits. If hits exist, fix or note them.

- [ ] **Step 2: Delete**

```bash
cd ~/github/phareim.no
git rm -r public/game
```

- [ ] **Step 3: File follow-up sfl meta**

```bash
sfl meta add "flatboy/redhat: build a platformer game or delete the assets" --priority low --status pending
```

### Task 28: Eyeball `server/api/debug-env.ts` and remove if it's an obvious leak

**Files:**
- Read + possibly delete: `server/api/debug-env.ts`

- [ ] **Step 1: Inspect**

Run: `cd ~/github/phareim.no && cat server/api/debug-env.ts`
Decision rubric:
- If it returns env vars / secrets / config to anonymous callers — **delete the file**.
- If it's gated by some token / IP check / NODE_ENV check that proves it's dev-only — leave it but add a comment noting the audit.
- If unclear, prefer delete (it can be reintroduced in dev when needed).

- [ ] **Step 2: Act**

Either `git rm server/api/debug-env.ts` (recommended default) or annotate with a comment block at the top explaining why it's safe to keep.

### Task 29: Update CLAUDE.md with the new IA and verdict table

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rewrite the affected sections**

Open `CLAUDE.md`. Replace the "Theme System" section with:

```markdown
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
```

Replace the "Project Structure" `pages/` block with the new IA:

```markdown
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
```

Add a "Rebuild — May 2026" section at the bottom:

```markdown
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

**Out-of-scope follow-ups** (filed as sfl metas):
- Space Invaders: D1 high-scores, mobile touch polish, sound.
- Flatboy/redhat: build a real platformer or delete the (now-deleted) sprites.
- Lint rule banning literal hex values in `pages/*.vue`.
- Auth reimplementation.
```

Update the "Keyboard Shortcuts" section to remove `1/2/3` and reflect the new NAV_PAGES order.

### Task 30: File follow-up sfl metas

- [ ] **Step 1: File the follow-ups**

```bash
sfl meta add "space-invaders: D1 high-scores" --priority low --status pending
sfl meta add "space-invaders: mobile touch controls polish" --priority low --status pending
sfl meta add "space-invaders: web audio sound effects" --priority low --status pending
sfl meta add "phareim.no: lint rule banning literal hex in pages/*.vue" --priority medium --status pending
sfl meta add "phareim.no: auth reimplementation (per CLAUDE.md note)" --priority low --status pending
```

(If `sfl meta add` rejects any of these as duplicates, accept and move on.)

### Task 31: Commit Phase 8

```bash
cd ~/github/phareim.no
git add -A
git commit -m "chore(cleanup): token wiring, docs refresh, dead asset purge

- scripts/build-almanac-css.mjs reads ~/github/almanac-design/tokens/tokens.json
  at prebuild/predev time, patches assets/themes/almanac.css. Keeps phareim.no
  in lockstep with wiki-reader and the canonical Almanac source.
- public/game/ orphan platformer sprites deleted (no route ever wired them up).
- server/api/debug-env.ts eyeballed and (kept/deleted per audit).
- CLAUDE.md rewritten: new IA, new Almanac-only theme section, rebuild note,
  follow-ups index.

Part of the phareim.no rebuild (council run 2026-05-27-2208).
"
```

---

## Phase 9 — Verification, Polish, Push

### Task 32: Update the QA rig for the new IA and token names, then re-run

**Files:**
- Modify: `scripts/almanac-qa.mjs` — the `ROUTES` list and the `TOKENS` list both need to be rewritten for the new IA and new var names.

**Why this matters.** The QA rig hardcodes the OLD route list (`/clock`, `/morse`, `/stats`, etc.) and OLD token names (`--theme-bg`, `--theme-text`, `--theme-card-border`). After the rebuild those routes 301 to new locations and those CSS vars don't exist anymore. If you just re-run the rig without updating it, every cell shows empty vars and every old route screenshots a redirect page. The rebuild looks broken even when it isn't.

Also: the rig's `status.json` is populated with `'pending'` for every cell — the "broken / minor / ok" classification in `~/thoughts/wiki/almanac-qa-2026-05.md` was a manual human review pass. There is no automatic broken-cell count; the rig captures screenshots and writes per-page var snapshots. The acceptance criterion below is reframed accordingly.

- [ ] **Step 1: Rewrite the rig's ROUTES list**

Open `scripts/almanac-qa.mjs`. Replace the `ROUTES` constant (the array at lines ~11-21) with:

```js
const ROUTES = [
  ['index','/'],
  ['about','/about'],
  ['now','/now'],
  ['uses','/uses'],
  ['colophon','/colophon'],
  ['projects','/projects'],
  ['feed','/feed'],
  ['gallery','/gallery'],
  ['guestbook','/guestbook'],
  ['lab','/lab'],
  ['lab-imagine','/lab/imagine'],
  ['games','/games'],
  ['games-space-invaders','/games/space-invaders'],
  ['playground','/playground'],
  ['playground-terminal','/playground/terminal'],
  ['playground-morse','/playground/morse'],
  ['playground-launch','/playground/launch'],
  ['error','/this-does-not-exist'],
];
```

(17 surviving cells × 2 modes = 34 captures. Down from the pre-rebuild 38.)

- [ ] **Step 2: Rewrite the rig's TOKENS list**

Same file, replace the `TOKENS` constant (lines ~23-26) with the new variable names introduced by `_tokens-generated.css`:

```js
const TOKENS = [
  '--theme-paper','--theme-ink','--theme-ink-muted',
  '--theme-accent','--theme-rule','--theme-surface',
  '--theme-font-serif','--theme-measure',
];
```

- [ ] **Step 3: Remove the obsolete localStorage shim**

In the per-route capture, the rig does `await page.evaluate(() => localStorage.setItem('theme','almanac'))` and then reloads. With the theme system collapsed to Almanac-only, this is a no-op — but leaving it in is fine (the `setTheme` shim from Task 3 silently swallows it). If you want to clean up: delete those two lines from the per-route loop. Optional.

- [ ] **Step 4: Bring up dev server**

Run: `cd ~/github/phareim.no && npm run dev &` and wait for `Local: http://localhost:3030`. Verify with `curl -s http://localhost:3030/ | head -3`.

- [ ] **Step 5: Run the rig**

Run: `cd ~/github/phareim.no && node scripts/almanac-qa.mjs 2>&1 | tee /tmp/qa-after.log`
Expected: 34 lines of `OK <slug> <mode>` (17 routes × 2 modes), `0` lines of `FAIL`, no `WARN dev error overlay present` lines.

- [ ] **Step 6: Verify the captured CSS vars are all non-empty**

Run: `cd ~/github/phareim.no && for f in .qa/almanac/*.vars.json; do python3 -c "import json,sys; d=json.load(open('$f')); missing=[k for k,v in d.items() if not v]; print('$f', 'missing:', missing) if missing else None"; done`
Expected: no output (every var has a value). If output appears, the missing var indicates either (a) the page wasn't wrapped in `AlmanacFrame` so the `.almanac-page` class isn't on the root the rig samples, or (b) the var is declared but not propagating.

- [ ] **Step 7: Acceptance — eyeball the captures**

Open `.qa/almanac/index-light.png`, `.qa/almanac/index-dark.png`, `.qa/almanac/games-space-invaders-light.png`, `.qa/almanac/games-space-invaders-dark.png`, and one tool page (`.qa/almanac/playground-terminal-light.png`). The acceptance criteria:

1. **All capture commands succeeded** (Step 5: 34/34 OK, 0 FAIL).
2. **All CSS vars present** (Step 6: no missing).
3. **Visual consistency** — homepage, reading pages, and `/games`/`/playground` indexes all show the Almanac frame (hairline, serif, moon-glyph title); tool pages keep their native interior visually wrapped in the frame; space-invaders fills the canvas with its dark chrome.

If any of these fail, fix in-place (likely a missed `AlmanacFrame` wrap from Task 20/21/22) and re-run from Step 5.

### Task 33: Manual smoke test of /games/space-invaders

- [ ] **Step 1: Play the game end-to-end**

In dev, navigate to `http://localhost:3030/games/space-invaders`. Verify:
- Page chrome: hairline header with "← games" link, "Score 0" HUD, "Press Enter to start" hint.
- Press Enter → game starts, "Press Enter to start" hint disappears.
- Arrow keys move the player ship. Space fires bullets.
- Hitting an enemy → score increments in HUD.
- Player dies → HUD shows "Game over — Enter to restart" + "High N".
- Press Enter → restarts, score back to 0.
- Refresh the page → high score persists (from localStorage).
- Click "← games" → returns to /games.
- `/games` lists Space Invaders with the right description.

### Task 34: Final build + push

- [ ] **Step 1: Final build**

Run: `cd ~/github/phareim.no && npm run build 2>&1 | tail -20`
Expected: green. If broken, fix before pushing.

- [ ] **Step 2: Final review of the diff**

Run: `cd ~/github/phareim.no && git log --oneline pre-almanac-rebuild..HEAD`
Expected: 8 phase commits (Phases 2 through 8 + a possible Phase 9 fix-up if Task 32 surfaced issues that needed in-place edits). Each commit message clearly describes the phase.

- [ ] **Step 3: Push to master**

Run: `cd ~/github/phareim.no && git push origin master`
This triggers GitHub Actions on `master` → Cloudflare Pages deploy.

- [ ] **Step 4: Watch the deploy**

Run: `cd ~/github/phareim.no && gh run watch || gh run list --limit 1`
Expected: latest run completes green within ~3-5 minutes.

- [ ] **Step 5: Hit production**

Run: `curl -sI https://phareim.no | head -5`
Expected: 200. Then in a browser: confirm the new homepage loads, navigate to `/games/space-invaders`, confirm an archived URL (e.g. `/clock`) 301-redirects to `/playground`.

---

## Acceptance checklist (mirror of register.md)

- [ ] Page count ≤12 surviving top-level routes (verified by `ls pages/**/*.vue | wc -l` and accounting for archived/redirected ones; the `/games/<slug>` and `/playground/<slug>` children count as one route each at the IA level).
- [ ] Only `almanac.css` and `_tokens-generated.css` remain in `assets/themes/`.
- [ ] `nuxt.config.ts` `css: []` array has only the one Almanac import.
- [ ] `/games/space-invaders` playable: arrows move, space fires, score updates, "Game Over → Enter to restart" loop works, high score persists in localStorage, wave-counter HUD increments and the centered serif `Wave N` banner appears for ~1.5s when waves change.
- [ ] `/games` index reachable from `/`.
- [ ] `_redirects` covers all archived routes (5 deleted + 4 moved + 1 historical: 10 lines total).
- [ ] CLAUDE.md updated with new IA + verdict table + rebuild note.
- [ ] `scripts/sync-almanac-tokens.mjs` wired via `predev`/`prebuild`; `assets/themes/_tokens-generated.css` is vendored (committed) and refreshes from `~/github/almanac-design/tokens/tokens.json` locally.
- [ ] `npm run build` green; deploy to Cloudflare Pages green; production URL returns 200; at least one archived URL (e.g. `/clock`) confirmed 301-redirecting to the right destination.
- [ ] QA rig (`scripts/almanac-qa.mjs`) updated for the new IA + token names; runs cleanly with 34/34 OK captures and no missing CSS vars.
- [ ] Homepage shows the almanac datestamp (weekday · date · day-of-year · week).
- [ ] AlmanacFrame title sports the moon-glyph (`◐`) in accent color before every page title.
- [ ] Five follow-up sfl metas filed (space-invaders D1 high-scores, mobile touch, sound; phareim.no lint rule for hex literals; auth reimplementation).
