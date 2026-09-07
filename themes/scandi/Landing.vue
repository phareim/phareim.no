<template>
  <DefaultLanding @overlay-click="bubbles?.addBubble($event)">
    <template #background>
      <Bubbles ref="bubbles" />
    </template>
  </DefaultLanding>
</template>

<script setup lang="ts">
import DefaultLanding from '~/themes/base/DefaultLanding.vue'
import Bubbles from './Bubbles.vue'

const bubbles = ref<InstanceType<typeof Bubbles> | null>(null)
</script>
