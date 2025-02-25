<template>
  <div class="weather-container">
    <h1>Animated Weather Cards</h1>
    
    <div class="controls">
      <button 
        v-for="type in weatherTypes" 
        :key="type"
        @click="setActiveWeather(type)"
        :class="{ active: activeWeather === type }"
      >
        {{ type }}
      </button>
    </div>
    
    <div class="cards-container">
      <!-- Wind Card -->
      <div class="weather-card wind">
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
      <div class="weather-card rain">
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
      <div class="weather-card sun">
        <h2>Sun</h2>
        <div class="animation-container">
          <div class="sun-circle">
            <div class="sun-rays"></div>
          </div>
          <div class="heat-wave"></div>
        </div>
      </div>
      
      <!-- Snow Card -->
      <div class="weather-card snow">
        <h2>Snow</h2>
        <div class="animation-container">
          <div class="cloud snow-cloud"></div>
          <div class="snowflakes">
            <div v-for="n in 30" :key="`snowflake-${n}`" class="snowflake"></div>
          </div>
          <div class="snow-ground"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      weatherTypes: ['wind', 'rain', 'sun', 'snow'],
      activeWeather: 'all'
    }
  },
  methods: {
    setActiveWeather(type) {
      this.activeWeather = type === this.activeWeather ? 'all' : type;
    }
  },
  mounted() {
    // Set random positions for raindrops
    const raindrops = document.querySelectorAll('.raindrop');
    raindrops.forEach((drop, index) => {
      drop.style.setProperty('--i', Math.floor(Math.random() * 20));
      drop.style.setProperty('--j', Math.floor(Math.random() * 10));
      drop.style.animationDelay = `${Math.random() * 1.5}s`;
      drop.style.left = `${Math.random() * 100}%`;
    });
    
    // Set random positions for snowflakes
    const snowflakes = document.querySelectorAll('.snowflake');
    snowflakes.forEach((flake, index) => {
      flake.style.setProperty('--i', Math.floor(Math.random() * 20));
      flake.style.setProperty('--j', Math.floor(Math.random() * 10));
      flake.style.animationDelay = `${Math.random() * 6}s`;
      flake.style.left = `${Math.random() * 100}%`;
    });
  }
}
</script>

<style scoped>
.weather-container {
  font-family: 'Arial', sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  background-color: #1a1a2e;
  color: white;
  min-height: 100vh;
}

h1 {
  text-align: center;
  margin-bottom: 30px;
  color: #e2e2e2;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.controls {
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
  gap: 15px;
}

button {
  padding: 10px 20px;
  background-color: #0f3460;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: capitalize;
}

button:hover {
  background-color: #16213e;
  transform: translateY(-2px);
}

button.active {
  background-color: #e94560;
  box-shadow: 0 0 15px rgba(233, 69, 96, 0.5);
}

.cards-container {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: center;
}

