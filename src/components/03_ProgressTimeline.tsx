'use client';

import React from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useTransform, animate } from 'framer-motion';
import { filipRealEvents, chapterLines, impactConfig } from '@/data/graphData';
import AchievementModal, { AchievementData } from './AchievementModal';
import { loadAchievement } from '@/lib/loadAchievement';
import { LineAnchor } from '@/components/00_LineAnchor';

// ==================== TYPES ====================
export type ProgressEvent = {
    year: number;
    month: number;
    level: number;
    impactType: 'None' | 'Lesson' | 'Regional' | 'National' | 'International' | 'World-Class' | 'Exceptional';
    category: string;
    dotSize?: number;
    article?: string;
    significant?: boolean;
};

// ==================== CONSTANTS ====================
const LAYOUT_CONFIG = {
    TOTAL_YEARS: 11,
    BASE_GAP: 2,
    EXPANDED_GAP: 5,
    PAD_TOP: 0,
    PAD_BOTTOM: 40,
    LEVEL_TOP: 6,
    REVEAL_BIAS: 0.10,
    EPS: 0.002,
} as const;

const ANIMATION_CONFIG = {
    DURATION: 460,
    MAX_FPS: 60,
    EASING: (t: number) => 1 - Math.pow(1 - t, 3),
} as const;

const HINT_CONFIG = {
    AUTO_HIDE_DELAY: 5000,
    SHOW_ON_RECLICK_DELAY: 5000,
} as const;

// ==================== UTILITIES ====================
const yearIndex = (year: number) => year - 2016;

function cumulativeWithGaps(widths: readonly number[], gap: number) {
    const out = new Array(widths.length).fill(0);
    let acc = 0;
    for (let i = 0; i < widths.length; i++) {
        out[i] = acc;
        acc += widths[i] + (i < widths.length - 1 ? gap : 0);
    }
    return { positions: out, total: acc };
}

function straightPath(points: { x: number; y: number }[]) {
    if (points.length < 2) return points.length ? `M ${points[0].x},${points[0].y}` : '';
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x},${points[i].y}`;
    return d;
}

function spansForGap(
    TOTAL_YEARS: number,
    baseYearWidth: number,
    expandedFactor: number,
    FIXED_TOTAL_WIDTH: number,
    gap: number
) {
    const sumWidths = FIXED_TOTAL_WIDTH - (TOTAL_YEARS - 1) * gap;
    const big = baseYearWidth * expandedFactor;
    const remaining = sumWidths - big;
    const small = Math.max(30, remaining / (TOTAL_YEARS - 1));
    return { normal: small, big };
}

// ==================== HOOKS ====================
function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
    const [width, setWidth] = React.useState(0);

    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const updateWidth = () => {
            // Measure the CONTENT width (clientWidth includes the wrap's L/R padding).
            // The SVG renders at this content width, so the viewBox must use it too —
            // otherwise the viewBox is ~200px wider than the SVG and xMidYMid "meet"
            // scales the chart down + centers it, leaving empty letterbox bars at the
            // top and bottom of the plot. Subtracting the padding kills the letterbox.
            const cs = getComputedStyle(el);
            const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
            const w = el.clientWidth - padX;
            setWidth(Math.max(0, Math.round(w)));
        };

        // rAF-batch (was a 150ms debounce). The debounce made width land ~150ms after
        // the immediate height/scale updates on resize → a transient frame where the
        // chart's width disagreed with its height/dot-scale. rAF keeps them in lockstep.
        let scheduled = 0;
        const scheduleUpdate = () => {
            cancelAnimationFrame(scheduled);
            scheduled = requestAnimationFrame(updateWidth);
        };

        const rafId = requestAnimationFrame(updateWidth);
        const ro = new ResizeObserver(scheduleUpdate);
        ro.observe(el);

        return () => {
            cancelAnimationFrame(rafId);
            cancelAnimationFrame(scheduled);
            ro.disconnect();
        };
    }, [ref]);

    return width;
}

function useHintVisibility() {
    const [showHint, setShowHint] = React.useState(true);
    const [hasEverInteracted, setHasEverInteracted] = React.useState(false);
    const timerRef = React.useRef<number | null>(null);

    const hideHint = React.useCallback(() => setShowHint(false), []);

    const onInteraction = React.useCallback(() => {
        if (!hasEverInteracted) {
            setHasEverInteracted(true);
            setShowHint(false);
            if (timerRef.current) clearTimeout(timerRef.current);
        }
    }, [hasEverInteracted]);

    const toggleHint = React.useCallback(() => {
        setShowHint(prev => !prev);
    }, []);

    React.useEffect(() => {
        if (!showHint) return;

        const delay = hasEverInteracted ? HINT_CONFIG.SHOW_ON_RECLICK_DELAY : HINT_CONFIG.AUTO_HIDE_DELAY;
        timerRef.current = window.setTimeout(hideHint, delay);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [showHint, hasEverInteracted, hideHint]);

    return { showHint, hasEverInteracted, onInteraction, toggleHint };
}

// Fluid chart metrics — both derive from the fluid root font, so they share ONE
// rAF-batched resize listener (was two separate immediate listeners). Computing and
// committing them together guarantees the dot/type scale and the height never update
// on different frames.
//   • uiScale = rootFont/16 — width-driven scale for SVG interior type + dots. 1 at
//     the 1440 reference (no-op there), scales with the site otherwise.
//   • height  = width-driven (rides uiScale) AND clamped to a fraction of viewport
//     height, so the legend (top) and the bottom of the graph stay visible together
//     on one screen — not just on tall 16:10 displays. On short viewports the vh cap
//     wins and the chart shrinks to fit. Reference = 650 at 1440.
// Updates on the same `resize` signal the spine LineAnchors listen to, so metrics +
// anchors re-measure together and the spine never desyncs. SSR/initial == 1440 values
// (no hydration mismatch).
function useFluidMetrics() {
    const [m, setM] = React.useState({ uiScale: 1, height: 650 });
    React.useEffect(() => {
        let scheduled = 0;
        const compute = () => {
            const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            const uiScale = rootPx / 16;                                     // 1 at 1440; tracks the fluid root
            const base = 650 * uiScale;                                      // width-driven reference height
            const cap = 0.73 * (window.innerHeight || 800);                  // fit legend + graph on one screen
            const height = Math.round(Math.max(380, Math.min(base, cap, 840)));
            setM(prev => (prev.uiScale === uiScale && prev.height === height) ? prev : { uiScale, height });
        };
        const onResize = () => {
            cancelAnimationFrame(scheduled);
            scheduled = requestAnimationFrame(compute);
        };
        compute();
        window.addEventListener('resize', onResize);
        return () => {
            cancelAnimationFrame(scheduled);
            window.removeEventListener('resize', onResize);
        };
    }, []);
    return m;
}

// ==================== STYLES ====================
const styles = `
.tl-wrap {
    position: relative;
    overflow-x: hidden; /* no horizontal scroll */
    overflow-y: visible;
    /* rem so the side padding scales with the fluid engine and stays aligned
       with the LineAnchor spine (also scaled). 6.25rem == 100px at the 1440
       reference, matching the spine's offsetX={100}. */
    padding: 1.25rem 6.25rem;
    box-sizing: border-box;
    min-height: 400px;
    outline: none;
}

@media (max-width: 768px) {
    .tl-wrap {
        padding-left: 1.25rem;
        padding-right: 1.25rem;
    }
}

.tl-rail {
    position: relative;
    margin: 0 auto;
    will-change: width;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 0;
}

.tl-plot { position: relative; }

.tl-legend-inline{
    position: relative;
    top: auto;
    right: auto;
    display: flex;
    align-items: center;
    gap: clamp(8px, 1.5vw, 12px);
    pointer-events: none;
    background: transparent;
    /* Stay one rigid unit on the controls line so the legend never interleaves
       mid-row. When the line gets tight the WHOLE legend drops to its own line
       (see the stacked media query below), where wrapping is re-enabled. */
    flex-wrap: nowrap;
    row-gap: clamp(6px, 1vw, 8px);
}
.tl-legend-title{
    font:600 clamp(9px, 1.2vw, 10px)/1 'Rajdhani','Rajdhani Fallback',monospace;
    letter-spacing:.18em;
    color:rgba(255,255,255,.52);
    text-transform:uppercase;
    margin-right:clamp(4px, 0.8vw, 6px);
}
.tl-legend-item{
    display:inline-flex;
    align-items:center;
    gap:clamp(4px, 0.8vw, 6px);
    font:500 clamp(10px, 1.4vw, 12px)/1 'Rajdhani','Rajdhani Fallback',monospace;
    color:rgba(255,255,255,.85);
}
.tl-legend-dot{
    width:clamp(7px, 1vw, 9px);
    height:clamp(7px, 1vw, 9px);
    border-radius:50%;
    border:1px solid rgba(255,255,255,.25);
}

