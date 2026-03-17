# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Notes
See `AGENTS-NOTES.md` for observations, learnings, and repository-specific insights. Update it with notable findings to help future work in this codebase.

## Common Commands

### Development
- `npm run dev` - Start development server with host option
- `npm run build` - Build the application for production
- `npm run generate` - Generate static site
- `npm run preview` - Preview the built application

### Project Setup
- `npm install` - Install dependencies
- `npm run postinstall` - Prepare Nuxt (runs automatically after install)

## Architecture Overview

This is a **Nuxt 3** personal website with multiple interactive features:

### Core Structure
- **Frontend**: Vue.js with Nuxt 3 framework using Composition API and Options API patterns
- **Backend**: Nuxt server API routes in `server/api/`, deployed as Cloudflare Pages Functions
- **Database**: Cloudflare D1 (SQLite) for persistent data storage (`phareim-rpg`)
- **Object Storage**: Cloudflare R2 (`phareim-assets`) + legacy Firebase Storage URLs for some media
- **Hosting**: Cloudflare Pages (built with `NITRO_PRESET=cloudflare-pages`)
- **Styling**: CSS custom properties design system with 3 themes (Scandinavian Glass, Cyberpunk, Space)
- **State Management**: Pinia for client-side state

### Key Features & Architecture

#### 1. Blog System (`server/api/blog.ts`, `blog/` directory)
- Markdown-based blog posts with front matter support
- File-based content management in `/blog` directory
- Automatic parsing of YAML front matter and date extraction from filenames
- Server-side rendering of markdown to HTML using markdown-it

#### 2. Text-Based RPG Game
- **State Management**: D1-persisted game state in `server/rpg/state/game-state.ts`
- **AI Integration**: Venice AI API (OpenAI-compatible) for dynamic responses
- **Command System**: Text-based commands processed in `server/api/rpg.ts`
- **Game Logic**: Modular handlers in `server/rpg/handlers/` for movement, AI responses, items, and places
- **Types**: Shared TypeScript interfaces in `types/` directory

#### 3. AI-Powered Content Generation
- **Image Generation**: FAL AI integration for image-to-image processing
- **Text Generation**: Multiple AI APIs (Venice AI, OpenAI) for dynamic content
- **Place/Item Generation**: Procedural generation using AI for RPG content

### Environment Configuration
- Runtime config in `nuxt.config.ts` handles server-side secrets (overridden at runtime by `NUXT_`-prefixed env vars on Cloudflare)
- Cloudflare bindings (D1, R2) configured in `wrangler.toml`, accessed via `event.context.cloudflare.env`
- D1 helper in `server/utils/db.ts` (`getDB(event)`)
- Multiple API keys: VENICE_KEY, FAL_KEY, WAVESPEED_KEY, OPENAI_API_KEY

### Theme System
- **3 themes**: Scandinavian Glass (default), Cyberpunk/Hacker, Space
- **Theme files**: `assets/themes/scandinavian.css`, `hacker.css`, `space.css`
- **Semantic variables**: All themes expose a shared `--theme-*` CSS custom property API (e.g. `--theme-bg`, `--theme-text`, `--theme-card-bg`, `--theme-rpg-item`)
- **Composable**: `composables/useTheme.ts` provides `activeTheme`, `themePageClass`, `cx()` helper, `setTheme()` with localStorage persistence
- **Root wiring**: `app.vue` applies `themePageClass` to root div, cascading `--theme-*` vars to all pages/components
- **Theme switcher**: Available in the global menu on every page
- **Convention**: Use `var(--theme-*, fallback)` in scoped CSS instead of hardcoded colors

### Component Architecture
- **Global Components**: MenuComponent with keyboard shortcut (M key) for navigation and theme switcher
- **RPG Components**: Specialized UI components in `components/rpg/` for game interface
- **Reusable Components**: ProfileCard, SocialLink for common UI patterns

### API Structure
- RESTful endpoints in `server/api/` following Nuxt conventions
- Nested routing for resource collections (blogposts, items, places, characters)
- Cloudflare D1 for server-side database operations (via `getDB(event)`)
- Database schema in `database/schema.sql`, applied during CI deploy
- Error handling with H3 utilities (createError, defineEventHandler)

### File-Based Routing
- Pages in `pages/` directory following Nuxt file-based routing
- Nested routes for blog (`pages/blog/`) and RPG (`pages/rpg/`)
- Draft pages in `pages/drafts/` for experimental features

### Key Technical Patterns
- **Server Utilities**: D1 helper in `server/utils/db.ts`, AI/image utils in `server/utils/`
- **Type Safety**: Comprehensive TypeScript interfaces for all major features
- **Error Handling**: Consistent error responses across API endpoints
- **Client-Server Communication**: H3 event handlers with proper request/response typing

### Deployment
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`) on push to `master`
- **Build**: `nuxt build` with `NITRO_PRESET=cloudflare-pages`
- **Deploy**: `wrangler pages deploy` to Cloudflare Pages
- **D1 schema**: Applied via `wrangler d1 execute` during deploy
- **Post-deploy**: Push notification sent to Sleeper Chat

### Mobile Responsiveness
- Viewport meta configuration prevents zooming on mobile
- Responsive design considerations throughout the codebase

### Global Keyboard Shortcuts
- 'M' key toggles main menu (disabled on RPG and image-generator pages)
- Body scroll control based on page context