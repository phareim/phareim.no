<template>
  <div class="art" :style="combinedStyle">
    got art?
  </div>
</template>

<script>
export default {
  data() {
    return {
      alpha: {value: 10, grow: true},
      beta:  {value: 20, grow: true},
      gamma: {value: 30, grow: true},
      zeta:  {value: 40, grow: true},
      omega: {value: 5, grow: true},
      zebra: {value: 6, grow: true},
      red: {value: 100, grow: true},
      green: {value: 150, grow: true},
      blue: {value: 200, grow: true},
    };
  },
  computed: {
    transformStyle() {
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
  beforeDestroy() {
    if (window.DeviceOrientationEvent) {
      window.removeEventListener('deviceorientation', this.handleOrientation);
    }
    clearInterval(this.interval);
  },
  methods: {
    updateValues(prop) {
      prop.value += (prop.grow ? 1 : -1);
      prop.grow = prop.value > 255 || prop.value < 1 ? !prop.grow : prop.grow;
    },
    handleOrientation(event) {
      this.beta = event.beta;
      this.gamma = event.gamma;
    },
  },
};
</script>

<style>
.art {
  /** covers the entire screen */
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