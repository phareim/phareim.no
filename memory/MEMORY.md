# Project Memory

## Architecture
- Nuxt 3 personal website deployed on Cloudflare Pages
- Database: Cloudflare D1 (`phareim-rpg`), storage: Cloudflare R2 (`phareim-assets`)
- No auth system — removed, will be reimplemented from scratch

## D1 Tables
- `game_states` — RPG player state
- `places` — RPG world locations
- `items` — RPG items
- `characters` — RPG NPCs
- `model_definitions` — AI model configs for image generation

## RPG
- Main handler: `server/api/rpg.ts` (GET/POST/DELETE)
- Game state: `server/rpg/state/game-state.ts` (D1-persisted)
- Handlers: `server/rpg/handlers/` (movement, AI, items, places, characters)
- UI state in localStorage under key `rpg_ui_state`
- Reset: `DELETE /api/rpg` + clear localStorage

## Dev
- `npm run dev` — no Cloudflare bindings locally
- For D1/R2 testing: `wrangler pages dev .output/public --d1=DB --r2=BUCKET`

## Image URLs
- New images: `https://assets.phareim.no/{key}` (R2)
- Some legacy media still uses `firebasestorage.googleapis.com` URLs
