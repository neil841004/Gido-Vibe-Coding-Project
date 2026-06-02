#!/bin/bash
set -e

# Navigate to the script's directory
cd "$(dirname "$0")"

echo "Creating python virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt
pip install pyinstaller

echo "Cleaning previous Mac builds..."
rm -rf build dist/mac *.spec

echo "Building Mac Application (Single-File App Bundle)..."
# --onefile 搭配 --windowed：產生 .app，但其內部僅含單一 onefile 執行檔，
# 檔案數量最少、體積最小，方便用 Git 上傳。
# 本專案實際只用到 openpyxl / PyQt6；pandas、numpy、matplotlib、networkx
# 等並未被任何程式碼 import，全部排除以大幅縮小檔案。
pyinstaller --noconfirm --clean --onefile --windowed --name "TableVisualizer" \
    --distpath "dist/mac" \
    --add-data "excel_structure.json:." \
    --add-data "relationship_graph.json:." \
    --add-data "gui_config.json:." \
    --hidden-import "openpyxl" \
    --exclude-module "pandas" \
    --exclude-module "numpy" \
    --exclude-module "matplotlib" \
    --exclude-module "networkx" \
    --exclude-module "scipy" \
    --exclude-module "PIL" \
    --exclude-module "tkinter" \
    --exclude-module "test" \
    --exclude-module "unittest" \
    --exclude-module "pydoc" \
    --exclude-module "PyQt6.QtWebEngineCore" \
    --exclude-module "PyQt6.QtWebEngineWidgets" \
    --exclude-module "PyQt6.QtMultimedia" \
    --exclude-module "PyQt6.QtMultimediaWidgets" \
    --exclude-module "PyQt6.QtQml" \
    --exclude-module "PyQt6.QtQuick" \
    --exclude-module "PyQt6.QtQuick3D" \
    --exclude-module "PyQt6.Qt3DCore" \
    --exclude-module "PyQt6.QtSql" \
    --exclude-module "PyQt6.QtTest" \
    --exclude-module "PyQt6.QtBluetooth" \
    --exclude-module "PyQt6.QtPositioning" \
    --exclude-module "PyQt6.QtSensors" \
    --exclude-module "PyQt6.QtSerialPort" \
    --exclude-module "PyQt6.QtDesigner" \
    --exclude-module "PyQt6.QtHelp" \
    table_visualizer_gui.py

echo "Build complete!"
echo "You can find the application bundle at 'dist/mac/TableVisualizer.app'."
