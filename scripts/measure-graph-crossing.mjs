// Measures the graph-crossing geometry against the running dev server:
// where the run sits in the viewport when the sweep starts, how much of the
// graph is cut at the corner moment for the current BUBBLE_HORIZ_BUDGET, and
// the exact budget needed for the graph to fully clear the fold by the corner.
import puppeteer from 'puppeteer-core';

const URL = 'http://localhost:3001';
const VW = 1440, VH = 900;

// must mirror 00_ProgressLine.tsx
const TIP_BAND_TOP = 0.2;
const TIP_BAND_BOTTOM = 0.8;
const TIP_INTRO_VH = 0.3;
const TIP_OUTRO_VH = 0.3;
const BUBBLE_MIN_BUDGET = 50, BUBBLE_FIT_MARGIN = 48;

const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: [`--window-size=${VW},${VH + 100}`],
});
const page = await browser.newPage();
await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

// wait for the loader to reveal + anchors to settle
await page.waitForFunction(
    () => window.lineAnchors && window.lineAnchors['timeline-left'],
    { timeout: 30000 }
);
await new Promise((r) => setTimeout(r, 2500)); // fonts/images settle + re-measure

const data = await page.evaluate(() => {
    const a = window.lineAnchors;
    const wrap = document.querySelector('.tl-wrap');
    const rect = wrap.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    return {
        runY: a['timeline-left'].y,
        bottomAnchorY: a['timeline-bottom'].y,
        graphTopDoc: top,
        graphBottomDoc: top + rect.height,
        graphHeight: rect.height,
        docH: document.documentElement.scrollHeight,
        vh: window.innerHeight,
    };
});

const { runY, graphBottomDoc, docH, vh } = data;

// tip(p) = p + vh * vpPos(p) — same mapping as computeViewportPos
function tip(p) {
    const maxScrollForVP = docH - vh;
    const introEnd = vh * TIP_INTRO_VH;
    const normalEnd = maxScrollForVP - vh * TIP_OUTRO_VH;
    let vp;
    if (p <= introEnd) vp = (p / introEnd) * TIP_BAND_TOP;
    else if (p <= normalEnd)
        vp = TIP_BAND_TOP + ((p - introEnd) / (normalEnd - introEnd)) * (TIP_BAND_BOTTOM - TIP_BAND_TOP);
    else vp = TIP_BAND_BOTTOM + ((p - normalEnd) / (vh * TIP_OUTRO_VH)) * (1 - TIP_BAND_BOTTOM);
    return p + vh * Math.max(0, Math.min(1, vp));
}
// invert tip() by bisection
function pageAtTip(t) {
    let lo = 0, hi = docH - vh;
    for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (tip(mid) < t) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
}

const dropLen = data.bottomAnchorY - runY;
const cap = dropLen * 0.5;

const pSweepStart = pageAtTip(runY);
const runViewportAtStart = runY - pSweepStart;

const fitTarget = data.bottomAnchorY + BUBBLE_FIT_MARGIN;
// mirror of computeBubbles auto-budget
const budgetAuto = Math.min(Math.max(tip(Math.max(0, fitTarget - vh)) - runY, BUBBLE_MIN_BUDGET), cap);
const budgetEff = budgetAuto;
const pCorner = pageAtTip(runY + budgetEff);
const graphBottomAtCorner = graphBottomDoc - pCorner;
const deficitAtCorner = graphBottomAtCorner - vh;

// budget needed so graph bottom == viewport bottom exactly at the corner
const pFit = graphBottomDoc - vh;
const budgetNeeded = tip(pFit) - runY;

console.log(JSON.stringify({
    ...data,
    dropLen,
    halfDropCap: cap,
    pSweepStart: Math.round(pSweepStart),
    runViewportAtStart: Math.round(runViewportAtStart),
    budgetEffective: Math.round(budgetEff),
    graphBottomAtCorner: Math.round(graphBottomAtCorner),
    deficitAtCorner: Math.round(deficitAtCorner),
    budgetNeeded: Math.round(budgetNeeded),
}, null, 2));

// visual proof: screenshot at the corner moment
await page.evaluate((y) => window.scrollTo(0, y), pCorner);
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: 'C:/Users/ondre/AppData/Local/Temp/claude/C--Users-ondre-Desktop-PROJECTS-PersonalBrand-filipondrej-site-frontend/e565e8ac-deac-46a3-ac6f-d73fe7a12151/scratchpad/corner-moment.png' });

await browser.close();
