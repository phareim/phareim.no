<template>
  <canvas ref="canvas" class="bubbles-canvas"></canvas>
</template>

<script>
/**
 * Floating glass bubbles that react to the pointer, touch and the gyroscope.
 * Click the overlay to add one; the profile-card flip scatters them.
 * Options API, moved verbatim from the old pages/index.vue.
 */
export default {
  name: 'Bubbles',
  data() {
    return {
      ctx: null,
      boxes: [],
      darkMode: false,
      theUpsideDown: false,
      mousePosition: { x: 0, y: 0, v: { x: 0, y: 0 } },
      animationFrameId: null,
      gyroOffsetX: 0,
      gyroOffsetY: 0,
      targetGyroX: 0,
      targetGyroY: 0,
      _gyroTapHandler: null,
    };
  },
  mounted() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.darkMode = true;
    }
    this.start();
  },
  beforeUnmount() {
    this.stop();
    document.body.classList.remove('dark-mode');
  },
  methods: {
    setupCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;
      this.ctx = canvas.getContext('2d');
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    },
    updateMousePosition(event) {
      const old = this.mousePosition;
      this.mousePosition = { x: event.clientX, y: event.clientY, v: { x: event.clientX - old.x, y: event.clientY - old.y } };
    },
    updateTouchPosition(event) {
      const touch = event.touches[0];
      this.mousePosition = { x: touch.clientX, y: touch.clientY, v: { x: touch.clientX - this.mousePosition.x, y: touch.clientY - this.mousePosition.y } };
    },
    animate() {
      if (!this.$refs.canvas) return;
      this.animationFrameId = requestAnimationFrame(this.animate);

      // Gyroscope: smooth toward target and inject delta as velocity nudge
      const prevGX = this.gyroOffsetX;
      const prevGY = this.gyroOffsetY;
      this.gyroOffsetX += (this.targetGyroX - this.gyroOffsetX) * 0.08;
      this.gyroOffsetY += (this.targetGyroY - this.gyroOffsetY) * 0.08;
      this.mousePosition.v.x += (this.gyroOffsetX - prevGX) * 5;
      this.mousePosition.v.y += (this.gyroOffsetY - prevGY) * 5;

      this.ctx.clearRect(0, 0, this.$refs?.canvas?.width, this.$refs?.canvas?.height);
      this.boxes.forEach(box => {
        this.updatePosition(box);
        this.drawBox(box);
        if (!this.theUpsideDown) {
          this.checkCollisions(box);
        }
      });
      this.mousePosition.v.x = (this.mousePosition.v.x * 0.9);
      this.mousePosition.v.y = (this.mousePosition.v.y * 0.9);
    },
    getNewShadow(strength, color = 'rgba(0, 0, 0, 0.5)') {
      return {
        strength,
        shadowOffsetX: strength * 1,
        shadowOffsetY: Math.floor(strength * 0.5),
        shadowColor: color,
        shadowBlur: Math.floor(strength * 0.5) + 2
      };
    },
    removeBox(box) {
      this.boxes = this.boxes.filter(b => b !== box);
    },
    checkCanvasEdges(box) {
      const w = this.$refs?.canvas?.width;
      const h = this.$refs?.canvas?.height;
      if (box.x + box.vx > w - (box.size / 2) || box.x + box.vx - (box.size / 2) < 0) {
        if (box.turned) box.size = box.size * 0.95;
        box.vx = -box.vx;
        box.turned = true;
      }
      else if (box.y + box.vy > h - (box.size / 2) || box.y + box.vy - (box.size / 2) < 0) {
        if (box.turned) box.size = box.size * 0.95;
        box.vy = -box.vy;
        box.turned = true;
      }
      else {
        box.turned = false;
      }

      // Corners shrink the bubble
      const left = box.x + box.vx - (box.size / 2) < 0;
      const right = box.x + box.vx > w - (box.size / 2);
      const top = box.y + box.vy - (box.size / 2) < 0;
      const bottom = box.y + box.vy > h - (box.size / 2);
      if ((right && top) || (left && top) || (right && bottom) || (left && bottom)) {
        box.size = box.size * 0.95;
      }
    },
    updatePosition(box) {
      if (!box) return;
      this.checkCanvasEdges(box);

      if (box.size < 10) {
        this.removeBox(box);
        return;
      }

      // Pointer / touch nudges
      box.vx += (this.mousePosition.v.x * Math.random() * 0.3) * (Math.random() - 0.3);
      box.vy += (this.mousePosition.v.y * Math.random() * 0.3) * (Math.random() - 0.3);

      // Fast bubbles shrink
      if (Math.abs(box.vx) > 10 || Math.abs(box.vy) > 10) {
        box.size = box.size * 0.998;
        box.vx = box.vx * 0.9;
        box.vy = box.vy * 0.9;
      }

      box.vx *= 0.98;
      box.vy *= 0.98;
      box.x += box.vx;
      box.y += box.vy;
    },
    checkCollisions(currentBox) {
      this.boxes.forEach(box => {
        if (currentBox !== box && this.isColliding(currentBox, box)) {
          this.resolveCollision(currentBox, box);
        }
      });
    },
    resolveCollision(circle1, circle2) {
      if (circle1.shadow.strength != circle2.shadow.strength) return;
      const dx = circle1.x - circle2.x;
      const dy = circle1.y - circle2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const nx = dx / distance;
      const ny = dy / distance;
      const vxDiff = circle1.vx - circle2.vx;
      const vyDiff = circle1.vy - circle2.vy;
      const velocityAlongNormal = vxDiff * nx + vyDiff * ny;
      if (velocityAlongNormal > 0) return;
      const mass1 = circle1.size || 1;
      const mass2 = circle2.size || 1;
      const impulse = (2 * velocityAlongNormal) / (mass1 + mass2);
      circle1.vx -= impulse * mass2 * nx;
      circle1.vy -= impulse * mass2 * ny;
      circle2.vx += impulse * mass1 * nx;
      circle2.vy += impulse * mass1 * ny;
    },
    drawBox(box) {
      this.ctx.beginPath();
      this.ctx.arc(box.x, box.y, box.size / 2, 0, 2 * Math.PI);
      if (!this.theUpsideDown) {
        this.ctx.shadowOffsetX = box.shadow.shadowOffsetX;
        this.ctx.shadowOffsetY = box.shadow.shadowOffsetY;
        this.ctx.shadowBlur = box.shadow.shadowBlur;
        this.ctx.shadowColor = box.shadow.shadowColor;
      }
      this.ctx.fillStyle = box.color;
      this.ctx.fill();
      this.ctx.closePath();
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
      this.ctx.shadowBlur = 0;
      this.ctx.shadowColor = 'transparent';
      this.ctx.lineWidth = 5;
      this.ctx.strokeStyle = (this.theUpsideDown ? 'rgba(100,90,80,0.2)' : 'rgba(0, 0, 0, 0.9)');
      this.ctx.stroke();
    },
    isColliding(box1, box2) {
      const dx = box1.x - box2.x;
      const dy = box1.y - box2.y;
      return Math.sqrt(dx * dx + dy * dy) < (box1.size / 2 + box2.size / 2);
    },

    // ---- Public: wired to the profile card and the overlay ----
    flip(event) {
      document.body.classList.remove('dark-mode');
      this.theUpsideDown = false;
      this.boxes.forEach(box => {
        box.color = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
        box.vx = box.vx * 6;
        box.vy = box.vy * 6;
      });
      event.stopPropagation();
    },
    flipStart(event) {
      document.body.classList.add('dark-mode');
      this.theUpsideDown = true;
      this.boxes.forEach(box => {
        box.color = `#333`;
        box.vx = box.vx * 0.25;
        box.vy = box.vy * 0.25;
      });
      event.stopPropagation();
    },
    flipStop(event) {
      document.body.classList.remove('dark-mode');
      this.theUpsideDown = false;
      event.stopPropagation();
    },
    addBubble(event) {
      if (this.boxes.length > 12 && window.innerWidth < 600) return;

      if (this.boxes.length > 24) {
        let scale = 20;
        for (const box of this.boxes) {
          box.size = Math.abs(box.size - scale);
          scale = scale * 0.8;
        }
      }
      const rect = this.$refs.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const size = (Math.random() * 300) + 50;
      const r = (Math.random() > 0.5 ? 75 + Math.random() * 20 : 150 + Math.random() * 20);
      const g = (Math.random() > 0.5 ? 50 + Math.random() * 100 : 125 + Math.random() * 20);
      const b = (Math.random() > 0.5 ? 100 + Math.random() * 20 : 255);

      let shadowLength;
      if (event.layer) {
        shadowLength = event.layer === 1 ? 0 : 30;
      } else {
        shadowLength = (r + g + b) > 420 ? 0 : 30;
      }

      const color = `rgb(${r}, ${g}, ${b})`;
      const shadowColor = this.darkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(10, 10, 10, 0.5)';
      const shadow = this.getNewShadow(shadowLength, shadowColor);
      const yvelocity = ((Math.random() * 0.8) * (Math.random() < 0.5 ? -1 : 1));
      const xvelocity = ((Math.random() * 0.8) * (Math.random() < 0.5 ? -1 : 1));

      this.boxes.push({ x, y, vx: xvelocity, vy: yvelocity, size, color, turned: false, shadow });
      this.boxes = this.boxes.sort((a, b) => a.shadow.strength - b.shadow.strength);
    },

    // ---- Gyroscope ----
    handleOrientation(event) {
      if (event.gamma !== null && event.beta !== null) {
        this.targetGyroX = event.gamma * 1.5;
        this.targetGyroY = (event.beta - 45) * 1.5;
      }
    },
    enableGyro() {
      const DOE = window.DeviceOrientationEvent;
      if (typeof DOE !== 'undefined' && typeof DOE.requestPermission === 'function') {
        DOE.requestPermission().then(state => {
          if (state === 'granted') {
            window.addEventListener('deviceorientation', this.handleOrientation);
          }
        }).catch(console.warn);
      } else if ('DeviceOrientationEvent' in window) {
        window.addEventListener('deviceorientation', this.handleOrientation);
      }
    },

    // ---- Lifecycle ----
    start() {
      this.$nextTick(() => {
        this.setupCanvas();
        window.addEventListener('mousemove', this.updateMousePosition);
        window.addEventListener('resize', this.setupCanvas);
        window.addEventListener('touchmove', this.updateTouchPosition);
        this.animationFrameId = requestAnimationFrame(this.animate);
        this.addBubble({ clientX: window.innerWidth / 4, clientY: window.innerHeight / 3, layer: 1 });
        this.addBubble({ clientX: (window.innerWidth / 4) * 3, clientY: (window.innerHeight / 3) * 2, layer: 1 });

        // Gyroscope: Android works without a gesture, iOS needs a tap
        const DOE = window.DeviceOrientationEvent;
        if (typeof DOE !== 'undefined' && typeof DOE.requestPermission !== 'function') {
          window.addEventListener('deviceorientation', this.handleOrientation);
        }
        this._gyroTapHandler = () => { this.enableGyro(); };
        document.addEventListener('click', this._gyroTapHandler, { once: true });
      });
    },
    stop() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      window.removeEventListener('mousemove', this.updateMousePosition);
      window.removeEventListener('resize', this.setupCanvas);
      window.removeEventListener('touchmove', this.updateTouchPosition);
      window.removeEventListener('deviceorientation', this.handleOrientation);
      if (this._gyroTapHandler) {
        document.removeEventListener('click', this._gyroTapHandler);
        this._gyroTapHandler = null;
      }
      this.boxes = [];
    },
  },
};
</script>

<style>
.bubbles-canvas {
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

body.dark-mode {
  background-color: #333;
  color: white;
}

body.dark-mode .social-links svg {
  fill: white;
}
</style>
