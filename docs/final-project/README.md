# DocuSleuth AI final project evidence

The four sprints, completion statuses and hours below represent the academic simulation. The published prototype and the pinned repository files provide engineering evidence.

- [Published prototype](https://kerey404.github.io/docusleuth-ai/)
- [Pinned product baseline](https://github.com/Kerey404/docusleuth-ai/commit/3508a56484a5d34fa721ef8258800fcb42deccf9)
- [Working-day burn-down data](burndown.csv). Checkpoint 0 is the planned opening balance. Sprint-end balances are 4, 0, 2 and 5 task hours. Release scope in SP is 83 → 69 → 43 → 27 → 5.
- [Jira import for the 20 stories](jira-backlog.csv). The unique backlog totals 83 story points. Simulated completion totals 78 story points.

| Story IDs | Published engineering evidence |
| --- | --- |
| US01–US05 | [Browser workflow checks](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/qa/browser.mjs), [OCR and input](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/dist/ocr.mjs) |
| US06–US10, US16 | [Validation results](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/VALIDATION.md), [Parity test](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/qa/model-parity.mjs), [Published metrics](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/dist/models/validation.json) |
| US11–US13 | [Responsive and PDF checks](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/qa/full-audit.mjs), [PDF implementation](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/dist/report.mjs) |
| US18–US19 | [Pages workflow](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/.github/workflows/pages.yml), [User guide](https://github.com/Kerey404/docusleuth-ai/blob/3508a56484a5d34fa721ef8258800fcb42deccf9/README.md) |

US14 and US15 describe simulated feedback and defect triage. US17 remains open. The simulated US20 checklist and rollback rehearsal belong to the exercise.

## Jira setup

Use a Scrum space. Enable story point estimates and create Sprint 1 through Sprint 4. Map Summary, Work Type, Description, Story Points and Labels in the CSV importer. Use the Sprint labels to schedule the initial scope. Follow the carry-over notes for US05 and US14 when rehearsing the exercise. Keep the remaining timing task US17 in the backlog after Sprint 4. Simulated outcomes are recorded in descriptions so the import starts as planned work.

[Atlassian CSV import instructions](https://support.atlassian.com/jira-software-cloud/docs/import-data-to-a-software-project-using-a-csv-file/)
