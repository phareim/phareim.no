<template>
  <canvas ref="canvas" style="width: 100vw; height: 100vh;" @click="addBox"></canvas>
</template>

<script>
export default {
  data() {
    return {
      ctx: null,
      boxes: [],  // Liste for å holde på alle boksene
    };
  },
  mounted() {
    this.setupCanvas();
    this.animate();
  },
  methods: {
    setupCanvas() {
      const canvas = this.$refs.canvas;
      this.ctx = canvas.getContext('2d');
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    },
    animate() {
      requestAnimationFrame(this.animate);
      this.ctx.clearRect(0, 0, this.$refs.canvas.width, this.$refs.canvas.height);
      this.boxes.forEach(box => {
        this.drawBox(box);
        this.updatePosition(box);
      });
    },
    drawBox(box) {
      this.ctx.fillStyle = box.color;
      this.ctx.fillRect(box.x, box.y, box.size, box.size);
    },
    updatePosition(box) {
      if (box.x + box.vx > this.$refs.canvas.width - box.size || box.x + box.vx < 0) {
        box.vx = -box.vx;
      }
      if (box.y + box.vy > this.$refs.canvas.height - box.size || box.y + box.vy < 0) {
        box.vy = -box.vy;
      }

      box.x += box.vx;
      box.y += box.vy;
    },
    addBox(event) {
      const rect = this.$refs.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const color = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
      this.boxes.push({ x, y, vx: 2, vy: 2, size: 5, color });
    },
  },
};
</script>
<style>
body, html {
  margin: 0;
  padding: 0;
  overflow: hidden; /* Forhindrer scrollbars */
}

canvas {
  display: block; /* Fjerner eventuell ekstra plass under canvas */
}
</style>
