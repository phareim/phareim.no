# Mini World — design (2026-09-26)

A game made *with* Ulrikke (7). In form a cross of Roblox's blocky 3D
world and Toca World's houses and people. Theme id `miniworld`, cabinet
ten in the portal's arcade. Norwegian throughout (bokmål, short words, the
reader is seven: one idea per line, big buttons, pictures before words).

## What you do

- **Make people.** Up to three (`MAX_PERSONS`). Name (typed, 1–12 letters),
  skin, hair style and colour, eyes, mouth, cheeks, and clothes from the
  closet. One is *active*: the one you walk around as. Switch any time.
- **Clothes.** Everyone starts with the starter closet (two tees, jeans,
  white sneakers). New clothes: buy in **Klesbutikken** with bits, or win
  them (prizes) in contests. All persons dress from one shared closet. You
  can dress anywhere from the menu (Garderobe) and at the wardrobe at home.
- **Money is bits** — the same bits Neon Shrine's hero picks up. One wallet
  for the whole site (`composables/useWallet.ts`), on the player's profile.
  Bits found in Neon Shrine can be spent here and the other way round.
  A new player gets a 50-bit welcome gift once (prize id `welcome`).
- **Contests** at booths on **Tivoliet** win bits and prizes:
  - **Obby** (obstacle course, three levels: Lett / Middels / Vanskelig):
    floating blocks in the sky, gaps, moving and spinning platforms,
    kill bricks (red lava, you respawn at the last checkpoint), trampolines,
    a finish flag. Reward by level (+ a bonus for a new best time); first
    finish of a level gives its trophy (+ the Obby hoodie on Lett).
  - **Stjernejakt**: 45 seconds on Stjerneengen collecting stars that pop
    up; bits by stars; 30 stars once gives the star trophy and Stjernetopp.
  - **Motevisning** (fashion show): a theme is drawn (a `FashionTag`), you
    dress your active person from the closet, walk the catwalk, three
    animal judges give 1–5 stars each by how many pieces match the theme
    (+ something for a full outfit). 12+ stars once: Motepokal and Gullsko.
  - **Huskespill** (memory): pairs of item pictures, 6/8/10 pairs; bits
    by how few moves. First win on 10 pairs: Huskepokal + Stjernebriller.
  Rewards live in `core/contests.ts`. Bits per play are small (5–70) so
  the shops take a while but never feel far.
- **Your house.** Walk in at your door on Nabogata. One room of
  `HOUSE_W × HOUSE_D` cells. **Pynt** mode: pick things from storage, drag
  them on a grid, turn them, put them back; floors and wallpapers. Buy in
  **Møbelbutikken**. Sit on sofas, sleep in the bed, bounce on the
  trampoline, play the piano (small animations, a caption).
- **Upgrade things** in **Verkstedet**: furniture and weapons have levels
  1–3 (1 plain, 2 Skinnende: gold trim and sparkle, 3 Magisk: glow and
  floating sparkles; weapons also get bigger, more magic). Cost:
  `upgradeCost` in the catalog.
- **Fantasy weapons** in Verkstedet: pick a base (Tryllestav, Sverd,
  Pipehammer, Blaster, Bue), a magic (bobler, stjerner, hjerter, blomster,
  snø, konfetti, regnbue, lyn, drage) and a colour; the name is made from
  the parts ("Boble-blaster"). Equip one and press the magic button: the
  magic flies, sparkles and pops balloons floating in Ballongparken on
  Tivoliet (a bit now and then, capped per visit). Nobody gets hurt: no
  enemies, no damage; it is for play.
- **Neighbourhood** at **Slottet** (the castle):
  - **Friends**: everyone has a six-letter friend code. Type a friend's
    code to become friends (both ways at once).
  - **Nabolag**: make one (a generated name like "Solsikkedalen" and a
    join code) or join one with its code. One neighbourhood at a time,
    at most 12 members.
  - **The crown**: every member has one vote for who is ruler. Most votes
    is crowned (tie: who joined first). The ruler chooses **Konge** or
    **Dronning** and may give the others **Dronning/Konge, Prins,
    Prinsesse**. A title gives its royal clothes once (crown, tiara, cape,
    banner — `rarity: 'royal'`), and they are kept.
  - **Gifts**: send clothes, furniture (it leaves your house) or bits to a
    friend or a neighbour. They arrive in the **postkasse** outside the
    house; open to take them in.
  - **Visit**: friends' and neighbours' houses stand on **Nabogata** with
    their active person waving outside. Walk in to look (read-only).
- **Into Neon Shrine**: the active person's colours (skin, hair, hat,
  top, trousers, shoes) recolour Neon Shrine's hero (`HeroColors` in
  `types.ts`, localStorage `miniworld.heroColors`).

## The town (one island, about 120 × 120 units)

- **Torget** in the middle: fountain, benches, lamps, the spawn point, a
  signpost pointing to everything.
- **Butikkgata** (east): Klesbutikken, Møbelbutikken, Verkstedet —
  shop fronts with big signs and something in the window.
- **Nabogata** (west): your house first (with its postkasse), then the
  neighbours' houses, up to 12, each with a name sign.
