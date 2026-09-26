<template>
  <!-- A JA/NEI question over everything. -->
  <div class="fg-ask-layer" role="alertdialog" :aria-label="text">
    <div class="px-box fg-box fg-ask">
      <p class="fg-h fg-ask-text">{{ text }}</p>
      <div class="fg-row fg-row--center">
        <button ref="noRef" type="button" class="px-btn fg-btn fg-btn--plain fg-btn--big" @click="$emit('no')">
          <FgIcon id="close" :scale="2" />NEI
        </button>
        <button type="button" class="px-btn fg-btn fg-btn--danger fg-btn--big" @click="$emit('yes')">
          <FgIcon id="check" :scale="2" />JA
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import FgIcon from './FgIcon.vue'

defineProps<{ text: string }>()
defineEmits<{ yes: []; no: [] }>()
const noRef = ref<HTMLButtonElement | null>(null)
onMounted(() => noRef.value?.focus({ preventScroll: true }))
</script>

<style scoped>
.fg-ask-layer {
  position: absolute;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 16px calc(16px + var(--app-safe-bottom, 0px));
  background: rgba(42, 23, 68, 0.4);
}
.fg-ask {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 420px;
  padding: 22px 18px 20px;
}
.fg-ask-text { text-align: center; overflow-wrap: anywhere; }
</style>
