# GREmutiple

GRE 中文練習網站，程式位於 `web/`。

正式網站：[GRE 練習室](https://gre-multiple-kenneth.wy-lee9591.chatgpt.site)。使用者登入後需經管理員核准。

- B 培訓班：502 題（499 題可練習）
- C 衝刺班：282 題
- D 機經模考：391 題（386 題可練習）
- 共 1,175 題，8 題因原答案或題幹疑義暫停出題。
- 每回 15 題，優先未作答題；交卷後顯示答對數、用時、原講義補充及標為 [codex] 的解析。
- ChatGPT 登入、網站管理頁審核、服務端授權與 D1 個人進度保存。
- 未完成題號提示與跳轉；答案自動儲存，重新整理可繼續。
- 計時從伺服器建立練習至交卷，包含離開頁面時間。進度以已交卷的不重複題目計算。

## 本機開發

需要 Node.js >= 22.13、npm，以及合法取得的原 PDF／私有題庫。

```sh
cd web
npm ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_amazing_blockbuster.sql
npm run dev
```

在 `web/.dev.vars` 設定 `ADMIN_EMAILS`（逗號分隔）。本機預覽的模擬登入帳號為 `seedy@sites.test`，正式站不接受此模擬登入。

## 題庫與原始教材

PDF、密碼、抽取文字、題庫 JSON 與個人資料不放進公開 GitHub 儲存庫。題庫為伺服器私有資料，不能放在 `public/` 或由 Client Component 匯入。正式部署使用具有相同程式碼及私有題庫的 Sites 原始碼儲存庫。

本機已有 `web/data/questions.json`。重新抽取可執行：

```sh
python scripts/extract_pdfs.py
python scripts/import_questions.py
python scripts/finalize_questions.py
```

最後一步需要本機的 `.local/codex-explanations.json`，保留此檔可重建補充解析。原教材中的重複題號以題庫、章節、題號組成唯一 ID。匯入異常記錄於本機 `.local/import-report.json`。

## 驗證

```sh
cd web
node node_modules/typescript/bin/tsc --noEmit
node --test tests/flow.test.mjs
```

流程測試使用記憶體 SQLite 與模擬身份，不會修改正式使用者資料。涵蓋審核、授權、答案隱藏、15 題出題、選項驗證、並行版本衝突、重複交卷、撤權以及不重複進度。

