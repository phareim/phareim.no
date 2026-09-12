<template>
  <!-- Tiny sound on/off toggle shared by every game theme. Fixed above the
    canvas but below the pager (z-50), never intercepting game input except
    on itself. -->
  <button
    class="sound-toggle"
    type="button"
    :aria-label="muted ? 'Turn sound on' : 'Turn sound off'"
    :title="muted ? 'SOUND OFF' : 'SOUND ON'"
    @click="toggleMute"
  >
    {{ muted ? '🔇 OFF' : '🔊 ON' }}
  </button>
</template>

<script setup lang="ts">
import { useSound } from '~/composables/useSound'

const { muted, toggleMute } = useSound()
</script>

<style>
.sound-toggle {
  position: fixed;
  left: 12px;
  bottom: 12px;
  z-index: 40;
  font-family: var(--font-machine, monospace);
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--theme-text-muted, #b9a8d9);
  background: transparent;
  border: 1px solid var(--theme-card-border, rgba(255, 255, 255, 0.2));
  border-radius: 999px;
  padding: 4px 10px;
  cursor: pointer;
  opacity: 0.7;
}
.sound-toggle:hover,
.sound-toggle:focus-visible {
  opacity: 1;
  outline: none;
  border-color: var(--theme-accent, #2ff3ff);
}
</style>
