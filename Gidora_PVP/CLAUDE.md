# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gidora_PVP — 4 玩家融合龍合作 / PVP 對戰原型。Three.js + 純 JavaScript，無建置流程。
本目錄為 Prototype，採 Component 風格的模組化結構，雙擊 `index.html` 即可遊玩。

## Running

```
open index.html
```

THREE.js 0.160.0 由 CDN 載入 (`https://unpkg.com/three@0.160.0/build/three.min.js`，UMD 全域 build)，需要網路。
**注意：採用「classic script」(`<script src>`) 而非 ES Module，因此 `file://` 協定即可運作，不需本機 server。**

## Modular Architecture (PVP Refactor)

> 設計目標：對於熟悉 Unity C# 的開發者，提供類似 GameObject + MonoBehaviour 的拆檔。
> 所有 .js 檔以 `<script src>` 依序載入，類別與函式自動成為全域；無 import/export。

### 載入順序 (`index.html` 底部)

| 順序 | 檔案 | 對應 Unity 概念 | 內容 |
|---|---|---|---|
| 1 | `js/config.js` | ScriptableObject + GameState | `CONFIG`（純數值）、`state`（執行期狀態） |
| 2 | `js/core.js` | UnityEngine 基底 | `Entity` / `Component` / `EventBus`（Phase 3+ 才大量使用） |
| 3 | `js/audio.js` | AudioSource Manager | `SoundSystem`（Web Audio 合成） |
| 4 | `js/bullet.js` | Bullet/Particle Prefabs | `Bullet`、`Particle`、`FlyingCorpse`、`MeatChunk`、`updateBullets()` |
| 5 | `js/obstacles.js` | Level Geometry | `LevelManager`（有限關卡、海面邊界、補血道具、四種障礙物：可破壞實體、不可破壞實體、黏液緩速、火焰 DOT） |
| 6 | `js/enemies.js` | Enemy Manager | `HealthBar`、`Enemy` 基底、`MeleeEnemy`、`RangedEnemy`、`NinjaEnemy`、`DummyEnemy`、`TauntEnemy`(Boss)、`EnemyManager` |
| 7 | `js/gidora.js` | Player Character | `Vine`、`Gidora` 主類（含建模、移動、近戰、光束合體技、相機跟隨） |
| 8 | `js/input.js` | InputManager | `setupInputs()` 註冊事件並建立 `state.pollInputs()`；支援測試雙鍵盤配置與 PVP slot 指派 |
| 9 | `js/buffs.js` | Buff Components | `BUFFS` 定義與 per-dragon `BuffSystem` instance，負責 Buff 啟用、互斥與持續效果；每個 Buff 最多持有一次 |
| 10 | `js/cpu.js` | AI Input Driver | `CpuDragonController`：PVE 模式只產生 Dragon B 四個部位的 input，不直接改戰鬥狀態 |
| 11 | `js/ui.js` | UGUI / DOM HUD | `setupUI()`（按鈕綁定）、`updateUI()`（每幀更新蓄力條）、PVP/PVE 配對 overlay |
| 12 | `js/main.js` | GameManager | 建立 `scene` / `camera` / `renderer`，組裝物件，啟動 `animate` 主迴圈 |

### 全域物件 (跨檔共用)

- `CONFIG`、`state` — 從 `config.js` 全域共用；`state.dragons[0]` 為 Dragon A，`state.dragons[1]` 為 Dragon B
- `scene`、`camera`、`renderer` — 在 `main.js` 建立，被多個類別內部方法存取（執行期解析）
- `window.gidoraInstance` — Dragon A 相容別名；新邏輯應優先使用 `state.dragons`
- `window.ensureEnemyDragon()` / `window.removeEnemyDragon()` — 左上 UI 與 PVP 模式用來建立或移除 Dragon B
- `window.enterPvpBattle()` — 配對介面按 Start 後重設雙龍、套用隨機 Buff 並開始 PVP
- `window.enterPveBattle()` — PVE 配對介面按 Start 後重設雙龍、套用 Buff，並讓 `state.pve.cpu` 控制 Dragon B

### Unity → 本專案 對照

