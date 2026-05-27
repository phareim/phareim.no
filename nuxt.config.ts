import { defineNuxtConfig } from 'nuxt/config'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  css: [
    '~/assets/themes/almanac.css'
  ],

  app: {
    head: {
      htmlAttrs: {
        lang: 'en'
      },
      title: 'phareim.no',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'description', content: 'Petter Hareim — developer, consultant, builder of things. Personal site with projects, thoughts, and more.' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Alan+Sans:wght@300..900&family=Caveat:wght@400..700&display=swap' },
        { rel: 'alternate', type: 'application/rss+xml', title: 'phareim.no — thoughts', href: '/api/rss.xml' }
      ]
    }
  },

  compatibilityDate: '2024-09-08',

  devtools: { enabled: true },

  // Archived/moved routes from the May 2026 rebuild. The public/_redirects
  // file doesn't fire on Cloudflare Pages because _routes.json sends every
  // path to the Nuxt worker; route rules redirect at the worker level instead.
  routeRules: {
    '/clock':            { redirect: { to: '/playground',          statusCode: 301 } },
    '/focus':            { redirect: { to: '/playground',          statusCode: 301 } },
    '/stats':            { redirect: { to: '/projects',            statusCode: 301 } },
    '/activity':         { redirect: { to: '/feed',                statusCode: 301 } },
    '/meta':             { redirect: { to: '/projects',            statusCode: 301 } },
    '/playground/image': { redirect: { to: '/lab/imagine',         statusCode: 301 } },
    '/terminal':         { redirect: { to: '/playground/terminal', statusCode: 301 } },
    '/morse':            { redirect: { to: '/playground/morse',    statusCode: 301 } },
    '/launch':           { redirect: { to: '/playground/launch',   statusCode: 301 } },
  },

  runtimeConfig: {
    // Private keys that are exposed to the server
    // On Cloudflare Pages, these are overridden at runtime by NUXT_-prefixed env vars
    // (e.g. NUXT_VENICE_KEY -> veniceKey)
    veniceKey: '',
    openaiApiKey: '',
    falKey: '',
    wavespeedKey: '',
    githubToken: '',
    twitterBearerToken: '',
    feedApiKey: '',

    // Public keys that are exposed to the client
    public: {}
  }
});