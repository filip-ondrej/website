'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';

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

/* ==================== COMPONENT ==================== */
export default function CollaborationModal({ data, isOpen, onClose, logo, href, caption }: Props) {
    const backdropRef = React.useRef<HTMLDivElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [scrollProgress, setScrollProgress] = React.useState(0);
    const [activeSection, setActiveSection] = React.useState(0);
    const [isReading, setIsReading] = React.useState(false);

    /* Calculate read time */
    function calcReadTimeFromMarkdown(raw: string, wpm = 225): number {
        const noImages = raw.replace(/!\[[^\]]*]\([^)]*\)/g, " ");
        const noCodeBlocks = noImages.replace(/```[\s\S]*?```/g, " ");
        const noInlineCode = noCodeBlocks.replace(/`[^`]*`/g, " ");
        const plain = noInlineCode.replace(/[^\w\s]|_/g, " ");
        const words = plain.trim().split(/\s+/).filter(Boolean).length;
        return Math.max(1, Math.ceil(words / wpm));
    }

    /* Track reading state */
    React.useEffect(() => {
        if (!isOpen) {
            setIsReading(false);
            return;
        }

        let scrollTimer: NodeJS.Timeout;
        const handleScroll = () => {
            setIsReading(true);
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => setIsReading(false), 150);
        };

        const container = containerRef.current;
        container?.addEventListener('scroll', handleScroll);

        return () => {
            container?.removeEventListener('scroll', handleScroll);
            clearTimeout(scrollTimer);
        };
    }, [isOpen]);

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
        document.body.style.overflow = 'hidden';

        const container = containerRef.current;
        if (container) {
            container.scrollTop = 0;
        }

        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.removeEventListener('keydown', handleArrowKeys);
            document.body.style.overflow = 'unset';
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
                { id: 'hero', index: 0 },
                { id: 'summary', index: 1 },
                { id: 'stakes', index: 2 },
                { id: 'details', index: 3 }
            ];

            let current = 0;
            sections.forEach(({ id, index }) => {
                const element = document.getElementById(id);
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

        const sections = container.querySelectorAll('.story-section, .collab-image');
        sections.forEach((section) => observer.observe(section));

        container.addEventListener('scroll', handleScroll);
        handleScroll();

        return () => {
            container.removeEventListener('scroll', handleScroll);
            observer.disconnect();
        };
    }, [isOpen]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === backdropRef.current) onClose();
    };

    if (!isOpen || !data) return null;

    const readTime = calcReadTimeFromMarkdown(data?.story ?? "");

    const sections = [
        { name: 'Intro', id: 'hero' },
        { name: 'Summary', id: 'summary' },
        { name: 'Stakes', id: 'stakes' },
        { name: 'Details', id: 'details' }
    ];

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        const container = containerRef.current;
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
            className="achievement-modal-backdrop"
            onClick={handleBackdropClick}
        >
            {/* Reading indicator */}
            <div className={`reading-indicator ${isReading ? 'active' : ''}`}>
                <div className="reading-bar" />
            </div>

            <div ref={containerRef} className="achievement-modal-container">
                {/* Progress system */}
                <div className="progress-system">
                    <div className="progress-bar" style={{ width: `${scrollProgress * 100}%` }} />

                    <button className="close-btn-panel" onClick={onClose} aria-label="Close">
                        <div className="close-icon">
                            <span />
                            <span />
                        </div>
                    </button>

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
                </div>

                {/* HERO */}
                <div id="hero" className="hero-section">
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
                        {caption && (
                            <div className="hero-meta">
                                <span className="meta-item">{caption}</span>
                                {data.established && <span className="meta-divider">/</span>}
                                {data.established && <span className="meta-item">{data.established}</span>}
                                {data.location && <span className="meta-divider">/</span>}
                                {data.location && <span className="meta-item">{data.location}</span>}
                            </div>
                        )}

                        <h1 className="hero-title">
                            <span className="title-word">{data.name}</span>
                        </h1>

                        <p className="hero-hook">{data.description}</p>
                    </div>

                    <button
                        className="scroll-indicator"
                        onClick={() => scrollToSection('summary')}
                        aria-label="Scroll to content"
                    >
                        <span className="scroll-text">Read More</span>
                        <svg className="scroll-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M19 12l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                {/* SUMMARY */}
                <div id="summary" className="story-section summary-section">
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
                                        <div className="info-label">Institution:</div>
                                        <div className="info-value">{data.name}</div>
                                    </div>
                                )}
                                {data.duration && (
                                    <div className="info-card">
                                        <div className="info-label">Duration:</div>
                                        <div className="info-value">{data.duration}</div>
                                    </div>
                                )}
                                {data.location && (
                                    <div className="info-card">
                                        <div className="info-label">Location:</div>
                                        <div className="info-value">{data.location}</div>
                                    </div>
                                )}
                                {data.role && (
                                    <div className="info-card">
                                        <div className="info-label">Research Focus:</div>
                                        <div className="info-value">{data.role}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* STAKES */}
                {data.outcomes && data.outcomes.length > 0 && (
                    <div id="stakes" className="story-section stakes-section">
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
                <div id="details" className="story-section story-content">
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

                    <ReactMarkdown
                        components={{
                            h2: ({ children, ...props }) => (
                                <h2 className="story-h2" {...props}>
                                    <span className="h2-marker" />
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
                        }}
                    >
                        {data.story}
                    </ReactMarkdown>
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
                /* COPY EXACT STYLES FROM ACHIEVEMENT MODAL */
                
                .achievement-modal-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.98);
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    animation: fadeIn 0.3s ease-out;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .reading-indicator {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 1px;
                    z-index: 1004;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }

                .reading-indicator.active {
                    opacity: 1;
                }

                .reading-bar {
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, 
                        transparent 0%,
                        rgba(255, 255, 255, 0.8) 50%,
                        transparent 100%
                    );
                    animation: scan 1.5s linear infinite;
                }

                @keyframes scan {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(100%); }
                }

                .achievement-modal-container {
                    width: min(85vw, 85vh);
                    height: min(85vw, 85vh);
                    max-width: 900px;
                    max-height: 900px;
                    background: #000000;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    overflow-y: auto;
                    overflow-x: hidden;
                    animation: slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                    scroll-behavior: smooth;
                    position: relative;
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(40px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .progress-system {
                    position: sticky;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 100;
                    background: rgba(0, 0, 0, 0.95);
                    backdrop-filter: blur(10px);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }

                .progress-bar {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 2px;
                    background: rgba(255, 255, 255, 0.8);
                    transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .close-btn-panel {
                    position: absolute;
                    top: 50%;
                    right: 20px;
                    transform: translateY(-50%);
                    width: 32px;
                    height: 32px;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    overflow: hidden;
                }

                .close-btn-panel:hover {
                    border-color: rgba(255, 255, 255, 0.8);
                    transform: translateY(-50%) rotate(90deg);
                }

                .close-icon {
                    position: relative;
                    width: 14px;
                    height: 14px;
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
                    background: #FFFFFF;
                }

                .section-dots {
                    display: flex;
                    gap: 32px;
                    justify-content: center;
                    padding: 14px 20px;
                }

                .section-dot {
                    position: relative;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    padding: 8px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.3s ease;
                }

                .section-dot:hover {
                    transform: translateY(-2px);
                }

                .section-dot-inner {
                    width: 10px;
                    height: 10px;
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
                    font: 400 10px/1 'Rajdhani', monospace;
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

                /* SUMMARY SECTION */
                .summary-section {
                    padding: 50px 0;
                    background: rgba(255, 255, 255, 0.01);
                }

                .summary-content {
                    max-width: 900px;
                    margin: 0 auto;
                    padding: 0 60px;
                }

                .summary-text {
                    font: 400 clamp(18px, 2.5vw, 22px)/1.6 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.85);
                    margin: 0 0 40px 0;
                    text-align: center;
                    max-width: 700px;
                    margin-left: auto;
                    margin-right: auto;
                }

                .summary-info {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }

                .info-card {
                    padding: 24px;
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
                        rgba(255, 215, 0, 0.8) 50%,
                        transparent 100%
                    );
                    transition: left 0.6s ease;
                }

                .info-card::after {
                    content: '';
                    position: absolute;
                    inset: -2px;
                    border-radius: inherit;
                    background: linear-gradient(135deg, 
                        rgba(255, 215, 0, 0) 0%,
                        rgba(255, 215, 0, 0.15) 50%,
                        rgba(255, 215, 0, 0) 100%
                    );
                    opacity: 0;
                    transition: opacity 0.4s ease;
                    pointer-events: none;
                }

                .info-card:hover {
                    background: rgba(255, 255, 255, 0.08);
                    border-color: rgba(255, 215, 0, 0.6);
                    transform: translateY(-4px) scale(1.02);
                    box-shadow: 0 8px 32px rgba(255, 215, 0, 0.2);
                }

                .info-card:hover::before {
                    left: 100%;
                }

                .info-card:hover::after {
                    opacity: 1;
                }

                .info-label {
                    font: 600 11px/1 'Rajdhani', monospace;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.7);
                    margin-bottom: 12px;
                    transition: all 0.4s ease;
                }

                .info-card:hover .info-label {
                    color: rgba(255, 215, 0, 0.95);
                    text-shadow: 0 0 12px rgba(255, 215, 0, 0.4);
                }

                .info-value {
                    font: 400 16px/1.4 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.9);
                    transition: color 0.4s ease, text-shadow 0.4s ease;
                }

                .info-card:hover .info-value {
                    font-weight: 600;
                    color: rgba(255, 255, 255, 1);
                    text-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
                    letter-spacing: -0.003em;
                }

                /* HERO SECTION */
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
                    width: 200px;
                    height: 200px;
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
                    padding: 60px;
                    width: 100%;
                }

                .hero-meta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 16px;
                    opacity: 0;
                    animation: fadeInUp 0.6s 0.2s ease forwards;
                    flex-wrap: wrap;
                }

                .meta-item {
                    font: 400 11px/1 'Rajdhani', monospace;
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.6);
                }

                .meta-divider {
                    color: rgba(255, 255, 255, 0.2);
                }

                .hero-title {
                    /* Height-aware cap: 6vw upper cap relaxed to min(64px, 9vh) so
                       a wide-but-short viewport can't blow out the fixed-ratio hero.
                       No-op at the 1440 ref (>=~711px tall → 9vh>=64px → 64px cap). */
                    font: 700 clamp(42px, 6vw, min(64px, 9vh))/1 'Rajdhani', monospace;
                    color: #FFFFFF;
                    margin: 0 0 18px 0;
                    letter-spacing: -0.02em;
                    opacity: 0;
                    animation: fadeInUp 0.6s 0.3s ease forwards;
                }

                .title-word {
                    display: inline-block;
                    position: relative;
                }

                .title-word::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 0;
                    height: 2px;
                    background: rgba(255, 255, 255, 0.3);
                    transition: width 0.5s ease;
                }

                .hero-section:hover .title-word::after {
                    width: 100%;
                }

                .hero-hook {
                    font: 400 clamp(18px, 2.5vw, 22px)/1.4 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.9);
                    margin: 0 0 6px 0;
                    max-width: 650px;
                    opacity: 0;
                    animation: fadeInUp 0.6s 0.4s ease forwards;
                }

                .scroll-indicator {
                    position: absolute;
                    bottom: -15px;
                    left: 0;
                    right: 0;
                    margin: 0 auto;
                    transform: none;
                    width: max-content;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    z-index: 3;
                    opacity: 0;
                    animation: fadeInUp 0.8s 0.8s ease forwards;
                    transition: transform 0.3s ease;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                }

                .scroll-indicator:hover {
                    transform: translateY(4px);
                }

                .scroll-text {
                    font: 400 13px/1 'Rajdhani', monospace;
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
                    animation: scrollBounce 2s ease-in-out infinite;
                    stroke: rgba(255, 255, 255, 0.5);
                    transition: stroke 0.3s ease;
                    display: block;
                }

                .scroll-indicator:hover .scroll-arrow {
                    stroke: rgba(255, 255, 255, 0.9);
                    animation-duration: 1s;
                }

                @keyframes scrollBounce {
                    0%, 20%, 50%, 80%, 100% {
                        transform: translateY(0);
                    }
                    40% {
                        transform: translateY(5px);
                    }
                    60% {
                        transform: translateY(3px);
                    }
                }

                @keyframes fadeInUp {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                }

                /* SECTION HEADERS */
                .section-header {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 40px;
                    padding: 0 80px 16px 80px;
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
                    left: 70px;
                    right: 70px;
                    height: 1px;
                    background: rgba(255, 255, 255, 0.2);
                }

                .section-header > div:first-child {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .section-number {
                    font: 700 32px/1 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.5);
                    letter-spacing: -0.02em;
                }

                .section-title {
                    font: 500 11px/1 'Rajdhani', monospace;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.7);
                }

                /* OUTCOMES SECTION */
                .stakes-section {
                    padding: 50px 0;
                    background: linear-gradient(to bottom,
                        rgba(255, 255, 255, 0.02) 0%,
                        transparent 100%
                    );
                }

                .outcomes-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    max-width: 900px;
                    margin: 0 auto;
                    padding: 0 60px;
                }

                .outcome-card {
                    padding: 24px;
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
                        rgba(255, 215, 0, 0.8) 50%,
                        transparent 100%
                    );
                    transition: left 0.6s ease;
                }

                .outcome-card::after {
                    content: '';
                    position: absolute;
                    inset: -2px;
                    border-radius: inherit;
                    background: linear-gradient(135deg, 
                        rgba(255, 215, 0, 0) 0%,
                        rgba(255, 215, 0, 0.15) 50%,
                        rgba(255, 215, 0, 0) 100%
                    );
                    opacity: 0;
                    transition: opacity 0.4s ease;
                    pointer-events: none;
                }

                .outcome-card:hover {
                    background: rgba(255, 255, 255, 0.08);
                    border-color: rgba(255, 215, 0, 0.6);
                    transform: translateY(-4px);
                    box-shadow: 0 8px 32px rgba(255, 215, 0, 0.2);
                }

                .outcome-card:hover::before {
                    left: 100%;
                }

                .outcome-card:hover::after {
                    opacity: 1;
                }

                .outcome-marker {
                    font: 700 14px/1 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.3);
                    margin-bottom: 12px;
                    transition: all 0.4s ease;
                }

                .outcome-card:hover .outcome-marker {
                    color: rgba(255, 215, 0, 0.95);
                    text-shadow: 0 0 12px rgba(255, 215, 0, 0.4);
                }

                .outcome-card p {
                    font: 400 16px/1.6 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.9);
                    margin: 0;
                    transition: color 0.4s ease, text-shadow 0.4s ease;
                }

                .outcome-card:hover p {
                    font-weight: 600;
                    color: rgba(255, 255, 255, 1);
                    text-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
                    letter-spacing: -0.003em;
                }

                /* STORY CONTENT */
                .story-content {
                    padding: 50px 0;
                }

                .story-content .section-header {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin: 0 0 50px 0;
                    padding: 0 80px 16px 80px;
                    max-width: 900px;
                    margin-left: auto;
                    margin-right: auto;
                }

                .story-content .section-header::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 70px;
                    right: 70px;
                    height: 1px;
                    background: rgba(255, 255, 255, 0.2);
                }

                .story-content .section-header .read-time-wrapper {
                    position: absolute;
                    right: 80px;
                    top: 50%;
                    transform: translateY(-50%);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font: 400 11px/1 'Rajdhani', monospace;
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.6);
                    white-space: nowrap;
                }

                .story-h2,
                .story-h3,
                .story-p,
                .story-quote,
                .story-list {
                    max-width: 550px;
                    margin-left: auto;
                    margin-right: auto;
                }
                
                .story-h2 {
                    font: 700 clamp(28px, 3.5vw, 34px)/1.2 'Rajdhani', monospace;
                    color: #FFFFFF;
                    margin: 60px auto 24px auto;
                    position: relative;
                    padding-left: 104px;
                    padding-right: 60px;
                }

                .h2-marker {
                    position: absolute;
                    left: 80px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 12px;
                    height: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    background: transparent;
                    transition: all 0.3s ease;
                }

                .story-h2:hover .h2-marker {
                    background: rgba(255, 255, 255, 0.1);
                    transform: translateY(-50%) rotate(45deg);
                }

                .story-h3 {
                    font: 600 clamp(20px, 2.5vw, 24px)/1.3 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.9);
                    margin: 40px auto 16px auto;
                    position: relative;
                    padding-left: 104px;
                    padding-right: 60px;
                }

                .story-h3::before {
                    content: '//';
                    position: absolute;
                    left: 80px;
                    color: rgba(255, 255, 255, 0.2);
                }

                .story-p {
                    font: 400 17px/1.7 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.75);
                    margin: 0 0 20px 0;
                    padding-left: 120px;
                    padding-right: 60px;
                }

                .story-list {
                    padding-left: 140px;
                    padding-right: 60px;
                    margin: 0 auto 30px auto;
                    list-style-type: disc;
                }

                .story-li {
                    margin: 6px 0;
                    color: rgba(255,255,255,0.75);
                    font: 400 17px/1.7 'Rajdhani', monospace;
                }

                .story-quote {
                    margin: 50px auto;
                    margin-left: 120px;
                    margin-right: 60px;
                    padding: 32px;
                    padding-left: 48px;
                    padding-right: 48px;
                    position: relative;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .quote-mark {
                    position: absolute;
                    top: -10px;
                    left: 20px;
                    font-size: 48px;
                    color: rgba(255, 255, 255, 0.1);
                    font-family: Georgia, serif;
                    background: #000000;
                    padding: 0 10px;
                }

                .story-quote p {
                    font: 500 20px/1.5 'Rajdhani', monospace;
                    font-style: italic;
                    color: rgba(255, 255, 255, 0.8);
                    margin: 0;
                    position: relative;
                }

                .story-emphasis {
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.95);
                }

                /* FOOTER */
                .footer-section {
                    padding: 60px;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .website-button {
                    display: inline-flex;
                    align-items: center;
                    gap: 12px;
                    padding: 18px 36px;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: rgba(255, 255, 255, 0.9);
                    font: 600 14px/1 'Rajdhani', monospace;
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
                    transform: translateX(4px);
                    box-shadow: 0 4px 16px rgba(255, 255, 255, 0.1);
                }

                .website-button svg {
                    transition: transform 0.3s ease;
                }

                .website-button:hover svg {
                    transform: translateX(2px) translateY(-2px);
                }

                /* SCROLLBAR */
                .achievement-modal-container::-webkit-scrollbar {
                    width: 6px;
                }

                .achievement-modal-container::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.02);
                }

                .achievement-modal-container::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 3px;
                }

                .achievement-modal-container::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.3);
                }

                .story-section {
                    opacity: 0;
                    transform: translateY(40px);
                    transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .story-section.in-view {
                    opacity: 1;
                    transform: translateY(0);
                }

                @media (max-width: 768px) {
                    .achievement-modal-container {
                        width: min(95vw, 95vh);
                        height: min(95vw, 95vh);
                        max-width: none;
                        max-height: none;
                    }
                    .hero-section {
                        aspect-ratio: 3 / 4;
                    }
                    .section-dots {
                        gap: 20px;
                        padding: 16px;
                    }
                    .section-label {
                        font-size: 9px;
                    }
                    .hero-content {
                        padding: 40px 24px;
                    }
                    .outcomes-grid {
                        grid-template-columns: 1fr;
                        gap: 16px;
                        padding: 0 24px;
                    }
                    .section-header {
                        padding: 0 24px 16px 24px;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    *,
                    *::before,
                    *::after {
                        animation-duration: 0.01ms !important;
                        animation-iteration-count: 1 !important;
                        transition-duration: 0.01ms !important;
                    }
                }
            `}</style>
        </div>
    );
}