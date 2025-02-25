<template>
  <div class="container">
    <!-- Weather Card 1 -->
    <div class="weather-card" id="card1">
      <div class="weather-title">Weather Card</div>
      <div class="weather-animation" id="animation1"></div>
      <div class="controls">
        <button @click="setWeather('card1', 'sun')">Sun</button>
        <button @click="setWeather('card1', 'rain')">Rain</button>
        <button @click="setWeather('card1', 'wind')">Wind</button>
        <button @click="setWeather('card1', 'snow')">Snow</button>
      </div>
    </div>
    <!-- Weather Card 2 -->
    <div class="weather-card" id="card2">
      <div class="weather-title">Weather Card</div>
      <div class="weather-animation" id="animation2"></div>
      <div class="controls">
        <button @click="setWeather('card2', 'sun')">Sun</button>
        <button @click="setWeather('card2', 'rain')">Rain</button>
        <button @click="setWeather('card2', 'wind')">Wind</button>
        <button @click="setWeather('card2', 'snow')">Snow</button>
      </div>
    </div>
    <!-- Weather Card 3 -->
    <div class="weather-card" id="card3">
      <div class="weather-title">Weather Card</div>
      <div class="weather-animation" id="animation3"></div>
      <div class="controls">
        <button @click="setWeather('card3', 'sun')">Sun</button>
        <button @click="setWeather('card3', 'rain')">Rain</button>
        <button @click="setWeather('card3', 'wind')">Wind</button>
        <button @click="setWeather('card3', 'snow')">Snow</button>
      </div>
    </div>
    <!-- Weather Card 4 -->
    <div class="weather-card" id="card4">
      <div class="weather-title">Weather Card</div>
      <div class="weather-animation" id="animation4"></div>
      <div class="controls">
        <button @click="setWeather('card4', 'sun')">Sun</button>
        <button @click="setWeather('card4', 'rain')">Rain</button>
        <button @click="setWeather('card4', 'wind')">Wind</button>
        <button @click="setWeather('card4', 'snow')">Snow</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'WeatherCards',
  mounted() {
    ['card1', 'card2', 'card3', 'card4'].forEach(cardId => {
      this.setWeather(cardId, 'sun')
    })
  },
  methods: {
    clearAnimation(cardId) {
      const animDiv = document.getElementById('animation' + cardId.slice(-1))
      animDiv.innerHTML = ''
      animDiv.className = 'weather-animation'
    },
    setWeather(cardId, condition) {
      const animDiv = document.getElementById('animation' + cardId.slice(-1))
      this.clearAnimation(cardId)
      
      switch(condition) {
        case 'sun':
          animDiv.classList.add('sun')
          break
        case 'rain':
          for(let i = 0; i < 20; i++) {
            let drop = document.createElement('div')
            drop.className = 'raindrop'
            drop.style.left = Math.random() * 100 + '%'
            drop.style.animationDelay = Math.random() + 's'
            animDiv.appendChild(drop)
          }
          break
        case 'wind':
          for(let i = 0; i < 3; i++) {
            let cloud = document.createElement('div')
            cloud.className = 'cloud'
            cloud.style.top = (20 + i * 30) + 'px'
            cloud.style.left = (-80 + i * 80) + 'px'
            cloud.style.animationDuration = (4 + Math.random() * 3) + 's'
            animDiv.appendChild(cloud)
          }
          break
        case 'snow':
          for(let i = 0; i < 20; i++) {
            let snowflake = document.createElement('div')
            snowflake.className = 'snowflake'
            snowflake.innerHTML = '❆'
            snowflake.style.left = Math.random() * 100 + '%'
            snowflake.style.animationDelay = Math.random() * 3 + 's'
            snowflake.style.fontSize = (10 + Math.random() * 10) + 'px'
            animDiv.appendChild(snowflake)
          }
          break
      }
    }
  }
}
</script>

<style scoped>
/* Global styles */
.container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
  padding: 20px;
}

.weather-card {
  position: relative;
  width: 250px;
  height: 300px;
  background: #333;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
}

.weather-title {
  position: absolute;
  top: 10px;
  left: 10px;
  font-size: 18px;
  z-index: 2;
}

.controls {
  position: absolute;
  bottom: 10px;
  left: 10px;
  right: 10px;
  text-align: center;
  z-index: 2;
}

.controls button {
  margin: 0 5px;
  padding: 5px 10px;
  border: none;
  border-radius: 5px;
  background: #555;
  color: #fff;
  cursor: pointer;
}

.controls button:hover {
  background: #777;
}

.weather-animation {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  z-index: 1;
}

/* Sun Animation */
.sun {
  background: radial-gradient(circle at center, #ffd700 30%, transparent 31%);
  animation: sunPulse 2s infinite;
}

@keyframes sunPulse {
  0%   { filter: brightness(1); }
  50%  { filter: brightness(1.3); }
  100% { filter: brightness(1); }
}

/* Rain Animation */
.rain {
  background: transparent;
}

.raindrop {
  position: absolute;
  top: -20px;
  width: 2px;
  height: 12px;
  background: #0af;
  opacity: 0.8;
  animation: fall 1s infinite linear;
}

@keyframes fall {
  to { transform: translateY(320px); opacity: 0; }
}

/* Wind Animation */
.wind {
  background: transparent;
}

.cloud {
  position: absolute;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  width: 60px;
  height: 40px;
  opacity: 0.7;
  animation: moveClouds 5s linear infinite;
}

@keyframes moveClouds {
  0% { transform: translateX(-100px); }
  100% { transform: translateX(250px); }
}

/* Snow Animation */
.snow {
  background: transparent;
}

.snowflake {
  position: absolute;
  top: -10px;
  color: #fff;
  font-size: 14px;
  opacity: 0.8;
  animation: fallSnow 3s infinite linear;
}

@keyframes fallSnow {
  0% { transform: translateY(0px); }
  100% { transform: translateY(320px); opacity: 0; }
}
</style>