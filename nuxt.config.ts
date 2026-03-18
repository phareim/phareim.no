import { defineNuxtConfig } from 'nuxt/config'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  css: [
    '~/assets/themes/scandinavian.css',
    '~/assets/themes/hacker.css',
    '~/assets/themes/space.css'
  ],

  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Alan+Sans:wght@300..900&family=Caveat:wght@400..700&display=swap' }
      ]
    }
  },

  compatibilityDate: '2024-09-08',

  devtools: { enabled: true },

  runtimeConfig: {
    // Private keys that are exposed to the server
    // On Cloudflare Pages, these are overridden at runtime by NUXT_-prefixed env vars
    // (e.g. NUXT_VENICE_KEY -> veniceKey)
    veniceKey: '',
    openaiApiKey: '',
    falKey: '',
    wavespeedKey: '',

    // Public keys that are exposed to the client
    public: {}
  }
});