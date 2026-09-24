<template>
  <Transition name="intercom">
    <div
      v-if="line"
      :key="line.id"
      class="intercom"
      :class="[`intercom--${line.who}`, { 'intercom--talking': typing }]"
      role="status"
      aria-live="polite"
    >
      <div class="intercom-portrait" aria-hidden="true">
        <svg v-if="line.who === 'claude'" viewBox="-20 -20 40 40" class="intercom-spark">
          <g class="intercom-spark-rays">
            <path
              v-for="i in 10"
              :key="i"
              :transform="`rotate(${i * 36 + (i % 2 ? 8 : 0)})`"
              :d="i % 2 ? 'M0 -3 L1.6 -9 L0 -16 L-1.6 -9 Z' : 'M0 -3 L1.3 -8 L0 -12 L-1.3 -8 Z'"
            />
          </g>
          <circle r="3.2" class="intercom-spark-core" />
        </svg>
        <svg v-else viewBox="-20 -20 40 40" class="intercom-choir">
          <circle r="15" />
          <circle r="10" />
          <circle r="5" />
          <path d="M-16 0 L-10 -4 L-6 5 L-2 -7 L2 7 L6 -5 L10 4 L16 0" />
        </svg>
      </div>
      <div class="intercom-body">
        <p class="intercom-who">{{ line.who === 'claude' ? 'CLAUDE · COMMS' : 'THE CHOIR · INTERCEPT' }}</p>
        <p class="intercom-text">
          <span>{{ line.text.slice(0, shown) }}</span><span v-if="typing" class="intercom-caret">▍</span><span class="intercom-ghost">{{ line.text.slice(shown) }}</span>
        </p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * The Galaga intercom: one line at a time from the story director
 * (story.ts), typed out, on a blueprint panel. Claude speaks in the
 * person voice (lowercase, Space Grotesk, cyan hairline); the Choir in the
 * machine voice (uppercase mono, pink). The untyped remainder is laid out
 * invisibly so the panel never changes size while typing.
 */
const props = defineProps<{
  line: { id: number; who: 'claude' | 'choir'; text: string } | null
  shown: number
}>()

const typing = computed(() => !!props.line && props.shown < props.line.text.length)
</script>

