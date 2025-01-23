// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  head: {
    meta: [
      { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
      ],
  },

  compatibilityDate: '2024-09-08',

  devtools: { enabled: true },

  runtimeConfig: {
    veniceKey: process.env.VENICE_KEY
  }
});