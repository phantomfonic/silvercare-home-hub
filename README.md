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

- 後台：http://localhost:5173
- API：http://localhost:8787/health
- Demo Chat：後台左側「Demo Chat」
  - 家屬電話 `61110001`
  - 護理員電話 `91230001`

資料預設存於 `./data`（PGlite），無需安裝 Postgres。

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

## 授權

MIT — 歡迎養老中心、NGO、義工團隊直接使用與二次開發。
