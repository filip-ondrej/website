'use client';

import * as React from 'react';
import { LineAnchor } from '@/components/00_LineAnchor';

type Props = {
    className?: string;
    top?: string;
    mid?: string;
    botLeft?: string;
    botGold?: string;
    fontScale?: number;
    lineDurationMs?: number;
    bladeDurationMs?: number;
    staggerMs?: number;
    threshold?: number;
    rootMargin?: string;
    /* Lead-in gap (vh) from the section top to where the spine turns horizontal.
       This is the dramatic empty space after the Hero. Clamped [180px, 460px] so
       it stays bounded on very short/tall screens. Lower = tighter top. */
    leadInVH?: number;
};

export default function TitleRevealPro({
                                           className,
                                           top = 'Think You Know What',
                                           mid = '‘Dedicated’',
                                           botLeft = 'Looks Like?',
                                           botGold = 'Watch This.',
                                           fontScale = 1.15,
                                           lineDurationMs = 1000,
                                           bladeDurationMs = 820,
                                           staggerMs = 160,
                                           threshold = 0.5,
                                           rootMargin = '0px 0px -2% 0px',
                                           leadInVH = 40,
                                       }: Props) {
    const wrapRef = React.useRef<HTMLDivElement | null>(null);
    const hasRevealedRef = React.useRef(false);

    React.useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;

        // start animation when visible
        const start = () => {
            if (hasRevealedRef.current || el.getAttribute('data-reveal') !== '0') return;
            hasRevealedRef.current = true;
            requestAnimationFrame(() => el.setAttribute('data-reveal', '1'));
        };

        const io = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    start();
                    io.disconnect();
                }
            },
            { threshold, rootMargin }
        );
        io.observe(el);

        return () => {
            io.disconnect();
        };
    }, [threshold, rootMargin]);

    return (
        <section
            className={`trp-section relative ${className ?? ''}`}
            style={{
                /* Height is content-driven (lead-in + offset + title + trailing),
                   NOT a flat vh box — a vh box made the trailing grow with screen
                   height; this keeps it small & consistent (Bounded-Journey model).
                   These MUST be inline (not styled-jsx): the line anchors measure
                   their position on mount, so the height has to exist at first
                   paint or the section collapses and the spine draws above it. */
                ['--trp-small' as string]: `calc(${fontScale} * 4.32rem)`,   // ≈ 4.8vw @1440
                ['--trp-xlarge' as string]: `calc(${fontScale} * 8.64rem)`,  // ≈ 9.6vw @1440
                ['--trp-block-h' as string]: 'calc((2 * var(--trp-small) + var(--trp-xlarge)) * 0.95)',
                ['--trp-lead' as string]: `clamp(180px, ${leadInVH}vh, 460px)`,
                ['--trp-trail' as string]: '0px',
                /* Line→title gap, width-scaled to mirror the spine's inset (= 100px
                   at 1440, no-op there) so it shrinks with the title instead of
                   staying a fixed 100px. Matches §4 TimelineTitle's --tt-gap law. */
                ['--trp-gap' as string]: 'clamp(18px, min(6.944vw, 6.25rem), 160px)',
                height: `calc(var(--trp-lead) + var(--trp-gap) + var(--trp-block-h) + var(--trp-trail))`,
                position: 'relative',
                overflow: 'clip',
                isolation: 'isolate',
            } as React.CSSProperties}
        >
            {/* ===== Anchors overlay (fills section) ===== */}
            <div className="pointer-events-none absolute inset-0 z-[10]">
                {/* Top: where the line enters this section */}
                <div className="absolute left-0 top-[40px]">
                    <LineAnchor id="titlereveal-top" position="left" offsetX={100} />
                </div>

                {/* Middle pair: horizontal run - at the end of the lead-in gap */}
                <div className="absolute left-0 w-0" style={{ top: 'var(--trp-lead)' }}>
                    <LineAnchor id="titlereveal-left" position="left" offsetX={100} />
                </div>
                <div className="absolute right-0 w-0" style={{ top: 'var(--trp-lead)' }}>
                    <LineAnchor id="titlereveal-right" position="right" offsetX={100} />
                </div>

                {/* Below point: line→title gap below the horizontal line */}
                <div className="absolute left-0 w-0" style={{ top: `calc(var(--trp-lead) + var(--trp-gap))` }}>
                    <LineAnchor id="titlereveal-below" position="right" offsetX={100} />
                </div>

                {/* Bottom: where the line exits this section */}
                <div className="absolute right-0 bottom-[40px]">
                    <LineAnchor id="titlereveal-bottom" position="right" offsetX={100} />
                </div>
            </div>

            {/* Title positioned below the horizontal line */}
            <div
                ref={wrapRef}
                className="trp-wrap"
                data-reveal="0"
                aria-label="Intro title"
                style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    /* Sits a width-scaled gap below the spine's horizontal run. The
                       section grows to fit it (see .trp-section height), so it
                       can't clip and needs no height-based lift hack. */
                    top: `calc(var(--trp-lead) + var(--trp-gap))`,
                    width: '100%',
                    /* Stay inside the gutters so the title never overlaps the
                       progressline spine (which sits at 6.25rem from each edge). */
                    maxWidth: 'min(calc(100vw - 2 * var(--gutter)), 1400px)',
                    textAlign: 'center',
                    pointerEvents: 'none',
                }}
            >
                <div>
                    <h1 className="trp-title">
                        <span className="trp-line trp-small">
                            {top}
                        </span>
                        <span className="trp-line trp-xlarge trp-gold">{mid}</span>
                        <span className="trp-line trp-small">
                            {botLeft} <span className="trp-gold">{botGold}</span>
                        </span>
                    </h1>
                </div>
            </div>

            <style jsx>{`
        .trp-title {
          margin: 0;
          font-family: var(--font-sans, Rajdhani), sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          line-height: 0.92;
          color: rgba(255, 255, 255, 0.94);
          font-weight: 900;
          transform: translateZ(0);
        }
        .trp-line {
          display: block;
          margin: 0.04em 0;
          will-change: transform, opacity;
        }

        /* Width-only sizing: the type rides the fluid root (vars defined inline on
           .trp-section) and no longer shrinks with viewport HEIGHT — that was the
           scaling inconsistency vs. the Hero. The section grows to fit the type,
           so there's no clipping to compensate for. */
        .trp-small {
          font-weight: 800;
          font-size: var(--trp-small);
        }
        .trp-xlarge {
          font-weight: 900;
          font-size: var(--trp-xlarge);
        }

        .trp-gold {
          background: linear-gradient(
            135deg,
            #fef3c7 0%,
            #fde047 25%,
            #ffd60a 50%,
            #f59e0b 75%,
            #b45309 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* pre state */
        .trp-wrap[data-reveal='0'] .trp-line {
          opacity: 0;
          transform: translateY(16px) scale(0.982);
        }

        /* split-blade animation */
        .trp-wrap[data-reveal='1'] .trp-line {
          animation: trpBladeRise ${lineDurationMs}ms
            cubic-bezier(0.19, 1, 0.22, 1) forwards;
          position: relative;
          overflow: hidden;
        }
        .trp-wrap[data-reveal='1'] .trp-line:nth-child(2) {
          animation-delay: ${staggerMs}ms;
        }
        .trp-wrap[data-reveal='1'] .trp-line:nth-child(3) {
          animation-delay: ${staggerMs * 2}ms;
        }

        .trp-wrap .trp-line::before,
        .trp-wrap .trp-line::after {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--color-bg, #0b0b0d);
          z-index: 3;
        }
        .trp-wrap .trp-line::before {
          transform-origin: left center;
          clip-path: polygon(0 0, 52% 0, 48% 100%, 0 100%);
        }
        .trp-wrap .trp-line::after {
          transform-origin: right center;
          clip-path: polygon(52% 0, 100% 0, 100% 100%, 48% 100%);
        }

        .trp-wrap[data-reveal='1'] .trp-line::before {
          animation: trpBladeLeft ${bladeDurationMs}ms
            cubic-bezier(0.19, 1, 0.22, 1) forwards;
        }
        .trp-wrap[data-reveal='1'] .trp-line::after {
          animation: trpBladeRight ${bladeDurationMs}ms
            cubic-bezier(0.19, 1, 0.22, 1) forwards;
        }
        .trp-wrap[data-reveal='1'] .trp-line:nth-child(2)::before,
        .trp-wrap[data-reveal='1'] .trp-line:nth-child(2)::after {
          animation-delay: ${staggerMs}ms;
        }
        /* Line 3's blade must stagger with its rise (delay = 2× stagger);
           without this the bottom line's wipe fired early and out of sync. */
        .trp-wrap[data-reveal='1'] .trp-line:nth-child(3)::before,
        .trp-wrap[data-reveal='1'] .trp-line:nth-child(3)::after {
          animation-delay: ${staggerMs * 2}ms;
        }

        @keyframes trpBladeRise {
          0% {
            opacity: 0;
            transform: translateY(16px) scale(0.982);
          }
          65% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes trpBladeLeft {
          to {
            transform: translateX(-100%);
          }
        }
        @keyframes trpBladeRight {
          to {
            transform: translateX(100%);
          }
        }

        @media (max-width: 768px) {
          .trp-wrap {
            max-width: calc(100vw - 2 * var(--gutter)) !important;
          }
        }
        /* XXS phones: drop the desktop px floors so the title shrinks with the
           narrow viewport. Caps match the base floors (28px / 48px) so the size
           is CONTINUOUS at the 480px boundary (no upward bump) and only shrinks
           below it. */
        @media (max-width: 480px) {
          .trp-small  { font-size: calc(${fontScale} * clamp(16px, 5.8vw, 28px)); }
          .trp-xlarge { font-size: calc(${fontScale} * clamp(26px, 10vw, 48px)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .trp-wrap[data-reveal] .trp-line {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .trp-line::before,
          .trp-line::after {
            display: none !important;
          }
        }
      `}</style>
        </section>
    );
}