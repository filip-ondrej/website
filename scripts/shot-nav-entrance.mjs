// Entrance choreography + journey tick verification.
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const b = await puppeteer.launch({
    executablePath: EDGE, headless: true,
    args: ['--no-first-run', '--hide-scrollbars'],
});
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await p.goto('http://localhost:3001', { waitUntil: 'domcontentloaded', timeout: 90000 });

// Catch the reveal moment, then shoot the entrance at three beats.
await p.waitForFunction(() => window.__loaderPerf?.reveal !== undefined, { timeout: 60000 });
const CLIP = { x: 0, y: 0, width: 1440, height: 60 };
await new Promise(r => setTimeout(r, 120));
await p.screenshot({ path: 'scripts/shots/entrance-1.png', clip: CLIP });
await new Promise(r => setTimeout(r, 280));
await p.screenshot({ path: 'scripts/shots/entrance-2.png', clip: CLIP });
await new Promise(r => setTimeout(r, 500));
await p.screenshot({ path: 'scripts/shots/entrance-3.png', clip: CLIP });
await new Promise(r => setTimeout(r, 1200));
await p.screenshot({ path: 'scripts/shots/entrance-settled.png', clip: CLIP });

// Every element must end visible.
const hiddenLeft = await p.evaluate(() =>
    document.querySelectorAll('.glass-nav [data-hidden="true"], .glass-nav__name[data-hidden="true"]').length);
console.log('elements still hidden after entrance:', hiddenLeft);

// Journey tick: scroll to ~55% of the document, read the transform.
await p.evaluate(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: max * 0.55 });
});
await new Promise(r => setTimeout(r, 900));
const tick = await p.evaluate(() => {
    const el = document.querySelector('.glass-nav__progress');
    return { transform: getComputedStyle(el).transform, scrolled: document.querySelector('.glass-nav').getAttribute('data-scrolled') };
});
console.log('tick at 55% scroll:', JSON.stringify(tick));

await b.close().catch(() => {});
process.exit(0);
