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

按最新要求，全平台字體在保留層次下放大 30%，以同一 CSS 變數控制，並檢查桌面及兩種手機寬度。另新增 [Massive 私人下載及正規化工具](../scripts/marketdata/README.md)，具備安全認證、限速、分頁、續傳、校驗及資料品質封鎖；2026-10-29 Publish 後已驗證 Massive 安全綁定及 API 成功，首批 12 隻股票已保存 413,381 筆分鐘行情。按最新授權，已啟動 2025-10-29 至 2026-10-28 的全年私人保存：12 隻核心及最多 50 隻分鐘線、全市場每日行情、12 隻逐日 reference。採每分鐘 8 次請求，保存仍在進行；尚未完成全年覆蓋檢查或真實市場 dry run。詳見下載工具 README。

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


## 多日績效模擬（2026-10-29）

新增 `simulator.html` 期間績效頁，沿用原有五階段引擎、20 個前置交易日及暫定成交規則。支援累計美元損益、費用與滑點拆解、收市最大回撤、逐日／逐股結果、篩選及開關原因、成交明細及 JSON／CSV 匯出。回撤僅按收市點計算；未實作賬戶保證金限制，不顯示本金回報率或年化績效。

公開版不預載訂閱行情，提供私人 JSON 匯入及明確標示的合成示例。私人單檔 HTML 內嵌資料與引擎，可離線審閱。首個真實資料範圍已完成：NVDA、TSLA、AMD，2026-10-15 至 2026-10-28 共 10 個交易日，另含 20 日回看資料，合計 35,100 筆正常交易時段分鐘線。完整性／校驗通過，沒有補造市值或分鐘資料；固定三股子集不等於完整歷史股票池。私人資料、結果、CSV、單檔 HTML 及 ZIP 保存在 repo 外。

20 項 Node 測試及 6 項資料適配器測試通過。瀏覽器驗證原有六頁、新績效頁、設定重算、逐日切換、匯入拒絕保留舊結果、JSON／CSV 匯出及 390／320px 排版。單檔打包版經本地 HTTP 驗證可自動重播，除 HTML 本身外沒有額外請求。本環境瀏覽器政策阻擋 file:// 導覽，因此未在此環境直接驗證雙擊開檔。

真實資料驗證：命令列及瀏覽器的資料指紋和績效摘要完全一致；獨立逐筆對平現金流、費用、累計損益、收市回撤及期末歸零。滑點由 5 增至 10 基點的敏感度測試保持成交筆數一致，淨盈虧不增加。完成優先資料補齊後，全年下載已恢復。公開模擬頁已確認 HTTP 200；首次部署記錄為 [40871234903](https://github.com/newprojectshkau/Win-win/actions/runs/40871234903)。


## 真實資料主入口（2026-10-30，墨爾本）

網站根目錄改為導向 `simulator.html`，原合成規則工作台保留於 `review.html`。績效頁移除 DEMO 入口並拒絕 synthetic 資料，顯示可測試日期，新增單日／日期範圍模式。私人行情首次匯入後保存在同一瀏覽器的 IndexedDB，下次自動載入；保存失敗會明確提示，不能保證跨裝置或清除網站資料後仍保留。

已驗證根頁跳轉、真實 JSON 匯入、重新開啟恢復、2026-10-20 單日重播、週末日期拒絕、舊結果保留及手機排版。預載私人 HTML 同步更新，10 日結果仍與命令列完全一致。可用日期仍為 2026-10-15 至 2026-10-28，三股 NVDA／TSLA／AMD，不宣稱全年均可完整重播。

全年下載曾因 HTTP 回應不完整中斷；已加入此類傳輸錯誤的有限重試，並從校驗快取續傳，調低至每分鐘 5 次請求。


## 瀏覽器下載交付（2026-10-30，墨爾本）

本地工作區檔案連結在用戶端開成預覽器，無法完成下載。新增 `private-download.html`，將原始 JSON gzip 後以隨機 AES-256-GCM 金鑰加密，公開網站只保存密文。金鑰及完整存取連結保存在 repo 外並只透過私人對話交付；連結 fragment 不送至 HTTP 伺服器，頁面讀取後移除當前歷史項目的 fragment。

下載頁在瀏覽器解密及驗證資料，可觸發標準 JSON 下載，或存入同源 IndexedDB 後直接進入模擬器。此功能沒有把 API key 放進網站，也沒有公開明文行情。缺少／錯誤金鑰會封鎖，正確連結的瀏覽器下載檔與原始 JSON 位元組完全一致；直接載入後 10 日重播完成，瀏覽器請求不含存取金鑰。
