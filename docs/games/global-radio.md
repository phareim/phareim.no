## Global radio — én musikkspiller på tvers av spillene (2026-09-12, flettet til master samme dag)

Spillerønske 2026-09-12: en musikkspiller øverst til høyre som til enhver
tid viser radioen som spiller, og blir med på tvers av spillene. Bygd i
worktree `~/github/phareim-radio-widget` parallelt med spill-lyd
(`feat/invaders-powerups`) — begge flettet til master 2026-09-12.

**Hvordan:** `components/RadioWidget.vue` (i `app.vue`, fast øverst høyre,
z 60, Space Mono, `♪ STASJON n/6` + mute) leser `composables/useRadio.ts`
(stasjon/mute i `useState`, persistert `phareim.radioStation` /
`phareim.radioMuted`). Lyden kommer fra singleton-motoren
`themes/radio/engine.ts` (samme sequencer-oppsett som spillene hadde:
buss, delt noise, gated reverb, dotted-eighth delay, 25 ms / 0,14 s
lookahead) — opprettes på første gesture, disponeres aldri ved
theme-bytte. Katalogen `themes/radio/catalog.ts` (ren, testbar) samler alle
seks sporene: Galaga 0–2 + OutRun 3–5. M sykler globalt (widgeten eier den),
første pointerdown/keydown hvor som helst starter radioen.

**Spillene:** Galaga og OutRun spiller musikk via `radio.*` og beholder kun
SFX/motorlyd lokalt (to AudioContexts). Død, TIME UP og GOAL fader ikke
lenger musikken — radioen spiller videre. Galagas `M` og intensitets-
styring (`setIntensity` per wave/boss) går mot radioen; OutRuns
SELECT MUSIC-screen velger global stasjon (OFF = start muted) og canvas-
HUD-en viser sann global stasjon under kjøring. Pauser og skjult fane
suspender begge kontekster; resume overstyrer aldri mute.

**Kontrakt mot lyd-agenten:** notene eies av `TRACKS` i hvert spills
`audio.ts` (motoren importerer dem; katalogen speiler navnene og
`tests/radio-catalog.test.mjs` feiler høyt ved avvik i stedet for å drive
stille). `intensityVoices`/`transposeFor`/`hz` gjenbrukes fra
`galaga/audio.ts`. Per-spill `playTrack/stopTrack/fadeMusic` er døde —
ikke koble dem til igjen. `npm run test:radio` (5 tester) + én ny
regressjon i `galaga-game` (reset driver radioen); CI-linje lagt til.
Verifisert: alle suiter grønne, typecheck, produksjonsbygg, SSR-widget på
galaga/outrun/playerone (nå pensjonert)/tetris, headless Chromium uten JS-feil på fem
themes. Fysisk telefon og reappl multi-context-batterikostnad er umålt.

**Spill-lyd og samspill (2026-09-12).** De andre spillene har eget lydspor
i `composables/useSound.ts` (syntetiserte one-shots + én 16-toners sløyfe
per spill: breakout, rtype, invaders, starfox, tetris, shore; Cyberpunk-
sporene døde med `hacker`-temaet da det ble Galaga) med `SoundToggle`
(`themes/base/SoundToggle.vue`) på hvert spill-landing. Attract-modus er
alltid stille. Regelen som holder det hele på greip: et spill med eget
soundtrack parkerer radioen mens et run pågår (`music.start` →
radio-`suspend(true)`, `music.stop()` → resume) og holder den parkert i
pause (`stop(false)`); one-shots spiller alltid over radioen. Resume
overstyrer aldri mute — verken radioens eller spillets egen. To
AudioContexts er normalt: radioens lever i widgeten, spillets i temaet.

