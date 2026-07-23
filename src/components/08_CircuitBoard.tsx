'use client';

import * as React from 'react';
import { LineAnchor } from '@/components/00_LineAnchor';
import {
    BOARD_COPPER_PATH,
    BOARD_WIDTH,
    BOARD_HEIGHT,
    BOARD_FIELD,
    FIELD_WIDTH,
    FIELD_HEIGHT,
} from './08_CircuitBoardArt';

const SPINE_OFFSET_PX = 100;

// Width of the soft leading edge, in field units (the field spans 0..1). This is
// the whole "travelling front" effect: everything behind it is lit, everything
// ahead is dark, and the ramp between is what reads as the signal arriving.
const FRONT_SOFTNESS = 0.055;

// feComponentTransfer computes out = slope * in + intercept, then clamps to
// [0,1]. We want the mask to be 1 where the field is already behind the front:
//
//   mask = (progress - field) / softness
//        = (-1 / softness) * field + progress / softness
//
// so the slope is fixed and only the intercept moves as you scroll. The front is
// driven one softness-width past 1.0, otherwise the trailing edge of the ramp
// stops exactly on the farthest copper and it never reaches full brightness.
const TRANSFER_SLOPE = -1 / FRONT_SOFTNESS;
const interceptFor = (progress: number) => (progress * (1 + FRONT_SOFTNESS)) / FRONT_SOFTNESS;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

type CircuitBoardProps = {
    className?: string;
    /**
     * Fraction of the section's height over which the board finishes lighting up.
     * 1 = the last trace lights as the tip leaves the section; 0.75 = done a
     * quarter early, leaving the fully-lit board on screen for a beat.
     */
    revealSpan?: number;
    /** Render the shared spine anchors. */
    anchors?: boolean;
    /** Optional caption rendered under the board. */
    caption?: React.ReactNode;
};

