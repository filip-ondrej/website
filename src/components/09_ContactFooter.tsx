'use client';

import React from 'react';
import { LineAnchor } from '@/components/00_LineAnchor';
import Image from 'next/image';

type ContactMethod = {
    id: string;
    label: string;
    value: string;
    href: string;
    // link = external (new tab) · email = mailto · internal = same-tab route ·
    // download = browser downloads the target file
    type: 'email' | 'link' | 'internal' | 'download';
    accent?: boolean; // gold treatment (the collaborate invitation)
};

const contactMethods: ContactMethod[] = [
    {
        id: 'linkedin',
        label: 'LINKEDIN',
        value: 'linkedin.com/in/filip-ondrej',
        href: 'https://linkedin.com/in/filip-ondrej',
        type: 'link',
    },
    {
        id: 'email',
        label: 'EMAIL',
        value: 'ondrejfilip152@gmail.com',
        href: 'mailto:ondrejfilip152@gmail.com',
        type: 'email',
    },
    {
        id: 'cal',
        label: 'BOOK A CALL',
        value: 'cal.com/filipondrej/15min',
        href: 'https://www.cal.com/filipondrej/15min',
        type: 'link',
    },
    {
        // Backstop for the nav's collaborate entry — the /collaborate page is
        // roadmap #5; the link 404s until it lands (pre-launch, acceptable).
        id: 'collaborate',
        label: 'COLLABORATE',
        value: 'filipondrej.com/collaborate',
        href: '/collaborate',
        type: 'internal',
        accent: true,
    },
    {
        // The PDF ships in the content pass — drop it at /public/cv/.
        id: 'cv',
        label: 'RESUME',
        value: 'filip-ondrej-cv.pdf',
        href: '/cv/filip-ondrej-cv.pdf',
        type: 'download',
    },
];

// Timeline images - 10 years of robotics.
// .webp is emitted by `npm run img` from /public/timeline/<year>.jpg sources —
// drop the source .jpg in, run the script, and the entry lights up.
const timelineImages = [
    { year: '2016', age: 'AGE 12', caption: 'FIRST ROBOTICS COMPETITION', src: '/timeline/2016.webp' },
    { year: '2017', age: 'AGE 13', caption: 'NATIONAL CHAMPION', src: '/timeline/2017.webp' },
    { year: '2018', age: 'AGE 14', caption: 'TEAM LEADER', src: '/timeline/2018.webp' },
    { year: '2019', age: 'AGE 15', caption: 'ROBOT MAGICIAN', src: '/timeline/2019.webp' },
    { year: '2020', age: 'AGE 16', caption: 'MONTREAL WORLD CUP', src: '/timeline/2020.webp' },
    { year: '2021', age: 'AGE 17', caption: 'SYDNEY 4TH PLACE', src: '/timeline/2021.webp' },
    { year: '2022', age: 'AGE 18', caption: 'ELECTRONICS MASTERY', src: '/timeline/2022.webp' },
    { year: '2023', age: 'AGE 19', caption: 'YOUNG CREATOR AWARD', src: '/timeline/2023.webp' },
    { year: '2024', age: 'AGE 20', caption: 'THAILAND BEST HARDWARE', src: '/timeline/2024.webp' },
    { year: '2025', age: 'AGE 21', caption: 'GRADUATION & FRANCE', src: '/timeline/2025.webp' },
];

