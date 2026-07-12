'use client';

import * as React from 'react';
import { LineAnchor } from '@/components/00_LineAnchor';
import { useScrollLock } from '@/lib/useScrollLock';

type ScrollVideoProps = {
    backgroundVideoUrl?: string;
    fullscreenVideoUrl?: string;
    className?: string;
};

export default function ScrollVideo({
                                        backgroundVideoUrl = 'https://vimeo.com/1132746110',
                                        fullscreenVideoUrl = 'https://vimeo.com/1132746110',
                                        className,
                                    }: ScrollVideoProps) {
    const sectionRef = React.useRef<HTMLElement | null>(null);
    const [progress, setProgress] = React.useState(0);
    const [isHovering, setIsHovering] = React.useState(false);
    const [isFullscreen, setIsFullscreen] = React.useState(false);

    // Shared page lock while the fullscreen player is open: body overflow
    // hidden + data-scroll-locked so the ProgressLine wheel engine yields.
    // Replaces the legacy body position:fixed hack (which zeroed window.scrollY
    // and made the spine's canonical scroll ref drift while the modal was open).
    useScrollLock(isFullscreen);

    // Mount the looping background player only when the section is within one
    // viewport of view (loading speed: the iframe + Vimeo player boot are heavy
    // and this section starts ~2 viewports below the fold). One-shot.
    const [playerReady, setPlayerReady] = React.useState(false);
    React.useEffect(() => {
        const el = sectionRef.current;
        if (!el) return;
        const io = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setPlayerReady(true);
                    io.disconnect();
                }
            },
            { rootMargin: '100% 0px' }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);
    const fullscreenIframeRef = React.useRef<HTMLIFrameElement>(null);
    const backdropRef = React.useRef<HTMLDivElement>(null);
    const closeBtnRef = React.useRef<HTMLButtonElement>(null);
    const backgroundIframeRef = React.useRef<HTMLIFrameElement>(null);

    // Extract Vimeo ID from URL
    const getVimeoId = (url: string) => {
        const match = url.match(/vimeo\.com\/(\d+)/);
        return match ? match[1] : '';
    };

    const backgroundVideoId = getVimeoId(backgroundVideoUrl);
    const fullscreenVideoId = getVimeoId(fullscreenVideoUrl);

    React.useEffect(() => {
        // Motion-sensitive users: the grow/rise/fade is JS-driven (inline
        // transforms), so a CSS media query can't disable it. Honour the
        // preference here by pinning progress to its final state — the video
        // shows full-size, centered and fully visible, with no scroll animation.
        const reduceMotion =
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        if (reduceMotion) {
            setProgress(1);
            return;
        }

        let raf = 0;

        const calc = () => {
            const section = sectionRef.current;
            if (!section) return;

            const rect = section.getBoundingClientRect();
            const vh = window.innerHeight;

            // Animation range: most scroll goes to main growth, quick settle
            const startPoint = vh * 0.5;
            const endPoint = -vh * 0.6; // Main animation completes here

            let rawProgress = 0;
            if (rect.top <= startPoint && rect.top >= endPoint) {
                rawProgress = (startPoint - rect.top) / (startPoint - endPoint);
            } else if (rect.top < endPoint) {
                rawProgress = 1;
            }

            setProgress(rawProgress);
        };

        const onScroll = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(calc);
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        calc();

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
        };
    }, []);

    // Handle fullscreen modal and auto-close on video end
    React.useEffect(() => {
        if (!isFullscreen) return;

        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsFullscreen(false);
                return;
            }
            // Focus trap: keep Tab cycling inside the dialog.
            if (e.key === 'Tab' && backdropRef.current) {
                const focusables = backdropRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], iframe, [tabindex]:not([tabindex="-1"])'
                );
                if (focusables.length === 0) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        // A11y: remember what was focused, then move focus into the dialog.
        const previouslyFocused = document.activeElement as HTMLElement | null;
        requestAnimationFrame(() => closeBtnRef.current?.focus());

        // Setup Vimeo listener for video end AND fullscreen changes
        const setupVimeoListener = () => {
            // Pause the looping background video while the modal is open (perf).
            if (backgroundIframeRef.current && window.Vimeo) {
                try {
                    new window.Vimeo.Player(backgroundIframeRef.current).pause();
                } catch {}
            }
            if (fullscreenIframeRef.current && window.Vimeo) {
                const player = new window.Vimeo.Player(fullscreenIframeRef.current);

                player.on('ended', () => {
                    setIsFullscreen(false);
                });

                // Listen for when Vimeo's native fullscreen is exited
                player.on('fullscreenchange', (data: { fullscreen: boolean }) => {
                    if (!data.fullscreen) {
                        // Vimeo fullscreen was exited, recalculate line positions
                        requestAnimationFrame(() => {
                            window.dispatchEvent(new Event('scroll'));
                            window.dispatchEvent(new Event('resize'));
                        });
                    }
                });
            }
        };

        if (!window.Vimeo) {
            const script = document.createElement('script');
            script.src = 'https://player.vimeo.com/api/player.js';
            script.onload = setupVimeoListener;
            document.body.appendChild(script);
        } else {
            setupVimeoListener();
        }

        document.addEventListener('keydown', handleKeydown);

        return () => {
            document.removeEventListener('keydown', handleKeydown);

            // Resume the background video and return focus to the trigger.
            if (backgroundIframeRef.current && window.Vimeo) {
                try {
                    new window.Vimeo.Player(backgroundIframeRef.current).play();
                } catch {}
            }
            previouslyFocused?.focus();
        };
    }, [isFullscreen]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === backdropRef.current) {
            setIsFullscreen(false);
        }
    };

    // ONE smooth curve - no if/else, no phases, no transitions
    // Just pure ease-out
    const eased = 1 - Math.pow(1 - progress, 3);

    const scale = 0.5 + 0.5 * eased;
    // Reveal-time down-push only: the small video starts ~12vh below centre and
    // eases up TO centre as it grows — so the full-size hold lands dead-centre,
    // while the reveal still rises into place. Reduced from 35 so the revealing
    // video isn't parked low (which opened the dark gap under the §2 title).
    const REVEAL_DROP_VH = 12;
    const translateY = (1 - eased) * REVEAL_DROP_VH;
    const opacity = Math.min(1, progress * 3);

    return (
        <>
            <section
                ref={sectionRef}
                className={className}
                style={{
                    position: 'relative',
                    width: '100%',
                    minHeight: '180vh',
                    background: 'var(--color-bg, #0b0b0d)',
                }}
            >
                <div className="absolute top-20">
                    <LineAnchor id="promovideo-top" position="right" offsetX={100} />
                </div>
                <div
                    style={{
                        position: 'sticky',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                    }}
                >
                    <div
                        className="video-container will-change-transform"
                        role="button"
                        tabIndex={0}
                        aria-label="Play promo video"
                        onMouseEnter={() => setIsHovering(true)}
                        onMouseLeave={() => setIsHovering(false)}
                        onFocus={() => setIsHovering(true)}
                        onBlur={() => setIsHovering(false)}
                        onClick={() => setIsFullscreen(true)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setIsFullscreen(true);
                            }
                        }}
                        style={{
                            // Fluid side inset: was fixed 300px total (150px/side) at 1440.
                            // 150px → clamp(gutter, 10.42vw, 9.375rem). Never crosses inside the gutter.
                            // At 1440: 10.42vw=150px → 100vw-2*150px = calc(100vw-300px) (no-op).
                            width: 'calc(100vw - 2 * clamp(var(--gutter), 10.42vw, 9.375rem))',
                            aspectRatio: '16 / 9',
                            transform: `translateY(${translateY}vh) scale(${scale})`,
                            transformOrigin: 'center center',
                            borderRadius: 0,
                            overflow: 'hidden',
                            background: 'black',
                            pointerEvents: 'auto',
                            opacity: opacity,
                            cursor: 'pointer',
                            position: 'relative',
                        }}
                    >
                        {/* Background looping video (mounted on approach, see playerReady) */}
                        {playerReady && (
                        <iframe
                            ref={backgroundIframeRef}
                            title="Background video"
                            src={`https://player.vimeo.com/video/${backgroundVideoId}?background=1&autoplay=1&loop=1&autopause=0&muted=1`}
                            allow="autoplay; fullscreen; picture-in-picture"
                            style={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                border: 'none',
                                display: 'block',
                                pointerEvents: 'none',
                            }}
                        />
                        )}

                        {/* Play button overlay — ALWAYS present so the frame reads as a
                            video at a glance: idle = half-size, faint, no dark wash;
                            hover/focus = full-size + dimmed backdrop (original look). */}
                        <div
                            className={`play-overlay ${isHovering ? 'visible' : ''}`}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: isHovering ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0)',
                                transition: 'background 0.3s ease',
                                pointerEvents: 'none',
                            }}
                        >
                            <svg
                                className="play-icon"
                                viewBox="0 0 100 100"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{
                                    width: '200px',
                                    height: '200px',
                                    filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))',
                                    transform: isHovering ? 'scale(1)' : 'scale(0.65)',
                                    opacity: isHovering ? 1 : 0.45,
                                    transition:
                                        'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
                                }}
                            >
                                <defs>
                                    <filter id="softGlow">
                                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                        <feMerge>
                                            <feMergeNode in="coloredBlur" />
                                            <feMergeNode in="SourceGraphic" />
                                        </feMerge>
                                    </filter>
                                </defs>
                                <path
                                    d="M 25 15 L 25 85 L 85 50 Z"
                                    fill="white"
                                    opacity="0.9"
                                    filter="url(#softGlow)"
                                />
                            </svg>
                        </div>
                    </div>
                </div>
                {/* bottom anchor */}
                <div className="absolute bottom-20">
                    <LineAnchor id="promovideo-bottom" position="right" offsetX={100} />
                </div>
            </section>

            {/* Fullscreen video modal */}
            {isFullscreen && (
                <div
                    ref={backdropRef}
                    className="fullscreen-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Promo video"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.98)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'fadeIn 0.3s ease-out',
                        backdropFilter: 'blur(10px)',
                    }}
                    onClick={handleBackdropClick}
                    onWheel={(e) => e.preventDefault()}
                    onTouchMove={(e) => e.preventDefault()}
                >
                    <div className="lightbox-container">
                        {/* Fullscreen video */}
                        <div
                            style={{
                                /* Fit BOTH dimensions: cap width by height too, so the
                                   16:9 video never exceeds the viewport on short/wide
                                   screens (which used to overflow and shove the close
                                   button off-screen). */
                                width: 'min(90vw, calc(90vh * 16 / 9), 1600px)',
                                aspectRatio: '16 / 9',
                            }}
                        >
                            <iframe
                                ref={fullscreenIframeRef}
                                title="Fullscreen video"
                                src={`https://player.vimeo.com/video/${fullscreenVideoId}?autoplay=1`}
                                allow="autoplay; fullscreen; picture-in-picture"
                                allowFullScreen
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none',
                                }}
                            />
                        </div>
                    </div>

                    {/* Close button — sibling of the (scaled) lightbox so its position
                        isn't affected by that transform; anchored to the screen corner
                        so it's always reachable regardless of the video's size. */}
                    <button
                        ref={closeBtnRef}
                        className="close-btn"
                        onClick={() => setIsFullscreen(false)}
                        aria-label="Close video"
                    >
                        <span className="close-line" />
                        <span className="close-line" />
                    </button>
                </div>
            )}

            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .lightbox-container {
                    position: relative;
                    max-width: 90vw;
                    max-height: 90vh;
                    animation: scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @keyframes scaleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                .close-btn {
                    /* Anchored to the modal's top-right corner (the modal is fixed
                       inset:0, so this is effectively the screen corner). Always on
                       screen, independent of the video's size. */
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    z-index: 1;
                    width: 44px;
                    height: 44px;
                    background: rgba(0, 0, 0, 0.7);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
                    backdrop-filter: blur(10px);
                }

                .close-btn:hover {
                    background: rgba(0, 0, 0, 0.9);
                    border-color: rgba(255, 255, 255, 0.5);
                    transform: rotate(90deg);
                }

                .close-line {
                    position: absolute;
                    width: 20px;
                    height: 2px;
                    background: rgba(255, 255, 255, 0.9);
                    transition: background 0.3s ease;
                }

                .close-btn:hover .close-line {
                    background: #ffffff;
                }

                .close-line:first-child {
                    transform: rotate(45deg);
                }

                .close-line:last-child {
                    transform: rotate(-45deg);
                }

                /* Hide Vimeo controls and branding */
                .video-container :global(iframe) {
                    pointer-events: auto;
                }

                /* Force hide Vimeo UI elements */
                :global(.vp-sidedock),
                :global(.vp-overlay),
                :global(.vp-controls-wrapper),
                :global(.vp-badge),
                :global(.vp-logo),
                :global(.vp-title),
                :global(.vp-byline),
                :global(.vp-portrait) {
                    display: none !important;
                    opacity: 0 !important;
                    visibility: hidden !important;
                }

                /* Close button is now screen-corner anchored at all sizes; only its
                   footprint shrinks a touch on small screens. */
                @media (max-width: 768px) {
                    .close-btn {
                        top: 12px;
                        right: 12px;
                        width: 40px;
                        height: 40px;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    * {
                        animation: none !important;
                        transition: none !important;
                    }
                }
            `}</style>
        </>
    );
}

// TypeScript declaration for Vimeo Player API
declare global {
    interface Window {
        Vimeo?: {
            Player: new (iframe: HTMLIFrameElement) => {
                on: (event: string, callback: (data: { fullscreen: boolean }) => void) => void;
                pause: () => void;
                play: () => void;
            };
        };
    }
}