'use client';

import { useEffect, useLayoutEffect, useState, useRef, useCallback, Fragment } from 'react';
import { generateDynamicPath } from '@/lib/00_generateDynamicPath';
import { linePathConfig } from '@/data/00_linePathConfig';

// useLayoutEffect on the client (re-sync the imperative strokes BEFORE paint, so
// a rebuild re-render never flashes hidden/stale strokes); useEffect during SSR
// where layout effects don't exist.
const useIsomorphicLayoutEffect =
    typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// ====== VISUAL CONFIG ======
const STATIC_LINE_COLOR = 'rgba(47,47,49)'; // faint baseline
const ACTIVE_LINE_COLOR = 'rgb(255,255,255)';       // animated stroke
const STATIC_LINE_WIDTH = 2;
const ACTIVE_LINE_WIDTH = 4;

// how far ahead (in px) we reveal the gray baseline
const BASELINE_REVEAL_AHEAD = 1000;

// Global wheel-scroll speed. 1 = native feel, lower = slower page. Applies on
// top of the per-bubble slow zones (those multiply this further). Tune live —
// but beware going far below ~0.75: the page is long and a recruiter on a
// 90-second budget shouldn't feel like they're wading.
const WHEEL_SPEED = 0.8;

// Stepped-mouse smoothing. Notched wheels teleport in ~100px quanta ("robotic");
// instead of applying the step instantly, we glide the page toward the target
// with this exponential time-constant. Higher = softer/floatier. The page and
// the line tip stay locked together while gliding (the tip derives from the
// live position), so this can NEVER reintroduce line-lag. Trackpads are
// detected (fractional / small deltas) and keep their native instant feel.
const WHEEL_SMOOTH_TAU_MS = 110;
// A delta that is fractional or smaller than this marks the device as a
// trackpad for TRACKPAD_LATCH_MS — smoothing stays off while it's latched.
const TRACKPAD_DELTA_MAX = 80;
const TRACKPAD_LATCH_MS = 300;

// ---- Tip-in-viewport mapping ----
// Where the tip rides in the viewport as you scroll: it ramps 0 → TIP_BAND_TOP
// over the first TIP_INTRO_VH viewport-heights of scrolling, slides TIP_BAND_TOP
// → TIP_BAND_BOTTOM linearly through the body of the page, then ramps
// TIP_BAND_BOTTOM → 1 over the last TIP_OUTRO_VH. The ramps exist so the tip
// can touch the document's very top and very bottom; inside them it moves
// faster than the scroll (shorter ramp = faster catch-up sprint).
// Band top 0.2 keeps the horizontal crossings high in the viewport so the
// content below them (e.g. the graph) stays fully visible during the slow.
const TIP_BAND_TOP = 0.25;
const TIP_BAND_BOTTOM = 0.75;
const TIP_INTRO_VH = 0.3;
const TIP_OUTRO_VH = 0.3;

// ---- Slow-zone (bubble) geometry ----
// Each bubble's sweep "budget" — the px of page drift during which the
// horizontal finishes drawing — is AUTO-COMPUTED per bubble at rebuild time:
// exactly the drift needed for the content below the run (drop end +
// BUBBLE_FIT_MARGIN) to clear the fold by the corner moment, at the CURRENT
// viewport. This is the conservation law made self-tuning: page descent during
// the sweep == vertical sync error at the corner, so we spend precisely what
// the section needs and no more. BUBBLE_MIN_BUDGET keeps a natural drift on
// crossings whose content already fits (the titles); the half-drop cap
// protects short drops.
const BUBBLE_MIN_BUDGET = 50;
const BUBBLE_FIT_MARGIN = 48;
// Phase changes are eased over this many px of tip travel (slope-continuous
// mapping: ramp into the sweep, ease through the corner, ramp out at the drop
// end). The plateau speeds are SOLVED so the line still advances exactly 1px
// of path per 1px of wheel input overall, the horizontal still completes
// exactly at the corner, and the vertical still lands exactly at the drop end.
const BUBBLE_EASE_RAMP = 30;

// ====== TYPES ======
type AnchorPoint = { x: number; y: number };
type AnchorsMap = Record<string, AnchorPoint>;

// One linear-slope piece of a bubble's path-vs-tip mapping. Over tip travel
// [y0, y1] (local, from bubble start) the draw speed (px of path per px of tip)
// goes linearly s0 → s1; S0 = total path drawn at y0. Slope-continuity across
// pieces is what makes the page speed (= input × 1/s) free of steps.
type SlopePiece = { y0: number; y1: number; s0: number; s1: number; S0: number };

type Bubble = {
    startY: number;
    endY: number;
    horizY: number;
    horizWidth: number;
    dropLen: number;
    // px of tip descent allocated to drawing the horizontal (phase 1); the
    // horizontal completes EXACTLY here (the corner). Auto-computed per bubble
    // so the content below the run clears the fold by the corner moment.
    budget: number;
    // slope-continuous mapping pieces covering [0, dropLen]
    pieces: SlopePiece[];
    horizontalSegIndex: number;
    postVerticalSegIndex: number;
    maxOwnedIndex: number;
};

// Draw speed (px path / px tip) at local tip position y.
function bubbleSlopeAt(bubble: Bubble, y: number): number {
    const ps = bubble.pieces;
    for (const p of ps) {
        if (y <= p.y1 || p === ps[ps.length - 1]) {
            const span = p.y1 - p.y0;
            const t = span <= 0 ? 1 : clamp((y - p.y0) / span, 0, 1);
            return p.s0 + (p.s1 - p.s0) * t;
        }
    }
    return 1;
}

