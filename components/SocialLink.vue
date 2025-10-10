<template>
  <a :href="href" target="_blank" class="social-link" :class="cssClass">
    <img v-if="isImageType" :src="computedImageSrc" :class="cssClass" :width="computedWidth" :height="computedHeight" alt="Social link" />
    <svg v-else v-html="computedSvgContent" :class="cssClass" :width="computedWidth" :height="computedHeight" :viewBox="computedViewBox"></svg>
  </a>
</template>

<script>
const SVG_DEFINITIONS = {
  linkedin: {
    content: `<path d="M41,4H9C6.24,4,4,6.24,4,9v32c0,2.76,2.24,5,5,5h32c2.76,0,5-2.24,5-5V9C46,6.24,43.76,4,41,4z M17,20v19h-6V20H17z M11,14.47c0-1.4,1.2-2.47,3-2.47s2.93,1.07,3,2.47c0,1.4-1.12,2.53-3,2.53C12.2,17,11,15.87,11,14.47z M39,39h-6c0,0,0-9.26,0-10 c0-2-1-4-3.5-4.04h-0.08C27,24.96,26,27.02,26,29c0,0.91,0,10,0,10h-6V20h6v2.56c0,0,1.93-2.56,5.81-2.56 c3.97,0,7.19,2.73,7.19,8.26V39z">`,
    viewBox: '0 0 50 50'
  },
  bluesky: {
    content: `<path d="M13.873 3.805C21.21 9.332 29.103 20.537 32 26.55v15.882c0-.338-.13.044-.41.867-1.512 4.456-7.418 21.847-20.923 7.944-7.111-7.32-3.819-14.64 9.125-16.85-7.405 1.264-15.73-.825-18.014-9.015C1.12 23.022 0 8.51 0 6.55 0-3.268 8.579-.182 13.873 3.805ZM50.127 3.805C42.79 9.332 34.897 20.537 32 26.55v15.882c0-.338.13.044.41.867 1.512 4.456 7.418 21.847 20.923 7.944 7.111-7.32 3.819-14.64-9.125-16.85 7.405 1.264 15.73-.825 18.014-9.015C62.88 23.022 64 8.51 64 6.55c0-9.818-8.578-6.732-13.873-2.745Z">`,
    viewBox: '0 0 64 57'
  },
  github: {
    content: `<path d="M17.791,46.836C18.502,46.53,19,45.823,19,45v-5.4c0-0.197,0.016-0.402,0.041-0.61C19.027,38.994,19.014,38.997,19,39 c0,0-3,0-3.6,0c-1.5,0-2.8-0.6-3.4-1.8c-0.7-1.3-1-3.5-2.8-4.7C8.9,32.3,9.1,32,9.7,32c0.6,0.1,1.9,0.9,2.7,2c0.9,1.1,1.8,2,3.4,2 c2.487,0,3.82-0.125,4.622-0.555C21.356,34.056,22.649,33,24,33v-0.025c-5.668-0.182-9.289-2.066-10.975-4.975 c-3.665,0.042-6.856,0.405-8.677,0.707c-0.058-0.327-0.108-0.656-0.151-0.987c1.797-0.296,4.843-0.647,8.345-0.714 c-0.112-0.276-0.209-0.559-0.291-0.849c-3.511-0.178-6.541-0.039-8.187,0.097c-0.02-0.332-0.047-0.663-0.051-0.999 c1.649-0.135,4.597-0.27,8.018-0.111c-0.079-0.5-0.13-1.011-0.13-1.543c0-1.7,0.6-3.5,1.7-5c-0.5-1.7-1.2-5.3,0.2-6.6 c2.7,0,4.6,1.3,5.5,2.1C21,13.4,22.9,13,25,13s4,0.4,5.6,1.1c0.9-0.8,2.8-2.1,5.5-2.1c1.5,1.4,0.7,5,0.2,6.6c1.1,1.5,1.7,3.2,1.6,5 c0,0.484-0.045,0.951-0.11,1.409c3.499-0.172,6.527-0.034,8.204,0.102c-0.002,0.337-0.033,0.666-0.051,0.999 c-1.671-0.138-4.775-0.28-8.359-0.089c-0.089,0.336-0.197,0.663-0.325,0.98c3.546,0.046,6.665,0.389,8.548,0.689 c-0.043,0.332-0.093,0.661-0.151,0.987c-1.912-0.306-5.171-0.664-8.879-0.682C35.112,30.873,31.557,32.75,26,32.969V33 c2.6,0,5,3.9,5,6.6V45c0,0.823,0.498,1.53,1.209,1.836C41.37,43.804,48,35.164,48,25C48,12.318,37.683,2,25,2S2,12.318,2,25 C2,35.164,8.63,43.804,17.791,46.836z">`,
    viewBox: '0 0 50 50'
  },
  google: {
    content: `<path class="google-stroke-1" d="M10.313 5.376l1.887-1.5-.332-.414a5.935 5.935 0 00-5.586-1.217 5.89 5.89 0 00-3.978 4.084c-.03.113.312-.098.463-.056l2.608-.428s.127-.124.201-.205c1.16-1.266 3.126-1.432 4.465-.354l.272.09z"></path><path class="google-stroke-2" d="M13.637 6.3a5.835 5.835 0 00-1.77-2.838l-1.83 1.82a3.226 3.226 0 011.193 2.564v.323c.9 0 1.63.725 1.63 1.62 0 .893-.73 1.619-1.63 1.619l-3.257-.003-.325.035v2.507l.325.053h3.257a4.234 4.234 0 004.08-2.962A4.199 4.199 0 0013.636 6.3z"></path><path class="google-stroke-3" d="M4.711 13.999H7.97v-2.594H4.71c-.232 0-.461-.066-.672-.161l-.458.14-1.313 1.297-.114.447a4.254 4.254 0 002.557.87z"></path><path class="google-stroke-4" d="M4.711 5.572A4.234 4.234 0 00.721 8.44a4.206 4.206 0 001.433 4.688l1.89-1.884a1.617 1.617 0 01.44-3.079 1.63 1.63 0 011.714.936l1.89-1.878A4.24 4.24 0 004.71 5.572z"></path>`,
    viewBox: '0 0 16 16'
  },
  miles: {
    content: `<path d="M14.7,10.8C14.7,10.8,14.7,10.8,14.7,10.8c-5,0-9.1-4.1-9-9.1c0,0,0,0,0,0H0V31h5.7V12.7 c0.1,0.2,0.3,0.4,0.5,0.5c2.4,1.9,5.5,2.9,8.5,2.9c3.1,0,6.1-1,8.5-2.9c0.2-0.1,0.3-0.3,0.5-0.5V31h5.7V1.7h-5.7 C23.7,6.7,19.7,10.8,14.7,10.8z">`,
    viewBox: '00 0 44 32'
  },
  kreftforeningen: {
    image: '/kreftforeningen.png',
    width: '46',
    height: '46',
  }
}

