# phareim.no

Personal website built with Nuxt 3, deployed on Cloudflare Pages.

## Features

- **Text RPG** — AI-driven text adventure with procedural world generation, persistent state, and NPC conversations (Venice AI)
- **Theme system** — Three switchable themes: Scandinavian Glass, Cyberpunk, Space

## Tech

- Nuxt 3 / Vue 3 / TypeScript
- Cloudflare Pages + D1 (SQLite) + R2 (object storage)
- Venice AI, FAL AI, OpenAI, Wavespeed for generative features
- GitHub Actions CI/CD on push to `master`

## Development

```bash
npm install
npm run dev      # http://localhost:3030
npm run build    # production build
```
