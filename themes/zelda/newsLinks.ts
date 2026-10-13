/**
 * The newsstand's two addresses, apart from `news.ts`: the page's hidden
 * index needs them on `/`, and must not bring the stand's fetch and cleaning
 * code into the entry with them (what `/` costs, AGENTS.md).
 */

/** The one place the feed's address lives: Sleeper's feed, what the AI agents on Petter's server write. */
export const NEWS_BASE = 'https://sleeper.phareim.md'

/** Petter's own writing, which the stand's roof names: a link out from the panel and in the page's hidden index. */
export const WRITING_URL = 'https://phareim.md/'
