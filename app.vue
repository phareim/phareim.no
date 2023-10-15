<template>
  <div @touchstart="animateText"   :style="{ fontFamily: currentFont }">
    <header>
      <h1 :style="{
        color: textColor,
        transform: `scale(${textScale}) translateY(${textYOffset}vh) rotate(${textRotation}deg)`
      }" :class="{ transition: isTransitionActive }"
>
{{currentQuote}}
</h1>
    </header>
    <footer></footer>
  </div>
</template>

<script>
export default {
  data() {
    return {
      quotes: [
        'Build Bad Art',
        'Code Creative Chaos',
        'Debug Dreamy Designs',
        'Script Stylish Stories',
        'Test Terrific Themes'
      ],
			currentQuote: '', 
			isTransitionActive: false,  // Ny flagg for å styre overgangsstaten
			textYOffset: 0,  // Initial vertical offset
      textRotation: 0,  // Initial rotation
      isTextAnimated: false,
      textColor: '#333',  // Initial color
			currentFont: '"Comfortaa", arial ,cursive',  // Initial font
			fonts: [
        '"DM Sans", sans-serif',
        '"Inter", sans-serif',
        '"Space Mono", monospace',
        '"Space Grotesk", sans-serif',
        '"Work Sans", sans-serif',
        '"Syne", sans-serif',
        '"Libre Franklin", sans-serif',
        '"Cormorant", serif',
        '"Fira Sans", sans-serif',
        '"Eczar", serif',
        '"Alegreya Sans", sans-serif',
        '"Alegreya", serif',
        '"Source Sans Pro", sans-serif',
        '"Source Serif Pro", serif',
        '"Roboto", sans-serif',
        '"Roboto Slab", serif',
        '"Inknut Antiqua", serif'
      ],
			textScale: 1,
    }
  },
	created() {
    this.pickRandomQuote();  // Velger et tilfeldig sitat når komponenten er opprettet
  },
  methods: {
    animateText() {
      this.isTextAnimated = !this.isTextAnimated;
      this.textColor = this.randomColor();
      this.setRandomBgColor();  // Set a random background color
		  this.setRandomFont(); 
			this.setRandomScale();
			this.setRandomTransform(30);
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
		setRandomTransform(maxTransformValue) {
      // Generate a random vertical offset and rotation based on the maxTransformValue parameter
      this.textYOffset = Math.floor(Math.random() * (maxTransformValue - (-maxTransformValue) + 1) + (-maxTransformValue));
      this.textRotation = Math.floor(Math.random() * (maxTransformValue - (-maxTransformValue) + 1) + (-maxTransformValue));
    }, 
		setRandomScale() {
      // Generate a random scale value between 0.6 and 1.2
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
    setRandomBgColor() {
      const newColor = this.randomColor();
      document.body.style.backgroundColor = newColor;
      document.body.style.transition = 'background-color 0.06s ease-in-out';  // Optional: Add transition

      const metaThemeColor = document.querySelector('meta[name=theme-color]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', newColor);
      } else {
        const newMetaThemeColor = document.createElement('meta');
        newMetaThemeColor.name = 'theme-color';
        newMetaThemeColor.content = newColor;
        document.head.appendChild(newMetaThemeColor);
      }
    },
    setRandomFont() {
      this.currentFont = this.fonts[Math.floor(Math.random() * this.fonts.length)];
    }
  }
}
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=Comfortaa:wght@300&display=swap");

body, html {
  overflow: hidden;  /* Forhindrer scrolling */
  user-select: none;  /* Forhindrer tekstvalg */
}

div {
  display: grid;
  justify-content: center;
  align-content: center;
  height: 95vh;
  margin: 0;
  padding: 0;
}

header {
  text-align: center;
  font-family: "Comfortaa", cursive;
}

h1 {
  font-size: 5em;
  font-weight: 300;
  margin: 0;
  padding: 0;
  transition: color 0.8s ease-in-out, transform 0.4s ease-in-out; /* beholder transition */
}

h1.transition {
  transition: transform 0.6s ease-in-out, opacity 0.6s ease-in-out;
  opacity: 0.5;
}
</style>
