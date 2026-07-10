// Shared hooks for the scroll-driven "typewriter" title headers (§4 TimelineTitle,
// §12 ContactTitle). These were copy-pasted identically in both components; this is
// the single source of truth.

import * as React from 'react';

/**
 * Maps the section's scroll position to a 0→1 progress value and reports a paused
 * state when the user stops scrolling mid-section. Pass `frozen` to tear down the
 * listeners once typing is locked-complete (or reduced motion forces the title
 * full) — there's no point re-rendering on every scroll frame after that.
 */
export function useScrollProgress(
    ref: React.RefObject<HTMLElement | null>,
    frozen = false,
) {
    const [progress, setProgress] = React.useState(0);
    const [isPaused, setIsPaused] = React.useState(false);
    const lastProgress = React.useRef(0);
    const lastChangeAt = React.useRef<number>(Date.now());

    React.useEffect(() => {
        const el = ref.current;
        // Once frozen, stop ticking — listeners are torn down and `progress` holds.
        if (!el || frozen) return;

        let rafId: number | null = null;

        const tick = () => {
            const rect = el.getBoundingClientRect();
            const vh = window.innerHeight || 1;
            const start = vh - 150;
            const end = vh * 0.4;
            const p = 1 - Math.max(0, Math.min(1, (rect.top - end) / (start - end)));
            setProgress(p);

            const diff = Math.abs(p - lastProgress.current);
            if (diff > 0.005) {
                lastChangeAt.current = Date.now();
                setIsPaused(false);
            } else if (p > 0.01 && p < 0.99) {
                if (Date.now() - lastChangeAt.current > 500) setIsPaused(true);
            }
            lastProgress.current = p;
            rafId = null;
        };

        const onScroll = () => {
            if (rafId != null) return;
            rafId = requestAnimationFrame(tick);
        };

        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });

        const intervalId = window.setInterval(() => {
            const p = lastProgress.current;
            if (p > 0.01 && p < 0.99 && Date.now() - lastChangeAt.current > 500) setIsPaused(true);
        }, 120);

        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            window.clearInterval(intervalId);
        };
    }, [ref, frozen]);

    return { progress, isPaused };
}

/**
 * Animates a character count toward `targetChars`, "chasing" the target in both
 * directions (types forward, deletes back) so it tracks scroll up/down. Pass
 * `lockTo` to drive it to a fixed value (e.g. fully typed once complete).
 */
export function useChasingTypewriter(targetChars: number, charDelay = 50, lockTo?: number) {
    const [count, setCount] = React.useState(0);

    React.useEffect(() => {
        const desired = typeof lockTo === 'number' ? lockTo : targetChars;
        if (count === desired) return;

        const typing = desired > count;
        const delay = typing ? charDelay : charDelay / 2;

        const id = window.setInterval(() => {
            setCount(cur => {
                if (typing) {
                    const next = cur + 1;
                    return next >= desired ? desired : next;
                } else {
                    const next = cur - 1;
                    return next <= desired ? desired : next;
                }
            });
        }, delay);

        return () => window.clearInterval(id);
    }, [targetChars, charDelay, count, lockTo]);

    return count;
}
