import { defineEventHandler, getQuery } from 'h3'

// Statisk liste over tilgjengelige sider
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
  { path: 'https://dot.phareim.no', title: 'Red dot game', icon: '🔴', external: true },
 // { path: 'https://librarian.phareim.no', title: 'The Librarian', icon: '📚', external: true },
  { path: 'https://reader.phareim.no', title: 'RSS Reader', icon: '📰', external: true }
]

export default defineEventHandler(async (event: any) => {
  const query = getQuery(event)
  const titleQuery = query.title;

  if (typeof titleQuery === 'string') {
    return menuItems.filter(item => item.title.toLowerCase().includes(titleQuery.toLowerCase()));
  }

  return menuItems;
})
