// The newsstand on the coast reads Sleeper's feed (sleeper.phareim.md)
// through themes/zelda/news.ts. A fake fetch plays the site, so nothing here
// touches the network: the rack, one piece, the site down or lying, what the
// cleaner lets through of another site's HTML, and that the shell opens the
// panel on the engine's event without the reader weighing on the entry.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

let N
before(async () => {
  const out = esbuild.buildSync({
    entryPoints: [join(root, 'themes/zelda/news.ts')],
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  N = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

/** A fake fetch: records each call and answers with `reply(url, init)`. */
function fake(reply) {
  const calls = []
  const f = async (url, init) => {
    calls.push({ url, init })
    return reply(url, init)
  }
  return { f, calls }
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const SITE = 'https://sleeper.phareim.md'
const ENTRY = { slug: 'neon-shrine', title: 'Slik ble Neon Shrine til', date: '2026-09-23', byline: 'Claude (Opus 5.5)', summary: 'Fem utgaver på én uke.', url: `${SITE}/neon-shrine/`, reader: `${SITE}/reader/neon-shrine.json` }
const INDEX = { version: 1, title: 'sleeper.phareim.md', tagline: 'Skrevet av AI-agentene.', url: `${SITE}/`, articles: [ENTRY, { ...ENTRY, slug: 'radio-motoren', title: 'Motoren', url: `${SITE}/radio-motoren/` }] }
const PIECE = { version: 1, ...ENTRY, html: '<p>Hei<sup>1</sup> og «hallo».</p>', notes: ['En <a href="https://example.com/x">kilde</a>.'] }

describe('newsstand: sleeper.phareim.md', () => {
  it('keeps the feed\'s address in one constant', () => {
    assert.equal(N.NEWS_BASE, SITE)
    assert.equal(N.WRITING_URL, 'https://phareim.md/')
    for (const file of ['themes/zelda/NewsStand.vue', 'themes/zelda/Zelda.vue', 'themes/portal/Landing.vue', 'themes/zelda/world/overworld.ts']) {
      const src = readFileSync(join(root, file), 'utf8')
      assert.doesNotMatch(src, /https:\/\/(sleeper\.)?phareim\.md/, `${file} has the address written out`)
    }
  })

  it('asks for the rack without a cookie, and reads it newest first as it came', async () => {
    const { f, calls } = fake(() => json(INDEX))
    const got = await N.fetchIndex(f)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, `${SITE}/reader/index.json`)
    assert.equal(calls[0].init.method, 'GET')
    assert.equal(calls[0].init.credentials, 'omit')
    assert.deepEqual(got.map(a => a.slug), ['neon-shrine', 'radio-motoren'])
    assert.deepEqual(got[0], { slug: 'neon-shrine', title: ENTRY.title, date: ENTRY.date, byline: ENTRY.byline, summary: ENTRY.summary, url: ENTRY.url })
  })

  it('leaves out entries that are not the contract, and keeps an article\'s address on the feed\'s own site', async () => {
    const odd = { version: 1, articles: [
      ENTRY,
      { ...ENTRY, slug: '../../etc' },
      { ...ENTRY, slug: 'a', date: 'yesterday' },
      { ...ENTRY, slug: 'b', title: '' },
      null, 'x', 7,
      { ...ENTRY, slug: 'elsewhere', url: 'https://example.com/elsewhere/' },
      { slug: 'bare', title: 'Bare', date: '2026-01-02' },
    ] }
    const got = await N.fetchIndex(fake(() => json(odd)).f)
    assert.deepEqual(got.map(a => a.slug), ['neon-shrine', 'elsewhere', 'bare'])
    assert.equal(got[1].url, `${SITE}/elsewhere/`)
    assert.deepEqual(got[2], { slug: 'bare', title: 'Bare', date: '2026-01-02', byline: '', summary: '', url: `${SITE}/bare/` })
  })

  it('calls it no answer when the site refuses, fails, lies or never answers', async () => {
    for (const reply of [
      () => { throw new TypeError('Failed to fetch') },
      () => json({ error: 'x' }, 500),
      () => json(INDEX, 404),
      () => new Response('<html>', { status: 200 }),
      () => json({ version: 2, articles: [] }),
      () => json({ version: 1, articles: 'none' }),
      () => json([INDEX]),
      () => json(null),
    ]) {
      assert.equal(await N.fetchIndex(fake(reply).f), null)
      assert.equal(await N.fetchArticle('neon-shrine', fake(reply).f), null)
    }
    // A site that never answers is given up on.
    const hang = (url, init) => new Promise((_, no) => init.signal.addEventListener('abort', () => no(new Error('aborted'))))
    assert.equal(await N.fetchIndex(hang, SITE, 20), null)
    assert.equal(await N.fetchArticle('neon-shrine', hang, SITE, 20), null)
  })

  it('fetches one piece from an address it builds itself, and only the piece it asked for', async () => {
    const { f, calls } = fake(() => json(PIECE))
    const a = await N.fetchArticle('neon-shrine', f)
    assert.equal(calls[0].url, `${SITE}/reader/neon-shrine.json`)
    assert.equal(calls[0].init.credentials, 'omit')
    assert.equal(a.title, ENTRY.title)
    assert.equal(a.html, '<p>Hei<sup>1</sup> og «hallo».</p>')
    assert.deepEqual(a.notes, ['En <a href="https://example.com/x" target="_blank" rel="noopener">kilde</a>.'])
    // A slug that is no slug never becomes a request; another piece's body is no answer.
    for (const bad of ['', '../index', 'a/b', 'a b', 'x'.repeat(200), 'neon-shrine.json?x=1']) {
      const bf = fake(() => json(PIECE))
      assert.equal(await N.fetchArticle(bad, bf.f), null)
      assert.equal(bf.calls.length, 0, `asked for ${JSON.stringify(bad)}`)
    }
    assert.equal(await N.fetchArticle('radio-motoren', fake(() => json(PIECE)).f), null)
    assert.equal(await N.fetchArticle('neon-shrine', fake(() => json({ ...PIECE, html: '' })).f), null)
    assert.deepEqual((await N.fetchArticle('neon-shrine', fake(() => json({ ...PIECE, notes: undefined })).f)).notes, [])
  })

  it('writes the article\'s own markup out again, classes prefixed', () => {
    const c = N.cleanHtml
    assert.equal(c('<h2>Én melding</h2><p>Tekst med <em>kursiv</em>, <strong>fet</strong> og <code>kode</code>.</p>'), '<h2>Én melding</h2><p>Tekst med <em>kursiv</em>, <strong>fet</strong> og <code>kode</code>.</p>')
    assert.equal(c('<p class="byline-note">Skrevet av Claude.</p>'), '<p class="n-byline-note">Skrevet av Claude.</p>')
    assert.equal(c('<div class="figs four pixel"><figure class="wide"><img src="https://sleeper.phareim.md/img/a.webp" width="800" height="600" alt="Et «rom»"><figcaption>Fase 1</figcaption></figure></div>'),
      '<div class="n-figs n-four n-pixel"><figure class="n-wide"><img src="https://sleeper.phareim.md/img/a.webp" alt="Et «rom»" width="800" height="600" loading="lazy" decoding="async"><figcaption>Fase 1</figcaption></figure></div>')
    assert.equal(c('<pre><code class="language-ts">const a = b &lt; c &amp;&amp; d\n</code></pre>'), '<pre><code class="n-language-ts">const a = b &lt; c &amp;&amp; d\n</code></pre>')
    assert.equal(c('<a href="https://github.com/phareim/phareim.no/commit/0bfbec6?a=1&amp;b=2">commit</a>'), '<a href="https://github.com/phareim/phareim.no/commit/0bfbec6?a=1&amp;b=2" target="_blank" rel="noopener">commit</a>')
    assert.equal(c('<table><thead><tr><th colspan="2">A</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'), '<table><thead><tr><th colspan="2">A</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>')
    assert.equal(c('<aside class="live">Kodecelle. <a href="https://sleeper.phareim.md/radio-motoren/">Kjør den i artikkelen.</a></aside>'), '<aside class="n-live">Kodecelle. <a href="https://sleeper.phareim.md/radio-motoren/" target="_blank" rel="noopener">Kjør den i artikkelen.</a></aside>')
    assert.equal(c('a < b og c > d'), 'a &lt; b og c &gt; d')
  })

  it('lets nothing through that can run, load or dress up as this site', () => {
    const c = N.cleanHtml
    assert.equal(c('<p>før</p><script>alert(1)</script><p>etter</p>'), '<p>før</p><p>etter</p>')
    assert.equal(c('<script type="module" src="/lab/radio.js"></script>'), '')
    assert.equal(c('<style>p{display:none}</style>x'), 'x')
    assert.equal(c('<iframe src="https://example.com"></iframe>x<object data="x"></object>y<svg><a href="javascript:1">z</a></svg>w'), 'xyw')
    assert.equal(c('<p onclick="alert(1)" style="position:fixed" id="nw-title">x</p>'), '<p>x</p>')
    assert.equal(c('<img src="https://x.test/a.png" onerror="alert(1)">'), '<img src="https://x.test/a.png" alt="" loading="lazy" decoding="async">')
    assert.equal(c('<img src=x onerror=alert(1)>'), '')
    assert.equal(c('<img src="http://x.test/a.png">'), '', 'a picture over http')
    assert.equal(c('<img src="data:image/svg+xml,<svg onload=alert(1)>">'), '')
    for (const href of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java&#x73;cript:alert(1)', 'javascript&colon;alert(1)', 'data:text/html,x', 'vbscript:x', '/relative', '//example.com/x', '']) {
      assert.equal(c(`<a href="${href}">tekst</a>`), 'tekst', href)
    }
    assert.equal(c('<a href="https://a.test/"><a href="https://b.test/">x</a></a>'), '<a href="https://a.test/" target="_blank" rel="noopener">x</a>')
    assert.equal(c('<a href="https://a.test/" target="_top" rel="opener" onclick="x()">x</a>'), '<a href="https://a.test/" target="_blank" rel="noopener">x</a>')
    assert.equal(c('<a href="https://a.test/&quot; onmouseover=&quot;x">x</a>'), '<a href="https://a.test/&quot; onmouseover=&quot;x" target="_blank" rel="noopener">x</a>')
    assert.equal(c('<p class="px-btn zelda-deck &quot;><script>">x</p>'), '<p class="n-px-btn n-zelda-deck">x</p>')
    assert.equal(c('<button>x</button><form><input name="a"></form><input value="y">z'), 'z')
    assert.equal(c('<!-- <script>alert(1)</script> -->x'), 'x')
    assert.equal(c('<scr<script>ipt>alert(1)</script>x'), 'ipt&gt;alert(1)x')
    assert.equal(c('<script>never closed <p>x</p>'), '')
    assert.equal(c('<p>x</p><div'), '<p>x</p>&lt;div')
    assert.equal(c('<h1>Tittel</h1><marquee>x</marquee><unknown-tag a="b">y</unknown-tag>'), 'Tittelxy')
    // Nothing the cleaner writes can hold a tag it did not write itself.
    const wild = c('<p title="</p><script>alert(1)</script>">x</p><a href=\'https://a.test/"><img src=x onerror=1>\'>y</a>')
    assert.doesNotMatch(wild, /<script|onerror=1>|<img/)
  })

  it('opens the panel in the shell on the engine\'s panel event, as its own chunk', () => {
    // The shell and the panel are Vue files; these checks read their source.
    const shell = readFileSync(join(root, 'themes/zelda/Zelda.vue'), 'utf8')
    assert.match(shell, /case 'panel': openPanel\(e\.id, e\.panel\)/)
    assert.match(shell, /<NewsStand v-if="panel === 'news'"/)
    assert.match(shell, /const NewsStand = defineAsyncComponent\(\(\) => import\('\.\/NewsStand\.vue'\)\)/)
    assert.doesNotMatch(shell, /import NewsStand from/, 'the reader must not be in the entry')
    const panel = readFileSync(join(root, 'themes/zelda/NewsStand.vue'), 'utf8')
    assert.match(panel, /fetchIndex\(f\)/)
    assert.match(panel, /fetchArticle\(slug, f\)/)
    assert.match(panel, /props\.fetcher \?\? fetch/)
    assert.match(panel, /v-html="article\.html"/)
    assert.match(panel, /NO CARRIER/)
    // What the feed sends is only ever shown as text or through the cleaner.
    assert.equal([...panel.matchAll(/v-html="([^"]+)"/g)].map(m => m[1]).join(), 'article.html,n')
    // The page's hidden index still names both sites, now that the stand is no link.
    const page = readFileSync(join(root, 'themes/portal/Landing.vue'), 'utf8')
    assert.match(page, /href: `\$\{NEWS_BASE\}\/`/)
    assert.match(page, /href: WRITING_URL/)
  })
})
