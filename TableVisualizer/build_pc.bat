@echo off
setlocal
cd /d "%~dp0"

echo Creating python virtual environment...
python -m venv venv
call venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements.txt
pip install pyinstaller pywin32

echo Cleaning previous PC builds...
if exist build rd /s /q build
if exist dist\pc rd /s /q dist\pc
if exist *.spec del /q *.spec

echo Building Windows Application (Single File)...
REM Build args are appended into one variable to avoid fragile caret line breaks.
REM This project only uses openpyxl / PyQt6 / pywin32. pandas, numpy, matplotlib,
REM networkx, etc. are never imported and are excluded to shrink the output.
set "ARGS=--noconfirm --clean --onefile --windowed --name TableVisualizer"
set "ARGS=%ARGS% --distpath dist/pc"
set ARGS=%ARGS% --add-data "excel_structure.json;."
set ARGS=%ARGS% --add-data "relationship_graph.json;."
set ARGS=%ARGS% --add-data "gui_config.json;."
set "ARGS=%ARGS% --hidden-import openpyxl --hidden-import win32com --hidden-import pythoncom"
set "ARGS=%ARGS% --exclude-module pandas --exclude-module numpy --exclude-module matplotlib"
set "ARGS=%ARGS% --exclude-module networkx --exclude-module scipy --exclude-module PIL"
set "ARGS=%ARGS% --exclude-module tkinter --exclude-module test --exclude-module unittest --exclude-module pydoc"
set "ARGS=%ARGS% --exclude-module PyQt6.QtWebEngineCore --exclude-module PyQt6.QtWebEngineWidgets"
set "ARGS=%ARGS% --exclude-module PyQt6.QtMultimedia --exclude-module PyQt6.QtMultimediaWidgets"
set "ARGS=%ARGS% --exclude-module PyQt6.QtQml --exclude-module PyQt6.QtQuick --exclude-module PyQt6.QtQuick3D"
set "ARGS=%ARGS% --exclude-module PyQt6.Qt3DCore --exclude-module PyQt6.QtSql --exclude-module PyQt6.QtTest"
set "ARGS=%ARGS% --exclude-module PyQt6.QtBluetooth --exclude-module PyQt6.QtPositioning --exclude-module PyQt6.QtSensors"
set "ARGS=%ARGS% --exclude-module PyQt6.QtSerialPort --exclude-module PyQt6.QtDesigner --exclude-module PyQt6.QtHelp"

pyinstaller %ARGS% table_visualizer_gui.py

echo Build complete!
echo You can find the single-file application at 'dist\pc\TableVisualizer.exe'.
pause
