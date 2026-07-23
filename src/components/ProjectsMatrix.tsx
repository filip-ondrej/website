'use client';

import React from 'react';
import ProjectModal from '@/components/ProjectModal';
import { PROJECTS, type ProjectItem } from '@/data/projects';

/* /projects — the full index. One row per project in the site's schematic
   language: numbered rows, hairlines, tiny uppercase labels, hover recede.
   Rows open the same ProjectModal as the home-page cards. */

const years = PROJECTS.map((p) => p.year).filter((y): y is number => typeof y === 'number');
const YEAR_MIN = Math.min(...years);
const YEAR_MAX = Math.max(...years);

export default function ProjectsMatrix() {
    const [modalProject, setModalProject] = React.useState<ProjectItem | null>(null);

    return (
        <main className="pm">
            <a className="pm-back" href="/">
                <span aria-hidden="true">←</span> BACK HOME
            </a>

            <header className="pm-head">
                <p className="pm-label">
                    [01 — {String(PROJECTS.length).padStart(2, '0')}] INDEX
                </p>
                <h1 className="pm-title">ALL PROJECTS</h1>
                <p className="pm-sub">
                    {PROJECTS.length} ENTRIES <span className="pm-slash">/</span>{' '}
                    {YEAR_MIN} — {YEAR_MAX} <span className="pm-slash">/</span> INDEX
                    GROWS WITH EVERY BUILD
                </p>
            </header>

            <div className="pm-cols" aria-hidden="true">
                <span>NO</span>
                <span>YEAR</span>
                <span>PROJECT</span>
                <span className="pm-cols-tags">STACK</span>
                <span />
            </div>

            <div className="pm-rows">
                {PROJECTS.map((p, i) => (
                    <button
                        key={p.id}
                        type="button"
                        className="pm-row"
                        style={{ animationDelay: `${i * 70}ms` }}
                        onClick={() => setModalProject(p)}
                    >
                        <span className="pm-no">[{String(i + 1).padStart(2, '0')}]</span>
                        <span className="pm-year">{p.year ?? '—'}</span>
                        <span className="pm-name">{p.title}</span>
                        <span className="pm-tags">
                            {(p.tags ?? []).map((t) => (
                                <span
                                    key={t}
                                    className={`pm-tag${t === 'world-class' ? ' gold' : ''}`}
                                >
                                    #{t}
                                </span>
                            ))}
                        </span>
                        <span className="pm-glyph" aria-hidden="true">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                width="22"
                                height="22"
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
                    </button>
                ))}
            </div>

            <p className="pm-note">// MORE ENTRIES LAND WITH THE CONTENT PASS</p>

            <ProjectModal
                data={modalProject}
                isOpen={modalProject !== null}
                onClose={() => setModalProject(null)}
                startIndex={0}
            />

            {/* Global on purpose: pm- prefixes are unique, and it sidesteps the
                styled-jsx compound-:global()/:has() scoping traps (V7 §7). */}
            <style jsx global>{`
                .pm {
                    min-height: 100vh;
                    padding: clamp(6rem, 14vh, 9rem) var(--gutter, clamp(2rem, 8.5vw, 6.25rem))
                    clamp(4rem, 10vh, 7rem);
                    background: #050505;
                }

                .pm-back {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    font: 600 0.6875rem/1 'Rajdhani', monospace;
                    letter-spacing: 0.16em;
                    color: rgba(255, 255, 255, 0.5);
                    text-decoration: none;
                    text-transform: uppercase;
                    transition: color 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .pm-back:hover,
                .pm-back:focus-visible {
                    color: #fff;
                }

                .pm-head {
                    margin: clamp(2rem, 6vh, 3.5rem) 0 clamp(2.5rem, 7vh, 4.5rem);
                }

                .pm-label {
                    margin: 0 0 1rem;
                    font: 600 0.6875rem/1 'Rajdhani', monospace;
                    letter-spacing: 0.2em;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: uppercase;
                }

                .pm-title {
                    margin: 0;
                    font: 700 clamp(3rem, 5.9rem, 7rem) / 0.95 'Rajdhani', monospace;
                    letter-spacing: 0.01em;
                    color: #fff;
                    text-transform: uppercase;
                }

                .pm-sub {
                    margin: 1.25rem 0 0;
                    font: 600 0.6875rem/1.6 'Rajdhani', monospace;
                    letter-spacing: 0.16em;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: uppercase;
                }

                .pm-slash {
                    color: rgba(255, 255, 255, 0.25);
                    margin: 0 0.35rem;
                }

                .pm-cols,
                .pm-row {
                    display: grid;
                    grid-template-columns: 3.5rem 5rem minmax(0, 1fr) auto 3rem;
                    align-items: center;
                    gap: 1.25rem;
                }

                .pm-cols {
                    padding: 0 0 0.7rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
                    font: 600 0.625rem/1 'Rajdhani', monospace;
                    letter-spacing: 0.2em;
                    color: rgba(255, 255, 255, 0.32);
                    text-transform: uppercase;
                }

                .pm-row {
                    width: 100%;
                    padding: clamp(1.1rem, 2.4vh, 1.5rem) 0;
                    border: 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    background: transparent;
                    text-align: left;
                    cursor: pointer;
                    /* backwards (not forwards) fill: the from-frame covers the
                       stagger delay, and once the animation ends its fill stops
                       winning the cascade — otherwise the pinned opacity: 1
                       would override the group-hover recede below. */
                    animation: pm-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) backwards;
                    transition: opacity 0.3s ease, background 0.25s ease;
                }

                @keyframes pm-in {
                    from {
                        opacity: 0;
                        transform: translateY(14px);
                    }
                }

                /* Group-hover recede: exploring one row dims the rest. */
                .pm-rows:has(.pm-row:hover) .pm-row:not(:hover),
                .pm-rows:has(.pm-row:focus-visible) .pm-row:not(:focus-visible) {
                    opacity: 0.35;
                }

                .pm-row:hover {
                    background: rgba(255, 255, 255, 0.025);
                }

                .pm-row:focus-visible {
                    outline: 1px solid rgba(255, 255, 255, 0.9);
                    outline-offset: -1px;
                }

                .pm-no {
                    font: 600 0.6875rem/1 'Rajdhani', monospace;
                    letter-spacing: 0.08em;
                    color: rgba(255, 255, 255, 0.32);
                    font-variant-numeric: tabular-nums;
                }

                .pm-year {
                    font: 600 0.8125rem/1 'Rajdhani', monospace;
                    letter-spacing: 0.1em;
                    color: rgba(255, 255, 255, 0.6);
                    font-variant-numeric: tabular-nums;
                }

                .pm-name {
                    font: 700 clamp(1rem, 1.375rem, 1.5rem) / 1.2 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.9);
                    letter-spacing: 0.01em;
                    transition: color 0.25s ease;
                }
                .pm-row:hover .pm-name,
                .pm-row:focus-visible .pm-name {
                    color: #fff;
                }

                .pm-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    justify-content: flex-end;
                }

                .pm-tag {
                    padding: 0.3rem 0.6rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    font: 400 0.625rem/1 'Rajdhani', monospace;
                    letter-spacing: 0.08em;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: lowercase;
                    white-space: nowrap;
                }

                .pm-tag.gold {
                    border-color: rgba(255, 214, 10, 0.35);
                    color: #f59e0b;
                }

                .pm-glyph {
                    justify-self: end;
                    opacity: 0;
                    transform: translate(-4px, 4px) scale(0.92);
                    transition:
                            opacity 0.28s ease-out,
                            transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
                }
                .pm-glyph svg {
                    stroke: rgba(255, 255, 255, 0.92);
                }
                .pm-row:hover .pm-glyph,
                .pm-row:focus-visible .pm-glyph {
                    opacity: 1;
                    transform: translate(0, 0) scale(1);
                }

                .pm-note {
                    margin: 2.5rem 0 0;
                    font: 600 0.6875rem/1 'Rajdhani', monospace;
                    letter-spacing: 0.16em;
                    color: rgba(255, 255, 255, 0.32);
                    text-transform: uppercase;
                }

                @media (max-width: 900px) {
                    .pm-cols,
                    .pm-row {
                        grid-template-columns: 3rem 4rem minmax(0, 1fr) 2.5rem;
                    }
                    .pm-cols-tags,
                    .pm-tags {
                        display: none;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .pm-row {
                        opacity: 1;
                        transform: none;
                        animation: none;
                    }
                }
            `}</style>
        </main>
    );
}
