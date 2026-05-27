<template>
  <div class="game-page">
    <header class="game-page__chrome">
      <NuxtLink to="/games" class="game-page__back">← games</NuxtLink>
      <div class="game-page__hud">
        <span class="game-page__hud-item">Wave <strong>{{ wave }}</strong></span>
        <span class="game-page__hud-item">Score <strong>{{ score }}</strong></span>
        <span v-if="lastDeath" class="game-page__hud-item">High <strong>{{ highScore }}</strong></span>
        <span v-if="!started" class="game-page__hud-hint">Press Enter to start</span>
        <span v-else-if="dead" class="game-page__hud-hint">Game over — Enter to restart</span>
      </div>
    </header>
    <div class="game-page__canvas-wrap">
      <SpaceInvadersGame
        @score="onScore"
        @death="onDeath"
        @restart="onRestart"
        @started="onStarted"
        @wave="onWave"
      />
      <transition name="wave-banner">
        <div v-if="waveBanner" class="game-page__wave-banner">
          Wave {{ toRoman(wave) }}
        </div>
      </transition>
    </div>
    <footer class="game-page__footer">
      <span>Arrows to move · space to fire · enter to restart</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
const score = ref(0)
const highScore = ref(0)
const started = ref(false)
const dead = ref(false)
const lastDeath = ref(false)
const wave = ref(1)
const waveBanner = ref(false)
let waveBannerTimer: ReturnType<typeof setTimeout> | null = null

const onScore = (n: number) => { score.value = n; if (n > highScore.value) highScore.value = n }
const onDeath = () => { dead.value = true; lastDeath.value = true }
const onRestart = () => { dead.value = false; score.value = 0; wave.value = 1 }
const onStarted = () => { started.value = true; dead.value = false; wave.value = 1 }
const onWave = (n: number) => {
  wave.value = n
  waveBanner.value = true
  if (waveBannerTimer) clearTimeout(waveBannerTimer)
  waveBannerTimer = setTimeout(() => { waveBanner.value = false }, 1500)
}

const toRoman = (n: number): string => {
  if (n <= 0) return ''
  const map: [number, string][] = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]
  let out = '', remaining = n
  for (const [v, s] of map) while (remaining >= v) { out += s; remaining -= v }
  return out
}

useHead({
  title: 'Space Invaders — phareim.no',
  meta: [{ name: 'theme-color', content: '#0e1219' }],
})

definePageMeta({ layout: false })  // bypass the default app shell — full screen game

if (import.meta.client) {
  const saved = localStorage.getItem('space-invaders-high')
  if (saved) highScore.value = parseInt(saved, 10) || 0
}
watch(highScore, (n) => {
  if (import.meta.client) localStorage.setItem('space-invaders-high', String(n))
})
</script>

<style scoped>
.game-page {
  position: fixed;
  inset: 0;
  background: #0e1219;
  color: #ebe4d4;
  display: flex;
  flex-direction: column;
  font-family: 'Source Serif 4', Georgia, serif;
}
.game-page__chrome {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(235, 228, 212, 0.15);
}
.game-page__back {
  font-size: 0.85rem;
  color: rgba(235, 228, 212, 0.75);
  text-decoration: none;
  border-bottom: 1px solid currentColor;
}
.game-page__back:hover { color: #d4a574; }
.game-page__hud { display: flex; gap: 1.5rem; align-items: baseline; font-size: 0.9rem; }
.game-page__hud-item { color: rgba(235, 228, 212, 0.75); }
.game-page__hud-item strong { color: #ebe4d4; font-weight: 600; margin-left: 0.25rem; }
.game-page__hud-hint { font-style: italic; color: #d4a574; }
.game-page__canvas-wrap { flex: 1; position: relative; overflow: hidden; }
.game-page__canvas-wrap > * { width: 100%; height: 100%; display: block; }
:deep(canvas) { width: 100%; height: 100%; display: block; }

.game-page__wave-banner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: clamp(3rem, 8vw, 6rem);
  font-style: italic;
  font-weight: 300;
  color: #d4a574;
  text-shadow: 0 0 24px rgba(212, 165, 116, 0.35);
  letter-spacing: 0.08em;
}
.wave-banner-enter-active, .wave-banner-leave-active { transition: opacity 0.3s ease; }
.wave-banner-enter-from, .wave-banner-leave-to { opacity: 0; }
.game-page__footer {
  padding: 0.75rem 1.5rem;
  border-top: 1px solid rgba(235, 228, 212, 0.15);
  font-size: 0.8rem;
  font-style: italic;
  color: rgba(235, 228, 212, 0.5);
  text-align: center;
}
</style>
