<template>
  <div class="weather-container">
    <div class="controls">
      <button 
        v-for="type in weatherTypes" 
        :key="type" 
        @click="setWeather(type)"
        :class="{ active: activeWeather === type }"
      >
        {{ type.charAt(0).toUpperCase() + type.slice(1) }}
      </button>
    </div>
    
    <div class="weather-card-container">
      <div 
        class="weather-card"
        :class="activeWeather"
      >
        <h3>{{ activeWeather.charAt(0).toUpperCase() + activeWeather.slice(1) }}</h3>
        
        <!-- Wind Elements -->
        <template v-if="activeWeather === 'wind'">
          <div class="cloud cloud-1"></div>
          <div class="cloud cloud-2"></div>
          <div class="cloud cloud-3"></div>
          <div class="wind-line wind-line-1"></div>
          <div class="wind-line wind-line-2"></div>
          <div class="wind-line wind-line-3"></div>
          <div class="tree"></div>
        </template>
        
        <!-- Rain Elements -->
        <template v-else-if="activeWeather === 'rain'">
          <div class="cloud cloud-1"></div>
          <div class="cloud cloud-2"></div>
          <div class="cloud cloud-3"></div>
          <div class="cloud cloud-4"></div>
          <div class="raindrops">
            <div class="drop" v-for="i in 40" :key="i"></div>
          </div>
          <div class="puddle"></div>
        </template>
        
        <!-- Sun Elements -->
        <template v-else-if="activeWeather === 'sun'">
          <div class="sun-element">
            <div class="sun-rays"></div>
          </div>
          <div class="cloud cloud-small"></div>
        </template>
        
        <!-- Snow Elements -->
        <template v-else-if="activeWeather === 'snow'">
          <div class="cloud cloud-1"></div>
          <div class="cloud cloud-2"></div>
          <div class="cloud cloud-3"></div>
          <div class="snowflakes">
            <div class="snowflake" v-for="i in 50" :key="i"></div>
          </div>
          <div class="snow-ground"></div>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      weatherTypes: ['wind', 'rain', 'sun', 'snow'],
      activeWeather: 'sun'
    }
  },
  methods: {
    setWeather(type) {
      this.activeWeather = type;
      // When weather changes, apply random properties to elements
      this.$nextTick(() => {
        if (type === 'rain') {
          this.setupRaindrops();
        } else if (type === 'snow') {
          this.setupSnowflakes();
        }
      });
    },
    getRandomDelay() {
      return Math.random() * 2 + 's';
    },
    getRandomDuration() {
      return (Math.random() * 3 + 2) + 's';
    },
    setupRaindrops() {
      const raindrops = document.querySelectorAll('.drop');
      raindrops.forEach(drop => {
        // Random horizontal position
        drop.style.left = Math.random() * 100 + '%';
        // Also randomize vertical starting position for a staggered effect
        drop.style.top = (Math.random() * 40 + 80) + 'px';
        // Random delay so they don't all start at once
        drop.style.animationDelay = this.getRandomDelay();
        // Random speed for more natural effect
        drop.style.animationDuration = (Math.random() * 0.5 + 1) + 's';
      });
    },
    setupSnowflakes() {
      const snowflakes = document.querySelectorAll('.snowflake');
      snowflakes.forEach(flake => {
        // Random horizontal position
        flake.style.left = Math.random() * 100 + '%';
        // Also randomize vertical starting position for a staggered effect
        flake.style.top = (Math.random() * 40 + 80) + 'px';
        // Random delay for natural effect
        flake.style.animationDelay = this.getRandomDelay();
        flake.style.animationDuration = this.getRandomDuration();
        flake.style.opacity = Math.random() * 0.7 + 0.3;
        // Random size variation
        const size = Math.random() * 6 + 3;
        flake.style.width = size + 'px';
        flake.style.height = size + 'px';
      });
    }
  },
  mounted() {
    // Initialize with sun weather
    this.activeWeather = 'sun';
    
    // Ensure elements are positioned immediately
    this.$nextTick(() => {
      this.setupRaindrops();
      this.setupSnowflakes();
      
      // Also set them up after a delay to be sure all elements are rendered
      setTimeout(() => {
        this.setupRaindrops();
        this.setupSnowflakes();
      }, 100);
    });
  },
  watch: {
    // Re-apply styles whenever weather changes
    activeWeather(newWeather) {
      this.$nextTick(() => {
        if (newWeather === 'rain') {
          this.setupRaindrops();
        } else if (newWeather === 'snow') {
          this.setupSnowflakes();
        }
      });
    }
  }
}
</script>

