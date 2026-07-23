// Evaluation states: resting bar, active-section gold index, over-content glass.
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const b = await puppeteer.launch({
    executablePath: EDGE, headless: true,
    args: ['--no-first-run', '--hide-scrollbars'],
});
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:3001', { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForFunction(() => window.__loaderPerf?.reveal !== undefined, { timeout: 45000 }).catch(() => {});
await new Promise(r => setTimeout(r, 1500));

// Scroll into JOURNEY so scroll-spy locks an active link; viewport-true shot.
await p.evaluate(() => {
    const el = document.getElementById('journey');
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 200 });
});
await new Promise(r => setTimeout(r, 1200));
await p.screenshot({ path: 'scripts/shots/eval-active.png', captureBeyondViewport: false });

await b.close().catch(() => {});
process.exit(0);
