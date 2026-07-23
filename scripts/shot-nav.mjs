// Verify the rebuilt nav: gutter alignment, active indicator, section jumps.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const URL = process.argv[2] || 'http://localhost:3000';
const OUT = 'scripts/shots';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
    executablePath: EDGE, headless: true,
    args: ['--no-first-run', '--disable-extensions', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(
    () => window.__loaderPerf && window.__loaderPerf.reveal !== undefined,
    { timeout: 45000 }
).catch(() => {});
await new Promise((r) => setTimeout(r, 2000));

// 1. top of page — nav resting state
await page.screenshot({ path: join(OUT, 'nav-top.png') });

// 2. click JOURNEY, wait for the smooth scroll, check active state + position
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', String(e).slice(0, 200)));
await page.evaluate(() => {
    document.querySelector('.portfolio-nav__desktop a[href="#journey"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
});
await new Promise((r) => setTimeout(r, 2500));
const state = await page.evaluate(() => {
    const active = document.querySelector('.portfolio-nav-link[data-active="true"]');
    const journeyTop = document.getElementById('journey').getBoundingClientRect().top;
    return {
        scrollY: Math.round(window.scrollY),
        activeLabel: active?.textContent?.trim() ?? null,
        journeyTopInViewport: Math.round(journeyTop),
        hash: location.hash,
    };
});
console.log('after JOURNEY click:', JSON.stringify(state));
await page.screenshot({ path: join(OUT, 'nav-journey.png') });

// 3. scroll further to press — spy should follow without clicks
await page.evaluate(() => {
    const el = document.getElementById('press');
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100 });
});
await new Promise((r) => setTimeout(r, 1200));
const spyState = await page.evaluate(() => ({
    activeLabel: document.querySelector('.portfolio-nav-link[data-active="true"]')?.textContent?.trim() ?? null,
}));
console.log('after manual scroll to press:', JSON.stringify(spyState));
await page.screenshot({ path: join(OUT, 'nav-press.png') });

// 4. scaled window
await page.setViewport({ width: 1100, height: 650, deviceScaleFactor: 1 });
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: join(OUT, 'nav-1100x650.png') });

await browser.close();
console.log('done');
