import { NORWAY_ONLY_THEMES, norwayOk } from '../utils/norway'

// The door for the children's games (server/utils/norway.ts): a direct link
// to their theme and Mini World's neighbourhood API answer 403 outside Norway.
// The page itself also learns the answer (plugins/norway.server.ts), so a
// cabinet opened from the portal shows the same notice.
export default defineEventHandler((event) => {
  const ok = norwayOk(event)
  event.context.norwayOk = ok
  if (ok) return
  const path = event.path.split('?')[0]
  if (path.startsWith('/api/mw/')) {
    setResponseStatus(event, 403)
    return { error: 'only open in Norway' }
  }
  const theme = getQuery(event).theme
  if (path === '/' && typeof theme === 'string' && NORWAY_ONLY_THEMES.includes(theme)) {
    setResponseStatus(event, 403)
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    setResponseHeader(event, 'cache-control', 'no-store')
    return '<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>phareim.no</title>'
      + '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0616;color:#f4e9ff;font:18px/1.5 system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}a{color:#ff8fb8}</style></head>'
      + '<body><main><p>Dette spillet er bare åpent i Norge.</p><p lang="en">This game is only open in Norway.</p><p><a href="/">phareim.no</a></p></main></body></html>'
  }
})
