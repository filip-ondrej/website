// Screenshot the section-7 CircuitBoard at a few reveal states. Read-only.
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
await new Promise((r) => setTimeout(r, 2500));

// Find the circuit section's document-space top/height.
const box = await page.evaluate(() => {
    const el = document.querySelector('.cb-section');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, height: r.height, vh: window.innerHeight };
});
if (!box) { console.log('NO .cb-section found'); await browser.close(); process.exit(1); }
console.log('cb-section:', JSON.stringify(box));

async function shotAt(frac, name) {
    // Position so the section is centered-ish; drive the tip through it.
    const target = box.top - box.vh * (1 - frac) + box.height * frac;
    await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, target));
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: join(OUT, name) });
    const lit = await page.evaluate(() => {
        const f = document.querySelector('feFuncR');
        return f ? f.getAttribute('intercept') : 'n/a';
    });
    console.log(name, 'intercept=', lit);
}

// Center the section in the viewport for a clean full-board shot.
await page.evaluate((b) => window.scrollTo(0, b.top - (b.vh - b.height) / 2), box);
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: join(OUT, 'circuit-centered.png') });

await shotAt(0.35, 'circuit-mid.png');
await shotAt(0.95, 'circuit-lit.png');

await browser.close();
console.log('done');
