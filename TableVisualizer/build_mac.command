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

echo "Building Mac Application (App Bundle)..."
pyinstaller --noconfirm --onedir --windowed --name "TableVisualizer" \
    --distpath "dist/mac" \
    --add-data "excel_structure.json:." \
    --add-data "relationship_graph.json:." \
    --add-data "gui_config.json:." \
    --hidden-import "openpyxl" \
    --hidden-import "pandas" \
    --hidden-import "PyQt6" \
    table_visualizer_gui.py

echo "Build complete!"
echo "You can find the application in the 'dist/mac' folder."
