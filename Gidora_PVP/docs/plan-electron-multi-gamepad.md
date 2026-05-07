# Electron + SDL2 多手把支援 遷移計畫

> 目標：突破瀏覽器 4 顆手把上限，讓 Gidora_PVP 在桌面執行檔內穩定支援 7~8 顆遊戲控制器。
> 撰寫日期：2026-05-07

---

## 0. 決策紀錄（2026-05-07 確認）

| 項目 | 決策 |
|---|---|
| 目標平台 | **macOS 優先**（Apple Silicon + Intel 雙架構），Windows 暫不處理 |
| 要支援的手把 | **Xbox（XInput / Xbox Wireless）、PS5 DualSense、Nintendo Switch Pro、4 款雜牌** |
| 引入 build chain | **同意** 引入 `package.json` / `node_modules/`；CLAUDE.md 之後同步補一段「Production = Electron build」 |
| `index.html` 雙擊開玩 | 保留為 dev 模式 fallback，正式發佈走 `.app` |

> Windows / XInput 4 顆硬上限的相關段落仍保留作為背景，但實作只針對 macOS 路線。

---

## 1. 問題診斷

### 1.1 Browser Gamepad API 為何只到 4 顆？

- Chromium（含 Chrome / Edge / Electron renderer）在 **Windows** 平台預設使用 **XInput** 後端讀取手把。
- **XInput 規格本身的硬上限就是 4 個 slot**，與是否插了第 5、第 6 顆無關。
- Xbox 系列、相容 Xinput 的第三方手把（Logitech F310 XInput 模式、ShanWan、Beitong 等）插上後會「搶到」XInput 的 0~3 號 slot；多餘的同型手把會被忽略或互相覆蓋。
- macOS 上 Chromium 走 `IOHIDManager` 後端，理論上沒 4 顆硬上限，但會因驅動／韌體不同被靜默丟棄；不可預期。

### 1.2 為什麼 WebHID 嘗試失敗？

- WebHID 確實能讀「原始 HID 資料包」，看似可繞過 4 顆上限。
- 但在 Windows 上，當手把被 **XInput 驅動接管**時，作業系統會把該 device handle **獨佔**，WebHID 看不到也開不了它。
- 即使切到 DirectInput 模式，仍會遇到：
  - 每顆手把都要使用者親手按 `requestDevice()` 授權一次（UX 災難）。
  - Vendor / Product ID 各家不同，按鍵 / 軸對應要為每款手把寫一份 mapping。
  - 排線斷開後 reconnect 不一定觸發新事件。

> 結論：在純網頁環境下，4 顆是 Chromium + Windows + XInput 共同造成的天花板，靠 Web 標準（Gamepad API / WebHID / WebUSB）無法乾淨解決。

---

## 2. 為什麼 Electron 能解決

Electron = Chromium（renderer）+ Node.js（main process）。

| 層級 | 能力 | 對手把的意義 |
|---|---|---|
| Renderer (BrowserWindow) | 跑現有 HTML/JS/Three.js | `navigator.getGamepads()` 仍受 XInput 4 顆限制 |
| Main process (Node.js) | 可載入 **C++ native module** | 可直接呼叫 SDL2 / DirectInput / RawInput / IOHID，**不受 XInput 4 顆上限** |

關鍵：**手把讀取放在 main process**，再用 IPC（`ipcMain` / `ipcRenderer`）把狀態送進 renderer，遊戲端只需把原本 `navigator.getGamepads()` 替換成「拿 IPC 傳來的快照」。

---

## 3. 技術選擇比較（Mac 視角）

| 方案 | macOS 支援 | 同時手把數 | 對目標 4 類手把表現 | 結論 |
|---|---|---|---|---|
| **`@kmamal/sdl`** (SDL2 binding) | ✅ Apple Silicon + Intel prebuilt | 16+ | Xbox / PS5 / NS Pro / 多數雜牌都有內建 mapping | **首選** |
| `node-hid` | ✅ | 不限 | DualSense / NS Pro 要自己解 HID report，工作量大 | 備用 |
| `node-gamepad` | △ | 視 HID claim | 已少維護 | 不推 |
| 直接用 macOS `GameController.framework`（Objective-C bridge） | ✅ | 不限 | 蘋果原生支援 Xbox / DualSense / Joy-Con / NS Pro，但要自己寫 native module | 過度工程 |

**最終決定：`@kmamal/sdl`**（npm package）。理由：
- macOS prebuilt binary 直接可用，不需本機裝 Xcode toolchain。
- SDL2 自帶 community mapping（`gamecontrollerdb.txt`），Xbox / PS5 / NS Pro 三大廠 layout 都已正規化成 W3C standard gamepad。
- 雜牌手把若 SDL 內建沒有，可在執行期載入自訂 mapping 字串補上。

