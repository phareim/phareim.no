# Prompt for Sleeper: make zap a 3D-model backend (2026-09-29)

Paste everything below the line into a Claude session on Sleeper.

---

Mål: bruk zap (Petters M5 MacBook Pro, 32 GB, tunnel-vert `tzap`) som backend for å generere 3D-modeller til spillverdenen, og la deg (Sleeper) opprette subagenter av typen `zap` som kjører jobben der, på samme måte som `mac`-agentene (mac-claude) gjør på den andre Macen.

**Det som allerede er verifisert (fra zap, 2026-09-29):**
- Sleeper når zap: `ssh tzap` (Host tzap i ~/.ssh/config, localhost:2223, bruker `petter.hareim@partner.zaptec.com`). Sleepers nøkkel «phareim hetzner» ligger i zaps authorized_keys. Reverse-tunnelen er LaunchAgent `no.phareim.reverse-tunnel`.
- På zap ligger `~/3d-lab/` (les `~/3d-lab/README.md`): image-to-3dlab v0.3.4 med Pixal3D (MIT, Metal) og BiRefNet-bakgrunnsfjerning installert. Weights ligger lokalt.
- Inngangspunkt: `~/3d-lab/bin/mesh <bilde> [outdir] [--seed N] [--steps N]`. Skriver `<stem>.glb`, `<stem>-views.png` (fire vinkler) og `<stem>.summary.json`, og skriver sammendrags-JSON som siste stdout-linje. Testet ende til ende på `eventyrland-owl-wizard.png`: 486 s, ca. 1M trekanter, 37-40 MB GLB.
- Kvalitet: to første modeller (rev og Krea-prinsesse) og ugla ser svært bra ut fra forsiden, plausibel bakside, flat malt tekstur uten repaint. Kjente svakheter: tynne, flate deler (lutt, halespiss) blir tykke eller piggete, ansikt kan drive litt. Se `docs/3d-mesh-results.md` i phareim.no.
- Zap har `claude` 2.1.284 (~/.local/bin/claude), uv, Xcode 27 med Metal og 593 GB ledig. Ikke installert: Blender, TRELLIS.2, wave/mflux.

**Rammer:**
- Zap er en Zaptec-jobbmaskin. Bare hobbyprosjektet (~/github/phareim/ og ~/3d-lab/) skal røres. Ingen Zaptec-data inn i journalen. Følg avgjørelsen 2026-09-29#1.
- Ikke-kommersielt. Kun én mesh-jobb om gangen (bruker hele GPU-en). Bruk `caffeinate` for lange jobber, og forvent at maskinen kan være sovende eller offline (tunnelen faller ut da).
- Ingen sletting utenfor ~/3d-lab/out/. Presise stier.

**Oppgaver, i denne rekkefølgen:**
1. Sjekk at `ssh tzap '~/3d-lab/bin/mesh --help'`-lignende kall og en full kjøring fungerer fra Sleeper, og hent resultatene tilbake med rsync. Sjekk også at rsync finnes på zap (`/opt/homebrew/bin/rsync`) og at headless `claude -p` fungerer der (innlogget?).
2. Lag en rask sti uten Claude-jobb: `zap-mesh <bilde...>` på Sleeper som rsync-er bildet til zap, kjører `mesh`, henter GLB + views tilbake, og kan laste modellen opp til fixer.ink-biblioteket (tag `3d-glb`) hvis Petter vil det. En kø som kjører seriellt.
3. Lag agenttypen `zap` etter malen i `~/.claude/agents/mac.md`: samme relay-mønster, men mot `MAC_CLAUDE_HOST=tzap`. `bin/mac-claude` er allerede parametrisert (HOST, REMOTE, MODEL, EFFORT), så se om en tynn `zap-claude`-wrapper eller `MAC_CLAUDE_HOST=tzap` holder, og deploy `mac-claude-remote` til `~/bin` på zap. Legg agenten i Workflow-listene ved siden av `mac`.
4. Skriv en kort skill/recipe for «lag en 3D-modell av dette bildet» som forteller subagenten hvilke bilder som funker (ren eller forhåndsmaskert bakgrunn, motivet helt i bildet, A-pose, ingen tynne løse deler, ingen kastede skygger, koselig flat stil innenfor landsbymurene, dristigere Krea 2-kunst utenfor).
5. **Godkjent av Petter 2026-09-29, ingen ny bekreftelse nødvendig**, når 1-4 fungerer: (a) kjør de 14 gjenværende testbildene i `~/3d-lab/inputs/` som batch (ca. 1-1,5 t, serielt), (b) installer TRELLIS.2 lokalt (ca. 14 GB, HuggingFace-innlogging for `phareim` ligger allerede på zap) og sammenlign med WaveSpeed-TRELLIS-GLB-ene fra Eventyrland side om side med Pixal3D, (c) retopologi/dekimering til spillklare modeller (lab-et har `scripts/blender_*.py`). Blender må du installere hvis det trengs for (c). Petter har sagt at det er greit så lenge det er til nytte. Rapporter resultatene med rendrede bilder, tid og trekanttall per modell.

**Skriv ned underveis:** `journal note` og `journal decide` for nye fakta, og legg funn i `docs/3d-mesh-results.md`. Denne maskinen er ustabil, så det som bare ligger på zap kan bli borte.

## Backlog rule (Petter, 2026-09-29)

The 35 `ad-krea-*` / `ad-venice-*` images in `zap:~/3d-lab/inputs/` are backlog work for
`zap` subagents on Sleeper. They run only between 18:00 and 06:00 (Oslo), when zap is the
only machine free, the same model as the mac backlog. Serial through `~/3d-lab/bin/mesh`
(GPU lock `~/3d-lab/out/.gpu-lock`), outdir `~/3d-lab/out/ad/`. Do the 11 krea/venice pairs
first (about 2 h), then the rest. zap-Claude does not run them during the day.

Batch 1 (11 remaining Eventyrland/princess images: princess-krea-3/4, baker-gingerbread,
bear-knight, forest-witch, frog-prince, goblin-merchant, hare-ranger, old-fisher-cat,
stone-giant-child, troll-guard) is in the same backlog, same night rule, outdir
`~/3d-lab/out/batch1/`, run with `~/3d-lab/bin/batch <outdir> <images...>`. Ignore
`inputs/*__matted.png` (Pixal3D intermediates). Batch 1 goes before the ad-* pairs.

## Backlog: TRELLIS.2 vs Pixal3D (2026-09-29)

Blocked until Petter's Meta review for `facebook/dinov3-vitl16-pretrain-lvd1689m` (HF account
`phareim`) is approved. Check with a `hf_hub_download` of its `config.json`; 403 means wait. When
open, in the 18:00-06:00 window and with the GPU lock: `~/3d-lab/bin/trellis <masked.png>
~/3d-lab/out/trellis/` on fox-bard (mask already at `out/trellis/eventyrland-fox-bard.png`),
princess-krea-1 and owl-wizard (masks: `inputs/*__matted.png`), then `~/3d-lab/bin/lowpoly`, then
compare with Pixal3D and, if reachable, the WaveSpeed TRELLIS GLBs. Priority below Batch 1 and the
ad-* pairs. First run downloads about 14 GB and takes 15-35 min per image.