<style scoped>
.intercom {
  position: absolute;
  z-index: 3;
  left: 16px;
  bottom: calc(64px + var(--app-safe-bottom, 0px));
  width: min(400px, calc(100vw - 32px));
  box-sizing: border-box;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 14px 12px 10px;
  background: rgba(6, 3, 16, 0.78);
  border: 1px solid rgba(47, 243, 255, 0.45);
  border-radius: 4px;
  box-shadow: 0 0 24px rgba(47, 243, 255, 0.12);
  pointer-events: none;
  /* Corner ticks, blueprint style. */
  background-image:
    linear-gradient(#2ff3ff, #2ff3ff), linear-gradient(#2ff3ff, #2ff3ff),
    linear-gradient(#2ff3ff, #2ff3ff), linear-gradient(#2ff3ff, #2ff3ff);
  background-size: 10px 1px, 1px 10px, 10px 1px, 1px 10px;
  background-position: top left, top left, bottom right, bottom right;
  background-repeat: no-repeat;
}

.intercom--choir {
  border-color: rgba(255, 47, 160, 0.55);
  box-shadow: 0 0 24px rgba(255, 47, 160, 0.18);
  background-image:
    linear-gradient(#ff2fa0, #ff2fa0), linear-gradient(#ff2fa0, #ff2fa0),
    linear-gradient(#ff2fa0, #ff2fa0), linear-gradient(#ff2fa0, #ff2fa0);
}

/* Short landscape screens: a compact panel in the corner. */
@media (min-width: 641px) and (max-height: 520px) {
  .intercom {
    left: 10px;
    bottom: calc(10px + var(--app-safe-bottom, 0px));
    width: min(320px, 44vw);
    padding: 6px 10px 7px 6px;
    gap: 8px;
    background-color: rgba(6, 3, 16, 0.66);
  }
  .intercom-portrait { width: 28px !important; height: 28px !important; }
  .intercom-text { font-size: 12.5px !important; }
  .intercom--choir .intercom-text { font-size: 10.5px !important; }
}

/* Phones: under the HUD at the top, clear of the ship and the thumb. */
@media (max-width: 640px) {
  .intercom {
    left: 12px;
    right: 12px;
    width: auto;
    bottom: auto;
    top: calc(max(0.6rem, env(safe-area-inset-top)) + 78px);
    background-color: rgba(6, 3, 16, 0.66);
    padding: 8px 10px 9px 8px;
    gap: 10px;
  }
}

.intercom-portrait {
  flex: none;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(47, 243, 255, 0.3);
  border-radius: 3px;
  background:
    repeating-linear-gradient(0deg, rgba(47, 243, 255, 0.06) 0 1px, transparent 1px 3px),
    #0b0616;
  display: grid;
  place-items: center;
}
.intercom--choir .intercom-portrait {
  border-color: rgba(255, 47, 160, 0.4);
  background:
    repeating-linear-gradient(0deg, rgba(255, 47, 160, 0.08) 0 1px, transparent 1px 3px),
    #0b0616;
}
@media (max-width: 640px) {
  .intercom-portrait { width: 32px; height: 32px; }
}

.intercom-portrait svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.intercom-spark-rays path {
  fill: #ffd23f;
}
.intercom-spark-core {
  fill: #fff4c9;
}
.intercom-spark {
  filter: drop-shadow(0 0 4px rgba(255, 210, 63, 0.7));
}
.intercom-spark-rays {
  transform-origin: 0 0;
  animation: spark-turn 9s linear infinite;
}
.intercom--talking .intercom-spark-rays {
  animation: spark-turn 9s linear infinite, spark-talk 0.16s steps(2) infinite alternate;
}
@keyframes spark-turn {
  to { rotate: 360deg; }
}
@keyframes spark-talk {
  from { scale: 0.86; }
  to { scale: 1.08; }
}

.intercom-choir circle,
.intercom-choir path {
  fill: none;
  stroke: #ff2fa0;
  stroke-width: 1.4;
}
.intercom-choir circle:nth-child(1) { opacity: 0.35; }
.intercom-choir circle:nth-child(2) { opacity: 0.6; }
.intercom-choir {
  filter: drop-shadow(0 0 4px rgba(255, 47, 160, 0.8));
}
.intercom--talking .intercom-choir path {
  animation: choir-wave 0.12s steps(2) infinite alternate;
  transform-origin: 0 0;
}
@keyframes choir-wave {
  from { scale: 1 0.5; }
  to { scale: 1 1.3; }
}

.intercom-body {
  min-width: 0;
  flex: 1;
}

.intercom-who {
  margin: 0 0 3px;
  font-family: var(--font-machine);
  font-size: 10.4px;
  letter-spacing: 0.15em;
  color: #2ff3ff;
  opacity: 0.75;
}
.intercom--choir .intercom-who {
  color: #ff2fa0;
}

.intercom-text {
  margin: 0;
  font-family: var(--font-person);
  font-weight: 400;
  font-size: 15px;
  line-height: 1.35;
  color: #f2e9ff;
  text-align: left;
}
.intercom--choir .intercom-text {
  font-family: var(--font-machine);
  font-size: 13px;
  letter-spacing: 0.15em;
  color: #ff70bc;
  text-shadow: 0 0 10px rgba(255, 47, 160, 0.6);
}
@media (max-width: 640px) {
  .intercom-text { font-size: 13.5px; }
  .intercom--choir .intercom-text { font-size: 11.5px; }
}
.intercom--choir.intercom--talking .intercom-text {
  animation: choir-glitch 0.18s steps(2) infinite;
}
@keyframes choir-glitch {
  0% { transform: translateX(0); }
  50% { transform: translateX(1px); text-shadow: -1px 0 rgba(47, 243, 255, 0.5), 0 0 10px rgba(255, 47, 160, 0.6); }
}

.intercom-caret {
  color: #2ff3ff;
  animation: caret 0.5s steps(2) infinite;
}
.intercom--choir .intercom-caret { color: #ff2fa0; }
@keyframes caret {
  50% { opacity: 0; }
}

.intercom-ghost {
  visibility: hidden;
}

.intercom-enter-active {
  transition: opacity 0.32s, transform 0.32s cubic-bezier(0.2, 0.9, 0.2, 1);
}
.intercom-leave-active {
  transition: opacity 0.25s;
}
.intercom-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.intercom-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .intercom-spark-rays,
  .intercom--talking .intercom-spark-rays,
  .intercom--talking .intercom-choir path,
  .intercom--choir.intercom--talking .intercom-text,
  .intercom-caret {
    animation: none;
  }
  .intercom-enter-active { transition: opacity 0.2s; }
  .intercom-enter-from { transform: none; }
}
</style>