### 3.1 目標 4 類手把在 macOS + SDL2 的相容性備忘

| 手把 | 連線方式 | SDL2 支援度 | 注意事項 |
|---|---|---|---|
| Xbox（Wireless Series X/S / Elite） | 藍牙 / USB-C | ⭐⭐⭐⭐⭐ | macOS Sonoma+ 原生支援 Xbox Wireless；SDL 直接認 |
| PS5 DualSense | 藍牙 / USB-C | ⭐⭐⭐⭐⭐ | SDL 2.26+ 內建 mapping；觸控板 / 陀螺儀 / 自適應扳機本案不需要，忽略即可 |
| Nintendo Switch Pro | 藍牙 / USB | ⭐⭐⭐⭐ | A/B、X/Y 物理位置與 Xbox 相反，**SDL `GameController` API 已自動正規化**，邏輯端不用區分 |
| 雜牌（4 款） | 視型號 | ⭐~⭐⭐⭐⭐ | 多數走 generic HID；若 SDL 不認，要在 Phase B 收集 GUID + 手動填 mapping |

> 雜牌手把的實際支援度要等拿到實機 Phase B 跑 `joystick.devices` 才能下結論；plan 預留「自訂 mapping 注入」的擴充點。

---

## 4. 目標架構

```
┌──────────────────── Electron App ────────────────────┐
│                                                       │
│  ┌────────── Main Process (Node) ──────────┐         │
│  │  @kmamal/sdl                              │         │
│  │   ├─ joystick.devices  (列出全部手把)     │         │
│  │   ├─ joystick.openDevice(...)             │         │
│  │   └─ 每 16ms 取一次 axes / buttons         │         │
│  │              │                            │         │
│  │              ▼                            │         │
│  │   GamepadBridge.serialize()               │         │
│  │              │  IPC: 'gamepad:snapshot'   │         │
│  └──────────────┼────────────────────────────┘         │
│                 ▼                                      │
│  ┌────────── Renderer (BrowserWindow) ──────┐         │
│  │  preload.js  ─ 暴露 window.nativeGamepads │         │
│  │  index.html  ─ 現行 Three.js 遊戲完全照舊 │         │
│  │  js/input.js ─ 改 1 行：                   │         │
│  │     navigator.getGamepads()               │         │
│  │      → window.nativeGamepads.snapshot()   │         │
│  └───────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────┘
```

關鍵設計原則：
- **資料形狀對齊原生 Gamepad object**：snapshot 物件保留 `index` / `id` / `buttons[].pressed` / `buttons[].value` / `axes[]` / `connected` 欄位，讓 `input.js` 幾乎不用改邏輯。
- **單一注入點**：只有 `state.pollInputs()` 第一行（[`js/input.js:354`](../js/input.js)）需要替換來源。
- **降級相容**：若 SDL bridge 沒掛起來（例如 dev 直接 `open index.html`），自動 fallback 回 `navigator.getGamepads()`，桌機開發體驗不變。

---

## 5. 分階段實作步驟

### Phase 0 — 前置決策（**先確認再動手**，見 §8）

- 決定目標平台（Win only / Mac only / 兩者）。
- 決定發佈形式（內部測試 zip / 安裝檔 / Steam 包裝）。
- 蒐集實機要支援的手把型號清單（用來在 Phase 4 做相容測試）。

---

### Phase A — 建立 Electron 殼（不動遊戲邏輯）

新增檔案：

```
Gidora_PVP/
├── package.json              ← 新增
├── electron/
│   ├── main.js               ← Electron entry
│   ├── preload.js            ← 安全橋接
│   └── gamepad-bridge.js     ← SDL 輪詢 + IPC（Phase B 會用到）
├── index.html                ← 不動
├── js/                       ← 不動
└── docs/
    └── plan-electron-multi-gamepad.md
```

`package.json`（重點）：

```json
{
  "name": "gidora-pvp",
  "version": "0.1.0",
  "main": "electron/main.js",
  "scripts": {
    "start": "electron .",
    "dist": "electron-builder"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-builder": "^24.13.0"
  }
}
```

`electron/main.js`（最小可運作版本）：

```js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false, // 之後 SDL bridge 需要 Node API
    }
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
```

`electron/preload.js`（先建空殼）：

```js
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('nativeGamepads', {
  snapshot: () => null, // Phase B 才實作
});
```

**驗收條件**：`npm install && npm start` 可以開出視窗、遊戲照常跑、現有 4 顆手把能玩。**遊戲行為與目前完全一致**。

---

### Phase B — 整合 SDL2 多手把讀取

