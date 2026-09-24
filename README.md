# phareim.no

Personal website. Nuxt 3 on Cloudflare Pages, deployed by GitHub Actions on
every push to `master`. One D1 database (`phareim-leaderboard`) holds the
Hall of Fame — the world ranking of the six score games — behind three
small API routes; nothing else is stored.

The front page is the Portal: a small neon town you walk around in. Its
buildings lead to everything else — an arcade with a cabinet per game,
Petter's house (who he is, where to find him), and his public projects —
and the coast road east leads out of town into Neon Shrine, the adventure
the town is part of. Each game is a theme at `/?theme=<id>`; Escape or the ⌂ chip
goes back to the portal, and the next game is another cabinet. Each theme lives in `themes/<id>/` and owns its
whole page — see `.claude/skills/phareim-theme/SKILL.md` for how to add one.

## Pages

`/` is the whole site: the portal, or the theme `?theme=<id>` names. The
profile and the contact links live in the portal (Petter's house).

Themes: Another Shore, Galaga, Breakout, R-Type, Space Invaders, Star Fox,
OutRun, Tetris, Hall of Fame, Hangar — plus Another Shore II,
Scandinavian Glass, Space and Tufte Desk, parked but reachable. Open one
with `/?theme=<id>`.

The Hall of Fame (`/?theme=leaderboard`) is the global leaderboard: each
browser is a player with a generated two-word name (NEON OTTER, MODEM
WALRUS), games report a finished run to `POST /api/score`, and the board
shows the top ten per game with your own row highlighted. Reroll the name
on the board. Storage is Cloudflare D1; `npm run dev` uses an in-memory
store instead, so nothing local touches production data.

## Development

```bash
npm install
npm run dev        # http://localhost:3030
npm run typecheck  # vue-tsc via nuxi
npm run build      # cloudflare-pages preset → dist/
```

See `AGENTS.md` for architecture and conventions.
