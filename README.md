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

## G3 simulator plan and review status

### 可操作平台審閱版

已建立[六頁操作平台](sites/g3-platform/README.md)：工作台、參數設定、五階段結果、逐股重播、假設與留言及版本比較。參數會實際傳入重播核心；示例採合成資料，不是市場回測。此版不接券商或實盤。

未定義的內容依用戶指示採用[22 項可追溯暫定假設](docs/G3-platform-assumptions-zh-HK.md)，沒有覆寫原始 v3。留言只存在當前瀏覽器，可連同設定及運行結果匯出 JSON 審閱包。01c 對話仍未納入。

在 repo 根目錄可執行：

```sh
python3 -m http.server 8010 --bind 0.0.0.0 --directory sites/g3-platform
npm test --prefix sites/g3-platform
```

發布來源分支為 `g3-platform-review`，部署工作流程為 [G3 review platform](.github/workflows/g3-review-pages.yml)。GitHub Pages 須由 repo Settings 啟用 GitHub Actions 來源並允許此分支；推送程式不代表網址已上線。實際部署狀態見 [docs/STATUS.md](docs/STATUS.md)。

The G3 implementation plan has been reviewed through three independent agent perspectives: programmatic trading, software engineering, and investor usability. A review implementation now runs on explicit provisional assumptions; the complete v3 simulator and historical-data workflow have not been accepted as G3-complete. Earlier plans and briefings retain their original preparation context.

- [Revised implementation plan](docs/G3-simulator-plan.md)
- [Trading review](docs/reviews/G3-trading-review.md), [engineering review](docs/reviews/G3-engineering-review.md), and [investor review](docs/reviews/G3-investor-review.md)
- [Browser and printer-friendly HTML](output/html/G3-review.html): download the file and open it in a browser; GitHub's file view displays the HTML source.
- [PDF containing the plan and all three reviews](output/pdf/G3-simulator-plan-and-reviews.pdf): open the GitHub file view and select **Download raw file** to save it.
- [Current project status and next steps](docs/STATUS.md)
- 香港繁體中文六頁簡報：[PowerPoint](output/slides/G3-engine-briefing-zh-HK.pptx)｜[PDF](output/slides/G3-engine-briefing-zh-HK.pdf)｜[離線瀏覽器版](output/slides/G3-engine-briefing-zh-HK.html)。內容包括引擎架構、建置路線、16 項開工前決策及系統限制；下載後開啟。

No public live URL for the G3 review page has been verified. A repository file URL is not a hosted website; publishing the prepared HTML requires a connected hosting service or GitHub Pages configuration.

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
