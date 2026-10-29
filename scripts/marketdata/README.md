# Massive：私人下載與真實資料重播

此目錄只有程式及無憑證測試；不包含任何付費原始行情。API key 必須從安全環境變數 `MASSIVE_API_KEY` 注入，只送至 `https://api.massive.com` 的 HTTPS Bearer header。不能放進 Git、指令參數、查詢字串、日誌或公開網站。

## 安全設定及目前阻擋

本對話綁定的 Codex 環境名稱為 **Win-win**。請在該環境的 Secrets 為 `MASSIVE_API_KEY` 提供值，完成儲存／套用／發布。只填名稱並不等於綁定了值；也不能用 GitHub Actions secrets 代替本機環境注入。工具只檢查名稱及 `has_saved_binding`，不讀回或顯示憑證值。

截至這次檢查，配置需求已存在，但 `has_saved_binding: false`、執行環境沒有此變數，故尚未能取得訂閱資料。這不判定 key 是否有效；亦不代表用戶沒有在其他位置輸入。

## 一旦綁定可用，先小量驗證再保存

```sh
python3 scripts/marketdata/archive_massive.py --probe-only --start 2026-09-01 --end 2026-10-28
python3 scripts/marketdata/archive_massive.py --start 2026-09-01 --end 2026-10-28
```

預設保存到 `/workspace/private/market-data/massive/`，位於公開 repo 之外。預設依序：

1. 小量分鐘線驗證認證及方案權限。
2. 保存 12 隻固定研究股票在指定範圍內的分鐘線，先保住重播所需資料。
3. 保存各有行情日的全市場 grouped daily aggregates。
4. 嘗試保存上述研究股票逐日 reference `?date=` 快照；權限被拒便記錄，不反覆重試同一類無權限端點。
5. 若預算仍足夠，按最後可用日的成交量補充分鐘資料，最多至 50 隻。這是下載優先次序，**不是無偏差的歷史選股**。

預設每分鐘最多 120 次請求、整次最多 2,500 次及 1 GiB 新增原始回應；遇到 429／暫時錯誤會有限次退避。所有分頁均保留，不把 page size 當成總數；分頁只准同一 HTTPS host。已保存檔有 SHA-256 校驗，可中斷後重跑。錯誤回應不輸出 body，日誌／原始 JSON 亦會移除 credential 欄位；若成功回應意外包含 key，拒絕保存。

可用 `--symbols`、`--expand-minute-symbols`、`--max-requests`、`--max-bytes` 設定合理範圍。沒有 API key 不能核實方案內容或截止時間；下載完成不代表訂閱到期後的保存／使用權不受條款限制。

## 指定過去一個月任一完整交易日做 dry run

下載範圍須涵蓋欲測日、前日及 20 個前置完整交易日，並額外有最早回看日前收市價。範例以 **2026-10-28** 為交易日，原始資料尚未取得時不能宣稱已成功運行：

```sh
python3 scripts/marketdata/build_massive_dataset.py --archive /workspace/private/market-data/massive --date 2026-10-28 --output /workspace/private/market-data/massive-dry-run-2026-10-28.json
node scripts/marketdata/run_private_replay.mjs /workspace/private/market-data/massive-dry-run-2026-10-28.json /workspace/private/market-data/massive-result-2026-10-28.json
```

將生成的私人 dataset JSON 透過平台「參數設定 → 匯入資料 JSON」載入，然後執行重播。換日期可重新建檔，毋須重新下載已校驗快取。不會把付費 dataset 自動複製到公開 GitHub Pages；若要在網站預載，須另核實資料重發授權及私人儲存方式。

## 資料檢查及明確限制

- 逐分鐘 key 為股票＋UTC 開始時間；重複相同值記數，有衝突則封鎖。
- 只保留紐約正常交易時段，逐日核對 390 個唯一連續分鐘；缺值、停牌、半日市不前向填補。
- 檢查 OHLC 及 volume 的型別、正數／非負值及高低關係。
- 原始 gzip 保存校驗值；manifest 路徑不能跳出私人目錄。
- 市值必須有該日期 reference 回應；缺市值不能拿今天值回填。供應商 `?date=` 是其 as-of 聲明，**不是獨立驗證過的原始公布時間**；輸入的市值可用時刻暫設當日收市，並寫入 quality report。
- 分鐘價採下載時的拆股調整版；尚未獨立核對公司行動、股本修訂及實際可成交報價。
- 12 隻為固定研究子集，不是全 IB 股票池；即使五階段成功，也不是完整 G1/G2/G3 驗收或盈利證明。
- 檔案附 source manifest SHA、品質報告及嚴重問題清單；有必要資料問題時不生成可運行檔案。

官方接入依據：Massive 官方 [Python client](https://github.com/massive-com/client-python)、[aggregate endpoints](https://github.com/massive-com/client-python/blob/master/massive/rest/aggs.py)、[reference endpoints](https://github.com/massive-com/client-python/blob/master/massive/rest/reference.py)。本工具採 Python 標準庫，不需安裝 SDK。

## 無真實 key 的測試

```sh
python3 -m unittest discover -s scripts/marketdata -p 'test_*.py' -v
```

測試覆蓋 header-only 認證、去除 key、分頁目的地、快取／校驗／預算、憑證意外回傳封鎖、390 分鐘轉換及缺歷史 reference 阻擋。這些是合成 fixture 測試，不是 Massive 訂閱或真實行情請求驗證。
