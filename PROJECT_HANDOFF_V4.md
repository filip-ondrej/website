# Project handoff V4 — ProgressTimeline deep pass

Scope note: V1–V3 cover the whole site. **This V4 is narrow** — it documents only the
work done to **`src/components/03_ProgressTimeline.tsx`** in this session. Everything in
V3 (the scaling engine, spine law, title-header system, the rest of the sections) still
stands. Read V3 first for the global rules; read this for the timeline's current state.

---

## What ProgressTimeline is (quick recap)
SVG line chart. X = years 2016–2026 (11 columns), Y = "Progress Level" 0–6, ~50
achievement events (`src/data/graphData.ts`) plotted as impact-colored dots on a path
line, grouped into 3 chapters. Hovering a year **expands** that column (~4.2×, rAF width
animation) to reveal month ticks; clicking **locks** it; a dot with an `article` opens
`AchievementModal`. The chart renders ~1:1 with screen px so hit-testing maps cleanly.

`ProgressEvent` = `{ year, month, level, impactType, category, article?, significant?, dotSize? }`
where `impactType ∈ 'None'|'Lesson'|'Regional'|'National'|'International'|'World-Class'|'Exceptional'`.

---

## ⭐ The headline feature this session: the "caption journey" system
This replaced the old at-the-dot hover labels entirely. **On focusing a year**, after the
column settles, each event's caption is drawn into open space and tied back to its dot by a
**leader line that emanates from the dot in the dot's color**, routed **orthogonally
(vertical, with a 90° horizontal break)** — matching the spine's H/V "journey" language.

**Why this shape (the non-obvious reasoning):**
- A vertical leader at the **dot's own x can't cross the path** (the path is one-y-per-x) or
  hit **another dot** (all dots sit on the path). So the hard rule "leader never crosses the
  path / never overlaps a dot" holds **by construction**, not best-effort.
- Captions route **up or down**, chosen by available room then **balanced** between the two
  sides so they spread "airy" instead of stacking one way.
- Placement is a greedy 2D search per caption: try straight out from the dot, then **90°
  sideways breaks**, then farther out — first slot that clears **every placed box AND every
  placed leader** wins (`leaderHits()` rejects a candidate whose line would run over another
  caption). L-R order + this check keep leaders from crossing each other.

**Choreography (framer-motion — already a project dep, used in `app/transition.tsx`):**
- `pathLength` draws each leader **out from the dot**, duration ∝ leader length.
- Caption reveals **from the line's endpoint** (opacity + small drift), after the line draws.
- `staggerChildren` (~45ms) → ripples L→R as a wave.
- `AnimatePresence` runs the **reverse on exit**: caption retracts toward the dot, then the
  line erases dot-ward, staggered. (AnimatePresence keeps the last-rendered, populated
  element during exit, so the retract has data even though `captionPlacements` recomputes to
  `[]` once unfocused.)

**Context dim:** while a year is focused the base chart eases to **opacity 0.6** (a separate
wrapping `<g>`); a **bright overlay** on top holds the focused year's lit dots + leaders +
captions. (Was 0.15 — too dark, crushed the months — lightened to 0.6.)

**Dot hover (within a focused year):** hovering a dot grows it (×1.6) + swells its glow in
the bright overlay, and dims the other lit dots to ~0.32. Hover is detected by the original
PASS-1 hit areas (in the dimmed base, `pointer-events` still live); the overlay is
`pointer-events:none` so clicks pass through to open the modal.

### Architecture / where things live in the file
- `useFluidMetrics()` — merged scale+height hook (see below).
- `captionPlacements` useMemo — the placement solver (direction, 2D search, leader paths).
  Returns `{ key, category, isExceptional, color, dotX, dotY, boxX, boxY, boxW, boxH,
  baseFontSize, leaderD, leaderLen, goUp }`.
- `litDots` useMemo — bright copies of the focused year's dots (tracks positions live).
- `lit = focusedYear >= 0 && expansionComplete`.
- Render: base content wrapped in the **dim `<g>`** (after `{GRAPH_GRADIENTS}`, closed before
  the year labels); the **bright overlay** (lit dots `<g>` + `<AnimatePresence>` captions)
  sits after the year labels, before `</svg>`.
- `expansionComplete` timer was moved **250ms → 480ms** so leaders read off **settled** dot
  positions (the expand is ~460ms; drawing earlier traced moving dots).

### Knobs (all one-liners)
- Base dim `0.6`; lit-overlay fade.
- Stagger `0.045`s; line duration `leaderLen / 520`; caption drift `8px`; entrance/exit ease
  `cubic-bezier(0.16,1,0.3,1)`.
- Placement: dot→box gap `dotR + 24`; sideways step `boxW * 0.66`; padding `PAD = 6`; bounds
  `TOP = yTop6+4`, `BOT = yBottom+28`; settle gate `480ms`.
- Hover: grow `1.6`, others `0.32`.

