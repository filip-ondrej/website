// Check bar height, BOOK A CALL flicker, glass over content.
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const b = await puppeteer.launch({
    executablePath: EDGE, headless: true,
    args: ['--no-first-run', '--hide-scrollbars'],
});
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await p.goto(process.argv[2] || 'http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await p.waitForFunction(() => window.__loaderPerf?.reveal !== undefined, { timeout: 45000 }).catch(() => {});
await new Promise(r => setTimeout(r, 1500));

const h = await p.evaluate(() => document.querySelector('.glass-nav').offsetHeight);
console.log('bar height:', h);

const box = await p.evaluate(() => {
    const r = document.querySelector('.glass-nav__desktop .glass-nav__book').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await p.mouse.move(box.x, box.y);
await new Promise(r => setTimeout(r, 250));
const label = await p.evaluate(() =>
    document.querySelector('.glass-nav__desktop .glass-nav__book .glass-nav-link__label').textContent);
console.log('BOOK label mid-wave:', JSON.stringify(label));
await p.screenshot({ path: 'scripts/shots/nav4-book-wave.png', clip: { x: 0, y: 0, width: 1440, height: 120 } });

await p.evaluate(() => window.scrollTo({ top: 600 }));
await new Promise(r => setTimeout(r, 800));
await p.screenshot({ path: 'scripts/shots/nav4-glass.png', clip: { x: 0, y: 0, width: 1440, height: 120 } });
await b.close().catch(() => {});
process.exit(0);
