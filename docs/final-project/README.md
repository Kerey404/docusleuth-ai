# Final project evidence

DocuSleuth AI supports printed-essay review in English, Russian and Kazakh. This page connects the working prototype, published engineering records and the Agile execution exercise for Team Project 2 Part 2.

**[Open the application](https://kerey404.github.io/docusleuth-ai/)** · **[Review the four sprints](SPRINTS.md)** · **[Read model validation](../../VALIDATION.md)**

The academic simulation covers 16 November 2026 to 10 January 2027. Its backlog contains **20 stories and 83 story points**, with **78 SP completed** and **US17 open at 5 SP**. Sprint meetings, hours, completion decisions, user feedback and the rollback rehearsal are simulated. Product code, model files and validation records are available in the repository.

## A short review route

1. Open the application and select an English, Russian or Kazakh example.
2. Compare the scan with its editable transcription, run the analysis and download the PDF.
3. Read the model evaluation, including false flags, missed paraphrases and the Kazakh essay coverage gap.
4. Follow the sprint record from the original commitments through carry-over and the final open task.

| Material | What it provides |
| --- | --- |
| [Observed live-site check](DEMO_CHECK.md) | EN/RU/KZ workflow results, PDF extraction, responsive checks and screenshots from 15 November 2026 |
| [Sprint record](SPRINTS.md) | All 20 stories, MoSCoW priorities, estimates, outcomes and role handovers |
| [Daily burn-down CSV](burndown.csv) | The 11 simulation checkpoints used by the report charts |
| [Jira project evidence](../jira/) | The live project's exported stories, estimates, Sprint assignments and screenshots |
| [Original Jira import template](jira-backlog.csv) | Initial Sprint allocation and acceptance criteria for the 20 stories |
| [Validation record](../../VALIDATION.md) | Training counts, test denominators, model comparisons and limitations |
| [Published product baseline](https://github.com/Kerey404/docusleuth-ai/commit/3508a56484a5d34fa721ef8258800fcb42deccf9) | The exact repository revision used for the report's product evidence |
| [US17 performance follow-up](https://github.com/Kerey404/docusleuth-ai/issues/2) | The open request for named-device cold/warm measurements and p50/p95 timings |

## Product evidence and its coverage

The links below pin the product revision used in the report. Test scripts show the implemented assertions. Published validation statements describe earlier measurements. A fresh execution requires the dependencies and fixtures expected by each script.

| Stories | Inspectable evidence | Coverage and remaining evidence |
| --- | --- | --- |
| US01 | [Use and interpretation guidance](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/README.md) | User-facing limits are published. The consent and evaluation protocol belongs to the simulated exercise. |
| US02–US05 | [Application flow](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/dist/app.mjs), [OCR](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/dist/ocr.mjs), [workflow assertions](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/qa/full-audit.mjs) | Language selection, input limits, editable text, cancellation and recovery have implementation and test-source evidence. Real classroom-photo trials remain unvalidated. |
| US06–US07 | [Validation record](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/VALIDATION.md), [machine-readable metrics](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/dist/models/validation.json) | Language/domain denominators and false flags are published. Independent Kazakh student-essay validation remains open. |
| US08 | [Parity assertions](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/qa/model-parity.mjs), [model inference](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/dist/model.mjs) | Validation reports 58 matching cases. The script expects local language-specific parity fixtures that are absent from this published baseline. |
| US09 | [Interface language strings](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/dist/strings.mjs), [interpretation guidance](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/README.md) | Index meaning, uncertainty and human-review guidance can be inspected. Reviewer comprehension sessions are simulated. |
| US10, US16 | [Model audit source](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/qa/audit-models.py), [validation and limitations](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/VALIDATION.md) | Model versions, training counts, metric definitions, reused tests and CoAT overlap risk are documented. Reproduction needs the separately prepared evaluation data and training dependencies. |
| US11–US13 | [Layout and recovery assertions](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/qa/full-audit.mjs), [PDF implementation](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/dist/report.mjs), [PDF audit](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/qa/audit-pdf.py) | Responsive states, Unicode PDF output, long-text export and passage guidance have implementation and test-source evidence. |
| US14–US15 | [Sprint 3 and Sprint 4 record](SPRINTS.md) | Pilot attendance, observations and defect-triage decisions are simulated. Real participant records are unavailable. |
| US17 | [Open performance issue](https://github.com/Kerey404/docusleuth-ai/issues/2) | Named-device timing measurements remain outstanding. |
| US18–US19 | [Pages workflow](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/.github/workflows/pages.yml), [user guide](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/README.md) | Deployment configuration and operating instructions are published. The report's rollback rehearsal is simulated. |
| US20 | [Sprint 4 release decision](SPRINTS.md) | The final acceptance checklist is part of the simulation. Its remaining timing and comprehension restrictions are recorded. |

## Burn-down data

Each row of [burndown.csv](burndown.csv) is a working-day checkpoint. **Checkpoint 0** holds the Sprint's opening task-hour balance. Checkpoints 1–10 hold the remaining task hours. The chart's ideal series is `opening hours × (1 − checkpoint / 10)`.

| Sprint | Opening task hours | Closing task hours | Task hours spent | Closing item |
| --- | ---: | ---: | ---: | --- |
| 1 | 44 | 4 | 40 | US05 carried to Sprint 2 |
| 2 | 52 | 0 | 52 | All selected work completed |
| 3 | 46 | 2 | 44 | US14 carried to Sprint 4 |
| 4 | 44 | 5 | 39 | US17 returned to the backlog |

These simulated task-hour balances exclude event and reserve hours. An unfinished story earns zero completed SP until its acceptance criteria and Definition of Done are met. The release burn-down uses unique remaining SP at Sprint-end checkpoints, giving **83 → 69 → 43 → 27 → 5**.

## Jira board and Sprint data

The [Jira board](https://docusleuth-ai.atlassian.net/jira/software/projects/DS/boards/2/backlog) holds the 20 stories as DS-5 through DS-24. The [export and screenshots](../jira/) reflect the board snapshot and show the Sprint allocation after moving US05 to Sprint 2 and US14 to Sprint 4.

The snapshot marks all 20 stories Done, including DS-21 (US17). The report's 78 completed SP and open US17 come from the simulation. The named-device benchmark remains tracked as an open [GitHub follow-up](https://github.com/Kerey404/docusleuth-ai/issues/2).
