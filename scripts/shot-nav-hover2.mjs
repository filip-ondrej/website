// Hit-area contiguity + exit-flicker + traversal continuity check.
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const b = await puppeteer.launch({
    executablePath: EDGE, headless: true,
    args: ['--no-first-run', '--hide-scrollbars'],
});
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await p.goto('http://localhost:3001', { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForFunction(() => window.__loaderPerf?.reveal !== undefined, { timeout: 60000 }).catch(() => {});
await new Promise(r => setTimeout(r, 2500));

// 1) Geometry: adjacent link boxes must TOUCH (gap 0), visual text rhythm intact.
const m = await p.evaluate(() => {
    const links = [...document.querySelectorAll('.glass-nav__desktop .glass-nav-link')]
        .map(a => a.getBoundingClientRect());
    const book = document.querySelector('.glass-nav__desktop .glass-nav__book').getBoundingClientRect();
    const boxGaps = [];
    for (let i = 1; i < links.length; i++) boxGaps.push(Math.round(links[i].left - links[i - 1].right));
    return {
        boxGaps,
        linkHeights: links.map(r => Math.round(r.height)),
        barH: document.querySelector('.glass-nav').offsetHeight,
        lastLinkRightToBook: Math.round(book.left - links.at(-1).right),
    };
});
console.log(JSON.stringify(m));

// 2) Traversal: sweep the cursor across the whole cluster; sample how many
// links are lit (hover) at each step — should never be 0 inside the cluster.
const sweep = await p.evaluate(() => {
    const links = [...document.querySelectorAll('.glass-nav__desktop .glass-nav-link')];
    const first = links[0].getBoundingClientRect();
    const last = links.at(-1).getBoundingClientRect();
    return { startX: first.left + 2, endX: last.right - 2, y: first.top + first.height / 2 };
});
let zeroHits = 0;
for (let x = sweep.startX; x <= sweep.endX; x += 12) {
    await p.mouse.move(x, sweep.y);
    await new Promise(r => setTimeout(r, 16));
    const lit = await p.evaluate(() => document.querySelectorAll('.glass-nav__desktop .glass-nav-link:hover').length);
    if (lit === 0) zeroHits += 1;
}
console.log('sweep dead-zone samples (must be 0):', zeroHits);

// 3) Exit flicker: hover FILM, then leave downward — label must scramble AFTER leave.
const fb = await p.evaluate(() => {
    const el = [...document.querySelectorAll('.glass-nav__desktop .glass-nav-link')]
        .find(a => a.getAttribute('aria-label') === 'FILM');
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await p.mouse.move(fb.x, fb.y);
await new Promise(r => setTimeout(r, 900)); // let the enter wave finish
await p.mouse.move(fb.x, 400);              // leave
await new Promise(r => setTimeout(r, 80));
const midExit = await p.evaluate(() => {
    const el = [...document.querySelectorAll('.glass-nav__desktop .glass-nav-link')]
        .find(a => a.getAttribute('aria-label') === 'FILM');
    return el.querySelector('.glass-nav-link__label').textContent;
});
console.log('FILM label ~80ms after mouseleave:', JSON.stringify(midExit));
await p.screenshot({ path: 'scripts/shots/exit-flicker.png', clip: { x: 420, y: 0, width: 1020, height: 60 } });

await b.close().catch(() => {});
process.exit(0);
