import { defineEventHandler } from 'h3'

// Statisk liste over tilgjengelige sider
const menuItems = [
  { path: '/drafts/about', title: 'About' },
  { path: '/drafts/art', title: 'Art' },
  { path: '/drafts/bounce', title: 'Bounce' },
  { path: '/drafts/poem', title: 'Poem' },
  { path: '/drafts/quote', title: 'Quote' },
  { path: '/drafts/rpg', title: 'RPG' }
]

export default defineEventHandler(async () => {
  return menuItems
}) 