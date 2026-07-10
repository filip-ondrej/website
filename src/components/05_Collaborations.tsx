'use client';

import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';
import { collaborators, type Collaborator } from '@/data/collaborators';
import CollaborationModal from '@/components/CollaborationModal';
import { loadCollaboration } from '@/lib/loadCollaboration';
import type { CollaborationData } from '@/components/CollaborationModal';

/********************************************************************
 * --------------------- COLLABORATION BRANDS --------------------- *
 ********************************************************************/

export default function Collaborations() {
    const railRef = useRef<HTMLDivElement | null>(null);
    const rowRef = useRef<HTMLUListElement | null>(null);
    const [cloneCount, setCloneCount] = useState(5);

    // Modal state
    const [selectedCollab, setSelectedCollab] = useState<Collaborator | null>(null);
    const [collabData, setCollabData] = useState<CollaborationData | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const openModal = async (collab: Collaborator) => {
        setSelectedCollab(collab);
        setIsModalOpen(true);
        setIsLoading(true);

        const data = await loadCollaboration(collab.slug);
        setCollabData(data);
        setIsLoading(false);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setTimeout(() => {
            setSelectedCollab(null);
            setCollabData(null);
        }, 300);
    };

    // 60fps scrolling animation for BRANDS rail
    useEffect(() => {
        const rail = railRef.current;
        const row = rowRef.current;
        if (!rail || !row) return;

        let W = 0;
        let offset = 0;
        let velocity = 0;
        let raf: number | null = null;
        let last = performance.now();
        let paused = false;
        let armed = false;
        let armTimer: number | null = null;

        const DRIFT = 40;
        const WHEEL_GAIN = 1.2;
        const DAMPING = 0.9;
        const MIN_VEL = 2;
        const MAX_VEL = 600;
        // Hover must REST on the rail this long before it captures scrolling —
        // someone scrolling straight through the section must not get trapped.
        const ARM_DELAY_MS = 1000;

        const compute = () => {
            W = row.scrollWidth;
            rail.style.height = `${row.getBoundingClientRect().height}px`;
            const vw = rail.clientWidth;
            setCloneCount(Math.max(3, Math.ceil(vw / (W || 1)) + 2));
        };

        const ro = new ResizeObserver(compute);
        ro.observe(row);

        const wrap = (px: number) => (!W ? px : ((px % W) + W) % W);

        const tick = (now: number) => {
            const dt = Math.max(0.001, (now - last) / 1000);
            last = now;

            if (!paused) offset += DRIFT * dt;

            offset += velocity * dt;
            const dampingPerSecond = Math.pow(DAMPING, dt * 60);
            velocity *= dampingPerSecond;
            if (Math.abs(velocity) < MIN_VEL) velocity = 0;

            if (W > 0) {
                const rows = rail.querySelectorAll<HTMLElement>('.brands-row');
                const total = rows.length;
                const o = wrap(offset);
                for (let i = 0; i < total; i++) {
                    const baseX = (i - Math.floor(total / 2)) * W;
                    rows[i].style.transform = `translate3d(${baseX - o}px,0,0)`;
                }
            }
            raf = requestAnimationFrame(tick);
        };

        const onWheel = (e: WheelEvent) => {
            // Once ARMED (cursor rested on the rail for ARM_DELAY_MS), EVERY
            // wheel gesture — vertical included — drives the rail horizontally
            // and the page does not scroll until the cursor leaves. Before
            // arming, events fall through so a passer-by keeps scrolling.
            if (!armed) return;
            e.preventDefault();
            e.stopPropagation();
            const raw = e.deltaY !== 0 ? e.deltaY : e.deltaX;
            const clamped = Math.max(-120, Math.min(120, raw));
            velocity += clamped * WHEEL_GAIN;
            velocity = Math.max(-MAX_VEL, Math.min(MAX_VEL, velocity));
        };

        const onEnter = () => {
            paused = true;
            armTimer = window.setTimeout(() => {
                armed = true;
                // Hard lock: Chrome delivers NON-cancelable wheel events during
                // aggressive gestures (preventDefault silently ignored), which
                // let a single native scroll step slip through. While this attr
                // is set, 00_ProgressLine's scroll handler snaps any scroll not
                // initiated by itself straight back — nothing can move the page.
                document.documentElement.setAttribute('data-rail-hijack', '');
            }, ARM_DELAY_MS);
        };

        const onLeave = () => {
            paused = false;
            if (armTimer) {
                clearTimeout(armTimer);
                armTimer = null;
            }
            armed = false;
            document.documentElement.removeAttribute('data-rail-hijack');
        };

        const onFocusIn = () => { paused = true; };
        const onFocusOut = (ev: FocusEvent) => {
            if (!rail.contains(ev.relatedTarget as Node)) paused = false;
        };

        compute();
        raf = requestAnimationFrame(tick);

        rail.addEventListener('wheel', onWheel, { passive: false });
        rail.addEventListener('mouseenter', onEnter);
        rail.addEventListener('mouseleave', onLeave);
        rail.addEventListener('focusin', onFocusIn);
        rail.addEventListener('focusout', onFocusOut);
        window.addEventListener('resize', compute);

        return () => {
            if (raf) cancelAnimationFrame(raf);
            if (armTimer) clearTimeout(armTimer);
            document.documentElement.removeAttribute('data-rail-hijack');
            ro.disconnect();
            rail.removeEventListener('wheel', onWheel as EventListener);
            rail.removeEventListener('mouseenter', onEnter);
            rail.removeEventListener('mouseleave', onLeave);
            rail.removeEventListener('focusin', onFocusIn);
            rail.removeEventListener('focusout', onFocusOut);
            window.removeEventListener('resize', compute);
        };
    }, []);

    return (
        <>
            <section aria-label="Collaborations" className="collab-section">
                {/* Top tape */}
                <Tape label="COLLABORATIONS & COMPANY EXPERIENCE" reverse={false} />

                {/* Brands Rail */}
                <div className="collab-content">
                    <div className="brands">
                        <div className="brands-rail" ref={railRef}>
                            <ul ref={rowRef} className="brands-row">
                                {collaborators.map((c, idx) => (
                                    <BrandTile
                                        key={`base-${c.name}-${idx}`}
                                        c={c}
                                        onClick={() => openModal(c)}
                                    />
                                ))}
                            </ul>

                            {Array.from({ length: cloneCount }).map((_, i) => (
                                <ul key={`clone-${i}`} className="brands-row" aria-hidden="true">
                                    {collaborators.map((c, idx) => (
                                        <BrandTile
                                            key={`clone-${i}-${c.name}-${idx}`}
                                            c={c}
                                            onClick={() => openModal(c)}
                                        />
                                    ))}
                                </ul>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bottom tape */}
                <Tape label="COLLABORATIONS & COMPANY EXPERIENCE" reverse />
            </section>

            {/* Loading Overlay */}
            {isLoading && (
                <div className="collab-loading-overlay">
                    <div className="loading-spinner"></div>
                    <p>Loading collaboration details...</p>
                </div>
            )}

            {/* Modal */}
            <CollaborationModal
                data={collabData}
                isOpen={isModalOpen && !isLoading}
                onClose={closeModal}
                logo={selectedCollab?.logo}
                href={selectedCollab?.href}
                caption={selectedCollab?.caption}
            />

            <style jsx global>{`
                /* ============================================== */
                /* SECTION LAYOUT – no extra vertical padding */
                /* ============================================== */

                .collab-section {
                    position: relative;
                    padding: 0;
                }

                .collab-content {
                    position: relative;
                }

                /* ============================================== */
                /* LOADING OVERLAY */
                /* ============================================== */

                .collab-loading-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.92);
                    backdrop-filter: blur(8px);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 20px;
                    z-index: 9999;
                }

                .loading-spinner {
                    width: 48px;
                    height: 48px;
                    border: 3px solid rgba(255, 255, 255, 0.1);
                    border-top-color: rgba(255, 255, 255, 0.6);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to {
                        transform: rotate(360deg);
                    }
                }

                .collab-loading-overlay p {
                    font: 400 14px/1 'Rajdhani', monospace;
                    color: rgba(255, 255, 255, 0.6);
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                /* ============================================== */
                /* TAPE SECTION */
                /* ============================================== */

                .tape {
                    overflow: hidden;
                    border-top: 1px solid #fff;
                    border-bottom: 1px solid #fff;
                    -webkit-mask-image: -webkit-linear-gradient(
                            to right,
                            rgba(0, 0, 0, 0) 0,
                            rgba(0, 0, 0, 1) clamp(16px, 3vw, 32px),
                            rgba(0, 0, 0, 1) calc(100% - clamp(16px, 3vw, 32px)),
                            rgba(0, 0, 0, 0) 100%
                    );
                    mask-image: linear-gradient(
                            to right,
                            rgba(0, 0, 0, 0) 0,
                            rgba(0, 0, 0, 1) clamp(16px, 3vw, 32px),
                            rgba(0, 0, 0, 1) calc(100% - clamp(16px, 3vw, 32px)),
                            rgba(0, 0, 0, 0) 100%
                    );
                }

                .tape-rail {
                    position: relative;
                    overflow: hidden;
                    width: 100%;
                    height: auto;
                }

                .tape-row {
                    position: absolute;
                    top: 0;
                    left: 0;
                    display: inline-flex;
                    gap: clamp(8px, 1.5vw, 12px);
                    white-space: nowrap;
                    will-change: transform;
                }

                .tape-block {
                    display: inline-flex;
                    align-items: center;
                    gap: clamp(8px, 1.5vw, 12px);
                    white-space: nowrap;
                    padding-block: clamp(1px, 0.2vw, 2px);
                    color: #fff;
                    font-family: 'Rajdhani', monospace;
                }

                .tape-chunk {
                    display: inline-flex;
                    align-items: center;
                    gap: clamp(8px, 1.5vw, 12px);
                    font-family: 'Rajdhani', monospace;
                }

                .tape-label {
                    font-family: 'Rajdhani', monospace;
                    font-size: clamp(9px, 1.8vw, 11px) !important;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                }

                .tape-code {
                    font-family: 'Rajdhani', monospace;
                    font-size: clamp(8px, 1.6vw, 10px) !important;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }

                .tape-codeword {
                    display: inline-flex;
                    gap: 0;
                    letter-spacing: 0;
                }

                .tape-slot {
                    display: inline-block;
                    width: 1.1ch;
                    text-align: center;
                    line-height: 1;
                }

                .tape-slot[data-mode='digit'] {
                    font-variant-numeric: tabular-nums;
                    font-feature-settings: 'tnum' 1;
                }

                /* ============================================== */
                /* BRANDS SECTION */
                /* ============================================== */

                .brands {
                    position: relative;
                    -webkit-mask-image: -webkit-linear-gradient(
                            to right,
                            rgba(0, 0, 0, 0) 0,
                            rgba(0, 0, 0, 1) clamp(16px, 3vw, 24px),
                            rgba(0, 0, 0, 1) calc(100% - clamp(16px, 3vw, 24px)),
                            rgba(0, 0, 0, 0) 100%
                    );
                    mask-image: linear-gradient(
                            to right,
                            rgba(0, 0, 0, 0) 0,
                            rgba(0, 0, 0, 1) clamp(16px, 3vw, 24px),
                            rgba(0, 0, 0, 1) calc(100% - clamp(16px, 3vw, 24px)),
                            rgba(0, 0, 0, 0) 100%
                    );
                    overflow: hidden;
                    user-select: none;
                }

                .brands-rail {
                    position: relative;
                    overflow: hidden;
                    width: 100%;
                    height: auto;
                    touch-action: pan-x;
                }

                .brands-row {
                    position: absolute;
                    top: 0;
                    left: 0;
                    display: flex;
                    gap: 0;
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    will-change: transform;
                }

                /* ============================================== */
                /* BRAND TILES */
                /* ============================================== */

                .brand {
                    position: relative;
                    width: clamp(120px, 14vw, 230px);
                    aspect-ratio: 6 / 5;
                    display: grid;
                    place-items: center;
                    flex-shrink: 0;
                    transition: opacity 0.4s ease-in-out 0.05s;
                    cursor: pointer;
                }

                .brand-link {
                    position: absolute;
                    inset: 0;
                    display: grid;
                    place-items: center;
                    text-decoration: none;
                    outline: none;
                    cursor: pointer;
                    z-index: 1;
                }

                .brand-link img {
                    opacity: 0.85;
                    transition: opacity 0.25s ease;
                }

                .brand-name {
                    font-size: clamp(0.9rem, 1.6vw, 1.8rem);
                    font-weight: 700;
                    text-transform: none;
                    color: #fff;
                }

                .brands:hover .brand {
                    opacity: 0.5;
                }

                .brands:hover .brand:hover {
                    opacity: 1;
                }

                .brands:hover .brand:hover img {
                    opacity: 1;
                }

                .brand-card {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    background:
                            linear-gradient(
                                    180deg,
                                    rgba(255, 255, 255, 0.22) 0%,
                                    rgba(255, 255, 255, 0.1) 36%,
                                    rgba(255, 255, 255, 0.04) 70%,
                                    rgba(255, 255, 255, 0) 100%
                            ),
                            radial-gradient(
                                    120% 60% at 50% 100%,
                                    rgba(0, 0, 0, 0.16),
                                    rgba(0, 0, 0, 0) 60%
                            );
                    opacity: 0;
                    transition:
                            opacity 0.45s cubic-bezier(0.23, 1, 0.32, 1),
                            border-color 0.45s cubic-bezier(0.23, 1, 0.32, 1);
                    border-left: 1px solid rgba(255, 255, 255, 0.1);
                    border-right: 1px solid rgba(255, 255, 255, 0.1);
                    z-index: 2;
                }

                .brand:hover .brand-card {
                    opacity: 1;
                    border-color: rgba(255, 255, 255, 0.35);
                }

                .brand-corner {
                    position: absolute;
                    top: clamp(6px, 1.5vw, 10px);
                    right: clamp(8px, 2vw, 12px);
                    width: clamp(20px, 4vw, 28px);
                    height: clamp(20px, 4vw, 28px);
                    pointer-events: none;
                    opacity: 0;
                    transform: translate(-6px, 6px) scale(0.25);
                    transform-origin: bottom left;
                    transition:
                            opacity 0.28s ease-out,
                            transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
                    z-index: 3;
                }

                .brand-corner svg {
                    stroke: rgba(255, 255, 255, 0.92);
                }

                .brand:hover .brand-corner {
                    opacity: 1;
                    transform: translate(0, 0) scale(1);
                }

                .brand-caption {
                    position: absolute;
                    left: clamp(8px, 2vw, 12px);
                    bottom: clamp(6px, 1.5vw, 8px);
                    /* rem so it rides the fluid root (the raw-vw clamp pinned it at
                       14px across all desktop widths — oversized vs. the tile). */
                    font-size: clamp(9px, 0.75rem, 14px);
                    font-family: 'Rajdhani', monospace;
                    font-weight: 500;
                    letter-spacing: 0.12em;
                    color: rgba(255, 255, 255, 0.92);
                    text-shadow: 0 0 6px rgba(0, 0, 0, 0.35);
                    text-transform: uppercase;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    z-index: 3;
                }

                .brand:hover .brand-caption {
                    opacity: 1;
                }

                /* ============================================== */
                /* RESPONSIVE */
                /* ============================================== */

                @media (max-width: 768px) {
                    .brand {
                        width: clamp(100px, 25vw, 150px);
                    }
                }

                @media (max-width: 640px) {
                    .brand {
                        width: clamp(90px, 30vw, 140px);
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .tape-row,
                    .brands-row {
                        will-change: auto;
                    }
                    .brand-corner {
                        transition: opacity 0.2s ease;
                        transform: none;
                    }
                    .brand:hover .brand-corner {
                        opacity: 1;
                    }
                    .loading-spinner {
                        animation: none;
                        border-top-color: rgba(255, 255, 255, 0.3);
                    }
                }
            `}</style>
        </>
    );
}


/********************************************************************
 * -------------------------- BRAND TILE -------------------------- *
 ********************************************************************/

interface BrandTileProps {
    c: Collaborator;
    onClick: () => void;
}

function BrandTile({ c, onClick }: BrandTileProps) {
    const content = c.logo ? (
        <Image
            src={c.logo}
            alt={c.name}
            fill
            sizes="(max-width: 768px) 40vw, (max-width: 1200px) 25vw, 15vw"
            className="object-contain"
            priority={false}
        />
    ) : (
        <span className="brand-name">{c.name}</span>
    );

    return (
        <li className="brand">
            <div className="brand-link" onClick={onClick}>
                {content}
                <span className="brand-card" aria-hidden="true">
                    <span className="brand-corner" aria-hidden="true">
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
                    <span className="brand-caption">{c.caption || 'PARTNERSHIP'}</span>
                </span>
            </div>
        </li>
    );
}


/********************************************************************
 * -------------------- TAPE with flicker code -------------------- *
 ********************************************************************/

function Tape({
                  label,
                  code = 'NRG1-SNP-TT',
                  reverse = false,
              }: {
    label: string;
    code?: string;
    reverse?: boolean;
}) {
    const railRef = useRef<HTMLDivElement | null>(null);
    const rowRef = useRef<HTMLDivElement | null>(null);
    const [cloneCount, setCloneCount] = useState(5);

    const codeUp = code.toUpperCase();
    const len = codeUp.length;
    const [current, setCurrent] = useState(codeUp);
    const [mode, setMode] = useState<'word' | 'digit'>('word');

    // flicker effect for code
    useEffect(() => {
        const prefersReduced =
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        if (prefersReduced) return;

        let flickerId: number | null = null;
        let settleId: number | null = null;

        const randInt = (min: number, max: number) =>
            Math.floor(Math.random() * (max - min + 1)) + min;
        const randMs = (a: number, b: number) => randInt(a * 1000, b * 1000);
        const rand01 = () => (Math.random() < 0.5 ? '0' : '1');

        const WAIT_MIN_S = 4,
            WAIT_MAX_S = 8;
        const FLICKER_MIN_S = 0.5,
            FLICKER_MAX_S = 1.5;
        const FLICKER_INTERVAL_MS = 10;

        const startCycle = () => {
            setMode('digit');
            const doFlick = () => {
                let s = '';
                for (let i = 0; i < len; i++) s += rand01();
                setCurrent(s);
            };
            doFlick();
            flickerId = window.setInterval(doFlick, FLICKER_INTERVAL_MS);

            settleId = window.setTimeout(() => {
                if (flickerId) clearInterval(flickerId);
                setCurrent(codeUp);
                setMode('word');
                settleId = window.setTimeout(
                    startCycle,
                    randMs(WAIT_MIN_S, WAIT_MAX_S)
                );
            }, randMs(FLICKER_MIN_S, FLICKER_MAX_S));
        };

        settleId = window.setTimeout(
            startCycle,
            randMs(WAIT_MIN_S, WAIT_MAX_S)
        );

        return () => {
            if (flickerId) clearInterval(flickerId);
            if (settleId) clearTimeout(settleId);
        };
    }, [codeUp, len]);

    // marquee scroll for tape rows
    useEffect(() => {
        const rail = railRef.current;
        const row = rowRef.current;
        if (!rail || !row) return;

        const prefersReduced =
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

        let W = 0;
        let offset = 0;
        let raf: number | null = null;
        let last = performance.now();
        let paused = false;

        const DRIFT = 15;
        const dir = reverse ? -1 : 1;

        const compute = () => {
            W = row.scrollWidth;
            const h = row.getBoundingClientRect().height;
            rail.style.height = `${h}px`;
            const vw = rail.clientWidth;
            setCloneCount(Math.max(3, Math.ceil(vw / (W || 1)) + 2));
        };

        const ro = new ResizeObserver(() => compute());
        ro.observe(row);

        const wrap = (px: number) => (!W ? px : ((px % W) + W) % W);

        const tick = (now: number) => {
            const dt = Math.max(0.001, (now - last) / 1000);
            last = now;

            if (!prefersReduced && !paused) {
                offset += dir * DRIFT * dt;
            }

            if (W > 0) {
                const rows = rail.querySelectorAll<HTMLElement>('.tape-row');
                const total = rows.length;
                const o = wrap(offset);
                for (let i = 0; i < total; i++) {
                    const baseX = (i - Math.floor(total / 2)) * W;
                    rows[i].style.transform = `translate3d(${baseX - o}px,0,0)`;
                }
            }
            raf = requestAnimationFrame(tick);
        };

        const onEnter = () => {
            paused = true;
        };
        const onLeave = () => {
            paused = false;
        };

        compute();
        raf = requestAnimationFrame(tick);

        rail.addEventListener('mouseenter', onEnter);
        rail.addEventListener('mouseleave', onLeave);
        window.addEventListener('resize', compute);

        return () => {
            if (raf) cancelAnimationFrame(raf);
            ro.disconnect();
            rail.removeEventListener('mouseenter', onEnter);
            rail.removeEventListener('mouseleave', onLeave);
            window.removeEventListener('resize', compute);
        };
    }, [reverse]);

    const Slashes = () => (
        <span className="tape-chunk" aria-hidden="true">
            {'/////////////////////////'}
        </span>
    );

    const Block = (i: number) => (
        <div className="tape-block" key={i}>
            <Slashes />
            <span className="tape-code tape-codeword" aria-hidden="true">
                {current.split('').map((ch, idx) => (
                    <span
                        className="tape-slot"
                        data-mode={mode === 'digit' ? 'digit' : 'word'}
                        key={idx}
                    >
                        {ch}
                    </span>
                ))}
            </span>
            <Slashes />
            <span className="tape-label">{label}</span>
        </div>
    );

    const BLOCKS_PER_ROW = 8;
    const blocks = Array.from({ length: BLOCKS_PER_ROW }, (_, i) => Block(i));

    return (
        <div className="tape">
            <div className="tape-rail" ref={railRef}>
                <div className="tape-row" ref={rowRef}>
                    {blocks}
                </div>
                {Array.from({ length: cloneCount }).map((_, i) => (
                    <div className="tape-row" aria-hidden="true" key={`clone-${i}`}>
                        {blocks}
                    </div>
                ))}
            </div>
        </div>
    );
}