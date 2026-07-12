'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import {filipRealEvents, impactConfig} from '@/data/graphData';
import {useScrollLock} from '@/lib/useScrollLock';

/* ==================== TYPES ==================== */
export type AchievementData = {
    id: string;
    title: string;
    date: string;
    age?: number;
    location?: string;
    images: string[];
    videos?: string[];
    tags: string[];
    hook: string;
    pullQuote: string;
    challenge: string;
    outcome: string;
    metrics: string[];
    story: string;
    insight: string;
};

type Props = {
    data: AchievementData | null;
    isOpen: boolean;
    onClose: () => void;
};

/* Get impact scale data from graph data based on story article ID */
function getImpactFromGraphData(storyId: string) {
    const matchingEvent = filipRealEvents.find(event => event.article === storyId);

    if (matchingEvent && matchingEvent.impactType !== 'None') {
        return {
            scale: matchingEvent.impactType,
            color: impactConfig.legendColors[matchingEvent.impactType],
        };
    }

    return {
        scale: 'Regional' as const,
        color: impactConfig.legendColors['Regional'],
    };
}


/* ==================== COMPONENT ==================== */
export default function AchievementModal({data, isOpen, onClose}: Props) {
    const backdropRef = React.useRef<HTMLDivElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [scrollProgress, setScrollProgress] = React.useState(0);
    const [activeSection, setActiveSection] = React.useState(0);
    const [showTitle, setShowTitle] = React.useState(false);

    // Shared page lock: body overflow hidden + data-scroll-locked so the
    // ProgressLine wheel engine yields (native scroll inside the modal).
    // Replaces the legacy body position:fixed hack + per-element wheel guards.
    useScrollLock(isOpen);

    // Arrow ref – used to replay animation on hero hover and on open
    const arrowRef = React.useRef<SVGSVGElement | null>(null);

    /* Calculate read time from story text (~225 wpm), stripping most Markdown/noise */
    function calcReadTimeFromMarkdown(raw: string, wpm = 225): number {
        const noImages = raw.replace(/!\[[^\]]*]\([^)]*\)/g, ' ');
        const noCodeBlocks = noImages.replace(/```[\s\S]*?```/g, ' ');
        const noInlineCode = noCodeBlocks.replace(/`[^`]*`/g, ' ');
        const plain = noInlineCode.replace(/[^\w\s]|_/g, ' ');
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
                container.scrollBy({top: 100, behavior: 'smooth'});
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                container.scrollBy({top: -100, behavior: 'smooth'});
            }
        };

        document.addEventListener('keydown', handleEsc);
        document.addEventListener('keydown', handleArrowKeys);

        // Reset modal scroll to top
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

            // When hero is mostly gone, show small title
            const heroSection = document.getElementById('hero');
            if (heroSection) {
                const heroRect = heroSection.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                const heroBottom = heroRect.bottom - containerRect.top;
                setShowTitle(heroBottom < 100);
            }

            const sectionsMeta = [
                {id: 'hero', index: 0},
                {id: 'stakes', index: 1},
                {id: 'story', index: 2},
                {id: 'insight', index: 3},
            ];

            let current = 0;

            sectionsMeta.forEach(({id, index}) => {
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

        /* Intersection Observer for reveal animations */
        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;

                    entry.target.classList.add('in-view');

                    if (entry.target.classList.contains('metric-badge')) {
                        const el = entry.target as HTMLElement;

                        // 🚫 Already animated? Do nothing.
                        if (el.dataset.animated === 'true') return;

                        // ✅ Mark as animated and run the counter once
                        el.dataset.animated = 'true';

                        const finalText = el.dataset.value || el.textContent || '';
                        animateValue(el, finalText);
                    }
                });
            },
            {threshold: 0.05}
        );

        const observed = container.querySelectorAll('.story-section, .metric-badge, .story-image');
        observed.forEach(section => observer.observe(section));

        container.addEventListener('scroll', handleScroll);
        handleScroll();

        return () => {
            container.removeEventListener('scroll', handleScroll);
            observer.disconnect();
        };
    }, [isOpen]);

    /* Animate metric values */
    const animateValue = (element: HTMLElement, value: string) => {
        const match = value.match(/(\d+)/);
        if (!match) {
            element.textContent = value;
            return;
        }

        const num = parseInt(match[1], 10);
        const prefix = value.substring(0, match.index || 0);
        const suffix = value.substring((match.index || 0) + match[1].length);

        let current = 0;
        const increment = num / 20;
        const timer = setInterval(() => {
            current += increment;
            if (current >= num) {
                current = num;
                clearInterval(timer);
            }
            element.textContent = prefix + Math.floor(current) + suffix;
        }, 50);
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === backdropRef.current) onClose();
    };

    // Reusable: replay arrow bounce animation
    const triggerArrowBounce = React.useCallback(() => {
        const el = arrowRef.current;
        if (!el) return;

        el.classList.remove('scroll-arrow-anim');
        void el.getBoundingClientRect(); // force reflow
        el.classList.add('scroll-arrow-anim');
    }, []);

    // When modal opens, make the "Read the Story" arrow bounce once
    React.useEffect(() => {
        if (!isOpen) return;
        const timeout = setTimeout(() => {
            triggerArrowBounce();
        }, 900); // after hero fades in
        return () => clearTimeout(timeout);
    }, [isOpen, triggerArrowBounce]);

    if (!isOpen || !data) return null;

    const readTime = calcReadTimeFromMarkdown(data.story ?? '');
    const impactData = getImpactFromGraphData(data.id);
    const impactScale = impactData.scale;
    const impactColor = impactData.color;

    const stakesStyle = {
        '--impact-color': impactColor,
    } as React.CSSProperties;

    const sections = [
        {name: 'Intro', id: 'hero'},
        {name: 'Stakes', id: 'stakes'},
        {name: 'Story', id: 'story'},
        {name: 'Insight', id: 'insight'},
    ];

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        const container = containerRef.current;
        if (!element || !container) return;

        const progressPanel = container.querySelector('.progress-system') as HTMLElement | null;
        const panelHeight = progressPanel?.offsetHeight || 0;
        const elementPosition = element.offsetTop;
        const offsetPosition = elementPosition - panelHeight;

        container.scrollTo({
            top: offsetPosition,
            behavior: 'smooth',
        });
    };

    return (
        <div
            ref={backdropRef}
            className="achievement-modal-backdrop"
            onClick={handleBackdropClick}
        >
            <div
                ref={containerRef}
                className="achievement-modal-container"
            >
                {/* Progress system */}
                <div className="progress-system">
                    <div className="progress-bar" style={{width: `${scrollProgress * 100}%`}}/>

                    {/* LEFT SIDE - Impact Scale & Title */}
                    <div className={`panel-left ${showTitle ? 'panel-left-shifted' : ''}`}>
                        <div className="impact-scale">
                            <div
                                className="impact-dot"
                                style={{background: impactColor}}
                            />
                            <span className="impact-label">{impactScale}</span>
                        </div>

                        <div className={`panel-title ${showTitle ? 'visible' : ''}`}>
                            {data.title}
                        </div>
                    </div>

                    {/* CENTER - Section Dots */}
                    <div className="section-dots">
                        {sections.map((section, i) => (
                            <button
                                key={section.id}
                                className={`section-dot ${i <= activeSection ? 'active' : ''}`}
                                onClick={() => scrollToSection(section.id)}
                                aria-label={`Jump to ${section.name}`}
                            >
                                <span className="section-dot-inner"/>
                                <span className="section-label">{section.name}</span>
                            </button>
                        ))}
                    </div>

                    {/* RIGHT SIDE - Close button */}
                    <button className="close-btn-panel" onClick={onClose} aria-label="Close">
                        <div className="close-icon">
                            <span/>
                            <span/>
                        </div>
                    </button>
                </div>

                {/* HERO */}
                <div
                    id="hero"
                    className="hero-section"
                    onMouseEnter={triggerArrowBounce} // replay arrow animation on hero hover
                >
                    {data.images[0] && (
                        <div className="hero-media">
                            <img src={data.images[0]} alt={data.title} className="hero-image"/>
                            <div className="hero-overlay"/>
                            <div className="hero-grid"/>
                        </div>
                    )}

                    <div className="hero-content">
                        <div className="hero-meta">
                            <span className="meta-item">{data.date}</span>
                            {data.age && <span className="meta-divider">/</span>}
                            {data.age && <span className="meta-item">AGE {data.age}</span>}
                            {data.location && <span className="meta-divider">/</span>}
                            {data.location && <span className="meta-item">{data.location}</span>}
                        </div>

                        <h1 className="hero-title">
                            <span className="title-word">{data.title}</span>
                        </h1>

                        <p className="hero-hook">{data.hook}</p>
                    </div>

                    <button
                        className="scroll-indicator"
                        onClick={() => scrollToSection('stakes')}
                        aria-label="Scroll to story"
                    >
                        <span className="scroll-text">Read the Story</span>
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
                            <path d="M12 5v14M19 12l-7 7-7-7"/>
                        </svg>
                    </button>
                </div>

                {/* STAKES */}
                <div
                    id="stakes"
                    className="story-section stakes-section"
                    style={stakesStyle}
                >
                    <div className="section-header">
                        <span className="section-number">01</span>
                        <span className="section-title">THE STAKES</span>
                    </div>

                    <div className="stakes-container">
                        <div className="stake-card challenge">
                            <div className="stake-header">
                                <div className="stake-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         strokeWidth="2">
                                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                                    </svg>
                                </div>
                                <div className="stake-label">Challenge</div>
                            </div>
                            <p>{data.challenge}</p>
                        </div>

                        <div className="stakes-divider">
                            <span className="divider-line"/>
                            <span className="divider-arrow">→</span>
                            <span className="divider-line"/>
                        </div>

                        <div className="stake-card outcome">
                            <div className="stake-header">
                                <div className="stake-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                </div>
                                <div className="stake-label">Outcome</div>
                            </div>
                            <p>{data.outcome}</p>
                        </div>
                    </div>
                </div>

                {/* METRICS */}
                {data.metrics.length > 0 && (
                    <div className="story-section metrics-section">
                        <div className="metrics-grid">
                            {data.metrics.map((metric, i) => (
                                <div
                                    key={i}
                                    className="metric-badge"
                                    data-value={metric}
                                    style={{animationDelay: `${i * 0.1}s`}}
                                >
                                    {metric}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* STORY */}
                <div id="story" className="story-section story-content">
                    <div className="section-header">
                        <div>
                            <span className="section-number">02</span>
                            <span className="section-title">THE STORY</span>
                        </div>
                        <div className="read-time-wrapper">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 6v6l4 2"/>
                            </svg>
                            <span>{readTime} MIN READ</span>
                        </div>
                    </div>

                    <ReactMarkdown
                        components={{
                            h2: ({children, ...props}) => (
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
                                            <path d="M5 12h14M12 5l7 7-7 7"/>
                                        </svg>
                                    </span>
                                    {children}
                                </h2>
                            ),
                            h3: ({children, ...props}) => (
                                <h3 className="story-h3" {...props}>{children}</h3>
                            ),
                            p: ({children, ...props}) => {
                                const text = children?.toString() || '';
                                const imageMatch = text.match(/!\[IMAGE-(\d+)\]/);
                                if (imageMatch) {
                                    const idx = parseInt(imageMatch[1], 10);
                                    const img = data.images[idx];
                                    if (!img) return null;

                                    const parts = img.split('#');
                                    const imagePath = parts[0].trim();
                                    const caption = parts[1]?.trim();

                                    return (
                                        <figure className="story-image">
                                            <div className="image-wrapper">
                                                <img src={imagePath} alt={caption || ''}/>
                                                <div className="image-border"/>
                                            </div>
                                            {caption && <figcaption>{caption}</figcaption>}
                                        </figure>
                                    );
                                }

                                return <p className="story-p" {...props}>{children}</p>;
                            },
                            ul: ({children, ...props}) => (
                                <ul className="story-list" {...props}>{children}</ul>
                            ),
                            ol: ({children, ...props}) => (
                                <ol className="story-list ordered" {...props}>{children}</ol>
                            ),
                            li: ({children, ...props}) => (
                                <li className="story-li" {...props}>{children}</li>
                            ),
                            blockquote: ({children, ...props}) => (
                                <blockquote className="story-quote" {...props}>
                                    <span className="quote-mark">|</span>
                                    {children}
                                </blockquote>
                            ),
                            strong: ({...props}) => <strong className="story-emphasis" {...props} />,
                        }}
                    >
                        {data.story}
                    </ReactMarkdown>
                </div>

                {/* INSIGHT */}
                {data.insight && (
                    <div id="insight" className="story-section insight-section">
                        <div className="section-header">
                            <span className="section-number">03</span>
                            <span className="section-title">THE LESSON</span>
                        </div>
                        <p className="insight-text">{data.insight}</p>
                    </div>
                )}

                {/* FOOTER */}
                <div className="story-section footer-section">
                    <div className="footer-tags">
                        {data.tags.map(tag => (
                            <span key={tag} className="tag">#{tag}</span>
                        ))}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .achievement-modal-backdrop {
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
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                /* MODAL CONTAINER - Perfect 1:1 square that scales responsively */
                .achievement-modal-container {
                    /* Calculate size based on smallest viewport dimension with padding */
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

                .achievement-modal-container::-webkit-scrollbar {
                    display: none;
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(40px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                /* PROGRESS SYSTEM - Scales with modal size */
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
                    flex-direction: column;
                    justify-content: center;
                    align-items: flex-start;
                    gap: 0;
                    height: 100%;
                    position: relative;
                    transform: translateY(0);
                    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .panel-left.panel-left-shifted {
                    transform: translateY(2px);
                }

                .impact-scale {
                    display: flex;
                    align-items: center;
                    gap: clamp(6px, 1vmin, 8px);
                }

                .impact-dot {
                    width: clamp(8px, 1.2vmin, 10px);
                    height: clamp(8px, 1.2vmin, 10px);
                    border-radius: 50%;
                }

                .impact-label {
                    font: 600 clamp(9px, 1.3vmin, 11px)/1 'Rajdhani', monospace;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.8);
                    white-space: nowrap;
                }

                .panel-title {
                    font: 600 clamp(11px, 1.5vmin, 13px)/1.2 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.8);
                    opacity: 0;
                    transform: translateY(12px);
                    max-width: clamp(160px, 25vmin, 220px);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    max-height: 0;
                    margin-top: 0;
                    transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                    transform 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                    max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .panel-title.visible {
                    opacity: 1;
                    transform: translateY(0);
                    max-height: 40px;
                    margin-top: clamp(4px, 0.7vmin, 6px);
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

                /* HERO SECTION - Scales with modal */
                .hero-section {
                    position: relative;
                    width: 100%;
                    aspect-ratio: 4 / 3;
                    display: flex;
                    align-items: flex-end;
                    overflow: hidden;
                }

                .hero-media {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                }

                .hero-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    object-position: center;
                    display: block;
                }

                .hero-overlay {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(
                            to bottom,
                            rgba(0, 0, 0, 0.2) 0%,
                            rgba(0, 0, 0, 0.7) 60%,
                            rgba(0, 0, 0, 0.95) 100%
                    );
                }

                .hero-grid {
                    display: none;
                }

                .hero-content {
                    position: relative;
                    z-index: 2;
                    padding: clamp(30px, 5vmin, 60px);
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
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                /* SECTION HEADERS - Scale with modal */
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

                /* STAKES SECTION */
                .stakes-section {
                    padding: clamp(30px, 4vmin, 50px) 0;
                    background: linear-gradient(
                            to bottom,
                            rgba(255, 255, 255, 0.02) 0%,
                            transparent 100%
                    );
                }

                .stakes-container {
                    display: grid;
                    grid-template-columns: 1fr auto 1fr;
                    gap: clamp(20px, 3vmin, 30px);
                    align-items: stretch;
                    max-width: 900px;
                    margin: 0 auto;
                    padding: 0 clamp(30px, 4vmin, 60px);
                }

                .stake-card {
                    padding: clamp(20px, 3vmin, 28px);
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    position: relative;
                    overflow: hidden;
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }

                .stake-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 1px;
                    background: linear-gradient(90deg,
                    transparent 0%,
                    color-mix(in srgb, var(--impact-color, rgba(255, 255, 255, 0.5)) 80%, transparent) 50%,
                    transparent 100%
                    );
                    transition: left 0.6s ease;
                }

                .stake-card::after {
                    content: '';
                    position: absolute;
                    inset: -2px;
                    border-radius: inherit;
                    background: linear-gradient(135deg,
                    rgba(0, 0, 0, 0) 0%,
                    color-mix(in srgb, var(--impact-color, rgba(255, 255, 255, 0.5)) 25%, transparent) 50%,
                    rgba(0, 0, 0, 0) 100%
                    );
                    opacity: 0;
                    transition: opacity 0.4s ease;
                    pointer-events: none;
                }

                .stake-card:hover {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: var(--impact-color, rgba(255, 255, 255, 0.5));
                    transform: translateY(-4px) scale(1.02);
                    box-shadow: 0 8px 32px color-mix(in srgb, var(--impact-color, rgba(255, 255, 255, 0.5)) 30%, transparent);
                }

                .stake-card:hover::before {
                    left: 100%;
                }

                .stake-card:hover::after {
                    opacity: 1;
                }

                .stake-header {
                    display: flex;
                    align-items: center;
                    gap: clamp(8px, 1.2vmin, 10px);
                    margin-bottom: clamp(12px, 2vmin, 16px);
                }

                .stake-icon {
                    width: clamp(16px, 2.5vmin, 20px);
                    height: clamp(16px, 2.5vmin, 20px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .stake-icon svg {
                    width: 100%;
                    height: 100%;
                    stroke: rgba(255, 255, 255, 0.6);
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .stake-card:hover .stake-icon svg {
                    stroke: var(--impact-color, rgba(255, 255, 255, 0.8));
                    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--impact-color, rgba(255, 255, 255, 0.5)) 60%, transparent));
                    transform: scale(1.1);
                }

                .stake-label {
                    font: 600 clamp(9px, 1.3vmin, 11px)/1 'Rajdhani', monospace;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.7);
                    transition: all 0.4s ease;
                }

                .stake-card:hover .stake-label {
                    color: rgba(255, 255, 255, 0.95);
                    text-shadow: 0 0 12px rgba(255, 255, 255, 0.4);
                }

                .stake-card p {
                    font: 400 clamp(14px, 2vmin, 16px)/1.6 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.9);
                    margin: 0;
                    transition: color 0.4s ease, text-shadow 0.4s ease;
                }

                .stake-card:hover p {
                    font-weight: 600;
                    color: rgba(255, 255, 255, 1);
                    text-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
                    letter-spacing: -0.003em;
                }

                .stakes-divider {
                    display: flex;
                    align-items: center;
                    gap: clamp(8px, 1.5vmin, 12px);
                }

                .divider-line {
                    width: clamp(15px, 2.5vmin, 20px);
                    height: 1px;
                    background: rgba(255, 255, 255, 0.1);
                }

                .divider-arrow {
                    font-size: clamp(16px, 2.5vmin, 20px);
                    color: rgba(255, 255, 255, 0.3);
                }

                /* METRICS */
                .metrics-section {
                    padding: clamp(15px, 2.5vmin, 20px) clamp(30px, 4vmin, 60px) clamp(30px, 4vmin, 40px) clamp(30px, 4vmin, 60px);
                    background: #000;
                    position: relative;
                    overflow: hidden;
                }

                .metrics-section::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 1px;
                    background: rgba(255, 255, 255, 0.05);
                }

                .metrics-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: clamp(12px, 2vmin, 16px);
                    justify-content: center;
                }

                .metric-badge {
                    padding: clamp(12px, 2vmin, 16px) clamp(16px, 2.5vmin, 24px);
                    background: #000;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    position: relative;
                    overflow: hidden;
                    font: 600 clamp(12px, 1.8vmin, 14px)/1 'Rajdhani', monospace;
                    letter-spacing: 0.08em;
                    color: rgba(255, 255, 255, 0.9);
                    text-transform: uppercase;
                    opacity: 0;
                    transform: translateY(20px);
                    animation: metricReveal 0.5s ease forwards;
                }

                @keyframes metricReveal {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                /* STORY CONTENT */
                .story-content {
                    padding: clamp(30px, 4vmin, 50px) 0;
                    max-width: 900px;
                    margin: 0 auto;
                }

                .story-content .section-header {
                    margin: 0 0 clamp(35px, 5vmin, 50px) 0;
                    padding: 0 clamp(30px, 4vmin, 60px) clamp(12px, 2vmin, 16px) clamp(30px, 4vmin, 60px);
                }

                .story-content .section-header::after {
                    left: 30px;
                    right: 30px;
                }

                .story-content .section-header > div:first-child {
                    display: flex;
                    align-items: center;
                    gap: clamp(12px, 2vmin, 16px);
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

                .story-h2,
                .story-h3,
                .story-p,
                .story-image,
                .story-quote,
                .story-list {
                    max-width: min(550px, 90%);
                    margin-left: auto;
                    margin-right: auto;
                }

                /* PREMIUM H2 MARKER */
                .story-h2 {
                    font: 700 clamp(22px, 3.5vmin, 34px)/1.2 'Rajdhani', monospace;
                    color: #fff;
                    margin: clamp(40px, 6vmin, 60px) auto clamp(18px, 2.5vmin, 24px) auto;
                    position: relative;
                    padding-left: 0;
                }

                .h2-marker {
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

                .h2-arrow {
                    width: 100%;
                    height: 100%;
                    color: rgba(255, 255, 255, 0.35);
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    transform: rotate(0deg);
                }

                .story-h2:hover .h2-arrow {
                    color: rgba(255, 255, 255, 0.85);
                    transform: rotate(90deg);
                    filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.3));
                }

                .story-h3 {
                    font: 600 clamp(17px, 2.5vmin, 24px)/1.3 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.9);
                    margin: clamp(30px, 4vmin, 40px) auto clamp(12px, 2vmin, 16px) auto;
                    position: relative;
                    padding-left: clamp(20px, 3vmin, 24px);
                }

                .story-h3::before {
                    content: '// ';
                    position: absolute;
                    left: 0;
                    color: rgba(255, 255, 255, 0.2);
                }

                .story-p {
                    font: 400 clamp(15px, 2vmin, 17px)/1.7 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.75);
                    margin: clamp(16px, 2.5vmin, 20px) auto;
                }

                .story-emphasis {
                    color: #fff;
                    font-weight: 600;
                    position: relative;
                }

                .story-emphasis::after {
                    content: '';
                    position: absolute;
                    bottom: -2px;
                    left: 0;
                    width: 100%;
                    height: 1px;
                    background: rgba(255, 255, 255, 0.2);
                    transform: scaleX(0);
                    transition: transform 0.3s ease;
                }

                .story-emphasis:hover::after {
                    transform: scaleX(1);
                }

                .story-list {
                    margin: clamp(12px, 2vmin, 16px) auto;
                    padding-left: clamp(1rem, 2.5vmin, 1.25rem);
                    list-style-position: outside;
                }

                .story-list.ordered {
                    list-style-type: decimal;
                }

                .story-list:not(.ordered) {
                    list-style-type: disc;
                }

                .story-li {
                    margin: clamp(4px, 0.7vmin, 6px) 0;
                    color: rgba(255, 255, 255, 0.75);
                    font: 400 clamp(15px, 2vmin, 17px)/1.7 'Rajdhani', monospace;
                }

                .story-li > ul,
                .story-li > ol {
                    margin-top: clamp(6px, 1vmin, 8px);
                    margin-bottom: clamp(6px, 1vmin, 8px);
                }

                .story-image {
                    margin: clamp(35px, 5vmin, 50px) auto;
                    opacity: 0;
                    transform: translateY(30px);
                    transition: all 0.6s ease;
                }

                .story-image.in-view {
                    opacity: 1;
                    transform: translateY(0);
                }

                .image-wrapper {
                    position: relative;
                    overflow: hidden;
                    background: #000;
                }

                .story-image img {
                    width: 100%;
                    height: auto;
                    max-height: clamp(300px, 45vmin, 400px);
                    object-fit: cover;
                    display: block;
                    transition: all 0.5s ease;
                }

                .story-image:hover img {
                    transform: scale(1.02);
                }

                .image-border {
                    position: absolute;
                    inset: 0;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    pointer-events: none;
                }

                .story-image figcaption {
                    padding: clamp(10px, 1.5vmin, 12px) clamp(20px, 3vmin, 30px);
                    font: 400 clamp(10px, 1.5vmin, 12px)/1.4 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.5);
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    background: rgba(0, 0, 0, 0.5);
                }

                .story-quote {
                    margin: clamp(35px, 5vmin, 50px) auto;
                    padding: clamp(24px, 3.5vmin, 32px);
                    position: relative;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .quote-mark {
                    position: absolute;
                    top: clamp(-8px, -1.2vmin, -10px);
                    left: clamp(15px, 2.5vmin, 20px);
                    font-size: clamp(36px, 5vmin, 48px);
                    color: rgba(255, 255, 255, 0.1);
                    font-family: Georgia, serif;
                    background: #000;
                    padding: 0 clamp(8px, 1.2vmin, 10px);
                }

                .story-quote p {
                    font: 500 clamp(16px, 2.5vmin, 20px)/1.5 'Rajdhani', monospace;
                    font-style: italic;
                    color: rgba(255, 255, 255, 0.8);
                    margin: 0;
                    position: relative;
                }

                .insight-section {
                    padding: clamp(35px, 5vmin, 50px) clamp(30px, 4vmin, 60px);
                    background: transparent;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    text-align: center;
                    position: relative;
                    max-width: 900px;
                    margin: 0 auto;
                }

                .insight-section::before {
                    content: '';
                    position: absolute;
                    top: -1px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: clamp(60px, 9vmin, 80px);
                    height: 1px;
                    background: rgba(255, 255, 255, 0.3);
                }

                .insight-text {
                    font: 500 clamp(18px, 3vmin, 28px)/1.5 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.9);
                    margin: 0 auto;
                    max-width: min(600px, 90%);
                }

                #insight .section-header {
                    padding: 0 0 clamp(12px, 2vmin, 16px) 0;
                    max-width: 900px;
                    margin: 0 auto clamp(35px, 5vmin, 50px);
                    position: relative;
                }

                #insight .section-header::after {
                    left: -10px;
                    right: -10px;
                }

                .footer-section {
                    padding: clamp(30px, 4vmin, 40px) clamp(30px, 4vmin, 60px);
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    background: rgba(0, 0, 0, 0.5);
                }

                .footer-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: clamp(10px, 1.5vmin, 12px);
                    justify-content: center;
                }

                .tag {
                    padding: clamp(5px, 0.8vmin, 6px) clamp(10px, 1.5vmin, 12px);
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    font: 400 clamp(9px, 1.3vmin, 11px)/1 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.5);
                    letter-spacing: 0.08em;
                    text-transform: lowercase;
                    transition: all 0.3s ease;
                }

                .tag:hover {
                    color: rgba(255, 255, 255, 0.8);
                    border-color: rgba(255, 255, 255, 0.3);
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

                /* MOBILE - When modal gets too small, stack progress panel */
                @media (max-width: 768px) or (max-height: 600px) {
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
                    }

                    .section-dots {
                        order: 1;
                        gap: clamp(12px, 2vmin, 20px);
                    }

                    .close-btn-panel {
                        order: 3;
                        justify-self: center;
                    }

                    .stakes-container {
                        grid-template-columns: 1fr;
                        gap: clamp(20px, 3vmin, 24px);
                    }

                    .stakes-divider {
                        transform: rotate(90deg);
                    }
                }

                /* VERY SMALL - Hide section labels */
                @media (max-width: 480px) or (max-height: 500px) {
                    .achievement-modal-backdrop {
                        padding: 6px;
                    }

                    .section-label {
                        display: none;
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