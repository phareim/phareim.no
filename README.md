# phareim.no

Personal website. Nuxt 3, four pages, no database. Deployed to Cloudflare Pages
by GitHub Actions on every push to `master`.

## Pages

- `/` — landing page with a canvas animation (theme dependent)
- `/about` — bio, photo, social links
- `/projects` — public GitHub repos, fetched live from the GitHub API
- `/meta` — this site's commit log, from the GitHub API

Four switchable themes: Scandinavian Glass (default), Cyberpunk, Space, Tufte.

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
