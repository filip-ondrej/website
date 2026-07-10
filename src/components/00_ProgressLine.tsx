'use client';

import { useEffect, useState, useRef, useCallback, Fragment } from 'react';
import { generateDynamicPath } from '@/lib/00_generateDynamicPath';
import { linePathConfig } from '@/data/00_linePathConfig';

// ====== VISUAL CONFIG ======
const STATIC_LINE_COLOR = 'rgba(47,47,49)'; // faint baseline
const ACTIVE_LINE_COLOR = 'rgb(255,255,255)';       // animated stroke
const STATIC_LINE_WIDTH = 2;
const ACTIVE_LINE_WIDTH = 4;

// how far ahead (in px) we reveal the gray baseline
const BASELINE_REVEAL_AHEAD = 1000;

// ====== TYPES ======
type AnchorPoint = { x: number; y: number };
type AnchorsMap = Record<string, AnchorPoint>;

type Bubble = {
    startY: number;
    endY: number;
    horizY: number;
    horizWidth: number;
    dropLen: number;
    bubblePathDistance: number;
    bubbleMult: number;
    horizontalSegIndex: number;
    postVerticalSegIndex: number;
    maxOwnedIndex: number;
};

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

        const bubblePathDistance = horizWidth + dropLen;
        const bubbleMult = bubblePathDistance / dropLen;
        const maxOwnedIndex = Math.max(i, postVerticalSegIndex);

        bubbles.push({
            startY: horizY,
            endY: horizY + dropLen,
            horizY,
            horizWidth,
            dropLen,
            bubblePathDistance,
            bubbleMult,
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
 * Treat horizontal + its drop as one conveyor belt.
 */
function bubblePathProgress(
    bubble: Bubble,
    tipY: number
): { horizProg: number; vertProg: number } {
    const localY = tipY - bubble.startY;
    const verticalDone = clamp(localY, 0, bubble.dropLen);

    const pathCovered =
        (verticalDone / bubble.dropLen) * bubble.bubblePathDistance;

    const { horizWidth, dropLen } = bubble;

    if (pathCovered <= horizWidth || horizWidth === 0) {
        const horizProg =
            horizWidth === 0 ? 1 : clamp(pathCovered / horizWidth, 0, 1);
        return { horizProg, vertProg: 0 };
    } else {
        const afterHoriz = pathCovered - horizWidth;
        const vertProg = clamp(afterHoriz / dropLen, 0, 1);
        return { horizProg: 1, vertProg };
    }
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

    const baseSlow = 1 / bubble.bubbleMult;
    const scrollMult = clamp(baseSlow, 0.02, 1);

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
    const [tipY, setTipY] = useState(0);
    const [runtime, setRuntime] = useState<BubbleRuntimeState>({
        bubble: null,
        isActive: false,
        scrollMult: 1,
    });

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

    const lastTsRef = useRef<number | null>(null);
    const bubblesRef = useRef<Bubble[]>([]);

    // canonical scroll used by wheel handler (with bubble slowdown)
    const pageScrollRef = useRef(0);
    const wheelScrollingRef = useRef(false);

    // ---- LAYOUT SYNC ----
    const rebuildAll = useCallback(() => {
        const newPath = generateDynamicPath();
        setPathData(newPath);

        if (typeof window !== 'undefined' && window.lineAnchors) {
            bubblesRef.current = computeBubbles(window.lineAnchors);
        } else {
            bubblesRef.current = [];
        }
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

    // ---- SCROLL + RAF LOOP (original behavior + bubble slowdown, no smoothing) ----
    useEffect(() => {
        let rafId: number;

        const computeViewportPos = (pageY: number) => {
            const vh = window.innerHeight;
            const docH = document.documentElement.scrollHeight;
            const maxScrollForVP = docH - vh;

            const INTRO = vh * 0.3;
            const OUTRO = vh * 0.3;
            const introEnd = INTRO;
            const normalEnd = maxScrollForVP - OUTRO;

            let vpPosNow = 0;
            if (pageY <= introEnd) {
                vpPosNow = (pageY / introEnd) * 0.3;
            } else if (pageY <= normalEnd) {
                const norm = (pageY - introEnd) / (normalEnd - introEnd);
                vpPosNow = 0.3 + norm * 0.4;
            } else {
                const outro = (pageY - normalEnd) / OUTRO;
                vpPosNow = 0.7 + outro * 0.3;
            }
            return clamp(vpPosNow, 0, 1);
        };

        const handleWheel = (e: WheelEvent) => {
            // Yield to any full-screen overlay: while a scroll lock is active (see
            // useScrollLock) we do NOT hijack the wheel, so the overlay scrolls natively.
            // This replaces the old per-modal stopPropagation guards — new overlays get
            // correct scrolling for free just by locking.
            if (document.documentElement.hasAttribute('data-scroll-locked')) return;

            e.preventDefault();

            const vh = window.innerHeight;
            const docH = document.documentElement.scrollHeight;
            const maxScroll = docH - vh;

            const currPageY = pageScrollRef.current;
            const vpPosNow = computeViewportPos(currPageY);
            const tipBefore = currPageY + vh * vpPosNow;

            const state = getBubbleRuntimeState(tipBefore, bubblesRef.current);
            // Same identity-preserving commit as the rAF loop (a new object per
            // wheel event forced a spine re-render on every wheel tick).
            setRuntime((prev) =>
                prev.bubble === state.bubble &&
                prev.isActive === state.isActive &&
                prev.scrollMult === state.scrollMult
                    ? prev
                    : state
            );

            // clamp delta a bit so we don't jump crazy amounts
            const rawDelta = e.deltaY;
            const delta = clamp(rawDelta, -150, 150);

            let newPage = currPageY + delta * state.scrollMult;
            newPage = clamp(newPage, 0, maxScroll);

            pageScrollRef.current = newPage;
            wheelScrollingRef.current = true;
            window.scrollTo(0, newPage);
        };

        const handleScroll = () => {
            if (wheelScrollingRef.current) {
                wheelScrollingRef.current = false;
                return;
            }
            // While the collaborations rail is armed (data-rail-hijack), NO
            // outside scroll may move the page: Chrome can deliver non-cancelable
            // wheel events during aggressive gestures (preventDefault is ignored,
            // one native step slips through) — snap straight back instead.
            if (document.documentElement.hasAttribute('data-rail-hijack')) {
                window.scrollTo(0, pageScrollRef.current);
                return;
            }
            const current = window.scrollY || window.pageYOffset || 0;
            pageScrollRef.current = current;
        };

        let lastCommittedTip = -1;

        const raf = (ts: number) => {
            if (lastTsRef.current === null) lastTsRef.current = ts;
            lastTsRef.current = ts;

            const pageY = pageScrollRef.current;
            const vh = window.innerHeight;

            const vpPosNow = computeViewportPos(pageY);
            const tipNow = pageY + vh * vpPosNow;

            // Commit state ONLY when the tip actually moved. Without this gate the
            // loop re-rendered the entire spine SVG through React at 60fps even
            // while the page sat idle — in dev mode that alone reads as scroll lag.
            if (Math.abs(tipNow - lastCommittedTip) >= 0.1) {
                lastCommittedTip = tipNow;
                setTipY(tipNow);

                // Expose tip for other sections (like the tunnel)
                window.progressTipY = tipNow;

                const st = getBubbleRuntimeState(tipNow, bubblesRef.current);
                // Keep object identity when nothing changed so React can skip.
                setRuntime((prev) =>
                    prev.bubble === st.bubble &&
                    prev.isActive === st.isActive &&
                    prev.scrollMult === st.scrollMult
                        ? prev
                        : st
                );
            }

            rafId = requestAnimationFrame(raf);
        };

        // init scroll ref
        const initial = window.scrollY || window.pageYOffset || 0;
        pageScrollRef.current = initial;
        lastTsRef.current = null;

        window.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('scroll', handleScroll, { passive: true });
        rafId = requestAnimationFrame(raf);

        return () => {
            window.removeEventListener('wheel', handleWheel);
            window.removeEventListener('scroll', handleScroll);
            cancelAnimationFrame(rafId);
        };
    }, []);

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

    const lastSegIndex = linePathConfig.length - 1;
    function lastSegmentIsDone(): boolean {
        if (lastSegIndex < 0) return false;
        const prog = getSegmentLogicalProgress(
            lastSegIndex,
            tipY,
            anchors,
            bubblesRef.current
        );
        return prog >= 0.999;
    }

    const tailVisible =
        tailFrom &&
        tailTo &&
        segmentIsWithinRevealRange(
            tipY,
            tailFrom,
            tailTo,
            BASELINE_REVEAL_AHEAD
        )
            ? true
            : false;

    const tailAnimatedVisible = tailVisible && lastSegmentIsDone();

    let tailDasharray = 0;
    let tailDashoffset = 0;
    if (tailAnimatedVisible && tailFrom && tailTo) {
        const totalTailY = tailTo.y - tailFrom.y;
        const rawTailProg =
            totalTailY > 0 ? clamp((tipY - tailFrom.y) / totalTailY, 0, 1) : 1;

        const tailProgClamped = clampProgressByTip(
            rawTailProg,
            tailFrom,
            tailTo,
            tipY
        );

        const tailLen = dist(tailFrom, tailTo);
        tailDasharray = tailLen;
        tailDashoffset = tailLen * (1 - tailProgClamped);
    }

    // intro stub animated progress
    let introDasharray = 0;
    let introDashoffset = 0;
    if (introFrom && introTo) {
        const stubLen = dist(introFrom, introTo);

        const stubRawProg =
            introTo.y > introFrom.y
                ? clamp((tipY - introFrom.y) / (introTo.y - introFrom.y), 0, 1)
                : 1;

        const stubProgClamped = clampProgressByTip(
            stubRawProg,
            introFrom,
            introTo,
            tipY
        );

        introDasharray = stubLen;
        introDashoffset = stubLen * (1 - stubProgClamped);
    }

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

            {/* 2. Real segments baseline */}
            {linePathConfig.map((seg, i) => {
                const fromA = anchors[seg.from];
                const toA = anchors[seg.to];
                if (!fromA || !toA) return null;

                let showBaseline = segmentIsWithinRevealRange(
                    tipY,
                    fromA,
                    toA,
                    BASELINE_REVEAL_AHEAD
                );

                if (i === 0) {
                    showBaseline = true;
                }

                if (!showBaseline) return null;

                return (
                    <path
                        key={`baseline-${i}`}
                        d={`M ${fromA.x} ${fromA.y} L ${toA.x} ${toA.y}`}
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
            {tailFrom && tailTo && tailVisible && (
                <path
                    d={`M ${tailFrom.x} ${tailFrom.y} L ${tailTo.x} ${tailTo.y}`}
                    fill="none"
                    stroke={STATIC_LINE_COLOR}
                    strokeWidth={STATIC_LINE_WIDTH}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
            )}

            {/* 4. Intro stub active */}
            {introFrom && introTo && (
                <path
                    d={`M ${introFrom.x} ${introFrom.y} L ${introTo.x} ${introTo.y}`}
                    fill="none"
                    stroke={ACTIVE_LINE_COLOR}
                    strokeWidth={ACTIVE_LINE_WIDTH}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={introDasharray}
                    strokeDashoffset={introDashoffset}
                    vectorEffect="non-scaling-stroke"
                />
            )}

            {/* 5. Real segments active */}
            {linePathConfig.map((seg, index) => {
                const fromA = anchors[seg.from];
                const toA = anchors[seg.to];
                if (!fromA || !toA) return null;

                // gating: segment can't animate if future-locked by bubble
                if (
                    !canDrawSegment(
                        index,
                        tipY,
                        anchors,
                        bubblesRef.current,
                        runtime
                    )
                ) {
                    return null;
                }

                // don't animate a future segment until tip reached its Y,
                // except index 0 which can start immediately.
                if (index !== 0) {
                    const segStartY = Math.min(fromA.y, toA.y);
                    if (tipY < segStartY) return null;
                }

                const rawProg = getSegmentLogicalProgress(
                    index,
                    tipY,
                    anchors,
                    bubblesRef.current
                );

                const finalProg = clampProgressByTip(
                    rawProg,
                    fromA,
                    toA,
                    tipY
                );

                if (finalProg <= 0) {
                    return null;
                }

                const segLen = dist(fromA, toA);
                if (segLen <= 0) return null;

                const dashArray = segLen;
                const dashOffset = segLen * (1 - finalProg);

                return (
                    <path
                        key={`active-${index}`}
                        d={`M ${fromA.x} ${fromA.y} L ${toA.x} ${toA.y}`}
                        fill="none"
                        stroke={segStroke(index, 'active', ACTIVE_LINE_COLOR)}
                        strokeWidth={ACTIVE_LINE_WIDTH}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                        vectorEffect="non-scaling-stroke"
                    />
                );
            })}

            {/* 6. Tail active */}
            {tailFrom && tailTo && tailAnimatedVisible && (
                <path
                    d={`M ${tailFrom.x} ${tailFrom.y} L ${tailTo.x} ${tailTo.y}`}
                    fill="none"
                    stroke={ACTIVE_LINE_COLOR}
                    strokeWidth={ACTIVE_LINE_WIDTH}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={tailDasharray}
                    strokeDashoffset={tailDashoffset}
                    vectorEffect="non-scaling-stroke"
                />
            )}
        </svg>
    );
}