// Mobile dropdown at a scaled-down window: open over content, readability check.
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const b = await puppeteer.launch({
    executablePath: EDGE, headless: true,
    args: ['--no-first-run', '--hide-scrollbars'],
});
const p = await b.newPage();
await p.setViewport({ width: 900, height: 700 });
await p.goto('http://localhost:3001', { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForFunction(() => window.__loaderPerf?.reveal !== undefined, { timeout: 60000 }).catch(() => {});
await new Promise(r => setTimeout(r, 1800));

// Scroll into busy content first — the panel must read over it.
await p.evaluate(() => {
    const el = document.getElementById('journey');
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 300 });
});
await new Promise(r => setTimeout(r, 1000));

await p.click('.glass-nav__toggle');
await new Promise(r => setTimeout(r, 700));
await p.screenshot({ path: 'scripts/shots/mobile-open.png', captureBeyondViewport: false });

const m = await p.evaluate(() => {
    const panel = document.querySelector('.glass-nav__mobile');
    const r = panel.getBoundingClientRect();
    const bg = getComputedStyle(panel).backgroundColor;
    const link = document.querySelector('.glass-nav__mobile-links .glass-nav-link');
    return { panel: { top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width) }, bg, linkFontPx: getComputedStyle(link).fontSize };
});
console.log(JSON.stringify(m));

await b.close().catch(() => {});
process.exit(0);
