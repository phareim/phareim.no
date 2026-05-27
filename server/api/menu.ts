import { defineEventHandler, getQuery, setResponseHeader } from 'h3'

const menuItems = [
  { path: '/', title: 'Home', icon: '🏚️' },
  { path: '/about', title: 'About', icon: '👤' },
  { path: '/projects', title: 'Projects', icon: '🔧' },
  { path: '/feed', title: 'Thoughts', icon: '💬' },
  { path: '/now', title: 'Now', icon: '📍' },
  { path: '/uses', title: 'Uses', icon: '🔩' },
  { path: '/guestbook', title: 'Guestbook', icon: '✍️' },
  { path: '/activity', title: 'Activity', icon: '📡' },
  { path: '/stats', title: 'Stats', icon: '📊' },
  { path: '/meta', title: 'Meta', icon: '📋' },
  { path: '/colophon', title: 'Colophon', icon: '📖' },
  { path: '/playground', title: 'Playground', icon: '✦' },
  { path: '/gallery', title: 'Gallery', icon: '🖼️' },
  { path: '/clock', title: 'Clock', icon: '🕐' },
  { path: '/lab', title: 'Lab', icon: '🧪' },
  { path: '/focus', title: 'Focus', icon: '⏱' },
  { path: '/terminal', title: 'Terminal', icon: '>' },
  { path: '/morse', title: 'Morse', icon: '·−' },
  { path: '/launch', title: 'Launch', icon: '🚀' },
  { path: 'https://dot.phareim.no', title: 'Red dot game', icon: '🔴', external: true },
  { path: 'https://reader.phareim.no', title: 'RSS Reader', icon: '📰', external: true },
  { path: 'https://blue.phareim.no', title: 'Blue', icon: '🔵', external: true },
]

// Menu items are static — cache at the CDN edge for 1 hour
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')

  const query = getQuery(event)
  const titleQuery = query.title

  if (typeof titleQuery === 'string') {
    return menuItems.filter(item => item.title.toLowerCase().includes(titleQuery.toLowerCase()))
  }

  return menuItems
})
