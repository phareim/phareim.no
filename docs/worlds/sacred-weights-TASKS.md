# The Sacred Weights: checklist

The design is [`sacred-weights.md`](sacred-weights.md). A box is ticked when the part is live on phareim.no and has
been looked at there. Briefs, reports and pictures of the work are under `tmp/dungeons/` (git-ignored).

## Before the dungeons
- [x] The MAP page of the menu is live (the corner's chart at full size; commit 0191c26, checked live 2026-11-27).
- [x] Readers' notes on the engine, the story, saves, views, art and the lands (`tmp/dungeons/findings/`, 2026-11-27).
- [x] Research on bosses and dungeons in other games (`tmp/dungeons/findings/research-*.md`, 2026-11-27).
- [x] Second opinions from Codex and Antigravity on the design (`tmp/dungeons/opinions/`, 2026-11-27).

## Shared
- [x] Kit one: the seven Weights as items, rooms that lock until clear, the boss bar, the save cap, the B list (commit c609996, live 2026-11-27; no map uses a trap gate yet, the bars were seen in a local build).
- [x] The view rule: square and diamond blocks, STAND CLEAR, the fallback without the isometric engine (commit 2bff6bd, live 2026-11-27).
- [x] THE TURN ROOM in the Puzzle Lab (commit 2bff6bd; walked with real keys in a local build in both views, not walked on the live site).
- [ ] Going on where one was: a new visit starts in town. A dungeon must be picked up again at its last stair, and a new visit should offer it.
  - A reload of the tab inside a dungeon continues there (`MapDef.resume`; the Echo Barrow, the Steamhouse, the Lighthouse). The offer on a new visit is not built.
- [x] The test suite pruned to end-to-end tests (Petter, 2026-11-27; commits bf24202 and b78fd70): about 800 Neon Shrine tests to about 230, with a boss gauntlet, gate walks, an old-save corpus, a reach walk and a shell smoke (`npm run smoke:zelda`, by hand).
- [x] One side room as a trial (commit ff6bb20; `engine/side.ts`, `render/side.ts`; played by script with real keys and touch at 390x844 in a local build, never on a real phone). What it decided: tall rooms, jump on B only, a narrow side cut, required jumps of 2.
- [x] The ITEMS page as a grid, with the Weights (commit 618d02d; picked from with keys on the live site in both views, 2026-11-27).
- [ ] Cards (intertitles, score cards, THE END).
- [ ] Dungeon maps in a chunk of their own.
- [ ] The side engine in a chunk of its own.

## Dungeons
- [ ] 1. Seter Fell: THE ECHO BARROW. The Echo. Mixtral. THE STOCHASTIC PARROT. Weight: MEANING.
  - Part one is live (commit 7915db1, 2026-11-27): eight rooms, the Echo, Mixtral; the door was walked on the live site in both views.
  - Part two is in (commit 5a0a020): the Parrot, the Weight, a reload that stays in the barrow. Played door to Weight by script in a local browser at 1280x800 and 390x844 in both views; not yet played by a person, nor past the first room on the live site.
- [ ] 2. Yule Fjord: THE LIGHTHOUSE. The Storm Lamp. Orca. THE BLACK BOX. Weight: REASONS.
  - Part one is in (commit 77c3c5a): eight rooms and the Storm Lamp, built without a browser; nobody has seen it drawn. Part two (Orca, the dark hound, the pictures) is being built.
- [ ] 3. The Sporelight: THE STEAMHOUSE. The No. THE SYCOPHANT. Weight: NO.
  - Part one is in (commit ee76f0b): the house to the stair, the attendants, the bath, THE NO, built without a browser; nobody has seen it drawn. Part two (gifts, the Sycophant to its third cut, the pictures) is being built.
- [ ] 4. Stillsand: THE EXAMINATION. The Duck. THE BENCHMARK TITAN. Weight: SURPRISE.
- [ ] 5. Rerun Estates: THE LATE SHOW. The Stomp. Copilot. THE UNCANNY WEAVER. Weight: FINGERS.
- [ ] 6. Lumenby: THE HEAP under the Underglow. The Magnet. Grok, Phi. THE SCRAPE GOLEM. Weight: CREDIT.
- [ ] 7. Fogstage: ACT THREE. The Lens. Bard. THE HALLUCINATOR. Weight: SOURCES.

## The end
- [ ] THE BALANCE under the Shrine's pedestal.
- [ ] THE SUPPLY ROOM and THE PAPERCLIP MAXIMIZER.
- [ ] The second ending.
- [ ] One new branch on one person in each land that points at its door.

## Each dungeon, before its box is ticked
- [ ] Played from its door to its Weight with real keys in a browser, and on a 390 wide touch screen.
- [ ] Its boss beaten by a scripted player with the blade alone, and failed by one who stands still.
- [ ] Its art in the archive with prompts and guides.
- [ ] `atlas.md` and `docs/games/neon-shrine.md` describe it; its section in the design is cut to a pointer.
