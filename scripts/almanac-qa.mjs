#!/usr/bin/env node
import { chromium } from 'playwright-core';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.QA_BASE ?? 'http://localhost:3030';
const OUT = '.qa/almanac';
const CHROME = process.env.PLAYWRIGHT_EXECUTABLE
  ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`;

const ROUTES = [
  ['clock','/clock'], ['morse','/morse'], ['playground','/playground'],
  ['stats','/stats'], ['terminal','/terminal'],
  ['index','/'],
  ['about','/about'], ['activity','/activity'], ['colophon','/colophon'],
  ['feed','/feed'], ['focus','/focus'], ['gallery','/gallery'],
  ['guestbook','/guestbook'], ['lab','/lab'], ['meta','/meta'],
  ['now','/now'], ['projects','/projects'], ['uses','/uses'],
  ['error','/this-does-not-exist'],
];
const MODES = ['light','dark'];
const TOKENS = [
  '--theme-bg','--theme-bg-alt','--theme-text','--theme-text-muted',
  '--theme-text-subtle','--theme-card-border','--theme-accent','--theme-link-color',
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
const index = [];
const status = {};

for (const mode of MODES) {
  const ctx = await browser.newContext({
    colorScheme: mode,
    viewport: { width: 1280, height: 900 },
  });
  for (const [slug, path] of ROUTES) {
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.evaluate(() => localStorage.setItem('theme','almanac'));
      await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      const overlay = await page.$('.nuxt-error, nuxt-error');
      if (overlay) console.warn(`WARN dev error overlay present at ${slug}/${mode}`);
      const png = join(OUT, `${slug}-${mode}.png`);
      await page.screenshot({ path: png, fullPage: true });
      const vars = await page.evaluate((tokens) => {
        const root = document.querySelector('.almanac-page') ?? document.documentElement;
        const s = getComputedStyle(root);
        return Object.fromEntries(tokens.map(t => [t, s.getPropertyValue(t).trim()]));
      }, TOKENS);
      const varsFile = join(OUT, `${slug}-${mode}.vars.json`);
      await writeFile(varsFile, JSON.stringify(vars, null, 2));
      index.push({ slug, mode, path, png, vars: varsFile });
      status[`${slug}-${mode}`] = { status: 'pending', notes: '' };
      console.log(`OK ${slug} ${mode}`);
    } catch (err) {
      console.error(`FAIL ${slug} ${mode}: ${err.message}`);
      status[`${slug}-${mode}`] = { status: 'pending', notes: `capture failed: ${err.message}` };
    } finally {
      await page.close();
    }
  }
  await ctx.close();
}
await browser.close();
await writeFile(join(OUT,'index.json'), JSON.stringify(index, null, 2));
await writeFile(join(OUT,'status.json'), JSON.stringify(status, null, 2));
console.log(`\nDone. ${index.length} cells captured to ${OUT}/`);
