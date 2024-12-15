<template>
  <div class="art" :style="combinedStyle">
    got art?
  </div>
</template>

<script>
const createAnimatedValue = (initialValue) => ({
  value: initialValue,
  grow: true
});

export default {
  data() {
    return {
      alpha: createAnimatedValue(10),
      beta: createAnimatedValue(20),
      gamma: createAnimatedValue(30),
      zeta: createAnimatedValue(40),
      omega: createAnimatedValue(5),
      zebra: createAnimatedValue(6),
      red: createAnimatedValue(100),
      green: createAnimatedValue(150),
      blue: createAnimatedValue(200),
      interval: null
    };
  },
  computed: {
    transformStyle() {
      if (!this.alpha?.value || !this.beta?.value || !this.gamma?.value || 
          !this.zeta?.value || !this.omega?.value || !this.zebra?.value) {
        return {};
      }

      return {
        transform: `
          rotate(${this.alpha.value}deg) 
          scale(${Math.abs(this.beta.value) / 100})
          skew(${this.gamma.value}deg, ${this.zeta.value}deg)
          translate(${this.omega.value}px, ${this.zebra.value}px)
        `,
      };
    },
    colorStyle() {
      if (!this.red?.value || !this.green?.value || !this.blue?.value) {
        return {};
      }

      return {
        color: `rgb(${this.red.value}, ${this.green.value}, ${this.blue.value})`,
      };
    },
    combinedStyle() {
      return { ...this.transformStyle, ...this.colorStyle };
    },
  },
  mounted() {
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', this.handleOrientation);
    }
    this.startAnimation();
  },
  beforeDestroy() {
    this.cleanup();
  },
  beforeUnmount() {
    this.cleanup();
  },
  methods: {
    startAnimation() {
      this.interval = setInterval(() => {
        this.updateValues(this.alpha);
        this.updateValues(this.beta);
        this.updateValues(this.gamma);
        this.updateValues(this.zeta);
        this.updateValues(this.omega);
        this.updateValues(this.zebra);
        this.updateValues(this.red);
        this.updateValues(this.green);
        this.updateValues(this.blue);
      }, 50);
    },
    cleanup() {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', this.handleOrientation);
      }
    },
    updateValues(prop) {
      if (!prop) return;
      
      prop.value += (prop.grow ? 1 : -1);
      prop.grow = prop.value > 255 || prop.value < 1 ? !prop.grow : prop.grow;
    },
    handleOrientation(event) {
      if (event?.beta) this.beta = event.beta;
      if (event?.gamma) this.gamma = event.gamma;
    },
  },
};
</script>

<style>
.art {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 7em;
  transition: transform 0.1s ease-in-out, color 0.1s ease-in-out; 
}
</style>