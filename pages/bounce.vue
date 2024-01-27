<template>
  <canvas ref="canvas" width="600" height="400"></canvas>
</template>

<script>
export default {
  data() {
    return {
      ctx: null,
      x: 100,
      y: 100,
      vx: 2,
      vy: 2,
      boxSize: 20,
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
    },
    animate() {
      requestAnimationFrame(this.animate);
      this.ctx.clearRect(0, 0, this.$refs.canvas.width, this.$refs.canvas.height);
      this.drawBox();
      this.updatePosition();
    },
    drawBox() {
      this.ctx.fillStyle = 'gray';
      this.ctx.fillRect(this.x, this.y, this.boxSize, this.boxSize);
    },
    updatePosition() {
      // Sjekk for kollisjon med canvas-kanter
      if (this.x + this.vx > this.$refs.canvas.width - this.boxSize || this.x + this.vx < 0) {
        this.vx = -this.vx;
      }
      if (this.y + this.vy > this.$refs.canvas.height - this.boxSize || this.y + this.vy < 0) {
        this.vy = -this.vy;
      }

      this.x += this.vx;
      this.y += this.vy;
    },
  },
};
</script>