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

按最新要求，全平台字體在保留層次下放大 30%，以同一 CSS 變數控制，並檢查桌面及兩種手機寬度。另新增 [Massive 私人下載及正規化工具](../scripts/marketdata/README.md)，具備安全認證、限速、分頁、續傳、校驗及資料品質封鎖；真實資料仍未取得，不能宣稱已完成市場 dry run。最新憑證檢查為 `has_saved_binding: false` 且執行環境沒有 `MASSIVE_API_KEY`；只記錄狀態，不記錄值。

## Publication and download status

平台已由 GitHub Pages 發布至 **https://newprojectshkau.github.io/Win-win/**。原部署記錄 [40761600840](https://github.com/newprojectshkau/Win-win/actions/runs/40761600840) 的第三次嘗試已成功；用戶已啟用 Pages 並允許 `g3-platform-review` 分支部署，先前的 Not Found 及環境分支保護問題已解除。

介面按用戶提供的截圖改為白底、橙色重點、頂部膠囊按鈕導覽、章節編號及分隔線。加大字體、輸入欄、表格行距與留言框；手機版頂部顯示全部導覽按鈕。這次改動不涉及策略計算、儲存鍵或既有留言資料。新版本的發布仍以該次 GitHub Actions 結果為準。

此環境對 `newprojectshkau.github.io` 的直接請求仍可能被代理擋住；部署成功證據與本環境 HTTP／瀏覽器檢查須分開記錄。平台[介面截圖](images/g3-platform-desktop.png)及[設定頁截圖](images/g3-platform-settings.png)已更新。發布只含平台靜態檔，不包含留言、憑證或自行匯入資料。

After these files are pushed, use the GitHub repository branch containing them. For the PDF, open `output/pdf/G3-simulator-plan-and-reviews.pdf` and choose **Download raw file**. For offline browser review, download `output/html/G3-review.html` and open it locally, then use **Print / Save as PDF** if desired. All document content and styling are embedded in that HTML; external repository source links require connectivity.

The downloadable briefing and source-review documents are separate from the hosted platform; repository links are file views, not substitutes for the live URL.

## Verification evidence

平台核心新增 17 項 Node 測試，涵蓋手算計數、複利、股數同距、精確 RR 比較、h 限制、無事件、先平倉再反手、時段尾清倉、因果、重跑一致、前日輸入隔離、設定傳遞、缺漏／遲公布及極端資料拒絕。Chromium 檢查六頁操作、參數改動、舊版本鎖定、留言保存、文字注入安全、審閱 JSON 匯出、圖表／成交表及手機寬度。測試成功並不證明歷史資料或真實成交正確。

Earlier validation confirmed Python 3.12, a successful local HTTP response for the original static website, and offline reproduction of all 20 saved symbol/session RR results and event logs. This was a check of the existing assumed research model, not the proposed v3 simulator. The G3 HTML was separately checked in Chromium for four document sections, internal navigation, tables, mobile width and print rendering. The PDF was checked for all four document titles.

The research/export checks above were recorded during the earlier preparation work. The latest interface change passed the existing browser interaction suite, plus layout checks for six pages at 390px and 320px. It does not constitute a new historical-data or execution-realism validation. Strategy parameters and historical research outputs were not changed.
