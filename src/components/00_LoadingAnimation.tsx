'use client';

import { useState, useEffect, ReactNode } from 'react';

// Critical above-the-fold assets to preload. MUST match the Hero layers in
// 01_Hero.tsx — progress is driven by how many of these have actually arrived,
// so the bar's speed reflects the real download (fast on good wifi, slower on
// bad) instead of a fixed timer.
const CRITICAL_IMAGES = [
    '/images/filip-layer-1.webp',
    '/images/filip-layer-2.webp',
    '/images/filip-layer-3.webp',
    '/images/filip-layer-4.webp',
];

// Timing marks (ms since navigation start) — visible in the console as
// "[loader]" and on window.__loaderPerf for tooling (scripts/measure-load.mjs).
// Time BEFORE 'mounted' = HTML + JS download/parse + React hydration; the
// loader can only ever be as fast as that lets it.
const loaderPerf: Record<string, number> = {};
function mark(name: string) {
    if (loaderPerf[name] !== undefined) return;
    loaderPerf[name] = Math.round(performance.now());
    if (typeof window !== 'undefined') {
        (window as unknown as { __loaderPerf: typeof loaderPerf }).__loaderPerf = loaderPerf;
    }
}

export default function LoadingScreen({ children }: { children: ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);

    // Lock scroll while the loader overlay is up (the page is mounted behind it).
    useEffect(() => {
        document.body.style.overflow = loading ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [loading]);

    useEffect(() => {
        mark('mounted');
        let raf = 0;
        let revealed = false;
        let loaded = 0;            // how many critical images have arrived
        let fontsReady = false;
        const total = CRITICAL_IMAGES.length;
        const targetRef = { current: 0 };

        // Real target: bar position follows the fraction of critical images that
        // have downloaded (granular, real-speed). It's held at 95% until the hero
        // is truly ready (all critical images + fonts), then completes to 100.
        // Deliberately NOT gated on window `load`: that waits for every eager
        // resource on the whole page (below-fold images, any iframes), which held
        // the bar at 95% for seconds. The loader only needs to guarantee what it
        // reveals INTO — the hero — and the preloads below use the exact same
        // URLs the hero renders, so the bytes are in cache at reveal.
        const recompute = () => {
            const imagesPct = (loaded / total) * 100;
            const fullyReady = loaded === total && fontsReady;
            if (fullyReady) mark('assets-ready');
            targetRef.current = fullyReady ? 100 : Math.min(imagesPct, 95);
        };

        // Preload the critical images = the granular progress signal.
        CRITICAL_IMAGES.forEach(src => {
            const img = new Image();
            const onDone = () => { loaded += 1; mark(`img${loaded}`); recompute(); };
            img.onload = onDone;
            img.onerror = onDone; // count failures as done so we never stall
            img.src = src;
        });

        const fonts = document.fonts;
        if (fonts && fonts.ready) {
            fonts.ready.then(() => { fontsReady = true; mark('fonts'); recompute(); })
                       .catch(() => { fontsReady = true; mark('fonts'); recompute(); });
        } else {
            fontsReady = true;
        }
        const maxTimer = window.setTimeout(() => {
            loaded = total; fontsReady = true; recompute();
        }, 8000);

        recompute();

        // Ease the displayed number toward the real target. A small floor keeps
        // it visibly sweeping even when assets are already cached/instant.
        // (0.35/2.5/120ms: measured — the old pacing added ~500ms of artificial
        // wait after assets were ready; this keeps a visible sweep at ~250ms.
        // The bar should reflect load time, not add to it.)
        const tick = () => {
            setProgress(prev => {
                const target = targetRef.current;
                let next = prev + Math.max((target - prev) * 0.35, target > prev ? 2.5 : 0);
                if (next > target) next = target;
                if (!revealed && target >= 100 && next >= 99.5) {
                    revealed = true;
                    next = 100;
                    window.setTimeout(() => {
                        setLoading(false);
                        mark('reveal');
                        console.info('[loader] ms since navigation:', JSON.stringify(loaderPerf));
                    }, 120);
                }
                return next;
            });
            if (!revealed) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            window.clearTimeout(maxTimer);
            cancelAnimationFrame(raf);
        };
    }, []);

    return (
        <>
            {/* The page mounts immediately and downloads its assets BEHIND the
                overlay, so the reveal is into an already-loaded, smooth page. */}
            <div
                style={{
                    opacity: loading ? 0 : 1,
                    transition: 'opacity 0.6s ease-out',
                }}
            >
                {children}
            </div>

            {loading && (
                /* Critical layout is INLINE so it's centered on the first paint
                   (no top-left flash before styled-jsx applies). */
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--color-bg, #0b0b0d)',
                        zIndex: 9999,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '16px',
                        }}
                    >
                        <div
                            style={{
                                width: '280px',
                                height: '2px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '1px',
                                overflow: 'hidden',
                                position: 'relative',
                            }}
                        >
                            <div
                                className="progress-fill"
                                style={{
                                    height: '100%',
                                    width: `${progress}%`,
                                    background: 'rgba(255, 255, 255, 0.9)',
                                    transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                    position: 'relative',
                                }}
                            />
                        </div>
                        <p
                            style={{
                                margin: 0,
                                fontFamily: "var(--font-sans, Rajdhani), monospace",
                                fontSize: '13px',
                                fontWeight: 400,
                                letterSpacing: '0.15em',
                                textTransform: 'uppercase',
                                color: 'rgba(255, 255, 255, 0.6)',
                            }}
                        >
                            {Math.round(progress)}%
                        </p>
                    </div>

                    {/* Decorative shimmer only — pseudo-element, can't be inline. */}
                    <style jsx>{`
                        .progress-fill::after {
                            content: '';
                            position: absolute;
                            top: 0;
                            right: 0;
                            width: 40px;
                            height: 100%;
                            background: linear-gradient(
                                to right,
                                transparent,
                                rgba(255, 255, 255, 0.4)
                            );
                            animation: shimmer 1s ease-in-out infinite;
                        }
                        @keyframes shimmer {
                            0%, 100% { opacity: 0; }
                            50% { opacity: 1; }
                        }
                        @media (prefers-reduced-motion: reduce) {
                            .progress-fill { transition: none !important; }
                            .progress-fill::after { animation: none; }
                        }
                    `}</style>
                </div>
            )}
        </>
    );
}