/* ============ TOGGLE  ============ */
.tl-toggle-wrapper{
  position: relative;
  top: auto;
  left: auto;
  z-index: 1;
  pointer-events:auto;
}
.tl-toggle-container{
  display:flex; 
  align-items:center; 
  gap:clamp(12px, 2vw, 18px); 
  background:transparent; 
  border:none; 
  padding:0; 
  cursor:pointer;
}
.tl-toggle-label-left,
.tl-toggle-label-right{
  font:400 clamp(11px, 1.6vw, 14px)/1 'Rajdhani','Rajdhani Fallback',monospace;
  letter-spacing:.08em; text-transform:uppercase;
  color:rgba(255,255,255,.35);
  transition:color .35s cubic-bezier(.22,1,.36,1), transform .35s cubic-bezier(.22,1,.36,1);
  white-space:nowrap;
}
.tl-toggle-label-left:hover,
.tl-toggle-label-right:hover{ color:rgba(255,255,255,.6); }
.tl-toggle-label-active{ font-weight:700; color:#fff; transform:scale(1.02); }
.tl-toggle-label-active.tl-toggle-label-right{
  color:rgba(255,215,0,1); text-shadow:0 0 12px rgba(255,215,0,.4);
}

.tl-toggle-track{
  --track-w:clamp(40px, 5vw, 46px);
  --track-h:clamp(20px, 2.8vw, 24px);
  --pad:3px;
  --thumb:clamp(13px, 1.8vw, 15px);
  --tx: calc(var(--track-w) - var(--thumb) - var(--pad)*2 - 3px);
  position:relative;
  width:var(--track-w); height:var(--track-h);
  border-radius:999px;
  background:transparent;
  border:1.5px solid rgba(255,255,255,.25);
  transition:border-color .35s cubic-bezier(.22,1,.36,1), box-shadow .35s cubic-bezier(.22,1,.36,1);
  overflow: visible; /* keep the thumb from clipping */
  padding: 2px 0;
}

.tl-toggle-track .tl-toggle-slider{
  --pos: 0px;
}

.tl-toggle-track[data-key-active="true"] .tl-toggle-slider{
  --pos: var(--tx);
}

/* THUMB */
.tl-toggle-slider{
  position:absolute; 
  top: 0;
  bottom: 0;
  left: 3px;
  margin: auto 0;
  width:var(--thumb); height:var(--thumb);
  border-radius:50%;
  background: rgba(255,255,255,.95);
  box-shadow: 0 2px 8px rgba(0,0,0,.15), 0 1px 3px rgba(0,0,0,.1);
  transition: transform 340ms cubic-bezier(.16,1,.3,1), background 340ms cubic-bezier(.16,1,.3,1), box-shadow 340ms cubic-bezier(.16,1,.3,1);
  transform: translateX(var(--pos));
  will-change: transform;
}

/* Gold when Key is active */
.tl-toggle-slider[data-gold="true"]{
  background: linear-gradient(135deg, rgba(255,215,0,1) 0%, rgba(255,190,0,1) 100%);
  box-shadow:
    0 2px 8px rgba(255,215,0,.4),
    0 1px 3px rgba(255,215,0,.3),
    inset 0 1px 2px rgba(255,255,255,.3);
}

/* Track highlight when right side is active */
.tl-toggle-track[data-key-active="true"]{
  border-color:rgba(255,215,0,.5);
  box-shadow:0 0 10px rgba(255,215,0,.15);
}

/* Controls row between line and graph */
.tl-controls-row {
  margin-top: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;  /* everything starts from the left */
  /* Inset from the vertical spine (which runs at the content's left edge after
     the journey mirror) == the 1.25rem gap between the horizontal run and the
     controls' top — so the info button sits equidistant from the line on its
     top AND left. Legend keeps its own right inset (margin-right below). */
  padding-left: 1.25rem;
  gap: 16px;
  /* Wrap instead of overflowing/clipping (tl-wrap has overflow-x:hidden) when
     the toggle + 8-item legend can't share one line at mid widths. A no-op at
     1440 where everything fits on a single line. */
  flex-wrap: wrap;
  row-gap: 12px;
}

/* info button + hint wrapper */
.tl-controls-left {
  position: relative;           /* so .tl-hint can sit under the info button */
  display: flex;
  align-items: flex-start;
}

/* toggle */
.tl-controls-center {
  display: flex;
  align-items: center;
  flex: 0 0 auto;               /* just its own width */
  /* distance from info button: shrinks on narrower viewports, == 32px at 1440
     (2.5vw = 36px at 1440, so clamp pins to the 32px max at/above ~1280) */
  margin-left: clamp(16px, 2.5vw, 32px);
}

/* Impact Scale legend */
.tl-controls-right {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  margin-left: auto;            /* push this group to the right edge */
  /* small inset from the right; shrinks on narrower viewports, == 25px at 1440
     (2vw = 28.8px at 1440, so clamp pins to the 25px max at/above ~1250) */
  margin-right: clamp(0px, 2vw, 25px);
}

/* Deliberate 2-row fallback. The old single row wrapped chaotically at mid widths
   (legend interleaving with / overflowing the toggle). Below this threshold the
   info button + toggle stay on line 1 and the WHOLE legend drops to its own
   full-width line, left-aligned, where it may wrap internally. No-op at/above the
   threshold (incl. 1440). The 1100px point is tunable — bump it up if you still see
   the single line getting tight just above it. */
@media (max-width:1100px){
  .tl-controls-right{
    flex: 1 1 100%;        /* force the legend onto its own line */
    margin-left: 0;        /* override the line-1 right-push so it left-aligns */
    margin-right: 0;
  }
  .tl-legend-inline{
    flex-wrap: wrap;       /* now that it has the full width, let swatches wrap */
  }
}

/* Responsive */
@media (max-width:768px){
  .tl-toggle-track{
    --track-w:42px; --track-h:22px; --thumb:13px; --pad:3px;
    --tx: calc(var(--track-w) - var(--thumb) - var(--pad)*2 - 3px);
  }
  .tl-legend-inline{
    gap:6px;
  }
  .tl-legend-title{
    font-size:8px;
    margin-right:3px;
  }
  .tl-legend-item{
    gap:4px;
    font-size:9px;
  }
  .tl-legend-dot{
    width:6px;
    height:6px;
  }
  .tl-controls-row {
    flex-direction: column;
    align-items: flex-start;
  }
  .tl-controls-center,
  .tl-controls-right {
    justify-content: flex-start;
    flex: 0;
  }
}

/* ============ /TOGGLE ============ */

.tl-path {
    fill: none;
    stroke: #fff;
    stroke-width: 2.5;
}

.tl-tick {
    stroke: rgba(255, 255, 255, 0.18);
    stroke-width: 0.5;
    stroke-dasharray: 3 3;
}

.tl-month-group { opacity: 0; transition: opacity 0.22s cubic-bezier(0.22,1,0.36,1); }

.tl-month-tick {
    stroke: rgba(255, 255, 255, 0.12);
    stroke-width: 0.6;
    stroke-dasharray: 2 2;
}

.tl-month-bottom-tick {
    stroke: rgba(255, 255, 255, 0.28);
    stroke-width: 0.9;
}

.tl-month-label {
    font: 500 0.625rem/1 'Rajdhani', 'Rajdhani Fallback', monospace;
    letter-spacing: 0.05em;
    fill: rgba(255, 255, 255, 0.64);
}

.tl-dot { cursor: pointer; transition: r 360ms cubic-bezier(0.16, 1, 0.3, 1); }
.tl-dot-glow { filter: blur(10px); transition: opacity 420ms cubic-bezier(0.22,1,0.36,1); }

.tl-dot-label {
    font: 600 0.8125rem/1 'Rajdhani', 'Rajdhani Fallback', monospace;
    letter-spacing: 0.06em;
    fill: #fff;
    pointer-events: none;
    transition: font-size 420ms cubic-bezier(0.22,1,0.36,1), opacity 0.3s cubic-bezier(0.23, 1, 0.32, 1);
}

.tl-dot-label-exceptional {
    font: 600 0.8125rem/1 'Rajdhani', 'Rajdhani Fallback', monospace;
    letter-spacing: 0.06em;
    fill: #FFD60A !important;
    filter: drop-shadow(0 0 4px rgba(255, 214, 10, 0.6)) drop-shadow(0 0 8px rgba(255, 214, 10, 0.3));
    pointer-events: none;
    transition: font-size 420ms cubic-bezier(0.22,1,0.36,1), opacity 0.3s cubic-bezier(0.23, 1, 0.32, 1);
}

.tl-dot,
.tl-dot-glow,
.tl-dot-border,
.tl-dot-core,
.tl-dot-exceptional,
.tl-dot-label,
.tl-dot-label-exceptional {
    transition: 
        r 360ms cubic-bezier(0.16, 1, 0.3, 1),
        opacity 0.5s cubic-bezier(0.23, 1, 0.32, 1),
        filter 420ms cubic-bezier(0.22,1,0.36,1);
}

.tl-dot-hidden {
    opacity: 0;
    pointer-events: none;
}

.tl-dot-visible {
    opacity: 1;
}

.tl-year-typo,
.tl-y-axis-caption {
    color: rgba(255,255,255,0.78);
    fill: currentColor;
    font-family: 'Rajdhani', 'Rajdhani Fallback', monospace;
    font-weight: 600;
    font-size: 0.6875rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    transition: font-size 160ms cubic-bezier(0.22,1,0.36,1), fill 160ms cubic-bezier(0.22,1,0.36,1), opacity 160ms cubic-bezier(0.22,1,0.36,1);
}

.tl-level-label {
    fill: rgba(255, 255, 255, 0.72);
    font: 600 0.625rem/1 'Rajdhani', 'Rajdhani Fallback', monospace;
    letter-spacing: .10em;
}

.tl-chapter-line {
    stroke: rgba(255,255,255,0.85);
    stroke-dasharray: 5 5;
    cursor: default;
    transition: opacity 160ms cubic-bezier(0.22,1,0.36,1), stroke-width 160ms cubic-bezier(0.22,1,0.36,1);
}

.tl-chapter-label {
    font: 600 0.75rem/1 'Rajdhani', 'Rajdhani Fallback', monospace;
    letter-spacing: 0.16em;
    fill: rgba(255,255,255,0.92);
    text-anchor: start;
    transition: opacity 160ms cubic-bezier(0.22,1,0.36,1);
}

.tl-chapter-caption {
    font: 500 0.625rem/1 'Rajdhani', 'Rajdhani Fallback', monospace;
    letter-spacing: 0.12em;
    fill: rgba(255,255,255,0.75);
    text-anchor: start;
    transition: opacity 160ms cubic-bezier(0.22,1,0.36,1);
}

.tl-hint {
    position: absolute;
    top: 32px;                  /* directly under the button */
    left: 8px;
    background: rgba(20, 20, 20, 0.96);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 6px;
    padding: 10px 14px;
    font: 500 12px/1.3 'Rajdhani', monospace;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.92);
    z-index: 20;
    pointer-events: none;
    animation: tlHintFadeIn 0.4s ease-out;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    white-space: nowrap;
}

@keyframes tlHintFadeIn {
    from {
        opacity: 0;
        transform: translateY(-4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.tl-info-btn {
    position: absolute;
    top: 0px;
    left: 8px;
    background: rgba(30, 30, 30, 0.9);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.65);
    border-radius: 50%;
    width: 22px;
    height: 22px;
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.22,1,0.36,1);
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    z-index: 16;
    animation: tlInfoPulse 3s ease-in-out infinite;
    font-size: 13px;
    font-weight: 600;
}

.tl-info-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    color: rgba(255, 255, 255, 1);
    border-color: rgba(255, 255, 255, 0.9);
    transform: scale(1.08);
    animation: none;
}

@keyframes tlInfoPulse {
    0%, 100% {
        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.3);
        opacity: 0.85;
    }
    50% {
        box-shadow: 0 0 0 4px rgba(255, 255, 255, 0);
        opacity: 1;
    }
}

.tl-year-lock-hint {
    pointer-events: none;
    animation: tlLockPulse 2.5s ease-in-out infinite;
}

@keyframes tlLockPulse {
    0%, 100% {
        opacity: 0.5;
    }
    50% {
        opacity: 0.95;
    }
}

.tl-teaser-pulse {
    animation: tlTeaserPulse 2s ease-in-out infinite;
}

@keyframes tlTeaserPulse {
    0%, 100% { 
        opacity: 0.3; 
        transform: scale(1); 
    }
    50% { 
        opacity: 0.8; 
        transform: scale(1.15); 
    }
}

@media (max-width: 768px) {
    .tl-hint {
        font-size: 11px;
        padding: 6px 10px;
    }

    .tl-info-btn {
        width: 26px;
        height: 26px;
    }
    
    .tl-legend-title {
        display: none; /* Hide "IMPACT SCALE" text on mobile */
    }
}

@media (max-width: 480px) {
    .tl-toggle-label-left,
    .tl-toggle-label-right {
        font-size: 10px;
    }
    
    .tl-legend-item {
        font-size: 9px;
        gap: 3px;
    }
    
    .tl-legend-dot {
        width: 6px;
        height: 6px;
    }
    
    .tl-info-btn {
        width: 24px;
        height: 24px;
        font-size: 12px;
    }

    /* On phones the expanded year is too narrow (~10px per month slot) for the
       numeric month labels not to overlap; hide just the text (ticks stay).
       No-op at 1440. */
    .tl-month-label {
        display: none;
    }
}

@media (prefers-reduced-motion: reduce) {
    .tl-month-group,
    .tl-dot,
    .tl-dot-glow,
    .tl-year-typo,
    .tl-chapter-label,
    .tl-hint,
    .tl-info-btn,
    .tl-teaser-pulse,
    .tl-year-lock-hint,
    .tl-label-entrance,
    .tl-path { transition: none !important; animation: none !important; }
}

/* Calm, sophisticated fade-in for captions (no movement/scale "pop"). */
@keyframes labelSlideIn {
    from { opacity: 0; }
    to   { opacity: 1; }
}

/* Generic fade-in to whatever the element's own opacity is (used 'backwards' so it
   ramps 0 → the inline opacity). Lets the dot glow fade in instead of popping. */
