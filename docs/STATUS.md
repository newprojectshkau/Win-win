# Repository status

Updated: 29 October 2026 (Australia/Melbourne).

## Completed documentation

- [G3 simulator implementation plan](G3-simulator-plan.md), revised after three independent agent reviews.
- [Programmatic trading review](reviews/G3-trading-review.md).
- [Software engineering review](reviews/G3-engineering-review.md).
- [Investor usability review](reviews/G3-investor-review.md).
- [Self-contained, printer-friendly HTML review](../output/html/G3-review.html), including all four documents.
- [PDF review bundle](../output/pdf/G3-simulator-plan-and-reviews.pdf), including all four documents.
- 香港繁體中文六頁審閱簡報：[可編輯 PowerPoint](../output/slides/G3-engine-briefing-zh-HK.pptx)、[PDF](../output/slides/G3-engine-briefing-zh-HK.pdf)及[可列印瀏覽器版](../output/slides/G3-engine-briefing-zh-HK.html)。涵蓋引擎架構、建置路線、16 項決策及系統限制；屬建議設計，並非完成建置或批准紀錄。

The reviews are analytical agent assessments through the requested perspectives, not professional endorsements. The original document and export dates are retained. Conditional roadmap dates have not been rebaselined and are not evidence that scheduled milestones were completed.

## Implementation readiness

簡報已按[原始資料核對](G3-checklist-01-source-audit-zh-HK.md)修訂：第 3 頁分列「已有設定」及「待補細節」，不再把所有項目當成未定；01c 對話尚未取得，已在簡報註明。PowerPoint、PDF 及瀏覽器版已同步更新。

已按用戶授權建立操作平台審閱版（`sites/g3-platform/`）：六個頁面、可運行五階段合成資料重播、JSON 格式驗證及匯入、參數草稿與鎖定版本、逐股價格／成交紀錄、本地假設留言及 JSON／CSV 匯出。未定事項採[22 項明確假設](G3-platform-assumptions-zh-HK.md)，不升格為已批准策略。01c 仍未取得。

目前沒有完整歷史資料的 G2/G3 驗收、真實券商成交限制、實盤接駁或盈利驗證。原始策略權威仍是 v3 及 `model/parameters.json`，沒有改寫。合成股票、成交淨額及圖表均不構成市場結果。

下一步是讓用戶試操作介面並匯出集中意見，確認暫定規則，再導入經核實授權及時點的歷史資料。舊計劃的四星期屬條件式估算，不能當成此審閱版已完成所有原定驗收。

## Publication and download status

平台部署已準備 `.github/workflows/g3-review-pages.yml`：在 `g3-platform-review` 分支推送後執行測試及發布，發布內容只含平台靜態檔，不包含留言、憑證或自行匯入資料。需要 repo 的 GitHub Pages 來源設定為 GitHub Actions，並允許該分支進入 `github-pages` 環境。GitHub API 存取仍遭 Forbidden，已保存所需 `api.github.com` 及 `newprojectshkau.github.io` 網絡設定草稿；草稿本身不代表運行環境已套用或網站已部署。

首次自動部署 [40761016249](https://github.com/newprojectshkau/Win-win/actions/runs/40761016249) 的驗證及打包已成功，部署階段因 `Get Pages site failed / Not Found` 中止。這次已得到 GitHub 端的具體錯誤，不再僅依賴本機代理失敗推測。管理者須到 repo **Settings → Pages → Source: GitHub Actions** 啟用，再重新執行最新工作流程。尚未取得可驗證的公開 live URL，不應把預期網址當成已上線。平台[介面截圖](images/g3-platform-desktop.png)已保存供先行查看。

No public live URL for the G3 HTML review has been verified. The HTML and PDF are prepared files, not proof of hosting. The current session has no callable site-publishing capability; a GitHub Pages API discovery request was blocked by the network proxy. This does not establish whether Pages is enabled or disabled on GitHub.

After these files are pushed, use the GitHub repository branch containing them. For the PDF, open `output/pdf/G3-simulator-plan-and-reviews.pdf` and choose **Download raw file**. For offline browser review, download `output/html/G3-review.html` and open it locally, then use **Print / Save as PDF** if desired. All document content and styling are embedded in that HTML; external repository source links require connectivity.

Publishing an actual live review page still requires a supported hosting connection or GitHub Pages access. No localhost address, speculative hostname or file-browser link is presented as a live site.

## Verification evidence

平台核心新增 17 項 Node 測試，涵蓋手算計數、複利、股數同距、精確 RR 比較、h 限制、無事件、先平倉再反手、時段尾清倉、因果、重跑一致、前日輸入隔離、設定傳遞、缺漏／遲公布及極端資料拒絕。Chromium 檢查六頁操作、參數改動、舊版本鎖定、留言保存、文字注入安全、審閱 JSON 匯出、圖表／成交表及手機寬度。測試成功並不證明歷史資料或真實成交正確。

Earlier validation confirmed Python 3.12, a successful local HTTP response for the original static website, and offline reproduction of all 20 saved symbol/session RR results and event logs. This was a check of the existing assumed research model, not the proposed v3 simulator. The G3 HTML was separately checked in Chromium for four document sections, internal navigation, tables, mobile width and print rendering. The PDF was checked for all four document titles.

These are recorded checks from the prior preparation/export work, not claims of a new clean-environment simulator test. Repository source code, strategy parameters and historical research results remain unchanged by this documentation update.
