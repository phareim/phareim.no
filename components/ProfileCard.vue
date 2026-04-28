<template>
  <div
    class="flip-container"
    :class="{ 'is-flipped': flipped }"
    role="button"
    tabindex="0"
    :aria-label="flipped ? 'Profile photo (flipped) — click to flip back' : 'Profile photo — click to flip'"
    @click="emit('flip', $event)"
    @pointerdown="emit('flipStart', $event)"
    @pointerup="emit('flipStop', $event)"
    @keydown.enter.prevent="emit('flip', $event)"
    @keydown.space.prevent="emit('flip', $event)"
  >
    <div class="flipper">
      <div class="front" aria-hidden="true">
        <img
          class="profile-pic"
          src="/petter1.png"
          alt="Petter Hareim"
          @contextmenu.prevent
          @touchstart.prevent
        >
      </div>
      <div class="back" aria-hidden="true">
        <img
          class="profile-pic"
          src="/petter2.jpeg"
          alt="Petter Hareim, alternate photo"
          @contextmenu.prevent
          @touchstart.prevent
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ flipped?: boolean }>()
const emit = defineEmits<{
  flip: [event: Event]
  flipStart: [event: Event]
  flipStop: [event: Event]
}>()
</script>

<style scoped>
.flip-container {
  perspective: 1000px;
  height: 200px;
  width: 200px;
  margin-left: auto;
  margin-right: auto;
  cursor: pointer;
}

.flipper {
  transition: 1.2s;
  transform-style: preserve-3d;
  transition-timing-function: ease-in-out;
  position: relative;
}

.front, .back {
  backface-visibility: hidden;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.front {
  z-index: 2;
  transform: rotateY(0deg);
}

.back {
  transform: rotateY(180deg);
}

.flip-container:active .flipper,
.flip-container.is-flipped .flipper {
  transform: rotateY(180deg);
}

.flip-container:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 6px;
  border-radius: 50%;
}

.profile-pic {
  border-radius: 50%;
  width: 200px;
  height: 200px;
  transition: transform 8s ease-out, box-shadow 0.4s ease;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
  /* base ring — overridden per-theme below */
  border: 4px solid var(--theme-card-border, rgba(0, 0, 0, 0.15));
}

/* ── Scandi: frosted glass ring ─────────────────────────────── */
:global(.scandi-page) .profile-pic {
  border: 4px solid var(--theme-card-border, rgba(255, 255, 255, 0.4));
  box-shadow:
    0 4px 24px var(--theme-card-shadow, rgba(0, 0, 0, 0.06)),
    0 0 0 1px rgba(255, 255, 255, 0.15);
}

/* ── Hacker: neon pulse ring ────────────────────────────────── */
:global(.hacker-page) .profile-pic {
  border: 2px solid var(--theme-accent, #00ff41);
  box-shadow:
    0 0 10px var(--theme-card-shadow, rgba(0, 255, 65, 0.2)),
    0 0 28px rgba(0, 255, 65, 0.08);
  animation: hacker-ring-pulse 3s ease-in-out infinite;
}

@keyframes hacker-ring-pulse {
  0%, 100% {
    box-shadow:
      0 0 8px var(--theme-card-shadow, rgba(0, 255, 65, 0.2)),
      0 0 20px rgba(0, 255, 65, 0.05);
  }
  50% {
    box-shadow:
      0 0 20px var(--theme-card-shadow, rgba(0, 255, 65, 0.35)),
      0 0 44px rgba(0, 255, 65, 0.15);
  }
}

/* ── Space: stellar ambient glow ────────────────────────────── */
:global(.space-page) .profile-pic {
  border: 2px solid var(--theme-accent, #89abd0);
  box-shadow:
    0 0 16px var(--theme-card-shadow, rgba(140, 170, 220, 0.15)),
    0 4px 32px rgba(140, 170, 220, 0.07);
}

@media (prefers-reduced-motion: reduce) {
  :global(.hacker-page) .profile-pic {
    animation: none;
  }
}
</style>
