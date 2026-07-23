'use client';

import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    type MouseEvent,
} from 'react';

const NAV_ITEMS = [
    { label: 'PROJECTS', id: 'projects' },
    { label: 'JOURNEY', id: 'journey' },
    { label: 'FILM', id: 'film' },
    { label: 'PRESS', id: 'press' },
    { label: 'COLLABORATE', id: 'collaborate', accent: true },
    { label: 'CONTACT', id: 'contact' },
] as const;

type SectionId = (typeof NAV_ITEMS)[number]['id'];

const GOLD_GRADIENT =
    'linear-gradient(135deg, #FEF3C7 0%, #FDE047 25%, #FFD60A 50%, #F59E0B 75%, #B45309 100%)';

/* Wave flicker: chars flip to 0/1 LEFT→RIGHT (stagger), each flickers for
   the hold duration, then settles back in the same left→right sweep.
   HOLD/STAGGER ≈ 3 = only ~3 chars are digits at any moment — a tight wave
   that travels fast while the rest of the word stays READABLE. (The old
   80/500 pair scrambled ~6 chars at once: slow ramp-in, unreadable soup.) */
const FLICKER_STAGGER_MS = 35;
const FLICKER_HOLD_MS = 300;
const FLICKER_TICK_MS = 30;

interface NavigationGlassProps {
    name?: string;
    homeHref?: string;
    bookHref?: string;
    className?: string;
}

/* Entrance phases: 'wait' = loader still up (links hidden behind the overlay),
   'run' = loader just revealed → staggered flicker-in, 'skip' = reveal happened
   before we mounted (client nav) → render settled, no re-entrance. */
type IntroPhase = 'wait' | 'run' | 'skip';

