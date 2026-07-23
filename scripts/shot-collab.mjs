// Verify the rebuilt CollaborationModal: shoot hero, summary, stakes, story, end.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const URL = process.argv[2] || 'http://localhost:3000';
const OUT = 'scripts/shots';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-first-run', '--disable-extensions', '--hide-scrollbars'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(
    () => window.__loaderPerf && window.__loaderPerf.reveal !== undefined,
    { timeout: 30000 }
).catch(() => {});
await new Promise((r) => setTimeout(r, 1500));

await page.evaluate(() => {
    document.querySelector('[aria-label="Open Boyser collaboration story"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForSelector('.collab-modal-container', { timeout: 10000 });
await new Promise((r) => setTimeout(r, 1800));

const targets = [
    ['fix-hero', () => 0],
    ['fix-summary', (c) => c.querySelector('#collab-summary').offsetTop - 70],
    ['fix-stakes', (c) => c.querySelector('#collab-stakes').offsetTop - 70],
    ['fix-story-1', (c) => c.querySelector('#collab-details').offsetTop - 70],
    ['fix-story-2', (c) => c.querySelector('#collab-details').offsetTop + 700],
    ['fix-story-3', (c) => c.querySelector('#collab-details').offsetTop + 1500],
    ['fix-end', (c) => c.scrollHeight],
];

for (const [name, getTop] of targets) {
    // force the position right before the shot (guards against any snap-back)
    await page.evaluate((fnStr) => {
        const c = document.querySelector('.collab-modal-container');
        c.style.scrollBehavior = 'auto';
        // eslint-disable-next-line no-eval
        c.scrollTop = eval(`(${fnStr})`)(c);
    }, getTop.toString());
    await new Promise((r) => setTimeout(r, 1000));
    await page.evaluate((fnStr) => {
        const c = document.querySelector('.collab-modal-container');
        // eslint-disable-next-line no-eval
        c.scrollTop = eval(`(${fnStr})`)(c);
    }, getTop.toString());
    await new Promise((r) => setTimeout(r, 250));
    await page.screenshot({ path: join(OUT, `${name}.png`) });
    console.log('saved', name);
}

await browser.close();
console.log('done');
