<template>
  <div class="container">
    <canvas ref="canvas"></canvas>
    <div class="overlay" @click="addBox">
      <div class="home">
        <div class="flip-container" @click="flip" @pointerdown="flipStart" @pointerup="flipStop">
          <div class="flipper">
            <div class="front">
              <!-- Bilde på forsiden -->
              <img class="profile-pic" src="/public/petter1.png" alt="petter's profile picture" oncontextmenu="return false;"
                ontouchstart="return false;">
            </div>
            <div class="back">
              <!-- Bilde på baksiden -->
              <img class="profile-pic" src="/public/petter2.jpeg" alt="Bakside" oncontextmenu="return false;" ontouchstart="return false;">
            </div>
          </div>
        </div>
        <h1>petter hareim</h1>
        <p class="blurb">father, husband, geek, aspiring good guy.<br>
          head of software development at <a href="https://hkraft.no" class="hidden-href" target="_blank">haugaland kraft</a>.
        </p>
        <p class="blurb">
          help folks, write code, build useful things.
        </p>
<p class="location">
54°26'51 S 3°19'15 E
</p>
        <div class="social-links">
          <a href="https://www.linkedin.com/in/phareim" target="_blank"><svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="5em"
              height="50" viewBox="0 0 50 50" class="">
              <path
                d="M41,4H9C6.24,4,4,6.24,4,9v32c0,2.76,2.24,5,5,5h32c2.76,0,5-2.24,5-5V9C46,6.24,43.76,4,41,4z M17,20v19h-6V20H17z M11,14.47c0-1.4,1.2-2.47,3-2.47s2.93,1.07,3,2.47c0,1.4-1.12,2.53-3,2.53C12.2,17,11,15.87,11,14.47z M39,39h-6c0,0,0-9.26,0-10 c0-2-1-4-3.5-4.04h-0.08C27,24.96,26,27.02,26,29c0,0.91,0,10,0,10h-6V20h6v2.56c0,0,1.93-2.56,5.81-2.56 c3.97,0,7.19,2.73,7.19,8.26V39z">
              </path>
            </svg></a>
          <a href="https://twitter.com/phareim" target="_blank"><svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="50" height="50"
              viewBox="0 0 50 50" class="">
              <path
                d="M 50.0625 10.4375 C 48.214844 11.257813 46.234375 11.808594 44.152344 12.058594 C 46.277344 10.785156 47.910156 8.769531 48.675781 6.371094 C 46.691406 7.546875 44.484375 8.402344 42.144531 8.863281 C 40.269531 6.863281 37.597656 5.617188 34.640625 5.617188 C 28.960938 5.617188 24.355469 10.21875 24.355469 15.898438 C 24.355469 16.703125 24.449219 17.488281 24.625 18.242188 C 16.078125 17.8125 8.503906 13.71875 3.429688 7.496094 C 2.542969 9.019531 2.039063 10.785156 2.039063 12.667969 C 2.039063 16.234375 3.851563 19.382813 6.613281 21.230469 C 4.925781 21.175781 3.339844 20.710938 1.953125 19.941406 C 1.953125 19.984375 1.953125 20.027344 1.953125 20.070313 C 1.953125 25.054688 5.5 29.207031 10.199219 30.15625 C 9.339844 30.390625 8.429688 30.515625 7.492188 30.515625 C 6.828125 30.515625 6.183594 30.453125 5.554688 30.328125 C 6.867188 34.410156 10.664063 37.390625 15.160156 37.472656 C 11.644531 40.230469 7.210938 41.871094 2.390625 41.871094 C 1.558594 41.871094 0.742188 41.824219 -0.0585938 41.726563 C 4.488281 44.648438 9.894531 46.347656 15.703125 46.347656 C 34.617188 46.347656 44.960938 30.679688 44.960938 17.09375 C 44.960938 16.648438 44.949219 16.199219 44.933594 15.761719 C 46.941406 14.3125 48.683594 12.5 50.0625 10.4375 Z">
              </path>
            </svg></a>
          <a href="https://github.com/phareim" target="_blank"><svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="50" height="50"
              viewBox="0 0 50 50" class="">
              <path
                d="M17.791,46.836C18.502,46.53,19,45.823,19,45v-5.4c0-0.197,0.016-0.402,0.041-0.61C19.027,38.994,19.014,38.997,19,39 c0,0-3,0-3.6,0c-1.5,0-2.8-0.6-3.4-1.8c-0.7-1.3-1-3.5-2.8-4.7C8.9,32.3,9.1,32,9.7,32c0.6,0.1,1.9,0.9,2.7,2c0.9,1.1,1.8,2,3.4,2 c2.487,0,3.82-0.125,4.622-0.555C21.356,34.056,22.649,33,24,33v-0.025c-5.668-0.182-9.289-2.066-10.975-4.975 c-3.665,0.042-6.856,0.405-8.677,0.707c-0.058-0.327-0.108-0.656-0.151-0.987c1.797-0.296,4.843-0.647,8.345-0.714 c-0.112-0.276-0.209-0.559-0.291-0.849c-3.511-0.178-6.541-0.039-8.187,0.097c-0.02-0.332-0.047-0.663-0.051-0.999 c1.649-0.135,4.597-0.27,8.018-0.111c-0.079-0.5-0.13-1.011-0.13-1.543c0-1.7,0.6-3.5,1.7-5c-0.5-1.7-1.2-5.3,0.2-6.6 c2.7,0,4.6,1.3,5.5,2.1C21,13.4,22.9,13,25,13s4,0.4,5.6,1.1c0.9-0.8,2.8-2.1,5.5-2.1c1.5,1.4,0.7,5,0.2,6.6c1.1,1.5,1.7,3.2,1.6,5 c0,0.484-0.045,0.951-0.11,1.409c3.499-0.172,6.527-0.034,8.204,0.102c-0.002,0.337-0.033,0.666-0.051,0.999 c-1.671-0.138-4.775-0.28-8.359-0.089c-0.089,0.336-0.197,0.663-0.325,0.98c3.546,0.046,6.665,0.389,8.548,0.689 c-0.043,0.332-0.093,0.661-0.151,0.987c-1.912-0.306-5.171-0.664-8.879-0.682C35.112,30.873,31.557,32.75,26,32.969V33 c2.6,0,5,3.9,5,6.6V45c0,0.823,0.498,1.53,1.209,1.836C41.37,43.804,48,35.164,48,25C48,12.318,37.683,2,25,2S2,12.318,2,25 C2,35.164,8.63,43.804,17.791,46.836z">
              </path>
            </svg></a>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Home',
  data() {
    return {
      ctx: null,
      boxes: [],  // Liste for å holde på alle boksene
      boxCopy: [],
      darkMode: false,
    };
  },
  mounted() {
    this.setupCanvas();
    this.animate();
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.darkMode = true;
    }
  },
  methods: {
    setupCanvas() {
      const canvas = this.$refs.canvas;
      this.ctx = canvas.getContext('2d');
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    },
    animate() {
      requestAnimationFrame(this.animate);
      this.ctx.clearRect(0, 0, this.$refs?.canvas?.width, this.$refs?.canvas?.height);
      this.boxes.forEach(box => {
        this.updatePosition(box);
        this.drawBox(box);
        // this.checkCollisions(box); // does not work
      });
    },
    getNewShadow(strength, color = 'rgba(0, 0, 0, 0.5') {
      const shadow = {
        shadowOffsetX: strength * 1,
        shadowOffsetY: Math.floor(strength * 0.5),
        shadowColor: color,
        shadowBlur: Math.floor(strength * 0.5) + 2
      }
      shadow.css = `${shadow.shadowOffsetX}px ${shadow.shadowOffsetY}px ${shadow.shadowBlur}px ${shadow.shadowColor}`;
      return shadow;
    },
    updateShadows() {
      const shadow = this.getNewShadow(this.boxes.length);
      // Oppdaterer tekstskygge
      document.querySelectorAll('.text-shadow').forEach(element => {
        element.style.textShadow = shadow.css;
      });

      // Oppdaterer SVG-skygge
      document.querySelectorAll('.svg-shadow').forEach(element => {
        element.style.filter = `drop-shadow(${shadow.css})`;
      });

      document.querySelectorAll('.profile-pic').forEach(profilePicture => {
        profilePicture.style.boxShadow = shadow.css;
      });
    },
    updatePosition(box) {
      // Sjekk for kollisjon med canvas-kanter
      if (box.x + box.vx > this.$refs?.canvas?.width - (box.size / 2) || box.x + box.vx - (box.size / 2) < 0) {
        if (box.turned) {
          box.size = box.size * 0.9;
        }
        box.vx = -box.vx;
        box.turned = true;
      }
      else if (box.y + box.vy > this.$refs?.canvas?.height - (box.size / 2) || box.y + box.vy - (box.size / 2) < 0) {
        if (box.turned) {
          box.size = box.size * 0.9;
        }
        box.vy = -box.vy;
        box.turned = true;
      }
      else {
        box.turned = false;
      }

      if (box.x + box.vx > this.$refs?.canvas?.width - (box.size / 2) && box.y + box.vy - (box.size / 2) < 0) {
        box.size = box.size * 0.9;
      }
      else if (box.x + box.vx - (box.size / 2) < 0 && box.y + box.vy - (box.size / 2) < 0) {
        box.size = box.size * 0.9;
      }
      else if (box.x + box.vx > this.$refs?.canvas?.width - (box.size / 2) && box.y + box.vy > this.$refs.canvas.height - (box.size / 2)) {
        box.size = box.size * 0.9;
      }
      else if (box.x + box.vx - (box.size / 2) < 0 && box.y + box.vy > this.$refs?.canvas?.height - (box.size / 2)) {
        box.size = box.size * 0.9;
      }

      box.x += box.vx;
      box.y += box.vy;
    },
    checkCollisions(currentBox) {
      this.boxes.forEach(box => {
        if (currentBox !== box && this.isColliding(currentBox, box)) {
          // Endrer retning på boksene
          const tempVx = currentBox.vx;
          currentBox.vx = currentBox.vy;
          currentBox.vy = tempVx;
        }
      });
    },
    drawBox(box) {
      this.ctx.beginPath(); // Starter en ny sti
      this.ctx.arc(box.x, box.y, box.size / 2, 0, 2 * Math.PI); // Tegner en sirkel

      // Konfigurerer skygge
      this.ctx.shadowOffsetX = box.shadow.shadowOffsetX; // Skyggens forskyvning horisontalt
      this.ctx.shadowOffsetY = box.shadow.shadowOffsetY; // Skyggens forskyvning vertikalt
      this.ctx.shadowBlur = box.shadow.shadowBlur; // Skyggens uskarphet
      this.ctx.shadowColor = box.shadow.shadowColor; // Skyggens farge og gjennomsiktighet

      this.ctx.fillStyle = box.color;
      this.ctx.fill(); // Fyller sirkelen med farge

      // Nullstill skyggeinnstillinger for å unngå at hele canvaset påvirkes
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
      this.ctx.shadowBlur = 0;
      this.ctx.shadowColor = 'transparent';
    },

    isColliding(box1, box2) {
      return (
        box1.x < box2.x + (box2.size / 2) &&
        box1.x + (box1.size / 2) > box2.x &&
        box1.y < box2.y + (box2.size / 2) &&
        (box1.size / 2) + box1.y > box2.y
      );
    },
    flip(event) {
      this.boxes.forEach(box => {
        box.color = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
        box.vx = box.vx * 4;
        box.vy = box.vy * 4;
      });
      event.stopPropagation();
    },
    flipStart(event) {
      this.boxes.forEach(box => {
        box.color = `#333`;
        box.vx = box.vx * 0.25;
        box.vy = box.vy * 0.25;
      });
      event.stopPropagation();
    },
    flipStop(event) {
      event.stopPropagation();
    },
    addBox(event) {
      const rect = this.$refs.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const size = (Math.random() * 200) + 10;
      const color = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
      const shadowColor = this.darkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(10, 10, 10, 0.5)';
      const shadow = this.getNewShadow(this.boxes.length, shadowColor);
      const yvelocity = ((Math.random() * 1.2) * (Math.random() < 0.5 ? -1 : 1));
      const xvelocity = ((Math.random() * 1.2) * (Math.random() < 0.5 ? -1 : 1));
      this.boxes.push({ x, y, vx: xvelocity, vy: yvelocity, size, color, turned: false, shadow });
      this.updateShadows();
    },
  },
};
</script>

