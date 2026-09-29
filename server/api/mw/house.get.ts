/** GET /api/mw/house?player=<id>&viewer=<id> → { profile }: a friend's or neighbour's house (403 for strangers). */
export default defineEventHandler(event => mwRoute(event, getQuery(event).viewer, store => houseGet(store, getQuery(event))))
