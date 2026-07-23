// Viewport-true screenshot of the nav over content (captureBeyondViewport off).
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
await new Promise(r => setTimeout(r, 1800));
await p.evaluate(() => window.scrollTo({ top: 2200 }));
await new Promise(r => setTimeout(r, 1500));

await p.screenshot({
    path: 'scripts/shots/nav9-glass.png',
    captureBeyondViewport: false,
});
await b.close().catch(() => {});
process.exit(0);
