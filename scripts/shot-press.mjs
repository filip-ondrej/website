// Verify press lightbox: X scaling at a scaled window + scroll survives close.
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
await page.setViewport({ width: 1100, height: 650, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(
    () => window.__loaderPerf && window.__loaderPerf.reveal !== undefined,
    { timeout: 45000 }
).catch(() => {});
await new Promise((r) => setTimeout(r, 2000));

// scroll to the press section and open the main (clickable) video card
await page.evaluate(() => {
    const card = document.querySelector('.videoCard.clickable');
    card?.scrollIntoView({ block: 'center' });
});
await new Promise((r) => setTimeout(r, 2500)); // settle observers / lazy players
const before = await page.evaluate(() => {
    document.querySelector('.videoCard.clickable')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return { scrollY: Math.round(window.scrollY) };
});
const modal = await page.waitForSelector('.fullscreenModal', { timeout: 10000 }).catch(() => null);
if (!modal) {
    console.log('lightbox did not open');
    await browser.close();
    process.exit(1);
}
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: join(OUT, 'press-open-1100x650.png') });

// close and verify scroll + progressline
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 800));
const after = await page.evaluate(() => ({
    scrollY: Math.round(window.scrollY),
    modalGone: !document.querySelector('.fullscreenModal'),
    bodyOverflow: getComputedStyle(document.body).overflow,
    bodyPosition: getComputedStyle(document.body).position,
    lineSvgVisible: (() => {
        const svg = document.querySelector('svg[data-progressline], .progress-line svg, svg');
        return !!svg;
    })(),
}));
console.log('before open scrollY:', before.scrollY);
console.log('after close:', JSON.stringify(after));

// wheel down once — must NOT jump to top
await page.mouse.move(550, 325);
await page.mouse.wheel({ deltaY: 300 });
await new Promise((r) => setTimeout(r, 1000));
const afterWheel = await page.evaluate(() => Math.round(window.scrollY));
console.log('after one wheel-down scrollY:', afterWheel, afterWheel > before.scrollY - 50 ? 'OK (no jump to top)' : 'JUMPED');
await page.screenshot({ path: join(OUT, 'press-after-close-1100x650.png') });

await browser.close();
console.log('done');
