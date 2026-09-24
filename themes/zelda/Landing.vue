<template>
  <DefaultLanding>
    <template #background>
      <Zelda ref="game" @phase="onPhase" @result="onResult" />
    </template>

    <template #body>
      <div v-if="phase === 'attract' && !launching" class="zelda-title">
        <div class="zelda-sun" aria-hidden="true" />
        <p class="zelda-kicker">A NEON COAST ADVENTURE</p>
        <h1 class="zelda-logo"><span class="zelda-logo-neon">NEON</span><span class="zelda-logo-shrine">SHRINE</span></h1>
        <p class="zelda-tagline">THE SUN WON'T SET. GO GET IT BACK.</p>
        <p class="zelda-start">{{ hasSave ? hint('PRESS ENTER TO CONTINUE', 'TAP TO CONTINUE') : hint('PRESS ENTER TO BEGIN', 'TAP TO BEGIN') }}</p>
        <p v-if="quest" class="zelda-save">QUEST {{ quest.step }}/{{ QUEST_STEPS }}<span class="zelda-save-goal"> · {{ quest.goal }}</span> · {{ formatPlayTime(quest.elapsed) }}</p>
        <p v-if="pilot" class="zelda-pilot">SAVED TO {{ pilot.toUpperCase() }}</p>
        <p class="zelda-keys">{{ hint('ARROWS MOVE · SPACE SWORD / TALK · K ITEM · Q SWAP · P PAUSE', 'DRAG TO MOVE · A SWORD / TALK · B ITEM') }}</p>
        <div v-if="hasSave" class="zelda-row">
          <button class="zelda-btn" @click.stop="newGame">NEW GAME</button>
          <span v-if="inputMode === 'keyboard'" class="zelda-keys">OR PRESS N</span>
        </div>
        <p v-if="bestTime !== null" class="zelda-best">BEST TIME {{ formatPlayTime(bestTime) }}</p>
      </div>

      <div v-else-if="phase === 'over'" class="zelda-panel">
        <h1 class="zelda-panel-title">RESTING</h1>
        <p class="zelda-keys">{{ pilot ? `SAVED TO ${pilot.toUpperCase()}` : 'PROGRESS SAVED' }} · {{ formatPlayTime(result?.elapsed ?? 0) }} PLAYED</p>
        <p class="zelda-start">{{ hint('PRESS ENTER TO CONTINUE', 'TAP TO CONTINUE') }}</p>
      </div>

      <div v-else-if="phase === 'won'" class="zelda-panel zelda-panel--won">
        <div class="zelda-sun zelda-sun--small" aria-hidden="true" />
        <h1 class="zelda-panel-title">THE SUN SETS AT LAST</h1>
        <p class="zelda-time">{{ formatPlayTime(result?.elapsed ?? 0) }}</p>
        <p v-if="isNewBest" class="zelda-best">NEW BEST!</p>
        <p class="zelda-start">{{ hint('PRESS ENTER FOR A NEW QUEST', 'TAP FOR A NEW QUEST') }}</p>
      </div>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import { readStoredPlayer } from '~/composables/useLeaderboard'
import Zelda from './Zelda.vue'
import { parseSave } from './engine/index'
import { QUEST_STEPS, formatPlayTime, reconcile, summarizeSave, type QuestSummary } from './progress'
import { readLocalSave, writeLocalSave, clearLocalSave, localSavedAt, readLocalBest, writeLocalBest } from './localSave'

const { navigationLocked, portalLaunch } = useTheme()
const { hint, inputMode } = useInputMode()
const { player } = useLeaderboard()
const profileSave = useGameSave('zelda')

const game = ref<InstanceType<typeof Zelda> | null>(null)
const phase = ref<'attract' | 'play' | 'over' | 'won'>('attract')
/** Entered from the portal's hut: the title stays hidden while the profile save syncs, then the run starts. */
const launching = ref(false)
const result = ref<{ reason: 'quit' | 'won'; elapsed: number; best: number | null } | null>(null)
const hasSave = ref(false)
const bestTime = ref<number | null>(null)
const isNewBest = ref(false)
const quest = ref<QuestSummary | null>(null)
const storedPilot = ref<string | null>(null)
/** The Hall of Fame player the save belongs to, once this browser has one. */
const pilot = computed(() => player.value?.name ?? storedPilot.value)

function refresh() {
  const save = readLocalSave()
  hasSave.value = save !== null
  quest.value = save ? summarizeSave(save) : null
  bestTime.value = readLocalBest()
  storedPilot.value = readStoredPlayer()?.name ?? null
}

/**
 * Brings this browser's save and the profile's copy into step: the newer
 * one wins, best times meet at the lower. Skipped for a browser with no
 * player yet — its first save creates one.
 */
