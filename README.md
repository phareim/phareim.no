# phareim.no

Personal website. Nuxt 3, no database. Deployed to Cloudflare Pages by
GitHub Actions on every push to `master`.

The front page is a set of themes. Swipe or use the arrow keys to walk
through them; a first visit lands on a random one. Each theme lives in
`themes/<id>/` and owns its whole landing page — see
`.claude/skills/phareim-theme/SKILL.md` for how to add one.

## Pages

- `/` — landing page, rendered by the active theme
- `/about` — bio, photo, social links
- `/projects` — public GitHub repos, fetched live from the GitHub API
- `/meta` — this site's commit log, from the GitHub API

Themes: Scandinavian Glass, Cyberpunk, Space, Tufte, Tufte Desk, Almanac.
Preview one with `/?theme=<id>` (`scandi`, `hacker`, `space`, `tufte`,
`desk`, `almanac`).

## Development

```bash
npm install
npm run dev        # http://localhost:3030
npm run typecheck  # vue-tsc via nuxi
npm run build      # cloudflare-pages preset → dist/
```

Optional: `NUXT_GITHUB_TOKEN` raises the GitHub API rate limit for
`/projects` and `/meta`. Set it as a Pages environment variable in production.

See `CLAUDE.md` for architecture and conventions.
