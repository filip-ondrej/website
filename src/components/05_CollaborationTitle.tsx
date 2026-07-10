'use client';

import * as React from 'react';
import clsx from 'clsx';
import { LineAnchor } from '@/components/00_LineAnchor';

export type CollaborationTitleProps = {
    lines?: string[];
    className?: string;
    scale?: number;               // font size multiplier
    rightOffsetPx?: number;       // horizontal offset of the title FROM THE RIGHT EDGE
    reserveBelowPx?: number;      // spacing below the title block
    showAnchors?: boolean;
    debugGuides?: boolean;
};

/* ================= Styles ================= */
const styles = `
.ct-wrap {
  position: relative;
  width: 100%;
  container-type: inline-size;
  isolation: isolate;
  z-index: 1;
  /* Bounded Journey: content-driven height = compact lead-in + title + small
     trailing, instead of a fixed box. The lead-in is constant across all title
     sections regardless of line count, so every gap matches and nothing clips
     at any width. */
  display: flex;
  flex-direction: column;
  padding-top: calc(var(--ct-lead) + var(--ct-gap));
  padding-bottom: var(--ct-trail);
}

/* Title block — normal flow, RIGHT-aligned, offset from the right by --ct-right */
.ct-title {
  position: relative;
  align-self: flex-end;
  margin: 0 var(--ct-right) 0 0;

  display: flex;
  flex-direction: column;
  gap: 0.04em;
  text-align: right;

  font-family: var(--font-sans, Rajdhani), monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 0.92;
  color: rgba(255,255,255,0.94);
  font-weight: 900;
  pointer-events: none;

  /* --ct-scale and --ct-right are set inline on .ct-wrap from the scale and
     rightOffsetPx props (prop-driven, no-op at the 1440 reference). */
  --ct-size: calc(var(--ct-scale) * clamp(64px, 8.4cqi, 160px));
}
@supports not (font-size: 1cqi) {
  .ct-title { --ct-size: calc(var(--ct-scale) * clamp(64px, 8.4vw, 160px)); }
}

/* Lines inherit the big size */
.ct-line {
  display: block;
  font-size: var(--ct-size);
  overflow: hidden;
}

/* Word slide-up animation */
.ct-word {
  display: inline-block;
  opacity: 0;
  transform: translateY(100%);
  transition:
    transform 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: calc(var(--ct-i, 0) * 80ms);
}

/* When visible, all words slide up in sequence */
.ct-title.ct-visible .ct-word {
  opacity: 1;
  transform: translateY(0);
}

/* optional debug guides */
.ct-guide {
  position:absolute;
  left:0;
  right:0;
  height:1px;
  background: rgba(255,255,255,0.25);
  pointer-events:none;
  z-index: 100;
}
.ct-guide--mid    { top: 50%; }
.ct-guide--under  { top: var(--ct-under); }

/* ---------------------- TUNNEL ELLIPSE (SVG) ---------------------- */
.ct-tunnel-svg {
  position: absolute;
  bottom: 12px;
  /* Track the spine exactly — one source of truth (--ct-spine-x, set inline on .ct-wrap). */
  right: var(--ct-spine-x);
  width: clamp(80px, 11vw, 100px);
  height: clamp(16px, 2.5vw, 20px);
  transform: translateX(50%) translateY(3px);
  pointer-events: none;
  overflow: visible;
}

.ct-tunnel-ellipse {
  transform-origin: center;
  transform: scale(0);
  transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

/* grow / shrink depending on line progress */
.ct-wrap--tunnel-ready .ct-tunnel-ellipse {
  transform: scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .ct-word {
    transition: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
  .ct-tunnel-ellipse {
    transition: none !important;
  }
}
`;

/** how many px BEFORE the anchor the tunnel opens */
const TUNNEL_OFFSET_PX = 100;

interface WindowWithLine extends Window {
    lineAnchors?: Record<string, { x: number; y: number }>;
    progressTipY?: number;
}

