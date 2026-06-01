#!/bin/bash
# TableVisualizer 一鍵測試啟動器（macOS 雙擊即可執行）
# - 自動切到本檔所在目錄
# - 若有 venv 則啟用 venv，否則用系統 python3
# - 於終端機即時顯示所有 log 與錯誤訊息
# - 程式結束後停住，方便檢視結果

cd "$(dirname "$0")" || exit 1

echo "=================================================="
echo " TableVisualizer 測試啟動"
echo " 目錄：$(pwd)"
echo "=================================================="

if [ -d "venv" ]; then
    echo "啟用虛擬環境 venv ..."
    # shellcheck disable=SC1091
    source venv/bin/activate
fi

echo "使用 Python：$(which python3)"
echo "啟動 table_visualizer_gui.py ...（關閉視窗即結束）"
echo "--------------------------------------------------"

python3 table_visualizer_gui.py
status=$?

echo "--------------------------------------------------"
if [ $status -eq 0 ]; then
    echo "程式正常結束（exit code = 0）"
else
    echo "程式異常結束（exit code = $status）— 請檢查上方錯誤訊息"
fi
echo "按任意鍵關閉此視窗 ..."
read -r -n 1 -s
