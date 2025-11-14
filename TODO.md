# Image Generation TODOs

- [ ] Serve all UI model pickers from the Firestore-backed `/api/model-definitions` endpoint so the list stays synchronized with the seeding scripts.
- [ ] Extract a shared Firebase Storage upload helper (e.g., `server/utils/storage.ts`) and replace the duplicate logic in `server/api/generate-image.ts` and `server/api/characters/generate-image.ts`.
- [ ] Wrap fal.ai and Venice calls in reusable service functions to unify safety settings, logging, and retries across `server/api/generate-image.ts`, `server/api/image-to-image.ts`, `server/api/generate-krea-image.ts`, and `server/utils/image-generation.ts`.
- [ ] Switch `generateWithVeniceAI` to read `veniceKey` from Nuxt runtime config (or pass it in) instead of `process.env.VENICE_AI_API_KEY` so deployments only manage a single secret name.
