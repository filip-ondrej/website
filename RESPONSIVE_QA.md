# Responsive QA — per-section scaling checklist

Run this for **each section**, in order. A section is **done** when steps **1, 2, 3 all pass cleanly** and **4–8 have no blocking issues** (log minor nits for later).

**System reminders for this site:**
- **Design reference = your current screen** (~1440px logical). Everything is calibrated to look right there; changes elsewhere should not alter the 1440 look.
- The **progressline (spine)** should sit just *outside* the content and scale smoothly — never overlap titles/content.
- **Bounded-Journey rhythm:** gaps between sections are compact and capped — deliberate, never stretched. On very tall screens the next section may *peek* (that's intended). No scroll-snapping.
- A **horizontal scrollbar at any width = a hard fail** (something is overflowing).

**Setup:** DevTools → device toolbar (responsive mode) so you can type exact widths. Center the section first.

---

## 1. Baseline — your current screen (the reference)
- [ ] Looks exactly as intended (if it's off here, it's a real bug, not a scaling artifact).
- [ ] Everything works: hover, clicks, carousel/lightbox, timeline interaction, typewriter/reveal animations play.

## 2. The resize sweep (catches the worst issues)
- [ ] Slowly drag width from wide → ~320px. No **jumps** — nothing snaps position/size suddenly (should glide).
- [ ] No **horizontal scrollbar** appears at any width.
- [ ] The **spine** stays just outside the content and scales smoothly — never crosses/overlaps the title or content.

## 3. Specific widths — check each
For each: content not clipped, no overflow, text readable, spine aligned, spacing deliberate (not stretched/cramped).
- [ ] **1920×1080** (most common monitor)
- [ ] **1366×768** (short laptop — watch vertical fit / clipping)
- [ ] **1024** (tablet landscape)
- [ ] **768** (tablet portrait)
- [ ] **390** (phone portrait)
- [ ] **320** (small phone — tightest case)

## 4. Aspect-ratio extremes
- [ ] **Tall/narrow window:** title doesn't overlap the spine; image/content still visible (not cropped off-screen); spacing doesn't balloon (gaps stay compact, next section may peek).
- [ ] **Short/wide window:** tall content (big titles, the timeline graph) isn't cut off.

## 5. Spacing & rhythm (Bounded-Journey rule)
- [ ] Gap *into* the section is compact and consistent with the others (no big empty runway).
- [ ] Title/heading is connected to its content below (no large dead space under it).

## 6. Interaction on touch / small screens
- [ ] At phone width, tap targets are reachable and large enough; carousels/lightboxes/timeline work by touch.
- [ ] Hover-only effects have a sensible touch state (nothing stuck or left invisible).

## 7. Zoom (accessibility)
- [ ] Browser zoom **200%** and **50%** on your normal screen: layout holds, nothing breaks or overflows.

## 8. Motion
- [ ] Animations run smoothly; with OS "reduce motion" enabled they calm down rather than break.

---

## Section sign-off log

| # | Section | Done? | Notes / nits to revisit |
|---|---------|-------|-------------------------|
| §1 | Hero | ☐ | |
| §2 | TitleReveal | ☐ | |
| §3 | PromoVideo | ☐ | |
| §4 | TimelineTitle | ☐ | spacing/restructure done; mobile pass pending |
| §5 | ProgressTimeline (graph) | ☐ | graph height fixed at 650 (deferred) |
| §6 | ProjectTitle | ☐ | |
| §7 | Projects + lightbox | ☐ | |
| §8 | CollaborationTitle | ☐ | |
| §9 | Collaborations + modal | ☐ | |
| §10 | PressRecognitionTitle | ☐ | |
| §11 | PressRecognition + video lightbox | ☐ | |
| §12 | ContactTitle | ☐ | |
| §13 | ContactFooter | ☐ | cage-alignment fixed; 2-col→1-col stays at 1024 |
| §0 | Global chrome (header, spine, loader) | ☐ | header uses .container (1120px) — different from gutter |
