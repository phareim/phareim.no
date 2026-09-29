/** GET /api/mw/state?player=<id> → SocialState: my friend code (made on first call), friends, hood, mailbox. */
export default defineEventHandler(event => mwRoute(event, getQuery(event).player, store => stateGet(store, getQuery(event))))
