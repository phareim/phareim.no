<template>
  <div class="weather-container">
    <h1>Animated Weather</h1>
    
    <div class="controls">
      <button 
        v-for="type in weatherTypes" 
        :key="type"
        @click="setActiveWeather(type)"
        :class="{ active: activeWeather === type }"
        aria-label="Show weather animation for type"
      >
        {{ type }}
      </button>
    </div>
    
    <div class="card-wrapper">
      <transition name="fade" mode="out-in">
        <!-- Wind Card -->
        <div v-if="activeWeather === 'wind'" key="wind" class="weather-card wind">
          <h2>Wind</h2>
          <div class="animation-container">
            <div class="cloud cloud-1"></div>
            <div class="cloud cloud-2"></div>
            <div class="tree">
              <div class="trunk"></div>
              <div class="leaves"></div>
            </div>
            <div class="wind-lines">
              <div class="wind-line"></div>
              <div class="wind-line"></div>
              <div class="wind-line"></div>
            </div>
          </div>
        </div>
        
        <!-- Rain Card -->
        <div v-else-if="activeWeather === 'rain'" key="rain" class="weather-card rain">
          <h2>Rain</h2>
          <div class="animation-container">
            <div class="cloud rain-cloud"></div>
            <div class="raindrops">
              <div v-for="n in 20" :key="`raindrop-${n}`" class="raindrop"></div>
            </div>
            <div class="puddle"></div>
          </div>
        </div>
        
        <!-- Sun Card -->
        <div v-else-if="activeWeather === 'sun'" key="sun" class="weather-card sun">
          <h2>Sun</h2>
          <div class="animation-container">
            <div class="sun-circle">
              <div class="sun-rays"></div>
              <div class="sun-face"></div>
              <div class="sun-smile"></div>
            </div>
            <div class="heat-wave"></div>
          </div>
        </div>
        
        <!-- Snow Card -->
        <div v-else-if="activeWeather === 'snow'" key="snow" class="weather-card snow">
          <h2>Snow</h2>
          <div class="animation-container">
            <div class="cloud snow-cloud"></div>
            <div class="snowflakes">
              <div v-for="n in 30" :key="`snowflake-${n}`" class="snowflake"></div>
            </div>
            <div class="snow-ground"></div>
          </div>
        </div>

        <!-- Default Card - Welcome -->
        <div v-else key="welcome" class="weather-card welcome">
          <h2>Welcome</h2>
          <div class="animation-container welcome-container">
            <div class="welcome-text">
              <p>Select a weather type above to see the animation</p>
              <div class="weather-icons">
                <span>🌧️</span>
                <span>☀️</span>
                <span>❄️</span>
                <span>💨</span>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      weatherTypes: ['wind', 'rain', 'sun', 'snow'],
      activeWeather: null
    }
  },
  methods: {
    setActiveWeather(type) {
      this.activeWeather = type === this.activeWeather ? null : type;
    }
  },
  mounted() {
    // Set random positions for elements when they become visible
    this.$watch('activeWeather', (newType) => {
      this.$nextTick(() => {
        if (newType === 'rain') {
          const raindrops = document.querySelectorAll('.raindrop');
          raindrops.forEach((drop) => {
            drop.style.setProperty('--i', Math.floor(Math.random() * 20));
            drop.style.setProperty('--j', Math.floor(Math.random() * 10));
            drop.style.animationDelay = `${Math.random() * 1.5}s`;
            drop.style.left = `${Math.random() * 100}%`;
          });
        } else if (newType === 'snow') {
          const snowflakes = document.querySelectorAll('.snowflake');
          snowflakes.forEach((flake) => {
            flake.style.setProperty('--i', Math.floor(Math.random() * 20));
            flake.style.setProperty('--j', Math.floor(Math.random() * 10));
            flake.style.animationDelay = `${Math.random() * 6}s`;
            flake.style.left = `${Math.random() * 100}%`;
          });
        }
      });
    });
    
    // Check for system dark/light mode preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.querySelector('.weather-container').classList.add('light-theme');
    }
    
    // Check for reduced motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelector('.weather-container').classList.add('reduced-motion');
    }
  }
}
</script>

<style scoped>
.weather-container {
  font-family: 'Arial', sans-serif;
  max-width: 100%;
  margin: 0 auto;
  padding: 20px;
  background-color: #1a1a2e;
  color: white;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  transition: all 0.5s ease;
}

/* Light theme support */
.weather-container.light-theme {
  background-color: #e6f2ff;
  color: #333;
}

h1 {
  text-align: center;
  margin-bottom: 30px;
  color: #e2e2e2;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
  font-size: clamp(1.5rem, 5vw, 2.5rem);
}

.light-theme h1 {
  color: #333;
  text-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
}