// Total path drawn (px) after y px of local tip travel — piecewise-quadratic
// integral of the slope pieces.
function bubblePathCoveredAt(bubble: Bubble, y: number): number {
    const ps = bubble.pieces;
    const last = ps[ps.length - 1];
    if (y >= last.y1) return last.S0 + ((last.s0 + last.s1) / 2) * (last.y1 - last.y0);
    for (const p of ps) {
        if (y <= p.y1 || p === last) {
            const span = p.y1 - p.y0;
            const t = span <= 0 ? 0 : clamp((y - p.y0) / span, 0, 1);
            const sHere = p.s0 + (p.s1 - p.s0) * t;
            return p.S0 + ((p.s0 + sHere) / 2) * (y - p.y0);
        }
    }
    return 0;
}

type BubbleRuntimeState = {
    bubble: Bubble | null;
    isActive: boolean;
    scrollMult: number;
};

declare global {
    interface Window {
        lineAnchors?: AnchorsMap;
        progressTipY?: number;     // <— add this
    }
}

// ====== HELPERS ======

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

function dist(a: AnchorPoint, b: AnchorPoint) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// ---- Tip mapping (module scope: the scroll loop AND computeBubbles use it) ----
function viewportPosAt(pageY: number, vh: number, docH: number): number {
    const maxScrollForVP = docH - vh;
    const introEnd = vh * TIP_INTRO_VH;
    const normalEnd = maxScrollForVP - vh * TIP_OUTRO_VH;

    let vpPos = 0;
    if (pageY <= introEnd) {
        vpPos = (pageY / introEnd) * TIP_BAND_TOP;
    } else if (pageY <= normalEnd) {
        const norm = (pageY - introEnd) / (normalEnd - introEnd);
        vpPos = TIP_BAND_TOP + norm * (TIP_BAND_BOTTOM - TIP_BAND_TOP);
    } else {
        const outro = (pageY - normalEnd) / (vh * TIP_OUTRO_VH);
        vpPos = TIP_BAND_BOTTOM + outro * (1 - TIP_BAND_BOTTOM);
    }
    return clamp(vpPos, 0, 1);
}

function tipAt(pageY: number, vh: number, docH: number): number {
    return pageY + vh * viewportPosAt(pageY, vh, docH);
}

function segmentIsWithinRevealRange(
    tipY: number,
    fromA: AnchorPoint,
    toA: AnchorPoint,
    aheadPx: number
): boolean {
    const segMinY = Math.min(fromA.y, toA.y);
    return segMinY <= tipY + aheadPx;
}

// Build slowdown "bubbles" for each horizontal+down pair
function computeBubbles(anchors: AnchorsMap | undefined): Bubble[] {
    if (!anchors) return [];

    const bubbles: Bubble[] = [];

    for (let i = 0; i < linePathConfig.length; i++) {
        const seg = linePathConfig[i];
        if (seg.type !== 'horizontal') continue;

        const fromA = anchors[seg.from];
        const toA = anchors[seg.to];
        if (!fromA || !toA) continue;

        const horizWidth = Math.abs(toA.x - fromA.x);
        const horizY = fromA.y;

        // find attached downward leg after this horizontal
        let postVerticalSegIndex = -1;
        let dropLen = 0;

        for (let j = i + 1; j < linePathConfig.length; j++) {
            const seg2 = linePathConfig[j];
            if (seg2.type !== 'vertical') continue;

            const f2 = anchors[seg2.from];
            const t2 = anchors[seg2.to];
            if (!f2 || !t2) continue;

            const startsAtEitherEnd =
                (Math.abs(f2.x - toA.x) < 0.5 && Math.abs(f2.y - toA.y) < 0.5) ||
                (Math.abs(f2.x - fromA.x) < 0.5 && Math.abs(f2.y - fromA.y) < 0.5);

            const goesDown = t2.y > f2.y;

            if (startsAtEitherEnd && goesDown) {
                postVerticalSegIndex = j;
                dropLen = t2.y - f2.y;
                break;
            }
        }

        if (postVerticalSegIndex === -1 || dropLen <= 0.5) continue;

        // ---- auto-budget: exactly the sweep drift this section needs ----
        // Fit target = the drop's end plus a visual margin; the budget is the
        // tip travel after which that target sits at the viewport bottom. If
        // the target already fits when the sweep starts, keep a small natural
        // drift (min); never let the sweep eat more than half the drop.
        const vh = window.innerHeight;
        const docH = document.documentElement.scrollHeight;
        const fitTarget = horizY + dropLen + BUBBLE_FIT_MARGIN;
        const pFit = Math.max(0, fitTarget - vh);
        const budgetNeeded = tipAt(pFit, vh, docH) - horizY;
        const budget = clamp(budgetNeeded, BUBBLE_MIN_BUDGET, dropLen * 0.5);

        // ---- slope-continuous mapping (see SlopePiece) ----
        // Plateau speeds are SOLVED so that: path drawn over [0, budget] ==
        // horizWidth (the corner lands exactly at the corner), path drawn over
        // [budget, dropLen] == dropLen (the vertical lands exactly at the drop
        // end), and the slope enters/exits at 1 (no page-speed step against
        // the free vertical outside the bubble).
        const B = budget;
        const D = dropLen;
        const W = horizWidth;
        const r = Math.max(0, Math.min(BUBBLE_EASE_RAMP, B / 3, (D - B) / 3));
        // phase 2: r-wide exit ramp s2→1 ending at D
        const s2 = Math.max(1, (D - r / 2) / (D - B - r / 2));
        // phase 1: r-wide entry ramp 1→s1, plateau, r-wide corner ramp s1→s2
        const s1 = Math.max(s2, (W - (r * (1 + s2)) / 2) / (B - r));

        const pieces: SlopePiece[] = [];
        let S0 = 0;
        const pushPiece = (y0: number, y1: number, sa: number, sb: number) => {
            if (y1 - y0 <= 0) return;
            pieces.push({ y0, y1, s0: sa, s1: sb, S0 });
            S0 += ((sa + sb) / 2) * (y1 - y0);
        };
        pushPiece(0, r, 1, s1);              // ease into the sweep
        pushPiece(r, B - r, s1, s1);         // sweep plateau
        pushPiece(B - r, B, s1, s2);         // ease through the corner
        pushPiece(B, D - r, s2, s2);         // drop plateau
        pushPiece(D - r, D, s2, 1);          // ease out at the drop end

        const maxOwnedIndex = Math.max(i, postVerticalSegIndex);

        bubbles.push({
            startY: horizY,
            endY: horizY + dropLen,
            horizY,
            horizWidth,
            dropLen,
            budget,
            pieces,
            horizontalSegIndex: i,
            postVerticalSegIndex,
            maxOwnedIndex,
        });
    }

    bubbles.sort((a, b) => a.startY - b.startY);
    return bubbles;
}