@keyframes softIn {
    from { opacity: 0; }
}
`;

// Static gradient defs — fully constant (no props/state), so define once at module
// scope. Previously this lived inline in the SVG and was recreated + reconciled on
// every render, including every frame of the year-expansion animation. (Dots reference
// these by their stable string ids via impactConfig.)
const GRAPH_GRADIENTS = (
    <defs>
        <linearGradient id="metallic-purple" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C084FC" stopOpacity="1" />
            <stop offset="40%" stopColor="#9333EA" stopOpacity="1" />
            <stop offset="60%" stopColor="#7A2FB8" stopOpacity="1" />
            <stop offset="100%" stopColor="#581C87" stopOpacity="1" />
        </linearGradient>

        <linearGradient id="metallic-blue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" stopOpacity="1" />
            <stop offset="40%" stopColor="#3B82F6" stopOpacity="1" />
            <stop offset="60%" stopColor="#2563EB" stopOpacity="1" />
            <stop offset="100%" stopColor="#1E40AF" stopOpacity="1" />
        </linearGradient>

        <linearGradient id="metallic-teal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5EEAD4" stopOpacity="1" />
            <stop offset="40%" stopColor="#14B8A6" stopOpacity="1" />
            <stop offset="60%" stopColor="#059669" stopOpacity="1" />
            <stop offset="100%" stopColor="#047857" stopOpacity="1" />
        </linearGradient>

        <linearGradient id="metallic-amber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCD34D" stopOpacity="1" />
            <stop offset="40%" stopColor="#FBBF24" stopOpacity="1" />
            <stop offset="60%" stopColor="#D97706" stopOpacity="1" />
            <stop offset="100%" stopColor="#92400E" stopOpacity="1" />
        </linearGradient>

        <linearGradient id="metallic-red" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCA5A5" stopOpacity="1" />
            <stop offset="40%" stopColor="#EF4444" stopOpacity="1" />
            <stop offset="60%" stopColor="#DC2626" stopOpacity="1" />
            <stop offset="100%" stopColor="#991B1B" stopOpacity="1" />
        </linearGradient>

        <linearGradient id="metallic-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF3C7" stopOpacity="1" />
            <stop offset="25%" stopColor="#FDE047" stopOpacity="1" />
            <stop offset="50%" stopColor="#FFD60A" stopOpacity="1" />
            <stop offset="75%" stopColor="#F59E0B" stopOpacity="1" />
            <stop offset="100%" stopColor="#B45309" stopOpacity="1" />
        </linearGradient>
    </defs>
);

// ==================== CAPTION ITEM ====================
// One placed caption = its leader line + its glassy box. The whole reveal (line draw
// THEN box wipe) is driven by ONE progress value (0→1) under ONE easing, split by
// length: progress [0 … leaderFrac] draws the line, [leaderFrac … 1] wipes the box.
// Because it's a single eased timeline, the reveal front travels dot → along the line →
// across the caption with a CONTINUOUS velocity — the line and box are the same motion,
// not two animations with different speeds.
type CaptionPlacement = {
    key: string; evIdx: number; category: string; isExceptional: boolean; color: string;
    dotX: number; dotY: number; boxX: number; boxY: number; boxW: number; boxH: number;
    baseFontSize: number; leaderD: string; leaderLen: number; goUp: boolean;
};

const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;   // shared by line + wipe so they're one motion

const CaptionItem = React.memo(function CaptionItem({
                                                        p, isHov, someHov, prefersReduced,
                                                    }: {
    p: CaptionPlacement;
    isHov: boolean;
    someHov: boolean;
    prefersReduced: boolean | null;
}) {
    const dim = someHov && !isHov ? 0.28 : 1;             // others fade on hover
    const scale = isHov ? 1.14 : (someHov ? 0.9 : 1);      // hovered grows, others shrink
    const sw = isHov ? 4.5 : (someHov ? 2 : 3);            // hovered thickest; others thinner
    const isExc = p.isExceptional;
    const col = isExc ? '#FFD60A' : p.color;

    // wipe axis + the exact edge the leader touches.
    const horizontal = Math.abs(p.boxX - p.dotX) > 0.5;    // sideways leader -> horizontal wipe
    const anchorRight = horizontal && p.dotX > p.boxX;     // box left of dot -> reveal grows R->L (from box's right edge)
    const anchorBottom = !horizontal && p.boxY <= p.dotY;  // box above dot -> reveal grows up (from box's bottom edge)
    // the exact point where the leader meets the box. Hover-scaling from HERE (not the box
    // centre) keeps the connecting edge pinned, so the line never pokes inside on grow or
    // detaches on shrink.
    const connX = horizontal ? (anchorRight ? p.boxX + p.boxW / 2 : p.boxX - p.boxW / 2) : p.boxX;
    const connY = horizontal ? p.boxY : (anchorBottom ? p.boxY + p.boxH / 2 : p.boxY - p.boxH / 2);
    const wipeDist = horizontal ? p.boxW : p.boxH;

    // ONE shared progress over the whole (leader + wipe) length, single ease -> continuous.
    const total = p.leaderLen + wipeDist;
    const leaderFrac = total > 0 ? p.leaderLen / total : 0.5;
    const progress = useMotionValue(prefersReduced ? 1 : 0);

    React.useEffect(() => {
        if (prefersReduced) { progress.set(1); return; }
        progress.set(0);
        const dur = Math.min(2.3, Math.max(0.95, total / 210));  // slower, premium; still length-proportional
        const controls = animate(progress, 1, { duration: dur, ease: REVEAL_EASE });
        return () => controls.stop();
    }, [progress, prefersReduced, total, p.leaderD]);

    // Leader: classic dash-draw (dasharray=len, dashoffset len->0 over [0, leaderFrac]).
    const dashOffset = useTransform(progress, [0, leaderFrac], [p.leaderLen, 0], { clamp: true });

    // Wipe: the caption renders FULL SIZE and crisp -- NOTHING about the box is scaled
    // (the earlier scale on the content group is what made it inflate/squish "from the
    // sky"). Instead a clipPath rect UNCOVERS the finished box: we grow that rect's real
    // geometry (clipPath children honour x/y/width/height perfectly -- no CSS-transform-on-
    // clip-child flakiness, no attrX leak), driven imperatively off the SAME progress so the
    // reveal runs straight out of the line's end, from the edge the line touches. CM keeps
    // the soft shadow from being shaved at the revealing edge.
    const CM = 10;
    const FX = p.boxX - p.boxW / 2 - CM;
    const FY = p.boxY - p.boxH / 2 - CM;
    const FW = p.boxW + 2 * CM;
    const FH = p.boxH + 2 * CM;
    const clipUid = React.useId().replace(/:/g, '');
    const clipId = `capwipe-${clipUid}-${p.evIdx}`;
    const clipRef = React.useRef<SVGRectElement>(null);
    const glowRef = React.useRef<SVGRectElement>(null);

    React.useEffect(() => {
        const bl = p.boxX - p.boxW / 2, br = p.boxX + p.boxW / 2;
        const bt = p.boxY - p.boxH / 2, bb = p.boxY + p.boxH / 2;
        const GT = 5;   // leading-edge thickness
        const apply = (v: number) => {
            const el = clipRef.current;
            const g = glowRef.current;
            const wipeP = leaderFrac >= 1 ? 1 : Math.min(1, Math.max(0, (v - leaderFrac) / (1 - leaderFrac)));
            if (el) {
                if (horizontal) {
                    const w = FW * wipeP;
                    el.setAttribute('x', String(anchorRight ? FX + FW - w : FX));
                    el.setAttribute('y', String(FY));
                    el.setAttribute('width', String(w));
                    el.setAttribute('height', String(FH));
                } else {
                    const h = FH * wipeP;
                    el.setAttribute('x', String(FX));
                    el.setAttribute('y', String(anchorBottom ? FY + FH - h : FY));
                    el.setAttribute('width', String(FW));
                    el.setAttribute('height', String(h));
                }
            }
            if (g) {
                // luminous leading edge that rides the reveal front, fading in/out at the ends —
                // reads as light sweeping the caption into existence.
                const op = (wipeP <= 0 || wipeP >= 1) ? 0 : 0.9 * Math.min(1, wipeP * 6, (1 - wipeP) * 6);
                g.style.opacity = String(op);
                if (horizontal) {
                    const fx = anchorRight ? br - p.boxW * wipeP : bl + p.boxW * wipeP;
                    g.setAttribute('x', String(fx - GT / 2));
                    g.setAttribute('y', String(bt));
                    g.setAttribute('width', String(GT));
                    g.setAttribute('height', String(p.boxH));
                } else {
                    const fy = anchorBottom ? bb - p.boxH * wipeP : bt + p.boxH * wipeP;
                    g.setAttribute('x', String(bl));
                    g.setAttribute('y', String(fy - GT / 2));
                    g.setAttribute('width', String(p.boxW));
                    g.setAttribute('height', String(GT));
                }
            }
        };
        apply(progress.get());
        const unsub = progress.on('change', apply);
        return () => unsub();
    }, [progress, leaderFrac, horizontal, anchorRight, anchorBottom, FX, FY, FW, FH, p.boxX, p.boxY, p.boxW, p.boxH]);

    return (
        <g>
            {/* leader — dim via a plain <g> (framer manages the path itself, so inline opacity is ignored) */}
            <g style={{ opacity: dim, transition: 'opacity 220ms cubic-bezier(0.16,1,0.3,1)' }}>
                <motion.path
                    d={p.leaderD}
                    fill="none"
                    stroke={p.color}
                    strokeLinecap="butt"
                    strokeLinejoin="round"
                    style={{ strokeDasharray: p.leaderLen, strokeDashoffset: dashOffset, strokeWidth: sw, transition: 'stroke-width 220ms cubic-bezier(0.16,1,0.3,1)' }}
                />
            </g>

            {/* caption — hover scale + dim wrapper; revealed by the clip-rect wipe */}
            <g style={{
                opacity: dim,
                transformBox: 'view-box',
                transformOrigin: `${connX}px ${connY}px`,
                transform: `scale(${scale})`,
                transition: 'opacity 220ms cubic-bezier(0.16,1,0.3,1), transform 220ms cubic-bezier(0.16,1,0.3,1)',
            }}>
                <clipPath id={clipId}>
                    <rect
                        ref={clipRef}
                        x={horizontal ? (anchorRight ? FX + FW : FX) : FX}
                        y={!horizontal ? (anchorBottom ? FY + FH : FY) : FY}
                        width={horizontal ? 0 : FW}
                        height={horizontal ? FH : 0}
                    />
                </clipPath>
                <g clipPath={`url(#${clipId})`}>
                    {isHov && (
                        <rect
                            x={p.boxX - p.boxW / 2 - 3}
                            y={p.boxY - p.boxH / 2 - 3}
                            width={p.boxW + 6}
                            height={p.boxH + 6}
                            rx={7}
                            fill="none"
                            stroke={col}
                            strokeWidth={0.5}
                            opacity={0.4}
                            style={{ filter: 'blur(12px)' }}
                        />
                    )}
                    <rect
                        x={p.boxX - p.boxW / 2}
                        y={p.boxY - p.boxH / 2}
                        width={p.boxW}
                        height={p.boxH}
                        rx={5}
                        fill={isExc
                            ? `rgba(255, 214, 10, ${isHov ? 0.35 : 0.20})`
                            : `${p.color}${isHov ? '42' : '25'}`}
                        stroke={col}
                        strokeWidth={isHov ? 2.5 : 1.5}
                        style={{
                            filter: isExc
                                ? `drop-shadow(0 ${isHov ? '6px' : '2px'} ${isHov ? '24px' : '8px'} rgba(255,214,10,${isHov ? 0.65 : 0.3}))`
                                : `drop-shadow(0 ${isHov ? '6px' : '2px'} ${isHov ? '24px' : '8px'} ${p.color}${isHov ? '66' : '30'})`,
                            transition: 'fill 220ms cubic-bezier(0.22,1,0.36,1), stroke-width 220ms cubic-bezier(0.22,1,0.36,1), filter 220ms cubic-bezier(0.22,1,0.36,1)',
                        }}
                    />
                    <rect
                        x={p.boxX - p.boxW / 2 + 1}
                        y={p.boxY - p.boxH / 2 + 1}
                        width={p.boxW - 2}
                        height={(p.boxH - 2) / 3}
                        rx={4}
                        fill={`rgba(255, 255, 255, ${isHov ? 0.2 : 0.08})`}
                        style={{ transition: 'fill 220ms cubic-bezier(0.22,1,0.36,1)' }}
                    />
                    <text
                        x={p.boxX}
                        y={p.boxY + p.baseFontSize * 0.35}
                        textAnchor="middle"
                        className={isExc ? 'tl-dot-label-exceptional' : 'tl-dot-label'}
                        style={{ fontSize: `${p.baseFontSize}px`, fontWeight: isHov ? 700 : 600 }}
                    >
                        {p.category}
                    </text>
                </g>
                <rect
                    ref={glowRef}
                    x={p.boxX - p.boxW / 2} y={p.boxY - p.boxH / 2} width={0} height={0}
                    rx={3} fill={col} opacity={0}
                    style={{ filter: 'blur(3px)', mixBlendMode: 'screen', pointerEvents: 'none' }}
                />
            </g>
        </g>
    );
});

