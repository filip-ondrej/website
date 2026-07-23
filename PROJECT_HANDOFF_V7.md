# Project handoff V7 — reorder revert, scroll engine 2.0, contact polish, section 7 REJECTED

Read **V3 for global rules** (scaling engine, spine law, title system), V6 for the perf
pass and modal-lock rationale. This V7 documents one long session: the **section-order
revert**, a **complete ProgressLine scroll-engine overhaul** (the big work), scroll-lock
unification, collaborations content gating, ContactFooter/Title finishing, and a
**failed first attempt at section 7** (circuit board — owner rated it 4/10, redesign
required). Everything in V3–V6 still stands unless contradicted here.

Owner decision this session: **MACHINE FIRST, CONTENT LATER.** Build mechanisms +
styled placeholders; he supplies real copy/media before launch. Don't push content work.

---

## 1. Section order REVERTED (undo of V6 §1)

Order is back to: Hero → TitleReveal → PromoVideo → **TimelineTitle → ProgressTimeline
→ ProjectTitle → Projects** → CollaborationTitle → … Reason: with Projects first, the
graph's slow-zone crossing happened too low in the viewport and cut the chart. The V6
mirror was fully unwound (tt left-aligned again, `leftOffsetPx`, anchors
`tt-start-right-top/…/tt-bottom-left`; graph enters LEFT exits RIGHT; Y-axis labels back
on the left; controls padding-left removed). Skim-access to projects will come from the
future top nav (roadmap). All V6 perf fixes survive.

## 2. ⭐⭐ ProgressLine scroll engine 2.0 (00_ProgressLine.tsx) — the core work

Owner rates the engine ~9.5 now. In order of architectural importance:

1. **Imperative tip (the big unlock):** `tipY`/`runtime` React state is GONE. All paths
   mount once (hidden); `drawFrame()` writes `display` + dash attrs straight to the DOM
   from the rAF (pre-paint). The tip is pixel-locked to the scroll in the SAME paint —
   the old React pipeline lagged ≥1 frame and "caught up" on stop. React re-renders only
   on rebuilds; a pre-paint `useIsomorphicLayoutEffect` re-syncs strokes after each.
2. **Wheel handler:** `deltaMode` normalized (Firefox lines ×40 — was frozen there);
   **non-cancelable events skipped** (Chrome mid-gesture commits a native scroll;
   applying ours too double-moved the page = the "lag impulse" on sharp flicks);
   `WHEEL_SPEED = 0.8` global speed knob.
3. **Stepped-mouse glide:** notch wheels accumulate into `targetScrollRef`; rAF glides
   the page there (`WHEEL_SMOOTH_TAU_MS = 110`). Trackpads detected (fractional/small
   deltas, 300ms latch) and stay INSTANT. Page + tip move as one — this can never
   reintroduce line-lag.
4. **Self-echo scroll tracking:** `selfScrollYRef` records our exact scrollTo values;
   `handleScroll` skips only true echoes (≤1px) and adopts EVERYTHING else exactly.
   (A 2px canonical-ref tolerance was tried first — it quantized slow scrollbar drags
   into ~3px steps. Don't bring tolerances back.)
5. **Slow-zone bubbles are now slope-continuous + self-tuning:**
   - Two-phase mapping: horizontal draws over the first `budget` px of tip descent
     (completes EXACTLY at the corner), vertical draws near-1:1 and lands EXACTLY at
     the drop end. Conservation law: page drift during sweep == corner sync error.
   - **Auto-budget** per bubble at rebuild: exactly the drift needed for (drop end +
     `BUBBLE_FIT_MARGIN`) to clear the fold by the corner, at the CURRENT viewport.
     Proven live: owner retuned the band and the fit held without edits. Knobs:
     `BUBBLE_MIN_BUDGET 50`, `BUBBLE_FIT_MARGIN 48`, `BUBBLE_EASE_RAMP 30`.
   - Slope pieces (`SlopePiece[]`, solved plateaus) keep the line at EXACTLY 1px path
     per 1px wheel input everywhere, page speed step-free (ramps in/out/through corner).
   - The graph's descent is ONE config segment now (`timeline-right → timeline-bottom`;
     the colinear `timeline-below` knee was removed from config AND component) — that's
     what gave the budget headroom.
