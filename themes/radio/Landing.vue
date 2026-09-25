<template>
  <!-- The radio station's page: the generative radio from radio.phareim.no,
       listen-only. The engine, scene and controls load as their own chunk,
       client-side; the server paints the tuning-in shell. -->
  <div class="rd-landing">
    <ClientOnly>
      <Station />
      <template #fallback>
        <div class="rd-shell">
          <p class="rd-shell__title">RADIO</p>
          <p class="rd-shell__sub">TUNING IN...</p>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted } from 'vue'
import { getRadioEngine } from './engine'
import { MUTE_KEY } from './catalog'

const Station = defineAsyncComponent(() => import('./Station.vue'))

// The site radio (the six game stations) stays silent while the generative
// one is on the air, like the portal parks it for the town's music. Releasing
// resumes it only if it was playing and is not muted.
let parked = false

onMounted(() => {
  try {
    getRadioEngine().hold(true)
    parked = true
  } catch { /* no radio */ }
})

onBeforeUnmount(() => {
  if (!parked) return
  parked = false
  try {
    const r = getRadioEngine()
    r.hold(false)
    if (r.playing && localStorage.getItem(MUTE_KEY) !== '1') r.suspend(false)
  } catch { /* ignore */ }
})
</script>

<style scoped>
.rd-landing {
  height: var(--app-height, 100dvh);
  overflow: hidden;
  background: var(--theme-bg, #0b0616);
}

.rd-shell {
  height: 100%;
  display: grid;
  place-content: center;
  gap: 16px;
  text-align: center;
  font-family: var(--font-pixel);
  -webkit-font-smoothing: none;
}
.rd-shell p { margin: 0; }
.rd-shell__title {
  font-size: 48px;
  line-height: 48px;
  color: #ff2fa0;
  text-shadow: 6px 6px 0 #0b0616, 0 0 24px color-mix(in srgb, #ff2fa0 60%, transparent);
}
.rd-shell__sub {
  font-size: 16px;
  color: #2ff3ff;
  text-shadow: 2px 2px 0 #0b0616;
  animation: rd-shell-blink 1.1s steps(1) infinite;
}
@keyframes rd-shell-blink { 50% { opacity: 0.3; } }
@media (prefers-reduced-motion: reduce) { .rd-shell__sub { animation: none; } }
</style>
