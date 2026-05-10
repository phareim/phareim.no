<template>
  <div class="almanac-paper" aria-hidden="true">
    <span class="almanac-star almanac-star-1"></span>
    <span class="almanac-star almanac-star-2"></span>
    <span class="almanac-star almanac-star-3"></span>
    <span class="almanac-star almanac-star-4"></span>
    <span class="almanac-star almanac-star-5"></span>
    <span class="almanac-star almanac-star-6"></span>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.almanac-paper {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.almanac-star {
  display: none;
}

@media (prefers-color-scheme: dark) {
  .almanac-star {
    display: block;
    position: absolute;
    width: 2px;
    height: 2px;
    border-radius: 50%;
    background: rgba(212, 165, 116, 0.55);
    box-shadow: 0 0 4px rgba(212, 165, 116, 0.25);
  }
  .almanac-star-1 { top: 14vh; left: 18vw; }
  .almanac-star-2 { top: 22vh; right: 13vw; opacity: 0.85; }
  .almanac-star-3 { top: 39vh; left: 8vw; opacity: 0.7; }
  .almanac-star-4 { top: 62vh; right: 24vw; opacity: 0.65; }
  .almanac-star-5 { top: 76vh; left: 32vw; opacity: 0.55; }
  .almanac-star-6 { top: 84vh; right: 9vw; opacity: 0.8; }
}
</style>
