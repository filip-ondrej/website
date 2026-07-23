// Verify modal scaling: collab + project modals at several window sizes.
// Usage: node scripts/shot-scaling.mjs [url]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const URL = process.argv[2] || 'http://localhost:3000';
const OUT = 'scripts/shots';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
mkdirSync(OUT, { recursive: true });

const SIZES = [
    [1440, 900],
    [1200, 650],
    [900, 600],
    [700, 850],
];

const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-first-run', '--disable-extensions', '--hide-scrollbars'],
});

for (const [w, h] of SIZES) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(
        () => window.__loaderPerf && window.__loaderPerf.reveal !== undefined,
        { timeout: 30000 }
    ).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));

    // collab modal — hero
    await page.evaluate(() => {
        document.querySelector('[aria-label="Open Boyser collaboration story"]')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForSelector('.collab-modal-container', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: join(OUT, `scale-collab-${w}x${h}.png`) });
    // collab modal — summary (section bg check)
    await page.evaluate(() => {
        const c = document.querySelector('.collab-modal-container');
        c.style.scrollBehavior = 'auto';
        c.scrollTop = c.querySelector('#collab-summary').offsetTop - 60;
    });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: join(OUT, `scale-collab-sum-${w}x${h}.png`) });
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 500));

    // project modal — hero
    await page.evaluate(() => {
        document.querySelector('.image-clickable-area')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForSelector('.project-modal-container', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: join(OUT, `scale-project-${w}x${h}.png`) });
    await page.keyboard.press('Escape');

    console.log(`done ${w}x${h}`);
    await page.close();
}

await browser.close();
console.log('all done');
