<template>
  <div class="about-page">
    <div class="about-inner">

      <div class="about-photo-row">
        <img
          class="about-photo"
          src="/petter1.png"
          alt="Petter Hareim"
          width="130"
          height="130"
          draggable="false"
        />
      </div>

      <h1 class="about-name">petter hareim</h1>

      <p class="about-tagline">father. husband. geek. aspiring good guy.</p>

      <div class="about-divider" aria-hidden="true"></div>

      <div class="about-bio">
        <p>i help folks. i write code. i build things.</p>
        <p>
          currently working as a consultant at
          <a
            href="https://www.miles.no"
            target="_blank"
            rel="noopener noreferrer"
            class="about-link"
          >Miles</a>.
        </p>
      </div>

      <div class="about-social">
        <a
          v-for="link in socialLinks"
          :key="link.label"
          :href="link.href"
          :aria-label="link.label"
          target="_blank"
          rel="noopener noreferrer"
          class="about-social-link"
        >{{ link.label }}</a>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'about — phareim.no' })

const socialLinks = [
  { label: 'GitHub', href: 'https://github.com/phareim' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/phareim' },
  { label: 'Bluesky', href: 'https://bsky.app/profile/phareim.no' },
  { label: 'X', href: 'https://x.com/phareim' },
  { label: 'Threads', href: 'https://www.threads.com/@phareim' },
]
</script>

<style scoped>
.about-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 3.5rem 1.5rem 5rem;
  box-sizing: border-box;
}

.about-inner {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.about-photo-row {
  margin-bottom: 1.75rem;
}

.about-photo {
  width: 130px;
  height: 130px;
  border-radius: 50%;
  border: 3px solid var(--theme-card-border, rgba(0,0,0,0.12));
  object-fit: cover;
  user-select: none;
  -webkit-user-select: none;
  display: block;
  box-shadow: 0 4px 20px var(--theme-card-shadow, rgba(0,0,0,0.08));
  transition: box-shadow 0.3s ease, transform 0.3s ease;
  animation: photo-enter 0.5s ease both;
}

@keyframes photo-enter {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.about-photo:hover {
  transform: scale(1.04);
  box-shadow: 0 6px 28px var(--theme-card-shadow, rgba(0,0,0,0.14));
}

.about-name {
  font-size: clamp(1.8rem, 5vw, 2.8rem);
  font-weight: 500;
  margin: 0 0 0.6rem;
  color: var(--theme-text, #111);
  line-height: 1;
}

.about-tagline {
  font-size: 0.95rem;
  color: var(--theme-text-muted, #666);
  margin: 0 0 0.5rem;
  line-height: 1.5;
}

.about-divider {
  width: 40px;
  height: 1px;
  background: var(--theme-card-border, rgba(0,0,0,0.15));
  margin: 1.5rem auto;
}

.about-bio {
  max-width: 340px;
}

.about-bio p {
  font-size: 1rem;
  color: var(--theme-text-muted, #666);
  line-height: 1.7;
  margin: 0 0 0.75rem;
}

.about-bio p:last-child {
  margin-bottom: 0;
}

.about-link {
  color: var(--theme-accent, #6b8cae);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease;
}

.about-link:hover {
  border-color: var(--theme-accent, #6b8cae);
}

.about-social {
  display: flex;
  gap: 1.5rem;
  margin-top: 2.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.about-social-link {
  font-size: 0.85rem;
  color: var(--theme-text-muted, #666);
  text-decoration: none;
  text-transform: lowercase;
  letter-spacing: 0.03em;
  border-bottom: 1px solid transparent;
  padding-bottom: 1px;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.about-social-link:hover {
  color: var(--theme-text, #111);
  border-color: currentColor;
}

.about-social-link:focus-visible {
  outline: 2px solid var(--theme-accent, #6b8cae);
  outline-offset: 3px;
  border-radius: 2px;
}

/* ── Hacker theme overrides ─────────────────────────────────── */

:global(.hacker-page) .about-name {
  font-family: monospace;
  text-transform: lowercase;
  text-shadow: 0 0 10px currentColor;
}

:global(.hacker-page) .about-tagline {
  font-family: monospace;
}

:global(.hacker-page) .about-bio p {
  font-family: monospace;
}

:global(.hacker-page) .about-link {
  font-family: monospace;
}

:global(.hacker-page) .about-social-link {
  font-family: monospace;
}

:global(.hacker-page) .about-photo {
  border-radius: 0;
  box-shadow: 0 0 18px var(--theme-card-shadow, rgba(0, 255, 65, 0.2));
}

:global(.hacker-page) .about-photo:hover {
  box-shadow: 0 0 28px var(--theme-card-shadow, rgba(0, 255, 65, 0.35));
}

:global(.hacker-page) .about-divider {
  box-shadow: 0 0 6px currentColor;
}

/* ── Space theme overrides ─────────────────────────────────── */

:global(.space-page) .about-name {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  text-shadow: 0 0 40px rgba(140, 170, 220, 0.3);
}

:global(.space-page) .about-tagline {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  letter-spacing: 0.02em;
}

:global(.space-page) .about-bio p {
  font-family: var(--font-space-body, 'Arial Black', Impact, sans-serif);
}

:global(.space-page) .about-photo {
  box-shadow:
    0 4px 20px rgba(140, 170, 220, 0.15),
    0 0 0 1px rgba(140, 170, 220, 0.2);
  border-color: rgba(140, 170, 220, 0.3);
}

:global(.space-page) .about-photo:hover {
  box-shadow:
    0 8px 32px rgba(140, 170, 220, 0.25),
    0 0 0 1px rgba(140, 170, 220, 0.4);
}

:global(.space-page) .about-divider {
  background: linear-gradient(90deg, transparent, rgba(140, 170, 220, 0.5), transparent);
}

:global(.space-page) .about-social-link {
  font-family: var(--font-space-display, 'Arial Black', Impact, sans-serif);
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
</style>
