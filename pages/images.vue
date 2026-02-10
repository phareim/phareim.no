<template>
  <div class="images-page">
    <h1>Images</h1>
    <p>Welcome, {{ displayName }}.</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'owner-auth'
})

const { displayName } = useAuth()
</script>

<style scoped>
.images-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
  color: var(--theme-text, #333);
}

.images-page h1 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}
</style>
