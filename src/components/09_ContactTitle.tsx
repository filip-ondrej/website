'use client';

import * as React from 'react';
import clsx from 'clsx';
import { LineAnchor } from '@/components/00_LineAnchor';
import { useScrollProgress, useChasingTypewriter } from '@/lib/titleTypewriter';

type ContactTitleProps = {
    lines?: string[];
    className?: string;
    scale?: number;               // font size multiplier
    leftOffsetPx?: number;        // horizontal offset of the title
    reserveBelowPx?: number;      // spacing below the title section
    showAnchors?: boolean;
    debugGuides?: boolean;

    /** typing controls */
    typingMsPerChar?: number;     // default 50–75
    startThreshold?: number;      // IO threshold to start
    startRootMargin?: string;     // IO rootMargin
    startDelayMs?: number;        // delay after intersect
};

/* ================= Styles ================= */
const styles = `
.cft-wrap {
  position: relative; width: 100%;
  container-type: inline-size;
  isolation: isolate;
  z-index: 1;
  display: flex;
  flex-direction: column;
  padding-top: calc(var(--cft-lead) + var(--cft-gap));
  padding-bottom: var(--cft-trail);
}

/* Title block — normal flow, offset left by --cft-left */
.cft-title {
  position: relative;
  margin: 0 0 0 var(--cft-left);

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

  /* --cft-scale and --cft-left are set inline on .cft-wrap from the scale and
     leftOffsetPx props (prop-driven, no-op at the 1440 reference). */
  --cft-size: calc(var(--cft-scale) * clamp(64px, 8.4cqi, 160px));
}
@supports not (font-size: 1cqi) {
  .cft-title { --cft-size: calc(var(--cft-scale) * clamp(64px, 8.4vw, 160px)); }
}

.cft-line { display:block; font-size: var(--cft-size); }

.cft-ch { display:inline-block; opacity:0; }
.cft-ch--v { opacity:1; }

.cft-cur {
  display:inline-block;
  width:3px;
  height:0.9em;
  background: rgba(255,255,255,0.9);
  margin-left:4px;
  vertical-align:middle;
  opacity:0;
}
.cft-cur--typing { opacity:1; animation:none; }
.cft-cur--paused { opacity:1; animation: cftBlink .8s step-end infinite; }
.cft-cur--done   { opacity:1; animation: cftBlink .8s step-end 4, cftFade .6s ease-out 2.5s forwards; }

@keyframes cftBlink { 0%,50%{opacity:1} 51%,100%{opacity:0} }
@keyframes cftFade { to { opacity:0 } }

/* optional debug guides */
.cft-guide {
  position:absolute;
  left:0; right:0;
  height:1px;
  background: rgba(255,255,255,0.25);
  pointer-events:none;
  z-index: 100;
}
.cft-guide--mid    { top: 50%; }
.cft-guide--under  { top: var(--cft-under); }

@media (prefers-reduced-motion: reduce) {
  .cft-cur  { animation: none !important; }
}
`;

