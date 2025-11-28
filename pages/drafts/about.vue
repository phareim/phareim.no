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
          <p :class="cx('body') + ' bio-secondary'">
            Composed mainly of claude and coffee.
          </p>
        </article>

        <section :class="cx('animate-in') + ' fact-section'">
          <button :class="cx('interactive') + ' fact-button ' + cx('card')" @click="showRandomFact">
            <span class="fact-content">{{ currentFact }}</span>
            <span class="fact-hint" v-if="firstFact">tap to update</span>
          </button>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useTheme } from '~/composables/useTheme'

const { activeTheme } = useTheme()

const cx = (suffix) => {
  return `${activeTheme.value}-${suffix}`
}
const firstFact = ref(true)
const facts = [
  'Design is never finished, only abandoned'
]

const currentFact = ref(facts[0])

const showRandomFact = () => {
  const currentIndex = facts.indexOf(currentFact.value)
  let newIndex = Math.floor(Math.random() * facts.length)
  while (newIndex === currentIndex && facts.length > 1) {
    newIndex = Math.floor(Math.random() * facts.length)
  }
  currentFact.value = facts[newIndex]
  firstFact.value = false
}

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
.hacker-bar,
.tolkien-bar {
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

/* Values */
.values-section {
  text-align: center;
}

.values-heading {
  margin-bottom: var(--space-sm);
  opacity: 0.7;
}

.values-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-sm);
}

.value-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  font-size: 1rem;
}

.value-item--highlight {
  background: rgba(0, 150, 57, 0.06);
  border-color: rgba(0, 150, 57, 0.15);
}

.value-symbol,
.value-flag {
  font-size: 1.2rem;
}

.value-text {
  opacity: 0.8;
}

/* Fact section */
.fact-section {
  margin-top: var(--space-md);
  display: flex;
  justify-content: center;
}

.fact-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 400px;
  padding: var(--space-sm);
}

.fact-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.6;
}

.fact-content {
  font-size: 1.1rem;
  line-height: 1.5;
}

.fact-hint {
  font-size: 0.7rem;
  opacity: 0.5;
  margin-top: 0.25rem;
}

/* Footer */
.footer {
  margin-top: var(--space-xl);
  display: flex;
  justify-content: center;
}

.footer-line {
  width: 40px;
  height: 2px;
  background: currentColor;
  opacity: 0.3;
  border-radius: 1px;
}

/* Mobile adjustments */
@media (max-width: 640px) {
  .bio-card {
    padding: var(--space-xs);
  }

  .values-grid {
    flex-direction: column;
    align-items: center;
  }

  .value-item {
    width: 100%;
    max-width: 280px;
    justify-content: center;
  }

  .fact-button {
    padding: var(--space-md);
  }
}
</style>
