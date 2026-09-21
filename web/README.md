# GRE 練習室

React / Vinext / Cloudflare Workers 與 D1。啟動、題庫匯入及測試方式見上一層 README。

`data/questions.json` 是私有伺服器題庫，禁止放入公開 GitHub 或靜態資源。每回的選題與計分在 `app/api/gre/route.ts`，瀏覽器僅於交卷後取得該回答案與解析。

管理員由正式環境的 `ADMIN_EMAILS` 指定，沒有「第一個註冊者自動成為管理員」機制。每次受保護請求皆重新檢查核准狀態。一般使用者只能取得自己的練習與進度。