- **Slottet** (north, on a small hill with stairs): the neighbourhood hall.
- **Tivoliet** (south): four booths (Obby-tårnet, Stjernejakt,
  Motevisning's stage, Huskespill), Ballongparken with floating balloons.
- Around: water, a beach, trees, flowers, fences, a few trampolines and
  jumpy things to climb (Roblox-style free play: you can jump on roofs).
- **Obby-himmelen** and **Stjerneengen** are separate places reached from
  their booths; a door or the menu brings you back to town.

## Look

Chunky 3D: three.js rendered into a small render target (≈ 300–400
logical pixels on the short side), scaled up nearest-neighbour — the
site's pixel look (`docs/games/pixel-look.md`), but **daylight and
candy**: sky blue, mint grass, sunny yellow, candy pink, soft shadows,
flat/toon shading, crisp outlines where cheap. Blocky Roblox-style people
(box head, torso, arms, legs; faces drawn on a canvas texture; hair and
hats as box pieces). No dusk, no neon night here — this is the sunny side
of the same world. Panels are Neon Shrine's dialog box (`.px-box`,
`.px-btn`) in the pixel font (with Æ Ø Å), in bright candy edges, over the
3D view. Pictures in panels come from `scene/preview.ts` (the real
models, pixelated), never emoji.

Leave out: cream backgrounds, italic accent words, `01 / 02` labels,
pill buttons, soft glows, gradients on panels, a generic "kids' app" look.

## Controls

- **Keyboard**: WASD/arrows walk (relative to the camera), Space jumps,
  E / Enter = action (go in, use), F = magic, a mouse drag on the view
  turns the camera, the wheel zooms. Esc closes a panel; otherwise it is
  the shell's Escape home.
- **Touch** (iPhone, iPad): a floating stick on the left half, drag on
  the right half turns the camera, pinch zooms; buttons bottom-right:
  **Hopp** (big), the context **action** button with its word ("Gå inn",
  "Handle", "Sitt"), and **Magi** when a weapon is in hand. Everything
  above the bottom band (`--app-safe-bottom`).
- Menu buttons along the top right: Personer, Garderobe, Sekk, Hjem, Kart
  (fast travel to Torget, Butikkgata, Tivoliet, Slottet, Nabogata).

## Code map

```
themes/miniworld/
  DESIGN.md, types.ts, catalog.ts   design, data contract, every item and price
  core/        pure logic, node-tested: save.ts (the save and every action),
               contests.ts (rewards, fashion scoring, memory decks), royal.ts
               (crown from votes, titles, royal prizes), names.ts, outfit.ts
               (HeroColors for Neon Shrine), rng.ts
  scene/       three.js: contracts.ts (the seams), runtime.ts, look.ts
               (low-res render + outline), camera.ts, input.ts, physics.ts,
               town.ts, blocks.ts, place.ts, home.ts, neighbors.ts,
               obby.ts + obby-course.ts, stars.ts, catwalk.ts, play.ts
               (magic, balloons); avatar.ts, clothes.ts, textures.ts,
               meshkit.ts, furniture.ts, weapons.ts, house.ts, preview.ts
  Landing.vue, Game.vue, ui/*.vue    the shell and every panel (ui/context.ts
               is what panels share; ui/text.ts soft-hyphenates item names)
  audio.ts, audioScore.ts, theme.css
composables/useWallet.ts, useMiniWorld.ts, useMiniWorldSocial.ts
server/api/wallet.*, server/api/mw/*, server/utils/miniworld.ts (stores),
server/utils/miniworldApi.ts (route rules), migrations/0006_miniworld.sql
scripts/miniworld-lab/   avatar-sheet.mjs, world-shot.mjs, world-play.mjs
tests/miniworld-*.test.mjs   npm run test:miniworld
```

## Composables (the UI's API)

`useWallet()` → `{ bits: Ref<number>, earn(n, reason), spend(n, reason): boolean, sync(): Promise<void> }`,
plus plain functions for non-Vue code (Neon Shrine's shell):
`readWallet(): number`, `addToWallet(delta, reason): number`,
`onWalletChange(cb): () => void` (same tab and other tabs).
Local copy `phareim.wallet` (balance + pending ops with random ids);
ops go to `POST /api/wallet` when the browser has a player; the server
applies each op id once and answers the balance; the local balance is the
server's plus what is still pending. Never below 0, at most 99 999.

`useMiniWorld()` → the save as reactive state with actions (buy, dress,
place, upgrade, craft, finish a contest, give away, receive), local
`miniworld.save` + profile slot `miniworld` (`useGameSave`, newest wins).
Money goes through `useWallet`. See `core/save.ts` for the actions.

`useMiniWorldSocial()` → `SocialState` and the neighbourhood actions over
`/api/mw/*`.

## API (server/api)

- `GET /api/wallet?player=` → `{ bits }`; `POST /api/wallet { playerId, ops: [{ id, delta, reason }] }` → `{ bits }`
- `GET /api/mw/state?player=` → `SocialState` (makes the friend code on first call)
- `POST /api/mw/profile { playerId, person, house, levels, kinds }` — what others see
- `POST /api/mw/friend { playerId, code }`, `POST /api/mw/unfriend { playerId, friendId }`
- `POST /api/mw/hood { playerId, action: create|join|leave|vote|crown|title, code?, target?, title? }` → `{ hood }`
- `POST /api/mw/gift { playerId, to, kind, item?, level?, amount? }` (to a friend or neighbour; bits are debited on send, credited on open)
- `POST /api/mw/gift/open { playerId, id }` → `{ gift }`
- `GET /api/mw/house?player=<public id>&viewer=<my id>` → `{ profile: PublicProfile }` (friends and neighbours only)

The caller is always named by the private `playerId` (the browser's
UUID, the only credential). Every other player, in answers and in
requests (`to`, `target`, `friendId`, the house's `player`), is their
public id (`players.pub_id`; `SocialState.me.id` is my own). No answer
carries another player's private id (`tests/miniworld-server.test.mjs`
checks every one).

No auth, like the rest of the site's profile API. Ids validated, catalog
ids checked, sizes capped, at most 30 friends, 12 per neighbourhood, 40
unopened gifts per player.