<style scoped>
.weather-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 20px;
}

button {
  padding: 10px 16px;
  background-color: #444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}

button:hover {
  transform: translateY(-2px);
  background-color: #555;
}

button.active {
  background-color: #2c3e50;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
}

.weather-card-container {
  display: flex;
  justify-content: center;
}

.weather-card {
  position: relative;
  width: 280px;
  height: 380px;
  border-radius: 12px;
  padding: 20px;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  background: linear-gradient(to bottom, #2c3e50, #1c2630);
  color: white;
  transition: all 0.5s ease;
}

.weather-card h3 {
  position: relative;
  z-index: 10;
  margin-top: 0;
  text-align: center;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
}

/* Wind Styles */
.wind .cloud {
  position: absolute;
  background-color: #f0f0f0;
  border-radius: 50%;
  opacity: 0.8;
}

.wind .cloud::before,
.wind .cloud::after {
  content: '';
  position: absolute;
  background-color: #f0f0f0;
  border-radius: 50%;
}

.cloud-1 {
  width: 80px;
  height: 40px;
  top: 60px;
  left: 30px;
  animation: windCloud 8s infinite linear;
}

.cloud-2 {
  width: 60px;
  height: 30px;
  top: 90px;
  left: 20px;
  animation: windCloud 6s infinite linear;
  animation-delay: 0.5s;
}

.cloud-3 {
  width: 40px;
  height: 20px;
  top: 40px;
  left: 120px;
  animation: windCloud 7s infinite linear;
  animation-delay: 1s;
}

.wind-line {
  position: absolute;
  height: 2px;
  background-color: rgba(255, 255, 255, 0.6);
  transform: translateX(-100%);
  z-index: 2;
}

.wind-line-1 {
  width: 60px;
  top: 70px;
  left: 200px;
  animation: windLine 3s infinite;
}

.wind-line-2 {
  width: 45px;
  top: 85px;
  left: 190px;
  animation: windLine 3s infinite;
  animation-delay: 0.5s;
}

.wind-line-3 {
  width: 35px;
  top: 100px;
  left: 180px;
  animation: windLine 3s infinite;
  animation-delay: 1s;
}

.tree {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
}

.tree::before {
  content: '';
  position: absolute;
  width: 5px;
  height: 50px;
  background-color: #5d4037;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

.tree::after {
  content: '';
  position: absolute;
  width: 40px;
  height: 60px;
  background-color: #4caf50;
  border-radius: 50% 50% 10% 10%;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  animation: sway 4s ease-in-out infinite;
}

/* Rain Styles */
.rain {
  background: linear-gradient(to bottom, #2c3e50, #2c3e50);
}

.rain .cloud {
  position: absolute;
  background-color: #b3b3b3;
  border-radius: 50%;
  top: 60px;
}

.rain .cloud-1 {
  width: 100px;
  height: 40px;
  left: 40px;
  animation: none;
}

.rain .cloud-1::before,
.rain .cloud-1::after {
  content: '';
  position: absolute;
  background-color: #b3b3b3;
  border-radius: 50%;
}

.rain .cloud-1::before {
  width: 50px;
  height: 50px;
  top: -20px;
  left: 15px;
}

.rain .cloud-1::after {
  width: 50px;
  height: 50px;
  top: -10px;
  right: 15px;
}

.rain .cloud-2 {
  width: 60px;
  height: 30px;
  top: 50px;
  right: 40px;
  animation: none;
}

.rain .cloud-3 {
  width: 80px;
  height: 35px;
  top: 80px;
  right: 80px;
  animation: none;
}

.rain .cloud-4 {
  width: 70px;
  height: 30px;
  top: 40px;
  left: 120px;
  animation: none;
}

.raindrops {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
}

.raindrops .drop {
  position: absolute;
  background-color: rgba(120, 200, 255, 0.6);
  width: 2px;
  height: 15px;
  /* Remove fixed top position to allow JS positioning */
  /* top: 110px; */
  border-radius: 0 0 5px 5px;
  /* Add a variable animation-duration and delay by default */
  animation: rain 1.5s linear infinite;
  animation-delay: 0s; /* Will be overridden by JS */
}

.puddle {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  width: 140px;
  height: 10px;
  background-color: rgba(120, 200, 255, 0.3);
  border-radius: 50%;
  animation: puddle 3s ease-in-out infinite;
}

/* Sun Styles */
.sun {
  background: linear-gradient(to bottom, #2c3e50, #34495e);
}

.sun .sun-element {
  position: absolute;
  width: 70px;
  height: 70px;
  background-color: #ffeb3b;
  border-radius: 50%;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  box-shadow: 0 0 40px #ff9800;
  animation: glow 3s ease-in-out infinite;
  z-index: 1;
}

.sun .sun-rays {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
  border-radius: 50%;
}

.sun .sun-rays::after {
  content: '';
  position: absolute;
  top: -20px;
  left: -20px;
  right: -20px;
  bottom: -20px;
  border-radius: 50%;
  border: 15px solid transparent;
  border-top-color: rgba(255, 235, 59, 0.6);
  border-bottom-color: rgba(255, 235, 59, 0.6);
  border-left-color: rgba(255, 235, 59, 0.6);
  border-right-color: rgba(255, 235, 59, 0.6);
  animation: spin 20s linear infinite;
}

.sun .cloud-small {
  position: absolute;
  width: 40px;
  height: 20px;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 10px;
  top: 40px;
  right: 40px;
  animation: float 8s ease-in-out infinite;
}

/* Snow Styles */
.snow {
  background: linear-gradient(to bottom, #2c3e50, #303e4e);
}

.snow .cloud {
  position: absolute;
  background-color: #e0e0e0;
  border-radius: 50%;
  top: 60px;
}

.snow .cloud-1 {
  width: 100px;
  height: 40px;
  left: 40px;
  animation: none;
}

.snow .cloud-1::before,
.snow .cloud-1::after {
  content: '';
  position: absolute;
  background-color: #e0e0e0;
  border-radius: 50%;
}

.snow .cloud-1::before {
  width: 50px;
  height: 50px;
  top: -20px;
  left: 15px;
}

.snow .cloud-1::after {
  width: 50px;
  height: 50px;
  top: -10px;
  right: 15px;
}

.snow .cloud-2 {
  width: 75px;
  height: 35px;
  top: 50px;
  right: 50px;
  animation: none;
}

.snow .cloud-3 {
  width: 60px;
  height: 30px;
  top: 70px;
  left: 140px;
  animation: none;
}

.snowflakes {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
}

.snowflakes .snowflake {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: white;
  /* Remove fixed top position to allow JS positioning */
  /* top: 110px; */
  animation: snow 10s linear infinite;
  animation-delay: 0s; /* Will be overridden by JS */
}

.snow-ground {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  width: 180px;
  height: 20px;
  background-color: white;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.6);
}

/* Animations */
@keyframes windCloud {
  0% {
    transform: translateX(-20px);
  }
  100% {
    transform: translateX(280px);
  }
}

@keyframes windLine {
  0% {
    transform: translateX(-100%);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateX(0);
    opacity: 0;
  }
}

@keyframes sway {
  0%, 100% {
    transform: translateX(-50%) rotate(-5deg);
  }
  50% {
    transform: translateX(-50%) rotate(5deg);
  }
}

@keyframes rain {
  0% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(200px) scale(0.5);
    opacity: 0.3;
  }
}

@keyframes puddle {
  0%, 100% {
    transform: translateX(-50%) scale(1);
  }
  50% {
    transform: translateX(-50%) scale(1.1);
  }
}

@keyframes glow {
  0%, 100% {
    box-shadow: 0 0 30px #ff9800;
  }
  50% {
    box-shadow: 0 0 50px #ff9800;
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(-20px);
  }
}

@keyframes snow {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(200px) rotate(360deg);
    opacity: 0.3;
  }
}
</style>
