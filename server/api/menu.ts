import { defineEventHandler, getQuery } from 'h3'

// Statisk liste over tilgjengelige sider
const menuItems = [
  { path: '/drafts/about', title: 'About' },
  { path: '/drafts/art', title: 'Art' },
  { path: '/drafts/bounce', title: 'Bounce' },
  { path: '/drafts/poem', title: 'Poem' },
  { path: '/drafts/quote', title: 'Quote' },
  { path: '/drafts/rpg', title: 'RPG' },
  { path: '/drafts/spin', title: 'Spin' },
]

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const titleQuery = query.title;

  if (typeof titleQuery === 'string') {
    return menuItems.filter(item => item.title.toLowerCase().includes(titleQuery.toLowerCase()));
  }

  return menuItems;
}) 