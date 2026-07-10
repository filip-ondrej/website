# PORTFOLIO_GOAL.md — filipondrej.com

> **Purpose of this file:** Single source of truth for finishing the portfolio website.
> Use it as the guiding spec for every content, copy, and design decision.
> The site is ~70% done (functionality first); this brief drives the remaining 30% (content + polish).

---

## 1. Mission

Build a **top-1% founder portfolio** that convinces accelerator recruiters
(**Entrepreneur First, Y Combinator, Founders Inc.**) within a **60–90 second skim** that
Filip Ondrej is a high-agency, world-class hardware builder who should be building a
highly dynamic startup — ideally in Silicon Valley (willing to relocate; EU citizen, visa unproblematic).

**The one impression a visitor must leave with:**
*"This person has been shipping world-championship hardware since age 12, moves at startup speed, and is ready to build."*

---

## 2. Audience & How They Read

- Primary: EF / YC / Founders Inc. talent scouts & partners. Secondary: founders, engineers, press.
- They skim. Decisions form in ~90 seconds. Every section must earn its scroll.
- They screen for: **agency, speed, technical depth, resilience, evidence of building things people use.**
- They are allergic to: unbacked self-praise, long paragraphs, buzzwords, typos.

---

## 3. Positioning Statement (north star for all copy)

**"Hardware engineer who has competed and won on the world stage for 10 years — from custom PCBs to full autonomous robots — now building toward a startup."**

Supporting pillars (each must be visible on the site):
1. **World-class proof** — titles and awards with numbers attached.
2. **Full-stack hardware depth** — PCB design → CAD → manufacturing → embedded C/C++ → algorithms.
3. **Startup-grade speed & agency** — concrete war stories (see Fact Bank).
4. **Real-world/commercial work** — industrial and client projects, not only competitions.
5. **Leadership & communication** — team lead 3+ years, trainer, Erasmus project.

---

## 4. Tone & Copy Rules (non-negotiable)

- **No long paragraphs.** Max 2 short sentences per block. Prefer fragments, headlines, stats.
- **Externalized proof over self-praise.** Never "I build the best hardware."
  Instead: "Judges sent other teams to study the robot." / "2× Best Hardware Solution — RoboCup World Cup."
- **Numbers in every claim** where possible: *1st of 20 countries · 2× world-level hardware award · 1 of 20 students nationwide · 5 of 6 categories won.*
- **Quote third parties, not yourself.** Newspaper line: *"Filip — delivering the impossible within three days."* Attribute it.
- **Perfect English.** The site must contain zero errors of the kind found in source docs
  (e.g. "Inovation", "Optimalised", "beginned", "Determents"). Proofread every string.
- Present tense, active voice, confident but factual.

---

## 5. Verified Fact Bank (source: resume + life story — use these, rewrite freely)

### Headline achievements
| Fact | Detail |
|---|---|
| RoboCup World Champion | 1st place, Rescue Simulation, World Cup 2021 (online), vs teams from 20 countries |
| Best Hardware Solution ×2 | RoboCup Rescue Line — European Championship (Guimarães, Portugal) **and** World Cup (Bangkok, Thailand), 2022. Fully custom robot: own PCBs, CAD, mechanics |
| St. Gorazd Award | Highest moral award of the Slovak Ministry of Education, 2024. ~20 students selected nationally. Ceremony broadcast live on national TV |
| Young Creator of the Year ×2 | 1st place national awards: Ministry of Economics (2021/2022, Nitra) and again in 2023 |
| LUX Mention | Prestige award from the Chairman of the Prešov Self-Governing Region for best students (2022) |
| 5 of 6 | Won 5 of 6 entered categories at RoboCup national round 2023 with a 4-person team (2nd in the sixth) |
| 4th place, RoboCup World Cup Sydney 2019 | Rescue Simulation — after qualifying via national win |
| 1st place, national 3D modeling/printing competition | IT Akadémia, 2021 — precision design to blueprint, functional 3D-printed air-pump assembly with self-defined tolerances |
| Valedictorian | Secondary Technical School of Electrotechnical Engineering, Prešov. HZB 1.0 (2023) |

### War stories (project cards / "how I work" material)
- **The France sprint:** Final PCBs arrived faulty a week before the 2023 World Cup (Bordeaux, France). Reordered boards shipped directly to France, picked them up on landing, finished the robot on site, competed days later. Newspaper: *"delivering the impossible within three days."*
- **The 20-ton heat pump (age ~17):** At BOYSER s.r.o., a 20 t / 17 m industrial heat pump arrived from a Spanish manufacturer with misplaced valves. Read the technical drawings management couldn't, 3D-printed an exact scale replica proving the manufacturing error. The model was used in liability negotiations; the unit was returned to Spain for reconstruction.
- **The rewrite:** After 3 years of iterating in Rescue Simulation, deleted the legacy codebase and rebuilt from scratch for speed and clarity — then won the world championship.
- **Built in 8th grade, shown in Singapore:** Binary-numbers teaching robot built for his teacher; presented at a worldwide educators' conference in Singapore.
- **Monument digitization (client work):** For the mayor of Haniska pri Prešove — photogrammetry of a 192-year-old, 20 m monument, surface reconstruction, then a small production line of 1:80 3D-printed replicas for sponsors and investors (2021).
- **Working 3D printer built from Lego**, programmed in the Lego IDE (elementary school era).
- **Origin story (one line max):** Switched schools within 4 days at age 10 to join a robotics lab. 10 years of robotics since.