.weather-card {
  width: 250px;
  height: 350px;
  background: linear-gradient(145deg, #222244, #16213e);
  border-radius: 15px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
  transition: all 0.5s ease;
}

.weather-card h2 {
  text-align: center;
  padding: 15px 0;
  margin: 0;
  background-color: rgba(0, 0, 0, 0.3);
  color: white;
  z-index: 10;
  position: relative;
}

.animation-container {
  position: relative;
  height: calc(100% - 50px);
  overflow: hidden;
}

/* Wind Card Styles */
.cloud {
  position: absolute;
  background-color: #e2e2e2;
  border-radius: 50px;
  width: 80px;
  height: 30px;
  top: 40px;
}

.cloud:before, .cloud:after {
  content: '';
  position: absolute;
  background-color: #e2e2e2;
  border-radius: 50%;
}

.cloud:before {
  width: 40px;
  height: 40px;
  top: -20px;
  left: 10px;
}

.cloud:after {
  width: 30px;
  height: 30px;
  top: -15px;
  right: 15px;
}

.cloud-1 {
  left: 30px;
  animation: cloud-move 15s linear infinite;
}

.cloud-2 {
  left: 150px;
  top: 80px;
  transform: scale(0.7);
  animation: cloud-move 12s linear infinite;
  animation-delay: -5s;
}

@keyframes cloud-move {
  0% {
    transform: translateX(-100px);
  }
  100% {
    transform: translateX(300px);
  }
}

.tree {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
}

.trunk {
  width: 10px;
  height: 60px;
  background-color: #8B4513;
  margin: 0 auto;
}

.leaves {
  width: 60px;
  height: 80px;
  background-color: #2e7d32;
  border-radius: 50% 50% 50% 50%;
  position: relative;
  top: -20px;
  left: -25px;
  animation: tree-sway 3s ease-in-out infinite;
  transform-origin: bottom center;
}

@keyframes tree-sway {
  0%, 100% {
    transform: rotate(-5deg);
  }
  50% {
    transform: rotate(5deg);
  }
}

.wind-lines {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
}

.wind-line {
  height: 2px;
  background-color: rgba(255, 255, 255, 0.3);
  margin: 15px 0;
  position: relative;
  animation: wind-blow 3s linear infinite;
}

.wind-line:nth-child(2) {
  animation-delay: -1s;
}

.wind-line:nth-child(3) {
  animation-delay: -2s;
}

@keyframes wind-blow {
  0% {
    left: -100%;
    width: 20%;
  }
  100% {
    left: 100%;
    width: 80%;
  }
}

/* Rain Card Styles */
.rain-cloud {
  left: 85px;
  top: 30px;
  background-color: #546e7a;
}

.rain-cloud:before, .rain-cloud:after {
  background-color: #546e7a;
}

.raindrops {
  position: absolute;
  width: 100%;
  height: 100%;
}

.raindrop {
  position: absolute;
  width: 2px;
  height: 15px;
  background-color: #64b5f6;
  border-radius: 0 0 5px 5px;
  opacity: 0.8;
  animation: rain-fall 1.5s linear infinite;
}

@keyframes rain-fall {
  0% {
    transform: translateY(0) translateX(0);
    opacity: 0.8;
  }
  80% {
    opacity: 0.8;
  }
  100% {
    transform: translateY(200px) translateX(10px);
    opacity: 0;
  }
}

.puddle {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 10px;
  background-color: #64b5f6;
  border-radius: 50%;
  opacity: 0.7;
  animation: puddle-grow 5s ease-in-out infinite;
}

@keyframes puddle-grow {
  0%, 100% {
    transform: translateX(-50%) scale(1);
    opacity: 0.7;
  }
  50% {
    transform: translateX(-50%) scale(1.2);
    opacity: 0.9;
  }
}

/* Sun Card Styles */
.sun-circle {
  position: absolute;
  width: 80px;
  height: 80px;
  background-color: #ffeb3b;
  border-radius: 50%;
  top: 50px;
  left: 85px;
  box-shadow: 0 0 40px #ff9800;
  animation: sun-pulse 3s ease-in-out infinite;
}

.sun-rays {
  position: absolute;
  width: 100%;
  height: 100%;
  animation: sun-rotate 20s linear infinite;
}

.sun-rays:before {
  content: '';
  position: absolute;
  top: -30px;
  left: 35px;
  width: 10px;
  height: 140px;
  background-color: rgba(255, 235, 59, 0.5);
  border-radius: 5px;
}

.sun-rays:after {
  content: '';
  position: absolute;
  top: 35px;
  left: -30px;
  width: 140px;
  height: 10px;
  background-color: rgba(255, 235, 59, 0.5);
  border-radius: 5px;
}

@keyframes sun-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 40px #ff9800;
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 0 60px #ff9800;
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
  height: 50px;
  background: linear-gradient(0deg, rgba(255, 152, 0, 0.1) 0%, rgba(255, 152, 0, 0.4) 100%);
  animation: heat-ripple 3s ease-in-out infinite;
}

@keyframes heat-ripple {
  0%, 100% {
    transform: scaleY(1) translateY(0);
    opacity: 0.3;
  }
  50% {
    transform: scaleY(1.2) translateY(-5px);
    opacity: 0.5;
  }
}

/* Snow Card Styles */
.snow-cloud {
  left: 85px;
  top: 30px;
  background-color: #b0bec5;
}

.snow-cloud:before, .snow-cloud:after {
  background-color: #b0bec5;
}

.snowflakes {
  position: absolute;
  width: 100%;
  height: 100%;
}

.snowflake {
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: white;
  border-radius: 50%;
  opacity: 0.8;
  animation: snow-fall 6s linear infinite;
}

.snowflake:nth-child(even) {
  width: 5px;
  height: 5px;
  animation-duration: 5s;
}

.snowflake:nth-child(3n) {
  width: 4px;
  height: 4px;
  animation-duration: 7s;
}

@keyframes snow-fall {
  0% {
    transform: translateY(-50px) translateX(0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.8;
  }
  100% {
    transform: translateY(250px) translateX(20px) rotate(360deg);
    opacity: 0.2;
  }
}

.snow-ground {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 30px;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 50% 50% 0 0;
  animation: snow-accumulate 8s ease-in-out infinite;
}

@keyframes snow-accumulate {
  0%, 100% {
    height: 30px;
  }
  50% {
    height: 40px;
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

/* Responsive styles */
@media (max-width: 768px) {
  .cards-container {
    flex-direction: column;
    align-items: center;
  }
  
  .weather-card {
    width: 90%;
    max-width: 300px;
  }
}
</style>