6. **Tip-in-viewport mapping** is module-scope (`viewportPosAt`/`tipAt`) with knobs
   `TIP_BAND_TOP/BOTTOM` (owner tuned to **0.25/0.75**), `TIP_INTRO_VH/OUTRO_VH 0.3`.
7. **⚠ UNRESOLVED — scrollbar-drag feel.** External scrolls (scrollbar/keyboard) arm a
   drawn-tip catch-up glide (`TIP_CATCHUP_TAU_MS 70`, hard `TIP_CATCHUP_MAX_STEP 120`
   px/frame cap). Simulation verifies ≤120px/frame and exact settle, but the owner
   still finds real thumb-drags "not smooth" — PARKED. Next step when resumed:
   DevTools Performance trace during a real drag (suspect: sparse scroll events or
   long frames on real Windows Chrome that headless doesn't reproduce).
8. **Harness:** `scripts/measure-graph-crossing.mjs` measures crossing fit + budget
   (screenshots the corner moment). It MIRRORS the tip-band constants — keep in lockstep.

## 3. Scroll-lock unification + press SSR fix

- `useScrollLock` now used by **AchievementModal, CollaborationModal, PromoVideo
  fullscreen** (ProjectModal already had it). Deleted per modal: body position:fixed
  hacks, scroll save/restore double-rAF dances, onWheel/onTouchMove guards. ProjectModal
  is the reference modal — converge on it.
- **08_PressRecognition:** `vw` state initializes to **1440** (was 0 → the whole section
  collapsed in static-export HTML; crawlers saw nothing; lazy media mis-measured).
  Layout effect corrects pre-paint.

## 4. Collaborations: story gating + template

- `Collaborator.slug` → **`storySlug?`**. ONLY tiles with one are clickable (graph-dot
  rule): pointer cursor + corner glyph + keyboard (Enter/Space) only on story tiles.
- Currently story-backed: **MTEC** (real) and **Boyser → `_template`** (TEMP preview of
  the template modal — swap to a real `boyser.md` in the content pass).
- **`public/content/collaborations/_template.md`** = every supported part with YAML
  comments (meta chips, outcomes→Stakes section, hero image w/ logo fallback) + story
  body demonstrating **media embeds: `![caption](/img.jpg)` and
  `![caption](https://vimeo.com/… | youtube …)`** — CollaborationModal got a custom img
  renderer (styled figure / responsive iframe). Add a collab = copy file, delete unused
  parts, set storySlug.
- Fullscreen "Loading…" overlay deleted; modal opens when the local md arrives.

## 5. ContactFooter + ContactTitle (owner considers DONE, 9.5)

- Links: LinkedIn, Email, Book-a-call, **COLLABORATE (gold accent, → /collaborate —
  404s until roadmap #5, accepted)**, **CV (download arrow, → /cv/filip-ondrej-cv.pdf —
  PDF ships in content pass)**. GitHub REMOVED (empty profile = anti-proof).
- Links `flex: 1` — the stack's bottom lands exactly on the gallery+year-strip bottom.
- Availability badge removed. Bar inset = `--cf-x + 3.125rem` (150px @1440). `cage-h`
  runs through to the RIGHT browser edge (left end stays at the spine).
- Slideshow hygiene: auto-advance only in-view (IO) + not hovered + not reduced-motion
  (CSS killed the fade, so auto-advance would hard-jump — worse). Dots always work.
- Active year grows by the graph's 16/14 label ratio; `.dot .label` line-height pinned
  to the grown size — WITHOUT it the row breathed 1px every 4s and tripped the spine's
  settle observer into a rebuild per slide tick.
- **ContactTitle = ONE line: `READY` (gold) `WHEN YOU ARE` `;)` (gold).** The component
  now takes `TitleSegment[][]` (per-run gold, gradient sweeps whole segments, shimmer
  matches tt-gold, reduced-motion static). Note: below ~760px viewport the 64px font
  floor makes this line overflow — mobile-redo problem, deferred by design.

## 6. ⭐ SECTION 7 — CircuitBoard EXISTS BUT IS REJECTED (owner: 4/10)

`08_CircuitBoard.tsx` sits between Recognition and ContactTitle (anchors
`circuit-top/bottom`, straight vertical pass on the RIGHT — deliberately NO crossing,
alternation preserved). Concept (owner-approved in chat): the journey line reveals
itself as a PCB trace; principles = components fed by scroll-drawn branches; a keepout
FAULT with visible reroute (France-sprint in the site's language); "what's next" coda.

**The execution failed art direction, not engineering.** Agreed diagnosis:
sparse/empty where a PCB's beauty is DENSITY; the transformation moment missing (the
spine should visibly SPLIT into a parallel bus and re-converge — instead it passes
untouched with twigs); components are gray UI cards, not footprints (pins, pin-1 dots,
GOLD pads = free tie-in to the site's gold); no compositional grid. **Next session MUST
start with a visual/composition proposal (sketch, reference imagery, agreed picture)
BEFORE any code.** Owner was about to describe his mental image when the session ended
— ASK HIM FIRST. The mechanics (scroll-drawn branches, IO gating, imperative dash
writes, anchors) are sound and reusable; only the picture changes. Copy in it follows
the fact bank and can be recycled.

## 7. Gotchas learned this session (expensive ones)

- **styled-jsx DROPS the scoped class from compound `:global()` selectors**:
  `.foo:global(.state) :global(.child)` compiles to `.state .child` — loses the
  specificity fight against scoped base rules, silently. Write state-dependent pairs as
  fully-global with ascending specificity: `:global(.foo .child)` +
  `:global(.foo.state .child)`. This silently killed the circuit board's reveals.
- **09_ContactTitle source contains a literal NBSP character** in the space-render
  ternary (`ch === ' ' ? ' ' : ch` — the second ' ' is U+00A0). Exact-string edits
  against that line fail mysteriously; edit around it.
- Owner's dev server runs on **:3001**. Headless-verify workflow: puppeteer-core +
  local Edge against it (read-only) — scripts must live under `frontend/scripts/` for
  node_modules resolution. VERIFY before claiming fixed — twice this session the first
  "fix" was wrong and simulation caught it (drag quantization; fast-forward teleport).
- Simulated wheel/scroll ≠ owner's hand. The scrollbar-drag feel is still open despite
  passing simulation (§2.7).

## 8. Roadmap (owner's current sequencing)

1. **Section 7 redesign** — visual proposal FIRST, then rebuild on the existing rig.
2. **Projects:** 4th tile = ALL PROJECTS (card DNA, disabled until /projects exists) +
   the shared never-render-broken media empty-state system (Projects/Press/footer
   gallery all need it; 6 of 14 project images currently 404 into broken frames).
3. **Graph minors** (owner has a list) + keyboard a11y (V3 Phase D spec) + px polish.
4. **Top nav bar** (WORK/JOURNEY/FILM/PRESS/COLLABORATE + CV accent; migrate header off
   the 1120px `.container` onto the gutter system).
5. Scrollbar-drag feel (parked, §2.7). 6. SEO/OG/prerender plumbing. 7. /projects
   matrix + /collaborate pages. 8. Font unification LAST. Mobile redo = dedicated step.
9. Content pass (owner): real copy per PORTFOLIO_GOAL fact bank, media, CV pdf,
   timeline photos + caption fixes (several current captions contradict the fact bank).

## 9. Owner's working method (reaffirmed the hard way)

Diagnose → propose → **wait for go** on anything visible — and for art-direction-heavy
work (section 7) that means agreeing on the PICTURE (composition/reference), not just
the concept paragraph. Small mechanical fixes proceed. Measure before optimizing; verify
with the harness before claiming a fix; builds only coordinated (shared `.next`).
