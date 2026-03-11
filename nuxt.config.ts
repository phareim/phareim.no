import { defineNuxtConfig } from 'nuxt/config'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  css: [
    '~/assets/themes/scandinavian.css',
    '~/assets/themes/hacker.css',
    '~/assets/themes/tolkien.css'
  ],

  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Alan+Sans:wght@300..900&family=Caveat:wght@400..700&family=Cinzel+Decorative:wght@400;700&display=swap' }
      ]
    }
  },

  compatibilityDate: '2024-09-08',

  devtools: { enabled: true },

  runtimeConfig: {
    // Private keys that are exposed to the server
    veniceKey: process.env.VENICE_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    falKey: process.env.FAL_KEY,
    wavespeedKey: process.env.WAVESPEED_KEY,
    adminPassword: process.env.ADMIN_PASSWORD,

    // Public keys that are exposed to the client
    public: {}
  }
});