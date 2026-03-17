# Agent Notes

This file captures observations, learnings, and notable details discovered while working in this repository. It serves as a living document to improve agent effectiveness over time.

## What Went Well

### Successful Patterns
- Theme system uses semantic `--theme-*` CSS custom properties as an abstraction layer. Each theme file maps these to its own aesthetic. Components only reference `--theme-*` vars, never theme-specific vars directly.
- Always include fallback values in `var()` calls (e.g. `var(--theme-text, #333)`) so pages still render if the theme class is missing.
- `useTheme().cx(suffix)` returns `${activeTheme}-${suffix}` for applying theme-prefixed class names (e.g. `cx('card')` returns `scandi-card`).

### Effective Commands
- `npm run build` catches most issues quickly (type errors, missing imports, CSS problems)

### Good Architectural Decisions
- Keeping theme CSS variables on `.{theme}-page` class (not `:root`) means themes can coexist and the active theme is controlled by a single class on the root div
- localStorage persistence for theme choice with SSR-safe `import.meta.client` guard
- RPG-specific theme variables (`--theme-rpg-*`) allow the terminal to adapt per theme while keeping the RPG code clean

## Issues and Gotchas

### Known Problems
- [Track issues that agents commonly encounter]

### Workarounds
- [Document workarounds for known issues]

### Common Mistakes to Avoid
- Don't use `@media (prefers-color-scheme: dark)` blocks - the theme system handles light/dark natively
- Don't hardcode colors in scoped CSS; use `var(--theme-*, fallback)` instead
- Don't put theme variables in `:root` - they belong inside `.{theme}-page` selectors so they cascade correctly
- TailwindCSS was removed - don't add it back or use Tailwind utility classes

## Repository-Specific Details

### Environment Setup
- Nuxt 3 project deployed on Cloudflare Pages
- Database: Cloudflare D1 (SQLite), accessed via `server/utils/db.ts`
- Object storage: Cloudflare R2 (some legacy media still on Firebase Storage)
- Multiple AI integrations (Venice AI, FAL AI, OpenAI, WaveSpeed)
- Runtime config managed through `nuxt.config.ts`, overridden by `NUXT_`-prefixed env vars on Cloudflare

### Key Dependencies
- Node.js and npm for package management
- Cloudflare D1 for server-side database operations
- markdown-it for blog post rendering
- Pinia for client-side state management

### Special Considerations
- RPG game state persists in Cloudflare D1
- Server-side API routes in `server/api/` directory
- TypeScript interfaces defined in `types/` directory
- Blog posts stored as markdown files in `blog/` directory
- D1 database schema lives in `database/schema.sql`

## Useful Insights

### Development Workflow
- [Add insights about effective development workflows]

### Testing Observations
- No automated test suite currently committed
- Manual QA needed for changes (admin auth, blog rendering, RPG interactions)

### Deployment Notes
- Deployed to Cloudflare Pages via GitHub Actions on push to `master`
- D1 schema applied during CI before deploy (`wrangler d1 execute`)
- Post-deploy notification sent to Sleeper Chat

## Future Recommendations
- [Suggest improvements or areas to watch]

---

**Last Updated**: 2026-03-17
**Note**: Update this file whenever you discover something noteworthy while working in the repository.
