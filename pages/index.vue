<template>
  <div class="container">
    <canvas ref="canvas"></canvas>
    <div class="overlay" @click="addBox">
      <div class="home">
        <div class="flip-container" @click="flip" @pointerdown="flipStart" @pointerup="flipStop">
          <div class="flipper">
            <div class="front">
              <!-- Bilde på forsiden -->
              <img class="profile-pic" src="/petter1.png" alt="petter's profile picture" oncontextmenu="return false;"
              ontouchstart="return false;">
            </div>
            <div class="back">
              <!-- Bilde på baksiden -->
              <img class="profile-pic" src="/petter2.jpeg" alt="Bakside" oncontextmenu="return false;" ontouchstart="return false;">
            </div>
          </div>
        </div>
        <h1>petter hareim</h1>
        <p class="blurb">father, husband, geek, aspiring good guy.
        </p>
        <p class="blurb">
          help folks. write code. build things.
        </p>
        <p class="location">
          54°26'51 S 3°19'15 E
        </p>
        <div class="social-links">
          <a href="https://www.linkedin.com/in/phareim" target="_blank">
            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="5em"
            height="50" viewBox="0 0 50 50" class="linkedIn">
            <path 
            d="M41,4H9C6.24,4,4,6.24,4,9v32c0,2.76,2.24,5,5,5h32c2.76,0,5-2.24,5-5V9C46,6.24,43.76,4,41,4z M17,20v19h-6V20H17z M11,14.47c0-1.4,1.2-2.47,3-2.47s2.93,1.07,3,2.47c0,1.4-1.12,2.53-3,2.53C12.2,17,11,15.87,11,14.47z M39,39h-6c0,0,0-9.26,0-10 c0-2-1-4-3.5-4.04h-0.08C27,24.96,26,27.02,26,29c0,0.91,0,10,0,10h-6V20h6v2.56c0,0,1.93-2.56,5.81-2.56 c3.97,0,7.19,2.73,7.19,8.26V39z">
          </path>
        </svg></a>
        <a href="https://x.com/phareim" target="_blank"><svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="50" height="50"
          viewBox="0 0 50 50" class="twitter">
          <path  
          d="M 50.0625 10.4375 C 48.214844 11.257813 46.234375 11.808594 44.152344 12.058594 C 46.277344 10.785156 47.910156 8.769531 48.675781 6.371094 C 46.691406 7.546875 44.484375 8.402344 42.144531 8.863281 C 40.269531 6.863281 37.597656 5.617188 34.640625 5.617188 C 28.960938 5.617188 24.355469 10.21875 24.355469 15.898438 C 24.355469 16.703125 24.449219 17.488281 24.625 18.242188 C 16.078125 17.8125 8.503906 13.71875 3.429688 7.496094 C 2.542969 9.019531 2.039063 10.785156 2.039063 12.667969 C 2.039063 16.234375 3.851563 19.382813 6.613281 21.230469 C 4.925781 21.175781 3.339844 20.710938 1.953125 19.941406 C 1.953125 19.984375 1.953125 20.027344 1.953125 20.070313 C 1.953125 25.054688 5.5 29.207031 10.199219 30.15625 C 9.339844 30.390625 8.429688 30.515625 7.492188 30.515625 C 6.828125 30.515625 6.183594 30.453125 5.554688 30.328125 C 6.867188 34.410156 10.664063 37.390625 15.160156 37.472656 C 11.644531 40.230469 7.210938 41.871094 2.390625 41.871094 C 1.558594 41.871094 0.742188 41.824219 -0.0585938 41.726563 C 4.488281 44.648438 9.894531 46.347656 15.703125 46.347656 C 34.617188 46.347656 44.960938 30.679688 44.960938 17.09375 C 44.960938 16.648438 44.949219 16.199219 44.933594 15.761719 C 46.941406 14.3125 48.683594 12.5 50.0625 10.4375 Z">
        </path>
      </svg></a>
      <a href="https://github.com/phareim" target="_blank"><svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="50" height="50"
        viewBox="0 0 50 50" class="github">
        <path 
        d="M17.791,46.836C18.502,46.53,19,45.823,19,45v-5.4c0-0.197,0.016-0.402,0.041-0.61C19.027,38.994,19.014,38.997,19,39 c0,0-3,0-3.6,0c-1.5,0-2.8-0.6-3.4-1.8c-0.7-1.3-1-3.5-2.8-4.7C8.9,32.3,9.1,32,9.7,32c0.6,0.1,1.9,0.9,2.7,2c0.9,1.1,1.8,2,3.4,2 c2.487,0,3.82-0.125,4.622-0.555C21.356,34.056,22.649,33,24,33v-0.025c-5.668-0.182-9.289-2.066-10.975-4.975 c-3.665,0.042-6.856,0.405-8.677,0.707c-0.058-0.327-0.108-0.656-0.151-0.987c1.797-0.296,4.843-0.647,8.345-0.714 c-0.112-0.276-0.209-0.559-0.291-0.849c-3.511-0.178-6.541-0.039-8.187,0.097c-0.02-0.332-0.047-0.663-0.051-0.999 c1.649-0.135,4.597-0.27,8.018-0.111c-0.079-0.5-0.13-1.011-0.13-1.543c0-1.7,0.6-3.5,1.7-5c-0.5-1.7-1.2-5.3,0.2-6.6 c2.7,0,4.6,1.3,5.5,2.1C21,13.4,22.9,13,25,13s4,0.4,5.6,1.1c0.9-0.8,2.8-2.1,5.5-2.1c1.5,1.4,0.7,5,0.2,6.6c1.1,1.5,1.7,3.2,1.6,5 c0,0.484-0.045,0.951-0.11,1.409c3.499-0.172,6.527-0.034,8.204,0.102c-0.002,0.337-0.033,0.666-0.051,0.999 c-1.671-0.138-4.775-0.28-8.359-0.089c-0.089,0.336-0.197,0.663-0.325,0.98c3.546,0.046,6.665,0.389,8.548,0.689 c-0.043,0.332-0.093,0.661-0.151,0.987c-1.912-0.306-5.171-0.664-8.879-0.682C35.112,30.873,31.557,32.75,26,32.969V33 c2.6,0,5,3.9,5,6.6V45c0,0.823,0.498,1.53,1.209,1.836C41.37,43.804,48,35.164,48,25C48,12.318,37.683,2,25,2S2,12.318,2,25 C2,35.164,8.63,43.804,17.791,46.836z">
      </path>
    </svg></a>
    <a href="https://partner.cloudskillsboost.google/public_profiles/e7dcea7a-372a-4671-b56e-7daec9d97f47" target="_blank">
      <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="none"><g id="SVGRepo_bgCarrier" stroke-width="0">
      </g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path class="google-stroke-1" d="M10.313 5.376l1.887-1.5-.332-.414a5.935 5.935 0 00-5.586-1.217 5.89 5.89 0 00-3.978 4.084c-.03.113.312-.098.463-.056l2.608-.428s.127-.124.201-.205c1.16-1.266 3.126-1.432 4.465-.354l.272.09z"></path><path class="google-stroke-2" d="M13.637 6.3a5.835 5.835 0 00-1.77-2.838l-1.83 1.82a3.226 3.226 0 011.193 2.564v.323c.9 0 1.63.725 1.63 1.62 0 .893-.73 1.619-1.63 1.619l-3.257-.003-.325.035v2.507l.325.053h3.257a4.234 4.234 0 004.08-2.962A4.199 4.199 0 0013.636 6.3z"></path><path class="google-stroke-3" d="M4.711 13.999H7.97v-2.594H4.71c-.232 0-.461-.066-.672-.161l-.458.14-1.313 1.297-.114.447a4.254 4.254 0 002.557.87z"></path><path class="google-stroke-4" d="M4.711 5.572A4.234 4.234 0 00.721 8.44a4.206 4.206 0 001.433 4.688l1.89-1.884a1.617 1.617 0 01.44-3.079 1.63 1.63 0 011.714.936l1.89-1.878A4.24 4.24 0 004.71 5.572z"></path></g></svg>
    </a>
    <a href="https://www.miles.no/ansatte/petter-hareim/" target="_blank">
      <svg class="miles" version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="50" height="50" viewBox="00 0 44 32">
        <g >
          <path d="M14.7,10.8C14.7,10.8,14.7,10.8,14.7,10.8c-5,0-9.1-4.1-9-9.1c0,0,0,0,0,0H0V31h5.7V12.7
		c0.1,0.2,0.3,0.4,0.5,0.5c2.4,1.9,5.5,2.9,8.5,2.9c3.1,0,6.1-1,8.5-2.9c0.2-0.1,0.3-0.3,0.5-0.5V31h5.7V1.7h-5.7
		C23.7,6.7,19.7,10.8,14.7,10.8z"></path>
        </g>
      </svg>
    </a>
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
      thUpsideDown: false,
      mousePosition: { x: 0, y: 0, v: { x: 0, y: 0 } },
      statistics: {
        boxes: 0,
        collisions: 0,
        drawCount: 0,
        animateCount: 0
      }
    };
  },
  mounted() {
    this.setupCanvas();
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.darkMode = true;
    }
    window.addEventListener('mousemove', this.updateMousePosition);
    window.addEventListener('resize', this.setupCanvas);
    window.addEventListener('touchmove', this.updateTouchPosition);
    
    window.statistics = this.statistics;
    requestAnimationFrame(this.animate);
    this.addBox({clientX: window.innerWidth / 4, clientY: window.innerHeight / 3, layer: 1});
    this.addBox({clientX: (window.innerWidth / 4)*3, clientY: (window.innerHeight / 3)*2, layer: 1});
  },
  methods: {
    setupCanvas() {
      const canvas = this.$refs.canvas;
      this.ctx = canvas.getContext('2d');
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    },
    updateMousePosition(event) {
      const old = this.mousePosition;
      this.mousePosition = { x: event.clientX, y: event.clientY, v: { x: event.clientX - old.x, y: event.clientY - old.y } };
    },
    updateTouchPosition(event) {
      const touch = event.touches[0];
      this.mousePosition = { x: touch.clientX, y: touch.clientY, v: { x: touch.clientX - this.mousePosition.x, y: touch.clientY - this.mousePosition.y } };
    },
    animate() {
      this.statistics.animateCount++;
      this.statistics.boxes = this.boxes.length;
      requestAnimationFrame(this.animate);
      this.ctx.clearRect(0, 0, this.$refs?.canvas?.width, this.$refs?.canvas?.height);
      // Her tegner alle boksene på nytt og oppdaterer posisjonen for hver gang animate kalles
      this.boxes.forEach(box => {
        this.updatePosition(box);
        this.drawBox(box);
        if(!this.theUpsideDown){
          this.checkCollisions(box);
        }
      });
      //slow down mouse velocity
      this.mousePosition.v.x = (this.mousePosition.v.x * 0.8);
      this.mousePosition.v.y = (this.mousePosition.v.y * 0.8);
    },
    getNewShadow(strength, color = 'rgba(0, 0, 0, 0.5') {
      const shadow = {
        strength,
        shadowOffsetX: strength * 1,
        shadowOffsetY: Math.floor(strength * 0.5),
        shadowColor: color,
        shadowBlur: Math.floor(strength * 0.5) + 2
      }
      shadow.css = `${shadow.shadowOffsetX}px ${shadow.shadowOffsetY}px ${shadow.shadowBlur}px ${shadow.shadowColor}`;
      return shadow;
    },
    updateShadows() {
      const shadow = this.getNewShadow(0);
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
    removeBox(box) {
      this.boxes = this.boxes.filter(b => b !== box);
      this.updateShadows();    
    },
    checkCanvasEdges(box){
      // Sjekk for kollisjon med canvas-kanter
      if (box.x + box.vx > this.$refs?.canvas?.width - (box.size / 2) || box.x + box.vx - (box.size / 2) < 0) {
        if (box.turned) {
          box.size = box.size * 0.95;
        }
        box.vx = -box.vx;
        box.turned = true;
      }
      else if (box.y + box.vy > this.$refs?.canvas?.height - (box.size / 2) || box.y + box.vy - (box.size / 2) < 0) {
        if (box.turned) {
          box.size = box.size * 0.95;
        }
        box.vy = -box.vy;
        box.turned = true;
      }
      else {
        box.turned = false;
      }
      
      if (box.x + box.vx > this.$refs?.canvas?.width - (box.size / 2) && box.y + box.vy - (box.size / 2) < 0) {
        box.size = box.size * 0.95;
      }
      else if (box.x + box.vx - (box.size / 2) < 0 && box.y + box.vy - (box.size / 2) < 0) {
        box.size = box.size * 0.95;
      }
      else if (box.x + box.vx > this.$refs?.canvas?.width - (box.size / 2) && box.y + box.vy > this.$refs.canvas.height - (box.size / 2)) {
        box.size = box.size * 0.95;
      }
      else if (box.x + box.vx - (box.size / 2) < 0 && box.y + box.vy > this.$refs?.canvas?.height - (box.size / 2)) {
        box.size = box.size * 0.95;
      }
      // Sjekk for kollisjon med canvas-kanter, ferdig 😮‍💨
    },
    updatePosition(box) {
      this.checkCanvasEdges(box);
      // fjern boks hvis den er for liten
      if(box.size < 10) {
        this.removeBox(box);
      }
      box.vx = box.vx + (this.mousePosition.v.x * Math.random() * 0.3) * (Math.random()-0.3);
      box.vy = box.vy + (this.mousePosition.v.y * Math.random() * 0.3) * (Math.random()-0.3);
      
      Math.abs(box.vx) > 0.2 && (box.vx = (box.vx * 0.994));
      Math.abs(box.vy) > 0.2 && (box.vy = (box.vy * 0.994));
      
      if (Math.abs(box.vx) > 10 || Math.abs(box.vy) > 10) {
        box.size = box.size * 0.998;
        box.vx = box.vx * 0.9;
        box.vy = box.vy * 0.9;
      }
      box.x += box.vx;
      box.y += box.vy;
      
    },
    checkCollisions(currentBox) {
      this.boxes.forEach(box => {
        if (currentBox !== box && this.isColliding(currentBox, box)) {
          this.resolveCollision(currentBox, box);
        }
      });
    },
    resolveCollision(circle1, circle2) {
      if (circle1.shadow.strength  != circle2.shadow.strength) {
        return;
      }
      // Differanse i posisjon (for normal vektor)
      const dx = circle1.x - circle2.x;
      const dy = circle1.y - circle2.y;
      
      // Avstand mellom sirkelens sentre
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Normaliser normalvektoren
      const nx = dx / distance;
      const ny = dy / distance;
      
      // Finn relative hastigheter
      const vxDiff = circle1.vx - circle2.vx;
      const vyDiff = circle1.vy - circle2.vy;
      
      // Finn relativ hastighet langs normalvektoren
      const velocityAlongNormal = vxDiff * nx + vyDiff * ny;
      
      // Hvis hastigheten langs normalvektoren er positiv, betyr det at de går fra hverandre, så returner
      if (velocityAlongNormal > 0) return;
      
      // Massene til sirklene (kan tilpasses hvis de har forskjellige masser)
      const mass1 = circle1.size || 1;
      const mass2 = circle2.size || 1;
      
      // Elastisk kollisjonsformel for å oppdatere hastighetene
      const impulse = (2 * velocityAlongNormal) / (mass1 + mass2);
      
      circle1.vx -= impulse * mass2 * nx;
      circle1.vy -= impulse * mass2 * ny;
      circle2.vx += impulse * mass1 * nx;
      circle2.vy += impulse * mass1 * ny;
    },
    drawBox(box) {
      this.ctx.beginPath(); // Starter en ny sti
      this.ctx.arc(box.x, box.y, box.size / 2, 0, 2 * Math.PI); // Tegner en sirkel
      
      // Konfigurerer skygge
      if(!this.theUpsideDown){
        this.ctx.shadowOffsetX = box.shadow.shadowOffsetX; // Skyggens forskyvning horisontalt
        this.ctx.shadowOffsetY = box.shadow.shadowOffsetY; // Skyggens forskyvning vertikalt
        this.ctx.shadowBlur = box.shadow.shadowBlur; // Skyggens uskarphet
        this.ctx.shadowColor = box.shadow.shadowColor; // Skyggens farge og gjennomsiktighet
      }
      this.ctx.fillStyle = box.color;
      this.ctx.fill(); // Fyller sirkelen med farge
      this.ctx.closePath(); // Avslutter stien
      
      // Nullstill skyggeinnstillinger for å unngå at hele canvaset påvirkes
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
      this.ctx.shadowBlur = 0;
      this.ctx.shadowColor = 'transparent';
      
      this.ctx.stroke(); // Tegner sirkelens omriss
      this.ctx.lineWidth = (this.theUpsideDown?5:5); // Tykkelsen på sirkelens omriss
      this.ctx.strokeStyle = (this.theUpsideDown? 'rgba(100,90,80,0.2)':'rgba(0, 0, 0, 0.9)'); // Fargen på sirkelens omriss
      this.ctx.class = 'box';
      
      
    },
    
    isColliding(box1, box2) {
      const dx = box1.x - box2.x; // Differanse i x-koordinater
      const dy = box1.y - box2.y; // Differanse i y-koordinater
      const distance = Math.sqrt(dx * dx + dy * dy); // Avstand mellom sirkelens sentre
      
      return distance < (box1.size/2 + box2.size/2); // Sjekk om de kolliderer
    },
    flip(event) {
      document.body.classList.remove('dark-mode');
      this.theUpsideDown = false;
      this.boxes.forEach(box => {
        box.color = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
        box.vx = box.vx * 4;
        box.vy = box.vy * 4;
      });
      event.stopPropagation();
    },
    flipStart(event) {
      document.body.classList.add('dark-mode');
      this.theUpsideDown = true;
      this.boxes.forEach(box => {
        box.color = `#333`;
        box.vx = box.vx * 0.25;
        box.vy = box.vy * 0.25;
      });
      event.stopPropagation();
    },
    flipStop(event) {
      document.body.classList.remove('dark-mode');
      this.theUpsideDown = false;
      event.stopPropagation();
    },
    addBox(event) {
      if (this.boxes.length > 12 && window.innerWidth < 600) {
        return; // Slutt å legge til flere bokser på mobil
      }
      
      if (this.boxes.length > 24) {
        let scale = 20;
        for (let i = 0; i < this.boxes.length; i++) {
          const box = this.boxes[i];
          box.size = Math.abs (box.size - scale);
          scale = scale * 0.8;
          if (scale < 3) {
            continue;
          }
        };
      }
      const rect = this.$refs.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      console.log(event.clientX, event.clientY);
      const size = (Math.random() * 500) + 20;
      const r = (Math.random()> 0.5? 80 + Math.random()*20 : 200 + Math.random()*20);
      const g = (Math.random()> 0.5? 100 + Math.random()*20 : 190 + Math.random()*20);
      const b = (Math.random()> 0.5? 90 + Math.random()*20 : 280 + Math.random()*20);
      const sum = r + g + b;
      let shadowLength = 0;
      if(event.layer){
        shadowLength = event.layer === 3 ? 50 : event.layer === 2 ? 25 : 5;
      } else {
        shadowLength = sum < 420 ? 50 : sum >= 420 && sum < 550 ? 25 : 5;
      }
      
      const color = `rgb(${r}, ${g}, ${b})`;
      const shadowColor = this.darkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(10, 10, 10, 0.5)';
      const shadow = this.getNewShadow(shadowLength, shadowColor);
      const yvelocity = ((Math.random() * 0.8) * (Math.random() < 0.5 ? -1 : 1));
      const xvelocity = ((Math.random() * 0.8) * (Math.random() < 0.5 ? -1 : 1));
      
      this.boxes.push({ x, y, vx: xvelocity, vy: yvelocity,mass: size, size, color, turned: false, shadow });
      this.boxes = this.boxes.sort((a, b) => a.shadow.strength - b.shadow.strength);
      this.updateShadows();
    },
  },
};
</script>

