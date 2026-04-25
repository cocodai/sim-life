# 雙北生存戰 — Surviving Taipei

12 個月的模擬生活遊戲：在通膨、加班、隨機事件之間，試著存錢、買車、撐住身心能量。React + Vite + Tailwind 純前端，所有資料存在瀏覽器 `localStorage`。

## 多玩家支援

- 進入遊戲後可選擇現有玩家或建立新玩家
- 每位玩家有獨立的年數、存款、歷年紀錄
- 任何時候可從 header 點「切換玩家」

## 本機開發

```bash
npm install
npm run dev          # 開啟 http://localhost:5173
```

dev 模式 base path 自動是 `/`；如需測試 production 部署的 base 行為，跑 `VITE_BASE=/ npm run build && npm run preview`。

## 部署到 GitHub Pages

1. 把 repo 命名為 `sim-life` push 到 GitHub（或自訂名稱，但需同步調整 `vite.config.js` 中的 `base`）
2. 在 GitHub repo Settings → Pages → Source 選 **GitHub Actions**
3. 推送至 `main` 後，`.github/workflows/deploy.yml` 會自動 build 並發佈
4. 完成後網址：`https://<你的 GitHub 帳號>.github.io/sim-life/`

非 Pages 部署（如 Vercel / Netlify / 自架）：

```bash
VITE_BASE=/ npm run build
# dist/ 直接部署即可
```