export default function CollaborationTitle({
                                               lines = ['TRUSTED BY THE BEST'],
                                               className,
                                               scale = 0.785,
                                               rightOffsetPx = 200,
                                               reserveBelowPx = 30,
                                               showAnchors = true,
                                               debugGuides = false,
                                           }: CollaborationTitleProps) {
    const ref = React.useRef<HTMLDivElement | null>(null);

    const [visible, setVisible] = React.useState(false);
    const [tunnelReady, setTunnelReady] = React.useState(false);

    // Title words: start when this section enters viewport
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

    // Tunnel open/close: based on line tip Y vs ct-bottom-right anchor Y
    React.useEffect(() => {
        const handleProximity = () => {
            if (typeof window === 'undefined') return;
            const win = window as WindowWithLine;

            const anchors = win.lineAnchors;
            if (!anchors) return;

            const bottomAnchor = anchors['ct-bottom-right'];
            if (!bottomAnchor) return;

            const tipY = win.progressTipY;
            if (typeof tipY !== 'number') return;

            // open once the tip gets within 100px ABOVE the anchor,
            // stay open while tip is at/ below that (scrolling down),
            // close only when tip goes back above that threshold.
            const shouldBeReady = tipY >= bottomAnchor.y - TUNNEL_OFFSET_PX;

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

    // Split lines into words for the slide-up animation
    const allLines = React.useMemo(
        () => lines.map((line) => line.split(' ').filter(Boolean)),
        [lines]
    );

    // Shared CSS variables: title positioned from RIGHT. Bounded Journey: the line
    // + title sit at a compact, constant lead-in from the top (not 50% of a tall
    // box), so the gap matches the other title sections regardless of line count.
    // The section is fully content-driven.
    const wrapperStyle: React.CSSProperties & {
        ['--ct-scale']: string;
        ['--ct-right']: string;
        ['--ct-spine-x']: string;
        ['--ct-lead']: string;
        ['--ct-gap']: string;
        ['--ct-trail']: string;
        ['--ct-under']: string;
    } = {
        ['--ct-scale']: String(scale),
        // Fluid right-edge offset (see --ct-right in styles): floors at gutter, caps at rem,
        // tracks vw so it stays glued to the spine on resize. No-op at 1440.
        ['--ct-right']: `clamp(var(--gutter), ${rightOffsetPx / 14.4}vw, ${rightOffsetPx / 16}rem)`,
        // The vertical spine's x-position (from either edge), mirroring 00_LineAnchor's uiScale.
        ['--ct-spine-x']: 'clamp(18px, min(6.944vw, 6.25rem), 160px)',
        // lead-in (space above the line) — compact, the gap from the previous section
        ['--ct-lead']: 'clamp(140px, 26vh, 300px)',
        // line→title gap == the title's RIGHT inset (spine→title, this title is right-
        // aligned), so top & right stay equal and both scale with width. 100px at 1440.
        ['--ct-gap']: 'calc(var(--ct-right) - var(--ct-spine-x))',
        // trailing below the title — smaller than the lead-in
        ['--ct-trail']: 'clamp(20px, 4vh, 50px)',
        // title top / under-anchor point
        ['--ct-under']: 'calc(var(--ct-lead) + var(--ct-gap))',
    };

    return (
        <>
            <div
                ref={ref}
                className={clsx(
                    'ct-wrap',
                    className,
                    visible && 'ct-wrap--visible',
                    tunnelReady && 'ct-wrap--tunnel-ready'
                )}
                style={{ ...wrapperStyle, marginBottom: reserveBelowPx }}
                aria-hidden="true"
            >
                <style>{styles}</style>

                {debugGuides && (
                    <>
                        <div className="ct-guide ct-guide--mid" />
                        <div className="ct-guide ct-guide--under" />
                    </>
                )}

                {showAnchors && (
                    <div className="pointer-events-none absolute inset-0 z-[5]">
                        {/* MIRRORED: start/top on the LEFT */}
                        <div className="absolute left-0 top-[12px]">
                            <LineAnchor id="ct-start-left-top" position="left" offsetX={100} />
                        </div>
                        {/* Middle horizontal line - rides the title's lead-in (Bounded Journey) */}
                        <div className="absolute left-0 w-0" style={{ top: 'var(--ct-lead)' }}>
                            <LineAnchor id="ct-middle-left" position="left" offsetX={100} />
                        </div>
                        <div className="absolute right-0 w-0" style={{ top: 'var(--ct-lead)' }}>
                            <LineAnchor id="ct-middle-right" position="right" offsetX={100} />
                        </div>
                        {/* Under anchor on the RIGHT */}
                        <div className="absolute right-0 w-0" style={{ top: 'var(--ct-under)' }}>
                            <LineAnchor id="ct-under-right" position="right" offsetX={100} />
                        </div>
                        {/* Bottom anchor on the RIGHT */}
                        <div className="absolute right-0 bottom-[12px]">
                            <LineAnchor id="ct-bottom-right" position="right" offsetX={100} />
                        </div>

                        {/* SVG Tunnel ellipse around bottom anchor - layered rings with strokes */}
                        <svg
                            className="ct-tunnel-svg"
                            viewBox="0 0 100 20"
                            preserveAspectRatio="xMidYMid meet"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <defs>
                                {/* Main tunnel boundary - clips everything to the base ellipse */}
                                <clipPath id="tunnel-boundary">
                                    <ellipse cx="50" cy="10" rx="50" ry="10" />
                                </clipPath>
                            </defs>

                            {/* Group all rings inside the main tunnel boundary */}
                            <g clipPath="url(#tunnel-boundary)">
                                {/* Fill the base to create solid background */}
                                <ellipse
                                    className="ct-tunnel-ellipse"
                                    cx="50"
                                    cy="10"
                                    rx="50"
                                    ry="10"
                                    fill="rgba(255,255,255,0.05)"
                                />

                                {/* Ring outlines - each is a stroke showing the "step" */}
                                <ellipse
                                    className="ct-tunnel-ellipse"
                                    cx="50"
                                    cy="10"
                                    rx="50"
                                    ry="10"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.24)"
                                    strokeWidth="2.5"
                                />

                                <ellipse
                                    className="ct-tunnel-ellipse"
                                    cx="50"
                                    cy="11.5"
                                    rx="50"
                                    ry="10"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.20)"
                                    strokeWidth="1"
                                />

                                <ellipse
                                    className="ct-tunnel-ellipse"
                                    cx="50"
                                    cy="13"
                                    rx="50"
                                    ry="10"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.16)"
                                    strokeWidth="1"
                                />

                                <ellipse
                                    className="ct-tunnel-ellipse"
                                    cx="50"
                                    cy="14.5"
                                    rx="50"
                                    ry="10"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.12)"
                                    strokeWidth="1"
                                />

                                <ellipse
                                    className="ct-tunnel-ellipse"
                                    cx="50"
                                    cy="16"
                                    rx="50"
                                    ry="10"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.08)"
                                    strokeWidth="1"
                                />

                                <ellipse
                                    className="ct-tunnel-ellipse"
                                    cx="50"
                                    cy="17.5"
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

                <h1 className={clsx('ct-title', visible && 'ct-visible')}>
                    {allLines.map((words, lineIdx) => (
                        <span key={lineIdx} className="ct-line">
                            {words.map((word, wordIdx) => {
                                const idx = lineIdx * 10 + wordIdx;
                                const isLast = wordIdx === words.length - 1;

                                return (
                                    <React.Fragment key={`${lineIdx}-${wordIdx}-${word}`}>
                                        <span
                                            className="ct-word"
                                            style={
                                                {
                                                    ['--ct-i']: idx,
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