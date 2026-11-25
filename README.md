# 銀護 SilverCare Home Hub

香港上門居家老人服務開源調度平台：**WhatsApp（可切換）+ AI Agent + 後台資料庫**。

養老中心可零成本本機啟動；正式環境用 Docker Compose 一鍵部署，再接 Meta WhatsApp Cloud API。

## 功能

- **家屬／長者**：用自然語言預約、查詢、取消（粵語／繁中）
- **護理員**：接單／拒單、到達、完成回報
- **中心後台**：儀表板、個案、護理員、服務單、一鍵自動調度
- **自動調度**：技能 × 班表 × 香港區域鄰近度 × 當日負荷
- **Channel Adapter**：預設 Web Chat 演示；可切 `CHANNEL_MODE=whatsapp`

未設定 `OPENAI_API_KEY` 時走規則引擎，亦可完整演示（真正零 API 成本）。

## 快速開始（本機，無需 Docker）

```bash
cp .env.example .env
npm install
npm run dev
```

- 展覽首頁：http://localhost:5173
- 現場演示：http://localhost:5173/demo
- 調度中樞：http://localhost:5173/ops
- API：http://localhost:8787/health
- 講稿：見 [EXHIBITION.md](./EXHIBITION.md)
  - 家屬電話 `61110001`
  - 護理員電話 `91230001`

資料預設存於 `./data`（PGlite），無需安裝 Postgres。

## 線上部署（Vercel）

> GitHub Pages 只適合純靜態站，本專案有 API／資料庫，**不適用** GitHub.io。

**線上 Demo：** https://silvercare-home-hub.vercel.app  

**Push 自動部署：** 見 [DEPLOY.md](./DEPLOY.md)（GitHub 已接 Vercel）。

```bash
npm i -g vercel
vercel login
vercel --prod
```

Vercel 上使用記憶體 PGlite（冷啟動自動 seed），適合演示；正式可改接 `DATABASE_URL`。

## 一鍵 Docker 部署

```bash
cp .env.example .env
docker compose up --build -d
```

- 網頁：http://localhost:8080
- API：http://localhost:8787

## 接上 WhatsApp Cloud API

1. 在 Meta 建立 WhatsApp Business App，取得 token 與 Phone Number ID  
2. `.env` 設定：

```env
CHANNEL_MODE=whatsapp
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=silvercare-verify
```

3. Webhook URL：`https://<你的網域>/webhook/whatsapp`  
4. 對話邏輯與 Web Chat 相同；家屬／護理員以電話號碼對應 `channel_identities`

## 專案結構

```
apps/api     Fastify API、Agent、調度、Channel Adapter
apps/web     中心後台 + Demo Chat
migrations   Postgres / PGlite schema
```

## 下一波建議（Roadmap patch）

1. **持久化資料庫**：Vercel／Docker 接 Neon 或 Postgres，避免冷啟動清資料  
2. **多中心＋職員登入**：中心隔離、角色權限（職員／督導）  
3. **班表／月曆 UI**：拖曳改派、衝突提示  
4. **WhatsApp 引導設定**：一頁 wizard 填 token／webhook  
5. **到離打卡強化**：GPS／相片佐證、超時提醒  
6. **家屬通知**：預約確認、護理員出發、服務完成推播  
7. **社署／津貼報表**：服務時數、個案統計匯出  
8. **Agent evals**：粵語預約／改期／拒單回歸測試

## 授權

MIT — 歡迎養老中心、NGO、義工團隊直接使用與二次開發。
