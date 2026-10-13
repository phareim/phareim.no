<template>
  <DefaultLanding>
    <template #background>
      <OutRun @phase="onPhase" @over="onOver" />
    </template>

    <template #body>
      <div v-if="phase === 'attract'" class="drive-title-block">
        <h1 class="drive-logo">
          <span class="drive-logo-names">NOVA &amp; REX'</span>
          <span class="drive-logo-road">DRIVE TO THE MOUNTAINS</span>
        </h1>
        <p class="px-hud drive-tag">FIFTEEN ROADS · FIVE MOUNTAINS · ONE NIGHT</p>
        <div class="drive-plate">
          <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO DRIVE', 'TAP TO DRIVE') }} ◀</p>
          <p class="px-hint px-dim">{{ hint('↑ GAS · ↓ BRAKE · ← → STEER · M TAPE', 'DRAG TO STEER · 2ND FINGER BRAKES') }}</p>
          <p v-if="highScore > 0" class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
          <p class="px-hud drive-maker">(C) 1Q89 SLEEPY PRODUCTIONS</p>
        </div>
      </div>
      <div v-else-if="phase === 'over' && result" class="drive-over">
        <h1 class="px-title">{{ title }}</h1>
        <p v-if="ending" class="px-hud drive-ending">{{ ending }}</p>
        <p class="px-hud">SCORE {{ result.score }}</p>
        <table class="drive-splits">
          <tr v-for="(name, i) in result.route" :key="i">
            <td class="drive-splits-n">{{ i + 1 }}</td>
            <td>{{ name }}</td>
            <td class="drive-splits-t">{{ i < result.splits.length ? lap(result.splits[i]) : '' }}</td>
          </tr>
        </table>
        <p v-if="isNewHigh" class="px-hud px-blink" style="--px-hud: #ffe45c">NEW HIGH SCORE!</p>
        <p v-else class="px-hud px-dim">HIGH SCORE {{ highScore }}</p>
        <p v-if="rank" class="px-hud px-dim">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</p>
        <p class="px-hint px-blink">▶ {{ hint('PRESS ENTER TO DRIVE AGAIN', 'TAP TO DRIVE AGAIN') }} ◀</p>
      </div>
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import type { OutrunResult } from './engine'

/** The game is its own chunk (2026-09-30): the landing is the title screen. */
const OutRun = defineAsyncComponent(() => import('./OutRun.vue'))

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
const { hint } = useInputMode()

const phase = ref<'attract' | 'radio' | 'play' | 'over'>('attract')
const result = ref<OutrunResult | null>(null)
const highScore = ref(0)
const isNewHigh = ref(false)

/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'outrun' && result.value && lastSubmission.value.score === result.value.score ? lastSubmission.value : null)

/** One line of epilogue per road the mountains can be reached on (the fifth column, easiest to hardest). */
const ENDINGS = [
  'A VALLEY FULL OF RED TREES. REX FINDS THE ONLY DINER IN IT.',
  'THE CABIN HAS A STOVE, A PORCH AND NO PHONE. PERFECT.',
  'GRANITE ON BOTH SIDES. THE TAPE TURNS OVER TO SIDE B.',
  'FIRST SNOW OF 1989. AGAIN. REX BUILDS A SNOW PIZZA.',
  'TOP OF THE WORLD. NOVA SAYS IT IS A HILL. IT IS FINE.',
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
  if (result.value.reason === 'goal') return 'THE MOUNTAINS'
  if (result.value.reason === 'timeup') return 'OUT OF NIGHT'
  return 'GAME OVER'
})

onMounted(() => {
  highScore.value = parseInt(localStorage.getItem('outrunHighScore') || '0', 10) || 0
})

// The game owns the arrows while the tape screen or a run is up.
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
/* Text styles: themes/base/pixel/pixel.css (.px-*). The panels are the talk box of
   Nova's Solo Rescue: a flat night-blue field, a dark line, a cream line. No glow. */
.drive-title-block,
.drive-over {
  pointer-events: none;
  padding: 0 16px;
  --px-hud: #ffe9c4;
  --px-hint: #ffe45c;
  --px-title: #ffe45c;
  --px-dim: #8a90b8;
}
/* The shared text styles glow; this board's lettering has a hard shadow and nothing else. */
.landing .drive-title-block .px-hud,
.landing .drive-title-block .px-hint,
.landing .drive-over .px-hud,
.landing .drive-over .px-hint {
  text-shadow: 2px 2px 0 #0a0c1e;
}
.landing .drive-over .px-title {
  text-shadow: 6px 6px 0 #0a0c1e;
}

/* The name sits in the sky over the road, like the cabinet's title screen; the
   call to action gets a box so the road does not eat it. */
.drive-title-block {
  position: absolute;
  left: 0;
  right: 0;
  top: 7vh;
}
.drive-plate,
.drive-over {
  background: #141a3c;
  border: 2px solid #ffe9c4;
  border-radius: 0;
  box-shadow: 0 0 0 2px #0a0c1e;
}
.drive-plate {
  display: inline-block;
  margin-top: 16px;
  padding: 10px 18px 12px;
}
.drive-plate .px-hint {
  margin-top: 0;
}
.drive-over {
  padding: 16px 20px 18px;
  max-width: min(94vw, 560px);
  box-sizing: border-box;
}
@media (max-width: 600px) {
  .drive-over {
    padding: 12px 8px 14px;
  }
}

/* Two rows: who, in cream with an edge of jacket red, and where to, in gold. Hard
   shadows only, a whole font pixel (an eighth of an em) at a time. */
.landing .drive-logo {
  font-family: var(--font-pixel);
  font-weight: 400;
  -webkit-font-smoothing: none;
  line-height: 1;
  margin: 0 0 0.6em;
  transform: skewX(-8deg);
}
.drive-logo span {
  display: block;
}
.drive-logo-names {
  font-size: 40px;
  color: #ffe9c4;
  text-shadow: 0.125em 0.125em 0 #e2343f, 0.25em 0.25em 0 #0a0c1e;
  margin-bottom: 14px;
}
.drive-logo-road {
  font-size: 16px;
  color: #ffe45c;
  text-shadow: 0.125em 0.125em 0 #0a0c1e;
}
@media (min-width: 800px) {
  .drive-logo-names {
    font-size: 72px;
    margin-bottom: 24px;
  }
  .drive-logo-road {
    font-size: 40px;
  }
}

.landing .drive-tag {
  --px-hud: #ffe9c4;
}

/* The maker's line, at the foot of the plate. */
.landing .drive-plate .drive-maker {
  --px-hud: #8a90b8;
  margin: 10px 0 0;
}

.landing .drive-ending {
  --px-hud: #ffe45c;
  line-height: 1.5;
  margin: 0 auto 0.8em;
  max-width: 34em;
  text-wrap: balance;
}

/* The lap table: stage, road, time. */
.drive-splits {
  margin: 0.6em auto 0.6em;
  border-collapse: collapse;
  font-family: var(--font-pixel);
  -webkit-font-smoothing: none;
  font-size: 16px;
  color: #ffe9c4;
  text-shadow: 2px 2px 0 #0a0c1e;
}
.drive-splits td {
  padding: 2px 8px;
  text-align: left;
  white-space: nowrap;
}
.drive-splits .drive-splits-n {
  color: #e2343f;
}
.drive-splits .drive-splits-t {
  text-align: right;
  color: #ffe45c;
}
</style>
