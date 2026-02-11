@echo off
cd /d "%~dp0"

echo Creating python virtual environment...
python -m venv venv
call venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements.txt
pip install pyinstaller pywin32

echo Cleaning previous PC builds...
rd /s /q build
rd /s /q dist\pc
del *.spec

echo Building Windows Application (Folder with Internal Libs)...
pyinstaller --noconfirm --onedir --windowed --name "TableVisualizer" ^
    --distpath "dist/pc" ^
    --contents-directory "internal" ^
    --add-data "excel_structure.json;." ^
    --add-data "relationship_graph.json;." ^
    --add-data "gui_config.json;." ^
    --hidden-import "openpyxl" ^
    --hidden-import "pandas" ^
    --hidden-import "PyQt6" ^
    --hidden-import "win32com" ^
    --hidden-import "pythoncom" ^
    table_visualizer_gui.py

echo Build complete!
echo You can find the application in the 'dist/pc' folder.
pause