export default function NavigationGlass({
                                            name = 'FILIP ONDREJ',
                                            homeHref = '/',
                                            bookHref = 'https://www.cal.com/filipondrej/15min',
                                            className = '',
                                        }: NavigationGlassProps) {
    const headerRef = useRef<HTMLElement | null>(null);
    const progressRef = useRef<HTMLSpanElement | null>(null);
    const [activeId, setActiveId] = useState<SectionId | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [introGo, setIntroGo] = useState(false);
    const introSkipRef = useRef(false);

    // The bar performs its entrance the moment the loader lifts — the flicker
    // machinery doubles as the materialize effect. SSR HTML has everything
    // visible (crawlers see a full nav); the pre-reveal hide happens client-side
    // only, invisibly, behind the loader overlay.
    useEffect(() => {
        const revealDone = () =>
            (window as unknown as { __loaderPerf?: { reveal?: number } })
                .__loaderPerf?.reveal !== undefined;

        if (revealDone()) {
            introSkipRef.current = true;
            setIntroGo(true);
            return;
        }
        let raf = 0;
        const check = () => {
            if (revealDone()) {
                setIntroGo(true);
                return;
            }
            raf = window.requestAnimationFrame(check);
        };
        raf = window.requestAnimationFrame(check);
        return () => window.cancelAnimationFrame(raf);
    }, []);

    const intro: IntroPhase = introGo ? (introSkipRef.current ? 'skip' : 'run') : 'wait';

    const closeMenu = useCallback(() => setMenuOpen(false), []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeMenu();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [closeMenu]);

    useEffect(() => {
        if (!menuOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [menuOpen]);

    useEffect(() => {
        let raf = 0;

        const update = () => {
            raf = 0;
            const headerHeight = headerRef.current?.offsetHeight ?? 64;
            const probe = headerHeight + window.innerHeight * 0.32;

            // Journey tick: the line's echo in the chrome. Written imperatively
            // from the same rAF (like the spine's tip) — no React re-renders.
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
            progressRef.current?.style.setProperty('transform', `scaleX(${p})`);
            headerRef.current?.setAttribute(
                'data-scrolled',
                window.scrollY > 300 ? 'true' : 'false',
            );

            let current: SectionId | null = null;
            let bestTop = -Infinity;

            for (const item of NAV_ITEMS) {
                const section = document.getElementById(item.id);
                if (!section) continue;

                const top = section.getBoundingClientRect().top;
                if (top <= probe && top > bestTop) {
                    bestTop = top;
                    current = item.id;
                }
            }

            setActiveId((previous) => (previous === current ? previous : current));
        };

        const schedule = () => {
            if (raf) return;
            raf = window.requestAnimationFrame(update);
        };

        schedule();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);

        return () => {
            if (raf) window.cancelAnimationFrame(raf);
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
        };
    }, []);

    const goToSection = useCallback((id: SectionId) => {
        const section = document.getElementById(id);
        if (!section) {
            // Subpage (e.g. /projects): the sections aren't in this document —
            // go home and let the browser land on the anchor.
            window.location.href = `${homeHref}#${id}`;
            return;
        }

        const headerHeight = headerRef.current?.offsetHeight ?? 64;
        const top = section.getBoundingClientRect().top + window.scrollY - headerHeight - 10;

        window.scrollTo({
            top: Math.max(0, top),
            behavior: 'smooth',
        });

        window.history.replaceState(null, '', `#${id}`);
    }, [homeHref]);

    const goHome = useCallback(
        (event: MouseEvent<HTMLAnchorElement>) => {
            const onHomePage = window.location.pathname === homeHref;
            if (!onHomePage) return;

            event.preventDefault();
            closeMenu();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${window.location.search}`,
            );
        },
        [closeMenu, homeHref],
    );

    return (
        <header
            ref={headerRef}
            className={`glass-nav ${className}`.trim()}
            data-open={menuOpen ? 'true' : 'false'}
        >
            <nav className="glass-nav__inner" aria-label="Primary navigation">
                <NameLink name={name} href={homeHref} onClick={goHome} intro={intro} />

                <div className="glass-nav__desktop">
                    <div className="glass-nav__links">
                        {NAV_ITEMS.map((item, index) => (
                            <SignalLink
                                key={item.id}
                                href={`#${item.id}`}
                                label={item.label}
                                index={String(index + 1).padStart(2, '0')}
                                active={activeId === item.id}
                                accent={'accent' in item && item.accent}
                                intro={intro}
                                introDelay={140 + index * 80}
                                onClick={(event) => {
                                    event.preventDefault();
                                    goToSection(item.id);
                                }}
                            />
                        ))}
                    </div>

                    <BookLink href={bookHref} intro={intro} introDelay={140 + NAV_ITEMS.length * 80} />
                </div>

                <button
                    className="glass-nav__toggle"
                    type="button"
                    aria-expanded={menuOpen}
                    aria-controls="glass-nav-mobile"
                    aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    <span>{menuOpen ? 'CLOSE' : 'MENU'}</span>
                    <span className="glass-nav__toggle-icon" aria-hidden="true">
                        <i />
                        <i />
                    </span>
                </button>
            </nav>

            <div
                id="glass-nav-mobile"
                className="glass-nav__mobile"
                aria-hidden={!menuOpen}
            >
                <nav className="glass-nav__mobile-inner" aria-label="Mobile navigation">
                    <div className="glass-nav__mobile-links">
                        {NAV_ITEMS.map((item, index) => (
                            <SignalLink
                                key={item.id}
                                href={`#${item.id}`}
                                label={item.label}
                                index={String(index + 1).padStart(2, '0')}
                                active={activeId === item.id}
                                accent={'accent' in item && item.accent}
                                tabIndex={menuOpen ? 0 : -1}
                                onClick={(event) => {
                                    event.preventDefault();
                                    closeMenu();
                                    goToSection(item.id);
                                }}
                            />
                        ))}
                    </div>

                    <BookLink
                        href={bookHref}
                        className="glass-nav__book--mobile"
                        tabIndex={menuOpen ? 0 : -1}
                        onClick={closeMenu}
                    />
                </nav>
            </div>

            {/* Journey tick: rides ON the bottom hairline; gold tip = you are here. */}
            <span className="glass-nav__progress" ref={progressRef} aria-hidden="true" />

            <style jsx global>{`
                .glass-nav {
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    width: 100%;
                    color: #fff;
                    /* Liquid glass: more translucent, heavier blur + saturation +
                       a touch of brightness so the content refracts through, with
                       a specular top edge. */
                    background:
                            linear-gradient(
                                    180deg,
                                    rgba(14, 14, 16, 0.5) 0%,
                                    rgba(5, 5, 5, 0.34) 100%
                            );
                    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
                    box-shadow:
                            0 1px 0 rgba(255, 255, 255, 0.07) inset,
                            0 -1px 0 rgba(255, 255, 255, 0.02) inset,
                            0 18px 44px rgba(0, 0, 0, 0.24);
                    -webkit-backdrop-filter: blur(28px) saturate(170%) brightness(1.06);
                    backdrop-filter: blur(28px) saturate(170%) brightness(1.06);
                    transition: background 0.5s ease;
                }

                /* Past the hero the bar settles into something slightly more
                   solid — the chrome acknowledges the journey has started. */
                .glass-nav[data-scrolled='true'] {
                    background: linear-gradient(
                            180deg,
                            rgba(12, 12, 14, 0.72) 0%,
                            rgba(5, 5, 5, 0.6) 100%
                    );
                }

                /* Journey tick: 1px of travelled path riding the bottom
                   hairline, gold at the leading end — "you are here" in the
                   line's own language. Written per-frame from the rAF
                   (transform only, no transition — pixel-locked like the spine). */
                .glass-nav__progress {
                    position: absolute;
                    left: 0;
                    bottom: -1px;
                    width: 100%;
                    height: 1px;
                    transform: scaleX(0);
                    transform-origin: 0 50%;
                    background: linear-gradient(
                            90deg,
                            rgba(255, 255, 255, 0.22) 0%,
                            rgba(255, 255, 255, 0.55) 82%,
                            #ffd60a 97%,
                            #ffd60a 100%
                    );
                    pointer-events: none;
                    z-index: 3;
                    will-change: transform;
                }

                .glass-nav::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    background: linear-gradient(
                            90deg,
                            rgba(255, 255, 255, 0.035),
                            transparent 24%,
                            transparent 76%,
                            rgba(255, 255, 255, 0.025)
                    );
                }

                .glass-nav__inner {
                    position: relative;
                    z-index: 2;
                    width: 100%;
                    min-height: 3rem;
                    padding-inline: var(--gutter, clamp(2rem, 8.5vw, 6.25rem));
                    display: flex;
                    align-items: center;
                    gap: clamp(2rem, 4.5vw, 5rem);
                }

                .glass-nav__name {
                    flex: 0 0 auto;
                    color: rgba(255, 255, 255, 0.96);
                    font-family: 'Rajdhani', monospace;
                    font-size: 1.125rem;
                    font-weight: 600;
                    line-height: 1;
                    letter-spacing: 0.14em;
                    text-decoration: none;
                    white-space: nowrap;
                    transition:
                            color 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                            opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .glass-nav__name:hover,
                .glass-nav__name:focus-visible {
                    color: #fff;
                    opacity: 0.72;
                }

                .glass-nav__desktop {
                    /* One tight menu cluster on the RIGHT, next to the CTA —
                       the empty run between the name and the cluster is the
                       hierarchy. Distributing across the width made six equal
                       islands with no grouping. */
                    min-width: 0;
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    /* CTA separation must read wider than the 2rem inter-link
                       gap, or the button joins the cluster. */
                    gap: clamp(1.8rem, 3.3vw, 3.2rem);
                }

                .glass-nav__links {
                    flex: 0 1 auto;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: clamp(1.2rem, 2.2vw, 2rem);
                }

                .glass-nav-link {
                    position: relative;
                    display: inline-flex;
                    align-items: baseline;
                    gap: 0.38rem;
                    padding-block: 0.7rem;
                    color: rgba(255, 255, 255, 0.68);
                    font-family: 'Rajdhani', monospace;
                    /* The site's label DNA: tiny uppercase, wide tracking —
                       same voice as the tape / graph labels, not body size. */
                    font-size: 0.8rem;
                    font-weight: 600;
                    line-height: 1;
                    letter-spacing: 0.14em;
                    text-decoration: none;
                    text-transform: uppercase;
                    white-space: nowrap;
                    transform-origin: center;
                    transition:
                            color 0.34s cubic-bezier(0.16, 1, 0.3, 1),
                            opacity 0.34s cubic-bezier(0.16, 1, 0.3, 1),
                            transform 0.34s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .glass-nav-link__index {
                    color: rgba(255, 255, 255, 0.3);
                    font-size: 0.6rem;
                    font-weight: 600;
                    letter-spacing: 0.04em;
                    font-variant-numeric: tabular-nums;
                    transition: color 0.34s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .glass-nav-link__label {
                    display: inline-flex;
                    align-items: center;
                }

                .glass-nav-link__slot {
                    position: relative;
                    display: inline-block;
                    line-height: 1;
                }

                .glass-nav-link__slot-letter {
                    display: inline-block;
                    line-height: 1;
                }

                .glass-nav-link__slot[data-digit='true'] .glass-nav-link__slot-letter {
                    visibility: hidden;
                }

                .glass-nav-link__slot-digit {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-variant-numeric: tabular-nums;
                    font-feature-settings: 'tnum' 1;
                }

                .glass-nav-link:hover,
                .glass-nav-link:focus-visible,
                .glass-nav-link[data-active='true'],
                .glass-nav-link[data-flickering='true'] {
                    color: #fff;
                }

                /* No hover scale: transforming 12.8px text shimmers on Windows;
                   the flicker IS the hover event (motion rules: color/opacity). */

                .glass-nav__name[data-hidden='true'],
                .glass-nav-link[data-hidden='true'],
                .glass-nav__book[data-hidden='true'] {
                    opacity: 0;
                    pointer-events: none;
                }

                /* "You are here" is an earned gold moment (style guide §6.1),
                   like the graph's locked year and the footer's active dot. */
                .glass-nav-link[data-active='true'] .glass-nav-link__index {
                    color: rgba(255, 214, 10, 0.85);
                }

                .glass-nav__links:has(.glass-nav-link:hover)
                .glass-nav-link:not(:hover) {
                    opacity: 0.28;
                }

                .glass-nav-link[data-accent='true'] .glass-nav-link__label {
                    background: ${GOLD_GRADIENT};
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .glass-nav-link[data-accent='true'] .glass-nav-link__index {
                    color: rgba(255, 214, 10, 0.62);
                }

                /* Flicker digits on the gold link: the label's background-clip:
                   text + transparent fill doesn't reach the absolutely-positioned
                   digit overlays (and the ghost letter under them is
                   visibility:hidden), so digits rendered INVISIBLE — the label
                   looked eaten char-by-char during the wave. Digits get their
                   own solid gold so COLLABORATE flickers like every other link. */
                .glass-nav-link[data-accent='true'] .glass-nav-link__slot-digit {
                    color: #ffd60a;
                    -webkit-text-fill-color: #ffd60a;
                }

                .glass-nav-link[data-accent='true']:hover,
                .glass-nav-link[data-accent='true']:focus-visible {
                    filter: drop-shadow(0 0 12px rgba(255, 214, 10, 0.16));
                }

                .glass-nav__book {
                    flex: 0 0 auto;
                    position: relative;
                    min-height: 2.45rem;
                    padding: 0.76rem 1rem 0.72rem 1.1rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.7rem;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.36);
                    color: rgba(255, 255, 255, 0.94);
                    background: rgba(255, 255, 255, 0.025);
                    font-family: 'Rajdhani', monospace;
                    font-size: 0.82rem;
                    font-weight: 600;
                    line-height: 1;
                    letter-spacing: 0.13em;
                    text-decoration: none;
                    white-space: nowrap;
                    transition:
                            color 0.38s cubic-bezier(0.16, 1, 0.3, 1),
                            background 0.38s cubic-bezier(0.16, 1, 0.3, 1),
                            border-color 0.38s cubic-bezier(0.16, 1, 0.3, 1),
                            opacity 0.34s cubic-bezier(0.16, 1, 0.3, 1),
                            transform 0.38s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .glass-nav__book::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: #fff;
                    transform: translateY(102%);
                    transition: transform 0.42s cubic-bezier(0.16, 1, 0.3, 1);
                }

                /* Only the label wrapper + arrow get lifted above the fill —
                   NOT every span, or the absolute digit overlays inside the
                   flicker slots would be forced back to position:relative. */
                .glass-nav__book .glass-nav-link__label,
                .glass-nav__book svg {
                    position: relative;
                    z-index: 1;
                }

                .glass-nav__book svg {
                    stroke: currentColor;
                    stroke-width: 1.2;
                    stroke-linecap: square;
                    stroke-linejoin: miter;
                    transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .glass-nav__book:hover,
                .glass-nav__book:focus-visible {
                    color: #050505;
                    border-color: #fff;
                    transform: translateY(-1px);
                }

                .glass-nav__book:hover::before,
                .glass-nav__book:focus-visible::before {
                    transform: translateY(0);
                }

                .glass-nav__book:hover svg,
                .glass-nav__book:focus-visible svg {
                    transform: translate(2px, -2px);
                }

                .glass-nav__toggle {
                    display: none;
                    margin-left: auto;
                    padding: 0.65rem 0;
                    align-items: center;
                    gap: 0.75rem;
                    border: 0;
                    color: #fff;
                    background: transparent;
                    font-family: 'Rajdhani', monospace;
                    font-size: 0.78rem;
                    font-weight: 600;
                    line-height: 1;
                    letter-spacing: 0.14em;
                    cursor: pointer;
                }

                .glass-nav__toggle-icon {
                    position: relative;
                    width: 25px;
                    height: 14px;
                }

                .glass-nav__toggle-icon i {
                    position: absolute;
                    left: 0;
                    width: 100%;
                    height: 1px;
                    background: currentColor;
                    transition:
                            top 0.36s cubic-bezier(0.16, 1, 0.3, 1),
                            transform 0.36s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .glass-nav__toggle-icon i:first-child {
                    top: 3px;
                }

                .glass-nav__toggle-icon i:last-child {
                    top: 11px;
                }

                .glass-nav[data-open='true'] .glass-nav__toggle-icon i:first-child {
                    top: 7px;
                    transform: rotate(45deg);
                }

                .glass-nav[data-open='true'] .glass-nav__toggle-icon i:last-child {
                    top: 7px;
                    transform: rotate(-45deg);
                }

                /* Compact dropdown panel, NOT a full-screen sheet. Positioned
                   absolute (the header's backdrop-filter makes it the containing
                   block for fixed descendants anyway — position: fixed silently
                   resolved inset against the 49px bar, leaving the links spilling
                   over the page with a 1px-tall background). Solid paint: the
                   panel must read even where backdrop blur can't apply. */
                .glass-nav__mobile {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    z-index: 1;
                    visibility: hidden;
                    pointer-events: none;
                    max-height: calc(100svh - 3rem);
                    overflow-y: auto;
                    /* Fully opaque: nested backdrop-filter doesn't apply inside
                       the header's own filter, and any alpha lets bright content
                       (gold title glow) ghost through the rows. Solid black is
                       the site's language for the rare filled surface anyway. */
                    background: #070708;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
                    opacity: 0;
                    transform: translateY(-8px);
                    transition:
                            opacity 0.28s ease,
                            transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                            visibility 0s linear 0.4s;
                }

                .glass-nav[data-open='true'] .glass-nav__mobile {
                    visibility: visible;
                    pointer-events: auto;
                    opacity: 1;
                    transform: translateY(0);
                    transition-delay: 0s;
                }

                .glass-nav__mobile-inner {
                    padding: 0.5rem var(--gutter, clamp(2rem, 8.5vw, 6.25rem)) 1.5rem;
                }

                .glass-nav__mobile-links {
                    display: flex;
                    flex-direction: column;
                }

                /* Same label DNA as the desktop links, one readable size up. */
                .glass-nav__mobile-links .glass-nav-link {
                    width: 100%;
                    padding-block: 0.95rem;
                    gap: 0.7rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.09);
                    font-size: 1.05rem;
                    font-weight: 600;
                    letter-spacing: 0.12em;
                }

                .glass-nav__mobile-links .glass-nav-link__index {
                    min-width: 2.2rem;
                    font-size: 0.65rem;
                }

                .glass-nav__book--mobile {
                    width: 100%;
                    min-height: 2.8rem;
                    margin-top: 1.25rem;
                    font-size: 0.85rem;
                }

                .glass-nav a:focus-visible,
                .glass-nav button:focus-visible {
                    outline: 1px solid rgba(255, 255, 255, 0.9);
                    outline-offset: 4px;
                }

                @media (max-width: 1260px) {
                    .glass-nav__inner {
                        gap: 2rem;
                    }

                    .glass-nav__desktop {
                        gap: 1.35rem;
                    }

                    .glass-nav__links {
                        gap: 0.9rem;
                    }

                    .glass-nav-link {
                        font-size: 0.75rem;
                        letter-spacing: 0.1em;
                    }

                    .glass-nav-link__index {
                        font-size: 0.58rem;
                    }
                }

                @media (max-width: 980px) {
                    .glass-nav__desktop {
                        display: none;
                    }

                    .glass-nav__toggle {
                        display: inline-flex;
                    }
                }

                @media (min-width: 981px) {
                    .glass-nav__mobile {
                        display: none;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .glass-nav *,
                    .glass-nav *::before,
                    .glass-nav *::after {
                        scroll-behavior: auto !important;
                        transition-duration: 0.01ms !important;
                        animation-duration: 0.01ms !important;
                    }
                }
            `}</style>
        </header>
    );
}

