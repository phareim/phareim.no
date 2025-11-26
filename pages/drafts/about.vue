<template>
  <div :class="cx('page') + (activeTheme === 'scandi' ? ' scandi-gradient-warm' : '')">
    <div :class="cx('container') + ' about-layout'">
      
      <!-- Hero section -->
      <header :class="cx('stagger') + ' hero'">
        <h1 :class="cx('heading') + ' ' + cx('heading--xl') + ' ' + cx('animate-in')">
          About
        </h1>
        <!-- Dynamic political bar class based on theme -->
        <div :class="activeTheme === 'scandi' ? 'political-bar' : activeTheme === 'hacker' ? 'hacker-bar' : 'tolkien-bar' + ' ' + cx('animate-in')">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </header>

      <!-- Main content -->
      <main :class="cx('stagger') + ' content'">
        
        <!-- Bio card -->
        <article :class="cx('card') + ' bio-card ' + cx('animate-in')">
          <p :class="cx('body') + ' ' + cx('body--lg')">
            This is a pet project, written with <em>love</em>, <em>spare time</em>, 
            and a bit of <em>artificial intelligence</em>.
          </p>
          <p :class="cx('body') + ' bio-secondary'">
            Built during quiet evenings, powered by curiosity and coffee.
          </p>
        </article>

        <div :class="cx('divider') + ' ' + cx('animate-in')"></div>

        <!-- Values section -->
        <section :class="cx('animate-in') + ' values-section'">
          <h2 :class="cx('heading') + ' ' + cx('heading--md') + ' values-heading'">
            What matters
          </h2>
          
          <div class="values-grid">
            <div :class="cx('card') + ' ' + cx('card--flat') + ' value-item'">
              <span class="value-symbol">🕊️</span>
              <span class="value-text">Peace to the world</span>
            </div>
            
            <div :class="cx('card') + ' ' + cx('card--flat') + ' value-item value-item--highlight'">
              <span class="value-flag">🇵🇸</span>
              <span class="value-text">Free Palestine</span>
            </div>
            
            <div :class="cx('card') + ' ' + cx('card--flat') + ' value-item'">
              <span class="value-symbol">🌍</span>
              <span class="value-text">Climate justice</span>
            </div>
          </div>
        </section>

        <div :class="cx('divider') + ' ' + cx('animate-in')"></div>

        <!-- Fun fact section -->
        <section :class="cx('animate-in') + ' fact-section'">
          <button 
            :class="cx('interactive') + ' fact-button ' + cx('card')" 
            @click="showRandomFact"
          >
            <span class="fact-label">Random thought</span>
            <span class="fact-content">{{ currentFact }}</span>
            <span class="fact-hint">tap to shuffle</span>
          </button>
        </section>

      </main>

      <!-- Footer accent -->
      <footer :class="cx('animate-in') + ' footer'">
        <div class="footer-line"></div>
      </footer>

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

const facts = [
  'Every line of code tells a story',
  'Built during late-night sessions with good music',
  'Debugging is meditation in disguise',
  'Simplicity is the ultimate sophistication',
  'Powered by curiosity and stubbornness',
  'Made with Vue and a lot of iteration',
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
}
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
.political-bar,
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
  margin-bottom: var(--space-md);
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
    padding: var(--space-md);
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
