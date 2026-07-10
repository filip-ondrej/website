# Project handoff V5 — ProgressTimeline caption-reveal rework

Scope note: like V4, **this V5 is narrow** — it documents only the work done this session,
which was entirely inside **`src/components/03_ProgressTimeline.tsx`** (the caption
"journey" system: the leader lines + their text boxes shown when a year is focused).
Everything in V1–V4 still stands — the scaling engine, spine law, title-header system, the
rest of the sections, and the timeline's chart/expansion mechanics. **Read V3 for the
global rules and V4 for the timeline's chart internals; read this for the caption system's
current state.**

---

## What the caption system is (quick recap)
When a year is focused (hover, or click to lock) and the column has finished expanding
(`lit = focusedYear >= 0 && expansionComplete`, gated at 480ms), each of that year's events
draws a **leader line out of its dot** to a **glassy text box** placed in open space. The
placement solver (`captionPlacements` useMemo) is unchanged in spirit from V4 (greedy 2D
cost-ranked search, leaders never cross the path/dots/other boxes/other leaders). This
session reworked **how the leader routes, how the box looks, how the reveal animates, the
hover behaviour, and fixed two real bugs.**

---

## ⭐ Headline change this session: line + caption are now ONE continuous motion
Previously the leader drew (framer `pathLength` variant), then the box did its *own*
separate fade/slide after a fixed `delay`. With a strong ease-out the line *looked* finished
at ~40–70% of its duration, so there was a visible **gap then pop**, and the box motion felt
disconnected ("linear caption vs exponential line").

**Now:** each caption is its own component **`CaptionItem`** (module scope) driven by a
**single `progress` MotionValue (0→1)** under **one easing** (`REVEAL_EASE = [0.16,1,0.3,1]`),
split by length:
- `progress` `0 → leaderFrac` → the leader's `pathLength` (line draws).
- `progress` `leaderFrac → 1` → the caption **wipe** (box reveals).
- `leaderFrac = leaderLen / (leaderLen + wipeDist)` — the split matches real geometry, so the
  reveal front leaves the dot, runs down the line, and **carries its exact velocity into the
  wipe**. No seam, no gap, no separate segment.
- Duration is length-proportional: `dur = clamp(0.7, total/320, 1.6)` (s), set in a
  `useEffect` via framer's imperative `animate(progress, 1, …)` (cleaned up on unmount).
- All leaders **start at the same instant** (no stagger); each caption resolves when *its own*
  line arrives, so longer journeys naturally finish later.

### The wipe (the caption's reveal)
The box is revealed by an SVG `<clipPath>` containing a full-size rect that is **transform-
`scale`d from 0→1, anchored (`transform-origin`) at the edge the leader touches** — so it
opens *out of the line's connection point*:
- sideways leader → `scaleX` from `left center` (box right of dot) or `right center` (left of).
- vertical leader → `scaleY` from `center top` (box below dot) or `center bottom` (above).
- `transformBox: 'fill-box'` so the origin is the rect's own bbox.
- **Why transform-scale and not animating the rect's geometry:** see gotcha #1 below — the
  earlier attempt animated the clip rect's `x`/`width` via framer `attrX`, which broke. Pure
  transforms are framer's strength and the rect keeps real `x/y/width/height` attributes.
- `CM = 12` clip margin around the box so the soft drop-shadow isn't clipped away.

