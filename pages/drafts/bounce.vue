<template>
  <canvas 
    ref="canvas" 
    style="width: 100vw; height: 100vh;" 
    @mousedown="startAddingBoxes" 
    @mouseup="stopAddingBoxes" 
    @mouseleave="stopAddingBoxes"
    @click="addBox"
  ></canvas>
</template>

<script>
export default {
  data() {
    return {
      ctx: null,
      boxes: [],
      animationFrameId: null,
      isAddingBoxes: false,
      boxAddInterval: null
    };
  },
  mounted() {
    this.setupCanvas();
    this.animate();
    window.addEventListener('resize', this.setupCanvas);
  },
  beforeDestroy() {
    this.cleanup();
  },
  methods: {
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
      
      const rect = this.$refs.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      this.createBox(x, y);
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

canvas {
  display: block;
}
</style>
