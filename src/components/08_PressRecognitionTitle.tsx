'use client';

import * as React from 'react';
import clsx from 'clsx';
import { LineAnchor } from '@/components/00_LineAnchor';

export type PressRecognitionTitleProps = {
    lines?: string[];
    className?: string;
    scale?: number;               // font size multiplier
    leftOffsetPx?: number;        // horizontal offset of the title FROM THE LEFT EDGE
    reserveBelowPx?: number;      // spacing below the title block
    showAnchors?: boolean;
    debugGuides?: boolean;
};

/* pixels before the anchor where the tunnel opens */
const TUNNEL_OFFSET_PX = 100;

/* for reading globals written by ProgressLine */
interface WindowWithLine extends Window {
    lineAnchors?: Record<string, { x: number; y: number }>;
    progressTipY?: number;
}

/* ================= Styles ================= */
const styles = `
.prt-wrap {
  position: relative;
  width: 100%;
  container-type: inline-size;
  isolation: isolate;
  z-index: 1;
  display: flex;
  flex-direction: column;
  padding-top: calc(var(--prt-lead) + var(--prt-gap));
  padding-bottom: var(--prt-trail);
}

/* Title block — normal flow, LEFT-aligned, offset left by --prt-left */
.prt-title {
  position: relative;
  margin: 0 0 0 var(--prt-left);

  display: flex;
  flex-direction: column;
  gap: 0.04em;

  font-family: var(--font-sans, Rajdhani), monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 0.92;
  color: rgba(255,255,255,0.94);
  font-weight: 900;
  pointer-events: none;

  /* --prt-scale and --prt-left are set inline on .prt-wrap from the scale and
     leftOffsetPx props (prop-driven, no-op at the 1440 reference). */
  --prt-size: calc(var(--prt-scale) * clamp(64px, 8.4cqi, 160px));
}
@supports not (font-size: 1cqi) {
  .prt-title { --prt-size: calc(var(--prt-scale) * clamp(64px, 8.4vw, 160px)); }
}

/* Lines inherit the big size */
.prt-line {
  display: block;
  font-size: var(--prt-size);
  overflow: hidden;
}

/* Word slide-up animation */
.prt-word {
  display: inline-block;
  opacity: 0;
  transform: translateY(100%);
  transition:
    transform 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: calc(var(--prt-i, 0) * 80ms);
}

/* When visible, all words slide up in sequence */
.prt-title.prt-visible .prt-word {
  opacity: 1;
  transform: translateY(0);
}

/* optional debug guides */
.prt-guide {
  position:absolute;
  left:0;
  right:0;
  height:1px;
  background: rgba(255,255,255,0.25);
  pointer-events:none;
  z-index: 100;
}
.prt-guide--mid    { top: 50%; }
.prt-guide--under  { top: var(--prt-under); }

/* ---------------------- TUNNEL ELLIPSE (SVG) - TOP ENTRY ---------------------- */
.prt-tunnel-svg {
  position: absolute;
  top: 42px;
  /* Track the spine exactly — one source of truth (--prt-spine-x, set inline on .prt-wrap). */
  right: var(--prt-spine-x);
  width: clamp(80px, 11vw, 100px);
  height: clamp(16px, 2.5vw, 20px);
  transform: translateX(50%) translateY(calc(-50% + 6px));
  pointer-events: none;
  overflow: visible;
}

.prt-tunnel-ellipse {
  transform-origin: center;
  transform: scale(0);
  transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

/* open state */
.prt-wrap--tunnel-ready .prt-tunnel-ellipse {
  transform: scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .prt-word {
    transition: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
  .prt-tunnel-ellipse {
    transition: none !important;
  }
}
`;