<style>
body,
html {
  margin: 0;
  padding: 0;
  overflow: hidden;
}

/* Standard stiler for lys modus */
body {
  background-color: white;
  color: black;
}

/* Stiler for mørk modus */
@media (prefers-color-scheme: dark) {
  body {
    background-color: #222;
    color: white;
  }
}


/* Container som holder flipperen */
.flip-container {
  perspective: 1000px;
  height: 200px;
  /* Legger til dybdeperspektiv */
  width: 200px;
  /*center*/
  margin-left: auto;
  margin-right: auto;
  cursor: pointer;
}

/* Flipperen selv */
.flipper {
  transition: 1s;
  transform-style: preserve-3d;
  /* Bevarer 3D-transformasjonene */
  position: relative;
}

/* Forside og bakside */
.front,
.back {
  backface-visibility: hidden;
  /* Gjemmer baksiden av flipen */
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* Initialt viser forsiden */
.front {
  z-index: 2;
  transform: rotateY(0deg);
}

/* Baksiden er skjult og rotert 180 grader */
.back {
  transform: rotateY(180deg);
}

/* Når containeren er aktiv, roter flipperen */
.flip-container:active .flipper {
  transform: rotateY(180deg);
}

.container {
  position: relative;
  width: 100vw;
  height: 100vh;
}

canvas {
  width: 100vw;
  height: 100vh;
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2;
}

.home {
  text-align: center;
  margin-top: 5vh;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.profile-pic {
  border-radius: 50%;
  width: 200px;
  height: 200px;
  transition: transform 10s;
  transition-timing-function: ease-out;
  filter: drop-shadow(0px 0px 0px rgba(50, 50, 50, 0.35));
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
}

.hidden-href {
  color: inherit;
  text-decoration: none;
}

.hidden-href:hover {
  font-weight: bold;
  text-decoration: underline;
}

.social-links {
  text-align: center;
  margin-left: auto;
  margin-right: auto;
}

.social-links a {
  margin: 0 10px;
}

.social-links svg {
  width: 50px;
  height: 50px;
  fill: #000;
  transition: transform 0.7s;
  transition-timing-function: ease-in-out;
}

@media (prefers-color-scheme: dark) {
  .social-links svg {
    fill: white;
  }
}

.social-links svg:hover {
  transform: scale(1.4) rotate(-6deg);
}

.diffuse-border {
  color: black;
  text-shadow:
    1px 1px 0 rgba(255, 255, 255, 0.25),
    -1px 1px 0 rgba(255, 255, 255, 0.25),
    1px -1px 0 rgba(255, 255, 255, 0.25),
    -1px -1px 0 rgba(255, 255, 255, 0.25),
    1px 0px 0 rgba(255, 255, 255, 0.25),
    0px 1px 0 rgba(255, 255, 255, 0.25),
    -1px 0px 0 rgba(255, 255, 255, 0.25),
    0px -1px 0 rgba(255, 255, 255, 0.25);
}
</style>
