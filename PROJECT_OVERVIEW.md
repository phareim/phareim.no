# Project Overview

## 1. Project summary
- **Framework & tooling:** Nuxt 3 SPA using Vue 3, Tailwind CSS, Pinia, and TypeScript. The repo already includes `node_modules/` so it can run immediately.
- **Hosting model:** Nuxt server routes under `server/api`. Runtime secrets (Venice, OpenAI, Firebase, Fal.ai, admin password) are injected via environment variables declared in `nuxt.config.ts`.
- **Data layer:** Firebase Firestore and Storage power nearly all persistence. Client-side code uses a lightweight Firebase plugin; server routes rely on Firebase Admin SDK.

## 2. Front-end structure
- `app.vue`: Wraps every page with a hamburger menu and intercepts the `m` key (disabled on admin/RPG/image pages).
- `components/`: General UI widgets (`ProfileCard`, `SocialLink`, `AdminSidebar`) plus RPG-specific components (`TextWindow`, `InlineItem`, etc.) that render and interact with inline entities.
- `pages/index.vue`: Personal landing page featuring an animated canvas, flippable profile card, and social links.
- `pages/blog/`: Blog index/detail views fetching Markdown posts through `/api/blog`. A “new post” form exists, but the writing API intentionally returns 410 to enforce filesystem-backed content.
- `pages/drafts/`: Experimental playground (random facts, AI art tools, weather demos, character viewer/editor, mini games).
- `pages/rpg/index.vue`: Full-screen terminal UI for a text-based RPG, synchronizing state with Firestore and parsing inline interactions.
- `pages/admin/**`: Admin dashboard guarded by `middleware/admin-auth.ts`; surfaces stats, model management, and test-image generation.
- Styling favors glassmorphism with responsive, dark-mode-aware layouts, especially on RPG and admin screens.

## 3. Server/API layer highlights
- **Blog endpoints (`server/api/blog*.ts`, `blog/`):** Convert Markdown to HTML, serve metadata and excerpts, and purposely disable write operations.
- **Image generation (`generate-image.ts`, `image-to-image.ts`):** Route prompts to Fal.ai or Venice AI based on saved model definitions, then upload results to Firebase Storage.
- **Character suite (`server/api/characters/*`):** Firestore-backed CRUD, GPT-generated character bios, portrait generation, and emoji prompt helpers.
- **Emoji prompts (`emoji-prompts/`):** Manage emoji-to-prompt mappings for richer image requests.
- **RPG engine (`server/api/rpg.ts`, `server/rpg/*`):** Firestore-backed world generation, movement handling, and LLM-driven narration (Venice-hosted `llama-3.3-70b`).
- **Procedural place/item generation:** Context-aware prompts for Venice/OpenAI and persistence to Firestore.
- **Misc:** Random facts (`gpt-5-nano`), intentionally bad poems (`gpt-5-mini`), static menu data, and admin authentication/model utilities.

## 4. Shared types & helpers
- Types for characters, items, places, and game state live under `types/` for shared client/server contracts.
- Prompt builders and curated lists for character classes, settings, and styles reside in `server/utils/character-*.ts`.
- `utils/api-client.ts` offers a typed fetch wrapper for browser-side entry points (notably the RPG page).

## 5. Admin model management
- “Model definitions” in Firestore describe each AI image provider (prompt scaffolding, parameters, supported styles, priority).
- Admin UI allows toggling, editing, and test-generating models via `/api/admin/*` routes.
- Scripts in `scripts/` populate/migrate these definitions (`populate-model-definitions.ts`, `populate-venice-models.ts`, `migrate-image-prompts.ts`).

## 6. Documentation & spec
- `CHARACTER_IMAGE_SERVICE.md`: End-to-end guide for the character image service.
- `openapi.yaml`: OpenAPI spec covering RPG, place, item, and blog endpoints with JSON schemas.

## 7. Environment requirements
- `.env` must supply Firebase Admin credentials (`FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, etc.), Firebase client keys, Venice AI tokens, OpenAI API key, Fal.ai key, and an `ADMIN_PASSWORD`.
- Missing variables cause early failures for admin routes, AI generation, or Firebase connectivity.

## 8. Running the project
- Standard Nuxt commands (`npm run dev`, `build`, `generate`, etc.).
- `postinstall` executes `nuxt prepare`.
- No pre-commit hooks are configured beyond Nuxt/Vite defaults.

## TL;DR
A Nuxt 3 personal site that doubles as an AI experimentation sandbox: Markdown-backed blogging, a suite of draft demos, an LLM-driven text RPG with persistent world state, and an admin console for tuning AI image models. The backend relies on Nuxt server routes glued to Firebase and third-party AI providers, with prompt/style metadata centralized to streamline experimentation.