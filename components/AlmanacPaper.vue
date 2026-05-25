<template>
  <div class="almanac-paper" aria-hidden="true">
    <!-- Warm paper texture overlays -->
    <div class="almanac-vignette"></div>
    <div class="almanac-ambient"></div>

    <!-- 20 hand-placed stars — visible in dark mode only, twinkling via CSS -->
    <span class="almanac-star s1"></span>
    <span class="almanac-star s2"></span>
    <span class="almanac-star s3"></span>
    <span class="almanac-star s4"></span>
    <span class="almanac-star s5"></span>
    <span class="almanac-star s6"></span>
    <span class="almanac-star s7"></span>
    <span class="almanac-star s8"></span>
    <span class="almanac-star s9"></span>
    <span class="almanac-star s10"></span>
    <span class="almanac-star s11"></span>
    <span class="almanac-star s12"></span>
    <span class="almanac-star s13"></span>
    <span class="almanac-star s14"></span>
    <span class="almanac-star s15"></span>
    <span class="almanac-star s16"></span>
    <span class="almanac-star s17"></span>
    <span class="almanac-star s18"></span>
    <span class="almanac-star s19"></span>
    <span class="almanac-star s20"></span>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
/* ── Base container ──────────────────────────────────────────── */

.almanac-paper {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

/* ── Light-mode paper warmth ─────────────────────────────────── */
/* A barely-visible warm vignette that gives the blank page depth */

.almanac-vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 50% 0%,   rgba(210, 180, 110, 0.06) 0%, transparent 55%),
    radial-gradient(ellipse at 15% 60%,  rgba(190, 155,  90, 0.04) 0%, transparent 40%),
    radial-gradient(ellipse at 85% 80%,  rgba(200, 165, 100, 0.04) 0%, transparent 40%),
    radial-gradient(ellipse at 50% 100%, rgba(180, 145,  80, 0.05) 0%, transparent 50%);
}

/* ── Dark-mode ambient glow ──────────────────────────────────── */
/* Mimics moonlight pooling on midnight paper. Invisible in light mode. */

.almanac-ambient {
  position: absolute;
  inset: 0;
  opacity: 0;
  background:
    radial-gradient(ellipse at 28% 18%, rgba(212, 165, 116, 0.07) 0%, transparent 50%),
    radial-gradient(ellipse at 72% 75%, rgba(180, 135,  85, 0.05) 0%, transparent 45%),
    radial-gradient(ellipse at 55% 45%, rgba(235, 200, 150, 0.03) 0%, transparent 60%);
  animation: almanac-drift 28s ease-in-out infinite alternate;
}

@keyframes almanac-drift {
  from { transform: translate(0, 0) scale(1); }
  to   { transform: translate(8px, -6px) scale(1.02); }
}

/* ── Stars — hidden in light mode, shown in dark ────────────── */

.almanac-star {
  display: none;
  position: absolute;
  border-radius: 50%;
}

/* ── Twinkling keyframe ──────────────────────────────────────── */

@keyframes almanac-twinkle {
  0%, 100% { opacity: 1;    transform: scale(1); }
  45%       { opacity: 0.15; transform: scale(0.75); }
  50%       { opacity: 0.25; transform: scale(0.8); }
  55%       { opacity: 0.15; transform: scale(0.75); }
}

/* ── Dark-mode rules ─────────────────────────────────────────── */

