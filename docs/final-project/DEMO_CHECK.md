# Published-site verification

**Result: PASS** — the published application completed the English, Russian and Kazakh demonstration workflows on **15 November 2026, approximately 18:56–18:59 UTC** (23:56–23:59 Asia/Qyzylorda).

This is an observed engineering check, separate from the academic Sprint simulation.

**[Open the application](https://kerey404.github.io/docusleuth-ai/)** · [Evidence index](README.md) · [Desktop screenshot](../assets/product-preview.png) · [Kazakh mobile report](../assets/mobile-report.png)

## Environment and procedure

- Windows; isolated headless Chrome 157.0.8103.51.
- Playwright 1.62.1 and Node.js 24.22.1.
- Desktop viewport: 1440 × 960. Emulated mobile viewport: 390 × 844 with touch enabled.
- Additional layout widths: 320, 360, 650 and 768 pixels.
- Test source: [`qa/browser.mjs`](../../qa/browser.mjs), run in hosted mode with the application's bundled examples.
- Product baseline: [`3508a56`](https://github.com/Kerey404/docusleuth-ai/commit/3508a56484a5d34fa721ef8258800fcb42deccf9). Subsequent evidence/documentation changes did not modify `dist/`.

## Results

| Check | Observed result |
| --- | --- |
| Site loading | Expected application title and upload interface |
| Input validation | Corrupt images, images over 10 MB, short text, text over 2,000 words and mismatched document language rejected |
| English workflow | Sample image → OCR → analysis → PDF download passed |
| Russian workflow | Sample image → OCR → analysis → PDF download passed |
| Kazakh workflow | Sample image → OCR → analysis → PDF download passed |
| Results | Numeric model index and highlighted passages displayed |
| Editing | Editing recognized text invalidated the previous report |
| Method dialog | Validation rows displayed; Escape closed the dialog |
| Mobile | Camera control visible; Kazakh sample OCR and analysis completed without horizontal overflow |
| Responsive layout | Overflow assertions passed at all additional widths |
| Desktop error/request monitoring | No captured application errors or unexpected console errors; no external HTTP requests observed |

The script filters expected OCR resolution notices and console messages containing `404 (Not Found)`. Request monitoring covers its desktop browser context. Hosted mode skips the local server's file-isolation checks.

The command exited with code **0** and printed:

```text
Browser flows, mobile, PDF, validation and same-origin requests passed.
Captured errors: []
External requests: []
```

A separate extraction check confirmed readable text in all three exported PDFs:

| Export | Pages | Extractable characters |
| --- | ---: | ---: |
| English | 1 | 2,204 |
| Russian | 1 | 2,328 |
| Kazakh | 1 | 2,462 |

Cyrillic and Kazakh-specific characters were present in the extracted text. The desktop and mobile screenshots linked above were captured during this run.

## Repeat the browser check

Use an existing Node.js installation, Playwright package and Chrome installation. From the repository root, run in PowerShell:

```powershell
$env:DOCUSLEUTH_PLAYWRIGHT = '<absolute path to installed playwright package>'
$env:DOCUSLEUTH_CHROME = '<absolute path to chrome.exe>'
$env:DOCUSLEUTH_URL = 'https://kerey404.github.io/docusleuth-ai/'
$env:DOCUSLEUTH_HOSTED = '1'
node qa/browser.mjs
```

The script writes screenshots to `qa/screens/` and PDFs to `qa/sample-report-{en,ru,kk}.pdf`. These generated outputs are ignored by Git; the two selected screenshots are published in `docs/assets/`.

Test-script SHA-256 at execution:

```text
838c648143e317269efa24b0f6a3e80ea6437c891e7df1a7a0f256fbf1bc8a41
```

## Scope

This check verifies the demonstrated workflow using bundled examples. It does not estimate classifier accuracy or performance percentiles. The optional ten-scan `--ocr` accuracy run was not executed here. Independent essays, physical camera capture, other browsers and real mobile hardware require separate checks. [Model evaluation and limits](../../VALIDATION.md) and [open US17 performance work](https://github.com/Kerey404/docusleuth-ai/issues/2) remain applicable.
