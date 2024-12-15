<template>
  <div @click="animateText" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
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
			isTransitionActive: false,
			textYOffset: 0,
			textRotation: 0,
			isTextAnimated: false,
			textColor: '#333',
			textScale: 0.8,
      touchStartX: 0,
      touchStartY: 0
    }
  },
	created() {
    this.pickRandomQuote();
  },
  methods: {
    handleTouchStart(event) {
      this.touchStartX = event.touches[0].clientX;
      this.touchStartY = event.touches[0].clientY;
    },
    handleTouchEnd(event) {
      const touchEndX = event.changedTouches[0].clientX;
      const touchEndY = event.changedTouches[0].clientY;
      
      const deltaX = touchEndX - this.touchStartX;
      const deltaY = touchEndY - this.touchStartY;
      
      // Hvis sveipet er hovedsakelig horisontalt og langt nok
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        this.animateText();
      }
    },
		animateText() {
      this.isTextAnimated = !this.isTextAnimated;
      this.setRandomBgColor();
		  this.setTextColor();
			this.setRandomScale();
			this.pickRandomQuote();
		},
		pickRandomQuote() {
      let newQuote;
      do {
        newQuote = this.quotes[Math.floor(Math.random() * this.quotes.length)];
      } while (newQuote === this.currentQuote);
      this.currentQuote = newQuote;
    },
		toggleTransition() {
      this.isTransitionActive = true;
      setTimeout(() => {
        this.isTransitionActive = false;
      }, 600);
		},
		setRandomTransform(maxTransformValue) {
      this.textYOffset = Math.floor(Math.random() * (maxTransformValue - (-maxTransformValue) + 1) + (-maxTransformValue));
      this.textRotation = Math.floor(Math.random() * (maxTransformValue - (-maxTransformValue) + 1) + (-maxTransformValue));
    }, 
		setRandomScale() {
      this.textScale = (Math.random() * (1.15 - 0.1) + 0.1).toFixed(2);
		},
    randomColor() {
      const letters = '0123456789ABCDEF';
      let color = '#';
      for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
      }
      return color;
		},
    setTextColor() {
      const bgColor = document.body.style.backgroundColor.slice(4, -1).split(', ');
      const [r, g, b] = bgColor.map(Number);
      const invertedR = 255 - r;
      const invertedG = 255 - g;
      const invertedB = 255 - b;
      this.textColor = `rgb(${invertedR}, ${invertedG}, ${invertedB})`;
		},
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
div {
	text-align: center;
}

h1.transition {
  transition: transform 0.6s ease-in-out, opacity 0.6s ease-in-out;
}
</style>
