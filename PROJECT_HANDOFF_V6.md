# Project handoff V6 — Section reorder (journey mirror), performance pass, footer rework

Read **V3 for global rules** (scaling engine, spine law, title system), V4/V5 for the
ProgressTimeline internals. This V6 documents one large session: the **main-page section
reorder with a mirrored spine journey**, a **measured performance pass** (loader, images,
scroll), a **ContactFooter fundamental rework**, and a batch of interaction fixes.
Everything in V3–V5 still stands unless contradicted here.

---

## 1. ⭐ Section reorder + mirrored journey (THE structural change)

**New order in `page.tsx`:** Hero → TitleReveal → PromoVideo → **ProjectTitle → Projects**
→ **TimelineTitle → ProgressTimeline** → CollaborationTitle → Collaborations → Press →
ContactTitle (+footer via layout). Rationale (agreed with owner): skimmers need proof
(Projects) before the deep-dive (graph); the graph is the crown jewel and sits after.

To keep the one-continuous-line law, the **TimelineTitle + Graph pair was MIRRORED**:

- **TimelineTitle**: enters LEFT (from Projects), crosses L→R above the title, descends
  RIGHT. Anchors renamed: `tt-start-left-top, tt-middle-left, tt-middle-right,
  tt-under-right, tt-bottom-right`. The title is now **RIGHT-aligned**
  (`margin: 0 var(--tt-right) 0 auto`, `align-items:flex-end`, prop is `rightOffsetPx`);
  gap law mirrored: `--tt-gap = --tt-right − --tt-spine-x`.
- **Graph (ProgressTimeline)**: enters RIGHT, crosses R→L above the chart
  (`timeline-top`→`timeline-right`→`timeline-left`), knee + exit down the LEFT
  (`timeline-below`, `timeline-bottom` now `position="left"`). Chart internals untouched.
- `linePathConfig` middle block rewired (sections renumbered 4–7); **everything from
  CollaborationTitle down is byte-identical** (ct enters LEFT as before).
- **Perfect L/R alternation** across all crossings survives the swap.

**Symmetry law at the title→graph seam:** `--tt-trail = max(0px, --tt-gap − 25px − 8px)`
with `reserveBelowPx={0}` in page.tsx. 25px = the graph's `HORIZONTAL_LINE_Y`; 8px =
optical descender correction (owner-verified at 1440). The two comments reference each
other — if `HORIZONTAL_LINE_Y` changes, this breaks.

**Typewriter cursor** takes zero net layout width now (`margin-right:-7px` compensates
width+gap) — an in-flow cursor made the right-aligned lines' right edges ragged.

**Graph cosmetics after the mirror:** controls row got `padding-left: 1.25rem` (info
button equidistant from the line top & left); Y-axis numbers + "PROGRESS LEVEL" caption
moved to the RIGHT edge of the chart (`x = FIXED_TOTAL_WIDTH − 2`, inline
`textAnchor:'end'` because the CSS class would override the attribute).

## 2. ⭐ ProgressLine engine fixes (00_ProgressLine.tsx)

1. **Height ratchet BUG fixed:** the spine SVG used to set `height: scrollHeight px` —
   self-referential: after a downscale the too-tall SVG held scrollHeight at the old
   value, so the line drew far past the footer and the page scrolled into void, forever.
   Now `height: '100%'` (of the position:relative body). Never reintroduce a px height.
2. **Idle re-render BUG fixed:** the rAF loop committed state every frame (plus a
   write-only `viewportPos` state, now deleted) → the whole spine SVG re-rendered through
   React at 60fps even when idle (felt as scroll lag, brutal in dev). Now state commits
   only when the tip moves ≥0.1px, and `setRuntime` keeps object identity when equal
   (also in the wheel handler).
3. **Portal fades (owner LOVES this):** at every designed gap in the journey (consecutive
   config segments whose `to`/`from` differ = the tunnel portals), the last **14px** of
   the entering segment dissolve to transparent and the emerging segment fades back in —
   userSpaceOnUse gradients pinned to the anchor (`portal-fade-static/active-<segIdx>`),
   applied to both baseline and active strokes. **The rounded cap must never be visible
   at a portal.** Knob: `PORTAL_FADE = 14`. (A previous attempt drew circle "sockets" —
   owner hated it; don't bring that back.)
4. **`data-rail-hijack` guard:** while the collaborations rail is armed (see §4), the
   scroll handler snaps back ANY scroll it didn't initiate (`window.scrollTo(0,
   pageScrollRef.current)`). This defeats Chrome's non-cancelable wheel events (delivered
   during aggressive gestures; preventDefault silently ignored) that let one native
   vertical step slip past the rail's hijack.

## 3. Performance pass (MEASURED — don't regress it blind)

- **Image pipeline:** `scripts/optimize-images.mjs`, run via **`npm run img`** (sharp is
  a devDependency). Emits WebP next to sources, originals untouched. Hero layers:
  4×4.8MB PNG → 4×106KB WebP @2880w. **NOTE: the 4 hero layer PNGs are byte-identical
  placeholder copies of one image** — when real layers arrive, drop PNGs in and re-run.
  Footer timeline covered too (`/timeline/<year>.jpg → .webp`, only 2018 exists so far;
  the other 9 footer entries 404 by design until content lands).
- **Loader (00_LoadingAnimation):** gates on the 4 hero WebPs + fonts ONLY — deliberately
  NOT on window `load` (that waited for every below-fold resource and held the bar at 95%
  for seconds). Pacing 0.35/2.5/120ms (~250ms artificial sweep, was ~500+). Emits
  `[loader]` timing marks to console + `window.__loaderPerf` (mounted / imgN / fonts /
  assets-ready / reveal, ms since navigation).
- **Vimeo iframes lazy-mount:** promo background player and the 5 press card players
  mount only when their section is within one viewport (IntersectionObserver, one-shot,
  `rootMargin: '100% 0px'`). Press additionally requires `animateTrack` (geometry
  settled) — mounting into a half-settled box made Vimeo render the video shifted by
  ~half the frame (the "half-frame shift" bug).
- **Hero parallax:** `window.scrollY` gate before `getBoundingClientRect` (was a forced
  layout read at 60fps while idle).
- **Measurement harness (keep using it):** `scripts/measure-load.mjs` (loader phases +
  slowest resources) and `scripts/measure-scroll.mjs` (rAF frame deltas while wheeling,
  with suspect-isolation variants). Both puppeteer-core + local Edge
  (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`), run against
  `npx serve out -l 3999`.