### Caveats / known gaps (we said "evolve from here")
- **Same-side-dense years:** if many events route the same way, the stack can climb toward an
  edge. Mixed up/down balancing mitigates it but doesn't guarantee.
- **Leader vs other *dots*:** the solver checks leader-vs-*box*, not leader-vs-dot. Two events
  in the **same month** share an x, so one's vertical leader could pass the other's dot. Rare
  in the data; not yet handled.
- **Year-to-year switch:** old captions exit, the new year expands (~460ms), then new captions
  draw — a brief caption-less beat by design.
- **Reduced-motion:** handled minimally (skips the draw-in via `initial={false}`); exit still
  animates.
- Captions don't dim on per-dot hover yet (only dots do).

---

## Other ProgressTimeline changes this session

### Controls row — deliberate 2-row fallback (kept)
The info/toggle/legend row used to wrap chaotically at mid widths. Now the legend is a rigid
unit (`flex-wrap:nowrap`) and an `@media (max-width:1100px)` rule drops the **whole legend to
its own full-width line**, left-aligned. No-op at/above 1100px. `1100` is the one tunable
threshold.

### Letterbox bug — FIXED (important)
`FIXED_TOTAL_WIDTH` (the viewBox width) was measured from `tl-wrap.clientWidth`, which
**includes the 100px L/R padding**. The SVG renders at the *content* width, so the viewBox was
~200px wider → `xMidYMid meet` scaled the chart down and **centered it, leaving equal empty
bars top & bottom**. Fix: `useContainerWidth` now subtracts the horizontal padding. This is
why the chart now fills its box and renders true 1:1 (the Phase-B scaling work always assumed
1:1). If you ever see top/bottom bars again, suspect this.

### Height — fluid + viewport-fit (current ref = 650)
`useFluidMetrics()` (merged the old `useRootScale` + `useFluidGraphHeight` into one
rAF-batched resize listener so dot-scale and height commit on the same frame). Height =
`min(650 × rootFont/16, 0.73 × innerHeight, 840)`, floor 380. The `0.73 × vh` cap is what
makes the legend + graph-bottom **fit on one screen** on 16:9 displays (the old logic had a
`max(650, …)` floor that *prevented* shrinking on short screens). Spine **knee** stays
proportional: `height × (300/650)`.

### Performance pass (kept: items 1,2,3,5)
1. Static `<defs>` gradients extracted to a module const `GRAPH_GRADIENTS`; level gridlines +
   axis caption memoized into `levelGrid` — no longer reconciled on every expand frame.
2. Dot glows: only the hovered + Exceptional dots render a glow (was ~40 hidden `blur(10px)`
   filters live for nothing).
3. `getTextDimensions` cached in a ref `Map` (getBBox forces reflow).
5. Resize listeners consolidated (`useFluidMetrics` + `useContainerWidth` on rAF); unmount now
   cancels `hoverRAF` + the expansion timer (was a setState-after-unmount leak).

---

## Dead ends / reverted (don't redo without reading)
- **Cropping the empty top by lowering `LEVEL_TOP` 6→5:** tried twice. The owner wants the 6th
  level kept. The "big empty space" turned out to be the **letterbox bug**, not the level-6
  headroom — so the level crop was the wrong fix and was reverted. `LEVEL_TOP` is **6**.
- **Perf #6 (replace the rAF width-animation with CSS geometry transitions, `transition: d`
  etc.):** implemented, then reverted — it flattened the expand/retract feel the owner likes.
  The owner explicitly wants the **rAF expand animation kept**. A backup (`*.bak`) was used to
  restore and has been deleted. If revisiting "make the expand cheaper without changing the
  feel," the only safe route is **ref-driven DOM writes in the rAF** (keeps the exact easing),
  and you must keep `yearBounds` (hit-testing) in sync — that's the fiddly part.
- **Perf #4 (memoized dot component):** not done — after the other perf wins its benefit is
  negligible (during an expand every dot's x changes, so memoization skips nothing).

---

## Owner's working method (unchanged from V3)
- **Diagnose → propose → wait for go → change.** Big/spine changes: propose first.
- Owner runs the dev server; **don't start your own**. Not a git repo; **don't run builds
  unless asked** (a `tsc --noEmit` typecheck for bug-checking is fine and was used here).
- Aesthetic: **dark, calm, slow, sophisticated.** Motion is **exponential/ease-out, never
  bouncy or "poppy."** The owner will reject anything that feels like a default-chart pop.
- Owner iterates heavily and live — ship a coherent first version with clear knobs, expect to
  tune. "There's always an option to change stuff."

## Still pending on ProgressTimeline (from V3 + this session)
- Caption system polish (the caveats above) + whatever the owner tunes next.
- **Keyboard a11y** (still not done): year nav ←/→ move+expand, Enter/Space lock, Esc clear,
  using `:focus-visible` + the year's own glow as the focus indicator (owner hates the default
  focus rectangle). Optionally dots focusable → Enter opens achievement.
- Phase-B structural px offsets (month/year label y-offsets) still fixed px — folds into the
  eventual global font-unification pass.
