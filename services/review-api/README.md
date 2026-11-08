# G3 demo 留言 API

Python 3.11+ 標準庫 + SQLite，適合單一小型 demo。前端繼續 GitHub Pages，API 部署在提供 HTTPS、持久磁碟的單一容器／VM；無需 OAuth 或 Firebase。現有環境只有行情服務憑證，沒有可用的後端託管帳號／持久磁碟設定，因此本次不會假稱已部署正式 API。

## 主機設定（在主機的秘密設定介面輸入，不要在聊天貼出秘密）

- `DEMO_ACCESS_CODE`：至少 12 字元的高熵共用 demo 碼；不得放 repo、前端、URL 或 build args。
- `ALLOWED_ORIGINS`：正式值 `https://newprojectshkau.github.io`（只含 origin，不含 /Win-win）；逗號分隔多個明確來源，勿設萬用字元。
- `DATABASE_PATH`：`/data/reviews.sqlite3`；`/data` 必須是持久掛載，並可由 UID 10001 寫入。
- `COOKIE_SECURE=true`、`PORT=8080`；主機 HTTPS 反向代理至容器。測試本機 HTTP 才可設 COOKIE_SECURE=false。
- 對外 HTTPS API origin 確定後，填入 `sites/g3-platform/review-sync-config.js` 的 `REVIEW_API_URL` 並重新發布 Pages。只放公開 API 網址。

提供 Dockerfile / compose.yaml。先在秘密管理介面綁定碼，再在此目錄執行 `docker compose up -d --build`；由 HTTPS 反向代理對外提供服務。重啟不可刪除 `review-data` volume。只跑一個 SQLite 實例，不使用無持久儲存的 serverless filesystem。對外啟用前應備份 SQLite（sqlite3 backup API；勿在寫入中只複製單一檔案），並核對 401/409 與跨瀏覽器實測。

## Session、來源及限制

- 32-byte 隨機 token；伺服器只存 SHA-256；HttpOnly cookie；8 小時到期；登出刪除 session。
- 正式 cross-origin cookie 使用 SameSite=None; Secure。部分瀏覽器會封鎖跨網站 cookie：須允許該 API 的 cookie，或把整個前端與 API 同源託管／反向代理。GitHub Pages 不能代理 /api，故無法保證所有隱私設定下可用；部署後必須實測目標裝置。
- 所有留言讀寫檢查 session。跨來源 mutation 必須提供 allowlist 內 Origin，亦提供明確 CORS。GET 無 cookie 為 401；不因前端隱藏按鈕便視為安全。
- 每個直接 peer IP，15 分鐘最多 5 次錯碼；限制存 SQLite。反向代理可能共用一個 peer，會造成共用限制；正式主機應另設 edge rate limit。不可直接信任用戶提供的 X-Forwarded-For。
- 顯示姓名不是身份驗證，沒有帳戶隔離或私人權限。存取碼持有人可讀寫同 demo 空間所有記錄。不適合存放敏感個人資料。
- API 僅接受 A01–A22 的 status/comment 和 general。額外 runs、dataset、API key 欄位被拒；請勿把秘密貼入留言本身。
- 新記錄預先產生 UUID、首次寫入 revision=0。離線／回覆遺失時保留相同 ID 重試，若已寫入會回 409 而不重複建立。更新 revision 不符回 409，沒有強制覆蓋 API。
- 每次修改只記最後修改者及時間；不是完整審計歷史。無刪除功能、註冊、忘記密碼或 Google OAuth。

## 測試

`python3 -m unittest discover -s services/review-api -p 'test_*.py' -v`

`npm test --prefix sites/g3-platform`

`python3 sites/g3-platform/tests/demo_sync_browser.py`

瀏覽器測試以兩個獨立 context、暫存資料庫及本機測試存取碼運行。測試碼不存 repo、不輸出；不使用 Massive key 或真實行情。測試修改的 API URL 由 Playwright route 注入，正式 repo 預設仍是空值（未部署）。
