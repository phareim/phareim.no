/**
 * The newsstand's side of sleeper.phareim.md (the feed the AI agents on
 * Sleeper write; `~/github/phareim.md`). Framework-free, and `fetch` is
 * passed in, so the portal tests run it against a fake server and never touch
 * the network.
 *
 * Contract: `GET /reader/index.json` answers `{ version: 1, articles:
 * [{ slug, title, date, byline, summary, url }] }`, newest first (and the
 * feed's own title, tagline and address, which the stand does not use);
 * `GET /reader/<slug>.json` answers one of those entries plus `html`
 * (the body: absolute addresses, a footnote as `<sup>n</sup>`) and `notes`
 * (the footnotes, inline HTML, in order). The site allows any origin to read
 * `/reader/*`; no cookie goes along. Anything else (the site down, a body
 * that is not the contract) comes back as `null`, and the panel says NO
 * CARRIER and offers the link out.
 *
 * The HTML is another site's, so it never reaches the page as it came:
 * `cleanHtml` writes it out again from an allowlist of tags and attributes.
 */

/** The one place the feed's address lives. */
export const NEWS_BASE = 'https://sleeper.phareim.md'

/** Petter's own writing, which the stand's sign names: a link out from the panel and in the page's hidden index. */
export const WRITING_URL = 'https://phareim.md/'

/** A call that has not answered in this long counts as no answer. */
export const NEWS_TIMEOUT_MS = 8000

export interface NewsEntry {
  slug: string
  title: string
  /** YYYY-MM-DD */
  date: string
  byline: string
  summary: string
  /** The article on the site, for OPEN IN BROWSER. */
  url: string
}

export interface NewsArticle extends NewsEntry {
  /** The body, cleaned: safe to set as HTML. */
  html: string
  /** The footnotes, cleaned, in order: `<sup>n</sup>` in the body is `notes[n - 1]`. */
  notes: string[]
}

type Fetch = typeof fetch

const SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/** One entry as the contract has it, or null. The article's address must be on the feed's own site. */
function parseEntry(v: unknown, base: string): NewsEntry | null {
  const o = obj(v)
  if (!o) return null
  const slug = str(o.slug)
  const title = str(o.title)
  const date = str(o.date)
  if (!slug || !SLUG.test(slug) || !title || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const url = str(o.url)
  return {
    slug,
    title,
    date,
    byline: str(o.byline) ?? '',
    summary: str(o.summary) ?? '',
    url: url && url.startsWith(`${base}/`) ? url : `${base}/${slug}/`,
  }
}

/** The index body's articles as the contract has them, or null when the body is something else. Entries that are not the contract are left out. */
export function parseIndex(body: unknown, base = NEWS_BASE): NewsEntry[] | null {
  const o = obj(body)
  if (!o || o.version !== 1 || !Array.isArray(o.articles)) return null
  return o.articles.flatMap(a => parseEntry(a, base) ?? [])
}

/** One article's body as the contract has it, cleaned, or null. */
export function parseArticle(body: unknown, base = NEWS_BASE): NewsArticle | null {
  const o = obj(body)
  if (!o || o.version !== 1) return null
  const entry = parseEntry(o, base)
  const html = str(o.html)
  if (!entry || !html) return null
  const notes = Array.isArray(o.notes) ? o.notes.flatMap(n => (typeof n === 'string' ? [cleanHtml(n)] : [])) : []
  return { ...entry, html: cleanHtml(html), notes }
}

async function getJson(f: Fetch, url: string, timeoutMs: number): Promise<unknown> {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null
  try {
    const res = await f(url, { method: 'GET', headers: { accept: 'application/json' }, credentials: 'omit', signal: ctl?.signal })
    return res.ok ? await res.json() : null
  } catch {
    // No network, refused, timed out, or not JSON.
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** What the stand has on its rack, newest first. */
export async function fetchIndex(f: Fetch = fetch, base = NEWS_BASE, timeoutMs = NEWS_TIMEOUT_MS): Promise<NewsEntry[] | null> {
  return parseIndex(await getJson(f, `${base}/reader/index.json`, timeoutMs), base)
}

/** One article. The address is built here from the slug, never taken from the feed. */
export async function fetchArticle(slug: string, f: Fetch = fetch, base = NEWS_BASE, timeoutMs = NEWS_TIMEOUT_MS): Promise<NewsArticle | null> {
  if (!SLUG.test(slug)) return null
  const a = parseArticle(await getJson(f, `${base}/reader/${slug}.json`, timeoutMs), base)
  return a && a.slug === slug ? a : null
}

// ── Cleaning ────────────────────────────────────────────────────────────────

/** Tags that are written out again. Anything else loses its tag and keeps its text. */
const TAGS = new Set([
  'p', 'br', 'hr', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'img',
  'figure', 'figcaption', 'sup', 'sub', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span', 'aside', 'del', 'kbd',
])
/** Tags that go with everything inside them. */
const DROPPED = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'svg', 'math', 'noscript', 'form', 'select', 'textarea', 'button', 'head', 'title', 'audio', 'video', 'canvas'])
const VOID = new Set(['br', 'hr', 'img'])
/** Every class from the feed gets this in front, so none of them can be one of this site's. */
export const NEWS_CLASS_PREFIX = 'n-'

const TOKEN = /<!--[\s\S]*?-->|<(\/?)([A-Za-z][A-Za-z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g
const ATTR = /([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function escText(s: string): string {
  return s.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escAttr(s: string): string {
  return s.replace(/&(?![a-zA-Z#][a-zA-Z0-9]*;)/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** An address that starts with a literal `http(s)://`, or nothing: a scheme spelled with entities is no match. */
function httpUrl(raw: string, httpsOnly = false): string | null {
  const v = raw.trim()
  return (httpsOnly ? /^https:\/\//i : /^https?:\/\//i).test(v) ? v : null
}

function attrs(tag: string, raw: string): string {
  const got = new Map<string, string>()
  for (const m of raw.matchAll(ATTR)) {
    const name = m[1]!.toLowerCase()
    if (!got.has(name)) got.set(name, m[2] ?? m[3] ?? m[4] ?? '')
  }
  const out: string[] = []
  const cls = (got.get('class') ?? '').split(/\s+/).filter(c => /^[A-Za-z][A-Za-z0-9_-]*$/.test(c)).map(c => NEWS_CLASS_PREFIX + c)
  if (cls.length) out.push(`class="${cls.join(' ')}"`)
  if (tag === 'a') {
    const href = httpUrl(got.get('href') ?? '')
    // Without an address it is no link: the text stays, as a span.
    if (!href) return ''
    out.push(`href="${escAttr(href)}"`, 'target="_blank"', 'rel="noopener"')
  } else if (tag === 'img') {
    const src = httpUrl(got.get('src') ?? '', true)
    if (!src) return ''
    out.push(`src="${escAttr(src)}"`, `alt="${escAttr(got.get('alt') ?? '')}"`)
    for (const k of ['width', 'height']) {
      const v = got.get(k)
      if (v && /^\d{1,5}$/.test(v)) out.push(`${k}="${v}"`)
    }
    out.push('loading="lazy"', 'decoding="async"')
  } else if (tag === 'th' || tag === 'td') {
    for (const k of ['colspan', 'rowspan']) {
      const v = got.get(k)
      if (v && /^\d{1,2}$/.test(v)) out.push(`${k}="${v}"`)
    }
  }
  return out.length ? ' ' + out.join(' ') : ''
}

/**
 * Another site's HTML, written out again: only the tags in `TAGS`, only the
 * attributes named in `attrs`, links to http(s) in a new tab, pictures from
 * https. No tag text from the input is copied through; a `<` that starts no
 * tag becomes text. Scripts, styles, frames and their like go with all that
 * is in them.
 */
export function cleanHtml(html: string): string {
  let out = ''
  let last = 0
  /** The tag whose contents are being thrown away, and how deep in it we are. */
  let dropping: string | null = null
  let depth = 0
  /** One entry per open `<a>`: whether it was written out (a link without an address, or inside a link, is only its text). */
  const links: boolean[] = []
  TOKEN.lastIndex = 0
  for (let m = TOKEN.exec(html); m; m = TOKEN.exec(html)) {
    if (!dropping) out += escText(html.slice(last, m.index))
    last = m.index + m[0].length
    if (!m[2]) continue // a comment
    const tag = m[2].toLowerCase()
    const closing = m[1] === '/'
    if (dropping) {
      if (tag === dropping) { depth += closing ? -1 : 1; if (depth === 0) dropping = null }
      continue
    }
    if (DROPPED.has(tag)) { if (!closing) { dropping = tag; depth = 1 } continue }
    if (!TAGS.has(tag)) continue
    if (closing) {
      if (VOID.has(tag)) continue
      if (tag === 'a' && !links.pop()) continue
      out += `</${tag}>`
      continue
    }
    const a = attrs(tag, m[3] ?? '')
    if (tag === 'img' && !a) continue
    if (tag === 'a') {
      const written = a.includes(' href="') && !links.includes(true)
      links.push(written)
      if (!written) continue
    }
    out += `<${tag}${a}>`
  }
  if (!dropping) out += escText(html.slice(last))
  return out
}
