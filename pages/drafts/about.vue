<template>
  <div :class="cx('page') + (activeTheme === 'scandi' ? ' scandi-gradient-warm' : '')">
    <div :class="cx('container') + ' about-layout'">

      <!-- Hero section -->
      <header :class="cx('stagger') + ' hero'">
        <h1 :class="cx('heading') + ' ' + cx('heading--xl') + ' ' + cx('animate-in')">
          About
        </h1>
        <!-- Dynamic political bar class based on theme -->
        <div :class="cx('bar') + ' ' + cx('animate-in')">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span v-if="activeTheme === 'scandi'"></span>
          <span v-if="activeTheme === 'scandi'"></span>
          <span v-if="activeTheme === 'scandi'"></span>
          <span v-if="activeTheme === 'scandi'"></span>
          <span v-if="activeTheme === 'scandi'"></span>
        </div>
      </header>

      <!-- Main content -->
      <main :class="cx('stagger') + ' content'">

        <!-- Bio card -->
        <article :class="cx('card') + ' bio-card ' + cx('animate-in')">
          <p :class="cx('body') + ' ' + cx('body--lg')">
            Some easter eggs in a trenchcoat, trying to look like a homepage.
          </p>
        </article>
      </main>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useTheme } from '~/composables/useTheme'

const { activeTheme, cx } = useTheme()

onMounted(() => {
  document.body.classList.remove('scrollable');
})
</script>

<style scoped>
.about-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-top: var(--space-lg);
  padding-bottom: var(--space-lg);
}

/* Hero */
.hero {
  text-align: center;
  margin-bottom: var(--space-lg);
}

/* Centering for all theme bars */
.scandi-bar,
.hacker-bar {
  margin-left: auto !important;
  margin-right: auto !important;
}

/* Bio card */
.bio-card {
  text-align: center;
  max-width: 640px;
  margin: 0 auto;
}

.bio-secondary {
  margin-top: var(--space-sm);
  font-size: 0.95rem;
  opacity: 0.8;
}

/* Mobile adjustments */
@media (max-width: 640px) {
  .bio-card {
    padding: var(--space-xs);
  }
}
</style>
