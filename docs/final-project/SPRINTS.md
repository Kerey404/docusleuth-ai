# Sprint execution record

This record accompanies the Team Project 2 Part 2 report. The four two-week Sprints retain the Part 1 scope and dates. Completion, effort and feedback are modelled for the academic exercise. Published product evidence is linked from the [evidence hub](README.md).

## Scope and outcomes

| Sprint and dates | Sprint goal | New scope SP | Carried in SP | Committed SP | Done SP | Carried out SP |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 · 16–29 Nov 2026 | Reliable multilingual input and review | 17 | 0 | 17 | 14 | 3 |
| 2 · 30 Nov–13 Dec 2026 | Reproducible model evaluation | 23 | 3 | 26 | 26 | 0 |
| 3 · 14–27 Dec 2026 | Usable reporting and feedback | 24 | 0 | 24 | 16 | 8 |
| 4 · 28 Dec 2026–10 Jan 2027 | Verified release and handover | 19 | 8 | 27 | 22 | 5 |
| **Total** | | **83** | **11** | **94** | **78** | **16** |

The 94 committed SP include 11 SP selected again after carry-over. Unique scope is 83 SP. The carry-out total counts crossings of Sprint boundaries, with 5 SP still open at release. Commitment reliability is **78/94 = 83%**. Unique scope completion is **78/83 = 94%**. Mean velocity is **19.5 SP per Sprint**.

### The 20 stories

Each outcome below is the final state in the simulation. The initial Sprint column matches the labels in the [original import template](jira-backlog.csv). The [Jira export](../jira/backlog-export.csv) shows the allocation after moving US05 and US14.

| ID | Story | SP | MoSCoW | Initial Sprint | Simulated outcome |
| --- | --- | ---: | --- | ---: | --- |
| US01 | Bounded review process | 3 | Must | 1 | Done in Sprint 1 |
| US02 | Language selection and upload | 3 | Must | 1 | Done in Sprint 1 |
| US03 | OCR in the original language | 5 | Must | 1 | Done in Sprint 1, controlled-scan limits recorded |
| US04 | Text validation | 3 | Must | 1 | Done in Sprint 1 |
| US05 | Edit, cancel and retry | 3 | Must | 1 | Carried from Sprint 1, Done on day 3 of Sprint 2 |
| US06 | Repeatable Russian evaluation | 5 | Must | 2 | Done in Sprint 2 |
| US07 | Kazakh evidence limits | 5 | Must | 2 | Done in Sprint 2, essay coverage remains open |
| US08 | Browser and model parity | 5 | Must | 2 | Done in Sprint 2 |
| US09 | Index and uncertain state | 3 | Must | 2 | Done in Sprint 2 |
| US10 | Fixed evaluation inputs | 5 | Must | 2 | Done in Sprint 2, overlap risks documented |
| US11 | Responsive workflow | 3 | Should | 3 | Done in Sprint 3 |
| US12 | Unicode PDF report | 5 | Should | 3 | Done in Sprint 3 |
| US13 | Highlighted passages | 5 | Should | 3 | Done in Sprint 3 |
| US14 | Five-person user pilot | 8 | Should | 3 | Carried to Sprint 4, Done with comprehension below target |
| US15 | Ranked defects | 3 | Must | 3 | Done in Sprint 3 using the laboratory-review fallback |
| US16 | Model and data records | 3 | Must | 4 | Done in Sprint 4 |
| US17 | Measured loading and processing | 5 | Should | 4 | Returned to backlog with five task hours remaining |
| US18 | Stable HTTPS address | 3 | Must | 4 | Done in Sprint 4 |
| US19 | Short user guide | 3 | Must | 4 | Done in Sprint 4, timing targets explicitly unmeasured |
| US20 | Release checklist | 5 | Must | 4 | Done in Sprint 4 for a guided demonstration |

All 15 Must stories are completed in the simulation. Could items include extra file formats, configurable thresholds and batch review. Handwriting, plagiarism checking, student accounts and LMS integration remain outside this cycle.

## Adaptation decisions