export default function ContactTitle({
                                         lines = ["LET'S WORK", 'TOGETHER'],
                                         className,
                                         scale = 0.785,
                                         leftOffsetPx = 200,
                                         reserveBelowPx = 30,
                                         showAnchors = true,
                                         debugGuides = false,

                                         typingMsPerChar = 75,
                                         startThreshold = 0.5,
                                         startRootMargin = '0px 0px -10% 0px',
                                         startDelayMs = 0,
                                     }: ContactTitleProps) {
    const ref = React.useRef<HTMLDivElement | null>(null);

    // Respect prefers-reduced-motion. The typewriter reveal + cursor are JS-driven,
    // so the CSS @media block can't disable them; we short-circuit to the fully-typed
    // title, statically, with no scroll animation.
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

    // Start gate: begin typing once the section enters the viewport
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
            { threshold: startThreshold, rootMargin: startRootMargin },
        );

        io.observe(el);
        return () => io.disconnect();
    }, [started, startThreshold, startRootMargin, startDelayMs]);

    const { progress, isPaused } = useScrollProgress(ref, lockedComplete || reducedMotion);
    const gatedProgress = started ? progress : 0;

    const totalChars = React.useMemo(
        () => lines.reduce((s, l) => s + l.length, 0),
        [lines],
    );

    // Latch completion once we're 80% through the gated scroll progress.
    React.useEffect(() => {
        if (!lockedComplete && started && gatedProgress >= 0.8)
            setLockedComplete(true);
    }, [gatedProgress, started, lockedComplete]);

    const targetChars = React.useMemo(
        () =>
            lockedComplete
                ? totalChars
                : Math.floor(gatedProgress * totalChars),
        [gatedProgress, totalChars, lockedComplete],
    );

    const animatedTyped = useChasingTypewriter(
        targetChars,
        typingMsPerChar,
        lockedComplete ? totalChars : undefined,
    );
    // Reduced motion: jump straight to the fully-typed title, no animation.
    const typedChars = reducedMotion ? totalChars : animatedTyped;

    const visible = React.useMemo(() => {
        let remaining = typedChars;
        return lines.map((line) => {
            const c = Math.min(line.length, Math.max(0, remaining));
            remaining -= line.length;
            return c;
        });
    }, [typedChars, lines]);

    const allDone = reducedMotion || (lockedComplete && typedChars === totalChars);

    // CSS vars
    const wrapperStyle: React.CSSProperties & {
        ['--cft-scale']: string;
        ['--cft-left']: string;
        ['--cft-spine-x']: string;
        ['--cft-under']: string;
        ['--cft-lead']: string;
        ['--cft-gap']: string;
        ['--cft-trail']: string;
    } = {
        ['--cft-scale']: String(scale),
        // Fluid offset (see --cft-left in styles): floors at gutter, caps at rem, tracks vw
        // so it stays aligned to the spine on resize. No-op at 1440.
        ['--cft-left']: `clamp(var(--gutter), ${leftOffsetPx / 14.4}vw, ${leftOffsetPx / 16}rem)`,
        // The vertical spine's x-position, mirroring 00_LineAnchor's uiScale exactly.
        ['--cft-spine-x']: 'clamp(18px, min(6.944vw, 6.25rem), 160px)',
        ['--cft-lead']: 'clamp(140px, 26vh, 300px)',
        // line→title gap == the title's LEFT inset (spine→title), so top & left stay
        // equal and both scale with width. = 100px at 1440 (no-op).
        ['--cft-gap']: 'calc(var(--cft-left) - var(--cft-spine-x))',
        ['--cft-trail']: 'clamp(20px, 4vh, 50px)',
        ['--cft-under']: 'calc(var(--cft-lead) + var(--cft-gap))',
    };

    return (
        <div
            ref={ref}
            className={clsx('cft-wrap', className)}
            style={{
                ...wrapperStyle,
                marginBottom: reserveBelowPx,
            }}
            aria-hidden="true"
        >
            <style>{styles}</style>

            {debugGuides && (
                <>
                    <div className="cft-guide cft-guide--mid" />
                    <div className="cft-guide cft-guide--under" />
                </>
            )}

            {showAnchors && (
                <div className="pointer-events-none absolute inset-0 z-[5]">
                    <div className="absolute right-0 top-[12px]">
                        <LineAnchor id="cft-start-right-top" position="right" offsetX={100} />
                    </div>
                    <div className="absolute right-0 w-0" style={{ top: 'var(--cft-lead)' }}>
                        <LineAnchor id="cft-middle-right" position="right" offsetX={100} />
                    </div>
                    <div className="absolute left-0 w-0" style={{ top: 'var(--cft-lead)' }}>
                        <LineAnchor id="cft-middle-left" position="left" offsetX={100} />
                    </div>
                    <div className="absolute left-0 w-0" style={{ top: 'var(--cft-under)' }}>
                        <LineAnchor id="cft-under-left" position="left" offsetX={100} />
                    </div>
                    <div className="absolute left-0 bottom-[12px]">
                        <LineAnchor id="cft-bottom-left" position="left" offsetX={100} />
                    </div>
                </div>
            )}

            <h1 className="cft-title">
                {(() => {
                    let charsBefore = 0;
                    return lines.map((line, li) => {
                        const start = charsBefore;
                        charsBefore += line.length;
                        const lineVisible = visible[li] ?? 0;
                        const isLastLine = li === lines.length - 1;

                        return (
                            <span className="cft-line" key={`l${li}`}>
                                {line.split('').map((ch, i) => (
                                    <React.Fragment key={`l${li}-${i}`}>
                                        <span className={clsx('cft-ch', i < lineVisible && 'cft-ch--v')}>
                                            {ch === ' ' ? ' ' : ch}
                                        </span>
                                        {/* Cursor right after the last visible char of the line being typed */}
                                        {!allDone &&
                                            i === lineVisible - 1 &&
                                            typedChars > start &&
                                            typedChars <= start + line.length && (
                                                <span
                                                    className={clsx(
                                                        'cft-cur',
                                                        isPaused ? 'cft-cur--paused' : 'cft-cur--typing',
                                                    )}
                                                />
                                            )}
                                    </React.Fragment>
                                ))}
                                {/* Final done-cursor after the last line (skipped under reduced motion) */}
                                {isLastLine && allDone && !reducedMotion && (
                                    <span className="cft-cur cft-cur--done" />
                                )}
                            </span>
                        );
                    });
                })()}
            </h1>
        </div>
    );
}
