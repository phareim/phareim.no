import { defineEventHandler, getQuery } from 'h3'

// Statisk liste over tilgjengelige sider
const menuItems = [
  { path: '/', title: 'Home', icon: '🏚️' },
  { path: '/drafts/about', title: 'About', icon: '📄' },
  { path: '/drafts/bounce', title: 'Bounce', icon: '⚽️' },
  { path: '/drafts/image-generator', title: 'Image', icon: '👩🏻‍🎨' },
  /*{ path: '/blog', title: 'Blog', icon: '📬' },
  { path: '/blog/new', title: 'New Blog Post', icon: '📬' },*/
  { path: '/rpg', title: 'Old Skool RPG', icon: '🤓', external: false },
  { path: '/drafts/places', title: 'RPG Place Generator', icon: '🏞️', external: false },
  { path: '/drafts/dot', title: 'Red dot game', icon: '🔴', external: true },
  { path: '/drafts/librarian', title: 'The Librarian', icon: '📚', external: true },
]

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const titleQuery = query.title;

  if (typeof titleQuery === 'string') {
    return menuItems.filter(item => item.title.toLowerCase().includes(titleQuery.toLowerCase()));
  }

  return menuItems;
}) 