1. `npm i @kmamal/sdl`
2. 撰寫 `electron/gamepad-bridge.js`：
   - 啟動時呼叫 `sdl.joystick.devices` 列出所有 device。
   - 監聽 `sdl.joystick.on('deviceAdd' / 'deviceRemove')` 動態插拔。
   - 對每顆 opened device，每 16ms（或 main loop tick）讀取 axes / buttons。
   - 把全部裝置打包成陣列 `[ { index, id, mapping, axes, buttons, connected, timestamp } ]`。
3. 在 `electron/main.js` 啟動 bridge，並透過 `ipcMain.handle('gamepad:snapshot', ...)` 或 `webContents.send` push 到 renderer。
4. 更新 `electron/preload.js`：

```js
const { contextBridge, ipcRenderer } = require('electron');
let latestSnapshot = [];
ipcRenderer.on('gamepad:snapshot', (_e, snap) => { latestSnapshot = snap; });
contextBridge.exposeInMainWorld('nativeGamepads', {
  snapshot: () => latestSnapshot,
});
```

**Push vs Pull 取捨**：建議 **push（main → renderer）**，與遊戲渲染解耦；renderer 端 `state.pollInputs()` 每幀只是讀最近一次快照，避免同步阻塞。

**驗收條件**：在 main process console 印出 `joystick.devices` 應顯示 7~8 顆插上的手把（確認 SDL 真的看得到，這一步是分水嶺）。

---

### Phase C — 改寫 `js/input.js` 接到原生橋

只動 [`js/input.js:354`](../js/input.js)：

```js
// before
const gamepads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];

// after
const native = window.nativeGamepads && window.nativeGamepads.snapshot();
const gamepads = (native && native.length)
    ? native
    : (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []);
```

確保 SDL snapshot 的 shape 對齊瀏覽器 Gamepad object：

| 欄位 | 形狀 | 說明 |
|---|---|---|
| `index` | number | SDL 給的 device index |
| `id` | string | 例：`"Xbox 360 Controller (XInput STANDARD GAMEPAD)"` |
| `mapping` | `'standard'` 或 `''` | 套用 SDL `GameController` mapping 後填 `'standard'` |
| `connected` | boolean | |
| `buttons` | `Array<{pressed:boolean, value:number}>` | 至少對齊 W3C standard gamepad 17 顆按鈕 |
| `axes` | `number[]` | 至少 4 軸（左/右搖桿 X/Y） |

**為何要對齊**：`getGamepadSlotControls(slotIndex, gp)`、`pollPairingDevices(gamepads)` 等舊邏輯整片不用動，PVP 配對 overlay、按鍵記憶都直接續用。

**驗收條件**：
1. 7~8 顆手把全部能在 PVP 配對 overlay 被 detect、佔位。
2. 各 slot 移動 / Melee / 蓄力組合鍵都正確觸發。
3. 拔插線後能正確新增 / 移除可選裝置。

---

### Phase D — 打包與部署（macOS）

1. 加入 `electron-builder` 設定（`package.json` 的 `build` 區塊）。
2. **Universal binary**：產 `arm64` + `x64` 雙架構合一的 `.app`，方便覆蓋 Apple Silicon 與 Intel Mac。
3. **Native module 打包**：`@kmamal/sdl` 是 prebuilt `.node`；確認 electron-builder 的 `asarUnpack` 設定把 `**/*.node` 釋放出 asar，避免執行期載入失敗：
   ```json
   "build": {
     "appId": "com.gidora.pvp",
     "mac": {
       "target": [{ "target": "dmg", "arch": ["arm64", "x64"] }],
       "category": "public.app-category.games"
     },
     "asarUnpack": ["**/*.node", "node_modules/@kmamal/sdl/**"]
   }
   ```
4. **Entitlements**：macOS 14+ 對手把存取沒有額外授權需求（不像 camera / mic），但若要藍牙手把建議加 `NSBluetoothAlwaysUsageDescription` 到 `Info.plist`，避免某些情境彈窗。
5. **Codesign / Notarization 策略（兩條路擇一）**：
   - **內部派發路線（建議第一版）**：不簽名，使用者第一次開啟用「右鍵 → 開啟」繞過 Gatekeeper；或請使用者在「系統設定 → 隱私權與安全性」按一次允許。
   - **正式派發路線**：申請 Apple Developer Program ($99/年) → `Developer ID Application` 簽名 + `notarytool` 上傳公證。Phase D 預留 0.5~1 天處理。
6. 產出 `.dmg`（拖拉式安裝）或 `.zip`（解壓即用）。

**驗收條件**：把 `.app` 拷到完全沒裝過 Node 的乾淨 Mac，雙擊執行，4 種手把（Xbox / PS5 / NS Pro / 雜牌）共 7~8 顆全部可在配對 overlay 出現並完成 PVP。

