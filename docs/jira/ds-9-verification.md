# DS-9 OCR review and recovery

[Jira story DS-9](https://docusleuth-ai.atlassian.net/browse/DS-9) corresponds to US05, **Edit OCR output, cancel and retry**. The exported story is a Must with 3 story points and is assigned to Sprint 2.

## Acceptance check for the demo

1. Open the [live site](https://kerey404.github.io/docusleuth-ai/), set the document language and open its built-in example. Wait for recognition to populate the review editor.
2. Correct a word in the editor. Verify that **Analyze text** works with the edited transcription and opens the report.
3. Select **Back to text**. Edit the transcription again and verify the previous report is invalidated.
4. Start a new scan and select **New document** from the review screen before recognition completes. Open the example again. Verify that recognition completes, **Analyze text** becomes available, and the new report uses the current transcription.

The last step is easiest to reproduce on a fresh page where OCR language data has not been cached. The automated [workflow checks](../../qa/full-audit.mjs) cover canceling during initialization, keeping edits when a replacement scan is dismissed, and retrying after canceling a sample. The [published-site check](../final-project/DEMO_CHECK.md) records successful sample runs and report invalidation after an edit.
