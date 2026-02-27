# Project Memory

## Architecture
- Nuxt 3 personal website deployed on Cloudflare Pages
- **Firebase completely removed** — all data in Cloudflare D1 + R2
- Blog: markdown files in `/blog` directory, server-side rendering

## D1 Tables
- `game_states` — RPG player state
- `places` — RPG world locations
- `items` — RPG items
- `characters` — RPG NPCs
- `gallery_characters` — Gallery character display (separate from RPG NPCs)
- `emoji_prompts` — Emoji → image prompt mapping
- `image_prompts` — Default image prompt templates
- `user_prompts` — Per-user prompts (user_id = 'owner' for admin)
- `model_definitions` — AI model configs for image generation

## Key Files
- `server/utils/db.ts` — D1 binding getter (`getDB(event)`)
- `server/utils/r2.ts` — R2 binding getter + upload helper
- `server/utils/storage.ts` — `uploadImageToR2(event, src, opts)` replaces Firebase Storage
- `server/utils/user-auth.ts` — `getAuthenticatedUserId(event)` → cookie-based, returns `'owner'` or `null` (synchronous)
- `server/utils/model-definitions.ts` — `getModelDefinition(id, db)`, `getEnabledModelDefinitions(db)`
- `server/utils/image-generation.ts` — `generateCharacterImage(prompt, context, db)` (db required)
- `server/utils/place-generator.ts` — AI place generation, saves to D1
- `server/rpg/state/game-state.ts` — load/save game state from D1
- `server/rpg/handlers/characters.ts` — RPG NPC generation + conversation state
- `server/api/rpg.ts` — main RPG command handler (also handles DELETE for game reset)

## Auth
- Server: `getAuthenticatedUserId(event)` from `server/utils/user-auth.ts` — checks `admin-session` cookie
- Client: `useAuth()` composable fetches `/api/admin/auth/check`
- Middleware: `middleware/owner-auth.ts` checks admin cookie via API
- No Firebase Auth, no Google Sign-In — admin password login only

## RPG Page (pages/rpg/index.vue)
- UI state (messages, commandHistory, lastCoordinates) stored in localStorage under key `rpg_ui_state`
- Location updated from API response `data.gameState.coordinates` and `data.gameState.currentPlace`
- Reset: `DELETE /api/rpg` + clear localStorage

## wrangler.toml
- `database_id` field contains placeholder `REPLACE_WITH_GENERATED_DATABASE_ID`
- Must run `wrangler d1 create phareim-rpg` and update with real ID before deploying
- R2 bucket: `phareim-assets` (bound as `BUCKET`)

## Dev Server
- `npm run dev` runs nuxt dev (no Cloudflare bindings)
- For testing with D1: use `wrangler pages dev .output/public --d1=DB --r2=BUCKET`
- Build: `NITRO_PRESET=cloudflare-pages npx nuxt build`

## Image URLs
- New images: `https://assets.phareim.no/{key}` (R2 public domain)
- Old hardcoded characters still use `firebasestorage.googleapis.com` URLs (static, still work)
