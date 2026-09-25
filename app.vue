<template>
  <div :class="themePageClass">
    <component :is="theme.backdrop" v-if="theme.backdrop" />
    <NuxtPage />
    <HomeChip />
    <!-- The portal plays its own town music (it parks the radio) and its name
      billboard sits where the widget would; the radio returns in the games.
      The radio theme is a radio of its own (`ownRadio`). -->
    <RadioWidget v-if="!isHome && !theme.ownRadio" />
  </div>
</template>

<script setup lang="ts">
const { theme, isHome, themePageClass, themeColor } = useTheme()
useThemeNavigation()

// The portal carries the site's name; a game names itself, so history and
// tabs read "Galaga — phareim.no". Description and og tags: nuxt.config.ts.
useHead({
  title: computed(() => isHome.value ? 'Petter Hareim — phareim.no' : `${theme.value.name} — phareim.no`),
  meta: [
    { name: 'theme-color', content: themeColor }
  ]
})

</script>

<style>
/* The document never scrolls (2026-09-05): every landing is locked to the
   viewport. Since 2026-09-07 the site is landings only — the three content
   routes that needed an inner scroller are gone. */
/* The screen height every landing fills. In an iOS home-screen app with the
   black-translucent status bar, Safari starts the page under the status bar
   but still sizes 100dvh (and 100%) as if it did not, so a status-bar-high
   strip stays blank at the bottom; there it adds the top inset back. */
:root {
  --app-height: 100dvh;
  /* The bottom band: nothing interactive or meaning-bearing (buttons, text,
     the player's ship) sits lower than this above the bottom edge; backdrops
     may run through it. In a browser tab it is the safe-area inset. */
  --app-safe-bottom: env(safe-area-inset-bottom, 0px);
}

/* Installed as a web app the page reaches the very bottom of the screen, where
   the home indicator and the system swipe gestures live. */
@media (display-mode: standalone), (display-mode: fullscreen) {
  :root {
    --app-safe-bottom: max(48px, calc(env(safe-area-inset-bottom, 0px) + 30px));
  }
}

@supports (-webkit-touch-callout: none) {
  @media (display-mode: standalone), (display-mode: fullscreen) {
    :root {
      --app-height: calc(100dvh + env(safe-area-inset-top, 0px));
    }
  }
}

html {
  background: #0b0616;
}

html,
body {
  height: var(--app-height);
  overflow: hidden;
  overscroll-behavior: none;
  /* No double-tap zoom (Safari ignores user-scalable=no); pinch still works outside the games. */
  touch-action: manipulation;
  user-select: none;
  font-family: var(--font-person, system-ui, sans-serif);
  font-weight: 300;
  padding: 0;
  margin: 0;
}

#__nuxt {
  height: var(--app-height);
  overflow: hidden;
}

h1 {
  font-size: 4rem;
  font-weight: 300;
  letter-spacing: -0.01em;
  margin: 0;
  padding: 0;
}
</style>
