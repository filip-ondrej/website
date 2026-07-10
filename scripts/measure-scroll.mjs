// Headless scroll-jank benchmark for the hero section.
// Usage: node scripts/measure-scroll.mjs [url]
// Samples rAF frame deltas while wheeling through the hero, for a baseline and
// with individual suspects disabled — the delta tells us who causes the jank.
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] || 'http://localhost:3999';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-first-run', '--disable-extensions'],
});

async function bench(label, prep) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
        () => window.__loaderPerf && window.__loaderPerf.reveal !== undefined,
        { timeout: 30000 }
    );
    if (prep) await prep(page);
    await new Promise((r) => setTimeout(r, 600));

    await page.evaluate(() => {
        window.__frames = [];
        window.__stopSampler = false;
        let last = performance.now();
        const loop = (t) => {
            window.__frames.push(t - last);
            last = t;
            if (!window.__stopSampler) requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    });

    // Wheel through the hero (site hijacks wheel -> scrollTo)
    for (let i = 0; i < 50; i++) {
        await page.mouse.wheel({ deltaY: 120 });
        await new Promise((r) => setTimeout(r, 25));
    }

    const frames = await page.evaluate(() => {
        window.__stopSampler = true;
        return window.__frames.slice(5);
    });
    const scrollY = await page.evaluate(() => Math.round(window.scrollY));
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    const sorted = [...frames].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const jank = frames.filter((f) => f > 26).length;
    console.log(
        `${label.padEnd(22)} avg ${avg.toFixed(1)}ms  p95 ${p95.toFixed(0)}ms  worst ${Math.max(...frames).toFixed(0)}ms  jank>26ms ${jank}/${frames.length}  endY ${scrollY}`
    );
    await page.close();
}

await bench('baseline');
await bench('no header blur', (page) =>
    page.addStyleTag({ content: 'header{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' })
);
await bench('no hero images', (page) =>
    page.addStyleTag({ content: '.hero-section img{display:none!important}' })
);
await bench('no spine svg', (page) =>
    page.evaluate(() => document.querySelectorAll('svg.absolute')[0]?.remove())
);
await browser.close();