async function syncWithProfile() {
  if (!profileSave.hasPlayer()) return
  let local = readLocalSave()
  if (local && !local.savedAt) {
    // A save from before profile sync: stamp it now so it counts.
    local = { ...local, savedAt: Date.now() }
    writeLocalSave(local)
  }
  const remote = await profileSave.pull()
  // A run that started meanwhile owns the save; its own writes go up.
  if (remote === 'offline' || phase.value !== 'attract') return
  const remoteData = remote?.data ? parseSave(remote.data) : null
  const action = reconcile(local, localSavedAt(local), remote, remoteData)
  if (action.kind === 'pull') {
    if (action.save) writeLocalSave({ ...action.save, savedAt: remote!.savedAt })
    else clearLocalSave(remote!.savedAt)
  } else if (action.kind === 'push') {
    profileSave.push({ data: action.save, savedAt: action.savedAt })
  }
  const localBest = readLocalBest()
  if (remote?.best != null && (localBest === null || remote.best < localBest)) writeLocalBest(remote.best)
  else if (localBest !== null && (remote?.best == null || localBest < remote.best)) profileSave.push({ savedAt: Date.now(), best: localBest })
  refresh()
}

function newGame() {
  const at = Date.now()
  clearLocalSave(at)
  if (profileSave.hasPlayer()) profileSave.push({ data: null, savedAt: at })
  refresh()
}

/** How long a portal launch counts as "just now", and how long the profile sync may hold the start. */
const LAUNCH_FRESH_MS = 10_000
const LAUNCH_SYNC_MS = 1500

/** True (once) when the portal's hut door just sent the visitor here. */
function takePortalLaunch(): boolean {
  const l = portalLaunch.value
  if (!l || l.theme !== 'zelda') return false
  portalLaunch.value = null
  return Date.now() - l.at < LAUNCH_FRESH_MS
}

onMounted(async () => {
  refresh()
  const fromPortal = takePortalLaunch()
  if (fromPortal) launching.value = true
  const sync = syncWithProfile()
  if (!fromPortal) return
  // Start on the newest save: wait (briefly) for the profile copy first.
  await Promise.race([sync.catch(() => {}), new Promise(r => setTimeout(r, LAUNCH_SYNC_MS))])
  launching.value = false
  game.value?.start()
})

onBeforeUnmount(() => {
  navigationLocked.value = false
})

function onPhase(p: typeof phase.value) {
  phase.value = p
  navigationLocked.value = p === 'play'
  if (p !== 'play') refresh()
}

function onResult(r: { reason: 'quit' | 'won'; elapsed: number; best: number | null }) {
  result.value = r
  isNewBest.value = r.reason === 'won' && r.best !== null && r.best === r.elapsed
  phase.value = r.reason === 'won' ? 'won' : 'over'
}
</script>