<style>
body,
html, body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

body.dark-mode {
  background-color: #333;
  color: white;
}

body.dark-mode .social-links svg {
  fill: white;
}

/* Standard stiler for lys modus */
body {
  background-color: white;
  color: #111;
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
  transition: 1.2s;
  transform-style: preserve-3d;
  transition-timing-function: ease-in-out;
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
  margin-top: 6vh;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

h1 {
  transition: transform 4s;
  font-size: 3.5em;
  margin-top: 2px;
}

p {
  font-size: 1em;
}

.blurb {
  font-size: 1em;
}
@media(min-width: 800px) {
  .blurb {
    font-size: 1.2em;
  }
  h1 {
    margin-top: 0.1em;
    font-size: 4em;
  }
}

.location {
  font-size: 0.7em;
}

h1 p {
  transition: transform 0.4s;
}

.profile-pic {
  border-radius: 50%;
  width: 200px;
  height: 200px;
  transition: transform 8s;
  transition-timing-function: ease-out;
  filter: drop-shadow(0px 0px 0px rgba(50, 50, 50, 0.35));
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
  border: #222 5px solid;
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
  fill: #333;
  transition: transform 0.7s;
  transition-timing-function: ease-in-out;
}

@media (prefers-color-scheme: dark) {
  .social-links svg {
    fill: white;
  }
}

.social-links svg:hover {
  transform: scale(1.4) rotate(-2deg);
  text-shadow:   3px 30px 3px rgba(255, 255, 255, 0.25),
}
.social-links svg.miles:hover {
  fill: #b8261c;
}

.social-links svg.linkedIn:hover {
  fill: #0a66c2;
}

.social-links svg.twitter:hover {
  fill: #008AD8;
}

@media (prefers-color-scheme: dark) {
  .social-links svg.github:hover {
    fill: #ffffff;
  }
}

.social-links svg:hover path.google-stroke-1 {fill: #EA4335;}
.social-links svg:hover path.google-stroke-2 {fill: #4285F4;}
.social-links svg:hover path.google-stroke-3 {fill: #34A853;}
.social-links svg:hover path.google-stroke-4 {fill: #FBBC05;}

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
.box {
  z-index: 1;
}
</style>