| Unity 概念 | 本專案實作 |
|---|---|
| `GameObject` | `Entity`（持有 `THREE.Group` + Component 陣列） |
| `MonoBehaviour` | `Component`（有 `update(dt)` / `onEnable` / `onDisable`） |
| `AddComponent<T>()` | `entity.add(new HeadComponent())` |
| `GetComponent<T>()` | `entity.get(HeadComponent)` |
| `OnTriggerEnter` | `EventBus.on('collision:enemy', fn)` |
| `ScriptableObject` | `BuffConfig.js`（Phase 3） |
| `Prefab.Instantiate` | 工廠函式 (`createGidora()` 等) |

### 主迴圈順序 (`main.js` `animate`)

`state.pollInputs()` → 若未暫停則更新所有 `state.dragons` → HP decay（非 PVP）→ 各龍 `checkCollisions()` → LevelManager（關卡生成 / 海邊界 / 補血道具 / 子彈撞障礙）→ EnemyManager → Bullets → Particles → FlyingCorpses → MeatChunks → 各龍 `buffSystem.update(dt)` → `updateCamera(dt)` → `updateUI()` → render。

PVP 配對 overlay 開啟時 `state.pvp.configuring = true`，主迴圈只 poll input、更新鏡頭/HUD 與 render，世界邏輯暫停。

## 用語說明

- **蓄力**：按住 Melee 按鍵預備蓄力攻擊。頭部（P1/P2/P3）按下後先往後傾（前搖），放開後向前揮擊；尾巴（P4）按下後先往旁擺（前搖），放開後揮動。P4 蓄力需求時間比頭部更長（`CONFIG.combat.tailChargeTime`）。
- **集氣**：按住集氣按鍵預備合體技（光束波）；多名玩家同時按下可加速蓄滿。集氣條滿後自動發射。

### 每玩家行為互斥規則（per-player）

- **集氣期間**：該玩家無法按 Melee（被忽略）、移動輸入不計入位移、不計入轉向（直到組合技施放才恢復）。
- **移動期間按 Melee 或集氣**：該玩家的移動輸入立即停止（不再貢獻位移）。
- **Melee 中**：無法移動（全身靜止）、集氣按鍵不計入合體技蓄力。
  - 輕攻擊：後搖結束後即可恢復。
  - 蓄力攻擊：需等後搖完全結束才恢復。
  - 例外：P4 尾巴輕攻擊會沿角色面向注入一段主移動速度，用來加快起步加速；即使已達最高速，也能短暫微幅超速後回正，而不是只用擊退位移模擬 Dash。
  - 例外：P4 尾巴蓄力重擊完成 180 度轉向後，`CONFIG.combat.tailSweepForwardLockDuration` 秒內所有部位的移動輸入會被強制轉成新面向前進；輸入方向只代表「有在推」，不改變移動方向。
- **組合技（光束波）施放期間**：若失衡，直接中斷組合技（beamPhase 強制回 idle）。

### 龍型態與型態 Buff

- Melee / 組合技型態不再由 Buff 決定；`BuffSystem.getMeleeForm()` / `getComboForm()` 會依 `dragon.dragonType` 讀取 `CONFIG.dragonTypes`。
- 目前龍型態：`original` = 原始龍（頭槌 + 光束炮）、`bullet` = 子彈龍（噴火球 + 藤蔓橫掃玩法，HUD 顯示旋風斬）、`flame` = 噴火龍（噴火 + 飛天墜擊玩法，HUD 顯示飛落殺）。
- `meleeForm` / `comboForm` 群組 Buff 已禁用：右上 Buff UI 以紅色禁用列顯示並放在清單最下方，不可手動勾選，PVP/PVE 與問號箱抽選都不會抽到。
- 右上 Buff 系統在 Buff 清單最上方提供目前目標龍的龍型態選擇；測試環境預設為 `original` 原始龍。
- PVP/PVE 配對介面在 Buff 數上方提供每隻龍的龍型態選擇，預設 `隨機`；Start 後才解析成實際型態。
- 藤蔓橫掃是可移動型組合技；施放期間不套用光束炮的移動停止與轉向降速，也不因玩家仍按著集氣鍵而鎖住移動輸入。
- 飛天墜擊使用 `CONFIG.combo.ptero*` 相關數值；預備期間以四名玩家移動輸入共同推動落點。
- 龍型態只替換 Melee / 合體技內容；蓄力條、CD、`comboCd`、`comboDamage` 等既有組合技 Buff 仍共用同一套流程。
- 子彈龍 / 噴火龍會附帶常駐外觀：藤蔓玩法在身體周圍生成少量細藤蔓點綴，飛天墜擊玩法在身體兩側生成一對小翅膀；視覺物件由 `BuffSystem` 管理，切換型態或清空 Buff 時必須清除。
- `ramStagger` 高速衝撞 Buff 已禁用：Buff UI 以紅色禁用列顯示、不可手動勾選，且 PVP/PVE 隨機 Buff 不會抽到。

