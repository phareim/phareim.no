# phareim-feedback

Last verified: 2026-11-27.

Petter's in-game feedback box. Neon Shrine's dev-mode button posts a screenshot, a copy of the save, where the hero stands and a note to this service on Sleeper; Petter reads them afterwards with the `feedback` CLI or the review page. One account may use it; everyone else gets the same empty 404.

- Port 3057 on 127.0.0.1, PM2 `phareim-feedback`, nginx `https://sleeper.phareim.no/feedback/` (prefix stripped, 1 MB bodies, no geo gate).
- Plain `node:http`, Node runs the TypeScript. One dependency, `dotenv`. `app.ts` is the whole app (`startServer`, no side effects on import), `server.ts` starts it, `store.ts` is the folder store, `page.html` the review page, `cli.mjs` the CLI.

## Routes

The client half of the contract (what the game sends, `meta`'s shape) lives with the game; the service keeps `meta` as data and checks only `meta.app` (string, 1-32 chars) and `meta.v` (the number 1).

- Game side, `Origin` exactly `https://phareim.no` or `https://www.phareim.no`, CORS headers on every answer after the gate: `GET /can` (`{"ok":true}`), `POST /entry` (multipart: `meta`, `text`, optional `shot` JPEG up to 400 000 bytes, optional `save` JSON up to 65 536 bytes; whole body up to 600 000).
- Review side, `Origin` absent (GET) or `https://sleeper.phareim.no`, never CORS: `GET /` (page), `GET /entries?before=<id>` (30 a page), `GET /entry/<id>/shot.jpg|save.json|meta.json`, `POST /entry/<id>/done`.
- `GET /health` answers only a direct call on 127.0.0.1 (a request with an `X-Real-IP` header, which nginx always adds, is refused).
- Gate order: path and method, Origin and `Sec-Fetch-Site`, lookup budget (an unknown session token counts 20 a minute per address and 60 overall), `createSessionChecker()` from `server/utils/sessionCheck.ts` must say `in`, then the account must be on the allowlist. Every failure is one answer: 404, `text/plain`, empty, `cache-control: no-store`, no CORS. No body byte is read before the allowlist step.
- A sign-out elsewhere is honoured up to 5 minutes later (the session check caches).

## Env

`servers/feedback/.env` (mode 600, git-ignored), read only for these names:

- `FEEDBACK_ALLOWED_EMAILS`: comma list, compared lower-cased. Set.
- `FEEDBACK_ALLOWED_USER_IDS`: comma list, exact. The fallback if the session answers with another address: add the account id there, then `pm2 restart phareim-feedback`.
- `FEEDBACK_PORT` (default 3057), `FEEDBACK_ROOT` (default `~/data/feedback`).

Both lists empty means nobody; the service logs `no allowed accounts: refusing everyone`.

## Store

`~/data/feedback/` (mode 700, files 600; `~/data` is in the backup's `PATHS`), one folder per entry, `<id>.tmp/` renamed to `<id>/`, id `YYYY-MM-DDTHH-MM-SSZ-xxxx`:

- `meta.json`: `{v, id, createdAt, status:'open'|'done', doneAt, by (account id), text, client (the meta as sent, url cut to origin and path), files:{shot, save}}`. No cookie, no address, no email.
- `shot.jpg` and `save.json` as received (absent when not sent).

Disk guards, checked before a POST body is read (answer 507): the store at 256 MB or more, or under 3 GB free on the disk. At start and every hour `*.tmp` folders older than 10 minutes are deleted. Nothing else is pruned.

## CLI

`feedback` (symlink `~/.local/bin/feedback` to `cli.mjs`; reads the folder directly, works with the service down; `FEEDBACK_ROOT` honoured):

- `feedback list [--all]`: open entries (all with `--all`): id, time, status, map, area, tile, first 70 characters.
- `feedback show [<id|prefix>]`: no argument = newest open entry. Text, `MAP NAME · AREA · TILE x,y` (tile units), version, the three absolute paths and the replay line `createGame(WORLD,{save}) then enterMap(WORLD, s, '<map>', '<entry>', [], {x,y})`.
- `feedback done <id>`.

## Run

- Start: `cd servers/feedback && heavy -- npm ci --omit=dev && pm2 start ecosystem.config.cjs && pm2 save` (the ecosystem file wipes the shell's environment first; never `--update-env`).
- Restart: `pm2 restart phareim-feedback`. Logs: `pm2 logs phareim-feedback`: refusals as one summary line a minute (counts per class), an allowed POST as id and byte count; never a cookie, token, email, address, text, save or picture.
- `deploy.sh` restarts it when `servers/feedback`, `server/utils/sessionCheck.ts` or `themes/zelda/account.ts` changed (arg 1 = the sha before the pull); `scripts/deploy.sh` has to call it.
- Tests: `heavy -- node --test tests/feedback-service.test.mjs` (area `feedback`): the gate, a round trip with hostile strings and the CLI, the limits.

## By-hand cleanup

- Delete an entry: `rm -r ~/data/feedback/<id>`. Reopen: set `"status":"open"` in its `meta.json`.
- Nothing prunes `done` entries. Entries hold a canvas picture, a game save and Petter's words, never Zaptec or Miles content. The backup volume and the off-site copy keep older entries until their own rotation.

## What would make it redundant

- Tasks that take pictures (a do.phareim.no attachment field).
- The game's feedback moving to a Cloudflare store with a review page.
- Petter not wanting it.

## Retire

1. `cp -r ~/data/feedback ~/archive/feedback-<date>/`.
2. `pm2 delete phareim-feedback && pm2 save`.
3. Back up `/etc/nginx/sites-enabled/sleeper`, remove the `/feedback/` location, `sudo nginx -t`, reload.
4. Remove `servers/feedback/`, its lines in `scripts/deploy.sh`, `~/.local/bin/feedback`, the `tests/areas.mjs` lines, and the button from the game.
5. Mark it retired in `~/github/sleeper/docs/agent-environment-reference.md` and the pm2-services skill (port 3057 back to the free list).
6. Ask Petter before deleting the data.
