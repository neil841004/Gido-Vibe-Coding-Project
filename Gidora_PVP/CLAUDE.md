# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gidora_PVP — 4 玩家融合龍合作射擊原型。Three.js + 純 JavaScript，無建置流程。
本目錄為 Prototype，採 Component 風格的模組化結構，雙擊 `index.html` 即可遊玩。

## Running

```
open index.html
```

THREE.js 0.160.0 由 CDN 載入 (`https://unpkg.com/three@0.160.0/build/three.min.js`，UMD 全域 build)，需要網路。
**注意：採用「classic script」(`<script src>`) 而非 ES Module，因此 `file://` 協定即可運作，不需本機 server。**

## Modular Architecture (Phase 1)

> 設計目標：對於熟悉 Unity C# 的開發者，提供類似 GameObject + MonoBehaviour 的拆檔。
> 所有 .js 檔以 `<script src>` 依序載入，類別與函式自動成為全域；無 import/export。

### 載入順序 (`index.html` 底部)

| 順序 | 檔案 | 對應 Unity 概念 | 內容 |
|---|---|---|---|
| 1 | `js/config.js` | ScriptableObject + GameState | `CONFIG`（純數值）、`state`（執行期狀態） |
| 2 | `js/core.js` | UnityEngine 基底 | `Entity` / `Component` / `EventBus`（Phase 3+ 才大量使用） |
| 3 | `js/audio.js` | AudioSource Manager | `SoundSystem`（Web Audio 合成） |
| 4 | `js/bullet.js` | Bullet/Particle Prefabs | `Bullet`、`Particle`、`FlyingCorpse`、`MeatChunk`、`updateBullets()` |
| 5 | `js/obstacles.js` | Level Geometry | `LevelManager`（目前僅可破壞方塊；Phase 2 將加入其他三種障礙物） |
| 6 | `js/enemies.js` | Enemy Manager | `HealthBar`、`Enemy` 基底、`MeleeEnemy`、`RangedEnemy`、`NinjaEnemy`、`DummyEnemy`、`TauntEnemy`(Boss)、`EnemyManager` |
| 7 | `js/gidora.js` | Player Character | `Vine`、`Gidora` 主類（含建模、移動、近戰、光束合體技、相機跟隨） |
| 8 | `js/input.js` | InputManager | `setupInputs()` 註冊事件並建立 `state.pollInputs()` |
| 9 | `js/buffs.js` | Buff Components | Phase 3+ 才實作，目前為佔位 |
| 10 | `js/ui.js` | UGUI / DOM HUD | `setupUI()`（按鈕綁定）、`updateUI()`（每幀更新蓄力條/Debug HUD） |
| 11 | `js/main.js` | GameManager | 建立 `scene` / `camera` / `renderer`，組裝物件，啟動 `animate` 主迴圈 |

### 全域物件 (跨檔共用)

- `CONFIG`、`state` — 從 `config.js` 全域共用
- `scene`、`camera`、`renderer` — 在 `main.js` 建立，被多個類別內部方法存取（執行期解析）
- `window.gidoraInstance` — 玩家角色實例，敵人 AI 用來查詢玩家位置/方向

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

`gidora.update(dt)` → HP decay → `gidora.checkCollisions()` → `state.pollInputs()` → LevelManager → EnemyManager → Bullets → Particles → FlyingCorpses → MeatChunks → BuffSystem → updateUI → render

## Game Mode

**僅 4P (Ultra) 模式**：3 個頭 (P1/P2/P3) + 尾巴 (P4)。
2P Duo 模式於 Phase 1 已完整移除（`CONFIG.movement` / `CONFIG.beam` / `CONFIG.combo` 都已扁平化）。

## Player Controls

| Player | 移動 | 攻擊 | 蓄力 (合體技) |
|---|---|---|---|
| P1 (紅頭) | WASD | 滑鼠左鍵 / Digit1 | 滑鼠右鍵 / Left Shift |
| P2 (藍頭) | 方向鍵 (或 Gamepad 0 左搖桿) | Enter / Digit2 / Gamepad X | Right Shift / Gamepad RT |
| P3 (粉頭) | Gamepad 1 左搖桿 | Digit3 / Gamepad X | Gamepad RT |
| P4 (青尾) | Gamepad 2 左搖桿 | Digit4 / Gamepad X | Gamepad RT |

## UI Buttons

- **Enemy Spawner** — 開關敵人生成；ON 後 HP 會自動倒扣
- **Spawn Dummy / Close Dummy** — 切換是否在場上維持一隻 Dummy。初始預設為「Close Dummy」（場上有 Dummy）

## Phase 1 Changes (與舊單一 HTML 比較)

1. 拆分為 11 個模組（見上表）
2. 完全移除 2P Duo 模式
3. 合體技冷卻 (`CONFIG.combo.cooldown`) 改為 **15 秒**，且 CD 期間禁止重新蓄力
4. 修正蓄力條顯示 Bug：移除 CSS `transition`，每幀直接以 `state.beamCharge` 為準
5. 初始就生成 Dummy；按鈕改為 Spawn ↔ Close 開關

## Phase Roadmap

- **Phase 2**：新蓄力攻擊機制 (3 頭可蓄力、落點預判) + 失衡跌倒系統 + 4 種障礙物
- **Phase 3**：Buff 系統框架 + 3 個可疊加 Buff (HP / 速度 / Melee 攻擊力)
- **Phase 4+**：不可疊加 Buff（Melee 形態三選一、毒液、護盾、飛彈巢…）每批 5–6 個

## CONFIG 重點區塊（在 `js/config.js`）

| 區塊 | 用途 |
|---|---|
| `stats` | 角色 HP、HP 衰減速率、建築 HP 基值 |
| `enemy` | 各敵人血量/傷害/速度 + spawn weight；Boss 設定 |
| `movement` | 最大速度、加速度、摩擦力、轉向速度（已移除 duo/quad 區隔） |
| `combat` | 近戰傷害、攻擊範圍、前後搖時間 |
| `combo` | 合體技 CD（15s）、藤蔓速度、DoT 傷害 |
| `beam` | 光束炮蓄力速率、發射時長、傷害 tick、寬度 |
| `visuals` | 4 個玩家顏色、光束顏色 |

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
