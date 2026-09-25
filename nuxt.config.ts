import { defineNuxtConfig } from 'nuxt/config'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Petter Hareim — phareim.no',
      meta: [
        { name: 'description', content: 'Petter Hareim\'s corner of the web: a small neon town with an arcade of home-made games, his writing, and where to find him.' },
        { property: 'og:title', content: 'Petter Hareim — phareim.no' },
        { property: 'og:description', content: 'A small neon town with an arcade of home-made games, his writing, and where to find him.' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://phareim.no/' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'phareim' },
        { name: 'theme-color', content: '#0b0616' }
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
        // Installed as a web app, the site takes the whole screen (fullscreen on Android, standalone on iOS).
        { rel: 'manifest', href: '/manifest.webmanifest' }
      ]
    }
  },

  compatibilityDate: '2024-09-08',

  devtools: { enabled: true },

  // The radio engine vendored in themes/radio/station/ imports with `.ts`
  // extensions (Node runs it with type stripping in phareim/radio); Vite
  // resolves those, and vue-tsc needs leave to read them.
  typescript: {
    tsConfig: { compilerOptions: { allowImportingTsExtensions: true, noEmit: true } },
  },

  nitro: {
    preset: 'cloudflare-pages'
  }
});