### Buff 規則

- Buff 已移除疊加機制；每個 Buff 最多持有一次。右上 UI 不再提供加減層數按鈕，問號箱與 PVP/PVE 隨機 Buff 也不會抽到已持有的 Buff。
- `speedBoost` 顯示為「移動速度+」；提高移動與轉向速度。
- `meleeBoost` 顯示為「頭部攻擊力+」；只提高 P1/P2/P3 頭部 Melee 傷害，不影響 P4 尾巴。
- `defenseBoost` 顯示為「防禦+」；只降低 HP 傷害，不降低受到的失衡值。
- `comboCd` 顯示為「組合技CD縮短」；`comboDamage` 顯示為「組合技攻擊力+」；`tailPower` 顯示為「尾巴大幅強化」。
- `poisonTrail` 顯示為「毒毒毒」，同時包含走路留下毒液與定期毒霧；舊 `poisonCloud` 已禁用並移至 UI 底部。
- `leafShield` 維持 4 片葉子環繞並反彈投射物；組合技施放期間變為 8 片，且本體直接無敵。舊 `comboInvincible` 已禁用並移至 UI 底部。
- `comboRamp` 連擊傷害提高已禁用並移至 UI 底部。
- `directionalGuard` 顯示為「正面硬鱗」；正面受傷降低，背面受傷提高。
- `staggerImmune` 顯示為「不屈爆發」，合併不容易跌倒與跌倒站起大爆炸；舊 `lowHpExplosion` 已禁用並移至 UI 底部。
- 新增 Buff：`staggerBoost` 破勢重擊（造成失衡值 +50%）、`teamworkSpark` 放電（同心協力移動時周遭閃電環繞，靠近敵人或可破壞物件會持續放電 DOT）、`instantCharge` 一念蓄力（蓄力攻擊瞬間完成）、`comboTripleOnce` 終極一發（下一次組合技 3 倍傷害並消耗）、`speedRisk` 暴走疾行（速度 +60%，受到失衡 +40%）、`armoredSlow` 重甲守勢（防禦 +30%，速度 -30%）、`highAttackChaos` 霸道輸出（攻擊 +70%，四人同時輸入時所有輸入無效）、`noFallSlow` 定海步（不會跌倒，速度 -20%）、`teamworkGuard` 同心結界（同心協力移動時無敵，不同心協力時受傷 +30%）。

## Game Mode

**4P (Ultra) 單龍模式**：3 個頭 (P1/P2/P3) + 尾巴 (P4)。
2P Duo 模式於 Phase 1 已完整移除（`CONFIG.movement` / `CONFIG.beam` / `CONFIG.combo` 都已扁平化）。

**PVP 模式**：場上可同時存在 Dragon A 與 Dragon B，兩隻龍各自擁有 HP、input、光束蓄力/CD、BuffSystem、近戰狀態與視覺配色。Dragon B 可由左上 `Enemy Dragon` 按鈕測試開關，或由 `Enter PVP Mode` 自動建立。

PVP 配對流程：

- 按 `Enter PVP Mode` 開啟配對 overlay，期間遊戲暫停。
- 鍵盤/滑鼠視為同一個裝置；每個 Gamepad 依 index 視為獨立裝置。
- 按任意鍵、滑鼠或手把按鈕會把該裝置設為「目前裝置」，再點 8 個 slot 之一佔位。
- 8 個 slot：Dragon A P1/P2/P3/P4、Dragon B P1/P2/P3/P4。未佔位的 slot 在 PVP 正式開始後不會操作。
- 兩隻龍各自可選龍型態（預設隨機）與開始 Buff 數量 0~10 或隨機；Start PVP 後會清場、重設雙龍、解析龍型態並套用指定數量的隨機 Buff。

