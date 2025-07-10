<template>
  <div class="bounce-container">
    <canvas 
      ref="canvas" 
      style="width: 100vw; height: 100vh;" 
      @mousedown="startAddingBoxes" 
      @mouseup="stopAddingBoxes" 
      @mouseleave="stopAddingBoxes"
      @click="addBox"
      @touchstart="handleTouch"
      @touchend="stopAddingBoxes"
    ></canvas>
    
    <div 
      v-if="showMessage" 
      class="instruction-message"
      :class="{ 'fade-out': isMessageFading }"
    >
      <div class="message-content">
        <span class="message-text">{{ isMobile ? 'please touch the screen' : 'please click' }}</span>
        <div class="message-icon">{{ isMobile ? '👆' : '⚽️' }}</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      ctx: null,
      boxes: [],
      animationFrameId: null,
      isAddingBoxes: false,
      boxAddInterval: null,
      showMessage: true,
      isMessageFading: false,
      isMobile: false,
      messageTimeout: null
    };
  },
  mounted() {
    this.detectMobile();
    this.setupCanvas();
    this.animate();
    this.setupMessageTimeout();
    window.addEventListener('resize', this.setupCanvas);
  },
  beforeDestroy() {
    this.cleanup();
  },
  methods: {
    detectMobile() {
      this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                      ('ontouchstart' in window) || 
                      (navigator.maxTouchPoints > 0);
    },
    setupMessageTimeout() {
      // Auto-hide message after 5 seconds if no interaction
      this.messageTimeout = setTimeout(() => {
        this.hideMessage();
      }, 5000);
    },
    hideMessage() {
      if (!this.showMessage) return;
      
      this.isMessageFading = true;
      setTimeout(() => {
        this.showMessage = false;
        this.isMessageFading = false;
      }, 500);
      
      if (this.messageTimeout) {
        clearTimeout(this.messageTimeout);
        this.messageTimeout = null;
      }
    },
    setupCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;
      
      this.ctx = canvas.getContext('2d');
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    },
    animate() {
      if (!this.$refs.canvas) return;
      
      this.animationFrameId = requestAnimationFrame(this.animate);
      this.ctx.clearRect(0, 0, this.$refs.canvas.width, this.$refs.canvas.height);
      this.boxes.forEach(box => {
        this.drawBox(box);
        this.updatePosition(box);
      });
    },
    drawBox(box) {
      this.ctx.fillStyle = box.color;
      this.ctx.beginPath();
      this.ctx.arc(box.x + box.size / 2, box.y + box.size / 2, box.size / 2, 0, Math.PI * 2);
      this.ctx.fill();
    },
    updatePosition(box) {
      if (!this.$refs.canvas) return;
      
      if (box.x + box.vx > this.$refs.canvas.width - box.size || box.x + box.vx < 0) {
        box.vx = -box.vx * 0.9; // Legger til litt demping
      }
      if (box.y + box.vy > this.$refs.canvas.height - box.size || box.y + box.vy < 0) {
        box.vy = -box.vy * 0.9; // Legger til litt demping
      }

      // Legg til gravitasjon
      // box.vy += 0.2;

      box.x += box.vx;
      box.y += box.vy;
    },
    addBox(event) {
      if (!this.$refs.canvas) return;
      
      // Hide message on first interaction
      if (this.showMessage) {
        this.hideMessage();
      }
      
      const rect = this.$refs.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      this.createBox(x, y);
    },
    handleTouch(event) {
      // Hide message on first touch
      if (this.showMessage) {
        this.hideMessage();
      }
      
      // Handle touch events similar to mouse events
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        const rect = this.$refs.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        this.createBox(x, y);
        
        // Start continuous adding for touch
        this.isAddingBoxes = true;
        this.boxAddInterval = setInterval(() => {
          if (event.touches.length > 0) {
            const touch = event.touches[0];
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            this.createBox(x, y);
          }
        }, 100);
      }
    },
    createBox(x, y) {
      const color = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
      const size = 10 + Math.random() * 20; // Varierende størrelser
      const vx = (Math.random() - 0.5) * 4; // Tilfeldig horisontal hastighet
      const vy = -Math.random() * 5; // Oppover initial hastighet
      
      this.boxes.push({ x, y, vx, vy, size, color });
      
      // Begrens antall bokser
      if (this.boxes.length > 100) {
        this.boxes.shift();
      }
    },
    startAddingBoxes(event) {
      // Hide message on first interaction
      if (this.showMessage) {
        this.hideMessage();
      }
      
      this.isAddingBoxes = true;
      this.boxAddInterval = setInterval(() => {
        const rect = this.$refs.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        this.createBox(x, y);
      }, 100); // Legg til en boks hvert 100ms
    },
    stopAddingBoxes() {
      this.isAddingBoxes = false;
      if (this.boxAddInterval) {
        clearInterval(this.boxAddInterval);
        this.boxAddInterval = null;
      }
    },
    cleanup() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      if (this.messageTimeout) {
        clearTimeout(this.messageTimeout);
      }
      window.removeEventListener('resize', this.setupCanvas);
      this.stopAddingBoxes();
    }
  },
};
</script>

<style>
body, html {
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.bounce-container {
  position: relative;
  width: 100vw;
  height: 100vh;
}

canvas {
  display: block;
}

.instruction-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  pointer-events: none;
  opacity: 1;
  transition: opacity 0.5s ease-out;
}

.instruction-message.fade-out {
  opacity: 0;
}

.message-content {
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 2rem 3rem;
  text-align: center;
  border: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  animation: gentle-float 2s ease-in-out infinite;
}

.message-text {
  color: white;
  font-size: 1.5rem;
  font-weight: 300;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  display: block;
  margin-bottom: 1rem;
  letter-spacing: 0.5px;
}

.message-icon {
  font-size: 2rem;
  animation: bounce-icon 1s ease-in-out infinite;
}

@keyframes gentle-float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

@keyframes bounce-icon {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .message-content {
    padding: 1.5rem 2rem;
  }
  
  .message-text {
    font-size: 1.2rem;
  }
  
  .message-icon {
    font-size: 1.5rem;
  }
}

/* Ensure touch events work properly on mobile */
@media (hover: none) and (pointer: coarse) {
  canvas {
    touch-action: none;
  }
}
</style>
