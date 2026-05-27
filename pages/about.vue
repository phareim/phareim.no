<template>
  <AlmanacFrame title="About" kicker="Who and what." back="/">
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

      <p class="about-name">petter hareim</p>

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
          v-for="(link, i) in socialLinks"
          :key="link.label"
          :href="link.href"
          :aria-label="`${link.label} profile (opens in new tab)`"
          :data-platform="link.platform"
          :style="{ '--i': i }"
          target="_blank"
          rel="noopener noreferrer"
          class="about-social-link"
        >{{ link.label }}</a>
      </div>

    </div>
  </AlmanacFrame>
</template>

<script setup lang="ts">
useHead({ title: 'about — phareim.no' })

const socialLinks = [
  { label: 'GitHub',   href: 'https://github.com/phareim',                  platform: 'github'   },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/phareim',          platform: 'linkedin' },
  { label: 'Bluesky',  href: 'https://bsky.app/profile/phareim.no',          platform: 'bluesky'  },
  { label: 'X',        href: 'https://x.com/phareim',                        platform: 'x'        },
  { label: 'Threads',  href: 'https://www.threads.com/@phareim',             platform: 'threads'  },
]
</script>

<style scoped>
.about-inner {
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
  border: 1px solid var(--theme-card-border, rgba(0,0,0,0.12));
  object-fit: cover;
  user-select: none;
  -webkit-user-select: none;
  display: block;
  transition: transform 0.3s ease;
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
}

.about-name {
  font-size: clamp(1.25rem, 3vw, 1.5rem);
  font-style: italic;
  margin: 0 0 0.4rem;
  color: var(--theme-text, #1a1a1a);
  line-height: 1.2;
  animation: content-enter 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.15s both;
}

.about-tagline {
  font-size: 0.95rem;
  color: var(--theme-text-muted, #6a6a6a);
  margin: 0 0 0.5rem;
  line-height: 1.5;
  animation: content-enter 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.25s both;
}

.about-divider {
  width: 40px;
  height: 1px;
  background: var(--theme-card-border, rgba(0,0,0,0.15));
  margin: 1.5rem auto;
  animation: content-enter 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.35s both;
}

.about-bio {
  max-width: 340px;
  animation: content-enter 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.4s both;
}

.about-bio p {
  font-size: 1rem;
  color: var(--theme-text, #1a1a1a);
  line-height: 1.7;
  margin: 0 0 0.75rem;
}

.about-bio p:last-child {
  margin-bottom: 0;
}

@keyframes content-enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.about-link {
  color: var(--theme-accent, #c14a2a);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease;
}

.about-link:hover {
  border-color: var(--theme-accent, #c14a2a);
}

.about-link:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 2px;
  border-radius: 2px;
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
  color: var(--theme-text-muted, #6a6a6a);
  text-decoration: none;
  text-transform: lowercase;
  letter-spacing: 0.03em;
  border-bottom: 1px solid transparent;
  padding: 0 4px 1px;
  margin-inline: -4px;
  transition: color 0.2s ease, border-color 0.2s ease;
  opacity: 0;
  animation: link-enter 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  animation-delay: calc(0.5s + var(--i, 0) * 65ms);
}

@keyframes link-enter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.about-social-link:hover {
  color: var(--theme-accent, #c14a2a);
  border-color: currentColor;
}

.about-social-link:focus-visible {
  outline: 2px solid var(--theme-accent, #c14a2a);
  outline-offset: 3px;
  border-radius: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .about-photo,
  .about-name,
  .about-tagline,
  .about-divider,
  .about-bio,
  .about-social-link {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
