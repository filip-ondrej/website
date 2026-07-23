'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import { useScrollLock } from '@/lib/useScrollLock';

/* ==================== TYPES ==================== */
export type CollaborationData = {
    slug: string;
    name: string;
    description: string;
    established?: string;
    duration?: string;
    role?: string;
    location?: string;
    outcomes: string[];
    tags: string[];
    images: string[];
    story: string;
};

type Props = {
    data: CollaborationData | null;
    isOpen: boolean;
    onClose: () => void;
    logo?: string;
    href?: string;
    caption?: string;
};

/* Site gold (amber ramp from the title system) — NOT web yellow. */
const GOLD = '245, 158, 11';

/* ==================== COMPONENT ==================== */
export default function CollaborationModal({ data, isOpen, onClose, logo, href, caption }: Props) {
    const backdropRef = React.useRef<HTMLDivElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const arrowRef = React.useRef<SVGSVGElement | null>(null);
    const [scrollProgress, setScrollProgress] = React.useState(0);
    const [activeSection, setActiveSection] = React.useState(0);

    // Shared page lock: body overflow hidden + data-scroll-locked so the
    // ProgressLine wheel engine yields (native scroll inside the modal).
    useScrollLock(isOpen);

    /* Calculate read time */
    function calcReadTimeFromMarkdown(raw: string, wpm = 225): number {
        const noImages = raw.replace(/!\[[^\]]*]\([^)]*\)/g, " ");
        const noCodeBlocks = noImages.replace(/```[\s\S]*?```/g, " ");
        const noInlineCode = noCodeBlocks.replace(/`[^`]*`/g, " ");
        const plain = noInlineCode.replace(/[^\w\s]|_/g, " ");
        const words = plain.trim().split(/\s+/).filter(Boolean).length;
        return Math.max(1, Math.ceil(words / wpm));
    }

    React.useEffect(() => {
        if (!isOpen) return;

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        const handleArrowKeys = (e: KeyboardEvent) => {
            const container = containerRef.current;
            if (!container) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                container.scrollBy({ top: 100, behavior: 'smooth' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                container.scrollBy({ top: -100, behavior: 'smooth' });
            }
        };

        document.addEventListener('keydown', handleEsc);
        document.addEventListener('keydown', handleArrowKeys);

        const container = containerRef.current;
        if (container) {
            container.scrollTop = 0;
        }

        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.removeEventListener('keydown', handleArrowKeys);
        };
    }, [isOpen, onClose]);

    React.useEffect(() => {
        if (!isOpen) return;

        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const scrolled = container.scrollTop;
            const total = container.scrollHeight - container.clientHeight;
            const progress = Math.min(1, scrolled / total);
            setScrollProgress(progress);

            const sections = [
                { id: 'collab-hero', index: 0 },
                { id: 'collab-summary', index: 1 },
                { id: 'collab-stakes', index: 2 },
                { id: 'collab-details', index: 3 }
            ];

            let current = 0;
            sections.forEach(({ id, index }) => {
                const element = container.querySelector<HTMLElement>(`#${id}`);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    const relativeTop = rect.top - containerRect.top;
                    if (relativeTop <= container.clientHeight * 0.5) {
                        current = index;
                    }
                }
            });

            setActiveSection(current);
        };

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('in-view');
                    }
                });
            },
            { threshold: 0.05 }
        );

        const sections = container.querySelectorAll('.story-section, .story-media');
        sections.forEach((section) => observer.observe(section));

        container.addEventListener('scroll', handleScroll);
        handleScroll();

        return () => {
            container.removeEventListener('scroll', handleScroll);
            observer.disconnect();
        };
    }, [isOpen]);

    // Arrow bounces once on open / on hero hover (same behavior as the graph modal).
    const triggerArrowBounce = React.useCallback(() => {
        const el = arrowRef.current;
        if (!el) return;
        el.classList.remove('scroll-arrow-anim');
        void el.getBoundingClientRect(); // force reflow
        el.classList.add('scroll-arrow-anim');
    }, []);

    React.useEffect(() => {
        if (!isOpen) return;
        const timeout = setTimeout(() => {
            triggerArrowBounce();
        }, 900); // after hero fades in
        return () => clearTimeout(timeout);
    }, [isOpen, triggerArrowBounce]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === backdropRef.current) onClose();
    };

    // Memoized: the modal re-renders on every scroll tick (progress state), and an
    // un-memoized ReactMarkdown re-parses + RECREATES its DOM subtree each time —
    // which detaches the nodes the IntersectionObserver watches, so .story-media
    // reveals never fire (and the parse itself is wasted work at scroll rate).
    const storyMarkdown = React.useMemo(() => (
        <ReactMarkdown
            components={{
                h2: ({ children, ...props }) => (
                    <h2 className="story-h2" {...props}>
                        <span className="h2-marker">
                            <svg
                                className="h2-arrow"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </span>
                        {children}
                    </h2>
                ),
                h3: ({ children, ...props }) => (
                    <h3 className="story-h3" {...props}>{children}</h3>
                ),
                p: ({ children, ...props }) => (
                    <p className="story-p" {...props}>{children}</p>
                ),
                ul: ({ children, ...props }) => (
                    <ul className="story-list" {...props}>{children}</ul>
                ),
                ol: ({ children, ...props }) => (
                    <ol className="story-list ordered" {...props}>{children}</ol>
                ),
                li: ({ children, ...props }) => (
                    <li className="story-li" {...props}>{children}</li>
                ),
                blockquote: ({ children, ...props}) => (
                    <blockquote className="story-quote" {...props}>
                        <span className="quote-mark">|</span>
                        {children}
                    </blockquote>
                ),
                strong: ({ ...props }) => <strong className="story-emphasis" {...props} />,
                // Media in the story body, all via markdown image syntax:
                //   ![caption](/images/foo.jpg)            → styled figure
                //   ![caption](https://vimeo.com/123)     → responsive Vimeo embed
                //   ![caption](https://youtube.com/watch?v=x | youtu.be/x) → YouTube embed
                // One convention for pictures AND videos so a collaboration's
                // media is added/removed by editing its .md file only.
                img: ({ src, alt }) => {
                    const url = typeof src === 'string' ? src : '';
                    const vimeo = url.match(/vimeo\.com\/(\d+)/);
                    const youtube = url.match(
                        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/
                    );
                    if (vimeo || youtube) {
                        const embedSrc = vimeo
                            ? `https://player.vimeo.com/video/${vimeo[1]}`
                            : `https://www.youtube-nocookie.com/embed/${youtube![1]}`;
                        return (
                            <span className="story-media">
                                <iframe
                                    src={embedSrc}
                                    title={alt || 'Embedded video'}
                                    allow="autoplay; fullscreen; picture-in-picture"
                                    allowFullScreen
                                    loading="lazy"
                                />
                                {alt && <span className="story-media-caption">{alt}</span>}
                            </span>
                        );
                    }
                    return (
                        <span className="story-media">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={alt || ''} loading="lazy" decoding="async" />
                            {alt && <span className="story-media-caption">{alt}</span>}
                        </span>
                    );
                },
            }}
        >
            {data?.story ?? ''}
        </ReactMarkdown>
    ), [data?.story]);

    if (!isOpen || !data) return null;

    const readTime = calcReadTimeFromMarkdown(data?.story ?? "");

    const sections = [
        { name: 'Intro', id: 'collab-hero' },
        { name: 'Summary', id: 'collab-summary' },
        { name: 'Stakes', id: 'collab-stakes' },
        { name: 'Details', id: 'collab-details' }
    ];

    const scrollToSection = (id: string) => {
        const container = containerRef.current;
        const element = container?.querySelector<HTMLElement>(`#${id}`);
        if (!element || !container) return;

        const progressPanel = container.querySelector('.progress-system') as HTMLElement;
        const panelHeight = progressPanel?.offsetHeight || 0;
        const elementPosition = element.offsetTop;
        const offsetPosition = elementPosition - panelHeight;

        container.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    };

    return (
        <div
            ref={backdropRef}
            className="collab-modal-backdrop"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-label={data.name}
        >
            <div ref={containerRef} className="collab-modal-container">
                {/* Progress system — same 3-col grid as the achievement modal */}
                <div className="progress-system">
                    <div className="progress-bar" style={{ width: `${scrollProgress * 100}%` }} />

                    <div className="panel-left">
                        {caption && (
                            <div className="type-chip">
                                <span className="type-dot" />
                                <span className="type-label">{caption}</span>
                            </div>
                        )}
                    </div>

                    <div className="section-dots">
                        {sections.map((section, i) => (
                            <button
                                key={section.id}
                                className={`section-dot ${i <= activeSection ? 'active' : ''}`}
                                onClick={() => scrollToSection(section.id)}
                                aria-label={`Jump to ${section.name}`}
                            >
                                <span className="section-dot-inner" />
                                <span className="section-label">{section.name}</span>
                            </button>
                        ))}
                    </div>

                    <button className="close-btn-panel" onClick={onClose} aria-label="Close">
                        <div className="close-icon">
                            <span />
                            <span />
                        </div>
                    </button>
                </div>

                {/* HERO */}
                <div id="collab-hero" className="hero-section" onMouseEnter={triggerArrowBounce}>
                    {data.images && data.images[0] ? (
                        <>
                            <img src={data.images[0]} alt={data.name} className="hero-image" />
                            <div className="hero-overlay" />
                        </>
                    ) : logo ? (
                        <>
                            <div className="hero-logo-wrapper">
                                <Image
                                    src={logo}
                                    alt={data.name}
                                    width={200}
                                    height={200}
                                    className="hero-logo"
                                />
                            </div>
                            <div className="hero-overlay" />
                        </>
                    ) : (
                        <div className="hero-overlay" />
                    )}

                    <div className="hero-content">
                        <div className="hero-meta">
                            {caption && <span className="meta-item">{caption}</span>}
                            {caption && data.established && <span className="meta-divider">/</span>}
                            {data.established && <span className="meta-item">{data.established}</span>}
                            {(caption || data.established) && data.location && <span className="meta-divider">/</span>}
                            {data.location && <span className="meta-item">{data.location}</span>}
                        </div>

                        <h1 className="hero-title">
                            <span className="title-word">{data.name}</span>
                        </h1>

                        <p className="hero-hook">{data.description}</p>
                    </div>

                    <button
                        className="scroll-indicator"
                        onClick={() => scrollToSection('collab-summary')}
                        aria-label="Scroll to content"
                    >
                        <span className="scroll-text">Read More</span>
                        <svg
                            ref={arrowRef}
                            className="scroll-arrow"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M12 5v14M19 12l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                {/* SUMMARY */}
                <div id="collab-summary" className="story-section summary-section">
                    <div className="section-header">
                        <span className="section-number">01</span>
                        <span className="section-title">SUMMARY</span>
                    </div>

                    <div className="summary-content">
                        <p className="summary-text">{data.description}</p>

                        {(data.name || data.duration || data.location || data.role) && (
                            <div className="summary-info">
                                {data.name && (
                                    <div className="info-card">
                                        <div className="info-label">Partner</div>
                                        <div className="info-value">{data.name}</div>
                                    </div>
                                )}
                                {data.duration && (
                                    <div className="info-card">
                                        <div className="info-label">Duration</div>
                                        <div className="info-value">{data.duration}</div>
                                    </div>
                                )}
                                {data.location && (
                                    <div className="info-card">
                                        <div className="info-label">Location</div>
                                        <div className="info-value">{data.location}</div>
                                    </div>
                                )}
                                {data.role && (
                                    <div className="info-card">
                                        <div className="info-label">Role</div>
                                        <div className="info-value">{data.role}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* STAKES */}
                {data.outcomes && data.outcomes.length > 0 && (
                    <div id="collab-stakes" className="story-section stakes-section">
                        <div className="section-header">
                            <span className="section-number">02</span>
                            <span className="section-title">THE STAKES</span>
                        </div>

                        <div className="outcomes-grid">
                            {data.outcomes.map((outcome, i) => (
                                <div key={i} className="outcome-card">
                                    <div className="outcome-marker">{String(i + 1).padStart(2, '0')}</div>
                                    <p>{outcome}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* DETAILS */}
                <div id="collab-details" className="story-section story-content">
                    <div className="section-header">
                        <div>
                            <span className="section-number">03</span>
                            <span className="section-title">FULL DETAILS</span>
                        </div>
                        <div className="read-time-wrapper">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 6v6l4 2" />
                            </svg>
                            <span>{readTime} MIN READ</span>
                        </div>
                    </div>

                    {storyMarkdown}
                </div>

                {/* FOOTER */}
                {href && (
                    <div className="story-section footer-section">
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="website-button"
                        >
                            <span>Visit Website</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                        </a>
                    </div>
                )}

            </div>

            <style jsx>{`
                /* Presentation system mirrors AchievementModal (the reference modal):
                   vmin-scaled type/spacing, min(90vmin, 900px) square container, one
                   centered story column. Collab-specific bits (info cards, outcomes,
                   website button) restyled into the same language; gold = site amber. */

                .collab-modal-backdrop {
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

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .collab-modal-container {
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
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }

                .collab-modal-container::-webkit-scrollbar {
                    display: none;
                }

                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(40px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                /* ===== Progress system ===== */
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
                    display: flex;
                    align-items: center;
                    height: 100%;
                }

                .type-chip {
                    display: flex;
                    align-items: center;
                    gap: clamp(6px, 1vmin, 8px);
                }

                .type-dot {
                    width: clamp(8px, 1.2vmin, 10px);
                    height: clamp(8px, 1.2vmin, 10px);
                    border-radius: 50%;
                    background: rgba(${GOLD}, 0.9);
                }

                .type-label {
                    font: 600 clamp(9px, 1.3vmin, 11px)/1 'Rajdhani', monospace;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.8);
                    white-space: nowrap;
                }

                .section-dots {
                    display: flex;
                    gap: clamp(16px, 3vmin, 32px);
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
                    transition: all 0.3s ease;
                }

                .section-dot:hover {
                    transform: translateY(-2px);
                }

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

                .section-dot:hover .section-dot-inner {
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

                .section-dot.active .section-label {
                    color: rgba(255, 255, 255, 0.9);
                }

                .section-dot:hover .section-label {
                    color: rgba(255, 255, 255, 0.8);
                }

                .close-btn-panel {
                    width: clamp(28px, 4vmin, 32px);
                    height: clamp(28px, 4vmin, 32px);
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    overflow: hidden;
                    justify-self: end;
                }

                .close-btn-panel:hover {
                    border-color: rgba(255, 255, 255, 0.8);
                    transform: rotate(90deg);
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
                    transition: transform 0.3s ease, background 0.3s ease;
                }

                .close-icon span:first-child {
                    transform: translateY(-50%) rotate(45deg);
                }

                .close-icon span:last-child {
                    transform: translateY(-50%) rotate(-45deg);
                }

                .close-btn-panel:hover .close-icon span {
                    background: #fff;
                }

                /* ===== Hero ===== */
                .hero-section {
                    position: relative;
                    width: 100%;
                    aspect-ratio: 4 / 3;
                    display: flex;
                    align-items: flex-end;
                    overflow: hidden;
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
                }

                .hero-image {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    object-position: center;
                }

                .hero-logo-wrapper {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: clamp(140px, 25vmin, 200px);
                    height: clamp(140px, 25vmin, 200px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1;
                }

                .hero-logo {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    opacity: 0.15;
                    filter: brightness(1.5);
                }

                .hero-overlay {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to bottom,
                        rgba(0,0,0,0.2) 0%,
                        rgba(0,0,0,0.7) 60%,
                        rgba(0,0,0,0.95) 100%
                    );
                }

                .hero-content {
                    position: relative;
                    z-index: 2;
                    padding: clamp(30px, 5vmin, 60px);
                    /* extra bottom clearance so a two-line hook never collides with
                       the READ MORE indicator that overlaps the hero's bottom edge */
                    padding-bottom: clamp(48px, 8vmin, 72px);
                    width: 100%;
                }

                .hero-meta {
                    display: flex;
                    align-items: center;
                    gap: clamp(10px, 1.5vmin, 16px);
                    margin-bottom: 2px;
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

                .meta-divider {
                    color: rgba(255, 255, 255, 0.2);
                }

                .hero-title {
                    font: 700 clamp(28px, 5vmin, 64px)/1 'Rajdhani', monospace;
                    color: #fff;
                    margin: 0 0 clamp(8px, 1.2vmin, 10px) 0;
                    letter-spacing: -0.02em;
                    opacity: 0;
                    animation: fadeInUp 0.6s 0.3s ease forwards;
                }

                .title-word {
                    display: inline-block;
                    position: relative;
                }

                .hero-hook {
                    font: 400 clamp(14px, 2vmin, 22px)/1.4 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.9);
                    margin: 0 0 6px 0;
                    max-width: 650px;
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
                    z-index: 3;
                    opacity: 0;
                    animation: fadeInUp 0.8s 0.8s ease forwards;
                    transition: transform 0.3s ease;
                    padding: clamp(15px, 2.5vmin, 20px);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: clamp(6px, 1vmin, 8px);
                }

                .scroll-indicator:hover {
                    transform: translateY(4px);
                }

                .scroll-text {
                    font: 400 clamp(10px, 1.5vmin, 13px)/1 'Rajdhani', monospace;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.7);
                    transition: color 0.3s ease;
                    display: block;
                }

                .scroll-indicator:hover .scroll-text {
                    color: rgba(255, 255, 255, 0.95);
                }

                .scroll-arrow {
                    stroke: rgba(255, 255, 255, 0.5);
                    transition: stroke 0.3s ease;
                    display: block;
                    width: clamp(20px, 3vmin, 24px);
                    height: clamp(20px, 3vmin, 24px);
                }

                .scroll-arrow-anim {
                    animation: scrollBounce 1.2s ease-in-out 1;
                }

                .scroll-indicator:hover .scroll-arrow {
                    stroke: rgba(255, 255, 255, 0.9);
                    animation-duration: 1s;
                }

                @keyframes scrollBounce {
                    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(5px); }
                    60% { transform: translateY(3px); }
                }

                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* ===== Section headers ===== */
                .section-header {
                    display: flex;
                    align-items: center;
                    gap: clamp(12px, 2vmin, 16px);
                    margin-bottom: clamp(30px, 4vmin, 40px);
                    padding: 0 clamp(30px, 4vmin, 60px) clamp(12px, 2vmin, 16px) clamp(30px, 4vmin, 60px);
                    max-width: 900px;
                    margin-left: auto;
                    margin-right: auto;
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

                .section-header > div:first-child {
                    display: flex;
                    align-items: center;
                    gap: clamp(12px, 2vmin, 16px);
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

                .read-time-wrapper {
                    position: absolute;
                    right: clamp(30px, 4vmin, 60px);
                    top: 50%;
                    transform: translateY(-50%);
                    display: flex;
                    align-items: center;
                    gap: clamp(4px, 0.7vmin, 6px);
                    font: 400 clamp(9px, 1.3vmin, 11px)/1 'Rajdhani', monospace;
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.6);
                    white-space: nowrap;
                }

                .read-time-wrapper svg {
                    opacity: 0.7;
                    flex-shrink: 0;
                    width: clamp(10px, 1.5vmin, 12px);
                    height: clamp(10px, 1.5vmin, 12px);
                }

                /* ===== Summary ===== */
                .summary-section {
                    padding: clamp(30px, 4vmin, 50px) 0;
                    background: transparent;
                }

                .summary-content {
                    max-width: 900px;
                    margin: 0 auto;
                    padding: 0 clamp(30px, 4vmin, 60px);
                }

                .summary-text {
                    font: 400 clamp(15px, 2.2vmin, 20px)/1.6 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.85);
                    margin: 0 0 clamp(28px, 4vmin, 40px) 0;
                    text-align: center;
                    max-width: min(700px, 90%);
                    margin-left: auto;
                    margin-right: auto;
                }

                .summary-info {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(clamp(180px, 28vmin, 250px), 1fr));
                    gap: clamp(12px, 2.2vmin, 20px);
                    max-width: 800px;
                    margin: 0 auto;
                }

                .info-card {
                    padding: clamp(16px, 2.7vmin, 24px);
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    position: relative;
                    overflow: hidden;
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .info-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 1px;
                    background: linear-gradient(90deg,
                        transparent 0%,
                        rgba(${GOLD}, 0.8) 50%,
                        transparent 100%
                    );
                    transition: left 0.6s ease;
                }

                .info-card:hover {
                    border-color: rgba(${GOLD}, 0.6);
                    transform: translateY(-3px);
                }

                .info-card:hover::before {
                    left: 100%;
                }

                .info-label {
                    font: 600 clamp(9px, 1.3vmin, 11px)/1 'Rajdhani', monospace;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.7);
                    margin-bottom: clamp(8px, 1.4vmin, 12px);
                    transition: color 0.4s ease;
                }

                .info-card:hover .info-label {
                    color: rgba(${GOLD}, 0.95);
                }

                .info-value {
                    font: 400 clamp(14px, 1.9vmin, 16px)/1.4 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.9);
                    transition: color 0.4s ease;
                }

                .info-card:hover .info-value {
                    color: rgba(255, 255, 255, 1);
                }

                /* ===== Stakes / outcomes ===== */
                .stakes-section {
                    padding: clamp(30px, 4vmin, 50px) 0;
                    background: transparent;
                }

                .outcomes-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(clamp(180px, 28vmin, 250px), 1fr));
                    gap: clamp(12px, 2.2vmin, 20px);
                    max-width: 900px;
                    margin: 0 auto;
                    padding: 0 clamp(30px, 4vmin, 60px);
                }

                .outcome-card {
                    padding: clamp(16px, 2.7vmin, 24px);
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    position: relative;
                    overflow: hidden;
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .outcome-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 1px;
                    background: linear-gradient(90deg,
                        transparent 0%,
                        rgba(${GOLD}, 0.8) 50%,
                        transparent 100%
                    );
                    transition: left 0.6s ease;
                }

                .outcome-card:hover {
                    border-color: rgba(${GOLD}, 0.6);
                    transform: translateY(-3px);
                }

                .outcome-card:hover::before {
                    left: 100%;
                }

                .outcome-marker {
                    font: 700 clamp(12px, 1.7vmin, 14px)/1 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.3);
                    margin-bottom: clamp(8px, 1.4vmin, 12px);
                    transition: color 0.4s ease;
                }

                .outcome-card:hover .outcome-marker {
                    color: rgba(${GOLD}, 0.95);
                }

                .outcome-card p {
                    font: 400 clamp(14px, 1.9vmin, 16px)/1.6 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.9);
                    margin: 0;
                    transition: color 0.4s ease;
                }

                .outcome-card:hover p {
                    color: rgba(255, 255, 255, 1);
                }

                /* ===== Story (markdown) — ONE centered column, same as the graph modal ===== */
                .story-content {
                    padding: clamp(30px, 4vmin, 50px) 0;
                    max-width: 900px;
                    margin: 0 auto;
                }

                .story-content .section-header {
                    margin: 0 0 clamp(35px, 5vmin, 50px) 0;
                    padding: 0 clamp(30px, 4vmin, 60px) clamp(12px, 2vmin, 16px) clamp(30px, 4vmin, 60px);
                }

                /* The markdown subtree is memoized (built inside useMemo), and styled-jsx
                   does NOT add its scope class to JSX created in hook callbacks — so every
                   rule below is written fully-global, anchored under the container class
                   (V7 gotcha: never mix scoped + :global for these; keep specificity ascending). */
                :global(.collab-modal-container .story-h2),
                :global(.collab-modal-container .story-h3),
                :global(.collab-modal-container .story-p),
                :global(.collab-modal-container .story-quote),
                :global(.collab-modal-container .story-list),
                :global(.collab-modal-container .story-media) {
                    max-width: min(550px, 90%);
                    margin-left: auto;
                    margin-right: auto;
                }

                :global(.collab-modal-container .story-h2) {
                    font: 700 clamp(22px, 3.5vmin, 34px)/1.2 'Rajdhani', monospace;
                    color: #fff;
                    margin: clamp(40px, 6vmin, 60px) auto clamp(18px, 2.5vmin, 24px) auto;
                    position: relative;
                    padding-left: 0;
                }

                :global(.collab-modal-container .h2-marker) {
                    position: absolute;
                    left: 0;
                    top: 50%;
                    transform: translateY(-50%) translateX(calc(-100% - clamp(20px, 3vmin, 28px)));
                    width: clamp(18px, 2.5vmin, 22px);
                    height: clamp(18px, 2.5vmin, 22px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                :global(.collab-modal-container .h2-arrow) {
                    width: 100%;
                    height: 100%;
                    color: rgba(255, 255, 255, 0.35);
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    transform: rotate(0deg);
                }

                :global(.collab-modal-container .story-h2:hover .h2-arrow) {
                    color: rgba(255, 255, 255, 0.85);
                    transform: rotate(90deg);
                    filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.3));
                }

                :global(.collab-modal-container .story-h3) {
                    font: 600 clamp(17px, 2.5vmin, 24px)/1.3 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.9);
                    margin: clamp(30px, 4vmin, 40px) auto clamp(12px, 2vmin, 16px) auto;
                    position: relative;
                    padding-left: clamp(20px, 3vmin, 24px);
                }

                :global(.collab-modal-container .story-h3::before) {
                    content: '// ';
                    position: absolute;
                    left: 0;
                    color: rgba(255, 255, 255, 0.2);
                }

                :global(.collab-modal-container .story-p) {
                    font: 400 clamp(15px, 2vmin, 17px)/1.7 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.75);
                    margin: clamp(16px, 2.5vmin, 20px) auto;
                }

                :global(.collab-modal-container .story-emphasis) {
                    color: #fff;
                    font-weight: 600;
                    position: relative;
                }

                :global(.collab-modal-container .story-list) {
                    margin: clamp(12px, 2vmin, 16px) auto;
                    padding-left: clamp(1rem, 2.5vmin, 1.25rem);
                    list-style-position: outside;
                }

                :global(.collab-modal-container .story-list.ordered) {
                    list-style-type: decimal;
                }

                :global(.collab-modal-container .story-list:not(.ordered)) {
                    list-style-type: disc;
                }

                :global(.collab-modal-container .story-li) {
                    margin: clamp(4px, 0.7vmin, 6px) 0;
                    color: rgba(255, 255, 255, 0.75);
                    font: 400 clamp(15px, 2vmin, 17px)/1.7 'Rajdhani', monospace;
                }

                :global(.collab-modal-container .story-li > ul),
                :global(.collab-modal-container .story-li > ol) {
                    margin-top: clamp(6px, 1vmin, 8px);
                    margin-bottom: clamp(6px, 1vmin, 8px);
                }

                :global(.collab-modal-container .story-quote) {
                    margin: clamp(35px, 5vmin, 50px) auto;
                    padding: clamp(24px, 3.5vmin, 32px);
                    position: relative;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                :global(.collab-modal-container .quote-mark) {
                    position: absolute;
                    top: clamp(-8px, -1.2vmin, -10px);
                    left: clamp(15px, 2.5vmin, 20px);
                    font-size: clamp(36px, 5vmin, 48px);
                    color: rgba(255, 255, 255, 0.1);
                    font-family: Georgia, serif;
                    background: #000;
                    padding: 0 clamp(8px, 1.2vmin, 10px);
                }

                :global(.collab-modal-container .story-quote p) {
                    font: 500 clamp(16px, 2.5vmin, 20px)/1.5 'Rajdhani', monospace;
                    font-style: italic;
                    color: rgba(255, 255, 255, 0.8);
                    margin: 0;
                    position: relative;
                }

                /* Story media (pictures + video embeds) — same column + reveal as
                   achievement story images. span-based because it sits inside a <p>. */
                :global(.collab-modal-container .story-media) {
                    display: block;
                    margin-top: clamp(35px, 5vmin, 50px);
                    margin-bottom: clamp(35px, 5vmin, 50px);
                    opacity: 0;
                    transform: translateY(30px);
                    transition: all 0.6s ease;
                }

                :global(.collab-modal-container .story-media.in-view) {
                    opacity: 1;
                    transform: translateY(0);
                }

                :global(.collab-modal-container .story-media img),
                :global(.collab-modal-container .story-media iframe) {
                    display: block;
                    width: 100%;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: #000;
                }

                :global(.collab-modal-container .story-media iframe) {
                    aspect-ratio: 16 / 9;
                }

                :global(.collab-modal-container .story-media img) {
                    height: auto;
                    max-height: clamp(300px, 45vmin, 400px);
                    object-fit: cover;
                }

                :global(.collab-modal-container .story-media-caption) {
                    display: block;
                    padding: clamp(10px, 1.5vmin, 12px) 0 0;
                    font: 400 clamp(10px, 1.5vmin, 12px)/1.4 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.5);
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                }

                /* ===== Footer ===== */
                .footer-section {
                    padding: clamp(30px, 4vmin, 40px) clamp(30px, 4vmin, 60px);
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .website-button {
                    display: inline-flex;
                    align-items: center;
                    gap: clamp(8px, 1.4vmin, 12px);
                    padding: clamp(14px, 2vmin, 18px) clamp(24px, 4vmin, 36px);
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: rgba(255, 255, 255, 0.9);
                    font: 600 clamp(11px, 1.6vmin, 14px)/1 'Rajdhani', monospace;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    text-decoration: none;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }

                .website-button::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg,
                        transparent 0%,
                        rgba(255, 255, 255, 0.1) 50%,
                        transparent 100%
                    );
                    transition: left 0.5s ease;
                }

                .website-button:hover::before {
                    left: 100%;
                }

                .website-button:hover {
                    border-color: rgba(255, 255, 255, 0.6);
                    background: rgba(255, 255, 255, 0.08);
                }

                .website-button svg {
                    transition: transform 0.3s ease;
                }

                .website-button:hover svg {
                    transform: translateX(2px) translateY(-2px);
                }

                /* Section reveal */
                .story-section {
                    opacity: 0;
                    transform: translateY(40px);
                    transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .story-section.in-view {
                    opacity: 1;
                    transform: translateY(0);
                }

                /* ===== Small — real phones only. NOT height-gated: a scaled-down
                   desktop window must keep the one-row header and the 4/3 hero;
                   the vmin clamps handle the shrink. Mobile redo comes later. ===== */
                @media (max-width: 480px) {
                    .progress-system {
                        grid-template-columns: 1fr;
                        grid-template-rows: auto auto auto;
                        padding: clamp(10px, 1.5vmin, 12px);
                        gap: clamp(10px, 1.5vmin, 12px);
                        height: auto;
                    }

                    .panel-left {
                        order: 2;
                        height: auto;
                        justify-content: center;
                    }

                    .section-dots {
                        order: 1;
                        gap: clamp(12px, 2vmin, 20px);
                    }

                    .close-btn-panel {
                        order: 3;
                        justify-self: center;
                    }

                    .summary-info,
                    .outcomes-grid {
                        grid-template-columns: 1fr;
                    }

                    .collab-modal-backdrop {
                        padding: 6px;
                    }

                    .section-label {
                        display: none;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    *,
                    *::before,
                    *::after,
                    :global(.collab-modal-container .story-media),
                    :global(.collab-modal-container .h2-arrow) {
                        animation-duration: 0.01ms !important;
                        animation-iteration-count: 1 !important;
                        transition-duration: 0.01ms !important;
                    }
                }
            `}</style>
        </div>
    );
}