export default function CircuitBoard({
                                         className,
                                         revealSpan = 0.85,
                                         anchors = true,
                                         caption,
                                     }: CircuitBoardProps) {
    const sectionRef = React.useRef<HTMLElement | null>(null);
    const funcRefs = React.useRef<(SVGElement | null)[]>([]);

    // ---- PER-FRAME IMPERATIVE DRAW ----
    // Same reasoning as ProgressLine: the reveal is written straight to the SVG
    // DOM from rAF (pre-paint), so the front and the page move in one paint.
    // Routing this through React state put the front a frame behind the scroll.
    React.useEffect(() => {
        const section = sectionRef.current;
        if (!section) return;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

        let rafId = 0;
        let lastDrawn = Number.NaN;

        const write = (progress: number) => {
            const intercept = String(interceptFor(progress));
            for (const el of funcRefs.current) {
                el?.setAttribute('intercept', intercept);
            }
        };

        // Cached so the rAF loop never forces a layout. Refreshed on the same
        // signals ProgressLine rebuilds its own geometry on.
        let top = 0;
        let span = 1;

        const measure = () => {
            const rect = section.getBoundingClientRect();
            top = rect.top + (window.scrollY || window.pageYOffset || 0);
            span = Math.max(1, rect.height * revealSpan);
        };

        const measureProgress = () => {
            // ProgressLine publishes its tip in document coordinates. Without it
            // (component used on its own, or before the line mounts) fall back to
            // the section's own travel through the viewport.
            const scrollY = window.scrollY || window.pageYOffset || 0;
            const tipY =
                typeof window.progressTipY === 'number'
                    ? window.progressTipY
                    : scrollY + window.innerHeight * 0.75;

            return clamp01((tipY - top) / span);
        };

        const loop = () => {
            if (reduceMotion.matches) {
                if (lastDrawn !== 1) {
                    lastDrawn = 1;
                    write(1);
                }
            } else {
                const progress = measureProgress();
                if (Number.isNaN(lastDrawn) || Math.abs(progress - lastDrawn) >= 0.0005) {
                    lastDrawn = progress;
                    write(progress);
                }
            }
            rafId = requestAnimationFrame(loop);
        };

        measure();
        write(reduceMotion.matches ? 1 : measureProgress());
        rafId = requestAnimationFrame(loop);

        const resync = () => {
            measure();
            lastDrawn = Number.NaN;
        };

        // The board sits below other sections, so anything that reflows the page
        // moves it — not just a window resize.
        const observer =
            typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resync) : null;
        observer?.observe(document.body);

        window.addEventListener('resize', resync);
        window.addEventListener('anchors-updated', resync);
        reduceMotion.addEventListener?.('change', resync);

        return () => {
            cancelAnimationFrame(rafId);
            observer?.disconnect();
            window.removeEventListener('resize', resync);
            window.removeEventListener('anchors-updated', resync);
            reduceMotion.removeEventListener?.('change', resync);
        };
    }, [revealSpan]);

    const registerFunc = (index: number) => (el: SVGElement | null) => {
        funcRefs.current[index] = el;
    };

    return (
        <section
            ref={sectionRef}
            className={['cb-section', className].filter(Boolean).join(' ')}
            aria-label="Printed circuit board artwork"
        >
            {anchors && (
                <>
                    <div className="cb-anchor cb-anchor-top" aria-hidden="true">
                        <LineAnchor id="circuit-top" position="right" offsetX={SPINE_OFFSET_PX} />
                    </div>
                    <div className="cb-anchor cb-anchor-bottom" aria-hidden="true">
                        <LineAnchor id="circuit-bottom" position="right" offsetX={SPINE_OFFSET_PX} />
                    </div>
                </>
            )}

            <figure className="cb-figure">
                <svg
                    className="cb-board"
                    viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
                    preserveAspectRatio="xMidYMid meet"
                    role="img"
                    aria-labelledby="cb-title cb-desc"
                >
                    <title id="cb-title">Printed circuit board — copper layer</title>
                    <desc id="cb-desc">
                        Photoplot of a densely routed printed circuit board: a large ground pour, fine
                        signal traces, component footprints, mounting holes and edge cut-outs. The copper
                        lights up along its own routing as the page scrolls.
                    </desc>

                    <defs>
                        {/*
                          Turns the propagation field into a hard-ish reveal mask. sRGB is
                          required: under the default linearRGB the threshold would land at
                          the wrong place and the front would move non-uniformly.
                        */}
                        <filter
                            id="cb-threshold"
                            x="0"
                            y="0"
                            width="100%"
                            height="100%"
                            colorInterpolationFilters="sRGB"
                        >
                            <feComponentTransfer>
                                <feFuncR ref={registerFunc(0)} type="linear" slope={TRANSFER_SLOPE} intercept={0} />
                                <feFuncG ref={registerFunc(1)} type="linear" slope={TRANSFER_SLOPE} intercept={0} />
                                <feFuncB ref={registerFunc(2)} type="linear" slope={TRANSFER_SLOPE} intercept={0} />
                            </feComponentTransfer>
                        </filter>

                        {/*
                          The filter runs in the image's own 432x334 user space and only
                          the result is scaled up, so the per-frame filter work stays small
                          no matter how wide the board is rendered.
                        */}
                        <mask
                            id="cb-reveal"
                            maskUnits="userSpaceOnUse"
                            x="0"
                            y="0"
                            width={BOARD_WIDTH}
                            height={BOARD_HEIGHT}
                        >
                            <g transform={`scale(${BOARD_WIDTH / FIELD_WIDTH} ${BOARD_HEIGHT / FIELD_HEIGHT})`}>
                                <image
                                    href={BOARD_FIELD}
                                    width={FIELD_WIDTH}
                                    height={FIELD_HEIGHT}
                                    preserveAspectRatio="none"
                                    filter="url(#cb-threshold)"
                                />
                            </g>
                        </mask>
                    </defs>

                    {/* Unpowered copper — always present, so the board reads as a board. */}
                    <path className="cb-copper" d={BOARD_COPPER_PATH} />

                    {/* The same copper, revealed only as far as the signal has travelled. */}
                    <path className="cb-copper-live" d={BOARD_COPPER_PATH} mask="url(#cb-reveal)" />
                </svg>

                {caption ? <figcaption className="cb-caption">{caption}</figcaption> : null}
            </figure>

            <style jsx>{`
                .cb-section {
                    --cb-copper-idle: rgba(255, 255, 255, 0.17);
                    --cb-copper-live: #ffffff;
 
                    position: relative;
                    width: 100%;
                    overflow: hidden;
                    isolation: isolate;
                }
 
                .cb-anchor {
                    position: absolute;
                    right: 0;
                    z-index: 5;
                    pointer-events: none;
                }
 
                .cb-anchor-top {
                    top: 0;
                }
 
                .cb-anchor-bottom {
                    bottom: 0;
                }
 
                .cb-figure {
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1.25rem;
                }
 
                .cb-board {
                    display: block;
                    width: 100%;
                    height: auto;
                    max-height: 84vh;
                    pointer-events: none;
                    shape-rendering: geometricPrecision;
                }
 
                .cb-copper {
                    fill: var(--cb-copper-idle);
                    fill-rule: nonzero;
                }
 
                .cb-copper-live {
                    fill: var(--cb-copper-live);
                    fill-rule: nonzero;
                }
 
                .cb-caption {
                    margin: 0 0 2rem;
                    padding: 0 1.5rem;
                    max-width: 46ch;
                    text-align: center;
                    text-wrap: balance;
                    font-size: 0.8125rem;
                    line-height: 1.6;
                    letter-spacing: 0.04em;
                    color: rgba(255, 255, 255, 0.46);
                }
 
                @media (prefers-reduced-motion: reduce) {
                    .cb-copper {
                        fill: rgba(255, 255, 255, 0.44);
                    }
                }
            `}</style>
        </section>
    );
}
