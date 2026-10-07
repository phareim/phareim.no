# phareim.no

Personal website. Nuxt 3 on Cloudflare Pages, built and deployed from Sleeper on
every push to `master` (2026-10-04). One D1 database (`phareim-leaderboard`) holds the
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

## Deployment

GitHub Actions is disabled (2026-10-04). The signed GitHub webhook calls
`sleeper-deploy` → `scripts/deploy.sh`: the existing Mini World server deploy,
then `scripts/deploy-site.sh --auto`. Sites build from committed `origin/master`
in an isolated worktree through `heavy`, keeping uncommitted work out of production.
Every `test:*` script, typecheck and build must pass; then Wrangler applies the
existing D1 migrations before publishing to the `phareim-no` Pages production branch.
New test scripts automatically join the checks. Pull requests no longer run CI.

Busy pushes merge in the webhook's queue. A file lock serializes manual and
automatic site deploys; `~/.local/state/phareim-deploy/site` records the last
successful revision so duplicate webhooks skip building. Failed builds leave
the live site in place. Superseded automatic builds wait for the queued push.

A branch can be published as a Pages preview: `deploy-site.sh --branch <name>`
runs the same checks, deploys to that Pages branch, shares production's D1 and
applies no migrations; its last revision is in `site-<name>`. The `beta` branch
does this on every push and is served at beta.phareim.no (2026-10-07;
`AGENTS.md`, Deployment).

Manual: `bash scripts/deploy-site.sh [--branch <name>] [commit]`. Credentials are in
`~/.config/phareim-deploy/env` (600; `CLOUDFLARE_API_TOKEN` with Pages and D1
edit rights, `CLOUDFLARE_ACCOUNT_ID`), or the interactive environment.
Logs: `pm2 logs sleeper-deploy`; queue: `https://sleeper.phareim.no/deploy/health`.