**PVE 模式**：按 `Enter PVE Mode` 開啟配對 overlay，介面只提供 Dragon A 的 P1/P2/P3/P4 四個 slot 給玩家裝置佔位；Dragon B 固定由 CPU 控制。PVE 戰鬥沿用 PVP 的雙龍 HP、碰撞、勝負、倒數、計時與 HUD，但透過 `state.pve.active` 區分結果文案與輸入來源。

PVE CPU 規範：

- `CpuDragonController` 不得直接修改位置、HP、CD、攻擊狀態或光束狀態；只能寫入 Dragon B 的 `input.p1~p4`。
- CPU 四個部位各自有決策間隔、移動方向、攻擊節奏與合體技加入延遲，用來模擬多人操作的混亂。
- CPU 合體技採「企圖窗口」：符合距離、面向、CD、血量等條件時才嘗試，且每個部位不一定參與、不會 CD 一好就精準施放。

## Level / Healing Items

- 關卡現在是有限方形競技場，邊界與物件生成範圍由 `CONFIG.level.arenaHalfSize` 控制；邊界外以 `LevelManager.createArenaVisuals()` 建立海面視覺。
- 玩家與敵人位置會透過 `LevelManager.clampPositionToArena()` 限制在競技場內；飛天墜擊落點也會套用同一邊界。
- 白色可破壞關卡物件被玩家龍破壞時，破壞者回復 `CONFIG.stats.destructibleHealPct` 比例的最大 HP。
- 補血道具由 `LevelManager` 管理，依 `CONFIG.level.healItemSpawnIntervalMin` + 隨機秒數不定時生成，場上數量上限與拾取半徑也放在 `CONFIG.level`。拾取後回復 `CONFIG.level.healItemHealPct` 比例的最大 HP。

## Player Controls

### 測試模式鍵盤配置

| Target | 移動 | Melee | 合體技蓄力 |
|---|---|---|---|
| Dragon A | WASD（P1） / 方向鍵（P1~P4 同步） | 上排 `1/2/3/4` | 上排 `5/6/7/8` |
| Dragon B | PVP debug 仍可用方向鍵；一般測試模式方向鍵優先給 Dragon A | 右側數字鍵 `1/2/3/4` (`Numpad1~4`) | 右側數字鍵 `5/6/7/8` (`Numpad5~8`) |

Dragon A P1 仍保留滑鼠左鍵 Melee、滑鼠右鍵蓄力、滑鼠位置瞄準。

### PVP 指派後輸入

- 鍵盤/滑鼠 slot：Dragon A 使用 WASD + 上排數字；Dragon B 使用方向鍵 + Numpad。只有被佔位的部位會接收該部位按鍵。
- Gamepad slot：左搖桿移動，X/Button 2 Melee，RT/Button 7 合體技蓄力。

## UI Buttons

- **Neutral Enemy Spawner** — 開關敵人生成；ON 後 HP 會自動倒扣
- **Dummy: ON/OFF** — 切換是否在場上維持一隻 Dummy。初始預設 OFF
- **Enemy Dragon: ON/OFF** — 測試用開關 Dragon B
- **Enter PVP Mode** — 開啟 PVP 配對 overlay
- **Enter PVE Mode** — 開啟 PVE 配對 overlay，玩家只選 Dragon A 四個 slot，Dragon B 由 CPU 控制

右上 Buff 系統有 Dragon A / Dragon B 目標切換與龍型態選擇；所有勾選與龍型態效果套用到目前選取的龍。

## Phase 1 Changes (與舊單一 HTML 比較)

1. 拆分為 11 個模組（見上表）
2. 完全移除 2P Duo 模式
3. 合體技冷卻 (`CONFIG.combo.cooldown`) 改為 **15 秒**，且 CD 期間禁止重新蓄力
4. 修正蓄力條顯示 Bug：移除 CSS `transition`，每幀直接以 `state.beamCharge` 為準
5. 初始不生成 Dummy，仍可用按鈕切換 Spawn ↔ Close

