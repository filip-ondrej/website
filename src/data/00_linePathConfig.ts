// data/linePathConfig.ts

export type PathSegment = {
    from: string;
    to: string;
    type: 'vertical' | 'horizontal';
    sectionNumber: number;
    scrollMultiplier?: number;
};

export const linePathConfig: PathSegment[] = [

    // ============================================
    // SECTION 1: HERO
    // Simple vertical line down the left side
    // ============================================
    {
        from: 'hero-top',
        to: 'hero-bottom',
        type: 'vertical',
        sectionNumber: 1,
    },

    // Transition between sections (vertical)
    {
        from: 'hero-bottom',
        to: 'titlereveal-top',
        type: 'vertical',
        sectionNumber: 1,
    },

    // ============================================
    // SECTION 2: TITLE REVEAL PROMO VIDEO
    // Simple vertical line down the left side
    // ============================================
    {
        from: 'titlereveal-top',
        to: 'titlereveal-left',
        type: 'vertical',
        sectionNumber: 2,
    },

    {
        from: 'titlereveal-left',
        to: 'titlereveal-right',
        type: 'horizontal',
        sectionNumber: 2,
        scrollMultiplier: 10, // 10x slower = 10% speed
    },

    {
        from: 'titlereveal-right',
        to: 'titlereveal-below',
        type: 'vertical',
        sectionNumber: 2,

    },
    {
        from: 'titlereveal-below',
        to: 'titlereveal-bottom',
        type: 'vertical',
        sectionNumber: 2,

    },

    // Transition to projects section
    {
        from: 'titlereveal-bottom',
        to: 'promovideo-top',
        type: 'vertical',
        sectionNumber: 2,
    },
    // ============================================
    // SECTION 3: PROMO VIDEO
    // Simple vertical line down the left side
    // ============================================
    {
        from: 'promovideo-top',
        to: 'promovideo-bottom',
        type: 'vertical',
        sectionNumber: 3,
    },

    // Transition between sections (vertical)
    {
        from: 'promovideo-bottom',
        to: 'tt-start-right-top',
        type: 'vertical',
        sectionNumber: 3,
    },

    // ============================================
    // SECTION 4: TIMELINE TITLE
    // Enter RIGHT (from PromoVideo), cross R→L above the title, descend LEFT
    // ============================================
    // tt-start-right-top → tt-middle-right → tt-middle-left → tt-under-left → tt-bottom-left
    {
        from: 'tt-start-right-top',
        to: 'tt-middle-right',
        type: 'vertical',
        sectionNumber: 4,
    },

    // CROSS HORIZONTALLY from RIGHT to LEFT (SLOW SCROLL)
    {
        from: 'tt-middle-right',
        to: 'tt-middle-left',
        type: 'horizontal',
        sectionNumber: 4,
        scrollMultiplier: 10, // 10x slower = 10% speed
    },

    // Go down on LEFT side past the title
    {
        from: 'tt-middle-left',
        to: 'tt-under-left',
        type: 'vertical',
        sectionNumber: 4,
    },
    {
        from: 'tt-under-left',
        to: 'tt-bottom-left',
        type: 'vertical',
        sectionNumber: 4,
    },

    // Transition into the graph (stays LEFT)
    {
        from: 'tt-bottom-left',
        to: 'timeline-top',
        type: 'vertical',
        sectionNumber: 4,
    },

    // ============================================
    // SECTION 5: PROGRESS GRAPH
    // Enter LEFT, cross L→R above the chart, knee + exit down the RIGHT side
    // ============================================
    {
        from: 'timeline-top',
        to: 'timeline-left',
        type: 'vertical',
        sectionNumber: 5,
    },

    {
        from: 'timeline-left',
        to: 'timeline-right',
        type: 'horizontal',
        sectionNumber: 5,
        scrollMultiplier: 10, // 10x slower = 10% speed
    },

    // One straight descent to the section bottom (the old 'timeline-below' knee
    // waypoint was colinear — splitting here made the slow-zone bubble end at
    // the knee, which capped the sweep budget too low for the graph to clear
    // the fold by the corner; measured fit needs ~202px, see BUBBLE_HORIZ_BUDGET).
    {
        from: 'timeline-right',
        to: 'timeline-bottom',
        type: 'vertical',
        sectionNumber: 5,
    },

    // Transition to the project title (stays RIGHT)
    {
        from: 'timeline-bottom',
        to: 'pt-start-right-top',
        type: 'vertical',
        sectionNumber: 5,
    },

    // ============================================
    // SECTION 6: PROJECT TITLE
    // Enter RIGHT (from the graph), cross R→L above the title, descend LEFT
    // ============================================
    // pt-start-right-top → pt-middle-right → pt-middle-left → pt-under-left → pt-bottom-left
    {
        from: 'pt-start-right-top',
        to: 'pt-middle-right',
        type: 'vertical',
        sectionNumber: 6,
    },

    // CROSS HORIZONTALLY from RIGHT to LEFT (SLOW SCROLL)
    {
        from: 'pt-middle-right',
        to: 'pt-middle-left',
        type: 'horizontal',
        sectionNumber: 6,
        scrollMultiplier: 10, // 10x slower = 10% speed
    },

    // Go down on LEFT side past the title
    {
        from: 'pt-middle-left',
        to: 'pt-under-left',
        type: 'vertical',
        sectionNumber: 6,
    },
    {
        from: 'pt-under-left',
        to: 'pt-bottom-left',
        type: 'vertical',
        sectionNumber: 6,
    },

    // Transition into the projects grid
    {
        from: 'pt-bottom-left',
        to: 'projects-top',
        type: 'vertical',
        sectionNumber: 6,
    },

    // ============================================
    // SECTION 7: PROJECTS
    // Simple vertical line down the left side
    // ============================================
    {
        from: 'projects-top',
        to: 'projects-bottom',
        type: 'vertical',
        sectionNumber: 7,
    },

    // Transition to collaborations (vertical, stays LEFT — ct-start-left-top unchanged)
    {
        from: 'projects-bottom',
        to: 'ct-start-left-top',
        type: 'vertical',
        sectionNumber: 7,
    },

    // ============================================
    // SECTION 4: TIMELINE TITLE
    // This creates the horizontal crossings
    // ============================================
    //tt-start-right-top → tt-middle-right → tt-middle-left → tt-under-left → tt-bottom-left
    // 1. Enter and go down on LEFT side
    {
        from: 'ct-start-left-top',
        to: 'ct-middle-left',
        type: 'vertical',
        sectionNumber: 8,
    },

    // 2. CROSS HORIZONTALLY from LEFT to RIGHT (SLOW SCROLL)
    {
        from: 'ct-middle-left',
        to: 'ct-middle-right',
        type: 'horizontal',
        sectionNumber: 8,
        scrollMultiplier: 10, // 10x slower = 10% speed
    },

    // 3. Go down on RIGHT side
    {
        from: 'ct-middle-right',
        to: 'ct-under-right',
        type: 'vertical',
        sectionNumber: 8,
    },

    // 4. CROSS HORIZONTALLY from RIGHT to LEFT (SLOW SCROLL)
    {
        from: 'ct-under-right',
        to: 'ct-bottom-right',
        type: 'vertical',
        sectionNumber: 8,
    },

    // // 5. Go down on LEFT side
    // {
    //     from: 'ct-bottom-right',
    //     to: 'prt-start-right-top',
    //     type: 'vertical',
    //     sectionNumber: 8,
    // },



    // ============================================
    // SECTION 4: TIMELINE TITLE
    // This creates the horizontal crossings
    // ============================================
    //tt-start-right-top → tt-middle-right → tt-middle-left → tt-under-left → tt-bottom-left
    // 1. Enter and go down on LEFT side
    {
        from: 'prt-start-right-top',
        to: 'prt-middle-right',
        type: 'vertical',
        sectionNumber: 9,
    },

    // 2. CROSS HORIZONTALLY from LEFT to RIGHT (SLOW SCROLL)
    {
        from: 'prt-middle-right',
        to: 'prt-middle-left',
        type: 'horizontal',
        sectionNumber: 9,
        scrollMultiplier: 10, // 10x slower = 10% speed
    },

    // 3. Go down on RIGHT side
    {
        from: 'prt-middle-left',
        to: 'prt-under-left',
        type: 'vertical',
        sectionNumber: 9,
    },

    // 4. CROSS HORIZONTALLY from RIGHT to LEFT (SLOW SCROLL)
    {
        from: 'prt-under-left',
        to: 'prt-bottom-left',
        type: 'vertical',
        sectionNumber: 9,
    },

    // 5. Go down on LEFT side
    {
        from: 'prt-bottom-left',
        to: 'recognition-start-left-top',
        type: 'vertical',
        sectionNumber: 9,
    },
    // ============================================
    // SECTION 4: TIMELINE TITLE
    // This creates the horizontal crossings
    // ============================================
    //tt-start-right-top → tt-middle-right → tt-middle-left → tt-under-left → tt-bottom-left
    // 1. Enter and go down on LEFT side
    {
        from: 'recognition-start-left-top',
        to: 'recognition-bottom-left',
        type: 'vertical',
        sectionNumber: 10,
    },

    // 2. CROSS HORIZONTALLY from LEFT to RIGHT (SLOW SCROLL)
    {
        from: 'recognition-bottom-left',
        to: 'recognition-bottom-right',
        type: 'horizontal',
        sectionNumber: 10,
        scrollMultiplier: 10, // 10x slower = 10% speed
    },

    // 3. Go down on RIGHT side
    {
        from: 'recognition-bottom-right',
        to: 'recognition-under-right',
        type: 'vertical',
        sectionNumber: 10,
    },

    // 4. CROSS HORIZONTALLY from RIGHT to LEFT (SLOW SCROLL)

    // 5. Go down on LEFT side
    {
        from: 'recognition-under-right',
        to: 'cft-start-right-top',
        type: 'vertical',
        sectionNumber: 10,
    },

    // ============================================
    // SECTION 4: TIMELINE TITLE
    // This creates the horizontal crossings
    // ============================================
    //tt-start-right-top → tt-middle-right → tt-middle-left → tt-under-left → tt-bottom-left
    // 1. Enter and go down on LEFT side
    {
        from: 'cft-start-right-top',
        to: 'cft-middle-right',
        type: 'vertical',
        sectionNumber: 11,
    },

    // 2. CROSS HORIZONTALLY from LEFT to RIGHT (SLOW SCROLL)
    {
        from: 'cft-middle-right',
        to: 'cft-middle-left',
        type: 'horizontal',
        sectionNumber: 11,
        scrollMultiplier: 10, // 10x slower = 10% speed
    },

    // 3. Go down on RIGHT side
    {
        from: 'cft-middle-left',
        to: 'cft-under-left',
        type: 'vertical',
        sectionNumber: 11,
    },

    // 4. CROSS HORIZONTALLY from RIGHT to LEFT (SLOW SCROLL)
    {
        from: 'cft-under-left',
        to: 'cft-bottom-left',
        type: 'vertical',
        sectionNumber: 11,
    },

    // 5. Go down on LEFT side
    {
        from: 'cft-bottom-left',
        to: 'footer-start-left',
        type: 'vertical',
        sectionNumber: 11,
    },

    // ============================================
    // SECTION 1: HERO
    // Simple vertical line down the left side
    // ============================================
    {
        from: 'footer-start-left',
        to: 'footer-end-left',
        type: 'vertical',
        sectionNumber: 12,
    },
];