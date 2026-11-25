# Vercel 自動部署（push 即更新）

此雲端 Agent **無法使用你桌面已登入的 Vercel session**。請在桌面完成下面「一次設定」，之後每次 `git push` 都會自動重新編譯／部署。

## 推薦做法：Vercel 接 GitHub（約 2 分鐘）

1. 開啟 https://vercel.com/new （已登入）
2. **Import** GitHub 專案 `phantomfonic/silvercare-home-hub`
3. 設定：
   - Framework Preset: **Other**
   - Build Command: `npm run build`（已寫在 `vercel.json`）
   - Output Directory: `apps/web/dist`
   - Install Command: `npm install`
4. Production Branch 選 **`main`**
5. Deploy

完成後：

| 事件 | 結果 |
| --- | --- |
| push / merge 到 `main` | Production 自動部署 |
| 其他分支／PR | Preview 自動部署 |

## 展覽完整功能在 PR #3

請先 merge  
https://github.com/phantomfonic/silvercare-home-hub/pull/3  
再 push／merge 到 `main`，Production 才會有分析＋班表＋現場演示。

## 備援：GitHub Actions

倉庫已含 [`.github/workflows/vercel-deploy.yml`](.github/workflows/vercel-deploy.yml)。若不用 Vercel Git Integration，到 GitHub → Settings → Secrets and variables → Actions 新增：

- `VERCEL_TOKEN`（Account → Tokens）
- `VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`（Project → Settings → General）

未設定 secrets 時 workflow 會自動跳過，不會紅燈。
