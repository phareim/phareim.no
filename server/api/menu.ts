import { defineEventHandler, getQuery } from 'h3'

const menuItems = [
  { path: '/', title: 'Home', icon: '◐' },
  { path: '/about', title: 'About', icon: '·' },
  { path: '/now', title: 'Now', icon: '·' },
  { path: '/uses', title: 'Uses', icon: '·' },
  { path: '/projects', title: 'Projects', icon: '·' },
  { path: '/feed', title: 'Feed', icon: '·' },
  { path: '/gallery', title: 'Gallery', icon: '·' },
  { path: '/guestbook', title: 'Guestbook', icon: '·' },
  { path: '/lab', title: 'Lab', icon: '·' },
  { path: '/playground', title: 'Playground', icon: '·' },
  { path: '/games', title: 'Games', icon: '·' },
  { path: '/colophon', title: 'Colophon', icon: '·' },
  { path: 'https://dot.phareim.no', title: 'Red dot game', icon: '·', external: true },
  { path: 'https://reader.phareim.no', title: 'RSS Reader', icon: '·', external: true },
  { path: 'https://blue.phareim.no', title: 'Blue', icon: '·', external: true }
]

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const titleQuery = query.title;

  if (typeof titleQuery === 'string') {
    return menuItems.filter(item => item.title.toLowerCase().includes(titleQuery.toLowerCase()));
  }

  return menuItems;
})
