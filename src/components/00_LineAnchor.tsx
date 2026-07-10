'use client';

import { useEffect, useRef } from 'react';

interface LineAnchorProps {
    id: string;
    position?: 'left' | 'center' | 'right';
    offsetX?: number; // Offset from viewport edge (not container edge!)
    offsetY?: number;
}

export function LineAnchor({
                               id,
                               position = 'left',
                               offsetX = 0,
                               offsetY = 0
                           }: LineAnchorProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updatePosition = () => {
            if (!ref.current) return;

            const rect = ref.current.getBoundingClientRect();
            const scrollY = window.scrollY;

            // Scale the edge offset using the MINIMUM of two laws, which cross at
            // the 1440px design reference (both = 1.0):
            //   • width law (innerWidth/1440): dominates BELOW 1440, so the spine
            //     keeps shrinking on small screens (~half its inset at 500px),
            //     staying just outside the content gutter.
            //   • root-font law (rootFont/16): dominates ABOVE 1440, matching the
            //     6.25rem gutter/cage cap so the spine doesn't overshoot the
            //     footer/press cage lines (which compute the same min internally).
            // offsetX is the value at 1440px. Clamped so it never hugs the edge on
            // phones or drifts too far on huge displays.
            const REF_WIDTH = 1440;
            const rootFontPx =
                parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            const widthScale = window.innerWidth / REF_WIDTH;
            const fontScale = rootFontPx / 16;
            const uiScale = Math.min(1.6, Math.max(0.18, Math.min(widthScale, fontScale)));
            const scaledOffsetX = offsetX * uiScale;

            // Calculate X position relative to VIEWPORT, not container
            let x: number;

            if (position === 'left') {
                // Left edge of viewport + offset
                x = scaledOffsetX;
            } else if (position === 'center') {
                // Center of viewport + offset
                x = window.innerWidth / 2 + scaledOffsetX;
            } else if (position === 'right') {
                // Right edge of viewport - offset
                x = window.innerWidth - scaledOffsetX;
            } else {
                x = scaledOffsetX;
            }

            // Y position is based on where the anchor element actually is
            const y = rect.top + scrollY + offsetY;

            // CRITICAL: Round to prevent subpixel rendering issues
            // Without this, 4px lines appear as 1-2px at certain decimal positions
            const roundedX = Math.round(x);
            const roundedY = Math.round(y);

            // Store in global registry
            if (typeof window !== 'undefined') {
                window.lineAnchors = window.lineAnchors || {};
                window.lineAnchors[id] = { x: roundedX, y: roundedY };

                // Trigger path recalculation
                window.dispatchEvent(new CustomEvent('anchors-updated'));
            }
        };

        // Initial position + updates
        const timer = setTimeout(updatePosition, 50);
        updatePosition();

        window.addEventListener('resize', updatePosition);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updatePosition);
        };
    }, [id, position, offsetX, offsetY]);

    return (
        <div
            ref={ref}
            data-line-anchor={id}
            className="absolute pointer-events-none"
            style={{
                width: '1px',
                height: '1px',
                // Uncomment to debug anchor positions:
                // background: 'red',
                // width: '8px',
                // height: '8px',
                // borderRadius: '50%',
                // zIndex: 9999,
            }}
        />
    );
}

// TypeScript global declaration
declare global {
    interface Window {
        lineAnchors?: Record<string, { x: number; y: number }>;
    }
}