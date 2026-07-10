# Project handoff V3 — Filip Ondrej portfolio (per-section design passes)

Give this file (plus the codebase) to a fresh chat instead of replaying the whole
conversation. It captures the non-obvious decisions, the working method, and the
gotchas learned the hard way. **Supersedes `PROJECT_HANDOFF_V2.md` (and V1).**

---

## What this is
- Personal portfolio: `filipondrej-site/frontend` — **Next.js 15 (App Router) + Tailwind v4 + styled-jsx**, TypeScript.
- **Primary audience: YC / Entrepreneur First recruiters & investors** (also collaborators, press). Substance over polish; let the work speak.
- **Design reference width = 1440px logical** (owner's 2880×1800 Retina @2x → 1440×900 logical). The site is tuned to look right at 1440 — **every responsive change must be a no-op at 1440.**
- Dev: `npm run dev` — **the owner runs it; don't start your own server.** Prod: `next build` + `serve out` = **static export**, so next/image optimization is OFF (raw PNGs ship — relevant for load perf, and for hydration: see the spine fix below).
- **Not a git repo.** Don't run builds unless asked.

## Two phases
1. **Responsive scaling foundation — DONE & verified.**
2. **Per-section design passes — IN PROGRESS. Desktop first** (owner: mobile gets a full layout redo as a later step — don't sink time into mobile now).

## The scaling system (rules to follow)
In `src/app/globals.css`:
- **Fluid root font:** `html { font-size: clamp(0.6875rem, 0.25rem + 0.833vw, 1.375rem) }` → 16px @1440, clamped **[11px, 22px]**. **The engine is WIDTH-driven.** All `rem` scale with viewport width. The width-scale factor used all over is **`rootFont/16`** (range 0.6875–1.375).
- **`--gutter: clamp(2rem, 8.5vw, 6.25rem)`** = content-edge inset (100px @1440).
- **The "progressline" spine** scales its edge offset by `min(innerWidth/1440, rootFont/16)`, clamped [0.18, 1.6]. The CSS mirror of that x-position (used in title gaps + tunnels) is **`clamp(18px, min(6.944vw, 6.25rem), 160px)`** (= 100px @1440). `6.944vw = 100/14.4`, `6.25rem = 100·(rootFont/16)`.
- **Conversion @1440:** 1rem=16px, 1vw=14.4px.

**The ProgressLine is "the journey":** one continuous line top→bottom; on horizontal runs it slows scroll to focus attention. **Never add scroll-snap; never break its anchors.**

**"Bounded Journey" vertical rhythm:** sections are content-driven (compact lead-in + content + small trailing), trailing **smaller** than lead-in. Next section may peek on tall screens.

### ⚠️ Type-scaling laws
- **Size type in `rem`, not raw `vw`** (per-element px lock-points freeze at different widths → staggered scaling).
- **Never couple type size to viewport HEIGHT** (`vh`/`min(vw,vh)`) — type must react to width only. (Layout *spacing* may use vh; type must not.)

### ⚠️⚠️ CRITICAL gotcha #1: anchors measure on MOUNT — keep layout-critical sizing INLINE
`00_LineAnchor` reads each anchor's document position with `getBoundingClientRect()` once on mount (+50ms timer + on `resize`); `00_ProgressLine` rebuilds the path on `anchors-updated`. So **any CSS that determines a section's height/anchor positions must exist at first paint** — set section height + its driving custom props as **INLINE styles** (present in SSR HTML), not dynamically-interpolated styled-jsx (applies a frame late → section collapses → spine draws above/through it).

### ⚠️⚠️ CRITICAL gotcha #2 (NEW this session): late layout shifts desync the spine — now fixed globally
Because anchors only re-measure on mount/+50ms/`resize`, **anything that shifts layout *after* that window leaves the spine built from stale positions until the user resizes** — web-font swap (Rajdhani loads late), images decoding (logos/press photos), fluid section heights settling. Symptom: on refresh at an off-1440 size, the spine runs long / a horizontal run cuts through the next section's title, and "fixes itself" on any resize.
**FIX (in `00_ProgressLine.tsx`):** a `ResizeObserver` on `document.body` + `document.fonts.ready` + `window 'load'` each nudge a `resize` (rAF-debounced, guarded by a ≥1px height delta to avoid RO loops). All anchors re-measure on any layout settle → spine self-heals. **If you add anything that changes document height after load, you no longer need a per-section nudge — the global observer covers it.**

## Key files
- `src/app/page.tsx` — section order. `src/app/layout.tsx` — sticky header, `ProgressLine`, `LoadingAnimation` wrapper, `ContactFooter`.
- Title headers (all share the SAME font formula + gap law — see below): `01_Hero`, `02_TitleReveal`, `03_TimelineTitle`, `04_ProjectTitle`, `05_CollaborationTitle`, `08_PressRecognitionTitle`, `09_ContactTitle`.
- Content sections: `02_PromoVideo`, `03_ProgressTimeline` (+ `AchievementModal`, `src/data/graphData.ts`, `src/lib/loadAchievement.ts`), `04_Projects`, `05_Collaborations` (+ `CollaborationModal`), `08_PressRecognition`, `09_ContactFooter` (rendered in layout, not page.tsx).
- Spine: `00_LineAnchor` (anchors), `00_ProgressLine` (renderer + scroll bubbles + the NEW global re-measure observer). Path config: `src/data/00_linePathConfig.ts`, builder `src/lib/00_generateDynamicPath.ts`.
- **NEW shared module:** `src/lib/titleTypewriter.ts` — `useScrollProgress(ref, frozen)` + `useChasingTypewriter` shared by the two typewriter titles (§4, §12).
- **DEAD — do not edit:** `src/styles/progresstimeline.css`, `src/styles/collaborations.css`, `*Original*.tsx`. `09_ContactFooter` IS live (via layout).

## How to work (owner's process — important)
- **Diagnose → propose → wait for go → change.** For each section: read it, report findings + concrete options, change nothing until the owner picks. Acting too fast / on the wrong axis caused real breakage and rework. **For global/spine changes especially, propose first.**
- **Verify at 1440 first** — it's the reference; don't change its look without flagging.
- Make changes → owner reviews live → iterate. Use `frontend/RESPONSIVE_QA.md`.
- **Don't bikeshed ±1px.**

---

## ⭐ The title-header system (UNIFIED this session — applies to §2/§4/§6/§8/§10/§12)
All header titles now share one model. When touching any title, keep them consistent.

**Font size:** `--X-size: calc(var(--X-scale) * clamp(64px, 8.4cqi, 160px))` with a `@supports not (1cqi)` `vw` fallback. `--X-scale` is **prop-driven inline** (`scale` prop, default **0.785**) → **~95px @1440** for the 5 spine headers (was 0.8/96.8px; owner found that a touch big). *(Note: the `cqi`+px-lockpoint pattern is the not-fully-ideal one flagged for the final font-unification pass; but all 5 headers share it so they scale together.)*

**⚠️ Dead-prop gotcha (fixed this session):** the `.X-title` CSS rule used to hardcode `--X-scale: 0.8` and `--X-left/right`, which **override the inline prop-driven values** (a CSS custom property set on the element wins over an inherited one). That made the `scale`/`leftOffsetPx`/`rightOffsetPx` props silently dead. Fixed by removing the hardcodes so the inline props actually drive. If you re-add a hardcoded `--X-*` in the title rule, you'll re-break the prop.

**Line→title gap law (NEW):** the gap from the spine's horizontal run down to the title top now **equals the title's inset from the vertical spine**, and both scale with width. Mechanism (all inline):
```
--X-spine-x: clamp(18px, min(6.944vw, 6.25rem), 160px);   // mirrors the spine's x
--X-gap:     calc(var(--X-left) - var(--X-spine-x));        // left-aligned titles
--X-gap:     calc(var(--X-right) - var(--X-spine-x));       // §8 Collaboration (right-aligned)
--X-under:   calc(var(--X-lead) + var(--X-gap));
```
= 100px @1440 (no-op); shrinks with the title below that. The lead-in (`--X-lead`, vh-based) and trailing are unchanged (owner likes that spacing).

**Tunnel dedupe:** §8/§10 tunnel SVGs reference `var(--ct-spine-x)`/`var(--prt-spine-x)` (was a duplicated `6.94vw` literal).

**Title size map (@1440), for the eventual font-unification pass:**
| Section | Lines | Size @1440 |
|---|---|---|
| §1 Hero | 3-line headline / sub | **89.6px** (5.6rem) / 22px (1.375rem) — *deliberately smaller so white type doesn't blow out the photo; leave it* |
| §2 TitleReveal | 3 lines | **79.5 / 159 / 79.5px** (1.15×4.32rem / 1.15×8.64rem) — *intentional dramatic reveal; leave it* |
| §4/§6/§8/§10/§12 | header titles | **~95px** (0.785 × clamp(64px,8.4cqi,160px)) — *pixel-identical to each other* |

**§4 TimelineTitle & §12 ContactTitle are typewriters** (scroll-driven, JS). Both: reduced-motion short-circuit (JS `matchMedia` → render fully, no typing, no cursor — the CSS `@media` can't disable JS motion), the `frozen` flag freezes the scroll listener once complete (stops wasted re-renders), and they share `src/lib/titleTypewriter.ts`. §12 content is now **2 lines: "LET'S WORK" / "TOGETHER"** and its rendering maps over `lines` (was hardcoded to 3).

---

## §4/§5 ProgressTimeline (`03_ProgressTimeline.tsx`) — MOSTLY DONE; keyboard + polish pending
The most complex component on the site. SVG chart: X = years 2016–2026 (11 cols), Y = "Progress Level" 0–6, ~50 events (`graphData.ts`) as impact-colored dots on a path line, 3 chapter dividers. Hover a year → it expands ~4.2× (rAF width anim) revealing month ticks; click → locks; focused-year dots get collision-avoided labels; a dot with an `article` opens `AchievementModal`. Controls row: info/hint, Show-All↔Key-Milestones toggle, impact legend.

**Scaling architecture (important):** the SVG renders **~1:1 with screen px** (`viewBox` width = container width, `width=100%`), so X-columns **reflow** to fill width and hit-testing maps cleanly. This was deliberately preserved.

Done this session, in phases:
- **Phase A — cleanup (no visual change):** removed dead `selectedEvent` state, dead constants `HEADER_SPACE`/`CONTROL_STRIP_HEIGHT`, dead CSS (`.tl-header-gold`+`goldShimmer`, `.tl-current-marker`, `.tl-dot-label-box`*+`tlLabelSlideUp/Down`, `.tl-wrap:focus-visible`), tidied `FIX` comments.
- **Phase C — fluid height (hybrid):** `useFluidGraphHeight()` — `base = 650 × rootFont/16`, capped `min(base, max(650, 0.78·vh))`, bounds [480,920], **fallback 650 (no-op @1440, SSR-safe, no hydration mismatch)**. The `height` prop is now an optional fixed override. The spine **knee** (`timeline-below`) is proportional: `25 + height×(300/650)` (= 325 @650). Height recomputes on `resize` (same signal the anchors use) so they stay in lockstep.
- **Phase B — fluid type + dots:** `useRootScale()` → `uiScale = rootFont/16`. SVG **static** interior text → `rem`; **measured** dot labels + year labels + **dot radii** → `× uiScale`; `getTextDimensions(text, fontPx)` parameterized so label boxes match the scaled font. No-op @1440. Hit-area scales up but never below 12px.
- **Phase D — reduced-motion:** added `.tl-year-lock-hint` + `.tl-label-entrance` to the reduced-motion block.

**STILL PENDING on ProgressTimeline (pick up next session):**
- **Phase D — keyboard a11y (NOT done; decision was pending).** The graph is mouse-only (year hover/expand/lock + dot→achievement via SVG mouse handlers; no `tabIndex`/`role`/keyboard). Recommended scope: **"Year navigation"** — container focusable, **←/→** move+expand year, **Enter/Space** lock, **Esc** clear. **OWNER CONSTRAINT: hates the default focus rectangle.** Solve with `:focus-visible` (keyboard-only, never on mouse) + reuse the **year's own expansion/glow as the focus indicator** (no box). "Full parity" option would also make dots focusable + Enter to open achievements.
- **Phase B deferred polish:** structural Y-offsets below the axis (month label +18, year +36, lock hint +50, level −3) and label-box paddings are **still fixed px** — at extreme scales text may crowd slightly (no-op @1440). The two HTML chrome bits (`.tl-info-btn` glyph 13px, `.tl-hint` tooltip 12px) are still fixed px.
- Untouched & working: X-axis reflow, hit-testing, year-expansion rAF animation.

---

## Per-section status
- **§0 Global chrome:** fluid engine/gutter/spine-law done & audited. Loader done. **Spine global re-measure observer added (gotcha #2).** Header/spine/loader polish pass still pending (end).
- **§1 Hero:** desktop done (content + scaling). Mobile reflow pending (later).
- **§2 TitleReveal:** done (incl. gap law).
- **§3 PromoVideo:** done (desktop, incl. a11y).
- **§4 TimelineTitle:** done (typewriter, gap law, sizing, cleanup).
- **§4/§5 ProgressTimeline graph:** Phases A/B/C + reduced-motion done; **keyboard + Phase-B polish pending** (above).
- **§6 ProjectTitle:** done (gap law, sizing, cleanup).
- **§8 CollaborationTitle:** done (right-aligned gap law, tunnel dedupe, sizing, cleanup).
- **§10 PressRecognitionTitle:** done (gap law, tunnel dedupe, sizing, cleanup).
- **§12 ContactTitle:** done (typewriter + reduced-motion, 2-line content, gap law, sizing, cleanup).

## TODO (remaining) — per-section passes, ONE at a time, owner reviews each
- **ProgressTimeline:** keyboard a11y + Phase-B polish (above).
- **§7 Projects + lightbox** · **§9 Collaborations + modal** · **§11 PressRecognition + video** · **§13 ContactFooter** · **§0 global chrome polish** (header uses `.container` max-width 1120px — a different inset system than the gutter; ContactFooter 2-col→1-col breakpoint stays 1024px).

**⭐ FONT-SIZE UNIFICATION (do at the very END):** define one shared type scale (the `--font-*` tokens in `globals.css` can become it) and apply across all sections. Fold in: the title `cqi` formula (→ a clean rem scale), the title size map above, the ProgressTimeline HTML-chrome px, and the deferred Phase-B structural offsets.

**Mobile/portrait:** owner plans a full layout redo as a dedicated later step — don't pre-optimize mobile during desktop passes.
