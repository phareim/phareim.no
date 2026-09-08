# phareim.no

Personal website. Nuxt 3 on Cloudflare Pages, deployed by GitHub Actions on
every push to `master`. One D1 database (`phareim-leaderboard`) holds the
Hall of Fame — the world ranking of the six score games — behind three
small API routes; nothing else is stored.

The front page is a set of themes. Swipe or use the arrow keys to walk
through them; a first visit lands on a random one. Each theme lives in
`themes/<id>/` and owns its whole landing page — see
`.claude/skills/phareim-theme/SKILL.md` for how to add one.

## Pages

`/` is the whole site — the landing page, rendered by the active theme.
`/about`, `/projects` and `/meta` were removed 2026-09-07; the profile and
the contact links live in the **Player One** theme (`/?theme=playerone`).

Themes: Player One, Another Shore, Galaga, Breakout, R-Type, Space
Invaders, Star Fox, Tetris, Hall of Fame — plus Another Shore II,
Scandinavian Glass, Space and Tufte Desk, parked but reachable. Preview one
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

See `CLAUDE.md` for architecture and conventions.
