<template>
  <div class="flip-container" :class="{ 'is-flipped': flipped }" @click="flip" @pointerdown="flipStart" @pointerup="flipStop">
    <div class="flipper">
      <div class="front">
        <img class="profile-pic" src="/petter1.png" alt="petter's profile picture" 
             oncontextmenu="return false;" ontouchstart="return false;">
      </div>
      <div class="back">
        <img class="profile-pic" src="/petter2.jpeg" alt="Bakside" 
             oncontextmenu="return false;" ontouchstart="return false;">
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ProfileCard',
  props: {
    flipped: { type: Boolean, default: false }
  },
  methods: {
    flip(event) {
      this.$emit('flip', event)
    },
    flipStart(event) {
      this.$emit('flipStart', event)
    },
    flipStop(event) {
      this.$emit('flipStop', event)
    }
  }
}
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
