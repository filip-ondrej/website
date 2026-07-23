// /projects only: loader behavior + page + hover recede + modal.
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const b = await puppeteer.launch({
    executablePath: EDGE, headless: true,
    args: ['--no-first-run', '--hide-scrollbars'],
});
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:3001/projects', { waitUntil: 'networkidle2', timeout: 90000 });
const revealed = await p
    .waitForFunction(() => window.__loaderPerf?.reveal !== undefined, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
console.log('loader revealed:', revealed);
console.log('loaderPerf:', JSON.stringify(await p.evaluate(() => window.__loaderPerf ?? null)));
await new Promise(r => setTimeout(r, 800));

await p.screenshot({ path: 'scripts/shots/matrix2-page.png', captureBeyondViewport: false });

const rb = await p.evaluate(() => {
    const rows = document.querySelectorAll('.pm-row');
    if (rows.length < 2) return null;
    const r = rows[1].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (rb) {
    await p.mouse.move(rb.x, rb.y);
    await new Promise(r => setTimeout(r, 500));
    await p.screenshot({ path: 'scripts/shots/matrix2-hover.png', captureBeyondViewport: false });
    await p.mouse.click(rb.x, rb.y);
    await new Promise(r => setTimeout(r, 900));
    await p.screenshot({ path: 'scripts/shots/matrix2-modal.png', captureBeyondViewport: false });
}

await b.close().catch(() => {});
process.exit(0);
