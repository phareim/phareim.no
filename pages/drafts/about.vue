<template>
  <div class="about-container">
    <div class="quirky-header">
      <h1 class="bouncy-title">
        <span class="letter" v-for="(letter, index) in titleLetters" :key="index" :style="{ animationDelay: index * 0.1 + 's' }">
          {{ letter }}
        </span>
      </h1>
    </div>
    
    <div class="content-wrapper">
      <div class="floating-bubble bubble-1">✨</div>
      <div class="floating-bubble bubble-2">🎨</div>
      <div class="floating-bubble bubble-3">🤖</div>
      <div class="floating-bubble bubble-4">💖</div>
      <div class="floating-bubble bubble-5">⚡</div>
      
      <div class="main-message">
        <p class="scrolling-text">
          this is a pet project, written with 
          <span class="highlight">love</span>, 
          <span class="highlight">spare time</span> 
          and a bit of 
          <span class="highlight glitch">AI</span>
        </p>
      </div>
      
      <div class="separator">
        <div class="wavy-line"></div>
      </div>
      
      <div class="peace-section">
        <p class="peace-message">
          <span class="peace-emoji">🕊️</span>
          peace to the world
          <span class="peace-emoji">🌍</span>
        </p>
        <p class="palestine-message">
          <span class="flag">🇵🇸</span>
          Free Palestine
          <span class="flag">🇵🇸</span>
        </p>
      </div>
      
      <div class="fun-facts">
        <div class="fact-item" @click="showRandomFact">
          <span class="fact-icon">🎲</span>
          <span class="fact-text">{{ currentFact }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const titleLetters = ref('About Me'.split(''))
const currentFact = ref('Click for a random fact!')

const funFacts = [
  'This site was coded with way too much coffee ☕',
  'Every pixel was placed with intention... mostly 🎯',
  'Built during late-night coding sessions 🌙',
  'Powered by curiosity and stubbornness 💪',
  'Made with Vue.js and a sprinkle of magic ✨',
  'Debugging is just problem-solving in disguise 🔍',
  'Code is poetry, but sometimes it rhymes weird 📝'
]

const showRandomFact = () => {
  const randomIndex = Math.floor(Math.random() * funFacts.length)
  currentFact.value = funFacts[randomIndex]
}

onMounted(() => {
  // Add some dynamic behavior on mount if needed
})
</script>

<style scoped>
.about-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
}

.quirky-header {
  margin-bottom: 2rem;
}

.bouncy-title {
  font-size: 4rem;
  font-weight: bold;
  color: #fff;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  margin: 0;
  display: flex;
  gap: 0.1em;
}

.letter {
  display: inline-block;
  animation: bounce 1.5s ease-in-out infinite;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}

.content-wrapper {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  width: 100%;
}

.floating-bubble {
  position: absolute;
  font-size: 2rem;
  animation: float 3s ease-in-out infinite;
  pointer-events: none;
}

.bubble-1 { top: 10%; left: 10%; animation-delay: 0s; }
.bubble-2 { top: 20%; right: 15%; animation-delay: 0.5s; }
.bubble-3 { bottom: 30%; left: 20%; animation-delay: 1s; }
.bubble-4 { top: 60%; right: 25%; animation-delay: 1.5s; }
.bubble-5 { bottom: 20%; right: 10%; animation-delay: 2s; }

@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(180deg); }
}

.main-message {
  margin: 3rem 0;
  text-align: center;
}

.scrolling-text {
  font-size: 2.5rem;
  color: #fff;
  font-weight: 300;
  line-height: 1.4;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
  animation: gentle-pulse 2s ease-in-out infinite;
}

.highlight {
  color: #ffd700;
  font-weight: bold;
  position: relative;
  z-index: 1;
}

.highlight::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: linear-gradient(90deg, #ffd700, #ffed4e);
  border-radius: 2px;
}

.glitch {
  animation: glitch 1s linear infinite;
}

@keyframes glitch {
  0%, 100% { transform: translate(0); }
  10% { transform: translate(-2px, 2px); }
  20% { transform: translate(2px, -2px); }
  30% { transform: translate(-2px, -2px); }
  40% { transform: translate(2px, 2px); }
  50% { transform: translate(-2px, 2px); }
  60% { transform: translate(2px, -2px); }
  70% { transform: translate(-2px, -2px); }
  80% { transform: translate(2px, 2px); }
  90% { transform: translate(-2px, 2px); }
}

@keyframes gentle-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

.separator {
  display: flex;
  justify-content: center;
  margin: 3rem 0;
}

.wavy-line {
  width: 200px;
  height: 4px;
  background: linear-gradient(90deg, #ffd700, #ffed4e, #ffd700);
  border-radius: 2px;
  animation: wave 2s ease-in-out infinite;
}

@keyframes wave {
  0%, 100% { transform: scaleX(1); }
  50% { transform: scaleX(1.2); }
}

.peace-section {
  text-align: center;
  margin: 2rem 0;
}

.peace-message, .palestine-message {
  font-size: 2rem;
  color: #fff;
  margin: 1rem 0;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
}

.peace-emoji, .flag {
  font-size: 1.2em;
  margin: 0 0.5rem;
  animation: rotate 3s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.fun-facts {
  margin-top: 4rem;
  display: flex;
  justify-content: center;
}

.fact-item {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 1.5rem 2rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 1rem;
  max-width: 500px;
}

.fact-item:hover {
  transform: translateY(-5px);
  background: rgba(255, 255, 255, 0.2);
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

.fact-icon {
  font-size: 1.5rem;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.fact-text {
  color: #fff;
  font-size: 1.2rem;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .bouncy-title {
    font-size: 2.5rem;
  }
  
  .scrolling-text {
    font-size: 1.5rem;
  }
  
  .peace-message, .palestine-message {
    font-size: 1.5rem;
  }
  
  .about-container {
    padding: 1rem;
  }
  
  .floating-bubble {
    font-size: 1.5rem;
  }
}
</style>