---

### Phase E — 收尾與防呆

- 在 main process 對 SDL 例外做 try/catch，避免一顆手把崩掉整個 bridge。
- 加上 `--no-gamepad-bridge` 啟動參數，讓緊急時可退回原生 API。
- 在主畫面加一個 dev-only 的「偵測到 N 顆手把」debug HUD，方便對外測試 QA。
- 把現行 `gamepadButtonMemory` / `gamepadSetupNavMemory` 的 key 從 `gp.index` 改成 `gp.id + gp.index`，避免 SDL reindex 導致記憶錯亂（如果遇到問題再加）。

---

## 6. 風險與替代方案（Mac 視角）

| 風險 | 機率 | 衝擊 | 對策 |
|---|---|---|---|
| `@kmamal/sdl` 在某版 Electron 上 ABI 不相容 | 中 | 中 | 鎖定 `electron@31` + `@kmamal/sdl` 版本；package-lock 入版控 |
| 雜牌手把 SDL 不認 → 出現但無 mapping → 按鍵亂跳 | **高** | 中 | Phase B 收集每顆 GUID，找不到就在 `gamecontrollerdb.txt` 手動補；提供 in-game「重新校正」UI（次要） |
| macOS 藍牙同時連 8 顆會壅塞、手把延遲飆升 | 中 | 中 | 建議重要 slot 走 USB-C；藍牙限制在 4 顆內 |
| Switch Pro / DualSense 在背景 mode 切換（Bluetooth → USB）會觸發 deviceRemove + deviceAdd | 中 | 低 | bridge 對 add/remove 做 debounce，slot 配對用 GUID（非 index）做識別 |
| 同型號雜牌 4 顆 SDL 看不出個體 | 中 | 中 | 改用 SDL `getInstanceID()` 唯一 id；無 serial 時退回插入順序 |
| Gatekeeper 擋掉未簽名 `.app` | 高 | 低 | README 寫清楚「右鍵 → 開啟」，或走付費簽名 |
| Apple Silicon 與 Intel Mac 的 `.node` 不通用 | 中 | 中 | 打 universal binary（`arch: ["arm64","x64"]`），electron-builder 會合併 |
| 打包後 `.app` > 250MB | 高 | 低 | Electron 本來就大，可接受 |

替代路線（不建議，但寫下備案）：

1. **純 WebHID + 自家 mapping**：仍卡 XInput claim 與 UX，已驗證失敗，**不採用**。
2. **小型 Go / Rust 旁路 daemon + WebSocket**：把 SDL 讀取放外部程序，網頁連 `ws://localhost`。技術上可行，但部署多一支 exe，使用者要點兩次，**比 Electron 麻煩**。
3. **遷至 Tauri**：Tauri 的 Rust 後端也能用 `gilrs` / `sdl2` crate，最終包體比 Electron 小一截。**長期值得考慮**，但短期為了趕 deadline 用 Electron 較穩。

---

## 7. 預估工時（單人）

| Phase | 內容 | 工時估計 |
|---|---|---|
| A | Electron 殼 + 跑起遊戲 | 0.5 天 |
| B | SDL bridge + IPC | 1.5 天 |
| C | `input.js` 接線 + PVP 配對驗證 | 0.5 天 |
| D | 打包 + 乾淨機測試 | 1 天 |
| E | 防呆 + QA buffer | 1 天 |
| **合計** | | **~4.5 天** |

---

## 8. 待確認問題

| # | 問題 | 狀態 |
|---|---|---|
| 1 | 平台優先序 | ✅ macOS only |
| 2 | 手把型號 | ✅ Xbox / PS5 / NS Pro / 4 款雜牌 |
| 3 | 引入 build chain | ✅ 同意 |
| 4 | 發佈方式 | ⚠️ **未定**：內部派發 zip？還是要做 `.dmg` + 簽名公證？ |
| 5 | 雙擊 `index.html` dev 模式 | 建議保留（plan §C 已支援降級）；如要保留請確認 |
| 6 | 目標時程 / demo 日期 | ⚠️ **未定**，影響 Phase E 防呆投入 |
| 7 | 雜牌手把實機 | ⚠️ Phase B 起點：是否能把 4 款雜牌寄到開發機，或讓開發者借用？ |

---

## 9. 一句話總結

> **網頁解法已到天花板；用 Electron 把 SDL2 native module 塞進 main process，是目前 cost / risk 最低、能穩定支援 8 顆手把的工程路徑。** 現有遊戲程式幾乎不動，主要工作量在新增 `electron/` 資料夾與 IPC 橋接。