.controls {
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
  gap: 15px;
  flex-wrap: wrap;
}

button {
  padding: 12px 20px;
  background-color: #0f3460;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: capitalize;
  font-size: 1rem;
  min-width: 80px;
}

.light-theme button {
  background-color: #3498db;
}

button:hover {
  background-color: #16213e;
  transform: translateY(-2px);
}

.light-theme button:hover {
  background-color: #2980b9;
}

button.active {
  background-color: #e94560;
  box-shadow: 0 0 15px rgba(233, 69, 96, 0.5);
}

.light-theme button.active {
  background-color: #e74c3c;
  box-shadow: 0 0 15px rgba(231, 76, 60, 0.5);
}

.card-wrapper {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px 0;
}

.weather-card {
  width: 100%;
  max-width: 350px;
  height: 400px;
  background: linear-gradient(145deg, #222244, #16213e);
  border-radius: 20px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.4);
  transition: all 0.5s ease;
}

.light-theme .weather-card {
  background: linear-gradient(145deg, #e0f7fa, #bbdefb);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
}

.weather-card h2 {
  text-align: center;
  padding: 15px 0;
  margin: 0;
  background-color: rgba(0, 0, 0, 0.3);
  color: white;
  z-index: 10;
  position: relative;
  font-size: clamp(1.2rem, 4vw, 1.5rem);
}

.light-theme .weather-card h2 {
  background-color: rgba(0, 0, 0, 0.1);
  color: #333;
}

.animation-container {
  position: relative;
  height: calc(100% - 50px);
  overflow: hidden;
}

/* Welcome Card Styles */
.welcome-container {
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 20px;
}

.welcome-text {
  font-size: 1.2rem;
}

.weather-icons {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
  font-size: 2.5rem;
}

.weather-icons span {
  animation: bounce 2s infinite alternate;
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.5));
  transform-origin: bottom center;
}

.light-theme .weather-icons span {
  filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.2));
}

.weather-icons span:nth-child(1) {
  animation-delay: 0.2s;
  transform: rotate(-5deg);
}

.weather-icons span:nth-child(2) {
  animation-delay: 0.5s;
  transform: rotate(5deg);
}

.weather-icons span:nth-child(3) {
  animation-delay: 0.8s;
  transform: rotate(-5deg);
}

.weather-icons span:nth-child(4) {
  animation-delay: 1.1s;
  transform: rotate(5deg);
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0) scale(1) rotate(0deg);
  }
  50% {
    transform: translateY(-15px) scale(1.1) rotate(5deg);
  }
}

/* Wind Card Styles - Cartoony Version */
.cloud {
  position: absolute;
  background-color: #f5f5f5;
  border-radius: 50px;
  width: 100px;
  height: 40px;
  filter: drop-shadow(0 5px 15px rgba(0, 0, 0, 0.2));
}

.cloud:before, .cloud:after {
  content: '';
  position: absolute;
  background-color: #f5f5f5;
  border-radius: 50%;
}

.cloud:before {
  width: 50px;
  height: 50px;
  top: -25px;
  left: 15px;
}

.cloud:after {
  width: 40px;
  height: 40px;
  top: -20px;
  right: 20px;
}

.cloud-1 {
  left: 30px;
  top: 40px;
  animation: cloud-move 15s linear infinite, cloud-puff 4s ease-in-out infinite;
}

.cloud-2 {
  left: 150px;
  top: 80px;
  transform: scale(0.6);
  animation: cloud-move 12s linear infinite, cloud-puff 3s ease-in-out infinite;
  animation-delay: -5s, -2s;
}

.reduced-motion .cloud-1,
.reduced-motion .cloud-2 {
  animation-duration: 30s, 8s;
}

@keyframes cloud-move {
  0% {
    transform: translateX(-150px);
  }
  100% {
    transform: translateX(350px);
  }
}

@keyframes cloud-puff {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.tree {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
}

.trunk {
  width: 15px;
  height: 70px;
  background-color: #8B4513;
  margin: 0 auto;
  border-radius: 5px;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.2);
}

.leaves {
  width: 80px;
  height: 100px;
  background-color: #4CAF50;
  border-radius: 50% 50% 50% 50%;
  position: relative;
  top: -30px;
  left: -32.5px;
  animation: tree-sway 3s ease-in-out infinite;
  transform-origin: bottom center;
  box-shadow: 0 5px 0 rgba(0, 0, 0, 0.1);
}

.reduced-motion .leaves {
  animation-duration: 6s;
}

@keyframes tree-sway {
  0%, 100% {
    transform: rotate(-8deg);
  }
  50% {
    transform: rotate(8deg);
  }
}

.wind-lines {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  z-index: 1;
}