export default {
  name: 'SocialLink',
  props: {
    href: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true,
      validator: (value) => ['linkedin', 'bluesky', 'github', 'google', 'miles', 'kreftforeningen'].includes(value)
    },
    svgContent: {
      type: String,
      default: null
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
      default: null
    }
  },
  computed: {
    isImageType() {
      return !!SVG_DEFINITIONS[this.type]?.image;
    },
    computedImageSrc() {
      return SVG_DEFINITIONS[this.type]?.image || '';
    },
    computedWidth() {
      return SVG_DEFINITIONS[this.type]?.width || this.width;
    },
    computedHeight() {
      return SVG_DEFINITIONS[this.type]?.height || this.height;
    },
    computedSvgContent() {
      if (this.svgContent) return this.svgContent;
      return SVG_DEFINITIONS[this.type]?.content || '';
    },
    computedViewBox() {
      if (this.viewBox) return this.viewBox;
      return SVG_DEFINITIONS[this.type]?.viewBox || '0 0 50 50';
    }
  }
}
</script>

<style scoped>
a {
  margin: 0 10px;
}

a.kreftforeningen {
  margin: 0 !important;
}
svg, img {
  fill: #333;
  transition: transform 1.2s;
  transition-timing-function: ease-in-out;
}

@media (prefers-color-scheme: dark) {
  svg {
    fill: white;
  }
}

svg:hover, img:hover {
  transform: scale(2);
}
img.kreftforeningen:hover {
  transform: scale(2) rotate(-180deg);
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