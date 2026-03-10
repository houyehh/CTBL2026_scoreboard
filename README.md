# 🏀 交大籃球聯盟計分板 (Basketball Scoreboard)

交大籃球聯盟比賽紀錄用的網頁計分板，支援兩個角色 (A & B) 分工操作。

## 功能特色

- **角色分工**
  - **A (分數大錶)**: 主計時器 + 計分板
  - **B (犯規小錶)**: 進攻計時器 + 團隊犯規(自動計算) + 個人犯規記錄
- **離線使用**: PWA 架構，首次載入後可離線運作
- **防誤觸**: 重新整理前會跳出警告視窗
- **狀態記憶**: 所有資料存在 localStorage，回主選單再進入仍可保留
- **New Game**: 首頁按下 New Game 才會歸零，否則持續記憶
- **隊伍名單**: 從下拉選單選擇隊伍，自動載入球員資料
- **手動調時**: 點擊計時器數字開啟 iPhone 風格滾輪選擇器
- **犯規警示**: 球員3犯(黃)、4犯(橘)、5犯(紅) 自動變色
- **進攻計時器**: 按下14/24後自動開始倒數
- **全螢幕**: 每個頁面右上角都有全螢幕按鈕

## 網站邏輯

```
首頁 (Home)
├── 選擇左右隊伍 (下拉選單，資料來自 teams.json)
├── 選擇角色 A 或 B
├── New Game → 確認後清除所有紀錄
└── Enter → 進入對應頁面 (需先選角色+隊伍)

Page A (分數大錶)
├── 比賽計時器 (MM:SS) 置中於 X 正上方
│   └── 最後一分鐘自動切換為 0.1 秒精度
├── 比分加減 (+1/+2/+3 及 -1/-2/-3)
├── 節數切換 (點擊數字循環 1→2→3→4)
└── 右上角 ↩ 回主選單 (狀態保留)

Page B (犯規小錶)
├── 進攻計時器 (24秒/14秒)，按下即自動開始
├── 團隊犯規 = 自動加總該隊所有球員犯規數
├── 球權箭頭 (◀ / ▶)
├── 球員名單分布兩側，左隊/右隊各一列
│   └── 3犯黃底 / 4犯橘底 / 5犯紅底 警示
└── 右上角 ↩ 回主選單 (狀態保留)
```

## 檔案結構

| 檔案 | 說明 |
|------|------|
| `index.html` | 主頁面，包含三個頁面 (首頁/A/B) |
| `style.css` | 深色主題樣式，LED 字體 |
| `app.js` | 所有應用邏輯 |
| `teams.json` | 14 支隊伍的球員名單 |
| `sw.js` | Service Worker，離線快取 |
| `manifest.json` | PWA 設定檔 |

## 本地開發

不需要任何後端或建置工具。

```bash
# 啟動本地伺服器 (擇一)
python -m http.server 8080
# 或
npx serve .
# 或使用 VS Code Live Server 擴充套件
```

然後開啟 `http://localhost:8080`

## 部署到 GitHub Pages (一步步教學)

### 前置準備
1. 註冊/登入 [GitHub](https://github.com)
2. 確認電腦已安裝 [Git](https://git-scm.com/downloads)

### 步驟一：建立 GitHub Repository
1. 到 GitHub 點右上角 **+** → **New repository**
2. Repository name 輸入 `Scoreboard` (或你喜歡的名稱)
3. 選擇 **Public**
4. **不要**勾選 "Add a README file" (因為我們已經有了)
5. 點 **Create repository**

### 步驟二：初始化本地 Git 並推送
打開終端機 (Terminal / PowerShell)，切換到專案資料夾：

```bash
cd c:\Users\holbo\00VS_projjects\Scoreboard
```

執行以下指令：

```bash
# 1. 初始化 Git
git init

# 2. 加入所有檔案
git add .

# 3. 建立初始提交
git commit -m "初始化籃球計分板"

# 4. 設定主分支名稱
git branch -M main

# 5. 連結到你的 GitHub repository (替換成你的帳號)
git remote add origin https://github.com/你的帳號/Scoreboard.git

# 6. 推送到 GitHub
git push -u origin main
```

> 💡 如果出現登入視窗，請輸入你的 GitHub 帳號密碼或 Personal Access Token

### 步驟三：開啟 GitHub Pages
1. 到你的 GitHub repository 頁面
2. 點上方的 **Settings** (齒輪圖示)
3. 左側選單找到 **Pages**
4. 在 **Source** 區塊：
   - Branch 選擇 **main**
   - Folder 選擇 **/ (root)**
5. 點 **Save**

### 步驟四：等待部署完成
1. 稍等 1-3 分鐘
2. 重新整理 Settings → Pages 頁面
3. 上方會出現綠色的網址：`https://你的帳號.github.io/Scoreboard/`
4. 點擊該網址即可使用！

### 後續更新
每次修改後只需要：
```bash
git add .
git commit -m "更新描述"
git push
```
GitHub Pages 會自動重新部署 (1-2 分鐘)。

## 隊伍清單

管院, 光電, 半導體, 土木, 材料, 機械, 資工, 資財, 運管, 電機A, 電機B, 電物, 電研A, 電研B
