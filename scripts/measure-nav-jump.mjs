// Nav jump sync: after clicking a navbar link, the page and the drawn tip
// must settle TOGETHER. Samples scrollY + window.progressTipY every 50ms.
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const b = await puppeteer.launch({
    executablePath: EDGE, headless: true,
    args: ['--no-first-run', '--hide-scrollbars'],
});
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:3001', { waitUntil: 'networkidle2', timeout: 90000 });
await p.waitForFunction(() => window.__loaderPerf?.reveal !== undefined, { timeout: 60000 }).catch(() => {});
await new Promise(r => setTimeout(r, 2000));

const jump = async (label) => {
    const box = await p.evaluate((l) => {
        const links = [...document.querySelectorAll('.glass-nav__desktop .glass-nav-link')];
        const el = links.find(a => a.getAttribute('aria-label') === l);
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, label);
    await p.mouse.click(box.x, box.y);

    const t0 = Date.now();
    const samples = [];
    let settledAt = null;
    let tipSettledAt = null;
    let prev = null;
    while (Date.now() - t0 < 5000) {
        const s = await p.evaluate(() => ({ y: Math.round(window.scrollY), tip: Math.round(window.progressTipY ?? -1) }));
        const t = Date.now() - t0;
        samples.push({ t, ...s });
        if (prev) {
            if (settledAt === null && Math.abs(s.y - prev.y) < 1) settledAt = t;
            if (settledAt !== null && Math.abs(s.y - prev.y) >= 1) settledAt = null;
            if (tipSettledAt === null && Math.abs(s.tip - prev.tip) < 1) tipSettledAt = t;
            if (tipSettledAt !== null && Math.abs(s.tip - prev.tip) >= 1) tipSettledAt = null;
        }
        if (settledAt !== null && tipSettledAt !== null && t - Math.max(settledAt, tipSettledAt) > 400) break;
        prev = s;
        await new Promise(r => setTimeout(r, 50));
    }
    console.log(`${label}: page settled ~${settledAt}ms, tip settled ~${tipSettledAt}ms, lag ${Math.abs((tipSettledAt ?? 9999) - (settledAt ?? 9999))}ms`);
    console.log('  trace:', samples.filter((_, i) => i % 4 === 0).map(s => `${s.t}ms y=${s.y} tip=${s.tip}`).join(' | '));
};

await jump('CONTACT');   // longest jump: top → bottom
await new Promise(r => setTimeout(r, 500));
await jump('PROJECTS');  // long jump back up

await b.close().catch(() => {});
process.exit(0);
