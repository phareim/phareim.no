<template>
  <!-- Tiny sound on/off toggle shared by every game theme. Fixed above the
    canvas but below the pager (z-50), never intercepting game input except
    on itself. -->
  <button
    class="sound-toggle px-btn"
    type="button"
    :aria-label="muted ? 'Turn sound on' : 'Turn sound off'"
    :title="muted ? 'SOUND OFF' : 'SOUND ON'"
    @click="toggleMute"
  >
    {{ muted ? '♪ OFF' : '♪ ON' }}
  </button>
</template>

<script setup lang="ts">
import { useSound } from '~/composables/useSound'

const { muted, toggleMute } = useSound()
</script>

<style>
/* A .px-btn (themes/base/pixel/pixel.css) in the theme's muted colour. */
.sound-toggle.px-btn {
  position: fixed;
  left: 14px;
  bottom: calc(14px + var(--app-safe-bottom, 0px));
  z-index: 40;
  --px-edge: var(--theme-text-muted, #b9a8d9);
  opacity: 0.8;
}
.sound-toggle.px-btn:hover,
.sound-toggle.px-btn:focus-visible { opacity: 1; }
</style>