@media (prefers-color-scheme: dark) {
  .almanac-ambient {
    opacity: 1;
  }

  .almanac-star {
    display: block;
    animation: almanac-twinkle 5s ease-in-out infinite;
  }

  /* amber-warm stars */
  .s1  { width: 2px;   height: 2px;   top:  7%; left: 12%; background: rgba(212, 165, 116, 0.65); animation-duration: 5.2s; animation-delay:  0.0s; }
  .s2  { width: 1.5px; height: 1.5px; top: 11%; left: 83%; background: rgba(235, 210, 170, 0.80); animation-duration: 4.6s; animation-delay:  1.8s; }
  .s3  { width: 1px;   height: 1px;   top: 19%; left: 34%; background: rgba(212, 165, 116, 0.50); animation-duration: 6.1s; animation-delay:  3.2s; }
  .s4  { width: 2px;   height: 2px;   top: 23%; left: 67%; background: rgba(225, 195, 145, 0.70); animation-duration: 5.7s; animation-delay:  0.7s; }
  .s5  { width: 2.5px; height: 2.5px; top: 31%; left:  8%; background: rgba(235, 215, 165, 0.85); animation-duration: 4.9s; animation-delay:  2.4s; }
  .s6  { width: 1px;   height: 1px;   top: 28%; left: 91%; background: rgba(200, 155,  95, 0.55); animation-duration: 6.8s; animation-delay:  1.1s; }
  .s7  { width: 1.5px; height: 1.5px; top: 44%; left: 22%; background: rgba(212, 165, 116, 0.60); animation-duration: 5.4s; animation-delay:  4.0s; }
  .s8  { width: 2px;   height: 2px;   top: 38%; left: 55%; background: rgba(240, 220, 175, 0.75); animation-duration: 4.3s; animation-delay:  0.4s; }
  .s9  { width: 1px;   height: 1px;   top: 51%; left: 78%; background: rgba(185, 140,  85, 0.50); animation-duration: 7.2s; animation-delay:  2.9s; }
  .s10 { width: 2px;   height: 2px;   top: 47%; left:  5%; background: rgba(225, 190, 130, 0.65); animation-duration: 5.1s; animation-delay:  1.5s; }
  /* slightly cooler (white-paper) stars for variety */
  .s11 { width: 1.5px; height: 1.5px; top: 63%; left: 40%; background: rgba(245, 235, 215, 0.70); animation-duration: 4.8s; animation-delay:  3.6s; }
  .s12 { width: 1px;   height: 1px;   top: 58%; left: 88%; background: rgba(220, 205, 175, 0.50); animation-duration: 6.4s; animation-delay:  0.9s; }
  .s13 { width: 2px;   height: 2px;   top: 70%; left: 15%; background: rgba(235, 215, 175, 0.75); animation-duration: 5.6s; animation-delay:  2.1s; }
  .s14 { width: 1.5px; height: 1.5px; top: 72%; left: 62%; background: rgba(212, 165, 116, 0.60); animation-duration: 4.5s; animation-delay:  4.5s; }
  .s15 { width: 1px;   height: 1px;   top: 81%; left: 30%; background: rgba(200, 175, 130, 0.55); animation-duration: 6.0s; animation-delay:  1.3s; }
  .s16 { width: 2px;   height: 2px;   top: 77%; left: 95%; background: rgba(240, 220, 175, 0.65); animation-duration: 5.3s; animation-delay:  3.0s; }
  .s17 { width: 1.5px; height: 1.5px; top: 88%; left: 48%; background: rgba(212, 165, 116, 0.55); animation-duration: 4.7s; animation-delay:  0.6s; }
  .s18 { width: 1px;   height: 1px;   top: 85%; left: 72%; background: rgba(235, 210, 170, 0.70); animation-duration: 6.6s; animation-delay:  2.7s; }
  .s19 { width: 2px;   height: 2px;   top: 94%; left:  8%; background: rgba(225, 185, 120, 0.60); animation-duration: 5.0s; animation-delay:  1.9s; }
  .s20 { width: 1.5px; height: 1.5px; top: 92%; left: 85%; background: rgba(212, 165, 116, 0.65); animation-duration: 4.4s; animation-delay:  3.8s; }
}

/* ── Accessibility ───────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .almanac-ambient {
    animation: none;
  }

  .almanac-star {
    animation: none !important;
    opacity: 0.6;
  }
}
</style>
