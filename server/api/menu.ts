import { defineEventHandler, getQuery } from 'h3'

// Statisk liste over tilgjengelige sider
const menuItems = [
  { path: '/drafts/about', title: 'About' },
  { path: '/rpg', title: 'RPG' },
]

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const titleQuery = query.title;

  if (typeof titleQuery === 'string') {
    return menuItems.filter(item => item.title.toLowerCase().includes(titleQuery.toLowerCase()));
  }

  return menuItems;
}) 