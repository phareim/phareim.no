<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl mb-4">Images</h1>
    <p>Welcome, {{ displayName }}.</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'owner-auth'
})

const { displayName } = useAuth()
</script>
