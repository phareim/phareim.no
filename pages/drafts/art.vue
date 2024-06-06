<template>
  <div class="art" :style="transformStyle">
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
      grow: true
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
  },
  mounted() {
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', this.handleOrientation);
    }
    this.interval = setInterval(() => {
      this.alpha.value += (this.alpha.grow? 1 : -1);
      this.beta.value += (this.beta.grow? 1 : -1);
      this.gamma.value += (this.gamma.grow? 1 : -1);
      this.zeta.value += (this.zeta.grow? 1 : -1);
      this.omega.value += (this.omega.grow? 1 : -1);
      this.zebra.value += (this.zebra.grow? 1 : -1);

      this.alpha.grow = this.alpha.value > 90 || this.alpha.value < 1? !this.alpha.grow : this.alpha.grow;
      this.beta.grow = this.beta.value > 90 || this.beta.value < 1? !this.beta.grow : this.beta.grow;
      this.gamma.grow = this.gamma.value > 90 || this.gamma.value < 1? !this.gamma.grow : this.gamma.grow;
      this.zeta.grow = this.zeta.value > 90 || this.zeta.value < 1? !this.zeta.grow : this.zeta.grow;
      this.omega.grow = this.omega.value > 90 || this.omega.value < 1? !this.omega.grow : this.omega.grow;
      this.zebra.grow = this.zebra.value > 90 || this.zebra.value < 1? !this.zebra.grow : this.zebra.grow;
    }, 50); 
  },
  beforeDestroy() {
    if (window.DeviceOrientationEvent) {
      window.removeEventListener('deviceorientation', this.handleOrientation);
    }
  },
  methods: {
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
  transition: transform 0.1s ease-in-out; 
}
</style>