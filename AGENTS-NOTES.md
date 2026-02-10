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
- Nuxt 3 project with Firebase Firestore backend
- Multiple AI integrations (Venice AI, FAL AI, OpenAI)
- Runtime config managed through `nuxt.config.ts` with environment variables

### Key Dependencies
- Node.js and npm for package management
- Firebase Admin SDK for server-side operations
- markdown-it for blog post rendering
- Pinia for client-side state management

### Special Considerations
- RPG game state persists in Firebase
- Server-side API routes in `server/api/` directory
- TypeScript interfaces defined in `types/` directory
- Blog posts stored as markdown files in `blog/` directory

## Useful Insights

### Development Workflow
- [Add insights about effective development workflows]

### Testing Observations
- No automated test suite currently committed
- Manual QA needed for changes (admin auth, blog rendering, RPG interactions)

### Deployment Notes
- [Add deployment-specific observations]

## Future Recommendations
- [Suggest improvements or areas to watch]

---

**Last Updated**: 2026-02-10
**Note**: Update this file whenever you discover something noteworthy while working in the repository.
