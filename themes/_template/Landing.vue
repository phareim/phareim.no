<template>
  <!--
    Starting point for a new theme. Three levels of ambition:

    1. Colours only: leave this file as-is and edit theme.css.
    2. Add a background, keep the content: fill the #background slot.
       DefaultLanding emits overlay-click / flip / flip-start / flip-stop
       if the background wants to react (see themes/scandi).
    3. Own the page: drop DefaultLanding and render whatever you like.
       The only contract is that the root fills the viewport and does not
       scroll — the shell still draws the ThemePager on top.
  -->
  <DefaultLanding>
    <!--
    <template #background>
      <MyCanvas />
    </template>
    -->
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'

// If the theme takes over ArrowLeft/ArrowRight or horizontal touch
// (a game, a slider), lock the shell's navigation while it does:
//
// const { navigationLocked } = useTheme()
// navigationLocked.value = true   // while the game runs
// onBeforeUnmount(() => { navigationLocked.value = false })
</script>
