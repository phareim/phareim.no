<template>
  <div class="container">
    <canvas ref="canvas"></canvas>
    <div class="overlay" @click="addBox">
      <div class="home">
        <ProfileCard 
          @flip="flip"
          @flipStart="flipStart"
          @flipStop="flipStop"
        />
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
          <SocialLink 
            href="https://www.linkedin.com/in/phareim"
            type="linkedin"
            css-class="linkedIn"
          />
          <SocialLink 
            href="https://bsky.app/profile/phareim.no"
            type="bluesky"
            css-class="bluesky"
          />
          <SocialLink 
            href="https://github.com/phareim"
            type="github"
            css-class="github"
          />
          <SocialLink 
            href="https://partner.cloudskillsboost.google/public_profiles/e7dcea7a-372a-4671-b56e-7daec9d97f47"
            type="google"
          />
          <SocialLink 
            href="https://www.miles.no/ansatte/petter-hareim/"
            type="miles"
            css-class="miles"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import ProfileCard from '~/components/ProfileCard.vue'
import SocialLink from '~/components/SocialLink.vue'

export default {
  name: 'Home',
  components: {
    ProfileCard,
    SocialLink
  },
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
      },
      animationFrameId: null,
      orientation: {
        beta: 0,  // X-akse (tilting fremover/bakover)
        gamma: 0, // Y-akse (tilting venstre/høyre)
        alpha: 0  // Z-akse (rotasjon)
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
    
    // Be om tillatelse og sett opp DeviceOrientation
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(response => {
          if (response === 'granted') {
            window.addEventListener('deviceorientation', this.handleDeviceOrientation);
          }
        })
        .catch(console.error);
    } else {
      window.addEventListener('deviceorientation', this.handleDeviceOrientation);
    }
    
    window.statistics = this.statistics;
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.addBox({clientX: window.innerWidth / 4, clientY: window.innerHeight / 3, layer: 1});
    this.addBox({clientX: (window.innerWidth / 4)*3, clientY: (window.innerHeight / 3)*2, layer: 1});
  },
  beforeDestroy() {
    window.removeEventListener('mousemove', this.updateMousePosition);
    window.removeEventListener('resize', this.setupCanvas);
    window.removeEventListener('touchmove', this.updateTouchPosition);
    window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  },
  methods: {
    setupCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;
      
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
      if (!this.$refs.canvas) return;
      
      this.statistics.animateCount++;
      this.animationFrameId = requestAnimationFrame(this.animate);
      this.ctx.clearRect(0, 0, this.$refs?.canvas?.width, this.$refs?.canvas?.height);
      this.boxes.forEach(box => {
        this.updatePosition(box);
        this.drawBox(box);
        if(!this.theUpsideDown){
          this.checkCollisions(box);
        }
      });
      this.mousePosition.v.x = (this.mousePosition.v.x * 0.9);
      this.mousePosition.v.y = (this.mousePosition.v.y * 0.9);
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
    removeBox(box) {
      this.boxes = this.boxes.filter(b => b !== box);
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
      if (!box) return;
      
      this.checkCanvasEdges(box);
      
      // fjern boks hvis den er for liten
      if(box.size < 10) {
        this.removeBox(box);
        return;
      }

      // På desktop: bruk musebevegelse
      if (!this.orientation.beta && !this.orientation.gamma) {
        box.vx += (this.mousePosition.v.x * Math.random() * 0.3) * (Math.random()-0.3);
        box.vy += (this.mousePosition.v.y * Math.random() * 0.3) * (Math.random()-0.3);
      } 
      // På mobil: bruk orientering
      else {
        // Konverter grader til akselerasjon
        const tiltX = this.orientation.gamma / 45; // -1 til 1 ved 45 graders tilt
        const tiltY = this.orientation.beta / 45;
        
        box.vx += tiltX * 0.5;
        box.vy += tiltY * 0.5;
      }

      // Reduser størrelsen ved høy hastighet
      if (Math.abs(box.vx) > 10 || Math.abs(box.vy) > 10) {
        box.size = box.size * 0.998;
        box.vx = box.vx * 0.9;
        box.vy = box.vy * 0.9;
      }

      // Legg til demping
      box.vx *= 0.98;
      box.vy *= 0.98;
      
      // Oppdater posisjon
      box.x += box.vx;
      box.y += box.vy;
    },
    checkCollisions(currentBox) {
      // find collision with the profile-pic at the center of the canvas
      /*const center = { x: this.$refs?.canvas?.width / 2, y: (this.$refs?.canvas?.height / 2) + 20, size: 200, shadow: { strength: 0 }, vx: 20, vy: 20 , profile: true };
      if (this.isColliding(currentBox, center)) {
        this.resolveCollision(currentBox, center);
        console.log('collided with profile-pic');
        return;
      }*/

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
      this.ctx.arc(box.x, box.y, box.size / 2, 0, 2 * Math.PI);
      
      // Konfigurerer skygge
      if(!this.theUpsideDown){
        this.ctx.shadowOffsetX = box.shadow.shadowOffsetX;
        this.ctx.shadowOffsetY = box.shadow.shadowOffsetY;
        this.ctx.shadowBlur = box.shadow.shadowBlur;
        this.ctx.shadowColor = box.shadow.shadowColor;
      }
      this.ctx.fillStyle = box.color;
      this.ctx.fill();
      this.ctx.closePath();
      
      // Nullstill skyggeinnstillinger for å unngå at hele canvaset påvirkes
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
      this.ctx.shadowBlur = 0;
      this.ctx.shadowColor = 'transparent';     
      this.ctx.stroke(); 
      this.ctx.lineWidth = (this.theUpsideDown?5:5);
      this.ctx.strokeStyle = (this.theUpsideDown? 'rgba(100,90,80,0.2)':'rgba(0, 0, 0, 0.9)');
      this.ctx.class = 'box';
    },
    
    isColliding(box1, box2) {
      const dx = box1.x - box2.x;
      const dy = box1.y - box2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < (box1.size/2 + box2.size/2);
    },
    flip(event) {
      document.body.classList.remove('dark-mode');
      this.theUpsideDown = false;
      this.boxes.forEach(box => {
        box.color = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
        box.vx = box.vx * 6;
        box.vy = box.vy * 6;
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

      const size = (Math.random() * 300) + 50;
      const r = (Math.random()> 0.5? 75 + Math.random()*20 : 150 + Math.random()*20);
      const g = (Math.random()> 0.5? 50 + Math.random()*100 : 125 + Math.random()*20);
      const b = (Math.random()> 0.5? 100 + Math.random()*20 : 255);
      
      let shadowLength = 0;
      if(event.layer){
        shadowLength = event.layer === 1 ? 0 : 30;
      } else {
        shadowLength = (r + g + b) > 420 ? 0 : 30;
      }
      
      const color = `rgb(${r}, ${g}, ${b})`;
      const shadowColor = this.darkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(10, 10, 10, 0.5)';
      const shadow = this.getNewShadow(shadowLength, shadowColor);
      const yvelocity = ((Math.random() * 0.8) * (Math.random() < 0.5 ? -1 : 1));
      const xvelocity = ((Math.random() * 0.8) * (Math.random() < 0.5 ? -1 : 1));
      
      this.boxes.push({ x, y, vx: xvelocity, vy: yvelocity,mass: size, size, color, turned: false, shadow });
      this.boxes = this.boxes.sort((a, b) => a.shadow.strength - b.shadow.strength);
    },
    handleDeviceOrientation(event) {
      console.log('Orientation:', event.alpha, event.beta, event.gamma);
      
      this.orientation = {
        alpha: event.alpha || 0,  // Z-akse rotasjon
        beta: event.beta || 0,    // X-akse tilting
        gamma: event.gamma || 0    // Y-akse tilting
      };
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

/* Fjern resten av social-links stilene siden de nå er i SocialLink.vue */
</style>
