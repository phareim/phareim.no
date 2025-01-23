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
      rotation: 50,
    };
  },
  computed: {
    spinnerStyle() {
      return {
        display: 'inline-block',
        fontSize: '8em',
        transition: 'transform 0.3s',
        transform: `rotate(${this.rotation}deg)`,
      };
    },
  },
};
</script>