### Work experience
- **Research Assistant — MTEC Institute, TU Hamburg (May–Aug 2024):** Autonomous sailing boats. 3D tools, servo-calibration process, wiring documentation, modified Dijkstra pathfinding, state machine for reliable map movement, technical support for master students.
- **3D Printing Engineer — BOYSER s.r.o. (2021–2022):** Heat pump story above; printer-fleet maintenance; designed promotional products.
- **Project Developer (internship) — Vectorealism, Milan (2022):** Redesigned educational Raspberry Pi robots used at a Milan university; supervised implementation and manufacturing of new parts.
- **Robotics Trainer — ABC-Centrum Prešov (2022):** Taught robotics and algorithmic thinking to 15 students.
- **Team Leader — Robotics Team Prešov (2020–2023):** Weekly meetings, workload distribution, school/company funding cooperation, deadlines.
- **Erasmus VALT project:** 5 educational videos with 5 European partner schools (Greece, Sweden, France, Bulgaria, Czechia).

### Skills (for a compact skills strip — no skill soup)
CAD: Autodesk Inventor, Fusion 360 · PCB: Autodesk EAGLE, home prototyping/soldering · Simulation: NI Multisim · Embedded: C/C++, Arduino, Raspberry Pi, PLC, FPGA, MyDAQ/MyRIO · Industrial: Siemens TIA Portal, LabVIEW · Manufacturing: FFF/FDM 3D printing, photogrammetry

### Current status
- B.Sc. Engineering Science (Mechatronics direction), TU Hamburg, since Oct 2023 — chosen strategically for its startup ecosystem; active in startup orgs/events.
- Goal: join a top accelerator program; **ready to relocate to San Francisco**; EU citizen.

---

## 6. Site Content Map (adapt to existing structure)

> The site already has its structure/functionality (Next.js, preloader, meta: "10 Years of Robotics Portfolio"). Map content into existing sections; only add sections if a pillar has no home.

1. **Hero:** Name + one hard-hitting line + 3–4 stat callouts (World Champion · 2× Best Hardware in the World · 10 yrs robotics · St. Gorazd, 1 of 20). Primary CTA: contact / CV download.
2. **Selected projects (3–5 max, not a museum):** Rescue Line robot (custom hardware) · Rescue Simulation (world title) · Heat pump replica · Monument digitization · Autonomous sailing boats (TUHH). Each: 1-line description, 1–3 metrics, photos/video, stack tags.
3. **How I work / war stories (optional but differentiating):** France sprint · The rewrite · Heat pump. 2 lines each.
4. **Experience & education:** compact timeline, dates, one line each.
5. **Awards strip:** logos/names + year, one line each. This section must feel *dense*.
6. **About + goal (short):** 3–4 lines max — 10-year arc, leadership, what he wants to build next, SF relocation note.
7. **Contact:** email prominent; LinkedIn/GitHub if available.

---

## 7. Remaining Work Checklist (the missing 30%)

- [ ] Write final copy for every section per rules above (EN, proofed).
- [ ] Populate all projects with real content, metrics, and media (collect photos/videos of robots, awards, TV segments; use styled placeholders where media is pending — never lorem ipsum).
- [ ] Awards section complete with all items from Fact Bank.
- [ ] Add third-party quotes (newspaper line; judges anecdote) as pull-quotes.
- [ ] CV download: fixed, typo-free PDF consistent with site copy.
- [ ] Meta/SEO: title, description, OpenGraph image, favicon — aligned with positioning.
- [ ] Verify preloader doesn't hide content from crawlers (SSR/prerender check) — currently a plain fetch of filipondrej.com returns only the loader.
- [ ] Mobile pass: every section scannable on a phone.
- [ ] Performance pass: media compressed, loader fast; the site itself is a hardware-engineer work sample.
- [ ] Final proofread of every visible string.

---

## 8. Definition of Done

A YC/EF reader, in 90 seconds on mobile, can answer **yes** to all:
1. Do I know his top 3 achievements (with numbers)?
2. Do I believe he builds hardware end-to-end himself?
3. Did I see evidence of speed/agency under pressure?
4. Do I know what he wants next (startup, SF) and how to contact him?
5. Did nothing feel exaggerated, unpolished, or misspelled?
