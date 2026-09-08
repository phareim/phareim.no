<template>
  <div class="landing">
    <!-- Anything behind the content: canvas, video, texture. -->
    <slot name="background" />

    <div class="landing-overlay" @click="emit('overlay-click', $event)">
      <div class="landing-home">
        <!-- The landing carries no profile any more (2026-09-07): themes
          fill these slots with their own content, usually a game HUD. -->
        <slot name="card" />
        <slot name="body" />
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The default landing shell. A theme can use it as-is (see tufte), wrap it
 * with a background and hook into its events (scandi, space), replace
 * individual slots (galaga), or skip it and render its own page entirely.
 */
import { profile, type LandingContent } from '~/themes/content'

withDefaults(defineProps<{
  content?: LandingContent
  /** Class applied to whatever a theme puts in the slots (e.g. to fade it). */
  contentClass?: string | Record<string, boolean>
}>(), {
  content: () => profile,
  contentClass: '',
})

const emit = defineEmits<{
  'overlay-click': [event: MouseEvent]
}>()
</script>

<style>
.landing {
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  touch-action: none;
}

.landing-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2;
}

.landing-home {
  text-align: center;
  max-width: min(600px, 100%);
  box-sizing: border-box;
  padding: 0 12px;
  margin: 0 auto;
}

.landing h1 {
  /* Scales with the viewport below 800px so the name stays on one line on phones. */
  font-size: clamp(2.4em, 12.5vw, 3.5em);
  margin-top: 2px;
}

.landing p {
  font-size: 1em;
}

@media (min-width: 800px) {
  .landing .blurb {
    font-size: 1.2em;
  }
  .landing h1 {
    margin-top: 0.1em;
    font-size: 4em;
  }
}

.landing .location {
  font-size: 0.7em;
}

.landing .social-links {
  text-align: center;
}
</style>
