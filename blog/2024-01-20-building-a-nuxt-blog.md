---
title: "Bygge en Nuxt.js-blogg med Markdown"
date: "2024-01-20"
summary: "I dag vil jeg dele hvordan jeg bygget dette bloggsystemet ved hjelp av Nuxt.js og markdown-filer. Det er en enkel, men effektiv tilnærming som gir deg full kontroll over innholdet ditt."
---
I dag vil jeg dele hvordan jeg bygget dette bloggsystemet ved hjelp av Nuxt.js og markdown-filer. Det er en enkel, men effektiv tilnærming som gir deg full kontroll over innholdet ditt.

## Arkitekturen

Bloggsystemet består av flere nøkkelkomponenter:

### 1. Filbasert innhold
Alle blogginnlegg er lagret som markdown-filer i `/blog/`-katalogen. Denne tilnærmingen har flere fordeler:

- **Versjonskontroll** - Innholdet ditt er versjonert sammen med koden din
- **Enkelhet** - Ingen databaseoppsett kreves
- **Portabilitet** - Lett å migrere eller sikkerhetskopiere
- **Ytelse** - Statisk innhold laster raskt

### 2. API-endepunkt
`/api/blog`-endepunktet leser markdown-filene og parser dem til JSON. Det håndterer:

- Parsing av front matter (tittel, dato, osv.)
- Konvertering fra Markdown til HTML ved hjelp av `markdown-it`
- Automatisk generering av sammendrag
- Datobasert sortering

### 3. Vue.js-frontend
Bloggsiden (`/blog`) gir et rent grensesnitt som:

- Lister opp alle blogginnlegg
- Viser individuelle innlegg når de klikkes
- Inkluderer en tilbake-knapp for navigasjon
- Støtter både lys og mørk tema

## Kodeeksempel

Slik parser API-endepunktet markdown-filer:

```typescript
function parseMarkdownFile(filePath: string, slug: string): BlogPost | null {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  // Parse front matter
  if (lines[0]?.trim() === '---') {
    // Hent ut metadata...
  }
  
  // Konverter markdown til HTML
  const htmlContent = md.render(markdownContent)
  
  return { slug, title, date, excerpt, content: htmlContent }
}
```

## Fordeler med denne tilnærmingen

1. **Rask utvikling** - Ingen komplekst CMS-oppsett
2. **Flott SEO** - Server-side rendering med Nuxt.js
3. **Utviklervennlig** - Skriv innlegg i din favorittredigerer
4. **Tilpassbart** - Full kontroll over styling og funksjonalitet

Denne tilnærmingen fungerer utmerket for personlige blogger, dokumentasjonssider, eller ethvert prosjekt hvor du ønsker å holde ting enkelt og vedlikeholdbart.


Hva synes du? Har du bygget lignende systemer før?