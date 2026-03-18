import { defineEventHandler, getQuery } from 'h3'

// Statisk liste over tilgjengelige sider
const menuItems = [
  { path: '/', title: 'Home', icon: '🏚️' },
  { path: '/rpg', title: 'Old Skool RPG', icon: '🤓', external: false },
  { path: '/drafts/places', title: 'RPG Place Generator', icon: '🏞️', external: false },
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