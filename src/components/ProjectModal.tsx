'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useScrollLock } from '@/lib/useScrollLock';

/* ==================== TYPES ==================== */
export type ProjectVideo = { src: string; poster?: string; caption?: string };
export type ProjectDoc = { label: string; href: string };

// The card only needs id/title/year/blurb/images/tags. Everything below `--- rich ---`
// is OPTIONAL and drives the detail modal — each block renders ONLY when its field is
// present, so the data can be filled in later without touching this component and the
// modal grows from "gallery + overview" into a full case study as content arrives.
export type ProjectModalData = {
    id: string;
    title: string;
    year?: number;
    blurb: string;
    images: string[];
    tags?: string[];
    // --- rich (optional) ---
    hook?: string;                 // one-line hero subtitle
    overview?: string;             // fuller intro paragraph (falls back to blurb)
    challenge?: string;            // "the stakes" — the problem
    outcome?: string;              // "the stakes" — the result
    metrics?: string[];            // stat badges e.g. "4th / 20+ countries"
    story?: string;                // long-form markdown; supports ![IMAGE-n] / ![VIDEO-n]
    takeaway?: string;             // the lesson / reflection
    videos?: ProjectVideo[];       // embedded videos (Media section + ![VIDEO-n])
    documents?: ProjectDoc[];      // external docs / links (footer buttons)
};

type Props = {
    data: ProjectModalData | null;
    isOpen: boolean;
    onClose: () => void;
    startIndex?: number;   // gallery opens on the image the card was showing
};

type Section = { name: string; id: string };

