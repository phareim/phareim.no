<template>
  <div @click="animateText">
      <h1 :style="{
        color: textColor,
        transform: `scale(${textScale}) translateY(${textYOffset}vh) rotate(${textRotation}deg)`
      }" :class="{ transition: isTransitionActive }"
>
{{currentQuote}}
</h1>
  </div>
</template>

<script>
export default {
  data() {
    return {
      quotes: [
        'Create Bad Art',
        'Code Creative Chaos',
        'Debug Dreamy Designs',
        'Script Stylish Stories',
        'Test Terrific Themes',
				'Mold Magical Methods',
				'Brew Brilliant Blueprints',
				'Fabricate Fabulous Frameworks',
				'Generate Gorgeous Graphics',
				'Illustrate Impressive Interfaces',
				'Sculpt Spectacular Software',
				'Draft Daring Databases',
				'Author Artistic Algorithms',
				'Devise Distinguished Designs',
				'Concoct Clever Codebases',
				'Forge Funky Functions',
				'Render Radiant Renders',
				'Bootstrap Breathtaking Builds',
				'Compose Captivating Code',
				'Assemble Amazing Apps',
				'Develop Dazzling Designs',
				'Engineer Elegant Elements',
				'Craft Creative Components',
				'Produce Polished Products',
				'Structure Stunning Systems',
				'Articulate Bad Consepts'
			],
			currentQuote: '', 
			isTransitionActive: false,  // Ny flagg for å styre overgangsstaten
			textYOffset: 0,  // Initial vertical offset
      textRotation: 0,  // Initial rotation
      isTextAnimated: false,
      textColor: '#333',  // Initial color
			textScale: 0.8,
    }
  },
	created() {
    this.pickRandomQuote();  // Velger et tilfeldig sitat når komponenten er opprettet
  },
  mounted() {
    this.$parent.$on('swipe-event', this.handleSwipeEvent);  // Lytt på sveipe-eventet
  },
  beforeDestroy() {
    this.$parent.$off('swipe-event', this.handleSwipeEvent);  // Fjern lytteren når komponenten ødelegges
  },
  methods: {
		handleSwipeEvent(event) {
      // Håndter sveipe-eventet her
			this.animateText();
    },
		animateText() {
      this.isTextAnimated = !this.isTextAnimated;
      this.setRandomBgColor();  // Set a random background color
		  this.setTextColor();
			//this.setRandomScale();
			//this.setRandomTransform(30);
			this.pickRandomQuote();  // Velg et nytt tilfeldig sitat
      this.toggleTransition();  // Aktiver overgangseffekten
		},
		pickRandomQuote() {
      // Sørger for at det nye sitatet er forskjellig fra det nåværende
      let newQuote;
      do {
        newQuote = this.quotes[Math.floor(Math.random() * this.quotes.length)];
      } while (newQuote === this.currentQuote);
      this.currentQuote = newQuote;
    },
		toggleTransition() {
      this.isTransitionActive = true;  // Aktiver overgangseffekten
      setTimeout(() => {
        this.isTransitionActive = false;  // Deaktiver overgangseffekten etter 300 ms
      }, 600);
		},
		/**
		 * Sets the text vertical offset and rotation to a random value, based on the maxTransformValue parameter
		 * @param {*} maxTransformValue 
		 */
		setRandomTransform(maxTransformValue) {
      this.textYOffset = Math.floor(Math.random() * (maxTransformValue - (-maxTransformValue) + 1) + (-maxTransformValue));
      this.textRotation = Math.floor(Math.random() * (maxTransformValue - (-maxTransformValue) + 1) + (-maxTransformValue));
    }, 
		setRandomScale() {
      this.textScale = (Math.random() * (1.15 - 0.1) + 0.1).toFixed(2);
		},
		/**
		 * Generates a random color
		 */
    randomColor() {
      const letters = '0123456789ABCDEF';
      let color = '#';
      for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
      }
      return color;
		},
		/**
		 * Sets the text color to the inverse of the background color
		 */
    setTextColor() {
      const bgColor = document.body.style.backgroundColor.slice(4, -1).split(', ');  // Extract RGB values from bgColor
      const [r, g, b] = bgColor.map(Number);
      const invertedR = 255 - r;
      const invertedG = 255 - g;
      const invertedB = 255 - b;
      this.textColor = `rgb(${invertedR}, ${invertedG}, ${invertedB})`;
		},
		/**
		 * Sets the background color to a random color and updates the theme-color meta tag
		 */
    setRandomBgColor() {
      const newColor = this.randomColor();
      document.body.style.backgroundColor = newColor;

      const metaThemeColor = document.querySelector('meta[name=theme-color]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', newColor);
      } else {
        const newMetaThemeColor = document.createElement('meta');
        newMetaThemeColor.name = 'theme-color';
        newMetaThemeColor.content = newColor;
        document.head.appendChild(newMetaThemeColor);
      }
    }
  }
}
</script>

<style>
div{
	  text-align: center;
}

h1.transition {
  transition: transform 0.6s ease-in-out, opacity 0.6s ease-in-out;
  opacity: 0.5;
}
</style>