function getActiveBubbleAtY(y: number, bubbles: Bubble[]): Bubble | null {
    for (const b of bubbles) {
        if (y >= b.startY && y <= b.endY) return b;
    }
    return null;
}

function getBubbleBySegIndex(segIndex: number, bubbles: Bubble[]): Bubble | null {
    for (const b of bubbles) {
        if (
            b.horizontalSegIndex === segIndex ||
            b.postVerticalSegIndex === segIndex
        ) {
            return b;
        }
    }
    return null;
}

/**
 * bubblePathProgress
 * Slope-continuous two-phase mapping (see computeBubbles). The horizontal
 * draws over the first `budget` px of tip descent and completes exactly at
 * the corner; the vertical then draws near-1:1 and lands exactly at the drop
 * end. Progress is derived from the integrated slope curve, so there are no
 * speed steps anywhere — including against the free line outside the bubble.
 */
function bubblePathProgress(
    bubble: Bubble,
    tipY: number
): { horizProg: number; vertProg: number } {
    const { horizWidth, dropLen } = bubble;
    const localY = clamp(tipY - bubble.startY, 0, dropLen);
    const covered = bubblePathCoveredAt(bubble, localY);

    if (covered <= horizWidth || horizWidth === 0) {
        const horizProg = horizWidth === 0 ? 1 : clamp(covered / horizWidth, 0, 1);
        return { horizProg, vertProg: 0 };
    }
    const vertProg = clamp((covered - horizWidth) / dropLen, 0, 1);
    return { horizProg: 1, vertProg };
}

/**
 * getBubbleRuntimeState
 * While tip is inside a bubble:
 *  - scroll is slowed via scrollMult in wheel handler
 *  - we also use bubble.maxOwnedIndex to lock future segments
 */
function getBubbleRuntimeState(
    tipY: number,
    bubbles: Bubble[]
): BubbleRuntimeState {
    const bubble = getActiveBubbleAtY(tipY, bubbles);

    if (!bubble) {
        return { bubble: null, isActive: false, scrollMult: 1 };
    }

    // if we've basically hit the bottom of the bubble, unlock
    if (tipY >= bubble.endY - 0.5) {
        return { bubble, isActive: false, scrollMult: 1 };
    }

    // The page slowdown is the exact reciprocal of the draw speed at this tip
    // position, so the LINE advances at a constant 1px of path per 1px of
    // wheel input everywhere — and because the slope curve is continuous, the
    // page speed has no steps either (it ramps in/out and through the corner).
    const localY = tipY - bubble.startY;
    const scrollMult = clamp(1 / bubbleSlopeAt(bubble, localY), 0.02, 1);

    return {
        bubble,
        isActive: true,
        scrollMult,
    };
}

/**
 * getSegmentLogicalProgress
 */
function getSegmentLogicalProgress(
    segIndex: number,
    tipY: number,
    anchors: AnchorsMap | undefined,
    bubbles: Bubble[]
): number {
    if (!anchors) return 0;

    const cfg = linePathConfig[segIndex];
    const fromA = anchors[cfg.from];
    const toA = anchors[cfg.to];
    if (!cfg || !fromA || !toA) return 0;

    const bubble = getBubbleBySegIndex(segIndex, bubbles);
    if (bubble) {
        if (tipY < bubble.startY) return 0;
        if (tipY >= bubble.endY) return 1;

        const { horizProg, vertProg } = bubblePathProgress(bubble, tipY);

        if (segIndex === bubble.horizontalSegIndex) return horizProg;
        if (segIndex === bubble.postVerticalSegIndex) return vertProg;

        return 0;
    }

    // non-bubble fallback
    const segStartY = Math.min(fromA.y, toA.y);
    const segEndY = Math.max(fromA.y, toA.y);
    const h = segEndY - segStartY;
    if (h === 0) return 1;

    return clamp((tipY - segStartY) / h, 0, 1);
}

/**
 * clampProgressByTip
 * White cable (active stroke) is never allowed to "draw past" the tip.
 */
function clampProgressByTip(
    rawProg: number,
    fromA: AnchorPoint,
    toA: AnchorPoint,
    tipY: number
): number {
    const dy = toA.y - fromA.y;

    // horizontal / upward segments can't go "below tip", so raw is fine
    if (Math.abs(dy) < 0.0001) {
        return clamp(rawProg, 0, 1);
    }

    // downward segment: clamp
    if (dy > 0) {
        const startY = fromA.y;
        const revealedY = startY + dy * rawProg;
        if (revealedY > tipY) {
            const allowedDy = tipY - startY;
            const progAllowed = allowedDy / dy;
            return clamp(progAllowed, 0, 1);
        }
    }

    return clamp(rawProg, 0, 1);
}

