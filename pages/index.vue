<template>
  <div class="container">
    <canvas ref="canvas" style="width: 100vw; height: 100vh;" @click="addBox"></canvas>
    <div class="overlay">
      <div class="home">
        <img class="profile-pic"
          src="https://media.licdn.com/dms/image/C5603AQFvIgKksv9i4g/profile-displayphoto-shrink_400_400/0/1662048611811?e=1711584000&v=beta&t=K37o_1J8QEB5oJyn93odTEAm9ZLhQr5rTD4Gkz7Fbq0"
          alt="Petter's Profile Picture">
        <h1>Petter Hareim</h1>
        <p class="blurb">father, husband, geek, all round good guy. Writer of code and builder of good things. Lead Developer at Haugaland
          Kraft.</p>
        <div class="social-links">
          <a href="https://www.linkedin.com/in/phareim" target="_blank">LinkedIn</a>
          <a href="https://twitter.com/phareim" target="_blank">Twitter</a>
          <a href="https://github.com/phareim" target="_blank">GitHub</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Home',
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
body,
html {
  margin: 0;
  padding: 0;
  overflow: hidden;
  /* Forhindrer scrollbars */
}

.container {
  position: relative;
  width: 100vw;
  height: 100vh;
}

canvas {
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  /* Sørger for at canvas er bakgrunnen */
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  /* Sørger for at innholdet legges over canvas */
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  /* Legg til mer stil etter behov */
}

.home {
  text-align: center;
  margin-top: 50px;
  max-width: 600px;
  /* comfortable reading width */
  margin-left: auto;
  margin-right: auto;
}

.profile-pic {
  border-radius: 50%;
  width: 200px;
  height: 200px;
}

.social-links a {
  margin: 0 10px;
}
</style>
