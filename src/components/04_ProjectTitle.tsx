'use client';

import * as React from 'react';
import clsx from 'clsx';
import { LineAnchor } from '@/components/00_LineAnchor';

export type ProjectTitleProps = {
    lines?: string[];
    className?: string;
    scale?: number;               // font size multiplier
    leftOffsetPx?: number;        // horizontal offset of the title
    reserveBelowPx?: number;      // spacing below the title block
    showAnchors?: boolean;
    debugGuides?: boolean;
};

/* ================= Styles ================= */
const styles = `
.pt-wrap {
  position: relative;
  width: 100%;
  container-type: inline-size;
  isolation: isolate;
  z-index: 1;
  display: flex;
  flex-direction: column;
  padding-top: calc(var(--pt-lead) + var(--pt-gap));
  padding-bottom: var(--pt-trail);
}

/* Title block — normal flow, offset left by --pt-left */
.pt-title {
  position: relative;
  margin: 0 0 0 var(--pt-left);

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

  /* --pt-scale and --pt-left are set inline on .pt-wrap from the scale and
     leftOffsetPx props (prop-driven, no-op at the 1440 reference). */
  --pt-size: calc(var(--pt-scale) * clamp(64px, 8.4cqi, 160px));
}
@supports not (font-size: 1cqi) {
  .pt-title { --pt-size: calc(var(--pt-scale) * clamp(64px, 8.4vw, 160px)); }
}

/* Lines inherit the big size like in tt-line */
.pt-line {
  display: block;
  font-size: var(--pt-size);
  overflow: hidden;
}

/* Word slide-up animation (cinematic title) */
.pt-word {
  display: inline-block;
  opacity: 0;
  transform: translateY(100%);
  transition:
    transform 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: calc(var(--pt-i, 0) * 80ms);
}

/* When visible, all words slide up in sequence */
.pt-title.pt-visible .pt-word {
  opacity: 1;
  transform: translateY(0);
}

/* optional debug guides */
.pt-guide {
  position:absolute;
  left:0;
  right:0;
  height:1px;
  background: rgba(255,255,255,0.25);
  pointer-events:none;
  z-index: 100;
}
.pt-guide--mid    { top: 50%; }
.pt-guide--under  { top: var(--pt-under); }

@media (prefers-reduced-motion: reduce) {
  .pt-word {
    transition: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
`;

export default function ProjectTitle({
                                         lines = ['The Projects That', 'Won World Cups'],
                                         className,
                                         scale = 0.785,
                                         leftOffsetPx = 200,
                                         reserveBelowPx = 30,
                                         showAnchors = true,
                                         debugGuides = false,
                                     }: ProjectTitleProps) {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const [visible, setVisible] = React.useState(false);

    // Start animation when this section enters viewport
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
            { rootMargin: '0px 0px -35% 0px', threshold: 0.5 }
        );

        io.observe(el);
        return () => io.disconnect();
    }, []);

    // Split lines into words for the slide-up animation
    const allLines = React.useMemo(
        () => lines.map((line) => line.split(' ').filter(Boolean)),
        [lines]
    );

    // Shared CSS variables - horizontal line ALWAYS at 50%, title positioned relative to it
    const wrapperStyle: React.CSSProperties & {
        ['--pt-scale']: string;
        ['--pt-left']: string;
        ['--pt-spine-x']: string;
        ['--pt-lead']: string;
        ['--pt-gap']: string;
        ['--pt-trail']: string;
        ['--pt-under']: string;
    } = {
        ['--pt-scale']: String(scale),
        // Fluid offset (see --pt-left in styles): floors at gutter, caps at rem, tracks vw
        // so it stays aligned to the spine on resize. No-op at 1440.
        ['--pt-left']: `clamp(var(--gutter), ${leftOffsetPx / 14.4}vw, ${leftOffsetPx / 16}rem)`,
        // The vertical spine's x-position, mirroring 00_LineAnchor's uiScale exactly.
        ['--pt-spine-x']: 'clamp(18px, min(6.944vw, 6.25rem), 160px)',
        ['--pt-lead']: 'clamp(140px, 26vh, 300px)',
        // line→title gap == the title's LEFT inset (spine→title), so top & left stay
        // equal and both scale with width. = 100px at 1440 (no-op).
        ['--pt-gap']: 'calc(var(--pt-left) - var(--pt-spine-x))',
        ['--pt-trail']: 'clamp(20px, 4vh, 50px)',
        ['--pt-under']: 'calc(var(--pt-lead) + var(--pt-gap))',
    };

    return (
        <>
            <div
                ref={ref}
                className={clsx('pt-wrap', className)}
                style={{ ...wrapperStyle, marginBottom: reserveBelowPx }}
                aria-hidden="true"
            >
                <style>{styles}</style>

                {debugGuides && (
                    <>
                        <div className="pt-guide pt-guide--mid" />
                        <div className="pt-guide pt-guide--under" />
                    </>
                )}

                {showAnchors && (
                    <div className="pointer-events-none absolute inset-0 z-[5]">
                        <div className="absolute right-0 top-[12px]">
                            <LineAnchor id="pt-start-right-top" position="right" offsetX={100} />
                        </div>
                        <div className="absolute right-0 w-0" style={{ top: 'var(--pt-lead)' }}>
                            <LineAnchor id="pt-middle-right" position="right" offsetX={100} />
                        </div>
                        <div className="absolute left-0 w-0" style={{ top: 'var(--pt-lead)' }}>
                            <LineAnchor id="pt-middle-left" position="left" offsetX={100} />
                        </div>
                        <div className="absolute left-0 w-0" style={{ top: 'var(--pt-under)' }}>
                            <LineAnchor id="pt-under-left" position="left" offsetX={100} />
                        </div>
                        <div className="absolute left-0 bottom-[12px]">
                            <LineAnchor id="pt-bottom-left" position="left" offsetX={100} />
                        </div>
                    </div>
                )}

                <h1 className={clsx('pt-title', visible && 'pt-visible')}>
                    {allLines.map((words, lineIdx) => (
                        <span key={lineIdx} className="pt-line">
                            {words.map((word, wordIdx) => {
                                // Running word count across lines: the second
                                // line follows straight after the first
                                // (idx × 80ms). The old lineIdx*10 indexing
                                // parked line 2 at 800ms+ — it read as a
                                // separate, late animation.
                                const idx =
                                    allLines
                                        .slice(0, lineIdx)
                                        .reduce((n, l) => n + l.length, 0) + wordIdx;
                                const isLast = wordIdx === words.length - 1;

                                return (
                                    <React.Fragment key={`${lineIdx}-${wordIdx}-${word}`}>
                                        <span
                                            className="pt-word"
                                            style={
                                                {
                                                    ['--pt-i']: idx,
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
