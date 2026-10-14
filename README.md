# Win-win

美股 Renko 日內交易模型：策略規格、來源資料、RR 比較及互動圖解。

## Project contents

- [Current strategy specification (v3)](model/投資模型規格_v3.md)
- [Current parameters](model/parameters.json)
- [Transcript reconciliation](model/逐字稿差異核對.md)
- `model/archive/`: earlier specification and parameter snapshots.
- `imports/AL-briefing-01/`: two meeting transcripts and five reference photos.
- `output/pdf/`: illustrated review PDFs.
- `output/rr-comparison-2026-10-13/`: saved minute data, event counts, comparison results, sources, and the analysis script.
- `sites/investment-roadmap-hk/dist/index.html`: self-contained website preview.

v3 is the current strategy definition. Earlier PDFs and the website may reflect earlier versions; use v3 and `model/parameters.json` when resolving differences. This project currently contains research and specifications, not a complete trading execution system.

## Open in browser Codex

Repository: https://github.com/newprojectshkau/Win-win

1. Sign in to Codex on the web and choose **Work in > Cloud**.
2. Choose **Create environment**, connect GitHub if prompted, and select this repository. If it is unavailable in your repository selector, fork it into your own GitHub account and select the fork.
3. Let Codex prepare the environment, review the setup, and select **Publish**.
4. Start a new task using the published environment. Ask Codex to read this README, `model/投資模型規格_v3.md`, and `model/parameters.json` first.

A public repository lets everyone browse and clone the files. Each person still needs their own Codex access and an environment configured for the repository or their fork. Direct pushes require repository write access; other contributors can submit pull requests from forks.

Official setup guide: https://learn.chatgpt.com/docs/environments/cloud-environments

## Preview the website

No build step or package installation is required. With Python 3 installed, run from the repository root:

```sh
python3 -m http.server 8000 --directory sites/investment-roadmap-hk/dist
```

Open http://localhost:8000 in a browser, or use the cloud environment's forwarded preview URL.

## Analysis and PDF notes

`output/rr-comparison-2026-10-13/compare.py` uses Python 3.9+ standard-library modules. Saved JSON results can be inspected without network access. Running the script fetches Yahoo Finance's rolling five-day minute data and overwrites result files. Its target date is fixed to 2026-10-13, so a later rerun may fail its completeness checks once that date leaves the provider's retention window. The calculation is an assumed event model and RR ranking comparison, not a trading backtest.

The supplied PDFs are available without dependencies. Their original generation scripts use ReportLab and macOS system fonts and are retained under `scripts/pdf/`; regenerating on Linux requires adapting the font paths.