// One timeline dot (glow + dot + hit area). Memoized so hovering a single dot only
// re-renders that dot and the one being left — not all ~50 every mouse-move. All inputs are
// primitives or stable refs (ev from the module events array; handlers via useCallback), so
// the default shallow compare is correct. During the expand x/y change each frame → it
// re-renders then, as intended; on hover (positions static) only the toggled dots re-render.
const DotItem = React.memo(function DotItem({
                                                ev, evIdx, x, y, baseSize, isHovered, isVisible, inFocusedYear,
                                                isExceptional, isNone, dotColor, legendColor, hitR, onEnter, onLeave, onActivate,
                                            }: {
    ev: ProgressEvent; evIdx: number; x: number; y: number; baseSize: number;
    isHovered: boolean; isVisible: boolean; inFocusedYear: boolean;
    isExceptional: boolean; isNone: boolean; dotColor: string; legendColor: string; hitR: number;
    onEnter: (evIdx: number) => void; onLeave: () => void; onActivate: (ev: ProgressEvent) => void;
}) {
    const hoveredSize = baseSize * 1.5;
    const dotOpacity = isVisible ? 1 : 0;
    const showGlow = !isNone && (isExceptional || isHovered);
    return (
        <g style={{ opacity: dotOpacity, transition: 'opacity 320ms cubic-bezier(0.23, 1, 0.32, 1)' }}>
            {showGlow && (
                <circle
                    cx={x} cy={y} r={hoveredSize + 6}
                    className="tl-dot-glow"
                    style={{
                        fill: legendColor,
                        opacity: isExceptional ? (isHovered ? 0.6 : 0.3) : 0.6,
                        animation: 'softIn 360ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
                    }}
                    pointerEvents="none"
                />
            )}
            {isNone ? (
                <circle
                    cx={x} cy={y} r={isHovered ? hoveredSize : baseSize}
                    fill="#FFFFFF" className="tl-dot"
                    style={{ transition: 'r 360ms cubic-bezier(0.16, 1, 0.3, 1)' }}
                    pointerEvents="none"
                />
            ) : isExceptional ? (
                <circle
                    cx={x} cy={y} r={isHovered ? hoveredSize : baseSize}
                    fill={dotColor} className="tl-dot-exceptional"
                    style={{
                        filter: isHovered
                            ? 'drop-shadow(0 0 6px #FFD60A) drop-shadow(0 0 10px rgba(255,214,10,0.4))'
                            : 'drop-shadow(0 0 3px rgba(255,214,10,0.4))',
                        transition: 'r 360ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    pointerEvents="none"
                />
            ) : (
                <circle
                    cx={x} cy={y} r={isHovered ? hoveredSize : baseSize}
                    fill={dotColor} className="tl-dot"
                    style={{
                        filter: isHovered ? `drop-shadow(0 0 8px ${legendColor})` : 'none',
                        transition: 'r 360ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    pointerEvents="none"
                />
            )}
            <circle
                cx={x} cy={y} r={hitR} fill="transparent"
                style={{ pointerEvents: isVisible ? 'auto' : 'none', cursor: ev.article ? 'pointer' : 'default' }}
                onClick={(e) => { if (!inFocusedYear) return; e.stopPropagation(); onActivate(ev); }}
                onMouseEnter={() => { if (!inFocusedYear) return; onEnter(evIdx); }}
                onMouseLeave={() => { if (!inFocusedYear) return; onLeave(); }}
            />
        </g>
    );
});

// ==================== COMPONENT ====================
type Props = {
    events?: ProgressEvent[];
    height?: number;              // optional FIXED override; omit for the fluid default
    baseYearWidth?: number;
    expandedFactor?: number;
    className?: string;
};

export default function ProgressTimeline({
                                             events = filipRealEvents,
                                             height: heightProp,
                                             baseYearWidth,
                                             expandedFactor = 4.2,
                                             className,
                                         }: Props) {
    const {
        TOTAL_YEARS,
        BASE_GAP,
        EXPANDED_GAP,
        PAD_TOP,
        PAD_BOTTOM,
        LEVEL_TOP,
        REVEAL_BIAS,
        EPS,
    } = LAYOUT_CONFIG;

    // Animated horizontal line Y position
    const HORIZONTAL_LINE_Y = 25;
    const CONTROLS_OFFSET_FROM_LINE = 0;

    const containerRef = React.useRef<HTMLDivElement>(null);
    const widthsRef = React.useRef<Float64Array>(new Float64Array(TOTAL_YEARS));
    const gapRef = React.useRef<number>(BASE_GAP);
    const hoverRAF = React.useRef<number | null>(null);
    const pendingHoverX = React.useRef<number | null>(null);
    const prevActiveRef = React.useRef<number | null>(null);
    const currActiveRef = React.useRef<number | null>(null);

    const containerWidth = useContainerWidth(containerRef);
    const FIXED_TOTAL_WIDTH = Math.max(320, containerWidth);

    // Fluid metrics (one shared rAF-batched listener). `height`: 650 at the 1440
    // reference, capped against short viewports; a `height` prop overrides it. When it
    // settles it changes the document height, which the global body-ResizeObserver in
    // 00_ProgressLine picks up to re-measure the spine — so no section-specific nudge
    // is needed here. `uiScale`: width-driven scale for SVG interior type + dots
    // (no-op at 1440).
    const { uiScale, height: fluidHeight } = useFluidMetrics();
    const height = heightProp ?? fluidHeight;

    const derivedBaseYearWidth = React.useMemo(() => {
        const sum = FIXED_TOTAL_WIDTH - (TOTAL_YEARS - 1) * BASE_GAP;
        return sum / TOTAL_YEARS;
    }, [FIXED_TOTAL_WIDTH, TOTAL_YEARS, BASE_GAP]);

    const effectiveBaseYearWidth = baseYearWidth ?? derivedBaseYearWidth;

    const [modalData, setModalData] = React.useState<AchievementData | null>(null);
    const [isModalOpen, setIsModalOpen] = React.useState(false);

    const [hoverYear, setHoverYear] = React.useState<number>(-1);
    const [activeYear, setActiveYear] = React.useState<number | null>(null);
    // Hovered event is tracked by its unique index in the `events` array (NOT year+month —
    // several events can share the same month, so a year.month key cross-triggered siblings,
    // which is what made the caption/line highlight look random).
    const [hoveredEventIdx, setHoveredEventIdx] = React.useState<number | null>(null);
    const hoverDelayRef = React.useRef<number | null>(null);

    const [animatedWidths, setAnimatedWidths] = React.useState<number[]>(
        () => Array.from({ length: TOTAL_YEARS }, () => effectiveBaseYearWidth)
    );
    const [animatedGap, setAnimatedGap] = React.useState<number>(BASE_GAP);
    const [hasLoaded, setHasLoaded] = React.useState(false);
    const [showTeaser, setShowTeaser] = React.useState(false);
    const TEASER_EVENT_YEAR = 2019;
    const TEASER_EVENT_MONTH = 6;
    const TEASER_EVENT_LEVEL = 4.8;

    const { showHint, onInteraction, toggleHint } = useHintVisibility();

    const focusedYear = activeYear ?? hoverYear;
    const targetGap = focusedYear >= 0 ? EXPANDED_GAP : BASE_GAP;
    const activeIdx = activeYear ?? hoverYear;

    const [showAllEvents, setShowAllEvents] = React.useState(true);

    // Track when the year-expansion animation completes (gates the dot labels).
    const [expansionComplete, setExpansionComplete] = React.useState(false);
    const expansionTimerRef = React.useRef<number | null>(null);

    const handleToggle = React.useCallback(() => {
        setShowAllEvents(prev => !prev);
    }, []);

    // Unmount cleanup: cancel every pending timer/rAF so nothing fires setState after
    // the component is gone (the hover-detection rAF in particular was never cancelled).
    React.useEffect(() => {
        return () => {
            if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current);
            if (hoverRAF.current) cancelAnimationFrame(hoverRAF.current);
            if (expansionTimerRef.current) clearTimeout(expansionTimerRef.current);
        };
    }, []);

    const visibleEvents = React.useMemo(() => {
        if (showAllEvents) return events;
        return events.filter(ev => ev.significant === true || ev.impactType === 'None');
    }, [events, showAllEvents]);

    // Stable identity per event = its index in the original `events` array. `filter`/`sort`
    // keep the same object references, so this Map lets dots, captions and lit-dots all agree
    // on one unique id per event (the hover-matching key), free of same-month collisions.
    const eventIndexMap = React.useMemo(() => {
        const m = new Map<ProgressEvent, number>();
        events.forEach((ev, i) => m.set(ev, i));
        return m;
    }, [events]);

    React.useEffect(() => {
        const timer = setTimeout(() => setHasLoaded(true), 100);
        return () => clearTimeout(timer);
    }, []);

    React.useEffect(() => {
        const showTimer = setTimeout(() => setShowTeaser(true), 2000);
        const hideTimer = setTimeout(() => setShowTeaser(false), 5000);
        return () => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
        };
    }, []);

    React.useEffect(() => {
        prevActiveRef.current = currActiveRef.current;
        currActiveRef.current = (activeIdx !== null && activeIdx >= 0) ? activeIdx : null;
        if (activeIdx !== null && activeIdx >= 0) {
            onInteraction();
        }
    }, [activeIdx, onInteraction]);

    React.useEffect(() => {
        if (focusedYear >= 0) {
            setExpansionComplete(false);
            if (expansionTimerRef.current) clearTimeout(expansionTimerRef.current);

            // Wait until the column has fully settled (expand is ~460ms) before drawing
            // the caption leaders — they read off the final dot positions, so they must
            // not start while the dots are still sliding.
            expansionTimerRef.current = window.setTimeout(() => {
                setExpansionComplete(true);
            }, 480);
        } else {
            setExpansionComplete(false);
            if (expansionTimerRef.current) {
                clearTimeout(expansionTimerRef.current);
                expansionTimerRef.current = null;
            }
        }

        return () => {
            if (expansionTimerRef.current) {
                clearTimeout(expansionTimerRef.current);
            }
        };
    }, [focusedYear]);

    const yOf = React.useCallback((level: number) => {
        const innerH = height - PAD_TOP - PAD_BOTTOM;
        const clamped = Math.max(0, Math.min(LEVEL_TOP, level));
        return PAD_TOP + (LEVEL_TOP - clamped) / LEVEL_TOP * innerH;
    }, [height, PAD_TOP, PAD_BOTTOM, LEVEL_TOP]);

    const yTop6 = yOf(6);
    const yTop5 = yOf(5);
    const yBottom = yOf(0);

    React.useEffect(() => {
        const next = new Float64Array(TOTAL_YEARS).fill(effectiveBaseYearWidth);
        widthsRef.current = next;
        setAnimatedWidths(Array.from(next));
    }, [effectiveBaseYearWidth, TOTAL_YEARS]);

    const targetWidths = React.useMemo(() => {
        const sum = FIXED_TOTAL_WIDTH - (TOTAL_YEARS - 1) * targetGap;
        const arr = new Array(TOTAL_YEARS).fill(0);
        if (focusedYear >= 0 && focusedYear < TOTAL_YEARS) {
            const big = effectiveBaseYearWidth * expandedFactor;
            const remaining = sum - big;
            const small = Math.max(30, remaining / (TOTAL_YEARS - 1));
            arr.fill(small);
            arr[focusedYear] = big;
        } else {
            const normal = sum / TOTAL_YEARS;
            arr.fill(normal);
        }
        return arr;
    }, [FIXED_TOTAL_WIDTH, targetGap, focusedYear, effectiveBaseYearWidth, expandedFactor, TOTAL_YEARS]);

    React.useEffect(() => {
        const { DURATION, MAX_FPS, EASING } = ANIMATION_CONFIG;
        const frameBudget = 1000 / MAX_FPS;
        let raf = 0, start: number | null = null, lastCommit = 0;

        const targetW = new Float64Array(TOTAL_YEARS);
        for (let i = 0; i < TOTAL_YEARS; i++) targetW[i] = targetWidths[i];
        const targetG = targetGap;
        const initialW = widthsRef.current.slice(0);
        const initialG = gapRef.current;

        const tick = (now: number) => {
            if (start === null) start = now;
            const t = Math.min(1, (now - start) / DURATION);
            const ease = EASING(t);
            let changed = false;

            for (let i = 0; i < TOTAL_YEARS; i++) {
                const v = initialW[i] + (targetW[i] - initialW[i]) * ease;
                if (Math.abs(v - widthsRef.current[i]) > 0.25) {
                    widthsRef.current[i] = v;
                    changed = true;
                }
            }

            const newG = initialG + (targetG - initialG) * ease;
            if (Math.abs(newG - gapRef.current) > 0.1) {
                gapRef.current = newG;
                changed = true;
            }

            if (changed && (now - lastCommit) >= frameBudget) {
                lastCommit = now;
                setAnimatedWidths(Array.from(widthsRef.current));
                setAnimatedGap(gapRef.current);
            }

            if (t < 1) {
                raf = requestAnimationFrame(tick);
            } else {
                widthsRef.current.set(targetW);
                gapRef.current = targetG;
                setAnimatedWidths(Array.from(targetW));
                setAnimatedGap(targetG);
            }
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [targetWidths, targetGap, TOTAL_YEARS]);

    const { positions: xAtYear } = React.useMemo(
        () => cumulativeWithGaps(animatedWidths, animatedGap),
        [animatedWidths, animatedGap]
    );

    const yearBounds = React.useMemo(() => {
        const arr: Array<{ left: number; right: number }> = [];
        for (let y = 0; y < TOTAL_YEARS; y++) {
            const left = xAtYear[y];
            const right = (y < TOTAL_YEARS - 1) ? xAtYear[y + 1] : xAtYear[y] + animatedWidths[y];
            arr.push({ left, right });
        }
        return arr;
    }, [xAtYear, animatedWidths, TOTAL_YEARS]);

    const handleMouseMove = React.useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (activeYear !== null && activeYear >= 0) return;
        const svg = e.currentTarget;

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

        const minHoverY = 25;
        if (svgP.y < minHoverY) {
            setHoverYear(-1);
            return;
        }

        pendingHoverX.current = svgP.x;

        if (hoverRAF.current == null) {
            hoverRAF.current = requestAnimationFrame(() => {
                if (pendingHoverX.current == null) {
                    hoverRAF.current = null;
                    return;
                }
                const x = pendingHoverX.current;
                pendingHoverX.current = null;
                for (let y = 0; y < yearBounds.length; y++) {
                    const { left, right } = yearBounds[y];
                    if (x >= left && x < right) {
                        setHoverYear(y);
                        hoverRAF.current = null;
                        return;
                    }
                }
                setHoverYear(-1);
                hoverRAF.current = null;
            });
        }
    }, [activeYear, yearBounds]);

    const handleMouseLeave = React.useCallback(() => {
        if (hoverRAF.current) cancelAnimationFrame(hoverRAF.current);
        hoverRAF.current = null;
        if (activeYear === null) setHoverYear(-1);
    }, [activeYear]);

    const handleSvgClick = React.useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        const svg = e.currentTarget;

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
        const x = svgP.x;

        for (let y = 0; y < yearBounds.length; y++) {
            const { left, right } = yearBounds[y];
            if (x >= left && x < right) {
                setActiveYear(prev => (prev === y ? null : y));
                return;
            }
        }
    }, [yearBounds]);

    // Stable handlers for DotItem so the memoized dots don't see new function refs each render.
    const handleDotActivate = React.useCallback(async (ev: ProgressEvent) => {
        if (ev.article) {
            const data = await loadAchievement(ev.article);
            setModalData(data);
            setIsModalOpen(true);
        }
        setActiveYear(null);
    }, []);
    const handleDotEnter = React.useCallback((evIdx: number) => {
        if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current);
        hoverDelayRef.current = window.setTimeout(() => setHoveredEventIdx(evIdx), 150);
    }, []);
    const handleDotLeave = React.useCallback(() => {
        if (hoverDelayRef.current) {
            clearTimeout(hoverDelayRef.current);
            hoverDelayRef.current = null;
        }
        setHoveredEventIdx(null);
    }, []);

    const {
        normal,
        big
    } = spansForGap(TOTAL_YEARS, effectiveBaseYearWidth, expandedFactor, FIXED_TOTAL_WIDTH, targetGap);
    const rawRevealByYear = animatedWidths.map(w => {
        const denom = Math.max(1e-3, big - normal);
        return Math.max(0, Math.min(1, (w - normal) / denom));
    });

    const maxRevealIdx = React.useMemo(() => {
        let max = -1, idx = -1;
        for (let i = 0; i < rawRevealByYear.length; i++) {
            if (rawRevealByYear[i] > max) {
                max = rawRevealByYear[i];
                idx = i;
            }
        }
        return max > EPS ? idx : -1;
    }, [rawRevealByYear, EPS]);

    const eventsByYear = React.useMemo(() => {
        const m = new Map<number, ProgressEvent[]>();
        for (const ev of events) {
            const yi = yearIndex(ev.year);
            if (yi < 0 || yi >= TOTAL_YEARS) continue;
            if (!m.has(yi)) m.set(yi, []);
            m.get(yi)!.push(ev);
        }
        for (const arr of m.values()) arr.sort((a, b) => a.month - b.month);
        return m;
    }, [events, TOTAL_YEARS]);

    const points = React.useMemo(() => {
        const pts: { x: number; y: number }[] = [];
        for (let y = 0; y < TOTAL_YEARS; y++) {
            const evs = eventsByYear.get(y) || [];
            if (evs.length === 0) continue;
            const yearStart = xAtYear[y];
            const yearEnd = y < TOTAL_YEARS - 1 ? xAtYear[y + 1] : xAtYear[y] + animatedWidths[y];
            const span = yearEnd - yearStart;
            for (const ev of evs) {
                const t = (ev.month - 1) / 12;
                const x = yearStart + t * span;
                pts.push({ x, y: yOf(ev.level) });
            }
        }
        return pts;
    }, [eventsByYear, xAtYear, animatedWidths, yOf, TOTAL_YEARS]);

    const pathD = React.useMemo(() => straightPath(points), [points]);

    const pathLength = React.useMemo(() => {
        if (points.length < 2) return 2000;
        let total = 0;
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            total += Math.sqrt(dx * dx + dy * dy);
        }
        return total;
    }, [points]);

    const uid = React.useId();

    const focusHighlight = React.useMemo(() => {
        if (focusedYear < 0) return null;

        const left = xAtYear[focusedYear];
        const right = (focusedYear < TOTAL_YEARS - 1)
            ? xAtYear[focusedYear + 1]
            : xAtYear[focusedYear] + animatedWidths[focusedYear];
        const width = right - left;

        const glowXId = `glowX-${uid}`;
        const fadeYId = `fadeY-${uid}`;
        const maskId = `fadeMask-${uid}`;

        return (
            <g pointerEvents="none">
                <defs>
                    <linearGradient id={glowXId} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#fff" stopOpacity="0" />
                        <stop offset="18%" stopColor="#fff" stopOpacity="0.06" />
                        <stop offset="50%" stopColor="#fff" stopOpacity="0.12" />
                        <stop offset="82%" stopColor="#fff" stopOpacity="0.06" />
                        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                    </linearGradient>

                    <linearGradient
                        id={fadeYId}
                        x1="0" y1="0" x2="0" y2="1"
                    >
                        <stop offset="0%" stopColor="#fff" stopOpacity="0" />
                        <stop offset="6%" stopColor="#fff" stopOpacity="1" />
                        <stop offset="94%" stopColor="#fff" stopOpacity="1" />
                        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                    </linearGradient>

                    <mask id={maskId}>
                        <rect x={0} y={0} width={FIXED_TOTAL_WIDTH} height={height} fill={`url(#${fadeYId})`} />
                    </mask>
                </defs>

                <rect
                    x={left}
                    y={0}
                    width={width}
                    height={height}
                    fill={`url(#${glowXId})`}
                    mask={`url(#${maskId})`}
                    style={{ mixBlendMode: 'screen' }}
                />
            </g>
        );
    }, [focusedYear, xAtYear, animatedWidths, FIXED_TOTAL_WIDTH, height, uid, TOTAL_YEARS]);

    const legend = (
        <div className="tl-legend-inline" aria-hidden="true">
            <span className="tl-legend-title">IMPACT SCALE</span>
            {impactConfig.types.map((type) => (
                <span key={type} className="tl-legend-item">
                    <i
                        className="tl-legend-dot"
                        style={{
                            background: impactConfig.legendColors[type],
                            boxShadow: `0 0 6px ${impactConfig.legendColors[type]}60`,
                            borderColor: `${impactConfig.legendColors[type]}55`,
                        }}
                    />
                    {type}
                </span>
            ))}
        </div>
    );

    const toggleControl = (
        <div className="tl-toggle-wrapper">
            <button
                className="tl-toggle-container"
                onClick={handleToggle}
                aria-pressed={!showAllEvents}
                aria-label={showAllEvents ? "Show key milestones only" : "Show all events"}
            >
                <span className={clsx("tl-toggle-label-left", showAllEvents && "tl-toggle-label-active")}>
                    Show All Events
                </span>

                <div
                    className="tl-toggle-track"
                    data-key-active={!showAllEvents}
                >
                    <div
                        className="tl-toggle-slider"
                        data-gold={!showAllEvents}
                    />
                </div>

                <span className={clsx("tl-toggle-label-right", !showAllEvents && "tl-toggle-label-active")}>
                    Key Milestones
                </span>
            </button>
        </div>
    );

    const interactionHint = showHint && (
        <div className="tl-hint">
            💡 Hover years to expand • Click to lock
        </div>
    );

    const infoButton = (
        <button
            className="tl-info-btn"
            onClick={toggleHint}
            aria-label="Show interaction help"
        >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <text x="10" y="14.5" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="500">i</text>
            </svg>
        </button>
    );

    // SVG ref for measuring text
    const measureSvgRef = React.useRef<SVGSVGElement | null>(null);

    // Cache measured label dimensions. getBBox() forces a synchronous layout reflow,
    // and label sizing runs during render for every focused-year label — so without a
    // cache we re-measure the same strings (re)flowing the page each time a year is
    // focused. Keyed by text + font size (rounded), so it survives scale changes too.
    const textDimCache = React.useRef<Map<string, { width: number; height: number }>>(new Map());

    const getTextDimensions = React.useCallback((text: string, fontPx = 13): { width: number; height: number } => {
        const key = `${text}|${Math.round(fontPx * 10)}`;
        const cached = textDimCache.current.get(key);
        if (cached) return cached;

        if (!measureSvgRef.current) {
            // No SVG yet — estimate, but DON'T cache (so the real measurement replaces it).
            return { width: text.length * fontPx * 0.55, height: fontPx };
        }

        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', "'Rajdhani', 'Rajdhani Fallback', monospace");
        tempText.setAttribute('font-size', String(fontPx));
        tempText.setAttribute('font-weight', '600');
        tempText.setAttribute('letter-spacing', '0.06em');
        tempText.textContent = text;
        tempText.style.visibility = 'hidden';
        tempText.style.position = 'absolute';

        measureSvgRef.current.appendChild(tempText);
        const bbox = tempText.getBBox();
        measureSvgRef.current.removeChild(tempText);

        const dim = { width: Math.ceil(bbox.width), height: Math.ceil(bbox.height) };
        textDimCache.current.set(key, dim);
        return dim;
    }, []);

    // Static chart scaffold (level gridlines + level labels + Y-axis caption). Depends
    // only on the height-derived y-scale and the chart width — NOT on animatedWidths —
    // so memoizing it keeps React from reconciling these ~13 nodes on every frame of
    // the year-expansion animation. Recomputes only when the height (yOf) or width changes.
    const levelGrid = React.useMemo(() => (
        <>
            {Array.from({ length: 6 }).map((_, i) => (
                <line key={`lvl-${i}`} x1={0} x2={FIXED_TOTAL_WIDTH} y1={yOf(i)} y2={yOf(i)} className="tl-tick" />
            ))}
            {/* Level numbers + axis caption live on the RIGHT — the mirrored spine
                (descent + knee) now occupies the left edge and crowded them out. */}
            {Array.from({ length: 6 }).map((_, i) => (
                <text
                    key={`lvl-label-${i}`}
                    x={FIXED_TOTAL_WIDTH - 2}
                    y={yOf(i) - 3}
                    style={{ textAnchor: 'end' }}
                    className="tl-level-label"
                >{i}</text>
            ))}
            <g transform={`translate(${FIXED_TOTAL_WIDTH + 10}, ${((yTop5 + yBottom) / 2) - 6})`}>
                <text transform="rotate(-90)" textAnchor="middle" className="tl-y-axis-caption">
                    PROGRESS LEVEL
                </text>
            </g>
        </>
    ), [yOf, FIXED_TOTAL_WIDTH, yTop5, yBottom]);

    // ── Caption "journey" layout ───────────────────────────────────────────────
    // On focusing a year we draw a caption for each of its events into an open pocket
    // of empty space, connected by a leader that emanates VERTICALLY from the dot in
    // the dot's colour — matching the spine's 90° routing. Low dots route UP (into the
    // empty upper area), high dots route DOWN; a vertical leader at the dot's own x can't
    // cross the path (one y per x) or hit another dot (all dots sit on the path), so the
    // "never cross" rule holds by construction. Boxes stack at staggered heights to avoid
    // overlap; a single 90° horizontal jog is added only to clear a chart edge.
    const lit = focusedYear >= 0 && expansionComplete;
    const prefersReduced = useReducedMotion();

    const captionPlacements = React.useMemo(() => {
        type Place = {
            key: string; evIdx: number; category: string; isExceptional: boolean; color: string;
            dotX: number; dotY: number; boxX: number; boxY: number; boxW: number; boxH: number;
            baseFontSize: number; leaderD: string; leaderLen: number; goUp: boolean;
        };
        if (!lit) return [] as Place[];

        const evs = visibleEvents
            .filter(ev => {
                const yIdx = yearIndex(ev.year);
                const isVis = showAllEvents || ev.significant === true || ev.impactType === 'None';
                return yIdx === focusedYear && ev.category && isVis;
            })
            .sort((a, b) => a.month - b.month);

        const TOP = yTop6 + 32 * uiScale;   // clear the chapter-label strip; scales with the chart
        const BOT = yBottom + 24 * uiScale;
        const EDGE = 8 * uiScale;
        const PAD = 6 * uiScale;         // box-vs-box padding
        const DOT_R = 9 * uiScale;       // clearance bubble around every dot      (knob)
        const LINE_PAD = 6 * uiScale;    // gap kept between a box and the path     (knob)
        const MAX_JOG = 220 * uiScale;   // longest allowed sideways leader         (knob)

        type Box = { x1: number; y1: number; x2: number; y2: number };
        type Seg = { ax: number; ay: number; bx: number; by: number };

        // obstacles: `points` are the dot centres AND the polyline vertices
        const dots = points;
        const pathSegs: Seg[] = [];
        for (let i = 1; i < dots.length; i++)
            pathSegs.push({ ax: dots[i - 1].x, ay: dots[i - 1].y, bx: dots[i].x, by: dots[i].y });

        const placedUp: Box[] = [];
        const placedDown: Box[] = [];
        const placedLeaders: Seg[] = [];

        const clampX = (x: number, bw: number) =>
            Math.max(bw / 2 + EDGE, Math.min(FIXED_TOTAL_WIDTH - bw / 2 - EDGE, x));

        const boxHitsDot = (b: Box, ownX: number, ownY: number) => dots.some(d => {
            if (Math.abs(d.x - ownX) < 0.5 && Math.abs(d.y - ownY) < 0.5) return false;
            const nx = Math.max(b.x1, Math.min(d.x, b.x2));
            const ny = Math.max(b.y1, Math.min(d.y, b.y2));
            const dx = d.x - nx, dy = d.y - ny;
            return dx * dx + dy * dy < DOT_R * DOT_R;
        });

        const cross = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
            (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        const segCross = (s: Seg, t: Seg) => {
            const d1 = cross(t.ax, t.ay, t.bx, t.by, s.ax, s.ay);
            const d2 = cross(t.ax, t.ay, t.bx, t.by, s.bx, s.by);
            const d3 = cross(s.ax, s.ay, s.bx, s.by, t.ax, t.ay);
            const d4 = cross(s.ax, s.ay, s.bx, s.by, t.bx, t.by);
            return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
                ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
        };
        const ptInBox = (x: number, y: number, b: Box) => x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2;
        const segHitsBox = (s: Seg, b: Box) => {
            if (ptInBox(s.ax, s.ay, b) || ptInBox(s.bx, s.by, b)) return true;
            const e: Seg[] = [
                { ax: b.x1, ay: b.y1, bx: b.x2, by: b.y1 }, { ax: b.x2, ay: b.y1, bx: b.x2, by: b.y2 },
                { ax: b.x2, ay: b.y2, bx: b.x1, by: b.y2 }, { ax: b.x1, ay: b.y2, bx: b.x1, by: b.y1 },
            ];
            return e.some(edge => segCross(s, edge));
        };
        const boxHitsPath = (b: Box) => {
            const inf: Box = { x1: b.x1 - LINE_PAD, y1: b.y1 - LINE_PAD, x2: b.x2 + LINE_PAD, y2: b.y2 + LINE_PAD };
            return pathSegs.some(seg => segHitsBox(seg, inf));
        };

        // Leader routing: vertical out of the dot, then — only if the box is offset sideways —
        // a single 90° break that runs INTO THE MIDDLE OF THE BOX'S NEAR VERTICAL SIDE (the
        // left or right edge facing the dot). With no sideways offset it just meets the middle
        // of the box's near top/bottom edge. Returns the geometry, the SVG `d`, and the length.
        const buildLeader = (dotX: number, dotY: number, cx: number, cy: number, bw: number, bh: number) => {
            const jog = Math.abs(cx - dotX) > 0.5;
            if (!jog) {
                const ey = dotY < cy ? cy - bh / 2 : cy + bh / 2;       // near top/bottom edge centre
                return {
                    segs: [{ ax: dotX, ay: dotY, bx: dotX, by: ey }] as Seg[],
                    d: `M ${dotX} ${dotY} V ${ey}`,
                    len: Math.abs(dotY - ey),
                };
            }
            const edgeX = dotX <= cx ? cx - bw / 2 : cx + bw / 2;        // near left/right side centre
            return {
                segs: [
                    { ax: dotX, ay: dotY, bx: dotX, by: cy },           // vertical to the box's centre line
                    { ax: dotX, ay: cy, bx: edgeX, by: cy },            // horizontal into the side, mid-height
                ] as Seg[],
                d: `M ${dotX} ${dotY} V ${cy} H ${edgeX}`,
                len: Math.abs(dotY - cy) + Math.abs(edgeX - dotX),
            };
        };
        const leaderBad = (dotX: number, dotY: number, cx: number, cy: number, bw: number, bh: number) => {
            const { segs } = buildLeader(dotX, dotY, cx, cy, bw, bh);
            const horiz = segs[1];
            if (horiz) {
                const lo = Math.min(horiz.ax, horiz.bx), hi = Math.max(horiz.ax, horiz.bx);
                const hy = horiz.ay;
                const dotHit = dots.some(d => {
                    if (Math.abs(d.x - dotX) < 0.5 && Math.abs(d.y - dotY) < 0.5) return false;
                    const nx = Math.max(lo, Math.min(d.x, hi));
                    const dx = d.x - nx, dy = d.y - hy;
                    return dx * dx + dy * dy < DOT_R * DOT_R;
                });
                if (dotHit) return true;
                if (pathSegs.some(seg => segCross(horiz, seg))) return true;
            }
            const allBoxes = placedUp.concat(placedDown);
            if (segs.some(s => allBoxes.some(b => segHitsBox(s, b)))) return true;   // leader vs caption box
            return placedLeaders.some(pl => segs.some(s => segCross(s, pl)));        // leader vs leader
        };

        // ---- geometry per event, computed once ----
        const meta = evs.map(ev => {
            const yIdx = yearIndex(ev.year);
            const yearStart = xAtYear[yIdx];
            const yearEnd = yIdx < TOTAL_YEARS - 1 ? xAtYear[yIdx + 1] : xAtYear[yIdx] + animatedWidths[yIdx];
            const span = yearEnd - yearStart;
            const dotX = yearStart + ((ev.month - 1) / 12) * span;
            const dotY = yOf(ev.level);
            const dims = getTextDimensions(ev.category, 13 * uiScale);
            return { ev, dotX, dotY, boxW: dims.width + 24 * uiScale, boxH: dims.height + 10 * uiScale };
        });

        // placed left-to-right (meta is month-sorted); each box avoids the ones already set
        // to its left, which keeps the horizontal spread coherent.
        const order = meta.map((_, i) => i);

        let upN = 0, downN = 0;
        const out: Place[] = new Array(meta.length);

        for (const idx of order) {
            const { ev, dotX, dotY, boxW, boxH } = meta[idx];
            const evIdx = eventIndexMap.get(ev) ?? -1;
            const color = impactConfig.legendColors[ev.impactType];
            const baseFontSize = 13 * uiScale;
            const dotR = (ev.dotSize ?? impactConfig.defaultDotSize) * uiScale;

            // available room each way — used only to bias the preferred side
            const roomUp = dotY - (TOP + boxH);
            const roomDown = (BOT - boxH) - dotY;
            let goUp: boolean;
            if (roomUp < 36 * uiScale) goUp = false;
            else if (roomDown < 36 * uiScale) goUp = true;
            else goUp = upN <= downN;

            const baseGap = dotR + 24 * uiScale;
            const vStep = boxH + 10 * uiScale;
            const xStep = boxW * 0.55;
            const shifts: number[] = [0];
            for (let k = 1; k <= 6; k++) shifts.push(k * xStep, -k * xStep);

            const overlapArea = (b: Box, arr: Box[]) => arr.reduce((acc, q) => {
                const w = Math.min(b.x2, q.x2) - Math.max(b.x1, q.x1);
                const h = Math.min(b.y2, q.y2) - Math.max(b.y1, q.y1);
                return acc + (w > 0 && h > 0 ? w * h : 0);
            }, 0);

            // SCORING MODEL (the actual fix for "random lengths"): hug the dots at ONE
            // consistent vertical gap and spread SIDEWAYS; only drop to a deeper row when a row
            // is genuinely full. Vertical distance beyond the ideal hug gap is EXPENSIVE; a
            // sideways jog is CHEAP. Previously horizontal was punished MORE than vertical, so
            // colliding boxes escaped by wandering vertically to different depths -> leaders of
            // every length. Now they slide sideways at a uniform gap, so leaders stay short and
            // even. The strong side bias sends captions into whichever side has the open space.
            const V_WEIGHT = 5.0;    // cost per px the box sits beyond its ideal hug gap   (knob)
            const H_JOG = 1.0;       // cost per px of sideways leader                       (knob)
            const SIDE_BIAS = 2500;  // how hard we prefer the room-chosen side              (knob)
            type Cand = { cx: number; cy: number; up: boolean; pen: number };
            const placedAll = [...placedUp, ...placedDown];   // fixed during this event's search
            let best: Cand | null = null;
            const consider = (tx: number, ty: number, up: boolean) => {
                if (up && ty - boxH / 2 < TOP) return;
                if (!up && ty + boxH / 2 > BOT) return;
                const box: Box = { x1: tx - boxW / 2 - PAD, x2: tx + boxW / 2 + PAD, y1: ty - boxH / 2 - PAD, y2: ty + boxH / 2 + PAD };
                const { segs } = buildLeader(dotX, dotY, tx, ty, boxW, boxH);
                const hJog = segs[1] ? Math.abs(segs[1].bx - segs[1].ax) : 0;
                const vGap = up ? (dotY - (ty + boxH / 2)) : ((ty - boxH / 2) - dotY);   // dot -> near edge
                const vExcess = Math.max(0, vGap - baseGap);                              // beyond the ideal hug
                let pen = vExcess * V_WEIGHT + hJog * H_JOG;        // hug vertically, spread sideways
                pen += overlapArea(box, placedAll) * 200;          // box overlaps near-forbidden
                if (boxHitsDot(box, dotX, dotY)) pen += 200000;
                if (boxHitsPath(box)) pen += 200000;
                if (leaderBad(dotX, dotY, tx, ty, boxW, boxH)) pen += 120000;   // leader over a box / dot / other leader
                if (up !== goUp) pen += SIDE_BIAS;                              // strongly prefer the open side
                if (!best || pen < best.pen) best = { cx: tx, cy: ty, up, pen };
            };

            for (const up of [goUp, !goUp]) {
                for (let step = 0; step < 14; step++) {
                    const gap = baseGap + step * vStep;
                    const ty = up ? dotY - gap - boxH / 2 : dotY + gap + boxH / 2;
                    if (up && ty - boxH / 2 < TOP) break;
                    if (!up && ty + boxH / 2 > BOT) break;
                    for (const dx of shifts) {
                        const tx = clampX(dotX + dx, boxW);
                        if (Math.abs(tx - dotX) > MAX_JOG) continue;
                        consider(tx, ty, up);
                    }
                }
            }
            // tiny-band safety so `best` is never null
            if (!best) {
                const midUp = Math.max(TOP + boxH / 2, Math.min(BOT - boxH / 2, dotY - baseGap - boxH / 2));
                const midDn = Math.max(TOP + boxH / 2, Math.min(BOT - boxH / 2, dotY + baseGap + boxH / 2));
                consider(clampX(dotX, boxW), midUp, true);
                consider(clampX(dotX, boxW), midDn, false);
            }
            const chosen: Cand = best ?? { cx: clampX(dotX, boxW), cy: TOP + boxH / 2, up: true, pen: 0 };
            goUp = chosen.up;
            const res = { cx: chosen.cx, cy: chosen.cy };

            const { cx, cy } = res;
            const { segs: chosenSegs, d: leaderD, len: leaderLen } = buildLeader(dotX, dotY, cx, cy, boxW, boxH);
            (goUp ? placedUp : placedDown).push({ x1: cx-boxW/2-PAD, x2: cx+boxW/2+PAD, y1: cy-boxH/2-PAD, y2: cy+boxH/2+PAD });
            for (const s of chosenSegs) placedLeaders.push(s);
            if (goUp) upN++; else downN++;

            out[idx] = {
                key: `cap-${evIdx}`,
                evIdx,
                category: ev.category,
                isExceptional: ev.impactType === 'Exceptional',
                color, dotX, dotY, boxX: cx, boxY: cy, boxW, boxH, baseFontSize,
                leaderD, leaderLen, goUp,
            };
        }

        return out;
    }, [lit, focusedYear, visibleEvents, showAllEvents, xAtYear, animatedWidths, yOf, uiScale, FIXED_TOTAL_WIDTH, yTop6, yBottom, TOTAL_YEARS, getTextDimensions, points, eventIndexMap]);
    // Bright copies of the focused year's dots — they stay lit on top while the base
    // chart dims. Tracks positions live (cheap) so they're correct during the expand too.
    const litDots = React.useMemo(() => {
        if (focusedYear < 0) return [];
        return visibleEvents
            .filter(ev => {
                const yIdx = yearIndex(ev.year);
                const isVis = showAllEvents || ev.significant === true || ev.impactType === 'None';
                return yIdx === focusedYear && isVis;
            })
            .map(ev => {
                const yIdx = yearIndex(ev.year);
                const yearStart = xAtYear[yIdx];
                const yearEnd = yIdx < TOTAL_YEARS - 1 ? xAtYear[yIdx + 1] : xAtYear[yIdx] + animatedWidths[yIdx];
                const span = yearEnd - yearStart;
                const evIdx = eventIndexMap.get(ev) ?? -1;
                return {
                    key: `lit-${evIdx}`,
                    evIdx,
                    x: yearStart + ((ev.month - 1) / 12) * span,
                    y: yOf(ev.level),
                    r: (ev.dotSize ?? impactConfig.defaultDotSize) * uiScale,
                    fill: impactConfig.colors[ev.impactType],
                    glow: impactConfig.legendColors[ev.impactType],
                    isNone: ev.impactType === 'None',
                };
            });
    }, [focusedYear, visibleEvents, showAllEvents, xAtYear, animatedWidths, yOf, uiScale, TOTAL_YEARS, eventIndexMap]);

    return (
        <>
            <style>{styles}</style>
            <div
                className={clsx('tl-wrap', className)}
                ref={containerRef}
                aria-label="Progress timeline"
            >
                {/* Animated LineAnchor path overlay (high z-index so it sits above the chart).
                    MIRRORED journey (section reorder): the line arrives from TimelineTitle on
                    the RIGHT, crosses R→L above the chart, and descends the LEFT side (knee +
                    exit) toward Collaborations. Chart internals are untouched. */}
                <div className="pointer-events-none absolute inset-0 z-[100]">
                    {/* Top entry */}
                    <div className="absolute right-0 top-[20px]">
                        <LineAnchor id="timeline-top" position="right" offsetX={100} />
                    </div>

                    {/* Horizontal run */}
                    <div className="absolute right-0 w-0" style={{ top: `${HORIZONTAL_LINE_Y}px` }}>
                        <LineAnchor id="timeline-right" position="right" offsetX={100} />
                    </div>
                    <div className="absolute left-0 w-0" style={{ top: `${HORIZONTAL_LINE_Y}px` }}>
                        <LineAnchor id="timeline-left" position="left" offsetX={100} />
                    </div>

                    {/* Knee — proportional to the (fluid) height so it stays glued to the
                        descent at ~46% of the chart (= 300px below the run at the 650 reference). */}
                    <div className="absolute left-0 w-0" style={{ top: `${HORIZONTAL_LINE_Y + Math.round(height * (300 / 650))}px` }}>
                        <LineAnchor id="timeline-below" position="left" offsetX={100} />
                    </div>

                    {/* Bottom exit */}
                    <div className="absolute left-0 bottom-[40px]">
                        <LineAnchor id="timeline-bottom" position="left" offsetX={100} />
                    </div>
                </div>

                <div className="tl-rail">
                    {/* Spacer so controls sit just under the horizontal line */}
                    <div style={{ height: HORIZONTAL_LINE_Y + CONTROLS_OFFSET_FROM_LINE }} />

                    {/* Controls in the band between line and graph */}
                    <div className="tl-controls-row">
                        <div className="tl-controls-left">
                            {infoButton}
                            {interactionHint}
                        </div>
                        <div className="tl-controls-center">
                            {toggleControl}
                        </div>
                        <div className="tl-controls-right">
                            {legend}
                        </div>
                    </div>

                    {/* Graph, fixed height, starts below controls */}
                    <div
                        className="tl-plot"
                        style={{
                            position: 'relative',
                            height,
                            marginTop: 8,
                        }}
                    >
                        <svg
                            className="tl-svg"
                            ref={measureSvgRef}
                            width="100%"
                            height={height}
                            viewBox={`0 0 ${FIXED_TOTAL_WIDTH} ${height}`}
                            preserveAspectRatio="xMidYMid meet"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                overflow: 'visible'
                            }}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                            onClick={handleSvgClick}
                        >
                            {GRAPH_GRADIENTS}

                            {/* Base chart — eases to a gentle dim while a year is focused so the lit
                                journey reads on top, WITHOUT crushing the months/context to black.
                                Year labels (below) and the bright overlay stay outside this group. */}
                            <g style={{ opacity: focusedYear >= 0 ? 0.6 : 1, transition: 'opacity 420ms cubic-bezier(0.16, 1, 0.3, 1)' }}>

                                {focusHighlight}

                                {levelGrid}

                                {/* Year lines - including 2027 ending line */}
                                {Array.from({ length: TOTAL_YEARS + 1 }).map((_, i) => {
                                    const x = i < TOTAL_YEARS
                                        ? xAtYear[i]
                                        : xAtYear[TOTAL_YEARS - 1] + animatedWidths[TOTAL_YEARS - 1];

                                    const shouldHide = i < TOTAL_YEARS && (focusedYear === i || focusedYear === i - 1);
                                    const isClosingLine = i === TOTAL_YEARS;

                                    // Hide the rightmost year line (2027 ending line) where LineAnchor is
                                    const hideForLineAnchor = isClosingLine;

                                    // Tick centered on level-0 line
                                    const tickTop = yBottom - 4;
                                    const tickBottom = yBottom + 4;

                                    return (
                                        <g key={`year-${i}`}>
                                            <line
                                                x1={x}
                                                x2={x}
                                                y1={tickTop}
                                                y2={tickBottom}
                                                stroke="rgba(255, 255, 255, 0.28)"
                                                strokeWidth="1.2"
                                            />

                                            {(!shouldHide && !hideForLineAnchor) && (
                                                <line x1={x} x2={x} y1={yTop5} y2={tickTop} className="tl-tick" />
                                            )}
                                        </g>
                                    );
                                })}

                                {Array.from({ length: TOTAL_YEARS }).map((_, y) => {
                                    if (activeIdx !== null && activeIdx >= 0) {
                                        const prevIdx = prevActiveRef.current;
                                        if (y !== activeIdx && y !== prevIdx) return null;
                                    } else {
                                        if (y !== maxRevealIdx || rawRevealByYear[y] <= EPS) return null;
                                    }

                                    const revealRaw = rawRevealByYear[y];
                                    const isActive = activeIdx !== null && activeIdx >= 0 && y === activeIdx;
                                    const displayReveal = isActive ? Math.min(1, revealRaw / REVEAL_BIAS) : revealRaw;
                                    if (displayReveal <= EPS) return null;

                                    const yearStart = xAtYear[y];
                                    const yearEnd = y < TOTAL_YEARS - 1 ? xAtYear[y + 1] : xAtYear[y] + animatedWidths[y];
                                    const span = yearEnd - yearStart;

                                    // Hide 13th line when this is the last year (2026)
                                    const isLastYear = y === TOTAL_YEARS - 1;

                                    return (
                                        <g key={`months-${y}`} className="tl-month-group" style={{ opacity: displayReveal }}>
                                            {Array.from({ length: 13 }).map((_, m) => {
                                                // Skip the 13th line (index 12) when it's the last year
                                                if (isLastYear && m === 12) return null;

                                                const monthX = yearStart + (m / 12) * span;
                                                const sw = 0.3 + displayReveal * 0.7;
                                                const delay = `${m * 0.012}s`;
                                                return (
                                                    <g key={`month-${y}-${m}`}>
                                                        <line
                                                            x1={monthX} x2={monthX} y1={yTop5} y2={yBottom}
                                                            className="tl-month-tick"
                                                            style={{
                                                                strokeWidth: `${sw}px`,
                                                                transition: `stroke-width 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}`
                                                            }}
                                                        />
                                                        {m < 12 && (
                                                            <line
                                                                x1={monthX} x2={monthX} y1={yBottom} y2={yBottom + 4}
                                                                className="tl-month-bottom-tick"
                                                                style={{
                                                                    strokeWidth: `${sw}px`,
                                                                    transition: `stroke-width 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}`
                                                                }}
                                                            />
                                                        )}
                                                        <text
                                                            x={monthX} y={yBottom + 18}
                                                            className="tl-month-label"
                                                            textAnchor="middle"
                                                            style={{
                                                                opacity: displayReveal,
                                                                transition: `opacity 0.18s cubic-bezier(0.22,1,0.36,1) ${delay}`
                                                            }}
                                                        >
                                                            {m === 12 ? 1 : m + 1}
                                                        </text>
                                                    </g>
                                                );
                                            })}
                                        </g>
                                    );
                                })}

                                <path
                                    d={pathD}
                                    className="tl-path"
                                    style={{
                                        strokeDasharray: hasLoaded ? 'none' : pathLength,
                                        strokeDashoffset: hasLoaded ? 0 : pathLength,
                                        transition: 'stroke-dashoffset 2s ease-out'
                                    }}
                                />

                                {/* PASS 1: Dots + Hit Areas */}
                                {events.map((ev, evIdx) => {
                                    const yIdx = yearIndex(ev.year);
                                    const yearStart = xAtYear[yIdx];
                                    const yearEnd = yIdx < TOTAL_YEARS - 1 ? xAtYear[yIdx + 1] : xAtYear[yIdx] + animatedWidths[yIdx];
                                    const span = yearEnd - yearStart;
                                    const x = yearStart + ((ev.month - 1) / 12) * span;
                                    const y = yOf(ev.level);
                                    const inFocusedYear = focusedYear === yIdx;
                                    const isVisible = showAllEvents || ev.significant === true || ev.impactType === 'None';
                                    return (
                                        <DotItem
                                            key={`dot-${ev.year}.${ev.month}`}
                                            ev={ev} evIdx={evIdx} x={x} y={y}
                                            baseSize={(ev.dotSize ?? impactConfig.defaultDotSize) * uiScale}
                                            isHovered={inFocusedYear && hoveredEventIdx === evIdx}
                                            isVisible={isVisible}
                                            inFocusedYear={inFocusedYear}
                                            isExceptional={ev.impactType === 'Exceptional'}
                                            isNone={ev.impactType === 'None'}
                                            dotColor={impactConfig.colors[ev.impactType]}
                                            legendColor={impactConfig.legendColors[ev.impactType]}
                                            hitR={Math.max(12, 12 * uiScale)}
                                            onEnter={handleDotEnter} onLeave={handleDotLeave} onActivate={handleDotActivate}
                                        />
                                    );
                                })}

                                {/* Captions are no longer drawn here — they live in the bright overlay
                                (the <AnimatePresence> block) that sits on top of this dimmed base. */}

                                {chapterLines.map((line, index) => {
                                    const yIdx = yearIndex(line.year);
                                    const yearStart = xAtYear[yIdx];
                                    const yearEnd = yIdx < TOTAL_YEARS - 1 ? xAtYear[yIdx + 1] : xAtYear[yIdx] + animatedWidths[yIdx];
                                    const span = yearEnd - yearStart;
                                    const t = (line.month - 1) / 12;
                                    const x = yearStart + t * span;
                                    const isActive = focusedYear === yIdx;
                                    return (
                                        <g key={`chapter-${index}`}>
                                            <line
                                                x1={x} x2={x} y1={yTop6 + 10} y2={yBottom}
                                                className="tl-chapter-line"
                                                style={{
                                                    opacity: isActive ? 0.95 : 0.18,
                                                    strokeWidth: isActive ? 2 : 1,
                                                }}
                                            />
                                            <text
                                                x={x + 6} y={yTop6 + 18}
                                                className="tl-chapter-label"
                                                style={{
                                                    opacity: isActive ? 0.8 : 0.35,
                                                }}
                                            >
                                                {line.label}
                                            </text>
                                            <text
                                                x={x + 6} y={yTop6 + 30}
                                                className="tl-chapter-caption"
                                                style={{
                                                    opacity: isActive ? 0.7 : 0.45,
                                                }}
                                            >
                                                {line.caption}
                                            </text>
                                        </g>
                                    );
                                })}

                                {showTeaser && (() => {
                                    const yIdx = yearIndex(TEASER_EVENT_YEAR);
                                    const yearStart = xAtYear[yIdx];
                                    const yearEnd = yIdx < TOTAL_YEARS - 1 ? xAtYear[yIdx + 1] : xAtYear[yIdx] + animatedWidths[yIdx];
                                    const span = yearEnd - yearStart;
                                    const t = (TEASER_EVENT_MONTH - 1) / 12;
                                    const x = yearStart + t * span;
                                    const y = yOf(TEASER_EVENT_LEVEL);

                                    return (
                                        <circle
                                            cx={x}
                                            cy={y}
                                            r={20 * uiScale}
                                            className="tl-teaser-pulse"
                                            fill="none"
                                            stroke="rgba(255,215,0,0.6)"
                                            strokeWidth="2"
                                        />
                                    );
                                })()}

                            </g>{/* ── end dimmable base ── */}

                            {/* Year labels - 2016 to 2026 only (no 2027) */}
                            {Array.from({ length: TOTAL_YEARS }).map((_, y) => {
                                const left = xAtYear[y];
                                const right = y < TOTAL_YEARS - 1 ? xAtYear[y + 1] : xAtYear[y] + animatedWidths[y];
                                const cx = left + (right - left) / 2;
                                const isFocus = focusedYear === y;
                                const isLocked = activeYear === y;
                                const dim = focusedYear >= 0 && !isFocus;

                                // Anti-collision: the SVG renders ~1:1 with screen px horizontally
                                // (viewBox width == FIXED_TOTAL_WIDTH == container width) so a 14px,
                                // 4-char "2016" label is a fixed ~38px wide and collides once each
                                // year column gets narrow. Below ~42px/column abbreviate to '16 and
                                // shrink the font. At 1440 each column is ~115px, so the full 4-digit
                                // label at 14/16px is unchanged (no-op).
                                const colWidth = FIXED_TOTAL_WIDTH / TOTAL_YEARS;
                                const abbreviate = !isFocus && colWidth < 46;
                                const fullLabel = 2016 + y;
                                const yearLabel = abbreviate
                                    ? `'${String(fullLabel).slice(2)}`
                                    : fullLabel;
                                const baseFontSize = colWidth < 36 ? 11 : colWidth < 46 ? 12 : 14;

                                return (
                                    <g key={`ycap-${y}`}>
                                        <text
                                            x={cx}
                                            y={yBottom + 36}
                                            textAnchor="middle"
                                            className="tl-year-typo"
                                            style={{
                                                fill: isFocus ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.78)',
                                                opacity: dim ? 0.45 : 1,
                                                fontWeight: 700,
                                                fontSize: (isFocus ? 16 : baseFontSize) * uiScale,
                                                letterSpacing: isFocus ? '0.2em' : '0.16em',
                                            }}
                                        >
                                            {yearLabel}
                                        </text>
                                        {isLocked && (
                                            <text
                                                x={cx}
                                                y={yBottom + 50}
                                                textAnchor="middle"
                                                className="tl-year-lock-hint"
                                                style={{
                                                    fill: 'rgba(255, 255, 255, 0.9)',
                                                    fontSize: `${10 * uiScale}px`,
                                                    fontFamily: 'Rajdhani, monospace',
                                                    letterSpacing: '0.08em',
                                                    textTransform: 'uppercase',
                                                    opacity: dim ? 0.38 : 1,
                                                }}
                                            >
                                                [ Click to unlock ]
                                            </text>
                                        )}
                                    </g>
                                );
                            })}

                            {/* ── Bright "lit journey" overlay (above the dimmed base) ───────────
                                One presence group per focused year. On enter, each caption draws its
                                leader out from BEHIND its dot, then the glassy box reveals — staggered
                                into a wave. The lit dots paint LAST so they always sit on top of every
                                leader origin (no line is ever drawn over a dot). On exit / year-switch
                                the WHOLE group fades out together (dots + leaders + boxes) via
                                AnimatePresence, so a leader can never be stranded without its covering
                                dot — that orphaned colored stub at the old dot was the "dot left behind"
                                bug (the old per-leader retract could be interrupted mid-flight and the
                                old year's dots vanished instantly, exposing the leader's coloured origin). */}
                            <AnimatePresence>
                                {focusedYear >= 0 && (
                                    <motion.g
                                        key={`focus-${focusedYear}`}
                                        initial={{ opacity: 1 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0, transition: { duration: 0 } }}
                                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                        style={{ pointerEvents: 'none' }}
                                    >
                                        {/* Captions — only after the column has settled (lit). */}
                                        {lit && (
                                            <motion.g
                                                key={`captions-${focusedYear}`}
                                                initial={prefersReduced ? false : 'hidden'}
                                                animate="visible"
                                                variants={{ hidden: {}, visible: {} }}
                                            >
                                                {captionPlacements.map(p => (
                                                    <CaptionItem
                                                        key={p.key}
                                                        p={p}
                                                        isHov={hoveredEventIdx === p.evIdx}
                                                        someHov={hoveredEventIdx != null}
                                                        prefersReduced={prefersReduced}
                                                    />
                                                ))}
                                            </motion.g>
                                        )}

                                        {/* Lit dots LAST so they sit on top of every leader origin. On a
                                            per-dot hover the hovered dot grows + brightens and the others
                                            dim AND shrink (matches the caption hover above). */}
                                        {litDots.map(d => {
                                            const isHov = hoveredEventIdx === d.evIdx;
                                            const someHov = hoveredEventIdx != null;
                                            const r = isHov ? d.r * 1.6 : (someHov ? d.r * 0.85 : d.r);
                                            const ease = 'cubic-bezier(0.16,1,0.3,1)';
                                            return (
                                                <g key={d.key}
                                                   style={{ opacity: someHov && !isHov ? 0.32 : 1, transition: `opacity 260ms ${ease}` }}>
                                                    {!d.isNone && (
                                                        <circle cx={d.x} cy={d.y} r={r + (isHov ? 9 : 5)} fill={d.glow} className="tl-dot-glow"
                                                                style={{ opacity: isHov ? 0.7 : 0.45, transition: `r 260ms ${ease}, opacity 260ms ${ease}` }} />
                                                    )}
                                                    <circle cx={d.x} cy={d.y} r={r} fill={d.isNone ? '#FFFFFF' : d.fill}
                                                            style={{ transition: `r 260ms ${ease}` }} />
                                                </g>
                                            );
                                        })}
                                    </motion.g>
                                )}
                            </AnimatePresence>
                        </svg>
                    </div>
                </div>
            </div>
            <AchievementModal
                data={modalData}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    );
}