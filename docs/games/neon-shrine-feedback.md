# Neon Shrine: the feedback button

A button for the owner's own browser: tap `FB` where something is wrong, and a report with the place, a picture of the
screen, the save and a few words goes to a small service on Sleeper, to be read later. The service, who it lets in,
what it stores and its review page: `servers/feedback/README.md`. This file is the game's half.

## When it shows

The button shows while **DEV MODE** is on (`localStorage['zelda.dev']`, the menu's LOG page) **and** `GET /can` has
answered `200 {"ok":true}` for this page load. The service refuses everybody but the allowed account, all refusals
alike. A yes is kept while the page lives; a no is asked again the next time DEV MODE is switched on. With DEV MODE
off the game makes no feedback request and fetches none of the feature's code.

It is a 44 × 44 button in the top-left corner inside the safe area, the letters `FB` in DEV MODE's row and lilac. The
hearts are painted under it (they take no press); no other control stands there. It steps away under the menu, a
panel, a dialog and a way out. It has no key of its own; reached by Tab, Enter or Space press it.

## The window

The tap reads where the hero stands and copies the frame, then the world stands still (the shell's panel,
`openPanel('', 'feedback')`). Top to bottom: `FEEDBACK`; map, area and tile; the picture; a field (`WHAT IS WRONG?`,
focused by itself only without touch); SEND and CANCEL; a status line. Keys typed in it reach nothing else; Escape is
CANCEL. SEND works with an empty field. Presses in the first 350 ms are ignored, except that a press that begins on
SEND is sent when they are over. The box hangs from the top and keeps clear of an iPhone's keyboard (`--fb-kb`,
`composables/useKeyboardInset.ts`); its picture shrinks first.

`SENDING...`, then `SENT.` (the window closes after a second), or `NOT SENT: <reason>` and SEND reads `RETRY`:

| Reason | What happened |
|---|---|
| `NO ANSWER OR NOT SIGNED IN` | the request failed: offline, the service down, or its refusal (no CORS headers) |
| `TIMED OUT` | no answer in 15 s |
| `REJECTED` | 400: the service did not take the report |
| `TOO BIG` | 413 |
| `STORE FULL` | 507 |
| `SERVER ERROR` | any other 5xx, or an answer that is not the contract's |

A report that was not sent stays as it is (words, picture, place) until it is: CANCEL keeps it, and the next FB opens
it again. The picture and the place live in memory only. The words are also in `localStorage['zelda.feedbackDraft']`,
cleared only by the service's 201, so they come through a reload. That key and `zelda.dev` are the only storage the
feature touches.

## What is sent

`POST /entry`, `multipart/form-data`, nothing before SEND:

- `meta` (JSON): `v: 1`, `app: 'zelda'`, the time, the page's address (origin and path), the game's version, `where`
  (map, area, tile and exact position in tile units, facing, camera zone, continue point, hearts, mode, play time,
  view and rule, and up to 15 × 15 tiles around the hero) and `env` (window, canvas, touch, orientation, user agent,
  signed in, paused). About 1.2 KB.
- `text`: up to 4000 characters.
- `shot`: `shot.jpg`, the play canvas (not the HTML over it), long edge 1280 px at most, aimed under 300 000 bytes
  (quality 0.72, 0.55, 0.4, then three quarters the size); left out if it cannot be made that small.
- `save`: the save the game would write there (`toSave`; its `hp` is the full count, the real one is `where.hp`). A
  few KB; left out over 65 536 bytes.

To stand where a report was made: `createGame(WORLD, { save })`, then
`enterMap(WORLD, s, where.map.id, where.entry.entry, [], where.pos)`.

## Code

`themes/zelda/feedback/`: `useFeedback.ts` is the one file in the shell's own chunk. With DEV MODE on it fetches
`gate.ts` (`GET /can`) and `url.ts`; after a yes `context.ts` (`meta` and the save), the window
(`FeedbackPanel.vue`, with `send.ts`) and the button (`FeedbackButton.vue`); `capture.ts` (the picture) at the first
tap. `url.ts` holds the service's address, chosen at build time: `https://sleeper.phareim.no/feedback`, in
development the fake on the page's own host, port 3957.

## The fake and the checks

`scripts/zelda-lab/feedback-fake.mjs` stands in for the service's two routes, with the contract's caps and checks and
any `Origin` let in. Beside `npm run dev`:

```
node scripts/zelda-lab/feedback-fake.mjs [yes|no|drop|slow|500]
```

It prints what arrives and the temporary folder it writes it to.

- `tests/zelda-feedback.test.mjs` (in `npm run test:zelda`): the gate, the report's place and save, and sending,
  against the fake.
- `npm run smoke:feedback` (by hand, after a change to the button, its window or the shell around them): against a
  running `npm run dev` on port 3030, or `npm run smoke:feedback -- <url> [shotsDir]`; the second argument saves
  pictures. It starts the fake itself, so port 3957 must be free. It runs a headless Chrome on a phone and a desktop
  window in both views, and answers every other machine's address inside the browser.
