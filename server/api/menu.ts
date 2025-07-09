import { defineEventHandler, getQuery } from 'h3'

// Statisk liste over tilgjengelige sider
const menuItems = [
  { path: 'https://dot.phareim.no', title: 'Red dot game', icon: '🔴' },
  { path: 'https://rpg.phareim.no', title: 'Old Skool RPG', icon: '🤓' },
  { path: 'https://librarian.phareim.no', title: 'The Librarian', icon: '📚' },
  { path: '/drafts/about', title: 'About', icon: '📄' },
  { path: '/drafts/image-generator', title: 'Image', icon: '👩🏻‍🎨' },
  { path: '/blog', title: 'Blog', icon: '📬' },
  { path: '/', title: 'Home', icon: '🏚️' }
]

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const titleQuery = query.title;

  if (typeof titleQuery === 'string') {
    return menuItems.filter(item => item.title.toLowerCase().includes(titleQuery.toLowerCase()));
  }

  return menuItems;
}) 