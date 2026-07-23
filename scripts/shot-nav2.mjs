// Verify tape-style nav: slashes, slim bar, wave flicker frames.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const URL = process.argv[2] || 'http://localhost:3005';
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

// resting bar
const barH = await page.evaluate(() => document.querySelector('.portfolio-nav').offsetHeight);
console.log('bar height:', barH);
await page.screenshot({ path: join(OUT, 'nav2-top.png'), clip: { x: 0, y: 0, width: 1440, height: 120 } });

// hover COLLABORATE — catch the wave twice
const box = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.portfolio-nav__desktop .portfolio-nav-link')]
        .find((a) => a.getAttribute('aria-label') === 'COLLABORATE');
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.move(box.x, box.y);
await new Promise((r) => setTimeout(r, 180));
await page.screenshot({ path: join(OUT, 'nav2-wave-in.png'), clip: { x: 0, y: 0, width: 1440, height: 120 } });
const midWave = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.portfolio-nav__desktop .portfolio-nav-link')]
        .find((a) => a.getAttribute('aria-label') === 'COLLABORATE');
    return el.querySelector('.portfolio-nav-link__label').textContent;
});
console.log('label at ~180ms:', JSON.stringify(midWave));
await new Promise((r) => setTimeout(r, 420));
const settleWave = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.portfolio-nav__desktop .portfolio-nav-link')]
        .find((a) => a.getAttribute('aria-label') === 'COLLABORATE');
    return el.querySelector('.portfolio-nav-link__label').textContent;
});
console.log('label at ~600ms:', JSON.stringify(settleWave));
await page.screenshot({ path: join(OUT, 'nav2-wave-out.png'), clip: { x: 0, y: 0, width: 1440, height: 120 } });
await new Promise((r) => setTimeout(r, 500));
const done = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.portfolio-nav__desktop .portfolio-nav-link')]
        .find((a) => a.getAttribute('aria-label') === 'COLLABORATE');
    return el.querySelector('.portfolio-nav-link__label').textContent;
});
console.log('label settled:', JSON.stringify(done));

await browser.close();
console.log('done');
