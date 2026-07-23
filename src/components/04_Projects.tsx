'use client';

import React from 'react';
import { LineAnchor } from '@/components/00_LineAnchor';
import ProjectModal from '@/components/ProjectModal';
import { PROJECTS, type ProjectItem } from '@/data/projects';

export default function Projects() {
    const sectionRef = React.useRef<HTMLElement | null>(null);
    // Clicking a card opens its detail modal (the "project story"), replacing the old
    // image-zoom lightbox. The modal opens on whichever image the card was showing.
    const [modalProject, setModalProject] = React.useState<ProjectItem | null>(null);
    const [modalStartIndex, setModalStartIndex] = React.useState(0);
    const [currentImageIndex, setCurrentImageIndex] = React.useState<Record<string, number>>(
        PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {})
    );

    React.useEffect(() => {
        const root = sectionRef.current;
        if (!root) return;
        const cards = Array.from(root.querySelectorAll<HTMLElement>('.proj-card, .all-tile'));
        const io = new IntersectionObserver(
            (entries) => entries.forEach((en) => en.isIntersecting && en.target.classList.add('in-view')),
            { rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
        );
        cards.forEach((c) => io.observe(c));
        return () => io.disconnect();
    }, []);

    const openModal = (project: ProjectItem, startIndex: number) => {
        setModalStartIndex(startIndex);
        setModalProject(project);
    };

    const handlePrevImage = (projectId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const project = PROJECTS.find((p) => p.id === projectId);
        if (!project) return;
        setCurrentImageIndex((prev) => {
            const current = prev[projectId] || 0;
            const newIndex = current === 0 ? project.images.length - 1 : current - 1;
            return { ...prev, [projectId]: newIndex };
        });
    };

    const handleNextImage = (projectId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const project = PROJECTS.find((p) => p.id === projectId);
        if (!project) return;
        setCurrentImageIndex((prev) => {
            const current = prev[projectId] || 0;
            const newIndex = current === project.images.length - 1 ? 0 : current + 1;
            return { ...prev, [projectId]: newIndex };
        });
    };

    return (
        <section ref={sectionRef} className="projects">
            {/* Top anchor */}
            <div className="pointer-events-none absolute top-0 left-0 z-50">
                <LineAnchor id="projects-top" position="left" offsetX={100} />
            </div>

            <div className="grid">
                {PROJECTS.map((p, i) => {
                    const currentImg = currentImageIndex[p.id] || 0;
                    const showArrows = p.images.length > 1;

                    return (
                        <article key={p.id} className="proj-card">
                            <div className="caption">
                                <span className="index">[{String(i + 1).padStart(2, '0')}]</span>
                                <span className="dot" />
                                {typeof p.year === 'number' && <span className="year">{p.year}</span>}
                            </div>

                            <h3 className="p-title">{p.title}</h3>

                            <div className="visual-container">
                                {/* Main clickable image area — opens the project detail modal.
                                    Images are stacked and cross-faded (opacity) so switching
                                    carousel images is a soft dissolve, not a hard cut. */}
                                <div
                                    className="image-clickable-area"
                                    onClick={() => openModal(p, currentImg)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            openModal(p, currentImg);
                                        }
                                    }}
                                    aria-label={`Open ${p.title} details`}
                                >
                                    {p.images.map((src, idx) => (
                                        <img
                                            key={src}
                                            src={src}
                                            alt={`${p.title} - Image ${idx + 1}`}
                                            className={idx === currentImg ? 'active' : ''}
                                            loading="lazy"
                                            decoding="async"
                                            aria-hidden={idx === currentImg ? undefined : true}
                                        />
                                    ))}
                                </div>

                                {/* Arrow navigation overlay */}
                                {showArrows && (
                                    <>
                                        <button
                                            type="button"
                                            className="nav-arrow nav-prev"
                                            onClick={(e) => handlePrevImage(p.id, e)}
                                            aria-label="Previous image"
                                        >
                                            <svg width="20" height="160" viewBox="0 0 20 160" fill="none" preserveAspectRatio="none">
                                                <path
                                                    d="M15 16L5 80L15 144"
                                                    stroke="currentColor"
                                                    strokeLinecap="square"
                                                    strokeLinejoin="miter"
                                                    vectorEffect="non-scaling-stroke"
                                                />
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            className="nav-arrow nav-next"
                                            onClick={(e) => handleNextImage(p.id, e)}
                                            aria-label="Next image"
                                        >
                                            <svg width="20" height="160" viewBox="0 0 20 160" fill="none" preserveAspectRatio="none">
                                                <path
                                                    d="M5 16L15 80L5 144"
                                                    stroke="currentColor"
                                                    strokeLinecap="square"
                                                    strokeLinejoin="miter"
                                                    vectorEffect="non-scaling-stroke"
                                                />
                                            </svg>
                                        </button>

                                        {/* Dots indicator */}
                                        <div className="image-dots">
                                            {p.images.map((_, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className={`dot-indicator ${idx === currentImg ? 'active' : ''}`}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setCurrentImageIndex((prev) => ({
                                                            ...prev,
                                                            [p.id]: idx,
                                                        }));
                                                    }}
                                                    aria-label={`View image ${idx + 1} of ${p.images.length}`}
                                                >
                                                    <div className="dot-inner" />
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            <p className="blurb">{p.blurb}</p>

                            {p.tags && p.tags.length > 0 && (
                                <div className="tags">
                                    {p.tags.map((t) => (
                                        <span key={t} className="tag">#{t}</span>
                                    ))}
                                </div>
                            )}
                        </article>
                    );
                })}

                {/* Full-width index tile — same card DNA, links to the /projects
                    matrix. Sits as its own row so the hand-tuned 2×2 stays intact. */}
                <a className="all-tile" href="/projects">
                    <div className="caption">
                        <span className="index">[{String(PROJECTS.length + 1).padStart(2, '0')}]</span>
                        <span className="dot" />
                        <span className="year">INDEX</span>
                    </div>
                    <div className="all-tile-body">
                        <span className="all-tile-label">ALL PROJECTS</span>
                        <span className="all-tile-hint">THE FULL MATRIX — EVERY BUILD, EVERY YEAR</span>
                    </div>
                    <span className="all-tile-corner" aria-hidden="true">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            width="28"
                            height="28"
                            stroke="white"
                            fill="none"
                            strokeWidth="0.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M4 5 v14" />
                            <path d="M4 5 h3" />
                            <path d="M4 19 h3" />
                            <path d="M20 5 v14" />
                            <path d="M20 5 h-3" />
                            <path d="M20 19 h-3" />
                            <path d="M9 15 L15 9" />
                            <path d="M15 9 h-4" />
                            <path d="M15 9 v4" />
                        </svg>
                    </span>
                </a>
            </div>

            {/* Bottom anchor */}
            <div className="pointer-events-none absolute bottom-20 left-0 z-50">
                <LineAnchor id="projects-bottom" position="left" offsetX={100} />
            </div>

            {/* Project detail modal (story-style, same family as the timeline/collab modals) */}
            <ProjectModal
                data={modalProject}
                isOpen={modalProject !== null}
                onClose={() => setModalProject(null)}
                startIndex={modalStartIndex}
            />

            <style jsx>{`
                .projects {
                    padding: 0;
                    position: relative;
                    background: transparent;
                    width: 100%;
                }

                .grid {
                    width: 100%;
                    margin: 0;
                    /* Content inset MIRRORS the title's --pt-left exactly (13.889vw == 200px
                       at 1440, floored at var(--gutter), capped at 12.5rem) so the cards
                       left-align with the title above and scale with the spine identically.
                       Was 12.5vw (== 180px @1440), which left the cards only 80px from the
                       spine while the title sits 100px off it — the misalignment is now gone. */
                    padding-left: clamp(var(--gutter), 13.889vw, 12.5rem);
                    padding-right: clamp(var(--gutter), 13.889vw, 12.5rem);
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(min(100%, 500px), 1fr));
                    gap: clamp(24px, 3.125vw, 65px);
                    overflow: visible;
                    position: relative;
                    isolation: isolate;
                }

                /* Force 2 columns on wider screens, 1 column on mobile */
                @media (min-width: 1200px) {
                    .grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                @media (max-width: 1199px) and (min-width: 900px) {
                    .grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                @media (max-width: 899px) {
                    .grid {
                        grid-template-columns: 1fr;
                    }
                }

                .proj-card {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    background: rgba(255, 255, 255, 0.03);
                    transition: transform 140ms cubic-bezier(0.22, 1, 0.36, 1),
                    box-shadow 140ms ease, border-color 120ms ease, background 120ms ease,
                    opacity 250ms ease;
                    opacity: 0;
                    transform-origin: center;
                    transform: translateZ(0) scale(1);
                    will-change: transform, box-shadow;
                    z-index: 0;
                }
                .proj-card.in-view {
                    opacity: 1;
                }

                .proj-card:hover {
                    transform: scale(1.03);
                    /*box-shadow: 0 32px 88px rgba(0, 0, 0, 0.7);*/
                    border-color: rgba(255, 255, 255, 0.28);
                    background: rgba(255, 255, 255, 0.05);
                    z-index: 50;
                }

                .proj-card::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 0 36px rgba(255, 255, 255, 0.12);
                    opacity: 0;
                    transition: opacity 140ms ease;
                }
                .proj-card:hover::after {
                    opacity: 1;
                }

                /* ALL PROJECTS index tile — card DNA, one full-width row. */
                .all-tile {
                    grid-column: 1 / -1;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    background: rgba(255, 255, 255, 0.03);
                    text-decoration: none;
                    opacity: 0;
                    transition: opacity 250ms ease, border-color 120ms ease,
                    background 120ms ease;
                }
                .all-tile.in-view {
                    opacity: 1;
                }
                .all-tile:hover {
                    border-color: rgba(255, 255, 255, 0.28);
                    background: rgba(255, 255, 255, 0.05);
                }

                .all-tile-body {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    gap: 1.5rem;
                    flex-wrap: wrap;
                    padding: clamp(18px, 2vw, 28px) 14px clamp(20px, 2.2vw, 30px);
                }

                .all-tile-label {
                    font: 700 clamp(20px, 2rem, 32px) / 1 'Rajdhani', monospace;
                    color: #fff;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                }

                .all-tile-hint {
                    font: 600 0.6875rem/1 'Rajdhani', monospace;
                    letter-spacing: 0.16em;
                    color: rgba(255, 255, 255, 0.4);
                    text-transform: uppercase;
                    transition: color 0.25s ease;
                }
                .all-tile:hover .all-tile-hint {
                    color: rgba(255, 255, 255, 0.65);
                }

                .all-tile-corner {
                    position: absolute;
                    top: clamp(6px, 1.5vw, 10px);
                    right: clamp(8px, 2vw, 12px);
                    width: clamp(20px, 4vw, 28px);
                    height: clamp(20px, 4vw, 28px);
                    pointer-events: none;
                    opacity: 0;
                    transform: translate(-4px, 4px) scale(0.92);
                    transition:
                            opacity 0.28s ease-out,
                            transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
                }
                .all-tile-corner svg {
                    stroke: rgba(255, 255, 255, 0.92);
                }
                .all-tile:hover .all-tile-corner,
                .all-tile:focus-visible .all-tile-corner {
                    opacity: 1;
                    transform: translate(0, 0) scale(1);
                }
                .all-tile:focus-visible {
                    outline: 1px solid rgba(255, 255, 255, 0.9);
                    outline-offset: 4px;
                }

                .caption {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                }

                .index,
                .year {
                    /* 0.6875rem == 11px at 1440; scales with the fluid root (was fixed px). */
                    font: 600 0.6875rem/1 'Rajdhani', monospace;
                    letter-spacing: 0.16em;
                    color: rgba(255, 255, 255, 0.56);
                    text-transform: uppercase;
                }

                .dot {
                    width: 3px;
                    height: 3px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.25);
                }

                .p-title {
                    /* rem so the card heading rides the fluid root font like the rest of
                       the site (raw vw pinned it at 22px across all desktop widths — frozen,
                       not fluid). 1.375rem == 22px at 1440 (no-op there); bounds are safety. */
                    font: 800 clamp(16px, 1.375rem, 22px) / 1.15 'Rajdhani', monospace;
                    color: #fff;
                    margin: 10px 14px 8px 14px;
                    letter-spacing: 0.01em;
                }

                /* IMAGE CONTAINER - proper layering */
                .visual-container {
                    position: relative;
                    width: 100%;
                    aspect-ratio: 16 / 9;
                    overflow: hidden;
                    background: #000;
                }

                .image-clickable-area {
                    position: absolute;
                    inset: 0;
                    cursor: pointer;
                    z-index: 1;
                }

                /* Keyboard focus ring — a soft white inset glow instead of the default
                   browser outline (consistent with the site's no-default-box preference). */
                .image-clickable-area:focus-visible {
                    outline: none;
                    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.85);
                }

                /* Stacked + cross-faded carousel images (was a single hard-swapped img). */
                .image-clickable-area img {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                    opacity: 0;
                    transition: opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .image-clickable-area img.active {
                    opacity: 1;
                }

                /* ARROWS */
                .nav-arrow {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 70px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    border: none;
                    color: rgba(255, 255, 255, 0.5);
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
                    opacity: 0;
                    z-index: 10;
                }

                .nav-prev {
                    left: 0;
                    justify-content: flex-start;
                    /* 18px @1440 → fluid (1.25vw == 18px), capped at rem so look holds */
                    padding-left: clamp(12px, 1.25vw, 1.125rem);
                }

                .nav-next {
                    right: 0;
                    justify-content: flex-end;
                    padding-right: clamp(12px, 1.25vw, 1.125rem);
                }

                /* Reveal on hover, or when a control inside is focused BY KEYBOARD only
                   (:has(:focus-visible), not :focus-within — the latter stayed true after a
                   mouse click left a button focused, so the arrows lingered after mouse-out). */
                .visual-container:hover .nav-arrow,
                .visual-container:has(:focus-visible) .nav-arrow {
                    opacity: 1;
                }

                .nav-arrow:hover,
                .nav-arrow:focus-visible {
                    color: rgba(255, 255, 255, 0.95);
                    outline: none;
                }

                .nav-arrow:active {
                    transform: scale(0.96);
                }

                .nav-arrow svg {
                    width: 20px;
                    height: 160px;
                    stroke-width: 1.5px;
                    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
                }

                .nav-arrow:hover svg {
                    stroke-width: 2px;
                    transform: scale(1.05);
                }

                .nav-prev:hover svg {
                    transform: translateX(-3px) scale(1.05);
                }

                .nav-next:hover svg {
                    transform: translateX(3px) scale(1.05);
                }

                /* DOTS */
                .image-dots {
                    position: absolute;
                    bottom: 12px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 6px;
                    z-index: 10;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .visual-container:hover .image-dots,
                .visual-container:has(:focus-visible) .image-dots {
                    opacity: 1;
                }

                .dot-indicator {
                    padding: 4px;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: transform 0.3s ease;
                }

                .dot-indicator:hover,
                .dot-indicator:focus-visible {
                    transform: translateY(-2px);
                    outline: none;
                }

                .dot-inner {
                    width: 10px;
                    height: 10px;
                    background: rgba(255, 255, 255, 0.2);
                    border: 2px solid rgba(255, 255, 255, 0.4);
                    border-radius: 50%;
                    transition: all 0.3s ease;
                    pointer-events: none;
                }

                .dot-indicator.active .dot-inner {
                    background: rgba(255, 255, 255, 0.9);
                    border-color: rgba(255, 255, 255, 0.9);
                    box-shadow: 0 0 12px rgba(255, 255, 255, 0.5);
                    transform: scale(1.2);
                }

                .dot-indicator:hover .dot-inner,
                .dot-indicator:focus-visible .dot-inner {
                    background: rgba(255, 255, 255, 0.4);
                    border-color: rgba(255, 255, 255, 0.6);
                }

                .blurb {
                    padding: 12px 14px 0;
                    /* 0.9375rem == 15px at 1440; scales with the fluid root (was fixed px). */
                    font: 400 0.9375rem/1.6 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.84);
                    margin: 0;
                    flex: 1;
                }

                /* TAG STYLE */
                .tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: clamp(10px, 2vw, 12px);
                    padding: 10px 14px 14px;
                }

                .tag {
                    padding: clamp(5px, 1vw, 6px) clamp(10px, 2vw, 12px);
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    font: 400 clamp(9px, 2vw, 11px)/1 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.5);
                    letter-spacing: 0.08em;
                    text-transform: lowercase;
                    transition: all 0.3s ease;
                }

                .tag:hover {
                    color: rgba(255, 255, 255, 0.8);
                    border-color: rgba(255, 255, 255, 0.3);
                }

                /* MOBILE - 1 column */
                @media (max-width: 768px) {
                    /* Grid padding intentionally NOT overridden here:
                       the gutter-floored clamp above stays continuous with the spine
                       (removed step that jumped padding to 5vw/16px). */
                    .nav-arrow {
                        opacity: 1;
                        width: 60px;
                    }

                    .image-dots {
                        opacity: 1;
                    }
                }

                @media (max-width: 640px) {
                    .proj-card:active {
                        transform: scale(0.98);
                    }
                }

                /* Heading overflow floor on very small screens (no layout change). */
                @media (max-width: 480px) {
                    .p-title {
                        font-size: clamp(15px, 5vw, 19px);
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    * {
                        transition: none !important;
                        animation: none !important;
                    }
                }
            `}</style>
        </section>
    );
}