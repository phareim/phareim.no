# Project Memory

## Architecture
- Nuxt 3 personal website deployed on Cloudflare Pages
- Database: Cloudflare D1 (`phareim-rpg`), storage: Cloudflare R2 (`phareim-assets`)
- No auth system — removed, will be reimplemented from scratch

## D1 Tables
- `model_definitions` — AI model configs for image generation (only table used by current code)
- The live database still holds tables from removed features (RPG, gallery, prompts) — their DDL lives in git history

## Dev
- `npm run dev` — no Cloudflare bindings locally
- For D1/R2 testing: `wrangler pages dev .output/public --d1=DB --r2=BUCKET`

## Image URLs
- New images: `https://assets.phareim.no/{key}` (R2)
- Some legacy media still uses `firebasestorage.googleapis.com` URLs