/**
 * canDrawSegment
 */
function canDrawSegment(
    segIndex: number,
    tipY: number,
    anchors: AnchorsMap | undefined,
    bubbles: Bubble[],
    runtime: BubbleRuntimeState
): boolean {
    if (!anchors) return false;

    let maxAllowed = Infinity;
    if (runtime.isActive && runtime.bubble) {
        maxAllowed = runtime.bubble.maxOwnedIndex;
    }
    if (segIndex > maxAllowed) return false;

    for (let i = 0; i < segIndex; i++) {
        if (i <= maxAllowed) {
            const prevProg = getSegmentLogicalProgress(i, tipY, anchors, bubbles);
            if (prevProg < 0.999) {
                return false;
            }
        }
    }

    return true;
}

/**
 * getLastAnchorAndBottomTail
 */
function getLastAnchorAndBottomTail(
    anchors: AnchorsMap | undefined
): { tailFrom: AnchorPoint | null; tailTo: AnchorPoint | null } {
    if (!anchors) {
        return { tailFrom: null, tailTo: null };
    }

    let deepestId: string | null = null;
    let deepestY = -Infinity;

    for (const [id, pt] of Object.entries(anchors)) {
        if (pt.y > deepestY) {
            deepestY = pt.y;
            deepestId = id;
        }
    }

    if (!deepestId) {
        return { tailFrom: null, tailTo: null };
    }

    const fromA = anchors[deepestId];
    if (!fromA) {
        return { tailFrom: null, tailTo: null };
    }

    const bottomY = document.documentElement.scrollHeight;
    const tailFrom = { x: fromA.x, y: fromA.y };
    const tailTo = { x: fromA.x, y: bottomY };

    if (tailTo.y <= tailFrom.y + 0.5) {
        return { tailFrom: null, tailTo: null };
    }

    return { tailFrom, tailTo };
}

