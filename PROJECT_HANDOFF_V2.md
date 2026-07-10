# Project handoff V2 — Filip Ondrej portfolio (per-section design passes)

Give this file (plus the codebase) to a fresh chat instead of replaying the whole
conversation. It captures the non-obvious decisions, the working method, and the
gotchas learned the hard way. **Supersedes `PROJECT_HANDOFF.md` (V1).**

---

## What this is
- Personal portfolio: `filipondrej-site/frontend` — **Next.js 15 (App Router) + Tailwind v4 + styled-jsx**, TypeScript.
- **Primary audience: YC / Entrepreneur First recruiters & investors** (also collaborators, press). Implication: substance over polish; let the work speak.
- **Design reference width = 1440px logical** (owner's 2880×1800 Retina @2x). The site is tuned to look right at 1440 — **every responsive change must be a no-op at 1440.**
- Dev: `npm run dev` — **the owner runs it; don't start your own server.** Prod: `next build` + `serve out` = **static export**, so next/image optimization is OFF (raw PNGs ship — relevant for load perf).
- **Not a git repo.** Don't run builds unless asked.

## Two phases
1. **Responsive scaling foundation — DONE & verified.** Whole site scales 4K → ~320px: no breakpoint "jumps", no horizontal overflow, consistent gutters, decorative spine stays aligned.
2. **Per-section design passes — IN PROGRESS.** One section at a time: real mobile/portrait *reflow* + premium polish + content/copy. **Desktop first** (owner: mobile gets a full layout redo as a later step — don't sink time into mobile now). Tracked §1–§13 below.

## The scaling system (rules to follow)
In `src/app/globals.css`:
- **Fluid root font:** `html { font-size: clamp(0.6875rem, 0.25rem + 0.833vw, 1.375rem) }` → 16px @1440, clamped [11px, 22px]. **The engine is WIDTH-driven.** All `rem` (incl. Tailwind) scale with viewport width.
- **`--gutter: clamp(2rem, 8.5vw, 6.25rem)`** = content-edge inset. Align section content to it.
- **The "progressline" spine** (`00_LineAnchor.tsx` → `00_ProgressLine.tsx`) scales its edge offset by `min(innerWidth/1440, rootFont/16)`, clamped [0.18, 1.6]. Sits just outside the gutter; the two coincide at 1440.
- **Conversion @1440:** 1rem=16px, 1vw=14.4px.

**The ProgressLine is "the journey":** one continuous line top→bottom; on horizontal runs it slows scroll to focus attention. **Never add scroll-snap; never break its anchors.**

**"Bounded Journey" vertical rhythm** (owner's rule): sections are **content-driven** (compact lead-in + content + small trailing), NOT forced full-height. Trailing **smaller** than lead-in. On tall screens the next section may peek (fine).

### ⚠️ Type-scaling laws learned this session (READ BEFORE TOUCHING ANY FONT SIZE)
- **Size type in `rem`, not raw `vw`.** A `clamp(PXpx, Nvw, PXpx)` has px floor/ceiling lock-points that differ per element, so two elements scaling on different `vw` coefficients freeze/unfreeze at different widths → **staggered, non-uniform scaling**. (This was the original Hero bug: title and subtitle locked at different widths.) Pure `rem` rides the one fluid root, so everything scales as a unit.
- **Never couple type size to viewport HEIGHT (`vh`/`min(vw,vh)`).** It makes type shrink when only the window height changes — inconsistent with the rest of the site (which only reacts to width). If a tall element risks overflowing a short screen, fix it with **layout** (content-driven height, or reposition), not by shrinking the type. (This was the §2 bug.)

### ⚠️⚠️ CRITICAL gotcha: anchors measure on MOUNT — keep layout-critical sizing INLINE
`00_LineAnchor` reads each anchor's document position with `getBoundingClientRect()` **once on mount** (+ a 50ms timer + on `resize`); `00_ProgressLine` rebuilds the path on the `anchors-updated` event. Therefore **any CSS that determines a section's height/anchor positions must exist at first paint.** Putting a section's `height` (or the custom props it depends on) in a **styled-jsx rule with dynamic `${}` interpolation applies a frame late** → at measurement the section has no height → it collapses → `bottom-[...]` anchors resolve *above* the section → **the spine draws above/through the section.** We hit exactly this in §2. **Fix/rule: set section height + its driving custom properties as INLINE styles on the element** (they're in the SSR HTML, present at first paint). styled-jsx is fine for non-layout-critical stuff (colors, font-size that reads inherited vars, animations).

## Key files
- `src/app/page.tsx` — section order. `src/app/layout.tsx` — sticky header, `ProgressLine`, `LoadingAnimation` wrapper, `ContactFooter`.
- Sections: `01_Hero`, `02_TitleReveal`, `02_PromoVideo`, `03_TimelineTitle` + `03_ProgressTimeline`, `04_ProjectTitle` + `04_Projects`, `05_CollaborationTitle` + `05_Collaborations` (+ `CollaborationModal`), `08_PressRecognitionTitle` + `08_PressRecognition`, `09_ContactTitle`, `09_ContactFooter` (rendered in layout). Timeline uses `AchievementModal`.
- `00_LineAnchor` (spine anchors), `00_ProgressLine` (spine renderer + scroll bubbles), `00_LoadingAnimation` (loader). Spine path config: `src/data/00_linePathConfig.ts`, builder `src/lib/00_generateDynamicPath.ts`.
- **DEAD — do not edit:** `src/styles/progresstimeline.css`, `src/styles/collaborations.css`, `*Original*.tsx` (`CollaborationsOriginal`, `ProgressTimelineOgirinal`). Note: `09_ContactFooter` IS live (via layout, not page.tsx).

## How to work (owner's process — important)
- **Diagnose → propose → wait for go → change.** For each section: read it, report findings + concrete options, and **change nothing until the owner picks.** Acting too fast / on the wrong axis caused real breakage and rework this session. The owner reviews live and iterates.
- **Verify at 1440 first** — it's the reference; don't change its look without flagging.
- **Make changes → owner reviews live → iterate.** The owner runs the dev server.
- Use **`frontend/RESPONSIVE_QA.md`** (per-section checklist + sign-off table) before calling a section done.
- **Don't bikeshed ±1px.** Note nits and move on — they get cleaned up in the font-unification pass.

---

## Per-section status & decisions

### §0 Global chrome — partial
Fluid engine, gutter, spine law all DONE & audited. Loader rewritten (real Hero-image-download-driven progress, preloads behind overlay, min display + 8s cap). All 5 title-headers unified to the content-driven Bounded-Journey model. Header/spine/loader polish pass still pending (end).

### §1 Hero (`01_Hero.tsx`) — DESKTOP DONE; mobile reflow pending
- **Content (owner-approved):** headline now **3 lines** — `ARE YOU ALSO / THINKING ABOUT / ROBOTS?` ("ROBOTS?" gold). Sub: *"Filip Ondrej — 10 years winning robotics World Championships. The trophies were practice. The company is the point."* Copy block middle-left (flex-centered, no transform).
- **Scaling fix:** `.titleSize` / `.subtitleSize` converted from `clamp(px,vw,px)` to **pure rem** so they scale uniformly with the site. Current: `.titleSize: 5.6rem` (owner-set), `.subtitleSize: 1.375rem`. The `[00] Introduction` label shares `.subtitleSize`. XXS `@max-width:480px` title override kept (mobile, handled later).
- **Scroll FX:** bottom fade-to-black driven by `FADE_START` / `FADE_END` constants (scroll-progress fractions) in the rAF tick. Parallax via `parallaxMaxShiftPx` (currently 120; stale `// BACK TO 80` comment — settle on a value + delete in cleanup).
- Reduced-motion respected (effect early-returns).
- **Narrative note:** the Hero deliberately dangles "robots → *the company is the point*"; §2/§3 are the *proof* beat (about Filip, not the company). The **company payoff must land in a later section** (projects/contact) — watch for it.

### §2 TitleReveal (`02_TitleReveal.tsx`) — DONE (desktop)
- Copy unchanged (owner likes it): `Think You Know What / ‘Dedicated’ / Looks Like? Watch This.` (mid + "Watch This." gold).
- **Blade reveal bug fixed:** line 3's blade wipe was desynced from its rise (missing `nth-child(3)` blade delay). Added `animation-delay: staggerMs*2` so all 3 lines reveal identically.
- **Sizing:** converted from `min(vw,vh)` to **width-based rem** via inline custom props `--trp-small` (`calc(fontScale*4.32rem)`), `--trp-xlarge` (`calc(fontScale*8.64rem)`). No longer shrinks with height.
- **Layout: now CONTENT-DRIVEN** (was a fixed-`vh` box, which made trailing grow with screen height). Section `height = --trp-lead + titleOffset + --trp-block-h + --trp-trail`, **all defined INLINE** on the `<section>` (see the CRITICAL gotcha above — moving these to styled-jsx broke the spine). `--trp-block-h` is an *estimate* of the rendered 3-line height (`(2*small + xlarge)*0.95`); if a sliver shows under the title, tighten the `0.95`.
- **Knobs (in the inline section style / props):** `leadInVH = 40` (top lead-in gap, clamped 180–460px), `--trp-trail` currently **`0px`** (owner wanted no space under the title), `titleOffsetBelowLinePx = 100`.
- Removed old `sectionHeightVH` / `lineYPercent` props; replaced with `leadInVH`.

### §3 PromoVideo (`02_PromoVideo.tsx`) — DONE (desktop, incl. a11y)
1.5-min Vimeo promo (Filip's achievements/championships, his voiceover; **not about the company**). Scroll-grow reveal → click for fullscreen modal.
- **Reduced-motion (was a real a11y bug):** the grow/rise/fade is JS-driven inline transforms, which the CSS `prefers-reduced-motion` block can't disable. The scroll effect now early-returns with `setProgress(1)` → video shows full/centered/static.
- **Keyboard:** the video is `role="button"`, `tabIndex={0}`, `aria-label`, Enter/Space opens it; `onFocus/onBlur` show the play overlay.
- **Reveal position:** `translateY = (1-eased) * REVEAL_DROP_VH` with `REVEAL_DROP_VH = 12` (was 35) — reveals higher (tighter to §2), eases to 0 so the **full-size hold stays dead-center**. Reveal *timing* (`startPoint = vh*0.5`, `endPoint = -vh*0.6`) left at original — don't change it to move the video up; that's the wrong axis.
- **Fullscreen modal:** video fits BOTH dims (`width: min(90vw, calc(90vh*16/9), 1600px)`); **X button moved out of the scaled `.lightbox-container`** and screen-corner anchored (`position:absolute; top/right:20px; z-index:1`) so it's always reachable; `role="dialog"` + `aria-modal` + focus-on-open + Tab focus-trap + focus-restore + Esc; **background video pauses** while open (Vimeo API).
- **Deferred:** the background loop is the full 1.5-min clip autoplaying on page load (perf — consider a short muted teaser loop, full clip on click); play icon fixed `200px` (→ font-unification pass).

---

## TODO (remaining) — per-section design passes, ONE at a time, owner reviews each
**Next up: §4 Timeline.** `04 TimelineTitle` header was unified (Bounded-Journey); the **ProgressTimeline graph itself is the pending pass**.
Remaining: §4 ProgressTimeline graph · §6 ProjectTitle · §7 Projects+lightbox · §8 CollaborationTitle · §9 Collaborations+modal · §10 PressRecognitionTitle · §11 PressRecognition+video · §12 ContactTitle · §13 ContactFooter · §0 global chrome (header, spine, loader).

**Deferred decisions:** ProgressTimeline graph height hard-fixed at 650px (left untouched to avoid desyncing the spine knee); ContactFooter 2-col→1-col breakpoint stays 1024px; header uses `.container` (max-width 1120px) — a different inset system than the gutter.

**⭐ FONT-SIZE UNIFICATION (do at the very END, after all sections):** nearly every component defines its own font sizes — inconsistent. Final task = define **one shared type scale** (the `--font-*` tokens in `globals.css` can become it) and apply across all sections. Sweep up the deferred cosmetics here (Hero `parallaxMaxShiftPx` comment, §3 play-icon px, etc.).

**Mobile/portrait:** owner plans a **full layout redo as a dedicated later step** — don't pre-optimize mobile during desktop passes.
