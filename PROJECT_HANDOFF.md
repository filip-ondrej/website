# Project handoff — Filip Ondrej portfolio (responsive + design pass)

Give this file (plus the codebase) to a fresh chat instead of replaying the whole
conversation. It captures the non-obvious decisions and the working method.

---

## What this is
- Personal portfolio: `filipondrej-site/frontend` — **Next.js 15 (App Router) + Tailwind v4 + styled-jsx**, TypeScript.
- **Primary audience: YC / Entrepreneur First recruiters & investors** (also collaborators, press). Implication: substance over polish; let the work speak.
- **Design reference width = 1440px logical** (owner's 2880×1800 Retina @2x). The site is tuned to look right at 1440 — **every responsive change must be a no-op at 1440.**
- Dev: `npm run dev` — **the owner runs it; don't start your own server.** Prod: `next build` + `serve out` = **static export**, so next/image optimization is OFF (raw PNGs ship — relevant for load perf).
- **Not a git repo.** Don't run builds unless asked.

## Two phases
1. **Responsive scaling foundation — DONE & verified.** Whole site scales cleanly 4K → ~320px: no breakpoint "jumps", no horizontal overflow, consistent gutters, the decorative line stays aligned.
2. **Per-section design passes — IN PROGRESS.** One section at a time: real mobile/portrait *reflow* (not just scaling) + premium polish + content/copy. Tracked §0–§13 (below).

## The scaling system (rules to follow)
In `src/app/globals.css`:
- **Fluid root font:** `html { font-size: clamp(0.6875rem, 0.25rem + 0.833vw, 1.375rem) }` → 16px @1440. All `rem` (incl. Tailwind) scale with the viewport.
- **`--gutter: clamp(2rem, 8.5vw, 6.25rem)`** = content-edge inset. Align section content (titles, padding) to it.
- **The "progressline" spine** (`00_LineAnchor.tsx` → `00_ProgressLine.tsx`) scales its edge offset by `min(innerWidth/1440, rootFont/16)`, clamped [0.18, 1.6]. It sits just outside the gutter; the two coincide at 1440.
- **Conversion @1440:** 1rem=16px, 1vw=14.4px. A fixed `N px` → `clamp(var(--gutter), (N/14.4)vw, (N/16)rem)` (e.g. 200px → `clamp(var(--gutter), 13.9vw, 12.5rem)`).

**The ProgressLine is "the journey":** one continuous line from page top to bottom; on horizontal runs it slows scroll to focus attention. **Never add scroll-snap; never break its anchors.**

**"Bounded Journey" vertical rhythm** (owner's rule): sections are **content-driven** (compact lead-in + content + small trailing), NOT forced full-height. Whitespace is **capped & compact** — trailing space smaller than lead-in. On tall screens the next section may peek (fine). The 5 title-headers use this model: `--X-lead: clamp(140px,26vh,300px)`, `--X-gap`, `--X-trail: clamp(20px,4vh,50px)`; title in normal flow; line mid-anchor at `top: var(--X-lead)`.

## Key files
- `src/app/page.tsx` — section order. `src/app/layout.tsx` — sticky header, `ProgressLine`, `LoadingAnimation` wrapper, `ContactFooter`.
- Sections: `01_Hero`, `02_TitleReveal`, `02_PromoVideo`, `03_TimelineTitle` + `03_ProgressTimeline`, `04_ProjectTitle` + `04_Projects`, `05_CollaborationTitle` + `05_Collaborations` (+ `CollaborationModal`), `08_PressRecognitionTitle` + `08_PressRecognition`, `09_ContactTitle`, `09_ContactFooter` (rendered in layout). Timeline uses `AchievementModal`.
- `00_LineAnchor` (spine anchors), `00_ProgressLine` (spine renderer), `00_LoadingAnimation` (loader).
- **DEAD — do not edit:** `src/styles/progresstimeline.css`, `src/styles/collaborations.css`, `*Original*.tsx` (`CollaborationsOriginal`, `ProgressTimelineOgirinal`). Note: `09_ContactFooter` IS live (via layout, not page.tsx).

## Done so far
- Fluid engine + gutter + spine law; every live component converted to scale cleanly; no breakpoint jumps; full consistency audit passed (no bugs).
- **Loader (`00_LoadingAnimation`) rewritten:** the page mounts *behind* the overlay so assets preload; progress is driven by **real Hero-image downloads** (not a fake timer); centered via inline styles (no flash); min display time + 8s hard cap.
- All 5 title-headers unified to the content-driven Bounded-Journey model with one spacing scale.
- `03_ProgressTimeline`: controls-row overflow + label collisions fixed. `09_ContactFooter`: cage-alignment (negative-margin) bug fixed. Fixed a `top-[20px]` typo in the timeline spine anchor.
- **§1 Hero content (NEW, owner-approved):**
  - Headline: `ARE YOU ALSO THINKING ABOUT ROBOTS?` — two lines ("ARE YOU ALSO THINKING" / "ABOUT ROBOTS?"), **"ROBOTS?" in gold**. Playful hook matching the photo (elegant shirt, flirty smirk); the sub carries the substance.
  - Sub: `Filip Ondrej — 10 years winning robotics World Championships. The trophies were practice. The company is the point.`
  - Copy block moved **middle-left** (flex-centered, no transform). Title/subtitle sizes are the **originals**: `.titleSize: clamp(68px,6.6vw,92px)`, `.subtitleSize: clamp(16px,2.1vw,22px)`.

## TODO (remaining) — per-section design passes, ONE at a time, owner reviews each
§1 Hero (content done; **mobile/portrait reflow still pending** — in portrait the section is a short 16:9 band, needs a real phone treatment) · §2 TitleReveal · §3 PromoVideo · §4 TimelineTitle (header done) · §5 ProgressTimeline graph · §6 ProjectTitle · §7 Projects+lightbox · §8 CollaborationTitle · §9 Collaborations+modal · §10 PressRecognitionTitle · §11 PressRecognition+video · §12 ContactTitle · §13 ContactFooter · §0 Global chrome (header, spine, loader).

**Deferred decisions:** ProgressTimeline graph height is hard-fixed at 650px (left untouched to avoid desyncing the spine knee); ContactFooter 2-col→1-col breakpoint stays 1024px; header uses `.container` (max-width 1120px) — a different inset system than the gutter.

**⭐ FONT-SIZE UNIFICATION (do at the very END, after all sections):** right now nearly every component defines its own font sizes — inconsistent and not cohesive. Final task = define **one shared type scale** and apply it across all sections so headings/body/captions are consistent. (`globals.css` already has `--font-*` tokens that can become that scale.)

## How to work
- **Verify at 1440 first** — it's the reference; don't change its look without flagging.
- Use **`frontend/RESPONSIVE_QA.md`** (per-section checklist + sign-off table) before calling a section done.
- **Make changes → owner reviews live → iterate.** The owner runs the dev server.
- **Don't bikeshed ±1px.** Note nits and move on — they get cleaned up in the font-unification pass.
