/**
 * The feedback service's base address (docs/games/neon-shrine-feedback.md): Sleeper's, or in development the fake on
 * this machine (`scripts/zelda-lab/feedback-fake.mjs`). A build-time choice, so the production build holds one only.
 */
export const FEEDBACK_BASE = import.meta.dev ? 'http://' + location.hostname + ':3957' : 'https://sleeper.phareim.no/feedback'