/* Entrance choreography: hidden while the loader is up, then each element
   flickers into place at its own delay. Reduced motion / client-nav remounts
   render settled immediately. Returns whether the element is hidden. */
function useIntro(intro: IntroPhase, delayMs: number, startFlicker: () => void) {
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        if (intro === 'wait') {
            setHidden(true);
            return;
        }
        if (intro === 'skip') {
            setHidden(false);
            return;
        }
        const reduced =
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        if (reduced) {
            setHidden(false);
            return;
        }
        const timer = window.setTimeout(() => {
            setHidden(false);
            startFlicker();
        }, delayMs);
        return () => window.clearTimeout(timer);
    }, [intro, delayMs, startFlicker]);

    return hidden;
}

/* ---------------- shared wave-flicker machinery ----------------
   Used by the section links AND the BOOK A CALL button. */

function useWaveFlicker(word: string) {
    const [current, setCurrent] = useState(word);
    const [flickering, setFlickering] = useState(false);
    const intervalRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const startedAtRef = useRef(0);

    const clearTimers = useCallback(() => {
        if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const settle = useCallback(() => {
        clearTimers();
        setCurrent(word);
        setFlickering(false);
    }, [clearTimers, word]);

    const startFlicker = useCallback(() => {
        const reduced =
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        if (reduced || intervalRef.current !== null) return;

        startedAtRef.current = performance.now();
        setFlickering(true);

        const totalDuration =
            FLICKER_HOLD_MS + Math.max(0, word.length - 1) * FLICKER_STAGGER_MS;

        const tick = () => {
            const elapsed = performance.now() - startedAtRef.current;
            let next = '';

            for (let index = 0; index < word.length; index += 1) {
                const joinsAt = index * FLICKER_STAGGER_MS;
                const settlesAt = joinsAt + FLICKER_HOLD_MS;
                const character = word[index];

                next +=
                    character !== ' ' && elapsed >= joinsAt && elapsed < settlesAt
                        ? Math.random() < 0.5
                            ? '0'
                            : '1'
                        : character;
            }

            setCurrent(next);
        };

        tick();
        intervalRef.current = window.setInterval(tick, FLICKER_TICK_MS);
        timeoutRef.current = window.setTimeout(settle, totalDuration + 20);
    }, [settle, word]);

    useEffect(() => clearTimers, [clearTimers]);

    return { current, flickering, startFlicker };
}

/* Each slot is sized by its OWN letter (ghost, hidden while a digit shows) \u2014
   Rajdhani is proportional, so fixed ch-width slots squeezed wide glyphs (W)
   into their neighbours. The digit overlays centered in the letter's box;
   total width never changes. */
function WaveLabel({ word, current }: { word: string; current: string }) {
    return (
        <span className="glass-nav-link__label" aria-hidden="true">
            {word.split('').map((letter, characterIndex) => {
                const shown = current[characterIndex];
                const isDigit = shown === '0' || shown === '1';
                return (
                    <span
                        key={characterIndex}
                        className="glass-nav-link__slot"
                        data-digit={isDigit ? 'true' : 'false'}
                    >
                        <span className="glass-nav-link__slot-letter">
                            {letter === ' ' ? '\u00A0' : letter}
                        </span>
                        {isDigit && (
                            <span className="glass-nav-link__slot-digit">{shown}</span>
                        )}
                    </span>
                );
            })}
        </span>
    );
}

interface NameLinkProps {
    name: string;
    href: string;
    intro?: IntroPhase;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

function NameLink({ name, href, intro = 'skip', onClick }: NameLinkProps) {
    const word = name.toUpperCase();
    const { current, startFlicker } = useWaveFlicker(word);
    const hidden = useIntro(intro, 0, startFlicker);

    return (
        <a
            className="glass-nav__name"
            href={href}
            aria-label={word}
            data-hidden={hidden ? 'true' : 'false'}
            onMouseEnter={startFlicker}
            onFocus={startFlicker}
            onClick={onClick}
        >
            <WaveLabel word={word} current={current} />
        </a>
    );
}

interface SignalLinkProps {
    href: string;
    label: string;
    index: string;
    active?: boolean;
    accent?: boolean;
    intro?: IntroPhase;
    introDelay?: number;
    tabIndex?: number;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

function SignalLink({
                        href,
                        label,
                        index,
                        active = false,
                        accent = false,
                        intro = 'skip',
                        introDelay = 0,
                        tabIndex,
                        onClick,
                    }: SignalLinkProps) {
    const word = label.toUpperCase();
    const { current, flickering, startFlicker } = useWaveFlicker(word);
    const hidden = useIntro(intro, introDelay, startFlicker);

    return (
        <a
            href={href}
            className="glass-nav-link"
            data-active={active ? 'true' : 'false'}
            data-accent={accent ? 'true' : 'false'}
            data-flickering={flickering ? 'true' : 'false'}
            data-hidden={hidden ? 'true' : 'false'}
            aria-current={active ? 'location' : undefined}
            aria-label={word}
            tabIndex={tabIndex}
            onMouseEnter={startFlicker}
            onFocus={startFlicker}
            onClick={onClick}
        >
            <span className="glass-nav-link__index" aria-hidden="true">
                [{index}]
            </span>

            <WaveLabel word={word} current={current} />
        </a>
    );
}

interface BookLinkProps {
    href: string;
    className?: string;
    intro?: IntroPhase;
    introDelay?: number;
    tabIndex?: number;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

function BookLink({
                      href,
                      className = '',
                      intro = 'skip',
                      introDelay = 0,
                      tabIndex,
                      onClick,
                  }: BookLinkProps) {
    const word = 'BOOK A CALL';
    const { current, flickering, startFlicker } = useWaveFlicker(word);
    const hidden = useIntro(intro, introDelay, startFlicker);

    return (
        <a
            className={`glass-nav__book ${className}`.trim()}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={word}
            data-flickering={flickering ? 'true' : 'false'}
            data-hidden={hidden ? 'true' : 'false'}
            tabIndex={tabIndex}
            onMouseEnter={startFlicker}
            onFocus={startFlicker}
            onClick={onClick}
        >
            <WaveLabel word={word} current={current} />
            <svg
                aria-hidden="true"
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
            >
                <path d="M3.5 12.5 12.5 3.5M6 3.5h6.5V10" />
            </svg>
        </a>
    );
}