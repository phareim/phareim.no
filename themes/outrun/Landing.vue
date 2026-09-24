<template>
  <DefaultLanding>
    <template #background>
      <OutRun @phase="onPhase" @over="onOver" />
    </template>

    <template #body>
      <div v-if="phase === 'attract'" class="outrun-title-block">
        <h1 class="outrun-logo">OUTRUN</h1>
        <p class="px-hud outrun-tag">FIFTEEN ROADS · FIVE ENDINGS · ONE CLOCK</p>
        <div class="outrun-plate">
          <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO DRIVE', 'TAP TO DRIVE') }} ◀</p>
          <p class="px-hint px-dim">{{ hint('↑ GAS · ↓ BRAKE · ← → STEER · M RADIO', 'DRAG TO STEER · 2ND FINGER BRAKES') }}</p>
          <p v-if="highScore > 0" class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
        </div>
      </div>
      <div v-else-if="phase === 'over' && result" class="outrun-over">
        <h1 class="px-title">{{ title }}</h1>
        <p v-if="ending" class="px-hud outrun-ending">{{ ending }}</p>
        <p class="px-hud">SCORE {{ result.score }}</p>
        <table class="outrun-splits">
          <tr v-for="(name, i) in result.route" :key="i">
            <td class="outrun-splits-n">{{ i + 1 }}</td>
            <td>{{ name }}</td>
            <td class="outrun-splits-t">{{ i < result.splits.length ? lap(result.splits[i]) : '' }}</td>
          </tr>
        </table>
        <p v-if="isNewHigh" class="px-hud px-blink" style="--px-hud: #ffd23f">NEW HIGH SCORE!</p>
        <p v-else class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
        <p v-if="rank" class="px-hud px-dim">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
        <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO DRIVE AGAIN', 'TAP TO DRIVE AGAIN') }} ◀</p>
      </div>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import OutRun from './OutRun.vue'
import type { OutrunResult } from './engine'

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
const { hint } = useInputMode()

const phase = ref<'attract' | 'radio' | 'play' | 'over'>('attract')
const result = ref<OutrunResult | null>(null)
const highScore = ref(0)
const isNewHigh = ref(false)

/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'outrun' && result.value && lastSubmission.value.score === result.value.score ? lastSubmission.value : null)

/** One line of epilogue per road the goal can be reached on (the fifth column, easiest to hardest). */
const ENDINGS = [
  'THE BOULEVARD TURNS ITS LIGHTS ON FOR YOU, ONE BY ONE.',
  'YOU PARK AT THE WATER AND WATCH THE SUN REFUSE TO SET.',
  'A TROPHY IN THE SAND, AND NOBODY FOR A HUNDRED MILES.',
  'ABOVE THE CLOUDS NOW. THE RADIO IS STILL PLAYING.',
  'THE HARDEST ROAD. THE CROWD WAITED ALL NIGHT FOR YOU.',
]
const ending = computed(() => (result.value?.reason === 'goal' ? ENDINGS[result.value.node] ?? '' : ''))

/** Stage time the way the cabinet shows it: 1'04"37. */
function lap(t: number) {
  const m = Math.floor(t / 60)
  const sec = Math.floor(t % 60)
  const cs = Math.floor((t * 100) % 100)
  return `${m}'${String(sec).padStart(2, '0')}"${String(cs).padStart(2, '0')}`
}

const title = computed(() => {
  if (!result.value) return ''
  if (result.value.reason === 'goal') return 'GOAL'
  if (result.value.reason === 'timeup') return 'TIME UP'
  return 'GAME OVER'
})

onMounted(() => {
  highScore.value = parseInt(localStorage.getItem('outrunHighScore') || '0', 10) || 0
})

// The game owns the arrows while the radio screen or a run is up.
onBeforeUnmount(() => { navigationLocked.value = false })

function onPhase(p: typeof phase.value) {
  phase.value = p
  navigationLocked.value = p === 'radio' || p === 'play'
  if (p !== 'over') isNewHigh.value = false
}

function onOver(r: OutrunResult) {
  result.value = r
  if (r.score > 0) submitScore('outrun', r.score)
  isNewHigh.value = r.score > highScore.value && r.score > 0
  if (isNewHigh.value) {
    highScore.value = r.score
    localStorage.setItem('outrunHighScore', String(r.score))
  }
}
</script>

<style>
/* Text styles: themes/base/pixel/pixel.css (.px-*); Neon Shrine's dialog box for the plates. */
.outrun-title-block,
.outrun-over {
  pointer-events: none;
  padding: 0 16px;
}

/* The logo sits in the sky, over the sun, like the cabinet's title screen;
   the call to action gets a dialog box so the road does not eat it. */
.outrun-title-block {
  position: absolute;
  left: 0;
  right: 0;
  top: 9vh;
}
.outrun-plate,
.outrun-over {
  background: rgba(11, 6, 22, 0.86);
  border: 2px solid #ff2fa0;
  border-radius: 0;
  box-shadow: 0 0 0 2px #0b0616, inset 0 2px 0 rgba(255, 255, 255, 0.08);
}
.outrun-plate {
  display: inline-block;
  margin-top: 16px;
  padding: 10px 18px 12px;
}
.outrun-plate .px-hint {
  margin-top: 0;
}
.outrun-over {
  padding: 16px 20px 18px;
  max-width: min(94vw, 560px);
  box-sizing: border-box;
}
@media (max-width: 600px) {
  .outrun-over {
    padding: 12px 8px 14px;
  }
}

.landing .outrun-logo {
  font-family: var(--font-pixel);
  font-weight: 400;
  -webkit-font-smoothing: none;
  font-size: 64px;
  line-height: 1;
  color: #ff2fa0;
  text-shadow: 8px 8px 0 #0b0616, 0 0 32px rgba(255, 47, 160, 0.55);
  margin: 0 0 0.15em;
  transform: skewX(-10deg);
}
@media (min-width: 800px) {
  .landing .outrun-logo {
    font-size: 96px;
    text-shadow: 12px 12px 0 #0b0616, 0 0 40px rgba(255, 47, 160, 0.55);
  }
}

.landing .outrun-tag {
  --px-hud: #ffd23f;
}

.landing .outrun-ending {
  --px-hud: #ffd23f;
  line-height: 1.5;
  margin: 0 auto 0.8em;
  max-width: 34em;
  text-wrap: balance;
}

/* The lap table: stage, road, time. */
.outrun-splits {
  margin: 0.6em auto 0.6em;
  border-collapse: collapse;
  font-family: var(--font-pixel);
  -webkit-font-smoothing: none;
  font-size: 16px;
  color: #2ff3ff;
  text-shadow: 2px 2px 0 #0b0616;
}
.outrun-splits td {
  padding: 2px 8px;
  text-align: left;
  white-space: nowrap;
}
.outrun-splits .outrun-splits-n {
  color: #ff2fa0;
}
.outrun-splits .outrun-splits-t {
  text-align: right;
  color: #f2e9ff;
}
</style>