.wind-line {
  height: 3px;
  background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.6), transparent);
  margin: 20px 0;
  position: relative;
  animation: wind-blow 3s linear infinite;
  border-radius: 3px;
}

.light-theme .wind-line {
  background: linear-gradient(to right, transparent, rgba(0, 0, 0, 0.3), transparent);
}

.wind-line:nth-child(1) {
  animation-delay: 0s;
  top: -20px;
}

.wind-line:nth-child(2) {
  animation-delay: -1s;
  top: 0;
}

.wind-line:nth-child(3) {
  animation-delay: -2s;
  top: 20px;
}

.reduced-motion .wind-line {
  animation-duration: 6s;
}

@keyframes wind-blow {
  0% {
    left: -100%;
    width: 30%;
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    left: 100%;
    width: 80%;
    opacity: 0;
  }
}

/* Rain Card Styles - Cartoony Version */
.rain-cloud {
  left: 50%;
  transform: translateX(-50%);
  top: 40px;
  background-color: #78909c;
  width: 120px;
  height: 45px;
  animation: rain-cloud-bounce 4s ease-in-out infinite;
}

.rain-cloud:before, .rain-cloud:after {
  background-color: #78909c;
}

.rain-cloud:before {
  width: 60px;
  height: 60px;
  top: -30px;
  left: 15px;
}

.rain-cloud:after {
  width: 50px;
  height: 50px;
  top: -25px;
  right: 15px;
}

@keyframes rain-cloud-bounce {
  0%, 100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-5px);
  }
}

.raindrops {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 70px;
}

.raindrop {
  position: absolute;
  width: 4px;
  height: 20px;
  background-color: #64b5f6;
  border-radius: 0 0 5px 5px;
  opacity: 0.8;
  animation: rain-fall 1.5s linear infinite;
  filter: drop-shadow(0 0 2px rgba(100, 181, 246, 0.5));
}

.reduced-motion .raindrop {
  animation-duration: 3s;
}

@keyframes rain-fall {
  0% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 0.8;
  }
  50% {
    transform: translateY(100px) translateX(5px) scale(0.9);
    opacity: 0.8;
  }
  80% {
    opacity: 0.8;
  }
  100% {
    transform: translateY(200px) translateX(10px) scale(0.5);
    opacity: 0;
  }
}

.puddle {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 140px;
  height: 15px;
  background-color: #64b5f6;
  border-radius: 50%;
  opacity: 0.7;
  animation: puddle-grow 5s ease-in-out infinite;
  filter: blur(2px);
}

.reduced-motion .puddle {
  animation-duration: 10s;
}

@keyframes puddle-grow {
  0%, 100% {
    transform: translateX(-50%) scale(1);
    opacity: 0.7;
  }
  50% {
    transform: translateX(-50%) scale(1.3);
    opacity: 0.9;
  }
}

/* Sun Card Styles - Cartoony Version */
.sun-circle {
  position: absolute;
  width: 100px;
  height: 100px;
  background: radial-gradient(circle, #ffeb3b 60%, #ffc107);
  border-radius: 50%;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  box-shadow: 0 0 50px #ff9800;
  animation: sun-pulse 3s ease-in-out infinite;
  z-index: 2;
}

.reduced-motion .sun-circle {
  animation-duration: 6s;
}

.sun-rays {
  position: absolute;
  width: 100%;
  height: 100%;
  animation: sun-rotate 20s linear infinite;
}

.reduced-motion .sun-rays {
  animation-duration: 40s;
}

.sun-rays:before, .sun-rays:after {
  content: '';
  position: absolute;
  background-color: rgba(255, 235, 59, 0.7);
  border-radius: 5px;
}

.sun-rays:before {
  top: -40px;
  left: 45px;
  width: 10px;
  height: 180px;
}

.sun-rays:after {
  top: 45px;
  left: -40px;
  width: 180px;
  height: 10px;
}

.sun-face {
  position: absolute;
  width: 100%;
  height: 100%;
  z-index: 3;
}

.sun-face:before, .sun-face:after {
  content: '';
  position: absolute;
  background-color: #FF6D00;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  top: 35px;
  animation: sun-blink 4s ease-in-out infinite;
}

.sun-face:before {
  left: 30px;
}

.sun-face:after {
  right: 30px;
}

.sun-smile {
  position: absolute;
  width: 40px;
  height: 20px;
  border-radius: 0 0 20px 20px;
  border: 4px solid #FF6D00;
  border-top: none;
  bottom: 25px;
  left: 50%;
  transform: translateX(-50%);
}

@keyframes sun-blink {
  0%, 45%, 55%, 100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(0.1);
  }
}

