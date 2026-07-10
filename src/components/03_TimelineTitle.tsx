'use client';

import * as React from 'react';
import clsx from 'clsx';
import { LineAnchor } from '@/components/00_LineAnchor';
import { useScrollProgress, useChasingTypewriter } from '@/lib/titleTypewriter';

type TitleHeaderProps = {
    lines?: string[];
    className?: string;
    scale?: number;               // font size multiplier
    rightOffsetPx?: number;       // horizontal offset of the title from the RIGHT edge
    reserveBelowPx?: number;      // real spacing below the title section to separate timeline (default 96)
    showAnchors?: boolean;
    debugGuides?: boolean;

    /** NEW — typing controls */
    typingMsPerChar?: number;     // default 50
    startThreshold?: number;      // IntersectionObserver threshold to start (default 0.35)
    startRootMargin?: string;     // IO rootMargin (default '0px 0px -10% 0px')
    startDelayMs?: number;        // optional start delay after intersect (default 0)
};

/* ================= Styles ================= */
const styles = `
.tt-wrap {
  position: relative; width: 100%;
  container-type: inline-size;
  isolation: isolate;
  z-index: 1;
  /* Bounded Journey: content-driven height = compact lead-in + title + small
     trailing, instead of a fixed ~2x-tall box. The lead-in is constant across
     all title sections regardless of line count, so every gap matches and
     nothing clips at any width. */
  display: flex;
  flex-direction: column;
  padding-top: calc(var(--tt-lead) + var(--tt-gap));
  padding-bottom: var(--tt-trail);
}

/* Title block: in normal flow, RIGHT-aligned — the mirrored journey descends
   the right side, and the title hugs the line with the same inset law the
   other titles use (offset from the spine == the line→title gap). */
.tt-title {
  position: relative;
  margin: 0 var(--tt-right) 0 auto;
  text-align: right;

  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.04em;

  font-family: var(--font-sans, Rajdhani), monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 0.92;
  color: rgba(255,255,255,0.94);
  font-weight: 900;
  pointer-events: none;

  /* --tt-scale and --tt-right are set inline on .tt-wrap from the scale and
     rightOffsetPx props (prop-driven, fluid, no-op at the 1440 reference). They
     used to be hardcoded here, which silently overrode the props — removed. */
  --tt-size: calc(var(--tt-scale) * clamp(64px, 8.4cqi, 160px));
}
@supports not (font-size: 1cqi) {
  .tt-title { --tt-size: calc(var(--tt-scale) * clamp(64px, 8.4vw, 160px)); }
}

.tt-line { display:block; font-size: var(--tt-size); }

.tt-gold {
  background: linear-gradient(135deg,#FEF3C7 0%,#FDE047 25%,#FFD60A 50%,#F59E0B 75%,#B45309 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 12px rgba(255,214,10,0.35));
  animation: ttGoldShimmer 3s ease-in-out infinite;
}
@keyframes ttGoldShimmer { 0%,100%{filter:drop-shadow(0 0 8px rgba(255,214,10,0.4))} 50%{filter:drop-shadow(0 0 12px rgba(255,214,10,0.6))} }

.tt-ch { display:inline-block; opacity:0; }
.tt-ch--v { opacity:1; }

/* Cursor takes ZERO net layout width (margin-right compensates width+gap):
   it overhangs after the last typed char instead of widening the line. With
   the right-aligned title, an in-flow cursor made whichever line carried it
   7px wider — so the lines' right edges never matched. */
.tt-cur { display:inline-block; width:3px; height:0.9em; background: rgba(255,255,255,0.9); margin-left:4px; margin-right:-7px; vertical-align:middle; opacity:0; }
.tt-cur--typing { opacity:1; animation:none; }
.tt-cur--paused { opacity:1; animation: ttBlink .8s step-end infinite; }
.tt-cur--done   { opacity:1; animation: ttBlink .8s step-end 4, ttFade .6s ease-out 2.5s forwards; }
@keyframes ttBlink { 0%,50%{opacity:1} 51%,100%{opacity:0} }
@keyframes ttFade { to { opacity:0 } }

/* optional debug guides */
.tt-guide { position:absolute; left:0; right:0; height:1px; background: rgba(255,255,255,0.25); pointer-events:none; z-index: 100; }
.tt-guide--mid    { top: 50%; }
.tt-guide--under  { top: var(--tt-under); }

@media (prefers-reduced-motion: reduce) {
  .tt-gold { animation: none !important; }
  .tt-cur  { animation: none !important; }
}
`;

