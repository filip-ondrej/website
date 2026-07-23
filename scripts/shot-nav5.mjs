// Nav polish diagnosis: top state, over-content state, hover recede, link metrics.
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const b = await puppeteer.launch({
    executablePath: EDGE, headless: true,
    args: ['--no-first-run', '--hide-scrollbars'],
});
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await p.goto(process.argv[2] || 'http://localhost:3001', { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForFunction(() => window.__loaderPerf?.reveal !== undefined, { timeout: 45000 }).catch(() => {});
await new Promise(r => setTimeout(r, 1800));

// Metrics: bar height, name box, each link box, gaps between links, book box.
const m = await p.evaluate(() => {
    const bar = document.querySelector('.glass-nav');
    const name = document.querySelector('.glass-nav__name').getBoundingClientRect();
    const links = [...document.querySelectorAll('.glass-nav__desktop .glass-nav-link')]
        .map(a => ({ label: a.textContent.trim(), r: a.getBoundingClientRect() }));
    const book = document.querySelector('.glass-nav__desktop .glass-nav__book').getBoundingClientRect();
    const gaps = [];
    for (let i = 1; i < links.length; i++)
        gaps.push(Math.round(links[i].r.left - links[i - 1].r.right));
    return {
        barH: bar.offsetHeight,
        nameRight: Math.round(name.right),
        firstLinkLeft: Math.round(links[0].r.left),
        lastLinkRight: Math.round(links.at(-1).r.right),
        bookLeft: Math.round(book.left), bookRight: Math.round(book.right),
        bookH: Math.round(book.height),
        viewport: 1440,
        linkWidths: links.map(l => `${l.label.slice(0, 18)}:${Math.round(l.r.width)}`),
        gaps,
    };
});
console.log(JSON.stringify(m, null, 2));

await p.screenshot({ path: 'scripts/shots/nav5-top.png', clip: { x: 0, y: 0, width: 1440, height: 100 } });

// Hover a middle link to capture flicker + group recede.
const box = await p.evaluate(() => {
    const r = [...document.querySelectorAll('.glass-nav__desktop .glass-nav-link')][2].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await p.mouse.move(box.x, box.y);
await new Promise(r => setTimeout(r, 400));
await p.screenshot({ path: 'scripts/shots/nav5-hover.png', clip: { x: 0, y: 0, width: 1440, height: 100 } });
await p.mouse.move(10, 500);

// Over content (glass effect), mid-page.
await p.evaluate(() => window.scrollTo({ top: 2200 }));
await new Promise(r => setTimeout(r, 1200));
await p.screenshot({ path: 'scripts/shots/nav5-glass.png', clip: { x: 0, y: 0, width: 1440, height: 100 } });

await b.close().catch(() => {});
process.exit(0);
