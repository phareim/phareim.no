# phareim.no

Personal website. Nuxt 3, no database. Deployed to Cloudflare Pages by
GitHub Actions on every push to `master`.

The front page is a set of themes. Swipe or use the arrow keys to walk
through them; a first visit lands on a random one. Each theme lives in
`themes/<id>/` and owns its whole landing page — see
`.claude/skills/phareim-theme/SKILL.md` for how to add one.

## Pages

`/` is the whole site — the landing page, rendered by the active theme.
`/about`, `/projects` and `/meta` were removed 2026-09-07; the profile and
the contact links live in the **Player One** theme (`/?theme=playerone`).

Themes: Player One, Another Shore, Another Shore II, Cyberpunk, Breakout,
R-Type, Space Invaders, Star Fox, Tetris — plus Scandinavian Glass, Space and
Tufte Desk, parked but reachable. Preview one with `/?theme=<id>`.

## Development

```bash
npm install
npm run dev        # http://localhost:3030
npm run typecheck  # vue-tsc via nuxi
npm run build      # cloudflare-pages preset → dist/
```

See `CLAUDE.md` for architecture and conventions.
