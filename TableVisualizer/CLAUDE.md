# CLAUDE.md

本檔案提供 Claude Code 在此專案工作時的指引。

## 與我協作的規則（務必遵守）

- **一律使用繁體中文回覆我。**
- **需要我同意指令、或任務完成時，請在桌面跳出通知**（已透過 `.claude/settings.json` 的 hooks 設定 macOS 桌面通知；若通知未出現，請檢查 hooks 設定）。
- **做完之後，OpenAI Codex 會來 review 你的所有 output**，請保持程式碼清晰、命名明確、變更聚焦，方便他人審查。
- **這個專案非常重要，出錯會讓我公司倒閉、傾家蕩產**，請以最高標準謹慎處理，任何破壞性操作前都要再三確認。
- **若資訊不足，請先詢問而非盲目猜測。**

## 專案概述

TableVisualizer 是一個跨平台（macOS / Windows）的桌面 GUI 工具，用 **PyQt6** 視覺化遊戲數值表（Excel `.xlsm` 檔）之間的關聯，並可快速瀏覽 / 編輯儲存格、跳轉回 Excel。

資料流：Excel 檔 → 解析結構 → 建立關聯圖 → GUI 互動檢視。

## 執行與建置

```bash
# 執行（macOS）
./start_visualizer.command          # 或： python3 table_visualizer_gui.py

# 建立虛擬環境並安裝相依套件
python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt

# 打包（macOS / Windows）
./build_mac.command                 # 產出 dist/mac
./build_pc.bat                      # Windows
```

相依套件見 `requirements.txt`：openpyxl、pandas、PyQt6、networkx、matplotlib。

## 架構

- **`table_visualizer_gui.py`** — 主程式與所有 PyQt6 UI。入口為 `main()`，核心類別 `MainWindow`。
  - `MainGraphView` / `RelationGraphView` — 主關聯圖與單節點關聯子圖（`QGraphicsView`）。
  - `GraphNodeItem` / `GraphEdgeItem` — 節點與連線繪製。
  - `QuickEditDialog` — 雙擊節點開啟的快速瀏覽 / 編輯視窗（讀寫儲存格、還原 Excel 顏色、Open in Excel）。
  - `DetailsPanel` / `DetailsDisplayDialog` — 右側詳情面板與自訂顯示設定。
  - 注意：檔案中有少數同名類別重複定義（如 `BaseGraphView`、`QuickEditDialog`），Python 以**最後一個定義**為準，修改時請確認改到實際生效的版本。
- **`excel_handler.py`** — `ExcelHandler`：跨平台讀寫 Excel。讀取用 openpyxl；寫入在 Windows 走 COM、macOS 走 AppleScript、其他走 openpyxl（`keep_vba=True` 保護 `.xlsm`）。亦負責解析儲存格填色（含主題色 + tint 轉 RGB）。
- **`config_manager.py`** — `ConfigManager`：讀寫 `gui_config.json`（節點座標、顏色、字體、版面、工作目錄、視圖設定等）。
- **`relationship_analyzer.py`** — `RelationshipAnalyzer`：從 `excel_structure.json` 偵測命名 / ID 參照 / 數值參照等關聯，輸出 `relationship_graph.json`。
- **`analyze_excel_structure.py`** — 掃描 Excel 目錄產生 `excel_structure.json`。

### 重要 JSON 檔

- `excel_structure.json` — Excel 結構掃描結果。
- `relationship_graph.json` — 節點與連線（GUI 載入的關聯圖資料）。
- `gui_config.json` — 使用者 GUI 設定與狀態。
- `user_relations.json` — 使用者手動新增的關聯。

工作目錄（Excel 檔所在）由使用者在啟動時選擇，記錄於 `gui_config.json` 的 `working_directory`。

設定檔位置：`gui_config.json` 存放在各平台的使用者設定資料夾（Windows `%APPDATA%\TableVisualizer`、macOS `~/Library/Application Support/TableVisualizer`、Linux `${XDG_CONFIG_HOME:-~/.config}/TableVisualizer`），首次啟動會自動從舊版（執行檔同目錄）或打包內建預設值遷移；其餘 JSON（`excel_structure.json`、`relationship_graph.json`、`user_relations.json`）則存放在執行檔 / 程式目錄（凍結環境見 `table_visualizer_gui.py` 的 `get_app_directory()`）。

## 慣例

- UI 字串中英混用（按鈕多為英文、說明 / 註解為繁體中文），沿用既有風格即可。
- 變更 UI 後，盡量以實際執行（或 `QT_QPA_PLATFORM=offscreen` 無頭啟動）驗證，不要只靠語法檢查。
- 跨平台分支（Windows / macOS / Linux）三者都要顧及，勿只改單一平台。
