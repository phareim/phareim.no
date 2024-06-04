<template>
  <div class="art" :style="transformStyle">
    got art?
  </div>
</template>

<script>
export default {
  data() {
    return {
      alpha: 10,
      beta: 20, 
      gamma: 30,
      zeta: 40,
      omega: 5,
      zebra: 6,
      grow: true
    };
  },
  computed: {
    transformStyle() {
    return {
      transform: `
        rotate(${this.alpha}deg) 
        scale(${Math.abs(this.zeta) / 100})
        skew(${this.omega}deg, ${this.zebra}deg)
      `,
    };
  },
  },
  mounted() {
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', this.handleOrientation);
    }
    this.interval = setInterval(() => {
      this.alpha = (this.grow? this.alpha +1 : this.alpha -1);
      this.beta += (this.grow? this.beta +1 : this.beta -1);
      this.gamma += (this.grow? this.gamma +1 : this.gamma -1);
      this.zeta += (this.grow? this.zeta +1 : this.zeta -1);
      this.omega += (this.grow? this.omega +1 : this.omega -1);
      this.zebra += (this.grow? this.zebra +1 : this.zebra -1);
      if(this.alpha > 100){
        this.grow = false;
      } else if(this.alpha < 10){
        this.grow = true;
      }
    }, 50); //
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