# filipondrej.com — Style Guide & Design Language

The definitive reference for what this site looks like, moves like, and refuses to do.
Handoffs (`PROJECT_HANDOFF_V*.md`) track *state*; this file tracks *identity*. When a new
element doesn't know what to be, it finds its answer here.

---

## 1. Identity

**Dark, calm, engineered.** A robotics engineer's portfolio that proves competence by
behaving like a well-built machine: nothing jitters, nothing is decoration without a
system behind it, every animation has a reason and an easing. The audience is YC/EF
recruiters and investors — substance over polish, let the work speak, numbers over
adjectives.

**The core metaphor: the journey is one continuous line.** A single white line enters at
the top of the page and travels — through titles, around the achievement graph, past the
projects — to the very bottom. Sections don't float in space; they are stations the line
visits. Everything else in the language (indices, tapes, portals, dots) is infrastructure
around that line.

---

## 2. The Sacred Line (ProgressLine)

- **One line, top → bottom, never cut.** Only *portals* may interrupt it: at designed
  gaps the last 14px dissolve to transparent and the line re-emerges — the rounded cap
  must never be visible. No sockets, no caps, no ornaments at the break.
- The tip is **pixel-locked to scroll** in the same paint (imperative draw, no React lag).
- On horizontal runs (crossings above titles/graph) the page **slows** to focus
  attention — 1px of wheel input always equals 1px of drawn path.
- Crossings **alternate left/right** down the whole page. New sections must preserve the
  alternation.
- **Never add scroll-snap. Never break the anchors.**

## 3. Color

| Role | Value | Notes |
|---|---|---|
| Page black | `#050505` / `#000` | Sections are PURE black — no gray washes, no subtle white gradients on section backgrounds |
| Text ladder | `#fff` → `rgba(255,255,255,.9 / .75 / .6 / .5 / .32)` | Hierarchy comes from opacity, not from new colors |
| Hairlines | `rgba(255,255,255,0.1)` (≈0.08–0.15) | 1px everywhere: borders, rules, cages |
| **Site gold** | `linear-gradient(135deg, #FEF3C7 0%, #FDE047 25%, #FFD60A 50%, #F59E0B 75%, #B45309 100%)` | Warm amber ramp, usually clipped to text. Solid-color uses: `rgba(255,214,10,…)` / `#F59E0B` |
| Impact scale | graph legend colors (Lesson→Exceptional) | Data coloring lives only in the graph + achievement modals |

**Gold is earned.** It marks wins, invitations, and "you are here": `EVERY WIN.`,
`READY` in the contact title, COLLABORATE/CV accents, active nav index, locked graph
year. Never use it as generic decoration, and **never** pure web-yellow
`rgb(255,215,0)` — always the amber ramp.

## 4. Typography

- **One face: Rajdhani** (400/600/700), monospace fallback. Font unification pass comes
  last; until then all new work uses Rajdhani.
- **Labels are uppercase with wide tracking** (`letter-spacing: 0.08–0.2em`), tiny
  (9–11px @1440). Body text is sentence case, `1.6–1.75` line-height.
- **Type sizes in rem** — the root font scales with viewport width
  (`clamp(0.6875rem, 0.25rem + 0.833vw, 1.375rem)` → 16px @1440, clamped 11–22px).
  Never raw `vw` per element (staggered lock-points), **never coupled to viewport
  height** (`vh`, `vmin`) for *page* type. Inside modals, `vmin` clamps are the law
  instead (the modal is a square scaled by `min(90vmin, 900px)`).
- Section header titles share one formula (~95px @1440, `scale` prop 0.785); Hero and
  TitleReveal deliberately differ (see the size map in V3). Don't invent new title sizes.

## 5. Layout Systems

- **Reference viewport: 1440×900 logical.** Every responsive change must be a **no-op
  at 1440** — the site is hand-tuned there.
- **The gutter**: `--gutter: clamp(2rem, 8.5vw, 6.25rem)` = content edge (100px @1440).
  Chrome (nav, footer bar) and section content align to it.
- **Spine-x mirror**: the CSS mirror of the line's inset is
  `clamp(18px, min(6.944vw, 6.25rem), 160px)` — used by title gaps and tunnels.
- **Gap law**: the vertical gap from a horizontal line-run down to a title equals the
  title's horizontal inset from the vertical spine. Symmetry is the point.
- **Bounded Journey rhythm**: compact lead-in → content → *smaller* trailing space.
  The next section may peek on tall screens.
- **Modals are squares**: `min(90vmin, 900px)`, everything inside scaled with `vmin`
  clamps, one centered ~550px story column, sticky 3-column header (context chip /
  section dots / close). All three modals share this skeleton — don't fork it.

