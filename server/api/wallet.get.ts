/** GET /api/wallet?player=<id> → { bits }: the site wallet's balance (404 for an unknown player). */
export default defineEventHandler(event => mwRoute(event, store => walletGet(store, getQuery(event))))