- **Measured state:** production cold-cache reveal **~1.0–1.2s** (~700ms of it is JS +
  hydration = the floor; code-splitting was considered and deliberately NOT done — it
  fights the anchor system). Hero scroll ~9ms avg frame @DPR2 headless. **The owner's
  "4–5s" was `next dev` overhead** — judge perf ONLY on `npm run build` + `npm start`.

## 4. Collaborations rail behavior (owner-specified, don't "fix")

- Cursor resting on the rail for **`ARM_DELAY_MS = 1000`** arms it; once armed, EVERY
  wheel gesture (vertical included) drives the rail horizontally and the page is
  hard-locked (attr `data-rail-hijack` on `<html>` + the ProgressLine snap-back guard)
  until the cursor leaves. Before arming, events fall through so a passer-by scrolls on.
  Trade-off (accepted): keyboard scroll is also frozen while armed.
- Brand hover caption font is now rem (`clamp(9px, 0.75rem, 14px)`).

## 5. ContactFooter — fundamentally reworked (same look @1440)

- JS `innerWidth`/INSET math + measured SVG grid **deleted**. Cage = pure CSS on
  **`--cf-x`** (inline on the footer root; the standard spine mirror
  `clamp(18px, min(6.944vw, 6.25rem), 160px)`): `.cage-v/.cage-l/.cage-r/.cage-h` divs.
- All raw-vw font/space clamps → **rem no-ops at 1440** (year 4rem, value 1.375rem,
  labels 0.625rem, etc.).
- `.content`: `gap: 0` (socials column starts exactly ON the gallery's right border —
  shared middle line), columns `minmax(0, 1.2fr) minmax(0, 1fr)` + `min-width:0` on both
  + badge `max-width:100%` (grid min-width:auto used to overflow the viewport).
- **2-col → 1-col at 640px** (was 1024 — owner wants the picture side-by-side for as
  long as possible; it may get small, that's fine).
- Timeline gallery srcs point at `.webp` (pipeline output).

## 6. Press section (08_PressRecognition)

- `measuredCardH` changes now dispatch the anchor re-measure nudge directly (rAF-deferred)
  — the cage-bottom spine run floated off its line "sometimes" when the heal relied only
  on the global height observer.
- Card iframes: `animateTrack && playersReady && vimeoId` (see §3).
- Known structural debt: the section's heights are JS-state-derived → collapsed at SSR
  first paint, which makes below-fold lazy images/iframes look "near viewport" and load
  early. Also: **the empty area under the press cage is a missing component by design**
  (owner hasn't decided what goes there — candidates: About/What's-Next block).

## 7. Gotchas learned this session (expensive ones)

- **NEVER run `npm run build` while the owner's dev server is running** — they share
  `.next`; the build corrupts the dev server (symptom: `TypeError: Cannot read properties
  of undefined (reading 'call')` in `__webpack_exec__`). Fix: stop dev, `rm -rf .next`,
  restart.
- CSS `text-anchor` from a class **overrides** the SVG `textAnchor` attribute — use
  inline `style={{textAnchor}}` to win.
- Chrome delivers **non-cancelable wheel events** mid-aggressive-gesture; preventDefault
  is silently ignored. Only a scroll-snap-back guard truly locks the page.
- The four hero PNGs being identical means the parallax currently shifts copies of one
  image — don't debug "parallax looks flat," it's the placeholder.

## 8. Agreed roadmap (owner's sequencing)

1. ~~Reorder sections + mirror journey~~ ✅ (this session)
2. **Finish/polish main components with generated placeholder content** (owner supplies
   real content later; placeholders must never render broken — styled empty-states).
3. **Top navigation bar** (name + WORK/JOURNEY/FILM/PRESS/COLLABORATE + CV/book-a-call
   accent; active-section indicator; header currently uses `.container` 1120px — fold
   its migration to the gutter system into this step).
4. **/projects matrix page** (all projects; 1×1/2×1/2×2 tiles by importance,
   deterministic seed, same card DNA; homepage keeps 3 featured + "ALL PROJECTS" tile).
5. **Collaborate page** (value prop, skills, war stories, engagement types, form +
   cal.com; this is the EF/YC-facing invitation).
6. Still pending from V3–V5: timeline keyboard a11y, caption-wipe live check, mobile
   redo (dedicated step), font unification (very last), per-section QA sign-offs in
   RESPONSIVE_QA.md.

## 9. Owner's working method (updated)

- Diagnose → propose → **wait for go** on design/spine changes; owner reacts strongly to
  unrequested visual inventions (see portal sockets). Small mechanical fixes may proceed.
- **Measure before optimizing** — the harness scripts exist; use them.
- Owner runs the dev server; `tsc --noEmit` freely; builds only coordinated (see §7).
- Aesthetic unchanged: dark, calm, slow, ease-out; the line is sacred (never cut — only
  portals may interrupt it, and the cap must never show).