## 6. Signature Elements (what makes it *this* site)

1. **Section indices** — `[00] Introduction`, `01 WORK … 05 COLLABORATE`, `01 SUMMARY`.
   Everything is numbered like a schematic. Active/current index turns gold.
2. **The tape** — thin marquee strips with `/////////` slash runs, binary flicker codes,
   tiny uppercase labels, 1px top/bottom borders. Slashes double as separators elsewhere
   (nav). The flicker language: characters flip to random 0/1, then settle — in the nav
   it *waves* left→right (30ms/char stagger, ~500ms per char).
3. **Typewriter titles** — scroll-driven character reveal with a block cursor
   (TimelineTitle, ContactTitle). Cursor takes zero layout width.
4. **Portal fades** — the line's only permitted interruption (14px dissolve).
5. **The graph** — dots colored by impact, expanding years, collision-avoided labels;
   the crown jewel. Its dot language leaks outward deliberately: nav section dots,
   footer year strip, modal section dots.
6. **Corner glyph** — clickable tiles get the bracket + arrow glyph in the corner.
   **Graph-dot rule: only story-backed things are interactive** — if there's nothing
   behind it, it gets no pointer cursor, no glyph, no hover invitation.
7. **Cage lines** — the footer's 1px construction lines (`cage-v/l/r/h`) that run to
   the browser edge. Structure shown, not hidden.
8. **`//` prefixes** on sub-headings (story h3), `/` dividers between meta chips
   (`INTERNSHIP / 2023 / HAMBURG`).
9. **Hairline everything** — 1px rules define regions; solid fills are rare and black.

## 7. Motion Rules

- **The easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out, slightly overshooting
  calm). Durations 0.3–0.6s. Nothing bounces forever — one-shot animations (the modal
  scroll arrow bounces *once*, replays on hover).
- **Reveals**: `opacity 0 → 1` + `translateY(40px) → 0` on scroll into view
  (IntersectionObserver, threshold ~0.05).
- **Scroll drives, autoplay doesn't.** Typewriters, line drawing, graph focus — all
  scroll-coupled. Ambient motion (tape drift, slideshow advance) is slow, pausable on
  hover, and only runs in-view.
- **Flicker is the glitch accent** — used sparingly: tape codes on a random 4–8s cycle,
  nav labels on hover. 10–35ms randomize cadence, ~500ms duration, fixed-width slots so
  layout never shifts.
- **`prefers-reduced-motion` is always honored** — CSS *and* JS-driven motion
  (`matchMedia` short-circuit: render final state, no typing, no flicker).
- Hover effects change color/opacity/border — transforms are small (≤3px lifts, ≤1.09
  scale) and never move layout.

## 8. Interaction Rules

- **Scroll is the product.** The wheel engine glides stepped mice, keeps trackpads
  instant, and adopts external scrolls exactly. Nothing may fight it: overlays use the
  shared `useScrollLock` (body overflow hidden + `data-scroll-locked`), never
  `position:fixed` body hacks.
- **Focus without rectangles**: the owner hates default focus boxes. Use
  `:focus-visible` (keyboard-only) with custom outlines (1px white, offset) or reuse the
  element's own hover/expansion state as the indicator.
- **Esc closes, arrows navigate** in every modal; Tab is trapped inside dialogs.
- Group-hover recede: when exploring a link group, siblings dim (~0.28) and the hovered
  item holds full strength.

## 9. Content Voice

- Labels: `THE STAKES`, `FULL DETAILS`, `IMPACT SCALE` — short, uppercase, technical.
- Claims are **numbers-backed**; third-party validation (quotes from judges, press)
  beats self-praise.
- Story markdown: h2 chapters with arrow markers, `//` h3s, bold for load-bearing
  phrases, blockquotes for external voices, media embedded via markdown image syntax
  (one convention for pictures and videos).
- Placeholders are styled, complete, and **never render broken** — a missing image gets
  an empty-state, not a broken frame.

## 10. Hard Rules (never break)

1. The line is sacred — never cut it; only portals; the cap never shows.
2. No scroll-snap, anywhere, ever.
3. Every responsive change is a no-op at 1440×900.
4. Page type scales in rem with width only; modal type in vmin clamps.
5. Gold = the amber ramp, used for earned moments only.
6. Section backgrounds are pure black — no gray washes.
7. Interactive affordances only on things that actually open something.
8. All motion respects `prefers-reduced-motion`.
9. Mobile is a dedicated later pass — don't half-fix it inside desktop work.
10. Design changes: diagnose → propose → **agree on the picture** → build.
