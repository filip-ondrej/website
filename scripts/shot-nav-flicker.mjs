// Flicker wave sequence: mid-wave readability + accent digits + settle.
// Page is at scroll 0, so document-space clips == viewport clips here.
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const b = await puppeteer.launch({
    executablePath: EDGE, headless: true,
    args: ['--no-first-run', '--hide-scrollbars'],
});
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await p.goto('http://localhost:3001', { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForFunction(() => window.__loaderPerf?.reveal !== undefined, { timeout: 45000 }).catch(() => {});
await new Promise(r => setTimeout(r, 1500));

const CLIP = { x: 420, y: 0, width: 1020, height: 60 };

const linkBox = async (label) => p.evaluate((l) => {
    const links = [...document.querySelectorAll('.glass-nav__desktop .glass-nav-link')];
    const el = links.find(a => a.getAttribute('aria-label') === l);
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}, label);

// Text snapshot helper: what does the label actually read right now?
const labelText = async (label) => p.evaluate((l) => {
    const links = [...document.querySelectorAll('.glass-nav__desktop .glass-nav-link')];
    const el = links.find(a => a.getAttribute('aria-label') === l);
    return el.querySelector('.glass-nav-link__label').textContent;
}, label);

// 1) PROJECTS wave: capture early, mid, settled.
let bx = await linkBox('PROJECTS');
await p.mouse.move(bx.x, bx.y);
await new Promise(r => setTimeout(r, 60));
console.log('PROJECTS @~60ms:', JSON.stringify(await labelText('PROJECTS')));
await p.screenshot({ path: 'scripts/shots/flick-projects-early.png', clip: CLIP });
console.log('PROJECTS @shot1:', JSON.stringify(await labelText('PROJECTS')));
await new Promise(r => setTimeout(r, 150));
console.log('PROJECTS @~mid:', JSON.stringify(await labelText('PROJECTS')));
await new Promise(r => setTimeout(r, 500));
console.log('PROJECTS settled:', JSON.stringify(await labelText('PROJECTS')));
await p.mouse.move(700, 500);
await new Promise(r => setTimeout(r, 300));

// 2) COLLABORATE (accent) wave: digits must be VISIBLE gold, not vanish.
bx = await linkBox('COLLABORATE');
await p.mouse.move(bx.x, bx.y);
await new Promise(r => setTimeout(r, 100));
console.log('COLLAB @~100ms:', JSON.stringify(await labelText('COLLABORATE')));
await p.screenshot({ path: 'scripts/shots/flick-collab-mid.png', clip: CLIP });
console.log('COLLAB @shot:', JSON.stringify(await labelText('COLLABORATE')));
await new Promise(r => setTimeout(r, 600));
console.log('COLLAB settled:', JSON.stringify(await labelText('COLLABORATE')));
await p.screenshot({ path: 'scripts/shots/flick-collab-settled.png', clip: CLIP });
await p.mouse.move(700, 500);
await new Promise(r => setTimeout(r, 300));

// 3) BOOK A CALL wave mid-state.
const bb = await p.evaluate(() => {
    const r = document.querySelector('.glass-nav__desktop .glass-nav__book').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await p.mouse.move(bb.x, bb.y);
await new Promise(r => setTimeout(r, 100));
await p.screenshot({ path: 'scripts/shots/flick-book-mid.png', clip: CLIP });
await new Promise(r => setTimeout(r, 600));
await p.screenshot({ path: 'scripts/shots/flick-book-settled.png', clip: CLIP });

// 4) Resting bar for the evaluation.
await p.mouse.move(10, 500);
await new Promise(r => setTimeout(r, 400));
await p.screenshot({ path: 'scripts/shots/flick-bar-rest.png', clip: { x: 0, y: 0, width: 1440, height: 60 } });

await b.close().catch(() => {});
process.exit(0);
