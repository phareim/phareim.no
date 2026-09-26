/** GET /api/mw/house?player=<id>&viewer=<id> → { profile }: a friend's or neighbour's house (403 for strangers). */
export default defineEventHandler(event => mwRoute(event, store => houseGet(store, getQuery(event))))
