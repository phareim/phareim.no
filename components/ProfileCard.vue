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
  transition: transform 8s;
  transition-timing-function: ease-out;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
  border: var(--theme-text, #222) 5px solid;
}
</style>
