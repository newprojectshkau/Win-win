# G3 策略重播及審閱平台

香港繁體中文審閱版；純靜態網站、瀏覽器內計算、沒有第三方前端依賴、沒有實盤下單功能。

## 運行及測試

從此目錄執行 `npm start`，或從 repo 根目錄執行：

```sh
python3 -m http.server 8010 --bind 0.0.0.0 --directory sites/g3-platform
npm test --prefix sites/g3-platform
```

Node 22+ 用於內建測試；Python 3 只用於本地靜態伺服器。無需 `npm install` 或編譯。正式網站須以 HTTPS 提供，讓瀏覽器可計算 SHA-256；本機 loopback 亦受支援。

## 審閱流程

1. 工作台預設運行 12 隻虛構股票、22 個合成正常交易日，早市通過、午市跳過。
2. 在參數頁修改數值，儲存草稿後重新重播；舊運行不會改變，最多本地保留四次。
3. 核對五階段輸出、逐股圖表、持倉及成交。淨額是理想化成交下的賬本診斷，不是回測表現。
4. 在「假設與留言」逐項審閱 A01–A22，可標記接受暫定或要求修改；這只是意向，不會改寫策略。
5. 匯出 JSON 審閱包，將假設、留言、設定及運行結果一次過交回。留言只存在本瀏覽器；換裝置或清除網站資料前請備份。
6. 可以把審閱包匯回以還原留言，但不會自動執行其參數或替換運行紀錄。

原始 `model/parameters.json` 保留全部已定及未定規格；沒有把此版假設回寫成用戶已批准的規則。01c 對話仍未納入。

## 檔案與架構

- `engine.js`：設定及資料驗證、整數價格 Renko 計數、四項篩選、排名、配注、整段開關、持倉／理想化成交及指紋。
- `assumptions.js`：已知設定與 22 項暫定假設，供介面、匯出及文件使用。
- `app.js`：六個操作頁、草稿／鎖定運行、本地留言、比較、匯入及匯出。
- `index.html`、`styles.css`：響應式介面；不載入外部字型或套件。
- `tests/engine.test.js`：獨立手算、因果、邊界、無事件、平倉反手、零分母、資料缺漏及五階段測試。
- `build.json`：本地標示為 development；GitHub Actions 發布時注入實際程式 SHA。

## 自行匯入資料

先在參數頁下載目前資料作結構範本，另存及修改；不要覆寫 repo 原有研究輸出。檔案上限 40 MB，所有處理留在瀏覽器，不會上傳。自訂資料應標示 `kind: "imported"`。

```json
{
  "schemaVersion": 1,
  "id": "provider-reviewed-snapshot-001",
  "kind": "imported",
  "description": "資料範圍及用途說明",
  "providerStatement": "供應方、授權、價格調整及歷史股票池聲明",
  "instruments": [{
    "symbol": "EXAMPLE",
    "sessions": [{
      "date": "2026-10-13",
      "marketCap": 5000000000,
      "marketCapAvailableAt": "2026-10-13T13:29:00Z",
      "previousClose": 100,
      "bars": [{
        "time": "2026-10-13T13:30:00Z",
        "availableAt": "2026-10-13T13:31:00Z",
        "open": 100, "high": 100.2, "low": 99.9,
        "close": 100.1, "volume": 50000
      }]
    }]
  }]
}
```

上面只示範欄位，不能直接運行：每時段需要 390 根完整正常市況分鐘線，各股票相同日期，最後一日作交易日，之前至少有所選回看時段數。每個時段另有前收市價以計波幅分母；第一個回看日亦需要此欄位。時間必須含時區、按紐約 09:30–16:00 驗證；不補值、不猜分鐘內路徑。市場日曆、公司行動、歷史證券範圍與供應商資料真確性仍需外部核實。

## 部署

`.github/workflows/g3-review-pages.yml` 在 `g3-platform-review` 分支更新後測試及發布六個必要靜態檔案，不會發布匯入資料、留言或憑證。需要 repo 的 **Settings → Pages → Source: GitHub Actions** 已啟用，並允許此分支部署到 `github-pages` 環境。工作流程不得繞過 repo 的環境審批或保護設定。

預期 GitHub Pages 位置須以實際部署輸出為準；僅推送程式、工作流程或發布到預備分支，不代表已成功公開或網址已驗證。
