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
- **Tests:** `tests/miniworld-net.test.mjs` in the repo (`npm run test:miniworld`): the room, the real service with two clients, the link.

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

## Rules

- **Origin:** `https://phareim.no`, `https://www.phareim.no`, `https://<anything>.phareim-no.pages.dev`, and for dev `http://localhost:*`, `http://127.0.0.1:*` and this machine's private LAN/Tailscale addresses. Anything else, or no Origin, gets 403.
- **Joining:** `hello` → `welcome` (your id and everyone here) and a `join` to everyone else. At `MAX_PEERS` (40) the answer is `full` and the socket is closed (code 4003). A wrong protocol version is closed with 4001.
- **Who hears what:** join, info and leave go to everyone. A state goes to the peers in the sender's place, and on a place change also to the peers in the place it left. A peer that changes place gets everyone's latest state. Effects go to the peers in the same place.
- **Limits:** messages over `MAX_MSG_BYTES` close the socket (ws `maxPayload`); over `MAX_MSGS_PER_SEC` per socket are dropped; anything that fails the protocol validators is dropped.
- **Keepalive:** a ws ping every 25 s; no pong by the next one cuts the socket. No message for 60 s (the client pings every 20 s) or no hello within 10 s drops it too.
- **Logs:** stdout only, join/leave counts and refused origins, never message contents.

## Deploy

A push to `master` on `phareim/phareim.no` reaches `sleeper-deploy`
(`~/github/sleeper/deploy-hook`, `scriptRepos`), which runs `deploy.sh`:
`git pull --ff-only` in `~/github/phareim.no`, then `npm ci --omit=dev` and
`pm2 restart mw-world` only if `servers/mw-world/` or
`themes/miniworld/net/protocol.ts` changed. A restart drops everyone for a
moment. The site itself deploys to Cloudflare from GitHub Actions.

## What would make it redundant

Moving presence to a Cloudflare Durable Object next to the site (one object
per world, WebSocket hibernation), or dropping the shared world from Mini
World. Then: `pm2 delete mw-world && pm2 save`, remove the nginx
`/mw-world/` location and the `phareim/phareim.no` entry in the deploy hook,
and mark it retired in `~/github/sleeper/docs/agent-environment-reference.md`.
