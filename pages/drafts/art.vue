<template>
  <div class="art" :style="transformStyle">
    got art?
  </div>
</template>

<script>
export default {
  data() {
    return {
      beta: 20,  // Pitch: vipping frem og tilbake
      gamma: 30,  // Roll: vipping fra side til side
    };
  },
  computed: {
    transformStyle() {
      return {
        transform: `rotate(${this.gamma}deg) translateX(${this.gamma * 2}px) translateY(${this.beta * 2}px)`,
      };
    },
  },
  mounted() {
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', this.handleOrientation);
    }
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
  font-size: 7em;
  /* transition: transform 0.1s ease-in-out;   */
}
</style>