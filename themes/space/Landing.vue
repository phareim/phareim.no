<template>
  <!-- The starfield is the theme's backdrop (see themes/index.ts), so it
       sits behind every route. The landing is the default shell on top. -->
  <DefaultLanding />
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
</script>
