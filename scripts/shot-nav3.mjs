// Verify glass-nav fixes: no glyph overlap, PROJECTS label, spread layout.
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

// resting bar — check slot overlap numerically: no slot rect may intrude into the next
const overlap = await page.evaluate(() => {
    const results = [];
    for (const link of document.querySelectorAll('.glass-nav__desktop .glass-nav-link')) {
        const slots = [...link.querySelectorAll('.glass-nav-link__slot')];
        let worst = 0;
        for (let i = 0; i < slots.length - 1; i++) {
            const a = slots[i].getBoundingClientRect();
            const b = slots[i + 1].getBoundingClientRect();
            worst = Math.max(worst, a.right - b.left);
        }
        results.push({ label: link.getAttribute('aria-label'), worstOverlapPx: +worst.toFixed(2) });
    }
    return results;
});
console.log('slot overlaps (resting):', JSON.stringify(overlap));
await page.screenshot({ path: join(OUT, 'nav3-top.png'), clip: { x: 0, y: 0, width: 1440, height: 120 } });

// hover PROJECTS mid-wave — glyph boxes must still not overlap
const box = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.glass-nav__desktop .glass-nav-link')]
        .find((a) => a.getAttribute('aria-label') === 'PROJECTS');
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.move(box.x, box.y);
await new Promise((r) => setTimeout(r, 120));
const midState = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.glass-nav__desktop .glass-nav-link')]
        .find((a) => a.getAttribute('aria-label') === 'PROJECTS');
    return el.querySelector('.glass-nav-link__label').textContent;
});
console.log('PROJECTS label mid-wave:', JSON.stringify(midState));
await page.screenshot({ path: join(OUT, 'nav3-wave.png'), clip: { x: 0, y: 0, width: 1440, height: 120 } });
await new Promise((r) => setTimeout(r, 600));

// click CONTACT — anchor must exist and scroll
await page.evaluate(() => {
    const el = [...document.querySelectorAll('.glass-nav__desktop .glass-nav-link')]
        .find((a) => a.getAttribute('aria-label') === 'CONTACT');
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
});
await new Promise((r) => setTimeout(r, 2500));
const contact = await page.evaluate(() => ({
    scrollY: Math.round(window.scrollY),
    hash: location.hash,
}));
console.log('after CONTACT click:', JSON.stringify(contact));

await browser.close();
console.log('done');