**⚠️ Needs a live eyeball (didn't get to verify in-browser):** that each wipe grows *from the
connecting edge*, not from the centre. If framer doesn't pick up the CSS
`transformOrigin`/`transformBox` on the clip rect, switch to framer's `originX`/`originY`
props instead. Not a crash risk — worst case it scales from centre.

---

## The two bugs fixed
1. **"Colorful dot left behind" when switching years.** Root cause: there were **two**
   identical `litDots` groups (one drawn *under* the leaders), and on a year-switch the old
   year's dots vanished instantly while the leaders were still retracting — leaving each
   leader's coloured origin glow stranded at the old dot. **Fix:** one presence group per
   focused year wrapped in `<AnimatePresence>` — a single `motion.g key={`focus-${year}`}`
   that **fades the whole group out together on exit** (dots + leaders + boxes), so a leader
   can never outlive its covering dot. Dots are rendered **last** (on top of every leader
   origin). This replaced the old per-leader "erase" retract with a coordinated fade — more
   reliable; reintroduce a fancier retract later only if wanted.
2. **"Random" hover highlight/dim.** Captions & dots were keyed by `year.month`, but several
   events share a month → one hover lit up siblings at random. **Fix:** a stable
   `eventIndexMap` (event object → its index in `events`) gives each event a unique id;
   hover state is now `hoveredEventIdx` (number) and every key/match uses `evIdx`
   (`cap-${evIdx}`, `lit-${evIdx}`).

---

## Other changes this session
- **Leader routing — sideways now lands on the MIDDLE OF THE BOX'S NEAR VERTICAL SIDE**
  (not the corner / top-edge). `buildLeader(dotX,dotY,cx,cy,bw,bh)`:
  - jog → vertical to the box's centre-y, then horizontal into the middle of the near
    left/right side: `M dot V cy H edgeX`.
  - no jog → vertical to the middle of the near top/bottom edge: `M dot V ey`.
  - The solver's `leaderBad()` and cost ranking were updated to the new geometry
    (`cost = len + (H_WEIGHT-1)·horizLen`).
- **Glassy box restored (owner-chosen "backup style"):** translucent **impact-colour** fill
  (`${color}25`, hover `42`; exceptional uses gold rgba), colour border, soft colour
  drop-shadow, faint white shine along the top. (The dark `rgba(13,14,19,..)` box is gone.)
- **Hover parity:** hovered caption **and** its line grow + brighten (box `scale 1.14`,
  line `sw 4.5`, bold, brighter fill/border/glow); **all other captions and their lines**
  dim (`0.28`) **and** shrink (box `scale 0.9`, line `sw 2`). Lit dots match (hovered ×1.6,
  others ×0.85 + dim). Base line width when nothing hovered = `3`.

### Where things live now
- `eventIndexMap` useMemo — stable event→index identity.
- `hoveredEventIdx` state — set by the PASS-1 hit areas (`events.map((ev, evIdx) …)`).
- `captionPlacements` useMemo — placement solver + `buildLeader`. Returns `{ key, evIdx,
  category, isExceptional, color, dotX, dotY, boxX, boxY, boxW, boxH, baseFontSize, leaderD,
  leaderLen, goUp }`.
- `litDots` useMemo — `{ key, evIdx, x, y, r, fill, glow, isNone }`.
- **`CaptionItem`** (module scope, above the main component) — renders one leader + one box,
  owns the single-`progress` reveal. Takes `{ p, isHov, someHov, uid, prefersReduced }`.
- Render overlay (inside `<svg>`, after the year labels): `<AnimatePresence>` →
  `motion.g key={focus-${focusedYear}}` (exit opacity fade) → `{lit && …}` maps
  `captionPlacements` to `<CaptionItem>` → then `litDots` rendered last.

---

## ⚠️ framer-motion gotchas learned this session (READ before touching the reveal)
1. **`attrX`/`attrY` only work inside `animate`/`style` targets, NOT as bare props.** As a
   top-level prop on `motion.rect` they leak to the DOM → *"React does not recognize the
   attrX prop"* and the element doesn't render. To reveal via SVG geometry, use a **transform
   scale** instead (what we did).
2. **An inline `opacity` on a `motion.path` is ignored** — framer manages that element, so the
   style opacity doesn't take. Wrap the path in a plain `<g style={{ opacity }}>` to dim it.
   (This is why the leader lines "wouldn't dim" until wrapped.)
3. **Bare `x`/`y` on motion SVG elements are TRANSFORMS (translate), not the SVG x/y
   attributes.** Use `attrX`/`attrY` *inside animate/style* for the attribute — or, as here,
   avoid them and use transforms.
4. **A strong ease-out makes a line look "arrived" well before its duration ends.** Don't
   chain a follow-on animation off a fixed `delay = lineDur` — tie both to one shared
   `progress` so velocity is continuous.
5. `useReducedMotion()` path: `CaptionItem` sets `progress = 1` immediately (line fully drawn,
   box fully revealed, no animation).

---

## Knobs (all one-liners in `CaptionItem` / `captionPlacements`)
- Pace: `REVEAL_EASE`, `dur = clamp(0.7, total/320, 1.6)`.
- Split: `leaderFrac` (line vs wipe share of the timeline).
- Wipe: `CM = 12` (clip margin), the `transformOrigin` strings.
- Hover: dim `0.28`, scales `1.14 / 0.9`, line widths `4.5 / 2 / 3`.
- Placement (unchanged from V4): `MAX_JOG = 220·uiScale`, `H_WEIGHT = 2.5`, `DOT_R`,
  `LINE_PAD`, settle gate `480ms`, base dim `0.6`.

---

## Still pending on ProgressTimeline
- **Live verification of the wipe origin** (gotcha #1 fallback above) and that the
  right-side/bottom wipe directions read correctly.
- **Placement may have shifted** with the new side-routing — if any focused year feels
  crowded, tune `MAX_JOG` / `H_WEIGHT`. (Owner: "we'll get to caption polish a little later.")
- Optional: **feather the wipe's hard edge** with a gradient mask if a softer reveal is wanted.
- **Keyboard a11y** — still not done (from V3/V4): year nav ←/→ + Enter/Space lock + Esc,
  using `:focus-visible` + the year's own glow as the focus ring (owner hates the default
  focus box); optionally dots focusable → Enter opens the achievement.
- **Phase-B structural px offsets** (month/year label y-offsets) still fixed px — folds into
  the eventual global font-unification pass.
- Stale comment: the placement `order` comment says "most-crowded first" but it's plain
  left-to-right index order. Cosmetic.

## Rest of the site (unchanged, from V3)
§7 Projects + lightbox · §9 Collaborations + modal · §11 PressRecognition + video · §13
ContactFooter · §0 global chrome polish · then the **font-size unification pass at the very
end**. Mobile/portrait is still a dedicated later step — don't pre-optimize it.

## Owner's working method (unchanged)
Diagnose → propose → wait for go → change (propose first for big/spine changes). Owner runs
the dev server — **don't start your own**; a `tsc --noEmit` typecheck for bug-checking is
fine (note: there's a pre-existing unrelated `Vimeo` global type error in
`08_PressRecognition.tsx` — not yours). Aesthetic: dark, calm, slow, sophisticated; motion is
ease-out, never bouncy/poppy. Owner iterates heavily and live — ship a coherent version with
clear knobs and expect to tune.