| Sprint | Trigger | Response and acceptance consequence |
| --- | --- | --- |
| 1 | A cancel-and-retry path leaves Analyze disabled | US05 earns zero SP. Its remaining four task hours and full three SP carry to Sprint 2. |
| 1 | Two of six simulated phone photos fall below 90% character accuracy | Controlled-scan acceptance remains bounded. Photograph guidance enters US19. |
| 2 | US05 needs recovery work | OCR and frontend contributors pair and close it on working day 3. |
| 2 | Independent Kazakh student essays are unavailable | US07 documents the evidence gap and permitted use. The permission dependency stays open. |
| 3 | Three of five simulated volunteers attend | Two sessions move to Sprint 4. US14 earns zero SP in Sprint 3. US15 uses the laboratory fallback. |
| 3 | The review exposes PDF wrapping and navigation concerns | PDF wrapping is resolved in the simulation. Navigation and comprehension concerns limit the release to a guided demonstration. |
| 4 | Holiday availability falls by three person-hours | The team protects Must work and returns US17 to the backlog. |
| 4 | US19 depends on unfinished US17 | The Product Owner revises the dependency. The guide identifies timing as unmeasured and avoids speed promises. |

The completed simulated pilot records **4/5 independent completions** and **3/5 correct explanations of the index**. Running the sessions and reporting the outcome satisfies US14's story criteria. The broader comprehension target remains open.

## Definition of Done and capacity

A completed story has verified acceptance criteria, reviewed changes, passing applicable tests and current documentation. Model changes additionally require frozen weights, split checks, group-level evaluation and browser parity. Release changes require a hosted smoke check. Unfinished stories earn zero SP.

| Sprint | Task hours | Events and refinement | Additional reserve work | Total used | Available |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 40 | 25 | 8 | 73 | 80 |
| 2 | 52 | 25 | 3 | 80 | 80 |
| 3 | 44 | 25 | 11 | 80 | 80 |
| 4 | 39 | 25 | 13 | 77 | 77 |
| **Total** | **175** | **100** | **35** | **310** | **317** |

Reserve covers additional support work and excludes time already counted in tasks or events. Daily task-hour checkpoints are available in [burndown.csv](burndown.csv). SP express relative effort and uncertainty, while task hours support capacity planning.

## Educational role rotation

The simulation assigns one Scrum Master and one Product Owner at a time. All five members also contribute as Developers. Sprint 4 includes an educational handover after working day 5 so every member experiences both accountabilities. Durations differ between members.

| Sprint | Scrum Master | Product Owner |
| --- | --- | --- |
| 1 | Altynay | Diar |
| 2 | Nurzhan | Bakytzhan |
| 3 | Zhandos | Altynay |
| 4, working days 1–5 | Diar | Zhandos |
| 4, working days 6–10 | Bakytzhan | Nurzhan |

Handover notes preserve the Sprint Goal, backlog order, open risks and pending decisions. The next cycle should confirm external-dependency ownership and follow-up dates at every handover.

## Retrospective follow-through

| Action | Owner | Check | Simulated result |
| --- | --- | --- | --- |
| Write failure scenarios early and split tasks above five hours | Altynay | Sprint 2 finishes without carry-out | Met, 26 of 26 SP completed |
| Confirm volunteer slots before Sprint 3 Planning | Bakytzhan | Five confirmed sessions | Missed, recruitment started late and three attended |
| Agree the scope cut line at Planning | Zhandos | Protect Sprint 4 Must items | Met, US17 deferred |

Future planning uses the four-Sprint mean of 19.5 SP alongside actual availability and dependencies. Further actions are to split stories above five SP, observe users during each Sprint and assign a named check to each retrospective action.

## Open work

- Complete named-device loading and processing benchmarks, including cold/warm runs and p50/p95. [US17](https://github.com/Kerey404/docusleuth-ai/issues/2)
- Obtain permitted independent Kazakh student essays and long paraphrases for evaluation. [Model limitations](../../VALIDATION.md)
- Run real user-comprehension sessions and classroom-photo checks before broader classroom adoption.
- Maintain issue-to-code links on [Jira project DS](../jira/) as follow-up work proceeds.
