'use client';

import React from 'react';
import clsx from 'clsx';
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
    HEADER_SPACE: 260,
    CONTROL_STRIP_HEIGHT: 40,
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
            const w = el.clientWidth;
            setWidth(Math.max(0, Math.round(w)));
        };

        let timeoutId: number | null = null;
        const debouncedUpdate = () => {
            if (timeoutId) window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(updateWidth, 150);
        };

        const rafId = requestAnimationFrame(updateWidth);
        const ro = new ResizeObserver(debouncedUpdate);
        ro.observe(el);

        return () => {
            cancelAnimationFrame(rafId);
            if (timeoutId) window.clearTimeout(timeoutId);
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

// ==================== STYLES ====================
const styles = `
.tl-wrap {
    position: relative;
    overflow-x: hidden; /* no horizontal scroll */
    overflow-y: visible;
    padding: 20px 100px;
    box-sizing: border-box;
    min-height: 400px;
    outline: none;
}

@media (max-width: 1200px) {
    .tl-wrap {
        padding-left: 60px;
        padding-right: 60px;
    }
}

@media (max-width: 768px) {
    .tl-wrap {
        padding-left: 20px;
        padding-right: 20px;
    }
}

.tl-wrap:focus-visible {
    box-shadow: 0 0 0 2px rgba(255,255,255,0.25) inset;
    border-radius: 4px;
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
  overflow: visible; /* FIX: Prevent thumb cutoff */
  padding: 2px 0; /* FIX: Add padding to ensure thumb isn't clipped */
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
  gap: 16px;
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
  margin-left: 32px;            /* distance from info button */
}

/* Impact Scale legend */
.tl-controls-right {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  margin-left: auto;            /* push this group to the right edge */
  margin-right: 25px;           /* small inset from the right (you already liked this) */
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
    font: 500 10px/1 'Rajdhani', 'Rajdhani Fallback', monospace;
    letter-spacing: 0.05em;
    fill: rgba(255, 255, 255, 0.64);
}

.tl-dot { cursor: pointer; transition: r 420ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.tl-dot-glow { filter: blur(10px); transition: opacity 420ms cubic-bezier(0.22,1,0.36,1); }

.tl-dot-label {
    font: 600 13px/1 'Rajdhani', 'Rajdhani Fallback', monospace;
    letter-spacing: 0.06em;
    fill: #fff;
    pointer-events: none;
    transition: font-size 420ms cubic-bezier(0.22,1,0.36,1), opacity 0.3s cubic-bezier(0.23, 1, 0.32, 1);
}

.tl-dot-label-box {
    transition: opacity 320ms cubic-bezier(0.22,1,0.36,1), transform 320ms cubic-bezier(0.22,1,0.36,1);
}

.tl-dot-label-box-appear-from-bottom {
    animation: tlLabelSlideUp 420ms cubic-bezier(0.22,1,0.36,1) forwards;
}

.tl-dot-label-box-appear-from-top {
    animation: tlLabelSlideDown 420ms cubic-bezier(0.22,1,0.36,1) forwards;
}

@keyframes tlLabelSlideUp {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes tlLabelSlideDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.tl-dot-label-exceptional {
    font: 600 13px/1 'Rajdhani', 'Rajdhani Fallback', monospace;
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
        r 420ms cubic-bezier(0.34, 1.56, 0.64, 1),
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
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    transition: font-size 160ms cubic-bezier(0.22,1,0.36,1), fill 160ms cubic-bezier(0.22,1,0.36,1), opacity 160ms cubic-bezier(0.22,1,0.36,1);
}

.tl-level-label {
    fill: rgba(255, 255, 255, 0.72);
    font: 600 10px/1 'Rajdhani', 'Rajdhani Fallback', monospace;
    letter-spacing: .10em;
}

.tl-chapter-line {
    stroke: rgba(255,255,255,0.85);
    stroke-dasharray: 5 5;
    cursor: default;
    transition: opacity 160ms cubic-bezier(0.22,1,0.36,1), stroke-width 160ms cubic-bezier(0.22,1,0.36,1);
}

.tl-chapter-label {
    font: 600 12px/1 'Rajdhani', 'Rajdhani Fallback', monospace;
    letter-spacing: 0.16em;
    fill: rgba(255,255,255,0.92);
    text-anchor: start;
    transition: opacity 160ms cubic-bezier(0.22,1,0.36,1);
}

.tl-chapter-caption {
    font: 500 10px/1 'Rajdhani', 'Rajdhani Fallback', monospace;
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

.tl-current-marker {
    fill: #FFD447;
    font: 600 10px/1 'Rajdhani', 'Rajdhani Fallback', monospace;
    letter-spacing: 0.12em;
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
    .tl-path { transition: none !important; animation: none !important; }
}

.tl-header-gold {
    background: linear-gradient(135deg, #FEF3C7 0%, #FDE047 25%, #FFD60A 50%, #F59E0B 75%, #B45309 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 0 8px rgba(255, 214, 10, 0.4));
    animation: goldShimmer 3s ease-in-out infinite;
}

@keyframes goldShimmer {
    0%, 100% {
        filter: drop-shadow(0 0 8px rgba(255, 214, 10, 0.4));
    }
    50% {
        filter: drop-shadow(0 0 12px rgba(255, 214, 10, 0.6));
    }
}

@keyframes labelSlideIn {
    0% {
        opacity: 0;
        transform: translateY(var(--entrance-offset, -4px)) scale(0.98);
    }
    100% {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}
`;

// ==================== COMPONENT ====================
type Props = {
    events?: ProgressEvent[];
    height?: number;
    baseYearWidth?: number;
    expandedFactor?: number;
    className?: string;
};

export default function ProgressTimeline({
                                             events = filipRealEvents,
                                             height = 650,
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

    const derivedBaseYearWidth = React.useMemo(() => {
        const sum = FIXED_TOTAL_WIDTH - (TOTAL_YEARS - 1) * BASE_GAP;
        return sum / TOTAL_YEARS;
    }, [FIXED_TOTAL_WIDTH, TOTAL_YEARS, BASE_GAP]);

    const effectiveBaseYearWidth = baseYearWidth ?? derivedBaseYearWidth;

    const [modalData, setModalData] = React.useState<AchievementData | null>(null);
    const [isModalOpen, setIsModalOpen] = React.useState(false);

    const [hoverYear, setHoverYear] = React.useState<number>(-1);
    const [activeYear, setActiveYear] = React.useState<number | null>(null);
    const [selectedEvent, setSelectedEvent] = React.useState<ProgressEvent | null>(null);
    const [hoveredDot, setHoveredDot] = React.useState<{ year: number; month: number } | null>(null);
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

    // FIX 3: Track when year expansion animation completes
    const [expansionComplete, setExpansionComplete] = React.useState(false);
    const expansionTimerRef = React.useRef<number | null>(null);

    const handleToggle = React.useCallback(() => {
        setShowAllEvents(prev => !prev);
    }, []);

    React.useEffect(() => {
        return () => {
            if (hoverDelayRef.current) {
                clearTimeout(hoverDelayRef.current);
            }
        };
    }, []);

    const visibleEvents = React.useMemo(() => {
        if (showAllEvents) return events;
        return events.filter(ev => ev.significant === true || ev.impactType === 'None');
    }, [events, showAllEvents]);

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

    // FIX 3: Track expansion completion
    React.useEffect(() => {
        if (focusedYear >= 0) {
            setExpansionComplete(false);
            if (expansionTimerRef.current) clearTimeout(expansionTimerRef.current);

            // Ultimate premium: labels appear almost immediately (250ms into 460ms expansion)
            expansionTimerRef.current = window.setTimeout(() => {
                setExpansionComplete(true);
            }, 250);
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

    const getTextDimensions = React.useCallback((text: string): { width: number; height: number } => {
        if (!measureSvgRef.current) return { width: text.length * 7, height: 13 };

        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', "'Rajdhani', 'Rajdhani Fallback', monospace");
        tempText.setAttribute('font-size', '13');
        tempText.setAttribute('font-weight', '600');
        tempText.setAttribute('letter-spacing', '0.06em');
        tempText.textContent = text;
        tempText.style.visibility = 'hidden';
        tempText.style.position = 'absolute';

        measureSvgRef.current.appendChild(tempText);
        const bbox = tempText.getBBox();
        measureSvgRef.current.removeChild(tempText);

        return {
            width: Math.ceil(bbox.width),
            height: Math.ceil(bbox.height)
        };
    }, []);

    return (
        <>
            <style>{styles}</style>
            <div
                className={clsx('tl-wrap', className)}
                ref={containerRef}
                aria-label="Progress timeline"
            >
                {/* FIX 1: Animated LineAnchor path overlay - INCREASED Z-INDEX */}
                <div className="pointer-events-none absolute inset-0 z-[100]">
                    {/* Top entry */}
                    <div className="absolute left-0 top-20px]">
                        <LineAnchor id="timeline-top" position="left" offsetX={100} />
                    </div>

                    {/* Horizontal run */}
                    <div className="absolute left-0 w-0" style={{ top: `${HORIZONTAL_LINE_Y}px` }}>
                        <LineAnchor id="timeline-left" position="left" offsetX={100} />
                    </div>
                    <div className="absolute right-0 w-0" style={{ top: `${HORIZONTAL_LINE_Y}px` }}>
                        <LineAnchor id="timeline-right" position="right" offsetX={100} />
                    </div>

                    {/* Knee 300px below */}
                    <div className="absolute left-0 w-0" style={{ top: `${HORIZONTAL_LINE_Y + 300}px` }}>
                        <LineAnchor id="timeline-below" position="right" offsetX={100} />
                    </div>

                    {/* Bottom exit */}
                    <div className="absolute right-0 bottom-[40px]">
                        <LineAnchor id="timeline-bottom" position="right" offsetX={100} />
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
                            marginTop: 32,
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

                            {focusHighlight}

                            {Array.from({ length: 6 }).map((_, i) => (
                                <line key={`lvl-${i}`} x1={0} x2={FIXED_TOTAL_WIDTH} y1={yOf(i)} y2={yOf(i)}
                                      className="tl-tick" />
                            ))}

                            {Array.from({ length: 6 }).map((_, i) => (
                                <text key={`lvl-label-${i}`} x={2} y={yOf(i) - 3} className="tl-level-label">{i}</text>
                            ))}
                            <g transform={`translate(-10, ${((yTop5 + yBottom) / 2) - 6})`}>
                                <text transform="rotate(-90)" textAnchor="middle" className="tl-y-axis-caption">
                                    PROGRESS LEVEL
                                </text>
                            </g>

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
                            {events.map(ev => {
                                const yIdx = yearIndex(ev.year);
                                const yearStart = xAtYear[yIdx];
                                const yearEnd = yIdx < TOTAL_YEARS - 1 ? xAtYear[yIdx + 1] : xAtYear[yIdx] + animatedWidths[yIdx];
                                const span = yearEnd - yearStart;
                                const t = (ev.month - 1) / 12;
                                const x = yearStart + t * span;
                                const y = yOf(ev.level);

                                const inFocusedYear = focusedYear === yIdx;
                                const dotColor = impactConfig.colors[ev.impactType];
                                const legendColor = impactConfig.legendColors[ev.impactType];
                                const baseSize = ev.dotSize ?? impactConfig.defaultDotSize;
                                const hoveredSize = baseSize * 2;
                                const isHovered = inFocusedYear && hoveredDot?.year === ev.year && hoveredDot?.month === ev.month;
                                const isExceptional = ev.impactType === 'Exceptional';
                                const isNone = ev.impactType === 'None';
                                const isVisible = showAllEvents || ev.significant === true || ev.impactType === 'None';
                                const dotOpacity = isVisible ? 1 : 0;

                                return (
                                    <g
                                        key={`dot-${ev.year}.${ev.month}`}
                                        style={{
                                            opacity: dotOpacity,
                                            transition: 'opacity 320ms cubic-bezier(0.23, 1, 0.32, 1)', // smooth fade
                                        }}
                                    >
                                        {/* GLOW */}
                                        <circle
                                            cx={x} cy={y}
                                            r={hoveredSize + 6}
                                            className="tl-dot-glow"
                                            style={{
                                                fill: legendColor,
                                                opacity: isNone ? 0 : isExceptional ? (isHovered ? 0.6 : 0.3) : (isHovered ? 0.6 : 0),
                                            }}
                                            pointerEvents="none"
                                        />

                                        {/* DOT */}
                                        {isNone ? (
                                            <circle
                                                cx={x} cy={y}
                                                r={isHovered ? hoveredSize : baseSize}
                                                fill="#FFFFFF"
                                                className="tl-dot"
                                                style={{ transition: 'r 180ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                                                pointerEvents="none"
                                            />
                                        ) : isExceptional ? (
                                            <circle
                                                cx={x} cy={y}
                                                r={isHovered ? hoveredSize : baseSize}
                                                fill={dotColor}
                                                className="tl-dot-exceptional"
                                                style={{
                                                    filter: isHovered
                                                        ? 'drop-shadow(0 0 6px #FFD60A) drop-shadow(0 0 10px rgba(255,214,10,0.4))'
                                                        : 'drop-shadow(0 0 3px rgba(255,214,10,0.4))',
                                                    transition: 'r 180ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                                                }}
                                                pointerEvents="none"
                                            />
                                        ) : (
                                            <circle
                                                cx={x} cy={y}
                                                r={isHovered ? hoveredSize : baseSize}
                                                fill={dotColor}
                                                className="tl-dot"
                                                style={{
                                                    filter: isHovered ? `drop-shadow(0 0 8px ${legendColor})` : 'none',
                                                    transition: 'r 180ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                                                }}
                                                pointerEvents="none"
                                            />
                                        )}

                                        {/* HIT AREA */}
                                        <circle
                                            cx={x}
                                            cy={y}
                                            r={12}
                                            fill="transparent"
                                            style={{
                                                pointerEvents: isVisible ? 'auto' : 'none',   // don't click hidden dots
                                                cursor: ev.article ? 'pointer' : 'default',
                                            }}
                                            onClick={async (e) => {
                                                if (!inFocusedYear) return;
                                                e.stopPropagation();
                                                if (ev.article) {
                                                    const data = await loadAchievement(ev.article);
                                                    setModalData(data);
                                                    setIsModalOpen(true);
                                                }
                                                setSelectedEvent(prev => (prev?.year === ev.year && prev.month === ev.month ? null : ev));
                                                setActiveYear(null);
                                            }}
                                            onMouseEnter={() => {
                                                if (!inFocusedYear) return;
                                                if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current);
                                                hoverDelayRef.current = window.setTimeout(() => {
                                                    setHoveredDot({ year: ev.year, month: ev.month });
                                                    setSelectedEvent(ev);
                                                }, 150);
                                            }}
                                            onMouseLeave={() => {
                                                if (!inFocusedYear) return;
                                                if (hoverDelayRef.current) {
                                                    clearTimeout(hoverDelayRef.current);
                                                    hoverDelayRef.current = null;
                                                }
                                                setHoveredDot(null);
                                                setSelectedEvent(null);
                                            }}
                                        />
                                    </g>
                                );
                            })}

                            {/* FIX 3: PASS 2: Labels - Only show after expansion completes */}
                            {(() => {
                                if (focusedYear < 0 || !expansionComplete) return null;

                                const focusedEvents = visibleEvents.filter(ev => {
                                    const yIdx = yearIndex(ev.year);
                                    const isVisible = showAllEvents || ev.significant === true || ev.impactType === 'None';
                                    return yIdx === focusedYear && ev.category && isVisible;
                                });

                                const labelPositions = focusedEvents.map((ev, index) => {
                                    const yIdx = yearIndex(ev.year);
                                    const yearStart = xAtYear[yIdx];
                                    const yearEnd = yIdx < TOTAL_YEARS - 1 ? xAtYear[yIdx + 1] : xAtYear[yIdx] + animatedWidths[yIdx];
                                    const span = yearEnd - yearStart;
                                    const t = (ev.month - 1) / 12;
                                    const x = yearStart + t * span;
                                    const y = yOf(ev.level);

                                    const baseSize = ev.dotSize ?? impactConfig.defaultDotSize;
                                    const isHovered = hoveredDot?.year === ev.year && hoveredDot?.month === ev.month;

                                    const baseFontSize = 13;

                                    const { width: textWidth, height: textHeight } = getTextDimensions(ev.category);

                                    const boxPaddingX = 12;
                                    const boxPaddingY = 4;
                                    const boxWidth = textWidth + boxPaddingX * 2;
                                    const boxHeight = textHeight + boxPaddingY * 2;

                                    const scale = isHovered ? 1.5 : (hoveredDot ? 0.85 : 1);
                                    const opacity = hoveredDot ? (isHovered ? 1 : 0.3) : 0.9; // Dim others when one is hovered
                                    const translateY = isHovered ? -6 : 0;

                                    const dotsInYear = eventsByYear.get(yIdx) || [];
                                    const dotIndex = dotsInYear.findIndex(d => d.year === ev.year && d.month === ev.month);
                                    const preferBelow = dotIndex % 2 === 1;

                                    const offsetFromDot = baseSize + 18;
                                    const initialLabelY = preferBelow ? y + offsetFromDot : y - offsetFromDot;

                                    // Ultra-fast stagger for premium instant feel
                                    const staggerDelay = index * 25;

                                    return {
                                        ev,
                                        x,
                                        y,
                                        labelY: initialLabelY,
                                        boxWidth,
                                        boxHeight,
                                        baseFontSize,
                                        opacity,
                                        scale,
                                        translateY,
                                        isHovered,
                                        preferBelow,
                                        staggerDelay
                                    };
                                });

                                for (let i = 0; i < labelPositions.length; i++) {
                                    for (let j = i + 1; j < labelPositions.length; j++) {
                                        const a = labelPositions[i];
                                        const b = labelPositions[j];

                                        const aEffectiveWidth = a.boxWidth * a.scale;
                                        const bEffectiveWidth = b.boxWidth * b.scale;
                                        const aEffectiveHeight = a.boxHeight * a.scale;
                                        const bEffectiveHeight = b.boxHeight * b.scale;

                                        const horizontalOverlap = Math.abs(a.x - b.x) < (aEffectiveWidth + bEffectiveWidth) / 2 + 10;

                                        if (horizontalOverlap) {
                                            const verticalOverlap = Math.abs(a.labelY - b.labelY) < (aEffectiveHeight + bEffectiveHeight) / 2 + 8;

                                            if (verticalOverlap) {
                                                if (a.isHovered) {
                                                    const direction = b.preferBelow ? 1 : -1;
                                                    b.labelY += direction * ((aEffectiveHeight + bEffectiveHeight) / 2 + 10);
                                                } else if (b.isHovered) {
                                                    const direction = a.preferBelow ? 1 : -1;
                                                    a.labelY += direction * ((aEffectiveHeight + bEffectiveHeight) / 2 + 10);
                                                } else {
                                                    const direction = b.preferBelow ? 1 : -1;
                                                    b.labelY = a.labelY + direction * ((aEffectiveHeight + bEffectiveHeight) / 2 + 8);
                                                }
                                            }
                                        }
                                    }
                                }

                                return labelPositions.map(({ ev, x, labelY, boxWidth, boxHeight, baseFontSize, opacity, scale, translateY, isHovered, staggerDelay, preferBelow }) => {
                                    const isExceptional = ev.impactType === 'Exceptional';
                                    const impactColor = impactConfig.legendColors[ev.impactType];

                                    const shadowIntensity = isHovered ? '0.65' : '0.3';
                                    const shadowBlur = isHovered ? '24px' : '8px';
                                    const shadowSpread = isHovered ? '6px' : '2px';
                                    const glowBlur = isHovered ? '12px' : '0px';

                                    // Ultimate premium: barely-there movement (4px), instant feel
                                    const entranceOffset = preferBelow ? -4 : 4;

                                    return (
                                        <g
                                            key={`label-${ev.year}.${ev.month}`}
                                            className="tl-label-entrance"
                                            style={{
                                                '--entrance-offset': `${entranceOffset}px`,
                                                '--stagger-delay': `${staggerDelay}ms`,
                                                opacity,
                                                transform: `translate(0, ${translateY}px) scale(${scale})`,
                                                transformOrigin: `${x}px ${labelY}px`,
                                                transition: `opacity 280ms cubic-bezier(0.22,1,0.36,1), transform 320ms cubic-bezier(0.22,1,0.36,1)`,
                                                pointerEvents: 'none',
                                                animation: `labelSlideIn 240ms cubic-bezier(0.22,1,0.36,1) var(--stagger-delay) backwards`
                                            } as React.CSSProperties}
                                        >
                                            {/* Outer glow - only this animates wildly */}
                                            {isHovered && (
                                                <rect
                                                    x={x - boxWidth / 2 - 3}
                                                    y={labelY - boxHeight / 2 - 3}
                                                    width={boxWidth + 6}
                                                    height={boxHeight + 6}
                                                    rx={7}
                                                    fill="none"
                                                    stroke={isExceptional ? '#FFD60A' : impactColor}
                                                    strokeWidth={0.5}
                                                    opacity={0.4}
                                                    style={{
                                                        filter: `blur(${glowBlur})`,
                                                        transition: 'filter 320ms cubic-bezier(0.22,1,0.36,1)'
                                                    }}
                                                />
                                            )}

                                            {/* Main box border - smooth transition only */}
                                            <rect
                                                x={x - boxWidth / 2}
                                                y={labelY - boxHeight / 2}
                                                width={boxWidth}
                                                height={boxHeight}
                                                rx={5}
                                                fill={isExceptional
                                                    ? `rgba(255, 214, 10, ${isHovered ? 0.35 : 0.20})`
                                                    : `${impactColor}${isHovered ? '42' : '25'}`}
                                                stroke={isExceptional ? '#FFD60A' : impactColor}
                                                strokeWidth={isHovered ? 2.5 : 1.5}
                                                style={{
                                                    filter: isExceptional
                                                        ? `drop-shadow(0 ${shadowSpread} ${shadowBlur} rgba(255, 214, 10, ${shadowIntensity}))`
                                                        : `drop-shadow(0 ${shadowSpread} ${shadowBlur} ${impactColor}${Math.round(parseFloat(shadowIntensity) * 10)})`,
                                                    transition: 'fill 280ms cubic-bezier(0.22,1,0.36,1), stroke-width 280ms cubic-bezier(0.22,1,0.36,1), filter 280ms cubic-bezier(0.22,1,0.36,1)'
                                                }}
                                            />

                                            {/* Highlight shine */}
                                            <rect
                                                x={x - boxWidth / 2 + 1}
                                                y={labelY - boxHeight / 2 + 1}
                                                width={boxWidth - 2}
                                                height={(boxHeight - 2) / 3}
                                                rx={4}
                                                fill={`rgba(255, 255, 255, ${isHovered ? 0.2 : 0.08})`}
                                                pointerEvents="none"
                                                style={{
                                                    transition: 'fill 280ms cubic-bezier(0.22,1,0.36,1)'
                                                }}
                                            />

                                            {/* Text - no transition at all */}
                                            <text
                                                x={x}
                                                y={labelY + baseFontSize * 0.35}
                                                className={isExceptional ? "tl-dot-label-exceptional" : "tl-dot-label"}
                                                textAnchor="middle"
                                                style={{
                                                    fontSize: `${baseFontSize}px`,
                                                    fontWeight: isHovered ? 700 : 600,
                                                }}
                                            >
                                                {ev.category}
                                            </text>
                                        </g>
                                    );
                                });
                            })()}

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
                                        r={20}
                                        className="tl-teaser-pulse"
                                        fill="none"
                                        stroke="rgba(255,215,0,0.6)"
                                        strokeWidth="2"
                                    />
                                );
                            })()}

                            {/* Year labels - 2016 to 2026 only (no 2027) */}
                            {Array.from({ length: TOTAL_YEARS }).map((_, y) => {
                                const left = xAtYear[y];
                                const right = y < TOTAL_YEARS - 1 ? xAtYear[y + 1] : xAtYear[y] + animatedWidths[y];
                                const cx = left + (right - left) / 2;
                                const isFocus = focusedYear === y;
                                const isLocked = activeYear === y;
                                const dim = focusedYear >= 0 && !isFocus;
                                const yearLabel = 2016 + y;

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
                                                fontSize: isFocus ? 16 : 14,
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
                                                    fontSize: '10px',
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