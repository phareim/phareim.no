import { defineEventHandler, getQuery } from 'h3'

// Statisk liste over tilgjengelige sider
const facts = [
    { fact: 'The first computer program was written in 1843 by Ada Lovelace. 👩🏻‍💻' },
    { fact: 'The first computer was built in 1880 by Charles Babbage. 🤓' },
    { fact: 'Bananas are berries, but strawberries aren\'t! 🍌' },
    { fact: 'A group of flamingos is called a "flamboyance" - how fabulous! 💃' },
    { fact: 'Octopuses have three hearts and blue blood! 🐙💙' },
    { fact: 'Honey never spoils - archaeologists found edible honey in Egyptian tombs!' },
]

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const titleQuery = query.title;

  if (typeof titleQuery === 'string') {
    return facts.filter(item => item.fact.toLowerCase().includes(titleQuery.toLowerCase()));
  }

  return facts;
}) 