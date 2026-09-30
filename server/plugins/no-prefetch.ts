// No prefetch hints in the HTML (2026-09-30).
//
// The client manifest marks every async chunk `prefetch`, and the renderer
// turns each into a `<link rel="prefetch">` in every response — 21 of them,
// 465 KB brotli, for a page that renders one line of text and a canvas. On a
// phone they compete with the blocking entry chunk for the same pipe: measured
// on a 4x-throttled CPU at 1.6 Mbps, first contentful paint on `/` went from
// 6,676 ms to 3,708 ms with the hints blocked, a 44% win.
//
// They are also useless here. There is one route, and how you leave it is a
// walk around a town to a cabinet, not a link click — by the time anyone opens
// Star Fox, the prefetch is minutes stale. Most visitors never open a 3D game
// at all, so they were downloading three.js (142 KB) on idle for nothing.
//
// The `preload`/`modulepreload` links are left alone: those are the entry chunk
// and its stylesheet, which really are needed to paint.
//
// `html.head` is a one-element array holding the whole head as a single string,
// so this rewrites that string in place. Filtering the array instead would drop
// the entire head — styles, title and all — because the string merely *contains*
// a prefetch tag.
const PREFETCH_LINK = /[ \t]*<link\b[^>]*\brel="prefetch"[^>]*>\n?/g

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html) => {
    if (!Array.isArray(html.head)) return
    html.head = html.head.map((chunk) =>
      typeof chunk === 'string' ? chunk.replace(PREFETCH_LINK, '') : chunk,
    )
  })
})