export default function ProjectModal({ data, isOpen, onClose, startIndex = 0 }: Props) {
    const backdropRef = React.useRef<HTMLDivElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const closeBtnRef = React.useRef<HTMLButtonElement>(null);
    const prevFocusRef = React.useRef<HTMLElement | null>(null);
    const [scrollProgress, setScrollProgress] = React.useState(0);
    const [activeSection, setActiveSection] = React.useState(0);
    const [imgIdx, setImgIdx] = React.useState(startIndex);

    // Lock the page + tell the ProgressLine wheel engine to yield (native scroll inside).
    useScrollLock(isOpen);

    const images = data?.images ?? [];
    const hasGallery = images.length > 1;

    // Which content-driven sections exist (drives both the dots and the scroll spy).
    const sections = React.useMemo<Section[]>(() => {
        const list: Section[] = [{ name: 'Intro', id: 'project-hero' }, { name: 'Overview', id: 'project-overview' }];
        if (data?.challenge || data?.outcome) list.push({ name: 'Stakes', id: 'project-stakes' });
        if (data?.story) list.push({ name: 'Story', id: 'project-story' });
        if (data?.videos && data.videos.length > 0) list.push({ name: 'Media', id: 'project-media' });
        if (data?.takeaway) list.push({ name: 'Takeaway', id: 'project-takeaway' });
        return list;
    }, [data]);

    // Reset the gallery to the clicked image whenever the modal (re)opens.
    React.useEffect(() => {
        if (isOpen) setImgIdx(startIndex);
    }, [isOpen, startIndex, data?.id]);

    const goImage = React.useCallback((dir: number) => {
        const n = images.length;
        if (n <= 1) return;
        setImgIdx((i) => (i + dir + n) % n);
    }, [images.length]);

    /* Keyboard: Esc closes, ←/→ walk the gallery, ↑/↓ scroll, Tab is trapped. */
    React.useEffect(() => {
        if (!isOpen) return;

        const onKey = (e: KeyboardEvent) => {
            const container = containerRef.current;
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowRight') {
                if (hasGallery) { e.preventDefault(); goImage(1); }
            } else if (e.key === 'ArrowLeft') {
                if (hasGallery) { e.preventDefault(); goImage(-1); }
            } else if (e.key === 'ArrowDown') {
                if (container) { e.preventDefault(); container.scrollBy({ top: 100, behavior: 'smooth' }); }
            } else if (e.key === 'ArrowUp') {
                if (container) { e.preventDefault(); container.scrollBy({ top: -100, behavior: 'smooth' }); }
            } else if (e.key === 'Tab') {
                const root = containerRef.current;
                if (!root) return;
                const focusable = root.querySelectorAll<HTMLElement>(
                    'button, a[href], video[controls], [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                const active = document.activeElement as HTMLElement | null;
                if (e.shiftKey && (active === first || !root.contains(active))) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && active === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        prevFocusRef.current = document.activeElement as HTMLElement | null;
        document.addEventListener('keydown', onKey);

        const container = containerRef.current;
        if (container) container.scrollTop = 0;
        const focusTimer = window.setTimeout(() => closeBtnRef.current?.focus(), 60);

        return () => {
            document.removeEventListener('keydown', onKey);
            clearTimeout(focusTimer);
            prevFocusRef.current?.focus?.();
        };
    }, [isOpen, onClose, hasGallery, goImage]);

    /* Scroll-driven progress bar + active-section dots (spy over whatever sections exist). */
    React.useEffect(() => {
        if (!isOpen) return;
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const scrolled = container.scrollTop;
            const total = container.scrollHeight - container.clientHeight;
            setScrollProgress(total > 0 ? Math.min(1, scrolled / total) : 0);

            const navEls = Array.from(container.querySelectorAll<HTMLElement>('[data-nav-section]'));
            let current = 0;
            navEls.forEach((el, i) => {
                const relTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
                if (relTop <= container.clientHeight * 0.5) current = i;
            });
            setActiveSection(current);
        };

        const observer = new IntersectionObserver(
            (entries) => entries.forEach((en) => en.isIntersecting && en.target.classList.add('in-view')),
            { threshold: 0.05 }
        );
        container.querySelectorAll('.story-section').forEach((s) => observer.observe(s));
        container.addEventListener('scroll', handleScroll);
        handleScroll();

        return () => {
            container.removeEventListener('scroll', handleScroll);
            observer.disconnect();
        };
    }, [isOpen, sections.length]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === backdropRef.current) onClose();
    };

    const scrollToSection = (id: string) => {
        const el = document.getElementById(id);
        const container = containerRef.current;
        if (!el || !container) return;
        const panel = container.querySelector('.progress-system') as HTMLElement | null;
        const panelH = panel?.offsetHeight || 0;
        container.scrollTo({ top: el.offsetTop - panelH, behavior: 'smooth' });
    };

    if (!isOpen || !data) return null;

    const overviewText = data.overview ?? data.blurb;
    const videos = data.videos ?? [];

    return (
        <div
            ref={backdropRef}
            className="project-modal-backdrop"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-label={data.title}
        >
            <div ref={containerRef} className="project-modal-container">
                {/* Sticky progress header */}
                <div className="progress-system">
                    <div className="progress-bar" style={{ width: `${scrollProgress * 100}%` }} />

                    <div className="panel-left" />

                    <div className="section-dots">
                        {sections.map((s, i) => (
                            <button
                                key={s.id}
                                className={`section-dot ${i <= activeSection ? 'active' : ''}`}
                                onClick={() => scrollToSection(s.id)}
                                aria-label={`Jump to ${s.name}`}
                            >
                                <span className="section-dot-inner" />
                                <span className="section-label">{s.name}</span>
                            </button>
                        ))}
                    </div>

                    <button ref={closeBtnRef} className="close-btn-panel" onClick={onClose} aria-label="Close">
                        <div className="close-icon"><span /><span /></div>
                    </button>
                </div>

                {/* HERO — image gallery */}
                <div id="project-hero" data-nav-section className="hero-section">
                    <div className="gallery">
                        {images.map((src, i) => (
                            <img
                                key={src}
                                src={src}
                                alt={`${data.title} — image ${i + 1}`}
                                className={`gallery-image ${i === imgIdx ? 'active' : ''}`}
                                loading={i === 0 ? 'eager' : 'lazy'}
                                decoding="async"
                                aria-hidden={i === imgIdx ? undefined : true}
                            />
                        ))}
                        <div className="hero-overlay" />
                    </div>

                    {hasGallery && (
                        <>
                            <button type="button" className="gallery-arrow gallery-prev" onClick={() => goImage(-1)} aria-label="Previous image">
                                <svg width="20" height="160" viewBox="0 0 20 160" fill="none" preserveAspectRatio="none">
                                    <path d="M15 16L5 80L15 144" stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
                                </svg>
                            </button>
                            <button type="button" className="gallery-arrow gallery-next" onClick={() => goImage(1)} aria-label="Next image">
                                <svg width="20" height="160" viewBox="0 0 20 160" fill="none" preserveAspectRatio="none">
                                    <path d="M5 16L15 80L5 144" stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
                                </svg>
                            </button>

                            <div className="gallery-dots">
                                {images.map((_, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        className={`gallery-dot ${i === imgIdx ? 'active' : ''}`}
                                        onClick={() => setImgIdx(i)}
                                        aria-label={`Go to image ${i + 1} of ${images.length}`}
                                    />
                                ))}
                            </div>
                        </>
                    )}

                    <div className="hero-content">
                        <div className="hero-meta">
                            {typeof data.year === 'number' && <span className="meta-item">{data.year}</span>}
                            {hasGallery && <span className="meta-divider">/</span>}
                            {hasGallery && <span className="meta-item">{images.length} images</span>}
                        </div>
                        <h1 className="hero-title"><span className="title-word">{data.title}</span></h1>
                        {data.hook && <p className="hero-hook">{data.hook}</p>}
                    </div>

                    <button className="scroll-indicator" onClick={() => scrollToSection('project-overview')} aria-label="Scroll to overview">
                        <span className="scroll-text">Overview</span>
                        <svg className="scroll-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M19 12l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                {/* OVERVIEW — description + optional metrics + tags */}
                <div id="project-overview" data-nav-section className="story-section overview-section">
                    <div className="section-header">
                        <span className="section-number">01</span>
                        <span className="section-title">OVERVIEW</span>
                    </div>

                    <div className="overview-content">
                        <p className="overview-text">{overviewText}</p>

                        {data.metrics && data.metrics.length > 0 && (
                            <div className="metrics-grid">
                                {data.metrics.map((m, i) => (
                                    <div key={i} className="metric-badge">{m}</div>
                                ))}
                            </div>
                        )}

                        {data.tags && data.tags.length > 0 && (
                            <div className="overview-tags">
                                {data.tags.map((t) => (
                                    <span key={t} className="tag">#{t}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* STAKES — challenge → outcome (renders only if provided) */}
                {(data.challenge || data.outcome) && (
                    <div id="project-stakes" data-nav-section className="story-section stakes-section">
                        <div className="section-header">
                            <span className="section-number">02</span>
                            <span className="section-title">THE STAKES</span>
                        </div>
                        <div className="stakes-container">
                            {data.challenge && (
                                <div className="stake-card">
                                    <div className="stake-label">Challenge</div>
                                    <p>{data.challenge}</p>
                                </div>
                            )}
                            {data.challenge && data.outcome && (
                                <div className="stakes-divider"><span className="divider-line" /><span className="divider-arrow">→</span><span className="divider-line" /></div>
                            )}
                            {data.outcome && (
                                <div className="stake-card">
                                    <div className="stake-label">Outcome</div>
                                    <p>{data.outcome}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* STORY — long-form markdown with ![IMAGE-n] / ![VIDEO-n] embeds */}
                {data.story && (
                    <div id="project-story" data-nav-section className="story-section story-content">
                        <div className="section-header">
                            <span className="section-number">03</span>
                            <span className="section-title">THE STORY</span>
                        </div>
                        <ReactMarkdown
                            components={{
                                h2: ({ children, ...props }) => <h2 className="story-h2" {...props}>{children}</h2>,
                                h3: ({ children, ...props }) => <h3 className="story-h3" {...props}>{children}</h3>,
                                p: ({ children, ...props }) => {
                                    const text = children?.toString() || '';
                                    const imgMatch = text.match(/!\[IMAGE-(\d+)\]/);
                                    if (imgMatch) {
                                        const img = images[parseInt(imgMatch[1], 10)];
                                        if (!img) return null;
                                        const [path, caption] = img.split('#').map((s) => s.trim());
                                        return (
                                            <figure className="story-media">
                                                <img src={path} alt={caption || ''} loading="lazy" decoding="async" />
                                                {caption && <figcaption>{caption}</figcaption>}
                                            </figure>
                                        );
                                    }
                                    const vidMatch = text.match(/!\[VIDEO-(\d+)\]/);
                                    if (vidMatch) {
                                        const v = videos[parseInt(vidMatch[1], 10)];
                                        if (!v) return null;
                                        return (
                                            <figure className="story-media">
                                                <video src={v.src} poster={v.poster} controls preload="metadata" />
                                                {v.caption && <figcaption>{v.caption}</figcaption>}
                                            </figure>
                                        );
                                    }
                                    return <p className="story-p" {...props}>{children}</p>;
                                },
                                ul: ({ children, ...props }) => <ul className="story-list" {...props}>{children}</ul>,
                                ol: ({ children, ...props }) => <ol className="story-list ordered" {...props}>{children}</ol>,
                                li: ({ children, ...props }) => <li className="story-li" {...props}>{children}</li>,
                                blockquote: ({ children, ...props }) => (
                                    <blockquote className="story-quote" {...props}><span className="quote-mark">|</span>{children}</blockquote>
                                ),
                                strong: ({ ...props }) => <strong className="story-emphasis" {...props} />,
                            }}
                        >
                            {data.story}
                        </ReactMarkdown>
                    </div>
                )}

                {/* MEDIA — standalone videos not embedded in the story */}
                {videos.length > 0 && (
                    <div id="project-media" data-nav-section className="story-section media-section">
                        <div className="section-header">
                            <span className="section-number">04</span>
                            <span className="section-title">MEDIA</span>
                        </div>
                        <div className="media-list">
                            {videos.map((v, i) => (
                                <figure key={i} className="story-media">
                                    <video src={v.src} poster={v.poster} controls preload="metadata" />
                                    {v.caption && <figcaption>{v.caption}</figcaption>}
                                </figure>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAKEAWAY — the lesson */}
                {data.takeaway && (
                    <div id="project-takeaway" data-nav-section className="story-section takeaway-section">
                        <div className="section-header">
                            <span className="section-number">05</span>
                            <span className="section-title">TAKEAWAY</span>
                        </div>
                        <p className="takeaway-text">{data.takeaway}</p>
                    </div>
                )}

                {/* FOOTER — documents / external links */}
                {data.documents && data.documents.length > 0 && (
                    <div className="story-section footer-section">
                        {data.documents.map((d, i) => (
                            <a key={i} href={d.href} target="_blank" rel="noopener noreferrer" className="doc-button">
                                <span>{d.label}</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                            </a>
                        ))}
                    </div>
                )}
            </div>

            <style jsx>{`
                .project-modal-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.98);
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: clamp(12px, 2vh, 24px);
                    animation: fadeIn 0.3s ease-out;
                    overflow: hidden;
                }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                /* Same square + vmin scaling system as the achievement modal, so all
                   three modals are one size and shrink together with the window. */
                .project-modal-container {
                    width: min(90vmin, 900px);
                    height: min(90vmin, 900px);
                    aspect-ratio: 1 / 1;
                    background: #000;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    overflow-y: auto;
                    overflow-x: hidden;
                    animation: slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                    scroll-behavior: smooth;
                    position: relative;
                    /* No vertical scrollbar — the sticky horizontal progress bar already
                       communicates scroll position. */
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }

                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* ===== Sticky progress header — one row at every window size ===== */
                .progress-system {
                    position: sticky;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 100;
                    background: rgba(0, 0, 0, 0.95);
                    backdrop-filter: blur(10px);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    display: grid;
                    grid-template-columns: 1fr auto 1fr;
                    align-items: center;
                    padding: 0 clamp(12px, 2vmin, 20px);
                    height: clamp(50px, 7vmin, 60px);
                    overflow: hidden;
                }

                .progress-bar {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 2px;
                    background: rgba(255, 255, 255, 0.8);
                    transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .panel-left {
                    height: 100%;
                }

                .close-btn-panel {
                    width: clamp(28px, 4vmin, 32px);
                    height: clamp(28px, 4vmin, 32px);
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    cursor: pointer;
                    transition: border-color 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    overflow: hidden;
                    justify-self: end;
                }

                .close-btn-panel:hover,
                .close-btn-panel:focus-visible {
                    border-color: rgba(255, 255, 255, 0.8);
                    transform: rotate(90deg);
                    outline: none;
                }

                .close-icon {
                    position: relative;
                    width: clamp(12px, 1.8vmin, 14px);
                    height: clamp(12px, 1.8vmin, 14px);
                    margin: auto;
                }
                .close-icon span {
                    position: absolute;
                    top: 50%;
                    left: 0;
                    width: 100%;
                    height: 1px;
                    background: rgba(255, 255, 255, 0.8);
                    transition: background 0.3s ease;
                }
                .close-icon span:first-child { transform: translateY(-50%) rotate(45deg); }
                .close-icon span:last-child { transform: translateY(-50%) rotate(-45deg); }
                .close-btn-panel:hover .close-icon span,
                .close-btn-panel:focus-visible .close-icon span { background: #fff; }

                .section-dots {
                    display: flex;
                    gap: clamp(16px, 3vmin, 28px);
                    justify-content: center;
                    align-items: center;
                    transform: translateY(2px);
                }

                .section-dot {
                    position: relative;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    padding: clamp(6px, 1vmin, 8px);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: clamp(6px, 1vmin, 8px);
                    transition: transform 0.3s ease;
                }

                .section-dot:hover,
                .section-dot:focus-visible { transform: translateY(-2px); outline: none; }

                .section-dot-inner {
                    width: clamp(8px, 1.2vmin, 10px);
                    height: clamp(8px, 1.2vmin, 10px);
                    background: rgba(255, 255, 255, 0.2);
                    border: 2px solid rgba(255, 255, 255, 0.4);
                    border-radius: 50%;
                    transition: all 0.3s ease;
                }

                .section-dot.active .section-dot-inner {
                    background: rgba(255, 255, 255, 0.9);
                    border-color: rgba(255, 255, 255, 0.9);
                    box-shadow: 0 0 12px rgba(255, 255, 255, 0.5);
                    transform: scale(1.2);
                }

                .section-dot:hover .section-dot-inner,
                .section-dot:focus-visible .section-dot-inner {
                    background: rgba(255, 255, 255, 0.4);
                    border-color: rgba(255, 255, 255, 0.6);
                }

                .section-label {
                    font: 400 clamp(8px, 1.2vmin, 10px)/1 'Rajdhani', monospace;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.5);
                    white-space: nowrap;
                    transition: color 0.3s ease;
                }

                .section-dot.active .section-label { color: rgba(255, 255, 255, 0.9); }
                .section-dot:hover .section-label,
                .section-dot:focus-visible .section-label { color: rgba(255, 255, 255, 0.8); }

                /* ===== Hero gallery ===== */
                .hero-section {
                    position: relative;
                    width: 100%;
                    aspect-ratio: 4 / 3;
                    display: flex;
                    align-items: flex-end;
                    overflow: hidden;
                    background: #000;
                }

                .gallery { position: absolute; inset: 0; }

                .gallery-image {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    object-position: center;
                    opacity: 0;
                    transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .gallery-image.active { opacity: 1; }

                .hero-overlay {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to bottom,
                        rgba(0, 0, 0, 0.15) 0%,
                        rgba(0, 0, 0, 0.6) 60%,
                        rgba(0, 0, 0, 0.95) 100%);
                }

                /* Same treatment as the project card arrows so the two feel like one system. */
                .gallery-arrow {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    z-index: 4;
                    width: clamp(44px, 7.8vmin, 70px);
                    display: flex;
                    align-items: center;
                    background: transparent;
                    border: none;
                    color: rgba(255, 255, 255, 0.5);
                    cursor: pointer;
                    transition: color 0.3s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .gallery-prev { left: 0; justify-content: flex-start; padding-left: clamp(10px, 2vmin, 18px); }
                .gallery-next { right: 0; justify-content: flex-end; padding-right: clamp(10px, 2vmin, 18px); }
                .gallery-arrow:hover,
                .gallery-arrow:focus-visible { color: rgba(255, 255, 255, 0.95); outline: none; }
                .gallery-arrow svg {
                    width: clamp(14px, 2.3vmin, 20px);
                    height: clamp(110px, 17.8vmin, 160px);
                    stroke-width: 1.5px;
                    transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), stroke-width 0.3s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .gallery-arrow:hover svg,
                .gallery-arrow:focus-visible svg { stroke-width: 2px; }
                .gallery-prev:hover svg,
                .gallery-prev:focus-visible svg { transform: translateX(-3px) scale(1.05); }
                .gallery-next:hover svg,
                .gallery-next:focus-visible svg { transform: translateX(3px) scale(1.05); }

                .gallery-dots {
                    position: absolute;
                    top: clamp(10px, 1.8vmin, 16px);
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: clamp(6px, 0.9vmin, 8px);
                    z-index: 4;
                }
                .gallery-dot {
                    width: clamp(6px, 0.9vmin, 8px);
                    height: clamp(6px, 0.9vmin, 8px);
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.25);
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    cursor: pointer;
                    padding: 0;
                    transition: all 0.3s ease;
                }
                .gallery-dot.active {
                    background: rgba(255, 255, 255, 0.95);
                    border-color: rgba(255, 255, 255, 0.95);
                    box-shadow: 0 0 10px rgba(255, 255, 255, 0.4);
                    transform: scale(1.15);
                }
                .gallery-dot:hover,
                .gallery-dot:focus-visible { background: rgba(255, 255, 255, 0.5); outline: none; }

                .hero-content {
                    position: relative;
                    z-index: 2;
                    padding: clamp(30px, 5vmin, 60px);
                    /* extra bottom clearance so a wrapped title/hook never collides
                       with the scroll indicator overlapping the hero's bottom edge */
                    padding-bottom: clamp(48px, 8vmin, 72px);
                    width: 100%;
                    pointer-events: none;
                }

                .hero-meta {
                    display: flex;
                    align-items: center;
                    gap: clamp(6px, 1vmin, 8px);
                    margin-bottom: clamp(10px, 1.8vmin, 16px);
                    opacity: 0;
                    animation: fadeInUp 0.6s 0.2s ease forwards;
                    flex-wrap: wrap;
                }
                .meta-item {
                    font: 400 clamp(9px, 1.3vmin, 11px)/1 'Rajdhani', monospace;
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.6);
                }
                .meta-divider { color: rgba(255, 255, 255, 0.2); }

                .hero-title {
                    /* vmin-tracked so it shrinks with the modal (was vw/vh-coupled,
                       which froze or blew up on scaled desktop windows).
                       6.25vmin = 56px at the 900px reference modal — no-op @1440x900. */
                    font: 700 clamp(26px, 6.25vmin, 56px)/1.05 'Rajdhani', monospace;
                    color: #fff;
                    margin: 0;
                    letter-spacing: -0.02em;
                    max-width: 720px;
                    opacity: 0;
                    animation: fadeInUp 0.6s 0.3s ease forwards;
                }
                .title-word { display: inline-block; position: relative; }

                .hero-hook {
                    font: 400 clamp(13px, 2.1vmin, 19px)/1.5 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.88);
                    margin: clamp(10px, 1.6vmin, 14px) 0 0 0;
                    max-width: 620px;
                    opacity: 0;
                    animation: fadeInUp 0.6s 0.4s ease forwards;
                }

                .scroll-indicator {
                    position: absolute;
                    bottom: clamp(-10px, -1.5vmin, -15px);
                    left: 0;
                    right: 0;
                    margin: 0 auto;
                    width: max-content;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    z-index: 5;
                    opacity: 0;
                    animation: fadeInUp 0.8s 0.8s ease forwards;
                    transition: transform 0.3s ease;
                    padding: clamp(15px, 2.5vmin, 20px);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: clamp(6px, 1vmin, 8px);
                }
                .scroll-indicator:hover,
                .scroll-indicator:focus-visible { transform: translateY(4px); outline: none; }
                .scroll-text {
                    font: 400 clamp(10px, 1.5vmin, 13px)/1 'Rajdhani', monospace;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.7);
                    transition: color 0.3s ease;
                }
                .scroll-indicator:hover .scroll-text,
                .scroll-indicator:focus-visible .scroll-text { color: rgba(255, 255, 255, 0.95); }
                .scroll-arrow {
                    stroke: rgba(255, 255, 255, 0.5);
                    transition: stroke 0.3s ease;
                    animation: scrollBounce 2s ease-in-out infinite;
                    display: block;
                    width: clamp(20px, 3vmin, 24px);
                    height: clamp(20px, 3vmin, 24px);
                }
                .scroll-indicator:hover .scroll-arrow,
                .scroll-indicator:focus-visible .scroll-arrow { stroke: rgba(255, 255, 255, 0.9); }

                @keyframes scrollBounce {
                    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(5px); }
                    60% { transform: translateY(3px); }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* ===== Section header (shared) ===== */
                .section-header {
                    display: flex;
                    align-items: center;
                    gap: clamp(12px, 2vmin, 16px);
                    margin: 0 auto clamp(30px, 4vmin, 40px) auto;
                    padding: 0 clamp(30px, 4vmin, 60px) clamp(12px, 2vmin, 16px) clamp(30px, 4vmin, 60px);
                    max-width: 760px;
                    width: 100%;
                    position: relative;
                }
                .section-header::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 30px;
                    right: 30px;
                    height: 1px;
                    background: rgba(255, 255, 255, 0.2);
                }
                .section-number {
                    font: 700 clamp(24px, 3.5vmin, 32px)/1 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.5);
                    letter-spacing: -0.02em;
                }
                .section-title {
                    font: 500 clamp(9px, 1.3vmin, 11px)/1 'Rajdhani', monospace;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.7);
                }

                /* ===== Overview ===== */
                .overview-section { padding: clamp(40px, 6.7vmin, 60px) 0 clamp(15px, 2.2vmin, 20px); background: transparent; }
                .overview-content { max-width: 640px; margin: 0 auto; padding: 0 clamp(30px, 4vmin, 60px); }
                .overview-text {
                    font: 400 clamp(15px, 2vmin, 18px)/1.7 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.82);
                    margin: 0;
                }
                .metrics-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: clamp(9px, 1.4vmin, 12px);
                    margin-top: clamp(22px, 3.6vmin, 32px);
                }
                .metric-badge {
                    padding: clamp(9px, 1.4vmin, 12px) clamp(13px, 2vmin, 18px);
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    font: 600 clamp(11px, 1.6vmin, 14px)/1 'Rajdhani', monospace;
                    letter-spacing: 0.06em;
                    color: rgba(255, 255, 255, 0.9);
                    text-transform: uppercase;
                }
                .overview-tags { display: flex; flex-wrap: wrap; gap: clamp(9px, 1.4vmin, 12px); margin-top: clamp(22px, 3.6vmin, 32px); }
                .tag {
                    padding: clamp(5px, 0.8vmin, 6px) clamp(10px, 1.5vmin, 12px);
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    font: 400 clamp(9px, 1.3vmin, 11px)/1 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.5);
                    letter-spacing: 0.08em;
                    text-transform: lowercase;
                    transition: color 0.3s ease, border-color 0.3s ease;
                }
                .tag:hover { color: rgba(255, 255, 255, 0.8); border-color: rgba(255, 255, 255, 0.3); }

                /* ===== Stakes ===== */
                .stakes-section { padding: clamp(27px, 4.4vmin, 40px) 0; background: transparent; }
                .stakes-container {
                    display: grid;
                    grid-template-columns: 1fr auto 1fr;
                    gap: clamp(16px, 2.7vmin, 24px);
                    align-items: stretch;
                    max-width: 760px;
                    margin: 0 auto;
                    padding: 0 clamp(30px, 4vmin, 60px);
                }
                .stake-card {
                    padding: clamp(16px, 2.7vmin, 24px);
                    background: rgba(255, 255, 255, 0.04);
                    border: 1px solid rgba(255, 255, 255, 0.14);
                    transition: border-color 0.4s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .stake-card:hover { border-color: rgba(255, 255, 255, 0.4); transform: translateY(-3px); }
                .stake-label {
                    font: 600 clamp(9px, 1.3vmin, 11px)/1 'Rajdhani', monospace;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.7);
                    margin-bottom: clamp(8px, 1.4vmin, 12px);
                }
                .stake-card p {
                    font: 400 clamp(14px, 1.8vmin, 16px)/1.6 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.88);
                    margin: 0;
                }
                .stakes-divider { display: flex; align-items: center; gap: clamp(8px, 1.2vmin, 10px); }
                .divider-line { width: clamp(12px, 1.8vmin, 16px); height: 1px; background: rgba(255, 255, 255, 0.15); }
                .divider-arrow { font-size: clamp(14px, 2vmin, 18px); color: rgba(255, 255, 255, 0.35); }

                /* ===== Story (markdown) — one centered column, same as the other modals ===== */
                .story-content { padding: clamp(30px, 4vmin, 50px) 0; }
                .story-h2, .story-h3, .story-p, .story-quote, .story-list, .story-media {
                    max-width: min(550px, 90%);
                    margin-left: auto;
                    margin-right: auto;
                }
                .story-h2 {
                    font: 700 clamp(22px, 3.4vmin, 30px)/1.2 'Rajdhani', monospace;
                    color: #fff;
                    margin: clamp(34px, 5.4vmin, 48px) auto clamp(15px, 2.3vmin, 20px) auto;
                }
                .story-h3 {
                    font: 600 clamp(17px, 2.5vmin, 22px)/1.3 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.9);
                    margin: clamp(26px, 4vmin, 36px) auto clamp(10px, 1.6vmin, 14px) auto;
                }
                .story-p {
                    font: 400 clamp(15px, 1.9vmin, 17px)/1.75 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.75);
                    margin: 0 auto clamp(13px, 2vmin, 18px) auto;
                }
                .story-list { margin: 0 auto clamp(17px, 2.7vmin, 24px) auto; padding-left: clamp(1rem, 2.5vmin, 1.25rem); list-style-position: outside; }
                .story-list.ordered { list-style-type: decimal; }
                .story-list:not(.ordered) { list-style-type: disc; }
                .story-li {
                    margin: clamp(4px, 0.7vmin, 6px) 0;
                    color: rgba(255, 255, 255, 0.75);
                    font: 400 clamp(15px, 1.9vmin, 17px)/1.75 'Rajdhani', monospace;
                }
                .story-quote {
                    margin: clamp(28px, 4.4vmin, 40px) auto;
                    padding: clamp(20px, 3.1vmin, 28px) clamp(22px, 3.6vmin, 32px);
                    position: relative;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .quote-mark {
                    position: absolute;
                    top: clamp(-8px, -1.2vmin, -10px);
                    left: clamp(15px, 2.2vmin, 20px);
                    font-size: clamp(30px, 4.4vmin, 40px);
                    color: rgba(255, 255, 255, 0.12);
                    font-family: Georgia, serif;
                    background: #000;
                    padding: 0 clamp(8px, 1.2vmin, 10px);
                }
                .story-quote p {
                    font: 500 clamp(16px, 2.1vmin, 19px)/1.5 'Rajdhani', monospace;
                    font-style: italic;
                    color: rgba(255, 255, 255, 0.82);
                    margin: 0;
                }
                .story-emphasis { color: #fff; font-weight: 600; }

                /* ===== Media (images/videos embedded or standalone) ===== */
                .media-section { padding: clamp(27px, 4.4vmin, 40px) 0; }
                .media-list { max-width: 760px; margin: 0 auto; padding: 0 clamp(30px, 4vmin, 60px); display: flex; flex-direction: column; gap: clamp(22px, 3.6vmin, 32px); }
                .story-media { margin: clamp(28px, 4.4vmin, 40px) auto; }
                .story-media img,
                .story-media video {
                    display: block;
                    width: 100%;
                    height: auto;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: #000;
                }
                .story-media figcaption {
                    padding: clamp(8px, 1.2vmin, 10px) 4px 0;
                    font: 400 clamp(10px, 1.4vmin, 12px)/1.4 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.5);
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                }
                .media-list .story-media { margin: 0; padding: 0; max-width: none; }

                /* ===== Takeaway ===== */
                .takeaway-section {
                    padding: clamp(30px, 5.5vmin, 50px) clamp(30px, 4vmin, 60px);
                    text-align: center;
                    border-top: 1px solid rgba(255, 255, 255, 0.06);
                }
                .takeaway-text {
                    font: 500 clamp(18px, 2.9vmin, 26px)/1.5 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.9);
                    margin: 0 auto;
                    max-width: 620px;
                }

                /* ===== Footer (documents) ===== */
                .footer-section {
                    padding: clamp(27px, 4.4vmin, 40px) clamp(30px, 4vmin, 60px);
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    flex-wrap: wrap;
                    gap: clamp(12px, 1.8vmin, 16px);
                    justify-content: center;
                }
                .doc-button {
                    display: inline-flex;
                    align-items: center;
                    gap: clamp(8px, 1.4vmin, 12px);
                    padding: clamp(12px, 1.8vmin, 16px) clamp(20px, 3.1vmin, 28px);
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: rgba(255, 255, 255, 0.9);
                    font: 600 clamp(11px, 1.5vmin, 13px)/1 'Rajdhani', monospace;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    text-decoration: none;
                    transition: border-color 0.3s ease, background 0.3s ease, transform 0.3s ease;
                }
                .doc-button:hover,
                .doc-button:focus-visible {
                    border-color: rgba(255, 255, 255, 0.6);
                    background: rgba(255, 255, 255, 0.08);
                    transform: translateY(-2px);
                    outline: none;
                }
                .doc-button svg { transition: transform 0.3s ease; }
                .doc-button:hover svg,
                .doc-button:focus-visible svg { transform: translateX(2px) translateY(-2px); }

                /* Section reveal */
                .story-section {
                    opacity: 0;
                    transform: translateY(40px);
                    transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .story-section.in-view { opacity: 1; transform: translateY(0); }

                .project-modal-container::-webkit-scrollbar { display: none; }

                /* MOBILE — real phones only (was 768px, which also caught scaled-down
                   desktop windows and flipped the hero portrait / restyled the header).
                   The vmin clamps handle small windows; mobile redo comes later. */
                @media (max-width: 480px) {
                    .progress-system {
                        grid-template-columns: 1fr;
                        grid-template-rows: auto auto;
                        padding: clamp(10px, 1.5vmin, 12px);
                        gap: clamp(10px, 1.5vmin, 12px);
                        height: auto;
                    }
                    .panel-left { display: none; }
                    .close-btn-panel { justify-self: center; }
                    .stakes-container { grid-template-columns: 1fr; }
                    .stakes-divider { transform: rotate(90deg); justify-self: center; }
                    .section-label { display: none; }
                    .project-modal-backdrop { padding: 6px; }
                }

                @media (prefers-reduced-motion: reduce) {
                    *, *::before, *::after {
                        animation-duration: 0.01ms !important;
                        animation-iteration-count: 1 !important;
                        transition-duration: 0.01ms !important;
                    }
                }
            `}</style>
        </div>
    );
}
