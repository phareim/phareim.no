# mw-world

Mini World's shared world: everyone who plays `?theme=miniworld` on
phareim.no walks in the same world and sees the others live. This service
relays who is where. It keeps nothing on disk; a restart empties the room
and the browsers reconnect by themselves within a few seconds.

- **Runs on:** Sleeper, PM2 name `mw-world`, from `~/github/phareim.no/servers/mw-world`
- **Port:** 3034, bound to 127.0.0.1
- **Public URL:** `wss://sleeper.phareim.no/mw-world/ws` (nginx `location /mw-world/`, prefix stripped, WebSocket upgrade, 1 h read timeout); `GET /mw-world/health` → `{ ok, peers, uptime }`
- **Code:** `server.ts` (HTTP + WebSocket, origin check, keepalive), `room.ts` (the room logic, no sockets), the wire format in `../../themes/miniworld/net/protocol.ts`. The browser's end is `themes/miniworld/net/link.ts`.
- **Runtime:** Node 22.18 or newer runs the TypeScript directly (type stripping). Only erasable syntax, imports with `.ts` extensions. The one dependency is `ws`.
- **Tests:** `tests/miniworld-net.test.mjs` in the repo (`npm run test:miniworld`): the room, the real service with two clients and a fake auth server (no session, dead session and auth down are 401; wrong origin is 403 without asking auth), the link.

## Start

```bash
cd ~/github/phareim.no/servers/mw-world
npm ci --omit=dev
pm2 start server.ts --name mw-world --interpreter node --node-args="--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"
pm2 save
```

The warning flag hides Node's note that the repo root's `package.json` has no
`"type"` (protocol.ts lives there).

For local development: `npm start` (port 3034). In dev the game connects to
`ws://<page host>:3034/ws`.

## Env

No secrets and no `.env`. Optional:

- `MW_WORLD_PORT`: port, default 3034 (0 picks a free one; the tests use that)
- `MW_WORLD_ORIGINS`: extra allowed origins, comma-separated
- `MW_WORLD_AUTH_BASE`: another auth server for the session check. Only the tests set it (a fake on localhost); in production it is unset and the check goes to `https://auth.phareim.no`

## Rules

- **Origin:** `https://phareim.no`, `https://www.phareim.no`, `https://<anything>.phareim-no.pages.dev`, and for dev `http://localhost:*`, `http://127.0.0.1:*` and this machine's private LAN/Tailscale addresses. Anything else, or no Origin, gets 403.
- **Sign-in (2026-09-29):** the upgrade needs a signed-in site account. The page is on `phareim.no` and this service on `sleeper.phareim.no`, inside the cookie's `Domain=.phareim.no`, so the browser sends the httpOnly `session_token` cookie with the upgrade (nginx passes the `Cookie` header on by default). After the Origin check, `server.ts` hands the header to `../../server/utils/sessionCheck.ts` (the same code the Pages routes use), which forwards only that cookie to `GET https://auth.phareim.no/api/session` and caches the answer by the SHA-256 of the token: 5 minutes for a signed-in answer, 30 seconds for a signed-out one. No cookie is answered without asking auth. No session, or auth unreachable or answering nonsense (fail closed), gets `401 Unauthorized` **before** the upgrade, so no socket opens; the log line says `refused: no session` or `refused: auth unreachable`, never the token or the cookie. A wrong Origin is still 403 and never reaches auth. Identity beyond "signed in" is not used: the room is shared and the wire's public id is still the client's word. A socket that is already open is not re-checked: a sign-out ends the session for new connections, and the open one lasts until it drops (the browser link reconnects when the tab comes back).
- **Joining:** `hello` → `welcome` (your id and everyone here) and a `join` to everyone else. At `MAX_PEERS` (40) the answer is `full` and the socket is closed (code 4003). A wrong protocol version is closed with 4001.
- **Who hears what:** join, info and leave go to everyone. A state goes to the peers in the sender's place, and on a place change also to the peers in the place it left. A peer that changes place gets everyone's latest state. Effects go to the peers in the same place.
- **Limits:** messages over `MAX_MSG_BYTES` close the socket (ws `maxPayload`); over `MAX_MSGS_PER_SEC` per socket are dropped; anything that fails the protocol validators is dropped.
- **Keepalive:** a ws ping every 25 s; no pong by the next one cuts the socket. No message for 60 s (the client pings every 20 s) or no hello within 10 s drops it too.
- **Logs:** stdout only, join/leave counts and refused origins, never message contents.

## Deploy

A push to `master` on `phareim/phareim.no` reaches `sleeper-deploy`
(`~/github/sleeper/deploy-hook`, `scriptRepos`), which runs `deploy.sh`:
`git pull --ff-only` in `~/github/phareim.no`, then `npm ci --omit=dev` and
`pm2 restart mw-world` only if `servers/mw-world/`,
`themes/miniworld/net/protocol.ts`, `server/utils/sessionCheck.ts` or
`themes/zelda/account.ts` changed (the last two are what the sign-in check
imports). A restart drops everyone for a moment. A push made from `~/github/phareim.no` itself pulls nothing, so the hook sees no change: run `pm2 restart mw-world` by hand then (found 2026-09-29). The site itself deploys to
Cloudflare from GitHub Actions.

**The sign-in check (2026-09-29) and the order.** The push that adds it changes
`server.ts`, so `deploy.sh` restarts the service by itself; nothing is
restarted by hand and nothing is installed (`ws` is still the only
dependency). Pages and this service deploy independently, at slightly
different times. Until the restart, the old service still lets anyone
connect (a signed-out browser cannot reach the game anyway once the Pages
deploy is live); after it, a page from before the Pages deploy that
connects without a session gets 401 and plays solo. Either order is safe.
Check afterwards: `curl -si -H 'Origin: https://phareim.no' -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' https://sleeper.phareim.no/mw-world/ws | head -1`
answers `HTTP/1.1 401 Unauthorized` (403 from outside Norway), and
`pm2 logs mw-world` shows `refused: no session`.

## What would make it redundant

Moving presence to a Cloudflare Durable Object next to the site (one object
per world, WebSocket hibernation), or dropping the shared world from Mini
World. Then: `pm2 delete mw-world && pm2 save`, remove the nginx
`/mw-world/` location and the `phareim/phareim.no` entry in the deploy hook,
and mark it retired in `~/github/sleeper/docs/agent-environment-reference.md`.