@keyframes sun-pulse {
  0%, 100% {
    transform: translateX(-50%) scale(1);
    box-shadow: 0 0 50px #ff9800;
  }
  50% {
    transform: translateX(-50%) scale(1.1);
    box-shadow: 0 0 70px #ff9800;
  }
}

@keyframes sun-rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.heat-wave {
  position: absolute;
  bottom: 30px;
  left: 0;
  width: 100%;
  height: 70px;
  background: linear-gradient(0deg, rgba(255, 152, 0, 0.1) 0%, rgba(255, 152, 0, 0.4) 100%);
  animation: heat-ripple 3s ease-in-out infinite;
  border-radius: 50% 50% 0 0;
  filter: blur(5px);
}

.reduced-motion .heat-wave {
  animation-duration: 6s;
}

@keyframes heat-ripple {
  0%, 100% {
    transform: scaleY(1) translateY(0);
    opacity: 0.3;
  }
  50% {
    transform: scaleY(1.3) translateY(-10px);
    opacity: 0.5;
  }
}

/* Snow Card Styles - Cartoony Version */
.snow-cloud {
  left: 50%;
  transform: translateX(-50%);
  top: 40px;
  background-color: #b0bec5;
  width: 120px;
  height: 45px;
  animation: snow-cloud-float 5s ease-in-out infinite;
}

.snow-cloud:before, .snow-cloud:after {
  background-color: #b0bec5;
}

.snow-cloud:before {
  width: 60px;
  height: 60px;
  top: -30px;
  left: 15px;
}

.snow-cloud:after {
  width: 50px;
  height: 50px;
  top: -25px;
  right: 15px;
}

@keyframes snow-cloud-float {
  0%, 100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-8px);
  }
}

.snowflakes {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 70px;
}

.snowflake {
  position: absolute;
  width: 10px;
  height: 10px;
  background-color: white;
  border-radius: 50%;
  opacity: 0.9;
  animation: snow-fall 6s linear infinite;
  filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.5));
}

.snowflake:before, .snowflake:after {
  content: '';
  position: absolute;
  background-color: white;
  width: 10px;
  height: 2px;
  top: 4px;
  left: 0;
}

.snowflake:before {
  transform: rotate(45deg);
}

.snowflake:after {
  transform: rotate(-45deg);
}

.reduced-motion .snowflake {
  animation-duration: 12s;
}

.snowflake:nth-child(even) {
  width: 8px;
  height: 8px;
  animation-duration: 5s;
}

.snowflake:nth-child(3n) {
  width: 6px;
  height: 6px;
  animation-duration: 7s;
}

@keyframes snow-fall {
  0% {
    transform: translateY(-50px) translateX(0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.9;
  }
  90% {
    opacity: 0.9;
  }
  100% {
    transform: translateY(250px) translateX(20px) rotate(360deg);
    opacity: 0;
  }
}

.snow-ground {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 40px;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 50% 50% 0 0;
  animation: snow-accumulate 8s ease-in-out infinite;
  box-shadow: 0 -5px 15px rgba(255, 255, 255, 0.3);
}

.reduced-motion .snow-ground {
  animation-duration: 16s;
}

@keyframes snow-accumulate {
  0%, 100% {
    height: 40px;
  }
  50% {
    height: 55px;
  }
}

/* Initialize positions for raindrops and snowflakes */
.weather-card.rain .raindrop {
  left: calc(var(--i, 0) * 10px + 20px);
  top: calc(var(--j, 0) * -15px + 80px);
  animation-delay: calc(var(--i, 0) * 0.1s + var(--j, 0) * 0.2s);
}

.weather-card.snow .snowflake {
  left: calc(var(--i, 0) * 15px + 10px);
  top: calc(var(--j, 0) * -20px + 60px);
  animation-delay: calc(var(--i, 0) * 0.2s + var(--j, 0) * 0.3s);
}

/* Transition animations */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s, transform 0.5s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Responsive styles */
@media (max-width: 768px) {
  .controls {
    flex-wrap: wrap;
  }
  
  button {
    flex: 1;
    min-width: 70px;
    padding: 10px;
    font-size: 0.9rem;
  }
  
  .weather-card {
    height: 350px;
  }
}

@media (max-width: 480px) {
  .weather-container {
    padding: 10px;
  }
  
  h1 {
    margin-bottom: 20px;
  }
  
  .controls {
    margin-bottom: 20px;
    gap: 10px;
  }
  
  button {
    padding: 8px;
    font-size: 0.85rem;
  }
  
  .weather-card {
    height: 300px;
  }
}

/* Print styles */
@media print {
  .weather-container {
    background-color: white;
    color: black;
  }
  
  .controls {
    display: none;
  }
  
  .weather-card {
    box-shadow: none;
    border: 1px solid #ccc;
  }
}
</style>
