<template>
  <DefaultLanding
    @overlay-click="bubbles?.addBubble($event)"
    @flip="bubbles?.flip($event)"
    @flip-start="bubbles?.flipStart($event)"
    @flip-stop="bubbles?.flipStop($event)"
  >
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
