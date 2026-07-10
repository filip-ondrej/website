// Headless load-time measurement against a running server (dev or prod serve).
// Usage: node scripts/measure-load.mjs [url]
// Reports: navigation timings, the loader's phase marks (window.__loaderPerf),
// and the slowest network resources — i.e., exactly where the wait comes from.
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] || 'http://localhost:3999';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-first-run', '--disable-extensions'],
});

async function run(label) {
    const page = await browser.newPage();
    await page.setCacheEnabled(false); // cold-cache = worst case, like a hard refresh
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
        () => window.__loaderPerf && window.__loaderPerf.reveal !== undefined,
        { timeout: 30000 }
    );
    const perf = await page.evaluate(() => window.__loaderPerf);
    const nav = await page.evaluate(() => {
        const n = performance.getEntriesByType('navigation')[0];
        return {
            ttfb: Math.round(n.responseStart),
            htmlDone: Math.round(n.responseEnd),
            domContentLoaded: Math.round(n.domContentLoadedEventEnd),
        };
    });
    const resources = await page.evaluate(() =>
        performance
            .getEntriesByType('resource')
            .map((r) => ({
                name: r.name.replace(/^https?:\/\/[^/]+/, '').slice(0, 70),
                start: Math.round(r.startTime),
                dur: Math.round(r.duration),
                kb: Math.round((r.transferSize || 0) / 1024),
            }))
            .sort((a, b) => b.dur - a.dur)
            .slice(0, 12)
    );
    console.log(`\n=== ${label} ===`);
    console.log('nav:', JSON.stringify(nav));
    console.log('loader marks (ms since navigation):', JSON.stringify(perf));
    console.log('slowest resources:');
    for (const r of resources) console.log(`  ${String(r.dur).padStart(5)}ms  @${String(r.start).padStart(5)}ms  ${String(r.kb).padStart(5)}KB  ${r.name}`);
    await page.close();
}

await run('run 1 (cold cache)');
await run('run 2 (cold cache, warm server)');
await browser.close();