<style>
.zelda-title,
.zelda-panel {
  position: relative;
  pointer-events: none;
  padding: 0 22px;
  font-family: var(--font-machine);
  text-transform: uppercase;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.zelda-title {
  transform: translateY(-4vh);
}

/* A dark pool behind the title so it reads over the drifting world. */
.zelda-title::before {
  content: '';
  position: absolute;
  inset: -18% -30%;
  background: radial-gradient(closest-side, rgba(11, 6, 22, 0.82), rgba(11, 6, 22, 0.55) 60%, rgba(11, 6, 22, 0));
  z-index: -2;
}

@media (max-width: 480px) {
  .zelda-save-goal { display: none; }
  .zelda-kicker { letter-spacing: 0.2em; font-size: 10px; }
  .zelda-tagline { letter-spacing: 0.14em; font-size: 11px; }
  .zelda-start { font-size: 14px; letter-spacing: 0.16em; }
}

/* The striped synthwave sun behind the logo. */
.zelda-sun {
  position: absolute;
  left: 50%;
  top: -0.6em;
  width: min(62vw, 300px);
  aspect-ratio: 2 / 1;
  transform: translateX(-50%);
  border-radius: 300px 300px 0 0;
  background:
    repeating-linear-gradient(180deg, transparent 0 58%, #0b0616 58% 61%, transparent 61% 67%, #0b0616 67% 71%, transparent 71% 77%, #0b0616 77% 82%, transparent 82% 88%, #0b0616 88% 94%),
    linear-gradient(180deg, #ffd23f 0%, #ff8a3d 45%, #ff2fa0 80%, #b01874 100%);
  opacity: 0.85;
  filter: drop-shadow(0 0 28px rgba(255, 47, 160, 0.55));
  z-index: -1;
}

.zelda-sun--small {
  position: relative;
  top: 0;
  left: 0;
  transform: none;
  width: 120px;
  margin: 0 auto 0.6em;
}

.zelda-kicker {
  margin: 0 0 0.2em;
  font-size: 11px;
  letter-spacing: 0.34em;
  color: #2ff3ff;
  text-shadow: 0 0 10px rgba(47, 243, 255, 0.7);
}

.zelda-logo {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 0.92;
  font-weight: 700;
}

.zelda-logo-neon {
  font-family: var(--font-person);
  font-weight: 500;
  font-style: italic;
  font-size: clamp(30px, 8vw, 54px);
  letter-spacing: 0.08em;
  color: #fff4ff;
  text-shadow: 0 0 6px #ff2fa0, 0 0 18px #ff2fa0, 0 0 42px rgba(255, 47, 160, 0.8);
  transform: rotate(-4deg) translateY(0.12em);
}

.zelda-logo-shrine {
  font-size: clamp(46px, 15vw, 104px);
  letter-spacing: 0.06em;
  background: linear-gradient(180deg, #ffffff 0%, #cfe9ff 38%, #2ff3ff 50%, #7b3fe4 51%, #ff2fa0 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-stroke: 1px rgba(255, 255, 255, 0.35);
  filter: drop-shadow(0 3px 0 #0b0616) drop-shadow(0 0 16px rgba(47, 243, 255, 0.45));
}

.zelda-tagline {
  margin: 0.8em 0 1.4em;
  font-size: 12px;
  letter-spacing: 0.22em;
  color: #ffd23f;
  text-shadow: 0 0 10px rgba(255, 210, 63, 0.6);
}

.zelda-start {
  margin: 0.3em 0;
  font-size: 15px;
  letter-spacing: 0.2em;
  color: #ff2fa0;
  text-shadow: 0 0 10px rgba(255, 47, 160, 0.75);
  animation: zelda-blink 1.4s ease-in-out infinite alternate;
}

.zelda-keys {
  margin: 0.5em 0 0;
  font-size: 10px;
  letter-spacing: 0.14em;
  color: rgba(232, 246, 255, 0.55);
  max-width: 32em;
  line-height: 1.7;
}

.zelda-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 1em;
  pointer-events: auto;
}

.zelda-btn {
  font-family: var(--font-machine);
  font-size: 12px;
  letter-spacing: 0.14em;
  padding: 0.7em 1.2em;
  min-height: 44px;
  background: rgba(11, 6, 22, 0.7);
  border: 1px solid rgba(47, 243, 255, 0.6);
  border-radius: 6px;
  color: #2ff3ff;
  cursor: pointer;
}

.zelda-btn:hover {
  box-shadow: 0 0 14px rgba(47, 243, 255, 0.45);
}

.zelda-save,
.zelda-pilot {
  margin: 0.6em 0 0;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: #2ff3ff;
  text-shadow: 0 0 8px rgba(47, 243, 255, 0.55);
}

.zelda-pilot {
  margin-top: 0.3em;
  font-size: 10px;
  color: rgba(185, 168, 217, 0.85);
  text-shadow: none;
}

.zelda-best {
  margin: 1em 0 0;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: #ffd23f;
  text-shadow: 0 0 10px rgba(255, 210, 63, 0.6);
}

.zelda-panel {
  background: rgba(11, 6, 22, 0.72);
  border: 1px solid rgba(255, 47, 160, 0.45);
  border-radius: 12px;
  box-shadow: 0 0 30px rgba(255, 47, 160, 0.2);
  padding: 1.4em 1.8em 1.5em;
  max-width: min(90vw, 560px);
}

.zelda-panel-title {
  margin: 0 0 0.3em;
  font-size: clamp(24px, 7vw, 44px);
  letter-spacing: 0.1em;
  color: #ff2fa0;
  text-shadow: 0 0 12px rgba(255, 47, 160, 0.8), 0 0 40px rgba(255, 47, 160, 0.35);
}

.zelda-panel--won .zelda-panel-title {
  color: #ffd23f;
  text-shadow: 0 0 12px rgba(255, 210, 63, 0.8), 0 0 40px rgba(255, 138, 61, 0.4);
}

.zelda-time {
  margin: 0.2em 0 0.6em;
  font-size: 26px;
  letter-spacing: 0.12em;
  color: #2ff3ff;
  text-shadow: 0 0 10px rgba(47, 243, 255, 0.7);
}

@media (max-height: 480px) {
  .zelda-title { transform: none; }
  .zelda-logo-neon { font-size: 24px; }
  .zelda-logo-shrine { font-size: 44px; }
  .zelda-tagline { margin: 0.4em 0 0.6em; }
  .zelda-keys { display: none; }
  .zelda-sun { width: 180px; }
}

@keyframes zelda-blink {
  from { opacity: 0.5; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .zelda-start { animation: none; }
}
</style>
