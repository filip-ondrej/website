'use client';

import { useEffect } from 'react';

/**
 * Shared scroll lock for full-screen overlays (modals, lightboxes).
 *
 * Two jobs, both centralized here so individual overlays don't reinvent them:
 *   1. Lock the page behind the overlay (`body { overflow: hidden }`).
 *   2. Set `data-scroll-locked` on <html>, which the ProgressLine's global wheel
 *      handler checks to YIELD — that handler is non-passive and preventDefaults every
 *      wheel event to drive the custom "journey" scroll, which otherwise swallows an
 *      overlay's own scrolling. With this flag, overlays scroll natively and NO overlay
 *      needs per-element onWheel/stopPropagation guards anymore.
 *
 * Reference-counted so nested/stacked overlays don't unlock each other early.
 */
let lockCount = 0;
let savedOverflow = '';

function apply() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (lockCount > 0) {
        root.setAttribute('data-scroll-locked', '');
        document.body.style.overflow = 'hidden';
    } else {
        root.removeAttribute('data-scroll-locked');
        document.body.style.overflow = savedOverflow;
    }
}

export function useScrollLock(active: boolean) {
    useEffect(() => {
        if (!active) return;
        if (lockCount === 0) savedOverflow = document.body.style.overflow;
        lockCount += 1;
        apply();
        return () => {
            lockCount = Math.max(0, lockCount - 1);
            apply();
        };
    }, [active]);
}