// ====== COMPONENT ======
export function ProgressLine() {
    // The tip lives in a REF, not state. Routing it through setState meant React
    // re-reconciled the whole SVG at least a frame behind the page move, so the
    // drawn tip trailed the scroll during fast wheeling and visibly "caught up"
    // on stop. The rAF loop now writes stroke attributes imperatively (see
    // drawFrame) in the same frame as the scroll — the tip is ALWAYS at the
    // scroll position. React only re-renders on rebuilds (anchors/resize).
    const tipYRef = useRef(0);

    const [, setPathData] = useState<{
        pathString: string;
        totalLength: number;
        segmentData: {
            length: number;
            scrollMultiplier: number;
            sectionNumber: number;
            type: string;
        }[];
        minY: number;
        maxY: number;
    }>({
        pathString: '',
        totalLength: 0,
        segmentData: [],
        minY: 0,
        maxY: 0,
    });

    const bubblesRef = useRef<Bubble[]>([]);

    // canonical scroll used by wheel handler (with bubble slowdown)
    const pageScrollRef = useRef(0);
    // where the page WANTS to be — ahead of pageScrollRef only while a stepped
    // mouse wheel is gliding (trackpads apply instantly, keeping both equal)
    const targetScrollRef = useRef(0);
    // last time we saw a trackpad-like delta (fractional / small) — while
    // latched, wheel steps apply instantly with no glide
    const trackpadTsRef = useRef(0);

    // force one imperative redraw even if the tip didn't move (after rebuilds)
    const needsRedrawRef = useRef(true);

    // Imperative draw targets, indexed by config segment index. Callback refs
    // null them on unmount; drawFrame skips null entries.
    const baselineRefs = useRef<(SVGPathElement | null)[]>([]);
    const activeRefs = useRef<(SVGPathElement | null)[]>([]);
    const introActiveRef = useRef<SVGPathElement | null>(null);
    const tailBaselineRef = useRef<SVGPathElement | null>(null);
    const tailActiveRef = useRef<SVGPathElement | null>(null);

    // Tail geometry captured at render time — the per-frame draw must NOT re-read
    // document.scrollHeight (forced-layout risk). Any real height change re-renders
    // via the settle observer, refreshing this.
    const tailGeomRef = useRef<{ tailFrom: AnchorPoint; tailTo: AnchorPoint } | null>(null);

    // ---- LAYOUT SYNC ----
    const rebuildAll = useCallback(() => {
        const newPath = generateDynamicPath();
        setPathData(newPath);

        if (typeof window !== 'undefined' && window.lineAnchors) {
            bubblesRef.current = computeBubbles(window.lineAnchors);
        } else {
            bubblesRef.current = [];
        }
        needsRedrawRef.current = true;
    }, []);

    useEffect(() => {
        const t = setTimeout(rebuildAll, 100);
        window.addEventListener('anchors-updated', rebuildAll);
        window.addEventListener('resize', rebuildAll);
        return () => {
            clearTimeout(t);
            window.removeEventListener('anchors-updated', rebuildAll);
            window.removeEventListener('resize', rebuildAll);
        };
    }, [rebuildAll]);

    // ---- RE-MEASURE ON ANY LAYOUT SETTLE (not just window resize) ----
    // Each LineAnchor captures its Y on mount / +50ms / resize only, so any layout
    // shift after that — web-font swap, images decoding, the fluid timeline height
    // settling, the loader dismissing — moves content while the spine keeps the
    // stale positions, leaving it misaligned (running long, cutting through the next
    // title) until the user happens to resize. We watch the document height and, on a
    // real change, nudge the same 'resize' path every anchor + this component already
    // listen to, so the spine self-heals the moment the page settles.
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let raf = 0;
        let lastW = window.innerWidth;
        let lastH = document.documentElement.scrollHeight;

        const nudge = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
        };

        // Re-measure on ANY viewport-geometry change — WIDTH as well as height. Height
        // catches late layout shifts (font swap, images, fluid heights settling); WIDTH
        // catches window maximize/restore and — critically — browser zoom, which changes
        // the root element's CSS-pixel width but in several browsers does NOT fire a
        // window 'resize' event. Without the width check the CSS content rescaled while
        // the JS-measured spine kept stale anchor positions until a manual drag.
        // The delta guard ignores sub-pixel noise and prevents ResizeObserver feedback
        // loops (re-measuring is read-only; the absolutely-positioned spine SVG doesn't
        // change the root/body box).
        const check = () => {
            const w = window.innerWidth;
            const h = document.documentElement.scrollHeight;
            if (Math.abs(w - lastW) < 1 && Math.abs(h - lastH) < 1) return;
            lastW = w;
            lastH = h;
            nudge();
        };
        const ro = new ResizeObserver(check);
        ro.observe(document.body);
        ro.observe(document.documentElement);   // its CSS-px width shrinks on zoom

        // Pinch / browser zoom mutates the visual viewport without always firing a
        // window 'resize'; listen to it directly as a second safety net.
        const vv = window.visualViewport;
        vv?.addEventListener('resize', nudge);

        // Web-font swap is the most common late shift; re-measure once it's ready.
        if (document.fonts?.ready) {
            document.fonts.ready.then(nudge).catch(() => {});
        }

        // Backstop after all images/resources have loaded.
        const onLoad = () => nudge();
        window.addEventListener('load', onLoad);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            vv?.removeEventListener('resize', nudge);
            window.removeEventListener('load', onLoad);
        };
    }, []);

    // ---- PER-FRAME IMPERATIVE DRAW ----
    // Everything tip-dependent is written straight to the SVG DOM here, bypassing
    // React. Within one browser frame: the wheel handler moves the scroll → this
    // runs from rAF (pre-paint) → ONE paint shows page + tip together. React
    // reconciliation (state → diff → commit) added ≥1 frame of tip lag, visible
    // as the line trailing the scroll and catching up on stop.
    const drawFrame = useCallback(() => {
        const anchors = window.lineAnchors;
        if (!anchors) return;

        const tipY = tipYRef.current;
        const bubbles = bubblesRef.current;
        const runtime = getBubbleRuntimeState(tipY, bubbles);

        // Intro stub active
        const introEl = introActiveRef.current;
        if (introEl) {
            const firstA = linePathConfig.length > 0 ? anchors[linePathConfig[0].from] : undefined;
            if (firstA) {
                const introFrom = { x: firstA.x, y: 0 };
                const introTo = { x: firstA.x, y: firstA.y };
                const stubLen = dist(introFrom, introTo);
                const stubRawProg =
                    introTo.y > introFrom.y
                        ? clamp((tipY - introFrom.y) / (introTo.y - introFrom.y), 0, 1)
                        : 1;
                const stubProg = clampProgressByTip(stubRawProg, introFrom, introTo, tipY);
                introEl.style.display = '';
                introEl.setAttribute('stroke-dasharray', String(stubLen));
                introEl.setAttribute('stroke-dashoffset', String(stubLen * (1 - stubProg)));
            } else {
                introEl.style.display = 'none';
            }
        }

        // Real segments (baseline reveal + active stroke), same math as before —
        // only the write target changed (DOM attributes instead of React state).
        for (let i = 0; i < linePathConfig.length; i++) {
            const seg = linePathConfig[i];
            const fromA = anchors[seg.from];
            const toA = anchors[seg.to];
            const baseEl = baselineRefs.current[i];
            const activeEl = activeRefs.current[i];

            if (!fromA || !toA) {
                if (baseEl) baseEl.style.display = 'none';
                if (activeEl) activeEl.style.display = 'none';
                continue;
            }

            if (baseEl) {
                const showBaseline =
                    i === 0 ||
                    segmentIsWithinRevealRange(tipY, fromA, toA, BASELINE_REVEAL_AHEAD);
                baseEl.style.display = showBaseline ? '' : 'none';
            }

            if (activeEl) {
                let show = canDrawSegment(i, tipY, anchors, bubbles, runtime);

                // don't animate a future segment until tip reached its Y,
                // except index 0 which can start immediately.
                if (show && i !== 0 && tipY < Math.min(fromA.y, toA.y)) show = false;

                const segLen = dist(fromA, toA);
                let finalProg = 0;
                if (show && segLen > 0) {
                    finalProg = clampProgressByTip(
                        getSegmentLogicalProgress(i, tipY, anchors, bubbles),
                        fromA,
                        toA,
                        tipY
                    );
                }
                if (finalProg <= 0) show = false;

                activeEl.style.display = show ? '' : 'none';
                if (show) {
                    activeEl.setAttribute('stroke-dasharray', String(segLen));
                    activeEl.setAttribute('stroke-dashoffset', String(segLen * (1 - finalProg)));
                }
            }
        }

        // Bottom tail (geometry captured at render — see tailGeomRef)
        const tg = tailGeomRef.current;
        const tailBaseEl = tailBaselineRef.current;
        const tailActiveEl = tailActiveRef.current;
        if (tg) {
            const tailVisible = segmentIsWithinRevealRange(
                tipY,
                tg.tailFrom,
                tg.tailTo,
                BASELINE_REVEAL_AHEAD
            );
            if (tailBaseEl) tailBaseEl.style.display = tailVisible ? '' : 'none';

            const lastSegIndex = linePathConfig.length - 1;
            const lastDone =
                lastSegIndex >= 0 &&
                getSegmentLogicalProgress(lastSegIndex, tipY, anchors, bubbles) >= 0.999;

            const tailAnimatedVisible = tailVisible && lastDone;
            if (tailActiveEl) {
                tailActiveEl.style.display = tailAnimatedVisible ? '' : 'none';
                if (tailAnimatedVisible) {
                    const totalTailY = tg.tailTo.y - tg.tailFrom.y;
                    const rawTailProg =
                        totalTailY > 0 ? clamp((tipY - tg.tailFrom.y) / totalTailY, 0, 1) : 1;
                    const tailProg = clampProgressByTip(rawTailProg, tg.tailFrom, tg.tailTo, tipY);
                    const tailLen = dist(tg.tailFrom, tg.tailTo);
                    tailActiveEl.setAttribute('stroke-dasharray', String(tailLen));
                    tailActiveEl.setAttribute('stroke-dashoffset', String(tailLen * (1 - tailProg)));
                }
            }
        } else {
            if (tailBaseEl) tailBaseEl.style.display = 'none';
            if (tailActiveEl) tailActiveEl.style.display = 'none';
        }
    }, []);

    // ---- SCROLL + RAF LOOP (bubble slowdown + stepped-mouse glide) ----
    // Trackpad deltas apply instantly (native feel preserved). Stepped-mouse
    // notches accumulate into targetScrollRef and the rAF glides the page there;
    // the tip always derives from the LIVE position, so page + line move as one.
    useEffect(() => {
        let rafId: number;

        // module-scope tip mapping (shared with computeBubbles' auto-budget)
        const computeViewportPos = (pageY: number) =>
            viewportPosAt(pageY, window.innerHeight, document.documentElement.scrollHeight);

        const handleWheel = (e: WheelEvent) => {
            // Yield to any full-screen overlay: while a scroll lock is active (see
            // useScrollLock) we do NOT hijack the wheel, so the overlay scrolls natively.
            // This replaces the old per-modal stopPropagation guards — new overlays get
            // correct scrolling for free just by locking.
            if (document.documentElement.hasAttribute('data-scroll-locked')) return;

            // Chrome delivers NON-cancelable wheel events during aggressive
            // gestures (the compositor has already committed a native scroll;
            // preventDefault is silently ignored). Applying our scrollTo on top
            // of that incoming native step moved the page TWICE per notch — felt
            // as a jerk/lag impulse exactly on sharp flicks. Skip those events:
            // the native step lands, handleScroll adopts it into pageScrollRef,
            // and the next cancelable event resumes control.
            if (!e.cancelable) return;

            e.preventDefault();

            const vh = window.innerHeight;
            const docH = document.documentElement.scrollHeight;
            const maxScroll = docH - vh;

            // Normalize the delta to PIXELS: Firefox reports wheel deltas in
            // LINES (deltaMode 1, ~3 per notch) — used raw, scrolling there was
            // near-frozen. 40px/line ≈ one Chrome notch (120px) per FF notch.
            let rawDelta = e.deltaY;
            if (e.deltaMode === 1) rawDelta *= 40;
            else if (e.deltaMode === 2) rawDelta *= vh;

            // clamp delta a bit so we don't jump crazy amounts
            const delta = clamp(rawDelta, -150, 150);

            // Device detection. Trackpads stream fractional / small deltas at
            // high rate; notched mice fire integer ~100/120px quanta. Anything
            // trackpad-like latches "instant mode" for a moment so a stray
            // integer delta mid-gesture can't make a trackpad feel floaty.
            const now = performance.now();
            const trackpadLike =
                e.deltaMode === 0 &&
                (!Number.isInteger(e.deltaY) || Math.abs(rawDelta) < TRACKPAD_DELTA_MAX);
            if (trackpadLike) trackpadTsRef.current = now;
            const glide = !trackpadLike && now - trackpadTsRef.current > TRACKPAD_LATCH_MS;

            // Advance the target through the bubble field PIECEWISE: the slow
            // factor is re-sampled every few px of travel, so one big delta can
            // no longer punch across a slow-zone boundary at full speed (the old
            // single-sample version created a visible speed step at crossings).
            const CHUNK = 12;
            let remaining = delta * WHEEL_SPEED;
            let page = targetScrollRef.current;
            let guard = 64;
            while (Math.abs(remaining) > 0.01 && guard-- > 0) {
                const step = clamp(remaining, -CHUNK, CHUNK);
                const tip = page + vh * computeViewportPos(page);
                const mult = getBubbleRuntimeState(tip, bubblesRef.current).scrollMult;
                page = clamp(page + step * mult, 0, maxScroll);
                remaining -= step;
                if (page === 0 || page === maxScroll) break;
            }
            targetScrollRef.current = page;

            // Trackpad: apply instantly — its native inertia IS the smoothing.
            // Stepped mouse: leave the move to the rAF glide below.
            if (!glide) {
                pageScrollRef.current = page;
                window.scrollTo(0, page);
            }
        };

        const handleScroll = () => {
            // While the collaborations rail is armed (data-rail-hijack), NO
            // outside scroll may move the page: Chrome can deliver non-cancelable
            // wheel events during aggressive gestures (preventDefault is ignored,
            // one native step slips through) — snap straight back instead.
            if (document.documentElement.hasAttribute('data-rail-hijack')) {
                if (Math.abs((window.scrollY || 0) - pageScrollRef.current) >= 1) {
                    window.scrollTo(0, pageScrollRef.current);
                }
                return;
            }
            // Adopt any EXTERNAL movement (scrollbar, keyboard, a native wheel
            // step that slipped through) as the new truth for BOTH the position
            // and the glide target — otherwise a leftover target would fight the
            // user's scrollbar drag. Our own scrollTo reads back equal (within
            // sub-px browser quantization), so the tolerance skips it and keeps
            // our fractional precision. The old consumed-once flag desynced when
            // the browser COALESCED our scroll event with a native one: the next
            // wheel tick teleported the page back onto the stale track — a jerk.
            const current = window.scrollY || window.pageYOffset || 0;
            if (Math.abs(current - pageScrollRef.current) > 2) {
                pageScrollRef.current = current;
                targetScrollRef.current = current;
            }
        };

        let lastDrawnTip = -1;
        let lastRafTs = -1;
        const reduceMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

        const raf = (ts: number) => {
            const dt = lastRafTs < 0 ? 16.7 : Math.min(ts - lastRafTs, 100);
            lastRafTs = ts;

            // ---- glide toward the wheel target (stepped mice only — trackpads
            // keep page === target by applying instantly in the handler) ----
            if (
                document.documentElement.hasAttribute('data-scroll-locked') ||
                document.documentElement.hasAttribute('data-rail-hijack')
            ) {
                // page is locked: drop any residual glide so it can't resume
                // moving the page after the lock lifts
                targetScrollRef.current = pageScrollRef.current;
            } else {
                const diff = targetScrollRef.current - pageScrollRef.current;
                if (Math.abs(diff) > 0.05) {
                    // exponential approach, time-based so the feel is framerate-
                    // independent; reduced-motion users get the instant step
                    const alpha = reduceMotionMq.matches
                        ? 1
                        : 1 - Math.exp(-dt / WHEEL_SMOOTH_TAU_MS);
                    let next = pageScrollRef.current + diff * alpha;
                    if (Math.abs(targetScrollRef.current - next) < 0.5) {
                        next = targetScrollRef.current;
                    }
                    pageScrollRef.current = next;
                    window.scrollTo(0, next);
                }
            }

            const pageY = pageScrollRef.current;
            const vh = window.innerHeight;

            const vpPosNow = computeViewportPos(pageY);
            const tipNow = pageY + vh * vpPosNow;

            // Draw ONLY when the tip actually moved (or a rebuild queued a redraw)
            // so an idle page costs nothing. rAF runs pre-paint, so the imperative
            // writes land in the SAME paint as the scroll that moved the page.
            if (Math.abs(tipNow - lastDrawnTip) >= 0.1 || needsRedrawRef.current) {
                lastDrawnTip = tipNow;
                needsRedrawRef.current = false;
                tipYRef.current = tipNow;

                // Expose tip for other sections (like the tunnel)
                window.progressTipY = tipNow;

                drawFrame();
            }

            rafId = requestAnimationFrame(raf);
        };

        // init scroll refs
        const initial = window.scrollY || window.pageYOffset || 0;
        pageScrollRef.current = initial;
        targetScrollRef.current = initial;

        window.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('scroll', handleScroll, { passive: true });
        rafId = requestAnimationFrame(raf);

        return () => {
            window.removeEventListener('wheel', handleWheel);
            window.removeEventListener('scroll', handleScroll);
            cancelAnimationFrame(rafId);
        };
    }, [drawFrame]);

    // Re-sync the imperative strokes with the freshly-committed DOM before paint,
    // on mount and after every rebuild re-render (paths mount display:none, so
    // without this the whole line would flash invisible for a frame).
    useIsomorphicLayoutEffect(() => {
        drawFrame();
    });

    // grab anchors from window
    const anchors: AnchorsMap | undefined =
        typeof window !== 'undefined' ? window.lineAnchors : undefined;

    if (!anchors) {
        return null;
    }

    // --- INTRO STUB ---
    let introFrom: AnchorPoint | null = null;
    let introTo: AnchorPoint | null = null;
    if (linePathConfig.length > 0) {
        const firstCfg = linePathConfig[0];
        const firstA = anchors[firstCfg.from];
        if (firstA) {
            introFrom = { x: firstA.x, y: 0 };
            introTo = { x: firstA.x, y: firstA.y };
        }
    }

    // --- Bottom tail ---
    const { tailFrom, tailTo } = getLastAnchorAndBottomTail(anchors);
    // Stash for drawFrame (idempotent derived data — safe to set during render):
    // the per-frame draw must not re-read document.scrollHeight itself.
    tailGeomRef.current = tailFrom && tailTo ? { tailFrom, tailTo } : null;

    // --- Portal fades ---
    // At each designed gap in the journey (the tunnel portals) the line must
    // never show its rounded cap — that "pencil end" kills the going-through-
    // the-tunnel illusion. Instead the last ~14px of the segment ENTERING a
    // portal dissolve to transparent inside the mouth, and the first ~14px of
    // the segment EMERGING below fade back in. Gaps are detected generically:
    // consecutive config segments whose to/from anchors differ.
    const PORTAL_FADE = 14;
    const portalFades = new Map<number, { x: number; y: number; dir: 'out' | 'in' }>();
    for (let i = 0; i < linePathConfig.length - 1; i++) {
        const seg = linePathConfig[i];
        const next = linePathConfig[i + 1];
        if (seg.to === next.from) continue;
        const endA = anchors[seg.to];
        const startA = anchors[next.from];
        if (endA) portalFades.set(i, { x: endA.x, y: endA.y, dir: 'out' });
        if (startA) portalFades.set(i + 1, { x: startA.x, y: startA.y, dir: 'in' });
    }
    const segStroke = (i: number, base: 'static' | 'active', color: string) =>
        portalFades.has(i) ? `url(#portal-fade-${base}-${i})` : color;

    // All tip-dependent math (baseline reveal, active dash, tail, intro stub)
    // now lives in drawFrame — the render below only mounts the path elements
    // (hidden) with their static geometry and lets drawFrame drive them.

    return (
        <svg
            className="absolute top-0 left-0 w-full pointer-events-none"
            style={{
                // 100% of the (position:relative) body — NOT an explicit px
                // scrollHeight. The px version was self-referential: after the
                // viewport shrank and content got shorter, the too-tall SVG itself
                // held document.scrollHeight at the old value (a ratchet), so the
                // baseline/tail kept drawing far past the footer's end and the page
                // scrolled into empty space until a hard reload.
                height: '100%',
                zIndex: 50,
            }}
        >
            {/* Portal-fade gradients (userSpace so they pin to the anchor coords) */}
            <defs>
                {[...portalFades.entries()].map(([segIdx, f]) => {
                    const y1 = f.dir === 'out' ? f.y - PORTAL_FADE : f.y;
                    const y2 = f.dir === 'out' ? f.y : f.y + PORTAL_FADE;
                    const [o1, o2] = f.dir === 'out' ? [1, 0] : [0, 1];
                    return (
                        <Fragment key={`pf-${segIdx}`}>
                            <linearGradient
                                id={`portal-fade-static-${segIdx}`}
                                gradientUnits="userSpaceOnUse"
                                x1={f.x} y1={y1} x2={f.x} y2={y2}
                            >
                                <stop offset="0" stopColor={STATIC_LINE_COLOR} stopOpacity={o1} />
                                <stop offset="1" stopColor={STATIC_LINE_COLOR} stopOpacity={o2} />
                            </linearGradient>
                            <linearGradient
                                id={`portal-fade-active-${segIdx}`}
                                gradientUnits="userSpaceOnUse"
                                x1={f.x} y1={y1} x2={f.x} y2={y2}
                            >
                                <stop offset="0" stopColor={ACTIVE_LINE_COLOR} stopOpacity={o1} />
                                <stop offset="1" stopColor={ACTIVE_LINE_COLOR} stopOpacity={o2} />
                            </linearGradient>
                        </Fragment>
                    );
                })}
            </defs>

            {/* 1. Intro stub baseline */}
            {introFrom && introTo && (
                <path
                    d={`M ${introFrom.x} ${introFrom.y} L ${introTo.x} ${introTo.y}`}
                    fill="none"
                    stroke={STATIC_LINE_COLOR}
                    strokeWidth={STATIC_LINE_WIDTH}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
            )}

            {/* 2. Real segments baseline — all mounted (hidden); drawFrame reveals
                them per frame without any React re-render */}
            {linePathConfig.map((seg, i) => {
                const fromA = anchors[seg.from];
                const toA = anchors[seg.to];
                if (!fromA || !toA) return null;

                return (
                    <path
                        key={`baseline-${i}`}
                        ref={(el) => { baselineRefs.current[i] = el; }}
                        d={`M ${fromA.x} ${fromA.y} L ${toA.x} ${toA.y}`}
                        style={{ display: 'none' }}
                        fill="none"
                        stroke={segStroke(i, 'static', STATIC_LINE_COLOR)}
                        strokeWidth={STATIC_LINE_WIDTH}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                    />
                );
            })}

            {/* 3. Tail baseline */}
            {tailFrom && tailTo && (
                <path
                    ref={tailBaselineRef}
                    d={`M ${tailFrom.x} ${tailFrom.y} L ${tailTo.x} ${tailTo.y}`}
                    style={{ display: 'none' }}
                    fill="none"
                    stroke={STATIC_LINE_COLOR}
                    strokeWidth={STATIC_LINE_WIDTH}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
            )}

            {/* 4. Intro stub active (dash driven per frame by drawFrame) */}
            {introFrom && introTo && (
                <path
                    ref={introActiveRef}
                    d={`M ${introFrom.x} ${introFrom.y} L ${introTo.x} ${introTo.y}`}
                    style={{ display: 'none' }}
                    fill="none"
                    stroke={ACTIVE_LINE_COLOR}
                    strokeWidth={ACTIVE_LINE_WIDTH}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
            )}

            {/* 5. Real segments active — all mounted (hidden); drawFrame gates
                visibility and writes the dash reveal per frame */}
            {linePathConfig.map((seg, index) => {
                const fromA = anchors[seg.from];
                const toA = anchors[seg.to];
                if (!fromA || !toA) return null;

                return (
                    <path
                        key={`active-${index}`}
                        ref={(el) => { activeRefs.current[index] = el; }}
                        d={`M ${fromA.x} ${fromA.y} L ${toA.x} ${toA.y}`}
                        style={{ display: 'none' }}
                        fill="none"
                        stroke={segStroke(index, 'active', ACTIVE_LINE_COLOR)}
                        strokeWidth={ACTIVE_LINE_WIDTH}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                    />
                );
            })}

            {/* 6. Tail active */}
            {tailFrom && tailTo && (
                <path
                    ref={tailActiveRef}
                    d={`M ${tailFrom.x} ${tailFrom.y} L ${tailTo.x} ${tailTo.y}`}
                    style={{ display: 'none' }}
                    fill="none"
                    stroke={ACTIVE_LINE_COLOR}
                    strokeWidth={ACTIVE_LINE_WIDTH}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
            )}
        </svg>
    );
}