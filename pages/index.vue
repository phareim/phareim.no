<template>
  <div class="container">
    <SpaceInvadersBackground
      v-if="isHacker"
      @score="s => hackerScore = s"
      @death="onGameOver"
      @restart="onGameRestart"
    />
    <canvas v-else ref="canvas"></canvas>
    <div class="overlay" @click="onOverlayClick">
      <div class="home">
        <ProfileCard
          :flipped="hackerGameOver"
          @flip="flip"
          @flipStart="flipStart"
          @flipStop="flipStop"
        />
        <template v-if="isHacker && hackerGameOver">
          <h1 class="game-over-title">GAME OVER</h1>
          <p class="hacker-score">SCORE: {{ hackerScore }}</p>
          <p v-if="hackerScore >= hackerHighScore" class="hacker-score new-highscore">NEW HIGH SCORE!</p>
          <p v-else class="hacker-score">HIGH SCORE: {{ hackerHighScore }}</p>
          <p class="game-over-restart">PRESS ANY KEY TO RESTART</p>
        </template>
        <template v-else>
          <h1>petter hareim</h1>
          <p class="blurb">father, husband, geek, aspiring good guy.
          </p>
          <p class="blurb">
            help folks. write code. build things.
          </p>
          <p v-if="!isHacker" class="location">
            54°26'51 S 3°19'15 E
          </p>
          <p v-else class="location hacker-score">
            SCORE: {{ hackerScore }}
          </p>
        </template>
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
            href="https://www.miles.no/kontakt-oss"
            type="miles"
            css-class="miles"
          />
          <SocialLink 
            href="https://innsamling.stafettforlivet.no/fundraisers/teamulrikke"
            type="kreftforeningen"
            css-class="kreftforeningen"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import ProfileCard from '~/components/ProfileCard.vue'
import SocialLink from '~/components/SocialLink.vue'
import SpaceInvadersBackground from '~/components/SpaceInvadersBackground.vue'

export default {
  name: 'Home',
  components: {
    ProfileCard,
    SocialLink,
    SpaceInvadersBackground
  },
  data() {
    return {
      ctx: null,
      boxes: [],
      boxCopy: [],
      darkMode: false,
      theUpsideDown: false,
      mousePosition: { x: 0, y: 0, v: { x: 0, y: 0 } },
      statistics: {
        boxes: 0,
        collisions: 0,
        drawCount: 0,
        animateCount: 0
      },
      animationFrameId: null,
      hackerScore: 0,
      hackerHighScore: 0,
      hackerGameOver: false
    };
  },
  computed: {
    isHacker() {
      return useTheme().activeTheme.value === 'hacker'
    }
  },
  watch: {
    isHacker(isNowHacker, wasHacker) {
      if (isNowHacker) {
        // Switching to hacker: stop bubble animation
        if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
        }
        window.removeEventListener('mousemove', this.updateMousePosition);
        window.removeEventListener('resize', this.setupCanvas);
        window.removeEventListener('touchmove', this.updateTouchPosition);
        this.boxes = [];
      } else {
        // Switching away from hacker: start bubble animation
        this.$nextTick(() => {
          this.setupCanvas();
          window.addEventListener('mousemove', this.updateMousePosition);
          window.addEventListener('resize', this.setupCanvas);
          window.addEventListener('touchmove', this.updateTouchPosition);
          this.animationFrameId = requestAnimationFrame(this.animate);
          this.addBox({clientX: window.innerWidth / 4, clientY: window.innerHeight / 3, layer: 1});
          this.addBox({clientX: (window.innerWidth / 4)*3, clientY: (window.innerHeight / 3)*2, layer: 1});
        });
      }
    }
  },
  mounted() {
    if (!this.isHacker) {
      this.setupCanvas();
      window.addEventListener('mousemove', this.updateMousePosition);
      window.addEventListener('resize', this.setupCanvas);
      window.addEventListener('touchmove', this.updateTouchPosition);
      window.statistics = this.statistics;
      this.animationFrameId = requestAnimationFrame(this.animate);
      this.addBox({clientX: window.innerWidth / 4, clientY: window.innerHeight / 3, layer: 1});
      this.addBox({clientX: (window.innerWidth / 4)*3, clientY: (window.innerHeight / 3)*2, layer: 1});
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.darkMode = true;
    }
    this.hackerHighScore = parseInt(localStorage.getItem('hackerHighScore') || '0', 10);
  },
  beforeDestroy() {
    window.removeEventListener('mousemove', this.updateMousePosition);
    window.removeEventListener('resize', this.setupCanvas);
    window.removeEventListener('touchmove', this.updateTouchPosition);
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
      else if (box.x + box.vx > this.$refs?.canvas?.width - (box.size / 2) && box.y + box.vy > this.$refs?.canvas?.height - (box.size / 2)) {
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

      // Legg til bevegelse basert på mus/touch
      box.vx += (this.mousePosition.v.x * Math.random() * 0.3) * (Math.random()-0.3);
      box.vy += (this.mousePosition.v.y * Math.random() * 0.3) * (Math.random()-0.3);

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
      this.ctx.lineWidth = 5;
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
    onOverlayClick(event) {
      if (!this.isHacker) {
        this.addBox(event);
      }
    },
    onGameOver() {
      this.hackerGameOver = true;
      if (this.hackerScore > this.hackerHighScore) {
        this.hackerHighScore = this.hackerScore;
        localStorage.setItem('hackerHighScore', String(this.hackerHighScore));
      }
    },
    onGameRestart() {
      this.hackerGameOver = false;
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
  },
};
</script>

<style>
body,
html {
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

body {
  background-color: var(--theme-bg, white);
  color: var(--theme-text, #111);
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

.hacker-score {
  font-family: monospace;
  color: #00ff41;
  text-shadow: 0 0 10px #00ff41;
  letter-spacing: 0.15em;
  font-size: 1em;
}

.game-over-title {
  font-family: monospace;
  color: #00ff41;
  text-shadow: 0 0 20px #00ff41, 0 0 40px #00ff41;
  font-size: 3.5em;
  letter-spacing: 0.1em;
  margin-top: 2px;
}
@media(min-width: 800px) {
  .game-over-title {
    margin-top: 0.1em;
  }
}

.new-highscore {
  animation: pulse-glow 0.8s ease-in-out infinite alternate;
}
@keyframes pulse-glow {
  from { text-shadow: 0 0 10px #00ff41; }
  to { text-shadow: 0 0 20px #00ff41, 0 0 40px #ffcc00; }
}

.game-over-restart {
  font-family: monospace;
  color: #00ff41;
  text-shadow: 0 0 8px #00ff41;
  font-size: 0.9em;
  letter-spacing: 0.1em;
  opacity: 0.8;
  margin-top: 1em;
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

</style>
