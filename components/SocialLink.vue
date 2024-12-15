<template>
  <a :href="href" target="_blank">
    <svg v-html="svgContent" :class="cssClass" :width="width" :height="height" :viewBox="viewBox"></svg>
  </a>
</template>

<script>
export default {
  name: 'SocialLink',
  props: {
    href: {
      type: String,
      required: true
    },
    svgContent: {
      type: String,
      required: true
    },
    cssClass: {
      type: String,
      default: ''
    },
    width: {
      type: [String, Number],
      default: '50'
    },
    height: {
      type: [String, Number],
      default: '50'
    },
    viewBox: {
      type: String,
      default: '0 0 50 50'
    }
  }
}
</script>

<style scoped>
a {
  margin: 0 10px;
}

svg {
  fill: #333;
  transition: transform 0.7s;
  transition-timing-function: ease-in-out;
}

@media (prefers-color-scheme: dark) {
  svg {
    fill: white;
  }
}

svg:hover {
  transform: scale(1.4) rotate(-2deg);
}

.miles:hover {
  fill: #b8261c;
}

.linkedIn:hover {
  fill: #0a66c2;
}

.bluesky:hover {
  fill: #0385ff;
}

@media (prefers-color-scheme: dark) {
  .github:hover {
    fill: #ffffff;
  }
}

:deep(svg:hover path.google-stroke-1) {fill: #EA4335;}
:deep(svg:hover path.google-stroke-2) {fill: #4285F4;}
:deep(svg:hover path.google-stroke-3) {fill: #34A853;}
:deep(svg:hover path.google-stroke-4) {fill: #FBBC05;}
</style> 