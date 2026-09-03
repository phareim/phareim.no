import { defineNuxtConfig } from 'nuxt/config'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }
      ]
    }
  },

  compatibilityDate: '2024-09-08',

  devtools: { enabled: true },

  nitro: {
    preset: 'cloudflare-pages'
  },

  runtimeConfig: {
    // Private keys, server only. On Cloudflare Pages they are set at runtime
    // by NUXT_-prefixed env vars (NUXT_GITHUB_TOKEN -> githubToken).
    // Server code must call useRuntimeConfig(event) — without the event,
    // Workers return a config frozen before env vars exist.
    // Optional: raises GitHub API rate limits for /api/projects and /api/meta
    githubToken: '',

    // Public keys that are exposed to the client
    public: {}
  }
});