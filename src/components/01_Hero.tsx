'use client';

import Image from 'next/image';
import React from 'react';
import { LineAnchor } from '@/components/00_LineAnchor';

type HeroProps = {
    title?: string;
    subtitle?: string;
    images?: [string, string, string, string];
    className?: string;
    aspectRatio?: `${number} / ${number}`;
    fit?: 'cover' | 'contain';
    parallaxMaxShiftPx?: number;
};

// WebP emitted by scripts/optimize-images.mjs (npm run img) from the PNG
// sources — 106KB vs 4.8MB each. Keep this list in sync with the loader's
// CRITICAL_IMAGES in 00_LoadingAnimation.tsx.
const DEFAULT_IMAGES: [string, string, string, string] = [
    '/images/filip-layer-1.webp',
    '/images/filip-layer-2.webp',
    '/images/filip-layer-3.webp',
    '/images/filip-layer-4.webp',
];

export default function Hero({
                                 title = `ARE YOU ALSO THINKING ABOUT ROBOTS?`,
                                 subtitle = `Filip Ondrej — 10 years winning robotics World Championships. The trophies were practice. The company is the point.`,
                                 images = DEFAULT_IMAGES,
                                 className,
                                 aspectRatio = '16 / 9',
                                 fit = 'cover',
                                 parallaxMaxShiftPx = 120, // BACK TO 80
                             }: HeroProps) {
    const sectionRef = React.useRef<HTMLElement>(null);
    const layer0Ref = React.useRef<HTMLDivElement>(null);
    const layer1Ref = React.useRef<HTMLDivElement>(null);
    const layer2Ref = React.useRef<HTMLDivElement>(null);
    const layer3Ref = React.useRef<HTMLDivElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const fadeRef = React.useRef<HTMLDivElement>(null);

    const rafRef = React.useRef(0);
    const isInViewRef = React.useRef(false);

    React.useEffect(() => {
        const el = sectionRef.current;
        const container = containerRef.current;
        const fade = fadeRef.current;
        const layers = [layer0Ref.current, layer1Ref.current, layer2Ref.current, layer3Ref.current];

        if (!el || !container || !fade || layers.some(l => !l)) return;

        const REDUCE = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        if (REDUCE) return;

        const multipliers = [0, 0.4, 0.9, 1.25];
        let lastScroll = -1;
        let lastScrollY = -1;

        const tick = () => {
            if (!isInViewRef.current) return;

            // Cheap gate first: if the page didn't scroll, skip the frame WITHOUT
            // touching getBoundingClientRect — that call forces a layout flush and
            // this loop was paying it 60×/s while the hero sat idle in view.
            const y = window.scrollY;
            if (y === lastScrollY) {
                rafRef.current = requestAnimationFrame(tick);
                return;
            }
            lastScrollY = y;

            const rect = el.getBoundingClientRect();
            const scrollProgress = Math.min(1, Math.max(0, -rect.top / rect.height));

            // Skip if no meaningful change
            if (Math.abs(scrollProgress - lastScroll) < 0.005) {
                rafRef.current = requestAnimationFrame(tick);
                return;
            }
            lastScroll = scrollProgress;

            // Start effects earlier (at 5% instead of 15%)
            const START = 0.05;
            const adjusted = Math.min(1, Math.max(0, (scrollProgress - START) / (1 - START)));

            // Zoom and fade container
            const scale = 1 + adjusted * 0.15;
            const opacity = 1 - adjusted * 0.5;
            container.style.transform = `scale3d(${scale}, ${scale}, 1)`;
            container.style.opacity = String(opacity);

            // Parallax layers
            layers.forEach((layer, i) => {
                if (layer) {
                    const shift = scrollProgress * parallaxMaxShiftPx * multipliers[i];
                    layer.style.transform = `translate3d(${shift}px, 0, 0)`;
                }
            });

            // Bottom fade – start earlier, independent of container zoom
            const FADE_START = 0.05;   // when the fade should begin (0 = immediately)
            const FADE_END = 0.3;    // how far into the scroll it should be fully opaque
            const fadeProgress = Math.min(
                1,
                Math.max(0, (scrollProgress - FADE_START) / (FADE_END - FADE_START))
            );
            fade.style.opacity = String(fadeProgress);

            rafRef.current = requestAnimationFrame(tick);
        };

        const io = new IntersectionObserver(
            (entries) => {
                isInViewRef.current = entries[0].isIntersecting;
                if (isInViewRef.current) {
                    rafRef.current = requestAnimationFrame(tick);
                } else {
                    cancelAnimationFrame(rafRef.current);
                }
            },
            { root: null, rootMargin: '100px 0px', threshold: 0 }
        );

        io.observe(el);

        return () => {
            cancelAnimationFrame(rafRef.current);
            io.disconnect();
        };
    }, [parallaxMaxShiftPx]);

    return (
        <section
            ref={sectionRef}
            className={['hero-section relative w-screen overflow-hidden', className ?? ''].join(' ')}
            style={{
                isolation: 'isolate',
                backgroundColor: 'var(--color-bg, #0b0b0d)',
            }}
            aria-label="Hero"
        >
            {/* anchors */}
            <div className="pointer-events-none absolute top-20 left-0 z-50">
                <LineAnchor id="hero-top" position="left" offsetX={100} />
            </div>

            {/* Layered artwork with zoom/fade container */}
            <div
                ref={containerRef}
                className="absolute inset-0"
                style={{
                    transform: 'scale3d(1, 1, 1)',
                    opacity: 1,
                    willChange: 'transform, opacity',
                    transformOrigin: 'center center',
                }}
            >
                {[layer0Ref, layer1Ref, layer2Ref, layer3Ref].map((ref, i) => (
                    <div
                        key={i}
                        ref={ref}
                        className="absolute inset-0"
                        style={{
                            zIndex: 10 - i,
                            transform: 'translate3d(0, 0, 0)',
                            willChange: 'transform',
                        }}
                        aria-hidden
                    >
                        <Image
                            src={images[i]}
                            alt=""
                            fill
                            priority
                            sizes="100vw"
                            quality={95}
                            style={{
                                objectFit: fit,
                                /* Pin the artwork's bottom to the box bottom so the
                                   meaningful lower portion always stays in view and
                                   any cropping eats the black top first. */
                                objectPosition: 'center bottom',
                                /* Modest bottom-anchored zoom to crop the black top
                                   quarter on screens where the image otherwise fits
                                   exactly. Dial 1.12 up for less black / down for more.
                                   Independent of the parallax (parent) + scroll-zoom
                                   (container) transforms, so it doesn't fight them. */
                                transform: 'scale(1.12)',
                                transformOrigin: 'center bottom',
                                opacity: 1 - (i * 0.2),
                                pointerEvents: 'none',
                            }}
                            loading="eager"
                        />
                    </div>
                ))}
            </div>

            {/* Bottom fade */}
            <div
                ref={fadeRef}
                className="pointer-events-none absolute left-0 right-0 bottom-0"
                style={{
                    height: '30%',
                    background: 'linear-gradient(to bottom, transparent 0%, var(--color-bg, #0b0b0d) 100%)',
                    zIndex: 20,
                    opacity: 0,
                    willChange: 'opacity',
                }}
            />

            {/* Title block */}
            <div
                className="hero-copy pointer-events-none absolute z-30"
            >
                <div
                    className="subtitleSize"
                    style={{
                        color: 'var(--color-muted)',
                        textShadow: '0 1px 12px rgba(0,0,0,0.4)',
                        marginBottom: 'var(--space-xs)',
                    }}
                >
                    [00] Introduction
                </div>

                <h1
                    className="text-balance"
                    style={{
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'rgba(255,255,255,0.96)',
                        lineHeight: 0.95,
                        textShadow: '0 2px 24px rgba(0,0,0,0.5)',
                    }}
                    aria-label={title}
                >
          <span className="titleLine titleSize" style={{ display: 'block' }}>
            ARE YOU ALSO
          </span>
                    <span className="titleLine titleSize" style={{ display: 'block' }}>
            THINKING ABOUT
          </span>
                    <span className="titleLine titleSize" style={{ display: 'block' }}>
            <span className="hero-gold">ROBOTS?</span>
          </span>
                </h1>

                {subtitle && (
                    <p
                        className="subtitleSize"
                        style={{
                            marginTop: 'var(--space-sm)',
                            color: 'var(--color-muted)',
                            textShadow: '0 1px 12px rgba(0,0,0,0.4)',
                            maxWidth: '50rem',
                        }}
                    >
                        Filip Ondrej — 10 years winning robotics World Championships.<br />
                        The trophies were practice. The company is the point.
                    </p>
                )}
            </div>

            <style jsx>{`
        /* Landscape: fill the viewport height so the artwork bottom meets the
           screen bottom. svh accounts for mobile browser chrome. */
        .hero-section {
          height: 100svh;
        }
        /* Portrait: a tall narrow box would force the 16:9 art to overflow
           sideways (cover scales on height). Size by aspect ratio instead so
           the whole picture stays visible by width. */
        @media (orientation: portrait) {
          .hero-section {
            height: auto;
            aspect-ratio: 16 / 9;
          }
        }

        /* Title block anchored in rem so it rides the fluid scale engine
           (1rem scales with the viewport). Was left:200px / bottom:300px. */
        .hero-copy {
          /* Continuous: tracks ~2x the spine (spine ~6.94vw, title ~13.9vw),
             floored at the gutter and capped at 12.5rem (== 200px @ 1440). No
             breakpoint step, so it never jumps relative to the spine. */
          left: clamp(var(--gutter), 13.9vw, 12.5rem);
          /* Middle-left: span the full height and center the copy with flex —
             NO transform, so the type stays crisp (translateY(-50%) can land on a
             half-pixel and blur it). */
          top: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          /* Right edge lands on the gutter regardless of the fluid left. */
          max-width: calc(100vw - clamp(var(--gutter), 13.9vw, 12.5rem) - var(--gutter));
        }
        /* Pure rem so both sizes ride the fluid root font as ONE unit (per the
           globals scale engine) instead of each running its own vw clamp. The
           old clamp(px, vw, px) form gave the title and subtitle different
           lock-in points, so on the way down one would freeze while the other
           kept shrinking — the staggered, non-uniform scaling. Magnitudes are
           the originals at 1440 (root = 16px): 92px and 22px. No-op at 1440. */
        .titleSize {
          font-size: 5.6rem;   /* 5.75rem is 92px @1440 */
        }
        .subtitleSize {
          font-size: 1.375rem;  /* 22px @1440 */
        }

        /* Gold accent on the punchline word ("ROBOTS?"). */
        .hero-gold {
          background: linear-gradient(135deg, #FEF3C7 0%, #FDE047 25%, #FFD60A 50%, #F59E0B 75%, #B45309 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* XXS phones: shrink the title below its desktop floor so the long
           headline fits the gutter-constrained width. */
        @media (max-width: 480px) {
          .titleSize { font-size: clamp(22px, 8vw, 44px); }
        }

        @media (prefers-reduced-motion: reduce) {
          div[style*="willChange"] {
            will-change: auto !important;
            transform: none !important;
          }
        }
      `}</style>

            <div className="pointer-events-none absolute bottom-20 left-0 z-50">
                <LineAnchor id="hero-bottom" position="left" offsetX={100} />
            </div>
        </section>
    );
}