export default function ContactFooter() {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const rootRef = React.useRef<HTMLElement | null>(null);

    // Slideshow hygiene: the 4s auto-advance runs ONLY while the footer is
    // actually on screen (no interval churn while reading the rest of the
    // page), holds while the cursor rests on the picture (don't race the
    // reader), and stops entirely under prefers-reduced-motion (the CSS kills
    // the cross-fade, so auto-advancing would hard-JUMP images — worse than
    // the motion it replaces). The year dots always work — user-initiated
    // swaps are fine in every mode.
    const [inView, setInView] = React.useState(false);
    const [galleryHovered, setGalleryHovered] = React.useState(false);
    const [reducedMotion, setReducedMotion] = React.useState(false);

    React.useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const apply = () => setReducedMotion(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);

    React.useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const io = new IntersectionObserver(
            (entries) => setInView(entries[0]?.isIntersecting ?? false),
            { threshold: 0.15 }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    React.useEffect(() => {
        if (!inView || galleryHovered || reducedMotion) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % timelineImages.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [inView, galleryHovered, reducedMotion]);

    return (
        <footer
            ref={rootRef}
            className="contact-footer"
            style={{
                // Cage x-inset mirrors the spine's x exactly (100px @1440):
                // 100 * min(innerWidth/1440, rootFont/16), clamped — the same CSS
                // mirror the title sections use (--X-spine-x). INLINE so the cage
                // and content paddings exist at first paint (the line anchors
                // measure on mount). Replaces the old JS innerWidth/INSET math,
                // which applied a frame late and drove a resize-state re-render.
                ['--cf-x' as string]: 'clamp(18px, min(6.944vw, 6.25rem), 160px)',
            } as React.CSSProperties}
        >
            {/* LINE ANCHORS - Top and Bottom */}
            <div className="anchors">
                <div className="anchor-top">
                    <LineAnchor id="footer-start-left" position="left" offsetX={100} />
                </div>
                <div className="anchor-bottom">
                    <LineAnchor id="footer-end-left" position="left" offsetX={100} />
                </div>
            </div>

            {/* GRID — pure-CSS cage lines on --cf-x (was a JS-measured SVG) */}
            <div className="cage" aria-hidden="true">
                <span className="cage-v cage-l" />
                <span className="cage-v cage-r" />
                <span className="cage-h" />
            </div>

            {/* CONTENT */}
            <div className="content">
                {/* LEFT: Image Gallery */}
                <div className="gallery">
                    <div
                        className="gallery-container"
                        onMouseEnter={() => setGalleryHovered(true)}
                        onMouseLeave={() => setGalleryHovered(false)}
                    >
                        {timelineImages.map((img, i) => (
                            <div key={img.year} className={`slide ${i === currentIndex ? 'active' : ''}`}>
                                <Image
                                    src={img.src}
                                    alt={`Robotics ${img.year}`}
                                    fill
                                    style={{ objectFit: 'cover' }}
                                    priority={i === 0}
                                />
                            </div>
                        ))}

                        {/* Info overlay - all on left */}
                        <div className="info">
                            <div className="age">{timelineImages[currentIndex].age}</div>
                            <div className="year">{timelineImages[currentIndex].year}</div>
                            <div className="caption">{timelineImages[currentIndex].caption}</div>
                        </div>
                    </div>

                    {/* Timeline - outside image */}
                    <div className="timeline">
                        {timelineImages.map((img, i) => (
                            <button
                                key={img.year}
                                className={`dot ${i === currentIndex ? 'active' : ''}`}
                                onClick={() => setCurrentIndex(i)}
                            >
                                <span className="label">{img.year}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Contact — the links divide the column's full height
                    (which the gallery + year strip on the left determine). */}
                <div className="contact">
                    {contactMethods.map((c) => (
                        <a
                            key={c.id}
                            href={c.href}
                            className={`link${c.accent ? ' link--accent' : ''}`}
                            target={c.type === 'link' ? '_blank' : undefined}
                            rel={c.type === 'link' ? 'noopener noreferrer' : undefined}
                            download={c.type === 'download' ? true : undefined}
                        >
                            <span className="label">{c.label}</span>
                            <span className="value">{c.value}</span>
                            <div className="arrow">
                                {c.type === 'download' ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 4v12M6 12l6 6 6-6M5 21h14"/>
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M7 17L17 7M17 7H7M17 7V17"/>
                                    </svg>
                                )}
                            </div>
                        </a>
                    ))}
                </div>
            </div>

            {/* FOOTER BAR */}
            <div className="bar">
                <div className="bar-inner">
                    <span>© 2026 FILIP ONDREJ</span>
                    <span className="divider">/</span>
                    <span>10 YEARS OF ROBOTICS</span>
                    <span className="spacer" />
                    <span>DESIGNED & ENGINEERED WITH PRECISION</span>
                </div>
            </div>

            <style jsx>{`
                .contact-footer {
                    position: relative;
                    width: 100%;
                    background: transparent;
                    font-family: 'Rajdhani', monospace;
                    margin-top: 0;
                    padding-top: 0;
                }

                /* LINE ANCHORS */
                .anchors {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    z-index: 25;
                }

                .anchor-top {
                    position: absolute;
                    left: 0;
                    top: 0;
                }

                .anchor-bottom {
                    position: absolute;
                    left: 0;
                    bottom: 0;
                }

                /* GRID cage */
                .cage {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    z-index: 0;
                }
                .cage-v {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 1px;
                    background: rgba(255, 255, 255, 0.08);
                }
                .cage-l { left: var(--cf-x); }
                .cage-r { right: var(--cf-x); }
                .cage-h {
                    position: absolute;
                    top: 0;
                    left: var(--cf-x);
                    /* Runs THROUGH the right cage line to the browser edge (the
                       line above LINKEDIN) — the left end still starts at the
                       spine mirror. */
                    right: 0;
                    height: 1px;
                    background: rgba(255, 255, 255, 0.08);
                }

                /* CONTENT */
                .content {
                    position: relative;
                    z-index: 1;
                    display: grid;
                    /* minmax(0, …) so both columns can shrink below their content's
                       intrinsic width — without it the socials column refused to
                       compress (min-width:auto) and overflowed the viewport while
                       the picture stopped scaling. */
                    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
                    /* rem + --cf-x so the whole footer rides the fluid engine
                       (all magnitudes below are the 1440 values — no-op there).
                       gap 0: the contact column starts AT the gallery's right
                       border — the two halves share one middle line; the links'
                       own padding provides the breathing room. */
                    padding: 0 var(--cf-x);
                    gap: 0;
                    align-items: stretch;
                    margin-top: 0;
                }

                /* LEFT: Gallery */
                .gallery {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                    min-width: 0;
                }

                .gallery-container {
                    position: relative;
                    width: 100%;
                    aspect-ratio: 16 / 9;
                    overflow: hidden;
                    border-left: 1px solid rgba(255, 255, 255, 0.1);
                    border-right: 1px solid rgba(255, 255, 255, 0.1);
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    background: #000;
                }

                .slide {
                    position: absolute;
                    inset: 0;
                    opacity: 0;
                    transition: opacity 0.8s ease;
                }

                .slide.active {
                    opacity: 1;
                }

                .info {
                    position: absolute;
                    bottom: clamp(20px, 4vh, 30px);
                    left: 1.875rem;
                    z-index: 2;
                    display: flex;
                    flex-direction: column;
                    gap: clamp(4px, 1vh, 6px);
                    max-width: min(18.75rem, 80%);
                }

                .age {
                    font-size: 0.6875rem;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.5);
                }

                .year {
                    font-size: 4rem;
                    font-weight: 900;
                    line-height: 0.9;
                    letter-spacing: -0.02em;
                    color: rgba(255, 255, 255, 0.95);
                }

                .caption {
                    font-size: 0.9375rem;
                    font-weight: 600;
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.7);
                }

                /* Timeline */
                .timeline {
                    display: flex;
                    gap: 0;
                    border-left: 1px solid rgba(255, 255, 255, 0.1);
                    border-right: 1px solid rgba(255, 255, 255, 0.1);
                }

                .dot {
                    flex: 1;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    padding: clamp(12px, 2vh, 16px) 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0;
                    border-top: 2px solid rgba(255, 255, 255, 0.1);
                    transition: border-color 0.3s ease;
                }

                .dot.active {
                    border-top-color: rgba(255, 255, 255, 0.9);
                }

                .dot:hover {
                    border-top-color: rgba(255, 255, 255, 0.3);
                }

                .dot .label {
                    font-size: 0.625rem;
                    font-weight: 600;
                    letter-spacing: 0.1em;
                    color: rgba(255, 255, 255, 0.4);
                    transition: color 0.3s ease, font-size 0.3s ease;
                    /* Reserve the ACTIVE size's height so the row never grows when
                       a year swells — a 1px document-height change every 4s would
                       otherwise trip the spine's settle observer into a rebuild
                       on every slide tick. */
                    line-height: calc(0.625rem * 16 / 14);
                }

                .dot.active .label {
                    color: rgba(255, 255, 255, 0.9);
                    /* Projected year grows by the SAME ratio as the graph's
                       focused year label (16px over its 14px base). */
                    font-size: calc(0.625rem * 16 / 14);
                }

                .dot:hover .label {
                    color: rgba(255, 255, 255, 0.7);
                }

                /* RIGHT: Contact */
                .contact {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                    justify-content: flex-start;
                    min-width: 0;
                }

                .link {
                    position: relative;
                    display: grid;
                    grid-template-columns: 6.25rem minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 1.5rem;
                    /* flex: 1 — the links share the column height EQUALLY, so the
                       stack's bottom lands exactly on the gallery + year strip's
                       bottom (grid align-items: stretch equalizes the columns).
                       The padding is now a minimum, not the height driver. */
                    flex: 1 1 0;
                    padding: clamp(14px, 2vh, 20px) 2rem;
                    text-decoration: none;
                    border-top: 1px solid rgba(255, 255, 255, 0.08);
                    background: transparent;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .link:first-child {
                    border-top: none;
                }

                .link::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 3px;
                    background: rgba(255, 255, 255, 0.8);
                    transform: scaleY(0);
                    transform-origin: top;
                    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .link:hover {
                    background: rgba(255, 255, 255, 0.03);
                    padding-left: 2.5rem;
                }

                .link:hover::before {
                    transform: scaleY(1);
                }

                .link .label {
                    font-size: 0.625rem;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.4);
                    transition: color 0.3s ease;
                    grid-column: 1;
                }

                .link:hover .label {
                    color: rgba(255, 255, 255, 0.8);
                }

                .link .value {
                    font-size: 1.375rem;
                    font-weight: 600;
                    letter-spacing: -0.01em;
                    color: rgba(255, 255, 255, 0.85);
                    transition: all 0.3s ease;
                    grid-column: 2;
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .link:hover .value {
                    color: #fff;
                    text-shadow: 0 0 16px rgba(255, 255, 255, 0.2);
                }

                .link .arrow {
                    width: 1.25rem;
                    height: 1.25rem;
                    color: rgba(255, 255, 255, 0.3);
                    opacity: 0;
                    transform: translate(-8px, 0) scale(0.8);
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    grid-column: 3;
                }

                .link:hover .arrow {
                    opacity: 1;
                    transform: translate(0, 0) scale(1);
                    color: rgba(255, 255, 255, 0.8);
                }

                /* GOLD accent link — the collaborate invitation. Same anatomy as
                   the other links; only the palette shifts to the site gold. */
                .link--accent .value {
                    background: linear-gradient(135deg, #FEF3C7 0%, #FDE047 25%, #FFD60A 50%, #F59E0B 75%, #B45309 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .link--accent .label {
                    color: rgba(255, 214, 10, 0.45);
                }
                .link--accent::before {
                    background: linear-gradient(180deg, #FDE047 0%, #F59E0B 100%);
                }
                .link--accent:hover {
                    background: rgba(255, 214, 10, 0.04);
                }
                .link--accent:hover .label {
                    color: rgba(255, 214, 10, 0.85);
                }
                .link--accent:hover .value {
                    text-shadow: none;
                    filter: drop-shadow(0 0 14px rgba(255, 214, 10, 0.35));
                }
                .link--accent:hover .arrow {
                    color: rgba(255, 214, 10, 0.85);
                }

                /* FOOTER BAR */
                .bar {
                    position: relative;
                    z-index: 1;
                    border-top: 1px solid rgba(255, 255, 255, 0.08);
                    /* Horizontal inset = spine x + 3.125rem (100px + 50px = 150px
                       at 1440, both terms fluid) so the copyright / precision
                       captions breathe instead of starting exactly at the line. */
                    padding: clamp(32px, 4vh, 40px) calc(var(--cf-x) + 3.125rem);
                    background: transparent;
                }

                .bar-inner {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    font-size: 0.625rem;
                    font-weight: 500;
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.35);
                }

                .divider {
                    color: rgba(255, 255, 255, 0.15);
                }

                .spacer {
                    flex: 1;
                }

                /* RESPONSIVE */
                /* Keep image + socials side-by-side as long as possible (was 1024px —
                   the picture doesn't need to stay big, so collapse only when the
                   columns genuinely can't share the row anymore). */
                @media (max-width: 640px) {
                    .content {
                        grid-template-columns: 1fr;
                        gap: clamp(50px, 8vh, 70px);
                    }
                }

                @media (max-width: 768px) {
                    .timeline {
                        overflow-x: auto;
                        scrollbar-width: none;
                    }

                    .timeline::-webkit-scrollbar {
                        display: none;
                    }

                    .dot {
                        min-width: 50px;
                    }

                    .link {
                        grid-template-columns: 1fr;
                        gap: clamp(8px, 2vh, 10px);
                    }

                    .link .label {
                        grid-column: 1;
                    }

                    .link .value {
                        grid-column: 1;
                    }

                    .link .arrow {
                        display: none;
                    }
                }

                @media (max-width: 640px) {
                    .bar-inner {
                        flex-wrap: wrap;
                    }

                    .spacer {
                        display: none;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    * {
                        transition: none !important;
                        animation: none !important;
                    }
                }
            `}</style>
        </footer>
    );
}