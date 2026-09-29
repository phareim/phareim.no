// Hands the server's Norway answer (server/middleware/norway.ts) to the page,
// so Mini World and Lag Din Figur can say so when opened from a cabinet.
export default defineNuxtPlugin(() => {
  const event = useRequestEvent()
  useState<boolean>('norwayOk', () => event?.context.norwayOk ?? true)
})
