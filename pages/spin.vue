<template>
  <div style="display: flex; align-items: center; justify-content: center; height: 100vh;">
    <div :style="spinnerStyle">
      🌀
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      rotation: 0,
    };
  },
  computed: {
    spinnerStyle() {
      return {
        display: 'inline-block',
        fontSize: '5em',
        transition: 'transform 0.3s',
        transform: `rotate(${this.rotation}deg)`,
      };
    },
  },
  mounted() {
    this.$parent.$on('swipe-event', this.handleSwipeEvent);
  },
  beforeDestroy() {
    this.$parent.$off('swipe-event', this.handleSwipeEvent);
  },
  methods: {
    handleSwipeEvent(event) {
      this.rotation += 18;  // Endre dette tallet for å justere spinnvinkelen
    },
  },
};
</script>