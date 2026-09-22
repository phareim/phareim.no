## ⚠️ History note — lots of reverted work worth mining

On **2026-05-28** the top of `master` was intentionally reset back to the **April 2 snapshot** (commit `887aa6a`) via a single snapshot-revert commit (`66d257c`). This was a taste decision: the owner disliked the page-shift navigation animations and the cinematic theme-switch effect and prefers the calmer, simpler look. **No history was lost** — the reverted commits are all still in the graph.

The reverted range `887aa6a..4b93c52` contains **~217 commits** (≈2 months of work) with a lot worth bringing back later: many content pages (`/now`, `/feed`, `/uses`, `/colophon`, `/guestbook`, `/gallery`, `/stats`, `/activity`, …), backend APIs (unified Bluesky/X feed, RSS, D1 guestbook, R2 gallery, richer projects API), a Cmd+K command palette, keyboard navigation, accessibility wins, **and a later single-theme "Almanac" paper redesign** (`dc02650`, `c70bba1`, `b24da6b`, `d706eff`) — it was back as a theme (`themes/almanac/`) 2026-09-03 to 2026-09-05 and removed again because it was the only landing that needed to scroll (last commit with it: `1bd327a`).

When restoring things: cherry-pick onto this base, and **leave out the background-canvas animations, page slide/zoom transitions, theme-switch cinematics, menu stagger, and count-up effects** — that motion is exactly what was reverted. Tier-1 hardening (security dep bumps, Vue3 `beforeUnmount` fix, SSR hydration fix, CI injection fix) was already brought forward in commit `1a1b7d5`.

> Tip: `git log --oneline 887aa6a..4b93c52` lists everything; `git show <sha>` to inspect.

