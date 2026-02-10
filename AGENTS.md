# Repository Guidelines

## Agent Notes
Refer to `AGENTS-NOTES.md` for a living document of observations, learnings, and repository-specific insights discovered while working in this codebase. Update it when you discover patterns that work well or issues to avoid.

## Project Structure & Module Organization
Nuxt 3 drives the stack. `app.vue` sets the global shell while route-specific views stay in `pages/` (blog, RPG, admin). Shared UI sits in `components/`, and cross-cutting logic in `composables/` and `utils/`. Server routes live under `server/api/**`, aided by Firestore helpers in `server/rpg` and `server/utils`. Domain contracts live in `types/`, markdown posts in `blog/`, static assets in `public/`, and supporting docs in `docs/` plus `PROJECT_OVERVIEW.md`. Maintenance and migration scripts stay in `scripts/`.

## Build, Test, and Development Commands
- `npm run dev`: Start Nuxt locally on port 3030 for live editing of pages, APIs, and Tailwind.
- `npm run build`: Create the production bundle and catch typing/bundler errors.
- `npm run preview`: Serve the built bundle to mimic deployment behavior.
- `npm run generate`: Emit a static export for CDN-style testing.
- `npm run populate-models` / `npm run populate-venice-models`: Seed or refresh Firestore model definitions once credentials are set and the target project is confirmed.

## Coding Style & Naming Conventions
Stick to TypeScript and `<script setup>` with two-space indentation. Components stay PascalCase (`ProfileCard.vue`), composables use the `useFoo` prefix, and server handlers mirror their HTTP path (`server/api/blog.get.ts`). Keep template props/events kebab-cased, lean on Tailwind utilities, and lift repeated data into `types/` or `utils/`. Define secrets only in `.env` and surface them through `runtimeConfig` in `nuxt.config.ts`.

## Testing Guidelines
No automated suite is committed yet, so treat every change as needing targeted coverage. When you introduce logic, add Vitest or Nuxt test-utils specs under `tests/` named `*.spec.ts`, favoring focused units to keep runs fast. Until CI exists, call out manual QA steps in your PR (admin auth, blog rendering, RPG interactions) and include the command you used (usually `npm run dev` plus the exercised route).

## Commit & Pull Request Guidelines
Recent commits are short, imperative, and often lowercase (“remove some logging”). Match that tone, keep subjects under ~50 characters, and use the body only for essential details. Each PR should summarize the change, link any issue, list verification steps (commands + outcomes), note migrations or script runs, and attach UI screenshots/GIFs when visuals move. Always state whether env vars or Firebase data need updates so reviewers can replicate safely.

## Security & Configuration Tips
Runtime config expects Venice, OpenAI, Fal, and Firebase keys; keep them in `.env` or platform secrets and confirm the Firebase project before running seeding or admin scripts.