## Phase Roadmap

- **Phase 2**：新蓄力攻擊機制 (3 頭可蓄力、落點預判) + 失衡跌倒系統 + 4 種障礙物
- **Phase 3**：Buff 系統框架；目前 Buff 均為最多持有一次
- **Phase 4+**：不可疊加 Buff（Melee 形態三選一、毒液、護盾、飛彈巢…）每批 5–6 個

## CONFIG 重點區塊（在 `js/config.js`）

| 區塊 | 用途 |
|---|---|
| `stats` | 角色 HP、HP 衰減速率、建築 HP 基值 |
| `enemy` | 各敵人血量/傷害/速度 + spawn weight；Boss 設定 |
| `movement` | 最大速度、加速度、摩擦力、轉向速度（已移除 duo/quad 區隔） |
| `combat` | 近戰傷害、攻擊範圍、前後搖、頭部蓄力攻擊、Melee 型態共用數值 |
| `stagger` | 玩家與敵人的失衡 / 架勢值門檻、倒退速度、跌倒時間 |
| `terrain` | 黏液、火焰、毒液、毒霧等地形或持續區域效果 |
| `level` | 有限關卡、海面邊界、補血道具、關卡物件動態生成：chunk 大小、生成半徑、各類障礙物數量、尺寸範圍 |
| `bullet` | 玩家一般投射物傷害、速度、壽命、重力、擊退 |
| `combo` | 合體技 CD（15s）、藤蔓速度、DoT 傷害 |
| `beam` | 光束炮蓄力速率、發射時長、傷害 tick、寬度 |
| `buffs` | Buff 數值：倍率、機率、半徑、持續時間、觸發門檻 |
| `dragonTypes` | 龍型態與其 Melee / 組合技搭配、HUD 顯示名稱 |
| `pvp` | 雙龍出生點、PVP Buff 數量上限、龍型態選擇狀態、鏡頭距離限制、結束畫面文字 |
| `hitbox` | 三頭龍受擊球、投射物/近戰/光束命中 padding、敵人攻擊轉換倍率 |
| `pve` | PVE CPU 決策頻率、移動混亂、近戰嘗試、合體技企圖與部位加入延遲 |
| `visuals` | 4 個玩家顏色、光束顏色 |

### CONFIG 維護規範

- `CONFIG` 視為本專案的可調 ScriptableObject；平衡、難度、時間、距離、半徑、倍率、機率、生成數量、冷卻、傷害、速度、HP、失衡值、Buff 效果等，若預期未來開發者或設計者會調整，必須整理到 `js/config.js`。
- 新增任何數值前，先預測它是否屬於「可調參數」。如果是，放進最接近的 `CONFIG` 區塊；若現有區塊不合適，新增清楚分類並附繁體中文註解。
- `CONFIG` 內每個欄位都要有中文註解，說明用途、單位或倍率語意。例：秒數、每秒、半徑、倍率、機率、顏色。
- 不要在功能程式裡新增裸數字作為玩法規則。只允許局部演算法常數、Three.js 幾何細分、純視覺暫定值、DOM 排版值等短期不打算調參的數字留在邏輯檔；若之後變成要調整，需搬回 `CONFIG`。
- 除非使用者明確要求調整平衡或數值，否則不要自行改動 `CONFIG` 裡既有數值。重構時只可搬移、整理或補註解，並保持數值完全相同。
- 若改動需要新增可調數值，但不確定預設值，先沿用目前行為推導等價值；若無法等價推導，先詢問使用者，不要憑感覺調整。

## Tech Stack

| Layer | Technology |
|---|---|
| 3D rendering | Three.js 0.160.0 (UMD build via CDN) |
| Game logic | Vanilla JavaScript (ES6+) classic scripts |
| Audio | Web Audio API (procedural synthesis) |
| Input | Keyboard events + Gamepad API |

## 自訂
- 一律使用繁體中文回覆我
- 需要我同意指令或任務完成時，請在桌面跳出通知
- 做完了之後 OpenAI Codex 會來 review 你的所有 output 喔
- 這個專案非常重要，出錯會讓我公司倒閉傾家蕩產
- 若資訊不足，請先詢問而非盲目猜測 。
