# Vercel 自動部署（push 即更新）

## 正式網址

**https://silvercare-home-hub.vercel.app**

- GitHub 已連接：`phantomfonic/silvercare-home-hub`
- Production 目前追蹤分支：`cursor/exhibition-demo-ea9a`（展覽完整功能）
- push 到該 Production 分支會自動重新編譯部署

| 事件 | 結果 |
| --- | --- |
| push 到 Production 分支 | Production 自動部署 |
| 其他分支／PR | Preview 自動部署 |

合併 PR #3 到 `main` 後，可在 Vercel → Project → Settings → Git 把 Production Branch 改回 `main`。

## 備援：GitHub Actions

倉庫含 [`.github/workflows/vercel-deploy.yml`](.github/workflows/vercel-deploy.yml)。若要用 Actions，到 GitHub Secrets 新增 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`。未設定時會略過、不紅燈。
