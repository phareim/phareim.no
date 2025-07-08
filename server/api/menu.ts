import { defineEventHandler, getQuery } from 'h3'

// Statisk liste over tilgjengelige sider
const menuItems = [
  { path: 'https://dot.phareim.no', title: 'Red dot game 🔴' },
  { path: 'https://rpg.phareim.no', title: 'Old Skool RPG 🤓' },
  { path: 'https://phareim.no/drafts/about', title: 'About 📄' },
  { path: 'https://librarian.phareim.no', title: 'The Librarian📚' },
  { path: '/blog', title: 'Blog 📬' },
  { path: '/', title: 'Home 🏚️' },
  { path: '/drafts/image-generator', title: 'Image 👩🏻‍🎨' },
]

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const titleQuery = query.title;

  if (typeof titleQuery === 'string') {
    return menuItems.filter(item => item.title.toLowerCase().includes(titleQuery.toLowerCase()));
  }

  return menuItems;
}) 