export default function TimelineTitle({
                                          lines = ['Every Lesson.', 'Every Pivot.', 'Every Win.'],
                                          className,
                                          scale = 0.785,
                                          rightOffsetPx = 200,
                                          reserveBelowPx = 96,
                                          showAnchors = true,
                                          debugGuides = false,

                                          // NEW defaults
                                          typingMsPerChar = 75,
                                          startThreshold = 0.5,
                                          startRootMargin = '0px 0px -10% 0px',
                                          startDelayMs = 0,
                                      }: TitleHeaderProps) {
    const ref = React.useRef<HTMLDivElement | null>(null);

    // Respect prefers-reduced-motion. The typewriter reveal + cursor are JS-driven,
    // so the CSS @media block can't disable them; we short-circuit to the fully-typed
    // title, statically, with no scroll animation. (Same a11y gap as §3 PromoVideo.)
    const [reducedMotion, setReducedMotion] = React.useState(false);
    React.useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const apply = () => setReducedMotion(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);

    // One-time completion latch (set at 80% of gated progress, below). Declared up
    // here so it can freeze the scroll listener once typing is done.
    const [lockedComplete, setLockedComplete] = React.useState(false);

    // Start gate: begin typing only once the section actually enters the viewport
    const [started, setStarted] = React.useState(false);
    React.useEffect(() => {
        const el = ref.current;
        if (!el || started) return;

        const io = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    const fire = () => setStarted(true);
                    if (startDelayMs > 0) {
                        window.setTimeout(fire, startDelayMs);
                    } else {
                        fire();
                    }
                    io.disconnect();
                }
            },
            { threshold: startThreshold, rootMargin: startRootMargin }
        );

        io.observe(el);
        return () => io.disconnect();
    }, [started, startThreshold, startRootMargin, startDelayMs]);

    const { progress, isPaused } = useScrollProgress(ref, lockedComplete || reducedMotion);
    const gatedProgress = started ? progress : 0;

    const totalChars = React.useMemo(
        () => lines.reduce((s, l) => s + l.length, 0),
        [lines]
    );

    // Latch completion once we're 80% through the gated scroll progress.
    React.useEffect(() => {
        if (!lockedComplete && started && gatedProgress >= 0.8) setLockedComplete(true);
    }, [gatedProgress, started, lockedComplete]);

    const targetChars = React.useMemo(
        () => (lockedComplete ? totalChars : Math.floor(gatedProgress * totalChars)),
        [gatedProgress, totalChars, lockedComplete]
    );

    const animatedTyped = useChasingTypewriter(
        targetChars,
        typingMsPerChar,
        lockedComplete ? totalChars : undefined
    );
    // Reduced motion: jump straight to the fully-typed title, no animation.
    const typedChars = reducedMotion ? totalChars : animatedTyped;

    const visible = React.useMemo(() => {
        let remaining = typedChars;
        return lines.map(line => {
            const c = Math.min(line.length, Math.max(0, remaining));
            remaining -= line.length;
            return c;
        });
    }, [typedChars, lines]);

    const allDone = reducedMotion || (lockedComplete && typedChars === totalChars);

    // Shared CSS variables. Bounded Journey: the line + title sit at a compact,
    // constant lead-in from the top (not 50% of a tall box), so the gap matches
    // the other title sections regardless of line count. The section is fully
    // content-driven (the legacy fixed `height` prop has been removed).
    const wrapperStyle: React.CSSProperties & {
        ['--tt-scale']: string;
        ['--tt-right']: string;
        ['--tt-spine-x']: string;
        ['--tt-lead']: string;
        ['--tt-gap']: string;
        ['--tt-trail']: string;
        ['--tt-under']: string;
    } = {
        ['--tt-scale']: String(scale),
        // Fluid RIGHT offset (mirrored journey — the line descends the right side).
        // clamp floors at gutter, caps at rem; tracks the same vw so it stays glued
        // to the spine on resize. No-op at 1440.
        ['--tt-right']: `clamp(var(--gutter), ${rightOffsetPx / 14.4}vw, ${rightOffsetPx / 16}rem)`,
        // The vertical spine's x-position, mirroring 00_LineAnchor's uiScale exactly
        // (100px * min(innerWidth/1440, rootFont/16), clamped [0.18,1.6]). In CSS:
        // 100*widthScale = 100vw/14.4 = 6.944vw; 100*fontScale = 6.25rem. So the
        // anchor sits at clamp(18px, min(6.944vw, 6.25rem), 160px) from the edge.
        ['--tt-spine-x']: 'clamp(18px, min(6.944vw, 6.25rem), 160px)',
        // lead-in (space above the line) — compact, the gap from the previous section
        ['--tt-lead']: 'clamp(140px, 26vh, 300px)',
        // line-to-title gap == the title's RIGHT inset (spine→title), so the top and
        // right distances stay equal and both scale with width. = 100px at 1440 (no-op).
        ['--tt-gap']: 'calc(var(--tt-right) - var(--tt-spine-x))',
        // trailing below the title: title-bottom → graph-crossing distance equals
        // --tt-gap (the same gap as crossing → title-top above), so the title sits
        // symmetrically between the two horizontal runs. 25px = the graph's
        // HORIZONTAL_LINE_Y (its crossing sits 25px below the section top); 8px =
        // optical correction for the font's descender space below the last line
        // (geometric equality read ~8px looser below). reserveBelowPx must be 0
        // for the equality to hold (see page.tsx).
        ['--tt-trail']: 'max(0px, calc(var(--tt-gap) - 25px - 8px))',
        // title top / under-anchor point
        ['--tt-under']: 'calc(var(--tt-lead) + var(--tt-gap))',
    };

    return (
        <>
            <div
                ref={ref}
                className={clsx('tt-wrap', className)}
                style={{ ...wrapperStyle, marginBottom: reserveBelowPx }}
                aria-hidden="true"
            >
                <style>{styles}</style>

                {debugGuides && (
                    <>
                        <div className="tt-guide tt-guide--mid" />
                        <div className="tt-guide tt-guide--under" />
                    </>
                )}

                {/* Anchors — MIRRORED journey (section reorder): the line now arrives from
                    Projects on the LEFT, crosses L→R above the title, and descends the
                    RIGHT side into the graph. Title alignment is deliberately untouched. */}
                {showAnchors && (
                    <div className="pointer-events-none absolute inset-0 z-[5]">
                        <div className="absolute left-0 top-[12px]">
                            <LineAnchor id="tt-start-left-top" position="left" offsetX={100} />
                        </div>
                        {/* Middle horizontal line - rides the title's lead-in (Bounded Journey) */}
                        <div className="absolute left-0 w-0" style={{ top: 'var(--tt-lead)' }}>
                            <LineAnchor id="tt-middle-left" position="left" offsetX={100} />
                        </div>
                        <div className="absolute right-0 w-0" style={{ top: 'var(--tt-lead)' }}>
                            <LineAnchor id="tt-middle-right" position="right" offsetX={100} />
                        </div>
                        {/* Under anchor - at the title top (lead + gap), on the descending side */}
                        <div className="absolute right-0 w-0" style={{ top: 'var(--tt-under)' }}>
                            <LineAnchor id="tt-under-right" position="right" offsetX={100} />
                        </div>
                        <div className="absolute right-0 bottom-[12px]">
                            <LineAnchor id="tt-bottom-right" position="right" offsetX={100} />
                        </div>
                    </div>
                )}

                {/* Title — in normal flow (Bounded Journey), offset left by --tt-left */}
                <h1 className="tt-title">
                    {/* Line 1 */}
                    <span className="tt-line">
                        {lines[0].split('').map((ch, i) => (
                            <React.Fragment key={`l0-${i}`}>
                                <span className={clsx('tt-ch', i < (visible[0] ?? 0) && 'tt-ch--v')}>
                                    {ch === ' ' ? '\u00A0' : ch}
                                </span>
                                {/* Show cursor right after this character if it's the last visible one */}
                                {!allDone &&
                                    i === (visible[0] ?? 0) - 1 &&
                                    typedChars > 0 &&
                                    typedChars <= lines[0].length && (
                                        <span className={clsx('tt-cur', isPaused ? 'tt-cur--paused' : 'tt-cur--typing')} />
                                    )}
                            </React.Fragment>
                        ))}
                    </span>

                    {/* Line 2 */}
                    <span className="tt-line">
                        {lines[1].split('').map((ch, i) => (
                            <React.Fragment key={`l1-${i}`}>
                                <span className={clsx('tt-ch', i < (visible[1] ?? 0) && 'tt-ch--v')}>
                                    {ch === ' ' ? '\u00A0' : ch}
                                </span>
                                {/* Show cursor right after this character if it's the last visible one */}
                                {!allDone &&
                                    i === (visible[1] ?? 0) - 1 &&
                                    typedChars > lines[0].length &&
                                    typedChars <= lines[0].length + lines[1].length && (
                                        <span className={clsx('tt-cur', isPaused ? 'tt-cur--paused' : 'tt-cur--typing')} />
                                    )}
                            </React.Fragment>
                        ))}
                    </span>

                    {/* Line 3 — gold */}
                    <span className={clsx('tt-line', 'tt-gold')}>
                        {lines[2].split('').map((ch, i) => (
                            <React.Fragment key={`l2-${i}`}>
                                <span className={clsx('tt-ch', i < (visible[2] ?? 0) && 'tt-ch--v')}>
                                    {ch === ' ' ? '\u00A0' : ch}
                                </span>
                                {/* Show cursor right after this character if it's the last visible one */}
                                {!allDone &&
                                    i === (visible[2] ?? 0) - 1 &&
                                    typedChars > lines[0].length + lines[1].length &&
                                    typedChars <= totalChars && (
                                        <span className={clsx('tt-cur', isPaused ? 'tt-cur--paused' : 'tt-cur--typing')} />
                                    )}
                            </React.Fragment>
                        ))}
                        {/* Final cursor animation when done (skipped under reduced motion) */}
                        {allDone && !reducedMotion && <span className="tt-cur tt-cur--done" />}
                    </span>
                </h1>
            </div>
        </>
    );
}