export default function PressRecognitionTitle({
                                                  lines = ['PRESS & RECOGNITION'],
                                                  className,
                                                  scale = 0.785,
                                                  leftOffsetPx = 200,
                                                  reserveBelowPx = 30,
                                                  showAnchors = true,
                                                  debugGuides = false,
                                              }: PressRecognitionTitleProps) {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const [visible, setVisible] = React.useState(false);
    const [tunnelReady, setTunnelReady] = React.useState(false);

    // Title animation
    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const io = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry?.isIntersecting) {
                    setVisible(true);
                    io.disconnect();
                }
            },
            { rootMargin: '0px 0px -30% 0px', threshold: 0.5 }
        );

        io.observe(el);
        return () => io.disconnect();
    }, []);

    // Tunnel open/close based on line tip vs prt-start-right-top anchor
    React.useEffect(() => {
        const handleProximity = () => {
            if (typeof window === 'undefined') return;
            const win = window as WindowWithLine;

            const anchors = win.lineAnchors;
            if (!anchors) return;

            const startAnchor = anchors['prt-start-right-top'];
            if (!startAnchor) return;

            const tipY = win.progressTipY;
            if (typeof tipY !== 'number') return;

            // open once tip gets within 100px ABOVE that anchor
            // and stay open while tip is below it;
            // close again when tip moves more than 100px above.
            const shouldBeReady = tipY >= startAnchor.y - TUNNEL_OFFSET_PX;

            setTunnelReady(shouldBeReady);
        };

        handleProximity();
        window.addEventListener('scroll', handleProximity, { passive: true });
        window.addEventListener('anchors-updated', handleProximity);

        return () => {
            window.removeEventListener('scroll', handleProximity);
            window.removeEventListener('anchors-updated', handleProximity);
        };
    }, []);

    const allLines = React.useMemo(
        () => lines.map((line) => line.split(' ').filter(Boolean)),
        [lines]
    );

    const wrapperStyle: React.CSSProperties & {
        ['--prt-scale']: string;
        ['--prt-left']: string;
        ['--prt-spine-x']: string;
        ['--prt-lead']: string;
        ['--prt-gap']: string;
        ['--prt-trail']: string;
        ['--prt-under']: string;
    } = {
        ['--prt-scale']: String(scale),
        // Fluid offset (see --prt-left in styles): floors at gutter, caps at rem, tracks vw
        // so it stays aligned to the spine on resize. No-op at 1440.
        ['--prt-left']: `clamp(var(--gutter), ${leftOffsetPx / 14.4}vw, ${leftOffsetPx / 16}rem)`,
        // The vertical spine's x-position, mirroring 00_LineAnchor's uiScale exactly.
        ['--prt-spine-x']: 'clamp(18px, min(6.944vw, 6.25rem), 160px)',
        ['--prt-lead']: 'clamp(140px, 26vh, 300px)',
        // line→title gap == the title's LEFT inset (spine→title), so top & left stay
        // equal and both scale with width. = 100px at 1440 (no-op).
        ['--prt-gap']: 'calc(var(--prt-left) - var(--prt-spine-x))',
        ['--prt-trail']: 'clamp(20px, 4vh, 50px)',
        ['--prt-under']: 'calc(var(--prt-lead) + var(--prt-gap))',
    };

    return (
        <>
            <div
                ref={ref}
                className={clsx(
                    'prt-wrap',
                    className,
                    tunnelReady && 'prt-wrap--tunnel-ready'
                )}
                style={{ ...wrapperStyle, marginBottom: reserveBelowPx }}
                aria-hidden="true"
            >
                <style>{styles}</style>

                {debugGuides && (
                    <>
                        <div className="prt-guide prt-guide--mid" />
                        <div className="prt-guide prt-guide--under" />
                    </>
                )}

                {showAnchors && (
                    <div className="pointer-events-none absolute inset-0 z-[5]">
                        {/* TOP RIGHT start anchor */}
                        <div className="absolute right-0 top-[42px]">
                            <LineAnchor id="prt-start-right-top" position="right" offsetX={100} />
                        </div>
                        {/* Middle anchors */}
                        <div className="absolute right-0 w-0" style={{ top: 'var(--prt-lead)' }}>
                            <LineAnchor id="prt-middle-right" position="right" offsetX={100} />
                        </div>
                        <div className="absolute left-0 w-0" style={{ top: 'var(--prt-lead)' }}>
                            <LineAnchor id="prt-middle-left" position="left" offsetX={100} />
                        </div>
                        {/* Under + bottom */}
                        <div className="absolute left-0 w-0" style={{ top: 'var(--prt-under)' }}>
                            <LineAnchor id="prt-under-left" position="left" offsetX={100} />
                        </div>
                        <div className="absolute left-0 bottom-[12px]">
                            <LineAnchor id="prt-bottom-left" position="left" offsetX={100} />
                        </div>

                        {/* SVG Tunnel ellipse at top anchor - entry point (built upward) */}
                        <svg
                            className="prt-tunnel-svg"
                            viewBox="0 0 100 20"
                            preserveAspectRatio="xMidYMid meet"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <defs>
                                {/* Main tunnel boundary - clips everything to the base ellipse */}
                                <clipPath id="tunnel-boundary-top">
                                    <ellipse cx="50" cy="10" rx="50" ry="10" />
                                </clipPath>
                            </defs>

                            {/* Group all rings inside the main tunnel boundary */}
                            <g clipPath="url(#tunnel-boundary-top)">
                                {/* Fill the base to create solid background */}
                                <ellipse
                                    className="prt-tunnel-ellipse"
                                    cx="50"
                                    cy="10"
                                    rx="50"
                                    ry="10"
                                    fill="rgba(255,255,255,0.05)"
                                />

                                {/* Ring outlines - shifted UPWARD (negative direction) */}
                                <ellipse
                                    className="prt-tunnel-ellipse"
                                    cx="50"
                                    cy="10"
                                    rx="50"
                                    ry="10"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.24)"
                                    strokeWidth="2.5"
                                />

                                <ellipse
                                    className="prt-tunnel-ellipse"
                                    cx="50"
                                    cy="8.5"
                                    rx="50"
                                    ry="10"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.20)"
                                    strokeWidth="1"
                                />

                                <ellipse
                                    className="prt-tunnel-ellipse"
                                    cx="50"
                                    cy="7"
                                    rx="50"
                                    ry="10"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.16)"
                                    strokeWidth="1"
                                />

                                <ellipse
                                    className="prt-tunnel-ellipse"
                                    cx="50"
                                    cy="5.5"
                                    rx="50"
                                    ry="10"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.12)"
                                    strokeWidth="1"
                                />

                                <ellipse
                                    className="prt-tunnel-ellipse"
                                    cx="50"
                                    cy="4"
                                    rx="50"
                                    ry="10"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.08)"
                                    strokeWidth="1"
                                />

                                <ellipse
                                    className="prt-tunnel-ellipse"
                                    cx="50"
                                    cy="2.5"
                                    rx="50"
                                    ry="10"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.05)"
                                    strokeWidth="0.8"
                                />
                            </g>
                        </svg>
                    </div>
                )}

                <h1 className={clsx('prt-title', visible && 'prt-visible')}>
                    {allLines.map((words, lineIdx) => (
                        <span key={lineIdx} className="prt-line">
                            {words.map((word, wordIdx) => {
                                const idx = lineIdx * 10 + wordIdx;
                                const isLast = wordIdx === words.length - 1;

                                return (
                                    <React.Fragment key={`${lineIdx}-${wordIdx}-${word}`}>
                                        <span
                                            className="prt-word"
                                            style={
                                                {
                                                    ['--prt-i']: idx,
                                                } as React.CSSProperties
                                            }
                                        >
                                            {word}
                                        </span>
                                        {!isLast && ' '}
                                    </React.Fragment>
                                );
                            })}
                        </span>
                    ))}
                </h1>
            </div>
        </>
    );
}