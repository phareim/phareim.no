## Radio — the generative radio in the town (2026-09-25)

`?theme=radio` is Petter's generative background-music radio from
radio.phareim.no (repo `phareim/radio`), listen-only, in the town. The way
in is the old hippie with the records on the beach east of the pier (since
2026-09-26; before that a studio with a mast stood by the road). Face the
booth and press A: "DJ: JUST RECORDS, FRIEND. RADIO PHAREIM: TEN STATIONS,
AND THE MUSIC IS MADE UP AS IT PLAYS. / TUNE IN?", then YES / NO, the fade and
the launch. Back in town you stand in front of the booth (`portal.return`).
The other DJ, the one building loops live, leads to jam.phareim.no
(`docs/games/portal.md`). It is not an arcade cabinet: the theme is live
(in `liveThemes`, so the portal's hidden link index lists it) but no
cabinet points at it.

**The page** is the radio app's (`components/RadioApp.client.vue` in
`phareim/radio`) in the site's pixel look, which it already shared: the
painted place (scene window with place, key, chord now → next, bpm and the
phrase meter), the ten layers, PLAY and HOLD, the station dial, intensity
(STILL … SURGE), MOOD, SPACE, GRIT, DENSITY, TEMPO, VOLUME and mute, and the
AUTO / ▶▶ / DIM corner. DIM (`radio.calm`) leaves only the picture, with
the corner fading after 3.5 s idle. CHANNELS (the last dial tile, or C)
picks which places show on the dial, kept in this browser. A line under
the dial links out: RATE AND COMPOSE AT RADIO.PHAREIM.NO (MORE AT … on
phones).

- Keys as in the radio app: Space play/pause, 1–9 and 0 places, ← →
  previous/next place, ↑ ↓ intensity, H hold, A auto, G glide on, D dim,
  C channels, M mute. Escape closes CHANNELS or leaves DIM; otherwise the
  shell takes it home. The shell uses no other key here.
- The site radio (the six game stations) is held silent while the page is
  mounted (`getRadioEngine().hold(true)` in `Landing.vue`, released on
  unmount), and its widget is not shown: the registry flag `ownRadio`
  hides it in `app.vue`.
- Leaving (⌂, Escape, back button) stops the generative player (it fades
  out and suspends) and clears the media session. Controls, volume, AUTO
  and DIM persist in localStorage (`radio.*` keys, this origin only).
- The master output plays through a hidden `<audio>` element, as on
  radio.phareim.no, so phones treat the page as media (lock screen, media
  keys).
- Nothing scrolls; checked at 1440×900, 390×844 and 375×667. The right edge
  of the deck keeps clear of the ⌂ chip, and DIM's corner sits left of it
  above `--app-safe-bottom`.

**Files.**

| File | Job |
|---|---|
| `themes/radio/Landing.vue` | The SSR shell (RADIO / TUNING IN...), holds the site radio, loads `Station.vue` as its own chunk inside `<ClientOnly>` |
| `themes/radio/Station.vue` | The page: layout, keyboard, media session, hidden `<audio>` |
| `themes/radio/Dial.vue` | The listen-only station dial (the app's `StationDial.vue` without composing) |
| `themes/radio/Channels.vue` | Show/hide channels, localStorage only (the app's `ChannelsDialog.vue` without compose, remove or member sync) |
| `themes/radio/theme.css` | Tokens, and the app's palette names (`--bg`, `--ink`, `--cyan`, …) on `.radio-station` only |
| `themes/radio/station/` | Vendored from `phareim/radio`, never edited by hand (below) |
| `themes/zelda/world/overworld.ts` | The records booth: exit `radio` (mark `]`, look `booth`, art `records`) at column 33, row 30, between its `Z` tiles |
| `themes/zelda/render/exits.ts` | Look `booth`: wooden speakers, fairy lights, the table with two turntables, the DJ (sprites `dj_records_*` in `render/spritesBeach.ts`) |

`themes/radio/engine.ts` and `catalog.ts` are the other radio, the site
widget's six game stations (`docs/games/global-radio.md`).

**Vendoring.** `node scripts/sync-radio.mjs [path]` (default `../radio`)
copies from `phareim/radio` into `themes/radio/station/`: `engine/` (with
`audio/` and `landscapes/`), `scene/` (without `shots/`, `tools/`,
`assets/` and `dev.*`), the components `SceneWindow`, `IntensityBar`,
`PxSlider`, `PxText`, `LayerStrip`, and the composables `useRadio`,
`useAuto`, `useChannels`, `storage`. It rewrites `~/engine/…`, `~/scene/…`,
`~/composables/…` to relative paths and turns the app's Nuxt auto-imports
(`useRadio`, `useAuto`, `useChannels`, `PxText`) into explicit imports, so
phareim.no's own `composables/useRadio.ts` (the widget's) never answers
for them. Every file starts with `Vendored from phareim/radio@<sha> by
scripts/sync-radio.mjs — edit it there, then re-sync.` Fix things in the
radio repo, commit there, then re-sync here and commit `station/`.
`node scripts/sync-radio.mjs --check` exits 1 when `station/` differs from
what a sync would write. Last synced from `phareim/radio@61a86d4`
(2026-09-25).

The engine imports with `.ts` extensions; `nuxt.config.ts` sets
`allowImportingTsExtensions` (with `noEmit`) so vue-tsc accepts them, and
`npm run typecheck` checks `station/` as strictly as the rest.
`useChannels` can sync with radio-api's `/api/settings`, but only after
`sync()` is called, which this theme never does.

**What stays on radio.phareim.no.** Thumbs, notes, Reader login, the Opus
compose flow and Opus's composed places (the dial here shows the ten
built-in places), the channel sync across devices, and radio-api on
Sleeper. Its `backend/` validates composed landscapes with the same engine.

**Checks** (2026-09-25). `npm run test:portal` covers the station: the exit
exists in the town, sits in a wall with open ground below, ends its lines
on TUNE IN? PRESS {A}., has a RADIO sign, and the path-finding walker uses
it and comes back in front of it. Headless Chromium against the dev server
and a local production build: the town start, the hero at the door with
its lines, the door into the theme, playing at 1440×900, 390×844 and
375×667, DIM, CHANNELS, Escape back to the door. Not checked: sound on a
real phone, iOS lock-screen playback from phareim.no, the station's reach
from the desktop start view (at 1440×900 the start view shows the house
only; the plaza sign points down to the station).

**What would make it redundant.** radio.phareim.no keeps the full radio;
this theme is the listen-only copy. If the radio app itself moved into
phareim.no, or Petter no longer wants the radio in the town, retire the
theme (registry entry, `themes/radio/{Landing,Station,Dial,Channels}.vue`,
`theme.css`, `station/`, `scripts/sync-radio.mjs`) and the station in the
town (mark `]` and its booth; the Jam booth can stay on its own).
